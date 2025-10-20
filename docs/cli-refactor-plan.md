# CLI Refactor Plan

## 1. Section map for `cli-origin.js`
- **Bundler runtime helpers** – Wrapper utilities that emulate the module loader used throughout the bundled build. These sit immediately after the shebang and precede any CLI-specific logic.【F:cli-origin.js†L1-L40】
- **Install command UI bootstrap** – Lazy initializer that loads Ink/React primitives, defines the `install` JSX command descriptor (`TyQ`), and wires it into the CLI runtime.【F:cli-origin.js†L398515-L398541】
- **Update workflow** – Implements the `claude update` experience (`LyQ`), including diagnostics, version checks, and native-update handling.【F:cli-origin.js†L398187-L398260】
- **Settings and configuration loaders** – Functions `aT8`, `sT8`, and `rT8` parse `--settings`/`--setting-sources` flags and apply the resolved configuration before the CLI boots.【F:cli-origin.js†L399135-L399183】
- **CLI lifecycle orchestration** – Entry routine `tT8` establishes environment variables, determines execution mode, and ultimately calls `BP8` to register commands.【F:cli-origin.js†L399199-L399224】
- **Terminal I/O helpers** – `eT8` configures Ink’s stdio behavior and `AP8` normalizes stdin payloads for non-interactive pipelines.【F:cli-origin.js†L399226-L399263】
- **Argument parsing and command registration** – `BP8` builds the Commander.js program, defines global flags, and nests subcommand configuration blocks.【F:cli-origin.js†L399264-L399340】
- **Command groups inside `BP8`**:
  - MCP server management subcommands (`mcp serve/add/remove/list/...`).【F:cli-origin.js†L399700-L399944】
  - Plugin lifecycle subcommands (`plugin validate/install/uninstall/...`).【F:cli-origin.js†L399924-L400033】
  - Plugin marketplace management (`plugin marketplace add/list/remove/update`).【F:cli-origin.js†L399947-L400033】
  - Legacy installer maintenance (`migrate-installer`).【F:cli-origin.js†L400034-L400045】
  - Authentication utilities (`setup-token`).【F:cli-origin.js†L400046-L400079】
  - CLI diagnostics (`doctor`).【F:cli-origin.js†L400080-L400096】
  - Self-update & installer commands (`update`, `install`).【F:cli-origin.js†L400097-L400134】

## 2. Target module layout
Create a new `src/cli/` directory with the following modules and responsibilities:

| Module | Responsibilities | Candidate moves |
| --- | --- | --- |
| `src/cli/runtime.js` | Orchestrate startup (`tT8`), determine entrypoint (`oT8`), coordinate configuration pre-flight (`rT8`), and launch the command program (`BP8`). | `tT8`, `oT8`, `rT8`, `BP8`, and supporting imports they require.【F:cli-origin.js†L399135-L399340】 |
| `src/cli/settings.js` | Parse `--settings`/`--setting-sources`, resolve file paths, and write temporary config files. | `aT8`, `sT8`, helpers they call (`LAA`, `_AA`) should be imported from existing modules; document TODO if relocation needed.【F:cli-origin.js†L399135-L399183】 |
| `src/cli/io.js` | Handle terminal wiring (`eT8`) and stdin aggregation for print/streaming modes (`AP8`). | `eT8`, `AP8`, plus any shared telemetry callbacks (`Z1`).【F:cli-origin.js†L399226-L399263】 |
| `src/cli/ui/install.js` | Export the JSX command descriptor for the `install` flow and the Ink components used during install (`TyQ`, `xT8`, `jyQ`, etc.). | `TyQ`, `xT8`, `jyQ`, `x5` usage should be encapsulated here.【F:cli-origin.js†L398515-L398560】 |
| `src/cli/commands/index.js` | Build the Commander.js program by composing subcommand builders and wiring shared options (acts as the public factory consumed by `runtime`). | Wrapper around `BP8` once it delegates to specialized builders.【F:cli-origin.js†L399264-L400134】 |
| `src/cli/commands/mcp.js` | Provide a function that accepts a Commander program instance and registers `mcp` subcommands. | Block beginning at the MCP comment, including helper `Q(W, J)` used for error reporting.【F:cli-origin.js†L399700-L399923】 |
| `src/cli/commands/plugins.js` | Register `plugin` subcommands (validate/install/uninstall/enable/disable) and share plugin helper utilities. | Portion under “Plugin lifecycle commands,” capturing the nested `marketplace` builder as a nested export or separate helper.【F:cli-origin.js†L399924-L400033】 |
| `src/cli/commands/maintenance.js` | Bundle administrative commands (`migrate-installer`, `setup-token`, `doctor`, `update`, `install`) so runtime can attach them cleanly. | Sections flagged for legacy installer, authentication, diagnostics, and self-update actions.【F:cli-origin.js†L400034-L400134】 |
| `src/cli/state.js` | Persist CLI state between runs, mirroring the bundled configuration cache and installer migration checkpoints. | Extracted from stateful sections that tracked MCP servers, plugins, and installer metadata.【F:cli-origin.js†L399700-L400134】 |

Consider an additional `src/cli/constants.js` for shared arrays such as `h71` (permission modes) so multiple modules can import the same values without cyclical dependencies.【F:cli-origin.js†L399286-L399320】【F:cli-origin.js†L42600-L42604】

## 3. Export/import sketch
- `runtime.js`
  - **Exports**: `runCli`, `determineEntrypoint`, `bootstrapProgram`.
  - **Imports**: `applySettings` from `settings.js`, `buildProgram` from `commands/index.js`, `configureTerminal`/`readInput` from `io.js`, telemetry/logging utilities already referenced in the bundled file, and persistent-state helpers.
- `settings.js`
  - **Exports**: `loadSettingsFromArg`, `loadSettingSources`, `applyStartupSettings`, `SettingsError`, `extractSettingsFromArgv`.
  - **Imports**: Filesystem helpers, configuration mutators, and `markDirty` to persist CLI state changes triggered by flags.
- `io.js`
  - **Exports**: `createInkOptions`, `prepareInputPayload`.
  - **Imports**: `STREAMING_FORMATS` constant for structured stdin handling.
- `commands/index.js`
  - **Exports**: `createProgram({ terminal, settings, ui })` – constructs `parseArgs` routing and delegates to specialized command registries.
  - **Imports**: Each subcommand module (`mcp.js`, `plugins.js`, `maintenance.js`), along with shared constants and persistence helpers.
- `commands/mcp.js`
  - **Exports**: `registerMcpCommands(register, { state })` for add/list/remove/show operations.
  - **Imports**: `markDirty` to persist configuration changes.
- `commands/plugins.js`
  - **Exports**: `registerPluginCommands(register, { state })` including nested marketplace helpers.
  - **Imports**: `parseArgs` from `node:util`, `markDirty`.
- `commands/maintenance.js`
  - **Exports**: `registerMaintenanceCommands(register, { state, ui, version })` powering diagnostics, updates, installer migration, and token storage.
  - **Imports**: `DEFAULT_INSTALL_STEPS`, `markDirty`, `parseArgs`.
- `ui/install.js`
  - **Exports**: `installCommandDescriptor` returning a serialisable description of the guided installer steps.
  - **Imports**: `DEFAULT_INSTALL_STEPS`.
- `state.js`
  - **Exports**: `loadPersistentState`, `savePersistentState`, `resolveConfigPath`, `markDirty`, and `DEFAULT_STATE`.
  - **Imports**: Node filesystem/path utilities and `CONFIG_ENV_VAR`.
- `constants.js`
  - **Exports**: Entrypoint identifiers, exit codes, permission modes, configuration env var, installer defaults, telemetry helpers.

## 4. Migration checklist & follow-up work
1. **Create module skeletons** – ✅ *Completed in `/src/cli`.* Scaffold the `src/cli/` directory with placeholder exports matching the plan above so incremental moves compile.
2. **Move helper utilities** – ✅ `settings.js`, `io.js`, and `state.js` now provide concrete implementations for parsing inline/file settings, aggregating stdin payloads, and persisting CLI state to disk.
3. **Extract command builders** – ✅ `commands/index.js` orchestrates argument parsing via `node:util.parseArgs` and dispatches to dedicated MCP, plugin, and maintenance command registrars with persistence.
4. **Integrate UI module** – ✅ `ui/install.js` exposes a descriptive install flow that the maintenance module imports to render installer steps.
5. **Update entrypoint wiring** – ✅ `runtime.js` composes the modular pieces, exports `runCli`, `determineEntrypoint`, and `bootstrapProgram`, and wires environment preparation before executing the parsed program while saving config state.
6. **Regression testing** – ✅ Manual smoke tests for help, MCP, plugin, installer, and token flows executed via `node` invocations against the modular runtime.

### Anticipated follow-ups
- **Build tooling adjustments** – Update bundler/rollup configuration to include the new `src/cli/` entry modules instead of the monolithic bundle.
- **Type definitions** – If TypeScript types or JSDoc are used elsewhere, introduce declarations for the new modules to preserve IntelliSense.
- **Documentation updates** – Sync CLI usage docs so command grouping mirrors the new module structure (e.g., mention `commands/plugins` split).
- **Test coverage** – ✅ Added Node.js test coverage for runtime orchestration, state persistence, settings parsing, and key command flows via `node --test`.
