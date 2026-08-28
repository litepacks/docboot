/**
 * Anti-flash theme bootstrapper script to embed inline in <head>.
 * Restores dark/light mode, color preset, font size, and font family before page render.
 */
export const THEME_INIT_SCRIPT = `
(function() {
  try {
    var storedMode = localStorage.getItem('docboot-theme') || localStorage.getItem('euix-theme') || 'system';
    var storedPreset = localStorage.getItem('docboot-theme-preset') || localStorage.getItem('euix-theme-preset') || 'zinc';
    var storedFontSize = localStorage.getItem('docboot-font-size') || 'base';
    var storedFontFamily = localStorage.getItem('docboot-font-family') || 'sans';

    var isDark = storedMode === 'dark' || (storedMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    document.documentElement.setAttribute('data-theme', storedPreset);
    document.documentElement.setAttribute('data-font-size', storedFontSize);
    document.documentElement.setAttribute('data-font-family', storedFontFamily);
  } catch (e) {}
})();
`.trim();
