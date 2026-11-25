"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon, WarningIcon } from "@phosphor-icons/react";
import { buildShareUrl, copyText, type CopyResult } from "@/lib/share/link";
import { useAppState } from "@/state/AppStateProvider";

/** How long "Link copied" stays (DESIGN §6: "link copied (status line about 2s)"). */
const COPIED_MS = 2000;

const STATUS_ID = "share-bar-status";
const FIELD_ID = "share-bar-link";

/** An object, not the bare result, so a second tap is a new value and restarts the timer. */
interface CopyStatus {
  kind: CopyResult;
}

/**
 * Copy link (DESIGN §4 item 7, §5.9, §5.16). It sits under the receipt until T9.1 adds
 * "Export receipt" above it.
 *
 * The link is built inside the tap handler and handed straight to the clipboard, because
 * browsers only allow a clipboard write during the tap. When the write is refused, a read-only
 * field with the link takes over: it is focused and selected, so a long-press copies it.
 *
 * While that field is showing, its value is rebuilt from the current state on every render, so
 * an edit made after the refusal can never leave an old link in the field.
 */
export function ShareBar() {
  const { state } = useAppState();
  const [status, setStatus] = useState<CopyStatus | null>(null);
  const fieldRef = useRef<HTMLInputElement>(null);
  const kind = status?.kind;

  useEffect(() => {
    if (status?.kind !== "copied") return;
    const timer = setTimeout(() => setStatus(null), COPIED_MS);
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (status?.kind !== "denied") return;
    fieldRef.current?.focus();
    fieldRef.current?.select();
  }, [status]);

  function copyLink() {
    // No await before this call: the clipboard write has to start inside the tap.
    void copyText(buildShareUrl(state, window.location)).then((result) =>
      setStatus({ kind: result }),
    );
  }

  return (
    <div className="mx-auto mt-4 w-full max-w-[380px]">
      <button
        type="button"
        onClick={copyLink}
        className="flex h-12 w-full items-center justify-center gap-2 border-2 border-ink bg-surface font-display text-[length:var(--t-sm)] text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--focus) active:bg-danfo active:text-danfo-ink"
      >
        <CopyIcon size={20} weight="bold" aria-hidden="true" />
        Copy link
      </button>
      {/* Always in the page and two lines high even when empty, like the group row's status
          (DESIGN §5.9), so the message appearing never moves what is below it. */}
      <div id={STATUS_ID} role="status" className="mt-1 min-h-8 text-[length:var(--t-xs)] leading-4">
        {kind === "copied" && (
          <p className="flex items-start gap-1.5">
            <CheckIcon size={16} weight="bold" aria-hidden="true" className="shrink-0" />
            <span>Link copied. Drop it in the group chat.</span>
          </p>
        )}
        {kind === "denied" && (
          <p className="flex items-start gap-1.5 text-danger">
            <WarningIcon size={16} weight="bold" aria-hidden="true" className="shrink-0" />
            <span>Copy blocked. Press and hold the link below to copy.</span>
          </p>
        )}
      </div>
      {kind === "denied" && (
        <div className="mt-2">
          <label htmlFor={FIELD_ID} className="sr-only">
            Share link
          </label>
          <input
            ref={fieldRef}
            id={FIELD_ID}
            type="text"
            readOnly
            value={buildShareUrl(state, window.location)}
            aria-describedby={STATUS_ID}
            autoComplete="off"
            spellCheck={false}
            onFocus={(event) => event.currentTarget.select()}
            className="h-12 w-full border-2 border-border bg-surface px-3 font-mono text-[length:var(--t-base)] text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--focus)"
          />
        </div>
      )}
    </div>
  );
}
