import { afterEach, describe, expect, it, vi } from "vitest";
import { EXPORT_FILE_NAME, exportReceipt } from "@/lib/export";
import type { ExportEnv, ExportSource } from "@/lib/export";
import type { PrerenderSnapshot } from "@/lib/receipt/prerender";
import type { RenderFailureReason } from "@/lib/receipt/render";

const BLOB = new Blob(["png-bytes"], { type: "image/png" });

function readySnapshot(blob: Blob = BLOB): PrerenderSnapshot {
  return {
    status: "ready",
    blob,
    diagnostics: { fonts: [], renderMs: 1, blobBytes: blob.size },
  };
}

function sourceOf(snapshot: PrerenderSnapshot) {
  const start = vi.fn<() => void>();
  const getSnapshot = vi.fn<() => PrerenderSnapshot>(() => snapshot);
  const source: ExportSource = { getSnapshot, start };
  return { source, start, getSnapshot };
}

/** A working environment: sharing is supported and succeeds, download works. */
function makeEnv() {
  const share = vi.fn<(data: ShareData) => Promise<void>>(() => Promise.resolve());
  const canShare = vi.fn<(data: ShareData) => boolean>(() => true);
  const download = vi.fn<(blob: Blob, fileName: string) => boolean>(() => true);
  const env: ExportEnv = { share, canShare, download };
  return { env, share, canShare, download };
}

function abortError(): DOMException {
  return new DOMException("The share was cancelled", "AbortError");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("exportReceipt: share path", () => {
  it("shares the pre-built blob as a PNG file", async () => {
    const { source } = sourceOf(readySnapshot());
    const { env, share, canShare, download } = makeEnv();

    const result = await exportReceipt({ source, env });

    expect(result).toEqual({ status: "shared", method: "share" });
    const data = canShare.mock.calls[0]?.[0];
    expect(data?.files).toHaveLength(1);
    const file = data?.files?.[0];
    expect(file?.name).toBe(EXPORT_FILE_NAME);
    expect(file?.type).toBe("image/png");
    expect(file?.size).toBe(BLOB.size);
    expect(share).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith(data);
    expect(download).not.toHaveBeenCalled();
  });

  it("calls canShare, then share, before any microtask runs (no await before share)", () => {
    const { source } = sourceOf(readySnapshot());
    const { env, share, canShare } = makeEnv();

    const pending = exportReceipt({ source, env });

    // Nothing has been awaited yet: both calls already happened inside the "tap".
    expect(canShare).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledTimes(1);
    expect(canShare.mock.invocationCallOrder[0]).toBeLessThan(share.mock.invocationCallOrder[0] ?? 0);
    return pending;
  });

  it("never touches the renderer: a ready blob needs no start()", async () => {
    const { source, start } = sourceOf(readySnapshot());
    await exportReceipt({ source, env: makeEnv().env });
    expect(start).not.toHaveBeenCalled();
  });

  it("is silent when the user cancels (AbortError) and does not fall through", async () => {
    const { source } = sourceOf(readySnapshot());
    const { env, share, download } = makeEnv();
    share.mockRejectedValueOnce(abortError());

    expect(await exportReceipt({ source, env })).toEqual({ status: "cancelled" });
    expect(download).not.toHaveBeenCalled();
  });

  it("treats any object named AbortError as a cancel (cross-realm errors)", async () => {
    const { source } = sourceOf(readySnapshot());
    const { env, share } = makeEnv();
    share.mockRejectedValueOnce({ name: "AbortError" });

    expect(await exportReceipt({ source, env })).toEqual({ status: "cancelled" });
  });
});

describe("exportReceipt: fallbacks", () => {
  it("downloads when canShare says no", async () => {
    const { source } = sourceOf(readySnapshot());
    const { env, share, canShare, download } = makeEnv();
    canShare.mockReturnValue(false);

    expect(await exportReceipt({ source, env })).toEqual({ status: "downloaded", method: "download" });
    expect(share).not.toHaveBeenCalled();
    expect(download).toHaveBeenCalledWith(BLOB, EXPORT_FILE_NAME);
  });

  it.each([
    ["has no canShare", { canShare: undefined }],
    ["has no share", { share: undefined }],
    ["has neither", { share: undefined, canShare: undefined }],
  ] as const)("downloads when the browser %s", async (_label, missing) => {
    const { source } = sourceOf(readySnapshot());
    const base = makeEnv();
    const env: ExportEnv = { ...base.env, ...missing };

    expect(await exportReceipt({ source, env })).toEqual({ status: "downloaded", method: "download" });
    expect(base.download).toHaveBeenCalledTimes(1);
  });

  it("downloads when canShare throws (older Safari)", async () => {
    const { source } = sourceOf(readySnapshot());
    const { env, share, canShare, download } = makeEnv();
    canShare.mockImplementation(() => {
      throw new TypeError("canShare is not a function");
    });

    expect(await exportReceipt({ source, env })).toEqual({ status: "downloaded", method: "download" });
    expect(share).not.toHaveBeenCalled();
    expect(download).toHaveBeenCalledTimes(1);
  });

  it("downloads when share() throws synchronously", async () => {
    const { source } = sourceOf(readySnapshot());
    const { env, share, download } = makeEnv();
    share.mockImplementation(() => {
      throw new TypeError("Illegal invocation");
    });

    expect(await exportReceipt({ source, env })).toEqual({ status: "downloaded", method: "download" });
    expect(download).toHaveBeenCalledTimes(1);
  });

  it.each(["NotAllowedError", "DataError", "TypeError"])(
    "downloads when share() rejects with %s",
    async (name) => {
      const { source } = sourceOf(readySnapshot());
      const { env, share, download } = makeEnv();
      share.mockRejectedValueOnce(new DOMException("nope", name));

      expect(await exportReceipt({ source, env })).toEqual({ status: "downloaded", method: "download" });
      expect(download).toHaveBeenCalledTimes(1);
    },
  );

  it("downloads when share() rejects with a non-error value", async () => {
    const { source } = sourceOf(readySnapshot());
    const { env, share, download } = makeEnv();
    share.mockRejectedValueOnce("boom");

    expect(await exportReceipt({ source, env })).toEqual({ status: "downloaded", method: "download" });
    expect(download).toHaveBeenCalledTimes(1);
  });

  it("downloads when the browser cannot build a File", async () => {
    vi.stubGlobal("File", undefined);
    const { source } = sourceOf(readySnapshot());
    const { env, share, canShare, download } = makeEnv();

    expect(await exportReceipt({ source, env })).toEqual({ status: "downloaded", method: "download" });
    expect(canShare).not.toHaveBeenCalled();
    expect(share).not.toHaveBeenCalled();
    expect(download).toHaveBeenCalledTimes(1);
  });

  it("shows the image inline when anchor downloads are unsupported", async () => {
    const { source } = sourceOf(readySnapshot());
    const { env, download } = makeEnv();
    download.mockReturnValue(false);
    env.canShare = undefined;

    expect(await exportReceipt({ source, env })).toEqual({ status: "inline", method: "inline" });
  });

  it("shows the image inline when the download throws", async () => {
    const { source } = sourceOf(readySnapshot());
    const { env, download } = makeEnv();
    download.mockImplementation(() => {
      throw new Error("blocked");
    });
    env.share = undefined;

    expect(await exportReceipt({ source, env })).toEqual({ status: "inline", method: "inline" });
  });

  it("falls all the way to inline after a failed share and a failed download", async () => {
    const { source } = sourceOf(readySnapshot());
    const { env, share, download } = makeEnv();
    share.mockRejectedValueOnce(new DOMException("nope", "NotAllowedError"));
    download.mockReturnValue(false);

    expect(await exportReceipt({ source, env })).toEqual({ status: "inline", method: "inline" });
  });
});

describe("exportReceipt: blob not ready", () => {
  it.each(["idle", "waiting", "rendering"] as const)(
    "returns not_ready while the pre-render is %s, and asks it to start",
    async (status) => {
      const { source, start } = sourceOf({ status });
      const { env, share, canShare, download } = makeEnv();

      expect(await exportReceipt({ source, env })).toEqual({ status: "not_ready" });
      expect(start).toHaveBeenCalledTimes(1);
      expect(canShare).not.toHaveBeenCalled();
      expect(share).not.toHaveBeenCalled();
      expect(download).not.toHaveBeenCalled();
    },
  );

  it("reads the latest snapshot on every tap: the second tap shares", async () => {
    let snapshot: PrerenderSnapshot = { status: "rendering" };
    const source: ExportSource = { getSnapshot: () => snapshot, start: vi.fn() };
    const { env, share } = makeEnv();

    expect(await exportReceipt({ source, env })).toEqual({ status: "not_ready" });
    snapshot = readySnapshot();
    expect(await exportReceipt({ source, env })).toEqual({ status: "shared", method: "share" });
    expect(share).toHaveBeenCalledTimes(1);
  });
});

describe("exportReceipt: failed pre-render", () => {
  it.each(["font", "draw", "blob", "unknown"] as const satisfies readonly RenderFailureReason[])(
    "reports a %s failure without sharing or restarting",
    async (reason) => {
      const { source, start } = sourceOf({ status: "failed", reason });
      const { env, share, download } = makeEnv();

      expect(await exportReceipt({ source, env })).toEqual({ status: "failed", reason });
      expect(start).not.toHaveBeenCalled();
      expect(share).not.toHaveBeenCalled();
      expect(download).not.toHaveBeenCalled();
    },
  );

  it("maps a failed renderer import (load) to unknown and retries the import", async () => {
    const { source, start } = sourceOf({ status: "failed", reason: "load" });

    expect(await exportReceipt({ source, env: makeEnv().env })).toEqual({
      status: "failed",
      reason: "unknown",
    });
    expect(start).toHaveBeenCalledTimes(1);
  });
});
