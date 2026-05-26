package service

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha512"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
)

// WCheckout API hosts. Sandbox is preferred while integrating; production must
// be enabled explicitly by toggling the WCheckoutSandbox option to false.
const (
	wcheckoutSandboxBaseURL    = "https://openapi.dev.stablelink.app"
	wcheckoutProductionBaseURL = "https://openapi.stablelink.app"

	// Webhook clock-skew tolerance documented at
	// https://developer.wcheckout.app/7443464m0 (±2 minutes).
	wcheckoutWebhookSkew = 2 * time.Minute

	// Default HTTP timeout for outbound WCheckout calls.
	wcheckoutHTTPTimeout = 15 * time.Second

	// Refresh the access token this far before expiry to avoid using a stale one.
	wcheckoutTokenSkew = 5 * time.Minute
)

// WCheckoutOrderStatus values returned by the order info endpoint and webhook
// payloads. Documented in https://developer.wcheckout.app/7445736m0.
const (
	WCheckoutOrderStatusPaying          = "PAYING"
	WCheckoutOrderStatusPaid            = "PAID"
	WCheckoutOrderStatusCancelled       = "CANCELLED"
	WCheckoutOrderStatusRefunding       = "REFUNDING"
	WCheckoutOrderStatusPartialRefunded = "PARTIAL_REFUNDED"
	WCheckoutOrderStatusRefunded        = "REFUNDED"
	WCheckoutOrderStatusTimeout         = "TIMEOUT"
)

// WCheckout event types delivered via webhook.
const (
	WCheckoutEventCheckoutOrderChanged   = "CHECKOUT_ORDER_CHANGED"
	WCheckoutEventRefundOrderChanged     = "REFUND_ORDER_CHANGED"
	WCheckoutEventSettlementOrderChanged = "SETTLEMENT_ORDER_CHANGED"
	WCheckoutEventAbnormalPayment        = "ABNORMAL_PAYMENT"
)

// WCheckoutClient encapsulates one set of credentials and a base URL plus a
// cached OAuth2 access token. The zero value is unusable — always go through
// NewWCheckoutClient or GetWCheckoutClient.
type WCheckoutClient struct {
	baseURL    string
	apiKey     string
	apiSecret  string
	signKey    string
	merchantID string

	httpClient *http.Client

	tokenMu        sync.Mutex
	cachedToken    string
	tokenExpiresAt time.Time
}

// GetWCheckoutClient returns a client built from the currently active settings
// (sandbox vs production). Callers should not cache the returned client across
// configuration changes.
func GetWCheckoutClient() (*WCheckoutClient, error) {
	apiKey := setting.WCheckoutSandboxApiKey
	apiSecret := setting.WCheckoutSandboxApiSecret
	signKey := setting.WCheckoutSandboxSignKey
	baseURL := wcheckoutSandboxBaseURL
	if !setting.WCheckoutSandbox {
		apiKey = setting.WCheckoutApiKey
		apiSecret = setting.WCheckoutApiSecret
		signKey = setting.WCheckoutSignKey
		baseURL = wcheckoutProductionBaseURL
	}
	if strings.TrimSpace(apiKey) == "" || strings.TrimSpace(apiSecret) == "" || strings.TrimSpace(signKey) == "" {
		return nil, errors.New("WCheckout 凭证未配置完整 (apiKey/apiSecret/signKey)")
	}
	return &WCheckoutClient{
		baseURL:    baseURL,
		apiKey:     apiKey,
		apiSecret:  apiSecret,
		signKey:    signKey,
		merchantID: setting.WCheckoutMerchantId,
		httpClient: &http.Client{Timeout: wcheckoutHTTPTimeout},
	}, nil
}

// VerifyWebhookSignature checks the SIGNATURE/TIMESTAMP headers on an inbound
// webhook against the configured signKey. The TIMESTAMP must be within the
// documented ±2-minute window.
//
// Per https://developer.wcheckout.app/7443464m0:
//   signature = Base64(HMAC_SHA512(signKey, TIMESTAMP + body))
func VerifyWCheckoutWebhookSignature(signature, timestamp string, body []byte) error {
	if signature == "" || timestamp == "" {
		return errors.New("缺少 SIGNATURE 或 TIMESTAMP 头")
	}
	tsMs, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return fmt.Errorf("TIMESTAMP 格式错误: %w", err)
	}
	if diff := time.Since(time.UnixMilli(tsMs)); diff > wcheckoutWebhookSkew || diff < -wcheckoutWebhookSkew {
		return fmt.Errorf("TIMESTAMP 超出 ±%s 容差", wcheckoutWebhookSkew)
	}
	key := setting.WCheckoutSandboxSignKey
	if !setting.WCheckoutSandbox {
		key = setting.WCheckoutSignKey
	}
	if strings.TrimSpace(key) == "" {
		return errors.New("signKey 未配置")
	}
	mac := hmac.New(sha512.New, []byte(key))
	mac.Write([]byte(timestamp))
	mac.Write(body)
	expected := base64.StdEncoding.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(expected), []byte(signature)) {
		return errors.New("签名校验失败")
	}
	return nil
}

// wcheckoutTokenResponse is the response shape of /user/auth/oauth2/token.
type wcheckoutTokenResponse struct {
	Retcode string `json:"retcode"`
	Retmsg  string `json:"retmsg"`
	Retdata struct {
		AccessToken  string `json:"access_token"`
		TokenType    string `json:"token_type"`
		ExpiresIn    int    `json:"expires_in"`
		RefreshToken string `json:"refresh_token"`
		RtExpiresIn  int    `json:"rt_expires_in"`
	} `json:"retdata"`
}

// accessToken returns a cached token if still valid, otherwise fetches a new
// one via the client_credentials grant.
func (c *WCheckoutClient) accessToken(ctx context.Context) (string, error) {
	c.tokenMu.Lock()
	defer c.tokenMu.Unlock()

	if c.cachedToken != "" && time.Now().Add(wcheckoutTokenSkew).Before(c.tokenExpiresAt) {
		return c.cachedToken, nil
	}

	q := url.Values{}
	q.Set("grant_type", "client_credentials")
	q.Set("api_key", c.apiKey)
	q.Set("api_secret", c.apiSecret)
	endpoint := fmt.Sprintf("%s/user/auth/oauth2/token?%s", c.baseURL, q.Encode())

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, nil)
	if err != nil {
		return "", err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("请求 access_token 失败: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("读取 access_token 响应失败: %w", err)
	}
	var parsed wcheckoutTokenResponse
	if err := common.Unmarshal(raw, &parsed); err != nil {
		return "", fmt.Errorf("解析 access_token 响应失败: %w body=%s", err, string(raw))
	}
	if parsed.Retcode != "200" || parsed.Retdata.AccessToken == "" {
		return "", fmt.Errorf("获取 access_token 业务失败: retcode=%s retmsg=%s", parsed.Retcode, parsed.Retmsg)
	}

	c.cachedToken = parsed.Retdata.AccessToken
	c.tokenExpiresAt = time.Now().Add(time.Duration(parsed.Retdata.ExpiresIn) * time.Second)
	return c.cachedToken, nil
}

// signRequest computes the WCheckout request signature documented at
// https://developer.wcheckout.app/7441280m0:
//
//	signature = Base64(HMAC_SHA512(signKey, METHOD + TIMESTAMP + URI + QueryString + Body))
//
// QueryString is the raw query (no leading '?'), Body is the raw JSON payload
// or empty for requests without a body. TIMESTAMP is the same millisecond
// value sent in the TIMESTAMP header.
func (c *WCheckoutClient) signRequest(method, path, queryStr string, bodyBytes []byte, timestamp string) string {
	mac := hmac.New(sha512.New, []byte(c.signKey))
	mac.Write([]byte(method))
	mac.Write([]byte(timestamp))
	mac.Write([]byte(path))
	mac.Write([]byte(queryStr))
	mac.Write(bodyBytes)
	return base64.StdEncoding.EncodeToString(mac.Sum(nil))
}

// doRequest issues an authenticated REST call and decodes the response into
// out. body may be nil for GET requests. Every call carries both the
// Authorization Bearer token AND the WCheckout SIGNATURE/TIMESTAMP headers;
// the gateway rejects unsigned calls with retcode=00006 "Access denied:
// Missing header [SIGNATURE]".
func (c *WCheckoutClient) doRequest(ctx context.Context, method, path string, query url.Values, body interface{}, out interface{}) error {
	token, err := c.accessToken(ctx)
	if err != nil {
		return err
	}

	queryStr := ""
	if len(query) > 0 {
		queryStr = query.Encode()
	}
	endpoint := c.baseURL + path
	if queryStr != "" {
		endpoint += "?" + queryStr
	}

	var bodyBytes []byte
	if body != nil {
		raw, mErr := common.Marshal(body)
		if mErr != nil {
			return fmt.Errorf("序列化请求体失败: %w", mErr)
		}
		bodyBytes = raw
	}

	var bodyReader io.Reader
	if bodyBytes != nil {
		bodyReader = bytes.NewReader(bodyBytes)
	}

	req, err := http.NewRequestWithContext(ctx, method, endpoint, bodyReader)
	if err != nil {
		return err
	}

	timestamp := strconv.FormatInt(time.Now().UnixMilli(), 10)
	signature := c.signRequest(method, path, queryStr, bodyBytes, timestamp)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("SIGNATURE", signature)
	req.Header.Set("TIMESTAMP", timestamp)
	if bodyBytes != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("WCheckout 请求失败: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("读取响应失败: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("WCheckout HTTP %d: %s", resp.StatusCode, string(raw))
	}
	if out != nil {
		if err := common.Unmarshal(raw, out); err != nil {
			return fmt.Errorf("解析响应失败: %w body=%s", err, string(raw))
		}
	}
	return nil
}

// ---------------------------------------------------------------------------
// CreateCheckoutOrder
// ---------------------------------------------------------------------------

// WCheckoutCreateOrderRequest carries the fields documented at
// https://developer.wcheckout.app/354524812e0.
type WCheckoutCreateOrderRequest struct {
	OrderNo         string  `json:"orderNo"`
	OrderAmount     float64 `json:"orderAmount"`
	CustomerID      string  `json:"customerId"`
	Token           string  `json:"token"`
	ExpiredIn       int     `json:"expiredIn"`
	PcCallbackURL   string  `json:"pcCallbackUrl"`
	AppCallbackURL  string  `json:"appCallbackUrl"`
	MerchantID      string  `json:"merchantId,omitempty"`
	Fiat            string  `json:"fiat,omitempty"`
}

// WCheckoutCreateOrderResponse is the unwrapped success payload.
type WCheckoutCreateOrderResponse struct {
	Sysid          string  `json:"sysid"`
	OrderNo        string  `json:"orderNo"`
	PayingAmount   float64 `json:"payingAmount"`
	Token          string  `json:"token"`
	CoinAddress    string  `json:"coinAddress"`
	ExchangeRate   float64 `json:"exchangeRate"`
	DepositAddress string  `json:"depositAddress"`
	CustomerID     string  `json:"customerId"`
	MerchantID     string  `json:"merchantId"`
	PaymentURL     string  `json:"paymentUrl"`
	ExpiredIn      int     `json:"expiredIn"`
}

// CreateCheckoutOrder calls POST /checkout/order/create.
func (c *WCheckoutClient) CreateCheckoutOrder(ctx context.Context, req *WCheckoutCreateOrderRequest) (*WCheckoutCreateOrderResponse, error) {
	if req.MerchantID == "" && c.merchantID != "" {
		req.MerchantID = c.merchantID
	}
	var envelope struct {
		Retcode string                       `json:"retcode"`
		Retmsg  string                       `json:"retmsg"`
		Retdata WCheckoutCreateOrderResponse `json:"retdata"`
	}
	if err := c.doRequest(ctx, http.MethodPost, "/checkout/order/create", nil, req, &envelope); err != nil {
		return nil, err
	}
	if envelope.Retcode != "200" {
		return nil, fmt.Errorf("创建订单业务失败: retcode=%s retmsg=%s", envelope.Retcode, envelope.Retmsg)
	}
	return &envelope.Retdata, nil
}

// ---------------------------------------------------------------------------
// GetCheckoutOrderInfo
// ---------------------------------------------------------------------------

// WCheckoutOrderInfo is the order detail returned by /checkout/order/info.
type WCheckoutOrderInfo struct {
	Sysid          string  `json:"sysid"`
	OrderNo        string  `json:"orderNo"`
	OrderAmount    float64 `json:"orderAmount"`
	PayingAmount   float64 `json:"payingAmount"`
	CustomerID     string  `json:"customerId"`
	MerchantID     string  `json:"merchantId"`
	Token          string  `json:"token"`
	TxHash         string  `json:"txHash"`
	DepositAddress string  `json:"depositAddress"`
	OrderStatus    string  `json:"orderStatus"`
	RefundedAmount float64 `json:"refundedAmount"`
	CreatedTime    string  `json:"createdTime"`
	UpdatedTime    string  `json:"updatedTime"`
}

// GetCheckoutOrderInfo calls GET /checkout/order/info.
func (c *WCheckoutClient) GetCheckoutOrderInfo(ctx context.Context, orderNo string) (*WCheckoutOrderInfo, error) {
	q := url.Values{}
	q.Set("orderNo", orderNo)
	var envelope struct {
		Retcode string             `json:"retcode"`
		Retmsg  string             `json:"retmsg"`
		Retdata WCheckoutOrderInfo `json:"retdata"`
	}
	if err := c.doRequest(ctx, http.MethodGet, "/checkout/order/info", q, nil, &envelope); err != nil {
		return nil, err
	}
	if envelope.Retcode != "200" {
		return nil, fmt.Errorf("查询订单业务失败: retcode=%s retmsg=%s", envelope.Retcode, envelope.Retmsg)
	}
	return &envelope.Retdata, nil
}

// CancelCheckoutOrder calls GET /checkout/order/cancel.
func (c *WCheckoutClient) CancelCheckoutOrder(ctx context.Context, orderNo string) error {
	q := url.Values{}
	q.Set("orderNo", orderNo)
	var envelope struct {
		Retcode string `json:"retcode"`
		Retmsg  string `json:"retmsg"`
	}
	if err := c.doRequest(ctx, http.MethodGet, "/checkout/order/cancel", q, nil, &envelope); err != nil {
		return err
	}
	if envelope.Retcode != "200" {
		return fmt.Errorf("取消订单业务失败: retcode=%s retmsg=%s", envelope.Retcode, envelope.Retmsg)
	}
	return nil
}
