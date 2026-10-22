import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
const folder = path.resolve(process.argv[2] || "artifacts/web-preview/T12-public-v2");
const port = Number(process.argv[3] || 3001);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8", ".ico": "image/x-icon" };
const server = http.createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") { response.writeHead(405); response.end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const file = path.resolve(folder, "." + (pathname === "/" ? "/index.html" : pathname));
    if (!file.startsWith(folder + path.sep) || pathname.includes("\\") || pathname.includes("\0")) throw new Error("Invalid asset path");
    const info = await stat(file);
    if (!info.isFile()) throw new Error("Not an asset");
    response.writeHead(200, { "content-type": mime[path.extname(file)] || "application/octet-stream", "cache-control": "no-store", "x-content-type-options": "nosniff" });
    response.end(request.method === "HEAD" ? undefined : await readFile(file));
  } catch { response.writeHead(404); response.end("Not found"); }
});
server.listen(port, "127.0.0.1", () => console.log(`Read-only static preview: http://127.0.0.1:${port}`));
