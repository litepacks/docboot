import { slugify } from '../markdown/toc.js';
import { unescapeHtml, escapeHtml } from '../markdown/highlighter.js';

/**
 * Extracts distinct code identifiers, CLI flags, and symbols from markdown text.
 * @param {string} text 
 * @returns {string} Space-separated unique symbol tokens
 */
export function extractSymbols(text = '') {
  if (!text) return '';
  const symbols = new Set();

  // 1. Inline code backticks: `foo()`, `docboot build`, `--stale`
  const inlineCodeRegex = /`([^`\n]+)`/g;
  let match;
  while ((match = inlineCodeRegex.exec(text)) !== null) {
    const code = match[1].trim();
    if (code && code.length >= 2 && code.length <= 80) {
      symbols.add(code);
      // Also split multi-word inline code (e.g. `docboot doctor --stale`)
      code.split(/\s+/).forEach(w => {
        if (w.length >= 2) symbols.add(w);
      });
    }
  }

  // 2. CLI flags (--flag, -f, --flag=value)
  const flagRegex = /(?:^|\s)(--[a-zA-Z0-9_-]+(?:=[a-zA-Z0-9_-]+)?|-[a-zA-Z])(?:\s|$|[.,:;])/g;
  while ((match = flagRegex.exec(text)) !== null) {
    const flag = match[1].trim();
    if (flag) symbols.add(flag);
  }

  // 3. Code block identifiers (function names, config keys, imports)
  const codeBlockRegex = /```(?:[a-zA-Z0-9_-]+)?\s*([\s\S]*?)```/g;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const block = match[1];
    const words = block.match(/[a-zA-Z0-9_$-]{2,}/g) || [];
    for (const w of words) {
      if (w.length >= 3 && w.length <= 40) {
        symbols.add(w);
      }
    }
  }

  return Array.from(symbols).slice(0, 50).join(' ');
}

/**
 * Normalizes text by removing markdown symbols, links, HTML entities and excess whitespace,
 * while retaining searchable code keywords.
 * @param {string} text 
 * @returns {string} Clean plain text
 */
export function normalizeText(text = '') {
  return unescapeHtml(text)
    .replace(/```[a-zA-Z0-9_-]*\s*([\s\S]*?)```/g, ' $1 ') // Retain words inside code blocks
    .replace(/`([^`]+)`/g, ' $1 ')                         // Retain inline code words
    .replace(/:::[a-zA-Z0-9_-]*(?:[^\r\n]*)?/g, ' ')       // Directive markers
    .replace(/<[^>]*>/g, ' ')                              // HTML tags
    .replace(/\[([^\]]+)\]\([^)]+\)/g, ' $1 ')             // Links [text](url) -> text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, ' $1 ')             // Images
    .replace(/[#*_~`>-]/g, ' ')                            // Markdown formatting chars
    .replace(/\s+/g, ' ')                                  // Collapse whitespace
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
 * Creates a context-aware dynamic snippet centered around matching search terms.
 * @param {string} text Full section plain text
 * @param {string} query Search query string
 * @param {number} maxLength Target snippet length (default: 130)
 * @returns {string} Contextual snippet with leading/trailing ellipses
 */
export function createDynamicSnippet(text = '', query = '', maxLength = 130) {
  const clean = normalizeText(text);
  if (!clean) return '';
  if (!query || clean.length <= maxLength) {
    return createSnippet(clean, maxLength);
  }

  // Extract query keywords (length >= 2)
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .map(t => t.replace(/[^a-zA-Z0-9_-]/g, ''))
    .filter(t => t.length >= 2);

  if (tokens.length === 0) {
    return createSnippet(clean, maxLength);
  }

  const lowerText = clean.toLowerCase();
  let firstMatchIndex = -1;
  let matchedTokenLen = 0;

  for (const token of tokens) {
    const idx = lowerText.indexOf(token);
    if (idx !== -1 && (firstMatchIndex === -1 || idx < firstMatchIndex)) {
      firstMatchIndex = idx;
      matchedTokenLen = token.length;
    }
  }

  if (firstMatchIndex === -1) {
    return createSnippet(clean, maxLength);
  }

  // Center window around match
  const leadChars = 35;
  let start = Math.max(0, firstMatchIndex - leadChars);
  let end = Math.min(clean.length, start + maxLength);

  // Adjust to clean word boundaries
  if (start > 0) {
    const spaceIndex = clean.indexOf(' ', start);
    if (spaceIndex !== -1 && spaceIndex < firstMatchIndex) {
      start = spaceIndex + 1;
    }
  }

  if (end < clean.length) {
    const lastSpace = clean.lastIndexOf(' ', end);
    if (lastSpace > start + 40) {
      end = lastSpace;
    }
  }

  let snippet = clean.slice(start, end).trim();
  if (start > 0) snippet = '...' + snippet;
  if (end < clean.length) snippet = snippet + '...';

  return snippet;
}

/**
 * Safely wraps matching query tokens in <mark> tags without breaking HTML escaping.
 * @param {string} text Plain text to highlight
 * @param {string} query Search query
 * @param {string} highlightClass CSS classes for <mark>
 * @returns {string} HTML-escaped text with <mark> tags
 */
export function highlightMatches(text = '', query = '', highlightClass = 'bg-accent/20 text-accent font-semibold px-0.5 rounded-xs') {
  if (!text) return '';
  const escapedText = escapeHtml(text);
  if (!query) return escapedText;

  const tokens = query
    .trim()
    .split(/\s+/)
    .map(t => t.replace(/[^a-zA-Z0-9_-]/g, ''))
    .filter(t => t.length >= 2);

  if (tokens.length === 0) return escapedText;

  // Build regex for all tokens escaping special chars
  const escapedTokens = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escapedTokens.join('|')})`, 'gi');

  return escapedText.replace(regex, `<mark class="${highlightClass}">$1</mark>`);
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
    const symbols = extractSymbols(contentWithoutFrontmatter);
    records.push({
      id: `${baseRoute}::0`,
      title: pageTitle,
      section: category ? `${category} › ${pageTitle}` : pageTitle,
      headings: '',
      symbols,
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
    const rawSectionBody = sec.lines.join('\n');
    let plainText = normalizeText(rawSectionBody);
    const symbols = extractSymbols(rawSectionBody);

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
      symbols,
      route,
      text: plainText || sec.heading,
      snippet: createSnippet(plainText) || sec.heading
    });
  }

  return records;
}
