---
title: Progressive Web App (PWA)
description: Offline caching, web app manifest generation, and service worker registration.
order: 5
---

# Progressive Web App (PWA)

Docboot supports Progressive Web App (PWA) features for offline reading and standalone installation on mobile and desktop devices.

---

## Enabling PWA Support

PWA features are disabled by default. You can enable them via configuration or CLI flag:

### Via Configuration

```javascript title="docboot.config.js"
export default {
  pwa: true
};
```

### Via CLI Flag

```bash
docboot build --pwa
```

---

## What Docboot Generates

When PWA mode is enabled, the production build automatically generates:

1. **`dist/manifest.webmanifest`**: Configures app name, description, start URL, theme colors, and standalone display mode.
2. **`dist/sw.js` (Service Worker)**: Implements a lightweight **Stale-While-Revalidate** caching strategy.
3. **Precached Core Assets**: HTML pages, CSS stylesheets, client scripts, search index, and SVG favicon are pre-cached during service worker installation.

---

## Offline Caching Behavior

- **Fast Offline Navigation**: Once loaded, visitors can continue browsing previously cached documentation pages even when offline or in airplane mode.
- **Background Updates**: When an active internet connection is available, the service worker fetches fresh content in the background and updates the local cache for subsequent visits.
- **Base-Path Aware**: Pre-cached URLs and manifest start paths automatically respect custom subdirectories (e.g. `/docboot/`).

---

## Next Steps

- [Analytics Integration](/guide/analytics) — Connecting privacy-friendly analytics
- [Production Assets](/guide/assets) — Generating favicons and social banners
- [GitHub Pages Deployment](/tooling/github-pages) — Automated CI/CD deployment
