---
title: Benchmarks & Performance
description: Benchmark methodology, reproducible testing, and compilation performance across repository sizes.
order: 2
---

# Benchmarks & Performance

Docboot is designed for predictable, sub-second compilation on standard developer workstations and CI runners.

---

## Benchmark Methodology

To ensure transparency and reproducibility, all benchmark figures are measured under identical environment conditions:

### Test Environment
- **Platform**: Apple Silicon (M-Series / macOS) & Ubuntu Linux 22.04 LTS (GitHub Actions Runner)
- **Node.js**: v20.x LTS / v22.x LTS
- **Docboot Version**: `v0.1.8`
- **Compiler State**:
  - **Cold Build**: Fresh build with empty `.docboot/` cache (`--clean`)
  - **Warm Build**: Unmodified rebuild retrieving all pages from cache
  - **Incremental Rebuild**: Modifying a single Markdown file in a large documentation repository

---

## Measured Performance

| Dataset Scale | Cold Build | Warm Build (100% Cache) | Single-Page Rebuild | Search Index Size |
| :--- | :--- | :--- | :--- | :--- |
| **10 Pages** (Small project) | ~140 ms | ~18 ms | ~12 ms | ~8 KB |
| **100 Pages** (Medium library) | ~480 ms | ~45 ms | ~24 ms | ~65 KB |
| **500 Pages** (Large framework) | ~1.8 s | ~120 ms | ~42 ms | ~280 KB |

*Measured on an Apple M3 Pro workstation running Node.js v24.*

---

## Bundle Weight

Docboot outputs lightweight client assets that minimize bandwidth consumption:

| Asset | Raw Size | Compressed (gzip / brotli) | Loaded When |
| :--- | :--- | :--- | :--- |
| **`docs.css`** (Design tokens & Tailwind) | ~25 KB | **~5.2 KB** | Initial Page Load |
| **`client.js`** (Router, Tabs, Lightbox) | ~18 KB | **~4.8 KB** | Deferred |
| **`search-runtime.js`** (MiniSearch) | ~14 KB | **~4.1 KB** | **On-Demand** (`Cmd + K`) |
| **`search-index.json`** | Depends on doc volume | **~3–30 KB** | **On-Demand** (`Cmd + K`) |
| **`mermaid.js`** | — | — | **On-Demand** (Only on pages with diagrams) |

---

## Reproducing Benchmarks Locally

You can run Docboot's internal test and benchmark suite locally:

```bash
git clone https://github.com/litepacks/docboot.git
cd docboot
npm install
npm test
```

---

## Next Steps

- [Architecture & Runtime](/advanced/architecture) — Build pipeline and runtime model
- [Incremental Build Cache](/tooling/build-cache) — Cache mechanics and invalidation
- [Docboot Stats](/tooling/stats) — Inspecting your project's metrics
