---
title: Research Figure Evaluator
sdk: gradio
sdk_version: 6.30.0
python_version: 3.12
app_file: app.py
hf_oauth: true
---

# Hugging Face ZeroGPU entry point

This directory contains a candidate Gradio entry point for protocol `hf-zerogpu-0.1`. It calls the pinned `Qwen/Qwen3-VL-4B-Instruct` revision through three isolated requests coordinated by `run_relay`: reading A, reading B, and the comparison judgment. Author-provided expected messages are used only by the final comparison stage. A and B receive separate image inputs and no author messages.

The interface requires a signed-in Hugging Face profile and explicit consent before model inference. It accepts only PNG/JPEG uploads up to 10 MB and 25 megapixels, and accepts 3–5 expected messages. Gradio's temporary upload cache is configured for cleanup every 600 seconds once files are at least 600 seconds old: files can remain for approximately 10–20 minutes, or longer if cleanup is delayed. Uploading transfers the file to the host before the analysis consent is checked; do not upload confidential or unpublished figures. The queue has concurrency one and a maximum size of eight, and each model call requests at most 10,000 generated tokens with greedy decoding. Returned stage usage and finish reasons come from the model response; incomplete output or any failed stage stops the run. Results include the protocol-tagged JSON report and the reconstructed raster image.

This is AI simulated-reader feedback. It does not measure real human understanding, validate scientific conclusions, or establish that a difference was caused by the original figure. The same model is called independently, which does not make its errors statistically independent.

## Runtime status and requirements

Dependencies are pinned in `requirements.txt`. The Gradio/ZeroGPU runtime, model revision loading, end-to-end relay, and actual GPU allocation have **not been validated**. No Space has been created or published. ZeroGPU support depends on the Space hardware configuration and current platform availability.

Run `node scripts/build-hf-space.mjs --label my-space-v1` from the repository root to prepare an immutable upload directory in `artifacts/web-preview/`. The bundle includes the shared Node bridge. On Linux x64, `bootstrap.py` downloads Node 22.23.1 from nodejs.org, verifies its pinned SHA-256 and installs the three pinned bridge dependencies inside this Space directory. It does not install system software. These deployment/bootstrap steps still require actual platform validation; bundle creation is not proof of a working GPU service.

## Local syntax check

With Python available, run:

```powershell
python -m py_compile adapters/huggingface/app.py adapters/huggingface/relay.py
```

This checks Python syntax only. It does not import the pinned dependencies, download the model, or verify GPU behavior.
