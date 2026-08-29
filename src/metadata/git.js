import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Resolves Git repository metadata and file-level commit timestamps for documentation pages.
 */
export class GitMetadataResolver {
  constructor(rootDir = process.cwd()) {
    this.rootDir = rootDir;
    this.isGit = false;
    this.isShallow = false;
    this.branch = 'main';
    this.remote = null;
    this.cache = new Map();

    this.init();
  }

  init() {
    try {
      const isInside = execSync('git rev-parse --is-inside-work-tree', {
        cwd: this.rootDir,
        stdio: ['ignore', 'pipe', 'ignore'],
        encoding: 'utf-8'
      }).trim();
      this.isGit = isInside === 'true';
    } catch {
      this.isGit = false;
      return;
    }

    if (!this.isGit) return;

    try {
      const shallow = execSync('git rev-parse --is-shallow-repository', {
        cwd: this.rootDir,
        stdio: ['ignore', 'pipe', 'ignore'],
        encoding: 'utf-8'
      }).trim();
      this.isShallow = shallow === 'true';
    } catch {
      this.isShallow = false;
    }

    try {
      const branchName = execSync('git symbolic-ref --short HEAD 2>/dev/null || git rev-parse --abbrev-ref HEAD 2>/dev/null', {
        cwd: this.rootDir,
        stdio: ['ignore', 'pipe', 'ignore'],
        encoding: 'utf-8',
        shell: true
      }).trim();
      if (branchName && branchName !== 'HEAD') {
        this.branch = branchName;
      }
    } catch {
      this.branch = 'main';
    }

    try {
      const remoteUrl = execSync('git config --get remote.origin.url', {
        cwd: this.rootDir,
        stdio: ['ignore', 'pipe', 'ignore'],
        encoding: 'utf-8'
      }).trim();
      this.remote = remoteUrl || null;
    } catch {
      this.remote = null;
    }
  }

  /**
   * Resolves Git metadata for a specific file.
   * @param {string} fullPath Absolute file path
   * @param {string} relativePath Relative path from repo root
   * @returns {{ createdAt: string|null, updatedAt: string|null, commit: string|null, fullCommit: string|null }}
   */
  resolveFile(fullPath, relativePath) {
    if (!this.isGit || !relativePath) {
      return { createdAt: null, updatedAt: null, commit: null, fullCommit: null };
    }

    const normalizedPath = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');

    if (this.cache.has(normalizedPath)) {
      return this.cache.get(normalizedPath);
    }

    let updatedAt = null;
    let commit = null;
    let fullCommit = null;
    let createdAt = null;

    try {
      // 1. Latest commit info (updatedAt, short SHA, full SHA)
      const latestRaw = execSync(
        `git log -1 --format="%aI|%h|%H" -- "${normalizedPath}"`,
        { cwd: this.rootDir, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf-8' }
      ).trim();

      if (latestRaw) {
        const parts = latestRaw.split('|');
        if (parts.length >= 3) {
          updatedAt = parts[0] || null;
          commit = parts[1] || null;
          fullCommit = parts[2] || null;
        }
      }
    } catch {}

    // 2. Initial creation date (if repository is not a shallow clone)
    if (!this.isShallow && updatedAt) {
      try {
        const createdRaw = execSync(
          `git log --follow --diff-filter=A --format="%aI" -- "${normalizedPath}"`,
          { cwd: this.rootDir, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf-8' }
        ).trim();

        if (createdRaw) {
          const lines = createdRaw.split('\n').map(l => l.trim()).filter(Boolean);
          if (lines.length > 0) {
            createdAt = lines[lines.length - 1]; // Earliest commit
          }
        }
      } catch {}
    }

    const result = {
      createdAt: createdAt || updatedAt,
      updatedAt,
      commit,
      fullCommit
    };

    this.cache.set(normalizedPath, result);
    return result;
  }
}

/**
 * Formats an ISO date or Date object into human-readable representation (e.g. "29 Aug 2026").
 * @param {string|Date} dateInput
 * @returns {string|null}
 */
export function formatDate(dateInput) {
  if (!dateInput) return null;
  const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return null;

  const day = date.getUTCDate();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `${day} ${month} ${year}`;
}
