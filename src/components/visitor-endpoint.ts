// GitHub's raw branch URL can lag behind a rotating tunnel even with no-store.
// Use the Contents API and share a bounded cache across workspace remounts.
const endpointUrl = "https://api.github.com/repos/snowgoose1975/Research-Figure-Evaluator/contents/endpoint.json?ref=service-status";
const cacheMs = 180_000;
let cached: { value: unknown; expiresAt: number } | undefined;
let inFlight: Promise<unknown> | undefined;

export async function fetchVisitorEndpoint(): Promise<unknown> {
  if (cached && Date.now() < cached.expiresAt) return cached.value;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const response = await fetch(endpointUrl, {
      cache: "no-store", credentials: "omit", headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("The current host address is temporarily unavailable.");
    const file = await response.json() as { encoding?: unknown; content?: unknown };
    if (file.encoding !== "base64" || typeof file.content !== "string" || file.content.length > 16_384) throw new Error("Invalid host address announcement.");
    const value: unknown = JSON.parse(atob(file.content.replace(/\s/g, "")));
    cached = { value, expiresAt: Date.now() + cacheMs };
    return value;
  })();
  try { return await inFlight; } finally { inFlight = undefined; }
}
