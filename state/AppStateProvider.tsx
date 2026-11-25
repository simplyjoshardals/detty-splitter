"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import { resolveInitialState } from "@/lib/share/load";
import { readSnapshot } from "@/lib/storage";
import type { AppState } from "@/lib/types";
import { createInitialState, type AppAction } from "./reducer";
import { createSession, sessionReducer } from "./session";
import { useLocalSave } from "./useLocalSave";

interface AppStateContextValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  /** False until the link or saved snapshot has been applied (the "loading swap", UI_PLAN §2.2). */
  hydrated: boolean;
  /** True while the bad-link notice should show. */
  linkNotice: boolean;
  dismissLinkNotice: () => void;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

/**
 * Starts from the default scenario so the first client render matches the server HTML
 * (UI_PLAN §2.2). Right after mount one effect applies the link in the URL hash, else the
 * saved snapshot, else leaves the default (T8.2, `resolveInitialState`). A rejected link keeps
 * the default and raises the notice. Later edits are saved by `useLocalSave`.
 *
 * A link opened while the page is already showing (a chat app reusing the tab) only changes the
 * hash, so the browser fires `hashchange` and does not reload. A second effect applies it. It
 * ignores the snapshot, because a new link means the person wants that link's numbers.
 */
export function AppStateProvider({ children }: { children: ReactNode }) {
  const [session, dispatchSession] = useReducer(sessionReducer, undefined, createSession);

  useEffect(() => {
    const saved = readSnapshot();
    dispatchSession({
      type: "hydrated",
      load: resolveInitialState(
        window.location.hash,
        saved.ok ? saved.value : null,
        createInitialState(),
      ),
    });
  }, []);

  useEffect(() => {
    const onHashChange = () =>
      dispatchSession({
        type: "linkOpened",
        load: resolveInitialState(window.location.hash, null, createInitialState()),
      });
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useLocalSave(session.app, session.baseline);

  const dismissLinkNotice = useCallback(() => dispatchSession({ type: "dismissNotice" }), []);
  const { app, hydrated, linkNotice } = session;
  const value = useMemo(
    () => ({ state: app, dispatch: dispatchSession, hydrated, linkNotice, dismissLinkNotice }),
    [app, hydrated, linkNotice, dismissLinkNotice],
  );
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateContextValue {
  const value = useContext(AppStateContext);
  if (value === null) {
    throw new Error("useAppState must be used inside <AppStateProvider>");
  }
  return value;
}
