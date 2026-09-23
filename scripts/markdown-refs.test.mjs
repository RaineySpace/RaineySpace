import assert from "node:assert/strict";
import test from "node:test";
import {
  collectDataRefErrors,
  emptyCollectionMessage,
  expandDataRefsInMarkdown,
  parseDataRefTitle,
  renderDataRefHtml as renderSharedDataRefHtml,
  stripElementsByClass,
} from "../lib/markdown-refs.mjs";
import { renderEntityCardHtml } from "../lib/entity-rendering.mjs";

const registries = {
  project: [
    {
      id: "xiaofenshen",
      kind: "project",
      name: "小分身",
      url: "https://xiaofenshen.com",
      description: "训练一个会越来越像你的写手分身。",
      icon: "https://xiaofenshen.com/brand/xiaofenshen.svg",
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
      icon: "https://www.wefeather.cn/logo.png",
      pinned: false,
      date: new Date("2024-10-27T00:00:00.000Z"),
      dateText: "2024-10-27",
    },
  ],
  friend: [
    {
      id: "example-blog",
      kind: "friend",
      name: "朋友",
      title: "朋友的博客",
      url: "https://example.com",
      description: "记录生活与一些想法",
      icon: "/assets/friends/example-blog.png",
      pinned: false,
      date: new Date("2026-09-22T00:00:00.000Z"),
      dateText: "2026-09-22",
    },
  ],
};

function withoutInlinePresentation(html) {
  return html
    .replace(/ class="entity-inline-link entity-inline-link--text"/g, "")
    .replace(/<span class="entity-inline-name">([^<]*)<\/span>/g, "$1");
}

function renderDataRefHtml(content, options) {
  return withoutInlinePresentation(renderSharedDataRefHtml(content, options));
}

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

test("single and collection refs render inline links with hover cards or block cards", () => {
  const inlineProject = renderDataRefHtml('最近在做 [小分身](https://xiaofenshen.com "project:xiaofenshen")。', { registries });
  assert.match(inlineProject, /<p>最近在做 <span class="entity-chip">/);
  assert.match(inlineProject, /<a href="https:\/\/xiaofenshen.com">小分身<\/a>/);
  assert.match(inlineProject, /entity-chip-popover-panel/);
  assert.match(inlineProject, /entity-card-icon" src="https:\/\/xiaofenshen.com\/brand\/xiaofenshen.svg"/);
  assert.doesNotMatch(inlineProject, /entity-card-list/);
  assert.doesNotMatch(inlineProject, /<p><article|<p><div/);

  const blockProject = renderDataRefHtml('[小分身](https://xiaofenshen.com "project:xiaofenshen")', { registries });
  assert.match(blockProject, /entity-card-list/);
  assert.match(blockProject, /entity-card-name">小分身/);
  assert.match(blockProject, /href="https:\/\/xiaofenshen.com"/);
  assert.doesNotMatch(blockProject, /<p><div class="entity-card-list"/);

  const inlineAll = renderDataRefHtml('看过 [全部项目](https://rainey.space/projects/ "project:*")。', { registries });
  assert.equal([...inlineAll.matchAll(/class="entity-chip"/g)].length, 2);
  assert.match(inlineAll, />小分身<\/a>[\s\S]*、[\s\S]*>微羽助手<\/a>/);

  const blockAll = renderDataRefHtml('[全部项目](https://rainey.space/projects/ "project:*")', { registries });
  assert.equal([...blockAll.matchAll(/class="entity-card"/g)].length, 2);

  const inlineFriend = renderDataRefHtml('去 [朋友的博客](https://example.com "friend:example-blog") 坐坐。', { registries });
  assert.match(inlineFriend, /<a href="https:\/\/example.com">朋友<\/a>/);
  assert.match(inlineFriend, /entity-chip-popover/);

  const blockFriend = renderDataRefHtml('[朋友的博客](https://example.com "friend:example-blog")', { registries });
  assert.match(blockFriend, /entity-card-name">朋友的博客/);
  assert.match(blockFriend, /src="\/assets\/friends\/example-blog.png"/);

  const blockFriends = renderDataRefHtml('[朋友们](https://rainey.space/friends/ "friend:*")', { registries });
  assert.match(blockFriends, /entity-card-name">朋友的博客/);
});

test("empty collections keep an inline entry and show a short block empty state", () => {
  const inline = renderDataRefHtml('去 [朋友们](https://rainey.space/friends/ "friend:*") 看看。', { registries: emptyFriends });
  assert.match(inline, /<a href="https:\/\/rainey.space\/friends\/">朋友们<\/a>/);
  assert.doesNotMatch(inline, /entity-chip/);
  assert.doesNotMatch(inline, /暂时还没有添加朋友/);

  const block = renderDataRefHtml('[朋友们](https://rainey.space/friends/ "friend:*")', { registries: emptyFriends });
  assert.match(block, new RegExp(`<p>${emptyCollectionMessage.friend}</p>`));
  assert.doesNotMatch(block, /entity-card/);
});

test("line breaks stay inline, isolated paragraphs become cards", () => {
  const wrapped = renderDataRefHtml('[小分身](https://xiaofenshen.com "project:xiaofenshen")\n还在同一段', { registries });
  assert.match(wrapped, /<p><span class="entity-chip">/);
  assert.doesNotMatch(wrapped, /entity-card-list/);

  const isolated = renderDataRefHtml('前文\n\n[小分身](https://xiaofenshen.com "project:xiaofenshen")\n\n后文', { registries });
  assert.match(isolated, /entity-card-list/);
});

test("headings, lists, quotes and tables keep inline chips", () => {
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

  assert.match(html, /<h2.*>[\s\S]*<a href="https:\/\/xiaofenshen.com">小分身/);
  assert.match(html, /<li>[\s\S]*<a href="https:\/\/xiaofenshen.com">小分身/);
  assert.match(html, /<blockquote>[\s\S]*<a href="https:\/\/xiaofenshen.com">小分身/);
  assert.match(html, /<td>[\s\S]*<a href="https:\/\/xiaofenshen.com">小分身/);
  assert.doesNotMatch(html, /entity-card-list/);
  assert.equal(stripElementsByClass(html.match(/<h2[\s\S]*?<\/h2>/)[0], "entity-chip-popover").includes("训练一个"), false);
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

test("missing icons show a name initial and failed images keep a hidden fallback", () => {
  const noIcon = { ...registries.friend[0], icon: undefined };
  const missing = renderEntityCardHtml(noIcon);
  assert.match(missing, /entity-card-fallback">朋<\/span>/);
  assert.doesNotMatch(missing, /<img/);

  const withIcon = renderEntityCardHtml(registries.friend[0]);
  assert.match(withIcon, /onerror="this.hidden=true;this.nextElementSibling.hidden=false"/);
  assert.match(withIcon, /entity-card-fallback" hidden>朋<\/span>/);
});

test("plain output uses ordinary links and lists without card markup", () => {
  const html = renderDataRefHtml('[全部项目](https://rainey.space/projects/ "project:*")', {
    registries,
    format: "plain",
  });
  assert.match(html, /<ul>/);
  assert.match(html, /<a href="https:\/\/xiaofenshen.com">小分身<\/a>：训练一个会越来越像你的写手分身。/);
  assert.doesNotMatch(html, /entity-card|entity-chip/);

  const inline = renderDataRefHtml('最近在做 [小分身](https://xiaofenshen.com "project:xiaofenshen")。', {
    registries,
    format: "plain",
  });
  assert.match(inline, /<p>最近在做 <a href="https:\/\/xiaofenshen.com">小分身<\/a>。<\/p>/);
  assert.doesNotMatch(inline, /entity-chip|entity-card/);
});

test("friend names are inline while site titles appear in cards and block exports", () => {
  const inline = '认识 [站点](https://example.com "friend:example-blog")。';
  const block = '[站点](https://example.com "friend:example-blog")';
  assert.match(renderDataRefHtml(inline, { registries }), /entity-card-name">朋友的博客/);
  assert.equal(expandDataRefsInMarkdown(inline, registries), '认识 [朋友](https://example.com)。');
  assert.match(expandDataRefsInMarkdown(block, registries), /\[朋友的博客\]/);
  assert.match(renderDataRefHtml(inline, { registries, format: "plain" }), />朋友<\/a>/);
  assert.match(renderDataRefHtml(block, { registries, format: "plain" }), />朋友的博客<\/a>/);
});

test("inline references keep ordinary links and isolate card media in the popover", () => {
  for (const [kind, id] of [["project", "xiaofenshen"], ["friend", "example-blog"]]) {
    const item = registries[kind][0];
    const html = renderDataRefHtml(`认识 [示例](${item.url} "${kind}:${id}")。`, { registries });
    const visible = stripElementsByClass(html, "entity-chip-popover");
    assert.equal(visible, `<p>认识 <span class="entity-chip"><a href="${item.url}">${item.name}</a></span>。</p>\n`);
    assert.doesNotMatch(html, /entity-chip-(link|media|icon|fallback|name)/);
    assert.match(html, /entity-chip-popover/);
    assert.match(html, /entity-card-icon/);
  }
});
