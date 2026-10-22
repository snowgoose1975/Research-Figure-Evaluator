import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it("reads the current Contents API announcement and caches it across calls", async () => {
  const announcement = { url: "https://current.lhr.life", online: true };
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ encoding: "base64", content: btoa(JSON.stringify(announcement)) })));
  vi.stubGlobal("fetch", fetcher);
  const { fetchVisitorEndpoint } = await import("../src/components/visitor-endpoint");
  expect(await fetchVisitorEndpoint()).toEqual(announcement);
  expect(await fetchVisitorEndpoint()).toEqual(announcement);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toContain("api.github.com/repos/");
});

it("does not turn an API failure into a stale raw-URL result, and can retry", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response("rate limited", { status: 403 })).mockResolvedValueOnce(new Response(JSON.stringify({ encoding: "base64", content: btoa("{}") })));
  vi.stubGlobal("fetch", fetcher);
  const { fetchVisitorEndpoint } = await import("../src/components/visitor-endpoint");
  await expect(fetchVisitorEndpoint()).rejects.toThrow("temporarily unavailable");
  expect(await fetchVisitorEndpoint()).toEqual({});
  expect(fetcher).toHaveBeenCalledTimes(2);
});
