import test from 'node:test';
import assert from 'node:assert';
import { filePathToRoute, deriveTitle, formatSegmentName, stripNumericPrefix } from '../src/routes/tree.js';
import { buildSidebar, buildPrevNextMap, buildBreadcrumbs } from '../src/routes/navigation.js';

test('filePathToRoute converts file paths to clean routes', () => {
  assert.strictEqual(filePathToRoute('README.md'), '/');
  assert.strictEqual(filePathToRoute('index.md'), '/');
  assert.strictEqual(filePathToRoute('getting-started.md'), '/getting-started');
  assert.strictEqual(filePathToRoute('guide/README.md'), '/guide');
  assert.strictEqual(filePathToRoute('guide/installation.md'), '/guide/installation');
  assert.strictEqual(filePathToRoute('api/runtime.md'), '/api/runtime');

  // Numeric prefix stripping
  assert.strictEqual(filePathToRoute('01-getting-started.md'), '/getting-started');
  assert.strictEqual(filePathToRoute('02_configuration.md'), '/configuration');
  assert.strictEqual(filePathToRoute('01-guide/03-api.md'), '/guide/api');
});

test('deriveTitle formats titles and strips numeric prefixes', () => {
  assert.strictEqual(deriveTitle('01-getting-started.md'), 'Getting Started');
  assert.strictEqual(deriveTitle('02_advanced_config.md'), 'Advanced Config');
  assert.strictEqual(deriveTitle('guide/03-state-management.md'), 'State Management');
});

test('buildSidebar and buildPrevNextMap calculate navigation', () => {
  const pages = [
    { relativePath: 'README.md', route: '/', title: 'Home', frontmatter: { order: 1 } },
    { relativePath: '01-getting-started.md', route: '/getting-started', title: 'Getting Started', frontmatter: {} },
    { relativePath: 'guide/01-installation.md', route: '/guide/installation', title: 'Installation', frontmatter: {} },
    { relativePath: 'guide/02-state.md', route: '/guide/state', title: 'State', frontmatter: {} }
  ];

  const sidebar = buildSidebar(pages);
  assert.strictEqual(sidebar.length, 2); // root group + guide group

  const prevNext = buildPrevNextMap(sidebar);
  assert.deepStrictEqual(prevNext.get('/getting-started'), {
    prev: { title: 'Home', route: '/' },
    next: { title: 'Installation', route: '/guide/installation' }
  });
});
