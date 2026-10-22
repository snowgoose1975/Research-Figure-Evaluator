"""Install the pinned Node runtime inside this Space, never system-wide."""
from pathlib import Path
import hashlib
import os
import platform
import shutil
import subprocess
import tarfile
import urllib.request

VERSION = "22.23.1"
SHA256 = "9749e988f437343b7fa832c69ded82a312e41a03116d766797ac14f6f9eee578"


def prepare_node() -> str:
    root = Path(__file__).resolve().parent
    configured = os.environ.get("FIGURE_RELAY_NODE")
    if configured:
        return configured
    if platform.system() != "Linux" or platform.machine() not in ("x86_64", "AMD64"):
        candidate = shutil.which("node")
        if not candidate:
            raise RuntimeError("Provide Node >=22.12 through FIGURE_RELAY_NODE.")
    else:
        cache = root / ".runtime"
        cache.mkdir(exist_ok=True)
        runtime = cache / f"node-v{VERSION}-linux-x64"
        candidate = str(runtime / "bin/node")
        if not Path(candidate).exists():
            archive = cache / f"node-v{VERSION}-linux-x64.tar.xz"
            if not archive.exists():
                with urllib.request.urlopen(f"https://nodejs.org/dist/v{VERSION}/{archive.name}", timeout=90) as response:
                    with archive.open("xb") as output:
                        shutil.copyfileobj(response, output)
            if hashlib.sha256(archive.read_bytes()).hexdigest() != SHA256:
                raise RuntimeError("Node archive checksum mismatch; refusing to execute.")
            with tarfile.open(archive) as source:
                source.extractall(cache, filter="data")
    version = subprocess.check_output([candidate, "--version"], text=True).strip().lstrip("v")
    if tuple(int(part) for part in version.split(".")[:2]) < (22, 12):
        raise RuntimeError("Node >=22.12 is required.")
    if not (root / "node_modules/zod").is_dir():
        npm_cli = Path(candidate).resolve().parents[1] / "lib/node_modules/npm/bin/npm-cli.js"
        if npm_cli.exists():
            command = [candidate, str(npm_cli)]
        else:
            npm = shutil.which("npm")
            if not npm:
                raise RuntimeError("npm is unavailable for project-local bridge dependencies.")
            command = [npm]
        subprocess.run(command + ["install", "--omit=dev", "--no-audit", "--no-fund"], cwd=root, check=True)
    os.environ["FIGURE_RELAY_NODE"] = candidate
    return candidate
