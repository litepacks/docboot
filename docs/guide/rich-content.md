---
title: Rich Content Primitives
description: Expressive technical documentation primitives and authoring utilities without MDX or JSX.
order: 1
---

# Rich Content Primitives

> **Rich technical documentation without MDX or JSX.**  
> Most documentation UI should not require switching from standard Markdown to JSX frameworks.

Docboot provides expressive, accessible primitives via standard Markdown directives (`:::directive`) that compile ahead of time into portable HTML with progressive enhancement.

---

## 1. Before / After Comparison (`:::compare`)

Compare two screenshots or visual states with an accessible interactive slider:

:::compare
before: https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80
after: https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=80
beforeLabel: Legacy Architecture
afterLabel: Modern Docboot
beforeAlt: Legacy architecture screenshot
afterAlt: Modern Docboot screenshot
:::

### Features:
- **Responsive & Accessible**: Works with mouse drag, touch swipes, and keyboard controls (Arrow keys).
- **Zero JS Fallback**: Shows clean side-by-side or stacked images if JavaScript is disabled.
- **Image Pipeline Integrated**: Optimizes images, generates responsive WebP/AVIF variants, and integrates with the lightbox zoom viewer.

Syntax:
```markdown
:::compare
before: ./images/legacy-ui.png
after: ./images/modern-ui.png
beforeLabel: Before v2
afterLabel: After v2
beforeAlt: Legacy interface screenshot
afterAlt: Modern interface screenshot
:::
```

---

## 2. Steps Walkthrough (`:::steps`)

Structure sequential tutorials, setup guides, and onboarding walkthroughs:

:::steps
::step Install dependencies
Ensure Node.js 18+ is installed on your system, then install the package:

```bash
npm install -D docboot
```
::

::step Initialize project configuration
Create your `docboot.config.js` in the project root:

```js [docboot.config.js]
export default {
  title: 'My Documentation',
  rootDir: 'docs'
};
```
::

::step Start the fast dev server
Launch the local development environment with instant live reload:

```bash
npx docboot dev
```
::
:::

Syntax:
````markdown
:::steps
::step Install dependencies
Run npm install in your terminal.
::

::step Configure your site
Create docboot.config.js.
::
:::
````

---

## 3. Directory File Trees (`:::tree`)

Display structured project folders and file layouts with semantic icons:

:::tree
- package.json
- docboot.config.js
- docs/
  - index.md
  - guide/
    - getting-started.md
    - rich-content.md
    - images.md
  - public/
    - favicon.svg
    - images/
      - hero.png
- dist/
:::

Syntax:
```markdown
:::tree
- package.json
- docboot.config.js
- src/
  - index.js
  - compiler/
    - builder.js
- docs/
  - guide/
    - introduction.md
:::
```

---

## 4. Interactive Terminal Sessions (`:::terminal`)

Show realistic terminal command sessions with window chrome, status markers, and smart command-only copy:

:::terminal title="Terminal — zsh"
$ npx docboot build
✓ Discovered 18 documentation pages
✓ Optimized 12 images (saved 68% bandwidth)
✓ Compiled Tailwind CSS and search index
✓ Static documentation built to ./dist in 142ms
:::

### Features:
- macOS terminal title bar and status markers (`✓`, `⚠`, `✕`, `$`, `>`).
- Smart Copy button copies **only executable commands** (stripping `$` and command outputs).

Syntax:
```markdown
:::terminal title="Terminal — zsh"
$ npm test
✓ 106 tests passed (0 errors)
:::
```

---

## 5. Status & Version Badges

Communicate API lifecycle states, stability, and release milestones inline or in headings:

- Stable: :::badge stable
- Beta: :::badge beta
- Experimental: :::badge experimental
- Deprecated: :::badge deprecated
- Planned: :::badge planned
- Introduced in: :::since 2.4.0

Syntax:
```markdown
API Status: :::badge stable
Added in: :::since 2.4.0
Experimental feature: :::badge experimental
```

---

## 6. Deprecated Notice (`:::deprecated`)

Display clear deprecation warnings with version info and recommended migration paths:

:::deprecated since="2.0.0"
`config.legacyMode` has been removed. Use the new zero-config build pipeline instead.
:::

Syntax:
```markdown
:::deprecated since="2.0.0"
Use `newFunction()` instead of `oldFunction()`.
:::
```

---

## 7. Carousel Walkthrough (`:::carousel`)

Guide readers through multi-step screenshots or product tours:

:::carousel
- src: https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80
  alt: Step 1 Code Editor
  caption: 1. Write clean Markdown with standard directives

- src: https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=80
  alt: Step 2 Terminal
  caption: 2. Build production assets with zero configuration

- src: https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&auto=format&fit=crop&q=80
  alt: Step 3 Deployment
  caption: 3. Deploy instantly to GitHub Pages, Netlify, or Vercel
:::

Syntax:
```markdown
:::carousel
- src: ./images/step-1.png
  alt: Step 1 screenshot
  caption: 1. Configure settings

- src: ./images/step-2.png
  alt: Step 2 screenshot
  caption: 2. Review results
:::
```

---

## 8. Download Cards (`:::download`)

Provide direct download links with automatic file extension detection and size formatting:

:::download
file: ./public/favicon.svg
title: Docboot Brand Assets
description: Official vector SVG logos and icons for press and branding.
version: v2.4.0
:::

Syntax:
```markdown
:::download
file: ./assets/release.zip
title: Offline Documentation Bundle
description: Complete standalone static archive for offline environments.
version: v2.4.0
:::
```

---

## 9. Build-Time QR Codes (`:::qr`)

Generate pure SVG QR codes ahead-of-time during build for mobile device pairing, PWA installation, or quick reference:

:::qr https://github.com/litepacks/docboot
title: Scan to open on mobile device
size: 160
:::

Syntax:
```markdown
:::qr https://example.com/mobile-demo
title: Scan to test on real device
size: 160
:::
```

---

## 10. Collapsible Long Code Blocks

Prevent long configuration files or code snippets from dominating the reading experience:

```json collapse collapsedLines="10"
{
  "name": "docboot-project",
  "version": "1.0.0",
  "description": "High performance technical documentation",
  "main": "index.js",
  "type": "module",
  "scripts": {
    "dev": "docboot dev",
    "build": "docboot build",
    "doctor": "docboot doctor",
    "stats": "docboot stats"
  },
  "dependencies": {
    "docboot": "^2.4.0"
  },
  "devDependencies": {
    "postcss": "^8.4.0"
  },
  "keywords": [
    "documentation",
    "static-site-generator",
    "zero-config",
    "tailwind",
    "markdown"
  ],
  "author": "Docboot Team",
  "license": "MIT"
}
```

Syntax:
````markdown
```json collapse collapsedLines="12"
{ ... long content ... }
```
````

---

## 11. Accessible Callouts

:::tip Pro Tip
You can use `:::tip`, `:::info`, `:::warning`, `:::danger`, and `:::note` with optional custom titles.
:::

:::warning Experimental Feature
This API is subject to changes in upcoming minor releases.
:::

---

## 12. Footnotes

Add bibliographic references and clarifying notes using standard CommonMark footnote syntax[^1].

[^1]: Docboot automatically compiles footnotes with accessible bidirectional back-links (`↩`).

Syntax:
```markdown
Here is a claim[^note].

[^note]: Reference details and backlink.
```

---

## 13. Synchronized Package Manager Tabs

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

---

## Next Steps

- [Image Optimization Pipeline](/guide/images) — Automatic responsive pictures, WebP/AVIF, and galleries
- [Mermaid Diagrams](/guide/diagrams) — Flowcharts and architecture graphs
- [Docboot Doctor](/tooling/doctor) — Validating links, redirects, and stale pages
- [Configuration Reference](/reference/configuration) — Full options cheatsheet
