import json
from pathlib import Path
import sys
import unittest

from relay import RelayError, run_relay


def python_command(body):
    return [sys.executable, "-u", "-c", body]


def scripted_bridge(actions):
    """Build a tiny JSONL bridge script; actions are emitted after each reply."""
    encoded = json.dumps(actions)
    return """import json,sys
actions=json.loads(%r)
start=json.loads(sys.stdin.readline())
for action in actions:
 if action == 'eof': break
 if action == 'hang':
  import time; time.sleep(5); break
 if action == 'error':
  print(json.dumps({'type':'error','stage':'reading_a','code':'upstream','message':'secret payload'}),flush=True); break
 if action == 'result':
  print(json.dumps({'type':'result','protocol':'hf-zerogpu-0.1','a':{},'b':{},'report':{},'render_audit':{},'reconstruction_png_base64':'','stages':[]}),flush=True); break
 print(json.dumps(action),flush=True)
 reply=json.loads(sys.stdin.readline())
 if action.get('check_reply') and reply.get('id') != action.get('stage'): sys.exit(4)
""" % encoded


def requests_with_result():
    return [
        {"type": "request", "id": "reading_a", "stage": "reading_a", "prompt": "a", "schema": {}, "image_base64": "original", "max_output_tokens": 1},
        {"type": "request", "id": "reading_b", "stage": "reading_b", "prompt": "b", "schema": {}, "image_base64": "reconstruction", "max_output_tokens": 1},
        {"type": "request", "id": "judging", "stage": "judging", "prompt": "j", "schema": {}, "keypoints": ["k"], "max_output_tokens": 1},
        "result",
    ]


def response(_request):
    return {"text": "{}", "input_tokens": 1, "output_tokens": 1, "finish_reason": "stop"}


class RelayTests(unittest.TestCase):
    def test_success_three_independent_calls_and_two_sessions(self):
        actions = requests_with_result()
        seen = []
        def infer(req):
            seen.append(req)
            return response(req)
        for _ in range(2):
            result = run_relay("original", ["author point"], infer, python_command(scripted_bridge(actions)))
            self.assertEqual(result["protocol"], "hf-zerogpu-0.1")
        self.assertEqual([r["stage"] for r in seen], ["reading_a", "reading_b", "judging"] * 2)
        self.assertNotIn("keypoints", seen[0])
        self.assertNotIn("keypoints", seen[1])
        self.assertNotIn("image_base64", seen[2])
        self.assertIsNot(seen[0], seen[1])

    def assert_rejected(self, actions, code, infer=response, timeout=2):
        with self.assertRaises(RelayError) as caught:
            run_relay("original", [], infer, python_command(scripted_bridge(actions)), timeout_seconds=timeout)
        self.assertEqual(caught.exception.code, code)

    def test_rejects_original_reuse_for_b(self):
        actions = requests_with_result()
        actions[1]["image_base64"] = "original"
        self.assert_rejected(actions, "image_reuse")

    def test_rejects_order_and_extra_requests(self):
        actions = requests_with_result()
        actions[0], actions[1] = actions[1], actions[0]
        self.assert_rejected(actions, "invalid_order")
        actions = requests_with_result()
        actions.insert(3, dict(actions[0]))
        self.assert_rejected(actions, "too_many_requests")

    def test_length_fails_without_retry(self):
        calls = []
        def limited(req):
            calls.append(req)
            return {"text": "partial", "finish_reason": "length"}
        self.assert_rejected(requests_with_result(), "length", limited)
        self.assertEqual(len(calls), 1)

    def test_inference_exception_stops(self):
        def fail(_req):
            raise ValueError("sensitive response")
        self.assert_rejected(requests_with_result(), "inference_failed", fail)

    def test_timeout_and_early_eof(self):
        self.assert_rejected(["hang"], "timeout", timeout=0.1)
        self.assert_rejected(["eof"], "eof")


if __name__ == "__main__":
    unittest.main()
