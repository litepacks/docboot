import test from 'node:test';
import assert from 'node:assert';
import { parseMarkdown } from '../src/markdown/parser.js';
import { processDirectives } from '../src/markdown/directives.js';

test('processDirectives handles callout blocks', () => {
  const md = `:::note Note Title\nImportant note content.\n:::`;
  const html = processDirectives(md);
  assert.match(html, /docboot-callout/);
  assert.match(html, /Note Title/);
  assert.match(html, /Important note content\./);
});

test('processDirectives handles collapsible details', () => {
  const md = `:::details Advanced Configuration\nHere is hidden explanation.\n:::`;
  const html = processDirectives(md);
  assert.match(html, /<details class="docboot-details/);
  assert.match(html, /<summary[^>]*>[\s\S]*Advanced Configuration[\s\S]*<\/summary>/);
  assert.match(html, /Here is hidden explanation\./);
});

test('processDirectives handles tabs with synced group', () => {
  const md = `:::tabs group="pkg-mgr"
::tab npm
\`\`\`bash
npm i docboot
\`\`\`
::tab pnpm
\`\`\`bash
pnpm add docboot
\`\`\`
:::`;

  const html = processDirectives(md);
  assert.match(html, /class="docboot-tabs not-prose[^"]*"/);
  assert.match(html, /data-tab-group="pkg-mgr"/);
  assert.match(html, /data-tab-label="npm"/);
  assert.match(html, /data-tab-label="pnpm"/);
  assert.match(html, /role="tab"/);
  assert.match(html, /role="tabpanel"/);
  assert.match(html, /npm i docboot/);
  assert.match(html, /pnpm add docboot/);
});

test('processDirectives handles code-groups', () => {
  const md = `:::code-group
\`\`\`js [JavaScript]
export const a = 1;
\`\`\`
\`\`\`ts [TypeScript]
export const a: number = 1;
\`\`\`
:::`;

  const html = processDirectives(md);
  assert.match(html, /docboot-code-group/);
  assert.match(html, /data-tab-label="JavaScript"/);
  assert.match(html, /data-tab-label="TypeScript"/);
});

test('processDirectives handles safe embeds and allowlists', () => {
  const mdAllowed = `:::embed youtube
src: https://youtube.com/watch?v=dQw4w9WgXcQ
title: Video Demo
ratio: 16/9
:::`;

  const htmlAllowed = processDirectives(mdAllowed, {
    embeds: { allowedDomains: ['youtube.com', 'youtube-nocookie.com'] }
  });
  assert.match(htmlAllowed, /<iframe/);
  assert.match(htmlAllowed, /https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
  assert.match(htmlAllowed, /title="Video Demo"/);
  assert.match(htmlAllowed, /sandbox="allow-scripts/);

  // Blocked domain test
  const mdBlocked = `:::embed
src: https://malicious-site.xyz/embed
title: Bad Embed
:::`;

  const htmlBlocked = processDirectives(mdBlocked, {
    embeds: { allowedDomains: ['youtube.com'] }
  });
  assert.match(htmlBlocked, /Blocked embed domain:/);
  assert.match(htmlBlocked, /malicious-site\.xyz/);
});

test('processDirectives handles explicit image block and lightbox', () => {
  const md = `:::image
src: ./images/dashboard.png
alt: Dashboard Overview
caption: Main user dashboard
zoom: true
:::`;

  const html = processDirectives(md);
  assert.match(html, /<figure class="docboot-figure/);
  assert.match(html, /data-docboot-lightbox="true"/);
  assert.match(html, /src="\.\/images\/dashboard\.png"/);
  assert.match(html, /alt="Dashboard Overview"/);
  assert.match(html, /<figcaption[^>]*>Main user dashboard<\/figcaption>/);
});

test('processDirectives handles image galleries', () => {
  const md = `:::gallery
- src: ./screens/1.png
  alt: Screen 1
  caption: Home screen
- src: ./screens/2.png
  alt: Screen 2
  caption: Search screen
:::`;

  const html = processDirectives(md);
  assert.match(html, /class="docboot-gallery/);
  assert.match(html, /data-gallery-id="gallery-/);
  assert.match(html, /data-lightbox-src="\.\/screens\/1\.png"/);
  assert.match(html, /data-lightbox-src="\.\/screens\/2\.png"/);
  assert.match(html, /Home screen/);
  assert.match(html, /Search screen/);
});

test('parseMarkdown renders standard markdown images with lightbox support', () => {
  const md = `![Dashboard Overview](./images/dash.png "Analytics Dashboard")`;
  const result = parseMarkdown(md);
  assert.match(result.html, /data-docboot-lightbox="true"/);
  assert.match(result.html, /data-lightbox-src="\/images\/dash\.png"/);
  assert.match(result.html, /alt="Dashboard Overview"/);
  assert.match(result.html, /<figcaption[^>]*>Analytics Dashboard<\/figcaption>/);
});

test('processDirectives handles custom text size containers', () => {
  const md = `:::text-sm\nSmall explanatory note text.\n:::\n\n:::lead\nLead introductory paragraph.\n:::`;
  const html = processDirectives(md);
  assert.match(html, /docboot-text-block/);
  assert.match(html, /text-sm/);
  assert.match(html, /Small explanatory note text\./);
  assert.match(html, /text-lg sm:text-xl/);
  assert.match(html, /Lead introductory paragraph\./);
});

test('processDirectives ignores directives inside code blocks', () => {
  const md = `\`\`\`markdown\n:::details Custom Title\nContent visible when expanded.\n:::\n\`\`\``;
  const result = processDirectives(md);
  assert.strictEqual(result, md);
  assert.doesNotMatch(result, /<details class="docboot-details/);
});
