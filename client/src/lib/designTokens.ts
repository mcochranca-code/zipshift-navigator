/**
 * TypeScript mirror of `client/src/styles/tokens.css`.
 *
 * Use `cssVar.*` inside inline styles so values follow the active theme, and
 * the raw `tokens.*` hex values only where CSS variables cannot be used
 * (canvas/PDF rendering, SVG presentation attributes, color inputs).
 */

export const tokens = {
  color: {
    brand: "#0d8077",
    brandStrong: "#0f766e",
    brandBright: "#159d92",
    brandSoft: "#e3f5f3",
    onBrand: "#ffffff",
    navy: "#142846",
    surface: "#ffffff",
    surfaceMuted: "#f7f9fc",
    border: "#dce6ef",
    text: "#142846",
    textMuted: "#52657d",
    textSubtle: "#64748b",
    successText: "#15803d",
    warningText: "#a16207",
    dangerText: "#be123c",
    focusRing: "#0b6bcb",
  },
  space: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 },
  radius: { xs: 4, sm: 6, md: 9, lg: 12, xl: 16, pill: 999 },
  font: { xs: 12, sm: 14, md: 16, lg: 18, xl: 24, "2xl": 32 },
  tapTarget: 44,
  motion: {
    duration: { instant: 80, fast: 160, base: 240, slow: 320, slower: 480, loop: 1400 },
    easing: {
      standard: "cubic-bezier(0.2, 0, 0, 1)",
      out: "cubic-bezier(0.23, 1, 0.32, 1)",
      in: "cubic-bezier(0.4, 0, 1, 1)",
      spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    },
    stagger: 35,
  },
} as const;

/** CSS custom-property references, for theme-aware inline styles. */
export const cssVar = {
  brand: "var(--zs-color-brand)",
  brandStrong: "var(--zs-color-brand-strong)",
  brandBright: "var(--zs-color-brand-bright)",
  brandSoft: "var(--zs-color-brand-soft)",
  onBrand: "var(--zs-color-on-brand)",
  text: "var(--zs-color-text)",
  textMuted: "var(--zs-color-text-muted)",
  textSubtle: "var(--zs-color-text-subtle)",
  border: "var(--zs-color-border)",
  surface: "var(--zs-color-surface)",
  surfaceMuted: "var(--zs-color-surface-muted)",
  successText: "var(--zs-color-success-text)",
  dangerText: "var(--zs-color-danger-text)",
  focusRing: "var(--zs-focus-ring)",
  durationFast: "var(--zs-duration-fast)",
  durationBase: "var(--zs-duration-base)",
  easeOut: "var(--zs-ease-out)",
} as const;

/**
 * True when the OS asks for reduced motion or the user turned on the in-app
 * "Reduce motion" setting (`<html data-zs-motion="reduce">`). Safe during SSR/tests.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  if (document.documentElement.dataset.zsMotion === "reduce") return true;
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Relative luminance contrast ratio between two #rrggbb colors (WCAG 2.x). */
export function contrastRatio(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const value = hex.replace("#", "");
    const channels = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
    const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}
