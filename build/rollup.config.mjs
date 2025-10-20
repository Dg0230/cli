
import path from "node:path";
import { builtinModules } from "node:module";
import { fileURLToPath } from "node:url";

import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { defineConfig } from "rollup";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const cliEntries = {
  runtime: path.resolve(projectRoot, 'src/cli/runtime.js'),
  settings: path.resolve(projectRoot, 'src/cli/settings.js'),
  io: path.resolve(projectRoot, 'src/cli/io.js'),
  state: path.resolve(projectRoot, 'src/cli/state.js'),
  constants: path.resolve(projectRoot, 'src/cli/constants.js'),
  'commands/index': path.resolve(projectRoot, 'src/cli/commands/index.js'),
  'commands/mcp': path.resolve(projectRoot, 'src/cli/commands/mcp.js'),
  'commands/plugins': path.resolve(projectRoot, 'src/cli/commands/plugins.js'),
  'commands/maintenance': path.resolve(projectRoot, 'src/cli/commands/maintenance.js'),
  'ui/install': path.resolve(projectRoot, 'src/cli/ui/install.js'),
};

const externalModules = new Set([
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
]);

export default defineConfig({
  input: cliEntries,
  output: {
    dir: path.resolve(projectRoot, 'dist/cli'),
    format: 'cjs',
    exports: 'named',
    sourcemap: true,
    entryFileNames: '[name].js',
    chunkFileNames: 'chunks/[name]-[hash].js',
    preserveModules: true,
    preserveModulesRoot: 'src',
  },
  external(source) {
    if (externalModules.has(source)) {
      return true;
    }
    return source.startsWith('node:');
  },
  plugins: [
    nodeResolve({ preferBuiltins: true }),
    commonjs(),
    json(),
  ],
  treeshake: {
    moduleSideEffects: false,
  },
});
