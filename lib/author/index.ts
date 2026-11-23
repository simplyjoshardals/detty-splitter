/**
 * Footer credit helpers (DATA_MODEL.md §3.3). Pure functions, no React.
 */

/** Returns the URL string only if it parses with the https: protocol, else null. */
export function parseHttpsUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export interface AuthorCredit {
  name: string;
  url: string;
}

/**
 * The credit to show, or null. Both parts are required: a non-blank name and an https:
 * URL. Anything else counts as unset, so a half-filled config never renders a broken or
 * unsafe link. The name is returned as plain text (React escapes it when rendered).
 */
export function authorCredit(name: string, url: string): AuthorCredit | null {
  const trimmed = name.trim();
  const safeUrl = parseHttpsUrl(url);
  if (!trimmed || !safeUrl) return null;
  return { name: trimmed, url: safeUrl };
}
