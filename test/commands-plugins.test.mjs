import { test } from "node:test";
import assert from "node:assert/strict";

import { createProgram } from "../src/cli/commands/index.js";

function createStdIo() {
  const output = [];
  return {
    stdout: { write: (chunk) => output.push(chunk) },
    stderr: { write: (chunk) => output.push(chunk) },
    output,
  };
}

test("plugin marketplace add persists entry", async () => {
  const io = createStdIo();
  const state = { pluginMarketplace: {}, __dirty: false };
  const program = createProgram({ state });
  await program.run(
    [
      "node",
      "claude",
      "plugin",
      "marketplace",
      "add",
      "sample",
      "https://plugins.example/sample",
    ],
    io
  );
  assert.equal(state.pluginMarketplace.sample.url, "https://plugins.example/sample");
  assert.equal(state.__dirty, true);
});

