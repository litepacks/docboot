---
title: Getting Started
description: Quick start guide for Docboot documentation CLI
order: 2
---

# Getting Started

Learn how to create and serve your first documentation site with Docboot in seconds.

---

## 1. Instant Preview with npx

If you already have a folder with Markdown files (e.g. `./docs` or your project root):

:::tabs group="package-manager"
::tab npm
```bash
npx docboot ./docs -o
```
::tab pnpm
```bash
pnpm dlx docboot ./docs -o
```
::tab bun
```bash
bun x docboot ./docs -o
```
:::

This will:
1. Scan your markdown files.
2. Build the navigation tree and local MiniSearch index.
3. Start the live-reloading development server on `http://localhost:3000`.
4. Open the site in your default browser.

---

## 2. Directory Structure

Docboot maps your filesystem hierarchy directly to clean URLs:

```text
docs/
├── README.md               -> /
├── 01-getting-started.md   -> /getting-started
└── guide/
    ├── 01-installation.md  -> /guide/installation
    ├── 02-configuration.md -> /guide/configuration
    └── 03-cli.md           -> /guide/cli
```

:::note Automatic Ordering
Files prefixed with numbers like `01-getting-started.md` will sort naturally first in navigation while rendering clean URLs like `/getting-started`.
:::

---

## 3. Building for Production

When you are ready to deploy:

```bash
docboot build ./docs
```

Static HTML, CSS, JavaScript, and search indexes will be compiled to `./dist`.

---

## Next Steps

- [Installation Guide](/guide/installation)
- [Configuration Guide](/guide/configuration)
- [CLI Reference](/guide/cli)
