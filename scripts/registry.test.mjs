import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import {
  compareEntities,
  parseRegistry,
  sortEntities,
} from "../lib/registry.mjs";

const projectRoot = path.resolve("scripts", "..");

function project(id, overrides = {}) {
  return {
    name: id,
    url: `https://example.com/${id}`,
    date: "2026-01-01",
    ...overrides,
  };
}

function friend(id, overrides = {}) {
  return {
    name: id,
    url: `https://friends.example/${id}`,
    date: "2026-02-01",
    ...overrides,
  };
}

test("empty registries are valid and stay empty after sorting", () => {
  for (const kind of ["project", "friend"]) {
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
    "http-cover": project("http-cover", { cover: "http://example.com/a.png" }),
    "relative-cover": project("relative-cover", { cover: "./cover.webp" }),
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
  assert.match(messages, /http-cover: cover must be an HTTPS URL or a site-absolute public path/);
  assert.match(messages, /relative-cover: cover must be an HTTPS URL or a site-absolute public path/);
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
    const check = spawnSync(process.execPath, [path.join(projectRoot, "scripts/validate-content.mjs")], {
      cwd: directory,
      encoding: "utf8",
    });
    assert.equal(check.status, 1);
    assert.match(check.stderr, /content\/projects\.json:alpha: "date" must be a YYYY-MM-DD date/);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
