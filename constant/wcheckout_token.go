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
// Administrators can override the enabled subset (and upload icons) via the
// WCheckoutEnabledTokens option. Keep this list aligned with the WCheckout
// overview documentation: https://developer.wcheckout.app/7440725m0
//
// Icon paths are intentionally empty — frontends render a fallback glyph when
// Icon is blank. Administrators may attach custom icon URLs/paths via the
// admin token editor.
var DefaultWCheckoutTokens = []WCheckoutToken{
	{Name: "USDT (Ethereum)", Token: "ETH_USDT"},
	{Name: "USDC (Ethereum)", Token: "ETH_USDC"},
	{Name: "WUSD (Ethereum)", Token: "ETH_WUSD"},
	{Name: "USDT (TRON)", Token: "TRON_USDT"},
	{Name: "USDC (TRON)", Token: "TRON_USDC"},
	{Name: "WUSD (TRON)", Token: "TRON_WUSD"},
	{Name: "USDT (Solana)", Token: "SOL_USDT"},
	{Name: "USDC (Solana)", Token: "SOL_USDC"},
	{Name: "WUSD (Solana)", Token: "SOL_WUSD"},
}
