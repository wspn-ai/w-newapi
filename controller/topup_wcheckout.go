package controller

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/thanhpk/randstr"
)

// WCheckoutPayRequest is the JSON body the frontend submits when pulling up a
// WCheckout payment session.
type WCheckoutPayRequest struct {
	Amount int64  `json:"amount"`
	Token  string `json:"token"` // e.g. ETH_USDT — must be present in the admin-enabled list
}

// getWCheckoutPayMoney converts the user-facing top-up Amount to the USD value
// charged via WCheckout. Mirrors the Waffo helper so admins reusing the global
// AmountDiscount and topup group ratio see consistent pricing.
func getWCheckoutPayMoney(amount float64, group string) float64 {
	originalAmount := amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		amount = amount / common.QuotaPerUnit
	}
	topupGroupRatio := common.GetTopupGroupRatio(group)
	if topupGroupRatio == 0 {
		topupGroupRatio = 1
	}
	discount := 1.0
	if ds, ok := operation_setting.GetPaymentSetting().AmountDiscount[int(originalAmount)]; ok {
		if ds > 0 {
			discount = ds
		}
	}
	return amount * setting.WCheckoutUnitPrice * topupGroupRatio * discount
}

// RequestWCheckoutAmount returns the USD cost (string, 2 dp) for the requested
// quota amount so the frontend can show a preview before placing the order.
func RequestWCheckoutAmount(c *gin.Context) {
	var req WCheckoutPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}

	minTopup := int64(setting.WCheckoutMinTopUp)
	if req.Amount < minTopup {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", minTopup)})
		return
	}

	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}

	payMoney := getWCheckoutPayMoney(float64(req.Amount), group)
	if payMoney <= 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "success", "data": strconv.FormatFloat(payMoney, 'f', 2, 64)})
}

// RequestWCheckoutPay creates a WCheckout payment order and returns the
// hosted-page URL the frontend should iframe-load.
func RequestWCheckoutPay(c *gin.Context) {
	if !isWCheckoutTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "WCheckout 支付未启用"})
		return
	}

	var req WCheckoutPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if !setting.IsWCheckoutTokenAllowed(req.Token) {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("WCheckout 不支持的代币 token=%q", req.Token))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "不支持的支付代币"})
		return
	}
	minTopup := int64(setting.WCheckoutMinTopUp)
	if req.Amount < minTopup {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", minTopup)})
		return
	}

	id := c.GetInt("id")
	user, err := model.GetUserById(id, false)
	if err != nil || user == nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "用户不存在"})
		return
	}

	group, _ := model.GetUserGroup(id, true)
	payMoney := getWCheckoutPayMoney(float64(req.Amount), group)
	if payMoney < 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	// Unique merchant order id. The same value is reused as the WCheckout
	// orderNo so log/webhook trails line up. WCheckout requires orderNo to be
	// alphanumeric only (retcode=00008), so no separators here.
	tradeNo := fmt.Sprintf("WCHK%d%d%s", id, time.Now().UnixMilli(), randstr.String(6))

	// Token mode: normalise Amount to the equivalent USD/CNY units so
	// RechargeWCheckout does not double-scale quota during settlement.
	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		amount = int64(float64(req.Amount) / common.QuotaPerUnit)
		if amount < 1 {
			amount = 1
		}
	}

	topUp := &model.TopUp{
		UserId:          id,
		Amount:          amount,
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodWCheckout,
		PaymentProvider: model.PaymentProviderWCheckout,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("WCheckout 创建充值订单失败 user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	client, err := service.GetWCheckoutClient()
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("WCheckout 客户端初始化失败 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		_ = model.UpdatePendingTopUpStatus(tradeNo, model.PaymentProviderWCheckout, common.TopUpStatusFailed)
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "支付配置错误"})
		return
	}

	returnUrl := paymentReturnPath("/console/topup?show_history=true")
	if setting.WCheckoutReturnUrl != "" {
		returnUrl = setting.WCheckoutReturnUrl
	}

	expiredIn := setting.WCheckoutExpiredIn
	if expiredIn <= 0 {
		expiredIn = 1800
	}

	createReq := &service.WCheckoutCreateOrderRequest{
		OrderNo:        tradeNo,
		OrderAmount:    payMoney,
		CustomerID:     strconv.Itoa(user.Id),
		Token:          req.Token,
		ExpiredIn:      expiredIn,
		PcCallbackURL:  returnUrl,
		AppCallbackURL: returnUrl,
		Fiat:           "USD",
	}
	if setting.WCheckoutMerchantId != "" {
		createReq.MerchantID = setting.WCheckoutMerchantId
	}

	resp, err := client.CreateCheckoutOrder(c.Request.Context(), createReq)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("WCheckout 创建订单失败 user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		_ = model.UpdatePendingTopUpStatus(tradeNo, model.PaymentProviderWCheckout, common.TopUpStatusFailed)
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("WCheckout 充值订单创建成功 user_id=%d trade_no=%s amount=%d money=%.2f token=%s paying=%.6f", id, tradeNo, req.Amount, payMoney, req.Token, resp.PayingAmount))

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"payment_url":     resp.PaymentURL,
			"order_id":        tradeNo,
			"deposit_address": resp.DepositAddress,
			"paying_amount":   resp.PayingAmount,
			"exchange_rate":   resp.ExchangeRate,
			"token":           resp.Token,
			"expired_in":      resp.ExpiredIn,
		},
	})
}

// WCheckoutWebhookEvent is the envelope shared by every WCheckout webhook
// event. The data field's concrete shape depends on eventType.
type WCheckoutWebhookEvent struct {
	EventID   string                 `json:"eventId"`
	EventType string                 `json:"eventType"`
	Timestamp int64                  `json:"timestamp"`
	Data      map[string]interface{} `json:"data"`
}

// WCheckoutWebhook is the unauthenticated endpoint WCheckout calls to deliver
// order/refund/abnormal-payment events.
//
// Security model:
//   - Signature is verified against the configured signKey (HMAC-SHA512).
//   - TIMESTAMP must be within ±2 min of server time.
//   - Replay protection: idempotency is enforced by RechargeWCheckout
//     (status check inside a row-locked transaction).
func WCheckoutWebhook(c *gin.Context) {
	if !isWCheckoutWebhookEnabled() {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("WCheckout webhook 被拒绝 reason=webhook_disabled path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		c.AbortWithStatus(http.StatusForbidden)
		return
	}

	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("WCheckout webhook 读取请求体失败 path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	signature := c.GetHeader("SIGNATURE")
	timestamp := c.GetHeader("TIMESTAMP")
	if err := service.VerifyWCheckoutWebhookSignature(signature, timestamp, body); err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("WCheckout webhook 验签失败 path=%q client_ip=%s signature=%q timestamp=%q error=%q body=%q", c.Request.RequestURI, c.ClientIP(), signature, timestamp, err.Error(), string(body)))
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	var event WCheckoutWebhookEvent
	if err := common.Unmarshal(body, &event); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("WCheckout webhook 解析失败 path=%q client_ip=%s error=%q body=%q", c.Request.RequestURI, c.ClientIP(), err.Error(), string(body)))
		sendWCheckoutWebhookResponse(c, false, "invalid payload")
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("WCheckout webhook 收到事件 event_id=%s event_type=%s client_ip=%s", event.EventID, event.EventType, c.ClientIP()))

	switch event.EventType {
	case service.WCheckoutEventCheckoutOrderChanged:
		handleWCheckoutOrderChanged(c, &event)
	default:
		// Refund / settlement / abnormal-payment events are acknowledged but
		// not actioned on the top-up path. Settlement/refund flows are
		// merchant-side concerns handled out-of-band.
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("WCheckout webhook 忽略事件 event_id=%s event_type=%s", event.EventID, event.EventType))
		sendWCheckoutWebhookResponse(c, true, "ignored")
	}
}

func handleWCheckoutOrderChanged(c *gin.Context, event *WCheckoutWebhookEvent) {
	orderNo, _ := event.Data["orderNo"].(string)
	status, _ := event.Data["orderStatus"].(string)
	if orderNo == "" {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("WCheckout 订单事件缺少 orderNo event_id=%s data=%v", event.EventID, event.Data))
		sendWCheckoutWebhookResponse(c, false, "missing orderNo")
		return
	}

	switch status {
	case service.WCheckoutOrderStatusPaid:
		LockOrder(orderNo)
		defer UnlockOrder(orderNo)
		if err := model.RechargeWCheckout(orderNo, c.ClientIP()); err != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf("WCheckout 充值处理失败 trade_no=%s error=%q", orderNo, err.Error()))
			sendWCheckoutWebhookResponse(c, false, err.Error())
			return
		}
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("WCheckout 充值成功 trade_no=%s client_ip=%s", orderNo, c.ClientIP()))
	case service.WCheckoutOrderStatusCancelled,
		service.WCheckoutOrderStatusTimeout:
		// Mark the local order as failed so it does not linger in pending.
		if err := model.UpdatePendingTopUpStatus(orderNo, model.PaymentProviderWCheckout, common.TopUpStatusFailed); err != nil &&
			!errors.Is(err, model.ErrTopUpNotFound) &&
			!errors.Is(err, model.ErrTopUpStatusInvalid) {
			logger.LogError(c.Request.Context(), fmt.Sprintf("WCheckout 标记失败订单状态失败 trade_no=%s error=%q", orderNo, err.Error()))
		}
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("WCheckout 订单终态非成功 trade_no=%s order_status=%s", orderNo, status))
	default:
		// PAYING / REFUNDING / refund variants — informational only.
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("WCheckout 订单状态更新 trade_no=%s order_status=%s", orderNo, status))
	}

	sendWCheckoutWebhookResponse(c, true, "")
}

// sendWCheckoutWebhookResponse writes the documented {retcode, retmsg} ack
// payload. retcode is an INTEGER per docs (developer.wcheckout.app/7443464m0);
// WCheckout treats anything other than 200 as a delivery failure and retries.
func sendWCheckoutWebhookResponse(c *gin.Context, success bool, msg string) {
	if success {
		c.JSON(http.StatusOK, gin.H{"retcode": 200, "retmsg": "SUCCESS"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"retcode": 500, "retmsg": msg})
}
