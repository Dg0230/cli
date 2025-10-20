import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  DEFAULT_STATE,
  loadPersistentState,
  savePersistentState,
  resolveConfigPath,
  markDirty,
} from "../src/cli/state.js";

let tempDir;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-state-"));
});

test("resolveConfigPath respects explicit configPath", () => {
  const resolved = resolveConfigPath({ configPath: path.join(tempDir, "custom.json") });
  assert.ok(resolved.endsWith("custom.json"));
});

test("resolveConfigPath uses env override", () => {
  const target = path.join(tempDir, "env-config.json");
  const env = { CLAUDE_CODE_CONFIG: target };
  const resolved = resolveConfigPath({ env });
  assert.equal(resolved, path.resolve(target));
});

test("loadPersistentState returns defaults when file missing", () => {
  const configPath = path.join(tempDir, "missing.json");
  const state = loadPersistentState({ configPath });
  assert.equal(state.configPath, path.resolve(configPath));
  assert.equal(state.__dirty, false);
  for (const key of Object.keys(DEFAULT_STATE)) {
    assert.deepEqual(state[key], DEFAULT_STATE[key]);
  }
});

test("savePersistentState writes json and clears dirty flag", () => {
  const configPath = path.join(tempDir, "state.json");
  const state = { ...DEFAULT_STATE, configPath, __dirty: true, tokens: { default: { value: "123" } } };
  savePersistentState(state);
  const raw = fs.readFileSync(configPath, "utf8");
  const parsed = JSON.parse(raw);
  assert.deepEqual(parsed.tokens.default.value, "123");
  assert.equal(state.__dirty, false);
  assert.equal(state.configPath, path.resolve(configPath));
});

test("markDirty toggles flag", () => {
  const state = { ...DEFAULT_STATE, __dirty: false };
  markDirty(state);
  assert.equal(state.__dirty, true);
});

