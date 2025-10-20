import { STREAMING_FORMATS } from "./constants.js";

export function createInkOptions({ exitOnCtrlC = true, onFlicker } = {}) {
  const flickerHandler =
    typeof onFlicker === "function"
      ? onFlicker
      : (desiredHeight, actualHeight) => {
          if (desiredHeight === actualHeight) {
            return;
          }
          if (typeof console.debug === "function") {
            console.debug(
              `[ink] Flicker detected: desired=${desiredHeight} actual=${actualHeight}`
            );
          }
        };

  return {
    exitOnCtrlC,
    onFlicker: flickerHandler,
  };
}

async function readAll(stream) {
  stream.setEncoding("utf8");
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return chunks.join("");
}

function mergePromptAndInput(prompt, stdinContent) {
  return [prompt, stdinContent].filter(Boolean).join("\n");
}

export async function prepareInputPayload(
  prompt = "",
  inputFormat = "text",
  { stdin = process.stdin } = {}
) {
  const normalizedPrompt = prompt ?? "";
  const stream = stdin ?? process.stdin;
  const isInteractive = Boolean(stream?.isTTY);

  if (isInteractive && !STREAMING_FORMATS.has(inputFormat)) {
    return normalizedPrompt;
  }

  const stdinContent = await readAll(stream);
  if (!stdinContent) {
    return normalizedPrompt;
  }

  if (STREAMING_FORMATS.has(inputFormat)) {
    try {
      const parsed = JSON.parse(stdinContent);
      return JSON.stringify({ prompt: normalizedPrompt, input: parsed });
    } catch (error) {
      throw new Error(
        `Failed to parse stdin as ${inputFormat}: ${error.message}`
      );
    }
  }

  return mergePromptAndInput(normalizedPrompt, stdinContent);
}
