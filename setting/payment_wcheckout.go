package setting

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
)

// WCheckout (stablecoin payment) configuration. Mirrors the Waffo layout in
// payment_waffo.go: package-level vars for fast access, mutating via the option
// API in model.UpdateOption.
var (
	WCheckoutEnabled          bool
	WCheckoutSandbox          bool   = true
	WCheckoutApiKey           string // production credentials
	WCheckoutApiSecret        string
	WCheckoutSignKey          string
	WCheckoutSandboxApiKey    string // sandbox credentials
	WCheckoutSandboxApiSecret string
	WCheckoutSandboxSignKey   string
	WCheckoutMerchantId       string
	WCheckoutNotifyUrl        string
	WCheckoutReturnUrl        string
	WCheckoutUnitPrice        float64 = 1.0  // USD per quota unit
	WCheckoutMinTopUp         int     = 1    // minimum top-up amount (quota units)
	WCheckoutExpiredIn        int     = 1800 // payment expiry (seconds)
)

// GetWCheckoutTokens reads the admin-configured enabled token list. When unset
// or invalid, all WCheckout-supported tokens are exposed.
func GetWCheckoutTokens() []constant.WCheckoutToken {
	common.OptionMapRWMutex.RLock()
	jsonStr := common.OptionMap["WCheckoutEnabledTokens"]
	common.OptionMapRWMutex.RUnlock()

	if jsonStr == "" {
		return copyDefaultWCheckoutTokens()
	}
	var tokens []constant.WCheckoutToken
	if err := common.UnmarshalJsonStr(jsonStr, &tokens); err != nil {
		return copyDefaultWCheckoutTokens()
	}
	if len(tokens) == 0 {
		return copyDefaultWCheckoutTokens()
	}
	return tokens
}

// IsWCheckoutTokenAllowed reports whether token is in the admin-enabled list.
// Used by the order-create handler to guard against arbitrary token strings.
func IsWCheckoutTokenAllowed(token string) bool {
	for _, t := range GetWCheckoutTokens() {
		if t.Token == token {
			return true
		}
	}
	return false
}

// SetWCheckoutTokens persists the enabled-token list back into OptionMap.
func SetWCheckoutTokens(tokens []constant.WCheckoutToken) error {
	jsonBytes, err := common.Marshal(tokens)
	if err != nil {
		return err
	}
	common.OptionMapRWMutex.Lock()
	common.OptionMap["WCheckoutEnabledTokens"] = string(jsonBytes)
	common.OptionMapRWMutex.Unlock()
	return nil
}

func copyDefaultWCheckoutTokens() []constant.WCheckoutToken {
	cp := make([]constant.WCheckoutToken, len(constant.DefaultWCheckoutTokens))
	copy(cp, constant.DefaultWCheckoutTokens)
	return cp
}

// WCheckoutTokens2JsonString serialises the default token list for
// InitOptionMap.
func WCheckoutTokens2JsonString() string {
	jsonBytes, err := common.Marshal(constant.DefaultWCheckoutTokens)
	if err != nil {
		return "[]"
	}
	return string(jsonBytes)
}
