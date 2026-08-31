import test from 'node:test';
import assert from 'node:assert';
import { buildSidebar, buildPrevNextMap, buildBreadcrumbs } from '../src/routes/navigation.js';
import { filePathToRoute, deriveTitle } from '../src/routes/tree.js';

test('Sidebar Hierarchy: EUIX project structure categorization and numeric ordering', () => {
  // Simulates the exact structure reported by the user:
  // Root index.md + 9 numbered category folders
  const pages = [
    { relativePath: 'index.md', route: '/', title: 'Vanilla .EUIX Engine', frontmatter: {} },
    { relativePath: '01-getting-started/01-introduction.md', route: '/getting-started/introduction', title: 'Introduction', frontmatter: {} },
    { relativePath: '01-getting-started/02-quick-start.md', route: '/getting-started/quick-start', title: 'Quick Start', frontmatter: {} },
    { relativePath: '02-core-concepts/01-architecture.md', route: '/core-concepts/architecture', title: 'Runtime Architecture', frontmatter: {} },
    { relativePath: '02-core-concepts/02-state.md', route: '/core-concepts/state', title: 'State Management', frontmatter: {} },
    { relativePath: '03-components/01-basics.md', route: '/components/basics', title: 'Component Basics', frontmatter: {} },
    { relativePath: '04-actions/01-rest-api.md', route: '/actions/rest-api', title: 'REST API Integration & SWR', frontmatter: {} },
    { relativePath: '05-plugins/01-architecture.md', route: '/plugins/architecture', title: 'Plugin System Architecture', frontmatter: {} },
    { relativePath: '06-guides/01-performance.md', route: '/guides/performance', title: 'Performance Optimization', frontmatter: {} },
    { relativePath: '07-examples/01-counter.md', route: '/examples/counter', title: 'Interactive Counter Example', frontmatter: {} },
    { relativePath: '08-advanced/01-compiler.md', route: '/advanced/compiler', title: 'Compiler Internals', frontmatter: {} },
    { relativePath: '09-reference/01-markup.md', route: '/reference/markup', title: 'Markup Elements Reference', frontmatter: {} }
  ];

  const sidebar = buildSidebar(pages);

  // Should have 1 root group + 9 category groups = 10 top-level groups
  assert.strictEqual(sidebar.length, 10);

  // 1. Root group
  assert.strictEqual(sidebar[0].title, null);
  assert.strictEqual(sidebar[0].items[0].title, 'Vanilla .EUIX Engine');
  assert.strictEqual(sidebar[0].items[0].route, '/');

  // 2. Getting Started group
  assert.strictEqual(sidebar[1].title, 'Getting Started');
  assert.strictEqual(sidebar[1].items.length, 2);
  assert.strictEqual(sidebar[1].items[0].title, 'Introduction');
  assert.strictEqual(sidebar[1].items[1].title, 'Quick Start');

  // 3. Core Concepts group
  assert.strictEqual(sidebar[2].title, 'Core Concepts');
  assert.strictEqual(sidebar[2].items[0].title, 'Runtime Architecture');
  assert.strictEqual(sidebar[2].items[1].title, 'State Management');

  // 4. Components
  assert.strictEqual(sidebar[3].title, 'Components');
  assert.strictEqual(sidebar[3].items[0].title, 'Component Basics');

  // 5. Actions
  assert.strictEqual(sidebar[4].title, 'Actions');
  assert.strictEqual(sidebar[4].items[0].title, 'REST API Integration & SWR');

  // 6. Plugins
  assert.strictEqual(sidebar[5].title, 'Plugins');
  assert.strictEqual(sidebar[5].items[0].title, 'Plugin System Architecture');

  // 7. Guides
  assert.strictEqual(sidebar[6].title, 'Guides');

  // 8. Examples
  assert.strictEqual(sidebar[7].title, 'Examples');
  assert.strictEqual(sidebar[7].items[0].title, 'Interactive Counter Example');

  // 9. Advanced
  assert.strictEqual(sidebar[8].title, 'Advanced');

  // 10. Reference
  assert.strictEqual(sidebar[9].title, 'Reference');
  assert.strictEqual(sidebar[9].items[0].title, 'Markup Elements Reference');
});

test('Sidebar Hierarchy: Docs container prefix normalization when scanned from repo root', () => {
  // When scanned from repository root where files are inside docs/
  const pages = [
    { relativePath: 'docs/index.md', route: '/', title: 'Home', frontmatter: {} },
    { relativePath: 'docs/01-getting-started/01-intro.md', route: '/getting-started/intro', title: 'Intro', frontmatter: {} },
    { relativePath: 'docs/02-core-concepts/01-state.md', route: '/core-concepts/state', title: 'State', frontmatter: {} }
  ];

  const sidebar = buildSidebar(pages, null, { stripDocsPrefix: true });

  assert.strictEqual(sidebar.length, 3); // root + Getting Started + Core Concepts (NOT a single "Docs" group)
  assert.strictEqual(sidebar[1].title, 'Getting Started');
  assert.strictEqual(sidebar[2].title, 'Core Concepts');
});

test('Sidebar Hierarchy: Multi-level nested folder tree hierarchy', () => {
  const pages = [
    { relativePath: 'index.md', route: '/', title: 'Home', frontmatter: {} },
    { relativePath: 'guide/01-intro.md', route: '/guide/intro', title: 'Intro', frontmatter: {} },
    { relativePath: 'guide/advanced/01-performance.md', route: '/guide/advanced/performance', title: 'Performance', frontmatter: {} },
    { relativePath: 'guide/advanced/02-internals.md', route: '/guide/advanced/internals', title: 'Internals', frontmatter: {} },
    { relativePath: 'guide/advanced/deep/01-memory.md', route: '/guide/advanced/deep/memory', title: 'Memory', frontmatter: {} }
  ];

  const sidebar = buildSidebar(pages);

  assert.strictEqual(sidebar.length, 2); // root + Guide
  const guideGroup = sidebar[1];
  assert.strictEqual(guideGroup.title, 'Guide');
  assert.strictEqual(guideGroup.items[0].title, 'Intro');

  // Advanced sub-group
  const advancedSubGroup = guideGroup.items[1];
  assert.strictEqual(advancedSubGroup.title, 'Advanced');
  assert.strictEqual(advancedSubGroup.items[0].title, 'Performance');
  assert.strictEqual(advancedSubGroup.items[1].title, 'Internals');

  // Deep sub-group
  const deepSubGroup = advancedSubGroup.items[2];
  assert.strictEqual(deepSubGroup.title, 'Deep');
  assert.strictEqual(deepSubGroup.items[0].title, 'Memory');
});

test('Sidebar Hierarchy: _meta.json per-directory overrides for title, order, badge, and hidden', () => {
  const metaMap = new Map();
  metaMap.set('01-getting-started', {
    '02-quick-start': { title: '⚡ Fast Start', order: 1, badge: 'Popular' },
    '01-introduction': { title: 'Overview', order: 2 },
    'secret-draft': { hidden: true }
  });

  const pages = [
    { relativePath: '01-getting-started/01-introduction.md', route: '/getting-started/introduction', title: 'Introduction', frontmatter: {} },
    { relativePath: '01-getting-started/02-quick-start.md', route: '/getting-started/quick-start', title: 'Quick Start', frontmatter: {} },
    { relativePath: '01-getting-started/secret-draft.md', route: '/getting-started/secret-draft', title: 'Secret', frontmatter: {} }
  ];

  const sidebar = buildSidebar(pages, null, { metaMap });
  const gettingStartedGroup = sidebar[0];

  assert.strictEqual(gettingStartedGroup.title, 'Getting Started');
  assert.strictEqual(gettingStartedGroup.items.length, 2); // secret-draft is hidden
  assert.strictEqual(gettingStartedGroup.items[0].title, '⚡ Fast Start');
  assert.strictEqual(gettingStartedGroup.items[0].badge, 'Popular');
  assert.strictEqual(gettingStartedGroup.items[1].title, 'Overview');
});

test('Sidebar Hierarchy: Custom sidebar configuration with groups overrides', () => {
  const pages = [
    { relativePath: '01-getting-started/01-intro.md', route: '/getting-started/intro', title: 'Intro', frontmatter: {} },
    { relativePath: '02-core/01-arch.md', route: '/core/arch', title: 'Arch', frontmatter: {} }
  ];

  const customSidebarConfig = {
    collapsible: true,
    collapsed: true,
    groups: {
      'getting-started': { title: '🚀 Start Here', order: 2 },
      'core': { title: '🧠 Core Architecture', order: 1, badge: 'v2' }
    }
  };

  const sidebar = buildSidebar(pages, customSidebarConfig);

  assert.strictEqual(sidebar[0].title, '🧠 Core Architecture');
  assert.strictEqual(sidebar[0].badge, 'v2');
  assert.strictEqual(sidebar[1].title, '🚀 Start Here');
});

test('Sidebar Hierarchy: buildPrevNextMap preserves DFS tree ordering across nested folders', () => {
  const pages = [
    { relativePath: 'index.md', route: '/', title: 'Home', frontmatter: {} },
    { relativePath: '01-start/01-intro.md', route: '/start/intro', title: 'Intro', frontmatter: {} },
    { relativePath: '01-start/02-install.md', route: '/start/install', title: 'Install', frontmatter: {} },
    { relativePath: '02-guide/01-basics.md', route: '/guide/basics', title: 'Basics', frontmatter: {} }
  ];

  const sidebar = buildSidebar(pages);
  const prevNext = buildPrevNextMap(sidebar);

  assert.deepStrictEqual(prevNext.get('/start/intro'), {
    prev: { title: 'Home', route: '/' },
    next: { title: 'Install', route: '/start/install' }
  });

  assert.deepStrictEqual(prevNext.get('/start/install'), {
    prev: { title: 'Intro', route: '/start/intro' },
    next: { title: 'Basics', route: '/guide/basics' }
  });
});

test('Sidebar Hierarchy: sort "natural" and useHeuristics false disables heuristic group order', () => {
  // Without numeric prefixes, unnumbered folders normally use DEFAULT_GROUP_ORDER
  // With sort: 'natural', they should sort purely alphabetically
  const pages = [
    { relativePath: 'guide/01-item.md', route: '/guide/item', title: 'Guide Item', frontmatter: {} },
    { relativePath: 'api/01-item.md', route: '/api/item', title: 'API Item', frontmatter: {} },
    { relativePath: 'getting-started/01-item.md', route: '/getting-started/item', title: 'Start Item', frontmatter: {} }
  ];

  // Default (heuristic): Getting Started (10) -> Guide (25) -> API (85)
  const defaultSidebar = buildSidebar(pages);
  assert.strictEqual(defaultSidebar[0].title, 'Getting Started');
  assert.strictEqual(defaultSidebar[1].title, 'Guide');
  assert.strictEqual(defaultSidebar[2].title, 'Api');

  // Natural sort: API -> Getting Started -> Guide
  const naturalSidebar = buildSidebar(pages, { sort: 'natural' });
  assert.strictEqual(naturalSidebar[0].title, 'Api');
  assert.strictEqual(naturalSidebar[1].title, 'Getting Started');
  assert.strictEqual(naturalSidebar[2].title, 'Guide');

  // Custom defaultGroupOrder
  const customOrderSidebar = buildSidebar(pages, {
    useHeuristics: false,
    defaultGroupOrder: {
      'api': 1,
      'guide': 2,
      'getting-started': 3
    }
  });
  assert.strictEqual(customOrderSidebar[0].title, 'Api');
  assert.strictEqual(customOrderSidebar[1].title, 'Guide');
  assert.strictEqual(customOrderSidebar[2].title, 'Getting Started');
});

