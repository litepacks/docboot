import { slugify } from '../markdown/toc.js';
import { unescapeHtml } from '../markdown/highlighter.js';

/**
 * Normalizes text by removing markdown symbols, links, code syntax, HTML entities and excess whitespace.
 * @param {string} text 
 * @returns {string} Clean plain text
 */
export function normalizeText(text = '') {
  return unescapeHtml(text)
    .replace(/```[\s\S]*?```/g, ' ')                // Code blocks
    .replace(/`([^`]+)`/g, '$1')                     // Inline code
    .replace(/:::[a-zA-Z0-9_-]*(?:[^\r\n]*)?/g, ' ') // Callout markers
    .replace(/<[^>]*>/g, ' ')                        // HTML tags
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')         // Links [text](url) -> text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')         // Images
    .replace(/[#*_~`>-]/g, ' ')                      // Markdown formatting chars
    .replace(/\s+/g, ' ')                            // Collapse whitespace
    .trim();
}

/**
 * Creates a concise preview snippet from plain text.
 * @param {string} text 
 * @param {number} maxLength 
 * @returns {string} Truncated snippet with ellipsis
 */
export function createSnippet(text = '', maxLength = 130) {
  const clean = normalizeText(text);
  if (!clean) return '';
  if (clean.length <= maxLength) return clean;

  const truncated = clean.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > 40) {
    return truncated.slice(0, lastSpace) + '...';
  }
  return truncated + '...';
}

/**
 * Extracts section-level records from a markdown document for granular search indexing.
 * 
 * @param {object} page
 * @param {string} page.route Base route (e.g. /guide/state)
 * @param {string} page.title Main page title
 * @param {string} rawContent Raw markdown content of the file
 * @param {object} frontmatter YAML frontmatter object
 * @returns {Array<object>} Section search records
 */
export function extractSections(page, rawContent = '', frontmatter = {}) {
  const records = [];
  const baseRoute = page.route;
  const pageTitle = unescapeHtml(page.title || frontmatter.title || 'Documentation');
  const category = unescapeHtml(frontmatter.category || '');

  // Remove frontmatter before section splitting
  const contentWithoutFrontmatter = rawContent.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');

  // Split by headings (h1, h2, h3)
  const lines = contentWithoutFrontmatter.split(/\r?\n/);
  const rawSections = [];
  let currentSection = null;

  const slugCounts = new Map();
  function getSlug(text) {
    const rawSlug = slugify(text) || 'section';
    const count = slugCounts.get(rawSlug) || 0;
    slugCounts.set(rawSlug, count + 1);
    return count > 0 ? `${rawSlug}-${count}` : rawSlug;
  }

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      if (currentSection && (currentSection.lines.some(l => l.trim().length > 0) || currentSection.level > 1)) {
        rawSections.push(currentSection);
      }

      const level = headingMatch[1].length;
      const headingText = unescapeHtml(headingMatch[2].replace(/<[^>]*>/g, '').trim());
      const slug = level === 1 ? '' : getSlug(headingText);

      currentSection = {
        level,
        heading: headingText,
        slug,
        lines: []
      };
    } else {
      if (!currentSection) {
        currentSection = {
          level: 1,
          heading: pageTitle,
          slug: '',
          lines: []
        };
      }
      currentSection.lines.push(line);
    }
  }

  if (currentSection && (currentSection.lines.some(l => l.trim().length > 0) || currentSection.heading)) {
    rawSections.push(currentSection);
  }

  // If no sections produced, fallback to single root record
  if (rawSections.length === 0) {
    const plainText = normalizeText(contentWithoutFrontmatter);
    records.push({
      id: `${baseRoute}::0`,
      title: pageTitle,
      section: category ? `${category} › ${pageTitle}` : pageTitle,
      headings: '',
      route: baseRoute,
      text: plainText,
      snippet: createSnippet(plainText)
    });
    return records;
  }

  // Build search records from sections with unique IDs
  const seenSlugs = new Set();
  const aliases = Array.isArray(frontmatter.aliases) ? frontmatter.aliases.join(' ') : (frontmatter.aliases || '');
  const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags.join(' ') : (frontmatter.tags || '');
  const extraSearchTerms = [aliases, tags, frontmatter.description || ''].filter(Boolean).join(' ');

  for (let i = 0; i < rawSections.length; i++) {
    const sec = rawSections[i];
    const sectionBody = sec.lines.join('\n');
    let plainText = normalizeText(sectionBody);

    const isPageRoot = sec.level === 1 || !sec.slug;
    if (isPageRoot && extraSearchTerms) {
      plainText = `${extraSearchTerms} ${plainText}`.trim();
    }

    let finalSlug = isPageRoot ? '' : sec.slug;
    if (isPageRoot && seenSlugs.has('')) {
      finalSlug = getSlug(sec.heading);
    }
    seenSlugs.add(finalSlug);

    const route = finalSlug ? `${baseRoute}#${finalSlug}` : baseRoute;
    const id = `${baseRoute}::${i + 1}${finalSlug ? '#' + finalSlug : ''}`;

    let sectionBreadcrumb = pageTitle;
    if (category) {
      sectionBreadcrumb = `${category} › ${pageTitle}`;
    }
    if (!isPageRoot && sec.heading !== pageTitle) {
      sectionBreadcrumb = `${sectionBreadcrumb} › ${sec.heading}`;
    }

    records.push({
      id,
      title: pageTitle,
      section: sectionBreadcrumb,
      headings: isPageRoot ? '' : sec.heading,
      route,
      text: plainText || sec.heading,
      snippet: createSnippet(plainText) || sec.heading
    });
  }

  return records;
}
