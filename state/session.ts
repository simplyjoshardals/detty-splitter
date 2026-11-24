/**
 * What the provider holds (UI_PLAN §2.2): the app state plus two facts about how it was loaded.
 * Plain TypeScript, no React, so it can be tested directly.
 *
 * The first client render starts from the default scenario, so it matches the server HTML.
 * One "hydrated" action then applies the link or the snapshot, sets `hydrated` and sets the
 * notice, all in one step. The page therefore never renders a loaded state without its notice,
 * or a notice without its loaded state.
 */
import type { LoadResult } from "@/lib/share/load";
import type { AppState } from "@/lib/types";
import { appReducer, createInitialState, type AppAction } from "./reducer";

export interface Session {
  app: AppState;
  /** False on the server and the first client render, true once hash/snapshot were applied. */
  hydrated: boolean;
  /** True while the "couldn't read that link" notice is showing (a link was rejected). */
  linkNotice: boolean;
}

export type SessionAction =
  | AppAction
  | { type: "hydrated"; load: LoadResult }
  | { type: "dismissNotice" };

export function createSession(): Session {
  return { app: createInitialState(), hydrated: false, linkNotice: false };
}

export function sessionReducer(session: Session, action: SessionAction): Session {
  switch (action.type) {
    case "hydrated": {
      // Applied once. A second one (React's dev double-run of effects) is ignored, so it can
      // not swap in a new copy of the same state and look like an edit to the saver.
      if (session.hydrated) return session;
      const { load } = action;
      // "default" keeps the state already on screen, which is the default scenario itself.
      const app =
        load.source === "default"
          ? session.app
          : appReducer(session.app, { type: "loadState", state: load.state });
      return { app, hydrated: true, linkNotice: load.rejected !== null };
    }
    case "dismissNotice":
      return session.linkNotice ? { ...session, linkNotice: false } : session;
    default: {
      // Every other action belongs to the app reducer. An unchanged app state returns the same
      // session object, so nothing re-renders.
      const app = appReducer(session.app, action);
      return app === session.app ? session : { ...session, app };
    }
  }
}
