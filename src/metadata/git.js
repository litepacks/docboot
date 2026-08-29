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

    // 1-shot batch git history populate (100x faster than per-file execSync)
    try {
      const rawLog = execSync('git log --format="COMMIT:%aI|%h|%H" --name-only', {
        cwd: this.rootDir,
        stdio: ['ignore', 'pipe', 'ignore'],
        encoding: 'utf-8'
      });
      const lines = rawLog.split('\n');
      let currentCommit = null;
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith('COMMIT:')) {
          const parts = trimmed.slice(7).split('|');
          currentCommit = { updatedAt: parts[0], commit: parts[1], fullCommit: parts[2] };
        } else if (currentCommit) {
          const normalized = trimmed.replace(/\\/g, '/');
          if (!this.cache.has(normalized)) {
            this.cache.set(normalized, {
              createdAt: currentCommit.updatedAt,
              updatedAt: currentCommit.updatedAt,
              commit: currentCommit.commit,
              fullCommit: currentCommit.fullCommit
            });
          } else {
            const existing = this.cache.get(normalized);
            existing.createdAt = currentCommit.updatedAt;
          }
        }
      }
    } catch {}
  }

  /**
   * Resolves Git metadata for a specific file from in-memory cache.
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

    // Fast fallback if file was not matched by exact name
    const result = {
      createdAt: null,
      updatedAt: null,
      commit: null,
      fullCommit: null
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
