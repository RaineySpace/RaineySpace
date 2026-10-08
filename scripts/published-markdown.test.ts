import assert from "node:assert/strict";
import test from "node:test";
import {
  rewritePublishedMarkdown,
  toSiteAbsoluteAssetPath,
} from "../lib/published-markdown.ts";

test("relative assets become site-absolute paths for the published Markdown URL", () => {
  assert.equal(toSiteAbsoluteAssetPath("./cover.webp", "2015"), "/2015/cover.webp");
  assert.equal(toSiteAbsoluteAssetPath("images/photo.jpg", "album"), "/album/images/photo.jpg");
  assert.equal(
    toSiteAbsoluteAssetPath("./中文 image,1.png", "sample"),
    "/sample/%E4%B8%AD%E6%96%87%20image%2C1.png",
  );
  assert.equal(toSiteAbsoluteAssetPath("/already/absolute.webp", "2015"), null);
  assert.equal(toSiteAbsoluteAssetPath("https://cdn.example/cover.webp", "2015"), null);
  assert.equal(toSiteAbsoluteAssetPath("../escape.webp", "2015"), null);
  assert.equal(toSiteAbsoluteAssetPath("#heading", "2015"), null);
});

test("published Markdown rewrites cover, images and local links without changing source-relative meaning", () => {
  const source = [
    "---",
    "title: Sample",
    "cover: ./cover.webp",
    "---",
    "",
    "![港口](./harbour.jpg)",
    "![中文文件](<./中文 image,1.png>)",
    "[附件](./notes.pdf)",
    "See https://example.com/cover.webp and /assets/site.webp.",
    "",
  ].join("\n");

  assert.equal(
    rewritePublishedMarkdown(source, "2015"),
    [
      "---",
      "title: Sample",
      'cover: "/2015/cover.webp"',
      "---",
      "",
      "![港口](</2015/harbour.jpg>)",
      "![中文文件](</2015/%E4%B8%AD%E6%96%87%20image%2C1.png>)",
      "[附件](</2015/notes.pdf>)",
      "See https://example.com/cover.webp and /assets/site.webp.",
      "",
    ].join("\n"),
  );
});

test('image titles and reference-style links rewrite without changing code examples', () => {
  const source = '---\ntype: article\ntitle: X\n---\n![照片][photo]\n\n[photo]: ./photo.jpg "photography"\n\n![inline](./other.jpg "Other title")\n\n```md\n![code](./code.jpg "photography")\n```\n';
  const published = rewritePublishedMarkdown(source, 'sample', new Map());
  assert.match(published, /!\[照片\]\(<\/sample\/photo.jpg> "photography"\)/);
  assert.match(published, /!\[inline\]\(<\/sample\/other.jpg> "Other title"\)/);
  assert.match(published, /!\[code\]\(\.\/code.jpg "photography"\)/);
});

test('linked and reference images rewrite inside labels without interpreting image alt text as links', () => {
  const source = '[![photo][photo]](https://example.com)\n\n![photo][photo]\n\n[![another](./other.jpg)](./notes.pdf)\n\n![an [alt](./leave-alone)](./alt.jpg)\n\n[photo]: ./photo.jpg "photography"\n';
  const published = rewritePublishedMarkdown(source, 'sample', new Map());
  assert.match(published, /\[!\[photo\]\(<\/sample\/photo.jpg> "photography"\)\]\(<https:\/\/example.com>\)/);
  assert.equal(published.match(/!\[photo\]\(<\/sample\/photo.jpg> "photography"\)/g)?.length, 2);
  assert.match(published, /\[!\[another\]\(<\/sample\/other.jpg>\)\]\(<\/sample\/notes.pdf>\)/);
  assert.match(published, /!\[an \[alt\]\(\.\/leave-alone\)\]\(<\/sample\/alt.jpg>\)/);
});
