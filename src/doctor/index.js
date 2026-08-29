import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { scanMarkdownFiles } from '../scanner/index.js';
import { parseMarkdown } from '../markdown/parser.js';
import { filePathToRoute, deriveTitle } from '../routes/tree.js';
import { buildSidebar } from '../routes/navigation.js';
import { CacheManager } from '../cache/index.js';
import { hashString } from '../cache/hasher.js';
import { validateAccessibility } from './a11y.js';

export class Doctor {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.cache = new CacheManager(config.cacheDir);
  }

  async diagnose(options = {}) {
    const fileEntries = scanMarkdownFiles(this.config.docsDir);
    const pages = [];
    const routeMap = new Map();
    const errors = [];
    const warnings = [];
    const passes = [];

    let totalLinks = 0;
    let totalImages = 0;

    // 1. Scan and parse all pages
    for (const entry of fileEntries) {
      const rawContent = fs.readFileSync(entry.fullPath, 'utf-8');
      const sourceHash = hashString(rawContent);

      let parsed = null;
      if (this.cache.isFresh(entry.relativePath, sourceHash)) {
        parsed = this.cache.getPageArtifact(entry.relativePath);
      }
      if (!parsed) {
        parsed = parseMarkdown(rawContent, { relativePath: entry.relativePath });
      }

      const route = parsed.route || filePathToRoute(entry.relativePath);
      const title = parsed.title || deriveTitle(entry.relativePath, parsed.frontmatter, parsed.headings);

      // Check route collisions
      if (routeMap.has(route)) {
        errors.push({
          type: 'Route Conflict',
          message: `Both "${routeMap.get(route)}" and "${entry.relativePath}" generate route: ${pc.cyan(route)}`,
          action: 'Rename one file or override its route.'
        });
      } else {
        routeMap.set(route, entry.relativePath);
      }

      // Check missing title
      if (!parsed.frontmatter?.title && (!parsed.headings.length || parsed.headings[0].level !== 1)) {
        warnings.push({
          type: 'Missing Title',
          message: `${entry.relativePath}: Page lacks explicit title or top-level <h1> heading.`
        });
      }

      // Check missing description
      if (!parsed.frontmatter?.description) {
        warnings.push({
          type: 'Missing Description',
          message: `${entry.relativePath}: Missing SEO description in frontmatter.`
        });
      }

      // Check duplicate heading IDs within same page
      const seenHeadings = new Set();
      for (const h of parsed.headings) {
        if (seenHeadings.has(h.id)) {
          warnings.push({
            type: 'Duplicate Heading ID',
            message: `${entry.relativePath}: Duplicate heading ID "#${h.id}" for "${h.title}".`
          });
        }
        seenHeadings.add(h.id);
      }

      pages.push({
        relativePath: entry.relativePath,
        fullPath: entry.fullPath,
        route,
        title,
        frontmatter: parsed.frontmatter,
        headings: parsed.headings,
        rawContent,
        html: parsed.html
      });
    }

    // 2. Validate internal links & image references (including auto-generated category hubs)
    const validRoutes = new Set(pages.map(p => p.route));
    for (const page of pages) {
      const segments = page.route.split('/').filter(Boolean);
      let parentPath = '';
      for (let i = 0; i < segments.length - 1; i++) {
        parentPath += '/' + segments[i];
        validRoutes.add(parentPath);
      }
    }

    const pageHeadingMap = new Map();
    for (const page of pages) {
      pageHeadingMap.set(page.route, new Set(page.headings.map(h => h.id)));
    }

    const linkRegex = /<a\s+[^>]*href="([^"]+)"[^>]*>/gi;
    const imgRegex = /<img\s+[^>]*src="([^"]+)"[^>]*>/gi;

    for (const page of pages) {
      let match;

      // Check Links
      while ((match = linkRegex.exec(page.html)) !== null) {
        const href = match[1];
        if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:') || href.startsWith('tel:')) {
          continue; // External link
        }

        totalLinks++;
        const [targetPath, hash] = href.split('#');
        const resolvedPath = targetPath === '' ? page.route : targetPath;

        if (targetPath !== '' && !validRoutes.has(targetPath)) {
          errors.push({
            type: 'Broken Internal Link',
            message: `${page.relativePath} → ${pc.red(href)} (Target route not found)`
          });
        } else if (hash) {
          const targetHeadings = pageHeadingMap.get(resolvedPath);
          if (targetHeadings && !targetHeadings.has(hash)) {
            warnings.push({
              type: 'Broken Anchor Link',
              message: `${page.relativePath} → ${pc.yellow(href)} (Heading #${hash} not found in ${resolvedPath})`
            });
          }
        }
      }

      // Check Images
      while ((match = imgRegex.exec(page.html)) !== null) {
        const fullImgTag = match[0];
        const src = match[1];

        // Check missing alt
        if (!/alt="[^"]+"/i.test(fullImgTag)) {
          warnings.push({
            type: 'Missing Image Alt',
            message: `${page.relativePath}: Image tag missing descriptive alt text: ${pc.yellow(src)}`
          });
        }

        if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
          continue;
        }

        totalImages++;
        let diskPath = null;
        if (src.startsWith('/')) {
          diskPath = path.join(this.config.rootDir, 'public', src);
          if (!fs.existsSync(diskPath)) {
            diskPath = path.join(this.config.docsDir, src);
          }
        } else if (page.fullPath) {
          diskPath = path.resolve(path.dirname(page.fullPath), src);
        }

        if (diskPath && !fs.existsSync(diskPath)) {
          errors.push({
            type: 'Missing Image',
            message: `${page.relativePath} references missing image: ${pc.red(src)}`
          });
        }
      }

      // Check Embeds & Iframes
      const iframeRegex = /<iframe\s+[^>]*src="([^"]+)"[^>]*>/gi;
      let iframeMatch;
      while ((iframeMatch = iframeRegex.exec(page.html)) !== null) {
        const iframeTag = iframeMatch[0];
        const iframeSrc = iframeMatch[1];

        if (!/title="[^"]+"/i.test(iframeTag)) {
          warnings.push({
            type: 'Missing Iframe Title',
            message: `${page.relativePath}: Embed iframe missing accessibility title for: ${pc.yellow(iframeSrc)}`
          });
        }
      }

      // Check if page contains blocked embed warning messages
      if (page.html.includes('Blocked embed domain:')) {
        const blockedMatch = page.html.match(/Blocked embed domain:\s*<code>([^<]+)<\/code>/);
        const domain = blockedMatch ? blockedMatch[1] : 'unknown';
        errors.push({
          type: 'Blocked Embed Domain',
          message: `${page.relativePath}: Embed domain "${pc.red(domain)}" is not in config.embeds.allowedDomains.`
        });
      }

      // Check duplicate tab labels in same tab container
      const tabContainers = page.html.match(/<div class="[^"]*docboot-tabs[^"]*"[\s\S]*?<\/div>\s*<\/div>/g) || [];
      for (const tabHtml of tabContainers) {
        const tabLabels = (tabHtml.match(/data-tab-label="([^"]+)"/g) || []).map(m => m.replace(/data-tab-label="|"$/g, ''));
        const seenLabels = new Set();
        for (const label of tabLabels) {
          if (seenLabels.has(label.toLowerCase())) {
            warnings.push({
              type: 'Duplicate Tab Name',
              message: `${page.relativePath}: Tab group contains duplicate tab label: ${pc.yellow(label)}`
            });
          }
          seenLabels.add(label.toLowerCase());
        }
      }
    }

    // 3. Check for orphan pages
    const sidebar = buildSidebar(pages, this.config.sidebar);
    const sidebarRoutes = new Set();
    for (const group of sidebar) {
      if (group.items) {
        for (const item of group.items) {
          sidebarRoutes.add(item.route);
        }
      }
    }

    for (const page of pages) {
      if (!page.frontmatter?.draft && !sidebarRoutes.has(page.route)) {
        warnings.push({
          type: 'Orphan Page',
          message: `"${page.relativePath}" (${page.route}) is not reachable from the sidebar navigation.`
        });
      }
    }

    // Pass items
    if (pages.length > 0) passes.push(`${pages.length} documentation pages discovered & parsed`);
    if (totalLinks > 0 && errors.filter(e => e.type === 'Broken Internal Link').length === 0) {
      passes.push(`${totalLinks} internal links verified`);
    }
    if (errors.filter(e => e.type === 'Route Conflict').length === 0) {
      passes.push('All routes deterministic and valid');
    }

    // Optional GitHub Pages Diagnostics
    let githubDiagnostics = null;
    if (options.github) {
      const { diagnoseGitHub } = await import('../setup/github/doctor.js');
      githubDiagnostics = diagnoseGitHub(this.config.rootDir, this.config);
      for (const p of githubDiagnostics.passes) passes.push(p);
      for (const w of githubDiagnostics.warnings) {
        warnings.push({ type: 'GitHub Pages', message: w });
      }
      for (const err of githubDiagnostics.errors) {
        errors.push({ type: 'GitHub Pages', message: err });
      }
    }

    // Optional Accessibility (WCAG 2.2 AA) Diagnostics
    if (options.a11y) {
      const a11yResult = validateAccessibility(pages, this.config);
      for (const p of a11yResult.passes) passes.push(p);
      for (const w of a11yResult.warnings) warnings.push(w);
      for (const err of a11yResult.errors) errors.push(err);
    }

    return {
      pagesCount: pages.length,
      totalLinks,
      totalImages,
      passes,
      warnings,
      errors,
      githubDiagnostics
    };
  }
}
