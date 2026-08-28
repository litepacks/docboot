import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { parseGitHubRemote, detectGitRemote } from '../setup/github/detect.js';

export const STARTER_CONFIG_FILENAME = 'docboot.config.js';

/**
 * Generates starter configuration file content.
 * @param {object} options
 * @returns {string}
 */
export function generateStarterConfig({
  title = 'My Documentation',
  description = 'High-performance Markdown documentation site',
  repoUrl = '',
  docsDir = './docs',
  outDir = './dist',
  preset = 'zinc'
} = {}) {
  let editLinkComment = '';
  let sourceLinkComment = '';

  const parsed = parseGitHubRemote(repoUrl);
  if (parsed && parsed.isGitHub && parsed.owner && parsed.repository) {
    editLinkComment = `\n  editLink: {\n    pattern: 'https://github.com/${parsed.owner}/${parsed.repository}/edit/main/docs/:path'\n  },\n  sourceLink: {\n    pattern: 'https://github.com/${parsed.owner}/${parsed.repository}/blob/main/:path'\n  },`;
  } else {
    editLinkComment = `\n  // editLink: {\n  //   pattern: 'https://github.com/owner/repo/edit/main/docs/:path'\n  // },\n  // sourceLink: {\n  //   pattern: 'https://github.com/owner/repo/blob/main/:path'\n  // },`;
  }

  return `/** @type {import('docboot').DocbootConfig} */
export default {
  title: ${JSON.stringify(title)},
  description: ${JSON.stringify(description)},
  docs: ${JSON.stringify(docsDir)},
  out: ${JSON.stringify(outDir)},
  ${repoUrl ? `repo: ${JSON.stringify(repoUrl)},` : '// repo: "https://github.com/owner/repo",'}
  theme: {
    preset: ${JSON.stringify(preset)}, // "zinc" | "ocean" | "emerald" | "violet" | "amber" | "rose"
    defaultMode: "system" // "system" | "dark" | "light"
  },${editLinkComment}
  search: {
    fuzzy: 0.2,
    prefix: true,
    maxResults: 10
  }
};
`;
}

/**
 * Initializes a new Docboot project or configuration file.
 * @param {object} params
 */
export async function initProject({
  rootDir = process.cwd(),
  targetDir = null,
  configOnly = false,
  force = false,
  logger = console
}) {
  let projectName = path.basename(rootDir);
  let repoUrl = detectGitRemote(rootDir);

  // Read package.json for default project name
  const pkgPath = path.join(rootDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.name) {
        projectName = pkg.name.replace(/^@[^/]+\//, '');
      }
      if (!repoUrl && typeof pkg.repository === 'string') {
        repoUrl = pkg.repository;
      } else if (!repoUrl && pkg.repository?.url) {
        repoUrl = pkg.repository.url;
      }
    } catch (_) {}
  }

  // Format title (e.g. "my-project" -> "My Project")
  const title = projectName
    .split(/[-_]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const configPath = path.join(rootDir, STARTER_CONFIG_FILENAME);
  let configCreated = false;

  if (fs.existsSync(configPath) && !force) {
    logger.log(pc.yellow(`⚠ ${STARTER_CONFIG_FILENAME} already exists.`));
    logger.log(pc.dim('  Use --force to overwrite.\n'));
  } else {
    const configContent = generateStarterConfig({
      title,
      description: `${title} documentation`,
      repoUrl,
      docsDir: './docs',
      outDir: './dist',
      preset: 'zinc'
    });
    fs.writeFileSync(configPath, configContent, 'utf-8');
    configCreated = true;
  }

  const createdFiles = [];
  if (configCreated) {
    createdFiles.push(STARTER_CONFIG_FILENAME);
  }

  // If not config-only, create starter docs directory if none exists
  const docsDirectory = path.join(rootDir, 'docs');
  if (!configOnly && !fs.existsSync(docsDirectory)) {
    fs.mkdirSync(docsDirectory, { recursive: true });

    const starterReadme = `---
title: Welcome
description: Welcome to ${title} documentation
order: 1
---

# ${title}

Welcome to the official documentation for **${title}**.

---

## ⚡ Quick Start

Get started with **${title}** in just a few minutes.

:::tip Recommended
Check out the [Getting Started](./01-getting-started.md) guide to learn the basics.
:::

\`\`\`bash
npm install ${projectName}
\`\`\`
`;

    const starterGettingStarted = `---
title: Getting Started
description: Learn how to set up and configure ${title}
order: 2
---

# Getting Started

Follow these steps to integrate **${title}** into your project.

---

## 📦 Installation

:::tabs group="package-manager"
::tab npm
\`\`\`bash
npm install ${projectName}
\`\`\`
::tab pnpm
\`\`\`bash
pnpm add ${projectName}
\`\`\`
::tab yarn
\`\`\`bash
yarn add ${projectName}
\`\`\`
:::

---

## 🚀 Basic Usage

\`\`\`javascript title="index.js"
import { init } from '${projectName}';

init();
\`\`\`
`;

    const readmePath = path.join(docsDirectory, 'README.md');
    const gettingStartedPath = path.join(docsDirectory, '01-getting-started.md');

    if (!fs.existsSync(readmePath)) {
      fs.writeFileSync(readmePath, starterReadme, 'utf-8');
      createdFiles.push('docs/README.md');
    }
    if (!fs.existsSync(gettingStartedPath)) {
      fs.writeFileSync(gettingStartedPath, starterGettingStarted, 'utf-8');
      createdFiles.push('docs/01-getting-started.md');
    }
  }

  if (createdFiles.length > 0) {
    logger.log('');
    logger.log(pc.bold(pc.green('✔ Docboot project initialized successfully!')));
    logger.log('');
    logger.log('Created files:');
    for (const f of createdFiles) {
      logger.log(pc.dim('  + ') + pc.cyan(f));
    }
    logger.log('');
    logger.log(pc.bold('Next steps:'));
    logger.log(pc.dim('  npx docboot . -o       # Start dev server and open browser'));
    logger.log(pc.dim('  npx docboot build      # Build static production site\n'));
  }

  return { success: true, createdFiles };
}
