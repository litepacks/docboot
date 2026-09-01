import test from 'node:test';
import assert from 'node:assert';
import { extractSections, normalizeText, createSnippet, createDynamicSnippet, highlightMatches, extractSymbols } from '../src/search/extractor.js';
import { buildSearchIndex } from '../src/search/indexer.js';
import { createSearchEngine } from '../src/search/runtime.js';

test('normalizeText strips code fences, html tags, and excess spaces while preserving words', () => {
  const input = `
# Title

Here is \`inline code\` and a [link](https://example.com).

\`\`\`js
const myVariable = 1;
function calculateTotal() {}
\`\`\`

:::tip
Helpful tip!
:::

<div class="custom">HTML Content</div>
`;

  const normalized = normalizeText(input);
  assert.ok(!normalized.includes('```'));
  assert.ok(!normalized.includes(':::'));
  assert.ok(!normalized.includes('<div'));
  assert.ok(normalized.includes('inline code'));
  assert.ok(normalized.includes('myVariable'));
  assert.ok(normalized.includes('calculateTotal'));
  assert.ok(normalized.includes('Helpful tip!'));
  assert.ok(normalized.includes('HTML Content'));
});

test('extractSymbols extracts CLI flags, inline backticks, and code tokens', () => {
  const md = `
Use \`docboot doctor --stale\` or \`--fix\` flag.

\`\`\`js
import { buildSearchIndex } from './indexer.js';
const config = { staleAfterDays: 30 };
\`\`\`
`;

  const symbols = extractSymbols(md);
  assert.ok(symbols.includes('--stale'), 'Should extract --stale flag');
  assert.ok(symbols.includes('--fix'), 'Should extract --fix flag');
  assert.ok(symbols.includes('buildSearchIndex'), 'Should extract code identifiers');
  assert.ok(symbols.includes('staleAfterDays'), 'Should extract config keys');
});

test('createDynamicSnippet centers window around query terms with leading and trailing ellipses', () => {
  const longText = 'Docboot is an ultra-fast documentation generator. In this section we discuss configuring custom search index boosting and fuzzy tolerance. Finally you can deploy to GitHub Pages with ease.';
  
  // 1. Search term near the middle
  const snippet = createDynamicSnippet(longText, 'boosting', 70);
  assert.ok(snippet.includes('boosting'), 'Snippet must contain the target query keyword');
  assert.ok(snippet.startsWith('...'), 'Snippet should have leading ellipsis if starting mid-sentence');
  assert.ok(snippet.endsWith('...'), 'Snippet should have trailing ellipsis if truncated');

  // 2. Search term at beginning
  const snippetStart = createDynamicSnippet(longText, 'Docboot', 50);
  assert.ok(snippetStart.startsWith('Docboot'));
  assert.ok(!snippetStart.startsWith('...'));

  // 3. Fallback when no match
  const fallback = createDynamicSnippet(longText, 'nonexistentword', 50);
  assert.ok(fallback.length <= 55);
});

test('highlightMatches safely wraps matched query tokens in HTML-safe <mark> tags', () => {
  const text = 'Build documentation with docboot & fast static search <script>alert(1)</script>';
  const highlighted = highlightMatches(text, 'docboot search');

  assert.ok(highlighted.includes('<mark class="bg-accent/20 text-accent font-semibold px-0.5 rounded-xs">docboot</mark>'));
  assert.ok(highlighted.includes('<mark class="bg-accent/20 text-accent font-semibold px-0.5 rounded-xs">search</mark>'));
  assert.ok(!highlighted.includes('<script>'), 'HTML must be escaped for XSS safety');
  assert.ok(highlighted.includes('&lt;script&gt;'), 'Dangerous tags must be entity escaped');
});

test('extractSections extracts section-level records and code symbols for deep linking', () => {
  const page = {
    route: '/guide/state',
    title: 'State Management'
  };

  const rawMarkdown = `---
title: State Management
category: Guide
---

# State Management

Overview of reactive state in Docboot using \`reactiveState()\`.

## Computed Properties

Computed values are derived declaratively from reactive sources using \`createComputed()\`.

\`\`\`js
const double = createComputed(() => count.value * 2);
\`\`\`

## Watchers

Watchers execute side effects when specific state values change with \`--watch\` flag.
`;

  const sections = extractSections(page, rawMarkdown, { category: 'Guide' });
  assert.strictEqual(sections.length, 3);

  // Root section
  assert.strictEqual(sections[0].route, '/guide/state');
  assert.strictEqual(sections[0].title, 'State Management');
  assert.ok(sections[0].symbols.includes('reactiveState'));

  // Subsections with anchor slugs & symbols
  assert.strictEqual(sections[1].route, '/guide/state#computed-properties');
  assert.strictEqual(sections[1].headings, 'Computed Properties');
  assert.strictEqual(sections[1].section, 'Guide › State Management › Computed Properties');
  assert.ok(sections[1].text.includes('derived declaratively'));
  assert.ok(sections[1].symbols.includes('createComputed'));

  assert.strictEqual(sections[2].route, '/guide/state#watchers');
  assert.strictEqual(sections[2].headings, 'Watchers');
  assert.ok(sections[2].symbols.includes('--watch'));
});

test('MiniSearch runtime handles exact, prefix, fuzzy search, code symbols and dynamic snippet', () => {
  const documents = [
    {
      id: 'doc-1',
      title: 'Installation Guide',
      section: 'Guide › Installation Guide',
      headings: 'Node.js Setup',
      symbols: 'docboot-cli --stale --pwa',
      route: '/guide/installation',
      text: 'How to install docboot via npm or npx in modern documentation sites.',
      snippet: 'How to install docboot via npm'
    },
    {
      id: 'doc-2',
      title: 'State Management',
      section: 'Guide › State Management',
      headings: 'Reactivity',
      symbols: 'createSignal useStore',
      route: '/guide/state',
      text: 'Fine-grained reactive state models defined cleanly inside XML specs with deep binding.',
      snippet: 'Fine-grained reactive state models'
    },
    {
      id: 'doc-3',
      title: 'State Management',
      section: 'Guide › State Management › Watchers',
      headings: 'Watchers',
      symbols: 'watchEffect',
      route: '/guide/state#watchers',
      text: 'Execute side effects when reactive state updates.',
      snippet: 'Execute side effects'
    }
  ];

  const searchEngine = createSearchEngine(documents, {
    boost: { title: 6, headings: 4, symbols: 3, section: 2, text: 1 },
    fuzzy: 0.2,
    prefix: true,
    minQueryLength: 2
  });

  // 1. Exact search
  const resExact = searchEngine.search('installation');
  assert.ok(resExact.length > 0);
  assert.strictEqual(resExact[0].route, '/guide/installation');

  // 2. Code symbol search ("--stale" or "createSignal")
  const resSymbol = searchEngine.search('createSignal');
  assert.ok(resSymbol.length > 0);
  assert.strictEqual(resSymbol[0].route, '/guide/state');

  // 3. Dynamic snippet verification (contains contextual match)
  const resDynamic = searchEngine.search('binding');
  assert.ok(resDynamic.length > 0);
  assert.ok(resDynamic[0].snippet.includes('binding'), 'Returned snippet should dynamically center on keyword');

  // 4. Prefix search ("inst" -> Installation)
  const resPrefix = searchEngine.search('inst');
  assert.ok(resPrefix.length > 0);
  assert.strictEqual(resPrefix[0].route, '/guide/installation');

  // 5. Section search ("watchers" -> /guide/state#watchers)
  const resSection = searchEngine.search('watchers');
  assert.ok(resSection.length > 0);
  assert.strictEqual(resSection[0].route, '/guide/state#watchers');

  // 6. Fuzzy / typo tolerance ("recative" -> reactive in state)
  const resFuzzy = searchEngine.search('recative');
  assert.ok(resFuzzy.length > 0);
  assert.ok(resFuzzy.some(r => r.title === 'State Management'));

  // 7. Short query below threshold returns empty
  const resShort = searchEngine.search('a');
  assert.strictEqual(resShort.length, 0);
});

test('buildSearchIndex guarantees unique IDs across pages and subheadings', () => {
  const pages = [
    {
      route: '/getting-started/installation',
      title: 'Installation',
      rawContent: `# Installation\n\nContent for installation.\n\n# Installation\n\nDuplicate heading.`
    }
  ];

  const { index } = buildSearchIndex(pages);
  const ids = index.map(item => item.id);
  const uniqueIds = new Set(ids);
  assert.strictEqual(ids.length, uniqueIds.size, 'All IDs in search index must be unique');
});

test('createSearchEngine supports toJSON pre-serialization and instant loadJSON rehydration', () => {
  const documents = [
    {
      id: 'doc-1',
      title: 'CLI Commands',
      section: 'Reference › CLI',
      symbols: '--stale --clean --build',
      route: '/reference/cli',
      text: 'Docboot CLI commands and global diagnostic flags for CI/CD.',
      snippet: 'Docboot CLI commands'
    },
    {
      id: 'doc-2',
      title: 'Theme Configuration',
      section: 'Guide › Themes',
      symbols: 'presetMenu darkMode',
      route: '/guide/themes',
      text: 'Custom theme presets and dark mode styling options.',
      snippet: 'Custom theme presets'
    }
  ];

  // 1. Create engine and serialize
  const engineOriginal = createSearchEngine(documents);
  const serialized = engineOriginal.toJSON();
  assert.ok(serialized && typeof serialized === 'object');

  // 2. Rehydrate engine from serialized data (0ms CPU delay)
  const engineRehydrated = createSearchEngine(serialized);
  const results = engineRehydrated.search('--stale');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].route, '/reference/cli');
  assert.strictEqual(results[0].title, 'CLI Commands');
});

test('createSearchEngine supports category filtering and inline @category query syntax', () => {
  const documents = [
    {
      id: 'doc-1',
      title: 'Configuration Options',
      section: 'Reference › Config',
      symbols: 'staleAfterDays',
      route: '/reference/config',
      text: 'Global docboot configuration file parameters and options.',
      snippet: 'Global docboot configuration'
    },
    {
      id: 'doc-2',
      title: 'Configuration Guide',
      section: 'Guide › Configuration',
      symbols: 'siteTitle docsDir',
      route: '/guide/config',
      text: 'How to configure your documentation site layout and assets.',
      snippet: 'How to configure your documentation'
    }
  ];

  const engine = createSearchEngine(documents);

  // 1. Unfiltered search matches both documents
  const allResults = engine.search('configuration');
  assert.strictEqual(allResults.length, 2);

  // 2. Explicit category filter matches only Guide
  const guideResults = engine.search('configuration', { category: 'guide' });
  assert.strictEqual(guideResults.length, 1);
  assert.strictEqual(guideResults[0].route, '/guide/config');

  // 3. Inline @reference prefix matches only Reference
  const refResults = engine.search('@reference configuration');
  assert.strictEqual(refResults.length, 1);
  assert.strictEqual(refResults[0].route, '/reference/config');
});

test('createSearchEngine suggest provides fuzzy fallback query suggestions', () => {
  const documents = [
    {
      id: 'doc-1',
      title: 'Installation Guide',
      section: 'Getting Started › Installation',
      route: '/getting-started/installation',
      text: 'Install docboot CLI using npm or pnpm package manager.'
    }
  ];

  const engine = createSearchEngine(documents);
  const suggestions = engine.suggest('instal');
  assert.ok(suggestions.length > 0);
  assert.ok(suggestions.some(s => s.suggestion.toLowerCase().includes('install')));
});


