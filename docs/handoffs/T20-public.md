# T20 public service UI handoff

## Delivered

- Added optional per-statement connection input to the public page. It accepts one `Source -> Target` (`flows_to`) or `Source | flows_to/promotes/inhibits | Target` entry per line, checks syntax and the 12-entry limit, and keeps the author statement count independent from these textareas. The form tells authors to use exact visible graph labels and does not infer checks from prose.
- Sends valid entries only as optional `record_checks` on the existing keypoint objects. `claim` remains `null`; the local service schema validates each entry with the frozen `RecordCheckSchema` and rejects more than 12.
- Shows deterministic coverage from the report's persisted `author_record_checks` metadata, separately from the graph audit's actual executed state. Per-statement explicit-check labels also use this metadata, so restored results retain them; legacy reports without the field say coverage is unavailable.
- Displays duplicate and opposing edge records, with a warning that opposing directions may both occur in the original figure. Shows rule rationale and identifies explicit connection checks as limited to those connections; semantic suggestions and explanations remain available and open when both sides are semantic and unverified. Limitations are deduplicated and collapsed; A/B extraction and citations are also collapsed.
- Polling `404` identifies an expired/restarted session. Other poll failures say the service connection is temporarily unreachable and retain “Check again” for the same session; they never resubmit the image.
- Added HTTP coverage for accepting/forwarding bounded checks and rejecting 13 checks.

## Verification

- `npm run typecheck` — passed.
- `npm test -- tests/local-service-http.test.ts` — passed (6 tests). The first sandboxed attempt could not connect to the test server's random loopback port; rerunning with permission for this local-only HTTP test passed.
- `git diff --check` — passed; Git emitted only line-ending normalization notices.
- Follow-up UI adjustment: `npm run typecheck` — passed after switching coverage to persisted report metadata and folding long rule rationales.

## Limits

- The UI can validate the connection syntax but cannot independently establish that endpoint strings occur in the uploaded image. The author instruction asks for exact visible labels; graph-label matching is performed downstream by the evaluator.
- No service was restarted and no model run was made.
