/**
 * Deterministic related-page generator for Docboot.
 * Computes top 3-5 related pages at build time using link graph, keyword overlap,
 * and navigation proximity with zero external AI dependencies.
 */

export function calculateRelatedPages(currentPage, allPages = [], options = {}) {
  const maxResults = options.limit || 4;
  if (!currentPage || !Array.isArray(allPages) || allPages.length <= 1) {
    return [];
  }

  const currentRoute = currentPage.route;
  const currentLinks = new Set(currentPage.internalLinks || []);
  const currentKeywords = extractKeywords(currentPage);
  const currentDir = currentPage.relativePath ? currentPage.relativePath.split('/').slice(0, -1).join('/') : '';
  const currentTags = new Set(Array.isArray(currentPage.frontmatter?.tags) ? currentPage.frontmatter.tags : []);

  const scored = [];

  for (const page of allPages) {
    if (page.route === currentRoute) continue;
    if (page.frontmatter?.draft || page.frontmatter?.hidden) continue;

    let score = 0;

    // 1. Direct cross-linking: does current page link to this page or vice-versa?
    const targetRoute = page.route;
    const cleanTarget = targetRoute.replace(/^\/+/, '');
    if (currentLinks.has(targetRoute) || currentLinks.has(cleanTarget) || currentLinks.has('/' + cleanTarget)) {
      score += 5;
    }
    const otherLinks = new Set(page.internalLinks || []);
    if (otherLinks.has(currentRoute) || otherLinks.has(currentRoute.replace(/^\/+/, ''))) {
      score += 4;
    }

    // 2. Shared link targets (co-citation)
    let sharedLinkCount = 0;
    for (const link of currentLinks) {
      if (otherLinks.has(link)) sharedLinkCount++;
    }
    score += sharedLinkCount * 2;

    // 3. Tag overlap
    const otherTags = Array.isArray(page.frontmatter?.tags) ? page.frontmatter.tags : [];
    for (const tag of otherTags) {
      if (currentTags.has(tag)) score += 4;
    }

    // 4. Keyword overlap in Title and Headings
    const otherKeywords = extractKeywords(page);
    let keywordOverlap = 0;
    for (const kw of otherKeywords) {
      if (currentKeywords.has(kw)) keywordOverlap++;
    }
    score += Math.min(keywordOverlap * 1.5, 6);

    // 5. Directory proximity (same section)
    const otherDir = page.relativePath ? page.relativePath.split('/').slice(0, -1).join('/') : '';
    if (currentDir && otherDir && currentDir === otherDir) {
      score += 2;
    }

    if (score >= 3) {
      scored.push({
        route: page.route,
        title: page.title || deriveFallbackTitle(page.relativePath),
        description: page.description || page.frontmatter?.description || '',
        category: page.category || (otherDir ? otherDir.replace(/^[0-9]+[_-]/, '') : ''),
        score
      });
    }
  }

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, maxResults).map(({ route, title, description, category }) => ({
    route,
    title,
    description,
    category
  }));
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'your', 'have',
  'more', 'will', 'about', 'into', 'some', 'than', 'them', 'these',
  'using', 'when', 'what', 'which', 'where', 'guide', 'docs', 'docboot'
]);

function extractKeywords(page) {
  const set = new Set();
  const textToScan = [
    page.title || '',
    page.description || '',
    ...(page.headings || []).map(h => h.text || '')
  ].join(' ').toLowerCase();

  const words = textToScan.match(/[a-z0-9_-]{3,}/g) || [];
  for (const w of words) {
    if (!STOP_WORDS.has(w) && !/^\d+$/.test(w)) {
      set.add(w);
    }
  }
  return set;
}

function deriveFallbackTitle(relPath) {
  if (!relPath) return 'Page';
  const name = relPath.split('/').pop().replace(/\.md$/, '');
  return name.charAt(0).toUpperCase() + name.slice(1).replace(/[-_]/g, ' ');
}
