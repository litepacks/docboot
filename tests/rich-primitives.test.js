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

  test('Directive: :::endpoint renders method badge, path highlighting, auth badge, and copy button', () => {
    const raw = `:::endpoint GET /api/v1/users/:id
auth: Bearer
status: 200 OK
description: Retrieve user details by unique identifier
:::`;

    const parsed = parseMarkdown(raw);
    assert.ok(parsed.html.includes('docboot-endpoint'), 'Should render endpoint container');
    assert.ok(parsed.html.includes('docboot-method-badge'), 'Should render method badge');
    assert.ok(parsed.html.includes('>GET<'), 'Should render GET method in uppercase');
    assert.ok(parsed.html.includes('/api/v1/users/'), 'Should render path');
    assert.ok(parsed.html.includes(':id'), 'Should highlight path parameter');
    assert.ok(parsed.html.includes('Bearer'), 'Should render auth badge');
    assert.ok(parsed.html.includes('200 OK'), 'Should render status code badge');
    assert.ok(parsed.html.includes('data-code="/api/v1/users/:id"'), 'Should have copy path button');
  });

  test('Directive: :::request and :::response render HTTP payload and status code badges', () => {
    const rawReq = `:::request POST /api/v1/users
\`\`\`json
{"name": "Alice"}
\`\`\`
:::`;

    const parsedReq = parseMarkdown(rawReq);
    assert.ok(parsedReq.html.includes('docboot-request'), 'Should render request container');
    assert.ok(parsedReq.html.includes('POST /api/v1/users'), 'Should render method and path');
    assert.ok(parsedReq.html.includes('HTTP Payload'), 'Should render header');

    const rawRes = `:::response 201 Created
\`\`\`json
{"id": "usr_123", "name": "Alice"}
\`\`\`
:::`;

    const parsedRes = parseMarkdown(rawRes);
    assert.ok(parsedRes.html.includes('docboot-response'), 'Should render response container');
    assert.ok(parsedRes.html.includes('201'), 'Should render 201 status');
    assert.ok(parsedRes.html.includes('Created'), 'Should render Created status text');
    assert.ok(parsedRes.html.includes('bg-emerald-500'), 'Should style 201 with success badge');
  });

  test('Directive: :::params renders structured parameter list with type, required, default and enum chips', () => {
    const raw = `:::params Query Parameters
- name: page
  type: integer
  default: 1
  required: false
  description: Page offset index
- name: sort
  type: string
  required: true
  enum: [asc, desc]
  description: Sorting direction
:::`;

    const parsed = parseMarkdown(raw);
    assert.ok(parsed.html.includes('docboot-params'), 'Should render params container');
    assert.ok(parsed.html.includes('Query Parameters'), 'Should render custom title');
    assert.ok(parsed.html.includes('page'), 'Should render page parameter');
    assert.ok(parsed.html.includes('sort'), 'Should render sort parameter');
    assert.ok(parsed.html.includes('Required'), 'Should render Required badge');
    assert.ok(parsed.html.includes('optional'), 'Should render optional badge');
    assert.ok(parsed.html.includes('default:'), 'Should render default value tag');
    assert.ok(parsed.html.includes('asc'), 'Should render enum asc chip');
    assert.ok(parsed.html.includes('desc'), 'Should render enum desc chip');
  });

  test('Directive: :::property renders standalone property specification card', () => {
    const raw = `:::property timeout
type: number
default: 5000
required: false
HTTP request timeout in milliseconds before failing.
:::`;

    const parsed = parseMarkdown(raw);
    assert.ok(parsed.html.includes('docboot-property'), 'Should render property container');
    assert.ok(parsed.html.includes('timeout'), 'Should render property name');
    assert.ok(parsed.html.includes('number'), 'Should render property type');
    assert.ok(parsed.html.includes('5000'), 'Should render default value');
    assert.ok(parsed.html.includes('HTTP request timeout'), 'Should render description body');
  });

  test('Directive: :::env renders environment variable card with copy button', () => {
    const raw = `:::env DOCBOOT_PORT
type: number
default: 3000
required: false
The local development server port.
:::`;

    const parsed = parseMarkdown(raw);
    assert.ok(parsed.html.includes('docboot-env'), 'Should render env container');
    assert.ok(parsed.html.includes('$_'), 'Should render env icon symbol');
    assert.ok(parsed.html.includes('DOCBOOT_PORT'), 'Should render env name');
    assert.ok(parsed.html.includes('3000'), 'Should render default value');
    assert.ok(parsed.html.includes('data-code="DOCBOOT_PORT"'), 'Should have copy button for env var name');
  });

  test('Directive: :::config-option renders config option card with allowed values', () => {
    const raw = `:::config-option images.optimize
type: boolean
default: true
enum: [true, false]
Whether to optimize markdown images at build time.
:::`;

    const parsed = parseMarkdown(raw);
    assert.ok(parsed.html.includes('docboot-config-option'), 'Should render config option container');
    assert.ok(parsed.html.includes('Allowed values:'), 'Should render allowed values list');
    assert.ok(parsed.html.includes('data-code="images.optimize"'), 'Should have copy button for config key');
  });

  test('Directive: :::endpoint handles various HTTP methods, custom status codes, and path parameters', () => {
    const rawPost = `:::endpoint POST /api/v1/auth/login auth="none" status="200 OK"
Authenticate user with email and password
:::`;
    const parsedPost = parseMarkdown(rawPost);
    assert.ok(parsedPost.html.includes('bg-blue-500'), 'POST should use blue badge');
    assert.ok(parsedPost.html.includes('>POST<'), 'Should render POST');

    const rawDelete = `:::endpoint DELETE /api/v1/projects/{projectId} status="204 No Content"
:::`;
    const parsedDelete = parseMarkdown(rawDelete);
    assert.ok(parsedDelete.html.includes('bg-rose-500'), 'DELETE should use rose badge');
    assert.ok(parsedDelete.html.includes('{projectId}'), 'Should highlight bracketed parameter');

    const rawWs = `:::endpoint WS /realtime/events
:::`;
    const parsedWs = parseMarkdown(rawWs);
    assert.ok(parsedWs.html.includes('bg-cyan-500'), 'WS should use cyan badge');

    const rawRes400 = `:::response 400 Bad Request
\`\`\`json
{"error": "Invalid payload"}
\`\`\`
:::`;
    const parsedRes400 = parseMarkdown(rawRes400);
    assert.ok(parsedRes400.html.includes('bg-amber-500'), '400 response should use amber badge');

    const rawRes500 = `:::response 500 Internal Server Error
\`\`\`json
{"error": "Server error"}
\`\`\`
:::`;
    const parsedRes500 = parseMarkdown(rawRes500);
    assert.ok(parsedRes500.html.includes('bg-rose-500'), '500 response should use rose badge');
  });

  test('Directive: :::cards and :::card render interactive card grid and standalone cards', () => {
    const rawGrid = `:::cards cols="2"
::card Zero Config href="/guide/zero-config" icon="zap" badge="New"
Instant documentation compiler with smart defaults.
::
::card Local Search href="/guide/search" icon="search"
Pre-indexed client-side search engine.
::
:::`;

    const parsedGrid = parseMarkdown(rawGrid);
    assert.ok(parsedGrid.html.includes('docboot-cards'), 'Should render cards grid container');
    assert.ok(parsedGrid.html.includes('grid-cols-1 sm:grid-cols-2'), 'Should apply cols=2 grid classes');
    assert.ok(parsedGrid.html.includes('href="/guide/zero-config"'), 'Should render interactive link for card 1');
    assert.ok(parsedGrid.html.includes('Zero Config'), 'Should render card 1 title');
    assert.ok(parsedGrid.html.includes('New'), 'Should render card badge');
    assert.ok(parsedGrid.html.includes('Local Search'), 'Should render card 2 title');
    assert.ok(parsedGrid.html.includes('Pre-indexed client-side search engine'), 'Should render card description');

    const rawSingle = `:::card Standalone Card href="/guide/getting-started" icon="rocket" badge="v2.4"
Quick start with Docboot in under 2 minutes.
:::`;
    const parsedSingle = parseMarkdown(rawSingle);
    assert.ok(parsedSingle.html.includes('docboot-card'), 'Should render standalone card');
    assert.ok(parsedSingle.html.includes('Standalone Card'), 'Should render title');
    assert.ok(parsedSingle.html.includes('href="/guide/getting-started"'), 'Should render link');
    assert.ok(parsedSingle.html.includes('v2.4'), 'Should render badge');
  });

  test('Directive: :::metrics renders KPI metric cards with trends and values', () => {
    const raw = `:::metrics cols="3"
::metric 84ms Build time trend="-40%"
Ultra-fast compilation.
::metric 7.2KB Client JS
Zero runtime framework overhead.
::metric 100% Lighthouse trend="+15%"
Perfect accessibility score.
:::`;

    const parsed = parseMarkdown(raw);
    assert.ok(parsed.html.includes('docboot-metrics'), 'Should render metrics container');
    assert.ok(parsed.html.includes('84ms'), 'Should render 84ms value');
    assert.ok(parsed.html.includes('Build time'), 'Should render Build time label');
    assert.ok(parsed.html.includes('-40%'), 'Should render trend value');
    assert.ok(parsed.html.includes('7.2KB'), 'Should render 7.2KB value');
    assert.ok(parsed.html.includes('100%'), 'Should render 100% value');
    assert.ok(parsed.html.includes('Lighthouse'), 'Should render Lighthouse label');
  });

  test('Directive: :::hero renders landing hero banner with badge, tagline and CTA buttons', () => {
    const raw = `:::hero
badge: Version 2.4 Released
title: Next-Gen Documentation SSG
tagline: Zero-config technical documentation compiler for modern engineering teams.
primaryText: Get Started
primaryLink: /guide/getting-started
secondaryText: View GitHub
secondaryLink: https://github.com/litepacks/docboot
:::`;

    const parsed = parseMarkdown(raw);
    assert.ok(parsed.html.includes('docboot-hero'), 'Should render hero container');
    assert.ok(parsed.html.includes('Version 2.4 Released'), 'Should render badge');
    assert.ok(parsed.html.includes('Next-Gen Documentation SSG'), 'Should render title');
    assert.ok(parsed.html.includes('Zero-config technical documentation compiler'), 'Should render tagline');
    assert.ok(parsed.html.includes('Get Started'), 'Should render primary CTA button');
    assert.ok(parsed.html.includes('href="/guide/getting-started"'), 'Should render primary link');
    assert.ok(parsed.html.includes('View GitHub'), 'Should render secondary CTA button');
  });

  test('Directive: :::features renders structured feature highlight grid', () => {
    const raw = `:::features cols="2"
::feature Instant Build icon="zap"
Compiles hundreds of markdown pages in milliseconds.
::
::feature Accessible WCAG 2.2 icon="shield"
Built-in automated accessibility and keyboard navigation.
::
:::`;

    const parsed = parseMarkdown(raw);
    assert.ok(parsed.html.includes('docboot-features'), 'Should render features container');
    assert.ok(parsed.html.includes('Instant Build'), 'Should render feature title 1');
    assert.ok(parsed.html.includes('Accessible WCAG 2.2'), 'Should render feature title 2');
    assert.ok(parsed.html.includes('Compiles hundreds of markdown pages'), 'Should render feature description');
  });

  test('Directive: Package 2 primitives support YAML list format', () => {
    const rawCardsYaml = `:::cards cols="2"
- title: PWA Ready
  href: /guide/pwa
  icon: globe
  badge: Offline
  description: Service worker caching and dynamic updates.
- title: Themes & Styles
  href: /guide/themes
  icon: sparkles
  description: Customizable Tailwind design tokens.
:::`;
    const parsedCards = parseMarkdown(rawCardsYaml);
    assert.ok(parsedCards.html.includes('PWA Ready'), 'YAML cards should render title 1');
    assert.ok(parsedCards.html.includes('Offline'), 'YAML cards should render badge');
    assert.ok(parsedCards.html.includes('Themes &amp; Styles'), 'YAML cards should render title 2 with escaped ampersand');
    assert.ok(parsedCards.html.includes('href="/guide/pwa"'), 'YAML cards should render href');

    const rawMetricsYaml = `:::metrics
- value: 99.9%
  label: Uptime
  trend: +0.2%
- value: <10ms
  label: TTFB
:::`;
    const parsedMetrics = parseMarkdown(rawMetricsYaml);
    assert.ok(parsedMetrics.html.includes('99.9%'), 'YAML metrics should render value 1');
    assert.ok(parsedMetrics.html.includes('Uptime'), 'YAML metrics should render label 1');
    assert.ok(parsedMetrics.html.includes('&lt;10ms') || parsedMetrics.html.includes('<10ms'), 'YAML metrics should render value 2');
    assert.ok(parsedMetrics.html.includes('TTFB'), 'YAML metrics should render label 2');
  });

  test('Directive: :::compat renders compatibility matrix with platform badges', () => {
    const raw = `:::compat Browser & Runtime Matrix
Chrome: 120+
Firefox: 121+
Safari: 17+
Node.js: 18+
Deno: 1.38+
Bun: 1.0+
:::`;

    const parsed = parseMarkdown(raw);
    assert.ok(parsed.html.includes('docboot-compat'), 'Should render compat container');
    assert.ok(parsed.html.includes('Browser &amp; Runtime Matrix') || parsed.html.includes('Browser & Runtime Matrix'), 'Should render title');
    assert.ok(parsed.html.includes('Chrome'), 'Should render Chrome');
    assert.ok(parsed.html.includes('120+'), 'Should render 120+ version');
    assert.ok(parsed.html.includes('Firefox'), 'Should render Firefox');
    assert.ok(parsed.html.includes('Safari'), 'Should render Safari');
    assert.ok(parsed.html.includes('Node.js'), 'Should render Node.js');
    assert.ok(parsed.html.includes('18+'), 'Should render 18+');
  });

  test('Directive: :::shortcut and :::shortcuts render keycaps and multi-OS shortcuts', () => {
    const rawSingle = `:::shortcut Quick Search
mac: Cmd + K
windows: Ctrl + K
description: Opens global search modal
:::`;

    const parsedSingle = parseMarkdown(rawSingle);
    assert.ok(parsedSingle.html.includes('docboot-shortcuts'), 'Should render shortcuts container');
    assert.ok(parsedSingle.html.includes('docboot-kbd'), 'Should render styled kbd keycaps');
    assert.ok(parsedSingle.html.includes('Cmd') || parsedSingle.html.includes('⌘ Cmd'), 'Should render Cmd key');
    assert.ok(parsedSingle.html.includes('Ctrl'), 'Should render Ctrl key');
    assert.ok(parsedSingle.html.includes('Opens global search modal'), 'Should render description');

    const rawList = `:::shortcuts
- action: Command Palette
  mac: Cmd + Shift + P
  windows: Ctrl + Shift + P
- action: Toggle Theme
  mac: Cmd + D
:::`;
    const parsedList = parseMarkdown(rawList);
    assert.ok(parsedList.html.includes('Command Palette'), 'Should render action 1');
    assert.ok(parsedList.html.includes('Shift'), 'Should render Shift modifier');
    assert.ok(parsedList.html.includes('Toggle Theme'), 'Should render action 2');
  });

  test('Directive: :::preview renders interactive canvas and syntax highlighted source details', () => {
    const raw = `:::preview Button Demo
<button class="px-4 py-2 bg-blue-600 text-white rounded-lg">Submit</button>
\`\`\`html
<button class="px-4 py-2 bg-blue-600 text-white rounded-lg">Submit</button>
\`\`\`
:::`;

    const parsed = parseMarkdown(raw);
    assert.ok(parsed.html.includes('docboot-preview'), 'Should render preview container');
    assert.ok(parsed.html.includes('Button Demo'), 'Should render title');
    assert.ok(parsed.html.includes('docboot-preview-canvas'), 'Should render canvas');
    assert.ok(parsed.html.includes('<button class="px-4 py-2 bg-blue-600 text-white rounded-lg">Submit</button>'), 'Should render live canvas element');
    assert.ok(parsed.html.includes('docboot-preview-code'), 'Should render code details container');
    assert.ok(parsed.html.includes('View Source Code'), 'Should render source summary text');
  });

  test('Directive: :::changelog renders structured release notes with categorized changes', () => {
    const raw = `:::changelog v2.4.0 date="2026-09-02" title="Rich Primitives & PWA"
::added
- Added cards, metrics, and hero documentation directives.
- Added Service Worker auto-update toast.
::fixed
- Fixed MiniSearch search input auto-focus.
::removed
- Removed legacy config options.
:::`;

    const parsed = parseMarkdown(raw);
    assert.ok(parsed.html.includes('docboot-changelog'), 'Should render changelog container');
    assert.ok(parsed.html.includes('v2.4.0'), 'Should render release version badge');
    assert.ok(parsed.html.includes('2026-09-02'), 'Should render release date');
    assert.ok(parsed.html.includes('Rich Primitives &amp; PWA') || parsed.html.includes('Rich Primitives & PWA'), 'Should render title');
    assert.ok(parsed.html.includes('Added'), 'Should render Added category tag');
    assert.ok(parsed.html.includes('Fixed'), 'Should render Fixed category tag');
    assert.ok(parsed.html.includes('Removed'), 'Should render Removed category tag');
    assert.ok(parsed.html.includes('Fixed MiniSearch search input auto-focus'), 'Should render change description');
  });

  test('Directive: :::testimonial renders quotation card with author avatar and social link', () => {
    const raw = `:::quote author="Sarah Connor" title="Lead Architect" url="https://example.com/profile"
Docboot is the fastest and most elegant documentation compiler we have ever used.
:::`;

    const parsed = parseMarkdown(raw);
    assert.ok(parsed.html.includes('docboot-testimonial'), 'Should render testimonial container');
    assert.ok(parsed.html.includes('Sarah Connor'), 'Should render author name');
    assert.ok(parsed.html.includes('Lead Architect'), 'Should render title');
    assert.ok(parsed.html.includes('href="https://example.com/profile"'), 'Should render author link');
    assert.ok(parsed.html.includes('fastest and most elegant documentation compiler'), 'Should render quote text');
    assert.ok(parsed.html.includes('SC'), 'Should render fallback initials avatar');
  });

  test('Directive: :::timeline renders chronological process roadmap with nodes', () => {
    const raw = `:::timeline Product Evolution
::item 2026 Q3 — Zero-Config Engine
Initial release with instant startup and automatic routing.
::item 2026 Q4 — AI & Rich Primitives
Expanded interactive blocks and PWA offline support.
:::`;

    const parsed = parseMarkdown(raw);
    assert.ok(parsed.html.includes('docboot-timeline'), 'Should render timeline container');
    assert.ok(parsed.html.includes('Product Evolution'), 'Should render timeline title');
    assert.ok(parsed.html.includes('2026 Q3'), 'Should render item 1 date');
    assert.ok(parsed.html.includes('Zero-Config Engine'), 'Should render item 1 title');
    assert.ok(parsed.html.includes('2026 Q4'), 'Should render item 2 date');
    assert.ok(parsed.html.includes('AI &amp; Rich Primitives') || parsed.html.includes('AI & Rich Primitives'), 'Should render item 2 title');
  });

  test('Directive: :::faq and :::accordion render collapsible Q&A items with Schema.org markup', () => {
    const raw = `:::faq Frequently Asked Questions
::q Is Docboot completely open source?
Yes, Docboot is released under the MIT license and is 100% free to use.
::q How fast is the build step?
It compiles hundreds of markdown pages in under 100 milliseconds.
:::`;

    const parsed = parseMarkdown(raw);
    assert.ok(parsed.html.includes('docboot-faq'), 'Should render faq container');
    assert.ok(parsed.html.includes('Frequently Asked Questions'), 'Should render section title');
    assert.ok(parsed.html.includes('schema.org/FAQPage'), 'Should include FAQPage schema');
    assert.ok(parsed.html.includes('schema.org/Question'), 'Should include Question schema');
    assert.ok(parsed.html.includes('Is Docboot completely open source?'), 'Should render Question 1');
    assert.ok(parsed.html.includes('100% free to use'), 'Should render Answer 1');
    assert.ok(parsed.html.includes('How fast is the build step?'), 'Should render Question 2');
  });

  test('Directive: :::pricing renders structured tier cards with popular highlights', () => {
    const raw = `:::pricing cols="2"
::plan Community price="Free" period="forever" badge="Open Source"
- Unlimited pages
- Offline PWA
::
::plan Enterprise price="$49" period="/mo" popular="true"
- Dedicated support
- Custom themes
::
:::`;

    const parsed = parseMarkdown(raw);
    assert.ok(parsed.html.includes('docboot-pricing'), 'Should render pricing grid');
    assert.ok(parsed.html.includes('Community'), 'Should render plan 1 name');
    assert.ok(parsed.html.includes('Free'), 'Should render plan 1 price');
    assert.ok(parsed.html.includes('Open Source'), 'Should render badge');
    assert.ok(parsed.html.includes('Enterprise'), 'Should render plan 2 name');
    assert.ok(parsed.html.includes('$49'), 'Should render plan 2 price');
    assert.ok(parsed.html.includes('Popular'), 'Should render popular tag or styling');
    assert.ok(parsed.html.includes('Unlimited pages'), 'Should render bullet point');
  });

  test('Directive: :::table renders responsive data table with sticky header wrapper', () => {
    const raw = `:::table Benchmark Comparison
| Engine | Build Time | Client JS |
| :--- | :---: | :---: |
| Docboot | **84ms** | **7.2KB** |
| Docusaurus | 4.2s | 120KB |
:::`;

    const parsed = parseMarkdown(raw);
    assert.ok(parsed.html.includes('docboot-data-table'), 'Should render data table container');
    assert.ok(parsed.html.includes('Benchmark Comparison'), 'Should render title');
    assert.ok(parsed.html.includes('docboot-table-wrapper'), 'Should render table wrapper');
    assert.ok(parsed.html.includes('Docboot'), 'Should render row content');
    assert.ok(parsed.html.includes('84ms'), 'Should render 84ms');
  });

  test('Directive: :::team and :::author render team member profiles with avatars and social links', () => {
    const rawTeam = `:::team cols="2"
::member Sarah Connor role="Lead Architect" github="sarahconnor" twitter="sarahconnor"
Distributed systems engineer.
::
::member John Doe role="Maintainer" github="johndoe"
Documentation specialist.
::
:::`;

    const parsedTeam = parseMarkdown(rawTeam);
    assert.ok(parsedTeam.html.includes('docboot-team'), 'Should render team container');
    assert.ok(parsedTeam.html.includes('Sarah Connor'), 'Should render member 1 name');
    assert.ok(parsedTeam.html.includes('Lead Architect'), 'Should render role');
    assert.ok(parsedTeam.html.includes('https://github.com/sarahconnor'), 'Should render github link');
    assert.ok(parsedTeam.html.includes('John Doe'), 'Should render member 2 name');

    const rawAuthor = `:::author Ahmet role="Creator & Core Developer" github="ahmet"
Building lightweight developer tools.
:::`;
    const parsedAuthor = parseMarkdown(rawAuthor);
    assert.ok(parsedAuthor.html.includes('docboot-team'), 'Should render author container');
    assert.ok(parsedAuthor.html.includes('Ahmet'), 'Should render author name');
    assert.ok(parsedAuthor.html.includes('Creator &amp; Core Developer') || parsedAuthor.html.includes('Creator & Core Developer'), 'Should render role');
  });

  test('Directive: :::sponsors renders sponsor tiers with logo and link cards', () => {
    const raw = `:::sponsors title="Proud Sponsors" cols="3"
::sponsor Google tier="Platinum" url="https://google.com"
::sponsor Vercel tier="Gold" url="https://vercel.com"
:::`;

    const parsed = parseMarkdown(raw);
    assert.ok(parsed.html.includes('docboot-sponsors-container'), 'Should render sponsors container');
    assert.ok(parsed.html.includes('Proud Sponsors'), 'Should render title');
    assert.ok(parsed.html.includes('Google'), 'Should render sponsor 1 name');
    assert.ok(parsed.html.includes('Platinum'), 'Should render Platinum tier');
    assert.ok(parsed.html.includes('href="https://google.com"'), 'Should render sponsor link');
    assert.ok(parsed.html.includes('Vercel'), 'Should render sponsor 2 name');
    assert.ok(parsed.html.includes('Gold'), 'Should render Gold tier');
  });

  test('Directive: :::feedback renders interactive helpfulness rating widget', () => {
    const raw = `:::feedback
title: Was this tutorial helpful?
positiveText: Absolutely
negativeText: Not really
:::`;

    const parsed = parseMarkdown(raw);
    assert.ok(parsed.html.includes('docboot-feedback'), 'Should render feedback container');
    assert.ok(parsed.html.includes('Was this tutorial helpful?'), 'Should render title');
    assert.ok(parsed.html.includes('Absolutely'), 'Should render positive button text');
    assert.ok(parsed.html.includes('Not really'), 'Should render negative button text');
    assert.ok(parsed.html.includes('Thank you for your feedback!'), 'Should include feedback confirmation script snippet');
  });

  test('Directive: :::sandbox renders embedded iframe playground for StackBlitz and CodeSandbox', () => {
    const rawStackblitz = `:::sandbox stackblitz id="docboot-starter" file="src/index.js" height="400px" title="Docboot Live Sandbox"
:::`;
    const parsedStackblitz = parseMarkdown(rawStackblitz);
    assert.ok(parsedStackblitz.html.includes('docboot-sandbox'), 'Should render sandbox container');
    assert.ok(parsedStackblitz.html.includes('stackblitz.com/edit/docboot-starter'), 'Should format StackBlitz URL');
    assert.ok(parsedStackblitz.html.includes('height: 400px'), 'Should apply custom height');

    const rawCodesandbox = `:::sandbox codesandbox id="demo-box"
:::`;
    const parsedCodesandbox = parseMarkdown(rawCodesandbox);
    assert.ok(parsedCodesandbox.html.includes('codesandbox.io/embed/demo-box'), 'Should format CodeSandbox URL');
  });

});
