---
title: Mermaid Diagrams & Flowcharts
description: Visual architecture and workflow diagrams with zero configuration and dark mode support.
order: 3
---

# Mermaid Diagrams

Docboot provides built-in, lazy-loaded **Mermaid** diagram support without plugins or extra configuration.

---

## 1. Flowchart Example

````markdown
```mermaid
graph TD
  MD[Markdown Files] --> Scanner[Filesystem Scanner]
  Scanner --> Compiler[Markdown Compiler]
  Compiler --> HTML[Static Semantic HTML]
  Compiler --> MiniSearch[Local Search Index]
  HTML --> Dist[dist/ Portable Output]
  MiniSearch --> Dist
```
````

```mermaid
graph TD
  MD[Markdown Files] --> Scanner[Filesystem Scanner]
  Scanner --> Compiler[Markdown Compiler]
  Compiler --> HTML[Static Semantic HTML]
  Compiler --> MiniSearch[Local Search Index]
  HTML --> Dist[dist/ Portable Output]
  MiniSearch --> Dist
```

---

## 2. Sequence Diagram Example

````markdown
```mermaid
sequenceDiagram
  autonumber
  actor Developer
  participant Browser
  participant Docboot
  participant MiniSearch

  Developer->>Browser: Types npx docboot .
  Browser->>Docboot: Request /
  Docboot-->>Browser: Static HTML & CSS
  Developer->>Browser: Presses Cmd + K
  Browser->>MiniSearch: Lazy-load Search Runtime
  MiniSearch-->>Browser: In-Browser Local Search Results
```
````

```mermaid
sequenceDiagram
  autonumber
  actor Developer
  participant Browser
  participant Docboot
  participant MiniSearch

  Developer->>Browser: Types npx docboot .
  Browser->>Docboot: Request /
  Docboot-->>Browser: Static HTML & CSS
  Developer->>Browser: Presses Cmd + K
  Browser->>MiniSearch: Lazy-load Search Runtime
  MiniSearch-->>Browser: In-Browser Local Search Results
```

---

## Features

- **Lazy Loading**: If a document contains no diagrams, Mermaid JavaScript is **never** downloaded.
- **Theme-Aware Rendering**: Diagrams automatically adapt to your active theme mode (`dark` / `light`) and re-render seamlessly when you toggle themes.
- **Interactive Modal & Pan-Zoom**: Hover over any diagram and click **Expand Diagram** to open a full-screen view with interactive pan and zoom controls for large architecture graphs.

---

## Next Steps

- [Local Search Architecture](/guide/search) — Client-side search indexing
- [Themes & Customization](/guide/themes) — Color presets and typography
- [Rich Content Primitives](/guide/rich-content) — Callouts, tabs, and details
