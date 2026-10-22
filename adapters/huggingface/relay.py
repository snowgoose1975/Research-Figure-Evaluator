"""Isolated JSONL session relay for the optional Hugging Face GPU bridge."""

from __future__ import annotations

import json
import os
from pathlib import Path
import queue
import subprocess
import threading
from typing import Callable


PROTOCOL = "hf-zerogpu-0.1"
STAGES = ("reading_a", "reading_b", "judging")


class RelayError(RuntimeError):
    def __init__(self, stage: str, code: str, message: str):
        super().__init__(message)
        self.stage = stage
        self.code = code
        self.message = message

    def as_dict(self) -> dict:
        return {"type": "error", "stage": self.stage, "code": self.code, "message": self.message}


def _default_command() -> list[str]:
    node = os.environ.get("FIGURE_RELAY_NODE", "node")
    bridge = Path(__file__).with_name("bridge.mjs")
    return [node, str(bridge)]


def run_relay(
    image_base64: str,
    keypoints: list,
    infer: Callable[[dict], dict],
    command: list[str] | None = None,
    timeout_seconds: float = 180,
) -> dict:
    """Run one bridge session; model calls are separate and receive no history."""
    if not isinstance(image_base64, str) or not image_base64:
        raise RelayError("start", "invalid_input", "Image input is missing or invalid.")
    if not isinstance(keypoints, list):
        raise RelayError("start", "invalid_input", "Keypoints input is invalid.")
    if timeout_seconds <= 0:
        raise RelayError("start", "invalid_timeout", "Session timeout must be positive.")
    active_stage = "start"
    proc = None
    reader = None
    lines: queue.Queue = queue.Queue()
    stop_reader = threading.Event()

    def read_stdout(pipe):
        try:
            while not stop_reader.is_set():
                line = pipe.readline()
                if not line:
                    lines.put(EOFError())
                    return
                lines.put(line)
        except Exception:
            lines.put(EOFError())

    try:
        proc = subprocess.Popen(
            command if command is not None else _default_command(),
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            bufsize=0,
        )
        reader = threading.Thread(target=read_stdout, args=(proc.stdout,), daemon=True)
        reader.start()

        def send(value: dict):
            try:
                proc.stdin.write((json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n").encode("utf-8"))
                proc.stdin.flush()
            except Exception as exc:
                raise RelayError(active_stage, "bridge_write", "The analysis bridge stopped unexpectedly.") from exc

        def receive() -> dict:
            try:
                item = lines.get(timeout=timeout_seconds)
            except queue.Empty as exc:
                raise RelayError(active_stage, "timeout", "The analysis session timed out.") from exc
            if isinstance(item, EOFError):
                raise RelayError(active_stage, "eof", "The analysis bridge ended before returning a result.")
            try:
                value = json.loads(item)
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise RelayError(active_stage, "invalid_json", "The analysis bridge returned invalid data.") from exc
            if not isinstance(value, dict):
                raise RelayError(active_stage, "invalid_message", "The analysis bridge returned an invalid message.")
            return value

        send({"type": "start", "image_base64": image_base64, "keypoints": keypoints})
        expected_index = 0
        while True:
            message = receive()
            kind = message.get("type")
            if kind == "error":
                stage = message.get("stage")
                code = message.get("code")
                # Keep errors readable without forwarding arbitrary payload text.
                raise RelayError(stage if isinstance(stage, str) else active_stage,
                                 code if isinstance(code, str) else "bridge_error",
                                 "The analysis bridge reported an error.")
            if kind == "result":
                if expected_index != len(STAGES):
                    raise RelayError(active_stage, "incomplete_session", "The analysis bridge ended before all stages completed.")
                if message.get("protocol") != PROTOCOL:
                    raise RelayError(active_stage, "protocol_mismatch", "The bridge protocol is unsupported.")
                return message
            if kind != "request":
                raise RelayError(active_stage, "invalid_message", "The analysis bridge sent an unknown message.")
            stage = message.get("stage")
            request_id = message.get("id")
            if expected_index >= len(STAGES):
                raise RelayError(active_stage, "too_many_requests", "The analysis bridge requested too many model calls.")
            expected = STAGES[expected_index]
            active_stage = expected
            if stage != expected or request_id != expected:
                raise RelayError(expected, "invalid_order", "The analysis bridge requested an invalid stage order.")
            if stage in ("reading_a", "reading_b"):
                if "keypoints" in message:
                    raise RelayError(stage, "input_isolation", "A reader request contained author keypoints.")
                if not isinstance(message.get("image_base64"), str):
                    raise RelayError(stage, "invalid_request", "A reader request did not contain an image.")
                if stage == "reading_b" and message["image_base64"] == image_base64:
                    raise RelayError(stage, "image_reuse", "The second reading reused the original image.")
            elif "image_base64" in message and message["image_base64"] is not None:
                raise RelayError(stage, "input_isolation", "The judging request contained an image.")
            try:
                response = infer(dict(message))
            except Exception as exc:
                raise RelayError(stage, "inference_failed", "A model request failed.") from exc
            if not isinstance(response, dict):
                raise RelayError(stage, "invalid_response", "A model request returned an invalid response.")
            if response.get("finish_reason") == "length":
                raise RelayError(stage, "length", "A model response reached its output limit.")
            if not isinstance(response.get("text"), str):
                raise RelayError(stage, "invalid_response", "A model response did not contain text.")
            send({"id": stage, "response": response})
            expected_index += 1
    except RelayError:
        raise
    except Exception as exc:
        raise RelayError(active_stage, "bridge_start", "Could not start the analysis bridge.") from exc
    finally:
        if proc is not None:
            try:
                if proc.poll() is None:
                    proc.terminate()
                    try:
                        proc.wait(timeout=1)
                    except subprocess.TimeoutExpired:
                        proc.kill()
                        proc.wait(timeout=1)
            except Exception:
                pass
            for stream in (proc.stdin, proc.stdout):
                try:
                    stream.close()
                except Exception:
                    pass
        stop_reader.set()
        if reader is not None:
            reader.join(timeout=1)
