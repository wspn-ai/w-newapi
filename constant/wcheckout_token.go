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
// Identifiers and supported chain/token matrix per WCheckout docs:
//   Ethereum: USDT, USDC, WUSD  (prefix "ETH_")
//   TRON:     USDT, USDC        (prefix "TRX_", not "TRON_")
//   Solana:   USDT, USDC        (prefix "SOL_")
// WUSD (WSPN-issued) is currently Ethereum-only.
var DefaultWCheckoutTokens = []WCheckoutToken{
	{Name: "WUSD (Ethereum)", Token: "ETH_WUSD"},
	{Name: "USDC (Ethereum)", Token: "ETH_USDC"},
	{Name: "USDC (TRON)", Token: "TRX_USDC"},
	{Name: "USDC (Solana)", Token: "SOL_USDC"},
	{Name: "USDT (Ethereum)", Token: "ETH_USDT"},
	{Name: "USDT (TRON)", Token: "TRX_USDT"},
	{Name: "USDT (Solana)", Token: "SOL_USDT"},
}
