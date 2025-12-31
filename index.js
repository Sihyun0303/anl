(function() {
    "use strict";

    // --- 1. 스타일 설정 (포커스 효과) ---
    function injectStyles() {
        if (document.getElementById('tflix-styles')) return;
        var style = document.createElement("style");
        style.id = 'tflix-styles';
        
        var styleText = '';
        styleText += '.tflix-focused {';
        styleText += '    transform: scale(1.05) !important;';
        styleText += '    box-shadow: 0 0 15px 5px rgba(255, 255, 255, 0.6) !important;';
        styleText += '    outline: 3px solid white !important;';
        styleText += '    transition: all 0.2s ease !important;';
        styleText += '    z-index: 9999 !important;';
        styleText += '    position: relative !important;';
        styleText += '}';
        styleText += 'body.tflix-nav-mode { cursor: none !important; }';
        styleText += '.tflix-toast {';
        styleText += '    position: fixed; top: 50px; right: 50px;';
        styleText += '    background: rgba(0,0,0,0.8);';
        styleText += '    color: white; padding: 15px 25px;';
        styleText += '    border-radius: 10px; z-index: 10000;';
        styleText += '    font-size: 20px; transition: opacity 0.3s;';
        styleText += '    opacity: 0;';
        styleText += '}';
        styleText += '.tflix-toast.show { opacity: 1; }';
        
        if (style.styleSheet) {
            style.styleSheet.cssText = styleText;
        } else if (style.textContent !== undefined) {
            style.textContent = styleText;
        } else {
            style.appendChild(document.createTextNode(styleText));
        }
        
        document.head.appendChild(style);
        document.body.classList.add("tflix-nav-mode");
    }

    // --- 2. 공간 탐색 엔진 (사이드바 및 일반 요소) ---
    window.navigate = function(dir) {
        var current = document.activeElement || document.body;
        var selectors = 'a, button, input, [tabindex="0"], .movie-card, .nav-item, .sidebar a';
        var elements = document.querySelectorAll(selectors);
        var focusables = [];
        
        // Array.from 대신 for 루프 사용
        var i = 0;
        for (i = 0; i < elements.length; i++) {
            var el = elements[i];
            var rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                focusables.push(el);
            }
        }

        var curRect = current.getBoundingClientRect();
        var closest = null;
        var minDist = Infinity;
        var j = 0;

        for (j = 0; j < focusables.length; j++) {
            var target = focusables[j];
            if (target === current) continue;
            
            var tarRect = target.getBoundingClientRect();

            // 방향 판단
            var isCorrect = false;
            var curCenter = { 
                x: curRect.left + curRect.width / 2, 
                y: curRect.top + curRect.height / 2 
            };
            var tarCenter = { 
                x: tarRect.left + tarRect.width / 2, 
                y: tarRect.top + tarRect.height / 2 
            };

            if (dir === 'up') isCorrect = tarCenter.y < curCenter.y;
            if (dir === 'down') isCorrect = tarCenter.y > curCenter.y;
            if (dir === 'left') isCorrect = tarCenter.x < curCenter.x;
            if (dir === 'right') isCorrect = tarCenter.x > curCenter.x;

            if (isCorrect) {
                var dx = tarCenter.x - curCenter.x;
                var dy = tarCenter.y - curCenter.y;
                var dist = Math.pow(dx, 2) + Math.pow(dy, 2);
                
                if (dist < minDist) {
                    minDist = dist;
                    closest = target;
                }
            }
        }

        if (closest) {
            var focusedElements = document.querySelectorAll('.tflix-focused');
            var k = 0;
            for (k = 0; k < focusedElements.length; k++) {
                focusedElements[k].classList.remove('tflix-focused');
            }
            
            closest.classList.add('tflix-focused');
            closest.focus();
            
            // Chromium 47 호환 스크롤
            try {
                closest.scrollIntoView(false);
            } catch (e) {
                if (closest.scrollIntoViewIfNeeded) {
                    closest.scrollIntoViewIfNeeded();
                }
            }
        }
    };

    // --- 3. 알림 메시지 (Toast) ---
    function showToast(msg) {
        var toast = document.querySelector('.tflix-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'tflix-toast';
            document.body.appendChild(toast);
        }
        
        if (toast.textContent !== undefined) {
            toast.textContent = msg;
        } else {
            toast.innerText = msg;
        }
        
        toast.classList.add('show');
        setTimeout(function() {
            toast.classList.remove('show');
        }, 2000);
    }

    // --- 4. 핵심 키 이벤트 (keyCode 기반) ---
    document.addEventListener('keydown', function(e) {
        var video = document.querySelector('video');
        var keyCode = e.keyCode;

        switch(keyCode) {
            case 38: // ArrowUp
                e.preventDefault();
                navigate('up');
                break;
                
            case 40: // ArrowDown
                e.preventDefault();
                navigate('down');
                break;
                
            case 37: // ArrowLeft
                e.preventDefault();
                navigate('left');
                break;
                
            case 39: // ArrowRight
                e.preventDefault();
                navigate('right');
                break;

            case 70: // F키
            case 13: // Enter (확인 및 재생 제어)
                e.preventDefault();
                var focused = document.querySelector('.tflix-focused');
                
                if (video && !video.paused) {
                    // 영상 재생 중이면 일시정지
                    video.pause();
                    showToast("일시정지");
                } else if (focused) {
                    focused.click();
                    if (video && video.paused) {
                        video.play();
                        showToast("재생");
                    }
                }
                break;

            case 81: // Q키 (뒤로가기)
            case 10009: // Tizen Back 버튼
                e.preventDefault();
                
                // Fullscreen 체크 (타이젠 호환)
                var isFullscreen = document.fullscreenElement || 
                                   document.webkitFullscreenElement || 
                                   document.mozFullScreenElement || 
                                   document.msFullscreenElement;
                
                if (isFullscreen) {
                    if (document.exitFullscreen) {
                        document.exitFullscreen();
                    } else if (document.webkitExitFullscreen) {
                        document.webkitExitFullscreen();
                    } else if (document.mozCancelFullScreen) {
                        document.mozCancelFullScreen();
                    } else if (document.msExitFullscreen) {
                        document.msExitFullscreen();
                    }
                } else {
                    window.history.back();
                }
                break;
            
            case 415: // MediaPlay (타이젠)
            case 19: // MediaPause (타이젠)
                e.preventDefault();
                if (video) {
                    if (video.paused) {
                        video.play();
                        showToast("재생");
                    } else {
                        video.pause();
                        showToast("일시정지");
                    }
                }
                break;
        }
    }, true);

    // 초기화 실행
    function init() {
        injectStyles();
        
        // 2초 뒤 첫 번째 요소에 포커스
        setTimeout(function() {
            var first = document.querySelector('a, button');
            if (first) {
                first.classList.add('tflix-focused');
                first.focus();
            }
        }, 2000);
        
        console.log('[TFlix] Initialized for Tizen');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 동적 요소 감시 (새로운 영화 포스터 등이 뜰 때)
    var observer = null;
    
    try {
        if (window.MutationObserver) {
            observer = new MutationObserver(function(mutations) {
                var focusables = document.querySelectorAll('a, button, .movie-card');
                var i = 0;
                for (i = 0; i < focusables.length; i++) {
                    var el = focusables[i];
                    if (!el.hasAttribute('tabindex')) {
                        el.setAttribute('tabindex', '0');
                    }
                }
            });
            
            observer.observe(document.body, { 
                childList: true, 
                subtree: true 
            });
            
            console.log('[TFlix] MutationObserver active');
        } else {
            // Fallback: 주기적으로 체크
            setInterval(function() {
                var focusables = document.querySelectorAll('a, button, .movie-card');
                var i = 0;
                for (i = 0; i < focusables.length; i++) {
                    var el = focusables[i];
                    if (!el.hasAttribute('tabindex')) {
                        el.setAttribute('tabindex', '0');
                    }
                }
            }, 2000);
            
            console.log('[TFlix] Using fallback polling');
        }
    } catch (e) {
        console.error('[TFlix] Observer error:', e);
    }

})();
