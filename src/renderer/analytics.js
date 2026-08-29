import { escapeHtml } from '../markdown/highlighter.js';

/**
 * Generates non-blocking tracking scripts for supported analytics providers:
 * - Google Analytics (GA4)
 * - Plausible Analytics
 * - Umami Analytics
 * - Fathom Analytics
 * - Microsoft Clarity
 * - Custom script injection
 *
 * @param {object} config Docboot configuration
 * @returns {string} HTML snippet to inject inside <head>
 */
export function renderAnalyticsHead(config = {}) {
  const analytics = config.analytics || {};
  const scripts = [];

  // 1. Google Analytics (GA4)
  const gaId = analytics.google?.id || analytics.googleAnalytics || analytics.ga || (typeof analytics.google === 'string' ? analytics.google : '');
  if (gaId) {
    const cleanGaId = String(gaId).trim();
    scripts.push(`
  <!-- Google Analytics (GA4) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=${escapeHtml(cleanGaId)}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', ${JSON.stringify(cleanGaId)}, { send_page_view: true });
  </script>`);
  }

  // 2. Plausible Analytics (Privacy-first)
  const plausibleDomain = analytics.plausible?.domain || analytics.plausible || (typeof analytics.plausible === 'string' ? analytics.plausible : '');
  if (plausibleDomain) {
    const cleanDomain = String(plausibleDomain).trim();
    const apiHost = (analytics.plausible?.apiHost || 'https://plausible.io').replace(/\/$/, '');
    scripts.push(`
  <!-- Plausible Analytics -->
  <script defer data-domain="${escapeHtml(cleanDomain)}" src="${escapeHtml(apiHost)}/js/script.js"></script>`);
  }

  // 3. Umami Analytics (Privacy-friendly open-source)
  const umamiWebsiteId = analytics.umami?.websiteId || analytics.umami?.id || (typeof analytics.umami === 'string' ? analytics.umami : '');
  if (umamiWebsiteId) {
    const cleanId = String(umamiWebsiteId).trim();
    const umamiSrc = analytics.umami?.src || analytics.umami?.scriptUrl || 'https://analytics.umami.is/script.js';
    scripts.push(`
  <!-- Umami Analytics -->
  <script defer src="${escapeHtml(umamiSrc)}" data-website-id="${escapeHtml(cleanId)}"></script>`);
  }

  // 4. Fathom Analytics
  const fathomSiteId = analytics.fathom?.siteId || analytics.fathom?.id || (typeof analytics.fathom === 'string' ? analytics.fathom : '');
  if (fathomSiteId) {
    const cleanId = String(fathomSiteId).trim();
    const fathomSrc = analytics.fathom?.src || 'https://cdn.usefathom.com/script.js';
    scripts.push(`
  <!-- Fathom Analytics -->
  <script src="${escapeHtml(fathomSrc)}" data-site="${escapeHtml(cleanId)}" defer></script>`);
  }

  // 5. Microsoft Clarity
  const clarityId = analytics.clarity?.id || analytics.clarity?.projectId || (typeof analytics.clarity === 'string' ? analytics.clarity : '');
  if (clarityId) {
    const cleanId = String(clarityId).trim();
    scripts.push(`
  <!-- Microsoft Clarity -->
  <script type="text/javascript">
    (function(c,l,a,r,i,t,y){
      c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
      y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", ${JSON.stringify(cleanId)});
  </script>`);
  }

  // 6. Custom Head Tracking Scripts / HTML
  if (analytics.custom) {
    scripts.push(`\n  ${analytics.custom}`);
  }

  return scripts.join('\n');
}
