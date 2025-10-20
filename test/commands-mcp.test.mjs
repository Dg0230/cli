import { test } from "node:test";
import assert from "node:assert/strict";

import { createProgram } from "../src/cli/commands/index.js";

function runCommand(argv, options = {}) {
  const stdout = options.stdout ?? { write() {} };
  const stderr = options.stderr ?? { write() {} };
  const stdin = options.stdin ?? { isTTY: true };
  const program = createProgram({ state: options.state });
  return program.run(["node", "claude", ...argv], { stdout, stderr, stdin });
}

test("mcp add stores server", async () => {
  const outputs = [];
  const stdout = { write: (chunk) => outputs.push(chunk) };
  const state = { mcpServers: {}, __dirty: false };
  await runCommand(["mcp", "add", "demo", "--url", "https://example.com"], {
    stdout,
    state,
  });
  assert.equal(state.mcpServers.demo.url, "https://example.com");
  assert.equal(state.__dirty, true);
});

