import assert from "node:assert/strict";
import test from "node:test";
import {
  rewritePublishedMarkdown,
  toSiteAbsoluteAssetPath,
} from "../lib/published-markdown.ts";
import { entity } from './content-fixtures.ts';
import { marked } from 'marked';

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

test('published collections use inline member names in prose and keep standalone lists with titles and summaries', () => {
  const items = [
    entity('last', { type: 'contact', title: '最后', url: 'https://example.com/last', date: undefined }),
    entity('mail', { type: 'contact', title: '电子邮箱', name: 'Email [work]', url: 'mailto:a@example.com' }),
    entity('other', { type: 'project' }),
  ];
  const index = new Map(items.map((item) => [item.slug, item]));
  const source = '联系：[全部联系方式](/contacts/)。\n\n[全部联系方式](/contact/)\n';
  assert.equal(rewritePublishedMarkdown(source, 'sample', index),
    '联系：[Email \\[work\\]](/mail/)、[最后](/last/)。\n\n- [电子邮箱](/mail/)：简介\n- [最后](/last/)：简介\n\n');
  index.set('new', entity('new', { type: 'contact', title: '新增', date: '2026-01-01', url: 'https://example.com/new' }));
  assert.ok(rewritePublishedMarkdown(source, 'sample', index).startsWith('联系：[新增](/new/)、[Email \\[work\\]](/mail/)、[最后](/last/)。'));
});

test('published inline collections expand in formatted, nested and reference-style Markdown without rewriting navigation or code', () => {
  const mail = entity('mail', { type: 'contact', title: 'Email', url: 'mailto:a@example.com' });
  const index = new Map([[mail.slug, mail]]);
  for (const source of ['## [all](/contact/)\n', '- [all](/contact/)\n', '> [all](/contact/)\n', '**[all](/contact/)**\n', '| [all](/contact/) |\n| --- |\n', 'See [all][contacts].\n\n[contacts]: /contact/\n']) {
    const published = rewritePublishedMarkdown(source, 'sample', index);
    assert.ok(published.includes('[Email](/mail/)'), source);
    assert.ok(!published.includes('- [Email](/mail/)：'), source);
  }
  const preserved = 'See [query](/contact/?q=x), [hash](/contact/#top), [file](/contact.md), [external](https://example.com/contact/).\n\n`[code](/contact/)`\n\n```md\n[code](/contact/)\n```\n';
  assert.equal(rewritePublishedMarkdown(preserved, 'sample', index), preserved);
  const image = rewritePublishedMarkdown('[![icon](./icon.png)](/contact/)\n', 'sample', index);
  assert.equal(image, '[![icon](</sample/icon.png>)](</contact/>)\n');
  assert.equal(rewritePublishedMarkdown('See [empty](/contact/).\n', 'sample', new Map()), 'See [empty](/contact/).\n');
});

test('published inline member names cannot split Markdown table cells', () => {
  const mail = entity('mail', { type: 'contact', name: 'Email | Work', url: 'mailto:a@example.com' });
  const source = '| 联系方式 | 备注 |\n| --- | --- |\n| [全部](/contact/) | ok |\n';
  const published = rewritePublishedMarkdown(source, 'sample', new Map([[mail.slug, mail]]));
  assert.match(marked.parse(published) as string, /<td><a href="\/mail\/">Email \| Work<\/a><\/td>\n<td>ok<\/td>/);
});
