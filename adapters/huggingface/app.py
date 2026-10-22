"""Gradio ZeroGPU entry point for the isolated HF relay protocol."""

from __future__ import annotations

import base64
import io
import json
from pathlib import Path
from typing import Any

import gradio as gr
import spaces
import torch
from PIL import Image
from transformers import AutoModelForImageTextToText, AutoProcessor

from relay import RelayError, run_relay
from bootstrap import prepare_node


MODEL_ID = "Qwen/Qwen3-VL-4B-Instruct"
MODEL_REVISION = "ebb281ec70b05090aa6165b016eac8ec08e71b17"
MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 25_000_000
prepare_node()

# ZeroGPU requires model placement at module initialization; GPU is emulated
# until a decorated function acquires its allocation.
processor = AutoProcessor.from_pretrained(MODEL_ID, revision=MODEL_REVISION)
model = AutoModelForImageTextToText.from_pretrained(
    MODEL_ID,
    revision=MODEL_REVISION,
    torch_dtype="auto",
    device_map="cuda",
)
model.eval()


def _model_infer(request: dict[str, Any]) -> dict[str, Any]:
    text = request.get("prompt", "")
    schema = request.get("schema")
    if isinstance(schema, dict):
        text += "\n\nReturn one JSON object matching this schema, with no markdown: " + json.dumps(schema, ensure_ascii=False)

    content: list[dict[str, Any]] = [{"type": "text", "text": text}]
    encoded_image = request.get("image_base64")
    if encoded_image is not None:
        raw_image = base64.b64decode(encoded_image, validate=True)
        with Image.open(io.BytesIO(raw_image)) as opened:
            image = opened.convert("RGB")
        content.insert(0, {"type": "image", "image": image})

    messages = [{"role": "user", "content": content}]
    inputs = processor.apply_chat_template(
        messages,
        tokenize=True,
        add_generation_prompt=True,
        return_dict=True,
        return_tensors="pt",
    ).to(model.device)
    input_count = int(inputs["input_ids"].shape[-1])
    with torch.inference_mode():
        generated = model.generate(**inputs, max_new_tokens=10_000, do_sample=False)
    generated_ids = generated[0, input_count:]
    output_count = int(generated_ids.shape[-1])
    eos_ids = model.generation_config.eos_token_id
    if isinstance(eos_ids, int):
        eos_ids = [eos_ids]
    ended = bool(eos_ids) and any(int(token) in eos_ids for token in generated_ids.tolist())
    finish_reason = "stop" if ended else "length"
    response_text = processor.decode(generated_ids, skip_special_tokens=True)
    return {
        "text": response_text,
        "input_tokens": input_count,
        "output_tokens": output_count,
        "finish_reason": finish_reason,
    }


@spaces.GPU(duration=180)
def analyze(
    image_path: str | None,
    expected_messages: str,
    consent: bool,
    profile: gr.OAuthProfile | None,
) -> tuple[dict[str, Any], Image.Image]:
    if profile is None or not getattr(profile, "username", None):
        raise gr.Error("Please sign in to Hugging Face before submitting.")
    if not consent:
        raise gr.Error("Confirm the data-use consent before submitting.")
    if image_path is None:
        raise gr.Error("Upload a scientific figure first.")

    messages = [line.strip() for line in expected_messages.splitlines() if line.strip()]
    if not 3 <= len(messages) <= 5:
        raise gr.Error("Enter 3 to 5 expected scientific messages, one per line.")

    source = Path(image_path)
    if source.stat().st_size > MAX_IMAGE_BYTES:
        raise gr.Error("The uploaded PNG/JPEG must be 10 MB or smaller.")
    try:
        with Image.open(source) as opened:
            if opened.format not in {"PNG", "JPEG"}:
                raise gr.Error("Only PNG and JPEG images are accepted.")
            if opened.width * opened.height > MAX_IMAGE_PIXELS:
                raise gr.Error("The uploaded image must be 25 megapixels or smaller.")
            image = opened.convert("RGB")
    except gr.Error:
        raise
    except Exception as exc:
        raise gr.Error("The uploaded image could not be decoded.") from exc

    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    image_base64 = base64.b64encode(buffer.getvalue()).decode("ascii")
    keypoints = [
        {"id": f"K{index}", "text": text, "claim": None, "author_confirmed": True}
        for index, text in enumerate(messages, start=1)
    ]
    try:
        result = run_relay(image_base64, keypoints, _model_infer, timeout_seconds=180)
    except RelayError as exc:
        raise gr.Error(f"Analysis stopped at {exc.stage} ({exc.code}): {exc.message}") from exc

    reconstructed = Image.open(io.BytesIO(base64.b64decode(result["reconstruction_png_base64"]))).convert("RGB")
    return result, reconstructed


with gr.Blocks(title="Research Figure Evaluator · HF ZeroGPU", delete_cache=(600, 600)) as demo:
    gr.Markdown(
        "# Research Figure Evaluator\n"
        "Share 3–5 messages you intend readers to take from a physics, materials, or mathematics figure. "
        "The service simulates two readings of the figure and compares them with your expectations. "
        "This is AI feedback, not a measurement of human understanding or a scientific validation."
    )
    gr.Markdown("Uploads are transferred to this host and temporarily cached before analysis. Use public figures only; do not upload confidential or unpublished work.")
    gr.LoginButton()
    with gr.Row():
        image_input = gr.File(
            label="Scientific figure (PNG/JPEG, max 10 MB and 25 MP)",
            type="filepath",
            file_types=[".png", ".jpg", ".jpeg"],
        )
        messages_input = gr.Textbox(
            label="Expected scientific messages (3–5, one per line)",
            lines=5,
            placeholder="The phase boundary shifts to higher pressure as temperature rises.\nThe structure contains two connected layers.\n...",
        )
    consent_input = gr.Checkbox(
        label="I consent to sending this image and these expected messages to the hosted AI model for this analysis."
    )
    run_button = gr.Button("Run analysis", variant="primary")
    result_output = gr.JSON(label="Analysis result and stage usage")
    reconstruction_output = gr.Image(label="Reconstructed figure from the first reading")
    run_button.click(
        fn=analyze,
        inputs=[image_input, messages_input, consent_input],
        outputs=[result_output, reconstruction_output],
        concurrency_limit=1,
        api_name=False,
    )

demo.queue(default_concurrency_limit=1, max_size=8)

if __name__ == "__main__":
    demo.launch(max_file_size="10mb", show_error=False)
