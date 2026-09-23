import assert from 'node:assert/strict';
import test from 'node:test';
import { ImagePreloader, imagePreloadPolicy } from '../lib/image-preloader.ts';

function harness() {
  interface Request {
    src: string; canceled: boolean; promoted: boolean;
    finish(success?: boolean): void;
    cancel(): void;
    promote(): void;
  }
  const idle = new Set<() => void>();
  const requests: Request[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const preloader = new ImagePreloader({
    schedule(run) {
      idle.add(run);
      return () => idle.delete(run);
    },
    load(src, done) {
      let ended = false;
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      const request = {
        src, canceled: false, promoted: false,
        finish(success = true) {
          if (!ended) { ended = true; inFlight--; }
          done(success);
        },
        cancel() {
          if (!ended) { ended = true; inFlight--; }
          request.canceled = true;
        },
        promote() { request.promoted = true; },
      };
      requests.push(request);
      return request;
    },
  });
  return {
    preloader, requests,
    get sources() { return requests.map((request) => request.src); },
    get maxInFlight() { return maxInFlight; },
    runIdle() {
      assert.ok(idle.size <= 1, 'only one idle callback is queued');
      const run = idle.values().next().value;
      if (run) { idle.delete(run); run(); }
    },
    finish(success = true) { const last = requests.at(-1); assert.ok(last); last.finish(success); },
  };
}

test('waits for page load and idle, then warms one original at a time across all groups', () => {
  const h = harness();
  h.preloader.register('cover', ['a']);
  h.preloader.register('body', ['a', 'b', 'c']);
  h.runIdle();
  assert.deepEqual(h.sources, []);
  h.preloader.updateEnvironment({ pageLoaded: true });
  assert.deepEqual(h.sources, []);
  h.runIdle();
  assert.deepEqual(h.sources, ['a']);
  for (let i = 0; i < 3; i++) h.runIdle();
  assert.deepEqual(h.sources, ['a']);
  h.finish(); h.runIdle();
  h.finish(); h.runIdle();
  h.finish(); h.runIdle();
  assert.deepEqual(h.sources, ['a', 'b', 'c']);
  assert.equal(h.maxInFlight, 1);
});

test('current original blocks new warmups, then next, previous and its group precede other page images', () => {
  const h = harness();
  h.preloader.register('page', ['a', 'b']);
  h.preloader.register('album', ['c', 'd', 'e', 'f', 'g']);
  h.preloader.updateEnvironment({ pageLoaded: true });
  h.runIdle();
  const pending = h.preloader.observeCurrent('c', false);
  h.preloader.activate('album', 0);
  h.finish(); h.runIdle();
  assert.deepEqual(h.sources, ['a']);
  h.preloader.record('c', true);
  h.runIdle();
  assert.deepEqual(h.sources, ['a'], 'the visible image must also finish decoding');
  pending();
  h.preloader.observeCurrent('c', true);
  h.runIdle();
  for (let i = 0; i < 5; i++) { h.finish(); h.runIdle(); }
  assert.deepEqual(h.sources, ['a', 'd', 'g', 'e', 'f', 'b']);
  assert.equal(h.maxInFlight, 1);
});

test('switching photos reprioritizes queued work and promotes a warmup already in flight', () => {
  const h = harness();
  h.preloader.register('album', ['a', 'b', 'c', 'd', 'e']);
  h.preloader.activate('album', 0);
  const first = h.preloader.observeCurrent('a', true);
  h.preloader.record('a', true);
  first();
  const second = h.preloader.observeCurrent('c', false);
  h.preloader.activate('album', 2);
  h.runIdle();
  assert.deepEqual(h.sources, [], 'old queued neighbor must not start after switching');
  h.preloader.record('c', true);
  second(); h.preloader.observeCurrent('c', true);
  h.runIdle();
  assert.deepEqual(h.sources, ['d']);
  h.preloader.observeCurrent('d', false);
  h.preloader.activate('album', 3);
  assert.equal(h.requests[0].promoted, true);
  h.runIdle();
  assert.deepEqual(h.sources, ['d'], 'promotion reuses the existing request');
});

test('network policies restrict speculation, while explicit viewing can still complete and retry', () => {
  assert.equal(imagePreloadPolicy(), 'all');
  assert.equal(imagePreloadPolicy({ type: 'wifi', effectiveType: '4g' }), 'all');
  assert.equal(imagePreloadPolicy({ effectiveType: '4g' }), 'all', 'effectiveType is speed, not a cellular type');
  assert.equal(imagePreloadPolicy({ type: 'cellular' }), 'neighbors');
  assert.equal(imagePreloadPolicy({ effectiveType: '3g' }), 'neighbors');
  for (const connection of [{ saveData: true }, { effectiveType: '2g' }, { effectiveType: 'slow-2g' }]) {
    assert.equal(imagePreloadPolicy(connection), 'none');
  }
  const h = harness();
  h.preloader.register('album', ['a', 'b', 'c', 'd', 'e']);
  h.preloader.updateEnvironment({ pageLoaded: true, policy: 'none' });
  h.preloader.activate('album', 2);
  h.preloader.observeCurrent('c', true);
  h.preloader.record('c', false);
  h.preloader.record('c', true);
  h.runIdle();
  assert.equal(h.preloader.isLoaded('c'), true);
  assert.deepEqual(h.sources, []);
  h.preloader.updateEnvironment({ policy: 'neighbors' });
  h.runIdle(); h.finish(); h.runIdle(); h.finish(); h.runIdle();
  assert.deepEqual(h.sources, ['d', 'b']);
  h.preloader.activate('album', null);
  h.runIdle();
  assert.deepEqual(h.sources, ['d', 'b'], 'closing does not start page warmup on cellular');
  h.preloader.updateEnvironment({ policy: 'all' });
  h.runIdle();
  assert.deepEqual(h.sources, ['d', 'b', 'a']);
});

test('hiding the page or going offline pauses the queue without restarting an in-flight download', () => {
  const h = harness();
  h.preloader.register('album', ['a', 'b', 'c']);
  h.preloader.updateEnvironment({ pageLoaded: true });
  h.runIdle();
  h.preloader.updateEnvironment({ visible: false });
  assert.equal(h.requests[0].canceled, false);
  h.finish(); h.runIdle();
  assert.deepEqual(h.sources, ['a']);
  h.preloader.updateEnvironment({ visible: true, online: false });
  h.runIdle();
  assert.deepEqual(h.sources, ['a']);
  h.preloader.updateEnvironment({ online: true });
  h.runIdle();
  assert.deepEqual(h.sources, ['a', 'b']);
});

test('failed warmups do not loop or block the queue, and viewing can repair a failed cache entry', () => {
  const h = harness();
  h.preloader.register('album', ['a', 'b']);
  h.preloader.updateEnvironment({ pageLoaded: true });
  h.runIdle(); h.finish(false); h.runIdle(); h.finish(); h.runIdle();
  assert.deepEqual(h.sources, ['a', 'b']);
  assert.equal(h.preloader.isLoaded('a'), false);
  h.preloader.activate('album', 0);
  h.preloader.record('a', true);
  h.runIdle();
  assert.equal(h.preloader.isLoaded('a'), true);
  assert.deepEqual(h.sources, ['a', 'b']);
});

test('route cleanup cancels stale work and ignores late results, but preserves shared sources', () => {
  const h = harness();
  const removeCover = h.preloader.register('cover', ['a']);
  const removeBody = h.preloader.register('body', ['a', 'b']);
  h.preloader.updateEnvironment({ pageLoaded: true });
  h.runIdle();
  removeCover();
  assert.equal(h.requests[0].canceled, false);
  removeBody();
  assert.equal(h.requests[0].canceled, true);
  h.preloader.register('new-page', ['c']);
  h.runIdle();
  h.requests[0].finish();
  assert.equal(h.preloader.isLoaded('a'), false);
  h.finish(); h.runIdle();
  assert.deepEqual(h.sources, ['a', 'c']);
  assert.equal(h.preloader.isLoaded('c'), true);
  assert.equal(h.maxInFlight, 1);
});
