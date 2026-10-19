import { describe, expect, it } from "vitest";
import { normalizeGlobalEditorSettings } from "./index";

describe("global editor settings", () => {
  it("keeps invalid colors and out-of-range scales within safe defaults", () => {
    const settings = normalizeGlobalEditorSettings({
      brandColor: "javascript:alert(1)",
      accentColor: "#123456",
      surfaceColor: "#abcdef",
      textScale: 9,
      radiusScale: 0.1,
      sidebarDefaultCollapsed: true,
    });
    expect(settings.brandColor).toBe("#159d92");
    expect(settings.accentColor).toBe("#123456");
    expect(settings.surfaceColor).toBe("#abcdef");
    expect(settings.textScale).toBe(1.2);
    expect(settings.radiusScale).toBe(0.75);
    expect(settings.sidebarDefaultCollapsed).toBe(true);
  });

  it("preserves supported values for a reversible editor update", () => {
    expect(normalizeGlobalEditorSettings({
      brandColor: "#102030",
      accentColor: "#405060",
      surfaceColor: "#f0f0f0",
      textScale: 1.1,
      radiusScale: 1.2,
      sidebarDefaultCollapsed: false,
    })).toEqual({
      brandColor: "#102030",
      accentColor: "#405060",
      surfaceColor: "#f0f0f0",
      textScale: 1.1,
      radiusScale: 1.2,
      sidebarDefaultCollapsed: false,
    });
  });
});
