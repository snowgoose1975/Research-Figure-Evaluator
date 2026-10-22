// Prepare an immutable, credential-free upload directory. Does not publish.
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { evidenceLabel, assertEvidenceLabel } from "./lib/evidence.mjs";

const label = assertEvidenceLabel(evidenceLabel("T13-hf-space"));
const directory = path.resolve("artifacts/web-preview", label);
if (existsSync(directory)) throw new Error("Output exists; choose a new --label.");
mkdirSync(directory, { recursive: true });
for (const file of ["app.py", "relay.py", "bootstrap.py", "README.md", "requirements.txt"]) {
  cpSync(path.join("adapters/huggingface", file), path.join(directory, file), { errorOnExist: true, force: false });
}
const require = createRequire(import.meta.url);
const built = spawnSync(process.execPath, [require.resolve("esbuild/bin/esbuild"), "adapters/huggingface/bridge.ts", "--bundle", "--platform=node", "--format=esm", "--target=node22", "--packages=external", `--outfile=${path.join(directory, "bridge.mjs")}`], { stdio: "inherit" });
if (built.status !== 0) throw new Error("Bridge bundle failed.");
writeFileSync(path.join(directory, "package.json"), JSON.stringify({ private: true, type: "module", dependencies: { "@resvg/resvg-js": "2.6.2", sharp: "0.35.5", zod: "4.6.7" } }, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ directory, protocol: "hf-zerogpu-0.1", status: "prepared_not_gpu_validated" }));
