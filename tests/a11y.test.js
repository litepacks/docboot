import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  calculateLuminance,
  calculateContrastRatio,
  validateAccessibility,
  THEME_CONTRASTS
} from '../src/doctor/a11y.js';
import { parseMarkdown } from '../src/markdown/parser.js';
import { renderLayout } from '../src/renderer/layout.js';

describe('Accessibility & WCAG 2.2 AA Compliance Suite', () => {

  describe('WCAG 2.2 Contrast & Relative Luminance Math', () => {
    test('calculates correct relative luminance for pure black and white', () => {
      const lumWhite = calculateLuminance('#ffffff');
      const lumBlack = calculateLuminance('#000000');
      assert.strictEqual(Math.round(lumWhite), 1);
      assert.strictEqual(Math.round(lumBlack), 0);
    });

    test('calculates contrast ratio of black on white as 21:1', () => {
      const ratio = calculateContrastRatio('#000000', '#ffffff');
      assert.strictEqual(Math.round(ratio), 21);
    });

    test('all built-in Docboot themes meet WCAG 2.2 AA contrast >= 4.5:1 for body text', () => {
      for (const [themeName, colors] of Object.entries(THEME_CONTRASTS)) {
        const ratio = calculateContrastRatio(colors.foreground, colors.background);
        assert.ok(
          ratio >= 4.5,
          `Theme "${themeName}" contrast ratio ${ratio.toFixed(2)}:1 must be >= 4.5:1 (WCAG AA)`
        );
      }
    });
  });

  describe('Accessibility Doctor (validateAccessibility)', () => {
    test('flags images without alt text', () => {
      const mockPages = [
        {
          relativePath: 'docs/test.md',
          route: '/test',
          html: '<p><img src="/assets/diagram.png"></p>'
        }
      ];

      const report = validateAccessibility(mockPages, {});
      assert.strictEqual(report.errors.length, 1);
      assert.strictEqual(report.errors[0].type, 'A11y: Missing Image Alt');
    });

    test('accepts images with descriptive alt text', () => {
      const mockPages = [
        {
          relativePath: 'docs/test.md',
          route: '/test',
          html: '<p><img src="/assets/diagram.png" alt="Architecture diagram showing build flow"></p>'
        }
      ];

      const report = validateAccessibility(mockPages, {});
      assert.strictEqual(report.errors.length, 0);
      assert.ok(report.passes.some(p => p.toLowerCase().includes('image description')));
    });

    test('flags heading hierarchy skips (e.g. h1 followed directly by h3)', () => {
      const mockPages = [
        {
          relativePath: 'docs/guide.md',
          route: '/guide',
          html: '<h1>Main Title</h1><p>Some intro</p><h3>Skipped Subheading</h3>'
        }
      ];

      const report = validateAccessibility(mockPages, {});
      assert.strictEqual(report.warnings.length, 1);
      assert.strictEqual(report.warnings[0].type, 'A11y: Heading Hierarchy Skip');
    });

    test('flags iframes missing title attributes', () => {
      const mockPages = [
        {
          relativePath: 'docs/embed.md',
          route: '/embed',
          html: '<iframe src="https://www.youtube-nocookie.com/embed/xyz"></iframe>'
        }
      ];

      const report = validateAccessibility(mockPages, {});
      assert.strictEqual(report.errors.length, 1);
      assert.strictEqual(report.errors[0].type, 'A11y: Missing Iframe Title');
    });

    test('verifies accessible tablist and tabpanel semantics', () => {
      const md = `:::tabs
::tab Tab 1
Content 1
::tab Tab 2
Content 2
:::`;
      const parsed = parseMarkdown(md);
      assert.ok(parsed.html.includes('role="tablist"'));
      assert.ok(parsed.html.includes('role="tab"'));
      assert.ok(parsed.html.includes('role="tabpanel"'));
      assert.ok(parsed.html.includes('tabindex="0"'));
    });
  });

  describe('HTML Layout Semantic Landmarks & Live Region', () => {
    test('renders skip link, landmarks, live region, and dialog semantics in layout', () => {
      const page = {
        title: 'Accessibility Guide',
        route: '/guide/accessibility',
        relativePath: 'guide/accessibility.md',
        html: '<h1>Accessibility</h1><p>Docboot is accessible by default.</p>',
        toc: [{ id: 'accessibility', title: 'Accessibility', level: 1 }]
      };

      const html = renderLayout({
        page,
        pages: [page],
        sidebar: [{ title: 'Guide', items: [{ title: 'Accessibility', route: '/guide/accessibility' }] }],
        config: { title: 'Docboot', lang: 'en' },
        base: '/'
      });

      // Skip link
      assert.ok(html.includes('class="docboot-skip-link skip-link"'));
      assert.ok(html.includes('href="#main-content"'));

      // Semantic landmarks
      assert.ok(html.includes('role="banner"'));
      assert.ok(html.includes('id="main-content"'));
      assert.ok(html.includes('role="main"'));
      assert.ok(html.includes('role="article"'));
      assert.ok(html.includes('role="contentinfo"'));
      assert.ok(html.includes('aria-label="Main documentation navigation"'));
      assert.ok(html.includes('aria-current="page"'));

      // Live Announcer
      assert.ok(html.includes('id="docboot-a11y-live"'));
      assert.ok(html.includes('aria-live="polite"'));

      // Search Dialog
      assert.ok(html.includes('role="dialog"'));
      assert.ok(html.includes('aria-modal="true"'));
      assert.ok(html.includes('aria-label="Search documentation"'));
    });
  });

});
