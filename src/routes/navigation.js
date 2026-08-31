import path from 'node:path';
import { formatSegmentName, extractNumericOrder, stripNumericPrefix, normalizeDocRelativePath } from './tree.js';

export const DEFAULT_GROUP_ORDER = {
  'getting-started': 10,
  'start': 10,
  'intro': 10,
  'introduction': 10,
  'quick-start': 12,
  'quickstart': 12,
  'installation': 15,
  'install': 15,
  'tutorial': 20,
  'tutorials': 20,
  'guide': 25,
  'guides': 25,
  'concept': 30,
  'concepts': 30,
  'core': 30,
  'core-concepts': 30,
  'features': 35,
  'components': 40,
  'component': 40,
  'actions': 45,
  'plugins': 50,
  'tooling': 55,
  'tools': 55,
  'examples': 60,
  'advanced': 70,
  'architecture': 75,
  'reference': 80,
  'api': 85,
  'config': 90,
  'configuration': 90,
  'changelog': 95,
  'faq': 99
};

/**
 * Builds hierarchical sidebar navigation tree from routes list.
 * 
 * @param {Array<object>} pages Array of page objects { route, title, order, relativePath, frontmatter, ... }
 * @param {object|Array} customSidebar Optional manual sidebar configuration from config
 * @param {object} options Optional settings { metaMap, stripDocsPrefix, collapsible, collapsed, collapseDepth, mode, groups }
 * @returns {Array<object>} Sidebar groups & links
 */
export function buildSidebar(pages, customSidebar = null, options = {}) {
  // If customSidebar is an explicit array, return it directly
  if (customSidebar && Array.isArray(customSidebar)) {
    return customSidebar;
  }

  const sidebarConfig = typeof customSidebar === 'object' && customSidebar !== null ? customSidebar : {};
  const metaMap = options.metaMap || sidebarConfig.metaMap || new Map();
  const stripDocsPrefix = sidebarConfig.stripDocsPrefix !== undefined ? sidebarConfig.stripDocsPrefix : (options.stripDocsPrefix ?? true);
  const collapsible = sidebarConfig.collapsible !== undefined ? sidebarConfig.collapsible : (options.collapsible ?? true);
  const defaultCollapsed = sidebarConfig.collapsed !== undefined ? sidebarConfig.collapsed : (options.collapsed ?? false);
  const collapseDepth = sidebarConfig.collapseDepth ?? options.collapseDepth ?? 2;
  const groupsConfig = sidebarConfig.groups || options.groups || {};
  const rootTitle = sidebarConfig.rootTitle !== undefined ? sidebarConfig.rootTitle : (options.rootTitle || null);

  const useHeuristics = sidebarConfig.useHeuristics !== undefined
    ? Boolean(sidebarConfig.useHeuristics)
    : (sidebarConfig.sort !== 'natural' && sidebarConfig.sort !== 'alphabetical' && options.sort !== 'natural' && options.sort !== 'alphabetical');

  const groupOrderMap = {
    ...(useHeuristics ? DEFAULT_GROUP_ORDER : {}),
    ...(options.defaultGroupOrder || {}),
    ...(sidebarConfig.defaultGroupOrder || {})
  };

  // Filter out drafts and hidden pages
  const activePages = pages.filter(p => !p.frontmatter?.draft && !p.frontmatter?.hidden);
  if (activePages.length === 0) return [];

  // Detect common container prefix like "docs/" or "doc/" if present
  let stripPrefix = '';
  if (stripDocsPrefix) {
    const nonRootPaths = activePages
      .map(p => p.relativePath.replace(/\\/g, '/'))
      .filter(p => p !== 'README.md' && p !== 'index.md' && p !== '');

    if (nonRootPaths.length > 0) {
      if (nonRootPaths.every(p => p.startsWith('docs/'))) {
        stripPrefix = 'docs/';
      } else if (nonRootPaths.every(p => p.startsWith('doc/'))) {
        stripPrefix = 'doc/';
      }
    }
  }

  // 1. Separate root pages vs directory pages
  const rootPages = [];
  const dirPages = [];

  for (const page of activePages) {
    const rawRel = page.relativePath.replace(/\\/g, '/');
    const normalizedRel = normalizeDocRelativePath(rawRel, stripPrefix);
    const dir = path.dirname(normalizedRel);

    if (dir === '.' || dir === '') {
      const baseName = path.basename(normalizedRel);
      const fileNumericOrder = extractNumericOrder(baseName);
      const inferredOrder = page.frontmatter?.order ?? fileNumericOrder ?? (page.route === '/' ? 0 : 999);

      rootPages.push({
        title: page.frontmatter?.sidebarTitle || page.frontmatter?.menuTitle || page.title,
        route: page.route,
        order: inferredOrder,
        badge: page.frontmatter?.badge || null,
        relativePath: page.relativePath
      });
    } else {
      dirPages.push({
        ...page,
        normalizedRel,
        dir
      });
    }
  }

  // 2. Build recursive directory tree
  // rootTreeNode will hold top-level groups
  const treeRoot = { items: new Map() };

  function getOrCreateDirectoryNode(parentMap, dirSegment, fullDirRelPath, currentDepth) {
    const cleanKey = stripNumericPrefix(dirSegment).toLowerCase();
    const rawKey = dirSegment;
    const groupOverride = groupsConfig[cleanKey] || groupsConfig[dirSegment] || {};

    if (!parentMap.has(cleanKey)) {
      const segNumericOrder = extractNumericOrder(rawKey);
      const defaultOrder = groupOrderMap[cleanKey] ?? 999;
      const groupTitle = groupOverride.title || formatSegmentName(cleanKey);
      const groupOrder = groupOverride.order ?? segNumericOrder ?? defaultOrder;
      const isCollapsed = groupOverride.collapsed !== undefined
        ? groupOverride.collapsed
        : (currentDepth >= collapseDepth ? true : defaultCollapsed);
      const isCollapsible = groupOverride.collapsible !== undefined ? groupOverride.collapsible : collapsible;

      parentMap.set(cleanKey, {
        isGroup: true,
        title: groupTitle,
        key: cleanKey,
        rawKey,
        fullDirRelPath,
        order: groupOrder,
        route: null,
        badge: groupOverride.badge || null,
        collapsible: isCollapsible,
        collapsed: isCollapsed,
        items: new Map(),
        leafItems: []
      });
    }

    return parentMap.get(cleanKey);
  }

  for (const page of dirPages) {
    const dirSegments = page.dir.split('/').filter(Boolean);
    let currentMap = treeRoot.items;
    let currentPath = '';
    let targetGroup = null;

    for (let depth = 0; depth < dirSegments.length; depth++) {
      const seg = dirSegments[depth];
      currentPath = currentPath ? `${currentPath}/${seg}` : seg;
      targetGroup = getOrCreateDirectoryNode(currentMap, seg, currentPath, depth + 1);
      currentMap = targetGroup.items;
    }

    // Check if this page is index.md / README.md of the directory
    const baseName = path.basename(page.normalizedRel);
    const cleanBaseName = stripNumericPrefix(path.basename(page.normalizedRel, path.extname(page.normalizedRel))).toLowerCase();
    const isIndex = cleanBaseName === 'index' || cleanBaseName === 'readme';
    const fileNumericOrder = extractNumericOrder(baseName);
    const itemTitle = page.frontmatter?.sidebarTitle || page.frontmatter?.menuTitle || page.title;
    const itemOrder = page.frontmatter?.order ?? fileNumericOrder ?? 999;

    // Apply directory _meta.json overrides if present
    const dirMeta = metaMap.get(page.dir) || metaMap.get(targetGroup.fullDirRelPath) || {};
    const metaKey = path.basename(page.normalizedRel, path.extname(page.normalizedRel));
    const rawMetaKey = stripNumericPrefix(metaKey);
    const itemMeta = dirMeta[metaKey] || dirMeta[rawMetaKey] || dirMeta[baseName] || null;

    if (itemMeta === false || (typeof itemMeta === 'object' && itemMeta?.hidden)) {
      // Hidden via _meta.json
      continue;
    }

    let finalTitle = itemTitle;
    let finalOrder = itemOrder;
    let finalBadge = page.frontmatter?.badge || null;

    if (typeof itemMeta === 'string') {
      finalTitle = itemMeta;
    } else if (typeof itemMeta === 'object' && itemMeta !== null) {
      if (itemMeta.title) finalTitle = itemMeta.title;
      if (itemMeta.order !== undefined) finalOrder = itemMeta.order;
      if (itemMeta.badge) finalBadge = itemMeta.badge;
    }

    if (page.frontmatter?.groupOrder !== undefined) {
      targetGroup.order = Math.min(targetGroup.order, page.frontmatter.groupOrder);
    }

    if (isIndex) {
      targetGroup.route = page.route;
      // If the index page has a custom title or description distinct from group name, or explicit order
      const titleMatchesGroup = finalTitle.toLowerCase() === targetGroup.title.toLowerCase() || finalTitle.toLowerCase() === 'overview';
      if (page.frontmatter?.sidebarTitle || page.frontmatter?.showInSidebar || (!titleMatchesGroup && !page.frontmatter?.isCategoryHub)) {
        targetGroup.leafItems.push({
          title: finalTitle,
          route: page.route,
          order: page.frontmatter?.order ?? -1,
          badge: finalBadge,
          relativePath: page.relativePath
        });
      }
    } else {
      targetGroup.leafItems.push({
        title: finalTitle,
        route: page.route,
        order: finalOrder,
        badge: finalBadge,
        relativePath: page.relativePath
      });
    }
  }

  // 3. Recursive tree transformer & sorter
  function transformAndSortTree(nodeMap, dirRelPath = '') {
    const dirMeta = metaMap.get(dirRelPath) || {};
    const metaKeys = Object.keys(dirMeta);

    const result = [];

    for (const group of nodeMap.values()) {
      // Recursively transform sub-directories
      const childSubGroups = transformAndSortTree(group.items, group.fullDirRelPath);

      // Sort leaf items
      group.leafItems.sort((a, b) => {
        const aBase = path.basename(a.relativePath, path.extname(a.relativePath));
        const bBase = path.basename(b.relativePath, path.extname(b.relativePath));

        // Check _meta.json key ordering first
        const aMetaIdx = metaKeys.indexOf(aBase) !== -1 ? metaKeys.indexOf(aBase) : metaKeys.indexOf(stripNumericPrefix(aBase));
        const bMetaIdx = metaKeys.indexOf(bBase) !== -1 ? metaKeys.indexOf(bBase) : metaKeys.indexOf(stripNumericPrefix(bBase));

        if (aMetaIdx !== -1 && bMetaIdx !== -1) return aMetaIdx - bMetaIdx;
        if (aMetaIdx !== -1) return -1;
        if (bMetaIdx !== -1) return 1;

        if (a.order !== b.order) return a.order - b.order;
        return a.title.localeCompare(b.title);
      });

      // Combine leaf items and sub-groups
      const combinedChildren = [...group.leafItems, ...childSubGroups];

      // Sort combined children
      combinedChildren.sort((a, b) => {
        const orderA = a.order ?? 999;
        const orderB = b.order ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.title.localeCompare(b.title);
      });

      result.push({
        title: group.title,
        key: group.key,
        route: group.route,
        order: group.order,
        collapsible: group.collapsible,
        collapsed: group.collapsed,
        badge: group.badge,
        items: combinedChildren
      });
    }

    // Sort top-level groups at this depth
    result.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.title.localeCompare(b.title);
    });

    return result;
  }

  const topLevelGroups = transformAndSortTree(treeRoot.items, '');

  // 4. Sort root pages
  rootPages.sort((a, b) => {
    if (a.route === '/') return -1;
    if (b.route === '/') return 1;
    if (a.order !== b.order) return a.order - b.order;
    return a.title.localeCompare(b.title);
  });

  const sidebar = [];

  if (rootPages.length > 0) {
    sidebar.push({
      title: rootTitle, // null by default (no heading for top-level root items)
      collapsible: false,
      items: rootPages
    });
  }

  for (const group of topLevelGroups) {
    sidebar.push(group);
  }

  return sidebar;
}

/**
 * Flattens the hierarchical sidebar to calculate sequential Prev / Next links for each page.
 * @param {Array} sidebar 
 * @returns {Map<string, { prev: object|null, next: object|null }>}
 */
export function buildPrevNextMap(sidebar) {
  const flatItems = [];

  function collectItems(items) {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (item.route) {
        flatItems.push({ title: item.title, route: item.route });
      }
      if (item.items && item.items.length > 0) {
        collectItems(item.items);
      }
    }
  }

  for (const group of sidebar) {
    if (group.route && !flatItems.some(i => i.route === group.route)) {
      flatItems.push({ title: group.title, route: group.route });
    }
    if (group.items) {
      collectItems(group.items);
    }
  }

  // De-duplicate flatItems by route while preserving order
  const uniqueItems = [];
  const seenRoutes = new Set();
  for (const it of flatItems) {
    if (it.route && !seenRoutes.has(it.route)) {
      seenRoutes.add(it.route);
      uniqueItems.push(it);
    }
  }

  const map = new Map();

  for (let i = 0; i < uniqueItems.length; i++) {
    const current = uniqueItems[i];
    const prev = i > 0 ? { title: uniqueItems[i - 1].title, route: uniqueItems[i - 1].route } : null;
    const next = i < uniqueItems.length - 1 ? { title: uniqueItems[i + 1].title, route: uniqueItems[i + 1].route } : null;

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
  if (route === '/' || !route) return [];

  const segments = route.split('/').filter(Boolean);
  const crumbs = [];
  let currentPath = '';

  for (let i = 0; i < segments.length; i++) {
    currentPath += '/' + segments[i];
    const matchingPage = pages.find(p => p.route === currentPath);
    const title = matchingPage ? (matchingPage.frontmatter?.sidebarTitle || matchingPage.frontmatter?.menuTitle || matchingPage.title) : formatSegmentName(segments[i]);

    crumbs.push({
      title,
      route: currentPath,
      isCurrent: i === segments.length - 1
    });
  }

  return crumbs;
}

