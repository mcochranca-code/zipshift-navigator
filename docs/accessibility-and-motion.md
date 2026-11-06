# Accessibility, design tokens, and motion

This note describes the shared UI foundation added on the `hark/a11y-ux-motion` branch: where the tokens live, how motion is gated, how the resource map stays usable without a mouse or a network, and how accessibility is tested.

## Design tokens

| File | Purpose |
| --- | --- |
| [`client/src/styles/tokens.css`](../client/src/styles/tokens.css) | Source of truth: `--zs-*` custom properties for color, spacing, radius, typography, elevation, z-index and motion. |
| [`client/src/lib/designTokens.ts`](../client/src/lib/designTokens.ts) | TypeScript mirror (`tokens`, `cssVar`) plus `prefersReducedMotion()` and `contrastRatio()`. A unit test keeps it in sync with the CSS. |
| [`client/src/index.css`](../client/src/index.css) | Imports the tokens and exposes them to Tailwind as `bg-brand`, `text-brand`, `text-brand-strong`, `border-brand`, `ring-brand`, `accent-brand`, `text-zs-muted`, `text-zs-subtle`. |

Contrast rules (WCAG 2.2 AA):

- `--zs-color-brand` (`#0d8077`, 4.8:1 on white) is the color for text, links, and buttons with white labels. The old `#159d92` (3.35:1) failed AA for normal text, so every text and button use moved to the token.
- `--zs-color-brand-bright` (`#159d92`) is still available for decorative uses only: borders, dots, halos, and display text 24px or larger.
- `--zs-color-text-subtle` (`#64748b`) is the lightest gray allowed for text. `slate-400` / `#94a3b8` text moved to it.
- Success text uses `#15803d`. Map category pins were darkened so their white symbols pass 4.5:1.

Dark tokens are applied through `<html data-zs-theme="dark">`, which the client Dark Mode setting toggles. They are deliberately not tied to `.dark`, because `ThemeProvider` always sets `.dark` while the ZipShift screens are light.

## Motion

Motion tokens: `--zs-duration-{instant,fast,base,slow,slower,loop}`, `--zs-ease-{standard,out,in,spring}`, `--zs-stagger`, `--zs-distance-{sm,md,lg}`.

- **Splash / loading:** `BrandedSplash` (animated route line and pin with an indeterminate bar) and `SkeletonList` / `SkeletonCards` in [`components/motion/Loaders.tsx`](../client/src/components/motion/Loaders.tsx). Each loader is one `role="status"` message for screen readers, and its visuals are `aria-hidden`.
- **Screen transitions:** each screen's `<main>` (or wrapper) is keyed by screen and plays `zs-screen`. Previously `#root` itself was transformed, which briefly broke `position: fixed` chrome (bottom nav, sidebar, drawers) during every transition.
- **Micro-interactions:** `zs-press`, `zs-lift`, heart pop on save, a spring-thumb `zs-switch`, and the active indicator on the bottom nav.
- **Reduced motion:** under `prefers-reduced-motion: reduce`, every duration token drops to 0, loops and travel are removed, and screen transitions become a 120 ms opacity fade. Users can also turn on **Reduce motion** in the app's accessibility settings (menu, More, or Settings), which sets `<html data-zs-motion="reduce">` and is saved in `localStorage`. Leaflet zoom, fade, and fly animations are disabled in either case.

No animation library was added. `framer-motion` was already installed but is unused here, because CSS covers every case and reduced motion is handled in one place.

## Navigation and screen readers

- **Skip link** (`SkipLink`, the first focusable element) leads to `#main-content`. Every client screen now has `<header>` (with an `<h1>`), `<nav aria-label="Primary">` (mobile tabs with `aria-current="page"`), an `<aside>` sidebar with `<nav aria-label="Navigator">`, and `<main id="main-content">`.
- **Screen-change focus:** `useScreenChangeFocus(screen, title)` moves focus to the new screen's `<h1>`, updates `document.title`, and announces "{title} screen" through the shared polite live region (`LiveAnnouncer` / `announce()`).
- **Dialogs:** `useDialogA11y(ref, open, onClose)` provides focus-in, a Tab trap, Escape to close, scroll lock, and focus return. It is used by the mobile drawer, filters sheet, consent dialog, quick-guide modal, and field-tools modals.
- **Stable chrome:** Home's header, menus, and nav are now rendered through `<RenderSlot render={…}/>`. They were closures used as `<Header/>`, which remounted their DOM on every state change and dropped keyboard focus. For example, focus was lost when you toggled language inside the open menu.
- **Labels:** every icon-only button (back, menu, close, save, search) has a label. Toggles are `role="switch"` with `aria-checked`. Language buttons use `aria-pressed` and `lang`. Filter categories are a labelled group. The distance slider has a `<label>` and `aria-valuetext`. Result counts are live.
- **Breadcrumbs** on resource detail, Before you go, and Directions.
- `index.html` no longer sets `maximum-scale=1`, which blocked pinch zoom (WCAG 1.4.4).

## Interactive map

[`components/ZipShiftMap.tsx`](../client/src/components/ZipShiftMap.tsx) is used on the client Map screen, the referral destination flow, and the County directory's map mode (which replaces the earlier hand-drawn SVG "map").

- **Tiles:** Leaflet with OpenStreetMap standard tiles (no API key). The Leaflet CSS is bundled from `node_modules` instead of a CDN, so it works offline.
- **Clustering:** grid-based clustering with no dependency, re-computed on zoom. A cluster announces its count and zooms in when activated.
- **Keyboard:** the map container describes its keyboard model (arrow keys pan, +/- zoom). Pins and clusters are Tab stops with `role="button"` and descriptive labels. Decorative city labels and circles are not focusable.
- **Accessible alternative:** a synced list of every resource sits beside the map (on desktop) or below it (on mobile). It uses arrow, Home, and End keys, and `aria-current` marks the active item. Choosing a list item pans the map. Choosing a pin highlights the list item and moves focus to the details card. Closing the card returns focus to the list.
- **Fallbacks:** resources without valid coordinates appear only in the list, marked "no map location". If the device is offline, or four tiles in a row fail to load, a notice appears and the list stays fully usable.
- **Privacy:** the component accepts only public directory records (`Provider`). The County directory adapter copies only public fields. No client, case, or referral data is ever put on the map.

## Testing

- [`client/src/lib/a11y.test.tsx`](../client/src/lib/a11y.test.tsx): token sync and AA contrast, reduced-motion CSS, loaders, skip link, breadcrumbs, live announcer, dialog focus trap and return, map list and keyboard and offline fallback, plus axe-core scans of RolePortal, NotificationCenter, StaffIntakeFlow, and ReferralsDispatch.
- [`client/src/pages/Home.a11y.test.tsx`](../client/src/pages/Home.a11y.test.tsx): end-to-end jsdom run of Home that checks landmarks and headings, an axe scan of the client home, the mobile menu (focus in, Escape, focus return), and screen-change focus, title, and announcement.
- The axe scans in jsdom turn off `color-contrast` and `region`, because both need real layout. Contrast is enforced by the token tests instead.

Manual checks worth doing in a browser: VoiceOver or NVDA through Home → Map → a resource → Before you go; keyboard-only map use; OS reduced motion on and off; 200% zoom; and airplane mode on the Map screen.
