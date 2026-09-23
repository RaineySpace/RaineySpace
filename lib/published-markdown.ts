import { isPlainObject } from "./registry.ts";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import { expandDataRefsInMarkdown } from "./markdown-refs.ts";
import { loadRegistries } from "./registry.ts";

export function normalizeRelativeAssetPath(value: unknown) {
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

export function toSiteAbsoluteAssetPath(href: string, slug: string) {
  const relativePath = normalizeRelativeAssetPath(href);
  if (!relativePath) return null;
  return `/${[slug, ...relativePath.split("/")].map(encodeURIComponent).join("/")}`;
}

function collectRelativeHrefs(source: string) {
  const hrefs = new Set<string>();
  const { data, content } = matter(source);
  if (data.cover) hrefs.add(String(data.cover).trim());

  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!isPlainObject(value)) return;
    if ((value.type === "image" || value.type === "link") && typeof value.href === "string") {
      hrefs.add(value.href);
    }
    Object.values(value).forEach(visit);
  };

  visit(marked.lexer(content));
  return hrefs;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceAssetHref(source: string, href: string, next: string) {
  const escaped = escapeRegExp(href);
  return source
    .replace(new RegExp(`^(cover:\\s*)(['"]?)${escaped}\\2\\s*$`, "m"), `$1$2${next}$2`)
    .replace(new RegExp(`\\]\\(<${escaped}>\\)`, "g"), `](<${next}>)`)
    .replace(new RegExp(`\\]\\(${escaped}\\)`, "g"), `](${next})`)
    .replace(new RegExp(`<${escaped}>`, "g"), `<${next}>`);
}

export function rewritePublishedMarkdown(source: string, slug: string) {
  const expanded = expandDataRefsInMarkdown(source, loadRegistries(), slug);
  const replacements = [];

  for (const href of collectRelativeHrefs(expanded)) {
    const next = toSiteAbsoluteAssetPath(href, slug);
    if (next && next !== href) replacements.push({ href, next });
  }

  replacements.sort((left, right) => right.href.length - left.href.length);

  return replacements.reduce(
    (output, { href, next }) => replaceAssetHref(output, href, next),
    expanded,
  );
}
