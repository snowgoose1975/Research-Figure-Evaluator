Figure Relay helps researchers inspect whether a scientific figure communicates its intended message by making an AI reader’s interpretation visible. It reads a figure, reconstructs an image from the saved reading, and compares a second reading with the author’s intended statements, exposing possible misunderstandings and reconstruction limits for review.

## Approach

The author uploads a PNG/JPEG and confirms three to five statements they want readers to recover. Reader A receives only the image and produces structured notes covering entities, relationships, conditions, uncertainty, axes, and visual content. A deterministic renderer reconstructs a raster image from those saved notes alone. Reader B receives only the reconstruction in a separate request. Neither reader receives the author’s statements, source caption, or the other reader’s notes.

The report presents the original, reconstruction, actual A/B records, checkpoint comparisons, and detection coverage. Deterministic checks support bounded comparisons of explicit facts, uniquely matched connections, and selected numerical properties. Unsupported semantic judgments are marked for verification, and rendering gaps are shown separately so they are not automatically blamed on the original figure. An optional direct-image checkpoint baseline is isolated from the round trip.

The application uses Next.js, schema-validated model responses, SVG-to-PNG reconstruction, and local Ollama inference with Qwen3-VL. The public website offers recorded cases without installation and a limited new-image trial while the host computer is online. Visitors can reopen reports saved in their browser. Only already-public figures should be uploaded; processing records remain on the host.

## Results

A fixed protocol evaluated four attributed CC BY research figures across physics, materials, and mathematics, with three attempts per figure. Eight of twelve runs completed in 30–184 seconds; four stopped explicitly during Reader A at the output-token limit. All outcomes were retained. These are completion statistics, not an accuracy estimate.

The cases reveal why matching labels is insufficient. A mathematical reference line was sampled at the wrong height, and the second reader described a changed shape. A materials lattice became labelled boxes, losing its geometry. These observations expose reader and representation failures that require inspection; they do not establish defects in the source figures. Example checkpoints were curated by the project and were not independently confirmed by the paper authors.

Automated engineering checks cover reader-input isolation, schema validation, connection comparisons, reconstruction, and browser-local history; type checks, lint, and production builds also pass. Public-site connectivity has separate verification records.

## Limitations and next steps

AI-simulated readings do not measure human comprehension or establish scientific correctness. Separate requests to the same model can share errors. Four figures cannot establish cross-domain generalization, and the round trip has not demonstrated an advantage over direct checking. Next steps are controlled original-versus-revised figure comparisons, stronger readers, improved geometric reconstruction, and independent human review.

[Try Figure Relay](https://figure-relay.chicchair5.chatgpt.site) · [Source code and evidence](https://github.com/snowgoose1975/Research-Figure-Evaluator)
