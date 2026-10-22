// Evidence files are immutable records. Scripts must choose a new label for a
// rerun instead of silently overwriting an earlier validation artifact.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const LABEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const VALIDATION_DIR = path.join(process.cwd(), "artifacts", "validation");

/** @param {string} label */
export function assertEvidenceLabel(label) {
  if (!label || !LABEL_PATTERN.test(label)) {
    throw new Error(`Invalid evidence label "${label}". Use letters, digits, dots, underscores and hyphens; no path separators.`);
  }
  return label;
}

/**
 * Return an explicit --label, or the historical base name. A rerun that keeps
 * the base name is rejected by assertNewEvidence; pass --label <new-name>.
 * @param {string} base
 * @param {string[]} [argv]
 */
export function evidenceLabel(base, argv = process.argv.slice(2)) {
  const inline = argv.find(argument => argument.startsWith("--label="));
  const index = argv.indexOf("--label");
  const requested = inline !== undefined ? inline.slice("--label=".length) : index >= 0 ? argv[index + 1] : undefined;
  if (inline !== undefined || index >= 0) {
    if (!requested || requested.startsWith("--")) {
      throw new Error("--label requires a non-empty evidence label.");
    }
    return assertEvidenceLabel(requested);
  }
  return assertEvidenceLabel(base);
}

/** @param {string} label @param {string} suffix */
export function evidenceFile(label, suffix) {
  assertEvidenceLabel(label);
  return path.join(VALIDATION_DIR, `${label}${suffix}`);
}

/** @param {string[]} paths */
export function assertNewEvidence(paths) {
  const existing = paths.filter(file => existsSync(file));
  if (existing.length) {
    throw new Error([
      "Refusing to overwrite existing evidence:",
      ...existing.map(file => `  ${path.relative(process.cwd(), file)}`),
      "Evidence is immutable. Rerun with a new --label, for example --label T10-audit-stub.",
    ].join("\n"));
  }
}

/**
 * Create a new evidence file atomically. The wx flag refuses to replace an
 * existing path even if another process created it after the preflight check.
 * @param {string} file
 * @param {string | NodeJS.ArrayBufferView} contents
 */
export function writeNewEvidence(file, contents) {
  mkdirSync(path.dirname(file), { recursive: true });
  try {
    writeFileSync(file, contents, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === "EEXIST") {
      throw new Error(`Refusing to overwrite existing evidence: ${path.relative(process.cwd(), file)}. Rerun with a new --label.`);
    }
    throw error;
  }
}
