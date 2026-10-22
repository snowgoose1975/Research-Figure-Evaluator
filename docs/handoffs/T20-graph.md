# T20 Graph audit handoff

Task: T20 frozen graph-audit repair
Classification: execution
Contract/version: T20, GraphAudit optional duplicate/opposing fields
Owned files: `src/lib/evaluation/graph-audit.ts`, `tests/graph-audit.test.ts`, `docs/handoffs/T20-graph.md`

## Delivered

- `added_edges` and `removed_edges` now compare unique full edge-record keys. Duplicate occurrences do not create connection additions/removals; `unchanged_edges` counts unique matching records.
- Repeated uniquely addressable records are reported on their own side as `duplicate_edges_a/b` with total `count`.
- Reverse directed records with the same kind are reported as original records in `opposing_edges_a/b`. This scan is per-memory and includes nodes that have no counterpart in the other memory. It does not label the records as scientifically contradictory.
- Label ambiguity and blank labels remain ineligible for edge matching and anomaly reporting that requires resolved endpoints.
- The audit note is English and says the comparison covers extracted A/B records only, has no source-image ground truth, and opposing records may both already appear in the source image.
- Updated the old multiplicity test to the frozen set semantics; added coverage for repeated B-only records, opposing records on unmatched labels, and refusing edges through duplicate labels.

## Validation

- `npx vitest run tests/graph-audit.test.ts` — passed, 1 file / 12 tests.
- `npm run typecheck` — passed.

## Limits and next step

The audit key includes endpoints, kind, direction, line style, and evidence status, preserving the existing contract that changes to these fields count as a changed edge record. No runs, model calls, historical statistics, or other files were modified. Integrator should consume the optional fields without assuming they exist in legacy reports.
