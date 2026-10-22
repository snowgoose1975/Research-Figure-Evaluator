import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { modelConfig } from "../src/lib/pipeline/config";

const keys = ["RFE_BASE_URL", "OPENAI_BASE_URL", "RFE_MODEL", "OPENAI_MODEL", "RFE_PROTOCOL", "RFE_TIMEOUT_MS", "RFE_MAX_OUTPUT_TOKENS", "OPENAI_API_KEY"];
const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));

beforeEach(() => { for (const key of keys) delete process.env[key]; });
afterEach(() => {
  for (const key of keys) {
    const value = saved[key];
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

describe("model configuration defaults", () => {
  it("defaults a local service to the verified 16k model and 10000 output tokens", () => {
    expect(modelConfig()).toMatchObject({
      baseUrl: "http://127.0.0.1:11434/v1",
      model: "qwen3-vl:4b-instruct-16k",
      protocol: "chat",
      timeoutMs: 300_000,
      maxOutputTokens: 10_000,
    });
  });
  it("honours explicit environment overrides", () => {
    process.env.RFE_MODEL = "qwen3-vl:8b-instruct-16k";
    process.env.RFE_MAX_OUTPUT_TOKENS = "14000";
    process.env.RFE_TIMEOUT_MS = "1234";
    process.env.RFE_PROTOCOL = "responses";
    expect(modelConfig()).toMatchObject({ model: "qwen3-vl:8b-instruct-16k", maxOutputTokens: 14000, timeoutMs: 1234, protocol: "responses" });
  });
  it("never silently selects a local model for a remote service", () => {
    process.env.RFE_BASE_URL = "https://api.example.com/v1";
    expect(modelConfig().model).toBe("");
  });
  it("treats OPENAI_BASE_URL=localhost as local and falls back on invalid token limits", () => {
    process.env.OPENAI_BASE_URL = "http://localhost:11434/v1";
    process.env.RFE_MAX_OUTPUT_TOKENS = "not-a-number";
    expect(modelConfig()).toMatchObject({ model: "qwen3-vl:4b-instruct-16k", maxOutputTokens: 10_000 });
  });
});
