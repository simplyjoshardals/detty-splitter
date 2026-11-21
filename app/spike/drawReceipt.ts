/**
 * THROWAWAY (T2.1): canvas receipt for the export spike.
 * T7.2 starts from this drawing code and moves it into lib/receipt/.
 * Not here yet: ink stamp, speckle texture, rates note (T7.2, T7.3).
 */

export interface SpikeReceiptLine {
  label: string;
  formula: string;
  yourShare: string;
}

/** Local copy of the DATA_MODEL §6 ReceiptView fields this spike draws. */
export interface SpikeReceiptView {
  title: string;
  lines: ReadonlyArray<SpikeReceiptLine>;
  groupSize: number;
  perPersonTotal: string;
  groupTotal: string;
  balanceLine: string;
  authCode: string;
  siteUrl: string;
}

export type RenderFailureReason = "font" | "draw" | "blob" | "unknown";

export interface FontDiagnostic {
  label: string;
  facesLoaded: number;
  checkOk: boolean;
}

export interface RenderDiagnostics {
  fonts: ReadonlyArray<FontDiagnostic>;
  renderMs: number;
  blobBytes: number;
}

export type RenderResult =
  | { ok: true; blob: Blob; diagnostics: RenderDiagnostics }
  | { ok: false; reason: RenderFailureReason; message: string };

type RenderFailure = Extract<RenderResult, { ok: false }>;

interface ReceiptFonts {
  display: string;
  mono: string;
}

interface ReceiptColors {
  paper: string;
  ink: string;
  muted: string;
  danfo: string;
}

const WIDTH = 1080;
const HEIGHT = 1920;
const MARGIN_Y = 140; // story/reel safe margin (DESIGN §7)
const PAD_X = 72;
const CONTENT_W = WIDTH - PAD_X * 2;

// Includes ₦ (latin-ext) and Latin so both font files are fetched.
const FONT_SAMPLE =
  "₦£$0123456789.,:*×÷ ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz";

function fail(reason: RenderFailureReason, message: string): RenderFailure {
  return { ok: false, reason, message };
}

function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

/** A canvas can't read CSS variables, so resolve them from the document. */
function readCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function readColors(): ReceiptColors | null {
  const paper = readCssVar("--receipt-paper");
  const ink = readCssVar("--receipt-ink");
  const muted = readCssVar("--receipt-muted");
  const danfo = readCssVar("--receipt-danfo");
  if (!paper || !ink || !muted || !danfo) return null;
  return { paper, ink, muted, danfo };
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  color: string,
  align: CanvasTextAlign = "left",
  baseline: CanvasTextBaseline = "alphabetic",
): void {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(text, x, y);
}

/** Largest size (stepping down from startSize) at which the text fits maxWidth. */
function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: string,
  family: string,
  maxWidth: number,
  startSize: number,
): number {
  let size = startSize;
  while (size > 24) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 2;
  }
  return size;
}

function drawRule(
  ctx: CanvasRenderingContext2D,
  y: number,
  color: string,
  lineWidth: number,
  dash: ReadonlyArray<number>,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.setLineDash([...dash]);
  ctx.beginPath();
  ctx.moveTo(PAD_X, y);
  ctx.lineTo(WIDTH - PAD_X, y);
  ctx.stroke();
  ctx.restore();
}

function drawReceipt(
  ctx: CanvasRenderingContext2D,
  view: SpikeReceiptView,
  fonts: ReceiptFonts,
  colors: ReceiptColors,
): void {
  const { display, mono } = fonts;
  const { paper, ink, muted, danfo } = colors;

  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Top danfo band and stripe
  const bandHeight = 150;
  ctx.fillStyle = danfo;
  ctx.fillRect(0, MARGIN_Y, WIDTH, bandHeight);
  ctx.fillStyle = ink;
  ctx.fillRect(0, MARGIN_Y + bandHeight, WIDTH, 12);
  const title = view.title.toUpperCase();
  const titleSize = fitFontSize(ctx, title, "400", display, CONTENT_W, 64);
  drawText(
    ctx,
    title,
    WIDTH / 2,
    MARGIN_Y + bandHeight / 2,
    `400 ${titleSize}px ${display}`,
    ink,
    "center",
    "middle",
  );

  // POS header
  const header = [
    "*** DEBIT ALERT ***",
    "MERCHANT: DETTY DEC, LAGOS",
    "TXN: DAMAGE CALCULATION",
    "CARD: **** SAPA",
  ];
  header.forEach((line, i) => {
    const font = i === 0 ? `700 38px ${mono}` : `400 32px ${mono}`;
    drawText(ctx, line, WIDTH / 2, 364 + i * 46, font, ink, "center");
  });

  drawRule(ctx, 530, muted, 3, [14, 10]);

  // Line items
  view.lines.forEach((line, i) => {
    const y = 590 + i * 96;
    drawText(ctx, line.label, PAD_X, y, `400 34px ${mono}`, ink);
    drawText(ctx, line.yourShare, WIDTH - PAD_X, y, `700 40px ${mono}`, ink, "right");
    drawText(ctx, line.formula, PAD_X, y + 38, `400 30px ${mono}`, muted);
  });

  // Double rule
  drawRule(ctx, 1040, ink, 3, []);
  drawRule(ctx, 1048, ink, 3, []);

  // Totals
  drawText(ctx, "PER PERSON", PAD_X, 1100, `700 34px ${mono}`, ink);
  const perPersonSize = fitFontSize(ctx, view.perPersonTotal, "700", mono, CONTENT_W, 92);
  drawText(
    ctx,
    view.perPersonTotal,
    WIDTH - PAD_X,
    1190,
    `700 ${perPersonSize}px ${mono}`,
    ink,
    "right",
  );
  drawText(ctx, `GROUP (${view.groupSize})`, PAD_X, 1260, `700 34px ${mono}`, ink);
  drawText(ctx, view.groupTotal, WIDTH - PAD_X, 1260, `700 44px ${mono}`, ink, "right");

  // Status, balance and footer lines
  drawText(ctx, "STATUS: APPROVED", PAD_X, 1330, `700 34px ${mono}`, ink);
  drawText(ctx, view.balanceLine, PAD_X, 1384, `700 30px ${mono}`, ink);
  drawText(ctx, `AUTH: ${view.authCode}`, PAD_X, 1446, `400 30px ${mono}`, muted);
  drawText(ctx, "CUSTOMER COPY. KEEP YOUR RECEIPT.", PAD_X, 1488, `400 30px ${mono}`, muted);
  drawText(ctx, "YOUR ACCOUNT WON’T.", PAD_X, 1530, `400 30px ${mono}`, muted);

  // Bottom danfo band: site URL watermark, above the bottom safe margin
  const bottomHeight = 140;
  const bottomTop = HEIGHT - MARGIN_Y - bottomHeight;
  ctx.fillStyle = danfo;
  ctx.fillRect(0, bottomTop, WIDTH, bottomHeight);
  drawText(
    ctx,
    view.siteUrl,
    WIDTH / 2,
    bottomTop + bottomHeight / 2,
    `700 34px ${mono}`,
    ink,
    "center",
    "middle",
  );
}

/**
 * Waits for the fonts, draws the receipt and returns a PNG blob.
 * Never throws: every failure comes back as a typed result.
 */
export async function renderReceipt(view: SpikeReceiptView): Promise<RenderResult> {
  const started = performance.now();

  // next/font gives its fonts generated family names, so read them from the CSS variables.
  const display = readCssVar("--font-bungee");
  const mono = readCssVar("--font-space-mono");
  if (!display || !mono) {
    return fail("font", "CSS variables --font-bungee / --font-space-mono not found");
  }
  const colors = readColors();
  if (!colors) {
    return fail("draw", "CSS variables --receipt-* not found");
  }

  const specs: ReadonlyArray<{ label: string; spec: string }> = [
    { label: "Space Mono 400", spec: `400 40px ${mono}` },
    { label: "Space Mono 700", spec: `700 40px ${mono}` },
    { label: "Bungee 400", spec: `400 40px ${display}` },
  ];

  let fonts: FontDiagnostic[] = [];
  try {
    fonts = await Promise.all(
      specs.map(async ({ label, spec }) => {
        const faces = await document.fonts.load(spec, FONT_SAMPLE);
        return {
          label,
          facesLoaded: faces.length,
          checkOk: document.fonts.check(spec, FONT_SAMPLE),
        };
      }),
    );
  } catch (error) {
    return fail("font", describeError(error));
  }
  const missing = fonts.filter((f) => f.facesLoaded === 0).map((f) => f.label);
  if (missing.length > 0) {
    return fail("font", `No font files loaded for: ${missing.join(", ")}`);
  }

  let blob: Blob | null = null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return fail("draw", "Canvas 2D context unavailable");
    drawReceipt(ctx, view, { display, mono }, colors);
    blob = await canvasToBlob(canvas);
  } catch (error) {
    return fail("draw", describeError(error));
  }
  if (!blob) return fail("blob", "canvas.toBlob returned null");

  return {
    ok: true,
    blob,
    diagnostics: {
      fonts,
      renderMs: Math.round(performance.now() - started),
      blobBytes: blob.size,
    },
  };
}
