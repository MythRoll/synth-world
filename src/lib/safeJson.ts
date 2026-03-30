/**
 * Safely serialize data for embedding in a <script> tag.
 * Escapes characters that could break out of the script context.
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
