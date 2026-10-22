# Figure Relay

### AI-simulated reader round-trip diagnostics for scientific figures

Figure Relay helps researchers inspect whether a figure communicates the message they intend. It gives a scientific figure to an AI-simulated reader, reconstructs an image from that reader’s saved reading, and asks a second reader to interpret the reconstruction. The report highlights information that may be missed, changed, or left uncertain.

An exploratory research-software prototype built for the 2026 Open Scientific Intelligence Hackathon.

[Open the public demo](https://figure-relay.chicchair5.chatgpt.site) · [Read the project write-up](docs/submission/WRITEUP.md) · [Browse the source repository](https://github.com/snowgoose1975/Research-Figure-Evaluator)

## How it works

1. **Set the intended message.** The author records three to five points a reader should take away.
2. **Read the original.** Reader A uses a fixed prompt for original scientific figures and creates structured observations. The author’s checkpoints are withheld from the reader.
3. **Reconstruct from memory.** A deterministic renderer turns Reader A’s saved observations into an approximate diagram, without printing A’s prose summary into the image.
4. **Read again and compare.** Reader B uses its own fixed prompt in a separate image-only request. The report compares the two reader accounts with the intended points and marks areas that were not checked.

The report exposes the records from different stages for inspection; it does not automatically establish which stage caused an error. It is a review aid, not an overall figure-quality score. A “needs verification” assessment is unresolved, rather than a failed-figure grade.

Upload a figure and describe three to five intended messages in ordinary language. The report shows the two AI readings and their cited records; technical checks are available in a collapsed section. No connection syntax is required. Existing structured checks remain supported by the evaluation engine for reproducible experiments; they verify recorded content, not the source figure or every clause of an unrestricted natural-language statement.

## Try the public demo

The public site includes four recorded cases in physics, materials, and mathematics. These replays are available without installing a model.

- Select **Check my figure** to open the visitor workspace. New analysis is available only while the author’s host computer is online and accepting requests.
- Select **Saved checks** to find reports saved by this browser. Search, reopen, download, or remove them from the workspace.
- Visitor reports are stored in this browser’s local IndexedDB. They do not sync to an account, the host computer’s history, or another device.

Online analysis runs on the author’s computer through a limited free trial. Only submit figures that are already public and that you are authorized to share. Submitted images are processed and retained in a private run record on the host computer. Do not upload confidential or unpublished research. The service can pause or go offline; it has no uptime guarantee. See [local hosting and privacy details](docs/LOCAL_HOSTING.md).

## Evidence and limitations

The historical fixed local-model protocol covers four published figures and twelve attempts across physics, materials, and mathematics, using Qwen3-VL 4B and reader-0.2.2. Eight attempts completed; four ended during Reader A and remain counted as failures. Completion is not accuracy, and this small sample does not establish generalization. The protocol has not been rerun with the current reader-0.2.4 prompts; later development runs are recorded separately.

Observed cases show why the comparison can be useful and why its output needs review: a reconstructed threshold curve changed shape, lattice geometry was lost, and the model has misread arrow direction. Example checkpoints were curated by the project and marked by the protocol; they were not independently confirmed by the paper authors.

Figure Relay does not measure human understanding, establish scientific correctness, or prove that a figure is defective. The same model is used for separate reader requests, so their errors are not statistically independent. Free-text scientific interpretation, reliable arrow reading, and several geometric details remain outside the validated coverage. Repeated node labels can prevent unique branch matching. An advantage over direct figure checking and improvements to human communication have not yet been demonstrated.

## Run locally

Use Node.js 22.12 or newer. The recorded cases work without a local model:

```bash
npm ci
npm run dev
```

Open `http://127.0.0.1:3000`. For local inference, install Ollama and create the project’s 16k-context model:

```bash
ollama pull qwen3-vl:4b-instruct
ollama create qwen3-vl:4b-instruct-16k -f scripts/Modelfile.qwen3-vl-4b-instruct-16k
```

Then restart the app. The default model is `qwen3-vl:4b-instruct-16k`. Run the project checks with:

```bash
npm run validate
```

## Project documentation

- [Project write-up](docs/submission/WRITEUP.md) — method, results, and interpretation.
- [User guide](docs/USER_GUIDE.md) — operating the local application and reading reports.
- [Figure sources and permissions](docs/REAL_FIGURES.md).
- [Validation record](docs/DELIVERY_VALIDATION.md) — test evidence and remaining verification limits.
