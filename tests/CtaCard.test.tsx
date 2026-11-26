// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CtaCard } from "@/components/CtaCard";

afterEach(cleanup);

const URL_OK = "https://example.com/offer";
const copy = { title: "Still planning the trip?", buttonText: "Take me there" };

describe("CtaCard, on", () => {
  it("shows the title and a link that opens the URL in a new tab", () => {
    render(<CtaCard enabled url={URL_OK} {...copy} />);
    expect(screen.getByRole("heading", { level: 2, name: copy.title })).toBeTruthy();
    expect(screen.getByRole("region", { name: copy.title })).toBeTruthy();
    const link = screen.getByRole("link", { name: /Take me there/ });
    expect(link.getAttribute("href")).toBe(URL_OK);
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("tells screen readers the link opens a new tab", () => {
    render(<CtaCard enabled url={URL_OK} {...copy} />);
    expect(screen.getByRole("link", { name: "Take me there (opens in a new tab)" })).toBeTruthy();
  });

  it("without a disclosure: no disclosure line and no sponsored", () => {
    const { container } = render(<CtaCard enabled url={URL_OK} {...copy} disclosure="" />);
    expect(screen.getByRole("link").getAttribute("rel")).toBe("noopener noreferrer");
    expect(container.querySelector("p#cta-disclosure")).toBeNull();
  });

  it("with a disclosure: shows it, describes the link by it and adds sponsored", () => {
    render(<CtaCard enabled url={URL_OK} {...copy} disclosure="Sponsored link." />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer sponsored");
    expect(screen.getByText("Sponsored link.")).toBeTruthy();
    expect(link.getAttribute("aria-describedby")).toBe("cta-disclosure");
  });

  it("treats a blank disclosure as none", () => {
    render(<CtaCard enabled url={URL_OK} {...copy} disclosure="   " />);
    expect(screen.getByRole("link").getAttribute("rel")).toBe("noopener noreferrer");
  });
});

describe("CtaCard, off", () => {
  it("renders nothing at all when the flag is off, with a valid URL", () => {
    const { container } = render(<CtaCard enabled={false} url={URL_OK} {...copy} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("CtaCard, invalid URL", () => {
  it.each([
    ["null", null],
    ["empty", ""],
    ["not a URL", "not a url"],
    ["http", "http://example.com/offer"],
    ["javascript", "javascript:alert(1)"],
    ["ftp", "ftp://example.com/offer"],
    ["no scheme", "example.com/offer"],
  ])("renders nothing for %s, even with the flag on", (_name, url) => {
    const { container } = render(<CtaCard enabled url={url} {...copy} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("CtaCard, missing copy", () => {
  it("renders nothing when the title or the button text is blank", () => {
    const a = render(<CtaCard enabled url={URL_OK} title="  " buttonText="Go" />);
    expect(a.container.firstChild).toBeNull();
    const b = render(<CtaCard enabled url={URL_OK} title="Hi" buttonText="" />);
    expect(b.container.firstChild).toBeNull();
  });
});
