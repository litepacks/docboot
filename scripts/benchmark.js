import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SiteBuilder } from '../src/compiler/builder.js';
import { CacheManager } from '../src/cache/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const benchTmpDir = path.join(rootDir, '.benchmark-temp');

function generateFixtures(targetDir, pageCount) {
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  fs.mkdirSync(targetDir, { recursive: true });

  for (let i = 1; i <= pageCount; i++) {
    const padded = String(i).padStart(3, '0');
    const content = `---
title: Benchmark Document ${i}
description: Synthetic benchmark fixture page number ${i} testing build speeds.
order: ${i}
---

# Benchmark Document ${i}

This is a synthetic benchmark document generated to measure cold build, warm build, and incremental rebuild performance.

## Section 1: Code Samples

Here is a representative code block:

\`\`\`javascript [benchmark-${i}.js]
function computeMetrics_${i}() {
  const dataset = Array.from({ length: 100 }, (_, idx) => idx * ${i});
  return dataset.reduce((acc, val) => acc + val, 0);
}
console.log('Result ${i}:', computeMetrics_${i}());
\`\`\`

## Section 2: Technical Specifications

- Page Index: ${i}
- Complexity: Standard technical article
- Internal Reference: [Link to Page 1](/benchmark-document-1)

\`\`\`typescript [types-${i}.ts]
export interface DocumentConfig_${i} {
  id: number;
  title: string;
  enabled: boolean;
}
\`\`\`
`;

    const subDir = i > 20 ? path.join(targetDir, `group-${Math.floor(i / 20)}`) : targetDir;
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, `doc-${padded}.md`), content, 'utf-8');
  }
}

async function runBenchmark() {
  console.log('\n  ▲ Docboot Benchmark Suite');
  console.log('  ────────────────────────────────────────────────────────');
  console.log(`  Node.js:  ${process.version}`);
  console.log(`  Platform: ${process.platform} (${process.arch})`);
  console.log(`  Date:     ${new Date().toISOString()}\n`);

  const scales = [10, 50, 100];
  const results = [];

  for (const count of scales) {
    const docsDir = path.join(benchTmpDir, `docs-${count}`);
    const outDir = path.join(benchTmpDir, `dist-${count}`);
    const cacheDir = path.join(benchTmpDir, `cache-${count}`);

    generateFixtures(docsDir, count);

    const config = {
      title: `Benchmark ${count}`,
      rootDir: benchTmpDir,
      docsDir: docsDir,
      outDir: outDir,
      cacheDir: cacheDir,
      base: '/',
      theme: { preset: 'zinc' },
      search: { fuzzy: 0.2, prefix: true },
      analytics: {},
      pwa: false
    };

    const silentLogger = {
      info: () => {},
      success: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {}
    };

    // 1. Cold Build (clean cache)
    if (fs.existsSync(cacheDir)) fs.rmSync(cacheDir, { recursive: true, force: true });
    if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });

    const coldBuilder = new SiteBuilder(config, silentLogger, false);
    coldBuilder.cacheManager = new CacheManager(cacheDir, docsDir);

    const t0 = performance.now();
    await coldBuilder.build();
    const coldDuration = (performance.now() - t0).toFixed(1);

    // Measure emitted asset sizes
    const cssPath = path.join(outDir, 'assets', 'docs.css');
    const jsPath = path.join(outDir, 'assets', 'docs.js');
    const searchPath = path.join(outDir, 'assets', 'search-index.json');

    const cssSize = fs.existsSync(cssPath) ? (fs.statSync(cssPath).size / 1024).toFixed(1) + ' KB' : '-';
    const jsSize = fs.existsSync(jsPath) ? (fs.statSync(jsPath).size / 1024).toFixed(1) + ' KB' : '-';
    const searchSize = fs.existsSync(searchPath) ? (fs.statSync(searchPath).size / 1024).toFixed(1) + ' KB' : '-';

    // 2. Warm Build (100% cache hits)
    const warmBuilder = new SiteBuilder(config, silentLogger, false);
    warmBuilder.cacheManager = new CacheManager(cacheDir, docsDir);

    const t1 = performance.now();
    await warmBuilder.build();
    const warmDuration = (performance.now() - t1).toFixed(1);

    // 3. Single-Page Rebuild (modify 1 file)
    const targetFile = path.join(docsDir, 'doc-001.md');
    fs.appendFileSync(targetFile, '\n<!-- Modified for single-page incremental benchmark -->\n');

    const incBuilder = new SiteBuilder(config, silentLogger, false);
    incBuilder.cacheManager = new CacheManager(cacheDir, docsDir);

    const t2 = performance.now();
    await incBuilder.build();
    const incDuration = (performance.now() - t2).toFixed(1);

    results.push({
      count: `${count} Pages`,
      cold: `${coldDuration} ms`,
      warm: `${warmDuration} ms`,
      incremental: `${incDuration} ms`,
      searchSize
    });
  }

  // Cleanup temp fixtures
  if (fs.existsSync(benchTmpDir)) {
    fs.rmSync(benchTmpDir, { recursive: true, force: true });
  }

  // Print results table
  console.log('  Benchmark Results:');
  console.table(results);
  console.log('  ✔ Benchmark run completed successfully.\n');
}

runBenchmark().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
