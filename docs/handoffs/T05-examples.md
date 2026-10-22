# T05 examples handoff

Task: T05 cross-domain self-drawn teaching examples  
Classification: execution  
Contract/version: schema 0.2.0  
Owned files: `src/lib/examples/index.ts`, `scripts/generate-examples.ts`, `public/examples/`, `data/manifests/examples.json`, `docs/handoffs/T05-examples.md`

## Delivered

- Added six `ExampleDefinition` records for physics (oscillator and resonance), materials (idealized layer stack and thermal expansion), and mathematics (directed graph and parabola/derivative). The split is four dev and two holdout as requested.
- `gold`, `demo_a`, and `demo_b` are parsed by `MemorySchema` during module initialization. Each example has 3–4 author-confirmed atomic keypoints with claims aligned to the corresponding gold fact fields. `listExamples()` copies an explicit summary-field allowlist and never returns gold or scripted reader memories.
- Each example has original self-drawn clear/challenged SVG and PNG assets at 1200×700. The pair preserves the same scientific content; challenged variants reduce label contrast or size. Raster output uses the project-local Resvg dependency.
- Scripted A/B memories have separate hand-authored omissions or one controlled graph-edge error. They exist to preview the UI and are disclosed as scripted, hand-authored teaching data, not AI or measured results, in the example descriptions, manifest, and UI mode banner.
- The manifest records the dev/holdout split, source and CC0-1.0 license, figure metadata, keypoints, image URLs, and the scripted-data disclosure.
- Improved the T03 page after integration review: fixed its duplicate closing JSX and token usage counting, replaced synthetic example thumbnails with the actual self-drawn clear images, switched those images to `next/image` with `unoptimized`, and changed initial loading to asynchronous effect fetches. No UI interfaces were changed.

## Validation commands and observed results

- `npm run examples` — passed; all 12 manifest-linked image pairs were written or verified. The command imports the example module, which validates every gold and scripted memory with `MemorySchema`.
- `npm run typecheck` — passed after integration fixes in the shared tree.
- `npm run lint` — passed with 0 errors and 0 warnings after the shared pipeline cleanup.
- `npm test` — passed earlier in the same task: 2 test files, 13 tests.
- Clear oscillator, resonance, and layer-stack PNGs were visually inspected. The plots show the requested formula, axes, units, and relative curve behavior; the layer image shows the A/B/A order and both interfaces without implying material properties.

## Live/mock/replay evidence

- These are self-drawn educational engineer controls and scripted UI fixtures only. No model calls or empirical evaluations were run. They must not be presented as the main generalization evaluation set or as evidence of accuracy. The holdout labels remain metadata; the records are teaching examples, not research holdout results.

## Unresolved issues

- `public/examples/` contains 48 unreferenced PNG/SVG files from earlier prototype revisions. The current manifest points only to the 12 final PNGs and their matching SVG sources. These earlier files were retained because project rules prohibit automatic cleanup; no cleanup was performed.
- Formal figure evaluation should use the separately sourced paper-figure catalog being coordinated by the main agent. This T05 set should remain labelled as tutorial/engineer controls.
- There are no external paper sources because all drawings are original and self-drawn; the displayed equations and values are instructional relationships only.

## Escalations and proposed decisions

- Main agent requested future evaluation prioritization move to a separately sourced paper-figure catalog. This delivery is restricted to tutorial/engineer controls accordingly.
- None of the six scientific recipes were changed from the approved definitions. No evaluator behavior was relaxed.

## Next exact action

- Main integrator can import `EXAMPLES`, `getExample`, and `listExamples()`; keep the self-drawn figures clearly labelled as teaching controls while connecting the separately sourced paper-figure catalog.
