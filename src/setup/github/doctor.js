import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { detectGitHubEnvironment } from './detect.js';
import { WORKFLOW_PATH } from './workflow.js';

/**
 * Runs GitHub Pages diagnostics for `docboot doctor --github`.
 * @param {string} rootDir
 * @param {object} config
 * @returns {{ passes: string[], warnings: string[], errors: string[] }}
 */
export function diagnoseGitHub(rootDir = process.cwd(), config = {}) {
  const passes = [];
  const warnings = [];
  const errors = [];

  const env = detectGitHubEnvironment(rootDir, config);

  // 1. Git repository check
  const gitDir = path.join(rootDir, '.git');
  if (fs.existsSync(gitDir)) {
    passes.push('Git repository detected');
  } else {
    warnings.push('Not a Git repository (.git directory not found)');
  }

  // 2. Remote check
  if (env.isGitHub && env.owner && env.repository) {
    passes.push(`GitHub remote: ${pc.cyan(`${env.owner}/${env.repository}`)}`);
  } else if (env.remoteUrl) {
    warnings.push(`Remote "${env.remoteUrl}" does not appear to be a GitHub repository`);
  } else {
    warnings.push('No Git remote detected. Push to GitHub to enable Pages deployment.');
  }

  // 3. Workflow file check
  const workflowFile = path.join(rootDir, WORKFLOW_PATH);
  if (fs.existsSync(workflowFile)) {
    passes.push(`Workflow file: ${pc.cyan(WORKFLOW_PATH)}`);
    const content = fs.readFileSync(workflowFile, 'utf-8');
    if (content.includes(`branches:\n      - ${env.branch}`) || content.includes(`- ${env.branch}`)) {
      passes.push(`Workflow targets branch: ${pc.cyan(env.branch)}`);
    } else {
      warnings.push(`Workflow does not appear to target current branch "${env.branch}"`);
    }
  } else {
    warnings.push(`Missing workflow: ${WORKFLOW_PATH} (Run ${pc.cyan('docboot setup github')} to generate)`);
  }

  // 4. Output directory check
  passes.push(`Output directory: ${pc.cyan(env.outputDir + '/')}`);

  // 5. Base path check
  passes.push(`Base path: ${pc.cyan(env.basePath)}`);

  // 6. Site URL check
  if (config.siteUrl) {
    passes.push(`Site URL: ${pc.cyan(config.siteUrl)}`);
  } else {
    warnings.push('Site URL is not configured in docboot.config.js (Canonical URLs cannot be generated accurately).');
  }

  // 7. Custom domain check
  if (config.github?.customDomain || config.customDomain) {
    const domain = config.github?.customDomain || config.customDomain;
    passes.push(`Custom domain configured: ${pc.cyan(domain)}`);
  }

  return { passes, warnings, errors, env };
}
