import { parseArgs } from "node:util";

import { DEFAULT_INSTALL_STEPS } from "../constants.js";
import { markDirty } from "../state.js";

function ensureState(state) {
  if (!state.tokens || typeof state.tokens !== "object") {
    state.tokens = {};
  }
  if (!Array.isArray(state.updateHistory)) {
    state.updateHistory = [];
  }
  return state;
}

function formatCheck(result) {
  const icon = result.ok ? "✔" : "✖";
  return `${icon} ${result.name} – ${result.message}`;
}

function runDoctor(state) {
  const results = [];
  const nodeVersion = process.versions.node;
  const major = Number.parseInt(nodeVersion.split(".")[0], 10);
  results.push({
    name: "Node.js version",
    ok: major >= 18,
    message: major >= 18
      ? `Running Node.js ${nodeVersion}`
      : `Node.js ${nodeVersion} detected. Upgrade to >=18.0.0`,
  });
  if (state.configPath) {
    results.push({
      name: "Config path",
      ok: true,
      message: state.configPath,
    });
  }
  return results;
}

function recordUpdate(state, info) {
  ensureState(state);
  state.updateHistory.push(info);
  markDirty(state);
}

export function registerMaintenanceCommands(
  register,
  { state = {}, ui = {}, version = "0.0.0" } = {}
) {
  register({
    name: "doctor",
    description: "Run environment diagnostics",
    async run({ context }) {
      ensureState(state);
      const stdio = {
        stdout: context.stdout ?? process.stdout,
      };
      const checks = runDoctor(state);
      for (const check of checks) {
        stdio.stdout.write(`${formatCheck(check)}\n`);
      }
      const failures = checks.filter((check) => !check.ok);
      if (failures.length === 0) {
        stdio.stdout.write("Environment looks healthy.\n");
      } else {
        stdio.stdout.write(
          `${failures.length} issue(s) detected. Consult the upgrade guide.\n`
        );
      }
    },
  });

  register({
    name: "update",
    description: "Check for CLI updates",
    async run({ context }) {
      ensureState(state);
      const stdio = {
        stdout: context.stdout ?? process.stdout,
      };
      const timestamp = new Date().toISOString();
      const latest = process.env.CLAUDE_CODE_LATEST ?? version;
      const current = version ?? "0.0.0";
      if (latest === current) {
        stdio.stdout.write(`You are running the latest version (${current}).\n`);
      } else {
        stdio.stdout.write(
          `Update available: current ${current}, latest ${latest}.\n`
        );
      }
      recordUpdate(state, {
        timestamp,
        latest,
        current,
        status: latest === current ? "up-to-date" : "update-available",
      });
    },
  });

  register({
    name: "setup-token",
    description: "Store an authentication token",
    async run({ positionals, context, rawArgs }) {
      ensureState(state);
      const stdio = {
        stdout: context.stdout ?? process.stdout,
        stderr: context.stderr ?? process.stderr,
      };
      const tokens = Array.isArray(rawArgs) && rawArgs.length > 0 ? rawArgs : positionals;
      const { values, positionals: args } = parseArgs({
        args: tokens,
        allowPositionals: true,
        strict: false,
        options: {
          name: { type: "string" },
          description: { type: "string" },
        },
      });
      const [token] = args;
      const tokenName = values.name ?? "default";
      if (!token) {
        stdio.stderr.write("Usage: claude setup-token <token> [--name <alias>]\n");
        return;
      }
      state.tokens[tokenName] = {
        value: token,
        description: values.description ?? null,
        storedAt: new Date().toISOString(),
      };
      markDirty(state);
      stdio.stdout.write(`Stored token '${tokenName}'.\n`);
    },
  });

  register({
    name: "migrate-installer",
    description: "Migrate the legacy installer",
    async run({ context }) {
      const stdio = {
        stdout: context.stdout ?? process.stdout,
      };
      state.installMigration = {
        migratedAt: new Date().toISOString(),
      };
      markDirty(state);
      stdio.stdout.write("Legacy installer migration completed.\n");
    },
  });

  if (ui?.install) {
    register({
      name: "install",
      description: "Launch the interactive installer",
      async run({ context }) {
        const stdio = {
          stdout: context.stdout ?? process.stdout,
        };
        const descriptor = ui.install();
        const title = descriptor?.title ?? "Claude Code Installer";
        const steps = Array.isArray(descriptor?.steps)
          ? descriptor.steps
          : DEFAULT_INSTALL_STEPS;
        stdio.stdout.write(`${title}\n`);
        for (const step of steps) {
          stdio.stdout.write(`- ${step}\n`);
        }
      },
    });
  }
}
