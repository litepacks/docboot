import fs from 'node:fs';
import path from 'node:path';

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
