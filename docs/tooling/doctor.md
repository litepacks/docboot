---
title: Docboot Doctor
description: Built-in documentation health diagnostics for broken links, missing assets, and route conflicts.
order: 1
---

# Docboot Doctor

Docboot includes a comprehensive diagnostic linter designed to validate documentation integrity before publishing.

```bash
docboot doctor
```

---

## What Doctor Checks

`docboot doctor` inspects your entire documentation tree and reports errors and warnings across 8 categories:

| Check | Severity | Description |
| :--- | :--- | :--- |
| **Broken Internal Links** | `Error` | Validates every internal `[link](/path)` against actual generated routes and automatic category hubs |
| **Broken Anchor Links** | `Warning` | Validates heading hash targets (`/guide/rich-content#safe-embeds`) against real heading IDs on the target page |
| **Missing Image Files** | `Error` | Verifies that referenced local images (`./screens/hero.png` or `/favicon.svg`) exist on disk |
| **Route Conflicts** | `Error` | Flags duplicate routes (e.g. `docs/api.md` and `docs/api/README.md` attempting to own `/api`) |
| **Missing Page Titles** | `Warning` | Identifies documents without frontmatter `title` or a top-level `# Heading 1` |
| **Missing SEO Descriptions** | `Warning` | Highlights pages missing a `description` meta tag |
| **Missing Image Alt Text** | `Warning` | Accessibility check for images without descriptive `alt` text |
| **Duplicate Heading IDs** | `Warning` | Identifies duplicate anchor slugs within the same document |
| **GitHub Pages Workflow** | `Diagnostic` | When run with `docboot doctor --github`, checks if `.github/workflows/docs.yml` is present and valid |

---

## Example Terminal Output

Running `docboot doctor` outputs a clean, actionable diagnostic report:

```text
  ▲ Docboot Doctor — Health Check

  ✔ 12 pages scanned
  ✔ 48 internal links verified
  ✔ 8 local image references verified

  ⚠ Missing Description
    docs/getting-started/project-structure.md: Missing SEO description in frontmatter.

  ✗ Broken Internal Link
    docs/guide/rich-content.md → /reference/missing-page (Target route not found)

  ────────────────────────────────────────────────────────
  Found 1 error, 1 warning in 18ms.
```

---

## Exit Codes for CI/CD

`docboot doctor` returns non-zero exit codes when errors are detected, making it easy to incorporate as a pre-commit hook or CI pipeline gate:

```bash
# In package.json
"scripts": {
  "test:docs": "docboot doctor"
}
```

---

## Next Steps

- [Docboot Stats](/tooling/stats) — Documentation metrics and bundle analysis
- [Build Cache](/tooling/build-cache) — Cache mechanics and incremental compilation
- [GitHub Pages Setup](/tooling/github-pages) — Automated CI/CD deployment
