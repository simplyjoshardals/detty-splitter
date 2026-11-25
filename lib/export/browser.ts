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
  if (
    typeof document === "undefined" ||
    typeof HTMLAnchorElement === "undefined"
  )
    return false;
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
 * The real environment. The wrappers call `navigator.share(...)` as a method, so `this` is
 * right (a detached `navigator.share` throws "Illegal invocation").
 */
export function browserExportEnv(): ExportEnv {
  const nav: Navigator | undefined = globalThis.navigator;
  if (nav === undefined)
    return {
      share: undefined,
      canShare: undefined,
      download: downloadViaAnchor,
    };
  return {
    share:
      typeof nav.share === "function" ? (data) => nav.share(data) : undefined,
    canShare:
      typeof nav.canShare === "function"
        ? (data) => nav.canShare(data)
        : undefined,
    download: downloadViaAnchor,
  };
}
