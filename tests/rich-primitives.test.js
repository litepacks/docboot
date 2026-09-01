import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown } from '../src/markdown/parser.js';
import { processDirectives } from '../src/markdown/directives.js';
import { parseCodeInfo } from '../src/markdown/codeblock.js';
import { generateQrSvg } from '../src/markdown/qr.js';
import { calculateRelatedPages } from '../src/routes/related.js';
import { Doctor } from '../src/doctor/index.js';

describe('Rich Documentation Primitives', () => {

  test('Directive: :::compare renders accessible image comparison slider', () => {
    const raw = `:::compare
before: https://example.com/old.png
after: https://example.com/new.png
beforeLabel: Before v1
afterLabel: After v2
beforeAlt: Old interface
afterAlt: New interface
:::`;

    const parsed = parseMarkdown(raw);
    assert.ok(parsed.html.includes('docboot-compare'), 'Should include docboot-compare class');
    assert.ok(parsed.html.includes('data-docboot-compare="true"'), 'Should mark data-docboot-compare');
    assert.ok(parsed.html.includes('Before v1'), 'Should render before label');
    assert.ok(parsed.html.includes('After v2'), 'Should render after label');
    assert.ok(parsed.html.includes('Old interface'), 'Should render before alt');
    assert.ok(parsed.html.includes('New interface'), 'Should render after alt');
    assert.ok(parsed.html.includes('aria-valuenow="50"'), 'Should have initial a11y value');
  });

  test('Directive: :::steps renders semantic step-by-step layout', () => {
    const raw = `:::steps
::step Install dependencies
Run \`npm install\` in your project.
::

::step Build documentation
Run \`npx docboot build\` for production.
::
:::`;

    const parsed = parseMarkdown(raw);
    assert.ok(parsed.html.includes('docboot-steps'), 'Should render steps container');
    assert.ok(parsed.html.includes('docboot-step-number'), 'Should render step numbers');
    assert.ok(parsed.html.includes('Install dependencies'), 'Should render step 1 title');
    assert.ok(parsed.html.includes('Build documentation'), 'Should render step 2 title');
    assert.ok(parsed.html.includes('>1<'), 'Should include first number badge');
    assert.ok(parsed.html.includes('>2<'), 'Should include second number badge');
  });

  test('Directive: :::tree renders structured directory tree', () => {
    const raw = `:::tree
- package.json
- docboot.config.js
- src/
  - index.js
  - compiler/
    - builder.js
- docs/
  - guide/
    - intro.md
:::`;

    const parsed = parseMarkdown(raw);
    assert.ok(parsed.html.includes('docboot-file-tree'), 'Should render file tree container');
    assert.ok(parsed.html.includes('package.json'), 'Should render root files');
    assert.ok(parsed.html.includes('builder.js'), 'Should render nested files');
    assert.ok(parsed.html.includes('compiler/'), 'Should render folders');
  });

  test('Directive: :::terminal renders macOS window chrome and smart copy button', () => {
    const raw = `:::terminal title="Terminal — zsh"
$ npx docboot build
✓ Discovered 12 pages
✓ Built static site to ./dist
:::`;

    const parsed = parseMarkdown(raw);
    assert.ok(parsed.html.includes('docboot-terminal'), 'Should render terminal container');
    assert.ok(parsed.html.includes('Terminal — zsh'), 'Should render custom terminal title');
    assert.ok(parsed.html.includes('docboot-terminal-prompt'), 'Should style prompt line');
    assert.ok(parsed.html.includes('docboot-terminal-output'), 'Should style output lines');
    assert.ok(parsed.html.includes('data-docboot-terminal="true"'), 'Should mark data-docboot-terminal for smart copy');
    assert.ok(parsed.html.includes('data-command="npx docboot build"'), 'Should isolate pure command in data-command');
  });

  test('Directive: :::badge and :::since render status tokens', () => {
    const rawBadge = `Status: :::badge stable :::badge experimental`;
    const parsedBadge = parseMarkdown(rawBadge);
    assert.ok(parsedBadge.html.includes('docboot-badge'), 'Should render badge class');
    assert.ok(parsedBadge.html.includes('STABLE'), 'Should render badge text in uppercase');
    assert.ok(parsedBadge.html.includes('EXPERIMENTAL'), 'Should render badge text in uppercase');

    const rawSince = `Feature :::since 2.4.0`;
    const parsedSince = parseMarkdown(rawSince);
    assert.ok(parsedSince.html.includes('v2.4.0'), 'Should render since version badge');
  });

  test('Directive: :::deprecated renders clear deprecation warning', () => {
    const raw = `:::deprecated since="2.0.0"
This option has been removed. Use \`newOption\` instead.
:::`;

    const parsed = parseMarkdown(raw);
    assert.ok(parsed.html.includes('docboot-deprecated'), 'Should render deprecated callout');
    assert.ok(parsed.html.includes('Deprecated in v2.0.0'), 'Should render deprecation header');
    assert.ok(parsed.html.includes('Use <code>newOption</code> instead'), 'Should render body content');
  });

  test('Directive: :::carousel renders interactive image walkthrough', () => {
    const raw = `:::carousel
- src: https://example.com/step1.png
  alt: Step 1 Setup
  caption: 1. Configure settings

- src: https://example.com/step2.png
  alt: Step 2 Verify
  caption: 2. Test results
:::`;

    const parsed = parseMarkdown(raw);
    assert.ok(parsed.html.includes('docboot-carousel'), 'Should render carousel container');
    assert.ok(parsed.html.includes('data-docboot-carousel="true"'), 'Should mark carousel attribute');
    assert.ok(parsed.html.includes('docboot-carousel-slide'), 'Should render slides');
    assert.ok(parsed.html.includes('1 / 2'), 'Should render slide counter');
    assert.ok(parsed.html.includes('docboot-carousel-prev'), 'Should render prev button');
    assert.ok(parsed.html.includes('docboot-carousel-next'), 'Should render next button');
  });

  test('Directive: :::download renders file download card', () => {
    const raw = `:::download
file: ./docs/public/bundle.zip
title: Offline Documentation Bundle
description: Standalone offline documentation package.
version: v2.4.0
:::`;

    const parsed = parseMarkdown(raw);
    assert.ok(parsed.html.includes('docboot-download'), 'Should render download container');
    assert.ok(parsed.html.includes('Offline Documentation Bundle'), 'Should render title');
    assert.ok(parsed.html.includes('ZIP'), 'Should auto-detect file extension');
    assert.ok(parsed.html.includes('href="/docs/public/bundle.zip"') || parsed.html.includes('href="./docs/public/bundle.zip"'), 'Should link to target file');
  });

  test('Directive: :::qr generates pure SVG QR code', () => {
    const raw = `:::qr https://docboot.dev/mobile
title: Scan to open on mobile
size: 140
:::`;

    const parsed = parseMarkdown(raw);
    assert.ok(parsed.html.includes('docboot-qr'), 'Should render QR container');
    assert.ok(parsed.html.includes('<svg'), 'Should generate inline SVG');
    assert.ok(parsed.html.includes('Scan to open on mobile'), 'Should render visible title');
    assert.ok(parsed.html.includes('https://docboot.dev/mobile'), 'Should render fallback URL link');

    const pureSvg = generateQrSvg('https://example.com', { size: 120 });
    assert.ok(pureSvg.includes('<svg'), 'generateQrSvg should output valid SVG markup');
    assert.ok(pureSvg.includes('width="120"'), 'generateQrSvg should respect size option');
  });

  test('Collapsible Code Blocks: parseCodeInfo and expand button markup', () => {
    const parsedInfo = parseCodeInfo('js collapse collapsedLines="15" [index.js]');
    assert.equal(parsedInfo.lang, 'js');
    assert.equal(parsedInfo.title, 'index.js');
    assert.equal(parsedInfo.collapsible, true);
    assert.equal(parsedInfo.collapsedLines, 15);

    const raw = `\`\`\`js collapse [main.js]
console.log("Line 1");
console.log("Line 2");
\`\`\``;

    const parsed = parseMarkdown(raw);
    assert.ok(parsed.html.includes('docboot-code-collapsible'), 'Should render collapsible class');
    assert.ok(parsed.html.includes('is-collapsed'), 'Should be collapsed by default');
    assert.ok(parsed.html.includes('docboot-code-expand-btn'), 'Should render expand button');
    assert.ok(parsed.html.includes('Show full example'), 'Should have accessible button text');
  });

  test('Footnotes: parses GFM footnote references and backlink footer', () => {
    const raw = `Here is a statement[^note1] with a citation[^note2].

[^note1]: First citation reference details.
[^note2]: Second bibliographic note.`;

    const parsed = parseMarkdown(raw);
    assert.ok(parsed.html.includes('class="docboot-footnote-ref"'), 'Should wrap inline ref in sup');
    assert.ok(parsed.html.includes('href="#fn-note1"'), 'Should link to footnote definition');
    assert.ok(parsed.html.includes('docboot-footnotes'), 'Should append footnotes section at bottom');
    assert.ok(parsed.html.includes('First citation reference details'), 'Should render footnote body');
    assert.ok(parsed.html.includes('href="#fnref-note1"'), 'Should include backlink to reference point');
  });

  test('Related Pages: deterministically scores and recommends relevant pages', () => {
    const pages = [
      {
        route: '/guide/images',
        title: 'Image Optimization',
        description: 'Responsive images and WebP/AVIF variants',
        category: 'Guide',
        headings: [{ text: 'Optimization' }, { text: 'Responsive pictures' }],
        internalLinks: ['/guide/rich-content', '/guide/diagrams'],
        plainText: 'images optimization picture webp avif gallery compare slider'
      },
      {
        route: '/guide/rich-content',
        title: 'Rich Content Primitives',
        description: 'Steps, carousels, compare sliders, and trees',
        category: 'Guide',
        headings: [{ text: 'Before After Compare' }, { text: 'Carousel Walkthrough' }],
        internalLinks: ['/guide/images', '/reference/directives'],
        plainText: 'rich content primitives compare carousel images slider steps'
      },
      {
        route: '/guide/diagrams',
        title: 'Mermaid Diagrams',
        description: 'Flowcharts and architecture diagrams',
        category: 'Guide',
        headings: [{ text: 'Flowcharts' }, { text: 'Sequences' }],
        internalLinks: ['/guide/rich-content'],
        plainText: 'mermaid flowcharts diagrams graphs sequence architecture'
      },
      {
        route: '/reference/directives',
        title: 'Directives Reference',
        description: 'Cheatsheet of all available markdown directives',
        category: 'Reference',
        headings: [{ text: 'Compare' }, { text: 'Carousel' }],
        internalLinks: ['/guide/rich-content', '/guide/images'],
        plainText: 'directives syntax reference cheat sheet compare carousel'
      }
    ];

    const relatedToImages = calculateRelatedPages(pages[0], pages, { limit: 3 });
    assert.ok(relatedToImages.length > 0, 'Should find related pages');
    assert.equal(relatedToImages[0].route, '/guide/rich-content', 'Rich content should be top recommendation due to bi-directional linking and shared keywords');
    assert.ok(relatedToImages.some(r => r.route === '/reference/directives'), 'Should recommend directives reference');
  });

  test('Doctor: detects stale documentation pages with --stale flag', async () => {
    const config = {
      rootDir: 'docs',
      docs: {
        staleAfterDays: 180
      }
    };

    const doctor = new Doctor(config);
    // Overwrite pages with simulated old git timestamps (400 days old)
    const oldTimestamp = new Date(Date.now() - 400 * 86400000).toISOString();
    const result = await doctor.diagnose({
      stale: true,
      pagesOverride: [
        {
          route: '/legacy-doc',
          relativePath: 'guide/legacy-doc.md',
          title: 'Legacy Document',
          rawContent: '# Legacy\nOld doc',
          html: '<h1>Legacy</h1><p>Old doc</p>',
          git: { updatedAt: oldTimestamp },
          internalLinks: [],
          referencedAssets: []
        }
      ]
    });

    const staleWarning = result.warnings.find(w => w.type === 'Potentially Stale Page');
    assert.ok(staleWarning, 'Should warn about potentially stale page');
    assert.ok(staleWarning.message.includes('400 days ago'), 'Should specify age in days');
  });

  test('Doctor: detects redirect loops and chains', async () => {
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
    assert.ok(chainWarning, 'Should detect redirect chain /old-a -> /old-b -> /old-c');

    const loopError = result.errors.find(e => e.type === 'Redirect Loop');
    assert.ok(loopError, 'Should detect redirect loop /loop-1 <-> /loop-2');
  });

});
