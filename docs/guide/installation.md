---
title: Installation & Setup
description: How to install Docboot globally or locally in your project
order: 1
---

# Installation & Setup

Docboot can be run on-demand via `npx`, installed globally as a CLI tool, or added to a project's `devDependencies`.

---

## 1. Global Installation

Install Docboot globally to use the `docboot` command anywhere on your system:

:::tabs group="package-manager"
::tab npm
```bash
npm install -g docboot
```
::tab pnpm
```bash
pnpm add -g docboot
```
::tab yarn
```bash
yarn global add docboot
```
::tab bun
```bash
bun add -g docboot
```
:::

Verify the installation:

```bash
docboot --version
```

---

## 2. Local Project Installation

Add Docboot to your project:

:::tabs group="package-manager"
::tab npm
```bash
npm install --save-dev docboot
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
bun add -d docboot
```
:::

Add scripts to your `package.json`:

```json title="package.json"
{
  "scripts": {
    "docs:dev": "docboot ./docs -o",
    "docs:build": "docboot build ./docs",
    "docs:serve": "docboot serve ./dist",
    "docs:doctor": "docboot doctor ./docs",
    "docs:stats": "docboot stats ./docs"
  }
}
```

---

## Next Steps

- [Configuration Guide](/guide/configuration)
- [CLI Reference](/guide/cli)
- [Rich Content Primitives](/guide/rich-content)
