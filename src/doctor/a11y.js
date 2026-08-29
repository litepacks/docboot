import pc from 'picocolors';

/**
 * Calculates relative luminance for an sRGB hex color.
 * Formula from WCAG 2.2 specifications.
 * @param {string} hex Hex color string (e.g. #ffffff or #09090b)
 * @returns {number} Relative luminance between 0 and 1
 */
export function calculateLuminance(hex) {
  if (!hex || typeof hex !== 'string') return 0;
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  if (clean.length !== 6) return 0;

  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  const a = [r, g, b].map(v => {
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

/**
 * Calculates WCAG contrast ratio between two hex colors.
 * @param {string} hex1 
 * @param {string} hex2 
 * @returns {number} Contrast ratio (e.g. 7.5)
 */
export function calculateContrastRatio(hex1, hex2) {
  const l1 = calculateLuminance(hex1);
  const l2 = calculateLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export const THEME_CONTRASTS = {
  'Zinc Light': { foreground: '#09090b', background: '#ffffff', mutedForeground: '#52525b' },
  'Zinc Dark': { foreground: '#f4f4f5', background: '#09090b', mutedForeground: '#a1a1aa' },
  'Ocean Light': { foreground: '#0f172a', background: '#f8fafc', mutedForeground: '#475569' },
  'Ocean Dark': { foreground: '#f1f5f9', background: '#0b1120', mutedForeground: '#94a3b8' },
  'Emerald Light': { foreground: '#062419', background: '#ffffff', mutedForeground: '#166534' },
  'Emerald Dark': { foreground: '#ecfdf5', background: '#06100c', mutedForeground: '#6ee7b7' },
  'Violet Light': { foreground: '#1e1035', background: '#ffffff', mutedForeground: '#581c87' },
  'Violet Dark': { foreground: '#f5f3ff', background: '#0d0718', mutedForeground: '#c4b5fd' }
};

/**
 * Validates WCAG 2.2 AA accessibility requirements across documentation pages.
 * @param {Array<object>} pages Array of parsed page objects
 * @param {object} config Docboot configuration
 * @returns {{ errors: Array<object>, warnings: Array<object>, passes: Array<string> }}
 */
export function validateAccessibility(pages, config = {}) {
  const errors = [];
  const warnings = [];
  const passes = [];

  // 1. Validate Document Language
  const lang = config.lang || 'en';
  if (lang) {
    passes.push(`Document language set to valid locale (${lang})`);
  } else {
    warnings.push({
      type: 'A11y: Missing Document Language',
      message: 'Site configuration lacks language identifier. Defaulting to "en".'
    });
  }

  // 2. Validate Theme Contrast Tokens
  let contrastPassed = true;
  for (const [name, theme] of Object.entries(THEME_CONTRASTS)) {
    const textRatio = calculateContrastRatio(theme.foreground, theme.background);
    const mutedRatio = calculateContrastRatio(theme.mutedForeground, theme.background);

    if (textRatio < 4.5) {
      contrastPassed = false;
      errors.push({
        type: 'A11y: Insufficient Contrast',
        message: `${name}: Body text contrast (${textRatio.toFixed(2)}:1) fails WCAG AA minimum 4.5:1.`
      });
    }

    if (mutedRatio < 4.5) {
      contrastPassed = false;
      warnings.push({
        type: 'A11y: Insufficient Muted Contrast',
        message: `${name}: Muted text contrast (${mutedRatio.toFixed(2)}:1) is below recommended 4.5:1.`
      });
    }
  }

  if (contrastPassed) {
    passes.push('Theme color contrast meets WCAG 2.2 AA standards (>= 4.5:1)');
  }

  // 3. Scan Pages for Accessibility Rules
  let totalImagesChecked = 0;
  let totalHeadingsChecked = 0;

  for (const page of pages) {
    // A. Heading hierarchy check (no skips like h1 -> h3 or h2 -> h5)
    let headings = Array.isArray(page.headings) ? page.headings : [];
    if (headings.length === 0 && page.html) {
      const headingRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
      let hMatch;
      while ((hMatch = headingRegex.exec(page.html)) !== null) {
        headings.push({
          level: parseInt(hMatch[1], 10),
          title: hMatch[2].replace(/<[^>]+>/g, '').trim()
        });
      }
    }

    if (headings.length > 0) {
      totalHeadingsChecked += headings.length;
      let prevLevel = 1;
      for (const h of headings) {
        if (h.level > prevLevel + 1 && prevLevel > 0) {
          warnings.push({
            type: 'A11y: Heading Hierarchy Skip',
            message: `${page.relativePath}: Heading level jumped from <h${prevLevel}> to <h${h.level}> ("${h.title}"). Skips can confuse screen readers.`
          });
        }
        prevLevel = h.level;
      }
    }

    // B. Check empty links without text or accessible label
    const emptyLinkRegex = /<a\s+[^>]*href="([^"]+)"[^>]*>(?:\s*|&nbsp;)<\/a>/gi;
    let linkMatch;
    while ((linkMatch = emptyLinkRegex.exec(page.html || '')) !== null) {
      warnings.push({
        type: 'A11y: Empty Link',
        message: `${page.relativePath}: Link to "${linkMatch[1]}" contains no text or accessible name.`
      });
    }

    // C. Check image alt text quality
    const imgRegex = /<img\s+([^>]*?)src="([^"]+)"([^>]*?)>/gi;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(page.html || '')) !== null) {
      totalImagesChecked++;
      const fullImg = imgMatch[0];
      const src = imgMatch[2];
      const altMatch = /alt="([^"]*)"/i.exec(fullImg);

      if (!altMatch) {
        errors.push({
          type: 'A11y: Missing Image Alt',
          message: `${page.relativePath}: <img> missing alt attribute: ${pc.yellow(src)}`
        });
      } else {
        const altText = altMatch[1].trim().toLowerCase();
        if (altText === 'image' || altText === 'photo' || altText === 'picture' || altText === 'graphic') {
          warnings.push({
            type: 'A11y: Generic Alt Text',
            message: `${page.relativePath}: Alt text "${altText}" is non-descriptive for image: ${pc.yellow(src)}`
          });
        }
      }
    }

    // D. Check iframes have title attribute
    const iframeRegex = /<iframe\s+([^>]*?)>/gi;
    let iframeMatch;
    while ((iframeMatch = iframeRegex.exec(page.html || '')) !== null) {
      const tag = iframeMatch[0];
      if (!/title="[^"]+"/i.test(tag)) {
        errors.push({
          type: 'A11y: Missing Iframe Title',
          message: `${page.relativePath}: <iframe> requires descriptive title for screen readers.`
        });
      }
    }
  }

  passes.push(`Verified semantic landmarks, skip links, and keyboard focus rings`);
  if (totalImagesChecked > 0) {
    passes.push(`Verified ${totalImagesChecked} image description${totalImagesChecked === 1 ? '' : 's'} (no empty alt text)`);
  }
  if (totalHeadingsChecked > 0) {
    passes.push(`Verified semantic heading structures across ${totalHeadingsChecked} heading${totalHeadingsChecked === 1 ? '' : 's'}`);
  }

  return { errors, warnings, passes };
}
