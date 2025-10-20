import fs from "node:fs/promises";
import path from "node:path";

import { markDirty } from "./state.js";

function toSemverParts(version = "0.0.0") {
  const [main = "0.0.0", preRelease = ""] = String(version).split("-");
  const [major = "0", minor = "0", patch = "0"] = main.split(".");
  const numeric = (value) => Number.parseInt(value, 10) || 0;
  return {
    major: numeric(major),
    minor: numeric(minor),
    patch: numeric(patch),
    preRelease: preRelease || null,
  };
}

export function compareVersions(a, b) {
  const left = toSemverParts(a);
  const right = toSemverParts(b);
  if (left.major !== right.major) {
    return Math.sign(left.major - right.major);
  }
  if (left.minor !== right.minor) {
    return Math.sign(left.minor - right.minor);
  }
  if (left.patch !== right.patch) {
    return Math.sign(left.patch - right.patch);
  }
  if (left.preRelease && !right.preRelease) {
    return -1;
  }
  if (!left.preRelease && right.preRelease) {
    return 1;
  }
  if (!left.preRelease && !right.preRelease) {
    return 0;
  }
  if (left.preRelease === right.preRelease) {
    return 0;
  }
  return left.preRelease < right.preRelease ? -1 : 1;
}

function normalizeReleases(manifest = {}) {
  if (Array.isArray(manifest)) {
    return manifest;
  }
  if (Array.isArray(manifest.releases)) {
    return manifest.releases;
  }
  if (manifest.version) {
    return [manifest];
  }
  return [];
}

export async function loadUpdateManifest({
  manifestPath,
  defaultManifest,
  cwd = process.cwd(),
} = {}) {
  if (defaultManifest) {
    return defaultManifest;
  }
  if (!manifestPath) {
    throw new Error(
      "An update manifest path must be provided via --manifest or CLAUDE_CODE_UPDATE_MANIFEST"
    );
  }
  const resolved = path.isAbsolute(manifestPath)
    ? manifestPath
    : path.resolve(cwd, manifestPath);
  const contents = await fs.readFile(resolved, "utf8");
  try {
    const parsed = JSON.parse(contents);
    parsed.__source = resolved;
    return parsed;
  } catch (error) {
    throw new Error(`Update manifest ${resolved} is not valid JSON`, {
      cause: error,
    });
  }
}

export function selectRelease(manifest, {
  channel = "stable",
  fallbackChannel = "stable",
} = {}) {
  const releases = normalizeReleases(manifest);
  if (releases.length === 0) {
    return null;
  }
  const candidates = releases.filter((release) => {
    if (!release || typeof release !== "object") {
      return false;
    }
    if (channel && release.channel) {
      return release.channel === channel;
    }
    return true;
  });
  if (candidates.length > 0) {
    return candidates.reduce((latest, current) =>
      compareVersions(latest.version, current.version) >= 0 ? latest : current
    );
  }
  if (!fallbackChannel || fallbackChannel === channel) {
    return null;
  }
  return selectRelease(manifest, { channel: fallbackChannel, fallbackChannel: null });
}

export function determineUpdatePlan({
  currentVersion = "0.0.0",
  manifest,
  channel = "stable",
  fallbackChannel = "stable",
} = {}) {
  if (!manifest) {
    return {
      status: "no-manifest",
      currentVersion,
      message: "No update manifest available.",
    };
  }
  const release = selectRelease(manifest, { channel, fallbackChannel });
  if (!release) {
    return {
      status: "no-release",
      currentVersion,
      channel,
      message: `No releases found for channel '${channel}'.`,
    };
  }
  const comparison = compareVersions(release.version, currentVersion);
  if (comparison <= 0) {
    return {
      status: "up-to-date",
      currentVersion,
      channel,
      targetVersion: release.version,
      message: `Already running the latest ${channel} release (${currentVersion}).`,
      release,
    };
  }
  return {
    status: "update-available",
    currentVersion,
    channel,
    targetVersion: release.version,
    release,
    message: `Update available: ${currentVersion} → ${release.version} (${channel}).`,
  };
}

export function formatUpdateSummary(plan) {
  if (!plan) {
    return "No update information available.";
  }
  const lines = [plan.message ?? ""];
  if (plan.release?.notes) {
    lines.push("", plan.release.notes.trim());
  }
  if (plan.release?.url) {
    lines.push("", `Download: ${plan.release.url}`);
  }
  return lines.filter(Boolean).join("\n");
}

export async function applyUpdatePlan(plan, {
  download,
  install,
  logger = () => {},
  now = () => new Date(),
} = {}) {
  if (!plan || plan.status !== "update-available") {
    return {
      plan,
      applied: false,
      skipped: true,
      completedAt: now().toISOString(),
    };
  }
  const context = {
    version: plan.targetVersion,
    channel: plan.channel,
    release: plan.release,
  };
  logger(`Preparing to download ${context.version} (${context.channel}).`);
  const downloadResult = download
    ? await download(context)
    : { artifact: null, checksum: null };
  logger(`Download complete. Applying update...`);
  const installResult = install ? await install(context, downloadResult) : {};
  logger(`Update to ${context.version} applied successfully.`);
  return {
    plan,
    applied: true,
    skipped: false,
    completedAt: now().toISOString(),
    download: downloadResult,
    install: installResult,
  };
}

export function recordUpdateResult(state, result) {
  if (!state) {
    return;
  }
  if (!Array.isArray(state.updateHistory)) {
    state.updateHistory = [];
  }
  state.updateHistory.push({
    status: result?.plan?.status ?? "unknown",
    applied: Boolean(result?.applied),
    skipped: Boolean(result?.skipped),
    version: result?.plan?.targetVersion ?? null,
    channel: result?.plan?.channel ?? null,
    completedAt: result?.completedAt ?? new Date().toISOString(),
  });
  state.lastUpdateCheck = result?.completedAt ?? new Date().toISOString();
  markDirty(state);
}

export function createUpdateLogger({ stdout = process.stdout } = {}) {
  return function log(message) {
    if (message) {
      stdout.write(`${message}\n`);
    }
  };
}

export function summarizeUpdateHistory(state = {}) {
  if (!Array.isArray(state.updateHistory) || state.updateHistory.length === 0) {
    return "No updates have been applied yet.";
  }
  const lines = ["Update history:"];
  for (const entry of state.updateHistory.slice(-10)) {
    const status = entry.applied ? "applied" : entry.skipped ? "skipped" : "unknown";
    const timestamp = entry.completedAt ?? "unknown time";
    const version = entry.version ?? "unknown version";
    const channel = entry.channel ? ` (${entry.channel})` : "";
    lines.push(`- ${timestamp}: ${status} ${version}${channel}`);
  }
  return lines.join("\n");
}
