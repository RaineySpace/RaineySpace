import fs from "node:fs/promises";
import path from "node:path";

const reservedSlugs = new Set(["articles", "assets", "photography", "projects"]);

function today() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeSlug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  const rawSlug = process.argv[2];
  const rawTitle = process.argv[3] || rawSlug;

  if (!rawSlug) {
    console.error("Usage: pnpm new-post <slug> [title]");
    process.exit(1);
  }

  const slug = normalizeSlug(rawSlug);
  if (!slug) {
    console.error("Slug is empty after normalization.");
    process.exit(1);
  }

  if (reservedSlugs.has(slug)) {
    console.error(`Slug "${slug}" is reserved by a site route.`);
    process.exit(1);
  }

  const postDir = path.join(process.cwd(), "public", slug);
  const filePath = path.join(postDir, "index.md");

  await fs.mkdir(postDir, { recursive: false });
  await fs.writeFile(filePath, `---
title: ${rawTitle}
date: ${today()}
summary: 
tags: []
---

正文从这里开始。
`, "utf8");

  console.log(`Created ${path.relative(process.cwd(), filePath)}`);
}

main().catch((error) => {
  if (error.code === "EEXIST") {
    console.error("Post already exists.");
    process.exit(1);
  }
  console.error(error);
  process.exit(1);
});
