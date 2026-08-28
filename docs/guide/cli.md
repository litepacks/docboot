---
title: CLI Commands & Options
description: Complete reference for the Docboot command-line interface
order: 3
---

# CLI Commands & Options

Docboot provides an intuitive Unix-style command-line interface.

---

## Commands

### `docboot init [dir]`
Scaffolds a starter `docboot.config.js` and starter documentation files (`docs/README.md`, `docs/01-getting-started.md`):

```bash
docboot init
docboot init config      # Generates only docboot.config.js
docboot init --force     # Overwrites existing configuration
```

### `docboot [dir]`
Scans the specified folder (defaults to `./docs` or `.`), compiles static assets, and starts the development server with live reload.

```bash
docboot ./docs -o
```

### `docboot build [dir]`
Compiles static HTML, CSS, client scripts, search indexes, and SEO manifests to `./dist`.

```bash
docboot build ./docs
```

### `docboot serve [dir]`
Serves the production build directory locally for preview.

```bash
docboot serve ./dist -p 8080
```

### `docboot doctor [dir]`
Diagnoses health issues across your documentation files:
- Broken relative markdown links
- Missing heading anchors (`#hash`)
- Missing image files
- Route collisions
- Blocked embed domains
- Duplicate tab names

```bash
docboot doctor ./docs
```

### `docboot stats [dir]`
Collects documentation metrics:
- Total page count & word count
- Code block, heading, and image counts
- Exact bundle sizes (CSS, JS, Search Index KB)
- Build cache hit rate & storage size

```bash
docboot stats ./docs
```

### `docboot clean [dir]`
Safely clears the local incremental build cache directory (`.docboot/`).

```bash
docboot clean
```

### `docboot generate [assets|favicon|og|pwa]`
Generates production assets:
- `favicon.svg`
- `og-image.svg` (social share banner)
- `manifest.webmanifest`

```bash
docboot generate assets
```

### `docboot setup github`
Prepares your repository for automated deployment to GitHub Pages via GitHub Actions:
- Detects remote repository owner and name
- Detects branch, package manager (npm, pnpm, yarn, bun), and Node version
- Infers correct base path (`/repository/` or `/`)
- Generates `.github/workflows/docs.yml` with official GitHub Actions

```bash
docboot setup github
docboot setup github --dry-run
```

---

## Flags

| Flag | Long Flag | Description |
| :--- | :--- | :--- |
| `-b` | `--build` | Build static site |
| `-s` | `--serve` | Serve static site |
| `-o` | `--open` | Open site in default browser |
| `-p <port>` | `--port <port>` | Set custom port (default: 3000) |
| `-c` | `--clean` | Clear build cache and output directory before building |
| | `--no-cache` | Bypass reading and writing build cache |
| | `--dry-run` | Calculate and preview setup changes without modifying files |
| `-f` | `--force` | Overwrite existing workflow files when allowed |
| | `--github` | Include GitHub Pages health checks in `docboot doctor` |
| `-q` | `--quiet` | Mute non-error console logs |
| `-v` | `--verbose` | Enable verbose error output |
| | `--pwa` | Enable Progressive Web App manifest |
