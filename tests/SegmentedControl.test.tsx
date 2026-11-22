// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserIcon, UsersThreeIcon } from "@phosphor-icons/react";
import { SegmentedControl, type SegmentOption } from "@/components/SegmentedControl";
import type { Mode } from "@/lib/types";

afterEach(cleanup);

const OPTIONS: readonly SegmentOption<Mode>[] = [
  { value: "shared", label: "Shared", icon: UsersThreeIcon },
  { value: "perPerson", label: "Per person", icon: UserIcon },
];

function Harness({ onChange }: { onChange?: (value: Mode) => void }) {
  const [value, setValue] = useState<Mode>("shared");
  return (
    <>
      <h3 id="heading">Short-lets</h3>
      <SegmentedControl
        label="Cost split"
        labelledBy={["heading"]}
        options={OPTIONS}
        value={value}
        onChange={(next) => {
          onChange?.(next);
          setValue(next);
        }}
      />
    </>
  );
}

function setup(onChange?: (value: Mode) => void) {
  const user = userEvent.setup();
  render(<Harness onChange={onChange} />);
  const group = screen.getByRole("radiogroup", { name: "Cost split Short-lets" });
  const shared = within(group).getByRole("radio", { name: "Shared" });
  const perPerson = within(group).getByRole("radio", { name: "Per person" });
  return { user, shared, perPerson };
}

describe("SegmentedControl", () => {
  it("is a named radio group with the current option checked", () => {
    const { shared, perPerson } = setup();
    expect(shared).toHaveProperty("checked", true);
    expect(perPerson).toHaveProperty("checked", false);
  });

  it("selects an option on click and reports it", async () => {
    const onChange = vi.fn();
    const { user, shared, perPerson } = setup(onChange);
    await user.click(screen.getByText("Per person"));
    expect(perPerson).toHaveProperty("checked", true);
    expect(shared).toHaveProperty("checked", false);
    expect(onChange).toHaveBeenCalledWith("perPerson");
  });

  it("moves the selection with the arrow keys", async () => {
    const { user, shared, perPerson } = setup();
    await user.tab();
    expect(document.activeElement).toBe(shared);
    await user.keyboard("{ArrowRight}");
    expect(perPerson).toHaveProperty("checked", true);
    expect(document.activeElement).toBe(perPerson);
    await user.keyboard("{ArrowLeft}");
    expect(shared).toHaveProperty("checked", true);
  });

  it("is a single tab stop", async () => {
    const { user } = setup();
    await user.tab();
    await user.tab();
    expect(document.body).toBe(document.activeElement);
  });
});
