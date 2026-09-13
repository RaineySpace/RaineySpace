import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";

export function normalizeRelativeAssetPath(value) {
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
  if (!normalized || normalized === "." || normalized === ".." || normalized.startsWith("../")) {
    return null;
  }
  return normalized;
}

export function toSiteAbsoluteAssetPath(href, slug) {
  const relativePath = normalizeRelativeAssetPath(href);
  if (!relativePath) return null;
  return `/${[slug, ...relativePath.split("/")].map(encodeURIComponent).join("/")}`;
}

function collectRelativeHrefs(source) {
  const hrefs = new Set();
  const { data, content } = matter(source);
  if (data.cover) hrefs.add(String(data.cover).trim());

  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    if ((value.type === "image" || value.type === "link") && typeof value.href === "string") {
      hrefs.add(value.href);
    }
    Object.values(value).forEach(visit);
  };

  visit(marked.lexer(content));
  return hrefs;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceAssetHref(source, href, next) {
  const escaped = escapeRegExp(href);
  return source
    .replace(new RegExp(`^(cover:\\s*)(['"]?)${escaped}\\2\\s*$`, "m"), `$1$2${next}$2`)
    .replace(new RegExp(`\\]\\(<${escaped}>\\)`, "g"), `](<${next}>)`)
    .replace(new RegExp(`\\]\\(${escaped}\\)`, "g"), `](${next})`)
    .replace(new RegExp(`<${escaped}>`, "g"), `<${next}>`);
}

export function rewritePublishedMarkdown(source, slug) {
  const replacements = [];

  for (const href of collectRelativeHrefs(source)) {
    const next = toSiteAbsoluteAssetPath(href, slug);
    if (next && next !== href) replacements.push({ href, next });
  }

  replacements.sort((left, right) => right.href.length - left.href.length);

  return replacements.reduce(
    (output, { href, next }) => replaceAssetHref(output, href, next),
    source,
  );
}
