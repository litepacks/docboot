---
title: Docboot
description: Turn an existing Markdown folder into production-ready documentation with zero configuration.
order: 1
---

# Docboot

> **Turn an existing Markdown folder into production-ready documentation.**  
> Don't create a docs project. Point Docboot at your Markdown.

```bash
npx docboot .
```

---

## What is Docboot?

Docboot is a zero-config documentation CLI that turns any directory of Markdown files into portable static HTML with local in-browser search, progressive enhancement navigation, and built-in docs tooling.

### Traditional Docs vs Docboot

```text
Traditional documentation tools:
1. Initialize a separate documentation repository or workspace
2. Install framework dependencies (Vite, Next, Astro, React, Vue)
3. Write custom config and theme scaffolding
4. Migrate or copy Markdown files into framework structure
5. Maintain documentation framework dependencies over time

Docboot workflow:
1. cd your-existing-project
2. npx docboot .
```

You do not create a separate documentation project, you do not install a frontend framework, and you do not write required configuration files. Docboot compiles the Markdown you already have.

---

## Core Pillars

:::tabs group="pillars"
::tab Zero-Config
### Zero-Config Architecture

Point Docboot at any Markdown folder. File structures and headings are automatically discovered, ordered, and transformed into clean routes, navigation sidebars, breadcrumbs, table of contents, and search indexes without configuration.

```bash
npx docboot ./docs
```
::tab Static by Default
### Portable Static HTML

Pages are compiled ahead of time into standalone HTML with build-time syntax highlighting. Markdown parsing and syntax highlighting never run on the client. Unchanged pages are served from an incremental build cache.

```bash
npx docboot build
```
::tab Local Search
### In-Browser Local Search

No external search service and no per-query network requests. The search index is built at compile time and queried directly inside the browser using MiniSearch with section-level deep linking (`Cmd + K`).
::tab Docs Tooling
### Built-in Docs Tooling

Inspect and validate documentation health before publishing with built-in diagnostic tools:

```bash
docboot doctor    # Broken links, missing images, route conflicts
docboot stats     # Word count, bundle size, cache hit rate
docboot setup github # Automated GitHub Pages CI workflow
```
:::

---

## Quick Start

### 1. Local Preview

Start the local development server with instant live reload:

```bash
cd my-project
npx docboot .
```

```text
  ▲ Docboot v0.1.8

  ✔ Discovered 8 pages
  ✔ Local search index compiled
  ✔ Dev server listening at http://localhost:3000
```

### 2. Production Build

Compile standalone static assets to `dist/`:

```bash
npx docboot build
```

The output in `dist/` is pure static HTML, CSS, and lightweight client assets ready to deploy to GitHub Pages, Cloudflare Pages, Vercel, Netlify, or any static file server.

---

## Explore Documentation

- [Why Docboot?](/getting-started/why-docboot) — Core design philosophy and positioning
- [Project Structure & Routing](/getting-started/project-structure) — File conventions, automatic hubs, and slug resolution
- [Rich Content Primitives](/guide/rich-content) — Callouts, tabs, code groups, details, embeds, and lightboxes without MDX
- [Local Search Architecture](/guide/search) — Client-side MiniSearch indexing and deep linking
- [Themes & Customization](/guide/themes) — Color presets, typography, and visibility toggles
- [Docboot Doctor](/tooling/doctor) — Built-in diagnostics for broken links and invalid assets
- [Docboot Stats](/tooling/stats) — Documentation metrics and bundle analysis
- [GitHub Pages Setup](/tooling/github-pages) — Automated CI workflow generation
- [CLI Reference](/reference/cli) — Commands, flags, and options
- [Architecture & Runtime](/advanced/architecture) — Build pipeline and progressive enhancement model
