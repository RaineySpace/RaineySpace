import fs from "node:fs/promises";
import path from "node:path";
import { listPostSlugs, postMarkdownPath, publishedMarkdownName } from "../lib/post-files.ts";
import { rewritePublishedMarkdown } from "../lib/published-markdown.ts";

const publicDir = path.join(process.cwd(), "public");
const outputDir = path.join(process.cwd(), "out");

async function exportPost(slug: string) {
  const source = await fs.readFile(postMarkdownPath(publicDir, slug), "utf8");
  await fs.writeFile(
    path.join(outputDir, publishedMarkdownName(slug)),
    rewritePublishedMarkdown(source, slug),
  );

  try {
    await fs.unlink(path.join(outputDir, slug, "index.md"));
  } catch (error) {
    if ((error instanceof Error && 'code' in error ? error.code : undefined) !== "ENOENT") throw error;
  }
}

async function main() {
  const slugs = await listPostSlugs(publicDir);
  await Promise.all(slugs.map(exportPost));
  console.log(`Exported ${slugs.length} Markdown files to out/<slug>.md`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
