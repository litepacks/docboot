import test from 'node:test';
import assert from 'node:assert';
import { extractSections, normalizeText, createSnippet } from '../src/search/extractor.js';
import { buildSearchIndex } from '../src/search/indexer.js';
import { createSearchEngine } from '../src/search/runtime.js';

test('normalizeText strips code fences, html tags, and excess spaces', () => {
  const input = `
# Title

Here is \`inline code\` and a [link](https://example.com).

\`\`\`js
const a = 1;
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
  assert.ok(normalized.includes('Helpful tip!'));
  assert.ok(normalized.includes('HTML Content'));
});

test('createSnippet creates concise preview text with ellipsis', () => {
  const longText = 'This is a very long documentation paragraph designed to verify that createSnippet correctly trims the text to a specified maximum length and appends a clean ellipsis.';
  const snippet = createSnippet(longText, 60);
  assert.ok(snippet.length <= 65);
  assert.ok(snippet.endsWith('...'));
});

test('extractSections extracts section-level records for deep linking', () => {
  const page = {
    route: '/guide/state',
    title: 'State Management'
  };

  const rawMarkdown = `---
title: State Management
category: Guide
---

# State Management

Overview of reactive state in Docboot.

## Computed Properties

Computed values are derived declaratively from reactive sources.

## Watchers

Watchers execute side effects when specific state values change.
`;

  const sections = extractSections(page, rawMarkdown, { category: 'Guide' });
  assert.strictEqual(sections.length, 3);

  // Root section
  assert.strictEqual(sections[0].route, '/guide/state');
  assert.strictEqual(sections[0].title, 'State Management');

  // Subsections with anchor slugs
  assert.strictEqual(sections[1].route, '/guide/state#computed-properties');
  assert.strictEqual(sections[1].headings, 'Computed Properties');
  assert.strictEqual(sections[1].section, 'Guide › State Management › Computed Properties');
  assert.ok(sections[1].text.includes('derived declaratively'));

  assert.strictEqual(sections[2].route, '/guide/state#watchers');
  assert.strictEqual(sections[2].headings, 'Watchers');
  assert.ok(sections[2].text.includes('side effects'));
});

test('MiniSearch runtime handles exact, prefix, fuzzy search and boosting', () => {
  const documents = [
    {
      id: 'doc-1',
      title: 'Installation Guide',
      section: 'Guide › Installation Guide',
      headings: 'Node.js Setup',
      route: '/guide/installation',
      text: 'How to install docboot via npm or npx in modern documentation sites.',
      snippet: 'How to install docboot via npm'
    },
    {
      id: 'doc-2',
      title: 'State Management',
      section: 'Guide › State Management',
      headings: 'Reactivity',
      route: '/guide/state',
      text: 'Fine-grained reactive state models defined cleanly inside XML specs.',
      snippet: 'Fine-grained reactive state models'
    },
    {
      id: 'doc-3',
      title: 'State Management',
      section: 'Guide › State Management › Watchers',
      headings: 'Watchers',
      route: '/guide/state#watchers',
      text: 'Execute side effects when reactive state updates.',
      snippet: 'Execute side effects'
    }
  ];

  const searchEngine = createSearchEngine(documents, {
    boost: { title: 5, headings: 3, section: 2, text: 1 },
    fuzzy: 0.2,
    prefix: true,
    minQueryLength: 2
  });

  // 1. Exact search
  const resExact = searchEngine.search('installation');
  assert.ok(resExact.length > 0);
  assert.strictEqual(resExact[0].route, '/guide/installation');

  // 2. Prefix search ("inst" -> Installation)
  const resPrefix = searchEngine.search('inst');
  assert.ok(resPrefix.length > 0);
  assert.strictEqual(resPrefix[0].route, '/guide/installation');

  // 3. Section search ("watchers" -> /guide/state#watchers)
  const resSection = searchEngine.search('watchers');
  assert.ok(resSection.length > 0);
  assert.strictEqual(resSection[0].route, '/guide/state#watchers');

  // 4. Fuzzy / typo tolerance ("recative" -> reactive in state)
  const resFuzzy = searchEngine.search('recative');
  assert.ok(resFuzzy.length > 0);
  assert.ok(resFuzzy.some(r => r.title === 'State Management'));

  // 5. Short query below threshold returns empty
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
