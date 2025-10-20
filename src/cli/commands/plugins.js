import { parseArgs } from "node:util";

import { markDirty } from "../state.js";

function ensurePluginState(state) {
  if (!state.plugins || typeof state.plugins !== "object") {
    state.plugins = {};
  }
  if (!state.pluginMarketplace || typeof state.pluginMarketplace !== "object") {
    state.pluginMarketplace = {};
  }
  return state;
}

function formatPlugin(name, info) {
  const version = info.version ? `@${info.version}` : "";
  const enabled = info.enabled === false ? " (disabled)" : "";
  return `${name}${version}${enabled}`;
}

function runMarketplace(tokens, state, stdio) {
  const [subcommand = "list", ...rest] = tokens;
  switch (subcommand) {
    case "list": {
      const entries = Object.entries(state.pluginMarketplace);
      if (entries.length === 0) {
        stdio.stdout.write("Marketplace is empty.\n");
        return;
      }
      for (const [name, info] of entries.sort(([a], [b]) => a.localeCompare(b))) {
        stdio.stdout.write(`- ${name} (${info.url})\n`);
      }
      return;
    }
    case "add": {
      const [name, url] = rest;
      if (!name || !url) {
        stdio.stderr.write("Usage: claude plugin marketplace add <name> <url>\n");
        return;
      }
      state.pluginMarketplace[name] = { url };
      markDirty(state);
      stdio.stdout.write(`Added marketplace entry '${name}'.\n`);
      return;
    }
    case "remove": {
      const [name] = rest;
      if (!name) {
        stdio.stderr.write("Usage: claude plugin marketplace remove <name>\n");
        return;
      }
      if (state.pluginMarketplace[name]) {
        delete state.pluginMarketplace[name];
        markDirty(state);
        stdio.stdout.write(`Removed marketplace entry '${name}'.\n`);
      } else {
        stdio.stderr.write(`No marketplace entry named '${name}'.\n`);
      }
      return;
    }
    case "update": {
      const [name, url] = rest;
      if (!name || !url) {
        stdio.stderr.write("Usage: claude plugin marketplace update <name> <url>\n");
        return;
      }
      if (!state.pluginMarketplace[name]) {
        stdio.stderr.write(`No marketplace entry named '${name}'.\n`);
        return;
      }
      state.pluginMarketplace[name].url = url;
      markDirty(state);
      stdio.stdout.write(`Updated marketplace entry '${name}'.\n`);
      return;
    }
    default: {
      stdio.stderr.write(`Unknown marketplace subcommand: ${subcommand}\n`);
    }
  }
}

export function registerPluginCommands(register, { state = {} } = {}) {
  register({
    name: "plugin",
    description: "Manage Claude Code plugins",
    async run({ positionals, context, rawArgs }) {
      ensurePluginState(state);
      const stdio = {
        stdin: context.stdin ?? process.stdin,
        stdout: context.stdout ?? process.stdout,
        stderr: context.stderr ?? process.stderr,
      };
      const tokens = Array.isArray(rawArgs) && rawArgs.length > 0 ? rawArgs : positionals;
      const [subcommand = "list", ...rest] = tokens;
      if (subcommand === "marketplace") {
        runMarketplace(rest, state, stdio);
        return;
      }
      switch (subcommand) {
        case "list": {
          const entries = Object.entries(state.plugins);
          if (entries.length === 0) {
            stdio.stdout.write("No plugins installed.\n");
            return;
          }
          for (const [name, info] of entries.sort(([a], [b]) => a.localeCompare(b))) {
            stdio.stdout.write(`- ${formatPlugin(name, info)}\n`);
          }
          return;
        }
        case "validate": {
          const [name] = rest;
          if (!name) {
            stdio.stderr.write("Usage: claude plugin validate <name>\n");
            return;
          }
          const plugin = state.plugins[name];
          if (!plugin) {
            stdio.stderr.write(`No plugin named '${name}'.\n`);
            return;
          }
          const issues = [];
          if (!plugin.version) {
            issues.push("Missing version field.");
          }
          if (plugin.source && !plugin.source.startsWith("http")) {
            issues.push("Source should be a URL when provided.");
          }
          if (plugin.enabled === false && !plugin.disabledAt) {
            issues.push("Disabled plugins should include a disabledAt timestamp.");
          }
          if (issues.length === 0) {
            stdio.stdout.write(`Plugin '${name}' looks healthy.\n`);
          } else {
            stdio.stderr.write(`Plugin '${name}' has issues:\n`);
            for (const issue of issues) {
              stdio.stderr.write(`- ${issue}\n`);
            }
          }
          return;
        }
        case "install": {
          const { values, positionals: args } = parseArgs({
            args: rest,
            allowPositionals: true,
            strict: false,
            options: {
              version: { type: "string" },
              source: { type: "string" },
            },
          });
          const [name] = args;
          if (!name) {
            stdio.stderr.write(
              "Usage: claude plugin install <name> [--version <semver>] [--source <url>]\n"
            );
            return;
          }
          state.plugins[name] = {
            version: values.version ?? "latest",
            enabled: true,
            source: values.source ?? null,
            installedAt: new Date().toISOString(),
            disabledAt: null,
          };
          markDirty(state);
          stdio.stdout.write(`Installed plugin '${name}'.\n`);
          return;
        }
        case "uninstall": {
          const [name] = rest;
          if (!name) {
            stdio.stderr.write("Usage: claude plugin uninstall <name>\n");
            return;
          }
          if (state.plugins[name]) {
            delete state.plugins[name];
            markDirty(state);
            stdio.stdout.write(`Uninstalled plugin '${name}'.\n`);
          } else {
            stdio.stderr.write(`No plugin named '${name}'.\n`);
          }
          return;
        }
        case "enable":
        case "disable": {
          const [name] = rest;
          if (!name) {
            stdio.stderr.write(`Usage: claude plugin ${subcommand} <name>\n`);
            return;
          }
          const plugin = state.plugins[name];
          if (!plugin) {
            stdio.stderr.write(`No plugin named '${name}'.\n`);
            return;
          }
          plugin.enabled = subcommand === "enable";
          plugin.modifiedAt = new Date().toISOString();
          if (subcommand === "disable") {
            plugin.disabledAt = new Date().toISOString();
          } else {
            delete plugin.disabledAt;
          }
          markDirty(state);
          stdio.stdout.write(
            `${subcommand === "enable" ? "Enabled" : "Disabled"} plugin '${name}'.\n`
          );
          return;
        }
        case "info": {
          const [name] = rest;
          if (!name) {
            stdio.stderr.write("Usage: claude plugin info <name>\n");
            return;
          }
          const plugin = state.plugins[name];
          if (!plugin) {
            stdio.stderr.write(`No plugin named '${name}'.\n`);
            return;
          }
          const details = [`Name: ${name}`];
          if (plugin.version) details.push(`Version: ${plugin.version}`);
          details.push(`Enabled: ${plugin.enabled !== false}`);
          if (plugin.source) details.push(`Source: ${plugin.source}`);
          if (plugin.installedAt) details.push(`Installed: ${plugin.installedAt}`);
          if (plugin.modifiedAt) details.push(`Updated: ${plugin.modifiedAt}`);
          stdio.stdout.write(`${details.join("\n")}\n`);
          return;
        }
        default: {
          stdio.stderr.write(`Unknown plugin subcommand: ${subcommand}\n`);
        }
      }
    },
  });
}
