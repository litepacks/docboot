/**
 * Client-side runtime for Docboot
 * Handles:
 * 1. Dark / Light / System theme switching and persistent color palette presets
 * 2. Soft SPA-style instant page navigation (View Transitions API + prefetch cache)
 * 3. Lazy-loaded MiniSearch command palette (Cmd + K)
 * 4. Lazy-loaded Mermaid diagrams on demand
 * 5. Clipboard code copying with visual feedback
 * 6. Table of contents scroll-spy
 * 7. Mobile navigation drawer
 * 8. SSE dev server live reload
 */
(function() {
  'use strict';

  var RAW_BASE = window.__DOCBOOT_BASE__ || window.__EUIX_BASE__ || '/';
  var BASE_PATH = RAW_BASE === '/' ? '/' : RAW_BASE.replace(/\/$/, '') + '/';

  function resolveBase(path) {
    if (!path) return '';
    if (
      path.indexOf('://') !== -1 ||
      path.indexOf('//') === 0 ||
      path.indexOf('mailto:') === 0 ||
      path.indexOf('tel:') === 0 ||
      path.indexOf('#') === 0 ||
      path.indexOf('data:') === 0
    ) {
      return path;
    }
    if (BASE_PATH === '/') return path.startsWith('/') ? path : '/' + path;

    // Check if path already starts with BASE_PATH (e.g. /docboot/)
    if (path.indexOf(BASE_PATH) === 0) {
      return path;
    }
    // Check if path equals or starts with base without trailing slash (e.g. /docboot)
    var baseWithoutSlash = BASE_PATH.slice(0, -1);
    if (path === baseWithoutSlash) {
      return BASE_PATH;
    }
    if (path.indexOf(baseWithoutSlash + '/') === 0) {
      return path;
    }

    if (path === '/' || path === '') return BASE_PATH;
    var clean = path.replace(/^\/+/, '');
    return BASE_PATH + clean;
  }

  // --- Accessibility Announcer & Modal Focus Management ---
  function announceA11y(message) {
    var el = document.getElementById('docboot-a11y-live');
    if (!el || !message) return;
    el.textContent = '';
    setTimeout(function() {
      el.textContent = message;
    }, 40);
  }

  var activeModalFocusTrap = null;
  var lastModalFocusedTrigger = null;

  function trapModalFocus(modalEl, initialFocusEl) {
    lastModalFocusedTrigger = document.activeElement;
    document.body.style.overflow = 'hidden';

    var focusableSelectors = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    function handleKeyDown(e) {
      if (e.key === 'Tab') {
        var focusable = Array.from(modalEl.querySelectorAll(focusableSelectors)).filter(function(el) {
          return el.offsetParent !== null;
        });
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        var first = focusable[0];
        var last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

    modalEl.addEventListener('keydown', handleKeyDown);
    activeModalFocusTrap = { modal: modalEl, handler: handleKeyDown };

    setTimeout(function() {
      if (initialFocusEl && typeof initialFocusEl.focus === 'function') {
        initialFocusEl.focus();
      } else {
        var focusable = modalEl.querySelectorAll(focusableSelectors);
        if (focusable.length) focusable[0].focus();
      }
    }, 50);
  }

  function releaseModalFocus() {
    if (activeModalFocusTrap) {
      activeModalFocusTrap.modal.removeEventListener('keydown', activeModalFocusTrap.handler);
      activeModalFocusTrap = null;
    }
    document.body.style.overflow = '';
    if (lastModalFocusedTrigger && typeof lastModalFocusedTrigger.focus === 'function') {
      try { lastModalFocusedTrigger.focus(); } catch (e) {}
    }
  }

  // --- 1. Theme & Color Palette Management ---
  var themeInitialized = false;

  function initTheme() {
    var currentTheme = localStorage.getItem('docboot-theme') || localStorage.getItem('euix-theme') || 'system';
    var currentPreset = localStorage.getItem('docboot-theme-preset') || localStorage.getItem('euix-theme-preset') || 'zinc';
    var currentFontSize = localStorage.getItem('docboot-font-size') || 'base';

    function applyTheme(theme) {
      currentTheme = theme;
      localStorage.setItem('docboot-theme', theme);
      localStorage.setItem('euix-theme', theme);

      var isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      
      // Temporarily disable transitions during theme switch to prevent jank/lag
      var style = document.createElement('style');
      style.appendChild(document.createTextNode('*, *::before, *::after { transition: none !important; }'));
      document.head.appendChild(style);

      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }

      // Force layout calculation then remove transition blocker
      void document.documentElement.offsetHeight;
      document.head.removeChild(style);

      // Update button icons: Show Sun in Dark mode, Moon in Light mode
      document.querySelectorAll('.docboot-theme-toggle, .euix-theme-toggle').forEach(function(btn) {
        btn.setAttribute('title', isDark ? 'Switch to Light mode' : 'Switch to Dark mode');
        btn.setAttribute('aria-label', isDark ? 'Switch to Light mode' : 'Switch to Dark mode');

        var sunIcon = btn.querySelector('[data-theme-icon="light"]');
        var moonIcon = btn.querySelector('[data-theme-icon="dark"]');
        var sysIcon = btn.querySelector('[data-theme-icon="system"]');

        if (sunIcon) sunIcon.classList.toggle('hidden', !isDark);
        if (moonIcon) moonIcon.classList.toggle('hidden', isDark);
        if (sysIcon) sysIcon.classList.add('hidden');
      });

      // Defer Mermaid diagram re-rendering so theme toggle is instantaneous (60fps)
      if (typeof initMermaid === 'function' && document.querySelector('.docboot-mermaid-wrapper')) {
        if (window.requestIdleCallback) {
          window.requestIdleCallback(function() { initMermaid(true); });
        } else {
          setTimeout(function() { initMermaid(true); }, 50);
        }
      }
    }

    function applyPreset(preset) {
      currentPreset = preset;
      localStorage.setItem('docboot-theme-preset', preset);
      localStorage.setItem('euix-theme-preset', preset);
      document.documentElement.setAttribute('data-theme', preset);

      document.querySelectorAll('.docboot-preset-btn, .euix-preset-btn').forEach(function(btn) {
        var p = btn.getAttribute('data-preset');
        var check = btn.querySelector('.preset-check');
        if (check) {
          if (p === preset) {
            check.classList.remove('hidden');
            btn.classList.add('bg-muted/80', 'font-semibold');
          } else {
            check.classList.add('hidden');
            btn.classList.remove('bg-muted/80', 'font-semibold');
          }
        }
      });
    }

    var FONT_SIZES = ['sm', 'base', 'lg', 'xl'];
    var FONT_PERCENTAGES = { sm: '90%', base: '100%', lg: '110%', xl: '120%' };
    var FONT_LABELS = { sm: '14px', base: '16px', lg: '18px', xl: '20px' };

    function applyFontSize(size) {
      if (FONT_SIZES.indexOf(size) === -1) size = 'base';
      currentFontSize = size;
      localStorage.setItem('docboot-font-size', size);
      document.documentElement.setAttribute('data-font-size', size);

      var label = document.getElementById('docboot-font-size-label');
      if (label) {
        label.textContent = FONT_LABELS[size] || size;
      }

      document.querySelectorAll('.docboot-font-size-indicator').forEach(function(el) {
        el.textContent = FONT_PERCENTAGES[size] || '100%';
      });

      document.querySelectorAll('.docboot-font-size-btn').forEach(function(btn) {
        var s = btn.getAttribute('data-font-size');
        if (s === size) {
          btn.classList.add('bg-card-bg', 'font-bold', 'text-accent', 'shadow-xs');
          btn.classList.remove('text-foreground');
        } else {
          btn.classList.remove('bg-card-bg', 'font-bold', 'text-accent', 'shadow-xs');
          btn.classList.add('text-foreground');
        }
      });
    }

    function stepFontSize(step) {
      if (step === 0) {
        applyFontSize('base');
        return;
      }
      var idx = FONT_SIZES.indexOf(currentFontSize);
      if (idx === -1) idx = 1;
      var newIdx = Math.max(0, Math.min(FONT_SIZES.length - 1, idx + step));
      applyFontSize(FONT_SIZES[newIdx]);
    }

    var currentFontFamily = localStorage.getItem('docboot-font-family') || 'sans';

    function applyFontFamily(family) {
      currentFontFamily = family;
      localStorage.setItem('docboot-font-family', family);
      document.documentElement.setAttribute('data-font-family', family);

      var label = document.getElementById('docboot-font-family-label');
      if (label) {
        label.textContent = family;
      }

      document.querySelectorAll('.docboot-font-family-btn').forEach(function(btn) {
        var f = btn.getAttribute('data-font-family');
        if (f === family) {
          btn.classList.add('bg-card-bg', 'font-bold', 'text-accent', 'shadow-xs');
          btn.classList.remove('text-foreground');
        } else {
          btn.classList.remove('bg-card-bg', 'font-bold', 'text-accent', 'shadow-xs');
          btn.classList.add('text-foreground');
        }
      });
    }

    if (!themeInitialized) {
      themeInitialized = true;

      // Delegated click for theme toggle, palette, and font settings (100% reliable across SPA transitions)
      document.addEventListener('click', function(e) {
        var btn = e.target.closest('.docboot-theme-toggle, .euix-theme-toggle');
        if (btn) {
          var isCurrentlyDark = document.documentElement.classList.contains('dark');
          applyTheme(isCurrentlyDark ? 'light' : 'dark');
          return;
        }

        var stepBtn = e.target.closest('.docboot-font-step-btn');
        if (stepBtn) {
          var step = parseInt(stepBtn.getAttribute('data-step') || '0', 10);
          stepFontSize(step);
          return;
        }

        var fontBtn = e.target.closest('.docboot-font-size-btn');
        if (fontBtn) {
          var size = fontBtn.getAttribute('data-font-size');
          if (size) {
            applyFontSize(size);
          }
          return;
        }

        var familyBtn = e.target.closest('.docboot-font-family-btn');
        if (familyBtn) {
          var family = familyBtn.getAttribute('data-font-family');
          if (family) {
            applyFontFamily(family);
          }
          return;
        }

        var presetBtn = e.target.closest('.docboot-preset-btn, .euix-preset-btn');
        if (presetBtn) {
          var preset = presetBtn.getAttribute('data-preset');
          if (preset) {
            applyPreset(preset);
            var presetMenu = document.getElementById('docboot-preset-menu') || document.getElementById('euix-preset-menu');
            if (presetMenu) presetMenu.classList.add('hidden');
          }
          return;
        }

        var presetToggle = e.target.closest('#docboot-preset-toggle, #euix-preset-toggle');
        if (presetToggle) {
          e.stopPropagation();
          var menu = document.getElementById('docboot-preset-menu') || document.getElementById('euix-preset-menu');
          if (menu) menu.classList.toggle('hidden');
          return;
        }

        var menu = document.getElementById('docboot-preset-menu') || document.getElementById('euix-preset-menu');
        if (menu && !menu.classList.contains('hidden') && !menu.contains(e.target)) {
          menu.classList.add('hidden');
        }
      });

      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() {
        if ((localStorage.getItem('docboot-theme') || localStorage.getItem('euix-theme')) === 'system') {
          applyTheme('system');
        }
      });
    }

    window.__docboot_applyTheme = applyTheme;
    window.__docboot_applyPreset = applyPreset;
    window.__docboot_applyFontSize = applyFontSize;
    window.__docboot_applyFontFamily = applyFontFamily;

    applyTheme(currentTheme);
    applyPreset(currentPreset);
    applyFontSize(currentFontSize);
    applyFontFamily(currentFontFamily);
  }

  // --- 2. Copy Code to Clipboard ---
  function initCopyButtons() {
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('.docboot-copy-btn, .euix-copy-btn');
      if (!btn) return;

      var code = btn.getAttribute('data-code');
      if (!code) return;

      navigator.clipboard.writeText(code).then(function() {
        var copyIcon = btn.querySelector('.copy-icon');
        var copiedIcon = btn.querySelector('.copied-icon');
        var text = btn.querySelector('.copy-text');

        if (copyIcon) copyIcon.classList.add('hidden');
        if (copiedIcon) copiedIcon.classList.remove('hidden');
        if (text) text.textContent = 'Copied!';
        announceA11y('Code copied to clipboard');

        setTimeout(function() {
          if (copyIcon) copyIcon.classList.remove('hidden');
          if (copiedIcon) copiedIcon.classList.add('hidden');
          if (text) text.textContent = 'Copy';
        }, 2000);
      }).catch(function(err) {
        console.error('Failed to copy code:', err);
      });
    });
  }

  // --- 3. Table of Contents Scroll Spy ---
  var currentScrollSpyCleanup = null;

  function initTocScrollSpy() {
    if (typeof currentScrollSpyCleanup === 'function') {
      currentScrollSpyCleanup();
      currentScrollSpyCleanup = null;
    }

    var tocLinks = document.querySelectorAll('.docboot-toc-link, .euix-toc-link');
    if (!tocLinks.length) return;

    var headings = [];
    tocLinks.forEach(function(link) {
      var href = link.getAttribute('href');
      if (href && href.startsWith('#')) {
        var el = document.getElementById(href.slice(1));
        if (el) headings.push({ el: el, link: link });
      }
    });

    if (!headings.length) return;

    function onScroll() {
      var scrollPos = window.scrollY + 100;
      var activeHeading = null;

      for (var i = 0; i < headings.length; i++) {
        var top = headings[i].el.offsetTop;
        if (top <= scrollPos) {
          activeHeading = headings[i];
        } else {
          break;
        }
      }

      if (!activeHeading && headings.length > 0) {
        activeHeading = headings[0];
      }

      tocLinks.forEach(function(l) {
        l.classList.remove('text-accent', 'font-medium', 'border-accent');
        l.classList.add('text-muted-foreground', 'border-transparent');
      });

      if (activeHeading) {
        activeHeading.link.classList.remove('text-muted-foreground', 'border-transparent');
        activeHeading.link.classList.add('text-accent', 'font-medium', 'border-accent');
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    currentScrollSpyCleanup = function() {
      window.removeEventListener('scroll', onScroll);
    };
  }

  // --- 4. Mobile Navigation Drawer & Touch Swipe Gestures ---
  function initMobileDrawer() {
    var toggleBtn = document.getElementById('docboot-mobile-toggle') || document.getElementById('euix-mobile-toggle');
    var drawer = document.getElementById('docboot-mobile-drawer') || document.getElementById('euix-mobile-drawer');
    var backdrop = document.getElementById('docboot-mobile-backdrop') || document.getElementById('euix-mobile-backdrop');
    var closeBtn = document.getElementById('docboot-mobile-close') || document.getElementById('euix-mobile-close');

    if (!drawer) return;

    function isDrawerOpen() {
      return !drawer.classList.contains('-translate-x-full');
    }

    function openDrawer() {
      if (backdrop) backdrop.classList.remove('hidden');
      drawer.classList.remove('-translate-x-full');
      drawer.classList.add('translate-x-0');
      document.body.style.overflow = 'hidden';
    }

    function closeDrawer() {
      if (!isDrawerOpen()) return;
      drawer.classList.remove('translate-x-0');
      drawer.classList.add('-translate-x-full');
      if (backdrop) backdrop.classList.add('hidden');
      document.body.style.overflow = '';
    }

    if (toggleBtn) {
      toggleBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (isDrawerOpen()) {
          closeDrawer();
        } else {
          openDrawer();
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        closeDrawer();
      });
    }

    if (backdrop) {
      backdrop.addEventListener('click', function(e) {
        e.stopPropagation();
        closeDrawer();
      });
    }

    // 1. Close drawer when clicking outside (content area, header, etc.) or on navigation links
    document.addEventListener('click', function(e) {
      if (!isDrawerOpen()) return;
      if (drawer.contains(e.target)) {
        var link = e.target.closest('a');
        if (link && !link.classList.contains('docboot-sidebar-group-toggle-title')) {
          closeDrawer();
        }
        return;
      }
      if (toggleBtn && toggleBtn.contains(e.target)) return;
      closeDrawer();
    });

    // Close on Escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && isDrawerOpen()) {
        closeDrawer();
      }
    });

    // Auto-close on resize to desktop breakpoint (md: 768px)
    window.addEventListener('resize', function() {
      if (window.innerWidth >= 768 && isDrawerOpen()) {
        closeDrawer();
      }
    });

    // 2. Mobile Edge Swipe Gestures (Swipe right from edge to open, swipe left to close)
    var touchStartX = 0;
    var touchStartY = 0;
    var touchStartTime = 0;
    var isEdgeSwipe = false;

    document.addEventListener('touchstart', function(e) {
      if (e.touches.length !== 1) return;
      var touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchStartTime = Date.now();
      // Edge swipe triggers when touch begins within 45px of screen's left edge
      isEdgeSwipe = touchStartX <= 45;
    }, { passive: true });

    document.addEventListener('touchend', function(e) {
      if (e.changedTouches.length !== 1) return;
      var touch = e.changedTouches[0];
      var deltaX = touch.clientX - touchStartX;
      var deltaY = touch.clientY - touchStartY;
      var elapsed = Date.now() - touchStartTime;

      if (elapsed > 600) return;
      if (Math.abs(deltaX) < 40 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.25) return;

      if (!isDrawerOpen()) {
        if (isEdgeSwipe && deltaX > 40) {
          openDrawer();
        }
      } else {
        if (deltaX < -40) {
          closeDrawer();
        }
      }
    }, { passive: true });
  }

  // --- 5. Lazy-Loaded Client-Side Search (Cmd+K / MiniSearch) ---
  var searchEngine = null;
  var searchLoadingPromise = null;

  function loadSearch() {
    if (searchEngine) return Promise.resolve(searchEngine);
    if (searchLoadingPromise) return searchLoadingPromise;

    var indexUrl = window.__DOCBOOT_SEARCH_INDEX_URL__ || window.__EUIX_SEARCH_INDEX_URL__ || '/assets/search-index.json';
    var searchOptions = window.__DOCBOOT_SEARCH_CONFIG__ || window.__EUIX_SEARCH_CONFIG__ || {};

    searchLoadingPromise = Promise.all([
      import(resolveBase('/assets/search-runtime.js')),
      fetch(indexUrl).then(function(res) {
        if (!res.ok) throw new Error('Failed to fetch search index: ' + res.status);
        return res.json();
      })
    ]).then(function(results) {
      var searchModule = results[0];
      var searchData = results[1];

      searchEngine = searchModule.createSearchEngine(searchData, searchOptions);
      return searchEngine;
    }).catch(function(err) {
      console.error('[docboot] Search load failed:', err);
      searchLoadingPromise = null;
      throw err;
    });

    return searchLoadingPromise;
  }

  function initSearch() {
    var modal = document.getElementById('docboot-search-modal') || document.getElementById('euix-search-modal');
    var backdrop = document.getElementById('docboot-search-backdrop') || document.getElementById('euix-search-backdrop');
    var input = document.getElementById('docboot-search-input') || document.getElementById('euix-search-input');
    var resultsContainer = document.getElementById('docboot-search-results') || document.getElementById('euix-search-results');
    var triggers = document.querySelectorAll('.docboot-search-trigger, .euix-search-trigger');
    var clearBtn = document.getElementById('docboot-search-clear');
    var escBadge = modal.querySelector('kbd[aria-label*="Escape"]');

    if (!modal || !input || !resultsContainer) return;

    var selectedIndex = -1;
    var currentResults = [];
    var activeCategory = 'all';
    var RECENT_SEARCHES_KEY = 'docboot_recent_searches';

    var COMMAND_ACTIONS = [
      {
        id: 'toggle-theme',
        title: 'Toggle Color Theme',
        category: 'Theme',
        description: 'Switch between light and dark appearance',
        icon: '<svg class="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>',
        badge: 'Action',
        isAction: true,
        run: function() {
          var isDark = document.documentElement.classList.contains('dark');
          if (window.__docboot_applyTheme) {
            window.__docboot_applyTheme(isDark ? 'light' : 'dark');
          } else {
            var toggleBtn = document.querySelector('.docboot-theme-toggle, .euix-theme-toggle');
            if (toggleBtn) toggleBtn.click();
          }
          announceA11y('Theme switched to ' + (isDark ? 'light' : 'dark'));
        }
      },
      {
        id: 'theme-zinc',
        title: 'Switch Preset: Zinc',
        category: 'Theme Preset',
        description: 'Neutral slate monochromatic design',
        icon: '<span class="w-3 h-3 rounded-full bg-zinc-500 inline-block shrink-0"></span>',
        badge: 'Preset',
        isAction: true,
        run: function() {
          if (window.__docboot_applyPreset) window.__docboot_applyPreset('zinc');
          announceA11y('Switched preset to Zinc');
        }
      },
      {
        id: 'theme-ocean',
        title: 'Switch Preset: Ocean',
        category: 'Theme Preset',
        description: 'Deep vibrant blue accent theme',
        icon: '<span class="w-3 h-3 rounded-full bg-blue-500 inline-block shrink-0"></span>',
        badge: 'Preset',
        isAction: true,
        run: function() {
          if (window.__docboot_applyPreset) window.__docboot_applyPreset('ocean');
          announceA11y('Switched preset to Ocean');
        }
      },
      {
        id: 'theme-emerald',
        title: 'Switch Preset: Emerald',
        category: 'Theme Preset',
        description: 'Natural emerald green accent theme',
        icon: '<span class="w-3 h-3 rounded-full bg-emerald-500 inline-block shrink-0"></span>',
        badge: 'Preset',
        isAction: true,
        run: function() {
          if (window.__docboot_applyPreset) window.__docboot_applyPreset('emerald');
          announceA11y('Switched preset to Emerald');
        }
      },
      {
        id: 'theme-violet',
        title: 'Switch Preset: Violet',
        category: 'Theme Preset',
        description: 'Electric violet accent theme',
        icon: '<span class="w-3.5 h-3.5 rounded-full bg-purple-500 inline-block shrink-0"></span>',
        badge: 'Preset',
        isAction: true,
        run: function() {
          if (window.__docboot_applyPreset) window.__docboot_applyPreset('violet');
          announceA11y('Switched preset to Violet');
        }
      },
      {
        id: 'theme-amber',
        title: 'Switch Preset: Amber',
        category: 'Theme Preset',
        description: 'Warm gold and amber accent theme',
        icon: '<span class="w-3 h-3 rounded-full bg-amber-500 inline-block shrink-0"></span>',
        badge: 'Preset',
        isAction: true,
        run: function() {
          if (window.__docboot_applyPreset) window.__docboot_applyPreset('amber');
          announceA11y('Switched preset to Amber');
        }
      },
      {
        id: 'theme-rose',
        title: 'Switch Preset: Rose',
        category: 'Theme Preset',
        description: 'Modern rose red accent theme',
        icon: '<span class="w-3 h-3 rounded-full bg-rose-500 inline-block shrink-0"></span>',
        badge: 'Preset',
        isAction: true,
        run: function() {
          if (window.__docboot_applyPreset) window.__docboot_applyPreset('rose');
          announceA11y('Switched preset to Rose');
        }
      },
      {
        id: 'copy-markdown',
        title: 'Copy Page as Markdown',
        category: 'Action',
        description: 'Copy raw markdown source of this page to clipboard',
        icon: '<svg class="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>',
        badge: 'Copy',
        isAction: true,
        run: function() {
          var copyBtn = document.getElementById('docboot-copy-page-btn');
          if (copyBtn) {
            copyBtn.click();
          } else {
            var curPath = window.location.pathname;
            var rawSrc = resolveBase('/_sources' + (curPath === '/' ? '/index' : curPath).replace(/\/$/, '') + '.md');
            fetch(rawSrc)
              .then(function(res) { return res.text(); })
              .then(function(txt) {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  navigator.clipboard.writeText(txt);
                }
                announceA11y('Page Markdown copied to clipboard');
              }).catch(function() {});
          }
        }
      },
      {
        id: 'open-github',
        title: 'Open GitHub Repository',
        category: 'Navigation',
        description: 'Open source repository in a new browser tab',
        icon: '<svg class="w-4 h-4 text-accent" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>',
        badge: 'External',
        isAction: true,
        run: function() {
          var gh = document.querySelector('a[href*="github.com"]');
          if (gh && gh.href) window.open(gh.href, '_blank', 'noopener,noreferrer');
        }
      },
      {
        id: 'cycle-font-size',
        title: 'Cycle Body Font Size',
        category: 'Accessibility',
        description: 'Cycle text scale: 14px → 16px → 18px → 20px',
        icon: '<svg class="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h8m-8 6h16"/></svg>',
        badge: 'Display',
        isAction: true,
        run: function() {
          var current = localStorage.getItem('docboot-font-size') || 'base';
          var sizes = ['sm', 'base', 'lg', 'xl'];
          var nextIdx = (sizes.indexOf(current) + 1) % sizes.length;
          if (window.__docboot_applyFontSize) window.__docboot_applyFontSize(sizes[nextIdx]);
          announceA11y('Font size set to ' + sizes[nextIdx]);
        }
      },
      {
        id: 'clear-recent',
        title: 'Clear Recent Searches',
        category: 'Data',
        description: 'Delete search history from browser storage',
        icon: '<svg class="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>',
        badge: 'Storage',
        isAction: true,
        run: function() {
          clearRecentSearches();
          announceA11y('Cleared recent searches');
          resetEmptyState();
        }
      }
    ];

    function getRecentSearches() {
      try {
        var raw = localStorage.getItem(RECENT_SEARCHES_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (_) {
        return [];
      }
    }

    function saveRecentSearch(item) {
      if (!item || !item.route || item.isAction) return;
      try {
        var recents = getRecentSearches();
        recents = recents.filter(function(r) {
          return r.route !== item.route;
        });
        recents.unshift({
          title: item.title,
          section: item.section || item.title,
          route: item.route,
          query: input.value.trim() || item.title
        });
        if (recents.length > 5) recents = recents.slice(0, 5);
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recents));
      } catch (_) {}
    }

    function clearRecentSearches() {
      try {
        localStorage.removeItem(RECENT_SEARCHES_KEY);
      } catch (_) {}
    }

    function highlightText(text, query) {
      if (!text) return '';
      var escaped = escapeHtml(text);
      if (!query) return escaped;

      var tokens = query
        .trim()
        .split(/\s+/)
        .map(function(t) { return t.replace(/[^a-zA-Z0-9_-]/g, ''); })
        .filter(function(t) { return t.length >= 2; });

      if (tokens.length === 0) return escaped;

      var escapedTokens = tokens.map(function(t) {
        return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      });
      var regex = new RegExp('(' + escapedTokens.join('|') + ')', 'gi');

      return escaped.replace(regex, '<mark class="bg-accent/25 text-accent font-semibold px-0.5 rounded-xs">$1</mark>');
    }

    var CATEGORIES = [
      { id: 'all', label: 'All' },
      { id: 'getting-started', label: 'Getting Started' },
      { id: 'guide', label: 'Guide' },
      { id: 'reference', label: 'Reference' }
    ];

    function renderCategoryTabs() {
      var html = '<div class="flex items-center gap-1.5 px-3 py-2 border-b border-border/40 overflow-x-auto select-none no-scrollbar">';
      for (var i = 0; i < CATEGORIES.length; i++) {
        var cat = CATEGORIES[i];
        var isActive = activeCategory === cat.id;
        var btnClass = isActive
          ? 'bg-accent text-accent-foreground font-semibold shadow-2xs ring-1 ring-accent/30'
          : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted font-medium';
        html += '<button type="button" class="search-cat-tab text-xs px-2.5 py-1 rounded-full transition-all shrink-0 cursor-pointer ' + btnClass + '" data-category="' + cat.id + '">' + cat.label + '</button>';
      }
      html += '</div>';
      return html;
    }

    function renderPopularTopics() {
      return '<div class="px-3 pt-2.5 pb-2 border-t border-border/40 select-none">' +
        '<div class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-2 flex items-center gap-1.5">' +
          '<svg class="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>' +
          '<span>Popular Topics</span>' +
        '</div>' +
        '<div class="flex flex-wrap gap-1.5">' +
          '<button type="button" class="search-tag-btn text-xs px-2.5 py-1 rounded-md bg-muted/60 hover:bg-accent/15 hover:text-accent border border-border/60 transition-colors cursor-pointer" data-query="quick start">quick start</button>' +
          '<button type="button" class="search-tag-btn text-xs px-2.5 py-1 rounded-md bg-muted/60 hover:bg-accent/15 hover:text-accent border border-border/60 transition-colors cursor-pointer" data-query="installation">installation</button>' +
          '<button type="button" class="search-tag-btn text-xs px-2.5 py-1 rounded-md bg-muted/60 hover:bg-accent/15 hover:text-accent border border-border/60 transition-colors cursor-pointer" data-query="configuration">configuration</button>' +
          '<button type="button" class="search-tag-btn text-xs px-2.5 py-1 rounded-md bg-muted/60 hover:bg-accent/15 hover:text-accent border border-border/60 transition-colors cursor-pointer" data-query="themes">themes</button>' +
          '<button type="button" class="search-tag-btn text-xs px-2.5 py-1 rounded-md bg-muted/60 hover:bg-accent/15 hover:text-accent border border-border/60 transition-colors cursor-pointer" data-query="doctor">doctor</button>' +
          '<button type="button" class="search-tag-btn text-xs px-2.5 py-1 rounded-md bg-muted/60 hover:bg-accent/15 hover:text-accent border border-border/60 transition-colors cursor-pointer" data-query="compare">compare slider</button>' +
        '</div>' +
      '</div>';
    }

    function resetEmptyState() {
      var recents = getRecentSearches();
      var tabsHtml = renderCategoryTabs();
      var popularHtml = renderPopularTopics();

      if (recents.length > 0) {
        var html = tabsHtml;
        html += '<div class="py-2 px-1">';
        html += '<div class="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between select-none">';
        html += '<span class="flex items-center gap-1.5"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Recent Searches</span>';
        html += '<button id="docboot-search-clear-recent" type="button" class="text-[11px] text-accent hover:underline lowercase font-medium cursor-pointer">clear</button>';
        html += '</div>';
        html += '<div class="space-y-1 mt-1">';

        for (var i = 0; i < recents.length; i++) {
          var r = recents[i];
          var isSelected = (selectedIndex === i);
          var activeClass = isSelected
            ? 'bg-accent/12 border-accent/40 text-foreground ring-1 ring-accent/30 shadow-2xs'
            : 'hover:bg-muted/50 text-foreground/90 border-transparent';

          html += '<a href="' + resolveBase(r.route) + '" role="option" aria-selected="' + (isSelected ? 'true' : 'false') + '" class="search-result-item flex items-center justify-between p-2.5 rounded-lg border ' + activeClass + ' transition-all block text-sm group" data-index="' + i + '">';
          html += '<div class="flex-1 min-w-0 pr-3 flex items-center gap-2.5">';
          html += '<svg class="w-4 h-4 text-muted-foreground/60 group-hover:text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
          html += '<div class="min-w-0">';
          html += '<div class="font-medium text-foreground text-xs sm:text-sm truncate">' + escapeHtml(r.title) + '</div>';
          if (r.section && r.section !== r.title) {
            html += '<div class="text-[11px] text-muted-foreground truncate font-normal mt-0.5">' + escapeHtml(r.section) + '</div>';
          }
          html += '</div></div>';
          html += '<svg class="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>';
          html += '</a>';
        }
        html += '</div>';
        html += popularHtml;
        html += '<div class="text-[11px] text-muted-foreground/60 mt-1 pt-2 border-t border-border/40 text-center flex items-center justify-center gap-1.5 select-none"><span>Tip: Type</span><kbd class="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px] text-foreground font-semibold border border-border/80">&gt;</kbd><span>for Quick Actions or</span><kbd class="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px] text-foreground font-semibold border border-border/80">@category</kbd></div>';
        html += '</div>';

        resultsContainer.innerHTML = html;
        currentResults = recents;

        var clearRecentBtn = document.getElementById('docboot-search-clear-recent');
        if (clearRecentBtn) {
          clearRecentBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            clearRecentSearches();
            selectedIndex = -1;
            currentResults = [];
            resetEmptyState();
          });
        }
      } else {
        resultsContainer.innerHTML = tabsHtml + '<div class="py-8 px-6 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2 select-none"><svg class="w-8 h-8 text-muted-foreground/40 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg><span class="font-medium text-foreground/80">Search documentation</span><div class="text-xs text-muted-foreground/70 flex items-center justify-center gap-1.5 mt-0.5"><span>Type keywords,</span><kbd class="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px] text-foreground font-semibold border border-border/80">&gt;</kbd><span>for Actions, or</span><kbd class="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px] text-foreground font-semibold border border-border/80">@category</kbd></div></div>' + popularHtml;
        currentResults = [];
      }
    }

    function openModal() {
      modal.classList.remove('hidden');
      input.value = '';
      if (clearBtn) clearBtn.classList.add('hidden');
      selectedIndex = -1;
      activeCategory = 'all';
      currentResults = [];
      resetEmptyState();
      trapModalFocus(modal, input);
      announceA11y('Search dialog opened');

      // Immediate auto-focus with rAF and microtask backup for 100% reliable focus
      input.focus({ preventScroll: true });
      requestAnimationFrame(function() {
        input.focus({ preventScroll: true });
        input.select();
      });
      setTimeout(function() {
        input.focus({ preventScroll: true });
      }, 30);

      loadSearch().catch(function() {});
    }

    function closeModal() {
      modal.classList.add('hidden');
      input.blur();
      releaseModalFocus();
      announceA11y('Search dialog closed');
    }

    triggers.forEach(function(trigger) {
      trigger.addEventListener('click', openModal);
    });

    if (backdrop) backdrop.addEventListener('click', closeModal);
    if (escBadge) escBadge.addEventListener('click', closeModal);

    if (clearBtn) {
      clearBtn.addEventListener('click', function() {
        input.value = '';
        clearBtn.classList.add('hidden');
        selectedIndex = -1;
        currentResults = [];
        resetEmptyState();
        input.focus();
      });
    }

    // Pre-warm search engine during idle cycles so Cmd+K is instant with 0ms delay
    var idleCallback = window.requestIdleCallback || function(cb) { setTimeout(cb, 1200); };
    idleCallback(function() {
      loadSearch().catch(function() {});
    });

    document.addEventListener('keydown', function(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (modal.classList.contains('hidden')) {
          openModal();
        } else {
          closeModal();
        }
      } else if (e.key === '/' && modal.classList.contains('hidden')) {
        var activeTag = document.activeElement ? document.activeElement.tagName : '';
        if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA' && !document.activeElement.isContentEditable) {
          e.preventDefault();
          openModal();
        }
      } else if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        e.preventDefault();
        closeModal();
      }
    });

    function performSearch(query) {
      var q = query.trim();
      var searchConfig = window.__DOCBOOT_SEARCH_CONFIG__ || window.__EUIX_SEARCH_CONFIG__ || {};
      var minLen = searchConfig.minQueryLength || 2;

      if (clearBtn) {
        clearBtn.classList.toggle('hidden', !query);
      }

      // 1. Command Mode (triggered by > prefix)
      if (q.startsWith('>')) {
        var cmdQuery = q.slice(1).trim().toLowerCase();
        var matchingActions = COMMAND_ACTIONS.filter(function(action) {
          if (!cmdQuery) return true;
          return (
            action.title.toLowerCase().includes(cmdQuery) ||
            action.category.toLowerCase().includes(cmdQuery) ||
            action.description.toLowerCase().includes(cmdQuery)
          );
        });

        currentResults = matchingActions;
        selectedIndex = 0;
        renderResults(currentResults, q);
        return;
      }

      // 2. Inline @category query parsing
      var effectiveCategory = activeCategory;
      var cleanQuery = q;
      var atMatch = q.match(/^@([a-zA-Z0-9_-]+)(?:\s+(.*))?$/);
      if (atMatch) {
        effectiveCategory = atMatch[1].toLowerCase();
        cleanQuery = (atMatch[2] || '').trim();
      }

      if (!cleanQuery && effectiveCategory === 'all') {
        resetEmptyState();
        return;
      }

      if (!searchEngine) {
        resultsContainer.innerHTML = renderCategoryTabs() + '<div class="py-12 px-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2.5"><svg class="animate-spin w-4 h-4 text-accent" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg> <span>Initializing search...</span></div>';
        loadSearch().then(function(engine) {
          if (engine && input.value.trim() === q) {
            currentResults = engine.search(cleanQuery || effectiveCategory, { category: effectiveCategory });
            selectedIndex = 0;
            renderResults(currentResults, cleanQuery || effectiveCategory);
          }
        });
        return;
      }

      currentResults = searchEngine.search(cleanQuery || effectiveCategory, { category: effectiveCategory });
      selectedIndex = 0;
      renderResults(currentResults, cleanQuery || effectiveCategory);
    }

    function renderResults(results, query) {
      var isCommandMode = query.trim().startsWith('>');
      var minLen = (window.__EUIX_SEARCH_CONFIG__ && window.__EUIX_SEARCH_CONFIG__.minQueryLength) || 2;

      if (!query && activeCategory === 'all' && !isCommandMode) {
        resetEmptyState();
        return;
      }

      var tabsHtml = !isCommandMode ? renderCategoryTabs() : '';

      if (results.length === 0) {
        var suggestions = (!isCommandMode && searchEngine && typeof searchEngine.suggest === 'function')
          ? searchEngine.suggest(query, 2)
          : [];

        var suggestionHtml = '';
        if (suggestions.length > 0) {
          suggestionHtml = '<div class="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-xs text-accent"><span class="text-muted-foreground">Did you mean:</span><button type="button" class="search-suggestion-btn font-semibold hover:underline cursor-pointer" data-suggestion="' + escapeHtml(suggestions[0].suggestion) + '">' + escapeHtml(suggestions[0].suggestion) + '</button></div>';
        }

        resultsContainer.innerHTML = tabsHtml + '<div class="py-10 px-6 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2 select-none"><svg class="w-8 h-8 text-muted-foreground/40 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><span class="font-medium text-foreground">No ' + (isCommandMode ? 'actions' : 'documents') + ' found</span><span class="text-xs text-muted-foreground/70">No results matched "<span class="font-medium text-foreground/90">' + escapeHtml(query) + '</span>"</span>' + suggestionHtml + '</div>';
        announceA11y('No matching results found');
        return;
      }

      announceA11y(results.length + ' result' + (results.length === 1 ? '' : 's') + ' found');

      var html = tabsHtml + '<div class="p-1.5 space-y-1">';
      for (var i = 0; i < results.length; i++) {
        var item = results[i];
        var isSelected = i === selectedIndex;
        var activeClass = isSelected
          ? 'bg-accent/12 border-accent/40 text-foreground ring-1 ring-accent/30 shadow-2xs'
          : 'hover:bg-muted/50 text-foreground/90 border-transparent';

        if (item.isAction) {
          // Render Command Palette Action Item
          html += '<button type="button" role="option" aria-selected="' + (isSelected ? 'true' : 'false') + '" class="search-result-item w-full text-left flex items-center justify-between p-2.5 rounded-lg border ' + activeClass + ' transition-all block text-sm group cursor-pointer" data-index="' + i + '">';
          html += '<div class="flex items-center gap-3 min-w-0 pr-3">';
          html += '<div class="w-7 h-7 rounded-md bg-accent/15 border border-accent/25 flex items-center justify-center shrink-0">' + item.icon + '</div>';
          html += '<div class="min-w-0">';
          html += '<div class="font-medium text-foreground truncate flex items-center gap-2"><span>' + highlightText(item.title, query.replace(/^>/, '')) + '</span><span class="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded bg-muted/80 text-muted-foreground border border-border/60">' + escapeHtml(item.badge || 'Action') + '</span></div>';
          html += '<div class="text-xs text-muted-foreground/80 truncate mt-0.5">' + escapeHtml(item.description) + '</div>';
          html += '</div></div>';
          html += '<kbd class="hidden sm:inline-block px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[10px] border border-border/80 shrink-0">↵</kbd>';
          html += '</button>';
        } else {
          // Render Document Search Result with Anchor Breadcrumb
          html += '<a href="' + resolveBase(item.route) + '" role="option" aria-selected="' + (isSelected ? 'true' : 'false') + '" class="search-result-item flex items-center justify-between p-3 rounded-lg border ' + activeClass + ' transition-all block text-sm group" data-index="' + i + '">';
          html += '<div class="flex-1 min-w-0 pr-3">';
          html += '<div class="font-medium text-foreground truncate flex items-center gap-2"><span>' + highlightText(item.title, query) + '</span>';
          if (item.route && item.route.includes('#')) {
            html += '<span class="text-[10px] font-mono text-accent/80 font-medium px-1 rounded bg-accent/10 border border-accent/20">#' + escapeHtml(item.route.split('#')[1]) + '</span>';
          }
          html += '</div>';
          if (item.section) {
            html += '<div class="text-xs text-muted-foreground truncate mt-0.5 font-normal flex items-center gap-1"><span class="text-accent/80 font-mono">#</span> ' + highlightText(item.section, query) + '</div>';
          }
          if (item.snippet) {
            html += '<div class="text-xs text-muted-foreground/80 truncate mt-1 leading-relaxed">' + highlightText(item.snippet, query) + '</div>';
          }
          html += '</div>';
          html += '<svg class="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>';
          html += '</a>';
        }
      }
      html += '</div>';

      resultsContainer.innerHTML = html;
    }

    resultsContainer.addEventListener('click', function(e) {
      // 1. Category Tab Click
      var tabEl = e.target.closest('.search-cat-tab');
      if (tabEl) {
        e.preventDefault();
        e.stopPropagation();
        var cat = tabEl.getAttribute('data-category');
        if (cat) {
          activeCategory = cat;
          performSearch(input.value);
        }
        return;
      }

      // 2. Popular Query Tag Click
      var tagEl = e.target.closest('.search-tag-btn');
      if (tagEl) {
        e.preventDefault();
        e.stopPropagation();
        var tagQuery = tagEl.getAttribute('data-query');
        if (tagQuery) {
          input.value = tagQuery;
          performSearch(tagQuery);
          input.focus();
        }
        return;
      }

      // 3. "Did you mean" Suggestion Click
      var suggEl = e.target.closest('.search-suggestion-btn');
      if (suggEl) {
        e.preventDefault();
        e.stopPropagation();
        var suggText = suggEl.getAttribute('data-suggestion');
        if (suggText) {
          input.value = suggText;
          performSearch(suggText);
          input.focus();
        }
        return;
      }

      // 4. Search Result Item Click
      var itemEl = e.target.closest('.search-result-item');
      if (itemEl) {
        var idx = parseInt(itemEl.getAttribute('data-index'), 10);
        if (!isNaN(idx) && currentResults[idx]) {
          var targetItem = currentResults[idx];
          if (targetItem.isAction && typeof targetItem.run === 'function') {
            targetItem.run();
            closeModal();
          } else {
            saveRecentSearch(targetItem);
            if (targetItem.route && targetItem.route.includes('#')) {
              var targetHash = '#' + targetItem.route.split('#')[1];
              highlightAnchorTarget(targetHash);
            }
          }
        }
      }
    });

    input.addEventListener('input', function() {
      performSearch(input.value);
    });

    input.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentResults.length > 0) {
          selectedIndex = (selectedIndex + 1) % currentResults.length;
          renderResults(currentResults, input.value);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentResults.length > 0) {
          selectedIndex = (selectedIndex - 1 + currentResults.length) % currentResults.length;
          renderResults(currentResults, input.value);
        }
      } else if (e.key === 'Tab') {
        // Cycle through category tabs on Tab key if not selecting an item
        var suggBtn = resultsContainer.querySelector('.search-suggestion-btn');
        if (suggBtn) {
          e.preventDefault();
          var sugg = suggBtn.getAttribute('data-suggestion');
          if (sugg) {
            input.value = sugg;
            performSearch(sugg);
          }
        } else if (!e.shiftKey) {
          e.preventDefault();
          var catIds = CATEGORIES.map(function(c) { return c.id; });
          var curIdx = catIds.indexOf(activeCategory);
          var nextIdx = (curIdx + 1) % catIds.length;
          activeCategory = catIds[nextIdx];
          performSearch(input.value);
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (currentResults.length > 0 && currentResults[selectedIndex]) {
          var targetItem = currentResults[selectedIndex];
          if (targetItem.isAction && typeof targetItem.run === 'function') {
            targetItem.run();
            closeModal();
          } else {
            saveRecentSearch(targetItem);
            closeModal();
            navigateTo(targetItem.route);
          }
        }
      }
    });

    function navigateTo(route) {
      if (!route) return;
      var resolved = resolveBase(route);
      if (route.includes('#')) {
        var hash = '#' + route.split('#')[1];
        var path = route.split('#')[0];
        var curPath = window.location.pathname.replace(/\/$/, '');
        var targetPath = resolveBase(path).replace(/\/$/, '');
        if (curPath === targetPath || !path) {
          highlightAnchorTarget(hash);
          try {
            history.pushState(null, '', resolved);
          } catch (_) {}
          return;
        }
      }
      window.location.href = resolved;
    }

    function highlightAnchorTarget(hash) {
      if (!hash) return;
      var targetId = decodeURIComponent(hash.replace(/^#/, ''));
      var targetEl = document.getElementById(targetId) || document.querySelector('[name="' + targetId + '"]');
      if (targetEl) {
        targetEl.classList.remove('docboot-target-highlight');
        void targetEl.offsetWidth; // trigger reflow
        targetEl.classList.add('docboot-target-highlight');
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(function() {
          targetEl.classList.remove('docboot-target-highlight');
        }, 2400);
      }
    }

    function escapeHtml(str) {
      return (str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }
  }

  // --- 6. Lazy-Loaded Mermaid Diagram Renderer & In-Memory SVG Cache ---
  var mermaidLoading = false;
  var mermaidSvgCache = new Map();
  var mermaidObserver = null;

  function initMermaid(forceRerender) {
    var elements = Array.from(document.querySelectorAll('.mermaid'));
    if (!elements.length) return;

    elements.forEach(function(el) {
      if (!el.getAttribute('data-original-code')) {
        el.setAttribute('data-original-code', el.textContent.trim());
      } else if (forceRerender) {
        el.removeAttribute('data-processed');
      }
    });

    var isDark = document.documentElement.classList.contains('dark');
    var mermaidTheme = isDark ? 'dark' : 'neutral';

    function autoQuoteMermaid(code) {
      return code.split('\n').map(function(line) {
        var out = line.replace(/(\b[a-zA-Z0-9_-]+)\[([^"'\r\n\]]+)\]/g, function(_, node, label) {
          var trimmed = label.trim();
          if (!trimmed.startsWith('"') && !trimmed.startsWith("'")) {
            return node + '["' + trimmed.replace(/"/g, '\\"') + '"]';
          }
          return node + '[' + label + ']';
        });
        out = out.replace(/(\b[a-zA-Z0-9_-]+)\(([^"'\r\n\)]+)\)/g, function(_, node, label) {
          var trimmed = label.trim();
          if (!trimmed.startsWith('"') && !trimmed.startsWith("'") && (trimmed.includes('/') || trimmed.includes(':'))) {
            return node + '("' + trimmed.replace(/"/g, '\\"') + '")';
          }
          return node + '(' + label + ')';
        });
        return out;
      }).join('\n');
    }

    async function renderElement(mermaid, el, index) {
      var rawCode = el.getAttribute('data-original-code') || el.textContent.trim();
      var cacheKey = (isDark ? 'dark:' : 'light:') + rawCode;

      function removeLoader() {
        var loader = el.parentElement ? el.parentElement.querySelector('.docboot-mermaid-loading') : null;
        if (loader) loader.remove();
        el.classList.remove('hidden');
      }

      if (el.getAttribute('data-processed') === 'true' && !forceRerender) {
        removeLoader();
        return;
      }

      // In-memory cache hit: 0ms instant SVG insertion
      if (mermaidSvgCache.has(cacheKey) && !forceRerender) {
        el.innerHTML = mermaidSvgCache.get(cacheKey);
        el.setAttribute('data-processed', 'true');
        removeLoader();
        return;
      }

      var id = 'mermaid-svg-' + index + '-' + Math.random().toString(36).substring(2, 7);

      try {
        var sanitized = autoQuoteMermaid(rawCode);
        var res = await mermaid.render(id, sanitized);
        mermaidSvgCache.set(cacheKey, res.svg);
        el.innerHTML = res.svg;
        el.setAttribute('data-processed', 'true');
        removeLoader();
      } catch (err) {
        console.warn('[docboot] Mermaid render attempt failed:', err);
        try {
          var resFallback = await mermaid.render(id + '-f', rawCode);
          mermaidSvgCache.set(cacheKey, resFallback.svg);
          el.innerHTML = resFallback.svg;
          el.setAttribute('data-processed', 'true');
          removeLoader();
        } catch (e2) {
          console.error('[docboot] Mermaid parse failure:', e2);
          removeLoader();
          el.innerHTML = '<div class="p-3 text-xs font-mono text-left bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-500 leading-relaxed"><p class="font-bold mb-1">Mermaid Render Error</p>' + (err.message || err) + '</div>';
        }
      }
    }

    async function renderAllWith(mermaid) {
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: mermaidTheme,
          fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
          securityLevel: 'loose',
          suppressErrorRendering: true
        });
        for (var i = 0; i < elements.length; i++) {
          await renderElement(mermaid, elements[i], i);
        }
      } catch (e) {
        console.warn('[docboot] Mermaid batch initialization warning:', e);
      }
    }

    function triggerRender() {
      if (window.mermaid) {
        renderAllWith(window.mermaid);
        return;
      }

      if (mermaidLoading) return;
      mermaidLoading = true;

      // Load local mermaid.min.js script on demand
      var script = document.createElement('script');
      script.src = resolveBase('/assets/mermaid.min.js');
      script.onload = function() {
        if (window.mermaid) {
          renderAllWith(window.mermaid);
        }
      };
      script.onerror = function() {
        // Fallback to CDN ESM import if local asset fails
        import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs')
          .then(function(m) {
            window.mermaid = m.default || m;
            renderAllWith(window.mermaid);
          })
          .catch(function(err) {
            console.warn('[docboot] Mermaid failed to load:', err);
          });
      };
      document.head.appendChild(script);
    }

    if (!('IntersectionObserver' in window) || forceRerender) {
      triggerRender();
      return;
    }

    if (mermaidObserver) {
      mermaidObserver.disconnect();
    }

    mermaidObserver = new IntersectionObserver(function(entries) {
      var shouldLoad = entries.some(function(entry) { return entry.isIntersecting; });
      if (shouldLoad) {
        triggerRender();
        if (mermaidObserver) {
          mermaidObserver.disconnect();
          mermaidObserver = null;
        }
      }
    }, { rootMargin: '300px 0px' });

    elements.forEach(function(el) {
      mermaidObserver.observe(el);
    });
  }

  // --- 6.1 Interactive Mermaid Diagram Zoom & Pan Modal ---
  var mermaidModalBound = false;
  var currentMermaidScale = 1;
  var currentMermaidPanX = 0;
  var currentMermaidPanY = 0;

  function updateMermaidTransform() {
    var modal = document.getElementById('docboot-mermaid-modal');
    if (!modal) return;
    var stage = modal.querySelector('#docboot-mermaid-stage');
    var zoomVal = modal.querySelector('#docboot-mermaid-zoom-val');
    if (stage) {
      stage.style.transform = 'translate(' + currentMermaidPanX + 'px, ' + currentMermaidPanY + 'px) scale(' + currentMermaidScale + ')';
    }
    if (zoomVal) {
      zoomVal.textContent = Math.round(currentMermaidScale * 100) + '%';
    }
  }

  function setMermaidZoom(newScale) {
    currentMermaidScale = Math.min(Math.max(newScale, 0.2), 5);
    updateMermaidTransform();
  }

  function resetMermaidView() {
    currentMermaidScale = 1;
    currentMermaidPanX = 0;
    currentMermaidPanY = 0;
    updateMermaidTransform();
  }

  function initMermaidModal() {
    var modal = document.getElementById('docboot-mermaid-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'docboot-mermaid-modal';
      modal.className = 'fixed inset-0 z-50 m-0 w-full h-full bg-black/90 backdrop-blur-xl flex flex-col select-none hidden text-foreground font-sans';
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('role', 'dialog');
      modal.innerHTML = `
        <!-- Floating Header Toolbar -->
        <div class="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-black/50 backdrop-blur-md z-10 select-none flex-shrink-0">
          <div class="flex items-center gap-3">
            <span class="text-xs font-semibold text-accent uppercase tracking-wider flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent/10 border border-accent/20">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h6v6H3zM15 3h6v6h-6zM9 15h6v6H9z"/><path d="M6 9v3a3 3 0 003 3h3m3-6v3a3 3 0 01-3 3"/></svg>
              Mermaid Diagram Viewer
            </span>
            <span id="docboot-mermaid-zoom-val" class="text-xs font-mono text-white/80 px-2 py-0.5 rounded bg-white/10 font-semibold">100%</span>
            <span class="hidden sm:inline-block text-[11px] text-white/50">Drag to pan • Scroll to zoom</span>
          </div>
          <div class="flex items-center gap-2">
            <!-- Zoom Controls -->
            <div class="flex items-center rounded-md border border-white/15 bg-white/5 overflow-hidden">
              <button type="button" id="docboot-mermaid-zoom-out" class="p-1.5 hover:bg-white/15 text-white/80 hover:text-white transition-colors cursor-pointer" title="Zoom Out (-)">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M8 11h6"/></svg>
              </button>
              <button type="button" id="docboot-mermaid-zoom-reset" class="px-2.5 py-1 text-xs font-mono hover:bg-white/15 text-white/80 hover:text-white transition-colors border-x border-white/10 cursor-pointer" title="Reset Zoom (0)">
                Reset
              </button>
              <button type="button" id="docboot-mermaid-zoom-in" class="p-1.5 hover:bg-white/15 text-white/80 hover:text-white transition-colors cursor-pointer" title="Zoom In (+)">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M11 8v6M8 11h6"/></svg>
              </button>
            </div>

            <!-- Close Button -->
            <button type="button" id="docboot-mermaid-modal-close" class="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer ml-2" aria-label="Close Diagram (Esc)">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <!-- Canvas Viewport -->
        <div id="docboot-mermaid-viewport" class="flex-1 w-full h-full relative overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing p-6 sm:p-12">
          <div id="docboot-mermaid-stage" class="transition-transform duration-75 origin-center flex items-center justify-center select-none bg-white text-slate-900 p-8 sm:p-12 rounded-xl shadow-2xl border border-slate-200 min-w-[320px] max-w-[90vw]"></div>
        </div>
      `;
      document.body.appendChild(modal);

      var isDragging = false;
      var startX = 0;
      var startY = 0;

      var viewport = modal.querySelector('#docboot-mermaid-viewport');
      var closeBtn = modal.querySelector('#docboot-mermaid-modal-close');
      var zoomInBtn = modal.querySelector('#docboot-mermaid-zoom-in');
      var zoomOutBtn = modal.querySelector('#docboot-mermaid-zoom-out');
      var zoomResetBtn = modal.querySelector('#docboot-mermaid-zoom-reset');

      closeBtn.addEventListener('click', closeMermaidModal);
      zoomInBtn.addEventListener('click', function(e) { e.stopPropagation(); setMermaidZoom(currentMermaidScale * 1.25); });
      zoomOutBtn.addEventListener('click', function(e) { e.stopPropagation(); setMermaidZoom(currentMermaidScale / 1.25); });
      zoomResetBtn.addEventListener('click', function(e) { e.stopPropagation(); resetMermaidView(); });

      // Pan dragging
      viewport.addEventListener('mousedown', function(e) {
        if (e.target.closest('button')) return;
        isDragging = true;
        startX = e.clientX - currentMermaidPanX;
        startY = e.clientY - currentMermaidPanY;
      });

      window.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        currentMermaidPanX = e.clientX - startX;
        currentMermaidPanY = e.clientY - startY;
        updateMermaidTransform();
      });

      window.addEventListener('mouseup', function() {
        isDragging = false;
      });

      // Mouse wheel zoom
      viewport.addEventListener('wheel', function(e) {
        e.preventDefault();
        var factor = e.deltaY < 0 ? 1.15 : 0.85;
        setMermaidZoom(currentMermaidScale * factor);
      }, { passive: false });

      // Double click reset
      viewport.addEventListener('dblclick', function(e) {
        if (e.target.closest('button')) return;
        resetMermaidView();
      });

      // Click backdrop to close
      viewport.addEventListener('click', function(e) {
        if (e.target === viewport || e.target.id === 'docboot-mermaid-viewport') {
          closeMermaidModal();
        }
      });
    }

    if (mermaidModalBound) return;
    mermaidModalBound = true;

    // Delegated click for expand buttons
    document.addEventListener('click', function(e) {
      var expandBtn = e.target.closest('.docboot-mermaid-expand-btn');
      if (expandBtn) {
        var wrapper = expandBtn.closest('.docboot-mermaid-wrapper');
        if (wrapper) openMermaidModal(wrapper);
        return;
      }
    });

    document.addEventListener('dblclick', function(e) {
      var wrapper = e.target.closest('.docboot-mermaid-wrapper');
      if (wrapper && !e.target.closest('button')) {
        openMermaidModal(wrapper);
      }
    });

    // Global keydown shortcuts
    document.addEventListener('keydown', function(e) {
      var modal = document.getElementById('docboot-mermaid-modal');
      if (!modal || modal.classList.contains('hidden')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMermaidModal();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setMermaidZoom(currentMermaidScale * 1.25);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setMermaidZoom(currentMermaidScale / 1.25);
      } else if (e.key === '0') {
        e.preventDefault();
        resetMermaidView();
      }
    });
  }

  function openMermaidModal(wrapper) {
    initMermaidModal();
    var modal = document.getElementById('docboot-mermaid-modal');
    if (!modal) return;

    // Target the actual rendered Mermaid SVG inside .mermaid container (not the small toolbar icons)
    var mermaidContainer = wrapper.querySelector('.mermaid, pre.mermaid') || wrapper;
    var svgEl = mermaidContainer.querySelector('svg');
    if (!svgEl) {
      console.warn('[docboot] No rendered Mermaid SVG found inside diagram container');
      return;
    }

    var stage = modal.querySelector('#docboot-mermaid-stage');
    if (!stage) return;

    stage.innerHTML = svgEl.outerHTML;
    var clonedSvg = stage.querySelector('svg');
    if (clonedSvg) {
      clonedSvg.removeAttribute('style');
      clonedSvg.removeAttribute('width');
      clonedSvg.removeAttribute('height');
      clonedSvg.style.display = 'block';
      clonedSvg.style.width = '100%';
      clonedSvg.style.height = 'auto';
      clonedSvg.style.minWidth = '320px';
      clonedSvg.style.maxWidth = '100%';
      clonedSvg.style.maxHeight = '80vh';
      clonedSvg.style.margin = '0 auto';
      clonedSvg.style.filter = 'drop-shadow(0 20px 30px rgba(0, 0, 0, 0.4))';
    }

    stage.style.width = 'min(90vw, 1100px)';
    stage.style.maxWidth = '90vw';
    stage.style.margin = '0 auto';

    resetMermaidView();

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    var closeBtn = modal.querySelector('#docboot-mermaid-modal-close');
    trapModalFocus(modal, closeBtn);
    announceA11y('Mermaid diagram viewer opened. Use zoom controls or arrow keys to inspect.');
  }

  function closeMermaidModal() {
    var modal = document.getElementById('docboot-mermaid-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
    releaseModalFocus();
    announceA11y('Mermaid diagram viewer closed');
  }

  // --- 7. Soft SPA-Style Page Navigation & Top Loading Bar ---
  var pageCache = new Map();
  var progressBar = null;
  var progressTimer = null;

  function getProgressBar() {
    if (!progressBar) {
      progressBar = document.createElement('div');
      progressBar.id = 'docboot-progress-bar';
      progressBar.className = 'fixed top-0 left-0 h-[2.5px] bg-gradient-to-r from-blue-500 via-indigo-500 to-accent z-50 pointer-events-none opacity-0 shadow-sm shadow-accent/40';
      progressBar.style.width = '0%';
      document.body.appendChild(progressBar);
    }
    return progressBar;
  }

  function startProgress() {
    var bar = getProgressBar();
    clearTimeout(progressTimer);
    bar.style.transition = 'width 0.25s cubic-bezier(0.1, 0.9, 0.2, 1), opacity 0.1s ease';
    bar.style.width = '0%';
    bar.style.opacity = '1';
    void bar.offsetWidth;
    bar.style.width = '75%';
  }

  function finishProgress() {
    var bar = getProgressBar();
    bar.style.transition = 'width 0.1s ease, opacity 0.15s ease 0.1s';
    bar.style.width = '100%';
    progressTimer = setTimeout(function() {
      bar.style.opacity = '0';
      setTimeout(function() {
        bar.style.width = '0%';
      }, 200);
    }, 120);
  }

  var prefetchQueue = new Set();
  var prefetchObserver = null;

  function prefetchPage(url) {
    if (!url || pageCache.has(url) || prefetchQueue.has(url)) return;
    prefetchQueue.add(url);

    try {
      fetch(url, { priority: 'low' })
        .then(function(res) {
          if (!res.ok) throw new Error('Prefetch error');
          return res.text();
        })
        .then(function(html) {
          pageCache.set(url, html);
          prefetchQueue.delete(url);
        })
        .catch(function() {
          prefetchQueue.delete(url);
        });
    } catch (e) {
      prefetchQueue.delete(url);
    }
  }

  function preloadAllVisibleLinks() {
    if (!('IntersectionObserver' in window)) {
      var idleCallback = window.requestIdleCallback || function(cb) { setTimeout(cb, 100); };
      idleCallback(function() {
        document.querySelectorAll('aside nav a, main a[href^="/"]').forEach(function(a) {
          var href = a.getAttribute('href');
          if (href && href.startsWith('/') && !href.startsWith('//') && !href.includes(':')) {
            prefetchPage(href.split('#')[0]);
          }
        });
      });
      return;
    }

    if (prefetchObserver) {
      prefetchObserver.disconnect();
    }

    prefetchObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var a = entry.target;
          var href = a.getAttribute('href');
          if (href && href.startsWith('/') && !href.startsWith('//') && !href.includes(':')) {
            prefetchPage(href.split('#')[0]);
          }
          prefetchObserver.unobserve(a);
        }
      });
    }, { rootMargin: '200px 0px' });

    document.querySelectorAll('aside nav a, main a[href^="/"]').forEach(function(a) {
      prefetchObserver.observe(a);
    });
  }

  function getElementByHash(hash) {
    if (!hash || hash === '#') return null;
    var rawId = hash.startsWith('#') ? hash.slice(1) : hash;
    var decodedId = rawId;
    try {
      decodedId = decodeURIComponent(rawId);
    } catch (e) {}

    // 1. Direct getElementById (fastest and handles numeric/special character IDs safely)
    var el = document.getElementById(decodedId) || document.getElementById(rawId);
    if (el) return el;

    // 2. Safe querySelector with CSS.escape
    try {
      if (window.CSS && CSS.escape) {
        return (
          document.querySelector('#' + CSS.escape(decodedId)) ||
          document.querySelector('#' + CSS.escape(rawId))
        );
      }
    } catch (e) {}

    // 3. Fallback name anchor
    return (
      document.querySelector('a[name="' + decodedId + '"]') ||
      document.querySelector('a[name="' + rawId + '"]')
    );
  }

  function navigateTo(url, push) {
    if (push === undefined) push = true;

    // 1. Direct in-page hash jump (e.g. clicking TOC or anchor links)
    if (typeof url === 'string' && url.startsWith('#')) {
      var fullTargetUrl = window.location.pathname + window.location.search + url;
      if (push) {
        history.pushState(null, '', fullTargetUrl);
      }
      var el = getElementByHash(url);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    // 2. Resolve URL against base and current origin
    var resolvedUrl = resolveBase(url);
    var targetUrl = new URL(resolvedUrl, window.location.href);
    if (targetUrl.origin !== window.location.origin) {
      window.location.href = url;
      return;
    }

    var cleanPath = targetUrl.pathname;
    var hash = targetUrl.hash;
    var fullTargetUrl = targetUrl.pathname + targetUrl.search + hash;

    // In-page hash scroll
    if (cleanPath === window.location.pathname) {
      if (push && hash) {
        history.pushState(null, '', fullTargetUrl);
      }
      if (hash) {
        var el = getElementByHash(hash);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    startProgress();

    function performDomSwap(htmlString) {
      // 5x faster template extraction than DOMParser
      var tpl = document.createElement('template');
      tpl.innerHTML = htmlString;

      var newMain = tpl.content.querySelector('main');
      var currentMain = document.querySelector('main');

      var newAsideRight = tpl.content.querySelector('aside.hidden.lg\\:block');
      var currentAsideRight = document.querySelector('aside.hidden.lg\\:block');

      if (newMain && currentMain) {
        currentMain.innerHTML = newMain.innerHTML;
      }

      if (newAsideRight && currentAsideRight) {
        currentAsideRight.innerHTML = newAsideRight.innerHTML;
      } else if (currentAsideRight && !newAsideRight) {
        currentAsideRight.innerHTML = '';
      }

      var newSidebarDesktop = tpl.content.querySelector('#docboot-sidebar-desktop, .docboot-sidebar-desktop');
      var currentSidebarDesktop = document.querySelector('#docboot-sidebar-desktop, .docboot-sidebar-desktop');
      if (newSidebarDesktop && currentSidebarDesktop) {
        currentSidebarDesktop.innerHTML = newSidebarDesktop.innerHTML;
      }

      var newSidebarMobile = tpl.content.querySelector('#docboot-mobile-drawer nav, .docboot-mobile-drawer nav');
      var currentSidebarMobile = document.querySelector('#docboot-mobile-drawer nav, .docboot-mobile-drawer nav');
      if (newSidebarMobile && currentSidebarMobile) {
        currentSidebarMobile.innerHTML = newSidebarMobile.innerHTML;
      }

      var titleMatch = htmlString.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch) {
        var decoder = document.createElement('textarea');
        decoder.innerHTML = titleMatch[1];
        document.title = decoder.value;
      }

      // Close mobile drawer if open
      var drawer = document.getElementById('docboot-mobile-drawer') || document.getElementById('euix-mobile-drawer');
      var backdrop = document.getElementById('docboot-mobile-backdrop') || document.getElementById('euix-mobile-backdrop');
      if (drawer && !drawer.classList.contains('-translate-x-full')) {
        drawer.classList.remove('translate-x-0');
        drawer.classList.add('-translate-x-full');
        if (backdrop) backdrop.classList.add('hidden');
        document.body.style.overflow = '';
      }

      // Ensure active sidebar branch is expanded and in view
      autoExpandActiveSidebarBranch(cleanPath);
    }

    function applyNewPageHtml(htmlString) {
      if (document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.startViewTransition(function() {
          performDomSwap(htmlString);
        });
      } else {
        performDomSwap(htmlString);
      }

      if (push) {
        history.pushState(null, '', fullTargetUrl);
      }

      if (hash) {
        var anchor = getElementByHash(hash);
        if (anchor) {
          anchor.scrollIntoView({ behavior: 'smooth' });
        } else {
          window.scrollTo(0, 0);
        }
      } else {
        window.scrollTo(0, 0);
      }

      finishProgress();

      // Dispatch pageview to connected analytics (GA4, Plausible, Umami, Fathom)
      trackPageView();

      // Lazy re-initialization only if components exist on new page
      initTocScrollSpy();
      var currentMain = document.querySelector('main');
      if (currentMain && currentMain.querySelector('.docboot-mermaid-wrapper')) {
        initMermaid(false);
      }
      initMermaidModal();
      initTabs();
      initLightbox();
      initCompareSliders();
      initCarousels();
      preloadAllVisibleLinks();
    }

    function trackPageView() {
      try {
        var path = window.location.pathname + window.location.search;
        var title = document.title;
        var href = window.location.href;

        // 1. Google Analytics (GA4)
        if (typeof window.gtag === 'function') {
          window.gtag('event', 'page_view', {
            page_path: path,
            page_title: title,
            page_location: href
          });
        }

        // 2. Plausible Analytics
        if (typeof window.plausible === 'function') {
          window.plausible('pageview', { u: href });
        }

        // 3. Fathom Analytics
        if (window.fathom && typeof window.fathom.trackPageview === 'function') {
          window.fathom.trackPageview();
        }

        // 4. Umami Analytics
        if (window.umami && typeof window.umami.track === 'function') {
          window.umami.track(function(props) {
            return Object.assign({}, props, { url: path, title: title });
          });
        }
      } catch (err) {
        // Silently ignore analytics dispatch error in dev/offline
      }
    }

    var cached = pageCache.get(cleanPath);
    if (cached) {
      applyNewPageHtml(cached);
      return;
    }

    fetch(cleanPath)
      .then(function(res) {
        if (!res.ok) throw new Error('Navigation failed: ' + res.status);
        return res.text();
      })
      .then(function(html) {
        pageCache.set(cleanPath, html);
        applyNewPageHtml(html);
      })
      .catch(function(err) {
        finishProgress();
        console.error('Soft navigation fallback to hard load:', err);
        window.location.href = url;
      });
  }

  function initSoftNavigation() {
    preloadAllVisibleLinks();

    document.addEventListener('click', function(e) {
      var link = e.target.closest('a');
      if (!link) return;

      var href = link.getAttribute('href');
      if (!href) return;

      // Ignore external, download, or modifier clicks
      if (
        href.startsWith('http://') ||
        href.startsWith('https://') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        link.getAttribute('target') === '_blank' ||
        e.metaKey || e.ctrlKey || e.shiftKey || e.altKey
      ) {
        return;
      }

      // If clicked from search modal, close modal
      var searchModal = link.closest('#docboot-search-modal, #euix-search-modal');
      if (searchModal) {
        searchModal.classList.add('hidden');
        document.body.style.overflow = '';
      }

      e.preventDefault();
      navigateTo(href);
    });

    // Speculative Pointer-Intent prefetching (triggers 100-250ms before click event)
    document.addEventListener('pointerenter', function(e) {
      var link = e.target && e.target.closest ? e.target.closest('a') : null;
      if (!link) return;
      var href = link.getAttribute('href');
      if (href && href.startsWith('/') && !href.startsWith('//') && !href.includes(':')) {
        prefetchPage(href.split('#')[0]);
      }
    }, { capture: true, passive: true });

    document.addEventListener('mouseover', function(e) {
      var link = e.target.closest('a');
      if (!link) return;
      var href = link.getAttribute('href');
      if (href && href.startsWith('/') && !href.startsWith('//')) {
        prefetchPage(href.split('#')[0]);
      }
    });

    document.addEventListener('mousedown', function(e) {
      var link = e.target.closest ? e.target.closest('a') : null;
      if (!link) return;
      var href = link.getAttribute('href');
      if (href && href.startsWith('/') && !href.startsWith('//')) {
        prefetchPage(href.split('#')[0]);
      }
    }, { passive: true });

    document.addEventListener('touchstart', function(e) {
      var link = e.target.closest('a');
      if (!link) return;
      var href = link.getAttribute('href');
      if (href && href.startsWith('/') && !href.startsWith('//')) {
        prefetchPage(href.split('#')[0]);
      }
    }, { passive: true });

    window.addEventListener('popstate', function() {
      navigateTo(window.location.pathname + window.location.hash, false);
    });
  }

  // --- 8. Tabs & Synced Tabs System (Zero-Lag Event Delegation & In-Memory Cache) ---
  var tabGroupCache = new Map();

  function getSavedTab(group) {
    if (!tabGroupCache.has(group)) {
      try {
        tabGroupCache.set(group, localStorage.getItem('docboot-tab:' + group) || '');
      } catch (e) {
        tabGroupCache.set(group, '');
      }
    }
    return tabGroupCache.get(group);
  }

  function setSavedTab(group, label) {
    tabGroupCache.set(group, label);
    setTimeout(function() {
      try {
        localStorage.setItem('docboot-tab:' + group, label);
      } catch (e) {}
    }, 0);
  }

  function switchTab(container, index, syncGroup) {
    var btnList = container.querySelectorAll('.docboot-tab-btn');
    var panels = container.querySelectorAll('.docboot-tab-panel');
    var selectedLabel = '';
    var isCodeGroup = container.classList.contains('docboot-code-group');

    for (var i = 0; i < btnList.length; i++) {
      var btn = btnList[i];
      var isTarget = i === index;
      btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
      btn.setAttribute('tabindex', isTarget ? '0' : '-1');
      if (isTarget) {
        selectedLabel = btn.getAttribute('data-tab-label') || btn.textContent.trim();
        btn.className = isCodeGroup
          ? 'docboot-tab-btn px-3.5 py-2 text-xs transition-all border-b-2 -mb-px rounded-t-md select-none text-accent font-semibold border-accent bg-[#161b22]'
          : 'docboot-tab-btn px-4 py-2 text-xs transition-all border-b-2 -mb-px rounded-t-md select-none border-accent text-accent font-semibold bg-card-bg';
      } else {
        btn.className = isCodeGroup
          ? 'docboot-tab-btn px-3.5 py-2 text-xs transition-all border-b-2 -mb-px rounded-t-md select-none text-[#8b949e] hover:text-[#e6edf3] font-medium border-transparent'
          : 'docboot-tab-btn px-4 py-2 text-xs transition-all border-b-2 -mb-px rounded-t-md select-none border-transparent text-muted-foreground hover:text-foreground font-medium';
      }
    }

    for (var j = 0; j < panels.length; j++) {
      if (j === index) {
        panels[j].classList.remove('hidden');
      } else {
        panels[j].classList.add('hidden');
      }
    }

    var group = container.getAttribute('data-tab-group');
    if (syncGroup && group && selectedLabel) {
      setSavedTab(group, selectedLabel);
      var others = document.querySelectorAll('.docboot-tabs[data-tab-group="' + group + '"]');
      for (var k = 0; k < others.length; k++) {
        if (others[k] !== container) {
          switchTabByLabel(others[k], selectedLabel, false);
        }
      }
    }
  }

  function switchTabByLabel(container, label, syncGroup) {
    var btnList = container.querySelectorAll('.docboot-tab-btn');
    var targetLabel = (label || '').toLowerCase();
    for (var i = 0; i < btnList.length; i++) {
      var bLabel = (btnList[i].getAttribute('data-tab-label') || btnList[i].textContent).trim().toLowerCase();
      if (bLabel === targetLabel) {
        switchTab(container, i, syncGroup);
        return;
      }
    }
  }

  var tabsEventsBound = false;
  function initTabs() {
    var tabContainers = document.querySelectorAll('.docboot-tabs');
    if (!tabContainers.length) return;

    tabContainers.forEach(function(container) {
      var group = container.getAttribute('data-tab-group');
      if (group) {
        var savedLabel = getSavedTab(group);
        if (savedLabel) {
          switchTabByLabel(container, savedLabel, false);
        }
      }
    });

    if (tabsEventsBound) return;
    tabsEventsBound = true;

    // Single delegated listener on document for instant clicks
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('.docboot-tab-btn');
      if (!btn) return;
      var container = btn.closest('.docboot-tabs');
      if (!container) return;

      var btnList = Array.from(container.querySelectorAll('.docboot-tab-btn'));
      var index = btnList.indexOf(btn);
      if (index !== -1) {
        switchTab(container, index, true);
      }
    });

    // Single delegated keyboard navigation listener
    document.addEventListener('keydown', function(e) {
      var btn = e.target.closest('.docboot-tab-btn');
      if (!btn) return;
      var container = btn.closest('.docboot-tabs');
      if (!container) return;

      var btnList = Array.from(container.querySelectorAll('.docboot-tab-btn'));
      var index = btnList.indexOf(btn);
      if (index === -1) return;

      var targetIndex = -1;
      if (e.key === 'ArrowRight') targetIndex = (index + 1) % btnList.length;
      else if (e.key === 'ArrowLeft') targetIndex = (index - 1 + btnList.length) % btnList.length;
      else if (e.key === 'Home') targetIndex = 0;
      else if (e.key === 'End') targetIndex = btnList.length - 1;

      if (targetIndex !== -1) {
        e.preventDefault();
        btnList[targetIndex].focus();
        switchTab(container, targetIndex, true);
      }
    });
  }

  // --- 9. Accessible Image Lightbox Modal System ---
  var activeLightboxTrigger = null;
  var currentLightboxIndex = 0;
  var currentLightboxImages = [];
  var lightboxBound = false;

  function initLightbox() {
    var modal = document.getElementById('docboot-lightbox-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'docboot-lightbox-modal';
      modal.className = 'fixed inset-0 z-50 m-0 w-full h-full max-w-none max-h-none bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-8 outline-none border-0 select-none hidden';
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('role', 'dialog');
      modal.innerHTML = `
        <div class="relative w-full h-full flex flex-col items-center justify-center pointer-events-none">
          <!-- Top Bar -->
          <div class="absolute top-0 left-0 right-0 flex items-center justify-between p-4 pointer-events-auto z-10">
            <div id="docboot-lightbox-counter" class="text-xs font-mono font-semibold text-white/70 px-2.5 py-1 rounded bg-white/10 backdrop-blur-sm"></div>
            <button type="button" id="docboot-lightbox-close" class="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/90 hover:text-white transition-all cursor-pointer" aria-label="Close Lightbox (Esc)">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <!-- Main Image Container -->
          <div class="relative max-w-full max-h-[80vh] flex items-center justify-center pointer-events-auto">
            <img id="docboot-lightbox-img" src="" alt="" class="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl shadow-black/80 transition-all duration-200" />
          </div>

          <!-- Caption -->
          <div id="docboot-lightbox-caption" class="mt-4 text-center text-sm font-medium text-white/90 max-w-2xl px-4 pointer-events-auto"></div>

          <!-- Prev/Next Controls -->
          <button type="button" id="docboot-lightbox-prev" class="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-lg bg-white/10 hover:bg-white/25 text-white transition-all pointer-events-auto cursor-pointer" aria-label="Previous Image (Arrow Left)">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <button type="button" id="docboot-lightbox-next" class="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-lg bg-white/10 hover:bg-white/25 text-white transition-all pointer-events-auto cursor-pointer" aria-label="Next Image (Arrow Right)">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>
      `;
      document.body.appendChild(modal);

      var closeBtn = modal.querySelector('#docboot-lightbox-close');
      var prevBtn = modal.querySelector('#docboot-lightbox-prev');
      var nextBtn = modal.querySelector('#docboot-lightbox-next');

      closeBtn.addEventListener('click', closeLightbox);
      modal.addEventListener('click', function(e) {
        if (e.target === modal || e.target.id === 'docboot-lightbox-modal') {
          closeLightbox();
        }
      });

      prevBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        navigateLightbox(-1);
      });

      nextBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        navigateLightbox(1);
      });

      window.addEventListener('keydown', function(e) {
        if (modal.classList.contains('hidden')) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          closeLightbox();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          navigateLightbox(-1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          navigateLightbox(1);
        }
      });
    }

    if (lightboxBound) return;
    lightboxBound = true;

    // Single delegated click listener for all lightbox triggers
    document.addEventListener('click', function(e) {
      var img = e.target.closest('[data-docboot-lightbox="true"]');
      if (!img) return;
      e.preventDefault();
      openLightbox(img);
    });
  }

  function openLightbox(imgElement) {
    var modal = document.getElementById('docboot-lightbox-modal');
    if (!modal) return;

    activeLightboxTrigger = imgElement;
    var galleryId = imgElement.getAttribute('data-gallery-id');

    if (galleryId) {
      currentLightboxImages = Array.from(document.querySelectorAll(`[data-gallery-id="${galleryId}"]`));
    } else {
      currentLightboxImages = Array.from(document.querySelectorAll('[data-docboot-lightbox="true"]'));
    }

    currentLightboxIndex = currentLightboxImages.indexOf(imgElement);
    if (currentLightboxIndex === -1) currentLightboxIndex = 0;

    updateLightboxView();
    modal.classList.remove('hidden');
    var closeBtn = modal.querySelector('#docboot-lightbox-close');
    trapModalFocus(modal, closeBtn);
    announceA11y('Image lightbox opened. Image ' + (currentLightboxIndex + 1) + ' of ' + currentLightboxImages.length);
  }

  function closeLightbox() {
    var modal = document.getElementById('docboot-lightbox-modal');
    if (modal) modal.classList.add('hidden');
    releaseModalFocus();
    announceA11y('Image lightbox closed');
  }

  function navigateLightbox(delta) {
    if (!currentLightboxImages.length) return;
    currentLightboxIndex = (currentLightboxIndex + delta + currentLightboxImages.length) % currentLightboxImages.length;
    updateLightboxView();
    announceA11y('Image ' + (currentLightboxIndex + 1) + ' of ' + currentLightboxImages.length);
  }

  function updateLightboxView() {
    var modal = document.getElementById('docboot-lightbox-modal');
    if (!modal) return;

    var currentImg = currentLightboxImages[currentLightboxIndex];
    if (!currentImg) return;

    var src = currentImg.getAttribute('data-lightbox-src') || currentImg.getAttribute('src') || '';
    var alt = currentImg.getAttribute('data-lightbox-alt') || currentImg.getAttribute('alt') || '';
    var caption = currentImg.getAttribute('data-lightbox-caption') || alt || '';

    var imgEl = modal.querySelector('#docboot-lightbox-img');
    var capEl = modal.querySelector('#docboot-lightbox-caption');
    var counterEl = modal.querySelector('#docboot-lightbox-counter');
    var prevBtn = modal.querySelector('#docboot-lightbox-prev');
    var nextBtn = modal.querySelector('#docboot-lightbox-next');

    imgEl.src = src;
    imgEl.alt = alt;
    capEl.textContent = caption;

    if (currentLightboxImages.length > 1) {
      counterEl.textContent = (currentLightboxIndex + 1) + ' / ' + currentLightboxImages.length;
      counterEl.classList.remove('hidden');
      prevBtn.classList.remove('hidden');
      nextBtn.classList.remove('hidden');
    } else {
      counterEl.classList.add('hidden');
      prevBtn.classList.add('hidden');
      nextBtn.classList.add('hidden');
    }
  }

  // --- 10. Dev Server Live Reload (SSE) ---
  function initLiveReload() {
    if (!window.__DOCBOOT_DEV__ && !window.__EUIX_DEV__) return;

    try {
      var evtSource = new EventSource('/__docboot_reload');
      evtSource.onmessage = function(event) {
        if (event.data === 'reload') {
          window.location.reload();
        }
      };
    } catch (e) {}
  }

  // --- 11. Scroll Lock & Position Restoration System ---
  function initScrollRestoration() {
    var SIDEBAR_KEY = 'docboot-sidebar-scroll';
    var PAGE_PREFIX = 'docboot-scroll-y:';

    var sidebar = document.getElementById('docboot-sidebar-desktop') || document.querySelector('aside.md\\:block, aside.hidden.md\\:block');

    // 1. Sidebar Scroll Restoration
    if (sidebar) {
      var savedSidebarScroll = sessionStorage.getItem(SIDEBAR_KEY);
      if (savedSidebarScroll !== null) {
        sidebar.scrollTop = parseInt(savedSidebarScroll, 10);
      } else {
        var activeLink = sidebar.querySelector('a.bg-accent\\/10, a.text-accent');
        if (activeLink) {
          activeLink.scrollIntoView({ block: 'nearest' });
        }
      }

      sidebar.addEventListener('scroll', function() {
        sessionStorage.setItem(SIDEBAR_KEY, sidebar.scrollTop);
      }, { passive: true });
    }

    // 2. Window / Article Scroll Restoration (on refresh/reload)
    var currentPath = window.location.pathname;
    var currentHash = window.location.hash;

    if (!currentHash) {
      var savedPageScroll = sessionStorage.getItem(PAGE_PREFIX + currentPath);
      if (savedPageScroll !== null) {
        var targetY = parseInt(savedPageScroll, 10);
        if (targetY > 0) {
          window.scrollTo(0, targetY);
          requestAnimationFrame(function() {
            window.scrollTo(0, targetY);
          });
        }
      }
    } else {
      var anchor = getElementByHash(currentHash);
      if (anchor) {
        setTimeout(function() {
          anchor.scrollIntoView({ behavior: 'smooth' });
        }, 60);
      }
    }

    // Continuously save page scroll position
    var scrollDebounce = null;
    window.addEventListener('scroll', function() {
      clearTimeout(scrollDebounce);
      scrollDebounce = setTimeout(function() {
        sessionStorage.setItem(PAGE_PREFIX + window.location.pathname, window.scrollY);
      }, 80);
    }, { passive: true });

    window.addEventListener('beforeunload', function() {
      if (sidebar) {
        sessionStorage.setItem(SIDEBAR_KEY, sidebar.scrollTop);
      }
      sessionStorage.setItem(PAGE_PREFIX + window.location.pathname, window.scrollY);
    });
  }

  // --- 12. Collapsible Sidebar Groups & Active Branch Expansion ---
  function initSidebarCollapsible() {
    document.addEventListener('click', function(e) {
      var toggleBtn = e.target.closest('.docboot-sidebar-group-toggle');
      if (!toggleBtn) {
        var toggleTitle = e.target.closest('.docboot-sidebar-group-toggle-title');
        if (toggleTitle) {
          var parentGroup = toggleTitle.closest('.docboot-sidebar-group, .docboot-sidebar-root-group');
          if (parentGroup) {
            toggleBtn = parentGroup.querySelector('.docboot-sidebar-group-toggle');
          }
        }
      }

      if (!toggleBtn) return;

      var targetId = toggleBtn.getAttribute('aria-controls');
      var parentGroup = toggleBtn.closest('.docboot-sidebar-group, .docboot-sidebar-root-group');
      var targetSubmenu = (targetId ? document.getElementById(targetId) : null) ||
                          (parentGroup ? parentGroup.querySelector('.docboot-sidebar-submenu') : null);
      if (!targetSubmenu) return;

      var isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
      var nextExpanded = !isExpanded;

      toggleBtn.setAttribute('aria-expanded', String(nextExpanded));
      var svg = toggleBtn.querySelector('svg');

      if (nextExpanded) {
        targetSubmenu.classList.remove('hidden');
        if (svg) {
          svg.classList.remove('-rotate-90');
          svg.classList.add('rotate-0');
        }
      } else {
        targetSubmenu.classList.add('hidden');
        if (svg) {
          svg.classList.remove('rotate-0');
          svg.classList.add('-rotate-90');
        }
      }

      if (targetId) {
        try {
          var saved = JSON.parse(localStorage.getItem('docboot-sidebar-collapsed') || '{}');
          saved[targetId] = !nextExpanded;
          localStorage.setItem('docboot-sidebar-collapsed', JSON.stringify(saved));
        } catch (err) {}
      }
    });
  }

  function autoExpandActiveSidebarBranch(cleanPath) {
    document.querySelectorAll('.docboot-sidebar-desktop a, .docboot-mobile-drawer a').forEach(function(a) {
      var href = a.getAttribute('href');
      if (!href) return;
      var aUrl = new URL(href, window.location.origin);
      var isCurrent = aUrl.pathname === cleanPath ||
                      aUrl.pathname === cleanPath.replace(/\/$/, '') ||
                      cleanPath === aUrl.pathname.replace(/\/$/, '');

      if (isCurrent) {
        a.setAttribute('aria-current', 'page');

        // Auto expand all parent submenus of this active link
        var parentSubmenu = a.closest('.docboot-sidebar-submenu');
        while (parentSubmenu) {
          parentSubmenu.classList.remove('hidden');
          var parentGroup = parentSubmenu.closest('.docboot-sidebar-group, .docboot-sidebar-root-group');
          var toggle = (parentSubmenu.id ? document.querySelector('[aria-controls="' + parentSubmenu.id + '"]') : null) ||
                       (parentGroup ? parentGroup.querySelector('.docboot-sidebar-group-toggle') : null);
          if (toggle) {
            toggle.setAttribute('aria-expanded', 'true');
            var svg = toggle.querySelector('svg');
            if (svg) {
              svg.classList.remove('-rotate-90');
              svg.classList.add('rotate-0');
            }
          }
          parentSubmenu = parentSubmenu.parentElement ? parentSubmenu.parentElement.closest('.docboot-sidebar-submenu') : null;
        }
      }
    });
  }

  // --- 1. Before / After Comparison Slider ---
  function initCompareSliders() {
    var sliders = document.querySelectorAll('.docboot-compare[data-docboot-compare="true"]');
    sliders.forEach(function(slider) {
      if (slider._docbootCompareInit) return;
      slider._docbootCompareInit = true;

      var container = slider.querySelector('.docboot-compare-container');
      var beforeOverlay = slider.querySelector('.docboot-compare-before');
      var handle = slider.querySelector('.docboot-compare-handle');
      if (!container || !beforeOverlay || !handle) return;

      var isDragging = false;

      function updatePosition(clientX) {
        var rect = container.getBoundingClientRect();
        if (rect.width <= 0) return;
        var x = clientX - rect.left;
        var percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
        beforeOverlay.style.clipPath = 'inset(0 ' + (100 - percentage) + '% 0 0)';
        beforeOverlay.style.webkitClipPath = 'inset(0 ' + (100 - percentage) + '% 0 0)';
        beforeOverlay.style.width = percentage + '%';
        handle.style.left = percentage + '%';
        handle.setAttribute('aria-valuenow', Math.round(percentage));
      }

      function onPointerDown(e) {
        if (e.button !== undefined && e.button !== 0) return;
        isDragging = true;
        try {
          if (container.setPointerCapture && e.pointerId !== undefined) {
            container.setPointerCapture(e.pointerId);
          }
        } catch (_) {}
        var clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0].clientX);
        if (clientX !== undefined) updatePosition(clientX);
        if (e.cancelable) e.preventDefault();
      }

      function onPointerMove(e) {
        if (!isDragging) return;
        var clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0].clientX);
        if (clientX !== undefined) {
          updatePosition(clientX);
          if (e.cancelable) e.preventDefault();
        }
      }

      function onPointerUp(e) {
        if (!isDragging) return;
        isDragging = false;
        try {
          if (container.releasePointerCapture && e.pointerId !== undefined) {
            container.releasePointerCapture(e.pointerId);
          }
        } catch (_) {}
      }

      if (window.PointerEvent) {
        container.addEventListener('pointerdown', onPointerDown);
        container.addEventListener('pointermove', onPointerMove);
        container.addEventListener('pointerup', onPointerUp);
        container.addEventListener('pointercancel', onPointerUp);
      } else {
        container.addEventListener('mousedown', onPointerDown);
        window.addEventListener('mousemove', onPointerMove);
        window.addEventListener('mouseup', onPointerUp);

        container.addEventListener('touchstart', onPointerDown, { passive: false });
        window.addEventListener('touchmove', onPointerMove, { passive: false });
        window.addEventListener('touchend', onPointerUp);
      }

      handle.addEventListener('keydown', function(e) {
        var current = parseFloat(handle.getAttribute('aria-valuenow') || '50');
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          var next = Math.max(0, current - 5);
          beforeOverlay.style.clipPath = 'inset(0 ' + (100 - next) + '% 0 0)';
          beforeOverlay.style.webkitClipPath = 'inset(0 ' + (100 - next) + '% 0 0)';
          beforeOverlay.style.width = next + '%';
          handle.style.left = next + '%';
          handle.setAttribute('aria-valuenow', next);
          e.preventDefault();
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          var next = Math.min(100, current + 5);
          beforeOverlay.style.clipPath = 'inset(0 ' + (100 - next) + '% 0 0)';
          beforeOverlay.style.webkitClipPath = 'inset(0 ' + (100 - next) + '% 0 0)';
          beforeOverlay.style.width = next + '%';
          handle.style.left = next + '%';
          handle.setAttribute('aria-valuenow', next);
          e.preventDefault();
        }
      });
    });
  }

  // --- 2. Carousel Walkthrough ---
  function initCarousels() {
    var carousels = document.querySelectorAll('.docboot-carousel[data-docboot-carousel="true"]');
    carousels.forEach(function(carousel) {
      if (carousel._docbootCarouselInit) return;
      carousel._docbootCarouselInit = true;

      var slides = carousel.querySelectorAll('.docboot-carousel-slide');
      var prevBtn = carousel.querySelector('.docboot-carousel-prev');
      var nextBtn = carousel.querySelector('.docboot-carousel-next');
      var counter = carousel.querySelector('.docboot-carousel-counter');
      if (slides.length <= 1) return;

      var currentIndex = 0;

      function showSlide(index) {
        if (index < 0) index = slides.length - 1;
        if (index >= slides.length) index = 0;
        currentIndex = index;

        slides.forEach(function(s, idx) {
          if (idx === currentIndex) {
            s.classList.remove('hidden');
            s.classList.add('block');
            var img = s.querySelector('img');
            if (img && img.getAttribute('loading') === 'lazy') {
              img.setAttribute('loading', 'eager');
            }
          } else {
            s.classList.remove('block');
            s.classList.add('hidden');
          }
        });

        if (counter) {
          counter.textContent = (currentIndex + 1) + ' / ' + slides.length;
        }
      }

      if (prevBtn) {
        prevBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          showSlide(currentIndex - 1);
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          showSlide(currentIndex + 1);
        });
      }

      var startX = 0;
      carousel.addEventListener('touchstart', function(e) {
        startX = e.touches[0].clientX;
      }, { passive: true });

      carousel.addEventListener('touchend', function(e) {
        var diffX = e.changedTouches[0].clientX - startX;
        if (Math.abs(diffX) > 40) {
          if (diffX > 0) showSlide(currentIndex - 1);
          else showSlide(currentIndex + 1);
        }
      });
    });
  }

  // --- 3. Collapsible Code Blocks ---
  function initCollapsibleCodeBlocks() {
    document.addEventListener('click', function(e) {
      var expandBtn = e.target.closest('.docboot-code-expand-btn');
      if (!expandBtn) return;
      var codeblock = expandBtn.closest('.docboot-codeblock');
      if (!codeblock) return;

      var isCollapsed = codeblock.classList.contains('is-collapsed');
      var nextState = !isCollapsed;

      if (nextState) {
        codeblock.classList.add('is-collapsed');
        expandBtn.setAttribute('aria-expanded', 'false');
        var textSpan = expandBtn.querySelector('.expand-text');
        if (textSpan) textSpan.textContent = 'Show full example';
        var svg = expandBtn.querySelector('svg');
        if (svg) svg.classList.remove('rotate-180');
      } else {
        codeblock.classList.remove('is-collapsed');
        expandBtn.setAttribute('aria-expanded', 'true');
        var textSpan = expandBtn.querySelector('.expand-text');
        if (textSpan) textSpan.textContent = 'Collapse example';
        var svg = expandBtn.querySelector('svg');
        if (svg) svg.classList.add('rotate-180');
      }
    });
  }

  // --- 4. Copy Page as Markdown ---
  function initCopyPageMarkdown() {
    document.addEventListener('click', function(e) {
      var copyMdBtn = e.target.closest('.docboot-copy-page-md-btn');
      if (!copyMdBtn) return;
      var sourceUrl = copyMdBtn.getAttribute('data-source-url');
      if (!sourceUrl) return;

      var textSpan = copyMdBtn.querySelector('.copy-page-md-text');
      var originalText = textSpan ? textSpan.textContent : 'Copy Markdown';

      fetch(sourceUrl)
        .then(function(res) {
          if (!res.ok) throw new Error('Failed to fetch source');
          return res.text();
        })
        .then(function(md) {
          return navigator.clipboard.writeText(md);
        })
        .then(function() {
          if (textSpan) textSpan.textContent = 'Copied Markdown!';
          copyMdBtn.classList.add('text-emerald-400', 'border-emerald-500/50');
          setTimeout(function() {
            if (textSpan) textSpan.textContent = originalText;
            copyMdBtn.classList.remove('text-emerald-400', 'border-emerald-500/50');
          }, 2000);
        })
        .catch(function() {
          if (textSpan) textSpan.textContent = 'Copy failed';
          setTimeout(function() {
            if (textSpan) textSpan.textContent = originalText;
          }, 2000);
        });
    });
  }

  // --- 13. PWA Auto-Update Notification Banner & Service Worker Lifecycle ---
  function initPwaAutoUpdate() {
    window.addEventListener('docboot:pwa-update', function(e) {
      var registration = e.detail && e.detail.registration;
      if (!registration || !registration.waiting) return;

      // Avoid duplicate toasts
      if (document.getElementById('docboot-pwa-toast')) return;

      var toast = document.createElement('aside');
      toast.id = 'docboot-pwa-toast';
      toast.setAttribute('role', 'alert');
      toast.setAttribute('aria-live', 'polite');
      toast.className = 'fixed bottom-4 right-4 z-50 max-w-sm w-[calc(100vw-2rem)] p-3.5 bg-card/95 backdrop-blur-md border border-accent/40 rounded-xl shadow-xl flex items-center justify-between gap-3 text-sm text-card-foreground animate-in fade-in slide-in-from-bottom-3 duration-300 ring-1 ring-accent/20';

      var leftDiv = document.createElement('div');
      leftDiv.className = 'flex items-center gap-2.5 min-w-0';

      var iconSpan = document.createElement('span');
      iconSpan.className = 'w-7 h-7 rounded-lg bg-accent/15 border border-accent/30 text-accent flex items-center justify-center shrink-0';
      iconSpan.innerHTML = '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>';

      var textDiv = document.createElement('div');
      textDiv.className = 'min-w-0';
      textDiv.innerHTML = '<div class="font-medium text-xs sm:text-sm text-foreground truncate">Update Available</div><div class="text-[11px] text-muted-foreground truncate">New documentation version is ready.</div>';

      leftDiv.appendChild(iconSpan);
      leftDiv.appendChild(textDiv);

      var actionsDiv = document.createElement('div');
      actionsDiv.className = 'flex items-center gap-1.5 shrink-0';

      var reloadBtn = document.createElement('button');
      reloadBtn.type = 'button';
      reloadBtn.className = 'px-2.5 py-1.5 rounded-lg bg-accent text-accent-foreground font-semibold text-xs hover:bg-accent/90 transition-colors shadow-2xs cursor-pointer';
      reloadBtn.textContent = 'Refresh';
      reloadBtn.addEventListener('click', function() {
        reloadBtn.disabled = true;
        reloadBtn.textContent = 'Updating...';
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      });

      var dismissBtn = document.createElement('button');
      dismissBtn.type = 'button';
      dismissBtn.className = 'w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer';
      dismissBtn.setAttribute('aria-label', 'Dismiss update notification');
      dismissBtn.innerHTML = '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>';
      dismissBtn.addEventListener('click', function() {
        toast.remove();
      });

      actionsDiv.appendChild(reloadBtn);
      actionsDiv.appendChild(dismissBtn);

      toast.appendChild(leftDiv);
      toast.appendChild(actionsDiv);
      document.body.appendChild(toast);
    });
  }

  // --- 16. JSON Tree Expand / Collapse Controller ---
  function initJsonTrees() {
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('.docboot-json-toggle-btn');
      if (!btn) return;
      var action = btn.getAttribute('data-action');
      var container = btn.closest('[data-docboot-json-tree="true"]');
      if (!container) return;

      var detailsNodes = container.querySelectorAll('.docboot-json-node');
      detailsNodes.forEach(function(node) {
        if (action === 'expand') {
          node.open = true;
        } else if (action === 'collapse') {
          node.open = false;
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    initTheme();
    initCopyButtons();
    initTocScrollSpy();
    initMobileDrawer();
    initSearch();
    initMermaid(false);
    initMermaidModal();
    initTabs();
    initLightbox();
    initCompareSliders();
    initCarousels();
    initCollapsibleCodeBlocks();
    initCopyPageMarkdown();
    initJsonTrees();
    initSoftNavigation();
    initLiveReload();
    initScrollRestoration();
    initSidebarCollapsible();
    initPwaAutoUpdate();
  });
})();


