---
title: Mermaid Diagrams & Flowcharts
description: Visual architecture and workflow diagrams with zero configuration
order: 5
---

# Mermaid Diagrams

Docboot provides built-in, lazy-loaded **Mermaid** diagram rendering.

---

## 📊 Flowchart Example

```mermaid
graph TD
  MD[Markdown Files] --> Scanner[Filesystem Scanner]
  Scanner --> AST[Markdown AST & Frontmatter]
  AST --> HTML[Static Semantic HTML]
  AST --> MiniSearch[Local Search Index]
  HTML --> Dist[dist/ Ready for CDN]
  MiniSearch --> Dist
```

---

## 🔄 Sequence Diagram Example

```mermaid
sequenceDiagram
  autonumber
  actor User
  participant Browser
  participant Docboot
  participant MiniSearch

  User->>Browser: Types docboot .
  Browser->>Docboot: Request /
  Docboot-->>Browser: Instant Static HTML & CSS
  User->>Browser: Presses Cmd + K
  Browser->>MiniSearch: Lazy-load Search Engine
  MiniSearch-->>Browser: Instant Local Results
```

---

## 💡 How It Works
- **Lazy Loading**: If a page contains no Mermaid diagrams, **zero** Mermaid JavaScript is loaded (preserving ultra-lightweight page weight).
- **Dark & Light Mode Integration**: Diagrams automatically adapt to your active theme mode (`dark` / `light`) and re-render on the fly when switching themes.
