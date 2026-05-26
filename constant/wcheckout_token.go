package constant

// WCheckoutToken describes a stablecoin option presented to the user on the
// top-up page. The Token field is the WCheckout API identifier
// ({CHAIN}_{TOKEN}); Name and Icon are for frontend display only.
type WCheckoutToken struct {
	Name  string `json:"name"`
	Token string `json:"token"`
	Icon  string `json:"icon"`
}

// DefaultWCheckoutTokens lists every stablecoin WCheckout currently supports.
// Administrators can override the enabled subset via the WCheckoutEnabledTokens
// option. Keep this list aligned with the WCheckout overview documentation:
// https://developer.wcheckout.app/7440725m0
var DefaultWCheckoutTokens = []WCheckoutToken{
	{Name: "USDT (Ethereum)", Token: "ETH_USDT", Icon: "/pay-usdt.png"},
	{Name: "USDC (Ethereum)", Token: "ETH_USDC", Icon: "/pay-usdc.png"},
	{Name: "WUSD (Ethereum)", Token: "ETH_WUSD", Icon: "/pay-wusd.png"},
	{Name: "USDT (TRON)", Token: "TRON_USDT", Icon: "/pay-usdt.png"},
	{Name: "USDC (TRON)", Token: "TRON_USDC", Icon: "/pay-usdc.png"},
	{Name: "WUSD (TRON)", Token: "TRON_WUSD", Icon: "/pay-wusd.png"},
	{Name: "USDT (Solana)", Token: "SOL_USDT", Icon: "/pay-usdt.png"},
	{Name: "USDC (Solana)", Token: "SOL_USDC", Icon: "/pay-usdc.png"},
	{Name: "WUSD (Solana)", Token: "SOL_WUSD", Icon: "/pay-wusd.png"},
}
