import fs from "node:fs";
import path from "node:path";

export const PROJECT_KIND = "project";
export const FRIEND_KIND = "friend";

const KIND_CONFIG = {
  project: {
    file: "content/projects.json",
    label: "project",
  },
  friend: {
    file: "content/friends.json",
    label: "friend",
  },
};

const ENTITY_FIELDS = new Set(["name", "title", "url", "date", "description", "icon", "pinned", "extensions"]);

export function registryFile(kind) {
  const config = KIND_CONFIG[kind];
  if (!config) throw new Error(`Unknown registry kind "${kind}"`);
  return config.file;
}

export function registryPath(kind, cwd = process.cwd()) {
  return path.join(cwd, registryFile(kind));
}

export function isPlainObject(value) {
  return !!value && typeof value === "object" &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function isJsonValue(value, ancestors = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if ((!Array.isArray(value) && !isPlainObject(value)) || ancestors.has(value)) return false;
  ancestors.add(value);
  const valid = Object.values(value).every((child) => isJsonValue(child, ancestors));
  ancestors.delete(value);
  return valid;
}

export function isHttpUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isHttpsUrl(value) {
  try {
    return new URL(String(value)).protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeHttpUrl(value) {
  if (!isHttpUrl(value)) return null;
  const url = new URL(String(value));
  url.hash = "";
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

export function parseDateText(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
  const text = value.trim();
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) return null;
  return date;
}

export function formatDateText(date) {
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function resolvePublicAsset(value, publicDir = path.join(process.cwd(), "public")) {
  const href = String(value).trim().split(/[?#]/, 1)[0];
  if (!href.startsWith("/") || href.startsWith("//") || href.includes("\\")) return null;

  let decodedHref;
  try {
    decodedHref = decodeURIComponent(href);
  } catch {
    return null;
  }

  if (decodedHref.includes("\\") || decodedHref.split("/").includes("..")) return null;
  const normalized = path.posix.normalize(decodedHref);
  if (normalized === "/" || !normalized.startsWith("/")) return null;
  return path.join(publicDir, normalized.slice(1));
}

/** @param {import("./entities").Entity} a @param {import("./entities").Entity} b */
export function compareEntities(a, b) {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  const dateA = a.date ? a.date.getTime() : 0;
  const dateB = b.date ? b.date.getTime() : 0;
  if (dateA !== dateB) return dateB - dateA;
  return a.id.localeCompare(b.id);
}

/** @template {import("./entities").Entity} T @param {T[]} entities @returns {T[]} */
export function sortEntities(entities) {
  return [...entities].sort(compareEntities);
}

/**
 * @template {import("./entities").EntityKind} Kind
 * @param {Kind} kind
 * @param {unknown} raw
 * @param {{file?: string, publicDir?: string}} [options]
 */
export function parseRegistry(kind, raw, options = {}) {
  const config = KIND_CONFIG[kind];
  if (!config) throw new Error(`Unknown registry kind "${kind}"`);

  const file = options.file || config.file;
  const publicDir = options.publicDir || path.join(process.cwd(), "public");
  const errors = [];
  /** @type {import("./entities").Entity<Kind>[]} */
  const entities = [];
  const localImages = [];
  const urls = new Map();

  if (!isPlainObject(raw)) {
    errors.push(`${file}: root value must be an object keyed by ${config.label} ID`);
    return { entities, errors, localImages };
  }

  for (const [id, definition] of Object.entries(raw)) {
    const prefix = `${file}:${id}`;
    if (!id.trim() || id !== id.trim() || /\s/.test(id)) {
      errors.push(`${prefix}: ${config.label} ID must not be empty or contain whitespace`);
    }
    if (!isPlainObject(definition)) {
      errors.push(`${prefix}: ${config.label} definition must be an object`);
      continue;
    }

    for (const field of Object.keys(definition)) {
      if (!ENTITY_FIELDS.has(field)) errors.push(`${prefix}: unknown field "${field}"; put kind-specific data in "extensions"`);
    }

    for (const field of ["name", "url"]) {
      if (typeof definition[field] !== "string" || !definition[field].trim()) {
        errors.push(`${prefix}: "${field}" must be a non-empty string`);
      }
    }

    const date = parseDateText(definition.date);
    if (!date) errors.push(`${prefix}: "date" must be a YYYY-MM-DD date`);

    if (typeof definition.url === "string" && definition.url.trim()) {
      const normalizedUrl = normalizeHttpUrl(definition.url);
      if (!normalizedUrl) {
        errors.push(`${prefix}: invalid HTTP(S) url "${definition.url}"`);
      } else if (urls.has(normalizedUrl)) {
        errors.push(`${prefix}: url duplicates ${config.label} "${urls.get(normalizedUrl)}"`);
      } else {
        urls.set(normalizedUrl, id);
      }
    }

    for (const field of ["title", "description"]) {
      if (definition[field] !== undefined && (typeof definition[field] !== "string" || !definition[field].trim())) {
        errors.push(`${prefix}: "${field}" must be a non-empty string when provided`);
      }
    }

    const imageValue = definition.icon;
    let icon;
    if (imageValue !== undefined) {
      if (typeof imageValue !== "string" || !imageValue.trim()) {
        errors.push(`${prefix}: "icon" must be a non-empty string when provided`);
      } else if (isHttpsUrl(imageValue)) {
        icon = imageValue.trim();
      } else {
        const assetPath = resolvePublicAsset(imageValue, publicDir);
        if (!assetPath) {
          errors.push(
            `${prefix}: icon must be an HTTPS URL or a site-absolute public path`,
          );
        } else {
          icon = imageValue.trim();
          localImages.push({ id, field: "icon", value: icon, path: assetPath });
        }
      }
    }

    if (definition.pinned !== undefined && typeof definition.pinned !== "boolean") {
      errors.push(`${prefix}: "pinned" must be a boolean`);
    }

    let extensions = {};
    if (definition.extensions !== undefined) {
      if (!isPlainObject(definition.extensions) || !isJsonValue(definition.extensions)) {
        errors.push(`${prefix}: "extensions" must be a JSON object`);
      } else {
        // Preserve per-kind data without allowing it to override shared fields.
        extensions = JSON.parse(JSON.stringify(definition.extensions));
      }
    }

    entities.push({
      id,
      kind,
      name: typeof definition.name === "string" ? definition.name.trim() : "",
      title: typeof definition.title === "string" ? definition.title.trim() : undefined,
      url: typeof definition.url === "string" ? definition.url.trim() : "",
      description:
        typeof definition.description === "string" && definition.description.trim()
          ? definition.description.trim()
          : undefined,
      icon,
      extensions,
      pinned: definition.pinned === true,
      date,
      dateText: formatDateText(date),
    });
  }

  return { entities: sortEntities(entities), errors, localImages };
}

export function readRegistryJson(kind, cwd = process.cwd()) {
  const file = registryFile(kind);
  const filePath = path.join(cwd, file);
  try {
    return { file, value: JSON.parse(fs.readFileSync(filePath, "utf8")) };
  } catch (error) {
    throw new Error(`${file}: cannot be read as JSON (${error.message})`);
  }
}

/** @template {import("./entities").EntityKind} Kind @param {Kind} kind */
export function loadEntities(kind, cwd = process.cwd()) {
  const { file, value } = readRegistryJson(kind, cwd);
  const { entities, errors } = parseRegistry(kind, value, {
    file,
    publicDir: path.join(cwd, "public"),
  });
  if (errors.length) throw new Error(errors.join("\n"));
  return entities;
}

export function loadRegistries(cwd = process.cwd()) {
  return {
    project: loadEntities(PROJECT_KIND, cwd),
    friend: loadEntities(FRIEND_KIND, cwd),
  };
}

/** @template {import("./entities").EntityKind} Kind @param {Kind} kind @param {string} id */
export function getEntityById(kind, id, cwd = process.cwd()) {
  if (!id) return null;
  const entity = loadEntities(kind, cwd).find((item) => item.id === id);
  if (!entity) {
    throw new Error(`Unknown ${kind} "${id}". Add it to ${registryFile(kind)}.`);
  }
  return entity;
}
