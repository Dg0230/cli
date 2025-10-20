import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { markDirty } from "./state.js";

export class SettingsError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "SettingsError";
    if (options.cause) {
      this.cause = options.cause;
    }
    this.code = options.code ?? "SETTINGS_ERROR";
  }
}

function createTempSettingsFile(contents, { prefix = "claude-settings" } = {}) {
  const tempDir = os.tmpdir();
  const fileName = `${prefix}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}.json`;
  const filePath = path.join(tempDir, fileName);
  fs.writeFileSync(filePath, contents, "utf8");
  return filePath;
}

export function loadSettingsFromArg(value, { cwd = process.cwd() } = {}) {
  if (!value || typeof value !== "string") {
    throw new SettingsError("Expected a non-empty string for --settings", {
      code: "INVALID_SETTINGS_ARG",
    });
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new SettingsError("The --settings flag cannot be empty", {
      code: "INVALID_SETTINGS_ARG",
    });
  }

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      const serialized = JSON.stringify(parsed, null, 2);
      const filePath = createTempSettingsFile(serialized);
      return {
        type: "inline",
        path: filePath,
        data: parsed,
        source: "inline",
      };
    } catch (error) {
      throw new SettingsError("Invalid JSON provided to --settings", {
        code: "INVALID_SETTINGS_JSON",
        cause: error,
      });
    }
  }

  const resolvedPath = path.isAbsolute(trimmed)
    ? trimmed
    : path.resolve(cwd, trimmed);
  if (!fs.existsSync(resolvedPath)) {
    throw new SettingsError(`Settings file not found: ${resolvedPath}`, {
      code: "SETTINGS_FILE_MISSING",
    });
  }

  const contents = fs.readFileSync(resolvedPath, "utf8");
  try {
    const parsed = JSON.parse(contents);
    return {
      type: "file",
      path: resolvedPath,
      data: parsed,
      source: "file",
    };
  } catch (error) {
    throw new SettingsError(
      `Settings file does not contain valid JSON: ${resolvedPath}`,
      {
        code: "INVALID_SETTINGS_JSON",
        cause: error,
      }
    );
  }
}

export function loadSettingSources(value, { cwd = process.cwd() } = {}) {
  if (!value || typeof value !== "string") {
    throw new SettingsError("Expected --setting-sources to be a string", {
      code: "INVALID_SETTING_SOURCES",
    });
  }

  const segments = value
    .split(/[,:]/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const sources = segments.map((segment) => {
    const resolved = path.isAbsolute(segment)
      ? segment
      : path.resolve(cwd, segment);
    if (!fs.existsSync(resolved)) {
      throw new SettingsError(`Setting source not found: ${resolved}`, {
        code: "SETTINGS_FILE_MISSING",
      });
    }
    const raw = fs.readFileSync(resolved, "utf8");
    let data = raw;
    try {
      data = JSON.parse(raw);
    } catch {
      // keep raw string when JSON parsing fails; some sources may be INI/ENV.
    }
    return {
      path: resolved,
      data,
    };
  });

  return sources;
}

export function applyStartupSettings(values = {}, options = {}) {
  const { cwd = process.cwd(), onLoaded, state } = options;
  const result = {
    settings: null,
    settingSources: [],
    dirty: false,
  };

  if (values.settings !== undefined) {
    result.settings = loadSettingsFromArg(values.settings, { cwd });
    result.dirty = true;
  }

  if (values["setting-sources"] !== undefined) {
    result.settingSources = loadSettingSources(values["setting-sources"], {
      cwd,
    });
    result.dirty = true;
  }

  if (typeof onLoaded === "function") {
    onLoaded(result);
  }

  if (result.dirty) {
    markDirty(state);
  }

  return result;
}

export function extractSettingsFromArgv(argv = process.argv) {
  const args = Array.isArray(argv) ? [...argv] : [];
  const findValue = (flag) => {
    const index = args.indexOf(flag);
    if (index === -1) return undefined;
    return index + 1 < args.length ? args[index + 1] : undefined;
  };

  return {
    settings: findValue("--settings"),
    settingSources: findValue("--setting-sources"),
  };
}
