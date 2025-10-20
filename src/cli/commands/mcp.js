import { markDirty } from "../state.js";

function ensureState(state) {
  if (!state.mcpServers || typeof state.mcpServers !== "object") {
    state.mcpServers = {};
  }
  return state;
}

function formatTable(rows) {
  if (rows.length === 0) {
    return "(no entries)";
  }
  const widths = rows[0].map((_, columnIndex) =>
    Math.max(...rows.map((row) => String(row[columnIndex]).length))
  );
  return rows
    .map((row) =>
      row
        .map((value, index) => String(value).padEnd(widths[index]))
        .join("  ")
    )
    .join("\n");
}

function normalizeFlags(tokens = []) {
  const flags = {};
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token?.startsWith("--")) continue;
    const key = token.slice(2);
    const next = tokens[index + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
      continue;
    }
    flags[key] = next;
    index += 1;
  }
  return flags;
}

function validatePermission(permission) {
  if (!permission) return "default";
  const normalised = permission.toLowerCase();
  if (!["default", "read-only", "bypass"].includes(normalised)) {
    throw new Error(
      `Invalid permission mode '${permission}'. Expected default, read-only, or bypass.`
    );
  }
  return normalised;
}

export function registerMcpCommands(register, { state = {} } = {}) {
  register({
    name: "mcp",
    description: "Manage Model Context Protocol servers",
    async run({ positionals, context, rawArgs }) {
      ensureState(state);
      const stdio = {
        stdin: context.stdin ?? process.stdin,
        stdout: context.stdout ?? process.stdout,
        stderr: context.stderr ?? process.stderr,
      };
      const tokens = Array.isArray(rawArgs) && rawArgs.length > 0 ? rawArgs : positionals;
      const [subcommand = "list", ...rest] = tokens;
      switch (subcommand) {
        case "list": {
          const entries = Object.entries(state.mcpServers);
          const rows = [["Name", "URL", "Permission", "Description"]];
          for (const [name, info] of entries.sort(([a], [b]) => a.localeCompare(b))) {
            rows.push([
              name,
              info.url ?? "",
              info.permission ?? "default",
              info.description ?? "",
            ]);
          }
          stdio.stdout.write(`${formatTable(rows)}\n`);
          return;
        }
        case "add": {
          if (rest.length === 0) {
            stdio.stderr.write(
              "Usage: claude mcp add <name> --url <url> [--description <text>] [--permission <mode>]\n"
            );
            return;
          }
          const [name, ...flagSegments] = rest;
          const flags = normalizeFlags(flagSegments);
          const url = flags.url;
          if (!name || !url) {
            stdio.stderr.write(
              "Usage: claude mcp add <name> --url <url> [--description <text>] [--permission <mode>]\n"
            );
            return;
          }
          const permission = validatePermission(flags.permission);
          state.mcpServers[name] = {
            url,
            description: flags.description ?? "",
            permission,
          };
          markDirty(state);
          stdio.stdout.write(`Added MCP server '${name}'.\n`);
          return;
        }
        case "remove": {
          const [name] = rest;
          if (!name) {
            stdio.stderr.write("Usage: claude mcp remove <name>\n");
            return;
          }
          if (state.mcpServers[name]) {
            delete state.mcpServers[name];
            markDirty(state);
            stdio.stdout.write(`Removed MCP server '${name}'.\n`);
          } else {
            stdio.stderr.write(`No MCP server named '${name}'.\n`);
          }
          return;
        }
        case "show": {
          const [name] = rest;
          if (!name) {
            stdio.stderr.write("Usage: claude mcp show <name>\n");
            return;
          }
          const info = state.mcpServers[name];
          if (!info) {
            stdio.stderr.write(`No MCP server named '${name}'.\n`);
            return;
          }
          const details = [`Name: ${name}`, `URL: ${info.url}`];
          details.push(`Permission: ${info.permission ?? "default"}`);
          if (info.description) {
            details.push(`Description: ${info.description}`);
          }
          stdio.stdout.write(`${details.join("\n")}\n`);
          return;
        }
        default: {
          stdio.stderr.write(`Unknown mcp subcommand: ${subcommand}\n`);
        }
      }
    },
  });
}
