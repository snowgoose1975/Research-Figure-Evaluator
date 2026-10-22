Figure Relay makes an AI reader’s interpretation of a scientific figure visible for an author to inspect. It combines image-only reading, reconstruction from saved notes, and a second reading to expose possible information loss and the system’s own limitations.

## Approach

The author uploads a PNG/JPEG and writes three to five intended messages in ordinary language. Reader A sees only the original image and saves structured observations. A deterministic renderer turns those observations into an approximate raster reconstruction. Reader B sees only that reconstruction in a separate request, using its own fixed prompt. Neither reader receives the author’s messages, source caption, or the other reader’s notes.

The interface presents the two actual reading records, cited evidence for message assessments, and the reconstructed image. Technical checks and coverage are available in a collapsed section. Free-text assessments without independent support remain explicitly unverified; “needs verification” is not a failed-figure score. The engine also supports bounded checks of recorded facts, uniquely matched connections, and selected numerical properties. Rendering gaps are flagged separately, since a reconstruction error does not establish a defect in the original figure. An isolated direct-image checkpoint baseline is available in the local workbench.

Built with Next.js, schema-validated responses, SVG-to-PNG reconstruction, and local Ollama inference, the public site offers recorded cases without installation. A limited new-image trial uses the author’s computer while it is online and accepting requests. Visitors can search and reopen completed reports saved in the same browser; there is no account synchronization. Uploads must already be public, and private processing records remain on the host.

## Results

A fixed historical protocol used four attributed CC BY research figures across physics, materials, and mathematics, with three attempts per figure and Qwen3-VL 4B under reader-0.2.2. Eight of twelve runs completed in 30–184 seconds; four stopped during Reader A at the output-token limit. All outcomes were retained. These are completion statistics, not accuracy measurements, and were not rerun for the current reader-0.2.4 interface.

The cases expose limits beyond matching labels: a reference line was sampled at the wrong height, a second reading described a changed shape, and a lattice lost its geometry. Later development uploads also exposed arrow-reading errors and ambiguous repeated labels. These observations require inspection, rather than establishing source-figure defects. Reference checkpoints were project-curated, not independently confirmed by paper authors.

Current engineering validation passes type checks, lint, 143 tests, and production build. Separate browser checks cover the simplified visitor flow and public-page connectivity; they do not establish model accuracy.

## Limitations and next steps

This is an exploratory review aid, not a validated measure of human comprehension or scientific correctness. Same-model readers can share errors. Generalization and an advantage over direct checking remain unproven. Next steps are controlled figure revisions, stronger readers, improved reconstruction, and independent human review.

[Try Figure Relay](https://figure-relay.chicchair5.chatgpt.site) · [Public repository](https://github.com/snowgoose1975/Research-Figure-Evaluator)
