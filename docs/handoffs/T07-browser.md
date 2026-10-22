# T07 browser and HTTP smoke handoff

## Scope and method

- Ran the headless Microsoft Edge Playwright smoke script against the local app only at `http://127.0.0.1:3000`.
- Browser launch used the configured Edge executable and elevated execution as required. The dev server was left running.
- Script: `scripts/browser-smoke.mjs`.

## Results (bounded rerun after Origin fix)

Passed before stopping:

- Home page returned HTTP 200.
- Published research is selected by default and shows three published cards.
- All three cards expose attribution/license information and a separate paper link.
- Selecting a published figure disables Scripted tutorial, starts checkpoints unconfirmed, and displays the paper/caption checkpoint provenance notice.
- Selecting an engineering control enables Scripted tutorial.

Passed on the full rerun:

- Confirmed the oscillator keypoints and completed two Scripted tutorial runs (clear and challenged versions).
- Both original and reconstruction PNGs rendered, and the report showed at least three keypoint rows with an explicit Scripted demo label.
- JSON and Markdown downloads succeeded and contained run/report content.
- Clear/challenged run comparison rendered.
- At 390px viewport width, document width remained 390px with visible primary controls.
- No page-level JavaScript errors occurred. The browser console emitted a generic 404 resource message; the response listener captured no failed HTTP responses, so the source is unidentified.

## Evidence

- `artifacts/validation/browser-home.png` — home-page screenshot at 1440px.
- `artifacts/validation/browser-result.png` — completed scripted evaluation result.
- `artifacts/validation/browser-mobile.png` — 390px viewport screenshot.
- `artifacts/validation/browser-console.json` — complete checks, console errors, page errors, and failed-response URLs.
- `artifacts/validation/figure-relay-1792596289147-05241a80.json` and `.md` — downloaded reports from the clear scripted run.
- `artifacts/validation/renderer-smoke.png` and `renderer-smoke-v2.png` pre-existed and were not modified by this task.

## Interpretation

- The first attempt failed before creating the run because the app's same-origin check disagreed with Next's normalized request URL; the root owner fixed this separately and added regression coverage.
- The successful runs are clearly labeled scripted tutorial data. These results validate UI/API integration only and are not model-performance evidence.
- No application or backend code was changed by this task.
