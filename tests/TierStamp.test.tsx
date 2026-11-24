// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TierStamp } from "@/components/TierStamp";

afterEach(cleanup);

const thumping = (badge: string) => screen.getByText(badge).hasAttribute("data-thump");

describe("TierStamp", () => {
  it("shows the badge and the tagline", () => {
    render(<TierStamp badge="Budget Boss" tagline="No debt." />);
    expect(screen.getByText("Budget Boss")).toBeTruthy();
    expect(screen.getByText("No debt.")).toBeTruthy();
  });

  it("does not thump on first paint", () => {
    render(<TierStamp badge="Budget Boss" tagline="No debt." />);
    expect(thumping("Budget Boss")).toBe(false);
  });

  it("thumps when the badge changes", () => {
    const { rerender } = render(<TierStamp badge="Budget Boss" tagline="No debt." />);
    rerender(<TierStamp badge="Soft Life Certified" tagline="Planning." />);
    expect(screen.queryByText("Budget Boss")).toBeNull();
    expect(thumping("Soft Life Certified")).toBe(true);
  });

  it("keeps thumping on each further change, on a fresh element so the animation restarts", () => {
    const { rerender } = render(<TierStamp badge="One" tagline="a" />);
    rerender(<TierStamp badge="Two" tagline="b" />);
    const second = screen.getByText("Two");
    rerender(<TierStamp badge="Three" tagline="c" />);
    expect(thumping("Three")).toBe(true);
    expect(screen.getByText("Three")).not.toBe(second);
  });

  it("does not thump again for a render that keeps the same badge", () => {
    const { rerender } = render(<TierStamp badge="One" tagline="a" />);
    const stamp = screen.getByText("One");
    rerender(<TierStamp badge="One" tagline="a" />);
    rerender(<TierStamp badge="One" tagline="a different tagline" />);
    expect(screen.getByText("One")).toBe(stamp);
    expect(thumping("One")).toBe(false);
  });
});
