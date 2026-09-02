import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  normalizeRoutePath,
  buildRedirectManifest,
  renderRedirectHtml,
  findClosestRouteSuggestion
} from '../src/routes/redirects.js';
import { Doctor } from '../src/doctor/index.js';
import { SiteBuilder } from '../src/compiler/builder.js';
import { extractSections } from '../src/search/extractor.js';
import { buildSearchIndex } from '../src/search/indexer.js';
import { createSearchEngine } from '../src/search/runtime.js';

test('normalizeRoutePath normalizes various route and alias formats', () => {
  assert.strictEqual(normalizeRoutePath('/old-api').pathOnly, '/old-api');
  assert.strictEqual(normalizeRoutePath('old-api').pathOnly, '/old-api');
  assert.strictEqual(normalizeRoutePath('/old-api/').pathOnly, '/old-api');
  assert.strictEqual(normalizeRoutePath('/old-api.html').pathOnly, '/old-api');
  assert.strictEqual(normalizeRoutePath('/old-api/index.html').pathOnly, '/old-api');
  assert.strictEqual(normalizeRoutePath('/guide/install.md').pathOnly, '/guide/install');
  assert.strictEqual(normalizeRoutePath('').pathOnly, '/');
  assert.strictEqual(normalizeRoutePath('/').pathOnly, '/');
  assert.strictEqual(normalizeRoutePath('/index').pathOnly, '/');

  // Query and Hash extraction
  const withAnchor = normalizeRoutePath('/reference/configuration#search');
  assert.strictEqual(withAnchor.pathOnly, '/reference/configuration');
  assert.strictEqual(withAnchor.hash, 'search');
  assert.strictEqual(withAnchor.route, '/reference/configuration#search');

  const withQuery = normalizeRoutePath('/reference/api?tab=node&lang=ts#client');
  assert.strictEqual(withQuery.pathOnly, '/reference/api');
  assert.strictEqual(withQuery.query, 'tab=node&lang=ts');
  assert.strictEqual(withQuery.hash, 'client');

  // External URLs
  const external = normalizeRoutePath('https://legacy.example.com/docs');
  assert.strictEqual(external.isExternal, true);
  assert.strictEqual(external.isDangerous, false);

  // Dangerous Schemes
  const dangerous = normalizeRoutePath('javascript:alert(1)');
  assert.strictEqual(dangerous.isDangerous, true);
});

test('findClosestRouteSuggestion suggests closest canonical match', () => {
  const validRoutes = ['/getting-started', '/guide/installation', '/reference/configuration', '/tooling/build-cache'];
  const suggestion = findClosestRouteSuggestion('/reference/config', validRoutes);
  assert.strictEqual(suggestion, '/reference/configuration');

  const suggestion2 = findClosestRouteSuggestion('/install', validRoutes);
  assert.strictEqual(suggestion2, '/guide/installation');
});

test('buildRedirectManifest builds normalized graph with aliases, redirects, and redirectFrom', () => {
  const pages = [
    {
      route: '/getting-started/installation',
      relativePath: 'getting-started/installation.md',
      title: 'Installation',
      headings: [{ id: 'quick-start', title: 'Quick Start', level: 2 }],
      frontmatter: {
        aliases: ['/install', 'setup'],
        redirectFrom: ['/old-install']
      }
    },
    {
      route: '/reference/configuration',
      relativePath: 'reference/configuration.md',
      title: 'Configuration Reference',
      headings: [{ id: 'search-options', title: 'Search Options', level: 2 }],
      frontmatter: {}
    },
    {
      route: '/tooling/build-cache',
      relativePath: 'tooling/build-cache.md',
      title: 'Build Cache',
      headings: [],
      frontmatter: {
        aliases: ['/cache', '/compiler-cache']
      }
    }
  ];

  const configRedirects = {
    '/old-config': '/reference/configuration#search-options',
    '/guide/install': '/getting-started/installation',
    '/external-help': 'https://help.example.com'
  };

  const manifest = buildRedirectManifest(pages, configRedirects, { flattenChains: true });

  assert.strictEqual(manifest.errors.length, 0, `Expected 0 errors, got: ${JSON.stringify(manifest.errors)}`);
  assert.strictEqual(manifest.stats.aliasCount, 5); // /install, /setup, /old-install, /cache, /compiler-cache
  assert.strictEqual(manifest.stats.redirectCount, 2); // /old-config, /guide/install
  assert.strictEqual(manifest.stats.externalCount, 1); // /external-help

  // Aliases point to canonical routes
  assert.strictEqual(manifest.flattenedRedirects.get('/install').target, '/getting-started/installation');
  assert.strictEqual(manifest.flattenedRedirects.get('/setup').target, '/getting-started/installation');
  assert.strictEqual(manifest.flattenedRedirects.get('/old-install').target, '/getting-started/installation');
  assert.strictEqual(manifest.flattenedRedirects.get('/cache').target, '/tooling/build-cache');

  // Config redirect with anchor preserved
  assert.strictEqual(manifest.flattenedRedirects.get('/old-config').target, '/reference/configuration#search-options');
  assert.strictEqual(manifest.flattenedRedirects.get('/old-config').targetAnchor, 'search-options');

  // External redirect
  assert.strictEqual(manifest.flattenedRedirects.get('/external-help').isExternal, true);
  assert.strictEqual(manifest.flattenedRedirects.get('/external-help').target, 'https://help.example.com');
});

test('buildRedirectManifest detects redirect chains and flattens them', () => {
  const pages = [
    {
      route: '/destination',
      relativePath: 'destination.md',
      title: 'Final Destination',
      headings: []
    }
  ];

  const configRedirects = {
    '/a': '/b',
    '/b': '/c',
    '/c': '/destination'
  };

  const manifest = buildRedirectManifest(pages, configRedirects, { flattenChains: true });

  const chainWarning = manifest.warnings.find(w => w.type === 'Redirect Chain');
  assert.ok(chainWarning, 'Should warn about redirect chain /a -> /b -> /c -> /destination');

  // Flattened targets should all point directly to /destination
  assert.strictEqual(manifest.flattenedRedirects.get('/a').target, '/destination');
  assert.strictEqual(manifest.flattenedRedirects.get('/b').target, '/destination');
  assert.strictEqual(manifest.flattenedRedirects.get('/c').target, '/destination');
});

test('buildRedirectManifest detects redirect loops (2-hop and multi-hop)', () => {
  const pages = [
    { route: '/valid', relativePath: 'valid.md', headings: [] }
  ];

  const configRedirects = {
    '/loop-a': '/loop-b',
    '/loop-b': '/loop-c',
    '/loop-c': '/loop-a'
  };

  const manifest = buildRedirectManifest(pages, configRedirects);

  const loopError = manifest.errors.find(e => e.type === 'Redirect Loop');
  assert.ok(loopError, 'Should catch multi-hop redirect loop /loop-a -> /loop-b -> /loop-c -> /loop-a');
});

test('buildRedirectManifest detects missing redirect targets with suggestions', () => {
  const pages = [
    { route: '/reference/configuration', relativePath: 'reference/configuration.md', headings: [] }
  ];

  const configRedirects = {
    '/old-config': '/reference/config'
  };

  const manifest = buildRedirectManifest(pages, configRedirects);

  const missingError = manifest.errors.find(e => e.type === 'Missing Redirect Target');
  assert.ok(missingError, 'Should report missing redirect target');
  assert.ok(missingError.suggestion.includes('/reference/configuration'), 'Should provide close match suggestion');
});

test('buildRedirectManifest detects broken redirect anchor', () => {
  const pages = [
    {
      route: '/reference/configuration',
      relativePath: 'reference/configuration.md',
      headings: [{ id: 'valid-heading', title: 'Valid Heading', level: 2 }]
    }
  ];

  const configRedirects = {
    '/old-config': '/reference/configuration#non-existent-section'
  };

  const manifest = buildRedirectManifest(pages, configRedirects);

  const anchorWarning = manifest.warnings.find(w => w.type === 'Broken Redirect Anchor');
  assert.ok(anchorWarning, 'Should warn about missing anchor #non-existent-section');
});

test('buildRedirectManifest detects canonical route collision and alias conflict', () => {
  const pages = [
    {
      route: '/api',
      relativePath: 'docs/api.md',
      headings: []
    },
    {
      route: '/tooling/cache',
      relativePath: 'docs/tooling/cache.md',
      frontmatter: { aliases: ['/common-alias'] }
    },
    {
      route: '/reference/cache',
      relativePath: 'docs/reference/cache.md',
      frontmatter: { aliases: ['/common-alias'] }
    }
  ];

  const configRedirects = {
    '/api': '/reference/api' // Collides with real page /api
  };

  const manifest = buildRedirectManifest(pages, configRedirects);

  const routeConflict = manifest.errors.find(e => e.type === 'Route Conflict');
  assert.ok(routeConflict, 'Should detect route conflict where redirect source matches real page');

  const aliasConflict = manifest.errors.find(e => e.type === 'Alias Conflict');
  assert.ok(aliasConflict, 'Should detect alias collision where two pages declare /common-alias');
});

test('buildRedirectManifest rejects dangerous URL schemes and external aliases', () => {
  const pages = [
    {
      route: '/guide',
      relativePath: 'guide.md',
      frontmatter: { aliases: ['https://external-evil.com'] }
    }
  ];

  const configRedirects = {
    '/xss': 'javascript:alert(1)'
  };

  const manifest = buildRedirectManifest(pages, configRedirects);

  const secError = manifest.errors.find(e => e.type === 'Security Error');
  assert.ok(secError, 'Should reject javascript: URI scheme');

  const extAliasError = manifest.errors.find(e => e.type === 'Invalid Alias Target');
  assert.ok(extAliasError, 'Should reject external URL in frontmatter aliases');
});

test('renderRedirectHtml produces accessible, SEO-friendly redirect document', () => {
  const html = renderRedirectHtml({
    targetUrl: '/docboot/reference/api/',
    canonicalUrl: '/docboot/reference/api/',
    title: 'Redirecting to /docboot/reference/api/'
  });

  assert.ok(html.includes('<meta http-equiv="refresh" content="0; url=/docboot/reference/api/">'), 'Includes meta refresh');
  assert.ok(html.includes('<link rel="canonical" href="/docboot/reference/api/">'), 'Includes link canonical');
  assert.ok(html.includes('<meta name="robots" content="noindex, follow">'), 'Includes noindex');
  assert.ok(html.includes('window.location.replace("/docboot/reference/api/");'), 'Includes JS replace');
  assert.ok(html.includes('<a href="/docboot/reference/api/"'), 'Includes fallback anchor link');
  assert.ok(html.includes('This page has moved.'), 'Includes human-readable copy');
});

test('Search canonicalization: searching alias returns canonical page without duplicates', () => {
  const page = {
    route: '/tooling/build-cache',
    title: 'Build Cache'
  };
  const rawContent = `# Build Cache\n\nDocboot utilizes multi-tier incremental compilation caching.`;
  const frontmatter = {
    aliases: ['/cache', '/incremental-cache'],
    keywords: ['caching', 'turbo-speed']
  };

  const sections = extractSections(page, rawContent, frontmatter);
  const searchIndexData = buildSearchIndex([{ ...page, frontmatter, rawContent, searchEntries: sections }]);
  const searchEngine = createSearchEngine(searchIndexData.index);

  // Search by alias keyword "incremental-cache"
  const results = searchEngine.search('incremental-cache');
  assert.ok(results.length > 0, 'Should find page when searching alias term');
  assert.strictEqual(results[0].route, '/tooling/build-cache', 'Search result should point to the canonical route');
});

test('Doctor diagnosed passes, chains and loops with buildRedirectManifest', async () => {
  const config = {
    rootDir: 'docs',
    redirects: {
      '/old-a': '/old-b',
      '/old-b': '/old-c',
      '/loop-1': '/loop-2',
      '/loop-2': '/loop-1'
    }
  };

  const doctor = new Doctor(config);
  const result = await doctor.diagnose({
    pagesOverride: [
      {
        route: '/old-c',
        relativePath: 'old-c.md',
        title: 'Target',
        rawContent: '# Target',
        html: '<h1>Target</h1>',
        internalLinks: [],
        referencedAssets: []
      }
    ]
  });

  const chainWarning = result.warnings.find(w => w.type === 'Redirect Chain');
  assert.ok(chainWarning, 'Doctor should detect redirect chain /old-a -> /old-b -> /old-c');

  const loopError = result.errors.find(e => e.type === 'Redirect Loop');
  assert.ok(loopError, 'Doctor should detect redirect loop /loop-1 <-> /loop-2');
});

test('SiteBuilder: generates static redirect HTML, Netlify _redirects, and excludes from sitemap', async () => {
  const tmpDir = path.join(process.cwd(), 'tests', '.tmp-redirects-' + Date.now());
  const docsDir = path.join(tmpDir, 'docs');
  const outDir = path.join(tmpDir, 'dist');
  fs.mkdirSync(docsDir, { recursive: true });

  // Create real pages with aliases
  fs.writeFileSync(
    path.join(docsDir, 'index.md'),
    `---
title: Home
---
# Home
Welcome home.`,
    'utf-8'
  );

  fs.writeFileSync(
    path.join(docsDir, 'cache.md'),
    `---
title: Build Cache
aliases:
  - /caching
  - /compiler-cache
---
# Build Cache
Detailed cache information.`,
    'utf-8'
  );

  const config = {
    rootDir: tmpDir,
    docsDir,
    outDir,
    base: '/subpath/',
    siteUrl: 'https://docs.example.com',
    redirects: {
      '/old-home': '/',
      '/legacy-cache': '/cache'
    }
  };

  const builder = new SiteBuilder(config, { quiet: true });
  const result = await builder.build({ isDev: false });

  assert.strictEqual(result.redirectStats.canonicalCount, 2);
  assert.strictEqual(result.redirectStats.aliasCount, 2);
  assert.strictEqual(result.redirectStats.redirectCount, 2);

  // Check generated redirect files
  const cachingRedirectHtml = fs.readFileSync(path.join(outDir, 'caching', 'index.html'), 'utf-8');
  assert.ok(cachingRedirectHtml.includes('window.location.replace("/subpath/cache");'), 'Includes base-aware target in JS');
  assert.ok(cachingRedirectHtml.includes('<link rel="canonical" href="/subpath/cache">'), 'Includes canonical link with base');

  const legacyCacheRedirectHtml = fs.readFileSync(path.join(outDir, 'legacy-cache', 'index.html'), 'utf-8');
  assert.ok(legacyCacheRedirectHtml.includes('window.location.replace("/subpath/cache");'), 'Legacy redirect points to /subpath/cache');

  // Check _redirects
  const netlifyRedirects = fs.readFileSync(path.join(outDir, '_redirects'), 'utf-8');
  assert.ok(netlifyRedirects.includes('/caching /subpath/cache 301'));
  assert.ok(netlifyRedirects.includes('/legacy-cache /subpath/cache 301'));

  // Check sitemap.xml does NOT contain redirect or alias routes
  const sitemapXml = fs.readFileSync(path.join(outDir, 'sitemap.xml'), 'utf-8');
  assert.ok(!sitemapXml.includes('/caching'), 'Sitemap must not contain alias /caching');
  assert.ok(!sitemapXml.includes('/legacy-cache'), 'Sitemap must not contain redirect /legacy-cache');
  assert.ok(sitemapXml.includes('/subpath/cache'), 'Sitemap contains canonical page /subpath/cache');

  // Test cleanup on subsequent build with removed redirect
  const config2 = {
    ...config,
    redirects: {
      '/old-home': '/'
      // /legacy-cache removed
    }
  };

  const builder2 = new SiteBuilder(config2, { quiet: true });
  await builder2.build({ isDev: false });

  // /legacy-cache directory should be pruned
  assert.strictEqual(fs.existsSync(path.join(outDir, 'legacy-cache')), false, 'Stale redirect folder should be pruned');

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

