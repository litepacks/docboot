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

Docboot is a zero-config documentation CLI that transforms any directory of Markdown files into portable static HTML with local in-browser search, progressive enhancement navigation, and built-in docs tooling.

### Framework-Oriented Docs vs Docboot

Many framework-oriented documentation tools start by scaffolding or configuring a dedicated docs application:

```text
Framework-oriented workflow:
1. Scaffold dedicated documentation workspace
2. Configure bundler, routing, and theme templates
3. Import or restructure Markdown files
4. Maintain documentation application dependencies

Docboot workflow:
1. cd your-existing-project
2. npx docboot .
```

You do not create a separate documentation project, you do not install a frontend framework, and you do not write required configuration files. Docboot compiles the Markdown you already have.

---

## Core Highlights

### 1. Zero-Config Markdown
Point Docboot at any Markdown folder. File structures and headings are automatically discovered, ordered, and transformed into clean routes, navigation sidebars, breadcrumbs, table of contents, and search indexes without configuration.

```bash
npx docboot ./docs
```

### 2. Incremental Static Builds
Pages are compiled ahead of time into standalone HTML with build-time syntax highlighting. Unchanged Markdown files are served directly from the `.docboot/` incremental cache, avoiding redundant parsing and highlighting.

```bash
npx docboot build
```

### 3. In-Browser Local Search
No external search service and no per-query network requests. The search index is generated at compile time and queried directly inside the browser using MiniSearch with section-level deep linking (`Cmd + K`).

### 4. Built-in Tooling (`doctor` & `stats`)
Validate and inspect documentation health before publishing:
- `docboot doctor` validates broken links, missing images, duplicate routes, and frontmatter.
- `docboot stats` measures word counts, code block volume, and compiled bundle weights.

### 5. Rich Primitives Without MDX
Accessible tabs, synchronized tab groups, multi-language code groups, collapsible details, and sandboxed video/demo embeds using standard Markdown directives (`:::tabs`, `:::code-group`, `:::details`).

### 6. Automated GitHub Pages Setup
Generate an official GitHub Actions workflow configured with automated base-path resolution with a single command:

```bash
docboot setup github
```

### 7. Themes & Theme-Aware Diagrams
Includes 6 curated color presets (`Zinc`, `Ocean`, `Emerald`, `Violet`, `Amber`, `Rose`), reading font-size scaling, and lazy-loaded Mermaid diagrams with dark/light mode synchronization.

---

## Quick Start

### 1. Local Preview

Start the local development server with Server-Sent Events (SSE) live reload:

```bash
cd my-project
npx docboot .
```

```text
  ▲ Docboot v0.2.0

  ✔ Discovered 24 pages
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

## Documentation Index

- **Getting Started**:
  - [Quick Start](/getting-started/quick-start) — Run Docboot in under a minute
  - [Why Docboot?](/getting-started/why-docboot) — Design philosophy vs traditional docs frameworks
  - [Project Structure & Routing](/getting-started/project-structure) — Clean routes and automatic category hubs

- **Guide**:
  - [Installation & Setup](/guide/installation) — npm, pnpm, yarn, and global usage
  - [Rich Content Primitives](/guide/rich-content) — Tabs, code groups, callouts, and details
  - [Local Search Architecture](/guide/search) — Client-side MiniSearch indexing
  - [Themes & Customization](/guide/themes) — Color presets, typography, and controls
  - [Mermaid Diagrams](/guide/diagrams) — Interactive flowcharts and sequence graphs
  - [PWA & Offline Reading](/guide/pwa) — Service Worker and manifest support
  - [Analytics Integration](/guide/analytics) — Privacy-first analytics setup

- **Tooling**:
  - [Docboot Doctor](/tooling/doctor) — Diagnostics for links, images, and routes
  - [Docboot Stats](/tooling/stats) — Documentation metrics and bundle analysis
  - [Incremental Build Cache](/tooling/build-cache) — Cache mechanics and invalidation
  - [GitHub Pages Setup](/tooling/github-pages) — Automated workflow setup
  - [Production Assets](/tooling/assets) — Favicons, OG social cards, and manifests

- **Advanced**:
  - [Architecture & Runtime](/advanced/architecture) — Build pipeline vs client runtime
  - [Performance & Benchmarks](/advanced/performance) — Measured compilation speeds and methodology

- **Reference**:
  - [CLI Reference](/reference/cli) — Commands, flags, and shorthand combinations
  - [Configuration Reference](/reference/configuration) — All docboot.config.js options
  - [Directives Reference](/reference/directives) — Syntax reference for Markdown extensions
