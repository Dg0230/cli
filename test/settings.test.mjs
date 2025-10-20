import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  loadSettingsFromArg,
  loadSettingSources,
  applyStartupSettings,
  extractSettingsFromArgv,
  SettingsError,
} from "../src/cli/settings.js";

import { DEFAULT_STATE } from "../src/cli/state.js";

test("loadSettingsFromArg parses inline json", () => {
  const result = loadSettingsFromArg('{"foo": "bar"}');
  assert.equal(result.type, "inline");
  assert.equal(result.data.foo, "bar");
  assert.ok(fs.existsSync(result.path));
});

test("loadSettingsFromArg reads file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-settings-"));
  const file = path.join(dir, "config.json");
  fs.writeFileSync(file, JSON.stringify({ theme: "dark" }), "utf8");
  const result = loadSettingsFromArg(file);
  assert.equal(result.type, "file");
  assert.equal(result.data.theme, "dark");
});

test("loadSettingsFromArg throws on missing file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-settings-"));
  const file = path.join(dir, "missing.json");
  assert.throws(() => loadSettingsFromArg(file), SettingsError);
});

test("loadSettingSources reads comma separated entries", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-sources-"));
  const first = path.join(dir, "first.json");
  const second = path.join(dir, "second.json");
  fs.writeFileSync(first, JSON.stringify({ one: 1 }), "utf8");
  fs.writeFileSync(second, "NOTJSON", "utf8");
  const sources = loadSettingSources(`${first},${second}`);
  assert.equal(sources.length, 2);
  assert.equal(sources[0].data.one, 1);
  assert.equal(sources[1].data, "NOTJSON");
});

test("applyStartupSettings marks state dirty when flags used", () => {
  const state = { ...DEFAULT_STATE, __dirty: false };
  const result = applyStartupSettings(
    { settings: '{"mode":"ci"}' },
    { state }
  );
  assert.equal(result.dirty, true);
  assert.equal(state.__dirty, true);
});

test("extractSettingsFromArgv returns flag values", () => {
  const argv = [
    "node",
    "cli",
    "--settings",
    "inline",
    "--setting-sources",
    "sources.json",
  ];
  const result = extractSettingsFromArgv(argv);
  assert.equal(result.settings, "inline");
  assert.equal(result.settingSources, "sources.json");
});

