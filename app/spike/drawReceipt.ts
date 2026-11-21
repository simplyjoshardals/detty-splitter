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
  /** The single font family that was loaded (first entry of the CSS variable). */
  family: string;
  facesLoaded: number;
  checkOk: boolean;
  /** Set when loading this font threw (e.g. NetworkError), otherwise null. */
  error: string | null;
}

export interface RenderDiagnostics {
  fonts: ReadonlyArray<FontDiagnostic>;
  renderMs: number;
  blobBytes: number;
}

export type RenderResult =
  | { ok: true; blob: Blob; diagnostics: RenderDiagnostics }
  | {
      ok: false;
      reason: RenderFailureReason;
      message: string;
      /** Per-font results, so a failure shows which font file failed. */
      fonts: ReadonlyArray<FontDiagnostic>;
    };

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

function fail(
  reason: RenderFailureReason,
  message: string,
  fonts: ReadonlyArray<FontDiagnostic> = [],
): RenderFailure {
  return { ok: false, reason, message, fonts };
}

function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

/**
 * First family of a CSS font-family list. next/font appends a local() fallback face
 * (e.g. Arial) to the list. That face doesn't exist on Android, and including it makes
 * document.fonts.load() reject with NetworkError even though the real font is fine.
 */
function primaryFamily(list: string): string {
  const first = list.split(",")[0]?.trim();
  return first ? first : list;
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

  const displayFamily = primaryFamily(display);
  const monoFamily = primaryFamily(mono);
  const specs: ReadonlyArray<{ label: string; family: string; spec: string }> = [
    { label: "Space Mono 400", family: monoFamily, spec: `400 40px ${monoFamily}` },
    { label: "Space Mono 700", family: monoFamily, spec: `700 40px ${monoFamily}` },
    { label: "Bungee 400", family: displayFamily, spec: `400 40px ${displayFamily}` },
  ];

  // Each font loads on its own so one failure can't hide which file failed.
  const fonts: FontDiagnostic[] = await Promise.all(
    specs.map(async ({ label, family, spec }): Promise<FontDiagnostic> => {
      try {
        const faces = await document.fonts.load(spec, FONT_SAMPLE);
        return {
          label,
          family,
          facesLoaded: faces.length,
          checkOk: document.fonts.check(spec, FONT_SAMPLE),
          error: null,
        };
      } catch (error) {
        return { label, family, facesLoaded: 0, checkOk: false, error: describeError(error) };
      }
    }),
  );
  const failedFonts = fonts.filter((f) => f.error !== null || f.facesLoaded === 0);
  if (failedFonts.length > 0) {
    const detail = failedFonts.map((f) => `${f.label} (${f.error ?? "0 faces loaded"})`);
    return fail("font", `Font load failed: ${detail.join("; ")}`, fonts);
  }

  let blob: Blob | null = null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return fail("draw", "Canvas 2D context unavailable", fonts);
    drawReceipt(
      ctx,
      view,
      { display: `${displayFamily}, sans-serif`, mono: `${monoFamily}, monospace` },
      colors,
    );
    blob = await canvasToBlob(canvas);
  } catch (error) {
    return fail("draw", describeError(error), fonts);
  }
  if (!blob) return fail("blob", "canvas.toBlob returned null", fonts);

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
