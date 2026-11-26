// Usage (repo root): node apply-close.mjs   (idempotent; prints OK / SKIP / FAIL per step)
import { readFileSync, writeFileSync } from "node:fs";

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
let failed = 0;

function rep(file, label, oldStr, newStr) {
  const text = readFileSync(file, "utf8");
  const nl = text.includes("\r\n") ? "\r\n" : "\n";
  const toRe = (s) => new RegExp(esc(s).replace(/\n/g, "\\r?\\n"));
  if (toRe(newStr).test(text)) {
    console.log(`SKIP  ${file}: ${label} (already done)`);
  } else if (toRe(oldStr).test(text)) {
    writeFileSync(file, text.replace(toRe(oldStr), () => newStr.replace(/\n/g, nl)));
    console.log(`OK    ${file}: ${label}`);
  } else {
    failed++;
    console.log(`FAIL  ${file}: ${label} (text not found, edit by hand)`);
  }
}

const B = "BUILD_PLAN.md";
rep(B, "tick T10.1",
  "- [ ] **T10.1 Flag-controlled CTA card**",
  "- [x] **T10.1 Flag-controlled CTA card**");
rep(B, "verified lead",
  "**Built (26 Nov 2026), not yet verified by the author: tests written but not run, no browser check yet.**",
  "**Done: built and verified by the author (26 Nov 2026): all yarn suites pass, and the screenshot review (320, 360, 768 and 1280px, light and dark, with and without the disclosure, focus ring, card hidden) found the issues listed under \"Fixed after the screenshot review\", all fixed and re-checked.**");
rep(B, "review fixes, desktop spacing",
  "(no lone \"commission.\").",
  "(no lone \"commission.\"); the extra 24px of top padding from 1280px is gone (the gap under Copy link was about 85px, against about 56px on mobile and about 57px between Export and Copy link). **Left as is, on purpose:** with the placeholder copy the balanced disclosure breaks after \"We\"; the wording is replaced in C1.");
rep(B, "checks line",
  "**To run:** `yarn vitest run tests/CtaCard.test.tsx`, then `yarn tsc --noEmit`, `yarn lint`, `yarn check:icons`, and one `yarn build` (the `/ssr` icon import in a server component is the part not checked).",
  "**Checks:** all yarn suites pass on the real repo (author, 26 Nov 2026; totals not recorded). **Before launch:** `CTA_DISCLOSURE` stays empty unless the link is affiliate or paid, and the real title and button text come in C1.");

console.log(failed ? `\n${failed} step(s) need a manual edit.` : "\nAll steps done.");
