---
title: Analytics Integration
description: Privacy-first analytics and Google Analytics with automatic SPA pageview tracking.
order: 6
---

# Analytics Integration

Docboot includes first-class, provider-independent support for popular analytics services with **automatic SPA pageview tracking** across soft navigation route changes.

---

## Supported Providers

Configure one or more providers in `docboot.config.js`:

```javascript title="docboot.config.js"
export default {
  analytics: {
    // 1. Google Analytics (GA4)
    google: {
      id: "G-XXXXXXXXXX"
    },

    // 2. Plausible Analytics (Privacy-first)
    plausible: {
      domain: "docs.example.com",
      apiHost: "https://plausible.io" // optional self-hosted instance
    },

    // 3. Umami Analytics (Open-source privacy analytics)
    umami: {
      websiteId: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      src: "https://analytics.umami.is/script.js"
    },

    // 4. Fathom Analytics
    fathom: {
      siteId: "XXXXXX"
    },

    // 5. Microsoft Clarity (Heatmaps and session recordings)
    clarity: {
      id: "XXXXXXXXXX"
    },

    // 6. Custom Analytics / Tag Manager Injection
    custom: `<script defer data-domain="custom" src="https://my-cdn.com/tracker.js"></script>`
  }
};
```

---

## Automatic SPA Route Change Tracking

Because Docboot uses soft SPA navigation to transition between documentation pages with zero full-page reloads, standard script tags alone would only track the initial entry URL.

Docboot solves this by dispatching route change events automatically:
- **GA4 (`gtag`)**: Sends `page_view` events with updated `page_path` and `page_title`.
- **Plausible**: Dispatches `plausible('pageview')` with current URL.
- **Fathom**: Calls `fathom.trackPageview()`.
- **Umami**: Calls `umami.track()` with updated URL and document title.

---

## Privacy & Performance Guarantees

- **Disabled by Default**: No tracking scripts or external telemetry run unless explicitly enabled in your configuration.
- **Asynchronous / Deferred Loading**: Scripts are loaded with `async` or `defer` attributes to avoid blocking the critical rendering path.

---

## Next Steps

- [Production Assets](/guide/assets) — Favicons and social preview cards
- [Docboot Doctor](/tooling/doctor) — Validating links and assets
- [GitHub Pages Deployment](/tooling/github-pages) — Automated deployment workflow
