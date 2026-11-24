import { describe, expect, it } from "vitest";
import type { LoadResult } from "@/lib/share/load";
import { createInitialState } from "@/state/reducer";
import { createSession, sessionReducer } from "@/state/session";
import { GOLDEN, MAX_VALUES, deepFreeze } from "./fixtures";

const fromHash: LoadResult = { source: "hash", state: MAX_VALUES, clamped: [], rejected: null };
const rejected: LoadResult = {
  source: "default",
  state: createInitialState(),
  clamped: [],
  rejected: "bad_structure",
};
const silentDefault: LoadResult = { ...rejected, rejected: null };

describe("createSession", () => {
  it("starts on the default scenario, not hydrated, with no notice", () => {
    const session = createSession();
    expect(session.app).toEqual(createInitialState());
    expect(session.hydrated).toBe(false);
    expect(session.linkNotice).toBe(false);
  });
});

describe("hydrated", () => {
  it("applies a loaded state and marks the session hydrated, with no notice", () => {
    const next = sessionReducer(createSession(), { type: "hydrated", load: fromHash });
    expect(next).toEqual({ app: MAX_VALUES, hydrated: true, linkNotice: false });
  });

  it("a rejected link keeps the default on screen and raises the notice, in one step", () => {
    const start = createSession();
    const next = sessionReducer(start, { type: "hydrated", load: rejected });
    expect(next.app).toBe(start.app);
    expect(next.hydrated).toBe(true);
    expect(next.linkNotice).toBe(true);
  });

  it("a silent default (no link, no snapshot) keeps the state and raises no notice", () => {
    const start = createSession();
    const next = sessionReducer(start, { type: "hydrated", load: silentDefault });
    expect(next.app).toBe(start.app);
    expect(next.hydrated).toBe(true);
    expect(next.linkNotice).toBe(false);
  });

  it("is applied once: a second one (the dev double-run) changes nothing", () => {
    const once = sessionReducer(createSession(), { type: "hydrated", load: fromHash });
    const twice = sessionReducer(once, { type: "hydrated", load: rejected });
    expect(twice).toBe(once);
  });

  it("does not mutate the previous session", () => {
    sessionReducer(deepFreeze(createSession()), { type: "hydrated", load: fromHash });
  });
});

describe("dismissNotice", () => {
  it("clears the notice and nothing else", () => {
    const shown = sessionReducer(createSession(), { type: "hydrated", load: rejected });
    expect(sessionReducer(shown, { type: "dismissNotice" })).toEqual({ ...shown, linkNotice: false });
  });

  it("returns the same session when there is no notice", () => {
    const session = createSession();
    expect(sessionReducer(session, { type: "dismissNotice" })).toBe(session);
  });
});

describe("app actions pass through", () => {
  it("an app action changes the app state and keeps the rest", () => {
    const loaded = sessionReducer(createSession(), { type: "hydrated", load: rejected });
    const next = sessionReducer(loaded, { type: "setGroupSize", value: 9 });
    expect(next.app.groupSize).toBe(9);
    expect(next.hydrated).toBe(true);
    expect(next.linkNotice).toBe(true);
  });

  it("an action that changes nothing returns the same session, so nothing re-renders", () => {
    const session = createSession();
    expect(sessionReducer(session, { type: "setGroupSize", value: session.app.groupSize })).toBe(session);
  });

  it("editing after a load keeps working on the loaded state", () => {
    const loaded = sessionReducer(createSession(), { type: "hydrated", load: fromHash });
    const next = sessionReducer(loaded, { type: "loadState", state: GOLDEN });
    expect(next.app).toEqual(GOLDEN);
  });
});
