import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { CONFIG_ENV_VAR } from "./constants.js";

const DEFAULT_CONFIG_FILE = path.join(
  os.homedir(),
  ".config",
  "claude-code",
  "config.json"
);

export const DEFAULT_STATE = Object.freeze({
  version: null,
  print: false,
  settings: null,
  settingSources: [],
  mcpServers: {},
  plugins: {},
  pluginMarketplace: {},
  tokens: {},
  updateHistory: [],
  installMigration: null,
  updateChannel: "stable",
  lastUpdateCheck: null,
});

function ensureDirectoryExists(filePath) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
}

export function resolveConfigPath({ env = process.env, configPath } = {}) {
  if (configPath) {
    return path.resolve(configPath);
  }
  if (env?.[CONFIG_ENV_VAR]) {
    return path.resolve(env[CONFIG_ENV_VAR]);
  }
  return DEFAULT_CONFIG_FILE;
}

export function loadPersistentState(options = {}) {
  const configPath = resolveConfigPath(options);
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_STATE,
      ...parsed,
      configPath,
      __dirty: false,
    };
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return {
        ...DEFAULT_STATE,
        configPath,
        __dirty: false,
      };
    }
    throw new Error(`Failed to load CLI configuration at ${configPath}`, {
      cause: error,
    });
  }
}

export function savePersistentState(state, options = {}) {
  if (!state) return;
  const configPath = resolveConfigPath({ ...options, configPath: state.configPath });
  const serialisable = {
    ...state,
  };
  delete serialisable.__dirty;
  delete serialisable.configPath;
  ensureDirectoryExists(configPath);
  fs.writeFileSync(configPath, JSON.stringify(serialisable, null, 2), "utf8");
  state.__dirty = false;
  state.configPath = configPath;
}

export function markDirty(state) {
  if (state) {
    state.__dirty = true;
  }
}
