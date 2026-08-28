import test from 'node:test';
import assert from 'node:assert';
import { normalizeMarkdownLink } from '../src/markdown/links.js';
import { parseMarkdown } from '../src/markdown/parser.js';

test('normalizeMarkdownLink converts relative markdown file links to clean routes', () => {
  // 1. Same-directory relative link
  assert.strictEqual(
    normalizeMarkdownLink('./installation.md', 'getting-started/index.md'),
    '/getting-started/installation'
  );

  // 2. Parent-directory relative link
  assert.strictEqual(
    normalizeMarkdownLink('../concepts/architecture.md', 'getting-started/first-app.md'),
    '/concepts/architecture'
  );

  // 3. Link with hash fragment
  assert.strictEqual(
    normalizeMarkdownLink('./state.md#computed-properties', 'guide/index.md'),
    '/guide/state#computed-properties'
  );

  // 4. Root README.md link
  assert.strictEqual(
    normalizeMarkdownLink('../README.md', 'getting-started/first-app.md'),
    '/'
  );

  // 5. Folder README / index link
  assert.strictEqual(
    normalizeMarkdownLink('/guide/README.md', 'getting-started/first-app.md'),
    '/guide'
  );

  assert.strictEqual(
    normalizeMarkdownLink('./index.md#setup', 'guide/state.md'),
    '/guide#setup'
  );

  // 6. External URLs & pure anchor hashes remain unchanged
  assert.strictEqual(normalizeMarkdownLink('https://github.com/litepacks/euix', 'README.md'), 'https://github.com/litepacks/euix');
  assert.strictEqual(normalizeMarkdownLink('#section-1', 'guide/state.md'), '#section-1');
  assert.strictEqual(normalizeMarkdownLink('mailto:info@example.com', 'README.md'), 'mailto:info@example.com');
});

test('parseMarkdown resolves markdown links accurately in rendered HTML', () => {
  const rawMd = `
[Installation Guide](./installation.md)
[Architecture](../concepts/architecture.md#c4)
[External Link](https://google.com)
`;

  const parsed = parseMarkdown(rawMd, { relativePath: 'getting-started/first-app.md' });

  assert.match(parsed.html, /href="\/getting-started\/installation"/);
  assert.match(parsed.html, /href="\/concepts\/architecture#c4"/);
  assert.match(parsed.html, /href="https:\/\/google\.com"/);
});

test('normalizeMarkdownLink and parseMarkdown respect base path for sub-directory hosting', () => {
  assert.strictEqual(
    normalizeMarkdownLink('./installation.md', 'getting-started/index.md', '/docboot/'),
    '/docboot/getting-started/installation'
  );
  assert.strictEqual(
    normalizeMarkdownLink('../README.md', 'getting-started/first-app.md', '/docboot/'),
    '/docboot/'
  );

  const rawMd = `[Installation Guide](./installation.md)`;
  const parsed = parseMarkdown(rawMd, { relativePath: 'getting-started/first-app.md', base: '/docboot/' });
  assert.match(parsed.html, /href="\/docboot\/getting-started\/installation"/);
});
