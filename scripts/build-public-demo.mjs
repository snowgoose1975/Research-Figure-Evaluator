// Build an isolated, read-only site. Never copy API routes, private runs or keys.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { assertEvidenceLabel, evidenceLabel } from "./lib/evidence.mjs";

const root = process.cwd();
const label = assertEvidenceLabel(evidenceLabel("T12-public-v1"));
const destination = path.resolve("artifacts/web-preview", label);
if (existsSync(destination)) throw new Error("Static output already exists. Choose a new --label; no output is overwritten.");
const scratch = mkdtempSync(path.join(os.tmpdir(), "figure-relay-public-"));
const sources = ["src/app/page.tsx", "src/app/layout.tsx", "src/app/icon.svg", "src/app/globals.css", "src/components/entry.module.css", "src/components/visitor-history.ts", "src/components/visitor-endpoint.ts", "src/lib/examples/case-studies.ts", "src/lib/schemas/index.ts", "public/published", "public/case-studies"];
for (const source of sources) {
  const target = path.join(scratch, source);
  mkdirSync(path.dirname(target), { recursive: true });
  cpSync(path.join(root, source), target, { recursive: true, force: false, errorOnExist: true, filter: file => !/[\\/](?:index|record)\.json$/.test(file) });
}
// The public bundle cannot import the real workspace or its API clients.
writeFileSync(path.join(scratch, "src/components/workbench.tsx"), '"use client";\nexport default function Workbench() { return <p>This public site contains recorded cases only. Use the local application for new inference.</p>; }\n', { flag: "wx" });
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
writeFileSync(path.join(scratch, "package.json"), JSON.stringify({ ...pkg, name: "figure-relay-public-demo", scripts: { build: "next build --webpack" } }, null, 2), { flag: "wx" });
cpSync("package-lock.json", path.join(scratch, "package-lock.json"));
cpSync("tsconfig.json", path.join(scratch, "tsconfig.json"));
const basePath = process.env.RFE_PUBLIC_BASE_PATH || "";
if (basePath && !/^\/[A-Za-z0-9/_-]+$/.test(basePath)) throw new Error("Invalid public base path.");
writeFileSync(path.join(scratch, "next.config.mjs"), `export default ${JSON.stringify({ output: "export", agentRules: false, images: { unoptimized: true }, basePath })};\n`, { flag: "wx" });
symlinkSync(path.join(root, "node_modules"), path.join(scratch, "node_modules"), process.platform === "win32" ? "junction" : "dir");
const require = createRequire(import.meta.url);
// Build needs no model/network/credentials. Drop server configuration from the
// child environment instead of passing any credentials to the isolated build.
const analysisUrl = process.env.RFE_PUBLIC_ANALYSIS_URL || "";
if (analysisUrl && !/^https:\/\/[a-z0-9-]+\.(?:lhr\.life|localhost\.run|trycloudflare\.com)\/?$/.test(analysisUrl)) throw new Error("Expected a verified free HTTPS service URL.");
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_RFE_DEMO_ONLY: "1", NEXT_PUBLIC_RFE_BASE_PATH: basePath, NEXT_PUBLIC_RFE_ANALYSIS_URL: analysisUrl };
for (const key of Object.keys(env)) if (/^(OPENAI_|RFE_(?!PUBLIC_BASE_PATH))/.test(key) || /(?:TOKEN|SECRET|PASSWORD|API_KEY)$/.test(key)) delete env[key];
const result = spawnSync(process.execPath, [require.resolve("next/dist/bin/next"), "build", "--webpack"], { cwd: scratch, env, stdio: "inherit" });
if (result.status !== 0) throw new Error(`Public build failed (${result.status}); scratch retained at ${scratch}`);
mkdirSync(path.dirname(destination), { recursive: true });
cpSync(path.join(scratch, "out"), destination, { recursive: true, force: false, errorOnExist: true });
cpSync(path.join(root, "docs/submission/HF_SPACE_README.md"), path.join(destination, "README.md"), { force: false, errorOnExist: true });
const manifest = { label, created_at: new Date().toISOString(), mode: "static-recorded-cases", private_api_routes: false, live_inference: false, external_analysis_url: analysisUrl || null, base_path: basePath, source_allowlist: sources, note: "Deploy only this output folder. Static site has no uploads/API/model. Optional external link opens the separate host-computer trial; temporary URL may expire." };
writeFileSync(path.join(destination, "PUBLIC_BUILD.json"), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" });
console.log(`Read-only public site prepared: ${destination}`);
