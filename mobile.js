/************************************************/
/* BEAT ZEN: PREMIUM MOBILE ENGINE (mobile.js)  */
/* Handles: Persistence & Hardware Handshaking  */
/************************************************/

(function() {
    "use strict";

    // CORE CONFIGURATION
    const CONFIG = {
        BOOT_DELAY: 400,        // Sync with main script indexing
        SEEK_HANDSHAKE: 700,    // Wait for mobile audio buffer
        SWIPE_LIMIT: 60         // Gesture sensitivity
    };

    const state = {
        isMobile: () => window.innerWidth <= 768,
        restored: false,
        startX: 0,
        startY: 0
    };

    /********************************/
    /* MOBILE RECOVERY ENGINE       */
    /********************************/
    window.restoreMobileSession = function() {
        if (state.restored) return;

        const savedSong = localStorage.getItem('lastPlayedSong');
        const audio = document.getElementById('audio-player');
        const mainPlayer = document.getElementById('main-player');
        
        if (!audio || !savedSong || !window.masterPool) return;

        try {
            const data = JSON.parse(savedSong);
            
            // 1. Re-link to master data pool
            const obj = window.masterPool.find(a => 
                String(a.id || a.name || a.title) === String(data.albumId)
            );

            if (obj && window.playSong) {
                // 2. Rehydrate playing state
                const hydrated = window.resolveData ? window.resolveData(obj, data.type) : obj;
                window.playingAlbum = hydrated;
                window.currentSongIndex = parseInt(data.songIndex);

                // 3. Populate UI bar (no-autoplay mode)
                window.playSong(window.currentSongIndex, false);

                // 4. Force Home View on refresh (as requested)
                if (mainPlayer) {
                    mainPlayer.classList.remove('maximized');
                    document.body.style.overflow = '';
                    if (window.location.hash === '#player') {
                        history.replaceState(null, null, ' ');
                    }
                }

                // 5. Restore specific time position accurately
                if (window.applySavedTime) {
                    window.applySavedTime();
                }

                state.restored = true;
            }
        } catch (e) {
            console.error("Beat Zen Mobile: Recovery Error", e);
        }

        // Restore Playback Modes (Shuffle/Loop)
        window.isShuffling = localStorage.getItem('beatZen_shuffle') === 'true';
        window.isLooping = localStorage.getItem('beatZen_loop') === 'true';
        if (window.syncPlaybackModesUI) window.syncPlaybackModesUI();
    };

    /********************************/
    /* MOBILE GESTURE ENGINE        */
    /********************************/
    const initGestures = () => {
        const area = document.getElementById('main-player');
        if (!area) return;

        area.addEventListener('touchstart', (e) => {
            state.startX = e.changedTouches[0].screenX;
            state.startY = e.changedTouches[0].screenY;
        }, { passive: true });

        area.addEventListener('touchend', (e) => {
            const dx = state.startX - e.changedTouches[0].screenX;
            const dy = state.startY - e.changedTouches[0].screenY;

            // Detect horizontal swipe skip
            if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > CONFIG.SWIPE_LIMIT) {
                if ("vibrate" in navigator) navigator.vibrate(15);
                if (dx > 0 && window.playNextSong) window.playNextSong();
                if (dx < 0 && window.playPrevSong) window.playPrevSong();
            }
        }, { passive: true });
    };

    /********************************/
    /* MOBILE BOOTSTRAP             */
    /********************************/
    const initMobileApp = () => {
        // Dynamic Viewport Height Fix
        const syncVH = () => {
            let vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        };
        
        syncVH();
        window.addEventListener('resize', syncVH);
        
        // Setup Features
        initGestures();

        // Boot Recovery with enough delay for masterPool to be ready
        if (document.readyState === 'complete') {
            setTimeout(window.restoreMobileSession, CONFIG.BOOT_DELAY);
        } else {
            window.addEventListener('load', () => {
                setTimeout(window.restoreMobileSession, CONFIG.BOOT_DELAY);
            });
        }
    };

    initMobileApp();

})();