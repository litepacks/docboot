---
title: Production Assets
description: Generating production favicons, social preview banners, and PWA assets with docboot generate assets.
order: 6
---

# Production Assets

Docboot provides a built-in asset generator to produce favicons, social sharing banners, and web app manifests without external graphics tools.

---

## Generating Assets via CLI

Run the asset generation command in your project root:

```bash
docboot generate assets
```

You can also pass `--force` to overwrite existing files:

```bash
docboot generate assets --force
```

---

## What Gets Generated

The command populates your `./public` folder with the following production-ready assets:

| File | Purpose |
| :--- | :--- |
| **`public/favicon.svg`** | Scalable vector favicon with automatic dark/light theme awareness |
| **`public/favicon.ico`** | Legacy browser fallback favicon |
| **`public/apple-touch-icon.png`** | iOS / iPad home screen icon |
| **`public/og-image.png`** | Open Graph (OG) / Twitter card social preview banner (1200x630) |
| **`public/manifest.webmanifest`** | Progressive Web App manifest |
| **`public/sw.js`** | Offline caching Service Worker |

---

## Customizing Assets

Any files placed in your project's `public/` directory (e.g. `public/favicon.svg` or `public/images/`) are automatically copied verbatim to the root of `dist/` during every `docboot build`.

---

## Next Steps

- [Docboot Doctor](/tooling/doctor) — Validating broken links and missing images
- [Docboot Stats](/tooling/stats) — Inspecting documentation bundle metrics
- [CLI Reference](/tooling/cli) — Full list of CLI commands
