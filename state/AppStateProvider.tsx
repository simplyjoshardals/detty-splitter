"use client";

import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import type { AppState } from "@/lib/types";
import { appReducer, createInitialState, type AppAction } from "./reducer";

interface AppStateContextValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

/**
 * Starts from the default scenario so the first client render matches the server HTML
 * (UI_PLAN §2.2). Applying a link or saved state happens after mount, in a later slice.
 */
export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, undefined, createInitialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateContextValue {
  const value = useContext(AppStateContext);
  if (value === null) {
    throw new Error("useAppState must be used inside <AppStateProvider>");
  }
  return value;
}
