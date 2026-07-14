/**
 * Unit tests for theme palette resolution helpers.
 */

import {
  DARK_COLORS,
  LIGHT_COLORS,
  colorsForScheme,
} from "@/constants/theme";

describe("colorsForScheme", () => {
  it("returns light palette for light", () => {
    const c = colorsForScheme("light");
    expect(c.background).toBe(LIGHT_COLORS.background);
    expect(c.textPrimary).toBe(LIGHT_COLORS.textPrimary);
  });

  it("returns dark palette for dark", () => {
    const c = colorsForScheme("dark");
    expect(c.background).toBe(DARK_COLORS.background);
    expect(c.primary).toBe(DARK_COLORS.primary);
  });
});
