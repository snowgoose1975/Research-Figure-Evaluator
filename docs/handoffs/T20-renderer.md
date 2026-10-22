# T20 renderer handoff

## Delivery

- Updated `src/lib/reconstruction/index.ts` to renderer version 0.2.3.
- The PNG now uses the neutral title `Reconstructed figure`; the model title and `summary` remain available in `projectForRender` but neither is painted. Graph node labels, relation labels, plot titles, and plot labels remain rendered.
- Relations first use a direct segment. When it collides with a non-endpoint node, the renderer tries deterministic top, bottom, and side orthogonal channels. Parallel and reverse relations receive distinct channel offsets. Arrowheads and inhibition T bars use the final path segment, preserving source-to-target direction. If all candidate routes collide, the relation stays explicitly unsupported with a warning. Self-relations remain unsupported.
- Added `tests/renderer-routing.test.ts`; updated the routing expectation in `tests/renderer-layout.test.ts`.

## Verification

- `npm test -- --run tests/renderer-layout.test.ts tests/renderer-routing.test.ts` — exit 0; 2 files, 7 tests passed.

## T20 routing review follow-up

- Unobstructed relations that share endpoint pairs now route onto distinct deterministic channels as well; they no longer overlap merely because a direct segment is clear. Relation labels use the midpoint of the longest nonzero path segment, so a straight edge label sits at its center.
- Route height is included in the SVG height calculation, and routes that exceed the horizontal/top canvas bounds remain explicitly unsupported.
- Updated legacy renderer assertions for neutral title / summary isolation, new path-based edges, and renderer 0.2.3.
- `npm test -- --run tests/reconstruction.test.ts tests/renderer-layout.test.ts tests/renderer-routing.test.ts` — exit 0; 3 files, 18 tests passed.
- `npm run lint -- --no-warn-ignored` — exit 0.
- `npm test` — renderer and remaining project tests passed, but six `local-service-http.test.ts` cases failed because sandboxed loopback fetches returned `EACCES` (`127.0.0.1`). This is an environment restriction; those failures are unrelated to renderer code. Do not claim the full suite passed.

## T20 global-corner routing follow-up

- Added deterministic global left/right corner candidates combined with top/bottom channels. This covers cases where endpoint-aligned lanes and simple side lanes each intersect a different non-endpoint node. The existing route bounds audit and canvas height expansion apply to these paths too.
- Added a synthetic route case where the direct middle, endpoint-aligned top/bottom approaches, and central side lane are blocked; the selected path uses the global right channel and remains within the SVG bounds.
- Offline rendering of private development run `1792679901262-de6f77fd` was written only to the new `runs/1792679901262-de6f77fd/scratch/T20-renderer-v2/` directory. `rel_13` routes via the global right/bottom channel (`x=1154`); it is absent from unsupported IDs and warnings. The output was visually inspected; the route is not clipped. This is a renderer geometry check, not a claim about scientific correctness.

## T20 vertical reverse-edge follow-up

- Parallel/reverse relations with predominantly vertical endpoints now prefer distinct global left/right x channels. The renderer rejects same-x fallback candidates for these pairs, so an unrouteable edge remains explicitly unsupported instead of silently overlapping.
- Relation-label rectangle intersections are surfaced as warnings. On the real private A rendering, the central-to-dropout reverse paths use distinct x channels (`1190` and `1166`) with no unsupported relation or clipping. Their `flows_to` label cards still overlap; `rel_10` therefore carries the explicit `relation label overlaps another relation label; visual review required` warning.
- The final visual check was saved to `runs/1792679901262-de6f77fd/scratch/T20-renderer-v3-final/`; the earlier v3 scratch was retained unchanged.
- `npm test -- --run tests/renderer-routing.test.ts tests/reconstruction.test.ts tests/renderer-layout.test.ts` — exit 0; 3 files, 20 tests passed. `npm run typecheck` — exit 0.

## Limits and follow-up

- Routes are deterministic and local to the graph; a successful route may extend above or below the nodes by the clearance channel. If the available geometry leaves no clear candidate, the existing unsupported/warning path is retained.
- No existing private run was modified; no live model call or Git operation was made by this subtask. New private scratch outputs were used for offline checking. The offline renderer tests establish answer-text isolation and routing behavior; they do not establish scientific fidelity or validate any model extraction.

## Main integration follow-up

- The integrator added bounded label offsets when label rectangles overlap. Final offline rendering of the same private A record is in `scratch/T20-main-final/`, with no unsupported items or warnings. The separate new live extraction still has one unroutable connection, explicitly reported; the old-input geometry result is not a claim that all future graphs render without gaps.
