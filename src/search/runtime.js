import MiniSearch from 'minisearch';

/**
 * Creates an in-memory MiniSearch engine instance from indexed document records.
 * 
 * @param {Array<object>} documents 
 * @param {object} options 
 * @returns {object} Search engine with search(query) method
 */
export function createSearchEngine(documents, options = {}) {
  const boost = {
    title: 5,
    headings: 3,
    section: 2,
    text: 1,
    ...(options.boost || {})
  };

  const miniSearch = new MiniSearch({
    fields: ['title', 'section', 'headings', 'text'],
    storeFields: ['id', 'title', 'section', 'route', 'snippet'],
    searchOptions: {
      boost,
      fuzzy: options.fuzzy !== undefined ? options.fuzzy : 0.2,
      prefix: options.prefix !== undefined ? options.prefix : true
    }
  });

  miniSearch.addAll(documents);

  return {
    search(query, searchOpts = {}) {
      const q = (query || '').trim();
      const minLength = options.minQueryLength || 2;
      if (q.length < minLength) {
        return [];
      }

      const results = miniSearch.search(q, {
        boost,
        fuzzy: options.fuzzy !== undefined ? options.fuzzy : 0.2,
        prefix: options.prefix !== undefined ? options.prefix : true,
        ...searchOpts
      });

      const maxResults = options.maxResults || 10;
      return results.slice(0, maxResults).map(r => ({
        id: r.id,
        title: r.title,
        section: r.section,
        route: r.route,
        snippet: r.snippet,
        score: r.score
      }));
    }
  };
}
