import fs from "node:fs";
import path from "node:path";

export const PROJECT_KIND = "project";
export const FRIEND_KIND = "friend";

const KIND_CONFIG = {
  project: {
    file: "content/projects.json",
    label: "project",
    imageField: "cover",
    allowedFields: new Set(["name", "url", "date", "description", "cover", "pinned"]),
  },
  friend: {
    file: "content/friends.json",
    label: "friend",
    imageField: "icon",
    allowedFields: new Set(["name", "url", "date", "description", "icon", "pinned"]),
  },
};

export function registryFile(kind) {
  const config = KIND_CONFIG[kind];
  if (!config) throw new Error(`Unknown registry kind "${kind}"`);
  return config.file;
}

export function registryPath(kind, cwd = process.cwd()) {
  return path.join(cwd, registryFile(kind));
}

export function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
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

export function compareEntities(a, b) {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  const dateA = a.date ? a.date.getTime() : 0;
  const dateB = b.date ? b.date.getTime() : 0;
  if (dateA !== dateB) return dateB - dateA;
  return a.id.localeCompare(b.id);
}

export function sortEntities(entities) {
  return [...entities].sort(compareEntities);
}

export function parseRegistry(kind, raw, options = {}) {
  const config = KIND_CONFIG[kind];
  if (!config) throw new Error(`Unknown registry kind "${kind}"`);

  const file = options.file || config.file;
  const publicDir = options.publicDir || path.join(process.cwd(), "public");
  const errors = [];
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
      if (!config.allowedFields.has(field)) errors.push(`${prefix}: unknown field "${field}"`);
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

    if (
      definition.description !== undefined &&
      (typeof definition.description !== "string" || !definition.description.trim())
    ) {
      errors.push(`${prefix}: "description" must be a non-empty string when provided`);
    }

    const imageValue = definition[config.imageField];
    let image;
    if (imageValue !== undefined) {
      if (typeof imageValue !== "string" || !imageValue.trim()) {
        errors.push(`${prefix}: "${config.imageField}" must be a non-empty string when provided`);
      } else if (isHttpsUrl(imageValue)) {
        image = imageValue.trim();
      } else {
        const assetPath = resolvePublicAsset(imageValue, publicDir);
        if (!assetPath) {
          errors.push(
            `${prefix}: ${config.imageField} must be an HTTPS URL or a site-absolute public path`,
          );
        } else {
          image = imageValue.trim();
          localImages.push({ id, field: config.imageField, value: image, path: assetPath });
        }
      }
    }

    if (definition.pinned !== undefined && typeof definition.pinned !== "boolean") {
      errors.push(`${prefix}: "pinned" must be a boolean`);
    }

    entities.push({
      id,
      kind,
      name: typeof definition.name === "string" ? definition.name.trim() : "",
      url: typeof definition.url === "string" ? definition.url.trim() : "",
      description:
        typeof definition.description === "string" && definition.description.trim()
          ? definition.description.trim()
          : undefined,
      image,
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

export function getEntityById(kind, id, cwd = process.cwd()) {
  if (!id) return null;
  const entity = loadEntities(kind, cwd).find((item) => item.id === id);
  if (!entity) {
    throw new Error(`Unknown ${kind} "${id}". Add it to ${registryFile(kind)}.`);
  }
  return entity;
}
