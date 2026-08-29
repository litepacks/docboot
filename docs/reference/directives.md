---
title: Directives Reference
description: Syntax cheatsheet and live visual examples for Docboot Markdown directives and extensions.
order: 3
---

# Directives Reference

Docboot extends standard CommonMark and GitHub Flavored Markdown with clean, non-MDX documentation directives. Directives compile ahead of time into accessible, semantic HTML.

---

## 1. Callout Blocks

Callouts communicate contextual importance using semantic styles, distinct icons, and accessible markup.

### Syntax

```markdown
:::note Note Title
Standard informative note block.
:::

:::tip Helpful Tip
Optimization or recommended best practice.
:::

:::warning Caution
Important warning or breaking change notice.
:::

:::danger Critical Alert
High risk security or data loss warning.
:::
```

### Live Preview

:::note Informative Note
Standard informative note block for background context and helpful explanations.
:::

:::tip Optimization Tip
Use incremental build caching (`.docboot/cache/`) for sub-second rebuilds.
:::

:::warning Deprecation Notice
This configuration option will be deprecated in the upcoming major release.
:::

:::danger Security Warning
Never expose production API keys or credentials in client-side documentation code.
:::

---

## 2. Tabs (`:::tabs`)

Organize related content into accessible, keyboard-navigable tab panels (`WAI-ARIA Tabs 1.2`). Add `group="name"` to synchronize active selections across all pages.

### Syntax

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
::tab yarn
```bash
yarn add docboot
```
:::
````

### Live Preview

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
yarn add --dev docboot
```
::tab bun
```bash
bun add -d docboot
```
:::

---

## 3. Code Groups (`:::code-group`)

Group multiple related code blocks with dedicated file title tabs and syntax highlighting into a compact IDE-style container.

### Syntax

````markdown
:::code-group
```javascript [docboot.config.js]
export default {
  title: 'My Project',
  theme: { preset: 'zinc' }
};
```
```json [package.json]
{
  "name": "my-project",
  "type": "module"
}
```
:::
````

### Live Preview

:::code-group
```javascript [docboot.config.js]
export default {
  title: 'My Project Docs',
  theme: {
    preset: 'zinc',
    defaultMode: 'system'
  }
};
```
```json [package.json]
{
  "name": "my-project-docs",
  "scripts": {
    "dev": "docboot dev ./docs",
    "build": "docboot build ./docs"
  }
}
```
:::

---

## 4. Collapsible Details (`:::details`)

Hide secondary details, full error stack traces, or deep configurations inside native `<details>` elements.

### Syntax

```markdown
:::details Advanced Cache Configuration Details
You can fine-tune memory limits and hashing thresholds inside `docboot.config.js`.
:::
```

### Live Preview

:::details Click to view advanced cache details
The incremental build cache stores deterministic SHA-256 artifacts inside `.docboot/cache/manifest.json`. Builds automatically bypass unchanged AST generation and syntax highlighting.
:::

---

## 5. Safe Embeds (`:::embed`)

Embed responsive videos and interactive frames without layout shifts or arbitrary script execution.

### Syntax

```markdown
:::embed youtube
src: https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ
title: Interactive Product Tour
ratio: 16/9
:::
```

> [!NOTE]
> Embed domains are restricted by default. Customize allowed domains in `docboot.config.js` via `embeds.allowedDomains`.

---

## 6. Image Galleries (`:::gallery`)

Display multi-image galleries with responsive grid alignment, caption overlays, and full keyboard-navigable lightbox viewing (`Arrow Left` / `Arrow Right` / `Esc`).

### Syntax

```markdown
:::gallery
- src: /assets/screens/light-mode.png
  alt: Light Mode Interface
  caption: Clean Zinc light theme

- src: /assets/screens/dark-mode.png
  alt: Dark Mode Interface
  caption: High-contrast Dark theme
:::
```

---

## 7. Typographic Modifiers

Enhance visual rhythm with lead paragraphs and fine-print containers.

### Syntax

```markdown
:::lead
Docboot turns an existing folder of standard Markdown files into a production-ready documentation site in seconds.
:::

:::text-sm
All trademarks and registered trademarks are the property of their respective owners.
:::
```

### Live Preview

:::lead
Docboot turns an existing folder of standard Markdown files into a production-ready documentation site in seconds.
:::

:::text-sm
Docboot is open-source software licensed under the MIT License.
:::

---

## Next Steps

- [Rich Content Primitives](/guide/rich-content) — Complete showcase and interactive features
- [Mermaid Diagrams](/guide/diagrams) — Flowcharts, architecture models, and sequence diagrams
- [Accessibility Guide](/guide/accessibility) — Keyboard navigation and WCAG 2.2 AA compliance
- [CLI Reference](/reference/cli) — All command-line arguments and flags
