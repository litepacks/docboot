import test from 'node:test';
import assert from 'node:assert';
import { renderAnalyticsHead } from '../src/renderer/analytics.js';
import { renderLayout } from '../src/renderer/layout.js';

test('renderAnalyticsHead generates GA4 scripts', () => {
  const html = renderAnalyticsHead({
    analytics: {
      google: { id: 'G-TEST12345' }
    }
  });

  assert.match(html, /https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-TEST12345/);
  assert.match(html, /gtag\('config', "G-TEST12345"/);
});

test('renderAnalyticsHead generates Plausible scripts with custom apiHost', () => {
  const html = renderAnalyticsHead({
    analytics: {
      plausible: {
        domain: 'docs.example.com',
        apiHost: 'https://stats.example.com'
      }
    }
  });

  assert.match(html, /data-domain="docs\.example\.com"/);
  assert.match(html, /src="https:\/\/stats\.example\.com\/js\/script\.js"/);
});

test('renderAnalyticsHead generates Umami, Fathom, and Clarity scripts', () => {
  const html = renderAnalyticsHead({
    analytics: {
      umami: {
        websiteId: '9876-5432-10',
        src: 'https://analytics.umami.is/script.js'
      },
      fathom: {
        siteId: 'ABCDEF'
      },
      clarity: {
        id: 'clarity_project_id'
      }
    }
  });

  assert.match(html, /data-website-id="9876-5432-10"/);
  assert.match(html, /data-site="ABCDEF"/);
  assert.match(html, /clarity_project_id/);
});

test('renderAnalyticsHead injects custom tracking code', () => {
  const customScript = '<script>console.log("custom analytics");</script>';
  const html = renderAnalyticsHead({
    analytics: {
      custom: customScript
    }
  });

  assert.match(html, /console\.log\("custom analytics"\)/);
});

test('renderLayout embeds analytics head into full HTML layout', () => {
  const page = {
    route: '/',
    title: 'Home',
    html: '<h1>Home</h1>',
    toc: []
  };

  const layout = renderLayout({
    page,
    pages: [page],
    sidebar: [],
    prevNext: { prev: null, next: null },
    breadcrumbs: [],
    config: {
      title: 'Doc Site',
      base: '/',
      analytics: {
        google: 'G-LAYOUTTEST'
      }
    }
  });

  assert.match(layout, /https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-LAYOUTTEST/);
});
