import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const publicDir = path.join(process.cwd(), "public");
const requiredFields = ["title", "date", "summary"];
const imagePattern = /!\[[^\]]*]\(([^)]+)\)/g;

function isLocalReference(value) {
  return value && !/^(https?:)?\/\//.test(value) && !value.startsWith("data:");
}

function isValidDate(value) {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(String(value));
  return !Number.isNaN(date.getTime());
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const entries = await fs.readdir(publicDir, { withFileTypes: true });
  const slugs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  const seen = new Set();
  const errors = [];
  const warnings = [];

  for (const slug of slugs) {
    if (seen.has(slug)) {
      errors.push(`${slug}: duplicate slug`);
    }
    seen.add(slug);

    const postDir = path.join(publicDir, slug);
    const filePath = path.join(postDir, "index.md");
    if (!(await exists(filePath))) {
      errors.push(`${slug}: missing index.md`);
      continue;
    }

    const fileContents = await fs.readFile(filePath, "utf8");
    const { data, content } = matter(fileContents);
    const hidden = Boolean(data.hidden);

    if (!hidden) {
      for (const field of requiredFields) {
        if (!data[field]) {
          errors.push(`${slug}: missing required frontmatter "${field}"`);
        }
      }
    }

    if (data.date && !isValidDate(data.date)) {
      errors.push(`${slug}: invalid date "${data.date}"`);
    }

    if (hidden) continue;

    if (data.cover && isLocalReference(String(data.cover))) {
      const coverPath = path.resolve(postDir, String(data.cover));
      if (!(await exists(coverPath))) {
        warnings.push(`${slug}: missing cover asset ${data.cover}`);
      }
    }

    for (const match of content.matchAll(imagePattern)) {
      const src = match[1].trim();
      if (!isLocalReference(src)) continue;
      const imagePath = path.resolve(postDir, src);
      if (!(await exists(imagePath))) {
        warnings.push(`${slug}: missing image asset ${src}`);
      }
    }
  }

  for (const warning of warnings) {
    console.warn(`WARN ${warning}`);
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`ERROR ${error}`);
    }
    process.exit(1);
  }

  console.log(`Content validation passed for ${slugs.length} posts with ${warnings.length} warning(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
