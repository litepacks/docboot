---
title: Quick Start
description: Get up and running with Docboot in seconds.
order: 1
---

# Quick Start

Docboot is designed to start directly from the Markdown files you already have in your repository.

---

## 1. Instant Local Preview

Run Docboot in your project directory without installing any global dependencies:

```bash
cd my-project
npx docboot .
```

Open `http://localhost:3000` in your browser. Docboot watches for changes in Markdown files and updates the page via Server-Sent Events (SSE) live reload.

If your Markdown files reside in a specific subfolder (such as `docs/`), pass the folder path:

```bash
npx docboot ./docs -o
```

The `-o` (`--open`) flag automatically opens your default web browser once the server starts.

---

## 2. Production Static Build

To generate the static production website:

```bash
npx docboot build
```

This compiles your Markdown files into the `./dist` folder:

```text
dist/
├── index.html
├── 404.html
├── sitemap.xml
├── robots.txt
├── .nojekyll
├── assets/
│   ├── docs.css
│   ├── docs.js
│   ├── search-runtime.js
│   └── search-index.json
└── guide/
    └── installation/
        └── index.html
```

---

## 3. Preview Production Build Locally

To test the compiled static output locally:

```bash
npx docboot serve
```

This starts a lightweight HTTP server serving `./dist` with accurate 404 handling and static asset headers.

---

## 4. Validating Documentation Health

Before deploying, run the built-in diagnostic tool to catch broken links, missing assets, and route conflicts:

```bash
npx docboot doctor
```

---

## Next Steps

- [Why Docboot?](/getting-started/why-docboot) — Design philosophy vs traditional docs frameworks
- [Project Structure & Routing](/getting-started/project-structure) — Clean routes and automatic category hubs
- [CLI Reference](/reference/cli) — All available commands and flags
