---
title: Redirects & Aliases
description: Prevent broken links and seamlessly migrate documentation URLs using build-time static redirects, page aliases, and validation.
order: 11
---

# Redirects & Aliases

When restructuring, renaming, or migrating documentation pages, maintaining stable URLs is crucial to prevent 404 errors for external search engines, bookmarks, and developer links.

Docboot provides **zero-runtime, build-time static redirects and aliases** compatible with any static hosting provider (GitHub Pages, Netlify, Cloudflare Pages, Vercel, S3).

---

## 1. Core Concepts

Docboot distinguishes between two related concepts:

| Concept | Declaration | Behavior |
| :--- | :--- | :--- |
| **Redirect** | `docboot.config.js` (`redirects`) | Old/legacy path permanently moves to a new canonical URL. |
| **Alias** | Markdown frontmatter (`aliases`) | Alternate discoverable route for the same page; enriches search. |
| **Legacy Redirect** | Markdown frontmatter (`redirectFrom`) | Legacy URL redirecting to this page; excluded from user-facing search. |

Each page has exactly **one canonical route**. SEO `<link rel="canonical">` and `sitemap.xml` always point exclusively to the canonical URL.

---

## 2. Configuration Redirects

Define project-level route redirects in `docboot.config.js`:

```javascript title="docboot.config.js"
export default {
  redirects: {
    "/old-api": "/reference/api",
    "/guide/install": "/getting-started/installation",
    "/docs/config": "/reference/configuration",
    "/old-options": "/reference/configuration#search",
    "/legacy-docs": "https://legacy.example.com/docs"
  }
};
```

Docboot automatically normalizes paths:
- Leading and trailing slashes (`/old/`, `old`, `/old`)
- Stripped `.html` and `.md` file extensions (`old.html` $\to$ `/old`)
- Anchors (`#search`) and query strings (`?tab=node`)

---

## 3. Page-Level Aliases (`frontmatter`)

You can attach alternate paths directly to any Markdown document's YAML frontmatter:

```markdown title="docs/tooling/build-cache.md"
---
title: Build Cache
aliases:
  - /cache
  - /incremental-cache
  - /compiler-cache
keywords:
  - caching
  - multi-tier
---

# Build Cache
Docboot features multi-tier incremental compilation caching...
```

### `aliases` vs `redirectFrom`

- **`aliases`**: Alternate discoverable routes that also index terms for search. Searching `/cache` or `compiler-cache` returns the canonical `/tooling/build-cache` page.
- **`redirectFrom`**: Deprecated or legacy URLs that only emit static redirect pages without indexing legacy routes into search results.

```markdown title="docs/getting-started/installation.md"
---
title: Installation
redirectFrom:
  - /old-v1-install
  - /setup-legacy
---
```

---

## 4. Static Hosting & Accessible Fallbacks

During static site generation (`docboot build`), Docboot creates lightweight, WCAG 2.2 AA compliant directory-style HTML redirect pages (e.g. `dist/old-api/index.html`):

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Redirecting to /reference/api/</title>
  <link rel="canonical" href="/reference/api/">
  <meta http-equiv="refresh" content="0; url=/reference/api/">
  <meta name="robots" content="noindex, follow">
  <script>window.location.replace("/reference/api/");</script>
</head>
<body>
  <div class="redirect-card">
    <p>This page has moved.</p>
    <p><a href="/reference/api/">/reference/api/</a></p>
    <a href="/reference/api/">Click here if not redirected</a>
  </div>
</body>
</html>
```

### Static Host Providers

- **Universal Static Hosting / GitHub Pages**: Redirect HTML handles instant meta-refresh and JS `location.replace`.
- **Netlify & Cloudflare Pages**: Docboot automatically emits a top-level `_redirects` file (`/old-api /reference/api 301`) for instant edge redirects.

---

## 5. Base Path Awareness

Redirects automatically respect configured base URLs (e.g. GitHub Pages deployments with `base: '/docboot/'`):

- Source: `/old-api`
- Generated Redirect: Points to `/docboot/reference/api/` with `<link rel="canonical" href="/docboot/reference/api/">`.

---

## 6. Doctor & Graph Diagnostics

Run `docboot doctor` to validate your entire documentation redirect graph:

```bash
docboot doctor
```

Docboot validates:
1. **Loop Detection**: Arbitrary multi-hop cycle detection ($/a \to /b \to /c \to /a$) flagged as errors.
2. **Chain Flattening**: Chains ($/a \to /b \to /c$) reported as warnings and automatically flattened at build time.
3. **Missing Targets**: Non-existent target routes reported with intelligent fuzzy *"Did you mean"* suggestions.
4. **Anchor Validation**: Verifies that target anchors (`#heading-id`) exist on the destination page.
5. **Collision Detection**: Prevents redirects from overwriting real documentation pages.
6. **Alias Conflicts**: Ensures two separate pages do not claim the same alias.
7. **Security Checks**: Rejects unsafe URL schemes (`javascript:`, `data:`).
