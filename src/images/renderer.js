import { escapeHtml } from '../markdown/highlighter.js';
import { withBase } from '../config/index.js';

/**
 * Generates semantic, accessible, responsive HTML for images.
 * Produces <picture> elements with modern formats (AVIF, WebP), intrinsic dimensions,
 * lazy/eager loading, and lightbox metadata.
 */

export function renderPicture(imageRecord, options = {}) {
  const {
    alt = '',
    title = '',
    caption = '',
    lightbox = true,
    loading = 'lazy',
    fetchpriority = null,
    base = '/',
    customClass = '',
    style = '',
    isGallery = false,
    galleryId = '',
    galleryIndex = 0
  } = options;

  const escapedAlt = escapeHtml(alt);
  const escapedTitle = title ? escapeHtml(title) : '';
  const escapedCaption = caption ? escapeHtml(caption) : (title ? escapeHtml(title) : '');
  const titleAttr = title ? ` title="${escapedTitle}"` : '';

  // Determine loading and fetch priority attributes
  const isEager = loading === 'eager';
  const loadingAttr = isEager ? 'loading="eager"' : 'loading="lazy"';
  const priorityAttr = isEager ? ' fetchpriority="high"' : (fetchpriority ? ` fetchpriority="${fetchpriority}"` : '');
  const decodingAttr = 'decoding="async"';

  // Lightbox attributes
  const highResSrc = imageRecord.lightboxSrc || imageRecord.fallbackSrc || imageRecord.src;
  const normalizedHighResSrc = highResSrc ? withBase(highResSrc, base) : '';
  
  let lightboxAttrs = '';
  if (lightbox && normalizedHighResSrc) {
    lightboxAttrs = ` data-docboot-lightbox="true" data-lightbox-src="${normalizedHighResSrc}" data-lightbox-alt="${escapedAlt}" data-lightbox-caption="${escapedCaption}"`;
    if (isGallery && galleryId) {
      lightboxAttrs += ` data-gallery-id="${escapeHtml(galleryId)}" data-gallery-index="${galleryIndex}"`;
    }
  }

  const cursorClass = lightbox ? 'cursor-zoom-in ' : '';
  const defaultImgClass = isGallery
    ? `w-full h-full object-cover ${cursorClass}transition-transform duration-300 group-hover:scale-105`
    : `block max-w-full h-auto rounded-lg ${cursorClass}transition-transform duration-300 group-hover:scale-[1.01]`;
  const imgClass = customClass || defaultImgClass;

  const widthAttr = imageRecord.width ? ` width="${imageRecord.width}"` : '';
  const heightAttr = imageRecord.height ? ` height="${imageRecord.height}"` : '';
  const styleAttr = style ? ` style="${style}"` : '';

  // 1. If not optimized or SVG / GIF / Remote / Single fallback only -> render clean <img>
  const hasVariants = Array.isArray(imageRecord.variants) && imageRecord.variants.length > 0;
  const isSvgOrGif = imageRecord.format === 'svg' || imageRecord.format === 'gif' || imageRecord.isAnimated;

  if (!hasVariants || isSvgOrGif || imageRecord.optimize === false) {
    const srcUrl = withBase(imageRecord.src, base);
    return `<img src="${srcUrl}" alt="${escapedAlt}"${widthAttr}${heightAttr} ${loadingAttr} ${decodingAttr}${priorityAttr} class="${imgClass}"${lightboxAttrs}${styleAttr}${titleAttr} />`;
  }

  // 2. Generate <picture> with <source> elements for each format (AVIF, WebP, etc.)
  const formatGroups = new Map();
  for (const variant of imageRecord.variants) {
    if (!formatGroups.has(variant.format)) {
      formatGroups.set(variant.format, []);
    }
    formatGroups.get(variant.format).push(variant);
  }

  // Build format sources in priority order: AVIF, WebP, others
  const formatPriority = ['avif', 'webp', 'jpeg', 'png'];
  const sortedFormats = Array.from(formatGroups.keys()).sort((a, b) => {
    const idxA = formatPriority.indexOf(a);
    const idxB = formatPriority.indexOf(b);
    return (idxA > -1 ? idxA : 99) - (idxB > -1 ? idxB : 99);
  });

  let sourcesHtml = '';
  for (const fmt of sortedFormats) {
    const variants = formatGroups.get(fmt);
    variants.sort((a, b) => a.width - b.width);

    const mimeType = fmt === 'avif' ? 'image/avif' : (fmt === 'webp' ? 'image/webp' : (fmt === 'png' ? 'image/png' : 'image/jpeg'));
    const srcsetList = variants.map(v => `${withBase(v.url, base)} ${v.width}w`).join(', ');

    // Only render source if it differs from fallback or adds modern format
    if (fmt === 'avif' || fmt === 'webp' || variants.length > 1) {
      const maxWidth = variants[variants.length - 1].width;
      const sizes = `(max-width: ${maxWidth}px) 100vw, ${maxWidth}px`;
      sourcesHtml += `  <source type="${mimeType}" srcset="${srcsetList}" sizes="${sizes}">\n`;
    }
  }

  // Determine standard display fallback img src
  const fallbackUrl = withBase(imageRecord.displaySrc || imageRecord.fallbackSrc || imageRecord.src, base);

  return `<picture>\n${sourcesHtml}  <img src="${fallbackUrl}" alt="${escapedAlt}"${widthAttr}${heightAttr} ${loadingAttr} ${decodingAttr}${priorityAttr} class="${imgClass}"${lightboxAttrs}${styleAttr}${titleAttr} />\n</picture>`;
}

/**
 * Wraps image HTML inside a semantic <figure> with caption if appropriate.
 */
export function wrapFigure(innerHtml, options = {}) {
  const {
    caption = '',
    title = '',
    align = 'center',
    notProse = true
  } = options;

  const displayCaption = caption || title;
  const escapedCaption = displayCaption ? escapeHtml(displayCaption) : '';
  const alignClass = align === 'left' ? 'text-left' : (align === 'right' ? 'text-right' : 'text-center mx-auto');
  const notProseClass = notProse ? ' not-prose' : '';

  const captionHtml = escapedCaption
    ? `\n  <figcaption class="mt-2.5 text-xs text-muted-foreground font-medium">${escapedCaption}</figcaption>`
    : '';

  return `<figure class="docboot-figure${notProseClass} my-8 ${alignClass}">\n  <div class="inline-block relative overflow-hidden rounded-lg border border-border bg-card-bg/40 shadow-2xs group">\n    ${innerHtml}\n  </div>${captionHtml}\n</figure>`;
}
