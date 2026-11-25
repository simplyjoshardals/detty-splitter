// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LinkNotice } from "@/components/LinkNotice";
import { encodeShare } from "@/lib/share";
import { AppStateProvider } from "@/state/AppStateProvider";
import { GOLDEN } from "./fixtures";

afterEach(cleanup);

const NOTICE = "We couldn't read that link, so here's a fresh calculation.";

const setHash = (hash: string) => window.history.replaceState(null, "", `/${hash}`);

const mount = () =>
  render(
    <AppStateProvider>
      <LinkNotice />
    </AppStateProvider>,
  );

describe("LinkNotice", () => {
  it("is an empty status region when nothing was wrong with the link", () => {
    mount();
    expect(screen.getByRole("status").textContent).toBe("");
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();
  });

  it("stays empty for a good link", () => {
    setHash(encodeShare({ ...GOLDEN, groupSize: 9 }));
    mount();
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("says the link could not be read, inside the status region, for a bad link", () => {
    setHash("#v1");
    mount();
    expect(within(screen.getByRole("status")).getByText(NOTICE)).toBeTruthy();
  });

  it("goes away on Dismiss and leaves the empty status region behind", () => {
    setHash("#v1");
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText(NOTICE)).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("");
  });
});
