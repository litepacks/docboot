---
title: GitHub Pages Setup
description: Preparing repositories for GitHub Pages publishing with docboot setup github.
order: 4
---

# GitHub Pages Setup

Docboot prepares your repository for GitHub Pages deployment by generating an official GitHub Actions workflow:

> **Docboot configures the workflow. GitHub publishes the site.**

```text
Docboot         ──► Generates local .github/workflows/docs.yml with inferred base path
Git             ──► Pushes the workflow to your GitHub repository
GitHub Actions  ──► Automatically builds and publishes the dist/ static artifact
```

---

## 1. Setting Up the Workflow

Run the setup command in your repository:

```bash
docboot setup github
```

Terminal output:
```text
  ▲ Docboot — GitHub Pages Setup

  ✔ Inferred repository: litepacks/docboot
  ✔ Detected package manager: npm
  ✔ Inferred base path: /docboot/
  ✔ Created .github/workflows/docs.yml

  Next steps:
  1. Commit and push:
     git add . && git commit -m "ci: add GitHub Pages workflow" && git push
  2. In your GitHub repository settings (Settings > Pages > Source):
     Select "GitHub Actions" as the build source.
```

---

## 2. Automatic Base Path Resolution

GitHub Pages sub-directory repositories require assets and links to be prefixed with `/repository-name/`.

Docboot handles this automatically:

| Repository URL | Detected Base Path | Links & Asset URLs |
| :--- | :--- | :--- |
| `github.com/org/my-docs` | `/my-docs/` | `/my-docs/assets/docs.css`, `/my-docs/guide` |
| `github.com/org/org.github.io` (User/Org page) | `/` | `/assets/docs.css`, `/guide` |
| Custom Domain (`docs.example.com`) | `/` | `/assets/docs.css`, `/guide` |

All internal markdown links, favicon paths, search indexes, PWA service workers, and canonical URLs automatically adapt to the resolved base path without manual URL editing.

---

## 3. GitHub Pages Repository Configuration

After pushing your workflow to GitHub:

1. Open your repository on GitHub.
2. Navigate to **Settings** → **Pages**.
3. Under **Build and deployment → Source**, select **`GitHub Actions`** (instead of "Deploy from a branch").

Once selected, every `git push` to your default branch compiles and publishes your documentation automatically.

---

## 4. Custom Domains

If you are using a custom domain (e.g. `docs.mycompany.com`), add `customDomain` to your `docboot.config.js`:

```javascript title="docboot.config.js"
export default {
  customDomain: "docs.mycompany.com"
};
```

Docboot will automatically generate the required `dist/CNAME` file during build.

---

## Next Steps

- [Docboot Doctor](/tooling/doctor) — Running `docboot doctor --github`
- [PWA & Offline Docs](/guide/pwa) — Enabling offline support on GitHub Pages
- [CLI Reference](/reference/cli) — CLI commands and options
