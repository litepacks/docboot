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

## Measured Benchmark Environment

The performance metrics above were captured under the following reproducible benchmark conditions:

```text
Machine:     Apple Silicon (M3 Pro)
OS:          macOS Sonoma 14.x
Node.js:     v24.19.0
Docboot:     v0.2.x
Fixtures:    Synthesized markdown files with frontmatter, 2 code blocks, 4 headings, and links
Timing:      High-resolution wall-clock duration via performance.now()
```

### Definitions
- **Cold Build**: Fresh compilation with an empty cache directory (`docboot build --clean`).
- **Warm Build**: Unmodified rebuild where all unchanged compiled artifacts are retrieved from `.docboot/cache/`.
- **Incremental Rebuild**: A single Markdown file is modified while all unaffected page artifacts are reused from the build cache.

---

## Supported & Tested Environments

Docboot's test suite and compiler are continuously verified across the following platforms:

- **Operating Systems**: macOS (Apple Silicon / Intel), Ubuntu Linux 22.04+ (GitHub Actions CI), Windows 11 (WSL2 / PowerShell)
- **Node.js Runtimes**: Node.js v20.x LTS, v22.x LTS, v24.x
- **Package Managers**: `npm`, `pnpm`, `yarn`, `bun`

---

## Reproducing Benchmarks Locally

You can run Docboot's internal benchmark suite locally:

```bash
git clone https://github.com/litepacks/docboot.git
cd docboot
npm install
npm run benchmark
```

---

## Next Steps

- [Architecture & Runtime](/advanced/architecture) — Build pipeline and runtime model
- [Incremental Build Cache](/tooling/build-cache) — Cache mechanics and invalidation
- [Docboot Stats](/tooling/stats) — Inspecting your project's metrics
