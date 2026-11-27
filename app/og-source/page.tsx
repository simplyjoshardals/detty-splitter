import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { makeSpeckles, seedFromAuthCode } from "@/lib/receipt/speckle";
import { buildReceiptView, RECEIPT_COPY } from "@/lib/receipt/view";
import { createInitialState } from "@/state/reducer";

/**
 * TEMPORARY (T10.2): the source for public/og-image.png. Delete this folder once the PNG is saved.
 * It draws a 1200x630 card from the real default receipt (`buildReceiptView(createInitialState())`),
 * so the numbers, tier badge and copy cannot drift from the app. Capture the #og-card element at
 * device pixel ratio 1 (see BUILD_PLAN T10.2). Server component, no client code.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

const W = 1200;
const H = 630;
const INK = "var(--danfo-ink)"; // fixed #111 in both themes (--ink flips in dark mode)
const PAPER = "var(--receipt-paper)";
const STAMP_W = 300;
const STAMP_H = 112;

/** "SOFT LIFE CERTIFIED" -> ["SOFT LIFE", "CERTIFIED"]: the split with the most even line lengths. */
function splitBadge(badge: string): [string, string] {
  const words = badge.toUpperCase().split(/\s+/).filter(Boolean);
  let best: [string, string] = [words.join(" "), ""];
  let bestGap = Number.POSITIVE_INFINITY;
  for (let i = 1; i < words.length; i += 1) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    const gap = Math.abs(a.length - b.length);
    if (gap < bestGap) {
      bestGap = gap;
      best = [a, b];
    }
  }
  return best;
}

function Stamp({ badge, authCode }: { badge: string; authCode: string }) {
  const [first, second] = splitBadge(badge);
  const speckles = makeSpeckles(seedFromAuthCode(authCode), STAMP_W, STAMP_H);
  return (
    <svg
      width={STAMP_W}
      height={STAMP_H}
      viewBox={`0 0 ${STAMP_W} ${STAMP_H}`}
      style={{ display: "block", margin: "0 auto", transform: "rotate(-4deg)", color: "var(--receipt-stamp)" }}
      role="img"
      aria-label={badge}
    >
      <defs>
        <mask id="og-speckle">
          <rect width={STAMP_W} height={STAMP_H} fill="#fff" />
          {speckles.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#000" />
          ))}
        </mask>
      </defs>
      <g mask="url(#og-speckle)" fill="none" stroke="currentColor">
        <rect x="3" y="3" width={STAMP_W - 6} height={STAMP_H - 6} strokeWidth="4" />
        <rect x="11" y="11" width={STAMP_W - 22} height={STAMP_H - 22} strokeWidth="2" />
        <g
          fill="currentColor"
          stroke="none"
          textAnchor="middle"
          style={{ fontFamily: "var(--font-bungee)", fontSize: 34 }}
        >
          <text x={STAMP_W / 2} y="52">{first}</text>
          <text x={STAMP_W / 2} y="90">{second}</text>
        </g>
      </g>
    </svg>
  );
}

const rule: CSSProperties = { borderTop: `2px dashed var(--receipt-muted)`, margin: "10px 0" };
const doubleRule: CSSProperties = { borderTop: `6px double ${INK}`, margin: "8px 0 10px" };

export default function OgSource() {
  const view = buildReceiptView(createInitialState());
  const [debitAlert, merchant] = RECEIPT_COPY.posHeader;
  const siteHost = view.siteUrl.replace(/^https?:\/\//, "");

  return (
    <div
      id="og-card"
      className="font-mono"
      style={{
        position: "relative",
        width: W,
        height: H,
        overflow: "hidden",
        background: "var(--danfo)",
        color: INK,
      }}
    >
      {/* Left: wordmark and tagline. Bungee draws words only; no currency symbol is set in it. */}
      <div style={{ position: "absolute", left: 64, top: 52, width: 520 }}>
        <div
          className="font-display"
          style={{ fontSize: 116, lineHeight: 0.92, letterSpacing: "-0.01em" }}
        >
          DETTY
          <br />
          DEC
          <br />
          2026
        </div>
        <p style={{ marginTop: 22, fontSize: 28, lineHeight: "40px", fontWeight: 700 }}>
          Plan the damage before December plans you.
        </p>
      </div>

      {/* Bottom bar: the site URL, black with yellow text like the damage meter. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 84,
          background: INK,
          color: "var(--danfo)",
          display: "flex",
          alignItems: "center",
          paddingLeft: 64,
          fontSize: 30,
          fontWeight: 700,
        }}
      >
        {siteHost}
      </div>

      {/* Right: the slip, tilted, running off the bottom edge. Its stamp is kept inside the card. */}
      <div
        className="on-receipt"
        style={{
          position: "absolute",
          left: 630,
          top: 36,
          width: 480,
          height: 700,
          background: PAPER,
          color: "var(--receipt-ink)",
          border: `3px solid ${INK}`,
          boxShadow: `10px 10px 0 ${INK}`,
          transform: "rotate(3deg)",
          transformOrigin: "50% 50%",
        }}
      >
        <div
          className="font-display"
          style={{
            background: "var(--receipt-danfo)",
            color: INK,
            height: 54,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
          }}
        >
          {view.title.toUpperCase()}
        </div>
        <div style={{ height: 6, background: INK }} />

        <div style={{ padding: "14px 28px 0" }}>
          <div style={{ textAlign: "center", lineHeight: "30px", fontSize: 24, fontWeight: 700 }}>{debitAlert}</div>
          <div style={{ textAlign: "center", lineHeight: "22px", fontSize: 17 }}>{merchant}</div>
          <div style={rule} />

          {view.lines.map((line) => (
            <div
              key={line.label}
              style={{ display: "flex", justifyContent: "space-between", lineHeight: "30px" }}
            >
              <span style={{ fontSize: 18 }}>{line.label}</span>
              <span style={{ fontSize: 21, fontWeight: 700 }}>{line.yourShare}</span>
            </div>
          ))}

          <div style={doubleRule} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 20, fontWeight: 700 }}>PER PERSON</span>
            <span style={{ fontSize: 38, fontWeight: 700, lineHeight: "42px" }}>{view.perPersonTotal}</span>
          </div>

          <div style={{ marginTop: 16 }}>
            <Stamp badge={view.badge} authCode={view.authCode} />
          </div>
          <div style={{ marginTop: 18, textAlign: "center", fontSize: 17, fontWeight: 700, lineHeight: "22px" }}>
            {view.balanceLine}
          </div>
        </div>
      </div>
    </div>
  );
}
