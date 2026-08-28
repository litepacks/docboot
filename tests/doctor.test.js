import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Doctor } from '../src/doctor/index.js';
import { StatsCollector } from '../src/stats/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('Doctor diagnoses docs directory without errors', async () => {
  const config = {
    rootDir,
    docsDir: path.join(rootDir, 'docs'),
    outDir: path.join(rootDir, 'dist'),
    sidebar: null
  };

  const doctor = new Doctor(config, { quiet: true });
  const result = await doctor.diagnose();

  assert.strictEqual(result.errors.length, 0);
  assert.ok(result.pagesCount > 0);
  assert.ok(result.passes.length >= 2);
});

test('StatsCollector gathers documentation counts and asset sizes', async () => {
  const config = {
    rootDir,
    docsDir: path.join(rootDir, 'docs'),
    outDir: path.join(rootDir, 'dist'),
    sidebar: null,
    search: { boost: { title: 5, headings: 3, section: 2, text: 1 }, fuzzy: 0.2, prefix: true, maxResults: 10, minQueryLength: 2 }
  };

  const collector = new StatsCollector(config, { quiet: true });
  const stats = await collector.collect();

  assert.ok(stats.pageCount > 0);
  assert.ok(stats.totalWords > 0);
  assert.ok(stats.totalHeadings > 0);
  assert.ok(stats.buildElapsedMs >= 0);
  assert.ok(parseFloat(stats.cssSizeKb) > 0);
});
