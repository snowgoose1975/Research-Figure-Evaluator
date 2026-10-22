import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { z } from "zod";
import { IntentSetSchema, RecordCheckSchema } from "../../src/lib/schemas";
import { normalizeImage } from "../../src/lib/pipeline/images";
import { ServiceQueue, QueueError } from "./queue";
import { executeLocal, readiness, releaseModel, type ServiceInput } from "./executor";

const folder = path.dirname(fileURLToPath(import.meta.url));
const stateFile = path.resolve("runs/service-control/state.json");
const Input = z.object({ image_base64: z.string().min(1).max(14_000_000), keypoints: z.array(z.object({ id: z.string().min(1).max(40), text: z.string().min(3).max(1200), claim: z.null(), author_confirmed: z.literal(true), record_checks: z.array(RecordCheckSchema).max(12).optional() }).strict()).min(3).max(5), consent: z.literal(true) }).strict();
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
const PUBLIC_FRAME_CSP = CSP.replace("frame-ancestors 'none'", "frame-ancestors 'self' https://figure-relay.chicchair5.chatgpt.site");

function reply(res: ServerResponse, code: number, data: unknown, html = false, options: { frameable?: boolean } = {}) {
  const headers: Record<string, string> = { "content-type": html ? "text/html; charset=utf-8" : "application/json", "cache-control": "no-store", "referrer-policy": "no-referrer", "x-content-type-options": "nosniff", "content-security-policy": options.frameable ? PUBLIC_FRAME_CSP : CSP };
  if (!options.frameable) headers["x-frame-options"] = "DENY";
  res.writeHead(code, headers);
  res.end(html ? data as string : JSON.stringify(data));
}
function sameOrigin(req: IncomingMessage) {
  try { return !!req.headers.origin && new URL(req.headers.origin).host === req.headers.host && ["http:", "https:"].includes(new URL(req.headers.origin).protocol); }
  catch { return false; }
}
async function body(req: IncomingMessage) {
  if (!req.headers["content-type"]?.startsWith("application/json")) throw new Error("json_required");
  if (Number(req.headers["content-length"] || 0) > 14_100_000) throw new Error("too_large");
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 14_100_000) throw new Error("too_large");
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export async function startService(options: { publicPort?: number; adminPort?: number; execute?: (input: ServiceInput) => Promise<unknown>; release?: () => Promise<void>; ready?: () => Promise<boolean>; resourcesOk?: () => boolean; persist?: boolean } = {}) {
  const persist = options.persist !== false;
  let initialPaused = false;
  if (persist) {
    try { initialPaused = JSON.parse(await readFile(stateFile, "utf8")).paused === true; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") initialPaused = true; }
  }
  const save = async (paused: boolean) => { if (persist) { await mkdir(path.dirname(stateFile), { recursive: true }); await writeFile(stateFile, JSON.stringify({ paused }) + "\n"); } };
  const queue = new ServiceQueue({ execute: options.execute ?? executeLocal, release: options.release ?? releaseModel, initialPaused, sessionLimit: Number.MAX_SAFE_INTEGER, dailyLimit: 100 });
  let available = false;
  let validating = 0;
  let requests: number[] = [];
  const refresh = async () => { available = await (options.ready ?? readiness)(); };
  await refresh();
  const timer = setInterval(() => { void refresh(); }, 10000); timer.unref();
  const publicHtml = await readFile(path.join(folder, "public.html"), "utf8");
  const adminHtml = await readFile(path.join(folder, "admin.html"), "utf8");
  const resourcesOk = options.resourcesOk ?? (() => os.freemem() >= 1024 * 1024 * 1024);
  const view = () => ({ ...queue.status(), accepting: queue.status().accepting && available && resourcesOk(), model_ready: available, host_resources_ok: resourcesOk() });
  const publicServer = createServer(async (req, res) => {
    const route = (req.url || "").split("?")[0];
    try {
      if (req.method === "GET" && route === "/") return reply(res, 200, publicHtml, true, { frameable: true });
      if (req.method === "GET" && route === "/favicon.ico") { res.writeHead(204, { "cache-control": "public, max-age=3600" }); res.end(); return; }
      if (req.method === "GET" && route === "/status") return reply(res, 200, view());
      if (req.method === "GET" && /^\/jobs\/[a-f0-9]{64}$/.test(route)) {
        const job = queue.get(route.slice(6));
        return reply(res, job ? 200 : 404, job ?? { error: "This session expired or the host restarted. Results cannot be recovered from this public service." });
      }
      if (req.method !== "POST" || route !== "/jobs") return reply(res, 404, { error: "Not found." });
      if (!sameOrigin(req)) return reply(res, 403, { error: "Submit from this service's own page." });
      if (!available) return reply(res, 503, { error: "The host model is offline. No job was accepted." });
      if (!resourcesOk()) return reply(res, 503, { error: "The host is low on free memory. No job was accepted; please return later." });
      if (!queue.status().accepting) return reply(res, 503, { error: "The host is paused, full or at its usage limit. No job was accepted." });
      requests = requests.filter(time => Date.now() - time < 60000);
      if (validating >= 2 || requests.length >= 20) return reply(res, 429, { error: "Too many submissions. Please wait." });
      requests.push(Date.now()); validating++;
      try {
        const input = Input.parse(await body(req));
        IntentSetSchema.parse({ keypoints: input.keypoints });
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input.image_base64)) throw new Error("invalid_image");
        const raw = Buffer.from(input.image_base64, "base64");
        if (raw.byteLength > 10 * 1024 * 1024) throw new Error("too_large");
        // Complete decoding and shared size/pixel validation before admission.
        // Keep the original bytes for the formal pipeline; no caption or answer goes to A.
        await normalizeImage(raw);
        return reply(res, 202, queue.submit({ image_base64: input.image_base64, keypoints: input.keypoints }));
      } finally { validating--; }
    } catch (error) {
      if (error instanceof QueueError) return reply(res, 429, { error: error.message, code: error.code });
      return reply(res, error instanceof Error && error.message === "too_large" ? 413 : 400, { error: "Invalid input. Use a PNG/JPEG <=10 MB /25 MP and confirm 3–5 messages and processing consent." });
    }
  });
  const adminServer = createServer(async (req, res) => {
    // Separate socket and host allowlist: the public tunnel cannot reach this listener.
    if (!/^127\.0\.0\.1:\d+$/.test(req.headers.host || "")) return reply(res, 403, { error: "Local control only." });
    try {
      if (req.method === "GET" && req.url === "/") return reply(res, 200, adminHtml, true);
      if (req.method === "GET" && req.url === "/status") return reply(res, 200, view());
      if (req.method !== "POST" || !sameOrigin(req)) return reply(res, 403, { error: "Local control only." });
      await body(req);
      if (req.url === "/pause") { queue.pause(); await save(true); }
      else if (req.url === "/resume") { await save(false); queue.resume(); }
      else return reply(res, 404, { error: "Not found." });
      return reply(res, 200, view());
    } catch { return reply(res, 500, { error: "Control action failed; check the current status before retrying." }); }
  });
  for (const server of [publicServer, adminServer]) { server.requestTimeout = 30000; server.headersTimeout = 10000; server.maxHeadersCount = 32; }
  await new Promise<void>((resolve, reject) => { publicServer.once("error", reject); publicServer.listen(options.publicPort ?? 9040, "127.0.0.1", resolve); });
  try { await new Promise<void>((resolve, reject) => { adminServer.once("error", reject); adminServer.listen(options.adminPort ?? 9041, "127.0.0.1", resolve); }); }
  catch (error) { publicServer.close(); clearInterval(timer); throw error; }
  return { queue, publicServer, adminServer, close: async () => { clearInterval(timer); await queue.pause(); await Promise.all([publicServer, adminServer].map(server => new Promise<void>(resolve => { server.close(() => resolve()); server.closeIdleConnections(); }))); } };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startService().then(() => console.log("Public worker on 127.0.0.1:9040; local controls http://127.0.0.1:9041" )).catch(() => { console.error("Could not start service; check whether ports 9040/9041 are already in use and the app is available."); process.exitCode = 1; });
}
