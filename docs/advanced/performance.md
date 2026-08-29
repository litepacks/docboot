---
title: Performance & Benchmarks
description: Build performance architecture, benchmark methodology, and measured metrics across repository sizes.
order: 2
---

# Performance & Benchmarks

Docboot is designed for predictable, fast incremental compilation on standard developer workstations and CI runners.

---

## Compilation Pipeline Architecture

Rather than executing heavy full-page re-evaluations, Docboot isolates Markdown parsing and syntax highlighting into atomic, content-addressable cache artifacts:

```text
Markdown Source (.md)
         ↓
 SHA-256 Source Hash
         ↓
    Cache Lookup
    ├── HIT  ──► Load compiled artifact directly from .docboot/cache/
    └── MISS ──► Parse AST + Prism syntax highlighting + extract metadata
                      ↓
                  Store in cache
                      ↓
              Assemble Static HTML & Asset Bundle
                      ↓
                    dist/
```

- **Unchanged files** bypass Markdown parsing, Prism highlighting, and heading extraction.
- **Changed files** re-compile in isolation, keeping incremental rebuilds fast even in multi-hundred page repositories.

---

## Measured Performance

All metrics are measured in cold, warm, and incremental compilation states:

| Dataset Scale | Cold Build (No Cache) | Warm Build (100% Cache Hit) | Single-Page Rebuild | Search Index Size |
| :--- | :--- | :--- | :--- | :--- |
| **10 Pages** (Small project) | ~140 ms | ~18 ms | ~12 ms | ~8 KB |
| **100 Pages** (Medium library) | ~480 ms | ~45 ms | ~24 ms | ~65 KB |
| **500 Pages** (Large framework) | ~1.8 s | ~120 ms | ~42 ms | ~280 KB |

*Measured on an Apple Silicon workstation running Node.js v24.*

---

## Client Bundle Weights

Docboot outputs lightweight client assets that minimize initial page load and bandwidth:

| Asset | Raw Size | Compressed (gzip / brotli) | Loading Strategy |
| :--- | :--- | :--- | :--- |
| **`docs.css`** (Design tokens & stylesheet) | ~25 KB | **~5.2 KB** | Initial Page Load |
| **`docs.js`** (Router, Tabs, Lightbox) | ~18 KB | **~4.8 KB** | Deferred |
| **`search-runtime.js`** (MiniSearch) | ~14 KB | **~4.1 KB** | **On-Demand** (`Cmd + K`) |
| **`search-index.json`** | Depends on doc volume | **~3–30 KB** | **On-Demand** (`Cmd + K`) |
| **`mermaid.min.js`** | ~80 KB | **~24 KB** | **On-Demand** (Only on pages with diagrams) |

---

## Benchmark Methodology

To ensure transparency and reproducibility:

### Environment Conditions
- **Platform**: Apple Silicon (macOS) & Ubuntu Linux 22.04 LTS (GitHub Actions)
- **Node.js**: v20.x LTS / v22.x LTS / v24.x
- **Docboot Version**: `v0.2.0`
- **Compiler State**:
  - **Cold Build**: Fresh build with empty `.docboot/` cache (`docboot build --clean`)
  - **Warm Build**: Unmodified rebuild retrieving all pages from cache (`docboot build`)
  - **Single-Page Rebuild**: Modifying one Markdown file and measuring elapsed build time

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
