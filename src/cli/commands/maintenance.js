import { parseArgs } from "node:util";

import { DEFAULT_INSTALL_STEPS } from "../constants.js";
import { markDirty } from "../state.js";
import {
  applyUpdatePlan,
  createUpdateLogger,
  determineUpdatePlan,
  formatUpdateSummary,
  loadUpdateManifest,
  recordUpdateResult,
  summarizeUpdateHistory,
} from "../update.js";

function ensureState(state) {
  if (!state.tokens || typeof state.tokens !== "object") {
    state.tokens = {};
  }
  if (!Array.isArray(state.updateHistory)) {
    state.updateHistory = [];
  }
  if (typeof state.updateChannel !== "string") {
    state.updateChannel = "stable";
  }
  if (!("lastUpdateCheck" in state)) {
    state.lastUpdateCheck = null;
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
      const historySummary = summarizeUpdateHistory(state);
      if (historySummary) {
        stdio.stdout.write(`\n${historySummary}\n`);
      }
    },
  });

  register({
    name: "update",
    description: "Check for CLI updates",
    async run({ context, rawArgs }) {
      ensureState(state);
      const stdio = {
        stdout: context.stdout ?? process.stdout,
        stderr: context.stderr ?? process.stderr,
      };
      const args = parseArgs({
        args: rawArgs ?? [],
        allowPositionals: true,
        strict: false,
        options: {
          channel: { type: "string" },
          manifest: { type: "string" },
          "dry-run": { type: "boolean" },
        },
      });
      const channel = args.values.channel ?? state.updateChannel ?? "stable";
      const manifestPath =
        args.values.manifest ??
        process.env.CLAUDE_CODE_UPDATE_MANIFEST ??
        state.updateManifestPath ??
        null;
      let manifest;
      try {
        manifest = await loadUpdateManifest({
          manifestPath,
          defaultManifest: state.updateManifest,
          cwd: context.cwd ?? process.cwd(),
        });
      } catch (error) {
        stdio.stderr.write(`${error.message}\n`);
        recordUpdateResult(state, {
          plan: {
            status: "manifest-error",
            targetVersion: null,
            channel,
          },
          applied: false,
          skipped: true,
          completedAt: new Date().toISOString(),
        });
        return;
      }
      const plan = determineUpdatePlan({
        currentVersion: version ?? "0.0.0",
        manifest,
        channel,
      });
      stdio.stdout.write(`${formatUpdateSummary(plan)}\n`);
      state.updateChannel = channel;
      const dryRun = args.values["dry-run"] === true;
      let result;
      if (dryRun || plan.status !== "update-available") {
        const timestamp = new Date().toISOString();
        result = {
          plan,
          applied: false,
          skipped: true,
          completedAt: timestamp,
        };
        if (dryRun && plan.status === "update-available") {
          stdio.stdout.write("Dry run: update not applied.\n");
        }
      } else {
        const logger = createUpdateLogger({ stdout: stdio.stdout });
        result = await applyUpdatePlan(plan, {
          logger,
          download: async (context) => ({
            artifact: context.release?.url ?? null,
            checksum: context.release?.checksum ?? null,
          }),
          install: async () => ({
            restarted: false,
          }),
        });
      }
      recordUpdateResult(state, result);
      const historySummary = summarizeUpdateHistory(state);
      if (historySummary) {
        stdio.stdout.write(`\n${historySummary}\n`);
      }
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
