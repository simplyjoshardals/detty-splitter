"use client";

/**
 * THROWAWAY (T2.1): export spike. Pre-renders the receipt PNG, then offers
 * Share (pre-built blob, no await between tap and share()) and Download.
 */
import { useEffect, useState } from "react";
import { SITE_URL } from "@/config";
import {
  renderReceipt,
  type FontDiagnostic,
  type RenderDiagnostics,
  type RenderFailureReason,
  type SpikeReceiptView,
} from "./drawReceipt";

const FILE_NAME = "detty-receipt.png";

// DATA_MODEL §2.5 golden example, hard-coded.
const VIEW: SpikeReceiptView = {
  title: "Detty December 2026",
  lines: [
    { label: "STAY", formula: "₦150,000 × 7 ÷ 4", yourShare: "₦262,500" },
    { label: "EVENTS", formula: "₦100,000 × 3", yourShare: "₦300,000" },
    { label: "TABLES", formula: "₦800,000 × 2 ÷ 4", yourShare: "₦400,000" },
    { label: "TRANSPORT", formula: "₦60,000 × 7 ÷ 4", yourShare: "₦105,000" },
    { label: "FOOD", formula: "₦40,000 × 7", yourShare: "₦280,000" },
  ],
  groupSize: 4,
  perPersonTotal: "₦1,347,500",
  groupTotal: "₦5,390,000",
  balanceLine: "AVAIL BAL: ₦0.00",
  authCode: "7K2M9QX4",
  siteUrl: SITE_URL,
};

const IMAGE_ALT =
  "Detty December 2026 receipt: per person ₦1,347,500, group of 4 total ₦5,390,000, status approved.";

const BUTTON =
  "inline-flex min-h-11 items-center justify-center border-2 border-ink bg-danfo px-4 py-2 font-display text-base text-danfo-ink disabled:opacity-50";

type RenderState =
  | { status: "rendering" }
  | {
      status: "ready";
      file: File;
      url: string;
      diagnostics: RenderDiagnostics;
    }
  | {
      status: "failed";
      reason: RenderFailureReason;
      message: string;
      fonts: ReadonlyArray<FontDiagnostic>;
    };

interface Environment {
  userAgent: string;
  hasShare: boolean;
  canShareFiles: boolean | null;
  online: boolean;
}

function yesNo(value: boolean | null): string {
  if (value === null) return "unknown";
  return value ? "yes" : "no";
}

export function SpikeClient() {
  const [state, setState] = useState<RenderState>({ status: "rendering" });
  const [env, setEnv] = useState<Environment | null>(null);
  const [lastAction, setLastAction] = useState("none yet");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    void renderReceipt(VIEW).then((result) => {
      if (cancelled) return;
      const hasShare = "share" in navigator;

      if (!result.ok) {
        setEnv({
          userAgent: navigator.userAgent,
          hasShare,
          canShareFiles: null,
          online: navigator.onLine,
        });
        setState({
          status: "failed",
          reason: result.reason,
          message: result.message,
          fonts: result.fonts,
        });
        return;
      }

      const file = new File([result.blob], FILE_NAME, { type: "image/png" });
      objectUrl = URL.createObjectURL(result.blob);
      setEnv({
        userAgent: navigator.userAgent,
        hasShare,
        canShareFiles: "canShare" in navigator ? navigator.canShare({ files: [file] }) : false,
        online: navigator.onLine,
      });
      setState({ status: "ready", file, url: objectUrl, diagnostics: result.diagnostics });
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attempt]);

  function handleRetry(): void {
    setState({ status: "rendering" });
    setAttempt((n) => n + 1);
  }

  // Deliberately NOT async: share() must start inside the click, with no await before it.
  function handleShare(): void {
    if (state.status !== "ready") return;
    const data: ShareData = { files: [state.file] };
    if (!("share" in navigator) || !("canShare" in navigator) || !navigator.canShare(data)) {
      setLastAction("share: not supported for files here");
      return;
    }
    navigator.share(data).then(
      () => setLastAction("share: ok"),
      (error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          setLastAction("share: cancelled (AbortError, not an error)");
          return;
        }
        setLastAction(
          `share: failed (${error instanceof Error ? `${error.name}: ${error.message}` : String(error)})`,
        );
      },
    );
  }

  const rows: Array<readonly [string, string]> = [];
  if (env) {
    rows.push(["User agent", env.userAgent]);
    rows.push(["navigator.onLine", yesNo(env.online)]);
    rows.push(["navigator.share", yesNo(env.hasShare)]);
    rows.push(["canShare({ files })", yesNo(env.canShareFiles)]);
  }
  const fontRows =
    state.status === "ready"
      ? state.diagnostics.fonts
      : state.status === "failed"
        ? state.fonts
        : [];
  for (const font of fontRows) {
    const error = font.error ? `, error: ${font.error}` : "";
    rows.push([
      font.label,
      `${font.facesLoaded} face(s) loaded, check ${yesNo(font.checkOk)}, family ${font.family}${error}`,
    ]);
  }
  if (state.status === "ready") {
    rows.push([
      "Render",
      `${state.diagnostics.renderMs} ms, ${(state.diagnostics.blobBytes / 1024).toFixed(0)} KB PNG`,
    ]);
  }
  rows.push(["Render attempts", String(attempt + 1)]);
  rows.push(["Last action", lastAction]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-xl">Export spike (throwaway)</h1>

      <p role="status" className="text-base">
        {state.status === "rendering" && "Printing…"}
        {state.status === "ready" && "Receipt ready. Go and post am."}
        {state.status === "failed" && `Render failed (${state.reason}): ${state.message}`}
      </p>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={BUTTON}
          disabled={state.status !== "ready"}
          onClick={handleShare}
        >
          Share now
        </button>
        {state.status === "failed" && (
          <button type="button" className={BUTTON} onClick={handleRetry}>
            Retry
          </button>
        )}
        {state.status === "ready" ? (
          <a
            className={BUTTON}
            href={state.url}
            download={FILE_NAME}
            onClick={() => setLastAction("download: link clicked")}
          >
            Download
          </a>
        ) : (
          <button type="button" className={BUTTON} disabled>
            Download
          </button>
        )}
      </div>

      {state.status === "ready" && (
        // A blob URL can't go through next/image, so a plain img is used here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={state.url}
          alt={IMAGE_ALT}
          width={1080}
          height={1920}
          className="h-auto w-full border-2 border-border"
        />
      )}

      <section aria-labelledby="diag-heading" className="flex flex-col gap-2">
        <h2 id="diag-heading" className="font-display text-lg">
          Diagnostics
        </h2>
        <ul className="flex flex-col gap-1 break-words font-mono text-sm">
          {rows.map(([label, value]) => (
            <li key={label}>
              <span className="text-muted">{label}: </span>
              {value}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
