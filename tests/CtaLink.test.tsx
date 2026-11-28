// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CtaCard } from "@/components/CtaCard";
import { CtaLink } from "@/components/CtaLink";
import type { AnalyticsEvent } from "@/lib/analytics";

/** Stands in for the adapter, so a test sees what would be sent. */
const analytics = vi.hoisted(() => ({ track: vi.fn<(event: AnalyticsEvent) => void>() }));
vi.mock("@/lib/analytics", () => ({ track: analytics.track }));

beforeEach(() => analytics.track.mockClear());
afterEach(cleanup);

describe("CtaLink", () => {
  it("renders an ordinary link with the props it was given", () => {
    render(
      <CtaLink href="https://example.com/offer" target="_blank" rel="noopener noreferrer">
        Take me there
      </CtaLink>,
    );
    const link = screen.getByRole("link", { name: "Take me there" });
    expect(link.getAttribute("href")).toBe("https://example.com/offer");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("sends cta_click once, with no properties, when it is clicked", () => {
    render(
      <CtaLink href="https://example.com/offer" target="_blank">
        Take me there
      </CtaLink>,
    );
    expect(analytics.track).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("link"));
    expect(analytics.track).toHaveBeenCalledTimes(1);
    expect(analytics.track).toHaveBeenCalledWith({ name: "cta_click" });
  });
});

describe("CtaCard analytics", () => {
  it("sends cta_click when the card's link is clicked", () => {
    render(
      <CtaCard
        enabled
        url="https://example.com/offer"
        title="Still planning?"
        buttonText="Take me there"
      />,
    );
    expect(analytics.track).not.toHaveBeenCalled(); // showing the card is not a click
    fireEvent.click(screen.getByRole("link", { name: /Take me there/ }));
    expect(analytics.track).toHaveBeenCalledTimes(1);
    expect(analytics.track).toHaveBeenCalledWith({ name: "cta_click" });
  });

  it("sends nothing when the card is hidden", () => {
    render(
      <CtaCard
        enabled={false}
        url="https://example.com/offer"
        title="Still planning?"
        buttonText="Go"
      />,
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(analytics.track).not.toHaveBeenCalled();
  });
});
