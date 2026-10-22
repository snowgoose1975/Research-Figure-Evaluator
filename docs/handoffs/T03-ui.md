# T03 UI handoff

Task: T03 responsive Figure Relay workspace and published-catalog integration
Classification: execution
Contract/version: schema 0.2.0 plus optional ExampleSummary publication metadata
Owned files: `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `docs/handoffs/T03-ui.md`

## Delivered

- Built the Figure Relay research workspace with responsive navy navigation, service configuration state, domain/type filters, PNG/JPEG upload, editable author checkpoints, status/error handling, run history, polling, comparison, and Markdown/JSON export.
- Added segmented source selection for Published research and Engineering controls. Published examples surface figure label, attribution, license, and a separate paper link; teaching examples carry an explicit engineering-control/scripted-tutorial label.
- Selecting a published paper figure switches to Live and disables Scripted tutorial. Published versions are populated from the example's available versions, including single-version sources. The selection panel repeats source/license/paper details and explains that paper/caption checkpoints need author review and are not author-supplied intent.
- Added an independent keypoint-aware baseline option for configured Live runs. Its output is shown separately from A/B, labeled as a separate request, and never feeds the main report. Published figures do not receive scripted outputs.
- Kept original and reconstructed raster image rendering unoptimized through `next/image`; no fabricated published-figure result is generated in the UI.
- Added focus-visible styling, reduced-motion handling, narrow-screen layouts, loading/empty states, and explicit unavailable-service feedback.

## Validation

- `npm run lint` — passed.
- `npm run typecheck` — passed.
- No API routes, schemas, prompts, or dependencies were changed.

## Limits / handoff notes

- Published catalog metadata and paper URLs are supplied by the API; UI gracefully falls back to the available `source` and `license` fields.
- Current checkout has `/api/status`, `/api/examples`, and `/api/comparisons`; run creation/detail/report endpoints are not present in the API route tree yet, so those interactions follow the agreed endpoint contract but cannot be exercised end to end here.
- Upload size/MIME checks are client-side convenience; the API remains responsible for authoritative image validation, including pixel limits.
- No files were deleted.
