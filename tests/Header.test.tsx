// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { Header } from "@/components/Header";
import { AppStateProvider } from "@/state/AppStateProvider";

afterEach(cleanup);

function setup() {
  render(
    <AppStateProvider>
      <Header />
    </AppStateProvider>,
  );
  return { banner: screen.getByRole("banner"), user: userEvent.setup() };
}

describe("Header", () => {
  it("has the wordmark as the page heading", () => {
    const { banner } = setup();
    expect(within(banner).getByRole("heading", { level: 1, name: "DETTY DEC 2026" })).toBeTruthy();
  });

  it("holds the currency control, naira selected first", () => {
    const { banner } = setup();
    const group = within(banner).getByRole("radiogroup", { name: "Currency" });
    expect(within(group).getByRole("radio", { name: "NGN" })).toHaveProperty("checked", true);
  });

  it("switches currency from inside the band and says prices stay in naira", async () => {
    const { banner, user } = setup();
    expect(within(banner).queryByText("Prices stay in ₦")).toBeNull();
    await user.click(within(banner).getByText("USD"));
    expect(within(banner).getByRole("radio", { name: "USD" })).toHaveProperty("checked", true);
    expect(within(banner).getByText("Prices stay in ₦")).toBeTruthy();
  });
});
