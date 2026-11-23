import { describe, expect, it } from "vitest";
import { AUTHOR_NAME, AUTHOR_URL, CTA_URL } from "@/config";
import { authorCredit, parseHttpsUrl } from "@/lib/author";

describe("parseHttpsUrl", () => {
  it("accepts https and returns the normalised URL", () => {
    expect(parseHttpsUrl("https://example.com")).toBe("https://example.com/");
    expect(parseHttpsUrl("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
  });

  it("rejects other protocols, garbage, empty and undefined", () => {
    expect(parseHttpsUrl("http://example.com")).toBeNull();
    expect(parseHttpsUrl("javascript:alert(1)")).toBeNull();
    expect(parseHttpsUrl("not a url")).toBeNull();
    expect(parseHttpsUrl("")).toBeNull();
    expect(parseHttpsUrl(undefined)).toBeNull();
  });
});

describe("authorCredit", () => {
  it("returns the credit when both name and https URL are set", () => {
    expect(authorCredit("Ada", "https://ada.dev")).toEqual({
      name: "Ada",
      url: "https://ada.dev/",
    });
  });

  it("trims the name", () => {
    expect(authorCredit("  Ada  ", "https://ada.dev")?.name).toBe("Ada");
  });

  it("is null when the name is missing or only whitespace", () => {
    expect(authorCredit("", "https://ada.dev")).toBeNull();
    expect(authorCredit("   ", "https://ada.dev")).toBeNull();
  });

  it("is null when the URL is missing, not https, or not a URL", () => {
    expect(authorCredit("Ada", "")).toBeNull();
    expect(authorCredit("Ada", "http://ada.dev")).toBeNull();
    expect(authorCredit("Ada", "javascript:alert(1)")).toBeNull();
    expect(authorCredit("Ada", "ada.dev")).toBeNull();
  });

  it("returns a name with markup characters as plain text", () => {
    expect(authorCredit("A <b> & C", "https://ada.dev")?.name).toBe("A <b> & C");
  });

  it("ships unset, so no credit shows until the owner fills both in", () => {
    expect(authorCredit(AUTHOR_NAME, AUTHOR_URL)).toBeNull();
  });
});

describe("CTA_URL still uses the shared parser", () => {
  it("is null or an https URL", () => {
    expect(CTA_URL === null || CTA_URL.startsWith("https://")).toBe(true);
  });
});
