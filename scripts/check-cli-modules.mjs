import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const projectRoot = new URL('..', import.meta.url).pathname;

const moduleSpecs = {
  runtime: {
    file: 'src/cli/runtime.js',
    exports: ['runCli', 'bootstrapProgram', 'determineEntrypoint'],
  },
  settings: {
    file: 'src/cli/settings.js',
    exports: [
      'SettingsError',
      'loadSettingsFromArg',
      'loadSettingSources',
      'applyStartupSettings',
      'extractSettingsFromArgv',
    ],
  },
  io: {
    file: 'src/cli/io.js',
    exports: ['createInkOptions', 'prepareInputPayload'],
  },
  state: {
    file: 'src/cli/state.js',
    exports: [
      'DEFAULT_STATE',
      'resolveConfigPath',
      'loadPersistentState',
      'savePersistentState',
      'markDirty',
    ],
  },
  bundler: {
    file: 'src/cli/bundler.js',
    exports: [
      'readBundledManifest',
      'resolveBundledPath',
      'loadBundledModule',
      'listBundledModules',
      'createBundledModuleLoader',
      'describeBundledModule',
      'createEsmLoaderContext',
    ],
  },
  constants: {
    file: 'src/cli/constants.js',
    exports: [
      'ENTRYPOINTS',
      'EXIT_CODES',
      'DEFAULT_PROGRAM_NAME',
      'DEFAULT_PROGRAM_DESCRIPTION',
      'PERMISSION_MODES',
      'STREAMING_FORMATS',
      'CONFIG_ENV_VAR',
      'DEFAULT_INSTALL_STEPS',
      'getDefaultTelemetryContext',
    ],
  },
  update: {
    file: 'src/cli/update.js',
    exports: [
      'compareVersions',
      'loadUpdateManifest',
      'selectRelease',
      'determineUpdatePlan',
      'formatUpdateSummary',
      'applyUpdatePlan',
      'recordUpdateResult',
      'createUpdateLogger',
      'summarizeUpdateHistory',
    ],
  },
  'commands/index': {
    file: 'src/cli/commands/index.js',
    exports: ['createProgram'],
  },
  'commands/mcp': {
    file: 'src/cli/commands/mcp.js',
    exports: ['registerMcpCommands'],
  },
  'commands/plugins': {
    file: 'src/cli/commands/plugins.js',
    exports: ['registerPluginCommands'],
  },
  'commands/maintenance': {
    file: 'src/cli/commands/maintenance.js',
    exports: ['registerMaintenanceCommands'],
  },
  'ui/install': {
    file: 'src/cli/ui/install.js',
    exports: ['installCommandDescriptor'],
  },
};

function formatList(items) {
  return items.map((value) => `'${value}'`).join(', ');
}

async function verifyFile(relativePath) {
  const absolutePath = path.resolve(projectRoot, relativePath);
  await fs.access(absolutePath);
  return absolutePath;
}

async function verifyExports(absolutePath, expectedExports) {
  const moduleUrl = pathToFileURL(absolutePath).href;
  const loaded = await import(moduleUrl);
  const missing = expectedExports.filter((name) => !(name in loaded));
  if (missing.length > 0) {
    throw new Error(
      `${path.relative(projectRoot, absolutePath)} is missing exports: ${formatList(missing)}`
    );
  }
  return loaded;
}

async function main() {
  const results = [];
  for (const [name, spec] of Object.entries(moduleSpecs)) {
    const absolutePath = await verifyFile(spec.file);
    await verifyExports(absolutePath, spec.exports);
    results.push({ name, file: spec.file });
  }
  console.log(
    `Verified ${results.length} CLI modules:`,
    results.map((entry) => `${entry.name} → ${entry.file}`).join('; ')
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
