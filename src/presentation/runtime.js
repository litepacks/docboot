/**
 * Docboot Presentation Client Runtime (<4KB Zero-dependency)
 * Handles slide navigation, keyboard shortcuts, touch gestures, URL hash sync,
 * fullscreen mode, presenter view, local timer, and live reload.
 */

(function () {
  'use strict';

  var slides = Array.from(document.querySelectorAll('.docboot-slide'));
  var totalSlides = slides.length;
  if (!totalSlides) return;

  var currentSlide = 1;
  var isPresenterOpen = false;
  var timerSeconds = 0;
  var timerInterval = null;
  var isTimerRunning = false;

  var progressBar = document.getElementById('docboot-presentation-progress');
  var slideCounter = document.getElementById('docboot-presentation-counter');
  var presenterView = document.getElementById('docboot-presenter-view');

  var presenterCurrent = document.getElementById('docboot-presenter-current');
  var presenterNext = document.getElementById('docboot-presenter-next');
  var presenterNotes = document.getElementById('docboot-presenter-notes');
  var presenterTimer = document.getElementById('docboot-presenter-timer-display');
  var presenterCounter = document.getElementById('docboot-presenter-counter-display');

  // --- 1. URL Hash Resolution ---
  function getSlideFromHash() {
    var hash = window.location.hash.replace(/^#/, '');
    var parsed = parseInt(hash, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalSlides) {
      return parsed;
    }
    return 1;
  }

  // --- 2. Slide Navigation ---
  function updateSlide(targetIndex, pushHistory) {
    if (targetIndex < 1) targetIndex = 1;
    if (targetIndex > totalSlides) targetIndex = totalSlides;

    currentSlide = targetIndex;

    // Update active slide class
    for (var i = 0; i < slides.length; i++) {
      var slide = slides[i];
      if (i + 1 === currentSlide) {
        slide.classList.add('active');
        slide.setAttribute('aria-hidden', 'false');
      } else {
        slide.classList.remove('active');
        slide.setAttribute('aria-hidden', 'true');
      }
    }

    // Update progress bar
    if (progressBar) {
      var percent = (currentSlide / totalSlides) * 100;
      progressBar.style.width = percent + '%';
    }

    // Update slide counter
    if (slideCounter) {
      slideCounter.textContent = currentSlide + ' / ' + totalSlides;
    }

    // Update URL hash
    if (pushHistory !== false) {
      if (window.location.hash !== '#' + currentSlide) {
        history.pushState(null, '', '#' + currentSlide);
      }
    }

    // Update Presenter View if active
    updatePresenterView();
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

  // --- 3. Fullscreen Controller ---
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

  // --- 4. Presenter Mode & Timer ---
  function updatePresenterView() {
    if (!presenterView) return;

    var curSlideEl = slides[currentSlide - 1];
    var nextSlideEl = slides[currentSlide] || null;

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

    if (presenterCounter) {
      presenterCounter.textContent = currentSlide + ' / ' + totalSlides;
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

  // --- 5. Theme Switcher ---
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
  }

  // --- 6. Event Listeners ---
  document.addEventListener('keydown', function (e) {
    // Ignore input fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      return;
    }

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
      case 'PageDown':
      case ' ':
      case 'n':
      case 'N':
      case 'l':
      case 'L':
        e.preventDefault();
        nextSlide();
        break;

      case 'ArrowLeft':
      case 'ArrowUp':
      case 'PageUp':
      case 'h':
      case 'H':
      case 'k':
      case 'K':
        e.preventDefault();
        prevSlide();
        break;

      case 'Home':
        e.preventDefault();
        firstSlide();
        break;

      case 'End':
        e.preventDefault();
        lastSlide();
        break;

      case 'f':
      case 'F':
        e.preventDefault();
        toggleFullscreen();
        break;

      case 'p':
      case 'P':
        e.preventDefault();
        togglePresenter();
        break;

      case 't':
      case 'T':
        e.preventDefault();
        toggleTheme();
        break;

      case 'Escape':
        if (isPresenterOpen) {
          e.preventDefault();
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

      // Ensure horizontal swipe
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 40) {
        if (diffX < 0) {
          nextSlide();
        } else {
          prevSlide();
        }
      }
    }
  }, { passive: true });

  // Control Buttons
  var prevBtn = document.getElementById('docboot-btn-prev');
  if (prevBtn) prevBtn.addEventListener('click', prevSlide);

  var nextBtn = document.getElementById('docboot-btn-next');
  if (nextBtn) nextBtn.addEventListener('click', nextSlide);

  var fullscreenBtn = document.getElementById('docboot-btn-fullscreen');
  if (fullscreenBtn) fullscreenBtn.addEventListener('click', toggleFullscreen);

  var presenterBtn = document.getElementById('docboot-btn-presenter');
  if (presenterBtn) presenterBtn.addEventListener('click', togglePresenter);

  var themeBtn = document.getElementById('docboot-btn-theme');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // Presenter View Buttons
  var presenterCloseBtn = document.getElementById('docboot-presenter-btn-close');
  if (presenterCloseBtn) presenterCloseBtn.addEventListener('click', togglePresenter);

  var timerStartBtn = document.getElementById('docboot-timer-btn-start');
  if (timerStartBtn) timerStartBtn.addEventListener('click', startTimer);

  var timerPauseBtn = document.getElementById('docboot-timer-btn-pause');
  if (timerPauseBtn) timerPauseBtn.addEventListener('click', pauseTimer);

  var timerResetBtn = document.getElementById('docboot-timer-btn-reset');
  if (timerResetBtn) timerResetBtn.addEventListener('click', resetTimer);

  // --- 7. Live Reload (SSE) ---
  if (window.EventSource) {
    var eventSource = new EventSource('/__docboot_reload');
    eventSource.onmessage = function (e) {
      if (e.data === 'reload') {
        window.location.reload();
      }
    };
  }

  // --- 8. Initialize ---
  var urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('presenter') === '1' || urlParams.get('presenter') === 'true') {
    togglePresenter();
  }

  updateSlide(getSlideFromHash(), false);
})();
