/**
 * Building and copying the share link (DATA_MODEL §4.3: the link is made when the user taps
 * "Copy link", never on every keystroke). No React and no storage. `copyText` is the only
 * function that touches the browser, and it never throws.
 */
import type { AppState } from "@/lib/types";
import { encodeShare } from "./index";

/** The two parts of `window.location` the link is built from. */
export interface LinkBase {
  origin: string;
  pathname: string;
}

/**
 * The full link for a state: this page's address, with any old hash or query dropped, plus the
 * encoder's hash. Rebuilt from state every time, so nothing from the current URL is echoed.
 */
export function buildShareUrl(state: AppState, base: LinkBase): string {
  return `${base.origin}${base.pathname}${encodeShare(state)}`;
}

/** `denied` covers every failure: no clipboard API, no permission, insecure page, a throw. */
export type CopyResult = "copied" | "denied";

/**
 * Writes `text` to the clipboard. On "denied" the UI shows a read-only field for press-and-hold
 * copying (DESIGN §9, UI_PLAN §1.1). Call it straight from the tap handler: clipboard writes
 * need a user gesture, so nothing slow may run before it.
 */
export async function copyText(text: string): Promise<CopyResult> {
  try {
    const clipboard = globalThis.navigator?.clipboard;
    if (clipboard === undefined) return "denied";
    await clipboard.writeText(text);
    return "copied";
  } catch {
    return "denied";
  }
}
