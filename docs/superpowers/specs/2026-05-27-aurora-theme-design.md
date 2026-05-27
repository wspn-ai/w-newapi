# Aurora Theme — Design Spec

**Date:** 2026-05-27
**Status:** Approved (design)
**Author:** Jayke + Claude

## Goal

Add a third, fully-selectable website theme named **aurora** to w-newapi,
alongside the existing `default` and `classic` themes. Aurora is a
crypto/fintech-flavored visual identity (electric indigo + cyan on deep navy,
"Crypto Indigo" palette) appropriate for an AI API gateway with stablecoin
payments.

The theme must be **isolated from upstream** so syncing QuantumNous/new-api
stays low-conflict and PR-friendly. All new code lives in a new `web/aurora/`
directory; upstream files are touched only with minimal additive edits.

## Approach (decided)

Seed `web/aurora/` by **copying `web/default/`** (React 19 + Rsbuild + Base UI
+ Tailwind), then restyle. This is the only realistic path to a working,
feature-complete third theme — a from-scratch build is infeasible. The copy is
a deliberate fork of `default`; upstream improvements to `default` must be
manually ported (documented in FORK_SYNC.md).

**Restyle depth:** design tokens + layout shell (NOT deep per-page component
rework, which is deferred to a later phase).

## Visual System — "Crypto Indigo"

OKLCH tokens, applied as the theme's base palette (light + dark). Values are
the implementation target; minor tuning during build is acceptable.

| Role | Dark (primary mode) | Light |
|------|---------------------|-------|
| `--primary` | `oklch(0.66 0.20 280)` | `oklch(0.55 0.22 280)` |
| `--primary-foreground` | `oklch(0.16 0.02 280)` | `oklch(1 0 0)` |
| `--secondary` / accent | `oklch(0.70 0.15 210)` | `oklch(0.62 0.16 210)` |
| `--background` | `oklch(0.16 0.03 265)` | `oklch(0.99 0.004 265)` |
| `--card` / surface | `oklch(0.20 0.035 265)` | `oklch(1 0 0)` |
| `--border` | `oklch(0.30 0.03 265)` | `oklch(0.92 0.01 265)` |
| `--ring` | `oklch(0.66 0.20 280)` | `oklch(0.55 0.22 280)` |
| `--radius` | `0.625rem` | same |
| Brand gradient | `linear-gradient(135deg, var(--primary), var(--secondary))` (indigo → cyan) |

- Sidebar accent / active state, primary CTAs, logo mark, and home hero use
  the indigo→cyan brand gradient.
- `chart-1..5` derived from the indigo/cyan family.
- Dark mode is the default/primary experience; light mode fully supported.

**Typography:** keep `default`'s existing font stack (humanist sans / serif
axis) for this phase. A geometric display font (e.g. Space Grotesk) for
headings is explicitly out of scope for now.

## Layout Shell Restyle (scope of this phase)

Relative to copied `default`:

1. **Top navigation** — glass surface (translucent + backdrop blur), 1px
   gradient bottom border.
2. **Sidebar** — active item uses indigo→cyan gradient indicator + subtle
   glow; restyled hover/active states.
3. **Home hero** — aurora radial-glow gradient background + gradient headline,
   echoing the "aurora" name.
4. **Wallet & payment cards** — dark glass cards, gradient primary buttons
   (consistent with the existing WCheckout flow).

All other pages inherit the new tokens automatically (colors/radius/shadows)
without structural changes.

## Backend / Build Integration (upstream touchpoints — additive only)

| File | Change |
|------|--------|
| `main.go` | Add `//go:embed web/aurora/dist` + `auroraBuildFS` var + `//go:embed web/aurora/dist/index.html` + `auroraIndexPage`; pass both into the `ThemeAssets` literal. |
| `router/web-router.go` | Extend `ThemeAssets` struct with `AuroraBuildFS` + `AuroraIndexPage`; build `auroraFS` and pass to the theme-aware FS; serve `auroraIndexPage` in `NoRoute` when theme is `aurora`. |
| `common/embed-file-system.go` | Extend `themeAwareFileSystem` to hold a third (`auroraFS`) and return it when `GetTheme() == "aurora"`. |
| `common/constants.go` | `SetTheme` must accept `"aurora"` (in addition to `default`/`classic`). |
| `Dockerfile` | Add a `builder-aurora` stage (mirrors `builder`) + `COPY --from=builder-aurora /build/dist ./web/aurora/dist` into the Go build stage. |
| `.github/workflows/release.yml` | Add aurora build steps mirroring the default-theme steps. |
| Theme selector UI (`web/*/system-settings/site`) | Add `aurora` as an option in the frontend-theme dropdown so admins can select it. |

These are the documented fork "hotspot" files. Each edit is a pure addition
(new var / new struct field / new switch branch / new build stage), never a
modification of existing default/classic logic — minimizing merge conflicts.

## Fork Maintenance

Add a note to `FORK_SYNC.md`: `web/aurora` is a fork of `web/default`.
Upstream changes to `web/default` do not flow into aurora automatically; port
them manually when desired. Aurora's distinct files never conflict with
upstream; only the ~7 integration touchpoints above need additive re-merge on
upstream sync.

## Out of Scope (this phase)

- Deep per-page component redesign (playground, dashboard, pricing, etc.) —
  these inherit tokens but keep default's structure. Deferred to a later
  phase.
- Geometric display font for headings.
- Classic-theme changes (aurora seeds from default only).

## Success Criteria

1. `web/aurora` builds cleanly (`bun run build`).
2. Setting frontend theme to `aurora` serves the aurora app; `default` and
   `classic` still work unchanged.
3. Aurora renders the Crypto Indigo palette across all pages (light + dark).
4. Top nav, sidebar, home hero, and wallet/payment cards reflect the restyled
   shell.
5. Full `go build ./...` succeeds with all three themes embedded.
6. Docker image builds with the new aurora stage.
