import { unescapeHtml } from './highlighter.js';

/**
 * Generates clean, URL-friendly slug from heading text without HTML entities or emojis.
 * Examples:
 *   "🧪 Examples & Starter Kits" -> "examples-starter-kits"
 *   "Installation &amp; Setup" -> "installation-setup"
 * 
 * @param {string} text 
 * @returns {string} Clean URL slug
 */
export function slugify(text) {
  if (!text) return '';

  const clean = unescapeHtml(text)
    .toString()
    .toLowerCase()
    .trim()
    .replace(/&/g, ' ')         // Replace & with space so it doesn't become 'amp'
    .replace(/[^\w\s-]/g, '')   // Remove all non-word chars (and emojis like 🧪)
    .replace(/[\s_-]+/g, '-')   // Replace spaces/underscores with hyphens
    .replace(/^-+|-+$/g, '');   // Trim leading/trailing hyphens

  return clean;
}

/**
 * TOC generator helper with stateful slug tracking for duplicates.
 */
export class TocCollector {
  constructor() {
    this.slugCounts = new Map();
    this.items = [];
  }

  getSlug(text) {
    let slug = slugify(text) || 'section';
    const count = this.slugCounts.get(slug) || 0;
    this.slugCounts.set(slug, count + 1);

    if (count > 0) {
      return `${slug}-${count}`;
    }
    return slug;
  }

  addHeading(level, text, id) {
    if (level === 2 || level === 3) {
      this.items.push({
        level,
        title: unescapeHtml(text).trim(),
        id
      });
    }
  }

  getTocTree() {
    return this.items;
  }
}
