import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

/**
 * Parses a Git remote URL into owner and repository.
 * Supports HTTPS, SSH, SCP-like, and file URLs.
 * @param {string} remoteUrl
 * @returns {{ owner: string, repository: string, isGitHub: boolean } | null}
 */
export function parseGitHubRemote(remoteUrl = '') {
  if (!remoteUrl) return null;
  const trimmed = remoteUrl.trim();

  // HTTPS or SSH URL: https://github.com/owner/repo(.git) or ssh://git@github.com/owner/repo(.git)
  const httpMatch = trimmed.match(/^https?:\/\/(?:[a-zA-Z0-9_-]+@)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git|\/)?$/i);
  if (httpMatch) {
    return {
      owner: httpMatch[1],
      repository: httpMatch[2].replace(/\.git$/i, ''),
      isGitHub: true
    };
  }

  // SCP syntax: git@github.com:owner/repo(.git)
  const scpMatch = trimmed.match(/^(?:ssh:\/\/)?git@github\.com:([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git|\/)?$/i);
  if (scpMatch) {
    return {
      owner: scpMatch[1],
      repository: scpMatch[2].replace(/\.git$/i, ''),
      isGitHub: true
    };
  }

  // ssh:// syntax with custom port: ssh://git@github.com:22/owner/repo(.git)
  const sshPortMatch = trimmed.match(/^ssh:\/\/git@github\.com(?::\d+)?\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git|\/)?$/i);
  if (sshPortMatch) {
    return {
      owner: sshPortMatch[1],
      repository: sshPortMatch[2].replace(/\.git$/i, ''),
      isGitHub: true
    };
  }

  return { owner: '', repository: '', isGitHub: false };
}

/**
 * Detects the Git remote URL of the project.
 * Checks git config directly, then tries `git config` command.
 * @param {string} rootDir
 * @returns {string}
 */
export function detectGitRemote(rootDir = process.cwd()) {
  // 1. Try reading .git/config directly (pure file read, zero-exec)
  try {
    const gitConfigPath = path.join(rootDir, '.git', 'config');
    if (fs.existsSync(gitConfigPath)) {
      const content = fs.readFileSync(gitConfigPath, 'utf-8');
      const originMatch = content.match(/\[remote\s+"origin"\][^\[]*?url\s*=\s*([^\r\n]+)/);
      if (originMatch) {
        return originMatch[1].trim();
      }
      // Any other remote
      const anyRemoteMatch = content.match(/\[remote\s+"[^"]+"\][^\[]*?url\s*=\s*([^\r\n]+)/);
      if (anyRemoteMatch) {
        return anyRemoteMatch[1].trim();
      }
    }
  } catch (_) {}

  // 2. Fallback to git CLI if available
  try {
    const output = execSync('git config --get remote.origin.url', {
      cwd: rootDir,
      stdio: ['pipe', 'pipe', 'ignore'],
      encoding: 'utf-8'
    });
    if (output && output.trim()) return output.trim();
  } catch (_) {}

  return '';
}

/**
 * Detects the default or current Git branch.
 * @param {string} rootDir
 * @returns {string}
 */
export function detectGitBranch(rootDir = process.cwd()) {
  try {
    const headPath = path.join(rootDir, '.git', 'HEAD');
    if (fs.existsSync(headPath)) {
      const headContent = fs.readFileSync(headPath, 'utf-8').trim();
      const refMatch = headContent.match(/^ref:\s*refs\/heads\/([^\r\n]+)$/);
      if (refMatch) {
        return refMatch[1].trim();
      }
    }
  } catch (_) {}

  try {
    const out = execSync('git branch --show-current', {
      cwd: rootDir,
      stdio: ['pipe', 'pipe', 'ignore'],
      encoding: 'utf-8'
    });
    if (out && out.trim()) return out.trim();
  } catch (_) {}

  return 'main';
}

/**
 * Detects the package manager used by the repository.
 * @param {string} rootDir
 * @returns {'npm' | 'pnpm' | 'yarn' | 'bun'}
 */
export function detectPackageManager(rootDir = process.cwd()) {
  if (fs.existsSync(path.join(rootDir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(rootDir, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(rootDir, 'bun.lock')) || fs.existsSync(path.join(rootDir, 'bun.lockb'))) return 'bun';
  if (fs.existsSync(path.join(rootDir, 'package-lock.json'))) return 'npm';

  return 'npm';
}

/**
 * Detects the Node.js version target for CI.
 * Checks .node-version, .nvmrc, package.json engines.node, or defaults to 22.
 * @param {string} rootDir
 * @returns {string}
 */
export function detectNodeVersion(rootDir = process.cwd()) {
  const nodeVersionPath = path.join(rootDir, '.node-version');
  if (fs.existsSync(nodeVersionPath)) {
    const ver = fs.readFileSync(nodeVersionPath, 'utf-8').trim().replace(/^v/, '');
    if (ver) return ver.split('.')[0];
  }

  const nvmrcPath = path.join(rootDir, '.nvmrc');
  if (fs.existsSync(nvmrcPath)) {
    const ver = fs.readFileSync(nvmrcPath, 'utf-8').trim().replace(/^v/, '');
    if (ver) return ver.split('.')[0];
  }

  const pkgJsonPath = path.join(rootDir, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
      if (pkg.engines?.node) {
        const match = pkg.engines.node.match(/\b(\d{2})\b/);
        if (match) return match[1];
      }
    } catch (_) {}
  }

  return '22';
}

/**
 * Determines the build command from package.json scripts or fallback.
 * @param {string} rootDir
 * @param {'npm' | 'pnpm' | 'yarn' | 'bun'} pm
 * @returns {string}
 */
export function detectBuildCommand(rootDir = process.cwd(), pm = 'npm') {
  const pkgJsonPath = path.join(rootDir, 'package.json');
  let hasDocsBuild = false;
  let hasBuild = false;

  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
      const scripts = pkg.scripts || {};
      if (scripts['docs:build']) hasDocsBuild = true;
      else if (scripts['build:docs']) return `${pm === 'npm' ? 'npm run' : pm} build:docs`;
      else if (scripts['build'] && (scripts['build'].includes('docboot') || scripts['build'].includes('docup'))) hasBuild = true;
    } catch (_) {}
  }

  if (hasDocsBuild) {
    if (pm === 'npm') return 'npm run docs:build';
    if (pm === 'pnpm') return 'pnpm run docs:build';
    if (pm === 'yarn') return 'yarn docs:build';
    if (pm === 'bun') return 'bun run docs:build';
  }

  if (hasBuild) {
    if (pm === 'npm') return 'npm run build';
    if (pm === 'pnpm') return 'pnpm run build';
    if (pm === 'yarn') return 'yarn build';
    if (pm === 'bun') return 'bun run build';
  }

  // Fallback to npx / exec
  if (pm === 'pnpm') return 'pnpm exec docboot build';
  if (pm === 'yarn') return 'yarn docboot build';
  if (pm === 'bun') return 'bun x docboot build';
  return 'npx docboot build';
}

/**
 * Infers the GitHub Pages base path.
 * @param {string} owner
 * @param {string} repository
 * @param {object} config
 * @returns {string} Normalized base path (e.g. '/example/' or '/')
 */
export function inferBasePath(owner = '', repository = '', config = {}) {
  // If custom domain is configured, base is root
  if (config.github?.customDomain || config.customDomain || config.github?.cname) {
    return '/';
  }

  if (!repository) return '/';

  // User / Organization Pages: owner.github.io -> /
  if (owner && repository.toLowerCase() === `${owner.toLowerCase()}.github.io`) {
    return '/';
  }

  return `/${repository}/`;
}

/**
 * Gathers complete GitHub environment context.
 * @param {string} rootDir
 * @param {object} config
 * @returns {object}
 */
export function detectGitHubEnvironment(rootDir = process.cwd(), config = {}) {
  const remoteUrl = detectGitRemote(rootDir) || config.repo || '';
  const parsedRemote = parseGitHubRemote(remoteUrl);

  const owner = parsedRemote?.owner || '';
  const repository = parsedRemote?.repository || '';
  const isGitHub = !!(parsedRemote?.isGitHub || remoteUrl.includes('github.com'));

  const branch = config.github?.branch || detectGitBranch(rootDir) || 'main';
  const packageManager = detectPackageManager(rootDir);
  const nodeVersion = detectNodeVersion(rootDir);
  const buildCommand = detectBuildCommand(rootDir, packageManager);
  const basePath = inferBasePath(owner, repository, config);

  const outRel = path.relative(rootDir, config.outDir || path.join(rootDir, 'dist')) || 'dist';

  return {
    remoteUrl,
    owner,
    repository,
    isGitHub,
    branch,
    packageManager,
    nodeVersion,
    buildCommand,
    basePath,
    outputDir: outRel.replace(/\\/g, '/')
  };
}
