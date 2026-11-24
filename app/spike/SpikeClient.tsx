"use client";

/**
 * THROWAWAY (T2.1, repointed at the real renderer in T7.2): export spike. Pre-renders the
 * receipt PNG with `lib/receipt`, then offers Share (pre-built blob, no await between tap and
 * share()) and Download. The scenario switch shows the golden example and the max-values case.
 * The texture switch (T7.3) turns the ink-stamp speckles on or off, so render time can be
 * compared on the same phone. This page calls `renderReceipt` directly, not the pre-render cache.
 */
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_RATES } from "@/config";
import {
  renderReceipt,
  type FontDiagnostic,
  type RenderDiagnostics,
  type RenderFailureReason,
} from "@/lib/receipt/render";
import { buildReceiptView, type ReceiptView } from "@/lib/receipt/view";
import type { AppState, Bucket, BucketId, Mode } from "@/lib/types";

const FILE_NAME = "detty-receipt.png";

function bucket(id: BucketId, unitPriceNgn: number, quantity: number, mode: Mode, headcount: number): Bucket {
  return { id, unitPriceNgn, quantity, mode, headcount };
}

type ScenarioId = "golden" | "max";

const SCENARIOS: Record<ScenarioId, { label: string; state: AppState }> = {
  // DATA_MODEL §2.5 golden example.
  golden: {
    label: "Golden example",
    state: {
      presetId: "soft",
      currency: "NGN",
      groupSize: 4,
      rates: DEFAULT_RATES,
      buckets: [
        bucket("stay", 150000, 7, "shared", 4),
        bucket("events", 100000, 3, "perPerson", 4),
        bucket("tables", 800000, 2, "shared", 4),
        bucket("transport", 60000, 7, "shared", 4),
        bucket("food", 40000, 7, "perPerson", 4),
      ],
    },
  },
  // Every bucket at its limit: the receipt must not clip a digit.
  max: {
    label: "Max values",
    state: {
      presetId: "baller",
      currency: "NGN",
      groupSize: 100,
      rates: DEFAULT_RATES,
      buckets: [
        bucket("stay", 50000000, 999, "shared", 1),
        bucket("events", 50000000, 999, "shared", 1),
        bucket("tables", 50000000, 999, "shared", 1),
        bucket("transport", 50000000, 999, "shared", 1),
        bucket("food", 50000000, 999, "shared", 1),
      ],
    },
  },
};
const SCENARIO_IDS: ScenarioId[] = ["golden", "max"];

function imageAlt(view: ReceiptView): string {
  return `${view.title} receipt: per person ${view.perPersonTotal}, group of ${view.groupSize} total ${view.groupTotal}, status approved.`;
}

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
  const [scenario, setScenario] = useState<ScenarioId>("golden");
  const [texture, setTexture] = useState(true);
  const view = useMemo(() => buildReceiptView(SCENARIOS[scenario].state), [scenario]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    void renderReceipt(view, { texture }).then((result) => {
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
  }, [attempt, view, texture]);

  function handleRetry(): void {
    setState({ status: "rendering" });
    setAttempt((n) => n + 1);
  }

  function handleScenario(next: ScenarioId): void {
    if (next === scenario) return;
    setState({ status: "rendering" });
    setScenario(next);
  }

  function handleTexture(): void {
    setState({ status: "rendering" });
    setTexture((on) => !on);
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
      `${state.diagnostics.renderMs} ms, ${(state.diagnostics.blobBytes / 1024).toFixed(0)} KB PNG (stamp texture ${texture ? "on" : "off"}, ${SCENARIOS[scenario].label})`,
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

      <div role="group" aria-label="Scenario" className="flex flex-wrap gap-3">
        {SCENARIO_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={BUTTON}
            aria-pressed={id === scenario}
            onClick={() => handleScenario(id)}
          >
            {SCENARIOS[id].label}
            {id === scenario ? " ✓" : ""}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={texture}
          className={BUTTON}
          onClick={handleTexture}
        >
          Stamp texture: {texture ? "on ✓" : "off"}
        </button>
      </div>

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
          alt={imageAlt(view)}
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