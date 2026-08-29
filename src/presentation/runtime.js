/**
 * Docboot Presentation Client Runtime (<4KB Zero-dependency)
 * Handles 2D slide navigation, slide counter pagination, smooth slide scrolling,
 * on-demand Mermaid diagram rendering, keyboard shortcuts, touch gestures, URL hash sync,
 * fullscreen mode, presenter view, slide overview grid, shortcuts cheat-sheet,
 * local timer, and live reload.
 */

(function () {
  'use strict';

  var slides = Array.from(document.querySelectorAll('.docboot-slide'));
  var totalSlides = slides.length;
  if (!totalSlides) return;

  var currentSlide = 1;
  var isPresenterOpen = false;
  var isOverviewOpen = false;
  var isHelpOpen = false;
  var timerSeconds = 0;
  var timerInterval = null;
  var isTimerRunning = false;
  var notesFontSize = 1.4;
  var mermaidLoaded = false;

  var progressBar = document.getElementById('docboot-presentation-progress');
  var slideCounter = document.getElementById('docboot-presentation-counter');
  var verticalNav = document.getElementById('docboot-vertical-nav');
  var presenterView = document.getElementById('docboot-presenter-view');
  var overviewModal = document.getElementById('docboot-overview-modal');
  var helpModal = document.getElementById('docboot-help-modal');

  var presenterCurrent = document.getElementById('docboot-presenter-current');
  var presenterNext = document.getElementById('docboot-presenter-next');
  var presenterNotes = document.getElementById('docboot-presenter-notes');
  var presenterTimer = document.getElementById('docboot-presenter-timer-display');
  var presenterCounter = document.getElementById('docboot-presenter-counter-display');

  // --- 1. URL Hash Resolution (#12 or #7.3) ---
  function getSlideFromHash() {
    var hash = window.location.hash.replace(/^#/, '').trim();
    if (!hash) return 1;

    // Check h.v notation (e.g. 2.1, 2.2)
    if (hash.includes('.')) {
      var parts = hash.split('.');
      var h = parseInt(parts[0], 10);
      var v = parseInt(parts[1], 10);
      for (var i = 0; i < slides.length; i++) {
        var el = slides[i];
        if (parseInt(el.getAttribute('data-h'), 10) === h && parseInt(el.getAttribute('data-v'), 10) === v) {
          return i + 1;
        }
      }
    }

    var parsed = parseInt(hash, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalSlides) {
      return parsed;
    }
    return 1;
  }

  // --- 2. 2D Navigation Engine ---
  function getSlideMeta(index) {
    var el = slides[index - 1];
    if (!el) return null;
    var vCount = parseInt(el.getAttribute('data-v-count') || 1, 10);
    return {
      index: index,
      h: parseInt(el.getAttribute('data-h') || index, 10),
      v: parseInt(el.getAttribute('data-v') || 1, 10),
      vCount: vCount,
      isVertical: vCount > 1,
      displayIndex: el.getAttribute('data-display-index') || ('' + index),
      el: el
    };
  }

  // --- 3. On-Demand Mermaid Diagram Renderer ---
  function renderMermaidInSlide(slideEl) {
    if (!slideEl) return;
    var diagrams = Array.from(slideEl.querySelectorAll('.mermaid'));
    if (!diagrams.length) return;

    function renderAll(mermaid) {
      var isDark = document.documentElement.classList.contains('dark');
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'neutral',
          securityLevel: 'loose',
          fontFamily: 'inherit'
        });

        diagrams.forEach(async function (el, idx) {
          var loader = el.parentElement ? el.parentElement.querySelector('.docboot-mermaid-loading') : null;
          var rawCode = el.getAttribute('data-mermaid-src') || el.textContent || '';
          if (!el.getAttribute('data-mermaid-src')) {
            el.setAttribute('data-mermaid-src', rawCode);
          }

          if (rawCode) {
            var id = 'pres-mermaid-' + currentSlide + '-' + idx + '-' + Math.random().toString(36).substring(2, 6);
            try {
              var res = await mermaid.render(id, rawCode);
              el.innerHTML = res.svg;
              el.classList.remove('hidden');
              if (loader) loader.style.display = 'none';
            } catch (err) {
              if (loader) loader.style.display = 'none';
              el.classList.remove('hidden');
            }
          }
        });
      } catch (e) {}
    }

    if (window.mermaid) {
      renderAll(window.mermaid);
      return;
    }

    if (!mermaidLoaded) {
      mermaidLoaded = true;
      import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs')
        .then(function (m) {
          window.mermaid = m.default || m;
          renderAll(window.mermaid);
        })
        .catch(function () {
          // If offline / no cdn, fallback to revealing code blocks
          diagrams.forEach(function (el) {
            var loader = el.parentElement ? el.parentElement.querySelector('.docboot-mermaid-loading') : null;
            if (loader) loader.style.display = 'none';
            el.classList.remove('hidden');
          });
        });
    }
  }

  function updateSlide(targetIndex, pushHistory, direction) {
    if (targetIndex < 1) targetIndex = 1;
    if (targetIndex > totalSlides) targetIndex = totalSlides;

    currentSlide = targetIndex;
    var currentMeta = getSlideMeta(currentSlide);

    // Update active slide class
    for (var i = 0; i < slides.length; i++) {
      var slide = slides[i];
      if (i + 1 === currentSlide) {
        slide.classList.add('active');
        slide.setAttribute('aria-hidden', 'false');
        slide.scrollTop = 0; // Reset scroll position on new slide

        // Auto-scale slide content if slightly overflowing to fit perfectly
        slide.style.transform = '';
        requestAnimationFrame(function () {
          if (slide.scrollHeight > slide.clientHeight + 10) {
            var ratio = slide.clientHeight / slide.scrollHeight;
            if (ratio >= 0.78) {
              slide.style.transformOrigin = 'top left';
              slide.style.transform = 'scale(' + (Math.floor(ratio * 96) / 100) + ')';
              slide.style.width = (100 / ratio) + '%';
            }
          }
        });

        if (direction === 'down') {
          slide.classList.add('slide-v-enter-down');
          setTimeout(function (s) { s.classList.remove('slide-v-enter-down'); }, 250, slide);
        } else if (direction === 'up') {
          slide.classList.add('slide-v-enter-up');
          setTimeout(function (s) { s.classList.remove('slide-v-enter-up'); }, 250, slide);
        }

        // Render Mermaid diagrams on active slide
        renderMermaidInSlide(slide);
      } else {
        slide.classList.remove('active');
        slide.style.transform = '';
        slide.style.width = '';
        slide.setAttribute('aria-hidden', 'true');
      }
    }

    // Update Vertical Navigation Indicator Dots
    if (verticalNav) {
      if (currentMeta && currentMeta.vCount > 1) {
        verticalNav.style.display = 'flex';
        var dotsHtml = '';
        for (var v = 1; v <= currentMeta.vCount; v++) {
          var isActive = v === currentMeta.v;
          dotsHtml += '<button class="docboot-vdot' + (isActive ? ' active' : '') + '" data-jump-v="' + v + '" aria-label="Vertical sub-slide ' + v + '"></button>';
        }
        verticalNav.innerHTML = dotsHtml;
      } else {
        verticalNav.style.display = 'none';
        verticalNav.innerHTML = '';
      }
    }

    // Update overview active card
    if (overviewModal) {
      var cards = overviewModal.querySelectorAll('.docboot-overview-card');
      for (var j = 0; j < cards.length; j++) {
        if (j + 1 === currentSlide) {
          cards[j].classList.add('active');
        } else {
          cards[j].classList.remove('active');
        }
      }
    }

    // Update progress bar
    if (progressBar) {
      var percent = (currentSlide / totalSlides) * 100;
      progressBar.style.width = percent + '%';
    }

    // Update slide counter: clean linear pagination "12 / 16"
    if (slideCounter) {
      slideCounter.textContent = currentSlide + ' / ' + totalSlides;
    }

    // Update URL hash: clean "#12" (or supporting back/forward)
    if (pushHistory !== false) {
      var targetHash = '#' + currentSlide;
      if (window.location.hash !== targetHash) {
        history.pushState(null, '', targetHash);
      }
    }

    // Update Presenter View if active
    updatePresenterView();
  }

  // --- 4. Directional Navigation (Horizontal + Vertical 2D Grid) ---
  function nextHorizontal() {
    var cur = getSlideMeta(currentSlide);
    if (!cur) return;
    for (var i = 0; i < slides.length; i++) {
      var meta = getSlideMeta(i + 1);
      if (meta && meta.h > cur.h) {
        updateSlide(meta.index);
        return;
      }
    }
    if (currentSlide < totalSlides) {
      updateSlide(currentSlide + 1);
    }
  }

  function prevHorizontal() {
    var cur = getSlideMeta(currentSlide);
    if (!cur) return;
    for (var i = slides.length - 1; i >= 0; i--) {
      var meta = getSlideMeta(i + 1);
      if (meta && meta.h === cur.h - 1 && meta.v === 1) {
        updateSlide(meta.index);
        return;
      }
    }
    if (currentSlide > 1) {
      updateSlide(currentSlide - 1);
    }
  }

  function nextVertical() {
    var cur = getSlideMeta(currentSlide);
    var curSlideEl = slides[currentSlide - 1];

    if (curSlideEl && (curSlideEl.scrollTop + curSlideEl.clientHeight < curSlideEl.scrollHeight - 30)) {
      curSlideEl.scrollBy({ top: 260, behavior: 'smooth' });
      return;
    }

    if (cur && cur.v < cur.vCount) {
      for (var i = 0; i < slides.length; i++) {
        var meta = getSlideMeta(i + 1);
        if (meta && meta.h === cur.h && meta.v === cur.v + 1) {
          updateSlide(meta.index, true, 'down');
          return;
        }
      }
    }

    if (currentSlide < totalSlides) {
      updateSlide(currentSlide + 1, true, 'down');
    }
  }

  function prevVertical() {
    var cur = getSlideMeta(currentSlide);
    var curSlideEl = slides[currentSlide - 1];

    if (curSlideEl && curSlideEl.scrollTop > 30) {
      curSlideEl.scrollBy({ top: -260, behavior: 'smooth' });
      return;
    }

    if (cur && cur.v > 1) {
      for (var i = 0; i < slides.length; i++) {
        var meta = getSlideMeta(i + 1);
        if (meta && meta.h === cur.h && meta.v === cur.v - 1) {
          updateSlide(meta.index, true, 'up');
          return;
        }
      }
    }

    if (currentSlide > 1) {
      updateSlide(currentSlide - 1, true, 'up');
    }
  }

  function nextSlide() {
    if (currentSlide < totalSlides) {
      updateSlide(currentSlide + 1);
    }
  }

  function prevSlide() {
    if (currentSlide > 1) {
      updateSlide(currentSlide - 1);
    }
  }

  function firstSlide() {
    updateSlide(1);
  }

  function lastSlide() {
    updateSlide(totalSlides);
  }

  // --- 5. Overview Grid & Help Modals ---
  function toggleOverview() {
    isOverviewOpen = !isOverviewOpen;
    if (overviewModal) {
      if (isOverviewOpen) {
        overviewModal.classList.add('open');
      } else {
        overviewModal.classList.remove('open');
      }
    }
  }

  function toggleHelp() {
    isHelpOpen = !isHelpOpen;
    if (helpModal) {
      if (isHelpOpen) {
        helpModal.classList.add('open');
      } else {
        helpModal.classList.remove('open');
      }
    }
  }

  // --- 6. Fullscreen Controller ---
  function toggleFullscreen() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      var el = document.documentElement;
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(function () {});
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(function () {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  }

  // --- 7. Presenter Mode & Timer ---
  function updatePresenterView() {
    if (!presenterView) return;

    var curSlideEl = slides[currentSlide - 1];
    var nextSlideEl = slides[currentSlide] || null;
    var curMeta = getSlideMeta(currentSlide);

    if (presenterCurrent && curSlideEl) {
      presenterCurrent.innerHTML = curSlideEl.innerHTML;
    }

    if (presenterNext) {
      if (nextSlideEl) {
        presenterNext.innerHTML = nextSlideEl.innerHTML;
      } else {
        presenterNext.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#8b949e;font-style:italic;">End of Presentation</div>';
      }
    }

    if (presenterNotes && curSlideEl) {
      var notes = curSlideEl.getAttribute('data-notes') || '';
      presenterNotes.innerHTML = notes ? notes.replace(/\n/g, '<br>') : '';
    }

    if (presenterCounter && curMeta) {
      presenterCounter.textContent = currentSlide + ' / ' + totalSlides + (curMeta.isVertical ? ' (Sub-slide ' + curMeta.displayIndex + ')' : '');
    }
  }

  function formatTime(totalSec) {
    var mins = Math.floor(totalSec / 60);
    var secs = totalSec % 60;
    return (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
  }

  function startTimer() {
    if (isTimerRunning) return;
    isTimerRunning = true;
    timerInterval = setInterval(function () {
      timerSeconds++;
      if (presenterTimer) {
        presenterTimer.textContent = formatTime(timerSeconds);
      }
    }, 1000);
  }

  function pauseTimer() {
    isTimerRunning = false;
    if (timerInterval) clearInterval(timerInterval);
  }

  function resetTimer() {
    pauseTimer();
    timerSeconds = 0;
    if (presenterTimer) {
      presenterTimer.textContent = '00:00';
    }
  }

  function togglePresenter() {
    isPresenterOpen = !isPresenterOpen;
    if (presenterView) {
      if (isPresenterOpen) {
        presenterView.classList.add('open');
        updatePresenterView();
        startTimer();
      } else {
        presenterView.classList.remove('open');
      }
    }
  }

  // --- 8. Theme Switcher ---
  function toggleTheme() {
    var html = document.documentElement;
    var isDark = html.classList.contains('dark');
    if (isDark) {
      html.classList.remove('dark');
      localStorage.setItem('docboot-theme', 'light');
    } else {
      html.classList.add('dark');
      localStorage.setItem('docboot-theme', 'dark');
    }

    // Re-render Mermaid on active slide with updated theme
    var curSlideEl = slides[currentSlide - 1];
    if (curSlideEl && window.mermaid) {
      renderMermaidInSlide(curSlideEl);
    }
  }

  // --- 9. Event Listeners ---
  document.addEventListener('keydown', function (e) {
    // Ignore input fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      return;
    }

    switch (e.key) {
      case 'ArrowRight':
      case 'l':
      case 'L':
        e.preventDefault();
        nextHorizontal();
        break;

      case 'ArrowLeft':
      case 'h':
      case 'H':
        e.preventDefault();
        prevHorizontal();
        break;

      case 'ArrowDown':
      case 'j':
      case 'J':
        e.preventDefault();
        nextVertical();
        break;

      case 'ArrowUp':
      case 'k':
      case 'K':
        e.preventDefault();
        prevVertical();
        break;

      case ' ':
      case 'PageDown':
      case 'n':
      case 'N':
        e.preventDefault();
        nextSlide();
        break;

      case 'PageUp':
      case 'p':
      case 'P':
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          togglePresenter();
        }
        break;

      case 'Home':
        e.preventDefault();
        firstSlide();
        break;

      case 'End':
        e.preventDefault();
        lastSlide();
        break;

      case 'o':
      case 'O':
      case 'g':
      case 'G':
        e.preventDefault();
        toggleOverview();
        break;

      case '?':
        e.preventDefault();
        toggleHelp();
        break;

      case 'f':
      case 'F':
        e.preventDefault();
        toggleFullscreen();
        break;

      case 't':
      case 'T':
        e.preventDefault();
        toggleTheme();
        break;

      case 'Escape':
        if (isOverviewOpen) {
          toggleOverview();
        } else if (isHelpOpen) {
          toggleHelp();
        } else if (isPresenterOpen) {
          togglePresenter();
        }
        break;
    }
  });

  // URL Hash Changes (Browser Back/Forward)
  window.addEventListener('popstate', function () {
    updateSlide(getSlideFromHash(), false);
  });

  // Touch Swipe Support
  var touchStartX = 0;
  var touchStartY = 0;

  document.addEventListener('touchstart', function (e) {
    if (e.touches && e.touches.length > 0) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  document.addEventListener('touchend', function (e) {
    if (e.changedTouches && e.changedTouches.length > 0) {
      var touchEndX = e.changedTouches[0].clientX;
      var touchEndY = e.changedTouches[0].clientY;
      var diffX = touchEndX - touchStartX;
      var diffY = touchEndY - touchStartY;

      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 40) {
        if (diffX < 0) {
          nextHorizontal();
        } else {
          prevHorizontal();
        }
      } else if (Math.abs(diffY) > 40) {
        if (diffY < 0) {
          nextVertical();
        } else {
          prevVertical();
        }
      }
    }
  }, { passive: true });

  // Control Buttons
  var prevBtn = document.getElementById('docboot-btn-prev');
  if (prevBtn) prevBtn.addEventListener('click', prevSlide);

  var nextBtn = document.getElementById('docboot-btn-next');
  if (nextBtn) nextBtn.addEventListener('click', nextSlide);

  var overviewBtn = document.getElementById('docboot-btn-overview');
  if (overviewBtn) overviewBtn.addEventListener('click', toggleOverview);

  var fullscreenBtn = document.getElementById('docboot-btn-fullscreen');
  if (fullscreenBtn) fullscreenBtn.addEventListener('click', toggleFullscreen);

  var presenterBtn = document.getElementById('docboot-btn-presenter');
  if (presenterBtn) presenterBtn.addEventListener('click', togglePresenter);

  var helpBtn = document.getElementById('docboot-btn-help');
  if (helpBtn) helpBtn.addEventListener('click', toggleHelp);

  var themeBtn = document.getElementById('docboot-btn-theme');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // Vertical Dot Indicator Jump Clicks
  if (verticalNav) {
    verticalNav.addEventListener('click', function (e) {
      var dot = e.target.closest('[data-jump-v]');
      if (dot) {
        var targetV = parseInt(dot.getAttribute('data-jump-v'), 10);
        var cur = getSlideMeta(currentSlide);
        if (cur && !isNaN(targetV)) {
          for (var i = 0; i < slides.length; i++) {
            var meta = getSlideMeta(i + 1);
            if (meta && meta.h === cur.h && meta.v === targetV) {
              updateSlide(meta.index);
              return;
            }
          }
        }
      }
    });
  }

  // Overview Jump Clicks
  if (overviewModal) {
    overviewModal.addEventListener('click', function (e) {
      var card = e.target.closest('[data-jump-slide]');
      if (card) {
        var targetIndex = parseInt(card.getAttribute('data-jump-slide'), 10);
        if (!isNaN(targetIndex)) {
          updateSlide(targetIndex);
          toggleOverview();
        }
      }
    });

    var overviewCloseBtn = document.getElementById('docboot-overview-btn-close');
    if (overviewCloseBtn) overviewCloseBtn.addEventListener('click', toggleOverview);
  }

  // Help Modal Close
  var helpCloseBtn = document.getElementById('docboot-help-btn-close');
  if (helpCloseBtn) helpCloseBtn.addEventListener('click', toggleHelp);

  // Presenter View Buttons
  var presenterCloseBtn = document.getElementById('docboot-presenter-btn-close');
  if (presenterCloseBtn) presenterCloseBtn.addEventListener('click', togglePresenter);

  var timerStartBtn = document.getElementById('docboot-timer-btn-start');
  if (timerStartBtn) timerStartBtn.addEventListener('click', startTimer);

  var timerPauseBtn = document.getElementById('docboot-timer-btn-pause');
  if (timerPauseBtn) timerPauseBtn.addEventListener('click', pauseTimer);

  var timerResetBtn = document.getElementById('docboot-timer-btn-reset');
  if (timerResetBtn) timerResetBtn.addEventListener('click', resetTimer);

  var notesIncBtn = document.getElementById('docboot-notes-btn-inc');
  if (notesIncBtn) {
    notesIncBtn.addEventListener('click', function () {
      notesFontSize = Math.min(notesFontSize + 0.2, 2.6);
      if (presenterNotes) presenterNotes.style.fontSize = notesFontSize + 'rem';
    });
  }

  var notesDecBtn = document.getElementById('docboot-notes-btn-dec');
  if (notesDecBtn) {
    notesDecBtn.addEventListener('click', function () {
      notesFontSize = Math.max(notesFontSize - 0.2, 1.0);
      if (presenterNotes) presenterNotes.style.fontSize = notesFontSize + 'rem';
    });
  }

  // --- 10. Live Reload (SSE) ---
  if (window.EventSource) {
    var eventSource = new EventSource('/__docboot_reload');
    eventSource.onmessage = function (e) {
      if (e.data === 'reload') {
        window.location.reload();
      }
    };
  }

  // --- 11. Initialize ---
  var urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('presenter') === '1' || urlParams.get('presenter') === 'true') {
    togglePresenter();
  }

  updateSlide(getSlideFromHash(), false);
})();
