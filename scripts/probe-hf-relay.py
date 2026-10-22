"""One bounded real LOCAL-model integration, never presented as HF GPU evidence."""
import base64
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import time
import urllib.request

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("relay", root / "adapters/huggingface/relay.py")
relay = importlib.util.module_from_spec(spec)
spec.loader.exec_module(relay)
output = root / "artifacts/validation/T13-local-relay-live.json"
private = root / "runs/t13-local-relay-live-first"
if output.exists() or private.exists():
    raise SystemExit("Evidence already exists; no silent replacement run is allowed.")
status = json.load(urllib.request.urlopen("http://127.0.0.1:3000/api/status", timeout=10))
if status.get("active_run_id") or not status.get("configured"):
    raise SystemExit("Local model is busy or unavailable; no call started.")
private.mkdir(parents=True)
case = json.loads((root / "public/case-studies/materials-lattice-design/record-v2.json").read_text("utf8"))
keypoints = [{"id": point["id"], "text": point["text"], "claim": point.get("claim"), "author_confirmed": True} for point in case["keypoints"]]
image = base64.b64encode((root / "public/published/materials-lattice-design.png").read_bytes()).decode()
attempts = []

def infer(request):
    content = []
    if request.get("image_base64"):
        content.append({"type": "image_url", "image_url": {"url": "data:image/png;base64," + request["image_base64"]}})
    content.append({"type": "text", "text": request["prompt"] + "\n\nRequired JSON schema:\n" + json.dumps(request["schema"])})
    payload = {"model": "qwen3-vl:4b-instruct-16k", "messages": [{"role": "user", "content": content}], "temperature": 0, "max_tokens": request["max_output_tokens"], "response_format": {"type": "json_schema", "json_schema": {"name": request["stage"], "strict": True, "schema": request["schema"]}}}
    started = time.monotonic()
    entry = {"stage": request["stage"], "outcome": "started"}
    attempts.append(entry)
    try:
        body = urllib.request.Request("http://127.0.0.1:11434/v1/chat/completions", data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(body, timeout=120) as response:
            data = json.load(response)
        usage = data.get("usage") or {}
        choice = data["choices"][0]
        entry.update(outcome="response_received", duration_seconds=round(time.monotonic() - started, 2), usage=usage, finish_reason=choice.get("finish_reason"))
        return {"text": choice["message"]["content"], "input_tokens": usage.get("prompt_tokens"), "output_tokens": usage.get("completion_tokens"), "finish_reason": choice.get("finish_reason") or "unknown"}
    except Exception:
        entry.update(outcome="failed", duration_seconds=round(time.monotonic() - started, 2))
        raise

started = time.monotonic()
summary = {"scope": "One real LOCAL Ollama integration of the candidate Python/Node relay. NOT a ZeroGPU/HF hardware test, not part of fixed-protocol 8/12. Keypoints remain project-curated, not independently author-confirmed.", "source": "materials-lattice-design", "model": "qwen3-vl:4b-instruct-16k", "candidate_protocol": "hf-zerogpu-0.1", "attempts": attempts}
try:
    result = relay.run_relay(image, keypoints, infer, command=["node", str(root / "runs/t13-hf-integration/scratch/bridge.mjs")], timeout_seconds=180)
    (private / "result.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), "utf8")
    summary.update(status="completed", report_summary=result["report"]["summary"], stages=result["stages"])
except relay.RelayError as error:
    summary.update(status="failed", error=error.as_dict())
finally:
    summary["duration_seconds"] = round(time.monotonic() - started, 2)
    with output.open("x", encoding="utf8") as stream:
        json.dump(summary, stream, ensure_ascii=False, indent=2)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
if summary["status"] != "completed":
    sys.exit(1)
