import fs from 'node:fs';
import path from 'node:path';
import { hashString, hashObject, hashFile } from './hasher.js';

export const CACHE_VERSION = 28;
export const COMPILER_VERSION = '0.28.0';

/**
 * Robust, lightweight build cache manager for incremental documentation builds.
 * Preserves deterministic builds and provides atomic writes with corruption recovery.
 */
export class CacheManager {
  /**
   * @param {string} cacheDir Target cache directory (defaults to .docboot)
   * @param {object} options
   * @param {boolean} options.disabled If true, bypasses reading and writing to cache
   */
  constructor(cacheDir = path.resolve(process.cwd(), '.docboot'), options = {}) {
    this.cacheDir = cacheDir || path.resolve(process.cwd(), '.docboot');
    this.pagesDir = path.join(this.cacheDir, 'pages');
    this.searchDir = path.join(this.cacheDir, 'search');
    this.artifactsDir = path.join(this.cacheDir, 'artifacts');
    this.manifestFile = path.join(this.cacheDir, 'manifest.json');
    this.disabled = Boolean(options.disabled);

    this.manifest = {
      version: CACHE_VERSION,
      compilerVersion: COMPILER_VERSION,
      configHash: '',
      files: {},
      createdAt: Date.now(),
      lastBuiltAt: Date.now()
    };

    this.memoryCache = new Map();
    this.dirty = false;
    this.sessionHits = 0;
    this.sessionMisses = 0;

    if (!this.disabled) {
      this.load();
    }
  }

  /**
   * Loads cache manifest and validates version compatibility.
   */
  load() {
    try {
      if (fs.existsSync(this.manifestFile)) {
        const raw = fs.readFileSync(this.manifestFile, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.version === CACHE_VERSION && parsed.compilerVersion === COMPILER_VERSION) {
          this.manifest = parsed;
        } else {
          // Incompatible cache version -> discard and start fresh
          this.clear();
        }
      }
    } catch (err) {
      // Malformed or unreadable manifest -> recover gracefully
      this.manifest = {
        version: CACHE_VERSION,
        compilerVersion: COMPILER_VERSION,
        configHash: '',
        files: {},
        createdAt: Date.now(),
        lastBuiltAt: Date.now()
      };
    }
  }

  /**
   * Ensures internal cache directories exist.
   */
  ensureDirs() {
    if (this.disabled) return;
    try {
      fs.mkdirSync(this.pagesDir, { recursive: true });
      fs.mkdirSync(this.searchDir, { recursive: true });
      fs.mkdirSync(this.artifactsDir, { recursive: true });
    } catch (err) {}
  }

  /**
   * Computes a safe deterministic file key for saving JSON files.
   * @param {string} relativePath Relative markdown file path
   * @returns {string} Safe file name
   */
  getArtifactKey(relativePath) {
    return hashString(relativePath);
  }

  /**
   * Checks whether a cached entry is completely fresh and valid.
   * @param {string} relativePath
   * @param {string} sourceHash
   * @param {string} configHash
   * @returns {boolean}
   */
  isFresh(relativePath, sourceHash, configHash) {
    if (this.disabled) return false;
    if (configHash && this.manifest.configHash && this.manifest.configHash !== configHash) {
      return false;
    }

    const entry = this.manifest.files[relativePath];
    if (!entry) return false;

    if (entry.sourceHash !== sourceHash) {
      return false;
    }

    // Verify artifact file exists on disk
    const pageArtifactPath = path.join(this.pagesDir, `${this.getArtifactKey(relativePath)}.json`);
    if (!fs.existsSync(pageArtifactPath)) {
      return false;
    }

    return true;
  }

  recordHit() {
    this.sessionHits++;
  }

  recordMiss() {
    this.sessionMisses++;
  }

  /**
   * Retrieves cached compiled page artifact.
   * @param {string} relativePath
   * @returns {object|null}
   */
  getPageArtifact(relativePath) {
    if (this.disabled) {
      this.sessionMisses++;
      return null;
    }

    if (this.memoryCache.has(relativePath)) {
      this.sessionHits++;
      return this.memoryCache.get(relativePath);
    }

    const key = this.getArtifactKey(relativePath);
    const artifactPath = path.join(this.pagesDir, `${key}.json`);

    try {
      if (fs.existsSync(artifactPath)) {
        const raw = fs.readFileSync(artifactPath, 'utf-8');
        const artifact = JSON.parse(raw);
        this.memoryCache.set(relativePath, artifact);
        this.sessionHits++;
        return artifact;
      }
    } catch (err) {
      // Corrupted file on disk -> recover gracefully as cache miss
    }

    this.sessionMisses++;
    return null;
  }

  /**
   * Writes compiled page artifact atomically to disk.
   * @param {string} relativePath
   * @param {object} artifact
   * @param {object} hashes { sourceHash, contentHash, metadataHash, mtimeMs, size }
   */
  setPageArtifact(relativePath, artifact, { sourceHash, contentHash, metadataHash, mtimeMs = 0, size = 0 }) {
    if (this.disabled) return;

    this.ensureDirs();
    const key = this.getArtifactKey(relativePath);
    const artifactPath = path.join(this.pagesDir, `${key}.json`);
    const tmpPath = `${artifactPath}.${Date.now()}.tmp`;

    try {
      // Atomic write
      fs.writeFileSync(tmpPath, JSON.stringify(artifact), 'utf-8');
      fs.renameSync(tmpPath, artifactPath);

      this.memoryCache.set(relativePath, artifact);
      this.manifest.files[relativePath] = {
        sourceHash,
        contentHash,
        metadataHash,
        mtimeMs,
        size,
        route: artifact.route,
        title: artifact.title,
        updatedAt: Date.now()
      };
      this.dirty = true;
    } catch (err) {
      try {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      } catch (e) {}
    }
  }

  /**
   * Updates global configuration hash.
   * @param {string} configHash
   */
  setConfigHash(configHash) {
    if (this.manifest.configHash !== configHash) {
      this.manifest.configHash = configHash;
      this.dirty = true;
    }
  }

  /**
   * Prunes cached entries for deleted files.
   * @param {Array<string>} currentRelativePaths List of active relative paths
   */
  pruneDeleted(currentRelativePaths) {
    if (this.disabled) return;

    const currentSet = new Set(currentRelativePaths);
    for (const cachedPath of Object.keys(this.manifest.files)) {
      if (!currentSet.has(cachedPath)) {
        const key = this.getArtifactKey(cachedPath);
        const artifactPath = path.join(this.pagesDir, `${key}.json`);
        try {
          if (fs.existsSync(artifactPath)) fs.unlinkSync(artifactPath);
        } catch (e) {}

        delete this.manifest.files[cachedPath];
        this.memoryCache.delete(cachedPath);
        this.dirty = true;
      }
    }
  }

  /**
   * Saves manifest atomically.
   */
  save() {
    if (this.disabled || !this.dirty) return;

    this.ensureDirs();
    this.manifest.lastBuiltAt = Date.now();
    const tmpPath = `${this.manifestFile}.${Date.now()}.tmp`;

    try {
      fs.writeFileSync(tmpPath, JSON.stringify(this.manifest, null, 2), 'utf-8');
      fs.renameSync(tmpPath, this.manifestFile);
      this.dirty = false;
    } catch (err) {
      try {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      } catch (e) {}
    }
  }

  /**
   * Completely clears the cache directory.
   */
  clear() {
    try {
      if (fs.existsSync(this.cacheDir)) {
        fs.rmSync(this.cacheDir, { recursive: true, force: true });
      }
      this.manifest = {
        version: CACHE_VERSION,
        compilerVersion: COMPILER_VERSION,
        configHash: '',
        files: {},
        createdAt: Date.now(),
        lastBuiltAt: Date.now()
      };
      this.memoryCache.clear();
      this.dirty = false;
      this.sessionHits = 0;
      this.sessionMisses = 0;
    } catch (err) {}
  }

  /**
   * Calculates total disk size of the cache directory.
   * @returns {number} Size in bytes
   */
  getCacheSizeBytes() {
    if (!fs.existsSync(this.cacheDir)) return 0;
    let total = 0;

    function walk(dir) {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(fullPath);
          } else if (entry.isFile()) {
            const stats = fs.statSync(fullPath);
            total += stats.size;
          }
        }
      } catch (e) {}
    }

    walk(this.cacheDir);
    return total;
  }

  /**
   * Returns cache metrics and session statistics.
   * @returns {{ pages: number, hits: number, misses: number, hitRate: number, sizeBytes: number, sizeKb: string, sizeMb: string }}
   */
  getMetrics() {
    const totalRequests = this.sessionHits + this.sessionMisses;
    const hitRate = totalRequests > 0 ? (this.sessionHits / totalRequests) * 100 : 0;
    const sizeBytes = this.getCacheSizeBytes();

    return {
      pages: Object.keys(this.manifest.files).length,
      hits: this.sessionHits,
      misses: this.sessionMisses,
      hitRate: Number(hitRate.toFixed(1)),
      sizeBytes,
      sizeKb: (sizeBytes / 1024).toFixed(1),
      sizeMb: (sizeBytes / (1024 * 1024)).toFixed(2)
    };
  }
}
