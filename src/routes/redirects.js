import path from 'node:path';
import { escapeHtml, unescapeHtml } from '../markdown/highlighter.js';

/**
 * Normalizes any route, alias, or redirect path into a canonical internal route form.
 * Handles:
 *  - `/old`, `old`, `/old/`, `old.html`, `/old/index.html` -> `/old`
 *  - `/` or `""` or `"index.md"` -> `/`
 *  - preserves anchor `#hash` and query string `?key=val` separately.
 * 
 * @param {string} rawPath 
 * @returns {{ route: string, pathOnly: string, hash: string|null, query: string|null, isExternal: boolean, isDangerous: boolean }}
 */
export function normalizeRoutePath(rawPath = '') {
  if (typeof rawPath !== 'string') {
    return { route: '/', pathOnly: '/', hash: null, query: null, isExternal: false, isDangerous: false };
  }

  const trimmed = rawPath.trim();

  // Check dangerous schemes
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
    return { route: trimmed, pathOnly: trimmed, hash: null, query: null, isExternal: false, isDangerous: true };
  }

  // Check external URLs (http / https)
  if (/^https?:\/\//i.test(trimmed)) {
    return { route: trimmed, pathOnly: trimmed, hash: null, query: null, isExternal: true, isDangerous: false };
  }

  // Separate hash and query
  let pathPart = trimmed;
  let hash = null;
  let query = null;

  const hashIdx = pathPart.indexOf('#');
  if (hashIdx !== -1) {
    hash = pathPart.slice(hashIdx + 1);
    pathPart = pathPart.slice(0, hashIdx);
  }

  const queryIdx = pathPart.indexOf('?');
  if (queryIdx !== -1) {
    query = pathPart.slice(queryIdx + 1);
    pathPart = pathPart.slice(0, queryIdx);
  }

  // Normalize path segments
  let clean = pathPart.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
  
  // Strip .html or .md extension
  if (clean.endsWith('.html')) {
    clean = clean.slice(0, -5);
  } else if (clean.endsWith('.md')) {
    clean = clean.slice(0, -3);
  }

  // Strip trailing /index or /README
  clean = clean.replace(/\/(index|README)$/i, '');
  if (clean.toLowerCase() === 'index' || clean.toLowerCase() === 'readme' || clean === '') {
    clean = '';
  }

  const pathOnly = clean === '' ? '/' : '/' + clean;
  let fullRoute = pathOnly;
  if (query) fullRoute += '?' + query;
  if (hash) fullRoute += '#' + hash;

  return {
    route: fullRoute,
    pathOnly,
    hash: hash ? hash.replace(/^#/, '') : null,
    query,
    isExternal: false,
    isDangerous: false
  };
}

/**
 * Calculates Levenshtein edit distance between two strings.
 */
function levenshteinDistance(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

/**
 * Finds the closest matching canonical route from a list of valid routes.
 * @param {string} targetPath 
 * @param {Iterable<string>} validRoutes 
 * @returns {string|null}
 */
export function findClosestRouteSuggestion(targetPath, validRoutes) {
  let closest = null;
  let minDistance = 5; // Maximum distance threshold for suggestions

  const targetClean = targetPath.toLowerCase().replace(/^\/+/, '');

  for (const r of validRoutes) {
    const candidateClean = r.toLowerCase().replace(/^\/+/, '');
    if (candidateClean === targetClean) continue;

    // Direct prefix / suffix match
    if (candidateClean.includes(targetClean) || targetClean.includes(candidateClean)) {
      return r;
    }

    const dist = levenshteinDistance(targetClean, candidateClean);
    if (dist < minDistance) {
      minDistance = dist;
      closest = r;
    }
  }

  return closest;
}

/**
 * Builds and validates the complete redirect & alias graph from pages frontmatter and docboot.config.js.
 * 
 * @param {Array<object>} pages Array of parsed documentation pages
 * @param {object} configRedirects Map of redirects from docboot.config.js
 * @param {object} options Optional settings { flattenChains: true }
 * @returns {{
 *   redirects: Map<string, object>,
 *   flattenedRedirects: Map<string, object>,
 *   errors: Array<object>,
 *   warnings: Array<object>,
 *   stats: object
 * }}
 */
export function buildRedirectManifest(pages = [], configRedirects = {}, options = {}) {
  const { flattenChains = true } = options;

  const errors = [];
  const warnings = [];

  // 1. Map of canonical routes -> page object & headings
  const canonicalRouteMap = new Map();
  const pageHeadingsMap = new Map();

  for (const page of pages) {
    if (page.route) {
      canonicalRouteMap.set(page.route, page);
      const headingIds = new Set((page.headings || []).map(h => h.id));
      pageHeadingsMap.set(page.route, headingIds);
    }
  }

  // 2. Collect all raw redirects & aliases
  const rawRedirects = new Map(); // sourceRoute -> entry
  const aliasSourceMap = new Map(); // sourceRoute -> file path (for alias collision detection)

  // 2a. Frontmatter aliases and redirectFrom
  for (const page of pages) {
    const relFile = page.relativePath || page.fullPath || 'unknown markdown file';
    const aliases = [];

    if (Array.isArray(page.frontmatter?.aliases)) {
      for (const a of page.frontmatter.aliases) {
        aliases.push({ value: a, type: 'alias' });
      }
    } else if (typeof page.frontmatter?.aliases === 'string') {
      aliases.push({ value: page.frontmatter.aliases, type: 'alias' });
    }

    if (Array.isArray(page.frontmatter?.redirectFrom)) {
      for (const rf of page.frontmatter.redirectFrom) {
        aliases.push({ value: rf, type: 'redirectFrom' });
      }
    } else if (typeof page.frontmatter?.redirectFrom === 'string') {
      aliases.push({ value: page.frontmatter.redirectFrom, type: 'redirectFrom' });
    }

    for (const item of aliases) {
      const parsed = normalizeRoutePath(String(item.value));

      if (parsed.isDangerous) {
        errors.push({
          type: 'Security Error',
          message: `Dangerous scheme in ${item.type} "${item.value}" declared in ${relFile}.`
        });
        continue;
      }

      if (parsed.isExternal) {
        errors.push({
          type: 'Invalid Alias Target',
          message: `Aliases must be local routes and cannot point to external URLs. "${item.value}" in ${relFile}.`
        });
        continue;
      }

      const sourceRoute = parsed.pathOnly;

      // Check Real Page Collision
      if (canonicalRouteMap.has(sourceRoute)) {
        const canonicalPage = canonicalRouteMap.get(sourceRoute);
        const canonFile = canonicalPage.relativePath || canonicalPage.fullPath || 'real page';
        errors.push({
          type: 'Route Conflict',
          message: `Route conflict: "${sourceRoute}" is already generated by "${canonFile}". It cannot also be used as an ${item.type} in "${relFile}".`
        });
        continue;
      }

      // Check Alias Collision between different pages
      if (aliasSourceMap.has(sourceRoute) && aliasSourceMap.get(sourceRoute) !== relFile) {
        errors.push({
          type: 'Alias Conflict',
          message: `Alias conflict: "${sourceRoute}" is declared by both "${aliasSourceMap.get(sourceRoute)}" and "${relFile}".`
        });
        continue;
      }

      aliasSourceMap.set(sourceRoute, relFile);

      rawRedirects.set(sourceRoute, {
        sourceRoute,
        target: page.route,
        targetPath: page.route,
        targetAnchor: null,
        targetQuery: null,
        type: item.type,
        sourceFile: relFile,
        isExternal: false,
        canonicalRoute: page.route
      });
    }
  }

  // 2b. Config redirects (docboot.config.js)
  if (configRedirects && typeof configRedirects === 'object') {
    for (const [fromRaw, toRaw] of Object.entries(configRedirects)) {
      const parsedFrom = normalizeRoutePath(fromRaw);
      const parsedTo = normalizeRoutePath(String(toRaw));

      if (parsedFrom.isDangerous || parsedTo.isDangerous) {
        errors.push({
          type: 'Security Error',
          message: `Security: Dangerous URL scheme rejected in redirect: "${fromRaw}" → "${toRaw}".`
        });
        continue;
      }

      const sourceRoute = parsedFrom.pathOnly;

      // Check Real Page Collision
      if (canonicalRouteMap.has(sourceRoute)) {
        const canonicalPage = canonicalRouteMap.get(sourceRoute);
        const canonFile = canonicalPage.relativePath || canonicalPage.fullPath || 'real page';
        errors.push({
          type: 'Route Conflict',
          message: `Route conflict: "${sourceRoute}" is already generated by "${canonFile}". It cannot also be used as a redirect in docboot.config.js.`
        });
        continue;
      }

      // Check if already defined by an alias
      if (aliasSourceMap.has(sourceRoute)) {
        warnings.push({
          type: 'Duplicate Redirect Source',
          message: `Redirect source "${sourceRoute}" in config overrides alias declared in "${aliasSourceMap.get(sourceRoute)}".`
        });
      }

      rawRedirects.set(sourceRoute, {
        sourceRoute,
        target: parsedTo.route,
        targetPath: parsedTo.pathOnly,
        targetAnchor: parsedTo.hash,
        targetQuery: parsedTo.query,
        type: 'redirect',
        sourceFile: 'config',
        isExternal: parsedTo.isExternal,
        canonicalRoute: parsedTo.isExternal ? null : parsedTo.pathOnly
      });
    }
  }

  // 3. Graph Validation: Missing Targets, Anchors, Loops, Chains
  const validCanonicalRoutes = new Set(canonicalRouteMap.keys());
  let chainCount = 0;
  let loopCount = 0;
  let externalCount = 0;
  let aliasCount = 0;
  let redirectCount = 0;

  const flattenedRedirects = new Map();

  for (const [sourceRoute, entry] of rawRedirects.entries()) {
    if (entry.isExternal) {
      externalCount++;
      flattenedRedirects.set(sourceRoute, entry);
      continue;
    }

    if (entry.type === 'alias' || entry.type === 'redirectFrom') {
      aliasCount++;
    } else {
      redirectCount++;
    }

    // Check if target is in canonical pages or another redirect
    if (!validCanonicalRoutes.has(entry.targetPath) && !rawRedirects.has(entry.targetPath)) {
      const suggestion = findClosestRouteSuggestion(entry.targetPath, validCanonicalRoutes);
      errors.push({
        type: 'Missing Redirect Target',
        message: `Redirect target not found: "${sourceRoute}" → "${entry.target}"`,
        suggestion: suggestion ? `Did you mean: ${suggestion}` : null
      });
      continue;
    }

    // Check target anchor if target is a canonical page
    if (entry.targetAnchor && validCanonicalRoutes.has(entry.targetPath)) {
      const headingSet = pageHeadingsMap.get(entry.targetPath);
      if (headingSet && !headingSet.has(entry.targetAnchor)) {
        warnings.push({
          type: 'Broken Redirect Anchor',
          message: `Redirect anchor not found: Heading #${entry.targetAnchor} not found in "${entry.targetPath}" for redirect "${sourceRoute}" → "${entry.target}".`
        });
      }
    }

    // 4. Cycle / Loop and Chain Detection
    const visited = new Set([sourceRoute]);
    let current = entry;
    let chainLength = 1;
    let hasLoop = false;
    const chainPath = [sourceRoute];

    while (current && !current.isExternal && rawRedirects.has(current.targetPath)) {
      const nextSource = current.targetPath;
      chainPath.push(nextSource);

      if (visited.has(nextSource)) {
        hasLoop = true;
        loopCount++;
        errors.push({
          type: 'Redirect Loop',
          message: `Redirect loop detected: ${chainPath.join(' → ')}`
        });
        break;
      }

      visited.add(nextSource);
      current = rawRedirects.get(nextSource);
      chainLength++;
    }

    if (!hasLoop) {
      if (chainLength > 1) {
        chainCount++;
        warnings.push({
          type: 'Redirect Chain',
          message: `Redirect chain detected: ${chainPath.concat(current ? current.target : []).join(' → ')}. Consider redirecting "${sourceRoute}" directly to "${current ? current.target : ''}".`
        });
      }

      // Flatten target to final destination
      const finalTarget = current ? current.target : entry.target;
      const finalTargetPath = current ? current.targetPath : entry.targetPath;
      const finalAnchor = entry.targetAnchor || (current ? current.targetAnchor : null);
      const finalQuery = entry.targetQuery || (current ? current.targetQuery : null);

      flattenedRedirects.set(sourceRoute, {
        ...entry,
        target: flattenChains ? finalTarget : entry.target,
        targetPath: flattenChains ? finalTargetPath : entry.targetPath,
        targetAnchor: finalAnchor,
        targetQuery: finalQuery,
        canonicalRoute: current?.isExternal ? null : finalTargetPath
      });
    }
  }

  return {
    redirects: rawRedirects,
    flattenedRedirects,
    errors,
    warnings,
    stats: {
      canonicalCount: validCanonicalRoutes.size,
      aliasCount,
      redirectCount,
      externalCount,
      chainCount,
      loopCount
    }
  };
}

/**
 * Generates clean, accessible, SEO-friendly HTML redirect pages.
 * 
 * @param {object} params
 * @param {string} params.targetUrl Full target URL including base if applicable
 * @param {string} params.canonicalUrl Canonical URL for <link rel="canonical">
 * @param {string} params.title Optional page title
 * @returns {string} HTML markup
 */
export function renderRedirectHtml({ targetUrl, canonicalUrl, title = 'Redirecting...' }) {
  const safeTarget = escapeHtml(targetUrl);
  const safeCanonical = escapeHtml(canonicalUrl || targetUrl);
  const safeTitle = escapeHtml(title);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${safeTitle}</title>
  <link rel="canonical" href="${safeCanonical}">
  <meta http-equiv="refresh" content="0; url=${safeTarget}">
  <meta name="robots" content="noindex, follow">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script>window.location.replace("${safeTarget}");</script>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #ffffff;
      --text: #0f172a;
      --card-bg: #f8fafc;
      --border: #e2e8f0;
      --accent: #2563eb;
      --muted: #64748b;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0b0f19;
        --text: #f8fafc;
        --card-bg: #111827;
        --border: #1e293b;
        --accent: #3b82f6;
        --muted: #94a3b8;
      }
    }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      padding: 1.5rem;
      box-sizing: border-box;
    }
    .redirect-card {
      max-width: 28rem;
      width: 100%;
      text-align: center;
      padding: 2rem;
      border-radius: 1rem;
      background-color: var(--card-bg);
      border: 1px solid var(--border);
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
    }
    .redirect-msg {
      font-size: 0.875rem;
      color: var(--muted);
      margin-bottom: 0.5rem;
    }
    .redirect-link {
      font-size: 1rem;
      font-weight: 600;
      color: var(--accent);
      text-decoration: underline;
      word-break: break-all;
      display: inline-block;
      margin-bottom: 1.5rem;
    }
    .redirect-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 1.25rem;
      border-radius: 0.5rem;
      background-color: var(--accent);
      color: #ffffff;
      font-size: 0.875rem;
      font-weight: 600;
      text-decoration: none;
      transition: opacity 0.15s ease;
    }
    .redirect-btn:hover {
      opacity: 0.9;
    }
    .redirect-btn svg {
      width: 1rem;
      height: 1rem;
    }
  </style>
</head>
<body>
  <div class="redirect-card">
    <p class="redirect-msg">This page has moved.</p>
    <p><a href="${safeTarget}" class="redirect-link">${safeTarget}</a></p>
    <div>
      <a href="${safeTarget}" class="redirect-btn">
        Click here if not redirected
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
        </svg>
      </a>
    </div>
  </div>
</body>
</html>`;
}
