import path from 'node:path';
import { formatSegmentName, extractNumericOrder, stripNumericPrefix } from './tree.js';

/**
 * Builds hierarchical sidebar navigation tree from routes list.
 * 
 * @param {Array<object>} pages Array of page objects { route, title, order, relativePath, ... }
 * @param {object} customSidebar Optional manual sidebar configuration from config
 * @returns {Array<object>} Sidebar groups & links
 */
export function buildSidebar(pages, customSidebar = null) {
  if (customSidebar && Array.isArray(customSidebar)) {
    return customSidebar;
  }

  // Filter out drafts
  const activePages = pages.filter(p => !p.frontmatter?.draft);

  // Group pages by their top-level or nested directory
  const rootPages = [];
  const groupsMap = new Map();

  for (const page of activePages) {
    const rel = page.relativePath.replace(/\\/g, '/');
    const dir = path.dirname(rel);
    const baseName = path.basename(rel);
    const fileNumericOrder = extractNumericOrder(baseName);
    const inferredOrder = page.frontmatter?.order ?? fileNumericOrder ?? 999;

    if (dir === '.') {
      rootPages.push({
        title: page.title,
        route: page.route,
        order: inferredOrder,
        relativePath: page.relativePath
      });
    } else {
      const parts = dir.split('/');
      const groupKey = parts[0];
      const cleanGroupKey = stripNumericPrefix(groupKey);
      const groupNumericOrder = extractNumericOrder(groupKey);
      const groupTitle = formatSegmentName(cleanGroupKey);

      if (!groupsMap.has(cleanGroupKey)) {
        groupsMap.set(cleanGroupKey, {
          title: groupTitle,
          key: cleanGroupKey,
          order: groupNumericOrder ?? 999,
          items: []
        });
      }

      const group = groupsMap.get(cleanGroupKey);
      if (page.frontmatter?.groupOrder !== undefined) {
        group.order = Math.min(group.order, page.frontmatter.groupOrder);
      }

      group.items.push({
        title: page.title,
        route: page.route,
        order: inferredOrder,
        relativePath: page.relativePath
      });
    }
  }

  // Sort root pages
  rootPages.sort((a, b) => {
    if (a.route === '/') return -1;
    if (b.route === '/') return 1;
    if (a.order !== b.order) return a.order - b.order;
    return a.title.localeCompare(b.title);
  });

  // Sort groups and items within groups
  const groups = Array.from(groupsMap.values());
  for (const group of groups) {
    group.items.sort((a, b) => {
      // Index/README in group comes first
      const aIsIndex = a.relativePath.endsWith('index.md') || a.relativePath.endsWith('README.md');
      const bIsIndex = b.relativePath.endsWith('index.md') || b.relativePath.endsWith('README.md');
      if (aIsIndex && !bIsIndex) return -1;
      if (!aIsIndex && bIsIndex) return 1;

      if (a.order !== b.order) return a.order - b.order;
      return a.title.localeCompare(b.title);
    });
  }

  groups.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.title.localeCompare(b.title);
  });

  const sidebar = [];

  if (rootPages.length > 0) {
    sidebar.push({
      title: null, // No header for root items
      items: rootPages
    });
  }

  for (const group of groups) {
    sidebar.push({
      title: group.title,
      key: group.key,
      items: group.items
    });
  }

  return sidebar;
}

/**
 * Flattens the sidebar to calculate sequential Prev / Next links for each page.
 * @param {Array} sidebar 
 * @returns {Map<string, { prev: object|null, next: object|null }>}
 */
export function buildPrevNextMap(sidebar) {
  const flatItems = [];
  for (const group of sidebar) {
    if (group.items) {
      for (const item of group.items) {
        flatItems.push(item);
      }
    }
  }

  const map = new Map();

  for (let i = 0; i < flatItems.length; i++) {
    const current = flatItems[i];
    const prev = i > 0 ? { title: flatItems[i - 1].title, route: flatItems[i - 1].route } : null;
    const next = i < flatItems.length - 1 ? { title: flatItems[i + 1].title, route: flatItems[i + 1].route } : null;

    map.set(current.route, { prev, next });
  }

  return map;
}

/**
 * Calculates breadcrumbs for a given route.
 * @param {string} route 
 * @param {Array} pages 
 * @returns {Array<{ title: string, route: string, isCurrent: boolean }>}
 */
export function buildBreadcrumbs(route, pages) {
  if (route === '/') return [];

  const segments = route.split('/').filter(Boolean);
  const crumbs = [];
  let currentPath = '';

  for (let i = 0; i < segments.length; i++) {
    currentPath += '/' + segments[i];
    const matchingPage = pages.find(p => p.route === currentPath);
    const title = matchingPage ? matchingPage.title : formatSegmentName(segments[i]);

    crumbs.push({
      title,
      route: currentPath,
      isCurrent: i === segments.length - 1
    });
  }

  return crumbs;
}
