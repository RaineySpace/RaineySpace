import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { spawnSync } from "node:child_process";
import {
  compareEntities,
  parseRegistry,
  sortEntities,
} from "../lib/registry.ts";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

function project(id: string, overrides: Record<string, unknown> = {}) {
  return {
    name: id,
    url: `https://example.com/${id}`,
    date: "2026-01-01",
    ...overrides,
  };
}

function friend(id: string, overrides: Record<string, unknown> = {}) {
  return {
    name: id,
    title: `${id} blog`,
    url: `https://friends.example/${id}`,
    date: "2026-02-01",
    ...overrides,
  };
}

test("empty registries are valid and stay empty after sorting", () => {
  for (const kind of ["project", "friend", "contact"] as const) {
    const parsed = parseRegistry(kind, {});
    assert.deepEqual(parsed.errors, []);
    assert.deepEqual(parsed.entities, []);
    assert.deepEqual(sortEntities(parsed.entities), []);
  }
});

test("required fields, dates, urls and image paths are validated", () => {
  const parsed = parseRegistry("project", {
    "bad id": { name: "Bad", url: "https://a.example", date: "2026-01-01" },
    missing: {},
    "bad-date": project("bad-date", { date: "2026-02-30" }),
    "bad-url": project("bad-url", { url: "ftp://example.com" }),
    "http-icon": project("http-icon", { icon: "http://example.com/a.png" }),
    "relative-icon": project("relative-icon", { icon: "./cover.webp" }),
    "empty-desc": project("empty-desc", { description: "   " }),
    "bad-pin": project("bad-pin", { pinned: "true" }),
    extra: project("extra", { unknown: "nope" }),
  });
  const messages = parsed.errors.join("\n");
  assert.match(messages, /bad id: project ID must not be empty or contain whitespace/);
  assert.match(messages, /missing: "name" must be a non-empty string/);
  assert.match(messages, /missing: "url" must be a non-empty string/);
  assert.match(messages, /missing: "date" must be a YYYY-MM-DD date/);
  assert.match(messages, /bad-date: "date" must be a YYYY-MM-DD date/);
  assert.match(messages, /bad-url: invalid HTTP\(S\) url/);
  assert.match(messages, /http-icon: icon must be an HTTPS URL or a site-absolute public path/);
  assert.match(messages, /relative-icon: icon must be an HTTPS URL or a site-absolute public path/);
  assert.match(messages, /empty-desc: "description" must be a non-empty string when provided/);
  assert.match(messages, /bad-pin: "pinned" must be a boolean/);
  assert.match(messages, /extra: unknown field "unknown"/);
});

test("friend icons use the same path rules and duplicate urls are rejected", () => {
  const parsed = parseRegistry("friend", {
    alpha: friend("alpha", { url: "https://dup.example/blog/", icon: "/assets/friends/alpha.png" }),
    beta: friend("beta", { url: "https://dup.example/blog", icon: "https://cdn.example/beta.png" }),
  });
  assert.match(parsed.errors.join("\n"), /beta: url duplicates friend "alpha"/);
  assert.equal(parsed.localImages[0].field, "icon");
  assert.ok(parsed.localImages[0].path.endsWith(path.join("assets", "friends", "alpha.png")));
});

test("only contacts accept mailto URLs and reject malformed mailbox links", () => {
  for (const url of ["mailto:hello@example.com", "mailto:hello+blog@example.com?subject=Hello%20there&body=Hi"]) {
    const parsed = parseRegistry("contact", { email: project("email", { url }) });
    assert.deepEqual(parsed.errors, []);
    assert.equal(parsed.entities[0].url, url);
    for (const kind of ["project", "friend"] as const) {
      assert.match(parseRegistry(kind, { email: project("email", { url }) }).errors.join("\n"), /invalid HTTP\(S\) url/);
    }
  }
  for (const url of [
    "mailto:", "mailto:not-an-email", "mailto:hello@", "mailto:hello@@example.com",
    "mailto:[hello@example.com](mailto:hello@example.com)",
    "mailto:hello%20there@example.com", "mailto:hello%@example.com",
    "mailto:hello@example.com#fragment", "javascript:alert(1)", "tel:12345",
  ]) {
    assert.match(parseRegistry("contact", { email: project("email", { url }) }).errors.join("\n"), /invalid HTTP\(S\) or mailto url/);
  }
  const duplicate = parseRegistry("contact", {
    first: project("first", { url: "mailto:hello@example.com" }),
    second: project("second", { url: "MAILTO:hello%40EXAMPLE.COM" }),
  });
  assert.match(duplicate.errors.join("\n"), /url duplicates contact "first"/);
});

test("entities sort by pinned, then date descending, then id", () => {
  const parsed = parseRegistry("project", {
    zeta: project("zeta", { date: "2026-05-01", pinned: true }),
    alpha: project("alpha", { date: "2026-09-01" }),
    beta: project("beta", { date: "2026-09-01" }),
    old: project("old", { date: "2024-01-01" }),
    newer: project("newer", { date: "2026-08-01", pinned: false }),
  });
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.entities.map((item) => item.id), ["zeta", "alpha", "beta", "newer", "old"]);
  assert.deepEqual(
    sortEntities(parsed.entities).map((item) => item.id),
    ["zeta", "alpha", "beta", "newer", "old"],
  );
  assert.ok(compareEntities(parsed.entities[0], parsed.entities[1]) < 0);
});

test("content validator uses the shared registry rules", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "rainey-registry-"));
  try {
    await fs.mkdir(path.join(directory, "content"));
    await fs.mkdir(path.join(directory, "public"));
    await fs.writeFile(path.join(directory, "content/projects.json"), JSON.stringify({
      alpha: project("alpha", { date: "2026-02-30" }),
    }));
    await fs.writeFile(path.join(directory, "content/friends.json"), "{}");
    await fs.writeFile(path.join(directory, "content/contacts.json"), "{}");
    const check = spawnSync(process.execPath, [path.join(projectRoot, "scripts/validate-content.ts")], {
      cwd: directory,
      encoding: "utf8",
    });
    assert.equal(check.status, 1);
    assert.match(check.stderr, /content\/projects\.json:alpha: "date" must be a YYYY-MM-DD date/);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("both registries share optional titles, icons and extension data", () => {
  for (const kind of ["project", "friend", "contact"] as const) {
    const extensions = kind === "project"
      ? { repository: "https://github.com/example/project", platforms: ["web"], flags: { beta: true } }
      : { feed: "https://example.com/rss.xml", social: { github: "example" }, score: null };
    const parsed = parseRegistry(kind, { alpha: project("alpha", {
      title: " Alpha Blog ", icon: "/assets/alpha.png", extensions,
    }) });
    assert.deepEqual(parsed.errors, []);
    assert.equal(parsed.entities[0].name, "alpha");
    assert.equal(parsed.entities[0].title, "Alpha Blog");
    assert.equal(parsed.entities[0].icon, "/assets/alpha.png");
    assert.deepEqual(parsed.entities[0].extensions, extensions);
    assert.notEqual(parsed.entities[0].extensions, extensions);
    assert.equal(parsed.localImages[0].field, "icon");
    assert.equal("image" in parsed.entities[0], false);
    assert.equal("cover" in parsed.entities[0], false);
    const withoutTitle = parseRegistry(kind, { alpha: project("alpha") });
    assert.deepEqual(withoutTitle.errors, []);
    assert.equal(withoutTitle.entities[0].title, undefined);
    assert.deepEqual(withoutTitle.entities[0].extensions, {});
    for (const title of [null, "", "  ", 42]) {
      const invalid = parseRegistry(kind, { alpha: project("alpha", { title }) });
      assert.match(invalid.errors.join("\n"), /"title" must be a non-empty string/);
    }
  }
});

test("extensions are JSON objects and cannot overwrite the common contract", () => {
  for (const kind of ["project", "friend", "contact"] as const) {
    for (const extensions of [null, [], "bad", { bad: undefined }, { bad: Infinity }, { bad: new Date() }]) {
      assert.match(parseRegistry(kind, { alpha: project("alpha", { extensions }) }).errors.join("\n"), /"extensions" must be a JSON object/);
    }
    const parsed = parseRegistry(kind, { alpha: project("alpha", {
      extensions: { name: "different", icon: "not a display icon", pinned: true },
    }) });
    assert.deepEqual(parsed.errors, []);
    assert.equal(parsed.entities[0].name, "alpha");
    assert.equal(parsed.entities[0].icon, undefined);
    assert.equal(parsed.entities[0].pinned, false);
    assert.match(parseRegistry(kind, { alpha: project("alpha", { cover: "/old.png" }) }).errors.join("\n"), /unknown field "cover"/);
  }
});
