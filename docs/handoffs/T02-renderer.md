# T02 Renderer handoff

Task: T02 controlled reconstruction renderer  
Classification: execution  
Contract/version: schema 0.2.0; renderer version 0.2.0  
Owned files: `src/lib/reconstruction/index.ts`, `tests/reconstruction.test.ts`, `docs/handoffs/T02-renderer.md`

## Delivered

- Added `projectForRender(memory)` with an explicit allowlist projection. It retains graph, plot, fact and uncertainty semantics while excluding evidence records and image bounding boxes.
- Added deterministic SVG generation and Resvg PNG conversion at 1200 px wide. Graph nodes use an automatic grid except that geometry/structure semantic positions are retained. Group boxes, relation direction/style/evidence status, explicit condition scope and targets, facts with certainty/qualifiers/references, and uncertainty cards are visible.
- Promotion/flow directed relations use arrowheads; directed inhibition uses a blunt T endpoint. Unknown relation direction/style is labeled as unknown. Self-relations are disclosed in the figure and marked unsupported instead of being drawn as a misleading zero-length edge.
- Plot series are drawn from their points using the declared linear/log transforms, labeled axes and units, tick marks, and an approximate marker. Unknown scales do not receive an invented data mapping and set the audit incomplete. Out-of-domain points are excluded and their series marked unsupported.
- Audit IDs cover nodes, relations, groups, conditions, plots, series, facts and uncertainties. Unrenderable items populate `unsupported_item_ids`; `visual_review` remains `not_reviewed` because no human/strong-model image inspection occurred. Internal item IDs are SVG attributes only, never visible labels.
- Added focused tests for projection privacy, escaped XML, promotion/inhibition marks, qualifiers and conditions, logarithmic coordinate spacing, semantic item audit, unknown-scale reporting, and the PNG signature.

## Validation

- `npm test -- --run tests/reconstruction.test.ts` — passed, 8 tests (including vertically separated structure nodes, complete long-label rendering, relation detail disclosure, and empty-memory audit failure).
- `npm exec eslint -- src/lib/reconstruction/index.ts tests/reconstruction.test.ts` — passed with no findings.
- Targeted TypeScript check (`npm exec tsc -- --noEmit --skipLibCheck --target ES2022 --moduleResolution bundler --module esnext --strict --esModuleInterop --types node src/lib/reconstruction/index.ts tests/reconstruction.test.ts`) — passed.
- Latest `npm run typecheck` — blocked by tuple-index type errors in separately owned `tests/model.test.ts` at lines 20, 21, 31, 33, 43, and 44. No renderer diagnostic was reported.
- PNG signature was checked by the renderer test. Generated `artifacts/validation/renderer-smoke.png` and a follow-up `artifacts/validation/renderer-smoke-v2.png`. The follow-up uses explicit SVG font-family/size/weight attributes, system font loading, a 520 px minimum semantic canvas, and a centered 1084 px single-plot panel. `RenderResult.visual_review` remains `not_reviewed`; root/T06 should inspect v2 before any review is marked passed.

## Limits and next action

- The current renderer uses a one-layer group outline and grid layout; it is not a precision scientific digitizer. Semantic-position collisions are flagged unsupported. Extremely dense graphs and self-relations remain incomplete and are identified in the output audit.
- Review `renderer-smoke-v2.png` and additional crowded/unknown-scale fixtures. Fix any observed clipping/overlap. Re-run full typecheck after the model-test tuple typing errors are repaired.
