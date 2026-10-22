export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    // Next may normalize request.url to localhost even when the browser uses
    // 127.0.0.1. Compare with the actual HTTP Host header, not that internal URL.
    const expectedHost = request.headers.get("host") ?? new URL(request.url).host;
    const parsed = new URL(origin);
    return ["http:", "https:"].includes(parsed.protocol) && parsed.host === expectedHost;
  } catch { return false; }
}
