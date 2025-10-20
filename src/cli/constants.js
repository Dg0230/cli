import os from "node:os";

export const ENTRYPOINTS = {
  CLI: "cli",
  SDK: "sdk-cli",
  ACTION: "github-action",
};

export const EXIT_CODES = {
  SUCCESS: 0,
  GENERIC_ERROR: 1,
  CONFIG_ERROR: 2,
};

export const DEFAULT_PROGRAM_NAME = "claude";
export const DEFAULT_PROGRAM_DESCRIPTION =
  "Claude Code - starts an interactive session by default";

export const PERMISSION_MODES = ["default", "read-only", "bypass"];

export const STREAMING_FORMATS = new Set(["stream-json", "json"]);

export const CONFIG_ENV_VAR = "CLAUDE_CODE_CONFIG";

export const DEFAULT_INSTALL_STEPS = [
  "Verify environment",
  "Download latest release",
  "Install binaries",
  "Configure settings",
];

export function getDefaultTelemetryContext() {
  return {
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
  };
}
