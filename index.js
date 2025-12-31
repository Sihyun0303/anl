(function() {
    "use strict";

    // --- 상태 관리 ---
    var state = {
        initialized: false,
        focusIndex: 0,
        elements: []
    };

    // --- 1. 스타일 설정 (포커스 효과) ---
    function injectStyles() {
        if (document.getElementById('tflix-styles')) return;
        
        console.log('[TFlix] Injecting styles...');
        
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
        
        if (document.head) {
            document.head.appendChild(style);
            document.body.classList.add("tflix-nav-mode");
            console.log('[TFlix] Styles injected successfully');
        } else {
            console.error('[TFlix] document.head not available');
        }
    }

    // --- 2. 포커스 가능한 요소 스캔 ---
    function scanElements() {
        var selectors = 'a, button, input, [tabindex="0"], .movie-card, .nav-item, .sidebar a, [role="button"]';
        var elements = document.querySelectorAll(selectors);
        var focusables = [];
        
        var i = 0;
        for (i = 0; i < elements.length; i++) {
            var el = elements[i];
            var rect = el.getBoundingClientRect();
            var style = window.getComputedStyle(el);
            
            // 보이는 요소만 추가
            if (rect.width > 0 && rect.height > 0 && 
                style.display !== 'none' && 
                style.visibility !== 'hidden') {
                focusables.push(el);
            }
        }

        state.elements = focusables;
        console.log('[TFlix] Found ' + focusables.length + ' focusable elements');
        return focusables;
    }

    // --- 3. 포커스 설정 ---
    function setFocus(index) {
        if (state.elements.length === 0) {
            console.warn('[TFlix] No elements to focus');
            return false;
        }

        // 범위 체크
        if (index < 0) index = 0;
        if (index >= state.elements.length) index = state.elements.length - 1;

        // 기존 포커스 제거
        var oldFocused = document.querySelectorAll('.tflix-focused');
        var i = 0;
        for (i = 0; i < oldFocused.length; i++) {
            oldFocused[i].classList.remove('tflix-focused');
        }

        // 새 포커스 설정
        var element = state.elements[index];
        if (element) {
            element.classList.add('tflix-focused');
            element.focus();
            
            try {
                element.scrollIntoView(false);
            } catch (e) {
                if (element.scrollIntoViewIfNeeded) {
                    element.scrollIntoViewIfNeeded();
                }
            }
            
            state.focusIndex = index;
            console.log('[TFlix] Focused element ' + index + '/' + state.elements.length);
            return true;
        }
        
        return false;
    }

    // --- 4. 공간 탐색 엔진 ---
    window.navigate = function(dir) {
        // 요소가 없으면 다시 스캔
        if (state.elements.length === 0) {
            scanElements();
            if (state.elements.length === 0) {
                console.warn('[TFlix] Still no elements found');
                return;
            }
        }

        var current = document.querySelector('.tflix-focused') || state.elements[state.focusIndex];
        if (!current) {
            setFocus(0);
            return;
        }

        var curRect = current.getBoundingClientRect();
        var closest = null;
        var minDist = Infinity;
        var j = 0;

        for (j = 0; j < state.elements.length; j++) {
            var target = state.elements[j];
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

        // 가장 가까운 요소로 이동
        if (closest) {
            var newIndex = state.elements.indexOf(closest);
            if (newIndex !== -1) {
                setFocus(newIndex);
            }
        } else {
            // Fallback: 선형 이동
            if (dir === 'down' || dir === 'right') {
                if (state.focusIndex < state.elements.length - 1) {
                    setFocus(state.focusIndex + 1);
                }
            } else if (dir === 'up' || dir === 'left') {
                if (state.focusIndex > 0) {
                    setFocus(state.focusIndex - 1);
                }
            }
        }
    };

    // --- 5. 알림 메시지 (Toast) ---
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

    // --- 6. 핵심 키 이벤트 (keyCode 기반) ---
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
                
            case 82: // R키 (재스캔 - 디버깅용)
                e.preventDefault();
                console.log('[TFlix] Manual rescan triggered');
                scanElements();
                if (state.elements.length > 0) {
                    setFocus(0);
                    showToast("재스캔 완료: " + state.elements.length + "개");
                }
                break;
        }
    }, true);

    // --- 7. 초기화 함수 ---
    function init() {
        if (state.initialized) {
            console.log('[TFlix] Already initialized');
            return;
        }

        console.log('[TFlix] Initializing...');

        // 스타일 주입
        injectStyles();
        
        // 요소 스캔
        scanElements();
        
        // 첫 번째 요소에 포커스
        if (state.elements.length > 0) {
            var success = setFocus(0);
            if (success) {
                console.log('[TFlix] ✓ Initial focus set');
                showToast("TFlix 활성화: " + state.elements.length + "개 요소");
            } else {
                console.error('[TFlix] Failed to set initial focus');
            }
        } else {
            console.warn('[TFlix] No focusable elements found yet');
        }
        
        state.initialized = true;
        console.log('[TFlix] ✓ Initialization complete');
    }

    // --- 8. 동적 요소 감시 ---
    var observer = null;
    
    function setupObserver() {
        try {
            if (window.MutationObserver) {
                observer = new MutationObserver(function(mutations) {
                    var needsRescan = false;
                    var i = 0;
                    
                    for (i = 0; i < mutations.length; i++) {
                        if (mutations[i].addedNodes.length > 0) {
                            needsRescan = true;
                            break;
                        }
                    }
                    
                    if (needsRescan) {
                        console.log('[TFlix] DOM changed, rescanning...');
                        var oldCount = state.elements.length;
                        scanElements();
                        var newCount = state.elements.length;
                        
                        if (oldCount !== newCount) {
                            console.log('[TFlix] Element count changed: ' + oldCount + ' -> ' + newCount);
                        }
                        
                        // 포커스된 요소가 없으면 첫 번째로
                        if (!document.querySelector('.tflix-focused') && state.elements.length > 0) {
                            setFocus(0);
                        }
                    }
                });
                
                observer.observe(document.body, { 
                    childList: true, 
                    subtree: true 
                });
                
                console.log('[TFlix] MutationObserver active');
            } else {
                console.log('[TFlix] Using fallback polling');
            }
        } catch (e) {
            console.error('[TFlix] Observer error:', e);
        }
    }

    // --- 9. 시작 함수 (여러 타이밍에 재시도) ---
    function start() {
        console.log('[TFlix] Starting (readyState: ' + document.readyState + ')');
        
        // 즉시 실행
        setTimeout(function() {
            init();
            setupObserver();
        }, 500);
        
        // 1초 후 재시도
        setTimeout(function() {
            if (state.elements.length === 0) {
                console.log('[TFlix] Retry 1s - rescanning...');
                scanElements();
                if (state.elements.length > 0) {
                    setFocus(0);
                }
            }
        }, 1000);
        
        // 3초 후 재시도
        setTimeout(function() {
            if (state.elements.length === 0) {
                console.log('[TFlix] Retry 3s - rescanning...');
                scanElements();
                if (state.elements.length > 0) {
                    setFocus(0);
                }
            }
        }, 3000);
        
        // 5초 후 최종 재시도
        setTimeout(function() {
            if (state.elements.length === 0) {
                console.log('[TFlix] Retry 5s - final attempt...');
                scanElements();
                if (state.elements.length > 0) {
                    setFocus(0);
                } else {
                    console.error('[TFlix] ✗ No elements found after 5 seconds');
                    showToast("요소를 찾을 수 없음 (R키로 재시도)");
                }
            }
        }, 5000);
        
        // 10초마다 주기적 재스캔
        setInterval(function() {
            var oldCount = state.elements.length;
            scanElements();
            var newCount = state.elements.length;
            
            if (oldCount === 0 && newCount > 0) {
                console.log('[TFlix] Elements appeared! Setting focus...');
                setFocus(0);
            }
        }, 10000);
    }

    // --- 10. 진입점 ---
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }

    console.log('[TFlix] Script loaded');

})();
