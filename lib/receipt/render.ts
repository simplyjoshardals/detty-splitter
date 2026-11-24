/**
 * Canvas receipt renderer (DESIGN.md §7, T7.2). The thin browser shell around `layout.ts`:
 * waits for the fonts, resolves the `--receipt-*` colours once, measures with the real canvas,
 * paints the layout's draw operations and returns a PNG blob.
 *
 * Kept apart from `view.ts` on purpose: the on-screen receipt imports `view.ts` statically, and
 * this module is meant to be loaded lazily (T7.3).
 */
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  PAD_X,
  layoutReceipt,
  type ColorRole,
  type DrawOp,
  type FontSpec,
  type Measure,
} from "./layout";
import { makeSpeckles } from "./speckle";
import type { ReceiptView } from "./view";

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

export interface RenderOptions {

  texture?: boolean;
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
type Colors = Record<ColorRole, string>;
type Families = Record<FontSpec["role"], string>;
type StampOp = Extract<DrawOp, { kind: "stamp" }>;

// Latin only: the ₦ comes from the naira face below, so the latin-ext file is not needed.
const FONT_SAMPLE = "$£0123456789.,:*×÷ ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz";
// The naira face is limited to U+20A6 by `unicode-range`, so it only downloads for this sample.
const NAIRA_SAMPLE = "₦";

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
 * document.fonts.load() reject with NetworkError even though the real font is fine (T2.2).
 */
function primaryFamily(list: string): string {
  const first = list.split(",")[0]?.trim();
  return first ? first : list;
}

/** A canvas can't read CSS variables, so resolve them from the document. */
function readCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function readColors(): Colors | null {
  const paper = readCssVar("--receipt-paper");
  const ink = readCssVar("--receipt-ink");
  const muted = readCssVar("--receipt-muted");
  const stamp = readCssVar("--receipt-stamp");
  const danfo = readCssVar("--receipt-danfo");
  if (!paper || !ink || !muted || !stamp || !danfo) return null;
  return { paper, ink, muted, stamp, danfo };
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

function cssFont(font: FontSpec, families: Families): string {
  return `${font.weight} ${font.size}px ${families[font.role]}`;
}

const STAMP_LAYER_MARGIN = 4;

function strokeAndFillStamp(
  ctx: CanvasRenderingContext2D,
  op: StampOp,
  color: string,
  families: Families,
): void {
  ctx.strokeStyle = color;
  ctx.setLineDash([]);
  // Double border: a heavy outer line and a lighter inner one.
  ctx.lineWidth = 6;
  ctx.strokeRect(-op.width / 2, -op.height / 2, op.width, op.height);
  ctx.lineWidth = 3;
  ctx.strokeRect(-op.width / 2 + 12, -op.height / 2 + 12, op.width - 24, op.height - 24);
  ctx.font = cssFont(op.font, families);
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const top = -(op.lines.length * op.lineHeight) / 2;
  op.lines.forEach((line, i) => ctx.fillText(line, 0, top + op.lineHeight * (i + 0.5)));
}

function drawFlatStamp(ctx: CanvasRenderingContext2D, op: StampOp, color: string, families: Families): void {
  ctx.save();
  ctx.translate(op.centerX, op.centerY);
  ctx.rotate(op.angle);
  strokeAndFillStamp(ctx, op, color, families);
  ctx.restore();
}

function drawTexturedStamp(
  ctx: CanvasRenderingContext2D,
  op: StampOp,
  color: string,
  families: Families,
): boolean {
  const layerWidth = Math.ceil(op.width) + STAMP_LAYER_MARGIN * 2;
  const layerHeight = Math.ceil(op.height) + STAMP_LAYER_MARGIN * 2;
  const layer = document.createElement("canvas");
  layer.width = layerWidth;
  layer.height = layerHeight;
  const layerCtx = layer.getContext("2d");
  if (!layerCtx) return false;

  layerCtx.save();
  layerCtx.translate(layerWidth / 2, layerHeight / 2);
  strokeAndFillStamp(layerCtx, op, color, families);
  layerCtx.restore();

  const left = (layerWidth - op.width) / 2;
  const topEdge = (layerHeight - op.height) / 2;
  layerCtx.save();
  layerCtx.globalCompositeOperation = "destination-out";
  layerCtx.fillStyle = "#000";
  for (const speckle of makeSpeckles(op.seed, op.width, op.height)) {
    layerCtx.beginPath();
    layerCtx.arc(left + speckle.x, topEdge + speckle.y, speckle.r, 0, Math.PI * 2);
    layerCtx.fill();
  }
  layerCtx.restore();

  ctx.save();
  ctx.translate(op.centerX, op.centerY);
  ctx.rotate(op.angle);
  ctx.drawImage(layer, -layerWidth / 2, -layerHeight / 2);
  ctx.restore();
  return true;
}

function drawStamp(
  ctx: CanvasRenderingContext2D,
  op: StampOp,
  color: string,
  families: Families,
  texture: boolean,
): void {
  if (texture && drawTexturedStamp(ctx, op, color, families)) return;
  drawFlatStamp(ctx, op, color, families);
}

function paint(
  ctx: CanvasRenderingContext2D,
  ops: ReadonlyArray<DrawOp>,
  colors: Colors,
  families: Families,
  texture: boolean,
): void {
  for (const op of ops) {
    switch (op.kind) {
      case "rect":
        ctx.fillStyle = colors[op.color];
        ctx.fillRect(op.x, op.y, op.width, op.height);
        break;
      case "rule":
        ctx.save();
        ctx.strokeStyle = colors[op.color];
        ctx.lineWidth = op.lineWidth;
        ctx.setLineDash([...op.dash]);
        ctx.beginPath();
        ctx.moveTo(PAD_X, op.y);
        ctx.lineTo(CANVAS_WIDTH - PAD_X, op.y);
        ctx.stroke();
        ctx.restore();
        break;
      case "text":
        ctx.font = cssFont(op.font, families);
        ctx.fillStyle = colors[op.color];
        ctx.textAlign = op.align;
        ctx.textBaseline = op.baseline;
        ctx.fillText(op.text, op.x, op.y);
        break;
      case "stamp":
        drawStamp(ctx, op, colors.stamp, families, texture);
        break;
    }
  }
}

/**
 * Waits for the fonts, draws the receipt and returns a PNG blob.
 * Never throws: every failure comes back as a typed result.
 */
export async function renderReceipt(view: ReceiptView, options: RenderOptions = {}): Promise<RenderResult> {
  const texture = options.texture ?? true;
  const started = performance.now();

  // next/font gives its fonts generated family names, so read them from the CSS variables.
  const display = readCssVar("--font-bungee");
  const mono = readCssVar("--font-space-mono");
  const naira = readCssVar("--font-naira");
  if (!display || !mono || !naira) {
    return fail("font", "CSS variables --font-bungee / --font-space-mono / --font-naira not found");
  }
  const colors = readColors();
  if (!colors) return fail("draw", "CSS variables --receipt-* not found");

  const displayFamily = primaryFamily(display);
  const monoFamily = primaryFamily(mono);
  const nairaFamily = primaryFamily(naira);
  const specs: ReadonlyArray<{ label: string; family: string; spec: string; sample: string }> = [
    { label: "Space Mono 400", family: monoFamily, spec: `400 40px ${monoFamily}`, sample: FONT_SAMPLE },
    { label: "Space Mono 700", family: monoFamily, spec: `700 40px ${monoFamily}`, sample: FONT_SAMPLE },
    { label: "Bungee 400", family: displayFamily, spec: `400 40px ${displayFamily}`, sample: FONT_SAMPLE },
    { label: "Naira (₦)", family: nairaFamily, spec: `400 40px ${nairaFamily}`, sample: NAIRA_SAMPLE },
  ];

  // Each font loads on its own so one failure can't hide which file failed.
  const fonts: FontDiagnostic[] = await Promise.all(
    specs.map(async ({ label, family, spec, sample }): Promise<FontDiagnostic> => {
      try {
        const faces = await document.fonts.load(spec, sample);
        return {
          label,
          family,
          facesLoaded: faces.length,
          checkOk: document.fonts.check(spec, sample),
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

  // The naira face goes first so the ₦ is drawn from it; every other glyph falls through to
  // Space Mono (same stack as the page, globals.css).
  const families: Families = {
    display: `${displayFamily}, sans-serif`,
    mono: `${nairaFamily}, ${monoFamily}, monospace`,
  };

  let blob: Blob | null = null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return fail("draw", "Canvas 2D context unavailable", fonts);
    const measure: Measure = (text, font) => {
      ctx.font = cssFont(font, families);
      return ctx.measureText(text).width;
    };
    const layout = layoutReceipt(view, measure);
    if (!layout.ok) return fail("draw", `Receipt does not fit: ${layout.message}`, fonts);
    paint(ctx, layout.ops, colors, families, texture);
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
