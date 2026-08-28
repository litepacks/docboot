import crypto from 'node:crypto';
import { extractSections } from './extractor.js';

/**
 * Builds optimized section-level search index from all document pages.
 * Guarantees globally unique document IDs for MiniSearch.
 * 
 * @param {Array<object>} pages Array of page objects with raw markdown/content
 * @returns {{ index: Array<object>, hash: string, filename: string }}
 */
export function buildSearchIndex(pages) {
  const allRecords = [];
  const seenIds = new Set();

  for (const page of pages) {
    if (page.frontmatter?.draft) continue;

    let sections = page.searchEntries;
    if (!sections || sections.length === 0) {
      const rawContent = page.rawContent || page.plainText || '';
      sections = extractSections(page, rawContent, page.frontmatter || {});
      page.searchEntries = sections;
    }

    for (const record of sections) {
      let uniqueId = record.id || record.route;
      let counter = 1;
      while (seenIds.has(uniqueId)) {
        uniqueId = `${record.id || record.route}__${counter++}`;
      }
      seenIds.add(uniqueId);
      record.id = uniqueId;

      allRecords.push(record);
    }
  }

  // Calculate content hash for immutable caching
  const jsonString = JSON.stringify(allRecords);
  const hash = crypto.createHash('sha256').update(jsonString).digest('hex').slice(0, 8);
  const filename = `search-index.${hash}.json`;

  return {
    index: allRecords,
    hash,
    filename
  };
}
