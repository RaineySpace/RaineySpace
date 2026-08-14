import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";

const publicDir = path.join(process.cwd(), "public");
const projectsPath = path.join(process.cwd(), "content", "projects.json");
const requiredFields = ["title", "date", "summary"];
const booleanFields = ["hidden", "pinned", "photography"];
const reservedSlugs = new Set(["articles", "assets", "photography", "projects"]);
const deprecatedProjectFields = [
  "project",
  "projectUrl",
  "projectName",
  "projectDescription",
  "projectCover",
  "sourceUrl",
];
const allowedProjectFields = new Set([
  "name",
  "url",
  "description",
  "cover",
  "sourceUrl",
  "pinned",
]);

function isLocalReference(value) {
  return value && !/^(https?:)?\/\//.test(value) && !value.startsWith("data:");
}

function isValidDate(value) {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(String(value));
  return !Number.isNaN(date.getTime());
}

function isHttpUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isHttpsUrl(value) {
  try {
    return new URL(String(value)).protocol === "https:";
  } catch {
    return false;
  }
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeProjectUrl(value) {
  if (!isHttpUrl(value)) return null;
  const url = new URL(String(value));
  url.hash = "";
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

function resolvePublicAsset(value) {
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

function normalizeRelativeImagePath(value) {
  const href = String(value).trim().split(/[?#]/, 1)[0];
  if (
    !href ||
    href.startsWith("/") ||
    href.startsWith("//") ||
    href.includes("\\") ||
    /^[a-z][a-z\d+.-]*:/i.test(href)
  ) {
    return null;
  }

  let decodedHref;
  try {
    decodedHref = decodeURIComponent(href);
  } catch {
    return null;
  }

  if (decodedHref.includes("\\") || decodedHref.split("/").includes("..")) return null;
  const normalized = path.posix.normalize(decodedHref).replace(/^\.\//, "");
  return normalized && normalized !== "." ? normalized : null;
}

function extractImageTokens(content) {
  const images = [];

  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    if (value.type === "image") {
      images.push({ href: String(value.href || ""), alt: String(value.text || "").trim() });
      return;
    }
    Object.values(value).forEach(visit);
  };

  visit(marked.lexer(content));
  return images;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function validateProjectRegistry(errors) {
  let registry;
  try {
    registry = JSON.parse(await fs.readFile(projectsPath, "utf8"));
  } catch (error) {
    errors.push(`content/projects.json: cannot be read as JSON (${error.message})`);
    return new Set();
  }

  if (!isPlainObject(registry)) {
    errors.push("content/projects.json: root value must be an object keyed by project ID");
    return new Set();
  }

  const projectIds = new Set(Object.keys(registry));
  const urls = new Map();

  for (const [projectId, definition] of Object.entries(registry)) {
    const prefix = `content/projects.json:${projectId}`;
    if (!projectId.trim()) errors.push(`${prefix}: project ID must not be empty`);
    if (!isPlainObject(definition)) {
      errors.push(`${prefix}: project definition must be an object`);
      continue;
    }

    for (const field of Object.keys(definition)) {
      if (!allowedProjectFields.has(field)) errors.push(`${prefix}: unknown field "${field}"`);
    }

    for (const field of ["name", "url"]) {
      if (typeof definition[field] !== "string" || !definition[field].trim()) {
        errors.push(`${prefix}: "${field}" must be a non-empty string`);
      }
    }

    if (typeof definition.url === "string" && definition.url.trim()) {
      const normalizedUrl = normalizeProjectUrl(definition.url);
      if (!normalizedUrl) {
        errors.push(`${prefix}: invalid HTTP(S) url "${definition.url}"`);
      } else if (urls.has(normalizedUrl)) {
        errors.push(`${prefix}: url duplicates project "${urls.get(normalizedUrl)}"`);
      } else {
        urls.set(normalizedUrl, projectId);
      }
    }

    for (const field of ["description", "sourceUrl"]) {
      if (definition[field] !== undefined && (typeof definition[field] !== "string" || !definition[field].trim())) {
        errors.push(`${prefix}: "${field}" must be a non-empty string when provided`);
      }
    }
    if (definition.sourceUrl !== undefined && !isHttpUrl(definition.sourceUrl)) {
      errors.push(`${prefix}: invalid sourceUrl "${definition.sourceUrl}"`);
    }

    if (definition.cover !== undefined) {
      if (typeof definition.cover !== "string" || !definition.cover.trim()) {
        errors.push(`${prefix}: "cover" must be a non-empty string when provided`);
      } else if (!isHttpsUrl(definition.cover)) {
        const coverPath = resolvePublicAsset(definition.cover);
        if (!coverPath) {
          errors.push(`${prefix}: cover must be an HTTPS URL or a site-absolute public path`);
        } else if (!(await exists(coverPath))) {
          errors.push(`${prefix}: missing cover asset ${definition.cover}`);
        }
      }
    }

    if (definition.pinned !== undefined && typeof definition.pinned !== "boolean") {
      errors.push(`${prefix}: "pinned" must be a boolean`);
    }
  }

  return projectIds;
}

async function main() {
  const entries = await fs.readdir(publicDir, { withFileTypes: true });
  const slugs = entries
    .filter((entry) => entry.isDirectory() && entry.name !== "assets")
    .map((entry) => entry.name);
  const seen = new Set();
  const errors = [];
  const warnings = [];
  const projectIds = await validateProjectRegistry(errors);
  const referencedProjectIds = new Set();
  let photographyCount = 0;
  let projectArticleCount = 0;
  let photoCount = 0;

  for (const slug of slugs) {
    if (reservedSlugs.has(slug)) errors.push(`${slug}: reserved route cannot be used as a post slug`);
    if (seen.has(slug)) errors.push(`${slug}: duplicate slug`);
    seen.add(slug);

    const postDir = path.join(publicDir, slug);
    const filePath = path.join(postDir, "index.md");
    if (!(await exists(filePath))) {
      errors.push(`${slug}: missing index.md`);
      continue;
    }

    const fileContents = await fs.readFile(filePath, "utf8");
    const { data, content } = matter(fileContents);
    const participatesInAList = !data.hidden || data.photography === true || data.projectId !== undefined;

    if (participatesInAList) {
      for (const field of requiredFields) {
        if (!data[field]) errors.push(`${slug}: missing required frontmatter "${field}"`);
      }
    }

    for (const field of booleanFields) {
      if (data[field] !== undefined && typeof data[field] !== "boolean") {
        errors.push(`${slug}: frontmatter "${field}" must be a boolean`);
      }
    }

    for (const field of deprecatedProjectFields) {
      if (data[field] !== undefined) {
        errors.push(`${slug}: frontmatter "${field}" is deprecated; reference a registered project with "projectId"`);
      }
    }

    if (data.projectId !== undefined) {
      if (typeof data.projectId !== "string" || !data.projectId.trim()) {
        errors.push(`${slug}: frontmatter "projectId" must be a non-empty string`);
      } else {
        const projectId = data.projectId.trim();
        projectArticleCount += 1;
        referencedProjectIds.add(projectId);
        if (!projectIds.has(projectId)) {
          errors.push(`${slug}: unknown projectId "${projectId}"`);
        }
      }
    }

    if (data.date && !isValidDate(data.date)) errors.push(`${slug}: invalid date "${data.date}"`);
    if (data.location !== undefined && typeof data.location !== "string") {
      errors.push(`${slug}: frontmatter "location" must be a string`);
    }
    if (data.cover && isLocalReference(String(data.cover))) {
      const coverPath = path.resolve(postDir, String(data.cover));
      if (!(await exists(coverPath))) warnings.push(`${slug}: missing cover asset ${data.cover}`);
    }

    const imageTokens = extractImageTokens(content);
    const validPhotographyImages = [];
    const seenPhotographyImages = new Set();

    for (const image of imageTokens) {
      const relativePath = normalizeRelativeImagePath(image.href);
      if (!relativePath) {
        if (data.photography && isLocalReference(image.href)) {
          errors.push(`${slug}: photography image must stay inside its post directory: ${image.href}`);
        }
        continue;
      }

      const imagePath = path.join(postDir, relativePath);
      const imageExists = await exists(imagePath);
      if (!imageExists) {
        const message = `${slug}: missing image asset ${image.href}`;
        if (data.photography) errors.push(message);
        else warnings.push(message);
        continue;
      }

      if (data.photography && !seenPhotographyImages.has(relativePath)) {
        seenPhotographyImages.add(relativePath);
        validPhotographyImages.push(image);
        if (!image.alt) errors.push(`${slug}: photography image must have non-empty alt text: ${image.href}`);
      }
    }

    if (data.photography) {
      photographyCount += 1;
      photoCount += validPhotographyImages.length;
      if (validPhotographyImages.length === 0) {
        errors.push(`${slug}: photography post must contain at least one valid local Markdown image`);
      }
    }
  }

  for (const projectId of projectIds) {
    if (!referencedProjectIds.has(projectId)) {
      errors.push(`content/projects.json:${projectId}: project is not referenced by any post`);
    }
  }

  warnings.forEach((warning) => console.warn(`WARN ${warning}`));
  if (errors.length > 0) {
    errors.forEach((error) => console.error(`ERROR ${error}`));
    process.exit(1);
  }

  console.log(
    `Content validation passed for ${slugs.length} posts, ${photographyCount} photography posts (${photoCount} photos), and ${projectIds.size} projects referenced by ${projectArticleCount} posts with ${warnings.length} warning(s).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
