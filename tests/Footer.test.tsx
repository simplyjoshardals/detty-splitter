// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Footer } from "@/components/Footer";
import { AUTHOR_NAME } from "@/config";
import { authorCredit } from "@/lib/author";

afterEach(cleanup);

describe("Footer", () => {
  it("always shows the estimates note", () => {
    render(<Footer credit={null} />);
    expect(screen.getByText("Estimates only, not quotes. Tap any number to edit.")).toBeTruthy();
  });

  it("shows no credit when none is set", () => {
    render(<Footer credit={null} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByText(/Built in Lagos/)).toBeNull();
  });

  it("shows the shipped credit as a link", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: AUTHOR_NAME })).toBeTruthy();
  });

  it("shows the credit as a link when a valid one is given", () => {
    render(<Footer credit={authorCredit("Ada Obi", "https://example.com/ada")} />);
    const link = screen.getByRole("link", { name: "Ada Obi" });
    expect(link.getAttribute("href")).toBe("https://example.com/ada");
    expect(screen.getByText(/Built in Lagos by/)).toBeTruthy();
  });

  it("renders a name with markup characters as plain text", () => {
    render(<Footer credit={authorCredit("<b>Ada</b> & Co", "https://example.com")} />);
    expect(screen.getByRole("link", { name: "<b>Ada</b> & Co" })).toBeTruthy();
  });
});
