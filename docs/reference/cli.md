---
title: CLI Reference
description: Complete command and flag reference for the Docboot documentation CLI.
order: 1
---

# CLI Reference

Overview of all available Docboot CLI commands, options, and shorthand flags.

---

## Command Summary

| Command | Description |
| :--- | :--- |
| **`docboot [dir]`** | Discovers Markdown files and starts the development server with live reload |
| **`docboot build [dir]`** | Compiles the documentation into static HTML and assets in `dist/` |
| **`docboot serve [dir]`** | Serves the compiled production static directory locally |
| **`docboot doctor [dir]`** | Diagnoses broken links, missing images, duplicate routes, and frontmatter issues |
| **`docboot stats [dir]`** | Analyzes page counts, word counts, code blocks, bundle sizes, and cache hits |
| **`docboot setup github`** | Generates an official GitHub Actions workflow for GitHub Pages |
| **`docboot generate assets`** | Generates SVG favicons, social preview banners, and PWA manifests in `public/` |
| **`docboot init [dir]`** | Scaffolds starter `docboot.config.js` and initial Markdown files |
| **`docboot clean [dir]`** | Clears the local `.docboot/` incremental cache folder |

---

## Detailed Command Usage

### `docboot [dir]` (or `docboot dev [dir]`)
Starts the local development server with Server-Sent Events (SSE) live reload:

```bash
docboot .               # Watch current directory
docboot ./docs -o       # Watch ./docs and open default browser
docboot -p 8080         # Custom port
```

### `docboot build [dir]`
Compiles your documentation into a standalone static website:

```bash
docboot build           # Build docs folder to ./dist
docboot build -c        # Clean cache and output directory before building
docboot build --no-cache # Bypass build cache entirely
docboot build --pwa     # Generate PWA manifest and offline Service Worker
```

### `docboot serve [dir]`
Starts a lightweight local HTTP server for testing your compiled `./dist` folder:

```bash
docboot serve
docboot serve ./dist -p 4000
```

### `docboot doctor [dir]`
Validates internal cross-links, anchor headings, missing images, and route conflicts:

```bash
docboot doctor
docboot doctor --github # Include GitHub Pages workflow validation
```

### `docboot stats [dir]`
Inspects documentation volume and compiled asset weights:

```bash
docboot stats
```

### `docboot setup github`
Creates `.github/workflows/docs.yml` configured with automated base path resolution:

```bash
docboot setup github
docboot setup github --dry-run # Preview changes without writing files
docboot setup github --force   # Overwrite existing workflow
```

### `docboot generate assets`
Generates vector favicons, social preview cards, and PWA manifests:

```bash
docboot generate assets
docboot generate assets --force
```

---

## CLI Flags

| Flag | Long Flag | Description |
| :--- | :--- | :--- |
| `-b` | `--build` | Build static production site |
| `-s` | `--serve` | Serve static production build |
| `-o` | `--open` | Open default web browser after server starts |
| `-p <port>` | `--port <port>` | Specify custom server port (default: `3000`) |
| `-c` | `--clean` | Wipe cache directory and output directory before build |
| | `--no-cache` | Disable reading and writing to incremental build cache |
| | `--dry-run` | Preview setup actions without modifying filesystem |
| `-f` | `--force` | Overwrite existing files when supported |
| | `--github` | Include GitHub Pages health checks in `docboot doctor` |
| | `--pwa` | Enable Progressive Web App offline caching and manifest generation |
| `-q` | `--quiet` | Silence non-error terminal output |
| `-v` | `--verbose` | Enable verbose error logging |
| `-h` | `--help` | Display CLI help menu |
| | `--version` | Display Docboot version |

---

## Combined Shorthand Flags

Flags can be combined:

```bash
docboot . -bo   # Build + open in browser
docboot . -so   # Serve + open in browser
docboot . -bc   # Clean build
```

---

## Next Steps

- [Configuration Reference](/reference/configuration) — Full `docboot.config.js` options
- [Directives Reference](/reference/directives) — Markdown syntax extensions
- [Docboot Doctor](/tooling/doctor) — Validating documentation health
