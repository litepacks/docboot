import MiniSearch from 'minisearch';
import { createDynamicSnippet, highlightMatches } from './extractor.js';

/**
 * Creates an in-memory MiniSearch engine instance from indexed document records or pre-serialized JSON.
 * 
 * @param {Array<object>|string|object} data Document records array or serialized MiniSearch JSON
 * @param {object} options 
 * @returns {object} Search engine with search(query), suggest(query), toJSON(), highlight(), getDynamicSnippet()
 */
export function createSearchEngine(data, options = {}) {
  const boost = {
    title: 6,
    headings: 4,
    symbols: 3,
    section: 2,
    text: 1,
    ...(options.boost || {})
  };

  const searchOptions = {
    boost,
    fuzzy: options.fuzzy !== undefined ? options.fuzzy : 0.2,
    prefix: options.prefix !== undefined ? options.prefix : true
  };

  let miniSearch;

  if (typeof data === 'string' || (data && typeof data === 'object' && !Array.isArray(data) && (data.serializationVersion !== undefined || data.documentCount !== undefined))) {
    // 1. Fast path: Instantiate from pre-serialized MiniSearch JSON with 0ms indexing delay
    const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
    miniSearch = MiniSearch.loadJSON(jsonStr, {
      fields: ['title', 'section', 'headings', 'symbols', 'text'],
      storeFields: ['id', 'title', 'section', 'route', 'snippet', 'text', 'symbols'],
      searchOptions
    });
  } else {
    // 2. Standard path: Build in-memory inverted index from document records array
    const docs = Array.isArray(data) ? data : (data?.index || []);
    miniSearch = new MiniSearch({
      fields: ['title', 'section', 'headings', 'symbols', 'text'],
      storeFields: ['id', 'title', 'section', 'route', 'snippet', 'text', 'symbols'],
      searchOptions
    });
    miniSearch.addAll(docs);
  }

  return {
    search(query, searchOpts = {}) {
      let q = (query || '').trim();
      const minLength = options.minQueryLength || 2;

      // Inline category extraction support (@category query)
      let categoryFilter = searchOpts.category || null;
      const atMatch = q.match(/^@([a-zA-Z0-9_-]+)(?:\s+(.*))?$/);
      if (atMatch) {
        categoryFilter = atMatch[1].toLowerCase();
        q = (atMatch[2] || '').trim();
      }

      if (q.length > 0 && q.length < minLength && !categoryFilter) {
        return [];
      }

      const rawOpts = {
        boost,
        fuzzy: options.fuzzy !== undefined ? options.fuzzy : 0.2,
        prefix: options.prefix !== undefined ? options.prefix : true,
        ...searchOpts
      };

      if (categoryFilter && categoryFilter !== 'all') {
        const catLower = categoryFilter.toLowerCase();
        rawOpts.filter = (result) => {
          const sec = (result.section || '').toLowerCase();
          const route = (result.route || '').toLowerCase();
          return sec.includes(catLower) || route.includes('/' + catLower);
        };
      }

      // If query is empty but category is specified, return top category items
      const results = q.length >= (categoryFilter ? 0 : minLength)
        ? (q.length > 0 ? miniSearch.search(q, rawOpts) : miniSearch.search(categoryFilter, rawOpts))
        : [];

      const maxResults = options.maxResults || 10;
      return results.slice(0, maxResults).map(r => {
        const fullText = r.text || r.snippet || '';
        const dynamicSnippet = createDynamicSnippet(fullText, q || categoryFilter, 130);

        return {
          id: r.id,
          title: r.title,
          section: r.section,
          route: r.route,
          snippet: dynamicSnippet || r.snippet,
          symbols: r.symbols || '',
          score: r.score
        };
      });
    },
    suggest(query, limit = 3) {
      const q = (query || '').trim();
      if (!q || q.length < 2) return [];

      try {
        const suggestions = miniSearch.autoSuggest(q, {
          fuzzy: 0.35,
          prefix: true
        });
        return suggestions.slice(0, limit);
      } catch (_) {
        return [];
      }
    },
    toJSON() {
      return miniSearch.toJSON();
    },
    highlight(text, query) {
      return highlightMatches(text, query);
    },
    getDynamicSnippet(text, query) {
      return createDynamicSnippet(text, query, 130);
    }
  };
}
