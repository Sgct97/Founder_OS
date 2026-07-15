/**
 * Unit tests for project URL normalization.
 */

import { normalizeExternalUrl } from "../project-urls";

describe("normalizeExternalUrl", () => {
  it("returns null for empty values", () => {
    expect(normalizeExternalUrl(null)).toBeNull();
    expect(normalizeExternalUrl(undefined)).toBeNull();
    expect(normalizeExternalUrl("   ")).toBeNull();
  });

  it("keeps absolute http(s) URLs", () => {
    expect(normalizeExternalUrl("https://acme.onrender.com")).toBe(
      "https://acme.onrender.com"
    );
    expect(normalizeExternalUrl("http://localhost:3000")).toBe(
      "http://localhost:3000"
    );
  });

  it("prefixes https when scheme is missing", () => {
    expect(normalizeExternalUrl("acme.onrender.com")).toBe(
      "https://acme.onrender.com"
    );
  });
});
