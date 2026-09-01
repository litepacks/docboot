import fs from 'node:fs';
import path from 'node:path';
import { inspectImageFile, inspectBuffer } from './inspect.js';
import { processSvgContent } from './svg.js';
import { hashFile, hashString, hashObject } from '../cache/hasher.js';

export const PROCESSOR_VERSION = '1.0.0';

/**
 * Normalizes file name into URL-safe slug preserving extension.
 */
function safeSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Filter and compute candidate widths without upscaling.
 * @param {number} sourceWidth 
 * @param {Array<number>} configuredWidths 
 * @returns {Array<number>}
 */
export function computeTargetWidths(sourceWidth, configuredWidths = [480, 768, 1280, 1920]) {
  if (!sourceWidth || sourceWidth <= 0) {
    return [768];
  }

  const sortedConfigured = Array.from(new Set(configuredWidths))
    .filter(w => typeof w === 'number' && w > 0)
    .sort((a, b) => a - b);

  const smallerWidths = sortedConfigured.filter(w => w < sourceWidth);
  
  // Include exact source width if not already in list
  const widths = [...smallerWidths, sourceWidth];
  return Array.from(new Set(widths)).sort((a, b) => a - b);
}

export class ImageProcessor {
  /**
   * @param {object} config 
   * @param {object} options 
   */
  constructor(config = {}, options = {}) {
    this.config = config;
    this.logger = options.logger || null;
    this.rootDir = config.rootDir || process.cwd();
    this.docsDir = config.docsDir || path.join(this.rootDir, 'docs');
    this.outDir = config.outDir || path.join(this.rootDir, 'dist');
    this.cacheDir = config.cacheDir || path.join(this.rootDir, '.docboot');
    this.imagesCacheDir = path.join(this.cacheDir, 'images');
    this.imageConfig = {
      optimize: true,
      preset: 'docs',
      formats: ['avif', 'webp'],
      widths: [480, 768, 1280, 1920],
      quality: 82,
      lazy: true,
      svg: { minify: true },
      ...(config.images || {})
    };

    // Metrics for stats and doctor
    this.processedRecords = new Map();
    this.sessionStats = {
      sources: 0,
      variants: 0,
      originalBytes: 0,
      optimizedBytes: 0,
      cachedHits: 0,
      optimizedHits: 0,
      formats: {
        avif: 0,
        webp: 0,
        svg: 0,
        gif: 0,
        png: 0,
        jpeg: 0,
        other: 0
      }
    };
  }

  ensureDirs() {
    try {
      fs.mkdirSync(this.imagesCacheDir, { recursive: true });
      const outAssetsDir = path.join(this.outDir, 'assets', 'images');
      fs.mkdirSync(outAssetsDir, { recursive: true });
    } catch (_) {}
  }

  /**
   * Resolves a relative or absolute image path from Markdown source to a local disk path.
   * @param {string} src 
   * @param {string} relativeToMdPath 
   * @returns {{ diskPath: string|null, isRemote: boolean, cleanSrc: string }}
   */
  resolveSource(src, relativeToMdPath = '') {
    if (!src || typeof src !== 'string') {
      return { diskPath: null, isRemote: false, cleanSrc: '' };
    }

    const trimmed = src.trim();
    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('//') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('#')
    ) {
      return { diskPath: null, isRemote: true, cleanSrc: trimmed };
    }

    const cleanSrc = trimmed.split('?')[0].split('#')[0];
    const candidatePaths = [];

    // 1. Relative to Markdown file's directory
    if (relativeToMdPath) {
      const mdAbsDir = path.dirname(path.join(this.docsDir, relativeToMdPath));
      candidatePaths.push(path.resolve(mdAbsDir, cleanSrc));
    }

    // 2. Relative to docsDir
    candidatePaths.push(path.resolve(this.docsDir, cleanSrc.replace(/^\/+/, '')));

    // 3. Relative to public directory
    const publicDir = path.join(this.rootDir, 'public');
    candidatePaths.push(path.resolve(publicDir, cleanSrc.replace(/^\/+/, '')));

    // 4. Relative to rootDir
    candidatePaths.push(path.resolve(this.rootDir, cleanSrc.replace(/^\/+/, '')));

    for (const p of candidatePaths) {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        return { diskPath: p, isRemote: false, cleanSrc };
      }
    }

    return { diskPath: null, isRemote: false, cleanSrc };
  }

  /**
   * Main entry point to process an image and return an optimized imageRecord.
   * @param {string} src 
   * @param {object} options 
   * @returns {Promise<object>} imageRecord
   */
  async process(src, options = {}) {
    const {
      relativePath = '',
      quality = this.imageConfig.quality,
      formats = this.imageConfig.formats,
      widths = this.imageConfig.widths,
      optimize = this.imageConfig.optimize,
      isThumbnail = false
    } = options;

    const { diskPath, isRemote, cleanSrc } = this.resolveSource(src, relativePath);

    // 1. Remote images -> passthrough untouched
    if (isRemote) {
      return {
        src,
        displaySrc: src,
        lightboxSrc: src,
        format: 'remote',
        isRemote: true,
        width: null,
        height: null,
        variants: [],
        optimize: false
      };
    }

    // 2. Missing source file -> graceful record with original src
    if (!diskPath || !fs.existsSync(diskPath)) {
      return {
        src,
        displaySrc: src,
        lightboxSrc: src,
        format: 'unknown',
        exists: false,
        width: null,
        height: null,
        variants: [],
        optimize: false
      };
    }

    // Check duplicate in session cache by diskPath + options hash
    const configHash = hashObject({
      quality,
      formats,
      widths,
      optimize,
      preset: this.imageConfig.preset,
      version: PROCESSOR_VERSION
    });

    const fileContentHash = hashFile(diskPath);
    const sessionKey = `${diskPath}:${fileContentHash}:${configHash}`;

    if (this.processedRecords.has(sessionKey)) {
      this.sessionStats.cachedHits++;
      return this.processedRecords.get(sessionKey);
    }

    this.ensureDirs();
    const metadata = await inspectImageFile(diskPath);
    const parsedPath = path.parse(diskPath);
    const baseName = safeSlug(parsedPath.name) || 'image';
    const outAssetsDir = path.join(this.outDir, 'assets', 'images');

    this.sessionStats.sources++;
    this.sessionStats.originalBytes += metadata.size;

    // 3. SVG Processing
    if (metadata.format === 'svg') {
      const svgRaw = await fs.promises.readFile(diskPath, 'utf-8');
      const minifiedSvg = processSvgContent(svgRaw, { minify: this.imageConfig.svg?.minify !== false });
      const svgFileName = `${baseName}.${fileContentHash.slice(0, 8)}.svg`;
      const svgOutPath = path.join(outAssetsDir, svgFileName);
      const svgCachePath = path.join(this.imagesCacheDir, svgFileName);

      await fs.promises.writeFile(svgCachePath, minifiedSvg, 'utf-8');
      await fs.promises.writeFile(svgOutPath, minifiedSvg, 'utf-8');

      const optimizedSize = Buffer.byteLength(minifiedSvg, 'utf-8');
      this.sessionStats.optimizedBytes += optimizedSize;
      this.sessionStats.formats.svg++;

      const record = {
        src: `/assets/images/${svgFileName}`,
        displaySrc: `/assets/images/${svgFileName}`,
        lightboxSrc: `/assets/images/${svgFileName}`,
        width: metadata.width,
        height: metadata.height,
        format: 'svg',
        isAnimated: false,
        hasAlpha: true,
        variants: [],
        optimize: false,
        originalSize: metadata.size,
        optimizedSize
      };

      this.processedRecords.set(sessionKey, record);
      return record;
    }

    // 4. Animated GIF Processing (preserve animation)
    if (metadata.format === 'gif' && metadata.isAnimated) {
      const gifFileName = `${baseName}.${fileContentHash.slice(0, 8)}.gif`;
      const gifOutPath = path.join(outAssetsDir, gifFileName);
      const gifCachePath = path.join(this.imagesCacheDir, gifFileName);

      await fs.promises.copyFile(diskPath, gifCachePath);
      await fs.promises.copyFile(diskPath, gifOutPath);

      this.sessionStats.optimizedBytes += metadata.size;
      this.sessionStats.formats.gif++;

      const record = {
        src: `/assets/images/${gifFileName}`,
        displaySrc: `/assets/images/${gifFileName}`,
        lightboxSrc: `/assets/images/${gifFileName}`,
        width: metadata.width,
        height: metadata.height,
        format: 'gif',
        isAnimated: true,
        hasAlpha: metadata.hasAlpha,
        variants: [],
        optimize: false,
        originalSize: metadata.size,
        optimizedSize: metadata.size
      };

      this.processedRecords.set(sessionKey, record);
      return record;
    }

    // 5. Explicitly disabled optimization or missing raster dimensions -> Passthrough
    if (optimize === false || this.imageConfig.optimize === false || !metadata.width || !metadata.height) {
      const ext = (parsedPath.ext || '.png').toLowerCase();
      const passFileName = `${baseName}.${fileContentHash.slice(0, 8)}${ext}`;
      const passOutPath = path.join(outAssetsDir, passFileName);
      const passCachePath = path.join(this.imagesCacheDir, passFileName);

      await fs.promises.copyFile(diskPath, passCachePath);
      await fs.promises.copyFile(diskPath, passOutPath);

      this.sessionStats.optimizedBytes += metadata.size;
      const fmt = metadata.format in this.sessionStats.formats ? metadata.format : 'other';
      this.sessionStats.formats[fmt]++;

      const record = {
        src: `/assets/images/${passFileName}`,
        displaySrc: `/assets/images/${passFileName}`,
        lightboxSrc: `/assets/images/${passFileName}`,
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        isAnimated: metadata.isAnimated,
        hasAlpha: metadata.hasAlpha,
        variants: [],
        optimize: false,
        originalSize: metadata.size,
        optimizedSize: metadata.size
      };

      this.processedRecords.set(sessionKey, record);
      return record;
    }

    // 6. Raster Image Optimization (AVIF, WebP, Fallback)
    try {
      const sharpModule = await import('sharp').catch(() => null);
      const sharp = sharpModule?.default || sharpModule;

      if (!sharp) {
        throw new Error('Sharp image processing library is not available');
      }

      const targetWidths = computeTargetWidths(metadata.width, widths);
      const targetFormats = Array.from(new Set([...(formats || ['avif', 'webp']), 'webp']));
      const variants = [];
      let totalVariantsSize = 0;

      const sourceBuffer = await fs.promises.readFile(diskPath);

      for (const fmt of targetFormats) {
        for (const w of targetWidths) {
          const targetHeight = Math.round((w / metadata.width) * metadata.height);
          const variantName = `${baseName}.${fileContentHash.slice(0, 8)}.${w}.${fmt}`;
          const variantCachePath = path.join(this.imagesCacheDir, variantName);
          const variantOutPath = path.join(outAssetsDir, variantName);

          let variantBuffer;
          if (fs.existsSync(variantCachePath)) {
            variantBuffer = await fs.promises.readFile(variantCachePath);
          } else {
            let pipeline = sharp(sourceBuffer).resize(w, targetHeight, {
              withoutEnlargement: true,
              fit: 'inside'
            });

            if (fmt === 'avif') {
              pipeline = pipeline.avif({
                quality: Math.min(quality, 85),
                effort: 4,
                chromaSubsampling: '4:4:4'
              });
            } else if (fmt === 'webp') {
              pipeline = pipeline.webp({
                quality,
                effort: 4
              });
            } else if (fmt === 'png') {
              pipeline = pipeline.png({
                compressionLevel: 8
              });
            } else if (fmt === 'jpeg' || fmt === 'jpg') {
              pipeline = pipeline.jpeg({
                quality,
                mozjpeg: true
              });
            }

            variantBuffer = await pipeline.toBuffer();
            await fs.promises.writeFile(variantCachePath, variantBuffer);
          }

          await fs.promises.writeFile(variantOutPath, variantBuffer);

          const variantSize = variantBuffer.length;
          totalVariantsSize += variantSize;

          variants.push({
            width: w,
            height: targetHeight,
            format: fmt,
            url: `/assets/images/${variantName}`,
            size: variantSize
          });

          this.sessionStats.variants++;
          if (fmt in this.sessionStats.formats) {
            this.sessionStats.formats[fmt]++;
          }
        }
      }

      this.sessionStats.optimizedBytes += totalVariantsSize;
      this.sessionStats.optimizedHits++;

      // Pick display and lightbox variants
      const webpVariants = variants.filter(v => v.format === 'webp');
      const largestWebp = webpVariants[webpVariants.length - 1] || variants[variants.length - 1];
      
      // For display on page, pick a good standard size (e.g. 768w or 1280w if available, else largest)
      const displayVariant = webpVariants.find(v => v.width >= 768) || largestWebp;

      const record = {
        src: displayVariant.url,
        displaySrc: displayVariant.url,
        lightboxSrc: largestWebp.url,
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        hasAlpha: metadata.hasAlpha,
        isAnimated: false,
        variants,
        optimize: true,
        originalSize: metadata.size,
        optimizedSize: totalVariantsSize
      };

      this.processedRecords.set(sessionKey, record);
      return record;
    } catch (err) {
      if (this.logger) {
        this.logger.warn(`Failed to optimize image "${src}": ${err.message}. Using original image fallback.`);
      }

      // Graceful fallback to original image copying
      const ext = (parsedPath.ext || '.png').toLowerCase();
      const fallbackName = `${baseName}.${fileContentHash.slice(0, 8)}${ext}`;
      const fallbackOut = path.join(outAssetsDir, fallbackName);
      await fs.promises.copyFile(diskPath, fallbackOut);

      this.sessionStats.optimizedBytes += metadata.size;

      const record = {
        src: `/assets/images/${fallbackName}`,
        displaySrc: `/assets/images/${fallbackName}`,
        lightboxSrc: `/assets/images/${fallbackName}`,
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        hasAlpha: metadata.hasAlpha,
        isAnimated: false,
        variants: [],
        optimize: false,
        originalSize: metadata.size,
        optimizedSize: metadata.size
      };

      this.processedRecords.set(sessionKey, record);
      return record;
    }
  }

  getStats() {
    const { sources, variants, originalBytes, optimizedBytes, cachedHits, optimizedHits, formats } = this.sessionStats;
    const savedBytes = Math.max(0, originalBytes - (variants > 0 ? (optimizedBytes / Math.max(1, variants / Math.max(1, sources))) : optimizedBytes));
    const savedPercent = originalBytes > 0 ? Math.max(0, ((originalBytes - (optimizedBytes / Math.max(1, variants || 1))) / originalBytes) * 100) : 0;

    return {
      sources,
      variants,
      originalBytes,
      optimizedBytes,
      savedBytes,
      savedPercent: Number(savedPercent.toFixed(1)),
      cachedHits,
      optimizedHits,
      formats
    };
  }
}
