---
title: Local Search Architecture
description: How Docboot delivers zero-latency in-browser documentation search without external services.
order: 2
---

# Local Search Architecture

Docboot provides client-side documentation search powered by **MiniSearch**:

> **No external search service and no per-query network requests.**  
> Search runs locally in the browser after the pre-compiled index is loaded on demand.

---

## How Search Works

```text
┌─────────────────────────────────────────────────────────────┐
│                       Build Pipeline                        │
│                                                             │
│  Markdown Files ──► Build-Time Indexer ──► search-index.json│
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      Client Runtime                         │
│                                                             │
│  Cmd + K ──► Lazy-load index & MiniSearch ──► Local Queries │
│                                                             │
│  Zero network requests per keystroke ──► Deep Section Links │
└─────────────────────────────────────────────────────────────┘
```

1. **Build-Time Extraction**: During `docboot build` (or dev mode), pages are parsed into granular section-level records (page title, section heading, text snippet, URL anchor `#`).
2. **Deterministic Indexing**: The index JSON is compressed and hashed into `dist/assets/search-index.json`.
3. **On-Demand Lazy Loading**: The MiniSearch JavaScript runtime and search index are **not** loaded until the user opens search for the first time via `Cmd + K`, `Ctrl + K`, or clicking the search trigger.
4. **Local Query Evaluation**: Once loaded, all typing, fuzzy matching, and prefix searches happen in memory inside the browser with zero network latency.

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Cmd + K` (macOS) / `Ctrl + K` (Windows/Linux) | Open / close search modal |
| `/` | Quick open search |
| `↑` / `↓` | Navigate matching results |
| `Enter` | Select and jump to page or section |
| `Esc` | Close search modal |

---

## Search Features

- **Section-Level Deep Links**: Direct permalinks to specific headings (`/guide/rich-content#safe-embeds`) rather than only full page roots.
- **Typo Tolerance & Fuzzy Matching**: Accidental misspellings still resolve relevant articles.
- **Weighted Relevance Scoring**: Results are ranked by boosting `title` (5x), `headings` (3x), `section` (2x), and `text` (1x).
- **Mobile Responsive**: Sleek touch-friendly icon trigger on mobile viewports; full search bar on desktop.

---

## Customizing Search Configuration

You can tune search parameters in `docboot.config.js`:

```javascript title="docboot.config.js"
export default {
  search: {
    fuzzy: 0.2,       // Fuzzy matching threshold (0 = exact, 0.2 = standard)
    prefix: true,      // Prefix search (matches partial words as you type)
    maxResults: 10,    // Maximum number of visible results
    minQueryLength: 2  // Minimum characters before search executes
  }
};
```

---

## Next Steps

- [Rich Content Primitives](/guide/rich-content) — Callouts, tabs, and details
- [Themes & Customization](/guide/themes) — Dark/light modes and color palettes
- [Architecture & Runtime](/advanced/architecture) — Deep dive into build and client architecture
