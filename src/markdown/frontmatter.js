import YAML from 'yaml';

/**
 * Extracts YAML frontmatter from markdown file content.
 * @param {string} rawContent 
 * @returns {{ frontmatter: object, content: string }}
 */
export function extractFrontmatter(rawContent) {
  if (!rawContent || !rawContent.startsWith('---')) {
    return {
      frontmatter: {},
      content: rawContent || ''
    };
  }

  const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return {
      frontmatter: {},
      content: rawContent
    };
  }

  const yamlStr = match[1];
  const body = match[2];

  let parsed = {};
  try {
    parsed = YAML.parse(yamlStr) || {};
  } catch (err) {
    console.warn('[docboot] YAML Frontmatter parse error:', err.message);
  }

  return {
    frontmatter: parsed,
    content: body
  };
}
