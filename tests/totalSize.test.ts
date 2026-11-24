import { describe, expect, it } from "vitest";
import { totalSizeToken } from "@/components/totalSize";

describe("totalSizeToken (the receipt's per-person total)", () => {
  it("keeps 40px for 10 characters or fewer, so the golden total fits the 264px box at 320px", () => {
    expect(totalSizeToken("₦0")).toBe("--t-2xl");
    expect(totalSizeToken("₦1,347,500")).toBe("--t-2xl");
    expect(totalSizeToken("$12,345.67")).toBe("--t-2xl"); // 10 characters
  });

  it("drops to 28px from 11 characters up to 15", () => {
    expect(totalSizeToken("₦12,345,678")).toBe("--t-xl"); // 11 characters
    expect(totalSizeToken("$898,334.00")).toBe("--t-xl");
    expect(totalSizeToken("₦49,950,000,000")).toBe("--t-xl"); // 15 characters
  });

  it("drops to 20px from 16 characters, so the largest totals fit at 320px", () => {
    expect(totalSizeToken("₦249,750,000,000")).toBe("--t-lg"); // the max-values total, 16 characters
    expect(totalSizeToken("$4,995,000,000.00")).toBe("--t-lg"); // 17 characters, rate of 50
    expect(totalSizeToken("£4,995,000,000.00")).toBe("--t-lg");
    expect(totalSizeToken("$499,500,000,000.00")).toBe("--t-lg");
  });

  it("counts ₦ as one character, not by UTF-16 units", () => {
    expect(totalSizeToken("\u20A6".repeat(10))).toBe("--t-2xl");
    expect(totalSizeToken("\u20A6".repeat(11))).toBe("--t-xl");
    expect(totalSizeToken("\u20A6".repeat(15))).toBe("--t-xl");
    expect(totalSizeToken("\u20A6".repeat(16))).toBe("--t-lg");
  });
});
