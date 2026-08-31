import path from 'node:path';
import { unescapeHtml } from '../markdown/highlighter.js';

/**
 * Strips leading numeric ordering prefixes like `01-` or `02_` from a slug/segment.
 * @param {string} segment
 * @returns {string}
 */
export function stripNumericPrefix(segment) {
  if (!segment) return '';
  return segment.replace(/^\d+[-_]+/, '');
}

/**
 * Extracts numeric prefix as number if present, or null.
 * @param {string} segment
 * @returns {number|null}
 */
export function extractNumericOrder(segment) {
  if (!segment) return null;
  const match = segment.match(/^(\d+)[-_]+/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Normalizes documentation relative path by optionally removing container prefixes like `docs/` or `doc/`.
 * @param {string} relativePath
 * @param {string} stripPrefix
 * @returns {string}
 */
export function normalizeDocRelativePath(relativePath, stripPrefix = '') {
  let normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (stripPrefix && normalized.startsWith(stripPrefix)) {
    normalized = normalized.slice(stripPrefix.length).replace(/^\/+/, '');
  }
  return normalized;
}

/**
 * Converts a relative markdown file path to a clean URL route.
 * Strips numeric prefixes (e.g. `01-getting-started.md` -> `/getting-started`).
 *
 * @param {string} relativePath 
 * @param {string} stripPrefix Optional container prefix to strip (e.g. 'docs/')
 * @returns {string} Clean route starting with /
 */
export function filePathToRoute(relativePath, stripPrefix = '') {
  const normalized = normalizeDocRelativePath(relativePath, stripPrefix);
  const ext = path.extname(normalized);
  let withoutExt = ext ? normalized.slice(0, -ext.length) : normalized;

  const rawSegments = withoutExt.split('/').filter(Boolean);
  const cleanSegments = rawSegments.map(s => stripNumericPrefix(s));

  const cleanPath = cleanSegments.join('/');

  if (cleanPath === 'README' || cleanPath === 'index' || cleanPath === '') {
    return '/';
  }

  if (cleanPath.endsWith('/README') || cleanPath.endsWith('/index')) {
    return '/' + cleanPath.replace(/\/(README|index)$/, '').replace(/^\/+/, '');
  }

  return '/' + cleanPath.replace(/^\/+/, '');
}

/**
 * Derives a human-readable page title without raw HTML entities or numeric prefixes.
 * @param {string} relativePath 
 * @param {object} frontmatter 
 * @param {Array} headings 
 * @returns {string}
 */
export function deriveTitle(relativePath, frontmatter = {}, headings = []) {
  if (frontmatter.sidebarTitle) return unescapeHtml(frontmatter.sidebarTitle);
  if (frontmatter.menuTitle) return unescapeHtml(frontmatter.menuTitle);
  if (frontmatter.title) return unescapeHtml(frontmatter.title);

  const h1 = headings.find(h => h.level === 1);
  if (h1 && h1.title) return unescapeHtml(h1.title);

  const base = path.basename(relativePath, path.extname(relativePath));
  const cleanBase = stripNumericPrefix(base);

  if (cleanBase.toLowerCase() === 'readme' || cleanBase.toLowerCase() === 'index') {
    const dir = path.dirname(relativePath);
    if (dir && dir !== '.') {
      return unescapeHtml(formatSegmentName(stripNumericPrefix(path.basename(dir))));
    }
    return 'Overview';
  }

  return unescapeHtml(formatSegmentName(cleanBase));
}

export function formatSegmentName(segment) {
  const clean = stripNumericPrefix(segment);
  return unescapeHtml(clean)
    .split(/[-_]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

