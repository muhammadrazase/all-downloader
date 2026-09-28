/**
 * JSON.stringify escapes neither '<' nor '/', so a value containing
 * "</script>" (an admin-authored blog title, an SEO override, ...) would
 * close a surrounding <script> tag early and let arbitrary markup follow it.
 * < is valid inside a JSON string and parses back to '<', so this is
 * transparent to every consumer of the resulting JSON-LD.
 */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
