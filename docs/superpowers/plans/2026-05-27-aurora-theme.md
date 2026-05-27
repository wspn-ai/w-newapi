# Aurora Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third selectable website theme `aurora` (Crypto Indigo palette), seeded from `web/default` and restyled at the tokens + layout-shell level, wired into the Go embed/routing/build pipeline.

**Architecture:** Copy `web/default/` → `web/aurora/` (a deliberate fork). Restyle base design tokens (`theme.css`) + register an `aurora` preset, then restyle the layout shell (top-nav, sidebar, home hero, wallet/payment cards). Add additive integration in `main.go`, `router/web-router.go`, `common/embed-file-system.go`, `common/constants.go`, `Dockerfile`, and `release.yml`.

**Tech Stack:** Go 1.26 (embed.FS), React 19 + Rsbuild + Base UI + Tailwind v4 (OKLCH design tokens), Bun.

**Verification model:** This is a theme (CSS/layout + build wiring), not unit-testable logic. Each task's "test" is: the relevant build succeeds and/or the server serves the right theme. Visual correctness is confirmed by running the app.

---

## File Structure

**New (zero upstream conflict):**
- `web/aurora/**` — full copy of `web/default`, restyled.

**Modified (additive upstream touchpoints):**
- `main.go` — embed aurora dist + var + ThemeAssets wiring.
- `router/web-router.go` — ThemeAssets struct + aurora FS + index serving.
- `common/embed-file-system.go` — third FS in `themeAwareFileSystem`.
- `common/constants.go` — `SetTheme` accepts `aurora`.
- `Dockerfile` — `builder-aurora` stage + COPY dist.
- `.github/workflows/release.yml` — aurora build steps.
- `FORK_SYNC.md` — aurora maintenance note.

---

## Task 1: Seed web/aurora from web/default

**Files:**
- Create: `web/aurora/**` (copy of `web/default`, excluding `node_modules`, `dist`)

- [ ] **Step 1: Copy the default theme into web/aurora**

```bash
cd /Users/jayke/Documents/CTH/GitHub/w-newapi
rsync -a --exclude node_modules --exclude dist web/default/ web/aurora/
```

- [ ] **Step 2: Install deps and build the untouched copy to confirm it's a clean seed**

```bash
cd web/aurora && bun install && bunx tsc --noEmit && bunx rsbuild build 2>&1 | tail -5
```
Expected: build succeeds, `web/aurora/dist/index.html` exists.

- [ ] **Step 3: Commit the seed**

```bash
cd /Users/jayke/Documents/CTH/GitHub/w-newapi
git add web/aurora -f
git commit -m "feat(aurora): seed web/aurora from web/default"
```
Note: `dist/` is gitignored; only source is committed. If `bun.lock` is ignored, force-add it: `git add web/aurora/bun.lock -f`.

---

## Task 2: Apply Crypto Indigo design tokens

**Files:**
- Modify: `web/aurora/src/styles/theme.css` (the `:root` light block and `.dark` block)
- Modify: `web/aurora/src/lib/theme-customization.ts` (default preset + registry)

- [ ] **Step 1: Read the current token blocks**

Run: `grep -n "^:root\|^.dark\|--primary:\|--background:\|--radius:" web/aurora/src/styles/theme.css | head -40`
Identify the `:root { ... }` (light) and `.dark { ... }` (dark) variable blocks.

- [ ] **Step 2: Overwrite the core palette variables in `:root` (light)**

In the `:root` block of `theme.css`, set:
```css
--background: oklch(0.99 0.004 265);
--foreground: oklch(0.18 0.03 265);
--card: oklch(1 0 0);
--card-foreground: oklch(0.18 0.03 265);
--primary: oklch(0.55 0.22 280);
--primary-foreground: oklch(1 0 0);
--secondary: oklch(0.62 0.16 210);
--secondary-foreground: oklch(1 0 0);
--accent: oklch(0.62 0.16 210);
--accent-foreground: oklch(1 0 0);
--border: oklch(0.92 0.01 265);
--input: oklch(0.92 0.01 265);
--ring: oklch(0.55 0.22 280);
--sidebar-primary: oklch(0.55 0.22 280);
--sidebar-accent: oklch(0.95 0.02 280);
--radius: 0.625rem;
```
Leave any variables not listed here at their copied values.

- [ ] **Step 3: Overwrite the core palette variables in `.dark`**

In the `.dark` block of `theme.css`, set:
```css
--background: oklch(0.16 0.03 265);
--foreground: oklch(0.96 0.01 265);
--card: oklch(0.20 0.035 265);
--card-foreground: oklch(0.96 0.01 265);
--primary: oklch(0.66 0.20 280);
--primary-foreground: oklch(0.16 0.02 280);
--secondary: oklch(0.70 0.15 210);
--secondary-foreground: oklch(0.16 0.02 265);
--accent: oklch(0.70 0.15 210);
--accent-foreground: oklch(0.16 0.02 265);
--border: oklch(0.30 0.03 265);
--input: oklch(0.30 0.03 265);
--ring: oklch(0.66 0.20 280);
--sidebar: oklch(0.18 0.032 265);
--sidebar-primary: oklch(0.66 0.20 280);
--sidebar-accent: oklch(0.26 0.04 280);
```

- [ ] **Step 4: Add a reusable brand-gradient token**

Append to the `:root` block (and it inherits in dark since it references vars):
```css
--brand-gradient: linear-gradient(135deg, var(--primary), var(--secondary));
```

- [ ] **Step 5: Make `aurora` the default customization preset**

In `web/aurora/src/lib/theme-customization.ts`, change `DEFAULT_THEME_CUSTOMIZATION.preset` from `'default'` to `'default'` is fine — the base tokens already ARE aurora now, so no preset override is needed. Instead set the default dark mode if a setting exists. **No code change required here unless** a `default` preset block in `theme-presets.css` overrides `theme.css`; if so, neutralize it by ensuring `[data-theme-preset='default']` is not force-applied. Verify by Step 6.

- [ ] **Step 6: Build and visually verify tokens applied**

```bash
cd web/aurora && bunx rsbuild build 2>&1 | tail -3
```
Then run the app (see Task 7 once wired, or `bunx rsbuild dev`) and confirm primary buttons are indigo, dark bg is deep navy.

- [ ] **Step 7: Commit**

```bash
git add web/aurora/src/styles/theme.css web/aurora/src/lib/theme-customization.ts
git commit -m "feat(aurora): apply Crypto Indigo design tokens"
```

---

## Task 3: Restyle top navigation (glass + gradient border)

**Files:**
- Modify: `web/aurora/src/components/layout/components/top-nav.tsx`
- Modify: `web/aurora/src/components/layout/components/navbar.tsx`

- [ ] **Step 1: Read both files to find the nav container element + its className**

Run: `sed -n '1,80p' web/aurora/src/components/layout/components/top-nav.tsx`

- [ ] **Step 2: Apply glass surface + gradient bottom border to the nav container**

On the outermost nav/header element, add Tailwind classes:
```
bg-background/70 backdrop-blur-md border-b border-transparent
[border-image:var(--brand-gradient)_1] supports-[backdrop-filter]:bg-background/60
```
If `[border-image:...]` is awkward, instead add a child accent line:
```tsx
<div className="absolute inset-x-0 bottom-0 h-px" style={{ background: 'var(--brand-gradient)' }} />
```
(ensure the nav container is `relative`).

- [ ] **Step 3: Build to verify no breakage**

```bash
cd web/aurora && bunx tsc --noEmit && bunx rsbuild build 2>&1 | tail -3
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add web/aurora/src/components/layout/components/top-nav.tsx web/aurora/src/components/layout/components/navbar.tsx
git commit -m "feat(aurora): glass top navigation with gradient accent"
```

---

## Task 4: Restyle sidebar (gradient active indicator + glow)

**Files:**
- Modify: `web/aurora/src/components/layout/components/app-sidebar.tsx`
- Modify: `web/aurora/src/components/layout/components/nav-link-item.tsx`

- [ ] **Step 1: Read nav-link-item.tsx to find the active-state styling**

Run: `sed -n '1,120p' web/aurora/src/components/layout/components/nav-link-item.tsx`

- [ ] **Step 2: Apply a gradient active indicator + subtle glow on the active link**

For the active state, add a left indicator bar and glow. Example pattern on the active `<a>`/button:
```tsx
// when active:
className={cn(
  'relative',
  isActive && 'bg-sidebar-accent text-sidebar-accent-foreground'
)}
// + an indicator element rendered when active:
{isActive && (
  <span
    className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full"
    style={{ background: 'var(--brand-gradient)', boxShadow: '0 0 12px var(--primary)' }}
  />
)}
```

- [ ] **Step 3: Build to verify**

```bash
cd web/aurora && bunx tsc --noEmit && bunx rsbuild build 2>&1 | tail -3
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add web/aurora/src/components/layout/components/app-sidebar.tsx web/aurora/src/components/layout/components/nav-link-item.tsx
git commit -m "feat(aurora): gradient sidebar active indicator with glow"
```

---

## Task 5: Restyle home hero (aurora glow + gradient headline)

**Files:**
- Modify: `web/aurora/src/features/home/components/sections/hero.tsx`
- Reuse: `web/aurora/src/components/layout/components/glow.tsx` (existing glow component)

- [ ] **Step 1: Read the hero section + glow component**

Run: `sed -n '1,140p' web/aurora/src/features/home/components/sections/hero.tsx` and `sed -n '1,60p' web/aurora/src/components/layout/components/glow.tsx`

- [ ] **Step 2: Add an aurora radial-glow background behind the hero**

Insert a decorative layer as the first child of the hero's relative container:
```tsx
<div
  aria-hidden
  className="pointer-events-none absolute inset-0 -z-10"
  style={{
    background:
      'radial-gradient(60% 50% at 50% 0%, oklch(0.66 0.20 280 / 0.25), transparent 70%),' +
      'radial-gradient(40% 40% at 80% 20%, oklch(0.70 0.15 210 / 0.18), transparent 70%)',
  }}
/>
```
Ensure the hero root has `relative overflow-hidden`.

- [ ] **Step 3: Make the headline a gradient text**

On the main `<h1>`, add:
```tsx
className="bg-clip-text text-transparent"
style={{ backgroundImage: 'var(--brand-gradient)' }}
```
Keep a solid-color fallback class for accessibility if the existing design needs it.

- [ ] **Step 4: Build to verify**

```bash
cd web/aurora && bunx tsc --noEmit && bunx rsbuild build 2>&1 | tail -3
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/aurora/src/features/home/components/sections/hero.tsx
git commit -m "feat(aurora): aurora glow hero with gradient headline"
```

---

## Task 6: Restyle wallet & payment cards (glass + gradient CTA)

**Files:**
- Modify: `web/aurora/src/features/wallet/components/recharge-form-card.tsx`
- Modify: `web/aurora/src/features/wallet/components/wcheckout-select.tsx`

- [ ] **Step 1: Locate the primary CTA buttons + card containers**

Run: `grep -n "Button\|Card\|className" web/aurora/src/features/wallet/components/wcheckout-select.tsx | head -30`

- [ ] **Step 2: Apply gradient to the primary pay button**

On the main pay/confirm `<Button>`, add an inline gradient style:
```tsx
style={{ background: 'var(--brand-gradient)', color: 'white' }}
```
(Keep `disabled` styling intact — when disabled, drop the inline style or add `opacity-50`.)

- [ ] **Step 3: Give the top-up/amount card a dark-glass surface**

On the card container, add:
```
bg-card/70 backdrop-blur-sm border-border/60
```

- [ ] **Step 4: Build to verify**

```bash
cd web/aurora && bunx tsc --noEmit && bunx rsbuild build 2>&1 | tail -3
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/aurora/src/features/wallet/components/recharge-form-card.tsx web/aurora/src/features/wallet/components/wcheckout-select.tsx
git commit -m "feat(aurora): glass wallet cards with gradient pay CTA"
```

---

## Task 7: Backend embed + routing integration

**Files:**
- Modify: `main.go:38-48` (embed block) and the `ThemeAssets{...}` literal (~`main.go:196`)
- Modify: `router/web-router.go`
- Modify: `common/embed-file-system.go`
- Modify: `common/constants.go`

- [ ] **Step 1: Add aurora embed directives in main.go**

After the classic embed block (`main.go:48`), add:
```go
//go:embed web/aurora/dist
var auroraBuildFS embed.FS

//go:embed web/aurora/dist/index.html
var auroraIndexPage []byte
```

- [ ] **Step 2: Pass aurora into the ThemeAssets literal**

In the `router.SetRouter(server, router.ThemeAssets{...})` literal (~`main.go:196`), add:
```go
AuroraBuildFS:    auroraBuildFS,
AuroraIndexPage:  auroraIndexPage,
```

- [ ] **Step 3: Extend ThemeAssets + routing in router/web-router.go**

In `ThemeAssets` struct add:
```go
AuroraBuildFS   embed.FS
AuroraIndexPage []byte
```
In `SetWebRouter`, after the classicFS line:
```go
auroraFS := common.EmbedFolder(assets.AuroraBuildFS, "web/aurora/dist")
themeFS := common.NewThemeAwareFS(defaultFS, classicFS, auroraFS)
```
(Update the existing `NewThemeAwareFS(defaultFS, classicFS)` call to the 3-arg form.)
In the `NoRoute` handler, add an aurora branch before the default else:
```go
if common.GetTheme() == "classic" {
    c.Data(http.StatusOK, "text/html; charset=utf-8", assets.ClassicIndexPage)
} else if common.GetTheme() == "aurora" {
    c.Data(http.StatusOK, "text/html; charset=utf-8", assets.AuroraIndexPage)
} else {
    c.Data(http.StatusOK, "text/html; charset=utf-8", assets.DefaultIndexPage)
}
```

- [ ] **Step 4: Add third FS to themeAwareFileSystem in common/embed-file-system.go**

Replace the struct + constructor + Open:
```go
type themeAwareFileSystem struct {
	defaultFS static.ServeFileSystem
	classicFS static.ServeFileSystem
	auroraFS  static.ServeFileSystem
}

func (t *themeAwareFileSystem) Open(name string) (http.File, error) {
	switch GetTheme() {
	case "classic":
		return t.classicFS.Open(name)
	case "aurora":
		return t.auroraFS.Open(name)
	default:
		return t.defaultFS.Open(name)
	}
}

func NewThemeAwareFS(defaultFS, classicFS, auroraFS static.ServeFileSystem) static.ServeFileSystem {
	return &themeAwareFileSystem{defaultFS: defaultFS, classicFS: classicFS, auroraFS: auroraFS}
}
```
Also update the `Exists` method if present to mirror the same switch (read the file first; apply the same 3-way branch).

- [ ] **Step 5: Accept aurora in SetTheme (common/constants.go)**

Change the guard in `SetTheme`:
```go
func SetTheme(t string) {
	if t == "default" || t == "classic" || t == "aurora" {
		themeValue.Store(t)
	}
}
```

- [ ] **Step 6: Build the whole backend**

```bash
cd /Users/jayke/Documents/CTH/GitHub/w-newapi && go build ./... 2>&1 | head -20
```
Expected: no output (success). Requires `web/aurora/dist` to exist (Task 1/2 built it).

- [ ] **Step 7: Runtime smoke test**

Start the server locally (or in the dev container), set option `theme.frontend=aurora` via admin or DB, load the site, confirm the aurora app is served. Then switch back to `default`/`classic` and confirm they still serve.

- [ ] **Step 8: Commit**

```bash
git add main.go router/web-router.go common/embed-file-system.go common/constants.go
git commit -m "feat(aurora): embed + route the aurora theme (additive)"
```

---

## Task 8: Add aurora to the theme selector UI

**Files:**
- Modify: the frontend-theme selector in `web/default/src/features/system-settings/site/` (and mirror in `web/aurora` + `web/classic` so the option is selectable from whichever theme the admin is using)

- [ ] **Step 1: Find the theme option list**

Run: `grep -rn "classic\|'default'\|frontend" web/default/src/features/system-settings/site/*.tsx | grep -i theme | head`

- [ ] **Step 2: Add aurora as a selectable option**

Wherever the theme options array/enum lists `default` and `classic`, add `aurora` (value `aurora`, label `Aurora`). Apply the same addition in `web/aurora/src/features/system-settings/site/` and `web/classic/src/...` equivalent so the option appears regardless of active theme.

- [ ] **Step 3: Build the affected frontends**

```bash
cd web/default && bunx tsc --noEmit && bunx rsbuild build 2>&1 | tail -3
cd ../aurora && bunx tsc --noEmit && bunx rsbuild build 2>&1 | tail -3
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add web/default/src/features/system-settings/site web/aurora/src/features/system-settings/site web/classic/src
git commit -m "feat(aurora): expose aurora in the theme selector"
```

---

## Task 9: Build/CI integration

**Files:**
- Modify: `Dockerfile`
- Modify: `.github/workflows/release.yml`

- [ ] **Step 1: Add a builder-aurora stage in Dockerfile**

After the `builder-classic` stage (`Dockerfile:19`), add:
```dockerfile
FROM oven/bun:1@sha256:0733e50325078969732ebe3b15ce4c4be5082f18c4ac1a0f0ca4839c2e4e42a7 AS builder-aurora

WORKDIR /build
COPY web/aurora/package.json .
COPY web/aurora/bun.lock .
RUN bun install
COPY ./web/aurora .
COPY ./VERSION .
RUN DISABLE_ESLINT_PLUGIN='true' VITE_REACT_APP_VERSION=$(cat VERSION) bun run build
```
In the Go build stage (`builder2`), after the classic COPY (`Dockerfile:36`):
```dockerfile
COPY --from=builder-aurora /build/dist ./web/aurora/dist
```

- [ ] **Step 2: Add aurora build steps to release.yml**

For each place that builds `web/default` then `web/classic` (e.g. `release.yml:32,40,90,98,145`), add an aurora block mirroring the default one:
```yaml
          cd web/aurora
          bun install
          DISABLE_ESLINT_PLUGIN='true' VITE_REACT_APP_VERSION=$VERSION bun run build
          cd ../..
```
Match each existing default/classic pairing's working-directory style.

- [ ] **Step 3: Validate Dockerfile builds (if Docker available)**

```bash
docker build -t w-newapi-aurora-test . 2>&1 | tail -15
```
Expected: image builds; the Go stage finds `web/aurora/dist`. If Docker is unavailable locally, rely on CI.

- [ ] **Step 4: Commit**

```bash
git add Dockerfile .github/workflows/release.yml
git commit -m "build(aurora): add aurora frontend build stages"
```

---

## Task 10: Fork maintenance doc + final verification

**Files:**
- Modify: `FORK_SYNC.md`

- [ ] **Step 1: Document aurora as a default-fork in FORK_SYNC.md**

Add a subsection under the customization list:
```markdown
### web/aurora — forked theme
`web/aurora` is a fork of `web/default` (third selectable theme). Upstream
changes to `web/default` do NOT flow into aurora automatically — port them
manually when desired. Aurora's own files never conflict with upstream; only
these additive integration points need re-merge on upstream sync:
main.go (embed), router/web-router.go, common/embed-file-system.go,
common/constants.go (SetTheme), Dockerfile, .github/workflows/release.yml.
```

- [ ] **Step 2: Final full build of everything**

```bash
cd /Users/jayke/Documents/CTH/GitHub/w-newapi
cd web/default && bunx rsbuild build 2>&1 | tail -2 && cd ../..
cd web/classic && bunx vite build 2>&1 | tail -2 && cd ../..
cd web/aurora && bunx rsbuild build 2>&1 | tail -2 && cd ../..
go build ./... 2>&1 | head -10
```
Expected: all three frontend builds succeed; `go build ./...` produces no output.

- [ ] **Step 3: Commit**

```bash
git add FORK_SYNC.md
git commit -m "docs(aurora): document aurora as a web/default fork in FORK_SYNC"
```

---

## Notes for the implementer

- Aurora inherits ALL of default's pages automatically; only tokens + the four shell areas are restyled in this phase. Pages not touched still look coherent because they consume the new tokens.
- If `web/aurora/bun.lock` or other normally-ignored files are needed for the Docker/CI build, force-add them (`git add -f`).
- The `theme.frontend` option drives `common.SetTheme`; confirm the option-sync path (model/option.go `case "theme.frontend"` or the layered `theme` config) already calls SetTheme — it does for classic/default, so aurora rides the same path once SetTheme accepts it.
- Keep all edits to upstream files purely additive (new branches/fields/stages), per FORK_SYNC.md discipline.
