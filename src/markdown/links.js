import path from 'node:path';

/**
 * Normalizes markdown internal links into clean web routes.
 * Converts:
 *   ./installation.md -> /getting-started/installation
 *   ../concepts/architecture.md -> /concepts/architecture
 *   /guide/README.md -> /guide
 *   README.md#setup -> /#setup
 * 
 * @param {string} href Target link URL
 * @param {string} currentRelativePath Relative path of the current markdown file (e.g. 'getting-started/index.md')
 * @returns {string} Normalized clean route
 */
export function normalizeMarkdownLink(href = '', currentRelativePath = '') {
  if (!href) return '';

  const trimmed = href.trim();

  // Keep external links and in-page anchor links intact
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('#')
  ) {
    return trimmed;
  }

  // Split into pathname and hash
  const hashIndex = trimmed.indexOf('#');
  let pathname = hashIndex !== -1 ? trimmed.slice(0, hashIndex) : trimmed;
  const hash = hashIndex !== -1 ? trimmed.slice(hashIndex) : '';

  // If no pathname (just query/hash), return as is
  if (!pathname) {
    return hash || href;
  }

  // Check if link points to a markdown file or relative directory
  const isMd = pathname.endsWith('.md') || pathname.endsWith('.markdown');
  if (isMd) {
    pathname = pathname.replace(/\.(md|markdown)$/i, '');
  }

  let resolvedPath = '';

  if (pathname.startsWith('/')) {
    // Root-relative path (e.g. /guide/installation or /README)
    resolvedPath = pathname;
  } else {
    // Relative to current markdown file's directory
    const currentDir = currentRelativePath ? path.posix.dirname(currentRelativePath.replace(/\\/g, '/')) : '.';
    const joined = path.posix.join(currentDir === '.' ? '' : currentDir, pathname);
    resolvedPath = '/' + joined.replace(/^\/+/, '');
  }

  // Clean index/README filenames to folder root routes
  resolvedPath = resolvedPath.replace(/\\/g, '/');
  
  if (resolvedPath === '/README' || resolvedPath === '/index' || resolvedPath === '') {
    resolvedPath = '/';
  } else if (resolvedPath.endsWith('/README') || resolvedPath.endsWith('/index')) {
    resolvedPath = resolvedPath.replace(/\/(README|index)$/, '');
    if (!resolvedPath) resolvedPath = '/';
  }

  return (resolvedPath || '/') + hash;
}
