import fs from 'node:fs';
import path from 'node:path';

/**
 * Validates the local documentation setup and configuration for GitHub Pages deployment.
 * @param {string} rootDir
 * @param {object} config
 * @param {object} detectedEnv
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateGitHubSetup(rootDir = process.cwd(), config = {}, detectedEnv = {}) {
  const errors = [];
  const warnings = [];

  // 1. Verify docs directory
  if (!fs.existsSync(config.docsDir)) {
    errors.push(`Docs directory "${config.docsDir}" does not exist.`);
  } else {
    const files = fs.readdirSync(config.docsDir);
    const hasMarkdown = files.some(f => f.endsWith('.md') || f.endsWith('.markdown'));
    if (!hasMarkdown && files.length === 0) {
      warnings.push(`Docs directory "${config.docsDir}" is currently empty.`);
    }
  }

  // 2. Validate base path consistency
  if (config.base && config.base !== detectedEnv.basePath) {
    warnings.push(
      `Configured base "${config.base}" differs from detected GitHub Pages base "${detectedEnv.basePath}".`
    );
  }

  // 3. Custom domain consistency
  if (config.github?.customDomain && config.siteUrl) {
    try {
      const url = new URL(config.siteUrl);
      if (url.hostname !== config.github.customDomain) {
        warnings.push(
          `Site URL hostname "${url.hostname}" does not match custom domain "${config.github.customDomain}".`
        );
      }
    } catch (_) {}
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
