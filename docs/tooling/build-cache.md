---
title: Incremental Build Cache
description: Content-addressable incremental caching in .docboot/cache/.
order: 3
---

# Incremental Build Cache

Docboot implements an incremental build cache stored in `.docboot/cache/` to avoid re-parsing unchanged Markdown files and re-running syntax highlighters.

> **Core Principle**:  
> Cache makes builds faster, but it is **never required for correctness**.

### Build Modes
- **Cold Build**: No reusable compiled artifacts. All pages are parsed and rendered from scratch.
- **Warm Build**: All unchanged compiled artifacts are retrieved directly from `.docboot/cache/`.
- **Incremental Rebuild**: Modified source files are re-compiled while unaffected page artifacts are reused from cache.

---

## How the Cache Works

```text
┌─────────────────────────────────────────────────────────────┐
│                    Source File (.md)                        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                       SHA-256 Content Hash
                               │
                               ▼
               ┌───────────────────────────────┐
               │    Is Source Hash in Cache?   │
               └───────┬───────────────┬───────┘
                       │               │
                  YES (Hit)         NO (Miss)
                       │               │
                       ▼               ▼
               Load Pre-compiled    Compile Markdown,
               Artifact from Cache  Highlight & Store
                       │               │
                       └───────┬───────┘
                               │
                               ▼
                     Render Static Layout
```

1. **Content-Addressable Hashing**: Each Markdown file's content and frontmatter are hashed.
2. **Atomic Page Artifacts**: Parsed HTML, table of contents, headings, internal links, and search snippets are stored in individual cache files.
3. **Compiler Invalidation**: If the compiler version or global configuration changes, the cache manifest invalidates safely.
4. **Cache Miss Fallback**: Any cache corruption or missing entry falls back seamlessly to a fresh compilation without throwing build errors.

---

## Managing the Cache

### 1. Cleaning the Cache Directory

Remove the cached build artifacts from `.docboot/`:

```bash
docboot clean
```

### 2. Clean Build

Wipe the cache and output folder before initiating a production build:

```bash
docboot build --clean
# or short flag:
docboot build -c
```

### 3. Bypassing Cache in CI

Run compilation without reading or writing cache entries:

```bash
docboot build --no-cache
```

---

## Ignoring the Cache in Git

Add `.docboot/` to your `.gitignore`:

```text title=".gitignore"
.docboot/
dist/
```

---

## Next Steps

- [Docboot Doctor](/tooling/doctor) — Diagnostics for links and assets
- [Docboot Stats](/tooling/stats) — Documentation metrics and bundle analysis
- [GitHub Pages Setup](/tooling/github-pages) — Automated CI/CD workflow setup
- [Architecture & Runtime](/advanced/architecture) — Static build pipeline details
