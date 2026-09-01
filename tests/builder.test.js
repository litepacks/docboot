import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../src/config/index.js';
import { SiteBuilder } from '../src/compiler/builder.js';

test('SiteBuilder builds full static site to dist', async () => {
  const rootDir = process.cwd();
  const config = await loadConfig(rootDir, {
    docs: './docs',
    out: './dist_test',
    clean: true
  });

  const builder = new SiteBuilder(config);
  const result = await builder.build({ isDev: false });

  assert.ok(result.pageCount >= 5, `Expected >= 5 pages, got ${result.pageCount}`);
  assert.ok(fs.existsSync(path.join(config.outDir, 'index.html')));
  assert.ok(fs.existsSync(path.join(config.outDir, 'getting-started', 'quick-start', 'index.html')));
  assert.ok(fs.existsSync(path.join(config.outDir, 'guide', 'rich-content', 'index.html')));
  assert.ok(fs.existsSync(path.join(config.outDir, 'assets', 'docs.css')));
  assert.ok(fs.existsSync(path.join(config.outDir, 'assets', 'docs.js')));
  const docsJsContent = fs.readFileSync(path.join(config.outDir, 'assets', 'docs.js'), 'utf-8');
  assert.ok(docsJsContent.length < 75000, `Expected minified docs.js < 75KB, got ${docsJsContent.length}`);
  assert.ok(fs.existsSync(path.join(config.outDir, 'search.json')));
  assert.ok(fs.existsSync(path.join(config.outDir, 'sitemap.xml')));
  assert.ok(fs.existsSync(path.join(config.outDir, 'robots.txt')));

  // Pre-compressed files (.gz & .br)
  assert.ok(fs.existsSync(path.join(config.outDir, 'index.html.gz')), 'Expected index.html.gz');
  assert.ok(fs.existsSync(path.join(config.outDir, 'index.html.br')), 'Expected index.html.br');

  assert.ok(fs.existsSync(path.join(config.outDir, 'guide', 'index.html')), 'Expected auto-generated category hub for /guide');

  // Read index.html and verify layout elements
  const indexHtml = fs.readFileSync(path.join(config.outDir, 'index.html'), 'utf-8');
  assert.match(indexHtml, /<!DOCTYPE html>/);
  assert.match(indexHtml, /Docboot/);
  assert.match(indexHtml, /docboot-search-modal/);
  assert.match(indexHtml, /docboot-mobile-drawer/);
  assert.match(indexHtml, /docboot-theme-toggle/);
  assert.match(indexHtml, /docboot-font-family-btn/);

  assert.ok(fs.existsSync(path.join(config.outDir, '404.html')), 'Expected pre-rendered 404.html');

  // Read 404.html and verify elements
  const notFoundHtml = fs.readFileSync(path.join(config.outDir, '404.html'), 'utf-8');
  assert.match(notFoundHtml, /Page Not Found/);
  assert.match(notFoundHtml, /404 Error/);
  assert.match(notFoundHtml, /Back to Home/);
  assert.match(notFoundHtml, /docboot-search-trigger/);

  // Read search.json and verify structure
  const searchJson = JSON.parse(fs.readFileSync(path.join(config.outDir, 'search.json'), 'utf-8'));
  assert.ok(Array.isArray(searchJson));
  assert.ok(searchJson.some(item => item.route === '/getting-started/quick-start' || item.route === '/getting-started'));

  // Clean up test dist
  fs.rmSync(config.outDir, { recursive: true, force: true });
});

test('SiteBuilder renders editLink and sourceLink in layout and respects frontmatter source', async () => {
  const rootDir = process.cwd();
  const config = await loadConfig(rootDir, {
    docs: './docs',
    out: './dist_edit_test',
    repo: 'https://github.com/docboot/docboot',
    editLink: true,
    sourceLink: true,
    clean: true
  });

  const builder = new SiteBuilder(config);
  await builder.build({ isDev: false });

  const richContentHtml = fs.readFileSync(path.join(config.outDir, 'guide', 'rich-content', 'index.html'), 'utf-8');
  assert.match(richContentHtml, /Edit this page on GitHub/);
  assert.match(richContentHtml, /https:\/\/github\.com\/docboot\/docboot\/edit\/main\/docs\/guide\/rich-content\.md/);
  assert.match(richContentHtml, /View source/);
  assert.match(richContentHtml, /https:\/\/github\.com\/docboot\/docboot\/blob\/main\/docs\/guide\/rich-content\.md/);

  fs.rmSync(config.outDir, { recursive: true, force: true });
});

test('SiteBuilder generates CNAME file when customDomain is configured', async () => {
  const rootDir = process.cwd();
  const config = await loadConfig(rootDir, {
    docs: './docs',
    out: './dist_cname_test',
    github: {
      customDomain: 'docs.docboot.dev'
    },
    clean: true
  });

  const builder = new SiteBuilder(config);
  await builder.build({ isDev: false });

  const cnamePath = path.join(config.outDir, 'CNAME');
  assert.ok(fs.existsSync(cnamePath), 'Expected CNAME file to be generated');
  assert.strictEqual(fs.readFileSync(cnamePath, 'utf-8').trim(), 'docs.docboot.dev');

  fs.rmSync(config.outDir, { recursive: true, force: true });
});

test('SiteBuilder renders HTML with custom base path', async () => {
  const rootDir = process.cwd();
  const config = await loadConfig(rootDir, {
    docs: './docs',
    out: './dist_base_test',
    base: '/docboot/',
    clean: true
  });

  const builder = new SiteBuilder(config);
  await builder.build({ isDev: false });

  const indexHtml = fs.readFileSync(path.join(config.outDir, 'index.html'), 'utf-8');
  assert.match(indexHtml, /href="\/docboot\/assets\/docs\.css"/);
  assert.match(indexHtml, /src="\/docboot\/assets\/docs\.js"/);
  assert.match(indexHtml, /href="\/docboot\/favicon\.svg"/);
  assert.match(indexHtml, /href="\/docboot\/manifest\.webmanifest"/);
  assert.match(indexHtml, /__DOCBOOT_BASE__ = "\/docboot\/"/);
  assert.match(indexHtml, /href="\/docboot\/guide\/rich-content"/);

  fs.rmSync(config.outDir, { recursive: true, force: true });
});

test('SiteBuilder respects theme visibility controls (themeToggle, presetMenu, fontSizeControl)', async () => {
  const rootDir = process.cwd();
  const config = await loadConfig(rootDir, {
    docs: './docs',
    out: './dist_theme_vis_test',
    theme: {
      themeToggle: false,
      presetMenu: false,
      fontSizeControl: false
    },
    clean: true
  });

  const builder = new SiteBuilder(config);
  await builder.build({ isDev: false });

  const indexHtml = fs.readFileSync(path.join(config.outDir, 'index.html'), 'utf-8');
  assert.doesNotMatch(indexHtml, /id="docboot-preset-toggle"/);
  assert.doesNotMatch(indexHtml, /id="docboot-theme-toggle"/);
  assert.doesNotMatch(indexHtml, /class="docboot-font-step-btn/);

  fs.rmSync(config.outDir, { recursive: true, force: true });
});

test('SiteBuilder generates PWA assets with auto-update support and dynamic cache versioning', async () => {
  const rootDir = process.cwd();
  const config = await loadConfig(rootDir, {
    docs: './docs',
    out: './dist_pwa_test',
    pwa: {
      enabled: true,
      autoUpdate: 'prompt',
      checkInterval: 1800000
    },
    clean: true
  });

  const builder = new SiteBuilder(config);
  await builder.build({ isDev: false });

  const swPath = path.join(config.outDir, 'sw.js');
  assert.ok(fs.existsSync(swPath), 'Expected sw.js to be generated in outDir');

  const swContent = fs.readFileSync(swPath, 'utf-8');
  assert.match(swContent, /docboot-cache-/);
  assert.match(swContent, /SKIP_WAITING/);
  assert.match(swContent, /self\.addEventListener\('message'/);

  const manifestPath = path.join(config.outDir, 'manifest.webmanifest');
  assert.ok(fs.existsSync(manifestPath), 'Expected manifest.webmanifest to be generated');

  const indexHtml = fs.readFileSync(path.join(config.outDir, 'index.html'), 'utf-8');
  assert.match(indexHtml, /navigator\.serviceWorker\.register/);
  assert.match(indexHtml, /controllerchange/);
  assert.match(indexHtml, /docboot:pwa-update/);
  assert.match(indexHtml, /"autoUpdate":"prompt"/);

  fs.rmSync(config.outDir, { recursive: true, force: true });
});
