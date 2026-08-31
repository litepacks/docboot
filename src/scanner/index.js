import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';

const IGNORED_NAMES = new Set([
  'node_modules',
  '.git',
  '.docboot',
  'dist',
  'build',
  '.cache',
  '.vscode',
  '.idea',
  'coverage',
  '.stryker-tmp'
]);

/**
 * Scans directory recursively for markdown files (.md, .markdown).
 * @param {string} docsDir Root documentation folder
 * @returns {Array<{ relativePath: string, fullPath: string, mtimeMs: number, size: number }>}
 */
export function scanMarkdownFiles(docsDir) {
  const results = [];

  function walk(currentDir) {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.well-known') {
        // Skip hidden dotfiles/folders except special cases
        continue;
      }
      if (IGNORED_NAMES.has(entry.name)) {
        continue;
      }

      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (ext === '.md' || ext === '.markdown') {
          const relativePath = path.relative(docsDir, fullPath);
          const stat = fs.statSync(fullPath);
          results.push({
            relativePath: relativePath.replace(/\\/g, '/'),
            fullPath,
            mtimeMs: stat.mtimeMs,
            size: stat.size
          });
        }
      }
    }
  }

  walk(docsDir);

  return results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

/**
 * Scans directory recursively for _meta.json, meta.json, _meta.yaml, _meta.yml files.
 * @param {string} docsDir Root documentation folder
 * @returns {Map<string, object>} Map of normalized directory relative path -> parsed meta object
 */
export function scanDirectoryMeta(docsDir) {
  const metaMap = new Map();
  if (!fs.existsSync(docsDir)) return metaMap;

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    const relDir = path.relative(docsDir, currentDir).replace(/\\/g, '/');

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.well-known') {
        continue;
      }
      if (IGNORED_NAMES.has(entry.name)) {
        continue;
      }

      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const name = entry.name.toLowerCase();
        if (name === '_meta.json' || name === 'meta.json' || name === '_meta.yaml' || name === '_meta.yml') {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            let parsed = {};
            if (name.endsWith('.json')) {
              parsed = JSON.parse(content);
            } else {
              parsed = yaml.parse(content);
            }
            if (parsed && typeof parsed === 'object') {
              metaMap.set(relDir === '.' ? '' : relDir, parsed);
            }
          } catch (e) {
            console.warn(`[docboot] Warning: Failed to parse directory meta at ${fullPath}:`, e.message);
          }
        }
      }
    }
  }

  walk(docsDir);
  return metaMap;
}

