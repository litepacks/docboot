import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { CacheManager } from '../src/cache/index.js';
import { hashString, hashObject } from '../src/cache/hasher.js';
import { SiteBuilder } from '../src/compiler/builder.js';
import { loadConfig } from '../src/config/index.js';

test('hasher computes deterministic hashes', () => {
  const h1 = hashString('# Title\n\nBody content');
  const h2 = hashString('# Title\n\nBody content');
  const h3 = hashString('# Title\n\nDifferent content');

  assert.strictEqual(h1, h2);
  assert.notStrictEqual(h1, h3);
  assert.strictEqual(h1.length, 16);

  const objHash1 = hashObject({ a: 1, b: 'zinc' });
  const objHash2 = hashObject({ b: 'zinc', a: 1 });
  assert.strictEqual(objHash1, objHash2, 'Keys ordering should produce identical hashes');
});

test('CacheManager creates manifest, saves page artifacts atomically and retrieves them', () => {
  const testCacheDir = path.resolve(process.cwd(), '.test_cache_1');
  const cache = new CacheManager(testCacheDir);

  const mockArtifact = {
    route: '/test-page',
    title: 'Test Page',
    html: '<h1>Test</h1>',
    toc: [],
    headings: [{ level: 1, title: 'Test', id: 'test' }],
    wordCount: 10
  };

  const sourceHash = hashString('raw content');
  const contentHash = hashString('content');
  const metadataHash = hashObject({ title: 'Test Page' });

  cache.setPageArtifact('test.md', mockArtifact, {
    sourceHash,
    contentHash,
    metadataHash
  });

  cache.save();

  assert.ok(fs.existsSync(path.join(testCacheDir, 'manifest.json')));
  assert.ok(cache.isFresh('test.md', sourceHash));
  assert.strictEqual(cache.isFresh('test.md', 'invalid_hash'), false);

  const retrieved = cache.getPageArtifact('test.md');
  assert.deepStrictEqual(retrieved.title, mockArtifact.title);
  assert.deepStrictEqual(retrieved.html, mockArtifact.html);

  // Metrics
  const metrics = cache.getMetrics();
  assert.strictEqual(metrics.pages, 1);
  assert.strictEqual(metrics.hits, 1);

  cache.clear();
  assert.strictEqual(fs.existsSync(testCacheDir), false);
});

test('CacheManager handles corrupted artifact gracefully without throwing', () => {
  const testCacheDir = path.resolve(process.cwd(), '.test_cache_2');
  const cache = new CacheManager(testCacheDir);

  const sourceHash = hashString('raw');
  cache.setPageArtifact('bad.md', { title: 'Bad' }, { sourceHash, contentHash: 'c', metadataHash: 'm' });
  cache.save();

  // Corrupt the page artifact file on disk
  const key = cache.getArtifactKey('bad.md');
  fs.writeFileSync(path.join(cache.pagesDir, `${key}.json`), '{ corrupted json ...');
  cache.memoryCache.clear();

  // Should recover as null and increment miss without throwing
  const retrieved = cache.getPageArtifact('bad.md');
  assert.strictEqual(retrieved, null);

  cache.clear();
});

test('SiteBuilder performs incremental compilation with cache hits on repeated builds', async () => {
  const rootDir = process.cwd();
  const config = await loadConfig(rootDir, {
    docs: './docs',
    out: './dist_cache_test',
    cacheDir: path.resolve(rootDir, '.test_cache_builder'),
    clean: true
  });

  const builder1 = new SiteBuilder(config);
  const res1 = await builder1.build();

  assert.ok(res1.pageCount >= 5);
  assert.strictEqual(res1.cacheMetrics.misses >= 5, true, 'First build should have cache misses');

  // Second build with unchanged files should hit cache
  const builder2 = new SiteBuilder(config);
  const res2 = await builder2.build();

  assert.ok(res2.cacheMetrics.hits >= 5, 'Second build should have cache hits');
  assert.strictEqual(res2.cacheMetrics.hitRate, 100, 'Hit rate should be 100% on unchanged docs');

  // Third build with --no-cache should bypass cache
  const builder3 = new SiteBuilder(config, null, { noCache: true });
  const res3 = await builder3.build();
  assert.strictEqual(res3.cacheMetrics.hits, 0, 'No-cache build should not hit cache');

  // Clean up
  builder1.cache.clear();
  fs.rmSync(config.outDir, { recursive: true, force: true });
  if (fs.existsSync(config.cacheDir)) {
    fs.rmSync(config.cacheDir, { recursive: true, force: true });
  }
});
