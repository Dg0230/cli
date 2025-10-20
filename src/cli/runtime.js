import { DEFAULT_PROGRAM_NAME, ENTRYPOINTS } from "./constants.js";
import { createProgram } from "./commands/index.js";
import {
  applyStartupSettings,
  loadSettingsFromArg,
  loadSettingSources,
} from "./settings.js";
import { prepareInputPayload } from "./io.js";
import { installCommandDescriptor } from "./ui/install.js";
import {
  loadPersistentState,
  savePersistentState,
  markDirty,
} from "./state.js";

function createSettingsBridge(context = {}) {
  const state = context.state ?? {};
  return {
    loadSettingsFromArg,
    loadSettingSources,
    async apply(values = {}) {
      const result = applyStartupSettings(values, {
        cwd: context.cwd ?? process.cwd(),
        onLoaded: context.onSettingsLoaded,
        state,
      });
      if (result.settings) {
        state.settings = result.settings;
      }
      if (result.settingSources?.length) {
        state.settingSources = result.settingSources;
      }
      if (result.dirty) {
        markDirty(state);
      }
      return result;
    },
  };
}

function createIoBridge(context = {}) {
  return {
    prepareInputPayload: (prompt, inputFormat, options = {}) =>
      prepareInputPayload(prompt, inputFormat, {
        stdin: options.stdin ?? context.stdin ?? process.stdin,
      }),
  };
}

export function determineEntrypoint({ preferSdk = false } = {}) {
  if (preferSdk) {
    return ENTRYPOINTS.SDK;
  }
  if (process.env.CLAUDE_CODE_ENTRYPOINT) {
    return process.env.CLAUDE_CODE_ENTRYPOINT;
  }
  if (process.env.GITHUB_ACTIONS === "true") {
    return ENTRYPOINTS.ACTION;
  }
  return ENTRYPOINTS.CLI;
}

export async function bootstrapProgram(options = {}) {
  const persistentState =
    options.state ?? loadPersistentState({ configPath: options.configPath });
  const settingsBridge = options.settings ??
    createSettingsBridge({
      ...options,
      state: persistentState,
    });
  const ioBridge = options.io ?? createIoBridge(options);

  return createProgram({
    version: options.version ?? options.packageVersion ?? "0.0.0",
    settings: settingsBridge,
    io: ioBridge,
    ui: {
      install: installCommandDescriptor,
      ...(options.ui ?? {}),
    },
    state: persistentState,
  });
}

export async function runCli(context = {}) {
  const argv = context.argv ?? process.argv;
  const stdin = context.stdin ?? process.stdin;
  const stdout = context.stdout ?? process.stdout;
  const stderr = context.stderr ?? process.stderr;

  process.env.NoDefaultCurrentDirectoryInExePath = "1";
  const entrypoint = determineEntrypoint({
    preferSdk: context.preferSdk === true,
  });
  process.env.CLAUDE_CODE_ENTRYPOINT = entrypoint;

  const persistentState =
    context.state ??
    loadPersistentState({
      configPath: context.configPath,
    });

  const program = await bootstrapProgram({
    ...context,
    state: persistentState,
  });

  try {
    await program.run(argv, { stdin, stdout, stderr });
    if (program.state?.__dirty) {
      savePersistentState(program.state, {
        configPath: context.configPath,
      });
    }
    return {
      ...program.state,
      entrypoint,
    };
  } catch (error) {
    stderr.write(`Error running ${DEFAULT_PROGRAM_NAME}: ${error.message}\n`);
    if (context.throwOnError) {
      throw error;
    }
    process.exitCode = 1;
    return {
      ...program.state,
      entrypoint,
      error,
    };
  }
}
