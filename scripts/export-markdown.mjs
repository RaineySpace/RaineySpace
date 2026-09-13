import fs from "node:fs/promises";
import path from "node:path";
import { listPostSlugs, postMarkdownPath, publishedMarkdownName } from "../lib/post-files.mjs";

const publicDir = path.join(process.cwd(), "public");
const outputDir = path.join(process.cwd(), "out");

async function main() {
  const slugs = await listPostSlugs(publicDir);
  await Promise.all(
    slugs.map((slug) =>
      fs.copyFile(postMarkdownPath(publicDir, slug), path.join(outputDir, publishedMarkdownName(slug))),
    ),
  );
  console.log(`Exported ${slugs.length} Markdown files to out/<slug>.md`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
