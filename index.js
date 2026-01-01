// ==UserScript==
// @name         Anilife TV - Tizen Navigation
// @namespace    http://tampermonkey.net/
// @version      2.0-tizen
// @description  TV Remote navigation for Anilife.app (Tizen 3.0+ / Chromium 47)
// @author       You
// @match        https://anilife.app/*
// @match        https://*.anilife.app/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
  'use strict';

  // ========================================
  // POLYFILLS FOR CHROMIUM 47
  // ========================================
  if (typeof Object.assign !== 'function') {
    Object.assign = function(target) {
      if (target == null) {
        throw new TypeError('Cannot convert undefined or null to object');
      }
      var to = Object(target);
      var i = 1;
      for (i = 1; i < arguments.length; i++) {
        var nextSource = arguments[i];
        if (nextSource != null) {
          var keysArray = Object.keys(Object(nextSource));
          var nextIndex = 0;
          for (nextIndex = 0; nextIndex < keysArray.length; nextIndex++) {
            var nextKey = keysArray[nextIndex];
            to[nextKey] = nextSource[nextKey];
          }
        }
      }
      return to;
    };
  }

  if (!Array.prototype.find) {
    Array.prototype.find = function(predicate) {
      if (this == null) {
        throw new TypeError('Array.prototype.find called on null or undefined');
      }
      if (typeof predicate !== 'function') {
        throw new TypeError('predicate must be a function');
      }
      var list = Object(this);
      var length = parseInt(list.length) || 0;
      var thisArg = arguments[1];
      var value;
      var i = 0;
      for (i = 0; i < length; i++) {
        value = list[i];
        if (predicate.call(thisArg, value, i, list)) {
          return value;
        }
      }
      return undefined;
    };
  }

  // ========================================
  // CONFIGURATION
  // ========================================
  var CONFIG = {
    focusColor: '#3B82F6',  // Anilife blue color
    focusSize: '4px',
    focusAnimation: true,
    hideSelectors: [
      '#cookie-banner',
      '.popup:not(.tv-content)',
      '.modal:not(.tv-content)',
      '.ad',
      '.advertisement',
      '[class*="cookie"]',
      '[id*="cookie"]'
    ],
    maxZIndex: 999999
  };

  // ========================================
  // STATE MANAGEMENT
  // ========================================
  var state = {
    focusIndex: 0,
    focusableElements: [],
    initialized: false,
    lastFocus: null
  };

  // ========================================
  // CSS INJECTION
  // ========================================
  function addStyles() {
    try {
      var existingStyle = document.getElementById('anilife-tv-styles');
      if (existingStyle && existingStyle.parentNode) {
        existingStyle.parentNode.removeChild(existingStyle);
      }

      if (!document.head) {
        return false;
      }

      var style = document.createElement('style');
      style.id = 'anilife-tv-styles';
      style.type = 'text/css';
      
      var styleText = '';
      
      // Body 기본 스타일
      styleText += 'body { background-color: #000 !important; color: #fff !important; }';
      
      // Hide unwanted elements
      styleText += CONFIG.hideSelectors.join(', ') + ' { display: none !important; visibility: hidden !important; }';

      // Focus styles - Anilife blue theme
      styleText += '.tv-focused { outline: ' + CONFIG.focusSize + ' solid ' + CONFIG.focusColor + ' !important; box-shadow: 0 0 20px ' + CONFIG.focusColor + ', 0 0 40px ' + CONFIG.focusColor + ', 0 0 60px rgba(59, 130, 246, 0.3) !important; transform: scale(1.08) !important; transition: all 0.15s ease-out !important; z-index: ' + CONFIG.maxZIndex + ' !important; position: relative !important; }';

      // Focus animation
      styleText += '@keyframes focusPulse { 0%, 100% { box-shadow: 0 0 20px ' + CONFIG.focusColor + ', 0 0 40px ' + CONFIG.focusColor + ', 0 0 60px rgba(59, 130, 246, 0.3); } 50% { box-shadow: 0 0 30px ' + CONFIG.focusColor + ', 0 0 50px ' + CONFIG.focusColor + ', 0 0 70px rgba(59, 130, 246, 0.5); } }';
      styleText += '.tv-focused.animating { animation: focusPulse 2s ease-in-out infinite; }';

      // Anilife specific card styles - swiper-slide 및 실제 사이트 구조 타겟
      styleText += 'swiper-slide, swiper-slide a.group, li.group { transition: transform 0.15s ease-out, box-shadow 0.15s ease-out !important; cursor: pointer !important; }';
      styleText += 'swiper-slide .rounded-md, .aspect-poster { border-radius: 0.375rem !important; }';
      
      // 에피소드 리스트 항목
      styleText += 'li[data-type="thumbnail"] { transition: transform 0.15s ease-out, box-shadow 0.15s ease-out !important; cursor: pointer !important; }';

      // Focusable elements
      styleText += 'a, button, [role="button"] { outline: none !important; transition: all 0.15s ease-out !important; }';
      styleText += 'a:focus, button:focus, [role="button"]:focus { outline: none !important; }';

      // Back button
      styleText += '.tv-back-button { position: fixed !important; top: 20px !important; left: 20px !important; background: rgba(0, 0, 0, 0.8) !important; color: white !important; border: 2px solid ' + CONFIG.focusColor + ' !important; padding: 12px 24px !important; font-size: 1.2em !important; border-radius: 8px !important; cursor: pointer !important; z-index: ' + CONFIG.maxZIndex + ' !important; }';
      styleText += '.tv-back-button.tv-focused { background: ' + CONFIG.focusColor + ' !important; }';

      // Scrollbar 숨기기
      styleText += '::-webkit-scrollbar { width: 0 !important; height: 0 !important; }';

      // Use appendChild for Chromium 47 compatibility
      if (style.styleSheet) {
        // IE
        style.styleSheet.cssText = styleText;
      } else if (style.textContent !== undefined) {
        style.textContent = styleText;
      } else {
        style.appendChild(document.createTextNode(styleText));
      }

      document.head.appendChild(style);
      console.log('[Anilife TV] Styles injected');
      return true;
    } catch (e) {
      console.error('[Anilife TV] Error adding styles:', e);
      return false;
    }
  }

  // ========================================
  // ELEMENT SCANNING
  // ========================================
  function scanFocusableElements() {
    var elements = [];
    
    try {
      // 1. 사이드바 네비게이션 링크 (홈, 요일별, 공지사항 등)
      var sidebarLinks = document.querySelectorAll('li.group a[href]');
      
      // 2. 애니메이션 카드 (swiper-slide 내부의 링크)
      var animeCards = document.querySelectorAll('swiper-slide a.group[href^="/content/"]');
      
      // 3. 재생 버튼
      var playButtons = document.querySelectorAll('button[aria-label*="재생"]');
      
      // 4. 탭 버튼 (회차, 정보, 시리즈)
      var tabButtons = document.querySelectorAll('button[role="tab"]');
      
      // 5. 에피소드 리스트 항목
      var episodeItems = document.querySelectorAll('li.group[data-type="thumbnail"]');
      
      // 6. 일반 버튼들
      var generalButtons = document.querySelectorAll('button:not([role="tab"]):not([aria-label*="재생"])');
      
      // 7. 기타 일반 링크
      var generalLinks = document.querySelectorAll('a[href]:not(li.group a):not(swiper-slide a)');
      
      var allSelectors = [
        sidebarLinks,
        animeCards,
        playButtons,
        tabButtons,
        episodeItems,
        generalButtons,
        generalLinks
      ];
      
      var i = 0;
      var j = 0;
      var selector = null;
      var el = null;
      
      for (i = 0; i < allSelectors.length; i++) {
        selector = allSelectors[i];
        for (j = 0; j < selector.length; j++) {
          el = selector[j];
          if (isElementVisible(el) && isElementInteractable(el)) {
            // 중복 체크
            var isDuplicate = false;
            var k = 0;
            for (k = 0; k < elements.length; k++) {
              if (elements[k] === el) {
                isDuplicate = true;
                break;
              }
            }
            if (!isDuplicate) {
              elements.push(el);
            }
          }
        }
      }
      
      state.focusableElements = elements;
      console.log('[Anilife TV] Found ' + elements.length + ' focusable elements');
      return elements;
    } catch (e) {
      console.error('[Anilife TV] Error scanning:', e);
      state.focusableElements = [];
      return [];
    }
  }

  function isElementVisible(el) {
    if (!el) return false;
    
    try {
      if (el.offsetParent === null && el.tagName.toLowerCase() !== 'body') {
        return false;
      }

      var rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        return false;
      }

      var style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
      }

      return true;
    } catch (e) {
      return false;
    }
  }

  function isElementInteractable(el) {
    if (!el) return false;

    try {
      var tagName = el.tagName.toLowerCase();
      if (tagName === 'script' || tagName === 'style' || tagName === 'noscript') {
        return false;
      }

      if (el.getAttribute('disabled')) {
        return false;
      }

      return true;
    } catch (e) {
      return false;
    }
  }

  // ========================================
  // FOCUS MANAGEMENT
  // ========================================
  function setFocus(index) {
    if (state.focusableElements.length === 0) {
      return;
    }

    try {
      if (state.lastFocus) {
        state.lastFocus.classList.remove('tv-focused');
        state.lastFocus.classList.remove('animating');
      }

      if (index < 0) {
        index = 0;
      }
      if (index >= state.focusableElements.length) {
        index = state.focusableElements.length - 1;
      }

      state.focusIndex = index;
      var element = state.focusableElements[index];

      if (!element) {
        return;
      }

      element.classList.add('tv-focused');
      if (CONFIG.focusAnimation) {
        element.classList.add('animating');
      }

      // Chromium 47 호환 스크롤
      try {
        element.scrollIntoView(false); // false = align to bottom
      } catch (e) {
        // Fallback
        if (element.scrollIntoViewIfNeeded) {
          element.scrollIntoViewIfNeeded();
        }
      }

      state.lastFocus = element;
    } catch (e) {
      console.error('[Anilife TV] Error setting focus:', e);
    }
  }

  function moveFocus(direction) {
    if (state.focusableElements.length === 0) {
      scanFocusableElements();
      if (state.focusableElements.length === 0) {
        return;
      }
    }

    try {
      var currentEl = state.focusableElements[state.focusIndex];
      if (!currentEl) {
        setFocus(0);
        return;
      }

      var currentIndex = state.focusIndex;
      var bestIndex = -1;
      var bestScore = Infinity;

      var currentRect = currentEl.getBoundingClientRect();
      var currentCenterX = currentRect.left + currentRect.width / 2;
      var currentCenterY = currentRect.top + currentRect.height / 2;

      var i = 0;
      for (i = 0; i < state.focusableElements.length; i++) {
        if (i === currentIndex) continue;

        var el = state.focusableElements[i];
        var rect = el.getBoundingClientRect();
        var centerX = rect.left + rect.width / 2;
        var centerY = rect.top + rect.height / 2;

        var deltaX = centerX - currentCenterX;
        var deltaY = centerY - currentCenterY;
        var distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        var isCandidate = false;

        if (direction === 'up' && deltaY < -10 && Math.abs(deltaX) < currentRect.width * 2) {
          isCandidate = true;
        } else if (direction === 'down' && deltaY > 10 && Math.abs(deltaX) < currentRect.width * 2) {
          isCandidate = true;
        } else if (direction === 'left' && deltaX < -10 && Math.abs(deltaY) < currentRect.height * 2) {
          isCandidate = true;
        } else if (direction === 'right' && deltaX > 10 && Math.abs(deltaY) < currentRect.height * 2) {
          isCandidate = true;
        }

        if (isCandidate && distance < bestScore) {
          bestScore = distance;
          bestIndex = i;
        }
      }

      if (bestIndex !== -1) {
        setFocus(bestIndex);
      } else {
        // Fallback: linear navigation
        if (direction === 'down' || direction === 'right') {
          if (currentIndex < state.focusableElements.length - 1) {
            setFocus(currentIndex + 1);
          }
        } else if (direction === 'up' || direction === 'left') {
          if (currentIndex > 0) {
            setFocus(currentIndex - 1);
          }
        }
      }
    } catch (e) {
      console.error('[Anilife TV] Error moving focus:', e);
    }
  }

  // ========================================
  // TIZEN REMOTE CONTROL HANDLER
  // ========================================
  function handleKeyDown(e) {
    var keyCode = e.keyCode;
    var handled = false;

    switch (keyCode) {
      case 37:  // ← Left Arrow
        e.preventDefault();
        moveFocus('left');
        handled = true;
        break;
      case 38:  // ↑ Up Arrow
        e.preventDefault();
        moveFocus('up');
        handled = true;
        break;
      case 39:  // → Right Arrow
        e.preventDefault();
        moveFocus('right');
        handled = true;
        break;
      case 40:  // ↓ Down Arrow
        e.preventDefault();
        moveFocus('down');
        handled = true;
        break;
      case 13:  // Enter/OK button
        e.preventDefault();
        if (state.lastFocus) {
          try {
            state.lastFocus.click();
            console.log('[Anilife TV] Clicked element');
          } catch (err) {
            console.error('[Anilife TV] Error clicking:', err);
          }
        }
        handled = true;
        break;
      case 10009:  // Return/Back button (Tizen)
        e.preventDefault();
        try {
          if (window.history.length > 1) {
            window.history.back();
          } else {
            var closeButtons = document.querySelectorAll('[class*="close"], [class*="back"], [aria-label*="close"]');
            if (closeButtons.length > 0) {
              closeButtons[0].click();
            }
          }
        } catch (err) {
          console.error('[Anilife TV] Error going back:', err);
        }
        handled = true;
        break;
    }

    if (handled) {
      e.stopPropagation();
    }
  }

  // ========================================
  // MUTATION OBSERVER (동적 콘텐츠 감지)
  // ========================================
  function setupMutationObserver() {
    try {
      if (!window.MutationObserver) {
        // Fallback: 주기적 재스캔
        setInterval(function() {
          scanFocusableElements();
        }, 2000);
        console.log('[Anilife TV] Using fallback polling (no MutationObserver)');
        return;
      }

      var observer = new MutationObserver(function(mutations) {
        var shouldRescan = false;
        var i = 0;
        for (i = 0; i < mutations.length; i++) {
          if (mutations[i].addedNodes.length > 0 || mutations[i].removedNodes.length > 0) {
            shouldRescan = true;
            break;
          }
        }

        if (shouldRescan) {
          scanFocusableElements();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      console.log('[Anilife TV] MutationObserver active');
    } catch (e) {
      console.error('[Anilife TV] Error setting up observer:', e);
    }
  }

  // ========================================
  // BACK BUTTON UI
  // ========================================
  function injectBackButton() {
    try {
      if (document.querySelector('.tv-back-button')) {
        return;
      }

      if (!document.body) {
        return;
      }

      var backButton = document.createElement('button');
      backButton.className = 'tv-back-button';
      backButton.innerHTML = '&larr; Back';
      
      backButton.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (window.history.length > 1) {
          window.history.back();
        }
      });

      document.body.appendChild(backButton);
      console.log('[Anilife TV] Back button injected');
    } catch (e) {
      console.error('[Anilife TV] Error injecting back button:', e);
    }
  }

  // ========================================
  // INITIALIZATION
  // ========================================
  function init() {
    if (state.initialized) {
      return;
    }

    try {
      console.log('[Anilife TV] Initializing for Tizen...');

      // 1. Add CSS
      if (!addStyles()) {
        console.warn('[Anilife TV] Failed to add styles, continuing anyway');
      }

      // 2. Scan elements
      scanFocusableElements();

      // 3. Set initial focus
      if (state.focusableElements.length > 0) {
        setFocus(0);
      } else {
        console.warn('[Anilife TV] No focusable elements found initially');
      }

      // 4. Setup event listeners
      document.addEventListener('keydown', handleKeyDown, true);

      // 5. Setup observer
      setupMutationObserver();

      // 6. Inject back button
      injectBackButton();

      // 7. Periodic rescan
      setInterval(function() {
        var oldCount = state.focusableElements.length;
        scanFocusableElements();
        var newCount = state.focusableElements.length;
        
        if (oldCount !== newCount) {
          console.log('[Anilife TV] Element count changed: ' + oldCount + ' -> ' + newCount);
        }
      }, 3000);

      state.initialized = true;
      console.log('[Anilife TV] ✓ Ready! Found ' + state.focusableElements.length + ' elements');
      console.log('[Anilife TV] Use remote: ←↑→↓ to navigate, OK to select, RETURN to go back');
    } catch (e) {
      console.error('[Anilife TV] Initialization error:', e);
      // 에러가 나도 계속 시도
    }
  }

  // ========================================
  // STARTUP SEQUENCE
  // ========================================
  function start() {
    console.log('[Anilife TV] Starting...');
    
    // Tizen은 로딩이 느릴 수 있으므로 여러 타이밍에 시도
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        setTimeout(init, 500);
      });
    } else {
      setTimeout(init, 500);
    }

    // 추가 재시도 (타이젠 로딩 지연 대비)
    setTimeout(function() {
      if (!state.initialized) {
        console.log('[Anilife TV] Retry initialization...');
        init();
      }
    }, 2000);

    setTimeout(function() {
      if (!state.initialized) {
        console.log('[Anilife TV] Final retry...');
        init();
      }
    }, 5000);
  }

  // ========================================
  // MAIN ENTRY POINT
  // ========================================
  try {
    start();
  } catch (e) {
    console.error('[Anilife TV] Critical startup error:', e);
  }

})();
