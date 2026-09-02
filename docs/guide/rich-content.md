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
file: /favicon.svg
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

## 14. API Endpoints (`:::endpoint`)

Document REST, GraphQL, or WebSocket endpoints with color-coded HTTP method badges, highlighted path parameters, auth requirement tags, status tags, and a copy button:

:::endpoint GET /api/v1/users/:id auth="Bearer" status="200 OK"
Retrieve detailed user profile information by unique identifier.

:::params Path & Query Parameters
- name: id
  type: string
  required: true
  description: The unique user identifier UUID
- name: include_metadata
  type: boolean
  default: false
  description: Whether to include extra user profile metadata
:::

:::response 200 OK
```json
{
  "id": "usr_94819a82",
  "name": "Alex Smith",
  "role": "admin"
}
```
:::
:::

Syntax:
````markdown
:::endpoint GET /api/v1/users/:id auth="Bearer" status="200 OK"
Description or overview of the endpoint.

:::params
- name: id
  type: string
  required: true
  description: User ID
:::

:::response 200 OK
```json
{ "id": "usr_123" }
```
:::
:::
````

---

## 15. Request & Response Blocks (`:::request` / `:::response`)

Document HTTP payloads, request parameters, and response status codes (2xx emerald, 3xx cyan, 4xx amber, 5xx rose):

:::request POST /api/v1/projects
```json
{
  "title": "Docboot v3",
  "visibility": "public"
}
```
:::

:::response 201 Created
```json
{
  "id": "prj_884920",
  "title": "Docboot v3",
  "createdAt": "2026-09-02T12:00:00Z"
}
```
:::

Syntax:
````markdown
:::request POST /api/v1/projects
```json
{ "title": "New Project" }
```
:::

:::response 201 Created
```json
{ "id": "prj_123" }
```
:::
````

---

## 16. Parameter Specifications (`:::params`)

Render clean, responsive parameter lists without manually writing tedious Markdown tables:

:::params Query Parameters
- name: limit
  type: integer
  default: 20
  required: false
  description: Number of items to return per page (max 100)
- name: sort
  type: string
  required: false
  default: desc
  enum: [asc, desc]
  description: Sort direction by creation date
- name: apiKey
  type: string
  required: true
  description: API authorization key
:::

Syntax:
```markdown
:::params Query Parameters
- name: limit
  type: integer
  default: 20
  required: false
  description: Items per page
- name: sort
  type: string
  enum: [asc, desc]
  description: Sort order
:::
```

---

## 17. Properties, Environment Variables & Config Options

Document individual schema properties, environment variables (`$_` terminal badge), and configuration keys with copy buttons:

:::property timeout
type: number
default: 5000
required: false
Maximum time in milliseconds to wait for a network response before timing out.
:::

:::env DOCBOOT_PORT
type: number
default: 3000
required: false
Local development server port override.
:::

:::config-option pwa.autoUpdate
type: string
default: prompt
enum: [prompt, immediate, false]
Controls the Progressive Web App update notification lifecycle.
:::

---

## 18. Feature & Overview Cards (`:::cards` & `:::card`)

Build interactive card grids with hover elevation, icons, badges, and clickable destination links for overview and landing pages:

:::cards cols="2"
::card Zero Config href="/guide/getting-started" icon="zap" badge="Instant"
Get up and running with automatic file discovery, sensible defaults, and zero build tool hassle.
::
::card Local Search href="/guide/search" icon="search" badge="Pre-indexed"
Lightning-fast client-side search engine with keyboard navigation and zero latency.
::
::card WCAG 2.2 AA href="/guide/accessibility" icon="shield"
Automated accessibility checks with semantic landmarks, keyboard focus management, and screen reader announcements.
::
::card Themes & Design href="/guide/themes" icon="sparkles"
Tailwind-powered styling with dark mode, customizable color palettes, and responsive layouts.
::
:::

Syntax:
````markdown
:::cards cols="2"
::card Zero Config href="/guide/getting-started" icon="zap" badge="Instant"
Instant setup with smart defaults.
::
::card Local Search href="/guide/search" icon="search"
Pre-indexed client search engine.
::
:::
````

---

## 19. Metric & Stat KPI Cards (`:::metrics`)

Display high-impact benchmarks, performance milestones, and system metrics with trend indicators:

:::metrics cols="3"
::metric 84ms Build time trend="-40%"
Ultra-fast compilation speed.
::metric 7.2KB Client JS
Zero runtime framework overhead.
::metric 100% Lighthouse trend="+15%"
Perfect accessibility and SEO scores.
:::

Syntax:
````markdown
:::metrics cols="3"
::metric 84ms Build time trend="-40%"
Fast compilation speed.
::metric 7.2KB Client JS
Minimal bundle footprint.
::metric 100% Lighthouse trend="+15%"
Top tier audit score.
:::
````

---

## 20. Landing Page Hero Banner (`:::hero`)

Create beautiful hero banners with subtle mesh gradients, badges, heading, tagline, and call-to-action buttons:

:::hero
badge: Version 2.4 Released
title: Next-Gen Documentation SSG
tagline: Zero-config technical documentation compiler for modern engineering teams.
primaryText: Get Started
primaryLink: /guide/getting-started
secondaryText: GitHub Repository
secondaryLink: https://github.com/litepacks/docboot
:::

Syntax:
````markdown
:::hero
badge: Version 2.4 Released
title: Next-Gen Documentation SSG
tagline: Zero-config technical documentation compiler for modern engineering teams.
primaryText: Get Started
primaryLink: /guide/getting-started
secondaryText: GitHub
secondaryLink: https://github.com/litepacks/docboot
:::
````

---

## 21. Feature Highlights Grid (`:::features`)

Highlight product capabilities and core architectural strengths:

:::features cols="3"
::feature Instant Build icon="zap"
Compiles hundreds of markdown pages in milliseconds with incremental caching.
::
::feature Automated Accessibility icon="shield"
Built-in WCAG 2.2 AA diagnostics flag heading skips, missing alts, and invalid frames.
::
::feature Portable Output icon="box"
Generates standard static HTML and JSON that can be deployed to any static host.
::
:::

Syntax:
````markdown
:::features cols="3"
::feature Instant Build icon="zap"
Fast compilation pipeline.
::
::feature Automated Accessibility icon="shield"
WCAG 2.2 AA diagnostics.
::
:::
````

---

## 22. Compatibility Matrix (`:::compat`)

Display browser and runtime support grids with platform logos and version pills:

:::compat Browser & Runtime Support
Chrome: 120+
Firefox: 121+
Safari: 17+
Edge: 120+
Node.js: 18+
Deno: 1.38+
Bun: 1.0+
:::

Syntax:
```markdown
:::compat Browser & Runtime Support
Chrome: 120+
Firefox: 121+
Safari: 17+
Edge: 120+
Node.js: 18+
Deno: 1.38+
Bun: 1.0+
:::
```

---

## 23. Keyboard Shortcuts (`:::shortcut` & `:::shortcuts`)

Render realistic 3D keycaps for command palette and navigation shortcuts:

:::shortcuts Global Keybindings
- action: Open Command Palette Search
  mac: Cmd + K
  windows: Ctrl + K
  description: Instant fuzzy search across all documentation pages
- action: Toggle Dark & Light Mode
  mac: Cmd + D
  windows: Ctrl + D
  description: Switch theme color scheme
:::

Syntax:
```markdown
:::shortcuts
- action: Quick Search
  mac: Cmd + K
  windows: Ctrl + K
- action: Toggle Theme
  mac: Cmd + D
  windows: Ctrl + D
:::
```

---

## 24. Live Component Preview (`:::preview`)

Render live interactive UI components alongside their source code:

:::preview Button Component Demo
<div class="flex flex-wrap items-center gap-3">
  <button class="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700 transition-colors cursor-pointer shadow-xs">Primary Action</button>
  <button class="px-4 py-2 bg-muted text-foreground border border-border rounded-lg font-medium text-sm hover:bg-muted/80 transition-colors cursor-pointer">Secondary</button>
</div>
```html
<button class="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium text-sm">Primary Action</button>
<button class="px-4 py-2 bg-muted text-foreground border border-border rounded-lg font-medium text-sm">Secondary</button>
```
:::

---

## 25. Release Notes & Changelogs (`:::changelog`)

Structure release updates with categorized change tags (`Added`, `Changed`, `Fixed`, `Removed`):

:::changelog v2.4.0 date="2026-09-02" title="Rich Documentation Primitives"
::added
- Added API endpoints, requests, responses, and parameters directives.
- Added Cards, Metrics, Hero, Compatibility Matrix, Shortcuts, and Live Previews.
- Added PWA auto-update lifecycle notifications.
::changed
- Improved search indexing compression and sub-millisecond query execution.
::fixed
- Resolved autofocus retention in command palette dialog.
:::

Syntax:
````markdown
:::changelog v2.4.0 date="2026-09-02" title="Release Name"
::added
- New feature A
- New feature B
::fixed
- Bug fix C
::
:::
````

---

## 26. Testimonial & Social Proof (`:::quote`)

Present social proof, user endorsements, and architectural quotes:

:::quote author="Linus Torvalds" title="Creator of Linux & Git" url="https://github.com"
Docboot is lightning fast and gets completely out of the way so developers can focus on writing great documentation.
:::

Syntax:
```markdown
:::quote author="Author Name" title="Role at Company" avatar="https://..." url="https://..."
Endorsement quote text.
:::
```

---

## 27. Chronological Timeline & Roadmaps (`:::timeline`)

Document releases, migration phases, or architectural roadmaps with styled timeline nodes:

:::timeline Product Roadmap
::item 2026 Q3 — Zero-Config Engine
Instant startup with automatic file discovery, pre-indexed client search, and zero build tool hassle.
::item 2026 Q4 — Rich Documentation Directives
Over 40 accessible, interactive directives including API blocks, KPI metrics, hero banners, and component previews.
::item 2027 Q1 — Real-Time Collaborative Docs
Live multi-editor previews and edge SSR rendering plugins.
:::

Syntax:
````markdown
:::timeline Product Roadmap
::item 2026 Q3 — Zero-Config Engine
Instant startup and automatic routing.
::item 2026 Q4 — Rich Documentation Directives
Complete interactive component suite.
:::
````

---

## 28. FAQ & Accordions (`:::faq` & `:::accordion`)

Render accessible, collapsible Q&A accordions with automatic Schema.org `FAQPage` microdata:

:::faq Frequently Asked Questions
::q Is Docboot free and open source?
Yes, Docboot is licensed under the MIT license and is 100% free for both personal and commercial documentation projects.
::q How does the client-side search engine work?
Docboot pre-indexes headings, sections, symbols, and text into a high-performance MiniSearch index during static build time. Search executes locally in browser memory with zero network delay.
::q Can I deploy Docboot to GitHub Pages or Cloudflare Pages?
Yes! Docboot includes one-command deployment workflows for GitHub Pages (`docboot pages`), Cloudflare Pages, Netlify, and Vercel.
:::

Syntax:
````markdown
:::faq Frequently Asked Questions
::q How fast is Docboot?
It compiles hundreds of pages in under 100 milliseconds.
::q Does it support dark mode?
Yes, with seamless system auto-detection and persistence.
:::
````

---

## 29. Pricing Plans & Tier Comparison (`:::pricing`)

Compare edition features and plans with glowing popular highlights:

:::pricing cols="3"
::plan Open Source price="Free" period="forever" badge="MIT Licensed"
- Unlimited documentation pages
- Full offline PWA support
- Pre-indexed MiniSearch engine
- WCAG 2.2 AA accessibility audits
[Get Started](/guide/getting-started)
::
::plan Cloud Hosted price="$19" period="/mo" popular="true" badge="Most Popular"
- Everything in Open Source
- Automatic Git sync & previews
- Custom domain SSL management
- Real-time page analytics
[Explore Guides](/guide/getting-started)
::
::plan Enterprise price="Custom" period="billed annually" badge="Dedicated"
- Everything in Cloud Hosted
- Single Sign-On (SSO / SAML)
- Dedicated SLA & 24/7 support
- On-premise deployment assistance
[GitHub Repo](https://github.com/litepacks/docboot)
::
:::

---

## 30. Enhanced Responsive Data Table (`:::table`)

Wrap tables with smooth horizontal scrolling, zebra striping, and header styling:

:::table Engine Benchmark Matrix
| Documentation Engine | Build Speed | Client Bundle | Runtime Framework | Offline PWA |
| :--- | :---: | :---: | :---: | :---: |
| **Docboot** | **84ms** | **7.2KB** | **Zero Runtime** | **✓ Built-in** |
| Docusaurus | 4.2s | 140KB | React | Plugin Required |
| VitePress | 350ms | 48KB | Vue 3 | Plugin Required |
| GitBook | Cloud Only | >300KB | Proprietary | Cloud Only |
:::

Syntax:
````markdown
:::table Engine Benchmark Matrix
| Engine | Build Speed | Bundle Size |
| :--- | :---: | :---: |
| **Docboot** | **84ms** | **7.2KB** |
| Docusaurus | 4.2s | 140KB |
:::
````

---

## 31. Team Members & Authors (`:::team` & `:::author`)

Introduce project maintainers, core team members, and guide authors with social badges:

:::team cols="2"
::member Sarah Connor role="Lead Architect" github="sarahconnor" twitter="sarahconnor"
Distributed systems engineer leading static compiler performance and caching.
::
::member Ahmet role="Creator & Core Developer" github="ahmet"
Building lightweight developer tooling and modern documentation frameworks.
::
:::

Syntax:
````markdown
:::team cols="2"
::member Sarah Connor role="Lead Architect" github="sarahconnor" twitter="sarahconnor"
Distributed systems engineer.
::
::member Ahmet role="Maintainer" github="ahmet"
Core compiler developer.
::
:::
````

---

## 32. Project Sponsors & Backers (`:::sponsors`)

Recognize supporting organizations and backers with tiered logo cards:

:::sponsors title="Proud Sponsors & Backers" cols="3"
::sponsor Google tier="Platinum" url="https://google.com"
::sponsor Vercel tier="Gold" url="https://vercel.com"
::sponsor Cloudflare tier="Silver" url="https://cloudflare.com"
:::

Syntax:
````markdown
:::sponsors title="Proud Sponsors & Backers" cols="3"
::sponsor Google tier="Platinum" url="https://google.com"
::sponsor Vercel tier="Gold" url="https://vercel.com"
:::
````

---

## 33. Page Rating & Feedback Widget (`:::feedback`)

Collect instant reader feedback with one-click ratings:

:::feedback
title: Was this tutorial helpful?
positiveText: Yes, very helpful
negativeText: Not really
:::

Syntax:
```markdown
:::feedback
title: Was this tutorial helpful?
positiveText: Yes, very helpful
negativeText: Needs improvement
:::
```

---

## 34. Embedded Interactive Code Sandboxes (`:::sandbox`)

Embed live, editable playgrounds from StackBlitz, CodeSandbox, or CodePen:

:::sandbox stackblitz id="vitejs-vite-starter" file="index.html" height="420px" title="Live Vite Playground"
:::

Syntax:
```markdown
:::sandbox stackblitz id="docboot-starter" file="src/index.js" height="500px" title="Live Sandbox"
:::
```

---

## Next Steps

- [Image Optimization Pipeline](/guide/images) — Automatic responsive pictures, WebP/AVIF, and galleries
- [Mermaid Diagrams](/guide/diagrams) — Flowcharts and architecture graphs
- [Docboot Doctor](/tooling/doctor) — Validating links, redirects, and stale pages
- [Configuration Reference](/reference/configuration) — Full options cheatsheet

