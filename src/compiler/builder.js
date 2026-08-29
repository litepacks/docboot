import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { scanMarkdownFiles } from '../scanner/index.js';
import { parseMarkdown } from '../markdown/parser.js';
import { extractFrontmatter } from '../markdown/frontmatter.js';
import { filePathToRoute, deriveTitle, formatSegmentName } from '../routes/tree.js';
import { buildSidebar, buildPrevNextMap, buildBreadcrumbs } from '../routes/navigation.js';
import { buildSearchIndex } from '../search/indexer.js';
import { renderLayout } from '../renderer/layout.js';
import { generateSitemapAndRobots } from '../renderer/sitemap.js';
import { compileCss } from '../theme/compiler.js';
import { compileClientJs } from '../runtime/compiler.js';
import { CacheManager } from '../cache/index.js';
import { hashString, hashObject } from '../cache/hasher.js';
import { escapeHtml } from '../markdown/highlighter.js';
import { renderNotFoundPage } from '../renderer/not-found.js';
import { withBase } from '../config/index.js';
import { AssetGenerator } from '../assets/generator.js';
import { GitMetadataResolver } from '../metadata/git.js';
import { parseGitHubRemote } from '../setup/github/detect.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SiteBuilder {
  constructor(config, logger = null, options = {}) {
    this.config = config;
    this.logger = logger;
    this.noCache = Boolean(options.noCache || config.noCache);
    this.cache = new CacheManager(config.cacheDir, { disabled: this.noCache });
    this.gitResolver = new GitMetadataResolver(config.rootDir);
  }

  computeConfigHash() {
    return hashObject({
      title: this.config.title,
      description: this.config.description,
      siteUrl: this.config.siteUrl,
      repo: this.config.repo,
      theme: this.config.theme,
      sidebar: this.config.sidebar,
      search: this.config.search,
      embeds: this.config.embeds
    });
  }

  async build({ isDev = false, clean = false } = {}) {
    const startTime = performance.now();

    if (clean) {
      this.cache.clear();
      if (fs.existsSync(this.config.outDir)) {
        fs.rmSync(this.config.outDir, { recursive: true, force: true });
      }
    }

    const configHash = this.computeConfigHash();
    this.cache.setConfigHash(configHash);

    // 1. Scan markdown files
    const fileEntries = scanMarkdownFiles(this.config.docsDir);
    const pages = [];

    if (fileEntries.length === 0) {
      const defaultContent = `# ${this.config.title}\n\nWelcome to your new documentation site powered by **Docboot**.\n\nAdd \`README.md\` or markdown files in \`${path.relative(this.config.rootDir, this.config.docsDir) || '.'}\` to get started!\n\n:::tip\nRun \`docboot . -o\` to preview your documentation in the browser.\n:::`;
      const parsed = parseMarkdown(defaultContent);
      pages.push({
        relativePath: 'README.md',
        fullPath: '',
        rawContent: defaultContent,
        route: '/',
        title: this.config.title,
        frontmatter: parsed.frontmatter,
        toc: parsed.toc,
        headings: parsed.headings,
        plainText: parsed.plainText,
        html: parsed.html,
        internalLinks: parsed.internalLinks,
        externalLinks: parsed.externalLinks,
        referencedAssets: parsed.referencedAssets,
        codeBlockCount: parsed.codeBlockCount,
        wordCount: parsed.wordCount,
        searchEntries: null
      });
    } else {
      const activeRelativePaths = [];

      for (const entry of fileEntries) {
        activeRelativePaths.push(entry.relativePath);
        const rawContent = fs.readFileSync(entry.fullPath, 'utf-8');
        const sourceHash = hashString(rawContent);

        let pageArtifact = null;

        if (!this.noCache && this.cache.isFresh(entry.relativePath, sourceHash, configHash)) {
          pageArtifact = this.cache.getPageArtifact(entry.relativePath);
        }

        if (!pageArtifact) {
          this.cache.recordMiss();
          const { frontmatter, content } = extractFrontmatter(rawContent);
          const contentHash = hashString(content);
          const metadataHash = hashObject(frontmatter);

          const parsed = parseMarkdown(rawContent, { relativePath: entry.relativePath, config: this.config });
          const route = filePathToRoute(entry.relativePath);
          const title = deriveTitle(entry.relativePath, parsed.frontmatter, parsed.headings);

          pageArtifact = {
            relativePath: entry.relativePath,
            route,
            title,
            frontmatter: parsed.frontmatter,
            toc: parsed.toc,
            headings: parsed.headings,
            html: parsed.html,
            plainText: parsed.plainText,
            internalLinks: parsed.internalLinks,
            externalLinks: parsed.externalLinks,
            referencedAssets: parsed.referencedAssets,
            codeBlockCount: parsed.codeBlockCount,
            wordCount: parsed.wordCount,
            searchEntries: null
          };

          this.cache.setPageArtifact(entry.relativePath, pageArtifact, {
            sourceHash,
            contentHash,
            metadataHash,
            mtimeMs: entry.mtimeMs,
            size: entry.size
          });
        }

        pages.push({
          ...pageArtifact,
          fullPath: entry.fullPath,
          rawContent
        });
      }

      // Prune deleted files from cache
      this.cache.pruneDeleted(activeRelativePaths);
    }

    // 1.5 Auto-generate missing category / directory hub pages (e.g. /concepts, /guide)
    const existingRoutes = new Set(pages.map(p => p.route));
    const categoryGroups = new Map();

    for (const page of pages) {
      if (page.route === '/' || page.frontmatter?.draft) continue;

      const segments = page.route.split('/').filter(Boolean);
      if (segments.length > 1) {
        let parentPath = '';
        for (let i = 0; i < segments.length - 1; i++) {
          parentPath += '/' + segments[i];
          if (!categoryGroups.has(parentPath)) {
            categoryGroups.set(parentPath, {
              route: parentPath,
              segment: segments[i],
              children: []
            });
          }
          categoryGroups.get(parentPath).children.push(page);
        }
      }
    }

    for (const [catRoute, catData] of categoryGroups.entries()) {
      if (!existingRoutes.has(catRoute)) {
        const catTitle = formatSegmentName(catData.segment);
        const uniqueChildren = Array.from(new Set(catData.children));

        uniqueChildren.sort((a, b) => {
          const orderA = a.frontmatter?.order ?? 999;
          const orderB = b.frontmatter?.order ?? 999;
          if (orderA !== orderB) return orderA - orderB;
          return a.title.localeCompare(b.title);
        });

        let hubCardsHtml = `
<div class="not-prose my-8">
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
`;

        for (const child of uniqueChildren) {
          const desc = child.frontmatter?.description || (child.plainText ? child.plainText.slice(0, 140).replace(/^[#\s]+/, '').trim() + '...' : '');
          hubCardsHtml += `
    <a href="${child.route}" class="group relative flex flex-col p-5 rounded-2xl border border-border/80 bg-card-bg/60 hover:bg-card-bg hover:border-accent/40 shadow-sm hover:shadow-md transition-all">
      <div class="flex items-center justify-between">
        <h3 class="text-base font-semibold text-foreground group-hover:text-accent transition-colors flex items-center gap-2">
          ${escapeHtml(child.title)}
        </h3>
        <svg class="w-4 h-4 text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
        </svg>
      </div>
      ${desc ? `<p class="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">${escapeHtml(desc)}</p>` : ''}
    </a>
`;
        }

        hubCardsHtml += `
  </div>
</div>
`;

        const generatedMarkdown = `# ${catTitle}\n\nExplore all topics and documentation guides under **${catTitle}**.\n\n${hubCardsHtml}`;

        const syntheticPage = {
          relativePath: catRoute.slice(1) + '/README.md',
          fullPath: '',
          rawContent: generatedMarkdown,
          route: catRoute,
          title: catTitle,
          frontmatter: {
            title: catTitle,
            description: `Explore all topics and documentation guides under ${catTitle}.`,
            isCategoryHub: true
          },
          toc: [],
          headings: [{ level: 1, title: catTitle, id: catTitle.toLowerCase().replace(/\s+/g, '-') }],
          plainText: `${catTitle}. Explore all topics under ${catTitle}. ` + uniqueChildren.map(c => c.title).join(' '),
          html: `<h1>${escapeHtml(catTitle)}</h1><p class="lead text-base text-muted-foreground mt-2 mb-6">Explore all topics and documentation guides under <strong class="text-foreground font-medium">${escapeHtml(catTitle)}</strong>.</p>${hubCardsHtml}`,
          internalLinks: [],
          externalLinks: [],
          referencedAssets: [],
          codeBlockCount: 0,
          wordCount: 30,
          searchEntries: null
        };

        pages.push(syntheticPage);
        existingRoutes.add(catRoute);
      }
    }

    // 2. Build Sidebar & Navigation maps
    const sidebar = buildSidebar(pages, this.config.sidebar);
    const prevNextMap = buildPrevNextMap(sidebar);

    // 3. Search index & search asset setup (reuses cached search entries)
    const { index: searchIndex, hash, filename: searchFilename } = buildSearchIndex(pages);
    const searchJsonPayload = JSON.stringify(searchIndex, null, isDev ? 2 : 0);
    const searchIndexUrl = withBase(`/assets/${searchFilename}`, this.config.base);

    // 3.5 Resolve Git provenance, Edit links, and Package Metadata
    let pkgLicense = null;
    try {
      const pkgPath = path.join(this.config.rootDir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkgData = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        pkgLicense = pkgData.license || null;
      }
    } catch {}

    const remoteUrl = this.config.repo || this.gitResolver.remote;
    const parsedGh = remoteUrl ? parseGitHubRemote(remoteUrl) : null;
    const branch = this.config.branch || this.gitResolver.branch || 'main';

    for (const page of pages) {
      const repoRelPath = page.fullPath
        ? path.relative(this.config.rootDir, page.fullPath).replace(/\\/g, '/')
        : (page.relativePath || '').replace(/\\/g, '/');

      const gitMeta = this.gitResolver.resolveFile(page.fullPath, repoRelPath);

      page.git = {
        createdAt: page.frontmatter?.created || page.frontmatter?.createdAt || gitMeta.createdAt || null,
        updatedAt: page.frontmatter?.updated || page.frontmatter?.updatedAt || gitMeta.updatedAt || null,
        commit: gitMeta.commit || null,
        fullCommit: gitMeta.fullCommit || null
      };

      // Resolve edit URL
      if (page.frontmatter?.editLink === false || page.frontmatter?.editUrl === false) {
        page.editUrl = null;
      } else if (this.config.editLink?.pattern) {
        page.editUrl = this.config.editLink.pattern
          .replace(':path', (page.relativePath || '').replace(/^\/+/, ''))
          .replace(':repo', this.config.repo || '');
      } else if (parsedGh?.owner && parsedGh?.repository) {
        page.editUrl = `https://github.com/${parsedGh.owner}/${parsedGh.repository}/edit/${branch}/${repoRelPath.replace(/^\/+/, '')}`;
      } else {
        page.editUrl = null;
      }

      // Resolve source URL
      if (this.config.sourceLink?.pattern && page.frontmatter?.sourceLink !== false) {
        page.sourceUrl = this.config.sourceLink.pattern
          .replace(':path', (page.relativePath || '').replace(/^\/+/, ''))
          .replace(':repo', this.config.repo || '');
      } else {
        page.sourceUrl = null;
      }
    }

    // 4. Pre-render all HTML pages
    const renderedPages = [];
    const htmlContentsForTailwind = [];

    for (const page of pages) {
      if (page.frontmatter?.draft) continue;

      const breadcrumbs = buildBreadcrumbs(page.route, pages);
      const prevNext = prevNextMap.get(page.route) || { prev: null, next: null };

      const fullHtml = renderLayout({
        page,
        pages,
        sidebar,
        prevNext,
        breadcrumbs,
        config: this.config,
        searchIndexUrl,
        isDev,
        license: pkgLicense,
        commit: this.gitResolver.isGit ? Array.from(this.gitResolver.cache.values())[0]?.commit : null
      });

      renderedPages.push({
        page,
        fullHtml
      });

      htmlContentsForTailwind.push(fullHtml);
    }

    // 4.5 Pre-render modern 404 Not Found page
    const notFoundHtml = renderNotFoundPage({
      pages,
      sidebar,
      config: this.config,
      searchIndexUrl,
      isDev
    });
    htmlContentsForTailwind.push(notFoundHtml);

    // 5. Compile Tailwind CSS with all rendered HTML content and source JS files
    const compiledCss = await compileCss(htmlContentsForTailwind);

    // 6. Ensure output directories exist
    const assetsDir = path.join(this.config.outDir, 'assets');
    fs.mkdirSync(assetsDir, { recursive: true });

    // Write compiled CSS
    fs.writeFileSync(path.join(assetsDir, 'docs.css'), compiledCss, 'utf-8');

    // Compile and write Client JS (minified in production, unminified in dev)
    const compiledJs = await compileClientJs({ minify: !isDev });
    fs.writeFileSync(path.join(assetsDir, 'docs.js'), compiledJs, 'utf-8');

    // Copy Search Runtime
    const searchRuntimePath = path.resolve(__dirname, '../runtime/assets/search-runtime.js');
    if (fs.existsSync(searchRuntimePath)) {
      fs.copyFileSync(searchRuntimePath, path.join(assetsDir, 'search-runtime.js'));
    }

    // Copy Mermaid Runtime (for offline diagram rendering)
    const mermaidRuntimePath = path.resolve(__dirname, '../runtime/assets/mermaid.min.js');
    if (fs.existsSync(mermaidRuntimePath)) {
      fs.copyFileSync(mermaidRuntimePath, path.join(assetsDir, 'mermaid.min.js'));
    }

    // Write search index files
    fs.writeFileSync(path.join(assetsDir, searchFilename), searchJsonPayload, 'utf-8');
    fs.writeFileSync(path.join(assetsDir, 'search-index.json'), searchJsonPayload, 'utf-8');
    fs.writeFileSync(path.join(this.config.outDir, 'search.json'), searchJsonPayload, 'utf-8');

    // Generate PWA assets if enabled
    if (this.config.pwa) {
      const generator = new AssetGenerator(this.config, this.logger);
      await generator.generate('pwa');
    }

    // Copy Public Directory Assets (e.g. favicon.svg, manifest, sw.js, images)
    const publicDir = path.join(this.config.rootDir, 'public');
    if (fs.existsSync(publicDir)) {
      copyDirectoryRecursive(publicDir, this.config.outDir);
    }

    // 7. Write all pre-rendered HTML files
    for (const { page, fullHtml } of renderedPages) {
      let outFilePath;

      if (page.route === '/') {
        outFilePath = path.join(this.config.outDir, 'index.html');
      } else {
        const cleanRoute = page.route.replace(/^\/+/, '');
        const targetDir = path.join(this.config.outDir, cleanRoute);
        fs.mkdirSync(targetDir, { recursive: true });
        outFilePath = path.join(targetDir, 'index.html');
      }

      fs.writeFileSync(outFilePath, fullHtml, 'utf-8');
    }

    // Write 404.html to output root
    fs.writeFileSync(path.join(this.config.outDir, '404.html'), notFoundHtml, 'utf-8');

    // 8. Generate SEO & GitHub Pages Files (.nojekyll, sitemap.xml, robots.txt, CNAME)
    fs.writeFileSync(path.join(this.config.outDir, '.nojekyll'), '', 'utf-8');
    const { sitemap, robots } = generateSitemapAndRobots(pages, this.config);
    fs.writeFileSync(path.join(this.config.outDir, 'sitemap.xml'), sitemap, 'utf-8');
    fs.writeFileSync(path.join(this.config.outDir, 'robots.txt'), robots, 'utf-8');

    const customDomain = this.config.github?.customDomain || this.config.customDomain;
    if (customDomain) {
      fs.writeFileSync(path.join(this.config.outDir, 'CNAME'), customDomain.trim(), 'utf-8');
    }

    // 9. Pre-compress static assets (.gz & .br) for production
    if (!isDev) {
      compressStaticFiles(this.config.outDir);
    }

    // Save incremental cache
    this.cache.save();

    const elapsedMs = Math.round(performance.now() - startTime);
    const cacheMetrics = this.cache.getMetrics();

    return {
      pageCount: renderedPages.length,
      elapsedMs,
      outDir: this.config.outDir,
      cacheMetrics
    };
  }
}

function compressStaticFiles(dir) {
  if (!fs.existsSync(dir)) return;
  const compressibleExts = new Set(['.html', '.css', '.js', '.json', '.svg', '.xml', '.txt']);

  function walk(currentDir) {
    if (!fs.existsSync(currentDir)) return;
    let entries = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (_) {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (compressibleExts.has(ext) && !entry.name.endsWith('.gz') && !entry.name.endsWith('.br')) {
          try {
            const buffer = fs.readFileSync(fullPath);
            fs.writeFileSync(fullPath + '.gz', zlib.gzipSync(buffer, { level: 6 }));
            fs.writeFileSync(fullPath + '.br', zlib.brotliCompressSync(buffer, {
              params: {
                [zlib.constants.BROTLI_PARAM_QUALITY]: 4
              }
            }));
          } catch (_) {}
        }
      }
    }
  }

  walk(dir);
}

function copyDirectoryRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
