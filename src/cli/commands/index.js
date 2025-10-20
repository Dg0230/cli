import { parseArgs } from "node:util";

import {
  DEFAULT_PROGRAM_DESCRIPTION,
  DEFAULT_PROGRAM_NAME,
  EXIT_CODES,
  getDefaultTelemetryContext,
} from "../constants.js";
import { markDirty } from "../state.js";
import { registerMcpCommands } from "./mcp.js";
import { registerPluginCommands } from "./plugins.js";
import { registerMaintenanceCommands } from "./maintenance.js";

function createRegistry() {
  const commands = new Map();
  return {
    add(command) {
      if (!command?.name) {
        throw new Error("Command descriptors require a name");
      }
      commands.set(command.name, command);
      if (Array.isArray(command.aliases)) {
        for (const alias of command.aliases) {
          commands.set(alias, command);
        }
      }
    },
    get(name) {
      return commands.get(name);
    },
    list() {
      return Array.from(new Set(commands.values()));
    },
  };
}

function printHelp({ stdout, registry }) {
  const lines = [];
  lines.push(`${DEFAULT_PROGRAM_NAME} <command>`);
  lines.push("");
  lines.push(DEFAULT_PROGRAM_DESCRIPTION);
  lines.push("");
  lines.push("Commands:");
  for (const command of registry.list()) {
    if (command.name === "default") continue;
    lines.push(`  ${command.name.padEnd(18)} ${command.description ?? ""}`);
  }
  stdout.write(`${lines.join("\n")}\n`);
}

function normalizeContext(context = {}) {
  return {
    stdin: context.stdin ?? process.stdin,
    stdout: context.stdout ?? process.stdout,
    stderr: context.stderr ?? process.stderr,
    telemetry: {
      ...getDefaultTelemetryContext(),
      ...(context.telemetry ?? {}),
    },
  };
}

export function createProgram({ version, settings, io, ui, state } = {}) {
  const registry = createRegistry();
  const programState = state ?? {};

  registry.add({
    name: "default",
    description: DEFAULT_PROGRAM_DESCRIPTION,
    async run({ positionals, options, context }) {
      const stdio = normalizeContext(context);
      const [prompt = ""] = positionals;
      const inputFormat = options["input-format"] ?? "text";
      const outputFormat = options.print
        ? "print"
        : options["output-format"] ?? "interactive";
      const payload = io?.prepareInputPayload
        ? await io.prepareInputPayload(prompt, inputFormat, { stdin: stdio.stdin })
        : prompt;
      if (outputFormat === "print") {
        if (payload) {
          stdio.stdout.write(`${payload}\n`);
        }
        return;
      }
      stdio.stdout.write("Interactive mode is not implemented yet.\n");
      if (payload) {
        stdio.stdout.write(`Prompt:\n${payload}\n`);
      }
    },
  });

  registerMcpCommands((descriptor) => registry.add(descriptor), {
    state: programState,
  });
  registerPluginCommands((descriptor) => registry.add(descriptor), {
    state: programState,
  });
  registerMaintenanceCommands((descriptor) => registry.add(descriptor), {
    state: programState,
    ui,
    version,
  });

  async function execute(values, positionals, context, rawArgs) {
    if (values.help) {
      printHelp({ stdout: context.stdout, registry });
      return EXIT_CODES.SUCCESS;
    }

    let commandName = "default";
    let commandPositionals = positionals;
    if (positionals.length > 0) {
      const candidate = positionals[0];
      if (registry.get(candidate)) {
        commandName = candidate;
        commandPositionals = positionals.slice(1);
      }
    }

    let commandArgs = rawArgs;
    if (Array.isArray(rawArgs)) {
      if (commandName === "default") {
        commandArgs = rawArgs;
      } else {
        const startIndex = rawArgs.indexOf(commandName);
        commandArgs = startIndex === -1 ? [] : rawArgs.slice(startIndex + 1);
      }
    }

    const command = registry.get(commandName);
    if (!command) {
      context.stderr.write(`Unknown command: ${commandName}\n`);
      return EXIT_CODES.GENERIC_ERROR;
    }

    try {
      if (settings?.apply) {
        const applied = await settings.apply(values, context);
        programState.settings = applied.settings ?? programState.settings;
        programState.settingSources =
          applied.settingSources ?? programState.settingSources;
        if (applied.dirty) {
          markDirty(programState);
        }
      }
      await command.run({
        positionals: commandPositionals,
        options: values,
        context,
        rawArgs: commandArgs,
        state: programState,
        version,
      });
      return EXIT_CODES.SUCCESS;
    } catch (error) {
      context.stderr.write(`${error.message}\n`);
      return EXIT_CODES.GENERIC_ERROR;
    }
  }

  return {
    registry,
    state: programState,
    version,
    async run(argv = process.argv, stdio = {}) {
      const context = normalizeContext(stdio);
      const args = Array.isArray(argv) ? argv.slice(2) : [];
      const { values, positionals } = parseArgs({
        args,
        allowPositionals: true,
        strict: false,
        options: {
          help: { type: "boolean", short: "h" },
          debug: { type: "boolean", short: "d" },
          print: { type: "boolean", short: "p" },
          settings: { type: "string" },
          "setting-sources": { type: "string" },
          "input-format": { type: "string" },
          "output-format": { type: "string" },
        },
      });

      if (values.debug) {
        programState.debug = true;
      }
      programState.print = Boolean(values.print);
      programState.version = version;

      const exitCode = await execute(values, positionals, context, args);
      if (typeof exitCode === "number") {
        context.exitCode = exitCode;
      }
      return exitCode;
    },
  };
}
