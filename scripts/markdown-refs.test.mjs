import assert from "node:assert/strict";
import test from "node:test";
import {
  collectDataRefErrors,
  emptyCollectionMessage,
  expandDataRefsInMarkdown,
  parseDataRefTitle,
  renderDataRefHtml,
} from "../lib/markdown-refs.mjs";

const registries = {
  project: [
    {
      id: "xiaofenshen",
      kind: "project",
      name: "小分身",
      url: "https://xiaofenshen.com",
      description: "训练一个会越来越像你的写手分身。",
      image: "https://xiaofenshen.com/brand/xiaofenshen.svg",
      pinned: false,
      date: new Date("2026-05-07T00:00:00.000Z"),
      dateText: "2026-05-07",
    },
    {
      id: "wefeather-copilot",
      kind: "project",
      name: "微羽助手",
      url: "https://www.wefeather.cn",
      description: "公众号运营效率提升工具",
      image: "https://www.wefeather.cn/logo.png",
      pinned: false,
      date: new Date("2024-10-27T00:00:00.000Z"),
      dateText: "2024-10-27",
    },
  ],
  friend: [
    {
      id: "example-blog",
      kind: "friend",
      name: "朋友的博客",
      url: "https://example.com",
      description: "记录生活与一些想法",
      image: "/assets/friends/example-blog.png",
      pinned: false,
      date: new Date("2026-09-22T00:00:00.000Z"),
      dateText: "2026-09-22",
    },
  ],
};

const emptyFriends = { project: registries.project, friend: [] };

test("only declared project and friend titles are data references", () => {
  assert.deepEqual(parseDataRefTitle("project:xiaofenshen"), { kind: "project", id: "xiaofenshen" });
  assert.deepEqual(parseDataRefTitle("friend:*"), { kind: "friend", id: "*" });
  assert.equal(parseDataRefTitle("hover text"), null);
  assert.equal(parseDataRefTitle("Project:xiaofenshen"), null);
  assert.throws(() => parseDataRefTitle("project:"), /invalid data reference title/);
  assert.throws(() => parseDataRefTitle("friend: example"), /invalid data reference title/);
  assert.throws(() => parseDataRefTitle("project:foo:bar"), /invalid data reference title/);
});

test("single and collection refs render inline or as cards", () => {
  const inlineProject = renderDataRefHtml('最近在做 [小分身](https://xiaofenshen.com "project:xiaofenshen")。', { registries });
  assert.match(inlineProject, /<p>最近在做 <a href="https:\/\/xiaofenshen.com">小分身<\/a>。<\/p>/);
  assert.doesNotMatch(inlineProject, /entity-card/);

  const blockProject = renderDataRefHtml('[小分身](https://xiaofenshen.com "project:xiaofenshen")', { registries });
  assert.match(blockProject, /entity-card-list/);
  assert.match(blockProject, /entity-card-name">小分身/);
  assert.match(blockProject, /href="https:\/\/xiaofenshen.com"/);
  assert.doesNotMatch(blockProject, /<p><div class="entity-card-list"/);

  const inlineAll = renderDataRefHtml('看过 [全部项目](https://rainey.space/projects/ "project:*")。', { registries });
  assert.match(inlineAll, /<a href="https:\/\/xiaofenshen.com">小分身<\/a>、<a href="https:\/\/www.wefeather.cn">微羽助手<\/a>/);

  const blockAll = renderDataRefHtml('[全部项目](https://rainey.space/projects/ "project:*")', { registries });
  assert.equal([...blockAll.matchAll(/class="entity-card"/g)].length, 2);

  const inlineFriend = renderDataRefHtml('去 [朋友的博客](https://example.com "friend:example-blog") 坐坐。', { registries });
  assert.match(inlineFriend, /<a href="https:\/\/example.com">朋友的博客<\/a>/);

  const blockFriend = renderDataRefHtml('[朋友的博客](https://example.com "friend:example-blog")', { registries });
  assert.match(blockFriend, /entity-card-name">朋友的博客/);
  assert.match(blockFriend, /src="\/assets\/friends\/example-blog.png"/);

  const blockFriends = renderDataRefHtml('[朋友们](https://rainey.space/friends/ "friend:*")', { registries });
  assert.match(blockFriends, /entity-card-name">朋友的博客/);
});

test("empty collections keep an inline entry and show a short block empty state", () => {
  const inline = renderDataRefHtml('去 [朋友们](https://rainey.space/friends/ "friend:*") 看看。', { registries: emptyFriends });
  assert.match(inline, /<a href="https:\/\/rainey.space\/friends\/">朋友们<\/a>/);
  assert.doesNotMatch(inline, /暂时还没有添加朋友/);

  const block = renderDataRefHtml('[朋友们](https://rainey.space/friends/ "friend:*")', { registries: emptyFriends });
  assert.match(block, new RegExp(`<p>${emptyCollectionMessage.friend}</p>`));
  assert.doesNotMatch(block, /entity-card/);
});

test("line breaks stay inline, isolated paragraphs become cards", () => {
  const wrapped = renderDataRefHtml('[小分身](https://xiaofenshen.com "project:xiaofenshen")\n还在同一段', { registries });
  assert.match(wrapped, /<p><a href="https:\/\/xiaofenshen.com">小分身<\/a>/);
  assert.doesNotMatch(wrapped, /entity-card/);

  const isolated = renderDataRefHtml('前文\n\n[小分身](https://xiaofenshen.com "project:xiaofenshen")\n\n后文', { registries });
  assert.match(isolated, /entity-card-list/);
});

test("headings, lists, quotes and tables keep inline refs", () => {
  const html = renderDataRefHtml([
    '## [小分身](https://xiaofenshen.com "project:xiaofenshen")',
    "",
    '- [小分身](https://xiaofenshen.com "project:xiaofenshen")',
    "",
    '> [小分身](https://xiaofenshen.com "project:xiaofenshen")',
    "",
    "| 项目 | 链接 |",
    "| --- | --- |",
    '| 产品 | [小分身](https://xiaofenshen.com "project:xiaofenshen") |',
    "",
  ].join("\n"), { registries });

  assert.match(html, /<h2.*>.*<a href="https:\/\/xiaofenshen.com">小分身<\/a>/);
  assert.match(html, /<li>.*<a href="https:\/\/xiaofenshen.com">小分身<\/a>/);
  assert.match(html, /<blockquote>[\s\S]*<a href="https:\/\/xiaofenshen.com">小分身<\/a>/);
  assert.match(html, /<td>.*<a href="https:\/\/xiaofenshen.com">小分身<\/a>/);
  assert.doesNotMatch(html, /entity-card/);
});

test("reference links work, while code and escaped text stay literal", () => {
  const html = renderDataRefHtml([
    "[小分身][xfs]",
    "",
    '[xfs]: https://xiaofenshen.com "project:xiaofenshen"',
    "",
    "代码 `[小分身](https://xiaofenshen.com \"project:xiaofenshen\")`",
    "",
    "```",
    '[微羽助手](https://www.wefeather.cn "project:wefeather-copilot")',
    "```",
    "",
    '\\[朋友的博客](https://example.com "friend:example-blog")',
    "",
  ].join("\n"), { registries });

  assert.match(html, /entity-card-name">小分身/);
  assert.match(html, /<code>\[小分身\]\(https:\/\/xiaofenshen.com &quot;project:xiaofenshen&quot;\)<\/code>/);
  assert.match(html, /<pre><code>\[微羽助手\]\(https:\/\/www.wefeather.cn &quot;project:wefeather-copilot&quot;\)/);
  assert.equal([...html.matchAll(/class="entity-card"/g)].length, 1);
  assert.match(html, /friend:example-blog/);
});

test("published Markdown expands current registry values and drops special titles", () => {
  const source = [
    "---",
    "title: Sample",
    "---",
    "",
    '最近在做 [草稿名](https://old.example "project:xiaofenshen")。',
    "",
    '[全部项目](https://rainey.space/projects/ "project:*")',
    "",
    "[朋友][blog]",
    "",
    '[blog]: https://example.com "friend:example-blog"',
    "",
  ].join("\n");

  const published = expandDataRefsInMarkdown(source, registries, "sample");
  assert.ok(published.includes('最近在做 [小分身](https://xiaofenshen.com)。'));
  assert.ok(published.includes('- [小分身](https://xiaofenshen.com)：训练一个会越来越像你的写手分身。'));
  assert.ok(published.includes('[朋友的博客](https://example.com)'));
  assert.doesNotMatch(published, /project:xiaofenshen|friend:example-blog|project:\*/);
  assert.doesNotMatch(published, /\[blog\]:/);

  const empty = expandDataRefsInMarkdown('[朋友们](https://rainey.space/friends/ "friend:*")', emptyFriends, "friends");
  assert.equal(empty.trim(), emptyCollectionMessage.friend);
});

test("unknown or malformed data refs are reported with the source", () => {
  const errors = collectDataRefErrors([
    '[失踪](https://missing.example "project:missing")',
    '[坏掉](https://example.com "project:")',
    "[普通链接](https://example.com)",
  ].join("\n\n"), registries);
  assert.equal(errors.length, 2);
  assert.match(errors.join("\n"), /unknown project "missing"/);
  assert.match(errors.join("\n"), /invalid data reference title "project:"/);

  assert.throws(
    () => renderDataRefHtml('[失踪](https://missing.example "project:missing")', { registries, source: "demo" }),
    /demo: unknown project "missing"/,
  );
});

test("plain output uses ordinary links and lists without card markup", () => {
  const html = renderDataRefHtml('[全部项目](https://rainey.space/projects/ "project:*")', {
    registries,
    format: "plain",
  });
  assert.match(html, /<ul>/);
  assert.match(html, /<a href="https:\/\/xiaofenshen.com">小分身<\/a>：训练一个会越来越像你的写手分身。/);
  assert.doesNotMatch(html, /entity-card/);
});
