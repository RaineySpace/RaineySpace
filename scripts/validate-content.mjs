import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import exifr from "exifr";
import { parseUpdatedDate } from "../lib/post-dates.mjs";
import { parsePostOptions } from "../lib/post-options.mjs";
import { listPostSlugs, postAssetDir, postMarkdownPath } from "../lib/post-files.mjs";
import { collectDataRefErrors } from "../lib/markdown-refs.mjs";
import { parseRegistry, PROJECT_KIND, FRIEND_KIND, readRegistryJson, registryFile } from "../lib/registry.mjs";

const publicDir = path.join(process.cwd(), "public");
const requiredFields = ["title", "date", "summary"];
const booleanFields = ["hidden", "pinned", "photography"];
const reservedSlugs = new Set(["articles", "assets", "photography", "projects", "friends", "_optimized", "llms.txt", "robots.txt", "sitemap.xml", "rss.xml", "atom.xml"]);
const exifExtensions = new Set([".jpg", ".jpeg", ".tif", ".tiff", ".webp", ".heic"]);
const deprecatedProjectFields = [
  "projectId",
  "project",
  "projectUrl",
  "projectName",
  "projectDescription",
  "projectCover",
];

function isLocalReference(value) {
  return value && !/^(https?:)?\/\//.test(value) && !value.startsWith("data:");
}

function isValidDate(value) {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(String(value));
  return !Number.isNaN(date.getTime());
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

function assetStem(relativePath) {
  const parsed = path.posix.parse(relativePath);
  return path.posix.join(parsed.dir, parsed.name).replace(/^\//, "");
}

async function collectMovFiles(dir, base = "") {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) {
      files.push(...(await collectMovFiles(path.join(dir, entry.name), path.posix.join(base, entry.name))));
      continue;
    }
    if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".mov") {
      files.push(base ? path.posix.join(base, entry.name) : entry.name);
    }
  }

  return files;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function hasCaptureTime(filePath) {
  try {
    const parsed = await exifr.parse(filePath, {
      pick: ["DateTimeOriginal", "CreateDate"],
      reviveValues: true,
    });
    return Boolean(parsed?.DateTimeOriginal || parsed?.CreateDate);
  } catch {
    return false;
  }
}

async function validateRegistry(kind, errors) {
  let parsed;
  try {
    const { file, value } = readRegistryJson(kind);
    parsed = parseRegistry(kind, value, { file, publicDir });
  } catch (error) {
    errors.push(error.message);
    return [];
  }

  errors.push(...parsed.errors);
  for (const asset of parsed.localImages) {
    if (!(await exists(asset.path))) {
      errors.push(`${registryFile(kind)}:${asset.id}: missing ${asset.field} asset ${asset.value}`);
    }
  }
  return parsed.entities;
}

async function main() {
  const slugs = await listPostSlugs(publicDir);
  const seen = new Set();
  const errors = [];
  const warnings = [];
  const projects = await validateRegistry(PROJECT_KIND, errors);
  const friends = await validateRegistry(FRIEND_KIND, errors);
  const registries = { project: projects, friend: friends };
  let photographyCount = 0;
  let photoCount = 0;

  for (const slug of slugs) {
    if (reservedSlugs.has(slug)) errors.push(`${slug}: reserved route cannot be used as a post slug`);
    if (seen.has(slug)) errors.push(`${slug}: duplicate slug`);
    seen.add(slug);

    const postDir = postAssetDir(publicDir, slug);
    const filePath = postMarkdownPath(publicDir, slug);
    if (!(await exists(filePath))) {
      errors.push(`${slug}: missing index.md`);
      continue;
    }

    const fileContents = await fs.readFile(filePath, "utf8");
    const { data, content, matter: frontmatter } = matter(fileContents);
    try {
      parsePostOptions(data);
    } catch (error) {
      errors.push(`${slug}: ${error.message}`);
    }
    const participatesInAList = !data.hidden || data.photography === true;

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
        errors.push(`${slug}: frontmatter "${field}" is deprecated`);
      }
    }

    for (const error of collectDataRefErrors(content, registries)) {
      errors.push(`${slug}: ${error}`);
    }

    if (data.date && !isValidDate(data.date)) errors.push(`${slug}: invalid date "${data.date}"`);
    try {
      parseUpdatedDate(data.updated, isValidDate(data.date) ? new Date(data.date) : null, frontmatter);
    } catch (error) {
      errors.push(`${slug}: ${error.message}`);
    }
    if (data.location !== undefined && typeof data.location !== "string") {
      errors.push(`${slug}: frontmatter "location" must be a string`);
    }
    if (data.cover !== undefined) {
      if (typeof data.cover !== "string" || !data.cover.trim()) {
        errors.push(`${slug}: frontmatter "cover" must be a non-empty string when provided`);
      } else if (isLocalReference(data.cover)) {
        const coverPath = path.resolve(postDir, data.cover);
        if (!(await exists(coverPath))) warnings.push(`${slug}: missing cover asset ${data.cover}`);
      }
    }

    const imageTokens = extractImageTokens(content);
    const validPhotographyImages = [];
    const seenPhotographyImages = new Set();
    const imageStems = new Set();

    for (const image of imageTokens) {
      const relativePath = normalizeRelativeImagePath(image.href);
      if (!relativePath) {
        if (data.photography && isLocalReference(image.href)) {
          errors.push(`${slug}: photography image must stay inside its post directory: ${image.href}`);
        }
        continue;
      }

      const imagePath = path.join(postDir, relativePath);
      imageStems.add(assetStem(relativePath));
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
        const extension = path.extname(relativePath).toLowerCase();
        if (exifExtensions.has(extension) && !(await hasCaptureTime(imagePath))) {
          warnings.push(`${slug}: photography image is missing EXIF capture time: ${image.href}`);
        }
      }
    }

    if (await exists(postDir)) {
      for (const mov of await collectMovFiles(postDir)) {
        if (!imageStems.has(assetStem(mov))) {
          warnings.push(`${slug}: Live Photo video has no matching Markdown image: ${mov}`);
        }
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

  warnings.forEach((warning) => console.warn(`WARN ${warning}`));
  if (errors.length > 0) {
    errors.forEach((error) => console.error(`ERROR ${error}`));
    process.exit(1);
  }

  console.log(
    `Content validation passed for ${slugs.length} posts, ${photographyCount} photography posts (${photoCount} photos), ${projects.length} projects, and ${friends.length} friends with ${warnings.length} warning(s).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
