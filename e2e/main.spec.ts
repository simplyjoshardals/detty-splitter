import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Download, type Locator, type Page } from "@playwright/test";

// Same value as EXPORT_FILE_NAME in lib/export; not imported, so no app code runs in Node.
const EXPORT_FILE_NAME = "detty-splitter-receipt.png";
const PNG_SIGNATURE = "89504e470d0a1a0a";

const receiptOf = (page: Page): Locator => page.getByRole("region", { name: "Receipt" });
// The label reads "Printing…" while the PNG is being drawn.
const exportButtonOf = (page: Page): Locator =>
  page.getByRole("button", { name: /Export receipt|Printing/ });

async function openApp(page: Page): Promise<void> {
  await page.goto("/");
  // The page paints static HTML first; wait for the scripts so the first tap is not lost.
  await page.waitForLoadState("networkidle");
  await expect(receiptOf(page)).toBeVisible();
}

/** Fails with a short list (rule, impact, first nodes), not axe's full report. */
async function expectNoA11yViolations(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  const { violations } = await new AxeBuilder({ page }).analyze();
  const summary = violations.map(
    (v) =>
      `${v.id} [${v.impact ?? "n/a"}] x${v.nodes.length}: ` +
      v.nodes
        .slice(0, 3)
        .map((node) => node.target.join(" "))
        .join(" | "),
  );
  expect(summary, "axe violations").toEqual([]);
}

async function expectPngDownload(download: Download): Promise<void> {
  expect(download.suggestedFilename()).toBe(EXPORT_FILE_NAME);
  const bytes = await readFile(await download.path());
  expect(bytes.subarray(0, 8).toString("hex")).toBe(PNG_SIGNATURE);
}

/** Presses Tab until `target` has focus. Fails if the control is skipped or the order is wrong. */
async function tabTo(page: Page, target: Locator, maxTabs = 80): Promise<void> {
  for (let i = 0; i < maxTabs; i += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error(`Tab did not reach the control within ${maxTabs} presses`);
}

test("default, edit, currency, copy link, fresh page, export", async ({ page, browser }) => {
  await openApp(page);
  await expect(page.getByRole("heading", { level: 1, name: "DETTY DEC 2026" })).toBeVisible();
  await expectNoA11yViolations(page);

  const receipt = receiptOf(page);
  const defaultText = await receipt.innerText();

  // Edit a bucket.
  const price = page.getByRole("textbox", { name: /Price per night/ });
  await price.fill("123456");
  await price.press("Enter");
  await expect.poll(() => receipt.innerText()).not.toBe(defaultText);

  // Switch currency (display only).
  // Click the visible label, like a finger does: the radio itself is a 1px sr-only input.
  await page
    .locator("label")
    .filter({ has: page.getByRole("radio", { name: "USD", exact: true }) })
    .click();
  await expect(page.getByRole("radio", { name: "USD", exact: true })).toBeChecked();
  await expect(receipt).toContainText("$");

  // Open the Rates panel so its fields are checked too.
  const rates = page.getByRole("button", { name: /^Rates/ });
  await rates.click();
  await expect(rates).toHaveAttribute("aria-expanded", "true");
  await expectNoA11yViolations(page);
  await rates.click();

  // Copy link, then read it back from the clipboard.
  await page.getByRole("button", { name: "Copy link", exact: true }).click();
  await expect(page.getByText("Link copied. Drop it in the group chat.")).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toContain("#v1");
  const expectedReceipt = await receipt.innerText();

  // A new context has empty storage, so only the link can supply the numbers.
  const fresh = await browser.newPage();
  try {
    await fresh.goto(link);
    await expect.poll(() => receiptOf(fresh).innerText()).toBe(expectedReceipt);
    await expect(fresh.getByText(/couldn't read that link/)).toHaveCount(0);
  } finally {
    await fresh.close();
  }

  // Export triggers a download of a real PNG (desktop path: no share sheet).
  const download = page.waitForEvent("download");
  await exportButtonOf(page).click();
  await expectPngDownload(await download);
  await expect(page.getByText("Receipt saved. Check your downloads.")).toBeVisible();
});

test("the whole flow works by keyboard only", async ({ page }) => {
  await openApp(page);
  const receipt = receiptOf(page);

  // Currency: the radio group is one tab stop, arrows move the selection.
  await tabTo(page, page.getByRole("radio", { name: "NGN", exact: true }));
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: "USD", exact: true })).toBeChecked();

  // Route plates: the checked plate takes focus, an arrow picks the next route.
  const checkedPlate = page
    .getByRole("group", { name: "Pick your route" })
    .getByRole("radio", { checked: true });
  await tabTo(page, checkedPlate);
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText(/^Route set to/)).toBeVisible();

  // Edit a price, commit with Enter.
  const afterRoute = await receipt.innerText();
  await tabTo(page, page.getByRole("textbox", { name: /Price per night/ }));
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("123456");
  await page.keyboard.press("Enter");
  await expect.poll(() => receipt.innerText()).not.toBe(afterRoute);

  // Rates: opens and closes from the keyboard.
  const rates = page.getByRole("button", { name: /^Rates/ });
  await tabTo(page, rates);
  await page.keyboard.press("Enter");
  await expect(rates).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Enter");
  await expect(rates).toHaveAttribute("aria-expanded", "false");

  // Export, then Copy link.
  await tabTo(page, exportButtonOf(page));
  const download = page.waitForEvent("download");
  await page.keyboard.press("Enter");
  await expectPngDownload(await download);

  await tabTo(page, page.getByRole("button", { name: "Copy link", exact: true }));
  await page.keyboard.press("Enter");
  await expect(page.getByText("Link copied. Drop it in the group chat.")).toBeVisible();
});

/** The CSP line from public/_headers, so the test runs under the policy that ships. */
async function readCsp(): Promise<string> {
  const headers = await readFile("public/_headers", "utf8");
  const csp = /^\s+Content-Security-Policy:\s*(.+?)\s*$/m.exec(headers)?.[1];
  if (csp === undefined) throw new Error("No Content-Security-Policy line in public/_headers");
  return csp;
}

test("the flow runs under the production CSP with no violations", async ({ page }) => {
  const csp = await readCsp();
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));

  // `serve` ignores public/_headers, so give every page response the same policy here.
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() !== "document") {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), "content-security-policy": csp } });
  });
  // /m/lib is a Pages Function (the analytics relay), which `serve` does not run. An empty same-origin
  // script still shows that the policy lets it load.
  await page.route("**/m/lib", (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: "" }),
  );

  await openApp(page);
  const price = page.getByRole("textbox", { name: /Price per night/ });
  await price.fill("123456");
  await price.press("Enter");
  await page.getByRole("button", { name: "Copy link", exact: true }).click();
  await expect(page.getByText("Link copied. Drop it in the group chat.")).toBeVisible();
  const download = page.waitForEvent("download");
  await exportButtonOf(page).click();
  await expectPngDownload(await download);

  // A font the policy blocked would show here and in the console.
  const failedFonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].filter((face) => face.status === "error").map((face) => face.family);
  });
  expect(failedFonts, "fonts that failed to load").toEqual([]);
  expect(problems, "console and page errors").toEqual([]);
});

test.describe("dark mode at 360px", () => {
  test.use({ colorScheme: "dark", viewport: { width: 360, height: 800 } });

  test("no axe violations", async ({ page }) => {
    await openApp(page);
    await expectNoA11yViolations(page);
  });
});
