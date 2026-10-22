// Public endpoint discovery only. No uploads, job capabilities or model calls.
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);
const root = process.cwd(), control = path.join(root, "runs/service-control");
const repository = path.join(control, "discovery-repo");
const remote = "https://github.com/snowgoose1975/Research-Figure-Evaluator.git";
const git = async args => (await exec("git", ["-c", "credential.interactive=false", ...args], { cwd: repository, timeout: 60000, windowsHide: true })).stdout;
async function initialize() {
  try { await access(path.join(repository, ".git")); return; } catch { /* New isolated address-only branch. */ }
  await mkdir(control, { recursive: true });
  const listing = await exec("git", ["-c", "credential.interactive=false", "ls-remote", remote, "refs/heads/service-status"], { cwd: root, timeout: 30000, windowsHide: true });
  if (listing.stdout.trim()) {
    await exec("git", ["clone", "--depth", "1", "--single-branch", "--branch", "service-status", remote, repository], { cwd: root, timeout: 60000, windowsHide: true });
  } else {
    await mkdir(repository, { recursive: true });
    await git(["init", "--initial-branch=service-status"]);
    await git(["remote", "add", "origin", remote]);
  }
}
let lastUrl = "", lastPublished = 0, updates = [], busy = false, failures = 0;
async function update() {
  if (busy) return; busy = true;
  try {
    const meta = JSON.parse(await readFile(path.join(control, "tunnel.json"), "utf8"));
    try { process.kill(meta.pid, 0); }
    catch {
      await exec("powershell.exe", ["-NoProfile", "-File", path.join(root, "scripts/start-sharing.ps1")], { cwd: root, timeout: 60000, windowsHide: true });
      return;
    }
    const log = await readFile(meta.output, "utf8");
    const matches = [...log.matchAll(/https:\/\/[a-z0-9-]+\.(?:lhr\.life|localhost\.run)/g)];
    const url = matches.at(-1)?.[0];
    if (!url) return;
    let online = false;
    try {
      const healthy = await fetch(`${url}/status`, { signal: AbortSignal.timeout(10000) });
      const status = await healthy.json();
      online = healthy.ok && typeof status.paused === "boolean" && typeof status.accepting === "boolean";
    } catch { /* Report offline after three consecutive probes; never submit work. */ }
    failures = online ? 0 : failures + 1;
    if (!online && failures < 3) return;
    if (online) await writeFile(path.join(control, "public-url.txt"), url + "\n");
    const signature = `${url}|${online}`;
    if (lastUrl === signature && Date.now() - lastPublished < 3600000) return;
    updates = updates.filter(time => Date.now() - time < 3600000);
    if (updates.length >= 12) return;
    updates.push(Date.now());
    await writeFile(path.join(repository, "endpoint.json"), JSON.stringify({ version: 1, url, online, updated_at: new Date().toISOString(), protocol: "local-service-0.1", notice: "Free host-computer trial; may pause, rotate or go offline." }, null, 2) + "\n");
    await git(["add", "endpoint.json"]);
    const dirty = await git(["status", "--porcelain"]);
    if (dirty.trim()) await git(["-c", "user.name=snowgoose1975", "-c", "user.email=297401021+snowgoose1975@users.noreply.github.com", "commit", "-m", "Update public trial endpoint"]);
    await git(["push", "origin", "HEAD:service-status"]);
    lastUrl = signature; lastPublished = Date.now();
    console.log(`Public endpoint announcement updated: ${url}`);
  } catch {
    // Never print credential-manager/HTTP exception payloads or session URLs.
    console.error("Endpoint announcement unavailable; will check again without changing the main repository.");
  } finally { busy = false; }
}
await initialize(); await update();
setInterval(() => { void update(); }, 20000);
