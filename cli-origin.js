import { pathToFileURL } from "node:url";

import {
  bootstrapProgram,
  determineEntrypoint,
  runCli,
} from "./src/cli/runtime.js";
import {
  SettingsError,
  loadSettingsFromArg,
  loadSettingSources,
  applyStartupSettings,
  extractSettingsFromArgv,
} from "./src/cli/settings.js";
import { createInkOptions, prepareInputPayload } from "./src/cli/io.js";
import {
  DEFAULT_STATE,
  resolveConfigPath,
  loadPersistentState,
  savePersistentState,
  markDirty,
} from "./src/cli/state.js";
import {
  ENTRYPOINTS,
  EXIT_CODES,
  DEFAULT_PROGRAM_NAME,
  DEFAULT_PROGRAM_DESCRIPTION,
  PERMISSION_MODES,
  STREAMING_FORMATS,
  CONFIG_ENV_VAR,
  DEFAULT_INSTALL_STEPS,
  getDefaultTelemetryContext,
} from "./src/cli/constants.js";
import {
  readBundledManifest,
  resolveBundledPath,
  loadBundledModule,
  listBundledModules,
  createBundledModuleLoader,
  describeBundledModule,
  createEsmLoaderContext,
} from "./src/cli/bundler.js";
import {
  compareVersions,
  loadUpdateManifest,
  selectRelease,
  determineUpdatePlan,
  formatUpdateSummary,
  applyUpdatePlan,
  recordUpdateResult,
  createUpdateLogger,
  summarizeUpdateHistory,
} from "./src/cli/update.js";
import { createProgram } from "./src/cli/commands/index.js";
import { registerMcpCommands } from "./src/cli/commands/mcp.js";
import { registerPluginCommands } from "./src/cli/commands/plugins.js";
import { registerMaintenanceCommands } from "./src/cli/commands/maintenance.js";
import { installCommandDescriptor } from "./src/cli/ui/install.js";

export {
  // Runtime exports
  bootstrapProgram,
  determineEntrypoint,
  runCli,
  // Settings and configuration helpers
  SettingsError,
  loadSettingsFromArg,
  loadSettingSources,
  applyStartupSettings,
  extractSettingsFromArgv,
  // Terminal utilities
  createInkOptions,
  prepareInputPayload,
  // Persistent state helpers
  DEFAULT_STATE,
  resolveConfigPath,
  loadPersistentState,
  savePersistentState,
  markDirty,
  // Shared constants
  ENTRYPOINTS,
  EXIT_CODES,
  DEFAULT_PROGRAM_NAME,
  DEFAULT_PROGRAM_DESCRIPTION,
  PERMISSION_MODES,
  STREAMING_FORMATS,
  CONFIG_ENV_VAR,
  DEFAULT_INSTALL_STEPS,
  getDefaultTelemetryContext,
  // Bundler compatibility helpers
  readBundledManifest,
  resolveBundledPath,
  loadBundledModule,
  listBundledModules,
  createBundledModuleLoader,
  describeBundledModule,
  createEsmLoaderContext,
  // Update workflow exports
  compareVersions,
  loadUpdateManifest,
  selectRelease,
  determineUpdatePlan,
  formatUpdateSummary,
  applyUpdatePlan,
  recordUpdateResult,
  createUpdateLogger,
  summarizeUpdateHistory,
  // Command and UI modules
  createProgram,
  registerMcpCommands,
  registerPluginCommands,
  registerMaintenanceCommands,
  installCommandDescriptor,
};

export default {
  runCli,
  bootstrapProgram,
  determineEntrypoint,
  loadBundledModule,
  compareVersions,
};

const isDirectExecution = (() => {
  if (typeof process === "undefined" || !process.argv?.[1]) {
    return false;
  }
  try {
    const executedUrl = pathToFileURL(process.argv[1]).href;
    return executedUrl === import.meta.url;
  } catch {
    return false;
  }
})();

if (isDirectExecution) {
  runCli().catch((error) => {
    const message = error?.message ?? String(error);
    const details = error?.stack ?? message;
    console.error(`Failed to start Claude CLI: ${message}`);
    console.error(details);
    process.exitCode = 1;
  });
}
