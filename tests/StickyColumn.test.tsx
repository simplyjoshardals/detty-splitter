// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StickyColumn } from "@/components/StickyColumn";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** jsdom has no layout, so the column's height and the screen's are set by hand. */
function renderColumn(height: number, screenHeight: number): HTMLElement {
  vi.stubGlobal("innerHeight", screenHeight);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(height);
  render(
    <StickyColumn>
      <p>receipt</p>
    </StickyColumn>,
  );
  const column = screen.getByText("receipt").parentElement;
  if (column === null) throw new Error("expected the column");
  return column;
}

describe("StickyColumn", () => {
  it("renders its children", () => {
    renderColumn(500, 900);
    expect(screen.getByText("receipt")).toBeTruthy();
  });

  it("keeps 24px from the top when the column fits the screen", () => {
    expect(renderColumn(700, 900).style.top).toBe("24px");
  });

  it("goes negative by what does not fit, so the bottom ends 24px above the screen's bottom", () => {
    // 910 tall on a 720 screen: top = 720 - 910 - 24 = -214, so the bottom sits at 696.
    expect(renderColumn(910, 720).style.top).toBe("-214px");
  });

  it("keeps 24px exactly when the column and the gaps fill the screen", () => {
    expect(renderColumn(852, 900).style.top).toBe("24px");
  });
});
