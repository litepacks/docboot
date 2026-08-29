---
title: Rich Content Primitives
description: Rich technical documentation primitives without MDX or JSX.
order: 1
---

# Rich Content Primitives

> **Rich documentation without MDX or JSX.**  
> Most documentation UI should not require switching from standard Markdown to JSX components.

Docboot provides expressive, accessible primitives via standard Markdown directives (`:::directive`) that compile ahead of time into portable HTML.

---

## 1. Callout Containers

Highlight important notes, warnings, and tips:

:::tip Pro Tip
You can use `:::tip`, `:::info`, `:::warning`, `:::danger`, and `:::note` with optional custom titles.
:::

:::warning Experimental Feature
This API is subject to changes in upcoming minor releases.
:::

:::danger Critical Requirement
Never commit production API keys or credentials to public Git repositories.
:::

Syntax:
```markdown
:::tip Pro Tip
Content goes here.
:::

:::warning
Experimental API.
:::
```

---

## 2. Accessible Tabs & Synced Groups

Create responsive tab interfaces with optional cross-page synchronized selection:

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

When `group="package-manager"` is set, selecting `pnpm` will automatically switch all other tabs on the website with the same group name and persist the preference in `localStorage`.

Syntax:
````markdown
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
````

---

## 3. Code Groups

Display multi-language code snippets with tabbed file headers:

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

Syntax:
````markdown
:::code-group
```js [JavaScript]
const x = 1;
```
```ts [TypeScript]
const x: number = 1;
```
:::
````

---

## 4. Collapsible Details (`:::details`)

Native, accessible `<details>` elements that work smoothly with or without JavaScript:

:::details Advanced Build Options
When building in resource-constrained CI environments, you can disable compression or clear cache:
```bash
docboot build --clean --no-cache
```
:::

Syntax:
```markdown
:::details Custom Title
Content visible when expanded.
:::
```

---

## 5. Text Size Modifiers

Control typographic hierarchy for introductory text and fine print:

:::lead
Lead paragraphs are styled with larger, high-contrast typography for chapter introductions.
:::

:::text-sm
Smaller auxiliary text or fine print for terms and references.
:::

Syntax:
```markdown
:::lead
Introductory paragraph.
:::

:::text-sm
Fine print note.
:::
```

---

## 6. Safe Embeds (`:::embed`) & Security Model

Docboot includes a secure, sandboxed embedding mechanism for external demos and videos:

:::embed youtube
src: https://www.youtube.com/watch?v=dQw4w9WgXcQ
title: Getting Started Video Walkthrough
ratio: 16/9
:::

### Security Model:
- **Domain Allowlist**: Embed sources must match allowed domains configured in `docboot.config.js` (default: `youtube.com`, `codesandbox.io`, `stackblitz.com`, `codepen.io`, `vimeo.com`).
- **Iframe Sandbox**: Rendered with strict `loading="lazy"`, `referrerpolicy="no-referrer"`, and sandbox attributes.
- **Safe Fallback**: Any disallowed domain or malformed URL is safely rejected by `docboot doctor` and rendered as a secure external link.

---

## 7. Image Lightbox & Galleries

All standard Markdown images automatically support zoom-in lightbox modals.

You can also group multiple images into responsive grid galleries:

:::gallery
- src: https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&auto=format&fit=crop&q=80
  alt: Source Code
  caption: Clean architecture and modular components

- src: https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop&q=80
  alt: Developer Workspace
  caption: High performance local development server
:::

---

## Next Steps

- [Mermaid Diagrams](/guide/diagrams) — Interactive flowcharts and architecture graphs
- [Directives Reference](/reference/directives) — Complete directive syntax cheatsheet
- [Docboot Doctor](/tooling/doctor) — Validating broken directives and missing images
