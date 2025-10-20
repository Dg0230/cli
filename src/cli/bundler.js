import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeManifest(manifest = {}) {
  if (Array.isArray(manifest)) {
    return manifest.reduce((accumulator, entry) => {
      if (entry && typeof entry === "object" && entry.name && entry.path) {
        accumulator[entry.name] = entry.path;
      }
      return accumulator;
    }, {});
  }
  if (isObject(manifest)) {
    return manifest;
  }
  return {};
}

export async function readBundledManifest(manifestPath) {
  if (!manifestPath) {
    return {};
  }
  const resolvedPath = path.resolve(manifestPath);
  const contents = await fs.readFile(resolvedPath, "utf8");
  try {
    const parsed = JSON.parse(contents);
    const normalized = normalizeManifest(parsed);
    return { manifest: normalized, path: resolvedPath };
  } catch (error) {
    throw new Error(`Failed to parse bundler manifest at ${resolvedPath}`, {
      cause: error,
    });
  }
}

export function resolveBundledPath(specifier, {
  manifest = {},
  baseDir = process.cwd(),
  defaultExtension = ".js",
} = {}) {
  if (!specifier) {
    throw new Error("Bundled module specifier must be provided");
  }

  const normalized = normalizeManifest(manifest);
  const manifestEntry = normalized[specifier];
  if (manifestEntry) {
    const candidate = path.resolve(baseDir, manifestEntry);
    return candidate;
  }

  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const candidate = path.resolve(baseDir, specifier);
    return candidate;
  }

  if (specifier.startsWith("/")) {
    return specifier;
  }

  const fallback = path.resolve(baseDir, specifier);
  if (!path.extname(fallback) && defaultExtension) {
    return `${fallback}${defaultExtension}`;
  }
  return fallback;
}

async function ensureFileExists(resolvedPath) {
  try {
    await fs.access(resolvedPath);
    return resolvedPath;
  } catch (error) {
    throw new Error(`Bundled module not found: ${resolvedPath}`, { cause: error });
  }
}

export async function loadBundledModule(specifier, {
  manifest = {},
  baseDir = process.cwd(),
  defaultExtension = ".js",
} = {}) {
  const resolvedPath = resolveBundledPath(specifier, {
    manifest,
    baseDir,
    defaultExtension,
  });
  const filePath = await ensureFileExists(resolvedPath);
  const moduleUrl = pathToFileURL(filePath).href;
  return import(moduleUrl);
}

export function listBundledModules(manifest = {}) {
  const normalized = normalizeManifest(manifest);
  return Object.keys(normalized).sort();
}

export async function createBundledModuleLoader({
  manifest,
  manifestPath,
  baseDir = process.cwd(),
  defaultExtension = ".js",
} = {}) {
  let manifestData = normalizeManifest(manifest);
  let manifestLocation = null;
  if (!manifestData || Object.keys(manifestData).length === 0) {
    if (manifestPath) {
      const loaded = await readBundledManifest(manifestPath);
      manifestData = loaded.manifest;
      manifestLocation = loaded.path;
    } else {
      manifestData = {};
    }
  }

  async function importer(specifier) {
    return loadBundledModule(specifier, {
      manifest: manifestData,
      baseDir,
      defaultExtension,
    });
  }

  importer.manifest = manifestData;
  importer.baseDir = baseDir;
  importer.manifestPath = manifestLocation ?? (manifestPath ? path.resolve(manifestPath) : null);
  importer.list = () => listBundledModules(manifestData);

  return importer;
}

export function describeBundledModule(specifier, { manifest = {}, baseDir = process.cwd() } = {}) {
  const normalized = normalizeManifest(manifest);
  const entry = normalized[specifier];
  if (!entry) {
    return {
      specifier,
      resolvedPath: resolveBundledPath(specifier, { manifest, baseDir }),
      fromManifest: false,
    };
  }
  return {
    specifier,
    resolvedPath: path.resolve(baseDir, entry),
    fromManifest: true,
  };
}

export function createEsmLoaderContext(options = {}) {
  const loader = {
    async import(specifier) {
      return loadBundledModule(specifier, options);
    },
    resolve(specifier) {
      return resolveBundledPath(specifier, options);
    },
    list() {
      return listBundledModules(options.manifest ?? {});
    },
  };
  return loader;
}
