import fs from 'node:fs';
import path from 'node:path';
import { SiteBuilder } from '../compiler/builder.js';

export class StatsCollector {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
  }

  async collect() {
    const startTime = performance.now();

    // 1. Build site once with SiteBuilder (leverages incremental cache)
    const builder = new SiteBuilder(this.config, this.logger);
    const buildResult = await builder.build({ isDev: false });
    const buildElapsedMs = Math.round(performance.now() - startTime);

    // 2. Extract stats from builder's cache / outDir
    let totalWords = 0;
    let totalHeadings = 0;
    let totalCodeBlocks = 0;
    let totalInternalLinks = 0;
    let totalImages = 0;
    let pageCount = 0;

    const manifestFiles = builder.cache.manifest.files;
    for (const [relPath, entry] of Object.entries(manifestFiles)) {
      const artifact = builder.cache.getPageArtifact(relPath);
      if (!artifact) continue;
      pageCount++;

      // Words
      totalWords += artifact.wordCount || (artifact.plainText || '').trim().split(/\s+/).filter(Boolean).length;

      // Headings
      totalHeadings += (artifact.headings || []).length;

      // Code blocks
      totalCodeBlocks += artifact.codeBlockCount || 0;

      // Links & Images
      totalInternalLinks += (artifact.internalLinks || []).length;
      totalImages += (artifact.referencedAssets || []).length;
    }

    const assetsDir = path.join(this.config.outDir, 'assets');
    let cssSize = 0;
    let jsSize = 0;
    let searchIndexSize = 0;

    if (fs.existsSync(assetsDir)) {
      const files = fs.readdirSync(assetsDir);
      for (const f of files) {
        const fp = path.join(assetsDir, f);
        const stat = fs.statSync(fp);
        if (f.endsWith('.css')) cssSize += stat.size;
        else if (f.endsWith('.js')) jsSize += stat.size;
        else if (f.startsWith('search-index') && f.endsWith('.json')) searchIndexSize = Math.max(searchIndexSize, stat.size);
      }
    }

    const cacheMetrics = builder.cache.getMetrics();
    const imageStats = buildResult.imageStats || {
      sources: totalImages,
      variants: 0,
      originalBytes: 0,
      optimizedBytes: 0,
      savedBytes: 0,
      savedPercent: 0,
      formats: {}
    };

    const redirectStats = buildResult.redirectStats || {
      canonicalCount: pageCount || buildResult.pageCount,
      aliasCount: 0,
      redirectCount: 0,
      externalCount: 0
    };

    return {
      pageCount: pageCount || buildResult.pageCount,
      totalWords,
      totalHeadings,
      totalCodeBlocks,
      totalInternalLinks,
      totalImages: imageStats.sources || totalImages,
      buildElapsedMs,
      cssSizeKb: (cssSize / 1024).toFixed(1),
      jsSizeKb: (jsSize / 1024).toFixed(1),
      searchIndexSizeKb: (searchIndexSize / 1024).toFixed(1),
      cache: cacheMetrics,
      routes: {
        canonical: redirectStats.canonicalCount || pageCount || buildResult.pageCount,
        aliases: redirectStats.aliasCount || 0,
        redirects: redirectStats.redirectCount || 0,
        external: redirectStats.externalCount || 0
      },
      images: {
        sources: imageStats.sources || totalImages,
        variants: imageStats.variants,
        originalBytes: imageStats.originalBytes,
        optimizedBytes: imageStats.optimizedBytes,
        originalSizeMb: (imageStats.originalBytes / (1024 * 1024)).toFixed(2),
        optimizedSizeMb: (imageStats.optimizedBytes / (1024 * 1024)).toFixed(2),
        savedPercent: imageStats.savedPercent,
        formats: imageStats.formats
      }
    };
  }
}
