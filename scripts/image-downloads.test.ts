import assert from 'node:assert/strict';
import test from 'node:test';
import { ImageDownloads, formatImageBytes } from '../lib/image-downloads.ts';
const tick = () => new Promise(resolve => setImmediate(resolve));

interface Request {
  src: string;
  options: RequestInit & { signal: AbortSignal };
  controller: ReadableStreamDefaultController<Uint8Array>;
}
async function fixture(run: (downloads: ImageDownloads, requests: Request[], revoked: string[]) => void | Promise<void>) {
  const previousFetch = global.fetch;
  const previousRevoke = URL.revokeObjectURL;
  const revoked: string[] = [];
  URL.revokeObjectURL = url => { revoked.push(url); previousRevoke(url); };
  const requests: Request[] = [];
  global.fetch = async (src, options) => {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream({ start(value) { controller = value; } });
    assert.equal(typeof src, "string");
    assert.ok(options?.signal);
    requests.push({ src: String(src), options: { ...options, signal: options.signal }, controller });
    return new Response(body, { headers: { 'Content-Length': '10', 'Content-Type': 'image/png' } });
  };
  try { await run(new ImageDownloads(), requests, revoked); }
  finally { global.fetch = previousFetch; URL.revokeObjectURL = previousRevoke; }
}

test('warmup and viewer share bytes, report actual progress, and release the blob after the last consumer', async () => {
  await fixture(async (downloads, requests, revoked) => {
    const warmup = downloads.acquire('https://example.test/photo.png', 'low');
    const viewer = downloads.acquire('https://example.test/photo.png', 'high');
    await tick();
    assert.equal(requests.length, 1);
    assert.equal(requests[0].options.priority, 'low');
    requests[0].controller.enqueue(new Uint8Array(4));
    await tick();
    assert.deepEqual(downloads.snapshot(requests[0].src), { status: 'loading', loaded: 4, total: 10 });
    warmup.release();
    assert.equal(requests[0].options.signal.aborted, false);
    requests[0].controller.enqueue(new Uint8Array(6));
    requests[0].controller.close();
    assert.equal(await viewer.promise, true);
    const ready = downloads.snapshot(requests[0].src);
    assert.equal(ready.status, 'ready');
    assert.equal(ready.loaded, 10);
    assert.equal(ready.total, 10);
    assert.ok(ready.objectUrl);
    assert.match(ready.objectUrl, /^blob:/);
    assert.equal(revoked.length, 0);
    viewer.release();
    viewer.release();
    assert.deepEqual(revoked, [ready.objectUrl]);
    assert.equal(downloads.snapshot(requests[0].src).status, 'idle');
  });
});

test('cancellation and late chunks cannot overwrite a new request for the same image', async () => {
  await fixture(async (downloads, requests) => {
    const first = downloads.acquire('https://example.test/photo.png', 'high');
    await tick();
    first.release();
    const second = downloads.acquire('https://example.test/photo.png', 'high');
    await tick();
    assert.equal(requests[0].options.signal.aborted, true);
    requests[0].controller.enqueue(new Uint8Array(9));
    await tick();
    assert.equal(await first.promise, false);
    assert.equal(downloads.snapshot(requests[1].src).loaded, 0);
    requests[1].controller.enqueue(new Uint8Array(10));
    requests[1].controller.close();
    assert.equal(await second.promise, true);
    second.release();
  });
});

test('missing or encoded lengths remain indeterminate and completion records actual file size', async () => {
  await fixture(async downloads => {
    const headerCases: HeadersInit[] = [{}, { 'Content-Length': '4', 'Content-Encoding': 'gzip' }, { 'Content-Length': 'invalid' }];
    for (const headers of headerCases) {
      let controller!: ReadableStreamDefaultController<Uint8Array>;
      global.fetch = async () => new Response(new ReadableStream({ start(value) { controller = value; } }), { headers });
      const handle = downloads.acquire('https://example.test/photo.png', 'high');
      await tick();
      controller.enqueue(new Uint8Array(6));
      await tick();
      assert.equal(downloads.snapshot('https://example.test/photo.png').loaded, 6);
      assert.equal(downloads.snapshot('https://example.test/photo.png').total, undefined);
      controller.close();
      await handle.promise;
      assert.equal(downloads.snapshot('https://example.test/photo.png').total, 6);
      handle.release();
    }
  });
});

test('HTTP and stream failures preserve an error state and a later opening can retry', async () => {
  await fixture(async downloads => {
    const src = 'https://example.test/photo.png';
    for (const response of [() => new Response('', { status: 404 }), () => new Response(new ReadableStream({ start(controller) { controller.error(new Error('disconnected')); } }))]) {
      global.fetch = async () => response();
      const handle = downloads.acquire(src, 'high');
      assert.equal(await handle.promise, false);
      assert.equal(downloads.snapshot(src).status, 'error');
      handle.release();
    }
    global.fetch = async () => new Response(new Uint8Array(10));
    const retry = downloads.acquire(src, 'high');
    assert.equal(await retry.promise, true);
    retry.release();
  });
});

test('downloaded file sizes use decimal units with stable precision', () => {
  assert.equal(formatImageBytes(0), '0B');
  assert.equal(formatImageBytes(1500), '1.5KB');
  assert.equal(formatImageBytes(9300000), '9.3MB');
  assert.equal(formatImageBytes(17000000), '17.0MB');
  assert.equal(formatImageBytes(327700, 1700000), '0.3MB');
});
