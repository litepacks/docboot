---
title: Docboot Stats
description: Inspect documentation word counts, code block metrics, compiled asset sizes, and cache hit rates.
order: 2
---

# Docboot Stats

Docboot includes an inspection command to analyze documentation volume, asset weights, and build performance:

```bash
docboot stats
```

---

## What Stats Measures

`docboot stats` analyzes both your source documentation content and compiled distribution output:

### 1. Content Metrics
- **Pages**: Total number of compiled Markdown documents and automatic category hubs
- **Words**: Aggregate word count across all articles
- **Headings**: Total number of `h1`–`h6` heading anchors
- **Code Blocks**: Number of syntax-highlighted code samples
- **Internal Links**: Total number of cross-document links
- **Images**: Total referenced local and remote assets

### 2. Compiled Asset Sizes
- **CSS Bundle**: Compiled design tokens and stylesheet size (`dist/assets/docs.css`)
- **Client JS Runtime**: Progressive enhancement router and UI bundle size (`dist/assets/client.js`)
- **Search Index**: Pre-compiled MiniSearch index size (`dist/assets/search-index.json`)

### 3. Build & Cache Performance
- **Build Duration**: Total wall-clock compilation time
- **Cache Hit Rate**: Percentage of pages retrieved directly from the incremental build cache without re-parsing

---

## Example Terminal Output

Running `docboot stats` produces a structured summary:

```text
  ▲ Docboot Stats — Project Overview

  Content Metrics
  ──────────────────────────────────────────
  Pages                  12
  Words                  6,420
  Headings               84
  Code Blocks            42
  Internal Links         68
  Referenced Assets      14

  Compiled Asset Sizes
  ──────────────────────────────────────────
  CSS Bundle             24.8 KB  (5.2 KB gzip)
  Client JS              18.4 KB  (4.8 KB gzip)
  Search Index           12.1 KB  (3.1 KB gzip)

  Performance
  ──────────────────────────────────────────
  Build Time             142ms
  Cache Hit Rate         100% (Warm Cache)
```

---

## Next Steps

- [Docboot Doctor](/tooling/doctor) — Validating links and assets
- [Build Cache](/tooling/build-cache) — Cache directory mechanics
- [Benchmarks & Performance](/advanced/benchmarks) — Measured build performance across repository sizes
