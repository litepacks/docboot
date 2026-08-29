---
title: Installation & Setup
description: How to run Docboot via npx, global installation, or project dependencies.
order: 1
---

# Installation & Setup

Docboot does not require project scaffolding or manual installation. You can run it instantly using `npx`, `pnpm dlx`, or `bun x`.

---

## 1. Instant Execution (Recommended)

Run Docboot on any folder of Markdown files:

:::tabs group="package-manager"
::tab npm
```bash
npx docboot .
```
::tab pnpm
```bash
pnpm dlx docboot .
```
::tab yarn
```bash
yarn dlx docboot .
```
::tab bun
```bash
bun x docboot .
```
:::

---

## 2. Project Local Dependency

If you want to add Docboot as a development dependency in your existing `package.json`:

:::tabs group="package-manager"
::tab npm
```bash
npm install -D docboot
```
::tab pnpm
```bash
pnpm add -D docboot
```
::tab yarn
```bash
yarn add -D docboot
```
::tab bun
```bash
bun add -D docboot
```
:::

Add convenient scripts to your `package.json`:

```json title="package.json"
{
  "scripts": {
    "docs:dev": "docboot ./docs -o",
    "docs:build": "docboot build ./docs",
    "docs:serve": "docboot serve ./dist",
    "docs:doctor": "docboot doctor ./docs"
  }
}
```

---

## 3. Global Installation

To make `docboot` available everywhere as a global CLI tool:

```bash
npm install -g docboot
```

After installation, run `docboot` from any directory:

```bash
docboot .
docboot doctor
docboot build
```

---

## Next Steps

- [Configuration Reference](/reference/configuration) — Optional custom configuration
- [Rich Content Primitives](/guide/rich-content) — Callouts, tabs, and details
- [CLI Reference](/reference/cli) — Full list of CLI commands and flags
