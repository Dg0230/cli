import { test } from "node:test";
import assert from "node:assert/strict";
import { createInkOptions, prepareInputPayload } from "../src/cli/io.js";
import { createMockStdin } from "./helpers.mjs";

test("createInkOptions applies defaults and invokes fallback", () => {
  const options = createInkOptions({});
  assert.equal(options.exitOnCtrlC, true);
  options.onFlicker(10, 5);
});

test("prepareInputPayload returns prompt when stdin is tty", async () => {
  const stdin = createMockStdin("ignored", { interactive: true });
  const payload = await prepareInputPayload("hello", "text", { stdin });
  assert.equal(payload, "hello");
});

test("prepareInputPayload merges prompt and stdin for text", async () => {
  const stdin = createMockStdin("world\n", { interactive: false });
  const payload = await prepareInputPayload("hello", "text", { stdin });
  assert.equal(payload, "hello\nworld\n");
});

test("prepareInputPayload parses json for streaming formats", async () => {
  const stdin = createMockStdin('{"answer":42}', { interactive: false });
  const payload = await prepareInputPayload("prompt", "json", { stdin });
  const parsed = JSON.parse(payload);
  assert.deepEqual(parsed, { prompt: "prompt", input: { answer: 42 } });
});

test("prepareInputPayload throws on invalid json", async () => {
  const stdin = createMockStdin("not-json", { interactive: false });
  await assert.rejects(() => prepareInputPayload("prompt", "json", { stdin }));
});

