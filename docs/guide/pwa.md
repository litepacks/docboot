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

## Auto-Update Lifecycle

Docboot features an automated Service Worker lifecycle with dynamic cache versioning (`docboot-cache-v...`) and prompt notification toasts:

### Auto-Update Modes

```javascript title="docboot.config.js"
export default {
  pwa: {
    enabled: true,
    autoUpdate: 'prompt', // 'prompt' (toast notification) | 'immediate' (auto-reload) | false
    checkInterval: 60 * 60 * 1000 // Periodic check in milliseconds (default: 1 hour)
  }
};
```

- **`prompt` (default)**: When a new build is detected, a sleek floating notification toast appears: *"Update Available — New documentation version is ready [Refresh]"*. Clicking Refresh applies the update and reloads the page.
- **`immediate`**: Automatically activates the new Service Worker and reloads open tabs seamlessly.
- **Tab Focus & Visibility Triggers**: Docboot automatically checks for updates whenever visitors return to the browser tab (`visibilitychange` / `window.focus`).

---

## Offline Caching Behavior

- **Fast Offline Navigation**: Once loaded, visitors can continue browsing previously cached documentation pages even when offline or in airplane mode.
- **Background Updates**: When an active internet connection is available, the service worker fetches fresh content in the background and updates the local cache for subsequent visits.
- **Base-Path Aware**: Pre-cached URLs and manifest start paths automatically respect custom subdirectories (e.g. `/docboot/`).

---

## Next Steps

- [Analytics Integration](/guide/analytics) — Connecting privacy-friendly analytics
- [Production Assets](/tooling/assets) — Generating favicons and social banners
- [GitHub Pages Setup](/tooling/github-pages) — Automated CI/CD workflow setup
