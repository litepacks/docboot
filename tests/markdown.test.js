import test from 'node:test';
import assert from 'node:assert';
import { parseMarkdown } from '../src/markdown/parser.js';
import { slugify } from '../src/markdown/toc.js';

test('parseMarkdown parses frontmatter and markdown body', () => {
  const md = `---
title: My Custom Page
description: Page description
order: 5
---

# Main Title

This is introductory paragraph with **bold** text and [link](/test).
`;

  const parsed = parseMarkdown(md);
  assert.strictEqual(parsed.frontmatter.title, 'My Custom Page');
  assert.strictEqual(parsed.frontmatter.order, 5);
  assert.match(parsed.html, /<h1 id="main-title"/);
  assert.match(parsed.html, /introductory paragraph/);
  assert.strictEqual(parsed.headings.length, 1);
  assert.strictEqual(parsed.headings[0].id, 'main-title');
});

test('parseMarkdown handles callout blocks', () => {
  const md = `
:::note Info Header
Important note content.
:::

:::tip
Helpful tip content.
:::
`;

  const parsed = parseMarkdown(md);
  assert.match(parsed.html, /docboot-callout/);
  assert.match(parsed.html, /Info Header/);
  assert.match(parsed.html, /Important note content/);
  assert.match(parsed.html, /Helpful tip content/);
});

test('parseMarkdown handles code blocks and copy buttons', () => {
  const md = `
\`\`\`js title="app.js"
const message = "Hello Docs";
console.log(message);
\`\`\`
`;

  const parsed = parseMarkdown(md);
  assert.match(parsed.html, /docboot-codeblock/);
  assert.match(parsed.html, /app\.js/);
  assert.match(parsed.html, /docboot-copy-btn/);
  assert.match(parsed.html, /data-code="const message/);
});

test('parseMarkdown handles mermaid diagrams and auto-quotes complex node labels', () => {
  const md = `
\`\`\`mermaid
graph TD
  CLI[CLI Tooling / bin] --> AppInit[src/server.js: createApp]
  AppInit --> Express[Express 5 Server]
\`\`\`
`;

  const parsed = parseMarkdown(md);
  assert.match(parsed.html, /docboot-mermaid-wrapper/);
  assert.match(parsed.html, /<pre class="mermaid/);
  assert.match(parsed.html, /CLI\[(&quot;|")CLI Tooling \/ bin(&quot;|")\]/);
  assert.match(parsed.html, /AppInit\[(&quot;|")src\/server\.js: createApp(&quot;|")\]/);
});

test('parseMarkdown extracts table of contents and cleans emojis and HTML entities in slugs', () => {
  const md = `
# Page Title
## 🧪 Examples & Starter Kits
### Subsection A & Setup
### Subsection B
## State &amp; Reactivity
`;

  const parsed = parseMarkdown(md);
  assert.strictEqual(parsed.toc.length, 4);
  assert.strictEqual(parsed.toc[0].title, '🧪 Examples & Starter Kits');
  assert.strictEqual(parsed.toc[0].id, 'examples-starter-kits');

  assert.strictEqual(parsed.toc[1].title, 'Subsection A & Setup');
  assert.strictEqual(parsed.toc[1].id, 'subsection-a-setup');

  assert.strictEqual(parsed.toc[3].title, 'State & Reactivity');
  assert.strictEqual(parsed.toc[3].id, 'state-reactivity');

  // Verify slugify directly
  assert.strictEqual(slugify('🧪 Examples & Starter Kits'), 'examples-starter-kits');
  assert.strictEqual(slugify('Deployment &amp; Production Configuration'), 'deployment-production-configuration');
});

test('parseMarkdown renders badges and shield links inline without figure or ext icon', () => {
  const md = `
[![CI Status](https://github.com/docboot/docboot/workflows/ci/badge.svg)](https://github.com/docboot/docboot/actions)
`;

  const parsed = parseMarkdown(md);
  assert.match(parsed.html, /badge\.svg/);
  assert.doesNotMatch(parsed.html, /docboot-figure/);
  assert.doesNotMatch(parsed.html, /ext-link-icon/);
});

test('parseMarkdown parses markdown tables and standard formatting', () => {
  const md = `
| Command | Flag | Description |
| :--- | :--- | :--- |
| build | \`-b\` | Build production site |
| dev | \`-p\` | Start local dev server |
`;

  const parsed = parseMarkdown(md);
  assert.match(parsed.html, /<table/);
  assert.match(parsed.html, /<th[^>]*>Command<\/th>/);
  assert.match(parsed.html, /<td[^>]*>Build production site<\/td>/);
});
