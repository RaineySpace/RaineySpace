import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

async function withWorkspace(run: (directory: string) => Promise<void>) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rainey-ts-cli-'));
  try {
    for (const name of ['public', 'content', 'out']) await fs.mkdir(path.join(directory, name));
    for (const kind of ['projects', 'friends', 'contacts']) await fs.writeFile(path.join(directory, 'content', `${kind}.json`), '{}');
    await run(directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

function cli(directory: string, name: string, ...args: string[]) {
  return spawnSync(process.execPath, [fileURLToPath(new URL(`./${name}.ts`, import.meta.url)), ...args], {
    cwd: directory,
    encoding: 'utf8',
  });
}

test('native TypeScript new-post CLI uses the working directory and preserves argument and error handling', async () => {
  await withWorkspace(async (directory) => {
    assert.equal(cli(directory, 'new-post').status, 1);
    assert.equal(cli(directory, 'new-post', 'projects').status, 1);
    const created = cli(directory, 'new-post', '中文 Hello World', '测试标题');
    assert.equal(created.status, 0, created.stderr);
    const filename = path.join(directory, 'public/中文-hello-world/index.md');
    const content = await fs.readFile(filename, 'utf8');
    assert.match(content, /title: 测试标题\ndate: \d{4}-\d{2}-\d{2}/);
    assert.equal(cli(directory, 'new-post', '中文 Hello World', 'Overwrite').status, 1);
    assert.equal(await fs.readFile(filename, 'utf8'), content);
  });
});

test('native TypeScript export and headers CLIs resolve code from import.meta.url and content from cwd', async () => {
  await withWorkspace(async (directory) => {
    const slug = '中文 #1';
    const markdown = '---\ntitle: Sample\ndate: 2024-02-01\nsummary: Summary\nnoindex: true\ncover: ./photo.png\n---\n![Photo](./photo.png)\n';
    for (const base of ['public', 'out']) {
      await fs.mkdir(path.join(directory, base, slug));
      await fs.writeFile(path.join(directory, base, slug, 'index.md'), markdown);
    }
    const exported = cli(directory, 'export-markdown');
    assert.equal(exported.status, 0, exported.stderr);
    const published = await fs.readFile(path.join(directory, 'out', `${slug}.md`), 'utf8');
    assert.ok(published.includes(`/${encodeURIComponent(slug)}/photo.png`));
    await assert.rejects(fs.access(path.join(directory, 'out', slug, 'index.md')), { code: 'ENOENT' });
    const headers = cli(directory, 'generate-headers');
    assert.equal(headers.status, 0, headers.stderr);
    assert.ok((await fs.readFile(path.join(directory, 'out/_headers'), 'utf8')).includes(`/${encodeURIComponent(slug)}.md\n  X-Robots-Tag: noindex`));
    await fs.writeFile(path.join(directory, 'public', slug, 'index.md'), '[Missing](https://example.com "project:missing")');
    const rejected = cli(directory, 'export-markdown');
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /unknown project "missing"/);
  });
});

test('image optimizer runs from a temporary cwd and fails on an unreadable image', async () => {
  await withWorkspace(async (directory) => {
    const empty = cli(directory, 'optimize-images');
    assert.equal(empty.status, 0, empty.stderr);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(directory, 'public/_optimized/manifest.json'), 'utf8')), {});
    await fs.mkdir(path.join(directory, 'public/broken'));
    await fs.writeFile(path.join(directory, 'public/broken/index.md'), '![Broken](./image.png)');
    await fs.writeFile(path.join(directory, 'public/broken/image.png'), 'not an image');
    const failed = cli(directory, 'optimize-images');
    assert.equal(failed.status, 1);
    assert.match(failed.stderr, /unsupported image format/i);
  });
});

test('headers and output validators fail rather than report success when build output is missing', async () => {
  await withWorkspace(async (directory) => {
    await fs.rm(path.join(directory, 'out'), { recursive: true });
    for (const name of ['generate-headers', 'validate-seo', 'validate-images']) {
      const failed = cli(directory, name);
      assert.equal(failed.status, 1, name);
      assert.match(failed.stderr, /ENOENT/, name);
    }
  });
});
