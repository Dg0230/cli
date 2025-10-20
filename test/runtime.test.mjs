import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { determineEntrypoint, runCli } from "../src/cli/runtime.js";
import { DEFAULT_STATE } from "../src/cli/state.js";
import { createBufferStream } from "./helpers.mjs";

afterEach(() => {
  delete process.env.CLAUDE_CODE_ENTRYPOINT;
  delete process.env.CLAUDE_CODE_LATEST;
});

test("determineEntrypoint prefers sdk flag", () => {
  const result = determineEntrypoint({ preferSdk: true });
  assert.equal(result, "sdk-cli");
});

test("determineEntrypoint uses env override", () => {
  process.env.CLAUDE_CODE_ENTRYPOINT = "custom";
  const result = determineEntrypoint();
  assert.equal(result, "custom");
});

test("runCli executes plugin install and persists state", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-runtime-"));
  const configPath = path.join(dir, "config.json");
  const stdout = createBufferStream();
  const stderr = createBufferStream();
  const state = { ...DEFAULT_STATE, configPath, __dirty: false };
  const argv = [
    "node",
    "claude",
    "plugin",
    "install",
    "demo",
    "--version",
    "1.0.0",
  ];
  const result = await runCli({
    argv,
    stdout,
    stderr,
    state,
    throwOnError: true,
  });
  assert.equal(result.plugins.demo.version, "1.0.0");
  const raw = fs.readFileSync(configPath, "utf8");
  const parsed = JSON.parse(raw);
  assert.equal(parsed.plugins.demo.version, "1.0.0");
  assert.equal(stderr.toString(), "");
});

test("runCli reports command usage errors without throwing", async () => {
  const stdout = createBufferStream();
  const stderr = createBufferStream();
  const state = { ...DEFAULT_STATE, __dirty: false };
  const argv = ["node", "claude", "mcp", "remove"]; // missing name triggers usage output
  const result = await runCli({
    argv,
    stdout,
    stderr,
    state,
  });
  assert.ok(stderr.toString().includes("Usage: claude mcp remove"));
  assert.equal(result.entrypoint, "cli");
});

