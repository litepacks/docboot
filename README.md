# Docboot

> **Turn an existing Markdown folder into production-ready documentation.**  
> Don't create a docs project. Point Docboot at your Markdown.

```bash
npx docboot .
```

[![npm version](https://img.shields.io/npm/v/docboot.svg?color=3b82f6)](https://www.npmjs.com/package/docboot)
[![license](https://img.shields.io/github/license/litepacks/docboot.svg)](LICENSE)
[![tests](https://img.shields.io/badge/tests-passing-emerald.svg)](tests/)

---

## 💡 Why Docboot?

Traditional documentation frameworks require initializing a dedicated frontend application, configuring complex bundlers (Vite, Webpack, Astro), managing JavaScript framework dependencies, and moving your documentation files into framework-specific folder structures.

**Docboot is different:**

```text
Traditional docs tools:
  npm create docs-app ──► Configure framework ──► Move files ──► Maintain dependencies

Docboot workflow:
  cd your-project ──► npx docboot .
```

- **No separate docs project** to scaffold and maintain
- **No framework setup** (React, Vue, or JSX)
- **No file migration** — point directly at your existing Markdown directory
- **No required configuration** — sensible defaults for routes, navigation, search, and themes

---

## ⚡ Core Pillars

### 1. Zero-Config by Default
Point Docboot at any Markdown folder. Clean URLs, numeric prefix sorting, hierarchical sidebars, breadcrumbs, table-of-contents scroll spy, and search indexes are built automatically.

### 2. Static by Default
Markdown files and code blocks are compiled ahead of time into portable, standalone static HTML with zero client-side parser dependencies.

### 3. In-Browser Local Search
No external search services and no per-query network requests. The pre-compiled index is loaded on demand and queried locally in memory with MiniSearch (`Cmd + K`).

### 4. Built-in Docs Tooling
Validate internal cross-links, missing images, and route conflicts with `docboot doctor`, and inspect documentation metrics with `docboot stats`.

---

## 🚀 Quick Start

### 1. Local Development

Start the development server with live reload:

```bash
cd my-project
npx docboot .
```

Or target a specific folder and open your browser automatically:

```bash
npx docboot ./docs -o
```

### 2. Static Production Build

Compile standalone static assets to `./dist`:

```bash
npx docboot build
```

Preview compiled output locally:

```bash
npx docboot serve
```

---

## 🧩 Rich Primitives Without MDX

Build expressive technical documentation using native Markdown directives without JSX:

:::tabs group="package-manager"
::tab npm
```bash
npm install docboot
```
::tab pnpm
```bash
pnpm add docboot
```
:::

- **Callouts**: `:::note`, `:::tip`, `:::warning`, `:::danger`, `:::info`
- **Tabs & Synced Groups**: Synchronized tab selection across articles with `group="..."`
- **Code Groups**: Tabbed multi-language snippets (`:::code-group`)
- **Collapsible Details**: Native accessible `<details>` sections (`:::details`)
- **Mermaid Diagrams**: Interactive flowcharts and sequence graphs with dark/light mode awareness
- **Safe Embeds**: Sandboxed video and interactive demos with strict domain allowlists
- **Galleries & Lightbox**: Responsive image grids and zoom-in lightbox modals

---

## 🩺 Built-in Diagnostics & Tooling

### `docboot doctor`
Inspects documentation health and flags broken links, anchor mismatches, missing images, and route conflicts:

```bash
docboot doctor
```

```text
  ▲ Docboot Doctor — Health Check

  ✔ 12 pages scanned
  ✔ 48 internal links verified
  ✔ 8 local image references verified
  
  Found 0 errors in 18ms.
```

### `docboot stats`
Analyzes documentation metrics, bundle weights, and cache hit rates:

```bash
docboot stats
```

### `docboot setup github`
Generates an official GitHub Actions workflow (`.github/workflows/docs.yml`) for publishing to GitHub Pages:

```bash
docboot setup github
```

---

## 🛠️ CLI Reference

| Command | Description |
| :--- | :--- |
| **`docboot [dir]`** | Starts local development server with SSE live reload |
| **`docboot build [dir]`** | Compiles static HTML and assets to `dist/` |
| **`docboot serve [dir]`** | Serves the static `dist/` folder locally |
| **`docboot doctor [dir]`** | Diagnoses broken links, missing assets, and route collisions |
| **`docboot stats [dir]`** | Inspects page/word counts, bundle weights, and build duration |
| **`docboot setup github`** | Generates GitHub Actions workflow for GitHub Pages |
| **`docboot generate assets`**| Generates SVG favicons, social preview banners, and PWA manifests |
| **`docboot clean [dir]`** | Clears the local `.docboot/` incremental cache folder |

---

## ⚙️ Configuration (`docboot.config.js`)

Docboot works with **zero configuration**. When customization is required, create an optional `docboot.config.js`:

```javascript
export default {
  title: "My Project Documentation",
  description: "High-performance developer documentation",
  docs: "./docs",
  out: "./dist",
  repo: "https://github.com/org/my-project",
  theme: {
    preset: "zinc",          // "zinc" | "ocean" | "emerald" | "violet" | "amber" | "rose"
    defaultMode: "system",   // "system" | "dark" | "light"
    themeToggle: true,       // Dark/light mode switcher
    presetMenu: true,        // Palette and font customizer
    fontSizeControl: true    // A- / A+ reading font-size stepper
  },
  search: {
    fuzzy: 0.2,
    prefix: true,
    maxResults: 10
  },
  pwa: true,
  analytics: {
    google: { id: "G-XXXXXXXXXX" },
    plausible: { domain: "docs.example.com" }
  }
};
```

---

## 📚 Complete Documentation

Explore the full documentation site at **[https://litepacks.github.io/docboot/](https://litepacks.github.io/docboot/)**:

- [Why Docboot?](https://litepacks.github.io/docboot/getting-started/why-docboot)
- [Project Structure & Routing](https://litepacks.github.io/docboot/getting-started/project-structure)
- [Rich Content Primitives](https://litepacks.github.io/docboot/guide/rich-content)
- [Local Search Architecture](https://litepacks.github.io/docboot/guide/search)
- [Themes & Customization](https://litepacks.github.io/docboot/guide/themes)
- [Docboot Doctor](https://litepacks.github.io/docboot/tooling/doctor)
- [GitHub Pages Deployment](https://litepacks.github.io/docboot/tooling/github-pages)
- [CLI Reference](https://litepacks.github.io/docboot/reference/cli)
- [Configuration Reference](https://litepacks.github.io/docboot/reference/configuration)
- [Architecture & Runtime](https://litepacks.github.io/docboot/advanced/architecture)
- [Benchmarks & Performance](https://litepacks.github.io/docboot/advanced/benchmarks)

---

## 📄 License

MIT © 2026 Docboot
