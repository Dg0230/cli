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

test("setup-token stores named token", async () => {
  const io = createStdIo();
  const state = { tokens: {}, __dirty: false };
  const program = createProgram({ state });
  await program.run(
    [
      "node",
      "claude",
      "setup-token",
      "secret123",
      "--name",
      "ci",
    ],
    io
  );
  assert.equal(state.tokens.ci.value, "secret123");
  assert.equal(state.__dirty, true);
});

test("install command prints descriptor steps", async () => {
  const io = createStdIo();
  const program = createProgram({
    ui: {
      install: () => ({ title: "Installer", steps: ["Step A", "Step B"] }),
    },
  });
  await program.run(["node", "claude", "install"], io);
  const output = io.output.join("");
  assert.ok(output.includes("Installer"));
  assert.ok(output.includes("Step A"));
  assert.ok(output.includes("Step B"));
});

