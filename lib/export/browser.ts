/**
 * The browser side of the export chain (T9.1): the real `navigator` calls and the anchor
 * download. Kept apart from `index.ts` so the chain itself runs in plain Node tests with a
 * fake `ExportEnv`.
 *
 * Everything here is read at call time, not at import time, so importing this file on the
 * server (static export) touches no browser global.
 */

/** How long the object URL for a download stays alive. Revoking too early can cancel the save. */
export const REVOKE_DELAY_MS = 10_000;

/**
 * The browser features the chain uses. `share` and `canShare` are `undefined` when the browser
 * has no such API. `download` returns `false` when anchor downloads are unsupported and may
 * throw; the chain treats both as "go to the inline image".
 */
export interface ExportEnv {
  share: ((data: ShareData) => Promise<void>) | undefined;
  canShare: ((data: ShareData) => boolean) | undefined;
  download: (blob: Blob, fileName: string) => boolean;
}

/**
 * Saves `blob` through a hidden `<a download>`. Returns `false` when the browser has no anchor
 * `download` support. Nothing tells us whether the browser then actually saved the file (an
 * in-app browser may only open the image), so `true` means "the click was made".
 */
export function downloadViaAnchor(blob: Blob, fileName: string): boolean {
  if (typeof document === "undefined" || typeof HTMLAnchorElement === "undefined") return false;
  if (!("download" in HTMLAnchorElement.prototype)) return false;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.append(anchor);
  try {
    anchor.click();
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  } finally {
    anchor.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
  return true;
}

/**
 * Whether to offer the native share sheet at all. It is a phone and tablet feature: there the
 * primary pointer is a finger (`coarse`). On a desktop (mouse or trackpad) the sheet is
 * unreliable: Chrome on Windows exposes file sharing, but on the author's machine the first
 * `share()` stayed pending with no sheet and the next one failed with `InvalidStateError`.
 * Desktops go straight to the download. Without `matchMedia` we can't tell, so sharing stays on.
 */
export function prefersShareSheet(): boolean {
  if (typeof globalThis.matchMedia !== "function") return true;
  return globalThis.matchMedia("(pointer: coarse)").matches;
}

/**
 * The real environment. The wrappers call `navigator.share(...)` as a method, so `this` is
 * right (a detached `navigator.share` throws "Illegal invocation").
 */
export function browserExportEnv(): ExportEnv {
  const nav: Navigator | undefined = globalThis.navigator;
  if (nav === undefined || !prefersShareSheet()) {
    return { share: undefined, canShare: undefined, download: downloadViaAnchor };
  }
  return {
    share: typeof nav.share === "function" ? (data) => nav.share(data) : undefined,
    canShare: typeof nav.canShare === "function" ? (data) => nav.canShare(data) : undefined,
    download: downloadViaAnchor,
  };
}

/**
 * User-agent markers of the in-app browsers we know (T9.2). Matched without `\b` where the
 * marker is followed by `_` or a digit in the real strings (`musical_ly_26`, `Line/13`).
 */
const IN_APP_MARKERS: readonly RegExp[] = [
  /\bInstagram\b/,
  /\b(?:FBAN|FBAV|FB_IAB)\b/, // Facebook and Messenger
  /musical_ly|Bytedance|TikTok/,
  /\bLine\/\d/,
  /MicroMessenger/, // WeChat
  /; wv\)/, // any Android WebView
];

/**
 * Whether the user agent looks like an in-app browser. Best effort, and used only to show the
 * "open this page in your browser" hint: the export chain never branches on it (T2.2 decision 4).
 * A miss shows no hint; a false hit shows a harmless tip. Not detectable: iOS WebViews that send
 * no app marker, and X's browser (WhatsApp has no in-app browser). Pass `navigator.userAgent`
 * after mount, so the server render and the first client render agree.
 */
export function isInAppBrowser(userAgent: string): boolean {
  return IN_APP_MARKERS.some((marker) => marker.test(userAgent));
}