import assert from "node:assert/strict";
import test from "node:test";
import { parseRegistry, loadRegistries } from "../lib/registry.mjs";
import { renderEntityHtml } from "../lib/entity-rendering.mjs";
import { renderDataRefHtml, stripElementsByClass } from "../lib/markdown-refs.mjs";

const fixtures = Object.fromEntries(["project", "friend"].map((kind) => [kind, parseRegistry(kind, {
  example: {
    name: "Inline name",
    title: "Card title",
    url: "https://example.com/",
    icon: "https://example.com/icon.png",
    description: "Description",
    date: "2026-09-23",
    extensions: { internalLabel: "extension-only" },
  },
}).entities]));

test("all variants consume either registry directly, with independent icon and hover-card options", () => {
  for (const kind of ["project", "friend"]) {
    const item = fixtures[kind][0];
    for (const showIcon of [false, true]) {
      const card = renderEntityHtml(item, { variant: "card", showIcon, headingLevel: "h2" });
      assert.match(card, /<h2 class="entity-card-name">Card title<\/h2>/);
      assert.equal(card.includes("<img"), showIcon);
      assert.equal(card.includes("entity-card-media"), showIcon);
      assert.doesNotMatch(card, /extension-only/);
      for (const appearance of ["text", "chip"]) {
        for (const hoverCard of [false, true]) {
          for (const popoverShowIcon of [false, true]) {
            const html = renderEntityHtml(item, { variant: "inline", appearance, showIcon, hoverCard, popoverShowIcon, placement: "top" });
            const visible = stripElementsByClass(html, "entity-chip-popover");
            assert.match(visible, /Inline name/);
            assert.doesNotMatch(visible, /Card title|Description/);
            assert.equal(visible.includes("<img"), showIcon);
            assert.equal(html.includes("entity-chip-popover"), hoverCard);
            assert.equal(html.includes("entity-card-media"), hoverCard && popoverShowIcon);
            assert.equal(html.includes('data-placement="top"'), hoverCard);
            assert.match(html, new RegExp(`entity-inline-link--${appearance}`));
            assert.doesNotMatch(html, /<span[^>]*><article|<span[^>]*><div|extension-only/);
          }
        }
      }
    }
  }
});

test("Markdown uses the same card and inline renderer as Entity components", () => {
  for (const kind of ["project", "friend"]) {
    const item = fixtures[kind][0];
    const ref = `[Outdated name](https://old.example "${kind}:example")`;
    assert.equal(renderDataRefHtml(ref, { registries: fixtures }), `<div class="entity-card-list">${renderEntityHtml(item)}</div>\n`);
    assert.equal(renderDataRefHtml(`See ${ref}.`, { registries: fixtures }), `<p>See ${renderEntityHtml(item, { variant: "inline", newTab: false })}.</p>\n`);
  }
});

test("rendering escapes registry text and never interpolates extension data", () => {
  const item = {
    ...fixtures.project[0], name: '<script>alert("x")</script>', title: '<img src=x onerror="bad()">',
    description: '<a href="javascript:bad()">bad</a>', icon: 'https://example.com/a?x=" onload="bad()',
  };
  for (const variant of ["inline", "card"]) {
    const html = renderEntityHtml(item, { variant, showIcon: true });
    assert.doesNotMatch(html, /<script>|<img src=x| onload="bad|href="javascript/);
    assert.match(html, /&lt;/);
    assert.match(html, /&quot;/);
  }
});

test("missing icons have a fallback only when icons are requested; titles fall back to names", () => {
  const item = { ...fixtures.friend[0], icon: undefined, title: undefined };
  assert.match(renderEntityHtml(item), /entity-card-name">Inline name/);
  assert.match(renderEntityHtml(item), /entity-card-fallback">I<\/span>/);
  const textOnly = renderEntityHtml(item, { showIcon: false });
  assert.doesNotMatch(textOnly, /entity-card-media|entity-card-fallback|<img/);
});

test("real project and friend registries use one icon field without adapters", () => {
  const registries = loadRegistries();
  for (const [kind, items] of Object.entries(registries)) {
    for (const item of items) {
      assert.equal(item.kind, kind);
      assert.equal("image" in item || "cover" in item, false);
      assert.ok(item.extensions);
      assert.ok(renderEntityHtml(item, { variant: "inline", showIcon: true }).includes(item.url));
    }
  }
});
