---
title: Rich Content Primitives
description: Guide on tabs, code groups, collapsible details, embeds, galleries, and lightbox in Docboot.
order: 4
---

# Rich Content Primitives

Docboot includes high-value built-in documentation primitives so you can create richer technical documentation without needing MDX, React components, or raw HTML.

---

## 1. Accessible Tabs & Synced Groups

Create responsive tabs with standard `:::tabs` syntax:

:::tabs group="package-manager"
::tab npm
```bash
npm install docboot
```
::tab pnpm
```bash
pnpm add docboot
```
::tab yarn
```bash
yarn add docboot
```
::tab bun
```bash
bun add docboot
```
:::

> **Synced Tabs**: Notice `group="package-manager"`. When you choose `pnpm`, all other tabs on the page with the same group will switch in real-time and save your preference in `localStorage`!

:::tabs group="package-manager"
::tab npm
```bash
npx docboot . -o
```
::tab pnpm
```bash
pnpm exec docboot . -o
```
::tab yarn
```bash
yarn docboot . -o
```
::tab bun
```bash
bun x docboot . -o
```
:::

---

## 2. Code Groups

Organize multi-language code examples compactly:

:::code-group
```js [JavaScript]
export function greet(name) {
  return `Hello, ${name}!`;
}
```

```ts [TypeScript]
export function greet(name: string): string {
  return `Hello, ${name}!`;
}
```

```python [Python]
def greet(name: str) -> str:
    return f"Hello, {name}!"
```

```rust [Rust]
pub fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}
```
:::

---

## 3. Collapsible Sections (`:::details`)

Use native, accessible `<details>` elements that degrade gracefully even with JavaScript disabled:

:::details Advanced Config Example
```javascript
// docboot.config.js
export default {
  theme: {
    preset: "ocean"
  },
  embeds: {
    allowedDomains: ["youtube.com", "codesandbox.io", "stackblitz.com"]
  }
};
```
:::

---

## 4. Safe Embeds (`:::embed`)

Embed interactive sandboxes and videos with responsive aspect ratios, lazy loading, and domain allowlists:

:::embed youtube
src: https://www.youtube.com/watch?v=dQw4w9WgXcQ
title: Getting Started Video Walkthrough
ratio: 16/9
:::

---

## 5. Image Lightbox & Galleries

All standard Markdown images automatically support lazy loading and full-size accessible lightbox modals on click.

You can also create explicit image galleries:

:::gallery
- src: https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&auto=format&fit=crop&q=80
  alt: Source Code
  caption: Clean architecture and modular components

- src: https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop&q=80
  alt: Developer Workspace
  caption: High performance local development server

- src: https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80
  alt: Analytics
  caption: Comprehensive metrics and build statistics
:::
