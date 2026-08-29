---
title: Architecture & Runtime
description: Static ahead-of-time compilation pipeline and progressive enhancement client runtime.
order: 1
---

# Architecture & Runtime

Docboot is architected as an ahead-of-time static compilation pipeline paired with a lightweight progressive-enhancement runtime.

---

## Static Build Pipeline

```text
┌─────────────────────────────────────────────────────────────┐
│                    1. Discovery Phase                       │
│  Scan Markdown folder ──► Parse Frontmatter & Hierarchy     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    2. Compilation Phase                     │
│  Parse Markdown AST ──► Build-Time Syntax Highlighting      │
│  ──► Extract TOC & Headings ──► Build MiniSearch Records    │
│  ──► Store Atomic Page Artifact in .docboot/cache/          │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    3. Static Assembly                       │
│  Render Full Semantic HTML (Layout, Navigation, Breadcrumbs)│
│  ──► Generate Sitemap, Robots, CNAME, .nojekyll             │
│  ──► Output to dist/                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## What Runs at Build Time vs Client Side

| Component | Build Time (Node.js) | Client Side (Browser) |
| :--- | :--- | :--- |
| **Markdown Parser** | ✅ Fully parsed to HTML | ❌ Zero parser in browser bundle |
| **Syntax Highlighting** | ✅ Prism pre-highlighted | ❌ Zero highlighter in browser bundle |
| **TOC & Headings** | ✅ Pre-extracted slugs & tree | ❌ Only scroll-spy highlights active item |
| **Search Engine** | ✅ Pre-indexed JSON payload | ⚡ MiniSearch queried locally in memory |
| **Navigation & Links** | ✅ Native `<a href>` tags | ⚡ Soft SPA router with prefetching |
| **Directives (`:::`)** | ✅ Compiled to semantic HTML | ⚡ Synchronized tab group state |
| **Diagrams (Mermaid)**| — | ⚡ Lazy-loaded only on pages with diagrams |

---

## Progressive Enhancement

Docboot websites are fully readable and functional even if JavaScript is disabled or blocked by corporate firewalls:

- **Semantic HTML**: All article text, tables, and code snippets exist directly in the initial HTML response.
- **Native `<details>`**: Collapsible details use native browser rendering.
- **Native Links**: Navigation uses standard semantic `<a>` links.
- **Fast First Contentful Paint**: Zero blocking framework hydration steps.

---

## Next Steps

- [Benchmarks & Performance](/advanced/benchmarks) — Measured compilation speeds and bundle sizes
- [Local Search Architecture](/guide/search) — Client-side search implementation
- [Incremental Build Cache](/tooling/build-cache) — Cache mechanics and invalidation
