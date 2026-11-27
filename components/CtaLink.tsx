"use client";

import type { ComponentPropsWithoutRef } from "react";
import { track } from "@/lib/analytics";

/**
 * The CTA card's link (DESIGN §5.12). The one client piece of `CtaCard`, which stays a server
 * component: it only adds the `cta_click` event (T10.3) to a normal link, so the link works
 * and is in the static HTML with or without JavaScript. The card renders nothing unless it is
 * shown, so the event only fires for a visible card. A middle-click is not counted.
 */
export function CtaLink(props: ComponentPropsWithoutRef<"a">) {
  return <a {...props} onClick={() => track({ name: "cta_click" })} />;
}
