/* All scripts load with defer — DOM is already ready.
   IIFE ensures window.toggleShuffle / syncPlaybackModesUI / wireModeButtons
   are defined BEFORE buttons.js / mobile.js / beatzen-pro.js execute. */
(function () {

    /* ═══════════════════════════════════════════════════════════
       BZ POPUP ENGINE  — replaces all native alert() / confirm()
       bzAlert(type, title, body)            → info popup (OK only)
       bzConfirm(type, title, body, onOk)    → confirm popup
       bzInput(type, title, placeholder, onOk) → input popup
       types: 'danger' | 'warning' | 'success' | 'info' | 'playlist'
    ═══════════════════════════════════════════════════════════ */
    (function () {
        const OVERLAY_ID = 'bz-micro-popup';
        const ICONS = {
            danger: { bg: 'rgba(255,77,77,0.12)', border: 'rgba(255,77,77,0.30)', color: '#ff6b6b', fa: 'fa-exclamation-circle' },
            warning: { bg: 'rgba(243,156,18,0.12)', border: 'rgba(243,156,18,0.30)', color: '#f39c12', fa: 'fa-exclamation-triangle' },
            success: { bg: 'rgba(107,203,119,0.12)', border: 'rgba(107,203,119,0.30)', color: '#6bcb77', fa: 'fa-check-circle' },
            info: { bg: 'rgba(37,117,252,0.12)', border: 'rgba(37,117,252,0.30)', color: '#2575fc', fa: 'fa-info-circle' },
            playlist: { bg: 'rgba(124,58,237,0.12)', border: 'rgba(124,58,237,0.30)', color: '#a855f7', fa: 'fa-compact-disc' },
        };
        function getOverlay() {
            let el = document.getElementById(OVERLAY_ID);
            if (!el) {
                el = document.createElement('div');
                el.id = OVERLAY_ID;
                el.className = 'bz-clear-popup';
                el.setAttribute('role', 'dialog');
                el.setAttribute('aria-modal', 'true');
                document.body.appendChild(el);
            }
            return el;
        }
        function close() {
            const el = document.getElementById(OVERLAY_ID);
            if (!el) return;
            el.classList.remove('visible');
            if (el._esc) { document.removeEventListener('keydown', el._esc); el._esc = null; }
        }
        function open(type, title, body, btns, afterRender) {
            const ic = ICONS[type] || ICONS.info;
            const el = getOverlay();
            el.innerHTML = `
              <div class="bz-popup-box">
                <div class="bz-popup-icon" style="background:${ic.bg};border-color:${ic.border};color:${ic.color};">
                  <i class="fas ${ic.fa}"></i>
                </div>
                <p class="bz-popup-title">${title}</p>
                ${body ? `<p class="bz-popup-body">${body}</p>` : ''}
                <div class="bz-popup-actions">${btns}</div>
              </div>`;
            el.classList.add('visible');
            el.onclick = (e) => { if (e.target === el) close(); };
            el._esc = (e) => { if (e.key === 'Escape') close(); };
            document.addEventListener('keydown', el._esc);
            requestAnimationFrame(() => { if (afterRender) afterRender(el); else el.querySelector('button')?.focus(); });
            return el;
        }
        window.bzPopupClose = close;
        window.bzAlert = function (type, title, body) {
            open(type, title, body, `<button class="bz-popup-ok bz-popup-single" onclick="bzPopupClose()">OK</button>`);
        };
        window.bzConfirm = function (type, title, body, onOk, okLabel, cancelLabel) {
            const el = open(type, title, body,
                `<button class="bz-popup-cancel" onclick="bzPopupClose()">${cancelLabel || 'Cancel'}</button>
                 <button class="bz-popup-ok" id="_bzOk">${okLabel || 'Confirm'}</button>`);
            el.querySelector('#_bzOk').onclick = () => { close(); onOk && onOk(); };
            el.querySelector('#_bzOk')?.focus();
        };
        window.bzInput = function (type, title, placeholder, onOk) {
            const ic = ICONS[type] || ICONS.playlist;
            const el = getOverlay();
            el.innerHTML = `
              <div class="bz-popup-box">
                <div class="bz-popup-icon" style="background:${ic.bg};border-color:${ic.border};color:${ic.color};">
                  <i class="fas ${ic.fa}"></i>
                </div>
                <p class="bz-popup-title">${title}</p>
                <input id="_bzInp" type="text" placeholder="${placeholder}"
                  style="width:100%;padding:10px 14px;background:rgba(255,255,255,0.07);
                  border:1.5px solid rgba(255,255,255,0.15);border-radius:10px;color:#fff;
                  font-size:0.9rem;font-family:inherit;outline:none;box-sizing:border-box;margin-top:2px;">
                <div class="bz-popup-actions">
                  <button class="bz-popup-cancel" onclick="bzPopupClose()">Cancel</button>
                  <button class="bz-popup-ok" id="_bzOk">Create</button>
                </div>
              </div>`;
            el.classList.add('visible');
            el.onclick = (e) => { if (e.target === el) close(); };
            el._esc = (e) => { if (e.key === 'Escape') close(); };
            document.addEventListener('keydown', el._esc);
            const inp = el.querySelector('#_bzInp');
            const submit = () => {
                const v = inp.value.trim();
                if (!v) { inp.style.borderColor = '#ff6b6b'; inp.focus(); return; }
                close(); onOk && onOk(v);
            };
            el.querySelector('#_bzOk').onclick = submit;
            inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
            requestAnimationFrame(() => inp?.focus());
        };
    })();


    /* ═══════════════════════════════════════════════════════════
       GOOGLE SHEETS DATA LOADER
       Sheet: "beatzen data" | Tab: "songs"
       Fetches customYearAlbumsData dynamically — no data.js needed
    ═══════════════════════════════════════════════════════════ */
    const BEATZEN_SHEET_URL = "https://script.google.com/macros/s/AKfycbwhDDOdtuLW89vwQQLlgwVPBwtj_Gk6VNxJoLsQnd4SnI8JbgySOD_PxtmTZNJSb_7R/exec";
    window.BEATZEN_SHEET_URL = BEATZEN_SHEET_URL; /* exposed for playlists.js live-sync */

    /* ── Loader helpers ── */
    /* ── Loader hide ── */
    function loaderHide() {
        // Loader is disabled — overlay starts hidden, nothing to do.
        const ov = document.getElementById('bz-loader-overlay');
        if (ov) { ov.style.display = 'none'; ov.style.opacity = '0'; ov.style.visibility = 'hidden'; }
    }

    /* ── Escape user-controlled text before inserting into innerHTML ──────
     * Playlist names are typed by the user (and can sync across devices via
     * Firestore), then get interpolated directly into innerHTML template
     * literals in a couple of places (the "Add to Existing Playlist" list,
     * the daily-playlist card grid). Without escaping, a name like
     * <img src=x onerror=...> would execute as script wherever it renders —
     * a self-XSS hole that becomes cross-device once synced to the cloud.
     * Defined at top-level scope so it's reachable from anywhere in the file. */
    function _bzEscapeHTML(str) {
        const d = document.createElement('div');
        d.textContent = String(str ?? '');
        return d.innerHTML;
    }


    /* ── Shared "looks signed in" signal ─────────────────────────────────
     * Same dual-signal check needed in multiple places (bzNavGuard inside
     * startApp(), the boot wait-loop inside launchWhenReady(), showBzAuthGate
     * inside startApp()): a cached session UID written by auth.js, OR the
     * bz-signed-in class set by index.html's <head> fast-path before first
     * paint. Defined here at the top-level IIFE scope — NOT inside startApp()
     * — specifically so launchWhenReady()'s _waitForReadyThenHide (a sibling
     * function, not nested inside startApp()) can also see it via closure.
     * FIX: this was previously declared inside startApp(), which made it
     * invisible to _waitForReadyThenHide and threw a ReferenceError the
     * instant the wait-loop tried to call it — silently breaking the polling
     * chain entirely and leaving the loader spinning forever. */
    function _bzLikelySignedIn() {
        return !!(localStorage.getItem('beatZen_session_uid') ||
            document.documentElement.classList.contains('bz-signed-in'));
    }

    /* ══════════════════════════════════════════════════════════
       sanitizeSheetData — defined HERE so getCachedSheetData
       (called immediately below) can safely invoke it.
       FIX: was defined outside the IIFE at line ~4380, causing
       a ReferenceError on cache-hit paths which swallowed the
       error branch and left the loader spinning forever.
    ══════════════════════════════════════════════════════════ */
    function sanitizeSheetData(data) {
        if (!data || typeof data !== 'object') return data;

        function fixDuration(raw) {
            if (!raw && raw !== 0) return '';
            const s = String(raw).trim();
            if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) return s;
            const dateMatch = s.match(/(\d{1,2}):(\d{2}):(\d{2})/);
            if (dateMatch) {
                const h = parseInt(dateMatch[1], 10);
                const m = parseInt(dateMatch[2], 10);
                const sec = parseInt(dateMatch[3], 10);
                const totalSec = h * 3600 + m * 60 + sec;
                if (totalSec > 0) {
                    const mm = Math.floor(totalSec / 60);
                    const ss = String(totalSec % 60).padStart(2, '0');
                    return `${mm}:${ss}`;
                }
            }
            const n = parseFloat(s);
            if (!isNaN(n) && n > 0 && n < 1) {
                const totalSec = Math.round(n * 86400);
                const mm = Math.floor(totalSec / 60);
                const ss = String(totalSec % 60).padStart(2, '0');
                return `${mm}:${ss}`;
            }
            return s;
        }

        Object.values(data).forEach(albums => {
            if (!Array.isArray(albums)) return;
            albums.forEach(album => {
                if (!Array.isArray(album.songs)) return;
                album.songs.forEach(song => {
                    if (song && song.duration !== undefined) {
                        song.duration = fixDuration(song.duration);
                    }
                });
            });
        });
        return data;
    }
    window.sanitizeSheetData = sanitizeSheetData; /* exposed for playlists.js live-sync */

    /* ══════════════════════════════════════════════════════════
       SMART DATA LOADER
       Strategy:
         1. Always try to fetch fresh data from Sheets in background.
         2. If localStorage cache exists → launch INSTANTLY (0 ms).
         3. If no cache → show loader, wait for Sheets (up to 8s).
         4. Cache persists across browser restarts (localStorage, 24h TTL).
    ══════════════════════════════════════════════════════════ */

    const SHEET_CACHE_KEY = 'beatZen_sheetData_v2';

    /* Persistent cache — survives browser restarts for instant cold-start loads */
    function getCachedSheetData() {
        try {
            const raw = localStorage.getItem(SHEET_CACHE_KEY);
            if (!raw) return null;
            return sanitizeSheetData(JSON.parse(raw));
        } catch (_) { return null; }
    }

    function setCachedSheetData(data) {
        try {
            /* Store raw data as-is — sanitizeSheetData is applied on read */
            localStorage.setItem(SHEET_CACHE_KEY, JSON.stringify(data));
        } catch (_) { /* storage full — skip */ }
    }

    function startApp() {

        // FIX Bug 3: SPA-internal navigation depth counter. Incremented on every
        // pushState performed within the SPA, decremented on every popstate.
        // Used by the back button handler to distinguish "user navigated within
        // the app" from "browser has unrelated history" (window.history.length is
        // unreliable since it includes pre-app browser history).
        window._bzSpaNavDepth = 0;

        // FIX Bug E: BroadcastChannel tab ownership — prevents a new tab (e.g., opened
        // from a shared link) from hijacking playback in the already-active original tab.
        // On boot the new tab pings existing tabs. If any tab is playing it responds
        // "active"; the new tab sets _bzTabIsSecondary=true, skips session restore, and
        // shows a passive banner pointing the user back to their original tab.
        (function _bzInitTabOwnership() {
            let _bzOwnerCh;
            try { _bzOwnerCh = new BroadcastChannel('bz-tab-ownership'); } catch (_) { return; }
            window._bzTabOwnerChannel = _bzOwnerCh;
            window._bzTabIsSecondary = false;

            // Respond to pings from newly opened tabs — if this tab is playing, claim it
            _bzOwnerCh.onmessage = function (e) {
                if (e.data === 'ping') {
                    // Another tab opened — respond if we own active audio
                    try {
                        const _a = document.getElementById('audio-player');
                        if (_a && !_a.paused && _a.currentTime > 0 && !_a.ended) {
                            _bzOwnerCh.postMessage('active');
                        }
                    } catch (_) { /* ignore */ }
                } else if (e.data === 'active' && !window._bzTabIsSecondary) {
                    // An existing tab is playing — mark this tab as secondary, skip restore
                    window._bzTabIsSecondary = true;
                    // Show a non-blocking banner
                    function _bzShowSecondaryBanner() {
                        if (document.getElementById('bz-secondary-tab-banner')) return;
                        const _b = document.createElement('div');
                        _b.id = 'bz-secondary-tab-banner';
                        _b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:linear-gradient(90deg,#1a1040,#0e0824);border-bottom:1px solid rgba(167,139,250,0.3);padding:10px 16px;display:flex;align-items:center;gap:12px;font-size:13px;color:#e2e8f0;box-sizing:border-box;';
                        _b.innerHTML = '<i class="fas fa-music" style="color:#a78bfa;flex-shrink:0;"></i><span style="flex:1;">Music is playing in another tab — <strong id="bz-switch-there-btn" style="color:#a78bfa;cursor:pointer;text-decoration:underline;">switch there</strong> to control playback</span><button style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:18px;padding:0 4px;flex-shrink:0;" onclick="this.parentNode.remove()">×</button>';
                        if (document.body) document.body.prepend(_b);

                        // Wire the "switch there" action. We can't directly focus an
                        // arbitrary other browser tab from here (no window reference —
                        // BroadcastChannel only carries data, not a handle to the other
                        // tab), so we ask that tab to focus itself instead.
                        const _switchBtn = document.getElementById('bz-switch-there-btn');
                        if (_switchBtn) {
                            _switchBtn.onclick = function () {
                                try { _bzOwnerCh.postMessage('focus-request'); } catch (_) { /* ignore */ }
                                // Give feedback either way — window.focus() from another
                                // tab is allowed in most browsers but isn't guaranteed
                                // (focus-stealing protections vary), so don't promise
                                // a guaranteed switch, just confirm the request went out.
                                _switchBtn.textContent = 'Requested ✓';
                                setTimeout(function () {
                                    if (_switchBtn) _switchBtn.textContent = 'switch there';
                                }, 2000);
                            };
                        }
                    }
                    if (document.body) _bzShowSecondaryBanner();
                    else document.addEventListener('DOMContentLoaded', _bzShowSecondaryBanner);
                } else if (e.data === 'focus-request' && !window._bzTabIsSecondary) {
                    // The secondary tab is asking us (the tab actually playing audio)
                    // to bring ourselves to the front. Works in most browsers since
                    // this tab already has an active media session.
                    try { window.focus(); } catch (_) { /* ignore */ }
                    try { document.title = '▶ ' + document.title.replace(/^▶ /, ''); } catch (_) { /* ignore */ }
                }
            };

            // Ping existing tabs — any playing tab will respond within one event loop tick
            _bzOwnerCh.postMessage('ping');
        })();

        /* ── HISTORY-TARGET PULSE STYLE (injected once) ───────────────────────
           .bz-history-target: brief highlight glow on the song row that was
           last played, so the user knows which one to tap after clicking a
           Listen Again card.
        ─────────────────────────────────────────────────────────────────────── */
        if (!document.getElementById('bz-history-target-style')) {
            const s = document.createElement('style');
            s.id = 'bz-history-target-style';
            s.textContent = `
                @keyframes bz-history-pulse {
                    0%   { background: rgba(37,117,252,0.00); box-shadow: none; }
                    25%  { background: rgba(37,117,252,0.18); box-shadow: 0 0 0 2px rgba(37,117,252,0.35); }
                    60%  { background: rgba(37,117,252,0.12); box-shadow: 0 0 0 2px rgba(37,117,252,0.20); }
                    100% { background: rgba(37,117,252,0.00); box-shadow: none; }
                }
                .bz-history-target {
                    animation: bz-history-pulse 1.6s ease forwards !important;
                    border-radius: 10px;
                }`;
            document.head.appendChild(s);
        }

        /* ── Back button styles (injected once) ── */
        // FIX: album-playlist-desc needs white-space:pre-line so the \n between
        // the source line ("Added from …") and the "Created:" timestamp renders
        // as a real line break instead of a space.
        if (!document.getElementById('bz-playlist-desc-style')) {
            const _pds = document.createElement('style');
            _pds.id = 'bz-playlist-desc-style';
            _pds.textContent = `
                .album-playlist-desc {
                    white-space: pre-line;
                }`;
            document.head.appendChild(_pds);
        }

        if (!document.getElementById('bz-back-btn-style')) {
            const _bs = document.createElement('style');
            _bs.id = 'bz-back-btn-style';
            _bs.textContent = `
                .bz-album-nav-bar {
                    display: flex;
                    align-items: center;
                    padding: 0 0 4px 0;
                }
                .bz-back-btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: auto;
                    height: 36px;
                    border-radius: 20px;
                    padding: 0 12px 0 10px;
                    gap: 6px;
                    border: none;
                    background: rgba(255,255,255,0.09);
                    border: 1px solid rgba(255,255,255,0.12);
                    color: #fff;
                    font-size: 0.88rem;
                    cursor: pointer;
                    transition: background 0.18s, transform 0.15s, border-color 0.18s;
                    flex-shrink: 0;
                }
                .bz-back-btn:hover {
                    background: rgba(255,255,255,0.16);
                    border-color: rgba(255,255,255,0.22);
                }
                .bz-back-btn:active {
                    transform: scale(0.92);
                }
                body.dark-mode .bz-back-btn {
                    background: rgba(255,255,255,0.06);
                    border-color: rgba(255,255,255,0.10);
                }
                .bz-back-label {
                    font-size: 0.82rem;
                    font-weight: 600;
                    letter-spacing: 0.01em;
                    white-space: nowrap;
                }
                .bz-album-nav-bar {
                    justify-content: space-between;
                }
                .bz-album-nav-dots {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    border: 1px solid rgba(255,255,255,0.12);
                    background: rgba(255,255,255,0.09);
                    color: #fff;
                    font-size: 0.95rem;
                    cursor: pointer;
                    transition: background 0.18s, transform 0.15s, border-color 0.18s;
                    flex-shrink: 0;
                }
                .bz-album-nav-dots:hover {
                    background: rgba(255,255,255,0.16);
                    border-color: rgba(255,255,255,0.22);
                }
                .bz-album-nav-dots:active {
                    transform: scale(0.92);
                }
                body.dark-mode .bz-album-nav-dots {
                    background: rgba(255,255,255,0.06);
                    border-color: rgba(255,255,255,0.10);
                }`;
            document.head.appendChild(_bs);
        }

        /* ── INSTANT LAST-PLAYED RESTORE ──────────────────────────────────────
           Runs synchronously at the very top of startApp — before any data
           loads — so the player bar never shows "Select a song to play" on
           refresh when the user already has a last-played song saved.
           Uses only localStorage (available immediately, zero async latency).
        ─────────────────────────────────────────────────────────────────────── */
        (function paintLastPlayedBar() {
            try {
                const raw = localStorage.getItem('lastPlayedSong');
                if (!raw) return;
                const saved = JSON.parse(raw);
                const { songId, albumId } = saved;
                if (!songId && !albumId) return;

                /* Priority 1: Use rich metadata saved directly in lastPlayedSong (new format) */
                let title = saved.title || '';
                let artist = saved.artist || '';
                let cover = saved.cover || '';

                /* Priority 2: Fallback — scan history for this song */
                if (!title) {
                    const hist = JSON.parse(localStorage.getItem('beatZen_history_auto') || '[]');
                    const entry = hist.find(h => String(h.id) === String(songId));
                    if (entry) {
                        title = entry.title || '';
                        artist = entry.artist || '';
                        cover = entry._coverUrl || entry.albumCover || '';
                    }
                }

                if (!title) return; /* Nothing useful to show yet — full restore will populate */

                /* ── INSTANT AUDIO PRE-LOAD ────────────────────────────────────────
                   FIX: previously the <audio> element's src was only ever set once the
                   full session restore (_tryRestoreSession) resolved the song through
                   window.masterPool — which depends on customYearAlbumsData, itself
                   dependent on the Sheets fetch finishing. On a cold cache (or just a
                   slow Sheets response) that could take up to the full 300ms x 20/25
                   retry window (see restoreMobileSession) before the browser even
                   started requesting audio.
                   Now that the song's own streamable URL is saved directly inside
                   lastPlayedSong at play-time (see playSong's immediate save above),
                   we can point <audio> at it right here — before masterPool even
                   exists — so the browser starts buffering the correct file with
                   zero dependency on the sheet load. The later masterPool-based
                   restore still runs as normal (to rehydrate playingAlbum, the
                   queue, next/prev, etc.) but detects this src is already correct
                   and skips re-triggering load(), so buffering is never reset. */
                if (saved.url && !window._bzTabIsSecondary) {
                    try {
                        const _audioEl = document.getElementById('audio-player');
                        if (_audioEl) {
                            const _srcUnset = !_audioEl.src || _audioEl.src === window.location.href;
                            if (_srcUnset) {
                                _audioEl._bzInstantSrc = saved.url;
                                _audioEl.src = saved.url;
                                _audioEl.load();
                            }
                        }
                    } catch (_aErr) { /* silent — full restore will still handle it */ }
                }

                const titleEl = document.getElementById('player-song-title');
                const artistEl = document.getElementById('player-song-artist');
                const coverEl = document.getElementById('player-album-cover');

                if (titleEl) titleEl.textContent = title;
                if (artistEl) artistEl.textContent = artist;
                if (coverEl && cover) coverEl.src = cover;

                /* ── Reveal player bar (restore path) ──────────────────────── */
                (function _bzRevealPlayerRestore() {
                    var mp = document.getElementById('main-player');
                    if (mp) {
                        mp.classList.add('bz-player-active');
                        /* Remove the inline failsafe styles added to the HTML element
                           so the CSS class transform (translateY 0) can take effect. */
                        mp.style.removeProperty('transform');
                        mp.style.removeProperty('pointer-events');
                    }
                    document.body.classList.add('bz-has-player');
                })();


                /* ── FIX: Instant position paint on refresh ───────────────────────
                   Read beatZen_lastPosition from localStorage and paint the
                   current-time, duration, AND progress bar immediately — before
                   any audio event fires — so the bar never flashes 0:00/--:-- on
                   refresh. Duration is now saved in the position payload (field 'd')
                   so all three elements can be restored without waiting for metadata.
                ─────────────────────────────────────────────────────────────────── */
                try {
                    const posRaw = localStorage.getItem('beatZen_lastPosition');
                    if (posRaw) {
                        let savedTime = NaN, savedDur = NaN, savedPosId = '';
                        try {
                            const parsed = JSON.parse(posRaw);
                            if (parsed && typeof parsed === 'object' && 't' in parsed) {
                                savedTime = parseFloat(parsed.t);
                                savedDur = parseFloat(parsed.d);
                                savedPosId = String(parsed.id || '');
                            } else {
                                savedTime = parseFloat(posRaw);
                            }
                        } catch (_pe) { savedTime = parseFloat(posRaw); }

                        /* Only paint if position belongs to this song */
                        const posMatchesSong = !savedPosId || !songId || savedPosId === String(songId);
                        if (posMatchesSong && isFinite(savedTime) && savedTime > 2) {
                            const _fmt = (s) => isNaN(s) ? '0:00' : `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
                            document.querySelectorAll('#current-time').forEach(el => el.textContent = _fmt(savedTime));
                            if (isFinite(savedDur) && savedDur > 0) {
                                /* Paint full duration immediately — no metadata wait */
                                document.querySelectorAll('#duration').forEach(el => el.textContent = _fmt(savedDur));
                                /* Paint progress bar width immediately */
                                const pct = Math.min(100, (savedTime / savedDur) * 100);
                                document.querySelectorAll('#progress').forEach(el => el.style.width = `${pct}%`);
                            } else {
                                /* Duration not yet in payload (old save) — show placeholder */
                                document.querySelectorAll('#duration').forEach(el => el.textContent = '--:--');
                            }
                        }
                    }
                } catch (_posErr) { /* silent — cosmetic only */ }

            } catch (_) { /* silent — full restore will handle it */ }
        })();

        /* STATE */
        window.currentAlbum = null;
        window.playingAlbum = null;
        window.currentSongIndex = -1;
        window.isShuffling = localStorage.getItem('beatZen_shuffle') === 'true';
        // REPEAT MODE: 0 = off, 1 = repeat all (album/playlist loops), 2 = repeat one (single song)
        window.repeatMode = parseInt(localStorage.getItem('beatZen_repeat_mode') || '0', 10);
        if (![0, 1, 2].includes(window.repeatMode)) window.repeatMode = 0;
        // Legacy migration: old 'beatZen_loop' = true maps to mode 2 (repeat one)
        if (!localStorage.getItem('beatZen_repeat_mode') && localStorage.getItem('beatZen_loop') === 'true') {
            window.repeatMode = 2;
            localStorage.setItem('beatZen_repeat_mode', '2');
        }
        window.isLooping = window.repeatMode === 2; // legacy compat alias used in several places
        // Tracks how many songs the current album/playlist had when it started playing.
        // Songs added via "Play Next" / "Add to End of Queue" splice into playingAlbum.songs
        // but should NOT be included in repeat-all loops — only the original source songs loop.
        window._bzSourceSongCount = 0;
        // Snapshot of manually-queued songs saved when repeat-all is turned ON.
        // Restored when repeat is turned OFF so the queue comes back intact.
        window._bzPreRepeatAllQueue = null;
        window.isHistoryEnabled = localStorage.getItem('beatzen_history') === 'true';
        window.historyList = JSON.parse(localStorage.getItem('beatZen_history_auto') || '[]');
        // FIX Bug 8: pre-seed scrollPositions from localStorage so the first navigation
        // before any scroll event has fired doesn't fall back to a stale 0.
        // FIX E3: also pre-seed 'settings' — was missing from original, causing
        // Settings scroll position to reset to 0 on first navigation away and back.
        window.scrollPositions = {
            home: parseInt(localStorage.getItem('beatZen_scroll_home') || '0', 10) || 0,
            playlists: parseInt(localStorage.getItem('beatZen_scroll_playlists') || '0', 10) || 0,
            search: parseInt(localStorage.getItem('beatZen_scroll_search') || '0', 10) || 0,
            settings: parseInt(localStorage.getItem('beatZen_scroll_settings') || '0', 10) || 0
        };
        // FIX: the album/song-list view never had its own scroll position tracked at
        // all — the global scroll listener explicitly skips saving while the album
        // view is open (see the albumViewContainer.style.display check below), and
        // selectAlbum() always force-scrolled to 0 on open with no saved-position
        // lookup. That meant reloading (or deep-linking into) an album page always
        // landed at the top instead of where the user left off.
        // Keyed per-album (not a single flat value) so switching between albums
        // doesn't bleed one album's scroll position into another's.
        window._bzAlbumScrollKey = (albumId) => `beatZen_scroll_album_${albumId}`;
        window._bzGetAlbumScroll = (albumId) => {
            if (!albumId) return 0;
            return parseInt(localStorage.getItem(window._bzAlbumScrollKey(albumId)) || '0', 10) || 0;
        };
        window._bzSetAlbumScroll = (albumId, y) => {
            if (!albumId) return;
            localStorage.setItem(window._bzAlbumScrollKey(albumId), String(Math.max(0, Math.round(y))));
        };

        /* SEARCH KEYS — declared at top level so initSettings() can reference them */
        const RECENT_SEARCHES_KEY = 'beatZen_recentSearches';
        const RECENT_SEARCHES_ENABLED_KEY = 'beatZen_recentSearchesEnabled';
        const MAX_RECENT_SEARCHES = 5;

        let timerInterval = null;
        let isDragging = false;
        let selH = 0, selM = 0, selS = 0;

        /* DATA POOL */
        const allYears = Object.keys(customYearAlbumsData || {}).sort().reverse();
        const allAlbums = Object.values(customYearAlbumsData || {}).flat().filter(a => a && (a.id || a.title));
        const exploreList = typeof customGenreData !== 'undefined' ? Object.values(customGenreData).flat().filter(Boolean) : [];
        const playlistList = [];

        window.masterPool = [...allAlbums, ...exploreList, ...playlistList];

        const savedPlaylists = JSON.parse(localStorage.getItem('beatZen_importedPlaylists') || '[]');
        savedPlaylists.forEach(pl => {
            pl.id = String(pl.id);
            pl.isImported = true;
            pl.songs = (pl.songs || []).map(s => (typeof s === 'object' && s !== null) ? { ...s } : s);
            if (!window.masterPool.some(m => String(m.id || m.name) === pl.id)) window.masterPool.push(pl);
        });

        /* SONG MAP
         * ─────────────────────────────────────────────────────────────────────────
         * DESIGN: allSongsMap stores the CANONICAL song object keyed by song ID.
         * Canonical = the record that lives directly inside a Movie album (allAlbums).
         * Artist / Explore / Playlist entries reference these same IDs as strings —
         * they do NOT overwrite the canonical entry.  This prevents cross-album
         * contamination where opening Artist A would show Artist B's cover art
         * because they share a song and the last writer wins.
         * ─────────────────────────────────────────────────────────────────────────
         */
        window.allSongsMap = new Map();
        window.rebuildMasterMap = function () {
            window.allSongsMap.clear();

            // PASS 1 — index only from the authoritative Movie/Album pool.
            // These are the ground-truth song objects with full metadata + cover art.
            allAlbums.forEach(album => {
                if (!album || !Array.isArray(album.songs)) return;
                album.songs.forEach(song => {
                    if (!song || typeof song !== 'object') return;
                    const sId = String(song.id);
                    // Only write if not already present — first definition wins.
                    if (!window.allSongsMap.has(sId)) {
                        window.allSongsMap.set(sId, { ...song, album });
                    }
                });
            });

            // PASS 2 — index imported/user playlists that may contain full song objects
            // not present in allAlbums (manually created songs with no movie source).
            window.masterPool.forEach(album => {
                if (!album || !Array.isArray(album.songs)) return;
                // Skip plain movie albums — already handled in Pass 1
                const isMovieAlbum = allAlbums.some(a => String(a.id) === String(album.id));
                if (isMovieAlbum) return;
                album.songs.forEach(song => {
                    if (!song || typeof song !== 'object') return;
                    const sId = String(song.id);
                    if (!window.allSongsMap.has(sId)) {
                        // Resolve source album for cover art
                        const sourceEntry = window.allSongsMap.get(sId);
                        const sourceAlbum = sourceEntry?.album || album;
                        window.allSongsMap.set(sId, { ...song, album: sourceAlbum });
                    }
                });
            });
        };
        window.rebuildMasterMap();

        /* ── Migrate existing history entries:
              1. Fix Sheets-serialised duration values ("Sat Dec 30 1899…" → "3:45")
              2. Add albumId / albumTitle / albumCover if missing               ── */
        (function migrateHistoryAlbumFields() {
            try {
                const raw = localStorage.getItem('beatZen_history_auto');
                if (!raw) return;
                const list = JSON.parse(raw);
                let changed = false;

                function fixDur(v) {
                    if (!v && v !== 0) return '';
                    const s = String(v).trim();
                    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) return s;
                    const dm = s.match(/(\d{1,2}):(\d{2}):(\d{2})/);
                    if (dm) {
                        const tot = parseInt(dm[1], 10) * 3600 + parseInt(dm[2], 10) * 60 + parseInt(dm[3], 10);
                        if (tot > 0) return `${Math.floor(tot / 60)}:${String(tot % 60).padStart(2, '0')}`;
                    }
                    const n = parseFloat(s);
                    if (!isNaN(n) && n > 0 && n < 1) {
                        const tot = Math.round(n * 86400);
                        return `${Math.floor(tot / 60)}:${String(tot % 60).padStart(2, '0')}`;
                    }
                    return s;
                }

                list.forEach(entry => {
                    // Fix duration
                    const fixedDur = fixDur(entry.duration);
                    if (fixedDur !== String(entry.duration || '')) {
                        entry.duration = fixedDur;
                        changed = true;
                    }
                    // Fix album fields
                    if (!entry.albumId || !entry.albumTitle) {
                        const canonical = window.allSongsMap.get(String(entry.id));
                        const album = canonical?.album;
                        if (album) {
                            entry.albumId = String(album.id || '');
                            entry.albumTitle = album.title || album.name || entry.sourceName || '';
                            entry.albumCover = album.imageUrl || album.albumCover || entry._coverUrl || '';
                            changed = true;
                        } else if (entry.sourceName && !entry.albumTitle) {
                            entry.albumTitle = entry.sourceName;
                            entry.albumCover = entry._coverUrl || '';
                            changed = true;
                        }
                    }
                });
                if (changed) localStorage.setItem('beatZen_history_auto', JSON.stringify(list));
            } catch (e) { /* silent — don't break startup */ }
        })();

        /* customArtistsData — songs are resolved dynamically at render time
           from allSongsMap by name-matching in buildArtistsSection (playlists.js).
           Do NOT pre-set a.songs = [] here; that would mask the dynamic lookup. */

        /* DOM REFERENCES */
        const audioPlayer = document.getElementById('audio-player');

        /* ── FIX: Volume Persistence ────────────────────────────────────────
           Restore the saved volume on every page load so the user never has
           to re-adjust after a refresh.  A volumechange listener (wired below
           with the other audio events) saves the level on every change.
        ─────────────────────────────────────────────────────────────────── */
        (function restoreSavedVolume() {
            const v = parseFloat(localStorage.getItem('beatZen_volume'));
            if (!isNaN(v) && v >= 0 && v <= 1) audioPlayer.volume = v;
        })();

        /* ── FIX: Gapless Playback – hidden preload buffer ──────────────────
           A second, silent <audio> element starts fetching the next song
           ~15 s before the current one ends.  When the track does end we skip
           audioPlayer.load() (which clears the decode buffer and causes the
           audible gap) and play directly from the browser's HTTP cache that
           the preload element already filled.
        ─────────────────────────────────────────────────────────────────── */
        const _preloadAudio = document.createElement('audio');
        _preloadAudio.preload = 'auto';
        _preloadAudio.volume = 0;
        _preloadAudio.muted = true;
        _preloadAudio.setAttribute('aria-hidden', 'true');
        _preloadAudio.style.cssText =
            'position:fixed;top:-9999px;left:-9999px;width:0;height:0;pointer-events:none;';
        document.body.appendChild(_preloadAudio);

        let _gpIdx = -1;    // song index currently being pre-fetched
        let _gpReady = false; // true once canplaythrough fires
        let _gpSrc = '';    // URL that was prefetched

        function bzPreloadNext() {
            if (window.repeatMode === 2) return; // repeat-one: no need to prefetch next
            if (window._bzOffline) return;   // don't preload on no connection
            const nextIdx = (window.currentSongIndex ?? -1) + 1;
            const nextSong = window.playingAlbum?.songs?.[nextIdx];
            if (!nextSong?.url || nextIdx === _gpIdx) return;
            _gpIdx = nextIdx;
            _gpReady = false;
            _gpSrc = nextSong.url;
            _preloadAudio.oncanplaythrough = () => {
                if (_preloadAudio.src.endsWith(_gpSrc) || _preloadAudio.src === _gpSrc) {
                    _gpReady = true;
                }
            };
            // Reset preload index on error so playSong falls back to normal load()
            _preloadAudio.onerror = () => { _gpReady = false; _gpIdx = -1; };
            _preloadAudio.src = _gpSrc;
            try { _preloadAudio.load(); } catch (_) { /* ignore */ }
        }
        window._bzPreloadNext = bzPreloadNext;
        const playPauseBtn = document.getElementById('play-pause-btn');
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        const playerSongTitle = document.getElementById('player-song-title');
        const playerSongArtist = document.getElementById('player-song-artist');
        const playerAlbumCover = document.getElementById('player-album-cover');
        const progressBar = document.getElementById('progress-bar');
        const progress = document.getElementById('progress');
        const currentTimeSpan = document.getElementById('current-time');
        const durationSpan = document.getElementById('duration');
        const homeLink = document.getElementById('home-link');
        const searchLink = document.getElementById('search-link');
        const playlistsLink = document.getElementById('playlists-link');
        const artistsLink = document.getElementById('artists-link');
        const settingsLink = document.getElementById('settings-link');
        const updatesLink = document.getElementById('updates-link');
        const darkModeToggle = document.getElementById('dark-mode-toggle');
        const searchContainer = document.getElementById('search-container');
        const yearSectionsContainer = document.getElementById('year-sections-container');
        const playlistsContainer = document.getElementById('playlists-container');
        const exploreContainer = playlistsContainer; /* alias — explore content now lives in playlists */
        const artistsContainer = document.getElementById('artists-container');
        const settingsContainer = document.getElementById('settings-container');
        const updatesContainer = document.getElementById('updates-container');
        const albumViewContainer = document.getElementById('album-view-container');
        const albumMainContent = document.getElementById('album-main-content');
        const searchResultsContainer = document.getElementById('search-results-container');
        const timerBtn = document.getElementById('timer-btn');
        const timerPopup = document.getElementById('timer-popup');
        const timerMainHeading = timerPopup?.querySelector('h3');
        const timerSubText = document.getElementById('bz-timer-sub');
        const cancelTimerBtn = document.getElementById('cancel-timer-btn');
        const timerDisplay = document.getElementById('timer-display');
        const timerHeading = document.getElementById('timer-heading');
        const maximizeBtn = document.getElementById('maximize-btn');
        const mainPlayer = document.getElementById('main-player');
        const minimizeBtn = document.getElementById('minimize-btn');
        const closeTimerBtn = document.getElementById('close-timer-popup');
        const contactForm = document.getElementById('contact-form');
        const successPopup = document.getElementById('success-popup');
        const closeSuccessBtn = document.getElementById('close-success-popup');
        const timerEndedPopup = document.getElementById('timer-ended-popup');
        const actualSearchBar = document.getElementById('search-bar');
        const clearSearchBtn = document.getElementById('clear-search');



        const startTimerBtn = document.getElementById('start-timer-btn');

        /* SETTINGS */
        function applyDarkMode(enabled) {
            document.body.classList.toggle('dark-mode', enabled);
            localStorage.setItem('beatzen_dark_mode', enabled);
        }

        /* History storage key — declared early so settings clear button can reference it */
        const HISTORY_KEY = 'beatZen_history_auto';
        const HISTORY_MAX = 100;
        /* Separate store for Repeat Rewind qualifying plays.
           Every completed play (or loop iteration) is recorded here — no minimum
           listen-time gate. Songs need 3+ entries to appear in Repeat Rewind.  */
        const BZ_RR_PLAYS_KEY = 'beatZen_rr_plays';
        const BZ_RR_PLAYS_MAX = 500;
        const BZ_RR_LISTEN_SECS = 0;   // No minimum seconds threshold — every play qualifies
        const BZ_RR_MIN_PLAYS = 3;     // minimum qualifying plays to enter Repeat Rewind

        function initSettings() {
            /* ── Immediate cloud sync on settings changes (silent — no toast) ── */
            function _bzSyncNow() {
                if (typeof window.bzImmediateUpload === 'function') window.bzImmediateUpload();
            }

            const savedDark = localStorage.getItem('beatzen_dark_mode') === 'true';
            applyDarkMode(savedDark);
            if (darkModeToggle) {
                darkModeToggle.checked = savedDark;
                darkModeToggle.addEventListener('change', () => {
                    /* Block if schedule is currently managing dark mode */
                    if (localStorage.getItem('beatzen_schedule_dm_enabled') === 'true') return;
                    applyDarkMode(darkModeToggle.checked);
                    _bzSyncNow('✓ Dark mode ' + (darkModeToggle.checked ? 'on' : 'off') + ' — synced to cloud');
                });
            }
            const historyToggle = document.getElementById('history-toggle');
            /* Default ON for new users — only treat as disabled when explicitly set to 'false' */
            if (localStorage.getItem('beatzen_history') === null) {
                localStorage.setItem('beatzen_history', 'true');
            }
            const savedHistory = localStorage.getItem('beatzen_history') !== 'false';
            window.isHistoryEnabled = savedHistory;
            if (historyToggle) {
                historyToggle.checked = savedHistory;
                historyToggle.addEventListener('change', () => {
                    window.isHistoryEnabled = historyToggle.checked;
                    localStorage.setItem('beatzen_history', String(historyToggle.checked));
                    /* Re-render Explore so Listen Again section appears/disappears instantly */
                    if (typeof window.renderExplore === 'function') window.renderExplore();
                    _bzSyncNow('✓ Play history ' + (historyToggle.checked ? 'on' : 'off') + ' — synced to cloud');
                });
            }

            /* ── AUTO MIX TOGGLE ── */
            const autoMixToggle = document.getElementById('automix-toggle');
            if (autoMixToggle) {
                autoMixToggle.checked = localStorage.getItem('beatzen_automix') === 'true';
                autoMixToggle.addEventListener('change', () => {
                    localStorage.setItem('beatzen_automix', String(autoMixToggle.checked));
                    if (autoMixToggle.checked && typeof window.bzTriggerAutoMix === 'function') {
                        window.bzTriggerAutoMix();
                        showToast('Auto Mix enabled — queue will fill with your top songs');
                    } else {
                        showToast('Auto Mix disabled');
                    }
                    _bzSyncNow('✓ Auto Mix synced to cloud');
                });
            }

            /* ── RECENT SEARCHES TOGGLE ── */
            const recentSearchesToggle = document.getElementById('recent-searches-toggle');
            if (recentSearchesToggle) {
                recentSearchesToggle.checked = isRecentSearchesEnabled();
                recentSearchesToggle.addEventListener('change', () => {
                    localStorage.setItem(RECENT_SEARCHES_ENABLED_KEY, recentSearchesToggle.checked);
                    if (!recentSearchesToggle.checked) {
                        /* Wipe saved queries and dismiss panel immediately when disabled */
                        localStorage.removeItem(RECENT_SEARCHES_KEY);
                        document.getElementById('recent-searches-panel')?.remove();
                    } else {
                        /* Show panel immediately if user is on search and bar is empty */
                        const searchView = document.getElementById('search-container');
                        const bar = document.getElementById('search-bar');
                        if (searchView && !searchView.classList.contains('hidden') && bar && !bar.value.trim()) {
                            renderRecentSearches();
                        }
                    }
                    _bzSyncNow('✓ Recent searches ' + (recentSearchesToggle.checked ? 'on' : 'off') + ' — synced to cloud');
                });
            }

            /* ── KEYBOARD SHORTCUTS TOGGLE ── */
            const shortcutsToggle = document.getElementById('shortcuts-toggle');
            const viewShortcutsBtn = document.getElementById('view-shortcuts-btn');
            const savedShortcuts = localStorage.getItem('beatzen_shortcuts') === 'true';
            if (shortcutsToggle) {
                shortcutsToggle.checked = savedShortcuts;
                if (viewShortcutsBtn) viewShortcutsBtn.style.display = savedShortcuts ? 'block' : 'none';
                shortcutsToggle.addEventListener('change', () => {
                    localStorage.setItem('beatzen_shortcuts', shortcutsToggle.checked);
                    if (viewShortcutsBtn) viewShortcutsBtn.style.display = shortcutsToggle.checked ? 'block' : 'none';
                    _bzSyncNow('✓ Shortcuts ' + (shortcutsToggle.checked ? 'on' : 'off') + ' — synced to cloud');
                });
            }
            if (viewShortcutsBtn) {
                viewShortcutsBtn.addEventListener('click', () => {
                    if (window.showShortcutsCheatSheet) window.showShortcutsCheatSheet();
                });
            }

            const clearHistBtn = document.getElementById('clear-history-btn');
            if (clearHistBtn) {
                clearHistBtn.addEventListener('click', () => {
                    bzConfirm('danger', 'Clear History?', 'All play history will be removed.', () => {
                        localStorage.removeItem(HISTORY_KEY);
                        /* Also clear the Repeat Rewind qualifying plays store */
                        localStorage.removeItem(BZ_RR_PLAYS_KEY);
                        /* FIX B2: Also clear behavior signals so smart playlists (Made For You,
                           Auto-Mix) are no longer influenced by supposedly-cleared listening data.
                           Previously only HISTORY_KEY and BZ_RR_PLAYS_KEY were removed, leaving
                           beatZen_signals intact, so "Made For You" recommendations still showed
                           songs from the cleared history on the next Playlists render. */
                        const BZ_SIGNALS_KEY = 'beatZen_signals';
                        localStorage.removeItem(BZ_SIGNALS_KEY);
                        if (typeof customGenreData !== 'undefined') customGenreData['History'] = [];
                        patchHistoryPanel([]);
                        /* Remove Recently Played card from Playlists Made for You */
                        if (typeof window.bzRemoveListenAgainPlaylist === 'function') window.bzRemoveListenAgainPlaylist();
                        /* Re-render Explore so Listen Again disappears immediately */
                        if (typeof window.renderExplore === 'function') window.renderExplore();
                        showToast('Play history cleared');
                        _bzSyncNow('✓ History cleared — synced to cloud');
                    }, 'Clear', 'Cancel');
                });
            }

            /* ── DELETE ALL USER PLAYLISTS + RESTORE ── */
            const deletePlaylistsBtn = document.getElementById('delete-playlists-btn');
            const restorePlaylistsBtn = document.getElementById('restore-playlists-btn');

            /* Show/hide restore button based on whether a backup exists */
            function syncRestorePlaylistsBtn() {
                if (!restorePlaylistsBtn) return;
                const hasBackup = !!sessionStorage.getItem('_bz_deleted_playlists_backup');
                restorePlaylistsBtn.style.display = hasBackup ? 'inline-flex' : 'none';
            }
            syncRestorePlaylistsBtn();

            if (deletePlaylistsBtn) {
                deletePlaylistsBtn.addEventListener('click', () => {
                    const userPls = window.masterPool.filter(p =>
                        p.type === 'Playlist' || p.isImported ||
                        String(p.id).startsWith('user-') || String(p.id).startsWith('imported-')
                    );
                    const count = userPls.length;
                    if (count === 0) { showToast('No playlists to delete'); return; }

                    bzConfirm(
                        'danger',
                        'Delete All Playlists?',
                        `This will remove all ${count} playlist${count !== 1 ? 's' : ''}. You can restore them before closing this page.`,
                        () => {
                            /* Back up to sessionStorage before deleting */
                            sessionStorage.setItem('_bz_deleted_playlists_backup',
                                JSON.stringify(userPls));

                            /* Remove from masterPool and localStorage */
                            window.masterPool = window.masterPool.filter(p =>
                                !(p.type === 'Playlist' || p.isImported ||
                                    String(p.id).startsWith('user-') || String(p.id).startsWith('imported-'))
                            );
                            localStorage.removeItem('beatZen_importedPlaylists');

                            if (typeof displayPlaylists === 'function') displayPlaylists(true);
                            syncRestorePlaylistsBtn();
                            showToast(`✓ ${count} playlist${count !== 1 ? 's' : ''} deleted — Restore available`);
                            _bzSyncNow('✓ Playlists deleted — synced to cloud');
                        },
                        'Delete All', 'Cancel'
                    );
                });
            }

            if (restorePlaylistsBtn) {
                restorePlaylistsBtn.addEventListener('click', () => {
                    const raw = sessionStorage.getItem('_bz_deleted_playlists_backup');
                    if (!raw) { showToast('No backup available'); return; }

                    bzConfirm(
                        'success',
                        'Restore Playlists?',
                        'All deleted playlists will be brought back exactly as they were.',
                        () => {
                            try {
                                const backup = JSON.parse(raw);
                                backup.forEach(pl => {
                                    pl.id = String(pl.id);
                                    pl.isImported = true;
                                    pl.songs = (pl.songs || []).map(s =>
                                        typeof s === 'object' && s !== null ? { ...s } : s
                                    );
                                    if (!window.masterPool.some(m => String(m.id || m.name) === pl.id)) {
                                        window.masterPool.push(pl);
                                    }
                                });
                                /* Persist restored playlists */
                                localStorage.setItem('beatZen_importedPlaylists', JSON.stringify(backup));
                                /* Clear backup now that it's restored */
                                sessionStorage.removeItem('_bz_deleted_playlists_backup');

                                if (typeof displayPlaylists === 'function') displayPlaylists(true);
                                syncRestorePlaylistsBtn();
                                showToast(`✓ ${backup.length} playlist${backup.length !== 1 ? 's' : ''} restored`);
                                _bzSyncNow('✓ Playlists restored — synced to cloud');
                            } catch (e) {
                                console.error('Restore failed:', e);
                                showToast('Restore failed — backup may be corrupted');
                            }
                        },
                        'Restore', 'Cancel'
                    );
                });
            }

            /* ── EXPLORE PLAYLISTS — Remove & Restore ── */
            const removeExploreBtn = document.getElementById('remove-explore-btn');
            const restoreExploreBtn = document.getElementById('restore-explore-btn');

            /* Show/hide restore button based on whether a backup exists */
            function syncRestoreExploreBtn() {
                if (!restoreExploreBtn) return;
                const hasBackup = !!sessionStorage.getItem('_bz_deleted_explore_backup');
                restoreExploreBtn.style.display = hasBackup ? 'inline-flex' : 'none';
            }
            syncRestoreExploreBtn();

            if (removeExploreBtn) {
                removeExploreBtn.addEventListener('click', () => {
                    const exploreCount = (window.dailyPlaylistGroups || [])
                        .reduce((n, g) => n + (g.playlists?.length || 0), 0);

                    bzConfirm(
                        'warning',
                        'Remove Explore Playlists?',
                        'All daily and generated playlists will be cleared. You can restore them before closing this page.',
                        () => {
                            /* Back up current dailyPlaylistGroups */
                            sessionStorage.setItem('_bz_deleted_explore_backup',
                                JSON.stringify(window.dailyPlaylistGroups || []));

                            /* Clear explore playlists */
                            window.dailyPlaylistGroups = [];
                            if (typeof customGenreData !== 'undefined') {
                                delete customGenreData['Your Daily Mix'];
                                delete customGenreData['Recap'];
                            }
                            window.masterPool = window.masterPool.filter(p =>
                                !(p.type === 'Explore' && String(p.id || '').includes('daily-'))
                            );

                            const expContainer = document.getElementById('playlists-container');
                            if (expContainer && expContainer.style.display !== 'none') {
                                if (typeof displayexplore === 'function') displayexplore(true);
                            }
                            syncRestoreExploreBtn();
                            showToast('✓ Explore playlists removed — Restore available');
                        },
                        'Remove', 'Cancel'
                    );
                });
            }

            if (restoreExploreBtn) {
                restoreExploreBtn.addEventListener('click', () => {
                    const raw = sessionStorage.getItem('_bz_deleted_explore_backup');
                    if (!raw) { showToast('No backup available'); return; }

                    bzConfirm(
                        'success',
                        'Restore Explore Playlists?',
                        'All removed daily and generated playlists will be brought back.',
                        () => {
                            try {
                                const backup = JSON.parse(raw);
                                window.dailyPlaylistGroups = backup;

                                /* Re-add any explore entries that were stripped from masterPool */
                                backup.forEach(group => {
                                    (group.playlists || []).forEach(pl => {
                                        if (!window.masterPool.some(m =>
                                            String(m.id || m.name) === String(pl.id))) {
                                            window.masterPool.push(pl);
                                        }
                                    });
                                });

                                /* Clear backup */
                                sessionStorage.removeItem('_bz_deleted_explore_backup');

                                const expContainer = document.getElementById('playlists-container');
                                if (expContainer && expContainer.style.display !== 'none') {
                                    if (typeof displayexplore === 'function') displayexplore(true);
                                }
                                syncRestoreExploreBtn();
                                const total = backup.reduce((n, g) => n + (g.playlists?.length || 0), 0);
                                showToast(`✓ ${total} explore playlist${total !== 1 ? 's' : ''} restored`);
                            } catch (e) {
                                console.error('Explore restore failed:', e);
                                showToast('Restore failed — backup may be corrupted');
                            }
                        },
                        'Restore', 'Cancel'
                    );
                });
            }
            const exportBtn = document.getElementById('export-data-btn');
            if (exportBtn) {
                exportBtn.addEventListener('click', () => {
                    try {
                        /* Collect ALL Beat Zen data from localStorage */
                        const payload = {
                            _version: 4,
                            _exported: new Date().toISOString(),
                            _app: 'BeatZen',
                            /* Playlists */
                            beatZen_importedPlaylists: JSON.parse(localStorage.getItem('beatZen_importedPlaylists') || '[]'),
                            /* Play history */
                            beatZen_history_auto: JSON.parse(localStorage.getItem('beatZen_history_auto') || '[]'),
                            /* Repeat Rewind qualifying plays */
                            beatZen_rr_plays: JSON.parse(localStorage.getItem('beatZen_rr_plays') || '[]'),
                            /* Preferences */
                            beatzen_dark_mode: localStorage.getItem('beatzen_dark_mode') || 'false',
                            beatzen_history: localStorage.getItem('beatzen_history') || 'false',
                            beatzen_automix: localStorage.getItem('beatzen_automix') || 'false',
                            /* Last played session */
                            lastPlayedSong: localStorage.getItem('lastPlayedSong') || null,
                            beatZen_lastPosition: localStorage.getItem('beatZen_lastPosition') || null,
                        };
                        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const now = new Date();
                        const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
                        const a = document.createElement('a');
                        a.href = url; a.download = `beatzen_backup_${stamp}.json`;
                        document.body.appendChild(a); a.click(); a.remove();
                        URL.revokeObjectURL(url);
                        showToast('✓ Data exported successfully');
                    } catch (e) {
                        console.error('Export failed:', e);
                        showToast('Export failed. Please try again.');
                    }
                });
            }

            /* ── IMPORT DATA ── */
            const importBtn = document.getElementById('import-data-btn');
            const fileInput = document.getElementById('data-file-input');
            if (importBtn && fileInput) {
                importBtn.addEventListener('click', () => fileInput.click());
                fileInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        try {
                            const payload = JSON.parse(ev.target.result);
                            if (!payload || payload._app !== 'BeatZen') {
                                showToast('Invalid Beat Zen backup file.');
                                return;
                            }
                            bzConfirm('warning', 'Import Backup?', 'Overwrites playlists, history & settings.', () => {
                                if (Array.isArray(payload.beatZen_importedPlaylists)) {
                                    localStorage.setItem('beatZen_importedPlaylists', JSON.stringify(payload.beatZen_importedPlaylists));
                                }
                                if (Array.isArray(payload.beatZen_history_auto)) {
                                    localStorage.setItem('beatZen_history_auto', JSON.stringify(payload.beatZen_history_auto));
                                    if (typeof customGenreData !== 'undefined') {
                                        customGenreData['History'] = payload.beatZen_history_auto;
                                    }
                                }
                                /* Restore Repeat Rewind qualifying plays (may be absent in older backups) */
                                if (Array.isArray(payload.beatZen_rr_plays)) {
                                    localStorage.setItem('beatZen_rr_plays', JSON.stringify(payload.beatZen_rr_plays));
                                }
                                if (payload.beatzen_dark_mode !== undefined) {
                                    localStorage.setItem('beatzen_dark_mode', payload.beatzen_dark_mode);
                                    applyDarkMode(payload.beatzen_dark_mode === 'true');
                                    if (darkModeToggle) darkModeToggle.checked = payload.beatzen_dark_mode === 'true';
                                }
                                if (payload.beatzen_history !== undefined) {
                                    localStorage.setItem('beatzen_history', payload.beatzen_history);
                                    window.isHistoryEnabled = payload.beatzen_history === 'true';
                                    const historyToggle = document.getElementById('history-toggle');
                                    if (historyToggle) historyToggle.checked = payload.beatzen_history === 'true';
                                }
                                if (payload.beatzen_automix !== undefined) {
                                    localStorage.setItem('beatzen_automix', payload.beatzen_automix);
                                    const autoMixToggle = document.getElementById('automix-toggle');
                                    if (autoMixToggle) autoMixToggle.checked = payload.beatzen_automix === 'true';
                                }
                                if (payload.lastPlayedSong) localStorage.setItem('lastPlayedSong', payload.lastPlayedSong);
                                if (payload.beatZen_lastPosition) localStorage.setItem('beatZen_lastPosition', payload.beatZen_lastPosition);
                                fileInput.value = '';
                                showToast('✓ Data imported successfully');
                                setTimeout(() => location.reload(), 1200);
                            }, 'Import', 'Cancel');
                        } catch (err) {
                            console.error('Import failed:', err);
                            showToast('Import failed — file may be corrupted.');
                            fileInput.value = '';
                        }
                    };
                    reader.readAsText(file);
                });
            }
        }
        initSettings();
        initScheduledDarkMode();

        /* ═══════════════════════════════════════════════════════════════
           SCHEDULED DARK MODE
           Keys: beatzen_schedule_dm_enabled, beatzen_schedule_dm_days (JSON array),
                 beatzen_schedule_dm_on ("HH:MM"), beatzen_schedule_dm_off ("HH:MM")
        ═══════════════════════════════════════════════════════════════ */
        function initScheduledDarkMode() {
            const SDM_ENABLED_KEY = 'beatzen_schedule_dm_enabled';
            const SDM_DAYS_KEY = 'beatzen_schedule_dm_days';
            const SDM_ON_KEY = 'beatzen_schedule_dm_on';
            const SDM_OFF_KEY = 'beatzen_schedule_dm_off';

            let _sdmOnTimer = null;
            let _sdmOffTimer = null;

            /* ── Read saved state ── */
            function getSavedDays() { try { return JSON.parse(localStorage.getItem(SDM_DAYS_KEY) || '["daily"]'); } catch (_) { return ['daily']; } }
            function getSavedOn() { return localStorage.getItem(SDM_ON_KEY) || '22:00'; }
            function getSavedOff() { return localStorage.getItem(SDM_OFF_KEY) || '07:00'; }
            function isEnabled() { return localStorage.getItem(SDM_ENABLED_KEY) === 'true'; }

            /* ── Check if today matches selected days ── */
            function isTodayActive(days) {
                if (!days || days.includes('daily')) return true;
                const dow = new Date().getDay(); // 0=Sun … 6=Sat
                return days.map(Number).includes(dow);
            }

            /* ── Check if current time is inside the ON window ── */
            function isInsideWindow(onStr, offStr) {
                const [onH, onM] = onStr.split(':').map(Number);
                const [offH, offM] = offStr.split(':').map(Number);
                const now = new Date();
                const cur = now.getHours() * 60 + now.getMinutes();
                const on = onH * 60 + onM;
                const off = offH * 60 + offM;
                /* Overnight: e.g. 22:00 → 07:00 */
                if (on > off) return cur >= on || cur < off;
                return cur >= on && cur < off;
            }

            /* ── Apply or remove dark mode via schedule, update UI ── */
            function applySchedule() {
                if (!isEnabled()) return;
                const days = getSavedDays();
                const onStr = getSavedOn();
                const offStr = getSavedOff();
                const active = isTodayActive(days) && isInsideWindow(onStr, offStr);
                applyDarkMode(active);
                if (darkModeToggle) darkModeToggle.checked = active;
                updateBadge(active, onStr, offStr);
                armTimers(onStr, offStr, days);
            }

            /* ── Update the "Dark mode active via schedule" badge ── */
            function updateBadge(active, onStr, offStr) {
                const badge = document.getElementById('schedule-dm-active-badge');
                const text = document.getElementById('schedule-dm-badge-text');
                if (!badge) return;
                if (active) {
                    badge.style.display = 'flex';
                    if (text) text.textContent = `Dark mode active · off at ${fmt12(offStr)}`;
                } else {
                    badge.style.display = 'none';
                }
            }

            /* ── Update the status subtext + the coloured ON pill ── */
            function updateStatusText() {
                const el = document.getElementById('schedule-dm-status-text');
                const pill = document.getElementById('sdm-active-pill');
                const pillText = document.getElementById('sdm-active-pill-text');
                const collapseLabel = document.getElementById('sdm-collapse-label');
                const SDM_SET_KEY = 'beatzen_schedule_dm_set';
                const scheduleSet = localStorage.getItem(SDM_SET_KEY) === 'true';

                if (!isEnabled()) {
                    if (el) { el.style.display = ''; el.textContent = 'Auto-enable dark mode on a schedule'; }
                    if (pill) pill.style.display = 'none';
                    return;
                }
                const days = getSavedDays();
                const onStr = getSavedOn();
                const offStr = getSavedOff();
                const dayLabel = days.includes('daily') ? 'Daily' : days.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ');

                // When schedule is confirmed: hide the plain subtext, show the pill instead.
                // Pill contains: blink dot + "Schedule is active" label + separator + time range.
                if (scheduleSet) {
                    if (el) el.style.display = 'none';
                    if (pill && pillText) {
                        // Only the time range goes in pillText (the "Schedule is active" label
                        // is a separate static <span> inside the pill in the HTML).
                        pillText.textContent = `${dayLabel} · ${fmt12(onStr)} – ${fmt12(offStr)}`;
                        pill.style.display = 'inline-flex';
                    }
                } else {
                    if (el) { el.style.display = ''; el.textContent = `${dayLabel} · ${fmt12(onStr)} – ${fmt12(offStr)}`; }
                    if (pill) pill.style.display = 'none';
                }

                // Update collapse button label: "Edit timings" when collapsed, "Close" when open
                if (collapseLabel) {
                    const isCollapsed = document.getElementById('sdm-collapse-btn')?.classList.contains('collapsed');
                    collapseLabel.textContent = isCollapsed ? 'Edit' : 'Close';
                }
            }
            /* ── Set timers to fire at the exact ON / OFF boundary ── */
            function msUntil(hhmm) {
                const [h, m] = hhmm.split(':').map(Number);
                const now = new Date();
                const target = new Date(now);
                target.setHours(h, m, 0, 0);
                if (target <= now) target.setDate(target.getDate() + 1);
                return target - now;
            }

            function armTimers(onStr, offStr, days) {
                clearTimeout(_sdmOnTimer);
                clearTimeout(_sdmOffTimer);
                _sdmOnTimer = setTimeout(() => {
                    if (isEnabled() && isTodayActive(days)) {
                        applyDarkMode(true);
                        if (darkModeToggle) darkModeToggle.checked = true;
                        updateBadge(true, onStr, offStr);
                    }
                    armTimers(onStr, offStr, days); // re-arm for tomorrow
                }, msUntil(onStr));

                _sdmOffTimer = setTimeout(() => {
                    if (isEnabled()) {
                        applyDarkMode(false);
                        if (darkModeToggle) darkModeToggle.checked = false;
                        updateBadge(false, onStr, offStr);
                    }
                    armTimers(onStr, offStr, days); // re-arm for tomorrow
                }, msUntil(offStr));

                /* ── FIX B3: Midnight day-filter re-check for overnight windows ──────────
                   When an overnight schedule (e.g. 22:00 Friday → 07:00 Saturday) is
                   active and the user selected only specific days (e.g. only Friday),
                   isTodayActive() was evaluated at ON-timer fire time (Friday 22:00) and
                   again at the next ON-timer fire (Saturday 22:00) — but NOT at midnight
                   during the active window.  This meant dark mode stayed on past midnight
                   into Saturday even though Saturday was not a selected day.
                   Fix: arm an additional midnight-check timer whenever an overnight window
                   could be active.  At midnight we re-evaluate isTodayActive; if today
                   (the new day) is NOT a selected day but dark mode is currently on via
                   the schedule, we turn it off immediately. */
                const [onH, onM] = onStr.split(':').map(Number);
                const [offH, offM] = offStr.split(':').map(Number);
                const isOvernight = (onH * 60 + onM) > (offH * 60 + offM);
                if (isOvernight && !days.includes('daily')) {
                    // ms until next midnight
                    const _now = new Date();
                    const _midnight = new Date(_now);
                    _midnight.setHours(24, 0, 0, 0);
                    const _msToMidnight = _midnight - _now;
                    setTimeout(() => {
                        if (!isEnabled()) return;
                        // After midnight: if the NEW today is not an active day,
                        // and dark mode is currently on, turn it off.
                        if (!isTodayActive(days) && document.body.classList.contains('dark-mode')) {
                            applyDarkMode(false);
                            if (darkModeToggle) darkModeToggle.checked = false;
                            updateBadge(false, onStr, offStr);
                        }
                    }, _msToMidnight + 500); // +500ms safety margin past midnight
                }
            }

            /* ── Lock/unlock manual dark mode toggle ── */
            function syncManualToggleLock() {
                const label = darkModeToggle?.closest('label') || darkModeToggle?.parentElement;
                if (isEnabled()) label?.classList.add('sdm-managed');
                else label?.classList.remove('sdm-managed');
            }

            /* ── 12h ↔ 24h helpers ── */
            /* 24h "HH:MM" → { h12: 1-12, m: 0-59, ampm: 'AM'|'PM' } */
            function to12h(hhmm) {
                const [h24, m] = hhmm.split(':').map(Number);
                const ampm = h24 < 12 ? 'AM' : 'PM';
                let h12 = h24 % 12;
                if (h12 === 0) h12 = 12;
                return { h12, m, ampm };
            }
            /* { h12, m, ampm } → 24h "HH:MM" */
            function to24h(h12, m, ampm) {
                let h24 = h12 % 12;
                if (ampm === 'PM') h24 += 12;
                return `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            }
            /* Format a 24h "HH:MM" string as "12:00 AM" for display */
            function fmt12(hhmm) {
                const { h12, m, ampm } = to12h(hhmm);
                return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
            }

            /* ── Init manual inputs with saved values ── */
            function initManualInputs() {
                const onParts = to12h(getSavedOn());
                const offParts = to12h(getSavedOff());

                const onHrEl = document.getElementById('sdm-on-hr-input');
                const onMinEl = document.getElementById('sdm-on-min-input');
                const onAmPmEl = document.getElementById('sdm-on-ampm-btn');
                const offHrEl = document.getElementById('sdm-off-hr-input');
                const offMinEl = document.getElementById('sdm-off-min-input');
                const offAmPmEl = document.getElementById('sdm-off-ampm-btn');

                /* Live state */
                let onH = onParts.h12, onM = onParts.m, onAP = onParts.ampm;
                let offH = offParts.h12, offM = offParts.m, offAP = offParts.ampm;

                function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

                /* Populate initial values */
                if (onHrEl) onHrEl.value = String(onH).padStart(2, '0');
                if (onMinEl) onMinEl.value = String(onM).padStart(2, '0');
                if (onAmPmEl) onAmPmEl.textContent = onAP;
                if (offHrEl) offHrEl.value = String(offH).padStart(2, '0');
                if (offMinEl) offMinEl.value = String(offM).padStart(2, '0');
                if (offAmPmEl) offAmPmEl.textContent = offAP;

                function wireHrInput(el, setV) {
                    if (!el) return;
                    el.addEventListener('input', () => { setV(clamp(parseInt(el.value) || 1, 1, 12)); markSchedulePending(); });
                    el.addEventListener('blur', () => { const v = clamp(parseInt(el.value) || 1, 1, 12); setV(v); el.value = String(v).padStart(2, '0'); });
                }
                function wireMinInput(el, setV) {
                    if (!el) return;
                    el.addEventListener('input', () => { setV(clamp(parseInt(el.value) || 0, 0, 59)); markSchedulePending(); });
                    el.addEventListener('blur', () => { const v = clamp(parseInt(el.value) || 0, 0, 59); setV(v); el.value = String(v).padStart(2, '0'); });
                }
                function wireAmPmToggle(btn, getAP, setAP) {
                    if (!btn) return;
                    btn.addEventListener('click', () => { const n = getAP() === 'AM' ? 'PM' : 'AM'; setAP(n); btn.textContent = n; markSchedulePending(); });
                }

                wireHrInput(onHrEl, v => { onH = v; });
                wireMinInput(onMinEl, v => { onM = v; });
                wireAmPmToggle(onAmPmEl, () => onAP, v => { onAP = v; });
                wireHrInput(offHrEl, v => { offH = v; });
                wireMinInput(offMinEl, v => { offM = v; });
                wireAmPmToggle(offAmPmEl, () => offAP, v => { offAP = v; });

                /* ── Set Schedule / Cancel Schedule button ── */
                const setBtn = document.getElementById('sdm-set-schedule-btn');

                /* Track whether schedule has been committed */
                const SDM_SET_KEY = 'beatzen_schedule_dm_set';
                function isScheduleSet() { return localStorage.getItem(SDM_SET_KEY) === 'true'; }

                /* Render the button in the correct state */
                function renderScheduleBtn() {
                    if (!setBtn) return;
                    if (isScheduleSet()) {
                        setBtn.classList.remove('sdm-set-schedule-btn--pending', 'sdm-set-schedule-btn--saved');
                        setBtn.classList.add('sdm-set-schedule-btn--cancel');
                        setBtn.innerHTML = '<i class="fas fa-calendar-xmark"></i> Cancel Schedule';
                    } else {
                        setBtn.classList.remove('sdm-set-schedule-btn--cancel', 'sdm-set-schedule-btn--saved');
                        setBtn.innerHTML = '<i class="fas fa-calendar-check"></i> Set Schedule';
                    }
                }

                /* Init button state on open */
                renderScheduleBtn();

                if (setBtn) {
                    setBtn.addEventListener('click', () => {
                        if (isScheduleSet()) {
                            /* ── CANCEL flow ── */
                            localStorage.setItem(SDM_SET_KEY, 'false');
                            /* Clear saved times so it reverts to defaults on next open */
                            clearTimeout(_sdmOnTimer);
                            clearTimeout(_sdmOffTimer);
                            applyDarkMode(false);
                            if (darkModeToggle) darkModeToggle.checked = false;
                            document.getElementById('schedule-dm-active-badge').style.display = 'none';
                            updateStatusText();
                            renderScheduleBtn();
                            showToast('Schedule cancelled — no longer auto-switching');
                            _bzSyncNow('✓ Schedule cancelled — synced to cloud');
                        } else {
                            /* ── SET flow ── */
                            saveTime('on', onH, onM, onAP);
                            saveTime('off', offH, offM, offAP);
                            applySchedule();
                            localStorage.setItem(SDM_SET_KEY, 'true');
                            /* Flash green confirmation briefly, then switch to red Cancel */
                            setBtn.classList.remove('sdm-set-schedule-btn--pending', 'sdm-set-schedule-btn--cancel');
                            setBtn.classList.add('sdm-set-schedule-btn--saved');
                            setBtn.innerHTML = '<i class="fas fa-check"></i> Schedule Set!';
                            const onLabel = fmt12(getSavedOn());
                            const offLabel = fmt12(getSavedOff());
                            const days = getSavedDays();
                            const dayLabel = days.includes('daily') ? 'Daily' : days.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ');
                            showToast(`Schedule set — ON ${onLabel}, OFF ${offLabel} · ${dayLabel}`);
                            _bzSyncNow('✓ Schedule saved — synced to cloud');
                            // Show the ON pill immediately in the header row
                            updateStatusText();
                            setTimeout(() => {
                                setBtn.classList.remove('sdm-set-schedule-btn--saved');
                                renderScheduleBtn();
                                /* Auto-collapse once schedule is confirmed */
                                sdmCollapse();
                            }, 2000);
                        }
                    });
                }
            }

            function saveTime(which, h12, m, ampm) {
                const str24 = to24h(h12, m, ampm);
                localStorage.setItem(which === 'on' ? SDM_ON_KEY : SDM_OFF_KEY, str24);
                updateStatusText();
            }

            /* ── Mark the Set Schedule button as having pending changes ── */
            function markSchedulePending() {
                const setBtn = document.getElementById('sdm-set-schedule-btn');
                if (!setBtn) return;
                const SDM_SET_KEY = 'beatzen_schedule_dm_set';
                /* If schedule is active (cancel state), revert to "Set Schedule" pending */
                if (localStorage.getItem(SDM_SET_KEY) === 'true') {
                    localStorage.setItem(SDM_SET_KEY, 'false');
                    setBtn.classList.remove('sdm-set-schedule-btn--cancel', 'sdm-set-schedule-btn--saved');
                }
                if (!setBtn.classList.contains('sdm-set-schedule-btn--saved')) {
                    setBtn.classList.add('sdm-set-schedule-btn--pending');
                    setBtn.innerHTML = '<i class="fas fa-calendar-check"></i> Set Schedule';
                }
            }

            /* ── Day chips ── */
            function initDayChips() {
                const chips = document.querySelectorAll('.sdm-day-chip');
                const saved = getSavedDays();

                /* Set initial active state */
                chips.forEach(chip => {
                    const v = chip.dataset.day;
                    chip.classList.toggle('active', saved.includes(v) || (saved.includes('daily') && v === 'daily'));
                });

                chips.forEach(chip => {
                    chip.addEventListener('click', () => {
                        const v = chip.dataset.day;
                        if (v === 'daily') {
                            /* Daily selected — deselect all individual days */
                            chips.forEach(c => c.classList.toggle('active', c.dataset.day === 'daily'));
                            localStorage.setItem(SDM_DAYS_KEY, JSON.stringify(['daily']));
                        } else {
                            /* Individual day — deselect Daily, toggle this one */
                            const dailyChip = document.querySelector('.sdm-day-all');
                            dailyChip?.classList.remove('active');
                            chip.classList.toggle('active');
                            const selected = [...chips]
                                .filter(c => c.classList.contains('active') && c.dataset.day !== 'daily')
                                .map(c => c.dataset.day);
                            if (!selected.length) {
                                /* Nothing selected — revert to Daily */
                                dailyChip?.classList.add('active');
                                localStorage.setItem(SDM_DAYS_KEY, JSON.stringify(['daily']));
                            } else {
                                localStorage.setItem(SDM_DAYS_KEY, JSON.stringify(selected));
                            }
                        }
                        updateStatusText();
                        markSchedulePending();
                    });
                });
            }

            /* ── Main toggle ── */
            const sdmToggle = document.getElementById('schedule-dm-toggle');
            const sdmPanel = document.getElementById('schedule-dm-panel');
            const sdmCollapseBtn = document.getElementById('sdm-collapse-btn');

            let _sdmPanelCollapsed = false;

            /* ── Expand the schedule panel (show it, reset chevron) ── */
            function sdmExpand() {
                _sdmPanelCollapsed = false;
                if (sdmPanel) sdmPanel.style.display = 'flex';
                if (sdmCollapseBtn) {
                    // Always visible when toggle is ON — button shows panel is expandable
                    sdmCollapseBtn.classList.remove('sdm-collapse-btn--hidden', 'collapsed');
                    sdmCollapseBtn.title = 'Hide schedule controls';
                }
                const lbl = document.getElementById('sdm-collapse-label');
                if (lbl) lbl.textContent = 'Close';
            }

            /* ── Collapse the schedule panel (hide it, flip chevron) ── */
            function sdmCollapse() {
                _sdmPanelCollapsed = true;
                if (sdmPanel) sdmPanel.style.display = 'none';
                if (sdmCollapseBtn) {
                    // Stay visible — user can click to expand again
                    sdmCollapseBtn.classList.remove('sdm-collapse-btn--hidden');
                    sdmCollapseBtn.classList.add('collapsed');
                    sdmCollapseBtn.title = 'Show schedule controls';
                }
                const lbl = document.getElementById('sdm-collapse-label');
                if (lbl) lbl.textContent = 'Edit';
            }

            /* ── Fully hide the collapse button (toggle is OFF) ── */
            function hideCollapseBtn() {
                _sdmPanelCollapsed = false;
                if (sdmCollapseBtn) {
                    sdmCollapseBtn.classList.add('sdm-collapse-btn--hidden');
                    sdmCollapseBtn.classList.remove('collapsed');
                }
            }

            if (sdmToggle) {
                sdmToggle.checked = isEnabled();
                /* On load: if already enabled, expand immediately */
                if (isEnabled() && sdmPanel) { sdmExpand(); }

                sdmToggle.addEventListener('change', () => {
                    localStorage.setItem(SDM_ENABLED_KEY, String(sdmToggle.checked));
                    if (sdmToggle.checked) {
                        /* Toggle turned ON → expand and init */
                        if (sdmPanel) initManualInputs();
                        initDayChips();
                        sdmExpand();
                        syncManualToggleLock();
                        applySchedule();
                    } else {
                        /* Toggle turned OFF → hide panel, reset collapse state */
                        if (sdmPanel) sdmPanel.style.display = 'none';
                        hideCollapseBtn();
                        clearTimeout(_sdmOnTimer);
                        clearTimeout(_sdmOffTimer);
                        syncManualToggleLock();
                        const manual = localStorage.getItem('beatzen_dark_mode') === 'true';
                        applyDarkMode(manual);
                        if (darkModeToggle) darkModeToggle.checked = manual;
                        document.getElementById('schedule-dm-active-badge').style.display = 'none';
                        localStorage.setItem('beatzen_schedule_dm_set', 'false');
                    }
                    updateStatusText();
                    _bzSyncNow('✓ Schedule ' + (sdmToggle.checked ? 'on' : 'off') + ' — synced to cloud');
                });
            }

            /* Open panel and init if already enabled on load */
            if (isEnabled() && sdmPanel) {
                sdmExpand();
                initManualInputs();
                initDayChips();
                syncManualToggleLock();
                applySchedule();
            }
            updateStatusText();

            /* ── SDM: Chevron — manually toggle collapsed / expanded ── */
            if (sdmCollapseBtn && sdmPanel) {
                sdmCollapseBtn.addEventListener('click', () => {
                    if (_sdmPanelCollapsed) sdmExpand(); else sdmCollapse();
                });
            }

            // Expose a public hook so auth.js can re-run the SDM engine after a
            // cloud restore (mergeCloudData writes new SDM keys to localStorage;
            // calling this forces the schedule to pick them up without a reload).
            window.bzReinitScheduledDarkMode = function () {
                try {
                    // Clear any running timers from the previous schedule
                    clearTimeout(_sdmOnTimer);
                    clearTimeout(_sdmOffTimer);
                    _sdmOnTimer = null;
                    _sdmOffTimer = null;
                    // Re-apply the schedule using the freshly written localStorage values
                    applySchedule();
                    updateStatusText();
                } catch (_) { /* best effort */ }
            };
        }
        /* ═══════════════════════════════════════════════════════════════
           AUTO HISTORY — records every song the moment it starts playing
           Entry shape:
             id, title, artist, duration, _coverUrl,
             playedAt  (ISO string),
             playedTime (formatted HH:MM AM/PM),
             playedDate (formatted DD MMM YYYY),
             sourceView (nav section: Home / Playlists / Explore / Search),
             sourceName (album/playlist/artist name being browsed)
        ═══════════════════════════════════════════════════════════════ */

        /* Maps internal view IDs to human-readable nav names */
        function resolveNavLabel() {
            const view = window.lastActiveView || 'home';
            const map = { home: 'Home', playlists: 'Playlists', explore: 'Playlists', search: 'Search', settings: 'Settings' };
            return map[view] || 'Home';
        }

        /* Returns the album/playlist/artist name the user is currently browsing */
        function resolveSourceName(album) {
            if (!album) return '';
            return album.title || album.name || '';
        }

        /* Format a Date object → "9:45 AM" */
        function fmtTime(d) {
            let h = d.getHours(), m = d.getMinutes();
            const ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12 || 12;
            return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
        }

        /* Format a Date object → "5 Jan 2025" */
        function fmtDate(d) {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
        }

        /* Core writer — called automatically from playSong */
        window.recordHistory = function (song, playingAlbum) {
            if (!song) return;
            const now = new Date();
            const sourceAlbum = window.allSongsMap.get(String(song.id))?.album || song._sourceAlbum || playingAlbum;
            const isAutoMix = !!song._autoMix;
            // For AutoMix songs: sourceName should show the real movie name, and
            // we flag it so the history row can display "Auto-Mix → <Movie>" correctly.
            const realMovieName = isAutoMix
                ? (sourceAlbum?.title || sourceAlbum?.name || playingAlbum?.title || playingAlbum?.name || '')
                : '';
            const entry = {
                id: String(song.id),
                title: song.title || 'Unknown',
                artist: song.artist || '',
                duration: song.duration || '',
                _coverUrl: sourceAlbum?.imageUrl || sourceAlbum?.albumCover || '',
                playedAt: now.toISOString(),
                playedTime: fmtTime(now),
                playedDate: fmtDate(now),
                sourceView: resolveNavLabel(),
                sourceName: resolveSourceName(playingAlbum),
                // AutoMix-specific fields
                isAutoMix: isAutoMix,
                autoMixMovieName: realMovieName,
                autoMixAlbumId: isAutoMix ? String(sourceAlbum?.id || sourceAlbum?.name || sourceAlbum?.title || '') : '',
                autoMixAlbumType: isAutoMix ? (sourceAlbum?.type || 'Movie') : '',
                // Album fields used by Top Album stats
                albumId: String(sourceAlbum?.id || playingAlbum?.id || ''),
                albumTitle: sourceAlbum?.title || sourceAlbum?.name || playingAlbum?.title || playingAlbum?.name || '',
                albumCover: sourceAlbum?.imageUrl || sourceAlbum?.albumCover || playingAlbum?.imageUrl || playingAlbum?.albumCover || '',
                // The EXACT album/playlist the user was playing from — used by
                // playHistoryEntry to reopen the correct playlist vs movie album.
                playingAlbumId: String(playingAlbum?.id || ''),
                playingAlbumType: playingAlbum?.type || 'Movie'
            };

            /* Load, prepend (allow duplicates — each play is its own entry), cap */
            let list = [];
            try { list = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch (e) { list = []; }
            list.unshift(entry);
            list = list.slice(0, HISTORY_MAX);
            localStorage.setItem(HISTORY_KEY, JSON.stringify(list));

            /* Sync live runtime so Explore picks it up without full re-render */
            if (typeof customGenreData !== 'undefined') {
                customGenreData['History'] = list;
            }

            /* Instant DOM patch — update the history panel if it's currently visible */
            patchHistoryPanel(list);

        };

        /* ─────────────────────────────────────────────────────────────
           HISTORY HELPERS
        ───────────────────────────────────────────────────────────── */

        /* ─────────────────────────────────────────────────────────────────────
           Open the album / playlist a history entry came from.

           Behaviour:
           • Opens the correct album (home) or playlist (playlists tab)
             depending on where the song was originally played from.
           • Does NOT auto-play — the user clicks a song row to play.
           • Scrolls to and highlights the target song row so the user can
             see exactly which track was last played.

           Source resolution (first match wins):
           1. entry.playingAlbumId   → exact album/playlist saved at play time
           2. entry.sourceView hint  → find playlist by sourceName in masterPool
           3. Fallback               → canonical movie album (home tab)
        ───────────────────────────────────────────────────────────────────── */
        function playHistoryEntry(entry) {
            const canonical = window.allSongsMap.get(String(entry.id));
            if (!canonical?.album) return;

            /* ── AutoMix shortcut: route to the real source movie ── */
            if (entry.isAutoMix && entry.autoMixAlbumId) {
                const amId = String(entry.autoMixAlbumId);
                const amRaw = window.masterPool.find(a =>
                    String(a.id || a.name || a.title) === amId
                ) || canonical.album;
                const amType = entry.autoMixAlbumType || amRaw?.type || 'Movie';
                const amData = resolveData(amRaw, amType);
                if (amData) {
                    /* Tag the song with _autoMix + _sourceAlbum so that when the
                       user clicks the row (or it auto-plays), recordHistory writes
                       the correct Auto-Mix entry instead of 'home'. */
                    const targetSongId = String(entry.id);
                    const songInAlbum = amData.songs?.find(s => String(s.id) === targetSongId);
                    if (songInAlbum) {
                        songInAlbum._autoMix = true;
                        songInAlbum._sourceAlbum = amRaw;
                    }
                    window.currentAlbum = amData;
                    window.lastActiveView = 'home';
                    selectAlbum(amData, true, 'home', false);
                    const _amTargetSongId = String(entry.id);
                    setTimeout(() => {
                        const amIdx = (amData.songs || []).findIndex(s => String(s.id) === _amTargetSongId);
                        // Update player bar without auto-play
                        if (amIdx >= 0) {
                            const amSong = amData.songs[amIdx];
                            const amCanonical = window.allSongsMap?.get(_amTargetSongId);
                            const amSource = amCanonical?.album || amRaw;
                            const amCover = amSource?.imageUrl || amSource?.albumCover || amData.imageUrl || '';
                            if (playerSongTitle && amSong?.title) playerSongTitle.textContent = amSong.title;
                            if (playerSongArtist && amSong?.artist !== undefined) playerSongArtist.textContent = amSong.artist || '';
                            if (playerAlbumCover && amCover) playerAlbumCover.src = amCover;
                            const amAlbumTitle = amSource?.title || amSource?.name || amData.title || 'Beat Zen';
                            if (amSong?.title) document.title = `${amSong.title} - ${amAlbumTitle}`;
                        }
                        const row = albumViewContainer.querySelector(`.song-item[data-song-id="${_amTargetSongId}"]`);
                        if (row) {
                            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            row.classList.add('bz-history-target');
                            row.addEventListener('animationend', () => row.classList.remove('bz-history-target'), { once: true });
                        }
                    }, 120);
                    return;
                }
            }

            /* ── Step 1: exact album/playlist saved at play time ── */
            let targetRaw = null;
            let targetType = 'Movie';
            let navTab = 'home';

            if (entry.playingAlbumId) {
                targetRaw = window.masterPool.find(a =>
                    String(a.id || a.name || a.title) === String(entry.playingAlbumId)
                );
                if (targetRaw) {
                    targetType = entry.playingAlbumType || targetRaw.type || 'Movie';
                    const t = String(targetType).toLowerCase();
                    navTab = (t === 'playlist' || t === 'explore' || t === 'collection' || t === 'artist')
                        ? 'playlists'
                        : 'home';
                }
            }

            /* ── Step 2: sourceView hint for older entries without playingAlbumId ── */
            if (!targetRaw && entry.sourceView === 'Playlists' && entry.sourceName) {
                targetRaw = window.masterPool.find(a =>
                    (a.name || a.title || '') === entry.sourceName &&
                    (a.type === 'Playlist' || a.type === 'Explore' || a.type === 'Collection')
                );
                if (targetRaw) {
                    targetType = targetRaw.type || 'Playlist';
                    navTab = 'playlists';
                }
            }

            /* ── Step 3: fallback — canonical movie album on Home ── */
            if (!targetRaw) {
                targetRaw = canonical.album;
                targetType = canonical.album.type || 'Movie';
                navTab = 'home';
            }

            /* ── Resolve and open the album/playlist view (no auto-play) ── */
            const data = resolveData(targetRaw, targetType);
            if (!data) return;

            // Only update playingAlbum context if this is the album already playing,
            // so the "currently playing" highlight stays correct without starting playback.
            window.currentAlbum = data;
            window.lastActiveView = navTab;

            // Open the album view — pass isBack=true so we don't double-push history
            // entries. One back press should return user to the playlists/listening view.
            // highlightPlaying=false: don't show green active border — only pulse target row.
            selectAlbum(data, true, navTab, false);

            // After the song rows are rendered, scroll to and pulse-highlight the target song.
            // Also update the player bar to show this song's info without starting playback.
            const targetSongId = String(entry.id);
            setTimeout(() => {
                const idx = (data.songs || []).findIndex(x => String(x.id) === targetSongId);
                // Update player bar display without starting playback
                if (idx >= 0) {
                    const targetSong = data.songs[idx];
                    const canonical = window.allSongsMap?.get(targetSongId);
                    const sourceAlbum = canonical?.album || targetSong?._sourceAlbum || data;
                    const coverUrl = sourceAlbum?.imageUrl || sourceAlbum?.albumCover || data.imageUrl || '';
                    if (playerSongTitle && targetSong?.title) playerSongTitle.textContent = targetSong.title;
                    if (playerSongArtist && targetSong?.artist !== undefined) playerSongArtist.textContent = targetSong.artist || '';
                    if (playerAlbumCover && coverUrl) playerAlbumCover.src = coverUrl;
                    // Update tab title to reflect the highlighted (not-yet-playing) song
                    const albumTitle = sourceAlbum?.title || sourceAlbum?.name || data.title || 'Beat Zen';
                    if (targetSong?.title) document.title = `${targetSong.title} - ${albumTitle}`;
                }
                const row = albumViewContainer.querySelector(`.song-item[data-song-id="${targetSongId}"]`);
                if (row) {
                    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    row.classList.add('bz-history-target');
                    row.addEventListener('animationend', () => row.classList.remove('bz-history-target'), { once: true });
                }
            }, 120);
        }

        /* Build one history row element used in both the preview list and the overlay */
        function buildHistoryRow(entry, inOverlay) {
            const item = document.createElement('div');
            item.className = inOverlay ? 'bzh-full-row' : 'bz-history-item song-item';
            item.dataset.historyId = String(entry.id || '');

            const cover = entry._coverUrl || '';
            const title = entry.title || 'Unknown';
            const artist = entry.artist || '';
            const dur = entry.duration || '';
            const time = entry.playedTime || '';
            const date = entry.playedDate || '';
            const src = entry.sourceView || '';
            const srcN = entry.sourceName || '';
            const isAutoMix = !!entry.isAutoMix;
            const autoMixMovie = entry.autoMixMovieName || '';

            // For AutoMix entries show: song name · Auto-Mix wand icon · movie name
            // For normal entries show existing: time · date · source view · source name
            const autoMixBadgeLine = isAutoMix
                ? `<span class="bzh-dot">\u00b7</span>
                   <i class="fas fa-wand-magic-sparkles bzh-meta-icon" style="color:#2575fc;"></i>
                   <span class="bzh-automix-badge-inline">Auto-Mix</span>
                   ${autoMixMovie ? `<span class="bzh-dot">\u00b7</span><i class="fas fa-film bzh-meta-icon"></i><span class="bzh-automix-movie">${autoMixMovie}</span>` : ''}`
                : '';

            const normalSrcLine = !isAutoMix
                ? `${src ? `<span class="bzh-dot">\u00b7</span><i class="fas fa-compass bzh-meta-icon"></i><span style="text-transform:capitalize;">${src}</span>` : ''}
                   ${srcN ? `<span class="bzh-dot">\u00b7</span><i class="fas fa-music bzh-meta-icon"></i>${srcN}` : ''}`
                : '';

            item.innerHTML = `
            <div class="bzh-row-left">
                <img src="${cover}" class="${inOverlay ? 'bzh-cover' : 'playlist-song-cover'}" alt="" loading="lazy">
                <div class="bzh-text">
                    <span class="bzh-title">${title}</span>
                    <span class="bzh-artist">${artist}</span>
                    <span class="bzh-meta">
                        <i class="fas fa-clock bzh-meta-icon"></i>${time}
                        <span class="bzh-dot">·</span>
                        <i class="fas fa-calendar-alt bzh-meta-icon"></i>${date}
                        ${autoMixBadgeLine}
                        ${normalSrcLine}
                    </span>
                </div>
            </div>
            <div class="bzh-row-right">
                <span class="bzh-dur">${dur}</span>
                <i class="fas fa-play bzh-play-hint"></i>
            </div>`;

            item.addEventListener('click', () => {
                // For AutoMix entries, route to the real source movie, not the playingAlbum
                if (isAutoMix && entry.autoMixAlbumId) {
                    const autoMixEntry = {
                        ...entry,
                        playingAlbumId: entry.autoMixAlbumId,
                        playingAlbumType: entry.autoMixAlbumType || 'Movie'
                    };
                    playHistoryEntry(autoMixEntry);
                } else {
                    playHistoryEntry(entry);
                }
                if (inOverlay) closeBzhOverlay();
            });
            return item;
        }

        /* Open the full-history overlay */
        function openFullHistoryOverlay(list) {
            closeBzhOverlay(); /* remove any existing one */

            const ov = document.createElement('div');
            ov.id = 'bzh-overlay';

            const modal = document.createElement('div');
            modal.className = 'bzh-modal';

            /* Header */
            const hdr = document.createElement('div');
            hdr.className = 'bzh-modal-header';
            hdr.innerHTML = `
            <div class="bzh-modal-title">
                <i class="fas fa-history"></i> Full History
                <span class="bzh-modal-count">${list.length} plays</span>
            </div>
            <button class="bzh-close-btn" id="bzh-close-btn">
                <i class="fas fa-times"></i>
            </button>`;
            modal.appendChild(hdr);

            /* Scrollable list */
            const body = document.createElement('div');
            body.className = 'bzh-modal-body';
            if (!list.length) {
                body.innerHTML = '<p class="bzh-empty">No history yet. Play a song to start tracking.</p>';
            } else {
                list.forEach(entry => body.appendChild(buildHistoryRow(entry, true)));
            }
            modal.appendChild(body);
            ov.appendChild(modal);
            document.body.appendChild(ov);

            /* Close handlers */
            document.getElementById('bzh-close-btn').addEventListener('click', closeBzhOverlay);
            ov.addEventListener('click', e => { if (e.target === ov) closeBzhOverlay(); });
            const escHandler = e => { if (e.key === 'Escape') { closeBzhOverlay(); document.removeEventListener('keydown', escHandler); } };
            document.addEventListener('keydown', escHandler);

            /* Animate in */
            requestAnimationFrame(() => ov.classList.add('bzh-overlay-visible'));
        }

        function closeBzhOverlay() {
            const ov = document.getElementById('bzh-overlay');
            if (!ov) return;
            ov.classList.remove('bzh-overlay-visible');
            setTimeout(() => ov.remove(), 280);
        }

        /* Patches the live Listen Again section in Explore without full re-render.
           Uses bzPrependListenAgainPL (targeted card prepend) so Recommended for Today
           and other sections are never reordered when a song is played.           */
        function patchHistoryPanel(list) {
            /* Preferred path: prepend only the newest entry to the Listen Again row.
               This leaves Recommended for Today completely untouched.              */
            if (list.length && typeof window.bzPrependListenAgainPLPL === 'function') {
                window.bzPrependListenAgainPLPL(list[0]);
            }

            /* Legacy fallback: patch old bz-history-section if it exists */
            const sec = document.getElementById('bz-history-section');
            if (!sec) return;
            const container = sec.querySelector('.bz-history-list');
            if (!container) return;
            container.innerHTML = '';
            renderHistoryItems(list, container);
        }

        /* Renders up to 6 history rows + a "Show Full History" button */
        function renderHistoryItems(list, container) {
            if (!list.length) {
                container.innerHTML = '<p style="color:rgba(255,255,255,0.4);padding:16px 0 10px;font-size:13px;text-align:center;">No history yet. Play a song to start tracking.</p>';
                return;
            }

            const preview = list.slice(0, 6);
            preview.forEach(entry => container.appendChild(buildHistoryRow(entry, false)));

            /* "Show Full History" button — always shown so user knows there's more */
            const btn = document.createElement('button');
            btn.className = 'bzh-show-all-btn';
            btn.innerHTML = `<i class="fas fa-list"></i> Show Full History <span class="bzh-count-badge">${list.length}</span>`;
            btn.addEventListener('click', () => openFullHistoryOverlay(list));
            container.appendChild(btn);
        }

        /* Legacy manual-save stub — kept for compatibility with song context menu button */
        window.saveToHistoryManual = function (song) {
            if (song) window.recordHistory(song, window.playingAlbum);
        };

        /* Legacy stub — kept so other callers don't crash */
        function saveToHistory() { }

        /* CONTACT FORM */
        if (contactForm) {
            contactForm.onsubmit = async (e) => {
                e.preventDefault();
                const btn = contactForm.querySelector('.submit-btn');

                // ── Client-side validation before sending ──────────────────────
                const nameVal = (contactForm.querySelector('#contact-name')?.value || '').trim();
                const emailVal = (contactForm.querySelector('#contact-email')?.value || '').trim();
                const msgVal = (contactForm.querySelector('#contact-message')?.value || '').trim();

                // Full name check
                if (!nameVal || nameVal.length < 2) {
                    bzAlert('warning', 'Name Required', 'Please enter your full name (at least 2 characters).');
                    contactForm.querySelector('#contact-name')?.focus();
                    return;
                }

                // Strict email validation — reuse auth.js helper if available, else local check
                function _bzContactEmailValid(email) {
                    if (!email) return 'Email address is required.';
                    const atCount = (email.match(/@/g) || []).length;
                    if (atCount !== 1) return 'Enter a valid email address.';
                    const [local, domain] = email.toLowerCase().split('@');
                    if (!local || local.length === 0) return 'Email is missing a username before @.';
                    if (local.length > 64) return 'The part before @ is too long.';
                    if (local.startsWith('.') || local.endsWith('.')) return 'Email username cannot start or end with a dot.';
                    if (/\.{2,}/.test(local)) return 'Email username cannot have consecutive dots.';
                    if (!/^[a-zA-Z0-9._%+\-]+$/.test(local)) return 'Email username contains invalid characters.';
                    if (!domain || !domain.includes('.')) return 'Enter a valid email domain (e.g. gmail.com).';
                    if (domain.startsWith('.') || domain.endsWith('.')) return 'Email domain cannot start or end with a dot.';
                    if (/\.{2,}/.test(domain)) return 'Email domain cannot have consecutive dots.';
                    if (!/^[a-zA-Z0-9.\-]+$/.test(domain)) return 'Email domain contains invalid characters.';
                    const tld = domain.split('.').pop();
                    if (!tld || tld.length < 2 || !/^[a-zA-Z]{2,}$/.test(tld)) return 'Enter a valid top-level domain (e.g. .com, .in, .org).';
                    const BLOCKED = new Set(['example.com', 'test.com', 'mailinator.com', 'guerrillamail.com', 'throwam.com', 'trashmail.com', 'yopmail.com', 'tempmail.com', 'dispostable.com', 'fakeinbox.com', 'maildrop.cc', 'spamgourmet.com', 'mytemp.email', 'discard.email', 'tempr.email', 'throwit.email', 'burnermail.io']);
                    if (BLOCKED.has(domain)) return 'Please use a valid personal email address.';
                    return null; // valid
                }
                const emailErr = _bzContactEmailValid(emailVal);
                if (emailErr) {
                    bzAlert('warning', 'Invalid Email', emailErr);
                    contactForm.querySelector('#contact-email')?.focus();
                    return;
                }

                // Message check
                if (!msgVal || msgVal.length < 10) {
                    bzAlert('warning', 'Message Required', 'Please enter a message (at least 10 characters).');
                    contactForm.querySelector('#contact-message')?.focus();
                    return;
                }

                // ── Submit ─────────────────────────────────────────────────────
                btn.disabled = true;
                // 10-second timeout so button never stays stuck on a hung request
                const ctrl = new AbortController();
                const timeoutId = setTimeout(() => ctrl.abort(), 10000);
                try {
                    const res = await fetch(contactForm.action, {
                        method: 'POST',
                        body: new FormData(contactForm),
                        headers: { 'Accept': 'application/json' },
                        signal: ctrl.signal
                    });
                    clearTimeout(timeoutId);
                    if (res.ok) { successPopup.style.display = 'flex'; successPopup.classList.add('visible'); contactForm.reset(); }
                    else throw new Error('HTTP ' + res.status);
                } catch (err) {
                    clearTimeout(timeoutId);
                    if (err.name === 'AbortError') {
                        bzAlert('danger', 'Request Timed Out', 'The server took too long. Please try again.');
                    } else {
                        bzAlert('danger', 'Send Failed', 'Something went wrong. Check your connection and try again.');
                    }
                }
                finally { btn.disabled = false; }
            };
        }
        if (closeSuccessBtn) closeSuccessBtn.onclick = () => { successPopup.style.display = 'none'; successPopup.classList.remove('visible'); };

        /* UTILITIES */
        const formatTime = (s) => isNaN(s) ? "0:00" : `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

        function updateDynamicTitle() {
            const song = window.playingAlbum?.songs?.[window.currentSongIndex];
            if (song) {
                // AutoMix songs belong to a different source album — show that title
                const songIdStr = String(song.id || '');
                const _titleAlbum = song._autoMix
                    ? (window.allSongsMap?.get(songIdStr)?.album || song._sourceAlbum || window.playingAlbum)
                    : window.playingAlbum;
                const albumTitle = _titleAlbum?.title || _titleAlbum?.name || window.playingAlbum?.title || 'Beat Zen';
                // Show song title only while actively playing; reset to default when paused
                if (!audioPlayer.paused) {
                    document.title = `${song.title} - ${albumTitle}`;
                } else {
                    document.title = 'Beat Zen - Premium';
                }
            } else {
                document.title = 'Beat Zen - Premium';
            }
        }

        function updatePlayPauseIcon() {
            const paused = audioPlayer.paused;
            if (playPauseBtn) playPauseBtn.innerHTML = paused ? '<i class="fas fa-play"></i>' : '<i class="fas fa-pause"></i>';
            // Sync mini play/pause button (mobile mini-player)
            const miniBtn = document.getElementById('mini-play-pause-btn');
            if (miniBtn) miniBtn.innerHTML = paused ? '<i class="fas fa-play"></i>' : '<i class="fas fa-pause"></i>';
            const albumPlayBtn = document.querySelector('.play-album-btn');
            if (albumPlayBtn && window.currentAlbum?.id === window.playingAlbum?.id) {
                const icon = albumPlayBtn.querySelector('i'), text = albumPlayBtn.querySelector('span');
                if (icon) icon.className = paused ? 'fas fa-play' : 'fas fa-pause';
                if (text) text.textContent = paused ? 'Play' : 'Pause';
            }
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = paused ? "paused" : "playing";
            // Fix 4: keep home-grid card buttons in sync on every player state change —
            // syncAllCardPlayBtns is cheap (single querySelectorAll) so calling it here
            // is the single source of truth for all card play/pause icons.
            syncAllCardPlayBtns();
        }

        // Cache setPositionState support check once — avoids repeated property lookups
        const _canSetPosition = 'mediaSession' in navigator && 'setPositionState' in navigator.mediaSession;

        // Detect MIUI/Xiaomi — their Chrome does NOT extrapolate position from playbackRate.
        // Stock Android reads playbackRate:1 and counts forward on its own.
        // MIUI just shows a static snapshot, so we need a 1s push-interval on MIUI only.
        const _isMIUI = /MIUI|MiuiBrowser|XiaoMi|Redmi/i.test(navigator.userAgent);
        let _miuiPositionTimer = null; // interval handle for MIUI live position push

        function updateMediaPositionState() {
            if (!_canSetPosition) return;
            const dur = audioPlayer.duration, cur = audioPlayer.currentTime;
            // Guard: MIUI older WebView throws on Infinity, NaN, or position > duration
            if (!isFinite(dur) || dur <= 0 || !isFinite(cur) || cur < 0) return;
            try {
                navigator.mediaSession.setPositionState({
                    duration: dur,
                    // playbackRate:0 freezes the OS counter (paused)
                    // playbackRate:1 counts up automatically on stock Android
                    // MIUI ignores this and needs the 1s interval below instead
                    playbackRate: audioPlayer.paused ? 0 : (audioPlayer.playbackRate || 1),
                    position: Math.min(Math.max(0, cur), dur) // clamp both ends for MIUI
                });
            } catch (e) { /* MIUI older versions throw — silently ignore */ }
        }

        // Start 1-second position push for MIUI (does nothing on stock Android)
        function _startMIUIPositionTimer() {
            if (!_isMIUI) return;
            clearInterval(_miuiPositionTimer);
            _miuiPositionTimer = setInterval(() => {
                if (!audioPlayer.paused) updateMediaPositionState();
            }, 1000);
        }

        // Stop the MIUI timer on pause/end
        function _stopMIUIPositionTimer() {
            if (!_isMIUI) return;
            clearInterval(_miuiPositionTimer);
            _miuiPositionTimer = null;
        }

        function resolveData(data, type) {
            if (!data) return null;

            // Resolve each entry in songs[]:
            //   • If it's already a full song object → use as-is (but re-look-up source album for cover)
            //   • If it's a string ID → look up canonical entry from allSongsMap
            // The resolved song object always carries `._sourceAlbum` so the song-list
            // thumbnail shows the original movie poster, not the artist/playlist card.
            const songs = (data.songs || []).map(entry => {
                if (typeof entry === 'string') {
                    const canonical = window.allSongsMap.get(entry);
                    if (!canonical) return null;
                    // Return a copy so mutations on this resolved object stay local
                    return { ...canonical.song || canonical, _sourceAlbum: canonical.album };
                }
                // Full object — re-attach source album from map for cover consistency
                const sId = String(entry.id);
                const canonical = window.allSongsMap.get(sId);
                return { ...entry, _sourceAlbum: canonical?.album || entry.album || data };
            }).filter(Boolean);

            let total = 0;
            songs.forEach(s => {
                if (s?.duration) {
                    const p = s.duration.split(':');
                    total += parseInt(p[0]) * 60 + parseInt(p[1]);
                }
            });
            const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
            const dur = `${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm ' : ''}${s}s`.trim();

            const details = `<p><strong>Songs :</strong> ${songs.length} &nbsp;&nbsp; <strong>Duration :</strong> ${dur}${data.year ? ` &nbsp;&nbsp; <strong>Year :</strong> ${data.year}` : ''}</p>`;

            /* ── Build desc for user/imported/saved playlists ──────────────────
               • Saved-from-smart:  "Added from <smart playlist name>"
               • Other playlists:   use existing desc as-is
               • createdAt present: append "Created: DD Mon YYYY · HH:MM" on a
                 new line beneath the primary description.
            ─────────────────────────────────────────────────────────────────── */
            let resolvedDesc = data.desc || data.description || '';

            // Override desc for smart-playlist saves to show origin name instead of
            // the generic smart-playlist tagline (e.g. "Great songs you haven't heard yet")
            if (data._savedFrom === 'smart' && data._originalSmartId) {
                const SMART_NAMES = {
                    'bz-daily-mix': 'Daily Mix',
                    'bz-repeat-rewind': 'Repeat Rewind',
                    'bz-hidden-gems': 'Hidden Gems',
                    'bz-listen-again': 'Recently Played',
                    'bz-infinite-play': 'Infinite Play',
                };
                const smartName = SMART_NAMES[data._originalSmartId]
                    || (data._originalSmartId.startsWith('bz-year-')
                        ? data._originalSmartId.replace('bz-year-', '') + ' Collection'
                        : data._originalSmartId);
                resolvedDesc = `Added from ${smartName}`;
            }

            // Append "Created:" timestamp when the playlist has a createdAt value
            if (data.createdAt) {
                try {
                    const _cd = new Date(data.createdAt);
                    const _dateStr = _cd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                    const _timeStr = _cd.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                    const _stamp = `Created: ${_dateStr} · ${_timeStr}`;
                    resolvedDesc = resolvedDesc ? `${resolvedDesc}\n${_stamp}` : _stamp;
                } catch (_) { /* ignore malformed date */ }
            }

            return {
                id: String(data.id || data.name || data.title),
                title: data.name || data.title || 'Unknown',
                imageUrl: data.imageUrl || data.albumCover || data.cover || '',
                songs,
                detailsHtml: details,
                desc: resolvedDesc,
                type,
                year: data.year || null
            };
        }
        window.resolveData = resolveData;

        /* ══════════════════════════════════════════════════════════════════════
           REPEAT REWIND ENGINE
           ─────────────────────────────────────────────────────────────────────
           checkRepeatRewind(song)
             • Called ONLY after the user has listened ≥ BZ_RR_LISTEN_SECS (10 s):
               – syncProgressBar accumulator: real audio seconds are delta-accumulated
                 via ontimeupdate (pauses excluded automatically); fires once per song
                 when _bzRRListenedSecs ≥ BZ_RR_LISTEN_SECS
               – Loop restart: accumulators reset in handleTrackEnded, re-accumulated by syncProgressBar
               – handleTrackEnded: natural completion always qualifies if duration ≥ 10s
             • Reads qualifying play count from beatZen_rr_plays (dedicated store).
               beatZen_rr_plays entries are NEVER written on instant-start —
               only once _bzRRListenedSecs ≥ BZ_RR_LISTEN_SECS or on natural track completion.
             • A song enters Repeat Rewind after BZ_RR_MIN_PLAYS (3) qualifying plays.
             • Shows a toast on the exact 3rd qualifying play; silent after that.
             • Works for normal play AND loop mode restarts — called from both.

           buildRepeatRewindList()
             • Aggregates qualifying play counts from beatZen_rr_plays (NOT history).
             • Each rr_plays entry = a genuine >= 10-second listen.
             • Filters songs with BZ_RR_MIN_PLAYS (3)+ qualifying plays.
             • Returns [] when no songs qualify — never fills with random songs.
             • Sorts descending by play count; tie-break by most-recent qualifying play.
             • Returns [{songId, count, song, album}] — consumed by Explore.
        ══════════════════════════════════════════════════════════════════════ */
        function checkRepeatRewind(song) {
            if (!song) return;
            try {
                const BZ_SIGNALS_KEY = 'beatZen_signals';
                const songIdStr_rr = String(song.id);

                /* Count qualifying plays from the DEDICATED RR plays store.
                   Each entry = a ≥ BZ_RR_LISTEN_SECS (10 s) genuine listen.
                   Written by the syncProgressBar accumulator and natural-end path only —
                   never on instant-start, so brief/skipped plays don't count. */
                let rrList = [];
                try { rrList = JSON.parse(localStorage.getItem(BZ_RR_PLAYS_KEY) || '[]'); } catch (_) { }
                const qualifyingPlays = rrList.filter(e => String(e.id) === songIdStr_rr).length;

                if (qualifyingPlays < BZ_RR_MIN_PLAYS) return; /* not yet a Repeat Rewind candidate */

                /* Record a 'replay' signal on every qualifying play.
                   Each signal carries its own timestamp so Explore can rank by recency. */
                let signals = [];
                try { signals = JSON.parse(localStorage.getItem(BZ_SIGNALS_KEY) || '[]'); } catch (_) { }
                signals.unshift({ id: songIdStr_rr, signal: 'replay', count: qualifyingPlays, ts: Date.now() });
                signals = signals.slice(0, 1000);
                localStorage.setItem(BZ_SIGNALS_KEY, JSON.stringify(signals));

                /* Toast ONLY on the exact 3rd qualifying play — silent adds after that */
                if (qualifyingPlays === BZ_RR_MIN_PLAYS) {
                    setTimeout(() => {
                        showRepeatRewindToast(song.title, '3rd');
                    }, 800);
                }

                /* Notify Explore to refresh Repeat Rewind section live */
                if (typeof window.bzRefreshRepeatRewind === 'function') {
                    window.bzRefreshRepeatRewind();
                }

            } catch (_rrErr) { /* silent — never break playback */ }
        }

        // Refresh Repeat Rewind section in Playlists tab when a qualifying play is recorded
        window.bzRefreshRepeatRewind = function () {
            // Guard: never navigate to playlists while the album view is open.
            // lastActiveView stays 'playlists' even when a card is open, so without
            // this check every 10-second RR play fires navigateToView('playlists')
            // and kicks the user back out of the album they are browsing.
            const _albumView = document.getElementById('album-view-container');
            const _albumOpen = _albumView && _albumView.style.display !== 'none';
            if (!_albumOpen &&
                window.lastActiveView === 'playlists' &&
                typeof window.displayPlaylists === 'function') {
                window.displayPlaylists(true); // only re-renders when Playlists tab is active
            }
        };

        /* Build a sorted Repeat Rewind song list from the dedicated RR plays store.
           Called by Explore to render the section; also exposed on window
           so explore.js can call it at render time.
           Returns [] when no song has BZ_RR_MIN_PLAYS (3) qualifying plays — never fills with random songs.
           Each entry in beatZen_rr_plays = a ≥ BZ_RR_LISTEN_SECS (10s) genuine listen. */
        window.buildRepeatRewindList = function () {
            try {
                let rrList = [];
                try { rrList = JSON.parse(localStorage.getItem(BZ_RR_PLAYS_KEY) || '[]'); } catch (_) { }

                /* Count qualifying plays per song ID from dedicated RR store */
                const countMap = new Map();
                rrList.forEach(entry => {
                    const id = String(entry.id);
                    countMap.set(id, (countMap.get(id) || 0) + 1);
                });

                /* Build result array — only songs with BZ_RR_MIN_PLAYS (3)+ qualifying plays */
                const result = [];
                countMap.forEach((count, songId) => {
                    if (count < BZ_RR_MIN_PLAYS) return;
                    const canonical = window.allSongsMap?.get(songId);
                    if (!canonical) return;
                    result.push({
                        songId,
                        count,
                        song: canonical,
                        album: canonical.album
                    });
                });

                /* Sort: most-replayed first; tie-break by most-recent qualifying play */
                result.sort((a, b) => {
                    if (b.count !== a.count) return b.count - a.count;
                    const lastA = rrList.find(e => String(e.id) === a.songId);
                    const lastB = rrList.find(e => String(e.id) === b.songId);
                    return (lastB?.ts || 0) - (lastA?.ts || 0);
                });

                return result;
            } catch (_) { return []; }
        };

        /* PLAY ENGINE */
        window.playSong = async function (index, shouldPlay = true) {
            if (!window.playingAlbum?.songs?.[index]) return;

            /* ── FIX: Early-Skip Signal ────────────────────────────────────────────
               Capture the PREVIOUS song's state before we overwrite currentSongIndex.
               A "skip_early" is when the user manually skips (shouldPlay=true) before
               the song has played 30 s, and before the 30 s history-timer has fired
               (i.e. _bzHistoryRecorded is still false for this song).
               We use audioPlayer.currentTime as the ground truth — it reflects actual
               listening time regardless of buffering or seeking.
               Threshold: 20 s — enough to distinguish deliberate skips from accidental
               taps, while still flagging songs skipped well before the chorus.       */
            if (shouldPlay && !window._bzHistoryRecorded && window._bzHistoryPending) {
                try {
                    const _prevSong = window._bzHistoryPending.song;
                    const _listenedSecs = audioPlayer.currentTime;          // actual seconds heard
                    const SKIP_THRESHOLD_SECS = 20;

                    if (_prevSong && isFinite(_listenedSecs) && _listenedSecs < SKIP_THRESHOLD_SECS) {
                        const BZ_SIGNALS_KEY = 'beatZen_signals';
                        let signals = [];
                        try { signals = JSON.parse(localStorage.getItem(BZ_SIGNALS_KEY) || '[]'); } catch (_) { /* ignore */ }
                        signals.unshift({
                            id: String(_prevSong.id),
                            signal: 'skip_early',
                            listenedSecs: Math.round(_listenedSecs),
                            ts: Date.now()
                        });
                        signals = signals.slice(0, 500);
                        localStorage.setItem(BZ_SIGNALS_KEY, JSON.stringify(signals));
                    }
                } catch (_seErr) { /* silent — never block playback */ }
            }

            /* ── FIX: Queue Switching ──────────────────────────────────────────
               When the user starts a different album/playlist, purge every stale
               queue-management variable so old songs can never leak into the new
               queue or confuse the AutoMix boundary / shuffle restore logic.
            ─────────────────────────────────────────────────────────────────── */
            const _newAlbumId = String(window.playingAlbum.id);
            if (shouldPlay &&
                window._bzCurrentPlayingAlbumId !== undefined &&
                window._bzCurrentPlayingAlbumId !== _newAlbumId) {
                window._bzAutoMixStartIndex = -1;
                window._bzOriginalQueue = null;
                window._bzOriginalAutoMixBoundary = undefined;
                window._bzPreRepeatQueue = null;
                window._bzPreRepeatAutoMixBoundary = undefined;
                window._bzPreRepeatAllQueue = null;
                /* Clear session-used set so AutoMix picks fresh songs for new album */
                if (window._bzAmUsedIds instanceof Set) window._bzAmUsedIds.clear();
            }
            /* Track source song count — set whenever we start playing a new album/playlist
               (or on first play). This count represents the original number of songs in
               the album before any manual queue additions so repeat-all only loops the
               source songs, not queued items from other albums/playlists. */
            if (shouldPlay && (window._bzCurrentPlayingAlbumId === undefined || window._bzCurrentPlayingAlbumId !== _newAlbumId)) {
                window._bzSourceSongCount = window.playingAlbum.songs.length;
            }
            if (shouldPlay) window._bzCurrentPlayingAlbumId = _newAlbumId;

            window.currentSongIndex = index;
            const song = window.playingAlbum.songs[index];
            saveToHistory(window.playingAlbum);
            const albumIdStr = String(window.playingAlbum.id), songIdStr = String(song.id);
            // History is NOT auto-saved here — user must manually save via song menu.
            // Always resolve the source album title — needed for both playing and restore paths.
            const _titleAlbum = song._autoMix
                ? (window.allSongsMap.get(songIdStr)?.album || song._sourceAlbum || window.playingAlbum)
                : window.playingAlbum;
            const _titleStr = _titleAlbum.title || _titleAlbum.name || window.playingAlbum.title;
            // Always update the browser tab title so it reflects the restored song on refresh.
            document.title = `${song.title} - ${_titleStr}`;
            if (shouldPlay) {
                // FIX: preserve navFrom and scrollY that selectAlbum wrote when it opened
                // this album. playSong's replaceState was overwriting those fields with
                // undefined, so pressing Back had no navFrom to return to — it defaulted
                // to 'home' regardless of which tab opened the album, and scrollY was lost
                // so the grid scrolled back to the top instead of restoring position.
                const _existingState = history.state || {};
                history.replaceState({
                    view: 'album',
                    albumId: albumIdStr,
                    songIndex: index,
                    songId: songIdStr,
                    navFrom: _existingState.navFrom || 'home',
                    scrollY: typeof _existingState.scrollY === 'number' ? _existingState.scrollY : 0
                }, `${song.title} • ${_titleStr}`, `#album-${albumIdStr}/song-${songIdStr}`);
            }
            // When intentionally starting a new song, clear stale position so restore
            // never seeks to a leftover time from the previous song.
            if (shouldPlay) {
                localStorage.removeItem('beatZen_lastPosition');
                // Only persist on real plays — not during restore (shouldPlay=false).
                // Save rich metadata so the player bar can be instantly painted on refresh
                // without waiting for Sheets data to load.
                const _srcAlbumMeta = window.allSongsMap.get(songIdStr)?.album || song._sourceAlbum || window.playingAlbum;
                // For AutoMix songs, always use the song's real canonical source album for restore.
                // Using playingAlbum for automix songs would save the WRONG album — the source
                // album won't contain the automix song at the saved songIndex after a refresh.
                const _isAutoMixSave = !!song._autoMix;
                // FIX: "Virtual" collections (Artist pages, Daily Mix, Repeat Rewind, Hidden
                // Gems, etc.) are never added to window.masterPool — only real Movie/Genre
                // albums and saved playlists live there (see customArtistsData comment).
                // _tryRestoreSession() looks up the saved albumId in masterPool on refresh,
                // so saving window.playingAlbum.id for one of these virtual collections
                // means the lookup NEVER succeeds, playSong() is never called on restore,
                // audioPlayer.src stays empty forever, and both the transport buttons
                // (togglePlayback's "valid" check) and LRC lyric sync (currentTime never
                // advances) appear permanently broken after a refresh.
                // Fix: same as AutoMix — fall back to the song's real canonical source
                // album whenever the current playingAlbum isn't itself in masterPool.
                const _playingAlbumInMasterPool = Array.isArray(window.masterPool) && window.masterPool.some(a =>
                    String(a?.id ?? '') === String(window.playingAlbum.id) ||
                    String(a?.name ?? '') === String(window.playingAlbum.id) ||
                    String(a?.title ?? '') === String(window.playingAlbum.id)
                );
                const _useSourceAlbumForRestore = _isAutoMixSave || !_playingAlbumInMasterPool;
                const _restoreAlbum = _useSourceAlbumForRestore ? (_srcAlbumMeta) : window.playingAlbum;
                const _restoreAlbumId = String(_restoreAlbum?.id || _restoreAlbum?.name || _restoreAlbum?.title || albumIdStr);
                const _restoreType = _restoreAlbum?.type || window.playingAlbum.type;
                // When falling back to the source album, songIndex is meaningless after
                // refresh — we rely on songId to locate the song inside that album instead.
                const _restoreSongIndex = _useSourceAlbumForRestore ? 0 : index;
                localStorage.setItem('lastPlayedSong', JSON.stringify({
                    albumId: _restoreAlbumId,
                    songIndex: _restoreSongIndex,
                    songId: songIdStr,
                    type: _restoreType,
                    isAutoMix: _isAutoMixSave,
                    title: song.title || '',
                    artist: song.artist || '',
                    cover: _srcAlbumMeta?.imageUrl || _srcAlbumMeta?.albumCover || '',
                    /* FIX: persist the actual streamable audio URL (+ known duration) so a
                       refresh can start buffering the exact song instantly from localStorage
                       alone — see "INSTANT LAST-PLAYED RESTORE" near the top of startApp —
                       without waiting on masterPool / the Sheets fetch to resolve it first. */
                    url: song.url || '',
                    duration: song.duration || '',
                    savedAt: Date.now()
                }));
            }
            const songData = window.allSongsMap.get(songIdStr);
            const albumData = songData?.album || song._sourceAlbum || window.playingAlbum;
            if (playerSongTitle) playerSongTitle.textContent = song.title;

            /* ── Reveal player bar on first play ─────────────────────────────
               Adds bz-player-active to slide the player up from off-screen.
               Idempotent — safe to call on every playSong(), only has effect once. */
            (function _bzRevealPlayer() {
                var _mp = document.getElementById('main-player');
                if (_mp && !_mp.classList.contains('bz-player-active')) {
                    _mp.classList.add('bz-player-active');
                    /* Remove the inline failsafe styles so the CSS class can control
                       the transform and pointer-events from here on. */
                    _mp.style.removeProperty('transform');
                    _mp.style.removeProperty('pointer-events');
                }
                document.body.classList.add('bz-has-player');
            })();

            /* ── INSTANT HISTORY RECORD ─────────────────────────────────────────────────────────
                   Records immediately when playback starts so Listen Again
                   and history list update without any delay.
                   NOTE: checkRepeatRewind is NOT called here — it fires only after the
                   10-second real-audio-second gate (syncProgressBar accumulator), so only
                   genuine 10s+ listens count toward Repeat Rewind qualification. */
            if (shouldPlay) {
                if (window._bzHistoryTimer) { clearTimeout(window._bzHistoryTimer); window._bzHistoryTimer = null; }
                window._bzHistoryRecorded = true;
                window.recordHistory(song, window.playingAlbum);
            }

            /* ── REPEAT REWIND — real-audio-second accumulators ─────────────────────────────
               Accumulation happens in syncProgressBar (ontimeupdate) so pauses are
               automatically excluded.  Reset everything here on every new playSong().      */
            if (shouldPlay) {
                window._bzRRCountedThisSong = null; // reset flag for new song
                window._bzRRListenedSecs = 0;     // accumulated real audio seconds
                window._bzRRLastTime = null;  // last audioPlayer.currentTime sample
                window._bzRRSongId = String(song.id); // guard: which song we're tracking
            }
            if (playerSongArtist) playerSongArtist.textContent = song.artist;

            if (playerAlbumCover) {
                const _coverSrc = albumData.imageUrl || albumData.albumCover || albumData.cover
                    || window.playingAlbum?.imageUrl || window.playingAlbum?.albumCover
                    || song._coverUrl || '';
                playerAlbumCover.src = _coverSrc || 'https://res.cloudinary.com/beatzenapp/image/upload/v1782654641/Logo_kmpfjf.jpg';
                playerAlbumCover.onerror = () => {
                    playerAlbumCover.onerror = null;
                    playerAlbumCover.src = 'https://res.cloudinary.com/beatzenapp/image/upload/v1782654641/Logo_kmpfjf.jpg';
                };
            }
            const headerLabel = document.getElementById('header-playing-from');
            const headerMovie = document.getElementById('header-movie-name');
            if (headerLabel && headerMovie) {
                const type = String(window.playingAlbum.type).toLowerCase();

                // Resolve the true source album for this individual song.
                // Priority: allSongsMap canonical (most reliable) → song._sourceAlbum (set
                // by AutoMix injector & resolveData) → fall back to playingAlbum.
                const canonicalAlbum = window.allSongsMap.get(songIdStr)?.album
                    || song._sourceAlbum || null;
                const sourceAlbum = canonicalAlbum || song._sourceAlbum || null;

                // Is this an Auto-Mix injected song playing inside a "movie" context?
                // If yes, the playingAlbum is the original movie but the song itself
                // belongs to a DIFFERENT movie — show that song's real movie name.
                const isAutoMixSong = !!song._autoMix;

                if (isAutoMixSong && sourceAlbum) {
                    // Auto-Mix song: always show its own source movie, labelled as Auto-Mix
                    const realMovie = (sourceAlbum.title || sourceAlbum.name || "SINGLE").toUpperCase();
                    headerLabel.textContent = "AUTO-MIX — PLAYING FROM MOVIE";
                    headerMovie.textContent = realMovie;
                } else {
                    // Normal (non-automix) playback — use original logic
                    const name = (window.playingAlbum.title || window.playingAlbum.name || "Unknown").toUpperCase();
                    const movie = (sourceAlbum?.title || sourceAlbum?.name || "SINGLE").toUpperCase();
                    if (type === "movie") { headerLabel.textContent = "PLAYING FROM MOVIE"; headerMovie.textContent = name; }
                    else if (type === "artist") { headerLabel.textContent = `PLAYING FROM ARTIST - ${name}`; headerMovie.textContent = movie; }
                    else if (type === "playlist") { headerLabel.textContent = `PLAYING FROM PLAYLIST - ${name}`; headerMovie.textContent = movie; }
                    else if (type === "explore" || type === "collection") { headerLabel.textContent = `PLAYING FROM PLAYLISTS - ${name}`; headerMovie.textContent = movie; }
                    else { headerLabel.textContent = "PLAYING FROM BEAT ZEN"; headerMovie.textContent = name; }
                }
            }
            audioPlayer.onended = null;
            audioPlayer.pause();
            // Reset restore state BEFORE changing src so stale canplay/loadedmetadata
            // listeners from the previous song are cleared and the guard is fresh.
            audioPlayer._restoreApplied = false;
            clearTimeout(audioPlayer._restoreTimeout);
            if (audioPlayer._restoreCPHandler) {
                audioPlayer.removeEventListener('canplay', audioPlayer._restoreCPHandler);
                audioPlayer.removeEventListener('loadedmetadata', audioPlayer._restoreCPHandler);
                audioPlayer._restoreCPHandler = null;
            }
            /* Track whether this load is a real play or just a restore.
               The audio error handler reads this to decide whether to
               show the toast + skip (real play) or silently ignore (restore). */
            window._bzExpectingPlayback = !!shouldPlay;
            /* FIX: on the restore path (shouldPlay=false), paintLastPlayedBar may have
               already pointed <audio> at this exact song's URL and called load() well
               before masterPool was ready (see the "INSTANT AUDIO PRE-LOAD" block near
               the top of startApp). Reassigning .src to the same URL here would still
               re-run the browser's resource-selection algorithm and restart buffering
               from zero, throwing away that head start — so detect the match and skip
               both the reassignment and the load() call below. */
            const _instantRestoreHit = !shouldPlay && audioPlayer._bzInstantSrc && audioPlayer._bzInstantSrc === song.url;
            audioPlayer._bzInstantSrc = null; // one-shot flag — consume regardless of outcome
            if (!_instantRestoreHit) {
                audioPlayer.src = song.url;
            }

            /* FIX: Assign onended HERE — before load() — so there is zero window
               where the ended event could fire and be missed on mobile browsers
               (some Android/iOS WebKit versions fire ended immediately on src change
               if the previous track had already ended, before the post-load assignment). */
            audioPlayer.onended = handleTrackEnded;

            /* FIX: Gapless playback ──────────────────────────────────────────────
               If this song was already pre-fetched by bzPreloadNext() and its data
               is in the browser HTTP cache (_gpReady), skip audioPlayer.load().
               Calling load() would flush the decode pipeline and recreate the gap;
               play() alone lets the browser use the cached data immediately.
               If the preload is NOT ready, fall back to the normal load() call.
            ─────────────────────────────────────────────────────────────────── */
            const _isGapless = shouldPlay && _gpReady && _gpIdx === index && _gpSrc === song.url;
            if (!_isGapless && !_instantRestoreHit) {
                audioPlayer.load();
            }
            /* Reset preload state so the next song gets a fresh preload window */
            if (shouldPlay) {
                _gpIdx = -1;
                _gpReady = false;
                _gpSrc = '';
                try { _preloadAudio.src = ''; } catch (_) { /* ignore */ }
            }

            /* Set onended immediately after load — before play() resolves —
               so rapid next/prev clicks never lose or mis-assign the handler */
            audioPlayer.onended = handleTrackEnded;
            if ('mediaSession' in navigator) {
                navigator.mediaSession.metadata = new MediaMetadata({ title: song.title, artist: song.artist, album: albumData.title || "Beat Zen", artwork: [{ src: albumData.imageUrl, sizes: '512x512', type: 'image/jpeg' }] });
                // MIUI/Redmi injects seekbackward+seekforward buttons automatically —
                // wire them to 10s seek so they're useful instead of broken
                [
                    ['play', () => window.togglePlayback()],
                    ['pause', () => window.togglePlayback()],
                    ['previoustrack', () => window.playPrevSong()],
                    ['nexttrack', () => window.playNextSong()],
                    ['seekto', (d) => { if (d.seekTime && isFinite(d.seekTime)) audioPlayer.currentTime = d.seekTime; }],
                    ['seekbackward', (d) => { audioPlayer.currentTime = Math.max(0, audioPlayer.currentTime - (d?.seekOffset ?? 10)); }],
                    ['seekforward', (d) => { audioPlayer.currentTime = Math.min(audioPlayer.duration || 0, audioPlayer.currentTime + (d?.seekOffset ?? 10)); }],
                ].forEach(([a, h]) => { try { navigator.mediaSession.setActionHandler(a, h); } catch (e) { } });
            }
            if (shouldPlay) {
                audioPlayer.play().then(() => {
                    window._bzExpectingPlayback = true; /* confirm still active */
                    updatePlayPauseIcon(); updateDynamicTitle();
                    syncAllCardPlayBtns(); // Fix 2: sync home grid on every playSong call
                    if (typeof window.bzSyncPlaylistsPlayBtns === 'function') window.bzSyncPlaylistsPlayBtns();
                }).catch(() => { window._bzExpectingPlayback = false; });
            } else {
                updatePlayPauseIcon(); updateDynamicTitle();
                syncAllCardPlayBtns(); // Fix 2: sync home grid even when not autoplaying (restore)
                /* applySavedTime handles its own canplay/loadedmetadata listener registration.
                   _restoreApplied was already reset before audioPlayer.src was changed above. */
                if (window.applySavedTime) window.applySavedTime();
                // FIX Bug 6: if the user hit play while restore was still in progress,
                // auto-play now that restore has populated audioPlayer.src.
                if (window._bzAutoPlayAfterRestore) {
                    window._bzAutoPlayAfterRestore = false;
                    audioPlayer.play().then(() => {
                        updatePlayPauseIcon(); updateDynamicTitle();
                        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "playing";
                    }).catch(() => { });
                }
            }
            if (typeof updateActiveSongHighlight === 'function') updateActiveSongHighlight();
        };

        /* ── SESSION RESTORE ─────────────────────────────────────────────────────
           Triggered here — INSIDE startApp() — masterPool, resolveData, and
           playSong are all guaranteed to exist at this point.
           restoreMobileSession() is the authoritative restore entry point.
           The external fallback in the mobile IIFE fires only if startApp
           hasn't already set state.restored = true by window.load time.
        ──────────────────────────────────────────────────────────────────────── */
        if (typeof window.restoreMobileSession === 'function') {
            window.restoreMobileSession();
        } else {
            // Mobile IIFE parsed after startApp (unusual) — define a lightweight
            // restore so the IIFE's doRestore() fallback still works correctly.
            window._bzRestoreOnReady = true;
        }

        function handleTrackEnded() {
            /* Song ended naturally = fully played. Record history now if not already done by 30s guard. */
            if (window._bzHistoryTimer) { clearTimeout(window._bzHistoryTimer); window._bzHistoryTimer = null; }
            /* Song ended naturally — always a qualifying listen (handled below). */
            if (!window._bzHistoryRecorded && window._bzHistoryPending) {
                window._bzHistoryRecorded = true;
                window.recordHistory(window._bzHistoryPending.song, window._bzHistoryPending.album);
            }

            /* Song played to completion — always counts as a qualifying listen for Repeat Rewind.
               Write to the dedicated RR plays store (if syncProgressBar accumulator hadn't already).
               FIX: Only call checkRepeatRewind when a NEW entry is actually written here.
               If _alreadyCounted is true the accumulator already wrote + called checkRepeatRewind
               during playback — calling it again would write a duplicate signal entry and could
               re-show the toast or inflate play counts on every natural track end. */
            try {
                const _endedSong = window.playingAlbum?.songs?.[window.currentSongIndex];
                if (_endedSong) {
                    /* Since syncProgressBar now records RR on the very first tick of a
                       new song, _bzRRCountedThisSong will already be set for any song
                       that played even briefly. Only write a second RR entry here if
                       somehow the accumulator never fired (e.g. very rapid load→ended). */
                    const _alreadyCounted = window._bzRRCountedThisSong === String(_endedSong.id);
                    if (!_alreadyCounted) {
                        try {
                            let rrList = [];
                            try { rrList = JSON.parse(localStorage.getItem(BZ_RR_PLAYS_KEY) || '[]'); } catch (_) { }
                            rrList.unshift({ id: String(_endedSong.id), ts: Date.now() });
                            rrList = rrList.slice(0, BZ_RR_PLAYS_MAX);
                            localStorage.setItem(BZ_RR_PLAYS_KEY, JSON.stringify(rrList));
                        } catch (_) { }
                        /* Only call checkRepeatRewind when we actually wrote a new entry —
                           prevents duplicate signals/toasts when accumulator already handled it. */
                        checkRepeatRewind(_endedSong);
                    }
                }
            } catch (_) { /* silent */ }

            /* Record 'full_play' signal — song was listened to completion */
            try {
                const song = window.playingAlbum?.songs?.[window.currentSongIndex];
                if (song) {
                    const BZ_SIGNALS_KEY = 'beatZen_signals';
                    let signals = [];
                    try { signals = JSON.parse(localStorage.getItem(BZ_SIGNALS_KEY) || '[]'); } catch (_) { }
                    signals.unshift({ id: String(song.id), signal: 'full_play', ts: Date.now() });
                    signals = signals.slice(0, 500);
                    localStorage.setItem(BZ_SIGNALS_KEY, JSON.stringify(signals));
                }
            } catch (_) { /* silent */ }
            window._bzHistoryPending = null;

            if (window.repeatMode === 2) {
                /* REPEAT ONE: restart from zero, keep onended intact, reset history guard */
                window._bzHistoryRecorded = false;
                const song = window.playingAlbum?.songs?.[window.currentSongIndex];

                /* Each completed loop iteration counts as a qualifying play for Repeat Rewind */
                if (song) {
                    const _loopSongId = String(song.id);
                    try {
                        let rrList = [];
                        try { rrList = JSON.parse(localStorage.getItem(BZ_RR_PLAYS_KEY) || '[]'); } catch (_) { }
                        rrList.unshift({ id: _loopSongId, ts: Date.now() });
                        rrList = rrList.slice(0, BZ_RR_PLAYS_MAX);
                        localStorage.setItem(BZ_RR_PLAYS_KEY, JSON.stringify(rrList));
                    } catch (_) { /* silent */ }
                    checkRepeatRewind(song);
                }

                audioPlayer.currentTime = 0;
                audioPlayer.onended = handleTrackEnded;
                audioPlayer.play().then(() => {
                    if (song) {
                        const _gSong = song, _gAlbum = window.playingAlbum;
                        window._bzHistoryPending = { song: _gSong, album: _gAlbum };
                        window._bzHistoryTimer = setTimeout(function () {
                            if (!window._bzHistoryRecorded && !audioPlayer.paused) {
                                window._bzHistoryRecorded = true;
                                window.recordHistory(_gSong, _gAlbum);
                            }
                        }, 30000);
                        window._bzRRCountedThisSong = null;
                        window._bzRRListenedSecs = 0;
                        window._bzRRLastTime = null;
                        window._bzRRSongId = String(_gSong.id);
                    }
                }).catch(() => { });
                return;
            }

            /* FIX: Gapless – ensure the preload flag is set for the next index
               before calling playNextSong() → playSong().  playSong checks _gpReady
               + _gpIdx + _gpSrc and skips audioPlayer.load() when they all match,
               so the browser can play directly from the HTTP cache that _preloadAudio
               already filled during the last 15 seconds of this track.            */
            const _nextIdxForGapless = window.currentSongIndex + 1;
            if (!_gpReady && _gpIdx === _nextIdxForGapless && _gpSrc) {
                /* Preload may have finished by now even if canplaythrough hadn't fired */
                _gpReady = _preloadAudio.readyState >= 3;
            }

            playNextSong();
        }

        function togglePlayback() {
            // FIX: audioPlayer.src can now be set early by the "INSTANT AUDIO PRE-LOAD"
            // block (paintLastPlayedBar) purely to start buffering — before the full
            // masterPool-based restore has populated window.playingAlbum / currentSongIndex.
            // Gating validity on src alone would let a very-early tap call audioPlayer.play()
            // directly, leaving playingAlbum/currentSongIndex, UI highlighting, media-session
            // metadata, etc. all stale. Require the real state to be hydrated too, so an
            // early tap still takes the restore-in-progress branch below (spinner +
            // _bzAutoPlayAfterRestore), which now plays near-instantly anyway since the
            // audio is already buffered by the time restore finishes.
            const valid = audioPlayer.src && audioPlayer.src !== window.location.href && !audioPlayer.src.endsWith('/')
                && !!window.playingAlbum && window.currentSongIndex > -1;
            if (!valid) {
                // FIX Bug 6: previously this silently returned, leaving controls looking
                // broken for up to ~7.5s while _tryRestoreSession is still in progress
                // on cold loads. If a last-played song exists, show feedback, kick off
                // the restore, and flag it to auto-play once playSong runs.
                const hasLastSong = !!localStorage.getItem('lastPlayedSong');
                if (hasLastSong) {
                    if (!window._bzAutoPlayAfterRestore) {
                        window._bzAutoPlayAfterRestore = true;
                        // FIX: give immediate visual feedback — without this the button
                        // looked completely unresponsive for up to ~7.5s while restore
                        // was retrying in the background.
                        if (playPauseBtn) playPauseBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
                        const miniBtn = document.getElementById('mini-play-pause-btn');
                        if (miniBtn) miniBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
                        if (typeof window.restoreMobileSession === 'function') window.restoreMobileSession();
                        // Safety net: if restore (success or failure) hasn't cleared the
                        // spinner via updatePlayPauseIcon within the max retry window,
                        // force a repaint so the button never spins forever.
                        clearTimeout(window._bzSpinnerSafety);
                        window._bzSpinnerSafety = setTimeout(() => {
                            if (typeof updatePlayPauseIcon === 'function') updatePlayPauseIcon();
                        }, 8000);
                    }
                }
                return;
            }
            if (audioPlayer.paused) {
                audioPlayer.play().then(() => { updatePlayPauseIcon(); updateDynamicTitle(); if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "playing"; }).catch(() => { });
            } else {
                audioPlayer.pause(); updatePlayPauseIcon(); updateDynamicTitle();
                if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "paused";
            }
        }
        window.togglePlayback = togglePlayback;

        function playNextSong() {
            if (!window.playingAlbum?.songs?.length) return;
            const total = window.playingAlbum.songs.length;
            if (window.repeatMode === 2) {
                /* REPEAT ONE: handleTrackEnded handles history — don't double-record */
                audioPlayer.currentTime = 0;
                audioPlayer.play().catch(() => { });
                if (window._highlightActive && typeof window.updateActiveSongHighlight === 'function') {
                    requestAnimationFrame(() => window.updateActiveSongHighlight());
                }
                return;
            }

            // When shuffle is ON the queue is already reordered by toggleShuffle,
            // so sequential advance is correct in both shuffle and normal mode.
            const next = window.currentSongIndex + 1;
            if (next >= total) {
                /* REPEAT ALL (mode 1): wrap back to song 0 when end of album/playlist is reached.
                   Queued songs (added via "Play Next" / "Add to End") play through once and are
                   then consumed — only the original source album/playlist songs loop. */
                if (window.repeatMode === 1) {
                    if (window._bzOffline && !navigator.onLine) { stopAndReset(); return; }
                    // Strip any manually-queued songs that sit beyond the source album boundary.
                    // _bzSourceSongCount is set when the album first starts playing and is never
                    // updated when the user queues additional songs, so it always reflects the
                    // "real" album/playlist length. Trimming here means queued songs play exactly
                    // once before the album loops cleanly from the beginning.
                    const srcCount = window._bzSourceSongCount;
                    if (srcCount > 0 && window.playingAlbum.songs.length > srcCount) {
                        window.playingAlbum.songs.splice(srcCount);
                        if (typeof window.rebuildMasterMap === 'function') window.rebuildMasterMap();
                        if (typeof window.renderFullscreenQueue === 'function') window.renderFullscreenQueue();
                    }
                    window._highlightActive = true;
                    window._bzScrollToActive = true;
                    window.playSong(0);
                    return;
                }
                /* ── FIX: Queue Continuation — wait for Auto-Mix injection ──────────────
                   When Auto-Mix is enabled and the injection is currently in progress
                   (automixInjecting flag is true inside beatzen-pro.js), the new songs
                   haven't been pushed to window.playingAlbum.songs yet. Calling
                   stopAndReset() here would kill playback even though songs are on the
                   way. Retry up to 5 times (600ms total) to give the injection time to
                   complete. If AutoMix is off or injection never completes, fall through
                   to stopAndReset() as before.
                ─────────────────────────────────────────────────────────────────────── */
                const automixEnabled = localStorage.getItem('beatzen_automix') === 'true';
                if (automixEnabled) {
                    let _retries = 0;
                    const _waitForAutoMix = () => {
                        const newTotal = window.playingAlbum?.songs?.length || 0;
                        const newNext = window.currentSongIndex + 1;
                        if (newNext < newTotal) {
                            /* Auto-Mix injected songs — play now */
                            if (window._bzOffline && !navigator.onLine) { stopAndReset(); return; }
                            window._highlightActive = true;
                            window._bzScrollToActive = true;
                            window.playSong(newNext);
                            return;
                        }
                        if (_retries < 5) {
                            _retries++;
                            setTimeout(_waitForAutoMix, 120);
                        } else {
                            /* AutoMix didn't deliver in time — stop cleanly */
                            stopAndReset();
                        }
                    };
                    setTimeout(_waitForAutoMix, 120);
                    return;
                }
                return stopAndReset();
            }

            /* ── Offline guard: don't load next song — let current finish quietly ──
               FIX (mobile): re-verify real connectivity here instead of trusting
               a possibly-stale _bzOffline flag. Some Android devices miss the
               'online' event after a brief network blip, which previously left
               this flag stuck true forever and silently killed every future
               track transition even though the connection had long since
               recovered. */
            if (window._bzOffline && !navigator.onLine) {
                stopAndReset();
                return;
            }
            window._bzOffline = false;

            /* Preserve highlight state across next/prev navigation */
            window._highlightActive = true;
            window._bzScrollToActive = true;  // signal updateActiveSongHighlight to center this row
            window.playSong(next);
        }

        function playPrevSong() {
            if (!window.playingAlbum) return;
            if (audioPlayer.currentTime > 3) { audioPlayer.currentTime = 0; return; }
            // When shuffle is ON the queue is already reordered by toggleShuffle,
            // so sequential prev is correct in both shuffle and normal mode.
            const prev = window.currentSongIndex - 1;
            if (prev < 0) { audioPlayer.currentTime = 0; return; }
            /* Preserve highlight state across next/prev navigation */
            window._highlightActive = true;
            window._bzScrollToActive = true;  // signal updateActiveSongHighlight to center this row
            window.playSong(prev);
        }

        // Replaced by enhanced version above

        window.playNextSong = playNextSong;
        window.playPrevSong = playPrevSong;

        /* NEXT ALBUM CYCLING & TOAST */
        window.nextAlbum = function () {
            if (!window.masterPool?.length) return null;

            // Prefer recent history first
            let candidates = window.masterPool.filter(a => a && a.songs?.length > 0);
            if (window.historyList?.length) {
                const recentId = window.historyList[0].id;
                const recent = candidates.find(a => String(a.id) === String(recentId));
                if (recent && recent !== window.playingAlbum) {
                    return window.resolveData(recent, recent.type || 'album');
                }
            }

            // Filter out current album, pick first valid
            candidates = candidates.filter(a => String(a.id) !== String(window.playingAlbum?.id));
            return candidates[0] ? window.resolveData(candidates[0], candidates[0].type || 'album') : null;
        };

        /* ═══════════════════════════════════════════════════════════════════
           TOAST NOTIFICATION ENGINE
           showToast(message, duration?)
           ─────────────────────────────────────────────────────────────────
           All notification types are defined here in one place.
           Duration defaults to 5 seconds. Toasts auto-dismiss and are
           also dismissible by clicking.

           Notification type is auto-detected from message content (checked in order):
             • Auto Sync  — auto sync (checked first so ✓ prefix never overrides it)
             • Error      — fail / error / invalid / corrupt / couldn't load / skipping
             • Done       — ✓ / restored / success / import / export / created / added
             • Removed    — cancel / remov / delet / stop
             • Cloud Sync — sync / syncing / refresh / refreshing / updating / update
             • Download   — download / saving / cached / offline
             • Loading    — loading / fetching / connecting / preparing
             • Auto Mix   — auto mix / ✦
             • Schedule   — schedule / dark mode
             • History    — histor / cleared  (before Queue so "Play history" hits here)
             • Playlist   — playlist          (before Queue so "…Playlists" hits here)
             • Queue      — next / play
             • Ready      — songs loaded / data ready / music ready
             • Sleep Timer— timer / alarm / sleep
             • Fullscreen — fullscreen
             • Notice     — everything else (default)
           ═══════════════════════════════════════════════════════════════════ */
        function showToast(message, duration = 5000) {
            const container = document.getElementById('toast-container');
            if (!container) return;

            /* Accept {title, message} object OR plain string */
            let rawMsg, forcedTitle = null;
            if (message && typeof message === 'object') {
                rawMsg = message.message || '';
                forcedTitle = message.title || null;
            } else {
                rawMsg = message || '';
            }
            const msg = rawMsg;

            let iconClass, iconBg, borderColor, glowColor, labelText, labelColor;

            /* Auto Sync is checked first — before the Done/✓ block — so that
               messages like "✓ Auto sync on…" are labelled Auto Sync, not Done */
            if (/auto.?sync|auto sync/i.test(msg)) {
                iconClass = 'fa-cloud-bolt';
                iconBg = 'linear-gradient(135deg,#2575fc,#0099ff)';
                borderColor = 'rgba(37,117,252,0.45)';
                glowColor = 'rgba(37,117,252,0.12)';
                labelText = 'Auto Sync'; labelColor = '#90caf9';
                /* Error — "couldn't load" and "skipping" added so audio-load
                   failures are labelled Error, not Notice */
            } else if (/fail|error|invalid|corrupt|couldn't load|skipping/i.test(msg)) {
                iconClass = 'fa-circle-exclamation';
                iconBg = 'linear-gradient(135deg,#c0392b,#e74c3c)';
                borderColor = 'rgba(231,76,60,0.45)';
                glowColor = 'rgba(231,76,60,0.12)';
                labelText = 'Error'; labelColor = '#ff8a80';
            } else if (/restored|success|import|export|created|added|copied|saved|set!/i.test(msg) || msg.includes('\u2713')) {
                iconClass = 'fa-circle-check';
                iconBg = 'linear-gradient(135deg,#1db954,#1ed760)';
                borderColor = 'rgba(29,185,84,0.45)';
                glowColor = 'rgba(29,185,84,0.12)';
                labelText = 'Done'; labelColor = '#6bcb77';
            } else if (/cancel|remov|delet|stop/i.test(msg)) {
                iconClass = 'fa-circle-xmark';
                iconBg = 'linear-gradient(135deg,#b91c1c,#ef4444)';
                borderColor = 'rgba(239,68,68,0.45)';
                glowColor = 'rgba(239,68,68,0.12)';
                labelText = 'Removed'; labelColor = '#fca5a5';
            } else if (/sync|syncing|refresh|refreshing|updating|update/i.test(msg)) {
                iconClass = 'fa-arrows-rotate';
                iconBg = 'linear-gradient(135deg,#2575fc,#0099ff)';
                borderColor = 'rgba(37,117,252,0.45)';
                glowColor = 'rgba(37,117,252,0.12)';
                labelText = 'Cloud Sync'; labelColor = '#90caf9';
            } else if (/download|saving|cached|offline/i.test(msg)) {
                iconClass = 'fa-cloud-arrow-down';
                iconBg = 'linear-gradient(135deg,#6a11cb,#2575fc)';
                borderColor = 'rgba(106,17,203,0.45)';
                glowColor = 'rgba(106,17,203,0.12)';
                labelText = 'Download'; labelColor = '#ce93d8';
            } else if (/loading|fetching|connecting|preparing/i.test(msg)) {
                iconClass = 'fa-spinner';
                iconBg = 'linear-gradient(135deg,#f39c12,#e67e22)';
                borderColor = 'rgba(243,156,18,0.45)';
                glowColor = 'rgba(243,156,18,0.12)';
                labelText = 'Loading'; labelColor = '#ffd580';
            } else if (/auto.?mix/i.test(msg) || msg.includes('\u2726')) {
                iconClass = 'fa-wand-magic-sparkles';
                iconBg = 'linear-gradient(135deg,#2575fc,#6a11cb)';
                borderColor = 'rgba(37,117,252,0.45)';
                glowColor = 'rgba(37,117,252,0.12)';
                labelText = 'Auto Mix'; labelColor = '#90b8ff';
            } else if (/schedule|dark.?mode/i.test(msg)) {
                iconClass = 'fa-clock';
                iconBg = 'linear-gradient(135deg,#7c3aed,#4f46e5)';
                borderColor = 'rgba(124,58,237,0.45)';
                glowColor = 'rgba(124,58,237,0.12)';
                labelText = 'Dark Mode Schedule'; labelColor = '#a78bfa';
                /* History and Playlist are checked BEFORE Queue so that messages
                   containing "play" (e.g. "Play history cleared", "…Playlists")
                   do not accidentally match the /next|play/ Queue branch */
            } else if (/histor|cleared/i.test(msg)) {
                iconClass = 'fa-clock-rotate-left';
                iconBg = 'linear-gradient(135deg,#636e72,#2d3436)';
                borderColor = 'rgba(178,190,195,0.35)';
                glowColor = 'rgba(178,190,195,0.08)';
                labelText = 'Play History'; labelColor = '#b2bec3';
            } else if (/playlist/i.test(msg)) {
                iconClass = 'fa-compact-disc';
                iconBg = 'linear-gradient(135deg,#7c3aed,#4f46e5)';
                borderColor = 'rgba(124,58,237,0.45)';
                glowColor = 'rgba(124,58,237,0.12)';
                labelText = 'Playlist'; labelColor = '#a78bfa';
            } else if (/next|play/i.test(msg)) {
                iconClass = 'fa-forward-step';
                iconBg = 'linear-gradient(135deg,#f39c12,#e67e22)';
                borderColor = 'rgba(243,156,18,0.45)';
                glowColor = 'rgba(243,156,18,0.12)';
                labelText = 'Queue'; labelColor = '#ffd580';
            } else if (/songs.*loaded|data.*ready|music.*ready/i.test(msg)) {
                iconClass = 'fa-music';
                iconBg = 'linear-gradient(135deg,#1db954,#2575fc)';
                borderColor = 'rgba(29,185,84,0.45)';
                glowColor = 'rgba(29,185,84,0.12)';
                labelText = 'Music Ready'; labelColor = '#6bcb77';
            } else if (/timer|alarm|sleep/i.test(msg)) {
                iconClass = 'fa-hourglass-half';
                iconBg = 'linear-gradient(135deg,#f59e0b,#d97706)';
                borderColor = 'rgba(245,158,11,0.45)';
                glowColor = 'rgba(245,158,11,0.12)';
                labelText = 'Sleep Timer'; labelColor = '#fde68a';
                /* Fullscreen — new branch so fullscreen on/off messages get
                   a distinct label instead of falling through to Notice */
            } else if (/fullscreen/i.test(msg)) {
                iconClass = 'fa-expand';
                iconBg = 'linear-gradient(135deg,#7c3aed,#4f46e5)';
                borderColor = 'rgba(124,58,237,0.45)';
                glowColor = 'rgba(124,58,237,0.12)';
                labelText = 'Fullscreen'; labelColor = '#a78bfa';
            } else {
                iconClass = 'fa-circle-info';
                iconBg = 'linear-gradient(135deg,#2575fc,#6a11cb)';
                borderColor = 'rgba(124,58,237,0.45)';
                glowColor = 'rgba(124,58,237,0.12)';
                labelText = 'Notice'; labelColor = '#a78bfa';
            }

            if (forcedTitle) labelText = forcedTitle;

            // Strip only a leading ✓ or ✦ symbol — keep the full message text
            const cleanMsg = msg.replace(/^[✓✦]\s*/, '').trim();

            const toast = document.createElement('div');
            toast.className = 'bz-generic-toast';
            toast.innerHTML = `
                <div class="bz-rr-icon-wrap" style="background:${iconBg};box-shadow:0 4px 14px ${glowColor.replace('0.12', '0.5')};">
                    <i class="fas ${iconClass}" style="color:#fff;font-size:15px;"></i>
                </div>
                <div class="bz-rr-text">
                    <span class="bz-rr-label" style="color:${labelColor};">${labelText}</span>
                    <span class="bz-rr-sub">${cleanMsg}</span>
                </div>
                <button class="bz-toast-close" aria-label="Close">
                    <i class="fas fa-xmark"></i>
                </button>
                <div class="bz-toast-progress" style="--toast-duration:${duration}ms;background:${labelColor};"></div>`;
            toast.style.cssText = `border-color:${borderColor};box-shadow:0 8px 32px rgba(0,0,0,0.55),0 0 0 1px ${glowColor};`;

            container.appendChild(toast);

            requestAnimationFrame(() => requestAnimationFrame(() => {
                toast.style.opacity = '1';
                toast.style.transform = 'translateY(0) scale(1)';
                const bar = toast.querySelector('.bz-toast-progress');
                if (bar) bar.classList.add('bz-toast-progress--running');
            }));

            function dismiss() {
                clearTimeout(timer);
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(8px) scale(0.96)';
                setTimeout(() => toast.remove(), 300);
            }

            const timer = setTimeout(dismiss, duration);

            toast.querySelector('.bz-toast-close').addEventListener('click', e => {
                e.stopPropagation();
                dismiss();
            });

            toast.addEventListener('click', dismiss, { once: true });
        }

        /* ── Repeat Rewind styled toast — bottom-center, icon-based ── */
        function showRepeatRewindToast(songTitle, playWord, duration = 3500) {
            const container = document.getElementById('toast-container');
            if (!container) return;

            /* Remove any existing repeat-rewind toast to avoid stacking */
            container.querySelector('.bz-rr-toast')?.remove();

            const toast = document.createElement('div');
            toast.className = 'bz-rr-toast';
            toast.innerHTML = `
                <div class="bz-rr-icon-wrap" style="
                    background:linear-gradient(135deg,#7c3aed,#4f46e5);
                    box-shadow:0 4px 14px rgba(124,58,237,0.5);
                ">
                    <i class="fas fa-repeat" style="color:#fff;font-size:14px;"></i>
                </div>
                <div class="bz-rr-text">
                    <span class="bz-rr-label">Repeat Rewind</span>
                    <span class="bz-rr-sub">Songs you replayed upto 3+ times &nbsp;·&nbsp; ${songTitle}</span>
                </div>`;

            container.appendChild(toast);

            requestAnimationFrame(() => requestAnimationFrame(() => {
                toast.style.opacity = '1';
                toast.style.transform = 'translateY(0) scale(1)';
            }));

            const timer = setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(8px) scale(0.96)';
                setTimeout(() => toast.remove(), 300);
            }, duration);

            toast.addEventListener('click', () => {
                clearTimeout(timer);
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(8px) scale(0.96)';
                setTimeout(() => toast.remove(), 280);
            }, { once: true });
        }

        function stopAndReset() {
            audioPlayer.pause();
            audioPlayer.currentTime = 0;
            _stopMIUIPositionTimer(); // clear MIUI position timer if running
            /* Reset RR accumulators so no stale seconds bleed into the next song */
            window._bzRRCountedThisSong = null;
            window._bzRRListenedSecs = 0;
            window._bzRRLastTime = null;
            window._bzRRSongId = null;
            // Clear active song highlight so no row glows after queue ends
            window._highlightActive = false;
            window.currentSongIndex = -1;
            document.querySelectorAll('.song-item').forEach(el => el.classList.remove('active'));
            updatePlayPauseIcon();
            updateDynamicTitle();
        }

        /* AUDIO EVENTS */
        audioPlayer.onplay = () => {
            updatePlayPauseIcon(); updateDynamicTitle();
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
            // Sync BOTH card layers — home grid cards and playlist cards
            syncAllCardPlayBtns();
            if (typeof window.bzSyncPlaylistsPlayBtns === 'function') window.bzSyncPlaylistsPlayBtns();
            // Re-sync active song highlight on every play event — fixes random cases where
            // highlight was lost after next/prev, media session controls, or swipe gestures.
            if (window._highlightActive && typeof updateActiveSongHighlight === 'function') {
                requestAnimationFrame(() => updateActiveSongHighlight());
            }
            // Tell OS to start counting forward; start MIUI 1s interval in parallel
            updateMediaPositionState();
            _startMIUIPositionTimer();
            // Push lastPlayedSong/beatZen_lastPosition to the cloud promptly (debounced
            // 2s) instead of waiting up to 2 minutes for the periodic sync — this is
            // what lets another idle device pick up the new song quickly, or shows a
            // "Play here" toast on a device that's actively playing something else.
            setTimeout(() => { try { window.bzSilentUpload?.(); } catch (_) { } }, 200);
        };
        audioPlayer.onpause = () => {
            updatePlayPauseIcon(); updateDynamicTitle();
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
            // Sync BOTH card layers on pause too
            syncAllCardPlayBtns();
            if (typeof window.bzSyncPlaylistsPlayBtns === 'function') window.bzSyncPlaylistsPlayBtns();
            // Freeze OS counter; stop MIUI interval
            updateMediaPositionState();
            _stopMIUIPositionTimer();
            // Push the position reached at pause-time promptly — the single most useful
            // moment to sync, since pausing here to resume on another device is the
            // main reason cross-device position sync exists.
            setTimeout(() => { try { window.bzSilentUpload?.(); } catch (_) { } }, 200);
        };
        audioPlayer.addEventListener('waiting', () => {
            if (playPauseBtn) playPauseBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
            const miniBtn = document.getElementById('mini-play-pause-btn');
            if (miniBtn) miniBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
        });
        audioPlayer.addEventListener('playing', () => { updatePlayPauseIcon(); updateMediaPositionState(); });
        audioPlayer.addEventListener('loadeddata', () => { if (!isNaN(audioPlayer.duration)) document.querySelectorAll('#duration').forEach(el => el.textContent = formatTime(audioPlayer.duration)); });
        audioPlayer.addEventListener('seeked', updateMediaPositionState);
        audioPlayer.addEventListener('loadedmetadata', () => { updateMediaPositionState(); if (!isNaN(audioPlayer.duration) && audioPlayer.duration > 0) document.querySelectorAll('#duration').forEach(el => el.textContent = formatTime(audioPlayer.duration)); }); // FIX Bug 9: use querySelectorAll for all duration elements, matching loadeddata pattern, and guard NaN/0
        audioPlayer.addEventListener('ratechange', updateMediaPositionState);
        audioPlayer.addEventListener('error', () => {
            /* Guard 1: ignore errors from empty/unset src (page load, reset) */
            if (!audioPlayer.src || audioPlayer.src === window.location.href) return;
            /* Guard 2: ignore errors during session restore (shouldPlay=false).
               Restore only populates the player bar without starting audio —
               a network/CDN error on the silent pre-load should never show a
               toast or skip the song; the user hasn't pressed Play yet. */
            if (!window._bzExpectingPlayback) return;
            // Code 4 (MEDIA_ERR_SRC_NOT_SUPPORTED) = URL definitively broken — skip immediately
            const delay = (audioPlayer.error?.code === 4) ? 0 : 2000;
            showToast("Couldn't load this song, skipping…");
            setTimeout(playNextSong, delay);
        });
        audioPlayer.addEventListener('play', () => { if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "playing"; });
        audioPlayer.addEventListener('ended', () => { if (window.repeatMode !== 2 && 'mediaSession' in navigator) navigator.mediaSession.playbackState = "none"; });

        /* FIX: Volume Persistence – save whenever volume changes */
        audioPlayer.addEventListener('volumechange', () => {
            localStorage.setItem('beatZen_volume', String(audioPlayer.volume));
        });

        /* PROGRESS BAR */
        function syncProgressBar() {
            if (isDragging) return;
            // FIX Bug 1 & 2: while paused and the saved-position restore hasn't been applied yet,
            // skip painting progress/time so we don't wipe out the values painted from localStorage
            // by paintLastPlayedBar/applySavedTime before the seek to the saved time completes.
            if (audioPlayer.paused && !audioPlayer._restoreApplied) return;
            const cur = audioPlayer.currentTime, dur = audioPlayer.duration;
            const pct = dur > 0 ? (cur / dur) * 100 : 0;
            document.querySelectorAll('#progress').forEach(el => el.style.width = `${pct}%`);
            document.querySelectorAll('#current-time').forEach(el => el.textContent = formatTime(cur));
            if (!isNaN(dur) && dur > 0) document.querySelectorAll('#duration').forEach(el => el.textContent = formatTime(dur));
            /* Save playback position for restore on refresh.
               Bundle the current songId so the restore path can validate
               the position belongs to the song being restored — avoids a
               stale position from a previous song seeking the wrong one. */
            if (isFinite(cur) && cur > 0) {
                const _posSongId = window.playingAlbum?.songs?.[window.currentSongIndex]?.id;
                localStorage.setItem('beatZen_lastPosition', JSON.stringify({
                    t: cur,
                    d: isFinite(dur) && dur > 0 ? dur : undefined,
                    id: _posSongId != null ? String(_posSongId) : ''
                }));
            }
            /* ── REPEAT REWIND real-audio-second accumulator ─────────────────────────────
               timeupdate fires only during active playback, so pauses are free.
               Record a qualifying play on the first timeupdate tick (cur > 0) once per
               song/loop-iteration. No time accumulation needed — threshold is 0.          */
            if (!audioPlayer.paused && isFinite(cur) && cur > 0) {
                const _rrTrackedId = window._bzRRSongId;
                const _curSongId = window.playingAlbum?.songs?.[window.currentSongIndex]?.id;
                if (_rrTrackedId && String(_curSongId) === _rrTrackedId && !window._bzRRCountedThisSong) {
                    // Record immediately on first active tick — no seconds accumulation required
                    window._bzRRCountedThisSong = _rrTrackedId;
                    try {
                        let rrList = [];
                        try { rrList = JSON.parse(localStorage.getItem(BZ_RR_PLAYS_KEY) || '[]'); } catch (_e) { }
                        rrList.unshift({ id: _rrTrackedId, ts: Date.now() });
                        rrList = rrList.slice(0, BZ_RR_PLAYS_MAX);
                        localStorage.setItem(BZ_RR_PLAYS_KEY, JSON.stringify(rrList));
                    } catch (_e) { /* never break playback */ }
                    const _rrSongObj = window.playingAlbum?.songs?.[window.currentSongIndex];
                    if (_rrSongObj) checkRepeatRewind(_rrSongObj);
                }
            }
            // setPositionState must only be called on play/pause/seek events, not on
            // every timeupdate tick — the OS extrapolates position automatically.
            /* FIX: Gapless – start prefetching next track when ≤15 s remain */
            if (window.repeatMode !== 2 && dur > 0 && (dur - cur) <= 15 &&
                _gpIdx !== (window.currentSongIndex + 1) &&
                !audioPlayer.paused) {
                bzPreloadNext();
            }
        }
        audioPlayer.ontimeupdate = syncProgressBar;
        audioPlayer.addEventListener('loadedmetadata', syncProgressBar);
        // FIX: belt-and-suspenders — duration/progress can otherwise sit blank if
        // 'loadedmetadata' fires before this listener attaches (fast cache hits) or
        // never fires at all on some mobile browsers; 'canplay' and 'durationchange'
        // catch those cases too. syncProgressBar() is idempotent/cheap to call again.
        audioPlayer.addEventListener('canplay', syncProgressBar);
        audioPlayer.addEventListener('durationchange', syncProgressBar);

        if (progressBar) {
            let scrubbing = false;
            const handleScrub = (e) => {
                const dur = audioPlayer.duration;
                if (!dur || isNaN(dur)) return;
                const rect = progressBar.getBoundingClientRect();
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const pct = Math.max(0, Math.min(clientX - rect.left, rect.width)) / rect.width;
                const newTime = pct * dur;
                if (progress) progress.style.width = `${pct * 100}%`;
                if (currentTimeSpan) currentTimeSpan.textContent = formatTime(newTime);
                audioPlayer.currentTime = newTime;
                // seeked event fires after scrub — updateMediaPositionState called there
            };
            progressBar.onmousedown = (e) => { scrubbing = true; window._bzScrubbing = true; handleScrub(e); };
            window.addEventListener('mousemove', (e) => { if (scrubbing) handleScrub(e); });
            window.addEventListener('mouseup', () => { scrubbing = false; window._bzScrubbing = false; });
            progressBar.ontouchstart = (e) => { scrubbing = true; window._bzScrubbing = true; handleScrub(e); };
            progressBar.ontouchmove = (e) => { if (scrubbing) { if (e.cancelable) e.preventDefault(); handleScrub(e); } };
            progressBar.ontouchend = () => { scrubbing = false; window._bzScrubbing = false; };
            // Handle OS-level touch cancellations (phone calls, system gestures, multi-touch)
            progressBar.ontouchcancel = () => { scrubbing = false; window._bzScrubbing = false; };
            // Safety net: switching apps mid-scrub should also reset the flag
            document.addEventListener('visibilitychange', () => { if (document.hidden) { scrubbing = false; window._bzScrubbing = false; } });
        }

        /* NAVIGATION */
        function hideAllViews() {
            [yearSectionsContainer, searchResultsContainer, playlistsContainer, artistsContainer, albumViewContainer, exploreContainer, settingsContainer, updatesContainer]
                .forEach(v => { if (v && v.style.display !== 'none') v.style.display = 'none'; });
            if (searchContainer && !searchContainer.classList.contains('hidden')) searchContainer.classList.add('hidden');
        }

        function updateNav(id) {
            document.querySelectorAll('.nav-link-content').forEach(l => l.classList.remove('active'));
            document.getElementById(`${id}-link`)?.querySelector('.nav-link-content')?.classList.add('active');
        }

        function renderCard(title, img, onClick, albumId) {
            const div = document.createElement('div');
            div.className = 'album-card';
            div.setAttribute('data-album-id', String(albumId));
            let src = img || '';
            if (src.includes('cloudinary')) src = src.replace('/upload/', '/upload/f_auto,q_auto,w_400/');
            div.innerHTML = `
                <div class="album-card-img-wrap">
                    <img src="${src}" alt="${title}" loading="lazy" style="background:#2c3e50;min-height:150px;object-fit:cover;">
                    <div class="album-card-music-bars" aria-hidden="true">
                        <span></span><span></span><span></span><span></span>
                    </div>
                </div>
                <div class="album-info"><h2>${title}</h2></div>`;

            /* Card click — open album view */
            div.addEventListener('click', (e) => {
                e.preventDefault();
                onClick();
            });

            return div;
        }

        /* Sync all home cards to show correct now-playing/playing state via CSS classes */
        function syncAllCardPlayBtns() {
            const audio = document.getElementById('audio-player');
            const playingId = window.playingAlbum ? String(window.playingAlbum.id) : '';
            const isPaused = !audio || audio.paused;

            document.querySelectorAll('.album-card').forEach(card => {
                const cardAlbumId = String(card.getAttribute('data-album-id') || '');
                const isMatch = playingId && cardAlbumId && cardAlbumId === playingId;
                if (isMatch && !isPaused) {
                    card.classList.add('album-card--now-playing');
                    card.classList.add('album-card--playing');
                } else if (isMatch && isPaused) {
                    card.classList.add('album-card--now-playing');
                    card.classList.remove('album-card--playing');
                } else {
                    card.classList.remove('album-card--now-playing');
                    card.classList.remove('album-card--playing');
                }
            });
        }
        /* Expose so audio events can call it */
        window.syncAllCardPlayBtns = function () {
            syncAllCardPlayBtns();
            if (typeof window.bzSyncPlaylistsPlayBtns === 'function') window.bzSyncPlaylistsPlayBtns();
        };

        function navigateToView(id, container, isBack = false) {
            // FIX: Save scroll unconditionally — don't gate on albumView being hidden.
            // When coming back FROM album view, albumViewContainer is still visible at
            // this point and the old guard caused the position to never be saved.
            if (window.lastActiveView && window.lastActiveView !== id) {
                // FIX Bug 5: prefer the continuously-updated scrollPositions map over a
                // possibly-stale window.scrollY (fast/programmatic navigation may run
                // before the browser commits the latest scroll event).
                const pos = (typeof window.scrollPositions[window.lastActiveView] === 'number')
                    ? window.scrollPositions[window.lastActiveView]
                    : window.scrollY;
                window.scrollPositions[window.lastActiveView] = pos;
                localStorage.setItem('beatZen_scroll_' + window.lastActiveView, pos);
            }
            hideAllViews();
            updateNav(id);
            window.lastActiveView = id;
            localStorage.setItem('beatZen_activeView', id);
            // FIX Bug 7: include scrollY for the target view in the pushState entry so
            // onpopstate for tab-level entries (e.g. playlists) has a reliable value
            // instead of falling back to a possibly-stale scrollPositions map.
            if (!isBack && window.location.hash !== `#${id}`) {
                window._bzSpaNavDepth++; // FIX Bug 3: track SPA-internal navigation depth
                const _targetScroll = parseInt(window.scrollPositions[id] || localStorage.getItem('beatZen_scroll_' + id) || 0);
                history.pushState({ view: id, scrollY: _targetScroll }, '', `#${id}`);
            }
            const saved = localStorage.getItem('beatZen_scroll_' + id);
            const targetPos = parseInt(window.scrollPositions[id] || saved || 0);
            // Show container immediately — no visibility:hidden flash
            if (container) container.style.display = 'block';
            // FIX: Double-rAF ensures the browser has fully laid out and painted the
            // newly visible container before we attempt to scroll. A single rAF can
            // fire before the layout pass completes (e.g. after heavy re-renders like
            // the home grid or playlists), causing the scroll to land at 0 instead of
            // the saved position.
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    window.scrollTo({ top: targetPos, behavior: 'instant' });
                });
            });
            updateDynamicTitle();
        }

        /* VIEW ENGINES */
        /* ── Build a row of N skeleton cards (matches .album-card 140px shape) ── */
        function _bzHomeSkeletonRow(count) {
            const row = document.createElement('div');
            row.className = 'albums-grid bz-sk-grid';
            for (let i = 0; i < count; i++) {
                row.innerHTML += `<div class="bz-sk-card">
                    <div class="bz-skel bz-sk-card__img"></div>
                    <div class="bz-skel bz-sk-card__title"></div>
                    <div class="bz-skel bz-sk-card__sub"></div>
                </div>`;
            }
            return row;
        }

        /* ── Build skeleton year-sections for the home grid ── */
        function _bzInjectHomeSkeletons() {
            yearSectionsContainer.innerHTML = '';
            delete yearSectionsContainer.dataset.bzScrollReady;
            const years = allYears.length ? allYears : [0, 1, 2];   // fallback if data not ready
            years.forEach((year, idx) => {
                const sec = document.createElement('div');
                sec.className = 'year-section bz-sk-year-section';
                sec.id = `year-sec-skel-${idx}`;
                /* Heading skeleton */
                const heading = document.createElement('div');
                heading.className = 'bz-skel bz-sk-year-heading';
                sec.appendChild(heading);
                /* Card row skeleton — show ~5 cards */
                sec.appendChild(_bzHomeSkeletonRow(5));
                yearSectionsContainer.appendChild(sec);
            });
        }

        function displayHome(isBack = false, targetYear = null) {
            // Always rebuild if empty; also rebuild after a data refresh (grid may be stale)
            if (!yearSectionsContainer.innerHTML.trim() || yearSectionsContainer.dataset.builtFor !== window._bzDataVersion) {
                /* Show skeletons immediately so there is no blank flash */
                _bzInjectHomeSkeletons();
                navigateToView('home', yearSectionsContainer, isBack);

                /* Yield to browser paint, then swap in real cards */
                requestAnimationFrame(() => {
                    yearSectionsContainer.innerHTML = '';
                    const frag = document.createDocumentFragment();
                    allYears.forEach(year => {
                        const sec = document.createElement('div');
                        sec.className = 'year-section bz-sk-replaced'; sec.id = `year-sec-${year}`;
                        sec.innerHTML = `<h2>${year}</h2><div class="albums-grid"></div>`;
                        const grid = sec.querySelector('.albums-grid');
                        (customYearAlbumsData[year] || []).forEach(a => grid.appendChild(renderCard(a.title, a.imageUrl, () => selectAlbum(resolveData(a, "Movie")), a.id)));
                        frag.appendChild(sec);
                    });
                    yearSectionsContainer.appendChild(frag);
                    yearSectionsContainer.dataset.builtFor = window._bzDataVersion;
                    if (targetYear) {
                        const el = document.getElementById(`year-sec-${targetYear}`);
                        if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
                        yearSectionsContainer.dataset.bzScrollReady = '1';
                    } else {
                        // FIX: on a cold reload, navigateToView() above ran its scroll
                        // restore while the grid was still just skeletons (too short
                        // to scroll to the saved position, so the browser clamped it
                        // to ~0). Now that the real cards are in and the page has its
                        // full height, re-apply the saved position once more.
                        const _savedHomeScroll = parseInt(
                            window.scrollPositions['home'] ?? localStorage.getItem('beatZen_scroll_home') ?? 0,
                            10
                        ) || 0;
                        if (_savedHomeScroll > 0) {
                            requestAnimationFrame(() => {
                                window.scrollTo({ top: _savedHomeScroll, behavior: 'instant' });
                                yearSectionsContainer.dataset.bzScrollReady = '1';
                            });
                        } else {
                            yearSectionsContainer.dataset.bzScrollReady = '1';
                        }
                    }
                });
                return; // navigateToView already called above
            }
            navigateToView('home', yearSectionsContainer, isBack);
            yearSectionsContainer.dataset.bzScrollReady = '1';
            /* Re-sync card play states and active highlight after back navigation */
            if (isBack) {
                requestAnimationFrame(() => {
                    syncAllCardPlayBtns();
                    if (window._highlightActive && typeof updateActiveSongHighlight === 'function') {
                        updateActiveSongHighlight();
                    }
                });
            }
            if (targetYear) {
                // FIX Issue 8: navigateToView uses a double-rAF to restore saved scroll.
                // A plain setTimeout(150) here fires BEFORE that double-rAF completes,
                // so the year scroll was immediately overwritten by the saved position.
                // We defer using a third rAF AFTER the two inside navigateToView so
                // the year scroll always wins.
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            const el = document.getElementById(`year-sec-${targetYear}`);
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        });
                    });
                });
            }
        }

        /* ════════════════════════════════════════════════════════════
           DAILY PLAYLISTS — 4 slot rows, 8 playlists per slot
           Songs assigned by mood using duration + year + stable hash.
           Each playlist: 80-150 songs. Rotates daily via seed.
        ════════════════════════════════════════════════════════════ */
        const BEAT_ZEN_LOGO = 'https://res.cloudinary.com/beatzenapp/image/upload/v1782654641/Logo_kmpfjf.jpg';

        /* ── Seeded RNG (better LCG) ── */
        function dailySeedRandom(seed) {
            let s = ((seed ^ 0xdeadbeef) >>> 0) || 1;
            return function () {
                s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
                s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
                s = (s ^ (s >>> 16)) >>> 0;
                return s / 4294967296;
            };
        }

        /* Stable numeric hash of a string (djb2) */
        function strHash(str) {
            let h = 5381;
            for (let i = 0; i < str.length; i++) h = (Math.imul(h, 33) ^ str.charCodeAt(i)) >>> 0;
            return h;
        }

        /* Date seed: unique integer per calendar day */
        function getTodaySeed() {
            const d = new Date();
            return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
        }

        /* Parse "mm:ss" or "h:mm:ss" → total seconds */
        function parseDurSec(dur) {
            if (!dur) return 0;
            const p = String(dur).split(':').map(Number);
            if (p.length === 3) return p[0] * 3600 + p[1] * 60 + (p[2] || 0);
            if (p.length === 2) return p[0] * 60 + (p[1] || 0);
            return 0;
        }

        /* Seeded Fisher-Yates shuffle */
        function seededShuffle(arr, rng) {
            const a = arr.slice();
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(rng() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
        }

        /* ── MOOD CONSTANTS ─────────────────────────────────────────
           We classify songs using only what we reliably have:
             duration  → tempo proxy  (short=energetic, long=slow/deep)
             year      → era proxy    (recent=trending, old=retro)
             id hash   → stable partition (0-7) for variety
    
           Duration bands (seconds):
             PEPPY    : < 180        short punchy songs
             UPBEAT   : 180 – 240    medium energy
             MELODIC  : 240 – 300    soft / flowing
             ROMANTIC : 240 – 300    overlaps melodic, same duration band
             DEEP     : >= 300       long slow songs
             EMOTIONAL: >= 270       long + even hash
             TRENDING : year >= now-3
             RETRO    : year < 2012
        ─────────────────────────────────────────────────────────────── */
        const MOOD = { PEPPY: 0, UPBEAT: 1, ROMANTIC: 2, MELODIC: 3, DEEP: 4, RETRO: 5, TRENDING: 6, EMOTIONAL: 7 };

        function classifySong(song, album) {
            const dur = parseDurSec(song.duration);
            const year = parseInt(album.year) || 2015;
            const nowY = new Date().getFullYear();
            const hash = strHash(String(song.id)) % 8;
            const moods = new Set();

            if (dur > 0 && dur < 180) moods.add(MOOD.PEPPY);
            if (dur >= 180 && dur < 240) moods.add(MOOD.UPBEAT);
            if (dur >= 240 && dur < 300) { moods.add(MOOD.MELODIC); moods.add(MOOD.ROMANTIC); }
            if (dur >= 300) moods.add(MOOD.DEEP);
            if (dur >= 270 && hash % 2 === 0) moods.add(MOOD.EMOTIONAL);
            if (year >= nowY - 3) moods.add(MOOD.TRENDING);
            if (year < 2012) moods.add(MOOD.RETRO);
            /* Hash-partition fallback so every song lands somewhere */
            moods.add(hash % 8);

            return moods;
        }

        /* ── SLOT + PLAYLIST DEFINITIONS ───────────────────────────
           primary   : mood buckets — songs selected from here first
           fallback  : fill remaining slots if primary is short
           target    : hard cap on songs per playlist (20-30)
        ─────────────────────────────────────────────────────────────── */
        const SLOT_DEFS = [
            {
                id: 'daily-morning', label: 'Morning Vibes', hour: 6,
                playlists: [
                    { name: 'Chirpy Mornings', primary: [MOOD.PEPPY], fallback: [MOOD.UPBEAT, MOOD.TRENDING] },
                    { name: 'Morning Masala', primary: [MOOD.UPBEAT, MOOD.PEPPY], fallback: [MOOD.TRENDING] },
                    { name: 'Wake Up Hits', primary: [MOOD.TRENDING], fallback: [MOOD.UPBEAT, MOOD.PEPPY] },
                    { name: 'Sunrise Melodies', primary: [MOOD.MELODIC], fallback: [MOOD.ROMANTIC, MOOD.DEEP] },
                    { name: 'Feel Good Start', primary: [MOOD.ROMANTIC], fallback: [MOOD.MELODIC, MOOD.UPBEAT] },
                    { name: 'Morning Rush', primary: [MOOD.PEPPY, MOOD.UPBEAT], fallback: [MOOD.TRENDING] },
                    { name: 'Acoustic Awakening', primary: [MOOD.MELODIC, MOOD.DEEP], fallback: [MOOD.EMOTIONAL, MOOD.ROMANTIC] },
                    { name: 'Freshly Brewed', primary: [MOOD.TRENDING, MOOD.PEPPY], fallback: [MOOD.UPBEAT] },
                ]
            },
            {
                id: 'daily-afternoon', label: 'Afternoon Energy', hour: 12,
                playlists: [
                    { name: 'Afternoon Drive', primary: [MOOD.UPBEAT], fallback: [MOOD.PEPPY, MOOD.TRENDING] },
                    { name: 'High Noon Beats', primary: [MOOD.PEPPY, MOOD.UPBEAT], fallback: [MOOD.TRENDING] },
                    { name: 'Post Lunch Vibes', primary: [MOOD.MELODIC], fallback: [MOOD.ROMANTIC, MOOD.DEEP] },
                    { name: 'Power Hour', primary: [MOOD.PEPPY], fallback: [MOOD.UPBEAT, MOOD.TRENDING] },
                    { name: 'Midday Romance', primary: [MOOD.ROMANTIC], fallback: [MOOD.MELODIC, MOOD.EMOTIONAL] },
                    { name: 'Work Mode On', primary: [MOOD.MELODIC, MOOD.DEEP], fallback: [MOOD.EMOTIONAL] },
                    { name: 'Street Bangers', primary: [MOOD.PEPPY, MOOD.UPBEAT], fallback: [MOOD.TRENDING] },
                    { name: 'Afternoon Gold', primary: [MOOD.RETRO], fallback: [MOOD.MELODIC, MOOD.ROMANTIC] },
                ]
            },
            {
                id: 'daily-evening', label: 'Evening Mood', hour: 18,
                playlists: [
                    { name: 'Sunset Sessions', primary: [MOOD.MELODIC, MOOD.ROMANTIC], fallback: [MOOD.DEEP, MOOD.EMOTIONAL] },
                    { name: 'Party Starter', primary: [MOOD.PEPPY, MOOD.UPBEAT], fallback: [MOOD.TRENDING] },
                    { name: 'Evening Romance', primary: [MOOD.ROMANTIC], fallback: [MOOD.MELODIC, MOOD.EMOTIONAL] },
                    { name: 'Chill Zone', primary: [MOOD.DEEP, MOOD.MELODIC], fallback: [MOOD.EMOTIONAL, MOOD.ROMANTIC] },
                    { name: 'Retro Rewind', primary: [MOOD.RETRO], fallback: [MOOD.MELODIC, MOOD.DEEP] },
                    { name: 'Drama Kings', primary: [MOOD.EMOTIONAL], fallback: [MOOD.DEEP, MOOD.ROMANTIC] },
                    { name: 'Bass Drop', primary: [MOOD.PEPPY, MOOD.UPBEAT], fallback: [MOOD.TRENDING] },
                    { name: 'Evening Unplugged', primary: [MOOD.DEEP, MOOD.EMOTIONAL], fallback: [MOOD.MELODIC, MOOD.ROMANTIC] },
                ]
            },
            {
                id: 'daily-midnight', label: 'Midnight Feels', hour: 0,
                playlists: [
                    { name: 'Midnight Melancholy', primary: [MOOD.EMOTIONAL, MOOD.DEEP], fallback: [MOOD.ROMANTIC, MOOD.MELODIC] },
                    { name: 'Late Night Drive', primary: [MOOD.DEEP, MOOD.UPBEAT], fallback: [MOOD.EMOTIONAL, MOOD.MELODIC] },
                    { name: 'Slow Burns', primary: [MOOD.DEEP], fallback: [MOOD.EMOTIONAL, MOOD.MELODIC] },
                    { name: 'Stars & Stories', primary: [MOOD.MELODIC, MOOD.ROMANTIC], fallback: [MOOD.DEEP, MOOD.EMOTIONAL] },
                    { name: 'Insomniac Beats', primary: [MOOD.UPBEAT, MOOD.PEPPY], fallback: [MOOD.TRENDING] },
                    { name: 'Heartbreak Hotel', primary: [MOOD.EMOTIONAL], fallback: [MOOD.DEEP, MOOD.ROMANTIC] },
                    { name: 'Midnight Romance', primary: [MOOD.ROMANTIC, MOOD.DEEP], fallback: [MOOD.EMOTIONAL, MOOD.MELODIC] },
                    { name: 'The Night Owl', primary: [MOOD.DEEP, MOOD.MELODIC], fallback: [MOOD.EMOTIONAL, MOOD.RETRO] },
                ]
            }
        ];

        /* ── MAIN OVERRIDE ─────────────────────────────────────────── */
        window.buildDailyPlaylists = function () {
            const todaySeed = getTodaySeed();

            /* ── Constants — declared FIRST so all code below can use them ── */
            const MIN_SONGS = 80, MAX_SONGS = 150;
            const RANGE = MAX_SONGS - MIN_SONGS + 1;   // 71 possible values
            const TOTAL_PL = SLOT_DEFS.reduce((s, sd) => s + sd.playlists.length, 0); // 32

            /* ── Collect every song from non-user sources ── */
            const allSongEntries = [];
            (window.masterPool || []).forEach(album => {
                if (!album || !Array.isArray(album.songs) || album.type === 'Playlist') return;
                album.songs.forEach(song => {
                    if (song && song.id) allSongEntries.push({ song, album });
                });
            });

            /* ── Pre-classify every song once into mood buckets ── */
            const moodBuckets = new Map();
            for (let m = 0; m < 8; m++) moodBuckets.set(m, []);
            allSongEntries.forEach(({ song, album }) => {
                classifySong(song, album).forEach(m => moodBuckets.get(m)?.push(String(song.id)));
            });

            /* Total unique song IDs available */
            const totalSongs = allSongEntries.length;

            /* ── 32 unique song-count targets: MIN_SONGS – MAX_SONGS ─────────
               No two playlists share the same count. Seeded per day.
            ─────────────────────────────────────────────────────────────────── */
            const countRng = dailySeedRandom(todaySeed * 999 + 7);
            const usedCounts = new Set();
            const uniqueCounts = [];
            let safety = 0;
            while (uniqueCounts.length < TOTAL_PL && safety++ < 10000) {
                const c = MIN_SONGS + Math.floor(countRng() * RANGE);
                if (!usedCounts.has(c)) { usedCounts.add(c); uniqueCounts.push(c); }
            }
            /* Sequential fallback — fills any remaining if RNG exhausts range */
            for (let v = MIN_SONGS; uniqueCounts.length < TOTAL_PL && v <= MAX_SONGS; v++) {
                if (!usedCounts.has(v)) { usedCounts.add(v); uniqueCounts.push(v); }
            }

            let _plCountIdx = 0;

            return SLOT_DEFS.map((slotDef, slotIdx) => {
                const slotRng = dailySeedRandom(todaySeed * 7 + slotIdx * 31);

                const playlists = slotDef.playlists.map((def, defIdx) => {
                    const _plTarget = uniqueCounts[_plCountIdx++];
                    const plRng = dailySeedRandom(todaySeed * 13 + slotIdx * 97 + defIdx * 17);

                    /* Primary pool */
                    const primarySet = new Set();
                    def.primary.forEach(m => {
                        seededShuffle(moodBuckets.get(m) || [],
                            dailySeedRandom(todaySeed + m * 1000 + defIdx * 7)
                        ).forEach(id => primarySet.add(id));
                    });

                    /* Fallback pool — only songs not in primary */
                    const fallbackSet = new Set();
                    def.fallback.forEach(m => {
                        seededShuffle(moodBuckets.get(m) || [],
                            dailySeedRandom(todaySeed + m * 500 + defIdx * 11)
                        ).forEach(id => { if (!primarySet.has(id)) fallbackSet.add(id); });
                    });

                    /* If still short of target, pull remaining songs not yet used */
                    const merged = seededShuffle([...primarySet, ...fallbackSet], plRng);
                    let songIds = [...new Set(merged)];

                    /* Top-up: if we have fewer songs than target, add any remaining songs */
                    if (songIds.length < _plTarget) {
                        const usedSet = new Set(songIds);
                        const topUp = seededShuffle(
                            allSongEntries.map(e => String(e.song.id)).filter(id => !usedSet.has(id)),
                            dailySeedRandom(todaySeed * 77 + slotIdx * 13 + defIdx)
                        );
                        songIds = songIds.concat(topUp).slice(0, _plTarget);
                    } else {
                        songIds = songIds.slice(0, _plTarget);
                    }

                    return {
                        id: `${slotDef.id}-${def.name.toLowerCase().replace(/\s+/g, '-')}`,
                        name: def.name,
                        type: 'Explore',
                        songs: songIds,
                        albumCover: '',
                        imageUrl: ''
                    };
                    /* Soft minimum: keep playlist if it has at least 5 songs
                       (prevents empty playlists when pool is small) */
                }).filter(pl => pl.songs.length >= 5);

                return {
                    slot: { id: slotDef.id, label: slotDef.label, hour: slotDef.hour },
                    playlists: seededShuffle(playlists, slotRng)
                };
            });
        };

        /* Initialise on load — override whatever explore.js set */
        window.dailyPlaylistGroups = window.buildDailyPlaylists();

        function getNextSlotTime(slotHour) {
            const now = new Date();
            const next = new Date(now);
            next.setHours(slotHour, 0, 0, 0);
            if (next <= now) next.setDate(next.getDate() + 1);
            return next;
        }

        function getActiveSlotIndex() {
            const h = new Date().getHours();
            if (h >= 0 && h < 6) return 3;
            if (h >= 6 && h < 12) return 0;
            if (h >= 12 && h < 18) return 1;
            return 2;
        }

        function formatCountdown(ms) {
            if (ms <= 0) return '00:00:00';
            const totalSec = Math.floor(ms / 1000);
            const h = Math.floor(totalSec / 3600);
            const m = Math.floor((totalSec % 3600) / 60);
            const s = totalSec % 60;
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }

        /* Build a 2×2 collage from up to 4 album cover URLs */
        function buildCollageHTML(coverUrls) {
            const filled = [...coverUrls];
            while (filled.length < 4) filled.push(filled[filled.length - 1] || '');
            const imgs = filled.slice(0, 4).map(u => {
                let src = u || '';
                if (src.includes('cloudinary')) src = src.replace('/upload/', '/upload/f_auto,q_auto,w_300/');
                return `<img src="${src}" alt="" loading="lazy" style="width:50%;height:50%;object-fit:cover;display:block;flex-shrink:0;">`;
            }).join('');
            return `<div style="display:flex;flex-wrap:wrap;width:100%;height:100%;">${imgs}</div>`;
        }

        /* Get up to 4 distinct album cover URLs from a playlist's songs.
           Handles both string IDs (daily playlists) and full song objects
           (user-created playlists where songs are stored as objects). */
        function getPlaylistCovers(playlist) {
            const seen = new Set();
            const covers = [];
            if (!window.allSongsMap) return covers;
            for (const entry of (playlist.songs || [])) {
                let url = '';
                if (typeof entry === 'string') {
                    /* Daily-playlist style: entry is a song ID string */
                    url = window.allSongsMap.get(entry)?.album?.imageUrl || '';
                } else if (entry && typeof entry === 'object') {
                    /* User-playlist style: entry is a full song object */
                    const sid = String(entry.id || '');
                    const canonical = window.allSongsMap.get(sid);
                    url = canonical?.album?.imageUrl
                        || entry._sourceAlbum?.imageUrl
                        || entry.album?.imageUrl
                        || '';
                }
                if (url && url.trim() && !seen.has(url)) {
                    seen.add(url);
                    covers.push(url);
                    if (covers.length === 4) break;
                }
            }
            return covers;
        }

        /* Render a user playlist as a bzp-card — same style as smart playlists.
           Favourites shows its heart cover; others show a 2×2 collage or single image. */
        function renderPlaylistCard(p) {
            const card = document.createElement('div');
            card.className = 'bzp-card';
            card.id = p.isImported ? 'card-' + p.id : '';
            card.setAttribute('data-dp-id', String(p.id || p.name));

            const songCount = (p.songs || []).length;

            /* ── Cover area ── */
            const coverWrap = document.createElement('div');
            coverWrap.className = 'bzp-card-cover';

            if (p._isFavourites) {
                /* Favourites: gradient cover with heart icon — no white-bg emoji image */
                const g = document.createElement('div');
                g.className = 'bzp-card-gradient';
                g.style.cssText = [
                    'background:linear-gradient(135deg,#f43f5e 0%,#be123c 100%)',
                    'width:100%',
                    'height:100%',
                    'display:flex',
                    'align-items:center',
                    'justify-content:center'
                ].join(';');
                g.innerHTML = '<i class="fas fa-heart" style="font-size:3.3rem;color:rgba(255,255,255,0.92);filter:drop-shadow(0 2px 8px rgba(0,0,0,0.35));"></i>';
                coverWrap.appendChild(g);
            } else {
                const covers = getPlaylistCovers(p);
                if (covers.length >= 4) {
                    /* 2×2 collage for playlists with 4+ distinct album covers */
                    const collageDiv = document.createElement('div');
                    collageDiv.style.cssText = 'display:flex;flex-wrap:wrap;width:100%;height:100%;';
                    covers.slice(0, 4).forEach(u => {
                        const ci = document.createElement('img');
                        ci.src = u; ci.alt = '';
                        ci.style.cssText = 'width:50%;height:50%;object-fit:cover;display:block;flex-shrink:0;';
                        ci.loading = 'lazy';
                        collageDiv.appendChild(ci);
                    });
                    coverWrap.appendChild(collageDiv);
                } else if (covers.length > 0) {
                    const img = document.createElement('img');
                    img.src = covers[0]; img.alt = p.name || '';
                    img.loading = 'lazy';
                    img.onerror = () => {
                        img.remove();
                        const g = document.createElement('div');
                        g.className = 'bzp-card-gradient';
                        g.innerHTML = '<i class="fas fa-compact-disc"></i>';
                        coverWrap.insertBefore(g, coverWrap.firstChild);
                    };
                    coverWrap.appendChild(img);
                } else {
                    const g = document.createElement('div');
                    g.className = 'bzp-card-gradient';
                    g.innerHTML = '<i class="fas fa-compact-disc"></i>';
                    coverWrap.appendChild(g);
                }
            }

            /* Play button overlay removed */

            /* ── Info area ── */
            const info = document.createElement('div');
            info.className = 'bzp-card-info';
            info.innerHTML = `
                <div class="bzp-card-name">${p.name || p.title || 'Playlist'}</div>
                <div class="bzp-card-meta">${songCount} song${songCount !== 1 ? 's' : ''}</div>`;

            card.appendChild(coverWrap);
            card.appendChild(info);
            card.addEventListener('click', () => {
                const data = resolveData(p, 'Playlist');
                if (data) selectAlbum(data, false, 'playlists');
            });
            return card;
        }

        function displayPlaylists(isBack = false) {
            /* ── Inject skeletons immediately so the view is never blank ── */
            playlistsContainer.innerHTML = '';
            const _skelFrag = document.createDocumentFragment();

            /* Skeleton: "Your Playlists" section — header + horizontal card row */
            const _skelSec1 = document.createElement('div');
            _skelSec1.className = 'bzp-section dp-section';
            _skelSec1.innerHTML = `
                <div class="bz-sk-section-head">
                    <div class="bz-skel bz-sk-section-head__icon"></div>
                    <div class="bz-sk-section-head__lines">
                        <div class="bz-skel bz-sk-section-head__title"></div>
                        <div class="bz-skel bz-sk-section-head__sub"></div>
                    </div>
                </div>
                <div class="albums-grid bzp-row dp-grid bz-sk-grid" style="overflow-x:auto;">
                    ${Array.from({ length: 5 }, (_, i) => `
                    <div class="bz-sk-card">
                        <div class="bz-skel bz-sk-card__img"></div>
                        <div class="bz-skel bz-sk-card__title"></div>
                        <div class="bz-skel bz-sk-card__sub"></div>
                    </div>`).join('')}
                </div>`;
            _skelFrag.appendChild(_skelSec1);

            /* Skeleton: smart playlists section below */
            const _skelSec2 = document.createElement('div');
            _skelSec2.className = 'bzp-section';
            _skelSec2.style.marginTop = '24px';
            _skelSec2.innerHTML = `
                <div class="bz-sk-section-head">
                    <div class="bz-skel bz-sk-section-head__icon"></div>
                    <div class="bz-sk-section-head__lines">
                        <div class="bz-skel bz-sk-section-head__title"></div>
                        <div class="bz-skel bz-sk-section-head__sub"></div>
                    </div>
                </div>
                <div class="albums-grid bzp-row bz-sk-grid" style="overflow-x:auto;">
                    ${Array.from({ length: 5 }, (_, i) => `
                    <div class="bz-sk-card">
                        <div class="bz-skel bz-sk-card__img"></div>
                        <div class="bz-skel bz-sk-card__title"></div>
                        <div class="bz-skel bz-sk-card__sub"></div>
                    </div>`).join('')}
                </div>`;
            _skelFrag.appendChild(_skelSec2);

            playlistsContainer.appendChild(_skelFrag);
            navigateToView('playlists', playlistsContainer, isBack);

            /* Yield to browser paint, then swap in real content */
            requestAnimationFrame(() => {
                playlistsContainer.innerHTML = '';

                /* ── Section heading: "Your Playlists" — matches bzp-section-head style ── */
                const sec = document.createElement('div');
                sec.className = 'bzp-section dp-section bz-sk-replaced';
                const header = document.createElement('div');
                header.className = 'bzp-section-head';
                header.innerHTML = `
                <div class="bzp-section-title-row">
                    <span class="bzp-section-icon dp-icon-playlist"><i class="fas fa-compact-disc"></i></span>
                    <div>
                        <div class="bzp-section-title">Your Playlists</div>
                        <div class="bzp-section-sub">Your saved &amp; created playlists</div>
                    </div>
                </div>`;
                sec.appendChild(header);

                /* ── Horizontal scroll grid of bzp-cards ── */
                const grid = document.createElement('div');
                grid.className = 'albums-grid bzp-row dp-grid';

                let count = 0;
                window.masterPool.forEach(p => {
                    if (p.type === 'Playlist') {
                        count++;
                        grid.appendChild(renderPlaylistCard(p));
                    }
                });

                /* ── 5-step guide: only shown when user has no playlists yet ── */
                if (count === 0) {
                    const howTo = document.createElement('div');
                    howTo.style.cssText = [
                        'background:linear-gradient(135deg,rgba(124,58,237,0.14) 0%,rgba(99,102,241,0.10) 50%,rgba(167,139,250,0.07) 100%)',
                        'border:1.5px solid rgba(167,139,250,0.32)',
                        'border-radius:20px',
                        'padding:22px 24px 22px',
                        'margin:4px 16px 16px',
                        'max-width:700px',
                        'box-shadow:0 8px 32px rgba(99,102,241,0.15),0 1px 0 rgba(255,255,255,0.06) inset'
                    ].join(';');

                    const _htSteps = [
                        { color: '#a78bfa', label: 'Open any song', sub: 'from Home or Search' },
                        { color: '#818cf8', label: 'Tap ⊕ Add to Playlist', sub: 'icon on the song card' },
                        { color: '#6366f1', label: 'Choose "Create new playlist"', sub: 'enter a name and confirm' },
                        { color: '#8b5cf6', label: 'Keep adding songs', sub: 'they all stack into the same playlist' },
                        { color: '#7c3aed', label: 'Tap any playlist card', sub: 'to view, reorder, or start playing' },
                    ];

                    const _htRows = _htSteps.map((s, i) =>
                        '<div style="display:flex;align-items:center;gap:14px;padding:11px 14px;border-radius:13px;'
                        + 'background:linear-gradient(90deg,' + s.color + '18,' + s.color + '08);'
                        + 'border:1px solid ' + s.color + '30;'
                        + 'border-left:3px solid ' + s.color + ';">'
                        + '<span style="width:30px;height:30px;border-radius:50%;'
                        + 'background:linear-gradient(135deg,' + s.color + 'ee,' + s.color + '88);'
                        + 'box-shadow:0 2px 10px ' + s.color + '55;'
                        + 'display:flex;align-items:center;justify-content:center;flex-shrink:0;'
                        + 'font-size:0.75rem;font-weight:900;color:#fff;letter-spacing:-0.3px;">' + (i + 1) + '</span>'
                        + '<div style="flex:1;min-width:0;">'
                        + '<span style="font-size:0.86rem;font-weight:700;color:#ede9fe;">' + s.label + '</span>'
                        + '<span style="font-size:0.74rem;color:rgba(255,255,255,0.40);margin-left:7px;">' + s.sub + '</span>'
                        + '</div></div>'
                    ).join('');

                    howTo.innerHTML =
                        '<div style="margin-bottom:16px;">'
                        + '<div style="font-size:1.0rem;font-weight:800;color:#ede9fe;letter-spacing:0.01em;">How to create a playlist</div>'
                        + '</div>'
                        + '<div style="display:flex;flex-direction:column;gap:8px;">' + _htRows + '</div>'
                        + '<div style="font-size:0.72rem;color:rgba(167,139,250,0.55);margin-top:14px;padding-top:12px;'
                        + 'border-top:1px solid rgba(167,139,250,0.16);display:flex;align-items:center;gap:7px;">'
                        + '<i class="fas fa-cloud" style="font-size:0.7rem;color:#8b5cf6;"></i>'
                        + 'Playlists save automatically and stay available across every session</div>';
                    sec.appendChild(howTo);
                }

                sec.appendChild(grid);
                playlistsContainer.appendChild(sec);



                /* ── Smart Playlists (formerly Explore) — rendered by playlists.js ── */
                if (typeof window._bzPlaylistsRender === 'function') {
                    const smartWrap = document.createElement('div');
                    smartWrap.id = 'bz-smart-playlists-wrap';
                    smartWrap.className = 'bz-sk-replaced';
                    playlistsContainer.appendChild(smartWrap);
                    window._bzPlaylistsRender(smartWrap);
                }

                // FIX: same race as displayHome — navigateToView() above restored
                // scroll while the view was still just skeletons (too short to reach
                // the saved position, so the browser clamped it to ~0). Now that all
                // real sections are in and the page has its full height, re-apply
                // the saved position once more.
                {
                    const _savedPlaylistsScroll = parseInt(
                        window.scrollPositions['playlists'] ?? localStorage.getItem('beatZen_scroll_playlists') ?? 0,
                        10
                    ) || 0;
                    if (_savedPlaylistsScroll > 0) {
                        requestAnimationFrame(() => {
                            window.scrollTo({ top: _savedPlaylistsScroll, behavior: 'instant' });
                        });
                    }
                }

            }); // end rAF
        }

        /* Renders a Recap year card using the dp-card collage style.
           albumCover is already an SVG data-URI year badge from buildRecapData(). */
        function renderRecapCard(item) {
            const card = document.createElement('div');
            card.className = 'dp-card dp-card-recap';
            card.setAttribute('data-dp-id', item.id || item.name);

            const coverSrc = item.albumCover || '';
            card.innerHTML = `
            <div class="dp-card-inner">
                <div class="dp-card-collage dp-card-year-cover">
                    <img src="${coverSrc}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:0;">
                </div>
                <img class="dp-card-logo" src="${BEAT_ZEN_LOGO}" alt="Beat Zen">
                <div class="dp-card-body dp-recap-body">
                    <div class="dp-card-name">${item.name || ''}</div>
                    <div class="dp-card-count">${(item.songs || []).length} songs</div>
                </div>
            </div>`;
            card.addEventListener('click', () => {
                const data = resolveData(item, 'Explore');
                if (data) selectAlbum(data, false, 'playlists');
            });
            return card;
        }

        function renderDailyPlaylistCard(playlist) {
            const card = document.createElement('div');
            card.className = 'dp-card';
            card.setAttribute('data-dp-id', playlist.id);

            const covers = getPlaylistCovers(playlist);
            const collage = buildCollageHTML(covers);

            card.innerHTML = `
            <div class="dp-card-inner">
                <div class="dp-card-collage">${collage}</div>
                <img class="dp-card-logo" src="${BEAT_ZEN_LOGO}" alt="Beat Zen">
                <div class="dp-card-body">
                    <div class="dp-card-name">${_bzEscapeHTML(playlist.name)}</div>
                    <div class="dp-card-count">${playlist.songs.length} songs</div>
                </div>
            </div>`;

            card.addEventListener('click', () => {
                const data = resolveData(playlist, 'Explore');
                if (data) selectAlbum(data, false, 'playlists');
            });
            return card;
        }

        const _dpIntervals = {};

        function appendDailySlotSection(container, group, isActive, slotIdx) {
            const { slot, playlists } = group;
            const nextSlotIdx = (slotIdx + 1) % 4;
            const nextSlotHour = dailyPlaylistSlots[nextSlotIdx].hour;
            const nextSlotLabel = dailyPlaylistSlots[nextSlotIdx].label;
            const nextTime = getNextSlotTime(nextSlotHour);
            const timerId = `dp-timer-${slot.id}`;

            /* Icon map — circle badge spans matching explore heading style */
            const slotIcons = {
                'daily-morning': '<span class="dp-icon-badge dp-icon-morning"><i class="fas fa-sun"></i></span>',
                'daily-afternoon': '<span class="dp-icon-badge dp-icon-afternoon"><i class="fas fa-cloud-sun"></i></span>',
                'daily-evening': '<span class="dp-icon-badge dp-icon-evening"><i class="fas fa-cloud-moon"></i></span>',
                'daily-midnight': '<span class="dp-icon-badge dp-icon-midnight"><i class="fas fa-moon"></i></span>'
            };
            const nextSlotId = dailyPlaylistSlots[nextSlotIdx].id;
            const currentIcon = slotIcons[slot.id] || '<span class="dp-icon-badge dp-icon-default"><i class="fas fa-music"></i></span>';
            const nextIcon = slotIcons[nextSlotId] || '<span class="dp-icon-badge dp-icon-default"><i class="fas fa-music"></i></span>';

            /* Next slot time label e.g. "18:00" */
            const nextHourPadded = String(nextSlotHour).padStart(2, '0');
            const nextTimeLabel = `${nextHourPadded}:00`;

            const sec = document.createElement('div');
            sec.className = 'year-section dp-section';
            sec.id = `bz-dp-section-${slot.id}`;

            if (isActive) {
                /* ── ACTIVE SLOT: heading + inline countdown + active dot ── */
                const header = document.createElement('div');
                header.className = 'dp-header';
                header.innerHTML = `
                <h2>${currentIcon}${slot.label} <span class="dp-active-dot"></span></h2>
                <div class="dp-countdown-wrap">
                    <span class="dp-countdown-label">Next in</span>
                    <span class="dp-countdown-timer" id="${timerId}">--:--:--</span>
                </div>`;
                sec.appendChild(header);

            } else {
                /* ── INACTIVE SLOT: compact heading + small countdown pill ── */
                const header = document.createElement('div');
                header.className = 'dp-header';
                header.innerHTML = `
                <h2>${currentIcon}${slot.label}</h2>
                <div class="dp-countdown-wrap">
                    <span class="dp-countdown-label">Next in</span>
                    <span class="dp-countdown-timer" id="${timerId}">--:--:--</span>
                </div>`;
                sec.appendChild(header);
            }

            /* Horizontal scroll row */
            const grid = document.createElement('div');
            grid.className = 'albums-grid dp-grid';
            playlists.forEach(pl => grid.appendChild(renderDailyPlaylistCard(pl)));
            sec.appendChild(grid);
            container.appendChild(sec);

            /* Countdown tick */
            if (_dpIntervals[slot.id]) clearInterval(_dpIntervals[slot.id]);
            function tick() {
                const el = document.getElementById(timerId);
                if (!el) { clearInterval(_dpIntervals[slot.id]); return; }
                const remaining = nextTime - Date.now();
                el.textContent = formatCountdown(Math.max(0, remaining));
                if (remaining <= 0) {
                    clearInterval(_dpIntervals[slot.id]);
                    /* Always use the override version so we get full playlists */
                    window.dailyPlaylistGroups = window.buildDailyPlaylists();
                    displayexplore();
                }
            }
            tick();
            _dpIntervals[slot.id] = setInterval(tick, 1000);
        }

        /* appendDailyPlaylistsSection removed — handled by new playlists.js engine */

        /* displayexplore is now an alias for displayPlaylists — smart playlist content lives in the Playlists tab */
        function displayexplore(isBack = false) { displayPlaylists(isBack); }

        /* ── DAILY AUTO-REFRESH at midnight ── */
        (function scheduleDailyRefresh() {
            function msUntilMidnight() {
                const now = new Date(), midnight = new Date(now);
                midnight.setHours(24, 0, 0, 0);
                return midnight - now;
            }
            function triggerDailyRebuild() {
                if (window.lastActiveView === 'playlists') displayPlaylists(true);
                setTimeout(triggerDailyRebuild, msUntilMidnight());
            }
            setTimeout(triggerDailyRebuild, msUntilMidnight());
        })();

        /* ─── ARTISTS VIEW ─────────────────────────────────────────── */
        function displayArtists(isBack = false) {
            if (!artistsContainer) return;
            navigateToView('artists', artistsContainer, isBack);
            artistsContainer.style.display = 'block';

            /* Skip re-render if already built */
            if (artistsContainer.dataset.builtFor === 'v1') return;
            artistsContainer.dataset.builtFor = 'v1';
            artistsContainer.innerHTML = '';

            const data = (typeof customArtistsData !== 'undefined') ? customArtistsData : {};
            const allSongs = window.allSongsMap ? [...window.allSongsMap.values()] : [];

            Object.entries(data).forEach(([groupName, artists]) => {
                /* Section wrapper */
                const section = document.createElement('div');
                section.className = 'bz-artists-section';

                /* Section heading */
                const heading = document.createElement('div');
                heading.className = 'bz-artists-heading';
                heading.innerHTML = `<i class="fas fa-microphone-alt"></i><span>${groupName}</span>`;
                section.appendChild(heading);

                /* Horizontal scroll row */
                const row = document.createElement('div');
                row.className = 'bz-artists-row';

                artists.forEach(artist => {
                    /* Count songs for this artist */
                    const songCount = allSongs.filter(s =>
                        s.artist && s.artist.toLowerCase().includes(artist.name.toLowerCase())
                    ).length;

                    const card = document.createElement('div');
                    card.className = 'bz-artist-card';
                    card.setAttribute('data-artist-id', artist.id);

                    const imgHtml = artist.imageUrl
                        ? `<img src="${artist.imageUrl}" alt="${artist.name}" loading="lazy" class="bz-artist-img">`
                        : `<div class="bz-artist-img bz-artist-img-placeholder"><i class="fas fa-microphone-alt"></i></div>`;

                    card.innerHTML = `
                        <div class="bz-artist-img-wrap">${imgHtml}</div>
                        <div class="bz-artist-name">${artist.name}</div>
                        <div class="bz-artist-count">${songCount ? songCount + ' song' + (songCount !== 1 ? 's' : '') : 'Artist'}</div>`;

                    /* Click → filter songs by artist via search */
                    card.addEventListener('click', () => {
                        document.getElementById('search-link')?.click();
                        setTimeout(() => {
                            const bar = document.getElementById('search-bar');
                            if (bar) {
                                bar.value = artist.name;
                                bar.dispatchEvent(new Event('input', { bubbles: true }));
                            }
                        }, 100);
                    });

                    row.appendChild(card);
                });

                section.appendChild(row);
                artistsContainer.appendChild(section);
            });

            if (!Object.keys(data).length) {
                artistsContainer.innerHTML = `<div class="bz-artists-empty"><i class="fas fa-microphone-slash"></i><p>No artists found.</p></div>`;
            }
        }
        /* Expose so notification action can call it */
        window.bzDisplayArtists = displayArtists;

        function displaySettings(isBack = false) {
            navigateToView('settings', settingsContainer, isBack);
            if (settingsContainer) settingsContainer.style.display = 'block';
            // Refresh auth UI in case Firebase resolved while settings was hidden.
            // FIX: bzRefreshAuthUI is now auth-ready-aware (see auth.js) so it
            // defers automatically when bzIsAuthenticated is not yet set + a
            // cached session exists — preventing showSignedOut() from firing and
            // flashing the full-screen gate for a signed-in user during Firebase's
            // ~100-300ms init window. The setTimeout(80) is kept so the settings
            // DOM is fully visible before any UI updates run.
            setTimeout(() => { if (typeof window.bzRefreshAuthUI === 'function') window.bzRefreshAuthUI(); }, 80);
        }

        function displayUpdates(isBack = false) {
            navigateToView('updates', updatesContainer, isBack);
            if (updatesContainer) updatesContainer.style.display = 'block';
            /* Always render directly — don't rely on bzNotifRefresh being ready */
            renderList();
            updateBadge();
            applyNewLabels();
            if (typeof markAllSeen === 'function') markAllSeen();
        }

        function displayAbout(isBack = false) { displaySettings(isBack); }
        function displayContact(isBack = false) {
            displaySettings(isBack);
            const cf = document.getElementById('contact-form');
            if (cf) setTimeout(() => cf.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
        }


        window.displayHome = displayHome;
        window.displayPlaylists = displayPlaylists;
        window.displayexplore = displayexplore;
        window.displaySettings = displaySettings;
        window.displayAbout = displayAbout;
        window.displayContact = displayContact;
        window.displayUpdates = displayUpdates;

        /* ── FIX B1: renderExplore — live-refresh Playlists tab ────────────────
           Was referenced in initSettings() (history toggle + clear-history handler)
           but never defined, so history on/off toggling required a tab navigation
           to take effect.  This wrapper re-renders the Playlists view immediately
           when the user changes the Play History toggle or clears history —
           making the Listen Again section appear/disappear without any refresh.
        ─────────────────────────────────────────────────────────────────────── */
        window.renderExplore = function () {
            /* Only re-render if the Playlists tab is currently visible.
               Calling displayPlaylists() while on another tab would wrongly
               navigate away from the user's current view. */
            if (window.lastActiveView === 'playlists' &&
                typeof displayPlaylists === 'function') {
                displayPlaylists(true);
            }
        };

        /* ALBUM DETAIL VIEW */
        function selectAlbum(album, isBack = false, navOverride = null, highlightPlaying = false) {
            if (!album || !album.id) return;

            /* Save scroll position of the current view before leaving */
            const callerView = window.lastActiveView || 'home';
            // FIX Issue 5: window.scrollY is stale at selectAlbum() call time — the
            // browser hasn't processed the layout shift yet, so it still reflects the
            // PREVIOUS album's scroll position. window.scrollPositions[callerView] is
            // updated continuously by the scroll listener and is always accurate.
            const callerScrollY = window.scrollPositions[callerView]
                || parseInt(localStorage.getItem('beatZen_scroll_' + callerView) || '0', 10);
            // Keep scrollPositions in sync (in case listener missed the very last tick)
            window.scrollPositions[callerView] = callerScrollY;
            localStorage.setItem('beatZen_scroll_' + callerView, callerScrollY);

            /* If opening from a non-home tab (explore, playlists, etc.) and this
               is a fresh navigation (not a back/forward restore), push a #home
               history entry first so pressing Back lands the user on Home —
               not on Explore or Playlists — and restores the correct scroll. */
            if (!isBack && callerView !== 'home' && callerView !== 'album') {
                /* Return to the actual caller view (explore, playlists, etc.) — not always home.
                   Use replaceState (not pushState) so we update the existing #playlists entry
                   with the scroll position rather than duplicating it. This prevents the
                   "3 clicks to go back" bug caused by a phantom extra history entry. */
                const callerScroll = window.scrollPositions[callerView]
                    || parseInt(localStorage.getItem('beatZen_scroll_' + callerView) || '0');
                localStorage.setItem('beatZen_activeView', callerView);
                history.replaceState({ view: callerView, scrollY: callerScroll }, '', `#${callerView}`);
            }

            window.currentAlbum = album;
            hideAllViews();
            albumViewContainer.style.display = 'flex';
            delete albumViewContainer.dataset.bzScrollReady;
            window.scrollTo({ top: 0, behavior: 'instant' });
            const isPlaying = window.playingAlbum?.id === album.id && !audioPlayer.paused;
            const isUserPlaylist = String(album.id).startsWith('user-') || String(album.id).startsWith('imported-');
            albumMainContent.innerHTML = `
        <div class="bz-album-nav-bar">
            <button class="bz-back-btn" id="bz-album-back-btn" aria-label="Go back">
                <i class="fas fa-arrow-left"></i><span class="bz-back-label">Back</span>
            </button>
            <button class="bz-album-nav-dots" id="bz-album-nav-dots-btn" aria-label="More options">
                <i class="fas fa-ellipsis-v"></i>
            </button>
        </div>
        <div class="album-info-section">
            <div class="album-details-img-wrapper">${(album.imageUrl || album.albumCover)
                    ? `<img src="${album.imageUrl || album.albumCover}" class="album-details-img${album._isFavourites ? ' bz-fav-album-img' : ''}" style="${album._isFavourites ? 'object-fit:cover;border-radius:18px;' : ''}">`
                    : `<div class="album-details-img bzp-card-gradient" style="background:linear-gradient(135deg,${(album.color || '#6d28d9')}cc,${(album.color || '#6d28d9')}44);display:flex;align-items:center;justify-content:center;border-radius:18px;"><i class="fas ${album.icon || 'fa-music'}" style="font-size:3.5rem;color:#fff;opacity:0.9;"></i></div>`
                }</div>
            <div class="album-text-info">
                <h2>${album.title}</h2>
                <div class="internal-details">${album.detailsHtml}</div>
                ${album.desc ? `<div class="album-playlist-desc">${album.desc}</div>` : ''}
                <div class="action-bar">
                    <button class="action-btn primary play-album-btn"><i class="fas ${isPlaying ? 'fa-pause' : 'fa-play'}"></i> <span>${isPlaying ? 'Pause' : 'Play'}</span></button>
                    <button class="action-btn secondary share-album-btn" title="Share"><i class="fas fa-share-alt"></i> <span>Share</span></button>
                    ${isUserPlaylist ? `<button class="action-btn secondary delete-playlist-btn" title="Delete Playlist"><i class="fas fa-trash-alt"></i> <span>Delete</span></button>` : ""}
                </div>
            </div>
        </div>
        <div class="songs-list"></div>`;
            const list = albumMainContent.querySelector('.songs-list');

            // ── Show skeleton rows while song data populates ───────────────
            function _buildSongSkeleton() {
                const sk = document.createElement('div');
                sk.className = 'bz-song-skeleton';
                sk.innerHTML = `
                    <div class="bz-skel bz-skel-thumb"></div>
                    <div class="bz-skel-lines">
                        <div class="bz-skel bz-skel-title"></div>
                        <div class="bz-skel bz-skel-artist"></div>
                    </div>`;
                return sk;
            }
            // Always inject 6 skeletons.
            // The old Math.min(album.songs.length || 6, 8) short-circuited to 6 when
            // songs was empty (0 || 6 = 6), but the very next requestAnimationFrame
            // removed them and rendered 0 rows — skeletons lived for < 1 paint frame
            // and were never visible.  A fixed count of 6 is the right default for
            // every album; the deferred render below handles the actual song count.
            const skelCount = 6;
            for (let _s = 0; _s < skelCount; _s++) list.appendChild(_buildSongSkeleton());

            // Defer real render by one frame so skeletons paint first
            requestAnimationFrame(() => {
                list.querySelectorAll('.bz-song-skeleton').forEach(el => el.remove());

                // ── Empty-state: Repeat Rewind with no songs ──────────────────
                // When the album has 0 songs and is the special Repeat Rewind
                // virtual album, show a descriptive message instead of blank.
                // All other empty albums (user playlists, etc.) fall through to
                // the forEach below which simply renders nothing — that behaviour
                // is intentional and unchanged.
                if (!album.songs.length && String(album.id) === 'bz-repeat-rewind') {
                    const emptyEl = document.createElement('div');
                    emptyEl.className = 'bz-empty';
                    emptyEl.style.display = 'flex';
                    emptyEl.innerHTML = `
                        <i class="fas fa-rotate-left"></i>
                        <p>No songs in Repeat Rewind yet</p>
                        <p style="font-size:0.82rem;font-weight:500;opacity:0.65;margin-top:-4px;
                                   background:none;color:var(--bz-text-dim);">
                            Songs you replayed upto 3+ times will appear here.
                        </p>`;
                    list.appendChild(emptyEl);
                    // Nothing to scroll-restore for an empty album — mark ready
                    // immediately so the boot loader doesn't wait out its timeout.
                    albumViewContainer.dataset.bzScrollReady = '1';
                    return; // nothing else to render
                }

                album.songs.forEach((song, i) => {
                    const item = document.createElement('div');
                    item.className = 'song-item';
                    item.dataset.songId = String(song.id);
                    // Use _sourceAlbum (attached by resolveData) for cover art —
                    // this ensures artist/playlist thumbnails show the original movie poster.
                    const sourceAlbum = song._sourceAlbum || window.allSongsMap.get(String(song.id))?.album;
                    const prefix = sourceAlbum && (sourceAlbum.imageUrl || sourceAlbum.albumCover) ? `<img src="${sourceAlbum.imageUrl || sourceAlbum.albumCover}" class="playlist-song-cover">` : `<span class="song-num">${i + 1}</span>`;
                    item.innerHTML = `
                    <div class="bz-swipe-hint"><i class="fas fa-list-ul"></i> Add to Queue</div>
                    <div class="song-item-inner">
                        <div class="song-details">
                            <div class="song-number-wrapper">${prefix}</div>
                            <div class="song-text-details">
                                <span class="song-item-title">${song.title}</span>
                                <span class="song-item-artist">${song.artist}</span>
                            </div>
                        </div>
                        <div class="song-item-right">
                            <span class="song-item-duration">${song.duration}</span>
                            <button class="song-menu-btn" aria-label="Song Options"><i class="fas fa-ellipsis-v"></i></button>
                        </div>
                    </div>`;
                    item.onclick = () => {
                        window._highlightActive = true;
                        window.playingAlbum = window.currentAlbum;
                        window.playSong(i);
                        requestAnimationFrame(() => updateActiveSongHighlight());
                    };
                    item.querySelector('.song-menu-btn').onclick = (e) => { e.stopPropagation(); window.openSongMenu(song, e); };

                    // ── Swipe-right → Add to Queue ───────────────────────────
                    (function attachSwipe(el, songRef) {
                        const inner = el.querySelector('.song-item-inner');
                        if (!inner) return;
                        let startX = 0, startY = 0, dx = 0, active = false;
                        const THRESHOLD = 65;

                        el.addEventListener('touchstart', (e) => {
                            startX = e.touches[0].clientX;
                            startY = e.touches[0].clientY;
                            dx = 0; active = true;
                        }, { passive: true });

                        el.addEventListener('touchmove', (e) => {
                            if (!active) return;
                            dx = e.touches[0].clientX - startX;
                            const dy = Math.abs(e.touches[0].clientY - startY);
                            // Cancel if more vertical than horizontal
                            if (dy > Math.abs(dx) * 1.2) { active = false; inner.style.transform = ''; el.classList.remove('bz-swiping'); return; }
                            if (dx > 0) {
                                e.preventDefault();
                                const clamped = Math.min(dx, THRESHOLD * 1.4);
                                inner.style.transform = `translateX(${clamped}px)`;
                                el.classList.toggle('bz-swiping', clamped > 16);
                            }
                        }, { passive: false });

                        el.addEventListener('touchend', (e) => {
                            if (!active) return;
                            active = false;
                            el.classList.remove('bz-swiping');
                            inner.style.transition = 'transform 0.22s cubic-bezier(.22,.68,0,1.2)';
                            inner.style.transform = '';
                            setTimeout(() => { inner.style.transition = ''; }, 240);

                            // FIX: if a real horizontal swipe happened, stop propagation
                            // so the swipe engine doesn't also trigger a song play.
                            // For short/no-movement taps (dx≈0), let the click through.
                            if (dx >= THRESHOLD) {
                                e.stopPropagation();
                                // Add to "Up Next" queue
                                if (window.playingAlbum?.songs) {
                                    const insertAt = (window.currentSongIndex ?? -1) + 1;
                                    const songs = window.playingAlbum.songs;
                                    const alreadyNext = songs[insertAt] && String(songs[insertAt].id) === String(songRef.id);
                                    if (!alreadyNext) {
                                        songs.splice(insertAt, 0, songRef);
                                        if (typeof window.rebuildMasterMap === 'function') window.rebuildMasterMap();
                                        if (typeof window.renderFullscreenQueue === 'function') window.renderFullscreenQueue();
                                    }
                                    if (typeof showToast === 'function') showToast(`"${songRef.title}" will play next`);
                                } else {
                                    if (typeof showToast === 'function') showToast('Start playing a song first to use the queue');
                                }
                            }
                        });
                    })(item, song);

                    list.appendChild(item);
                });
                // Song items are now in the DOM — safe to highlight the active one
                if (_shouldHighlight) {
                    updateActiveSongHighlight();
                    // Scroll the currently-playing song row into view so the user
                    // doesn't have to hunt for it in long albums/playlists.
                    requestAnimationFrame(() => {
                        const activeRow = list.querySelector('.song-item.active');
                        if (activeRow) {
                            activeRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                        albumViewContainer.dataset.bzScrollReady = '1';
                    });
                } else {
                    // FIX: restore the saved scroll position for this album now that
                    // the real song rows have replaced the skeletons and the page has
                    // its full height. Doing this any earlier (e.g. right after
                    // setting albumViewContainer.style.display) gets clamped to ~0 by
                    // the browser because the skeleton-only list is too short to
                    // scroll — the same race that affected Home/Playlists.
                    const _savedAlbumScroll = window._bzGetAlbumScroll(album.id);
                    if (_savedAlbumScroll > 0) {
                        requestAnimationFrame(() => {
                            window.scrollTo({ top: _savedAlbumScroll, behavior: 'instant' });
                            albumViewContainer.dataset.bzScrollReady = '1';
                        });
                    } else {
                        albumViewContainer.dataset.bzScrollReady = '1';
                    }
                }
            }); // end requestAnimationFrame
            albumMainContent.querySelector('.play-album-btn').onclick = () => {
                // If this album is already playing, just toggle play/pause
                if (window.playingAlbum?.id === album.id) {
                    window.togglePlayback();
                } else {
                    // First time opening — load and play from song 0
                    window.playingAlbum = album;
                    window.playSong(0);
                }
            };
            albumMainContent.querySelector('.delete-playlist-btn')?.addEventListener('click', () => window.handleDeletePlaylist(album.id));
            /* ── Back button ── */
            albumMainContent.querySelector('#bz-album-back-btn')?.addEventListener('click', () => {
                // history.back() works when the user navigated here within the SPA.
                // On a cold refresh / deep-link the history stack has only one entry,
                // so back() is a no-op. Detect this and fall back to the caller view.
                // FIX Bug 3: window.history.length includes ALL browser history (Google,
                // YouTube, etc.) and is almost always > 1 even on a cold refresh, which
                // caused history.back() to navigate away from the site entirely.
                // Use the internal SPA navigation depth counter instead.
                if (window._bzSpaNavDepth > 0) {
                    history.back();
                } else {
                    // Cold refresh: go back to whatever tab opened this album,
                    // or fall back to Home if we have no caller info.
                    const navFrom = history.state?.navFrom || 'home';
                    if (navFrom === 'playlists' && typeof displayPlaylists === 'function') displayPlaylists(true);
                    else if (typeof displayHome === 'function') displayHome(true);
                }
            });
            /* ── Album nav three-dot dropdown ── */
            (function wireAlbumNavDots() {
                const dotsBtn = albumMainContent.querySelector('#bz-album-nav-dots-btn');
                if (!dotsBtn) return;

                // Inject dropdown styles once
                if (!document.getElementById('bz-album-dots-style')) {
                    const st = document.createElement('style');
                    st.id = 'bz-album-dots-style';
                    st.textContent = `
                        .bz-album-dots-menu {
                            position: fixed;
                            background: rgba(22,22,38,0.97);
                            backdrop-filter: blur(16px);
                            -webkit-backdrop-filter: blur(16px);
                            border: 1px solid rgba(255,255,255,0.11);
                            border-radius: 13px;
                            box-shadow: 0 10px 40px rgba(0,0,0,0.55);
                            z-index: 99999;
                            min-width: 200px;
                            overflow: hidden;
                            animation: bzDotMenuIn 0.15s cubic-bezier(0.2,0.8,0.4,1) both;
                        }
                        @keyframes bzDotMenuIn {
                            from { opacity:0; transform:scale(0.94) translateY(-6px); }
                            to   { opacity:1; transform:scale(1) translateY(0); }
                        }
                        .bz-album-dots-item {
                            display: flex;
                            align-items: center;
                            gap: 10px;
                            width: 100%;
                            padding: 13px 16px;
                            border: none;
                            background: none;
                            color: #fff;
                            font-size: 0.84rem;
                            font-weight: 500;
                            font-family: inherit;
                            cursor: pointer;
                            text-align: left;
                            transition: background 0.14s;
                            white-space: nowrap;
                        }
                        .bz-album-dots-item:hover { background: rgba(255,255,255,0.08); }
                        .bz-album-dots-item:active { background: rgba(255,255,255,0.13); }
                        .bz-album-dots-item i { width: 16px; text-align: center; opacity: 0.8; }
                    `;
                    document.head.appendChild(st);
                }

                function closeDotsMenu() {
                    document.getElementById('bz-album-dots-dropdown')?.remove();
                    document.removeEventListener('click', closeDotsMenu, true);
                }

                dotsBtn.addEventListener('click', (e) => {
                    e.stopPropagation();

                    // Toggle — close if already open
                    if (document.getElementById('bz-album-dots-dropdown')) { closeDotsMenu(); return; }

                    const dropdown = document.createElement('div');
                    dropdown.id = 'bz-album-dots-dropdown';
                    dropdown.className = 'bz-album-dots-menu';

                    // Already saved as a user playlist?
                    const alreadySaved = (() => {
                        try {
                            const saved = JSON.parse(localStorage.getItem('beatZen_importedPlaylists') || '[]');
                            return saved.some(pl => pl._sourceAlbumId === String(album.id));
                        } catch (_) { return false; }
                    })();

                    // "Share Album" removed — only Save as Playlist remains
                    dropdown.innerHTML = `
                        <button class="bz-album-dots-item" id="bz-adots-save">
                            <i class="fas fa-plus-circle"></i> Save as Playlist
                        </button>`;

                    // Position below the dots button using its current viewport rect
                    const rect = dotsBtn.getBoundingClientRect();
                    dropdown.style.top = (rect.bottom + 6) + 'px';
                    dropdown.style.right = (window.innerWidth - rect.right) + 'px';
                    document.body.appendChild(dropdown);

                    // FIX: Close the dropdown whenever the page scrolls so the menu
                    // never appears to "float" or "stick" at the wrong position.
                    const _scrollClose = () => closeDotsMenu();
                    window.addEventListener('scroll', _scrollClose, { passive: true, once: true });

                    // Close on outside click
                    setTimeout(() => document.addEventListener('click', closeDotsMenu, true), 10);

                    // ── Save as Playlist ──
                    dropdown.querySelector('#bz-adots-save').addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        closeDotsMenu();
                        window.bzInput('playlist', 'Save as Playlist', album.title || 'My Playlist', (name) => {
                            if (!name) return;
                            // Check for duplicate name
                            const existing = JSON.parse(localStorage.getItem('beatZen_importedPlaylists') || '[]');
                            if (existing.some(pl => pl.name.toLowerCase() === name.toLowerCase())) {
                                window.bzAlert('warning', 'Already Exists', `A playlist named "${name}" already exists. Choose a different name.`);
                                return;
                            }
                            const pl = {
                                id: 'user-' + Date.now(),
                                name,
                                title: name,
                                albumCover: album.imageUrl || album.albumCover || 'https://res.cloudinary.com/beatzenapp/image/upload/v1782654641/Logo_kmpfjf.jpg',
                                songs: (album.songs || []).map(s => ({ ...s })),
                                type: 'Playlist',
                                isImported: true,
                                createdAt: Date.now(),
                                _sourceAlbumId: String(album.id)
                            };
                            window.masterPool.push(pl);
                            if (typeof window.rebuildMasterMap === 'function') window.rebuildMasterMap();
                            if (typeof window.syncPlaylistData === 'function') window.syncPlaylistData();
                            showToast(`✓ "${name}" saved to your Playlists`);
                        });
                    });
                });
            })();
            if (!isBack) { window._bzSpaNavDepth++; history.pushState({ view: 'album', albumId: album.id, navFrom: navOverride || callerView || 'home', scrollY: callerScrollY }, album.title, `#album-${album.id}`); }
            /* When user intentionally opens an album, clear the nav-level persisted view
               so a refresh from inside the album falls back to home. */
            localStorage.removeItem('beatZen_activeView');
            updateNav(navOverride || 'home');
            /* Highlight the active song whenever the caller explicitly requests it
               (e.g. "Go to Album" / song row click) OR when the album being opened
               IS the one currently playing — so the green border always appears
               even when the user browses back to the playing album naturally. */
            const _isPlayingAlbum = window.playingAlbum != null &&
                String(window.playingAlbum.id) === String(album.id) &&
                window.currentSongIndex >= 0;
            const _shouldHighlight = !!highlightPlaying || _isPlayingAlbum;
            window._highlightActive = _shouldHighlight;
            if (!_shouldHighlight) {
                document.querySelectorAll('.song-item').forEach(el => el.classList.remove('active'));
            }
            updateDynamicTitle();
        }
        window.selectAlbum = selectAlbum;

        /* HIGHLIGHT — only runs when window._highlightActive is true.
           Set true by: song row click, Go to Album, Go to Playlist, card play button,
           next/prev navigation.
           Cleared by: opening any album view via normal browsing. */
        function updateActiveSongHighlight() {
            document.querySelectorAll('.song-item').forEach(el => el.classList.remove('active'));
            if (!window._highlightActive) return;

            const song = window.playingAlbum?.songs?.[window.currentSongIndex];
            const playingSongId = song?.id != null ? String(song.id) : null;
            if (!playingSongId) return;

            /* ── Highlight EVERY song-item across ALL open lists that matches the playing song ID ── */
            let _firstActiveRow = null;
            document.querySelectorAll(`.song-item[data-song-id="${playingSongId}"]`)
                .forEach(el => {
                    el.classList.add('active');
                    if (!_firstActiveRow) _firstActiveRow = el;
                });

            /* ── Auto-scroll the active row to center on next/prev navigation ──────────
               _bzScrollToActive is set by playNextSong() / playPrevSong() / auto-advance.
               Debounced via cancelAnimationFrame so rapid repeated presses only trigger
               one smooth scroll after the last press settles. */
            if (_firstActiveRow && window._bzScrollToActive) {
                window._bzScrollToActive = false;
                if (window._bzScrollRaf) cancelAnimationFrame(window._bzScrollRaf);
                window._bzScrollRaf = requestAnimationFrame(() => {
                    window._bzScrollRaf = null;
                    _firstActiveRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                });
            }

            /* ── Highlight in history preview list ── */
            document.querySelectorAll('.bz-history-item.bzh-playing, .bzh-full-row.bzh-playing')
                .forEach(el => el.classList.remove('bzh-playing'));

            /* Preview list — match by data-history-id attribute */
            document.querySelectorAll('.bz-history-item[data-history-id]').forEach(el => {
                if (el.dataset.historyId === playingSongId) {
                    el.classList.add('bzh-playing');
                }
            });

            /* Full overlay — same matching */
            document.querySelectorAll('.bzh-full-row[data-history-id]').forEach(el => {
                if (el.dataset.historyId === playingSongId) {
                    el.classList.add('bzh-playing');
                    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
            });
        }
        /* Export so external modules (playlists.js, beatzen-pro.js, etc.) can call it */
        window.updateActiveSongHighlight = updateActiveSongHighlight;

        /* ── PERSISTENT HIGHLIGHT SAFETY NET ─────────────────────────────────
           Any view re-render (search results, artist page, queue panel,
           navigation, etc.) can wipe out the .active class on song rows
           without going through one of the explicit updateActiveSongHighlight()
           call sites. Watch the whole document body for new .song-item /
           history-row nodes and re-apply the highlight automatically whenever
           _highlightActive is true, so the currently-playing song never loses
           its highlight after any page activity. */
        (function () {
            let _highlightRaf = null;
            const observer = new MutationObserver((mutations) => {
                if (!window._highlightActive) return;
                // Only react if song-row-like nodes were actually added
                const relevant = mutations.some(m =>
                    Array.from(m.addedNodes).some(n =>
                        n.nodeType === 1 && (
                            n.matches?.('.song-item, .bz-history-item, .bzh-full-row') ||
                            n.querySelector?.('.song-item, .bz-history-item, .bzh-full-row')
                        )
                    )
                );
                if (!relevant) return;
                if (_highlightRaf) return;
                _highlightRaf = requestAnimationFrame(() => {
                    _highlightRaf = null;
                    updateActiveSongHighlight();
                });
            });
            observer.observe(document.body, { childList: true, subtree: true });
        })();

        /* PLAYLIST DELETE */
        let playlistToDelete = null;
        window.handleDeletePlaylist = function (id) {
            playlistToDelete = id;
            const popup = document.getElementById('delete-confirm-popup');
            if (popup) { popup.style.display = 'flex'; popup.classList.add('visible'); }
        };
        document.getElementById('cancel-delete-btn')?.addEventListener('click', () => {
            const popup = document.getElementById('delete-confirm-popup');
            if (popup) popup.style.display = 'none';
            playlistToDelete = null;
        });
        document.getElementById('confirm-delete-btn')?.addEventListener('click', () => {
            if (!playlistToDelete) return;
            // If the playlist being deleted is currently playing, stop playback cleanly
            if (String(window.playingAlbum?.id) === String(playlistToDelete)) {
                stopAndReset();
                window.playingAlbum = null;
                const titleEl = document.getElementById('player-song-title');
                const artistEl = document.getElementById('player-song-artist');
                const coverEl = document.getElementById('player-album-cover');
                if (titleEl) titleEl.textContent = 'Select a song to play';
                if (artistEl) artistEl.textContent = '';
                if (coverEl) coverEl.src = 'https://res.cloudinary.com/beatzenapp/image/upload/v1782654641/Logo_kmpfjf.jpg';
                showToast('Playlist deleted — playback stopped');
            }
            window.masterPool = window.masterPool.filter(a => String(a.id) !== String(playlistToDelete));
            const saved = JSON.parse(localStorage.getItem('beatZen_importedPlaylists') || '[]');
            localStorage.setItem('beatZen_importedPlaylists', JSON.stringify(saved.filter(pl => String(pl.id) !== String(playlistToDelete))));
            document.getElementById('card-' + playlistToDelete)?.remove();
            const popup = document.getElementById('delete-confirm-popup');
            if (popup) popup.style.display = 'none';
            hideAllViews();
            displayPlaylists();
            playlistToDelete = null;
        });

        /* SEARCH — RECENT SEARCHES */
        function isRecentSearchesEnabled() {
            /* Default ON if never set */
            const val = localStorage.getItem(RECENT_SEARCHES_ENABLED_KEY);
            return val === null ? true : val === 'true';
        }

        function getRecentSearches() {
            try { return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]'); } catch (e) { return []; }
        }

        function saveRecentSearch(q) {
            if (!isRecentSearchesEnabled()) return;
            if (!q || q.length < 2) return;
            let searches = getRecentSearches().filter(s => s.toLowerCase() !== q.toLowerCase());
            searches.unshift(q);
            searches = searches.slice(0, MAX_RECENT_SEARCHES);
            localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
        }

        function renderRecentSearches() {
            document.getElementById('recent-searches-panel')?.remove();
            if (!isRecentSearchesEnabled()) return;
            const searches = getRecentSearches();
            if (!searches.length) return;
            const wrapper = document.querySelector('.search-bar-wrapper');
            if (!wrapper) return;

            const panel = document.createElement('div');
            panel.id = 'recent-searches-panel';

            panel.innerHTML = searches.map((s, i) => `
            <div class="rs-item" data-idx="${i}">
                <i class="fas fa-clock-rotate-left rs-icon"></i>
                <span class="rs-text">${s}</span>
                <i class="fas fa-times rs-remove" data-idx="${i}" title="Remove"></i>
            </div>`).join('') +
                `<div class="rs-footer">
                <span class="rs-clear-all" id="rs-clear-all-btn">Clear all</span>
            </div>`;

            wrapper.appendChild(panel);

            /* Click on a row — fill search bar and execute */
            panel.querySelectorAll('.rs-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    if (e.target.classList.contains('rs-remove') || e.target.closest('.rs-remove')) return;
                    const q = searches[+item.dataset.idx];
                    actualSearchBar.value = q;
                    clearSearchBtn.style.display = 'block';
                    panel.remove();
                    executeSearchLogic(q.toLowerCase().trim());
                });
            });

            /* Remove individual item */
            panel.querySelectorAll('.rs-remove').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idx = +btn.dataset.idx;
                    searches.splice(idx, 1);
                    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
                    renderRecentSearches();
                });
            });

            /* Clear all */
            panel.querySelector('#rs-clear-all-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                localStorage.removeItem(RECENT_SEARCHES_KEY);
                panel.remove();
            });
        }

        actualSearchBar.addEventListener('focus', () => {
            if (!actualSearchBar.value.trim()) renderRecentSearches();
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('#search-container') && !e.target.closest('#recent-searches-panel')) {
                document.getElementById('recent-searches-panel')?.remove();
            }
        });

        clearSearchBtn.onclick = () => {
            actualSearchBar.value = '';
            searchResultsContainer.innerHTML = '';
            clearSearchBtn.style.display = 'none';
            actualSearchBar.focus();
            renderRecentSearches();
        };

        let searchTimeout = null;
        actualSearchBar.oninput = (e) => {
            const q = e.target.value.toLowerCase().trim();
            clearSearchBtn.style.display = q ? 'block' : 'none';
            clearTimeout(searchTimeout);
            document.getElementById('recent-searches-panel')?.remove();
            searchTimeout = setTimeout(() => executeSearchLogic(q), 300);
        };

        function executeSearchLogic(q) {
            searchResultsContainer.innerHTML = '';
            searchResultsContainer.style.display = 'block';
            if (!q) return;
            const sw = q.split(/\s+/);
            const MAX = 8;
            const matchesStart = (str) => {
                if (!str) return false;
                return sw.some(w => str.toLowerCase().split(/\s+/).some(tw => tw.startsWith(w)));
            };
            const mt = {
                y: allYears.filter(y => sw.some(w => y.startsWith(w))).slice(0, 5),
                a: Object.values(customArtistsData).flat().filter(art => matchesStart(art.name)).slice(0, MAX),
                h: Object.values(typeof customHeroesData !== 'undefined' ? customHeroesData : {}).flat().filter(hero => matchesStart(hero.name)).slice(0, MAX),
                c: Object.keys(customGenreData || {}).filter(key => matchesStart(customGenreData[key]?.name || key)).slice(0, MAX),
                p: JSON.parse(localStorage.getItem('beatZen_importedPlaylists') || '[]').filter(pl => matchesStart(pl.name || pl.title)).slice(0, MAX),
                al: allAlbums.filter(alb => matchesStart(alb.title)).slice(0, MAX),
                s: Array.from(window.allSongsMap.values()).filter(s => matchesStart(s.title)).slice(0, MAX)
            };
            const mkSec = (title) => { const s = document.createElement('div'); s.className = 'year-section'; s.innerHTML = `<h2>${title}</h2><div class="albums-grid"></div>`; return s; };
            if (mt.y.length) {
                const sec = mkSec('Years'), grid = sec.querySelector('.albums-grid');
                mt.y.forEach(y => { const b = document.createElement('a'); b.className = 'year-button'; b.textContent = y; b.onclick = () => { hideAllViews(); displayHome(false, y); }; grid.appendChild(b); });
                searchResultsContainer.appendChild(sec);
            }
            if (mt.a.length) {
                const sec = mkSec('Artists'), grid = sec.querySelector('.albums-grid');
                mt.a.forEach(art => grid.appendChild(renderCard(art.name, art.imageUrl, () => { hideAllViews(); selectAlbum(resolveData(art, "Artist")); }, art.id)));
                searchResultsContainer.appendChild(sec);
            }
            if (mt.h.length) {
                const sec = mkSec('Heroes'), grid = sec.querySelector('.albums-grid');
                mt.h.forEach(hero => {
                    const heroSongs = (typeof window.bzResolveHeroSongs === 'function') ? window.bzResolveHeroSongs(hero.name) : [];
                    grid.appendChild(renderCard(hero.name, hero.imageUrl, () => { hideAllViews(); selectAlbum(resolveData({ ...hero, songs: heroSongs }, "Hero")); }, hero.id));
                });
                searchResultsContainer.appendChild(sec);
            }
            if (mt.c.length) {
                const sec = mkSec('Explore'), grid = sec.querySelector('.albums-grid');
                mt.c.forEach(key => { const col = customGenreData[key]; grid.appendChild(renderCard(col?.name || key, col?.albumCover, () => { hideAllViews(); selectAlbum(resolveData(col, "Collection")); }, key)); });
                searchResultsContainer.appendChild(sec);
            }
            if (mt.p.length) {
                const sec = mkSec('Playlists'), grid = sec.querySelector('.albums-grid');
                mt.p.forEach(pl => grid.appendChild(renderCard(pl.name || pl.title, pl.albumCover || pl.imageUrl, () => { hideAllViews(); selectAlbum(resolveData(pl, "Playlist")); }, pl.id)));
                searchResultsContainer.appendChild(sec);
            }
            if (mt.al.length) {
                const sec = mkSec('Albums'), grid = sec.querySelector('.albums-grid');
                mt.al.forEach(alb => grid.appendChild(renderCard(alb.title, alb.imageUrl, () => { hideAllViews(); selectAlbum(resolveData(alb, "Movie")); }, alb.id)));
                searchResultsContainer.appendChild(sec);
            }
            if (mt.s.length) {
                const sec = mkSec('Songs'), list = document.createElement('div');
                list.className = 'songs-list';
                mt.s.forEach(s => {
                    const item = document.createElement('div');
                    item.className = 'song-item';
                    item.innerHTML = `<div class="song-details"><img src="${s.album?.imageUrl || s.album?.albumCover || ''}" class="playlist-song-cover"><div class="song-text-details"><span class="song-item-title">${s.title}</span><span class="song-item-artist">${s.artist}</span></div></div>`;
                    item.onclick = () => {
                        hideAllViews();
                        const data = resolveData(s.album, s.album?.type || "Movie");

                        /* ── FIX: Queue cleanup on search-song click ──────────────────────────
                           A search result can come from any album — potentially different from
                           what's currently playing.  Explicitly purge ALL stale queue-management
                           state here so old shuffle order, AutoMix boundary, and repeat-queue
                           snapshots from the previous album never bleed into the new context.
                           This mirrors what playSong's album-switch guard does, but fires it
                           unconditionally because the search handler bypasses that guard when
                           window._bzCurrentPlayingAlbumId hasn't been set yet (e.g. on first
                           load or after a refresh where a different album was last open). */
                        window._bzAutoMixStartIndex = -1;
                        window._bzOriginalQueue = null;
                        window._bzOriginalAutoMixBoundary = undefined;
                        window._bzPreRepeatQueue = null;
                        window._bzPreRepeatAutoMixBoundary = undefined;
                        window._bzPreRepeatAllQueue = null;
                        window._bzSourceSongCount = 0; // reset so playSong re-captures for new album
                        if (window._bzAmUsedIds instanceof Set) window._bzAmUsedIds.clear();

                        /* Force-update the tracking id so playSong's own guard stays in sync */
                        window._bzCurrentPlayingAlbumId = String(data.id);

                        /* If shuffle was active for the previous album, reset it so the new
                           album starts in natural order.  Shuffle state (localStorage) is
                           preserved — only the in-memory reordering is cleared. */
                        if (window.isShuffling) {
                            window._bzOriginalQueue = null;           // already nulled above
                            /* Re-apply syncPlaybackModesUI so the shuffle button reflects the
                               current persisted preference without reordering the new queue */
                            if (typeof window.syncPlaybackModesUI === 'function') {
                                window.syncPlaybackModesUI();
                            }
                        }

                        window.playingAlbum = data;
                        selectAlbum(data, /*highlightPlaying=*/true);

                        const songIdx = data.songs.findIndex(x => String(x.id) === String(s.id));
                        window.playSong(songIdx >= 0 ? songIdx : 0);

                        /* ── Record 'search_after' signal ────────────────────────────────────
                           The user found this song through search and immediately played it —
                           a strong positive intent signal.  Write it to beatZen_signals so
                           buildSignalScores() in playlists.js can boost this song in smart
                           recommendations (Daily Mix, For You, etc.).               */
                        try {
                            const BZ_SIGNALS_KEY = 'beatZen_signals';
                            let signals = [];
                            try { signals = JSON.parse(localStorage.getItem(BZ_SIGNALS_KEY) || '[]'); } catch (_) { /* ignore */ }
                            signals.unshift({ id: String(s.id), signal: 'search_after', ts: Date.now() });
                            signals = signals.slice(0, 500);
                            localStorage.setItem(BZ_SIGNALS_KEY, JSON.stringify(signals));
                        } catch (_saErr) { /* silent — never break playback */ }
                    };
                    list.appendChild(item);
                });
                sec.appendChild(list); searchResultsContainer.appendChild(sec);
            }
            if (!mt.y.length && !mt.a.length && !mt.h.length && !mt.c.length && !mt.p.length && !mt.al.length && !mt.s.length) {
                searchResultsContainer.innerHTML = `<div class="no-results">No matches for "${q}"</div>`;
            } else {
                saveRecentSearch(q);
            }
        }

        /* TRANSPORT — onclick and touchend handlers wired once per page load.
           All handlers reference window.* so they resolve correctly regardless of
           whether wireModeButtons() fires before or after startApp() defines the locals.
           The _bzOnclickWired / _bzTouchWired flags live on DOM element instances and
           are naturally reset on every page refresh (new DOM = no flags). */
        if (!nextBtn._bzOnclickWired) {
            nextBtn.onclick = (e) => { e.stopPropagation(); if (window.playNextSong) window.playNextSong(); };
            nextBtn._bzOnclickWired = true;
        }
        if (!prevBtn._bzOnclickWired) {
            prevBtn.onclick = (e) => { e.stopPropagation(); if (window.playPrevSong) window.playPrevSong(); };
            prevBtn._bzOnclickWired = true;
        }
        if (!playPauseBtn._bzOnclickWired) {
            playPauseBtn.onclick = (e) => { e.stopPropagation(); if (window.togglePlayback) window.togglePlayback(); };
            playPauseBtn._bzOnclickWired = true;
        }

        // Guard touchend handlers — registered once; _bzTouchWired flag prevents
        // stacking on repeated wireModeButtons() calls (DOMContentLoaded + load).
        // FIX: retry up to 3× (80ms apart) if the window.* function isn't ready yet
        // — prevents silent no-ops on cold refresh before startApp() finishes.
        function _bzRetryCall(fn, attempts) {
            if (typeof fn === 'function') { fn(); return; }
            if (attempts > 0) setTimeout(() => _bzRetryCall(fn, attempts - 1), 80);
        }
        [
            [nextBtn, () => _bzRetryCall(window.playNextSong, 3)],
            [prevBtn, () => _bzRetryCall(window.playPrevSong, 3)],
            [playPauseBtn, () => _bzRetryCall(window.togglePlayback, 3)],
        ].forEach(([btn, handler]) => {
            if (!btn || btn._bzTouchWired) return;
            btn._bzTouchWired = true;
            btn.addEventListener('touchend', (e) => {
                e.stopPropagation(); // prevent swipe engine from seeing this touch
                e.preventDefault();  // prevent delayed synthetic click
                handler();
            }, { passive: false });
        });

        /* Mini play/pause button (mobile mini-player) */
        const miniPlayPauseBtn = document.getElementById('mini-play-pause-btn');
        if (miniPlayPauseBtn && !miniPlayPauseBtn._bzTouchWired) {
            miniPlayPauseBtn._bzTouchWired = true;
            miniPlayPauseBtn.onclick = (e) => { e.stopPropagation(); _bzRetryCall(window.togglePlayback, 3); };
            miniPlayPauseBtn.addEventListener('touchend', (e) => {
                e.stopPropagation();
                e.preventDefault();
                // FIX: retry if togglePlayback isn't ready yet (cold refresh race)
                _bzRetryCall(window.togglePlayback, 3);
            }, { passive: false });
        }

        /* PLAYBACK MODES */
        window.syncPlaybackModesUI = function () {
            const sBtns = document.querySelectorAll('#shuffle-btn');
            const lBtns = document.querySelectorAll('#loop-btn');
            sBtns.forEach(btn => {
                btn.classList.toggle('active', !!window.isShuffling);
            });
            // 3-mode repeat: 0=off, 1=repeat-all, 2=repeat-one
            const mode = window.repeatMode || 0;
            lBtns.forEach(btn => {
                // Remove all mode classes first
                btn.classList.remove('active', 'repeat-all', 'repeat-one');
                btn.removeAttribute('data-repeat-mode');
                btn.setAttribute('data-repeat-mode', mode);
                const icon = btn.querySelector('i');
                if (mode === 0) {
                    // OFF — grey, fa-repeat icon
                    btn.title = 'Repeat Off';
                    btn.setAttribute('aria-label', 'Repeat Off — click to Repeat All');
                    if (icon) { icon.className = 'fas fa-repeat'; }
                } else if (mode === 1) {
                    // REPEAT ALL — active colour, fa-repeat icon
                    btn.classList.add('active', 'repeat-all');
                    btn.title = 'Repeat All';
                    btn.setAttribute('aria-label', 'Repeat All — click to Repeat One');
                    if (icon) { icon.className = 'fas fa-repeat'; }
                } else {
                    // REPEAT ONE — active colour, fa-repeat icon + "1" badge via CSS
                    btn.classList.add('active', 'repeat-one');
                    btn.title = 'Repeat One';
                    btn.setAttribute('aria-label', 'Repeat One — click to turn off Repeat');
                    if (icon) { icon.className = 'fas fa-repeat'; }
                }
            });
        };
        /* Apply restored state immediately so buttons reflect saved preference */
        window.syncPlaybackModesUI();

        /* Exposed global toggles — beatzen-pro.js / buttons.js / mobile.js can call these */
        window.toggleShuffle = function () {
            window.isShuffling = !window.isShuffling;
            localStorage.setItem('beatZen_shuffle', window.isShuffling);

            if (window.playingAlbum?.songs && window.currentSongIndex >= 0) {
                const ci = window.currentSongIndex;
                const songs = window.playingAlbum.songs;

                if (window.isShuffling) {
                    // ── Save original remaining queue + AutoMix boundary ──────────
                    window._bzOriginalQueue = songs.slice(ci + 1);
                    window._bzOriginalAutoMixBoundary = window._bzAutoMixStartIndex ?? -1;

                    // ── Fisher-Yates shuffle of all songs after the current one ──
                    const remaining = songs.slice(ci + 1);
                    for (let i = remaining.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
                    }
                    songs.splice(ci + 1, songs.length - ci - 1, ...remaining);

                    // ── Recalculate AutoMix boundary in the new shuffled order ───
                    const newBnd = songs.findIndex((s, idx) => idx > ci && !!s._autoMix);
                    window._bzAutoMixStartIndex = newBnd > ci ? newBnd : -1;
                } else {
                    // ── Restore original queue order and AutoMix boundary ─────────
                    if (window._bzOriginalQueue) {
                        songs.splice(ci + 1, songs.length - ci - 1, ...window._bzOriginalQueue);
                        window._bzOriginalQueue = null;
                    }
                    if (window._bzOriginalAutoMixBoundary !== undefined) {
                        window._bzAutoMixStartIndex = window._bzOriginalAutoMixBoundary;
                        window._bzOriginalAutoMixBoundary = undefined;
                    }
                }

                if (typeof window.renderFullscreenQueue === 'function') {
                    window.renderFullscreenQueue();
                }
            }

            window.syncPlaybackModesUI();
        };
        window.toggleLoop = function () {
            // Cycle: 0 (off) → 1 (repeat all) → 2 (repeat one) → 0
            const prev = window.repeatMode || 0;
            const next = (prev + 1) % 3;
            window.repeatMode = next;
            window.isLooping = next === 2; // legacy compat
            localStorage.setItem('beatZen_repeat_mode', String(next));
            localStorage.setItem('beatZen_loop', String(next === 2)); // legacy compat key

            if (window.playingAlbum?.songs && window.currentSongIndex >= 0) {
                const ci = window.currentSongIndex;
                const songs = window.playingAlbum.songs;

                if (next === 2) {
                    // ── Entering repeat-one: save remaining queue, leave only current song ──
                    window._bzPreRepeatQueue = songs.slice(ci + 1);
                    window._bzPreRepeatAutoMixBoundary = window._bzAutoMixStartIndex ?? -1;
                    songs.splice(ci + 1);          // queue now contains only the current song
                    window._bzAutoMixStartIndex = -1;
                } else if (prev === 2) {
                    // ── Leaving repeat-one (→ OFF): restore saved queue tail ──
                    if (window._bzPreRepeatQueue) {
                        songs.splice(ci + 1, 0, ...window._bzPreRepeatQueue);
                        window._bzPreRepeatQueue = null;
                    }
                    if (window._bzPreRepeatAutoMixBoundary !== undefined) {
                        window._bzAutoMixStartIndex = window._bzPreRepeatAutoMixBoundary;
                        window._bzPreRepeatAutoMixBoundary = undefined;
                    }
                    // Also restore the queue snapshot saved when we entered repeat-all
                    // (handles the full 1 → 2 → 0 cycle path)
                    if (window._bzPreRepeatAllQueue?.length) {
                        songs.push(...window._bzPreRepeatAllQueue);
                        window._bzPreRepeatAllQueue = null;
                    }
                } else if (next === 1) {
                    // ── Entering repeat-all (OFF → 1): immediately remove any manually-queued
                    //    songs that sit beyond the source album/playlist boundary and save them
                    //    so they can be fully restored when repeat is turned off again. ──
                    const srcCount = window._bzSourceSongCount;
                    if (srcCount > 0 && songs.length > srcCount) {
                        window._bzPreRepeatAllQueue = songs.splice(srcCount);
                        if (typeof window.rebuildMasterMap === 'function') window.rebuildMasterMap();
                    }
                }
                // Note: 1 → 0 direct is unreachable via the (prev+1)%3 cycle.

                if (typeof window.renderFullscreenQueue === 'function') {
                    window.renderFullscreenQueue();
                }
            }

            window.syncPlaybackModesUI();
        };

        /* Wire buttons directly — runs now AND after DOM ready to survive
           any handlers added by later-loaded scripts (buttons.js, beatzen-pro.js) */
        function wireModeButtons() {
            const sBtn = document.getElementById('shuffle-btn');
            const lBtn = document.getElementById('loop-btn');
            // Always re-assign onclick on each call — wireModeButtons() is idempotent
            // and must win over any stale onclick= set by beatzen-pro.js / mobile.js.
            if (sBtn) sBtn.onclick = (e) => { e.stopPropagation(); if (window.toggleShuffle) window.toggleShuffle(); sBtn.blur(); };
            if (lBtn) lBtn.onclick = (e) => { e.stopPropagation(); if (window.toggleLoop) window.toggleLoop(); lBtn.blur(); };
        }
        wireModeButtons();
        /* Re-wire after all deferred scripts have loaded, ensuring we win over any
           onclick= assignment made by buttons.js / beatzen-pro.js / mobile.js */
        window.addEventListener('load', () => {
            wireModeButtons();
            if (window.syncPlaybackModesUI) window.syncPlaybackModesUI();
        });

        /* MAXIMIZE */
        function toggleMaximize(isBack = false) {
            const mp = document.getElementById('main-player');
            if (!mp) return;

            if (!mp.classList.contains('maximized')) {
                mp.classList.add('maximized');
                document.body.style.overflow = 'hidden';

                if (window.location.hash !== '#player') { window._bzSpaNavDepth++; history.pushState({ view: 'fullscreen-player' }, 'Player', '#player'); }
            } else {
                mp.classList.remove('maximized');
                document.body.style.overflow = '';
                // FIX: only call history.back() when the URL is actually #player.
                // If the player was opened from inside an album view the hash is
                // #album-{id} — calling history.back() there would pop the album
                // entry and land the user on Home unexpectedly. Use replaceState to
                // strip #player without moving the history pointer when !isBack too.
                if (!isBack && window.location.hash === '#player') history.back();
            }
        }

        // Expose toggleMaximize globally so the popstate handler (and any external
        // code) can call it even if it fires before startApp() completes.
        window._bzToggleMaximize = toggleMaximize;
        if (maximizeBtn) maximizeBtn.onclick = (e) => { e.stopPropagation(); if (window.playingAlbum) toggleMaximize(); };
        if (minimizeBtn) minimizeBtn.onclick = (e) => { e.stopPropagation(); toggleMaximize(); };

        /* Clicking the album art or song info area opens fullscreen.
           All control buttons work in place without triggering fullscreen. */
        if (mainPlayer) {
            mainPlayer.addEventListener('click', (e) => {
                /* Already maximized — ignore (minimize-btn handles close) */
                if (mainPlayer.classList.contains('maximized')) return;
                /* Only trigger fullscreen if clicking directly on the
                   album-cover image or the song-title/artist text area */
                const clickedCover = e.target.closest('#player-album-cover, .player-cover-wrap, .player-song-info, #player-song-title, #player-song-artist');
                if (!clickedCover) return;
                // FIX: if playingAlbum isn't ready yet (async restore still running
                // after refresh), retry once after 350ms instead of silently giving up.
                if (!window.playingAlbum) {
                    setTimeout(() => { if (window.playingAlbum) toggleMaximize(); }, 350);
                    return;
                }
                toggleMaximize();
            });
        }

        /* ── FULLSCREEN THREE-DOT MENU ── */
        const fsMenuBtn = document.getElementById('fs-menu-btn');
        const fsMenuDropdown = document.getElementById('fs-menu-dropdown');
        const fsGotoAlbumBtn = document.getElementById('fs-goto-album-btn');
        const fsGotoPlaylistBtn = document.getElementById('fs-goto-playlist-btn');

        function closeFsMenu() {
            if (!fsMenuDropdown) return;
            fsMenuDropdown.classList.remove('open');
            fsMenuDropdown.setAttribute('aria-hidden', 'true');
        }

        function minimizePlayer() {
            const mp = document.getElementById('main-player');
            if (mp && mp.classList.contains('maximized')) {
                mp.classList.remove('maximized');
                document.body.style.overflow = '';
            }
        }

        /* Show "Go to Playlist" only when playing from explore/playlist/artist/collection */
        function updateFsMenuButtons() {
            if (!fsGotoPlaylistBtn) return;
            const type = String(window.playingAlbum?.type || 'movie').toLowerCase();
            fsGotoPlaylistBtn.style.display = (type === 'movie') ? 'none' : '';
        }

        /* ── Go to Album action (shared) ── */
        function doGotoAlbum() {
            window.closePlaylistModal();
            if (!window.playingAlbum) return;
            minimizePlayer();
            const currentSong = window.playingAlbum.songs?.[window.currentSongIndex];
            const songIdStr = currentSong?.id != null ? String(currentSong.id) : null;

            // Resolve the TRUE source album/movie for this song, with the same
            // priority chain used by the header label / history recording:
            //   1) allSongsMap canonical album (most reliable — works for
            //      AutoMix and Queue songs which don't belong to playingAlbum)
            //   2) song._sourceAlbum (tagged by AutoMix injector)
            //   3) playingAlbum itself matched against allAlbums (normal case)
            const canonicalAlbum = songIdStr ? window.allSongsMap?.get(songIdStr)?.album : null;
            const sourceAlbum = canonicalAlbum
                || currentSong?._sourceAlbum
                || allAlbums.find(a => String(a.id) === String(window.playingAlbum.id))
                || (window.masterPool || []).find(a => String(a.id) === String(window.playingAlbum.id));

            const albumToOpen = sourceAlbum
                ? resolveData(sourceAlbum, sourceAlbum.type || 'Movie')
                : window.playingAlbum;

            history.replaceState({ view: 'album', albumId: albumToOpen.id }, '', `#album-${albumToOpen.id}`);
            window.lastActiveView = 'home';
            selectAlbum(albumToOpen, true, 'home', true);
        }

        /* ── Go to Playlist action (shared) ── */
        function doGotoPlaylist() {
            window.closePlaylistModal();
            if (!window.playingAlbum) return;
            minimizePlayer();

            const currentSong = window.playingAlbum.songs?.[window.currentSongIndex];
            const songIdStr = currentSong?.id != null ? String(currentSong.id) : null;
            const canonicalAlbum = songIdStr ? window.allSongsMap?.get(songIdStr)?.album : null;
            const sourceAlbum = canonicalAlbum || currentSong?._sourceAlbum || null;

            // If this song's real source (Queue/AutoMix injected) differs from the
            // currently playingAlbum and is itself a playlist/collection, go there.
            const sourceIsDifferent = sourceAlbum && String(sourceAlbum.id) !== String(window.playingAlbum.id);
            const sourceType = String(sourceAlbum?.type || '').toLowerCase();
            const targetAlbum = (sourceIsDifferent && sourceType !== 'movie' && sourceType !== '')
                ? resolveData(sourceAlbum, sourceAlbum.type)
                : window.playingAlbum;

            window.lastActiveView = 'playlists';
            displayPlaylists(false);
            setTimeout(() => selectAlbum(targetAlbum, false, 'playlists', true), 80);
        }

        if (fsMenuBtn && fsMenuDropdown) {
            const _fsMenuHandler = (e) => {
                e.stopPropagation();
                e.preventDefault();
                let song = window.playingAlbum?.songs?.[window.currentSongIndex];

                /* FIX (mobile): currentSongIndex/playingAlbum can momentarily be out
                   of sync right after a screen-lock resume or background restore —
                   previously this silently did nothing ("if (!song) return;") with
                   zero feedback. Fall back to re-resolving the song from whichever
                   song the <audio> element is actually playing before giving up. */
                if (!song && audioPlayer?.src && window.allSongsMap) {
                    try {
                        const _decodedSrc = decodeURIComponent(audioPlayer.src);
                        for (const [, mapped] of window.allSongsMap) {
                            if (mapped?.url && (mapped.url === audioPlayer.src || decodeURIComponent(mapped.url) === _decodedSrc)) {
                                song = mapped;
                                break;
                            }
                        }
                    } catch (_) { /* ignore */ }
                }
                if (!song) {
                    if (typeof showToast === 'function') showToast('No song playing yet');
                    return;
                }

                // Open the shared context menu
                window.openSongMenu(song, e);

                // After the menu renders, inject fullscreen-specific navigation buttons
                requestAnimationFrame(() => {
                    const opts = document.getElementById('modal-main-options');
                    if (!opts) return;

                    // Remove any previously injected fs-nav buttons to avoid duplicates
                    opts.querySelectorAll('.bz-fs-nav-btn').forEach(b => b.remove());

                    const type = String(window.playingAlbum?.type || 'movie').toLowerCase();
                    const isMovie = type === 'movie' || type === '' || !type;

                    // ── Go to Album (always shown in fullscreen) ──
                    const gotoAlbumBtn = document.createElement('button');
                    gotoAlbumBtn.className = 'bz-fs-nav-btn';
                    gotoAlbumBtn.innerHTML = '<i class="fas fa-compact-disc"></i> Go to Album';
                    gotoAlbumBtn.onclick = () => doGotoAlbum();
                    opts.appendChild(gotoAlbumBtn);

                    // ── Go to Playlist (shown only when playing from a playlist/explore) ──
                    if (!isMovie) {
                        const gotoPlBtn = document.createElement('button');
                        gotoPlBtn.className = 'bz-fs-nav-btn';
                        gotoPlBtn.innerHTML = '<i class="fas fa-list-ul"></i> Go to Playlist';
                        gotoPlBtn.onclick = () => doGotoPlaylist();
                        opts.appendChild(gotoPlBtn);
                    }

                    // ── Show Lyrics is handled by the static fs-show-lyrics-btn
                    // in #fs-menu-dropdown — do not inject a duplicate here.
                });
            };

            fsMenuBtn.onclick = _fsMenuHandler;
            // FIX (mobile): some mobile browsers swallow the synthetic click that
            // normally follows a touch on this button (same issue already worked
            // around for the next/prev/play-pause transport buttons above) —
            // wiring touchend directly makes the tap fire immediately and reliably.
            fsMenuBtn.addEventListener('touchend', (e) => {
                e.stopPropagation();
                e.preventDefault();
                _fsMenuHandler(e);
            }, { passive: false });
        }

        /* Keep old fsGotoAlbumBtn / fsGotoPlaylistBtn wired for any legacy callers */
        if (fsGotoAlbumBtn) fsGotoAlbumBtn.onclick = (e) => { e.stopPropagation(); doGotoAlbum(); };
        if (fsGotoPlaylistBtn) fsGotoPlaylistBtn.onclick = (e) => { e.stopPropagation(); doGotoPlaylist(); };

        /* Wire static Show Lyrics button in fullscreen dropdown */
        const fsShowLyricsBtn = document.getElementById('fs-show-lyrics-btn');
        if (fsShowLyricsBtn) {
            fsShowLyricsBtn.onclick = (e) => {
                e.stopPropagation();
                closeFsMenu();
                const song = window.playingAlbum?.songs?.[window.currentSongIndex];
                if (song && typeof window.bzShowLyrics === 'function') {
                    window.bzShowLyrics(song.id || '', song.title || '', song.artist || '', song.movie || window.playingAlbum?.title || window.playingAlbum?.name || '');
                }
            };
        }

        /* KEYBOARD SHORTCUTS */
        // Shortcut cheat sheet modal
        function showShortcutsCheatSheet() {
            const existing = document.getElementById('bz-shortcuts-popup');
            if (existing) { existing.remove(); return; }
            const modal = document.createElement('div');
            modal.id = 'bz-shortcuts-popup';
            modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px);';
            modal.innerHTML = `<div style="background:var(--card-bg,#1a1a1a);border:1px solid rgba(255,255,255,0.12);border-radius:18px;padding:24px 20px;max-width:380px;width:100%;max-height:80vh;overflow-y:auto;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
                <h3 style="margin:0;font-size:1.1rem;display:flex;align-items:center;gap:8px;"><i class="fas fa-keyboard" style="color:var(--primary-color,#2575fc);"></i> Keyboard Shortcuts</h3>
                <button id="bz-shortcuts-close" style="background:transparent;border:none;color:rgba(255,255,255,0.5);font-size:1.2rem;cursor:pointer;padding:4px 8px;"><i class="fas fa-times"></i></button>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;">
                ${[
                    ['Space', 'Play / Pause'],
                    ['→ Arrow Right', 'Next Song'],
                    ['← Arrow Left', 'Previous Song'],
                    ['↑ Arrow Up', 'Volume Up'],
                    ['↓ Arrow Down', 'Volume Down'],
                    ['M', 'Mute / Unmute'],
                    ['F', 'Fullscreen Player'],
                    ['S', 'Toggle Shuffle'],
                    ['Shift + L', 'Toggle Loop'],
                    ['L', 'Show Lyrics'],
                    ['T', 'Open Sleep Timer'],
                    ['Q', 'Open / Close Queue'],
                    ['Escape', 'Close / Exit'],
                ].map(([key, label]) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:rgba(255,255,255,0.04);border-radius:10px;">
                    <span style="font-size:0.88rem;opacity:0.8;">${label}</span>
                    <kbd style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:6px;padding:3px 10px;font-size:0.78rem;font-family:monospace;letter-spacing:0.5px;">${key}</kbd>
                </div>`).join('')}
            </div>
        </div>`;
            document.body.appendChild(modal);
            modal.querySelector('#bz-shortcuts-close').onclick = () => modal.remove();
            modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
        }
        window.showShortcutsCheatSheet = showShortcutsCheatSheet;

        document.addEventListener('keydown', (e) => {
            if (e.target.closest('input, textarea, select, [contenteditable="true"]')) { if (e.code === 'Escape') e.target.blur(); return; }
            if (e.code === 'Escape') {
                if (mainPlayer.classList.contains('maximized')) toggleMaximize();
                [timerPopup, successPopup, timerEndedPopup].forEach(p => { if (p) { if (p === timerPopup) { _showTimerPopup(false); } else { p.classList.remove('visible'); if (p === successPopup) p.style.display = 'none'; } } });
                document.body.classList.remove('no-scroll');
                const shortcutsPopup = document.getElementById('bz-shortcuts-popup');
                if (shortcutsPopup) { shortcutsPopup.remove(); return; }
                const lyrOverlay = document.getElementById('bz-lyr-overlay');
                if (lyrOverlay) { lyrOverlay.classList.add('bz-lyr-exit'); setTimeout(() => lyrOverlay.remove(), 320); return; }
                const shareOverlay = document.getElementById('bz-share-overlay');
                if (shareOverlay && typeof window.bzCloseShareModal === 'function') { window.bzCloseShareModal(); return; }
                if (shareOverlay) { shareOverlay.remove(); return; }
                return;
            }
            // Block all shortcuts if the toggle is disabled
            if (localStorage.getItem('beatzen_shortcuts') !== 'true') return;
            switch (e.code) {
                case 'Space': e.preventDefault(); togglePlayback(); break;
                case 'ArrowRight': e.preventDefault(); playNextSong(); break;
                case 'ArrowLeft': e.preventDefault(); playPrevSong(); break;
                case 'ArrowUp': e.preventDefault(); audioPlayer.volume = Math.min(1, parseFloat((audioPlayer.volume + 0.1).toFixed(1))); break;
                case 'ArrowDown': e.preventDefault(); audioPlayer.volume = Math.max(0, parseFloat((audioPlayer.volume - 0.1).toFixed(1))); break;
                case 'KeyM': e.preventDefault(); audioPlayer.muted = !audioPlayer.muted; break;
                case 'KeyF': e.preventDefault(); toggleMaximize(); break;
                case 'KeyS': e.preventDefault(); window.toggleShuffle?.(); break; // S = Shuffle
                case 'KeyL':
                    e.preventDefault();
                    if (e.shiftKey) {
                        window.toggleLoop?.();                                  // Shift+L = Loop
                    } else {
                        const song = window.playingAlbum?.songs?.[window.currentSongIndex];
                        if (song && typeof window.bzShowLyrics === 'function') {
                            window.bzShowLyrics(song.id || '', song.title || '', song.artist || '', song.movie || window.playingAlbum?.title || window.playingAlbum?.name || '');
                        }
                    }
                    break;
                case 'KeyT': e.preventDefault(); timerBtn?.click(); break;       // T = Timer popup
                case 'KeyQ': e.preventDefault(); {                               // Q = Queue
                    const _qo = document.getElementById('bz-queue-fullscreen');
                    if (_qo?.classList.contains('active')) window.bzCloseQueue?.();
                    else window.bzOpenQueue?.();
                    break;
                }
            }
        });

        /* POPUP OVERLAY CLOSE */
        document.addEventListener('mousedown', (e) => {
            [{ el: timerPopup, trigger: timerBtn }, { el: successPopup }, { el: timerEndedPopup }].forEach(({ el, trigger }) => {
                const visible = el && (el.classList.contains('visible') || el.style.display === 'flex' || el.style.display === 'block');
                if (visible && !el.contains(e.target) && (!trigger || !trigger.contains(e.target))) {
                    if (el === timerPopup) { _showTimerPopup(false); }
                    else { el.classList.remove('visible'); if (el === successPopup) el.style.display = 'none'; }
                }
            });
        });

        /* ── Screen Wake Lock (keeps screen alive while sleep timer runs on mobile) ── */
        let _bzWakeLock = null;
        async function requestWakeLock() {
            if (!('wakeLock' in navigator)) return; // not supported (older Android/iOS)
            try {
                _bzWakeLock = await navigator.wakeLock.request('screen');
                _bzWakeLock.addEventListener('release', () => { _bzWakeLock = null; });
            } catch (e) { /* permission denied or not available — ignore */ }
        }
        async function releaseWakeLock() {
            if (_bzWakeLock) { try { await _bzWakeLock.release(); } catch (e) { } _bzWakeLock = null; }
        }
        // Re-acquire wake lock when page becomes visible (iOS/Android releases it on hide)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && timerInterval !== null) {
                requestWakeLock();
            }
        });

        /* TIMER — text inputs for Hours and Minutes */
        const timerInputH = document.getElementById('timer-input-hours');
        const timerInputM = document.getElementById('timer-input-mins');
        const timerInputHint = document.getElementById('bz-timer-input-hint');

        // Show / hide the shared inline hint message
        let _hintClearTimer = null;
        function _showTimerHint(msg) {
            if (!timerInputHint) return;
            if (_hintClearTimer) { clearTimeout(_hintClearTimer); _hintClearTimer = null; }
            timerInputHint.textContent = msg;
            timerInputHint.style.display = 'flex';
            timerInputHint.classList.add('bz-timer-hint-visible');
        }
        function _hideTimerHint() {
            if (!timerInputHint) return;
            timerInputHint.classList.remove('bz-timer-hint-visible');
            _hintClearTimer = setTimeout(() => {
                timerInputHint.style.display = 'none';
                timerInputHint.textContent = '';
            }, 300);
        }

        // Clamp & zero-pad on blur; keep selH/selM in sync on every input change
        function _clampTimerInput(inp, max) {
            let v = parseInt(inp.value, 10);
            if (isNaN(v) || v < 0) v = 0;
            if (v > max) v = max;
            inp.value = String(v).padStart(2, '0');
            return v;
        }

        // Validate a value live — show hint and clear field if over limit
        function _validateTimerInput(inp, max, label) {
            const raw = inp.value;
            if (raw === '' || raw === '-') return; // still typing — don't interrupt
            const v = parseInt(raw, 10);
            if (!isNaN(v) && v > max) {
                _showTimerHint(`⚠ Enter ${max} or below for ${label}`);
                inp.value = '';          // clear the invalid value immediately
                inp.classList.add('bz-time-input--error');
                setTimeout(() => inp.classList.remove('bz-time-input--error'), 600);
            } else {
                _hideTimerHint();
            }
        }

        if (timerInputH) {
            timerInputH.addEventListener('input', () => {
                _validateTimerInput(timerInputH, 24, 'hours');
                selH = Math.min(24, Math.max(0, parseInt(timerInputH.value, 10) || 0));
            });
            timerInputH.addEventListener('blur', () => {
                selH = _clampTimerInput(timerInputH, 24);
                if (timerInputH.value && timerInputM && !timerInputM.value) {
                    _showTimerHint('ℹ Now enter minutes');
                    setTimeout(_hideTimerHint, 2000);
                } else { _hideTimerHint(); }
            });
            timerInputH.addEventListener('keydown', e => { if (e.key === 'Enter') { timerInputH.blur(); timerInputM && timerInputM.focus(); } });
        }
        if (timerInputM) {
            timerInputM.addEventListener('input', () => {
                _validateTimerInput(timerInputM, 60, 'mins');
                selM = Math.min(60, Math.max(0, parseInt(timerInputM.value, 10) || 0));
            });
            timerInputM.addEventListener('blur', () => {
                selM = _clampTimerInput(timerInputM, 60);
                _hideTimerHint();
            });
            timerInputM.addEventListener('keydown', e => { if (e.key === 'Enter') { timerInputM.blur(); startTimerBtn && startTimerBtn.click(); } });
            // Show a welcome hint when user first focuses minutes
            timerInputM.addEventListener('focus', () => {
                if (!timerInputM.value) {
                    _showTimerHint('ℹ Enter 60 or below for mins');
                }
            });
        }
        if (timerInputH) {
            timerInputH.addEventListener('focus', () => {
                if (!timerInputH.value) {
                    _showTimerHint('ℹ Enter 24 or below for hours');
                }
            });
        }

        // ── Timer popup aria-hidden / focus helper ────────────────────────────
        // The popup starts with aria-hidden="true" in HTML. Every open/close must
        // sync aria-hidden so focused descendants are never hidden from AT users.
        function _showTimerPopup(open) {
            if (open) {
                timerPopup.classList.add('visible');
                timerPopup.removeAttribute('aria-hidden');          // accessible when open
                document.body.classList.add('no-scroll');
                // Move focus into popup so screen readers land correctly
                requestAnimationFrame(() => closeTimerBtn && closeTimerBtn.focus());
            } else {
                // Blur any focused element inside BEFORE setting aria-hidden
                // — this is what Chrome complains about when we skip this step
                if (timerPopup.contains(document.activeElement)) {
                    document.activeElement.blur();
                }
                timerPopup.classList.remove('visible');
                timerPopup.setAttribute('aria-hidden', 'true');     // hidden from AT when closed
                document.body.classList.remove('no-scroll');
            }
        }
        /* Exposed globally to open the sleep timer popup from elsewhere */
        window.bzOpenSleepTimer = function () {
            timerPopup.style.zIndex = '10002';
            _showTimerPopup(true);
        };

        timerBtn.onclick = (e) => {
            e.stopPropagation();
            timerPopup.style.zIndex = "10002";
            _showTimerPopup(!timerPopup.classList.contains('visible'));
        };
        /* FIX: Add touchend handler for timer button so it works on mobile devices.
           Without this, touch events on mobile can be swallowed by the browser's
           300ms click delay or intercepted by parent touch handlers, making the
           sleep timer button appear unresponsive on small screens.
           Guard: bail out when the event is non-cancelable (scroll in progress)
           or when Y travel > 8 px (swipe/scroll gesture, not a tap) to avoid
           the "[Intervention] Ignored attempt to cancel a touchend" console error. */
        if (!timerBtn._bzTouchWired) {
            timerBtn._bzTouchWired = true;
            let _timerTouchStartY = 0;
            timerBtn.addEventListener('touchstart', (e) => {
                _timerTouchStartY = e.touches[0].clientY;
            }, { passive: true });
            timerBtn.addEventListener('touchend', (e) => {
                // Non-cancelable = browser owns this touch sequence (scrolling)
                if (!e.cancelable) return;
                // Large Y movement = scroll gesture, not a tap
                if (Math.abs(e.changedTouches[0].clientY - _timerTouchStartY) > 8) return;
                e.stopPropagation();
                e.preventDefault();
                timerPopup.style.zIndex = "10002";
                _showTimerPopup(!timerPopup.classList.contains('visible'));
            }, { passive: false });
        }
        window.addEventListener('mousedown', (e) => { if (timerPopup.classList.contains('visible') && e.target === timerPopup) { _showTimerPopup(false); } });
        /* FIX: Also close timer popup on touchstart outside (mobile equivalent of mousedown) */
        window.addEventListener('touchstart', (e) => { if (timerPopup.classList.contains('visible') && e.target === timerPopup) { _showTimerPopup(false); } }, { passive: true });

        function resetTimerUI() {
            clearInterval(timerInterval); timerInterval = null;
            localStorage.removeItem('beatzen_sleep_timer_end'); // clear persisted timer on cancel/end
            if (typeof releaseWakeLock === 'function') releaseWakeLock();
            timerDisplay.textContent = ''; timerHeading?.style && (timerHeading.style.display = 'none');
            cancelTimerBtn.style.display = 'none'; startTimerBtn.style.display = 'block';
            document.querySelector('.timer-columns-container')?.style && (document.querySelector('.timer-columns-container').style.display = 'flex');
            // Clear input values
            selH = 0; selM = 0; selS = 0;
            if (timerInputH) timerInputH.value = '';
            if (timerInputM) timerInputM.value = '';
            _hideTimerHint();
            // Restore preset buttons
            const presets = document.querySelector('.bz-timer-presets');
            if (presets) presets.style.display = 'flex';
            // Restore OR section
            const orSection = document.getElementById('bz-timer-or-section');
            if (orSection) orSection.style.display = 'flex';
            timerBtn.classList.remove('active', 'timer-pulse-active', 'timer-pulse-urgent');
            timerMainHeading.textContent = 'Set Sleep Timer'; _showTimerPopup(false);
            document.body.classList.remove('no-scroll');
            if (timerSubText) {
                timerSubText.textContent = 'Choose your sleep duration';
                timerSubText.classList.remove('bz-timer-subtitle--running');
            }
            // Clear preset highlight and confirmation panel
            document.querySelectorAll('.bz-preset-btn').forEach(b => b.classList.remove('bz-preset-active'));
            const cp = document.getElementById('bz-preset-confirm');
            if (cp) cp.style.display = 'none';
        }

        // ── Sleep Timer core start logic (shared by button click and refresh restore) ──
        function _startSleepTimer(totalSeconds) {
            if (totalSeconds <= 0) return;
            if (typeof requestWakeLock === 'function') requestWakeLock();
            clearInterval(timerInterval);
            // Always save end timestamp so a page refresh can restore the remaining time
            localStorage.setItem('beatzen_sleep_timer_end', String(Date.now() + totalSeconds * 1000));
            // Hide wheel columns AND preset buttons while timer is running
            const wc = document.querySelector('.timer-columns-container');
            if (wc) wc.style.display = 'none';
            const presets = document.querySelector('.bz-timer-presets');
            if (presets) presets.style.display = 'none';
            const orSection = document.getElementById('bz-timer-or-section');
            if (orSection) orSection.style.display = 'none';
            startTimerBtn.style.display = 'none'; cancelTimerBtn.style.display = 'block';
            timerMainHeading.textContent = 'Sleep Timer Running';
            if (timerSubText) {
                timerSubText.textContent = 'Songs will stop playing in';
                timerSubText.classList.add('bz-timer-subtitle--running');
            }
            timerBtn.classList.add('active');
            const fmt = t => `${String(Math.floor(t / 3600)).padStart(2, '0')}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
            timerDisplay.textContent = fmt(totalSeconds);
            const origVol = audioPlayer.volume;
            // Use the stored endTime (already in localStorage) for all remaining-time
            // calculations — this survives tab throttling / background suspension on mobile.
            const _timerEndTime = Date.now() + totalSeconds * 1000;
            function _timerTick() {
                const remaining = Math.max(0, Math.floor((_timerEndTime - Date.now()) / 1000));
                timerDisplay.textContent = fmt(remaining);
                if (remaining > 15) { timerBtn.classList.add('timer-pulse-active'); timerBtn.classList.remove('timer-pulse-urgent'); }
                else if (remaining > 0) { timerBtn.classList.remove('timer-pulse-active'); timerBtn.classList.add('timer-pulse-urgent'); }
                if (remaining <= 15 && remaining > 0) audioPlayer.volume = origVol * (remaining <= 4 ? 0.1 : remaining <= 8 ? 0.2 : remaining <= 10 ? 0.5 : remaining <= 12 ? 0.7 : 0.9);
                if (remaining <= 0) { audioPlayer.pause(); audioPlayer.volume = origVol; resetTimerUI(); timerEndedPopup.classList.add('visible'); updatePlayPauseIcon(); }
            }
            timerInterval = setInterval(_timerTick, 1000);
        }

        startTimerBtn.onclick = () => {
            // Clamp inputs before reading (covers the case where user hasn't blurred)
            if (timerInputH) selH = _clampTimerInput(timerInputH, 24);
            if (timerInputM) selM = _clampTimerInput(timerInputM, 60);
            const total = (selH * 3600) + (selM * 60);
            if (total <= 0) {
                showToast('⏱ Please set a time before starting the timer', 3000);
                return;
            }
            _startSleepTimer(total);
        };

        // ── Quick-preset buttons (15m / 30m / 45m / 60m) ────────────────────
        const confirmPanel = document.getElementById('bz-preset-confirm');
        const confirmDur = document.getElementById('bz-confirm-duration');
        const confirmStartBtn = document.getElementById('bz-confirm-start-btn');
        const confirmBackBtn = document.getElementById('bz-confirm-back-btn');
        let _pendingPresetSecs = 0;

        // Label map for friendly display
        const _presetLabel = { 900: '15 minutes', 1800: '30 minutes', 2700: '45 minutes', 3600: '60 minutes' };

        function _showPresetConfirm(secs, btnEl) {
            // Highlight the chosen preset
            document.querySelectorAll('.bz-preset-btn').forEach(b => b.classList.remove('bz-preset-active'));
            btnEl.classList.add('bz-preset-active');
            _pendingPresetSecs = secs;

            // Hide wheels + main action row, show confirmation
            const wc = document.querySelector('.timer-columns-container');
            if (wc) wc.style.display = 'none';
            const orSection = document.getElementById('bz-timer-or-section');
            if (orSection) orSection.style.display = 'none';
            startTimerBtn.style.display = 'none';
            cancelTimerBtn.style.display = 'none';
            if (confirmDur) confirmDur.textContent = _presetLabel[secs] || `${Math.round(secs / 60)} minutes`;
            if (confirmPanel) confirmPanel.style.display = 'flex';
        }

        function _hidePresetConfirm() {
            if (confirmPanel) confirmPanel.style.display = 'none';
            document.querySelectorAll('.bz-preset-btn').forEach(b => b.classList.remove('bz-preset-active'));
            _pendingPresetSecs = 0;
            // Restore wheels and OR section
            const wc = document.querySelector('.timer-columns-container');
            if (wc) wc.style.display = 'flex';
            const orSection = document.getElementById('bz-timer-or-section');
            if (orSection) orSection.style.display = 'flex';
            startTimerBtn.style.display = 'block';
        }

        document.querySelectorAll('.bz-preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const secs = parseInt(btn.dataset.seconds, 10);
                if (!secs || secs <= 0) return;
                _showPresetConfirm(secs, btn);
            });
        });

        confirmStartBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!_pendingPresetSecs) return;
            _startSleepTimer(_pendingPresetSecs);
            if (confirmPanel) confirmPanel.style.display = 'none';
            // Popup stays open — countdown is now visible in-place
        });

        confirmBackBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            _hidePresetConfirm();
        });

        // Restore any sleep timer that was active before page refresh
        (function restoreSleepTimer() {
            // Timer always persists across refresh — no toggle needed
            const endTime = parseInt(localStorage.getItem('beatzen_sleep_timer_end'));
            if (!endTime || isNaN(endTime)) return;
            const remaining = Math.floor((endTime - Date.now()) / 1000);
            if (remaining <= 5) { localStorage.removeItem('beatzen_sleep_timer_end'); return; } // expired
            // Silently restart the countdown — no toast notification
            _startSleepTimer(remaining);
        })();

        cancelTimerBtn.onclick = resetTimerUI;
        closeTimerBtn.onclick = () => { _showTimerPopup(false); };
        document.getElementById('close-timer-ended')?.addEventListener('click', () => timerEndedPopup.classList.remove('visible'));

        // ── Mobile background / screen-lock re-sync ───────────────────────────
        // On Android & iOS, setInterval is suspended when the browser goes to
        // the background or the screen locks.  When the user returns we:
        //   (a) immediately check if the timer already expired and fire the end
        //       logic right away, or
        //   (b) restart the interval so the display catches up instantly.
        function _resyncTimerOnForeground() {
            const endTime = parseInt(localStorage.getItem('beatzen_sleep_timer_end'));
            if (!endTime || isNaN(endTime)) return; // no timer running
            const remaining = Math.floor((endTime - Date.now()) / 1000);
            if (remaining <= 0) {
                // Timer expired while we were in the background — fire end logic now
                clearInterval(timerInterval); timerInterval = null;
                audioPlayer.pause();
                updatePlayPauseIcon();
                resetTimerUI();
                timerEndedPopup.classList.add('visible');
            } else {
                // Timer still running — restart interval so display is immediate & accurate
                clearInterval(timerInterval); timerInterval = null;
                _startSleepTimer(remaining);
            }
        }
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') _resyncTimerOnForeground();
        });
        // pageshow fires on iOS bfcache restore (back-forward navigation)
        window.addEventListener('pageshow', (e) => {
            if (e.persisted) _resyncTimerOnForeground();
        });

        /* ── Auth Guard ──────────────────────────────────────────────────────── */
        function showBzAuthGate() {
            const gate = document.getElementById('bz-auth-gate');
            if (gate) gate.classList.add('bz-gate-visible');
            // Do NOT call displaySettings() here — the gate is a self-contained
            // overlay and must never trigger navigation or push history entries.

            // FIX: On a fresh install (no session, no cached album data),
            // displayHome() never renders any .album-card elements because
            // bzNavGuard blocks it — so _waitForCards' 1.5s poll always times
            // out before the loader hides, leaving a blank screen the whole
            // time. The auth gate IS the "ready" state for a logged-out user,
            // so hide the loader the instant the gate becomes visible.
            //
            // FIX 2: the line above used to run unconditionally for EVERY call
            // to showBzAuthGate(), bypassing _waitForReadyThenHide's own
            // _likelySignedIn gating entirely. Every current call site only
            // reaches this function once auth is genuinely resolved to "not
            // signed in", so in practice _bzLikelySignedIn() is false here —
            // but that invariant lives across several files (script.js +
            // auth.js) and is easy to break with a future call site. Checking
            // it here too is a cheap, local safety net: if this ever fires
            // for a user who still looks signed in, defer to the wait-loop's
            // own polling (which re-checks hasCards/gateVisible/_attempts)
            // instead of yanking the loader away immediately ourselves.
            if (typeof loaderHide === 'function' && !_bzLikelySignedIn()) {
                loaderHide();
            }
        }

        window.showBzAuthGate = showBzAuthGate;

        /* NAV LINKS
         * FIX: All protected nav links now wait for bzAuthReady before acting.
         * bzIsAuthenticated starts undefined (falsy) because Firebase onAuthStateChanged
         * is async. Without the wait, a page refresh blocks nav for signed-in users
         * until Firebase resolves (~100-300ms). bzAuthReady resolves in auth.js the
         * moment onAuthStateChanged fires for the first time, making the check reliable.
         */
        /* ── Wait for the REAL bzAuthReady promise, not a same-tick decoy ──────
         * FIX (root cause of "signed-in user sees the auth gate on every
         * load"): script.js is `defer`'d BEFORE auth.js in index.html, so on
         * a cache-hit boot (the normal repeat-visit path) this code can run
         * — and call bzNavGuard for the boot view-restore — before auth.js
         * has executed at all. At that moment window.bzAuthReady doesn't
         * exist yet, so `window.bzAuthReady || Promise.resolve()` silently
         * fell back to an ALREADY-RESOLVED promise instead of waiting for
         * Firebase. window.bzIsAuthenticated was still undefined (Firebase
         * hadn't even started resolving), so `!window.bzIsAuthenticated`
         * was true and showBzAuthGate() fired immediately — hiding the
         * loader and showing the Sign Up/Sign In gate for a fraction of a
         * second even for an already-signed-in user, every single load.
         * Fix: poll briefly (every 20ms, up to 2s) for window.bzAuthReady to
         * actually exist as a Promise before using it, instead of assuming
         * its absence means "nothing to wait for". */
        function _bzGetAuthReadyPromise() {
            if (window.bzAuthReady && typeof window.bzAuthReady.then === 'function') {
                return window.bzAuthReady;
            }
            return new Promise(function (resolve) {
                var _tries = 0;
                (function _poll() {
                    if (window.bzAuthReady && typeof window.bzAuthReady.then === 'function') {
                        window.bzAuthReady.then(resolve);
                    } else if (++_tries >= 100) {
                        // auth.js failed to load / Firebase SDK blocked — give up
                        // waiting rather than hang the UI forever.
                        resolve();
                    } else {
                        setTimeout(_poll, 20);
                    }
                })();
            });
        }

        function bzNavGuard(action) {
            // Fast-path: Firebase already resolved — act immediately.
            if (window.bzIsAuthenticated !== undefined) {
                if (!window.bzIsAuthenticated) { showBzAuthGate(); return; }
                action();
            } else {
                // Firebase is still resolving (~100-300 ms on page refresh).
                // Use localStorage session UID as a synchronous proxy for
                // 'user is signed in' — auth.js writes this on every sign-in
                // and clears it on sign-out, so it is always accurate.
                // This prevents the auth gate flashing on nav clicks for
                // already-signed-in users while Firebase resolves.
                //
                // FIX: also fall back to <html>'s class from the index.html
                // head fast-path (bz-signed-in / bz-guest), which scans for
                // any 'firebase:authUser:' key in addition to the plain
                // beatZen_session_uid fallback. If beatZen_session_uid was
                // somehow not yet written (e.g. very first sign-in tick) but
                // Firebase's own persisted session already exists, the head
                // script will have already set bz-signed-in before this
                // runs — checking it here closes that gap so the gate is
                // never shown for a user who is, in fact, already signed in.
                const _cachedUid = _bzLikelySignedIn();
                if (_cachedUid) {
                    // Optimistically run the action; confirm with Firebase async.
                    action();
                    _bzGetAuthReadyPromise().then(function () {
                        // If Firebase disagrees (e.g. token revoked), show the gate.
                        if (!window.bzIsAuthenticated) { showBzAuthGate(); }
                    });
                } else {
                    // No cached session — wait for Firebase before proceeding.
                    _bzGetAuthReadyPromise().then(function () {
                        if (!window.bzIsAuthenticated) { showBzAuthGate(); return; }
                        action();
                    });
                }
            }
        }

        if (homeLink) homeLink.onclick = (e) => {
            e.preventDefault();
            bzNavGuard(() => displayHome());
        };
        if (playlistsLink) playlistsLink.onclick = (e) => {
            e.preventDefault();
            bzNavGuard(() => displayPlaylists());
        };
        if (artistsLink) artistsLink.onclick = (e) => {
            e.preventDefault();
            bzNavGuard(() => displayArtists());
        };
        /* explore nav removed — explore content now renders inside displayPlaylists */
        if (settingsLink) settingsLink.onclick = (e) => {
            e.preventDefault();
            // Settings now requires sign-in like all other tabs.
            bzNavGuard(() => {
                const gate = document.getElementById('bz-auth-gate');
                if (gate) gate.classList.remove('bz-gate-visible');
                displaySettings();
            });
        };
        if (updatesLink) updatesLink.onclick = (e) => {
            e.preventDefault();
            bzNavGuard(() => displayUpdates());
        };
        if (searchLink) searchLink.onclick = (e) => {
            e.preventDefault();
            bzNavGuard(() => {
                hideAllViews();
                searchContainer?.classList.remove('hidden');
                if (searchResultsContainer) searchResultsContainer.style.display = 'block';
                updateNav('search');
                window._bzSpaNavDepth++; history.pushState({ view: 'search' }, '', '#search');
                if (actualSearchBar?.value.trim()) executeSearchLogic(actualSearchBar.value.toLowerCase().trim());
                setTimeout(() => actualSearchBar?.focus(), 100);
            });
        };

        /* PLAYLIST SYNC */
        window.syncPlaylistData = function () {
            const custom = window.masterPool.filter(p => p.isImported || String(p.id).startsWith('user-') || String(p.id).startsWith('imported-'));
            localStorage.setItem('beatZen_importedPlaylists', JSON.stringify(custom));
            if (window.location.hash === '#playlists') displayPlaylists(true);
        };

        /* SONG CONTEXT MENU */
        let selectedSongForModal = null;
        window.openSongMenu = (song, triggerEvent) => {
            selectedSongForModal = song;
            const modal = document.getElementById('playlist-modal');
            const content = modal.querySelector('.timer-popup-content');
            document.getElementById('modal-song-title').innerText = song.title;
            window.backToModalMain();

            /* ── Position the dropdown near the three-dot button ── */
            const MENU_W = 260;
            const PADDING = 16; // min gap from screen edges (16 keeps menu clear of scrollbar gutter)
            /* The navbar is position:fixed at the top of the viewport (height set by
               --nav-height, currently 70px) and sits above the menu in z-index, so the
               menu must never be clamped to a top value inside that band — otherwise it
               renders underneath/overlapping the navbar once the trigger button scrolls
               up near the top of the page. */
            /* When the fullscreen player is open, the navbar and mini player bar
               don't exist as separate fixed elements — the whole screen IS the player.
               Skip their safe-zone guards entirely in that case so the menu isn't
               immediately dismissed (btnCenter < NAV_H) or clipped (BOTTOM_SAFE). */
            const _fsPlayerOpen = !!document.getElementById('main-player')?.classList.contains('maximized');
            const NAV_H = _fsPlayerOpen ? 0 : (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 70);
            const TOP_SAFE = _fsPlayerOpen ? 6 : (NAV_H + 6);
            /* Same idea at the bottom — the player bar is position:fixed with height
               --player-height (120px), so once the trigger button scrolls under it,
               the button itself is no longer visible/clickable and the menu should
               close rather than stay pinned above the player bar pointing at nothing. */
            const PLAYER_H = _fsPlayerOpen ? 0 : (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--player-height')) || 120);
            const BOTTOM_SAFE = _fsPlayerOpen ? 6 : (PLAYER_H + 6);

            /* ── Capture button element synchronously (currentTarget becomes null after async) ── */
            const _triggerBtn = triggerEvent ? (triggerEvent.currentTarget || triggerEvent.target) : null;
            /* ── Also remember a stable lookup so we can re-resolve the button if the
               originally-captured node ever goes stale/detached (e.g. its row gets
               re-rendered while the menu is open). A detached node still returns a
               DOMRect from getBoundingClientRect(), but it's frozen at {0,0,0,0} —
               which previously caused the menu to silently stick in place while the
               page scrolled underneath it instead of tracking the button. ── */
            const _songId = song && song.id != null ? String(song.id) : null;

            function resolveTriggerBtn() {
                // FIX: previously always preferred the same-songId list-row lookup,
                // even when the original trigger button (_triggerBtn) was still
                // perfectly valid. That lookup is meant to recover from a stale/
                // detached node when a LIST ROW gets re-rendered while the menu is
                // open — but it breaks when the menu is opened from something that
                // is NOT a list row at all, e.g. the fullscreen player's three-dot
                // ("More Options") button. In that case _songId still matches the
                // currently playing song, and document.querySelector happily finds
                // some OTHER, unrelated .song-item for that same song elsewhere on
                // the page (a Home-page card, a queue entry, a history row) — and
                // the menu ends up anchored to that random element's position
                // instead of the button the user actually clicked. Now: trust the
                // originally-captured trigger first as long as it's still
                // connected; only fall back to the songId re-lookup once it
                // genuinely goes stale.
                if (_triggerBtn && _triggerBtn.isConnected) return _triggerBtn;
                if (_songId) {
                    const row = document.querySelector(`.song-item[data-song-id="${CSS.escape(_songId)}"]`);
                    const liveBtn = row && row.querySelector('.song-menu-btn');
                    if (liveBtn && liveBtn.isConnected) return liveBtn;
                }
                return _triggerBtn; // last resort — may be detached
            }

            function positionMenu() {
                const btn = resolveTriggerBtn();
                if (!btn) return;
                const rect = btn.getBoundingClientRect();
                // A detached/invisible node reports an all-zero rect — bail out rather
                // than positioning the menu at a meaningless (0,0) coordinate.
                if (!btn.isConnected || (rect.top === 0 && rect.bottom === 0 && rect.left === 0 && rect.right === 0)) {
                    return;
                }
                // Use clientWidth/clientHeight — excludes the scrollbar-gutter space
                // that window.innerWidth counts but that fixed elements can't safely use
                // (scrollbar-gutter:stable in style.css always reserves ~17px on the right).
                const vw = document.documentElement.clientWidth;
                const vh = document.documentElement.clientHeight;

                // The button's own anchor point (its vertical center) is what the menu
                // is "pointing at". Once that point scrolls behind the fixed navbar or
                // the fixed player bar, the button is no longer visible/tappable, so
                // keeping the menu open (pinned to the nearest safe edge) would leave
                // it floating with nothing for the user to actually see it anchored
                // to. Close it automatically instead.
                const btnCenter = rect.top + rect.height / 2;
                if (btnCenter < NAV_H || btnCenter > vh - PLAYER_H) {
                    window.closePlaylistModal();
                    return;
                }

                // Measure actual rendered dimensions (border adds ~2px beyond CSS width).
                // Cap width so menu can never exceed the usable viewport.
                content.style.position = 'fixed';
                content.style.visibility = 'hidden';
                content.style.top = '0px';
                content.style.left = '0px';
                content.style.maxWidth = (vw - PADDING * 2) + 'px';
                const actualH = content.offsetHeight || 320;
                const actualW = content.offsetWidth || MENU_W;
                content.style.visibility = '';

                // Prefer below button, flip above if not enough space below
                let top = rect.bottom + 6;
                if (top + actualH > vh - PADDING) {
                    top = rect.top - actualH - 6;
                }
                // Clamp below the fixed navbar / above the fixed player bar (not the
                // bare screen edge) so the menu never renders underneath either.
                if (top < TOP_SAFE) top = TOP_SAFE;
                if (top + actualH > vh - BOTTOM_SAFE) {
                    top = Math.max(TOP_SAFE, vh - BOTTOM_SAFE - actualH);
                }

                // Horizontal: align right edge to button, clamp to usable viewport.
                // Uses clientWidth (scrollbar-gutter excluded) so the menu never
                // slides behind the reserved scrollbar space on the right.
                let left = rect.right - actualW;
                if (left < PADDING) left = PADDING;
                if (left + actualW > vw - PADDING) left = vw - actualW - PADDING;

                content.style.top = top + 'px';
                content.style.left = left + 'px';
                content.style.margin = '0';
                content.style.maxHeight = (vh - top - BOTTOM_SAFE) + 'px';
                content.style.maxWidth = (vw - PADDING * 2) + 'px';
                content.style.overflowY = 'auto';
            }

            modal.style.display = 'flex';
            modal.classList.add('visible');
            // Position after display so dimensions are measurable
            requestAnimationFrame(() => positionMenu());

            /* ── Reposition on scroll so menu tracks the button ──
               rAF-throttled: smooth scrolling (html { scroll-behavior: smooth })
               can fire many scroll events per animation frame; without throttling,
               redundant layout reads/writes pile up and the menu visibly lags
               behind the button instead of tracking it smoothly. ── */
            let _scrollRaf = null;
            function onScroll() {
                if (_scrollRaf) return;
                _scrollRaf = requestAnimationFrame(() => {
                    _scrollRaf = null;
                    positionMenu();
                });
            }
            window.addEventListener('scroll', onScroll, { passive: true });

            /* ── Close on outside click (transparent overlay or outside content) ── */
            function onOutsideClick(e) {
                if (!content.contains(e.target)) {
                    window.closePlaylistModal();
                }
            }
            /* Also close when clicking the transparent overlay background directly */
            modal.onclick = (e) => { if (e.target === modal) window.closePlaylistModal(); };
            /* Use setTimeout so this click doesn't immediately trigger close */
            setTimeout(() => document.addEventListener('click', onOutsideClick), 0);

            /* ── Close on Escape ── */
            function onEscape(e) {
                if (e.key === 'Escape') window.closePlaylistModal();
            }
            document.addEventListener('keydown', onEscape);

            /* ── Store cleanup refs on modal for closePlaylistModal to remove ── */
            modal._bzCleanup = () => {
                window.removeEventListener('scroll', onScroll);
                document.removeEventListener('click', onOutsideClick);
                document.removeEventListener('keydown', onEscape);
                if (_scrollRaf) { cancelAnimationFrame(_scrollRaf); _scrollRaf = null; }
                modal._bzCleanup = null;
            };

            // Wire up "Song Info" button
            const songInfoBtn = document.getElementById('modal-song-info-btn');
            if (songInfoBtn) {
                const fresh = songInfoBtn.cloneNode(true);
                songInfoBtn.parentNode.replaceChild(fresh, songInfoBtn);
                fresh.onclick = () => {
                    window.closePlaylistModal();
                    window.openSongInfoPanel(selectedSongForModal);
                };
            }

            // Wire up "Share Song Card" button
            const shareSongBtn = document.getElementById('modal-share-song-btn');
            if (shareSongBtn) {
                const fresh = shareSongBtn.cloneNode(true);
                shareSongBtn.parentNode.replaceChild(fresh, shareSongBtn);
                fresh.onclick = () => {
                    window.closePlaylistModal();
                    if (typeof window.openShareSongModal === 'function') {
                        window.openShareSongModal(selectedSongForModal);
                    }
                };
            }

            // Wire up "Copy Song Link" button
            const copyLinkBtn = document.getElementById('modal-copy-link-btn');
            if (copyLinkBtn) {
                const fresh = copyLinkBtn.cloneNode(true);
                copyLinkBtn.parentNode.replaceChild(fresh, copyLinkBtn);
                fresh.onclick = () => {
                    window.closePlaylistModal();
                    const s = selectedSongForModal;
                    if (!s) return;
                    const songLink = `${location.origin}${location.pathname}#song-${s.id}`;
                    if (navigator.clipboard) {
                        navigator.clipboard.writeText(songLink).then(() => showToast('✓ Song link copied!')).catch(() => fallbackCopy(songLink));
                    } else { fallbackCopy(songLink); }
                    function fallbackCopy(t) {
                        const ta = Object.assign(document.createElement('textarea'), { value: t });
                        Object.assign(ta.style, { position: 'fixed', opacity: '0' });
                        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
                        showToast('✓ Song link copied!');
                    }
                };
            }

            // Wire up "Show Lyrics" button
            const showLyricsBtn = document.getElementById('modal-show-lyrics-btn');
            if (showLyricsBtn) {
                const fresh = showLyricsBtn.cloneNode(true);
                showLyricsBtn.parentNode.replaceChild(fresh, showLyricsBtn);
                fresh.onclick = () => {
                    window.closePlaylistModal();
                    const s = selectedSongForModal;
                    if (s && typeof window.bzShowLyrics === 'function') {
                        window.bzShowLyrics(s.id || '', s.title || '', s.artist || '', s.movie || window.playingAlbum?.title || window.playingAlbum?.name || '');
                    }
                };
            }

            // Wire up Play Next button each time menu opens
            const playNextBtn = document.getElementById('modal-play-next-btn');
            if (playNextBtn) {
                // Clone to remove old listeners
                const fresh = playNextBtn.cloneNode(true);
                playNextBtn.parentNode.replaceChild(fresh, playNextBtn);
                fresh.onclick = () => {
                    if (!selectedSongForModal) return;
                    // If nothing is playing yet, just play the song directly
                    if (!window.playingAlbum) {
                        // Find the album that owns this song
                        const songData = window.allSongsMap.get(String(selectedSongForModal.id));
                        if (songData?.album) {
                            window.playingAlbum = window.resolveData(songData.album, songData.album.type || 'Movie');
                            window.playSong(0);
                        }
                        window.closePlaylistModal();
                        return;
                    }
                    // Insert the song right after the currently playing index
                    const insertAt = window.currentSongIndex + 1;
                    // Avoid duplicate adjacent songs
                    const songs = window.playingAlbum.songs;
                    const alreadyNext = songs[insertAt] && String(songs[insertAt].id) === String(selectedSongForModal.id);
                    if (!alreadyNext) {
                        songs.splice(insertAt, 0, selectedSongForModal);
                        // Rebuild map so new position is tracked
                        window.rebuildMasterMap();
                    }
                    window.closePlaylistModal();
                    // Refresh queue overlay if it's open
                    if (typeof window.renderFullscreenQueue === 'function') {
                        window.renderFullscreenQueue();
                    }
                    // Show toast feedback
                    showToast(`"${selectedSongForModal.title}" will play next`);
                };
            }

            // Wire up Add to End of Queue button each time menu opens
            const addEndBtn = document.getElementById('modal-add-end-btn');
            if (addEndBtn) {
                const freshEnd = addEndBtn.cloneNode(true);
                addEndBtn.parentNode.replaceChild(freshEnd, addEndBtn);
                freshEnd.onclick = () => {
                    if (!selectedSongForModal) return;
                    if (!window.playingAlbum) {
                        // Nothing playing — start the song
                        const songData = window.allSongsMap.get(String(selectedSongForModal.id));
                        if (songData?.album) {
                            window.playingAlbum = window.resolveData(songData.album, songData.album.type || 'Movie');
                            window.playSong(0);
                        }
                        window.closePlaylistModal();
                        return;
                    }
                    const songs = window.playingAlbum.songs;
                    // Avoid exact duplicate at the very end
                    const lastSong = songs[songs.length - 1];
                    const alreadyLast = lastSong && String(lastSong.id) === String(selectedSongForModal.id);
                    if (!alreadyLast) {
                        songs.push(selectedSongForModal);
                        window.rebuildMasterMap();
                    }
                    window.closePlaylistModal();
                    if (typeof window.renderFullscreenQueue === 'function') {
                        window.renderFullscreenQueue();
                    }
                    showToast(`"${selectedSongForModal.title}" added to end of queue`);
                };
            }

            // ── Remove from Playlist: only visible when inside a user/imported playlist ──
            const removeFromPlBtn = document.getElementById('modal-remove-from-playlist-btn');
            if (removeFromPlBtn) {
                const freshRfp = removeFromPlBtn.cloneNode(true);
                removeFromPlBtn.parentNode.replaceChild(freshRfp, removeFromPlBtn);

                const _curAlbum = window.currentAlbum;
                const _isUserPl = _curAlbum &&
                    _curAlbum.type === 'Playlist' &&
                    (String(_curAlbum.id).startsWith('user-') ||
                        String(_curAlbum.id).startsWith('imported-') ||
                        _curAlbum._isFavourites);

                freshRfp.style.display = _isUserPl ? 'flex' : 'none';

                freshRfp.onclick = () => {
                    if (!selectedSongForModal || !_curAlbum) return;
                    window.closePlaylistModal();

                    const _songTitle = selectedSongForModal.title || 'Song';
                    const _plName = _curAlbum.name || _curAlbum.title || 'Playlist';

                    // Splice song from masterPool entry
                    const _poolEntry = (window.masterPool || []).find(function (p) {
                        return String(p.id) === String(_curAlbum.id);
                    });
                    if (_poolEntry && Array.isArray(_poolEntry.songs)) {
                        var _pi = _poolEntry.songs.findIndex(function (s) {
                            return String(s.id) === String(selectedSongForModal.id);
                        });
                        if (_pi !== -1) { _poolEntry.songs.splice(_pi, 1); }
                    }
                    // Also splice from currentAlbum.songs
                    if (Array.isArray(_curAlbum.songs)) {
                        var _ci = _curAlbum.songs.findIndex(function (s) {
                            return String(s.id) === String(selectedSongForModal.id);
                        });
                        if (_ci !== -1) { _curAlbum.songs.splice(_ci, 1); }
                    }

                    // Persist to localStorage
                    if (typeof window.syncPlaylistData === 'function') {
                        window.syncPlaylistData();
                    }

                    // Refresh album view so the removed song row disappears
                    if (typeof window.selectAlbum === 'function') {
                        window.selectAlbum(_curAlbum, true);
                    }

                    showToast('"' + _songTitle + '" removed from ' + _plName);
                };
            }

        };

        /* ═══════════════════════════════════════════════════════════════════════
         *  ADVANCED PATTERN MATCHING ENGINE — Dynamic Song Import
         * ═══════════════════════════════════════════════════════════════════════
         * Multi-strategy matcher used when importing a playlist and we need to
         * find a BeatZen song object from a bare title/artist string.
         *
         * Strategies (applied in order, first match above threshold wins):
         *   1. Exact ID match          — score 1.00
         *   2. Exact title + artist    — score 0.95
         *   3. Normalized title match  — score 0.85  (strip punct, lowercase)
         *   4. Bigram similarity       — score ≥ 0.65 (Dice coefficient on bigrams)
         *   5. Token subset match      — score 0.60  (all query tokens in candidate)
         *
         * Returns { song, album, score } or null if best score < MIN_THRESHOLD.
         * ═══════════════════════════════════════════════════════════════════════
         */
        window.matchSongAdvanced = (function () {
            const MIN_THRESHOLD = 0.55;

            function normalize(str) {
                if (!str) return '';
                return str.toLowerCase()
                    .replace(/[''`]/g, "'")
                    .replace(/[^a-z0-9 ']/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
            }

            function bigrams(str) {
                const s = normalize(str).replace(/\s/g, '');
                const bg = new Set();
                for (let i = 0; i < s.length - 1; i++) bg.add(s[i] + s[i + 1]);
                return bg;
            }

            function diceSimilarity(a, b) {
                const bgA = bigrams(a), bgB = bigrams(b);
                if (!bgA.size || !bgB.size) return 0;
                let inter = 0;
                bgA.forEach(g => { if (bgB.has(g)) inter++; });
                return (2 * inter) / (bgA.size + bgB.size);
            }

            function tokenSubset(query, candidate) {
                const qTokens = normalize(query).split(' ').filter(Boolean);
                const cNorm = normalize(candidate);
                return qTokens.length > 0 && qTokens.every(t => cNorm.includes(t));
            }

            return function matchSong(titleQuery, artistQuery, idQuery) {
                let best = null, bestScore = 0;
                const normTitle = normalize(titleQuery || '');
                const normArtist = normalize(artistQuery || '');

                window.allSongsMap.forEach((entry, songId) => {
                    const song = entry;
                    const album = entry.album;
                    let score = 0;

                    // 1. Exact ID
                    if (idQuery && String(idQuery) === songId) {
                        score = 1.00;
                    }
                    // 2. Exact title + artist
                    else if (normTitle && normalize(song.title) === normTitle &&
                        normArtist && normalize(song.artist) === normArtist) {
                        score = 0.95;
                    }
                    // 3. Normalized title only
                    else if (normTitle && normalize(song.title) === normTitle) {
                        score = 0.85;
                    }
                    // 4. Bigram similarity (title + artist combined)
                    else {
                        const queryStr = normTitle + (normArtist ? ' ' + normArtist : '');
                        const candStr = normalize(song.title) + ' ' + normalize(song.artist || '');
                        const sim = diceSimilarity(queryStr, candStr);
                        if (sim >= 0.65) {
                            score = sim * 0.90; // scale down slightly vs exact matches
                        }
                        // 5. Token subset fallback
                        else if (normTitle && tokenSubset(normTitle, song.title)) {
                            score = 0.60;
                        }
                    }

                    if (score > bestScore) {
                        bestScore = score;
                        best = { song, album, score };
                    }
                });

                return best && bestScore >= MIN_THRESHOLD ? best : null;
            };
        })();

        document.getElementById('confirm-create-btn')?.addEventListener('click', () => {
            const nameInput = document.getElementById('new-playlist-name');
            const name = nameInput.value.trim();
            if (!name) { document.getElementById('new-playlist-name')?.focus(); return; }
            // Create a shallow copy of the selected song — don't share references
            const songCopy = selectedSongForModal ? { ...selectedSongForModal } : null;
            const pl = {
                id: 'user-' + Date.now(),
                name,
                title: name,
                albumCover: "https://res.cloudinary.com/beatzenapp/image/upload/v1782654641/Logo_kmpfjf.jpg",
                songs: songCopy ? [songCopy] : [],
                type: "Playlist",
                isImported: true
            };
            window.masterPool.push(pl);
            window.syncPlaylistData();
            window.closePlaylistModal();
            showToast(`✓ Playlist "${name}" created`);
        });

        window.showAddToPlaylistUI = () => {
            const listContainer = document.getElementById('existing-playlists-list');
            const saved = JSON.parse(localStorage.getItem('beatZen_importedPlaylists') || '[]');
            document.getElementById('modal-main-options').style.display = 'none';
            document.getElementById('modal-list-ui').style.display = 'block';
            listContainer.innerHTML = saved.length
                ? ''
                : '<p style="text-align:center;padding:10px;font-size:0.8rem;opacity:0.6;">No playlists created yet.</p>';
            saved.forEach(pl => {
                const div = document.createElement('div');
                div.style = "display:flex;justify-content:space-between;align-items:center;padding:10px;border-bottom:1px solid rgba(255,255,255,0.05);";
                div.innerHTML = `<span style="font-size:0.9rem;color:white;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px;">${_bzEscapeHTML(pl.name)}</span><button data-pl-id="${pl.id}" style="background:#2575fc;border:none;color:white;padding:5px 12px;border-radius:5px;font-size:0.8rem;cursor:pointer;">Add</button>`;
                div.querySelector('button').addEventListener('click', () => window.addSongToPlaylistID(pl.id));
                listContainer.appendChild(div);
            });
        };

        window.addSongToPlaylistID = (id) => {
            const target = window.masterPool.find(p => String(p.id) === String(id));
            if (target) {
                const alreadyIn = target.songs.some(s => String(s.id || s) === String(selectedSongForModal.id));
                if (alreadyIn) {
                    bzAlert("info", "Already Added", "This song is already in this playlist.");
                } else {
                    // Push a SHALLOW COPY so mutations on this playlist's song object
                    // don't bleed into other playlists or artist views that share the
                    // same song reference via allSongsMap.
                    target.songs.push({ ...selectedSongForModal });
                    window.rebuildMasterMap();
                    window.syncPlaylistData();
                    showToast(`✓ Added to "${target.name}"`);

                    /* ── Record 'add_playlist' signal ────────────────────────────────────
                       Adding a song to a playlist is a high-intent positive action
                       (weight +3 in buildSignalScores).  Write it here so smart playlists
                       (Daily Mix, For You, Liked) can actually learn from this habit. */
                    try {
                        const BZ_SIGNALS_KEY = 'beatZen_signals';
                        let signals = [];
                        try { signals = JSON.parse(localStorage.getItem(BZ_SIGNALS_KEY) || '[]'); } catch (_) { /* ignore */ }
                        signals.unshift({ id: String(selectedSongForModal.id), signal: 'add_playlist', ts: Date.now() });
                        signals = signals.slice(0, 500);
                        localStorage.setItem(BZ_SIGNALS_KEY, JSON.stringify(signals));
                    } catch (_apErr) { /* silent — never break playlist save */ }
                }
            }
            window.closePlaylistModal();
        };

        window.showCreatePlaylistUI = () => {
            window.closePlaylistModal();
            bzInput('playlist', 'New Playlist', 'Enter playlist name...', (name) => {
                const songCopy = selectedSongForModal ? { ...selectedSongForModal } : null;
                const pl = {
                    id: 'user-' + Date.now(), name, title: name,
                    albumCover: 'https://res.cloudinary.com/beatzenapp/image/upload/v1782654641/Logo_kmpfjf.jpg',
                    songs: songCopy ? [songCopy] : [], type: 'Playlist', isImported: true
                };
                window.masterPool.push(pl);
                window.syncPlaylistData();
                showToast(`✓ Playlist "${name}" created`);
            });
        };
        window.backToModalMain = () => {
            document.getElementById('modal-main-options').style.display = 'block';
            document.getElementById('modal-create-ui').style.display = 'none';
            document.getElementById('modal-list-ui').style.display = 'none';
            document.getElementById('new-playlist-name').value = '';
            // Inject extra buttons if not present
            if (!document.getElementById('modal-song-info-btn')) {
                const mainOpts = document.getElementById('modal-main-options');
                if (mainOpts) {
                    // Share Song Card
                    const shareBtn = document.createElement('button');
                    shareBtn.id = 'modal-share-song-btn';
                    shareBtn.innerHTML = '<i class="fas fa-share-nodes"></i> Share Song Card';
                    mainOpts.appendChild(shareBtn);

                    // Copy Song Link
                    const copyBtn = document.createElement('button');
                    copyBtn.id = 'modal-copy-link-btn';
                    copyBtn.innerHTML = '<i class="fas fa-link"></i> Copy Song Link';
                    mainOpts.appendChild(copyBtn);

                    // Song Info
                    const infoBtn = document.createElement('button');
                    infoBtn.id = 'modal-song-info-btn';
                    infoBtn.innerHTML = '<i class="fas fa-info-circle"></i> Song Info';
                    mainOpts.appendChild(infoBtn);

                    // Show Lyrics — always last
                    const lyricsBtn = document.createElement('button');
                    lyricsBtn.id = 'modal-show-lyrics-btn';
                    lyricsBtn.innerHTML = '<i class="fas fa-align-left"></i> Show Lyrics';
                    mainOpts.appendChild(lyricsBtn);
                }
            }
        };
        /* ═══════════════════════════════════════════════════
         *  SONG INFO PANEL — uses sheet data only (no external fetch)
         * ═══════════════════════════════════════════════════ */
        window.openSongInfoPanel = function (song) {
            // Remove existing panel if any
            const existing = document.getElementById('bz-song-info-overlay');
            if (existing) existing.remove();

            const overlay = document.createElement('div');
            overlay.id = 'bz-song-info-overlay';
            overlay.className = 'bz-song-info-overlay';
            overlay.innerHTML = `
                <div class="bz-song-info-panel" id="bz-song-info-panel">
                    <div class="bz-si-header">
                        <span class="bz-si-title">Song Info</span>
                        <button class="bz-si-close" id="bz-si-close-btn" aria-label="Close"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="bz-si-body" id="bz-si-body"></div>
                </div>`;
            document.body.appendChild(overlay);
            requestAnimationFrame(() => overlay.classList.add('visible'));

            document.getElementById('bz-si-close-btn').onclick = () => {
                overlay.classList.remove('visible');
                setTimeout(() => overlay.remove(), 280);
            };
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.classList.remove('visible');
                    setTimeout(() => overlay.remove(), 280);
                }
            });

            // Always use sheet data — songTitle and movieTitle from Google Sheet
            const albumData = window.allSongsMap?.get(String(song.id))?.album || song._sourceAlbum || window.playingAlbum || {};
            const data = {
                trackName: song.title || '—',
                artistName: song.artist || '—',
                albumName: albumData.title || albumData.name || '—',
                duration: song.duration || '—',
                releaseDate: albumData.year ? String(albumData.year) : '—',
                artwork: albumData.imageUrl || albumData.albumCover || ''
            };

            const body = document.getElementById('bz-si-body');
            if (!body) return;
            const rows = [
                { icon: 'fa-music', label: 'Track', value: data.trackName },
                { icon: 'fa-microphone-alt', label: 'Artist', value: data.artistName },
                { icon: 'fa-compact-disc', label: 'Album', value: data.albumName },
                { icon: 'fa-calendar-alt', label: 'Released', value: data.releaseDate },
                { icon: 'fa-clock', label: 'Duration', value: data.duration },
            ];
            body.innerHTML = `
                ${data.artwork ? `<div class="bz-si-artwork-wrap"><img src="${data.artwork}" class="bz-si-artwork" alt="Album Art"></div>` : ''}
                <div class="bz-si-rows">
                    ${rows.map(r => `
                        <div class="bz-si-row">
                            <div class="bz-si-row-icon"><i class="fas ${r.icon}"></i></div>
                            <div class="bz-si-row-content">
                                <span class="bz-si-row-label">${r.label}</span>
                                <span class="bz-si-row-value">${r.value}</span>
                            </div>
                        </div>`).join('')}
                </div>
            `;
        };

        window.closePlaylistModal = () => {
            const m = document.getElementById('playlist-modal');
            m.style.display = 'none';
            m.classList.remove('visible');
            /* Remove scroll / outside-click / escape listeners */
            if (typeof m._bzCleanup === 'function') m._bzCleanup();
        };

        /* ═══════════════════════════════════════════════════════════════════
         *  FAVOURITES ENGINE
         *  – Persists liked songs to localStorage under 'beatZen_favourites'
         *  – Creates / updates a "Favourites" playlist in masterPool + storage
         *  – Wires the #modal-fav-btn in the song context menu
         * ═══════════════════════════════════════════════════════════════════ */
        (function initFavouritesEngine() {
            const BZ_FAV_KEY = 'beatZen_favourites';
            const BZ_FAV_PLAYLIST_ID = 'bz-favourites-playlist';
            const BZ_FAV_HEART_IMG = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwIiB5MT0iMCIgeDI9IjEiIHkyPSIxIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjZjQzZjVlIi8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjYmUxMjNjIi8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIGZpbGw9InVybCgjZykiLz48cGF0aCB0cmFuc2Zvcm09InRyYW5zbGF0ZSgxMjgsMTM2KSBzY2FsZSgwLjUpIiBkPSJNNDcuNiAzMDAuNEwyMjguMyA0NjkuMWM3LjUgNyAxNy40IDEwLjkgMjcuNyAxMC45czIwLjItMy45IDI3LjctMTAuOUw0NjQuNCAzMDAuNGMzMC40LTI4LjMgNDcuNi02OCA0Ny42LTEwOS41di01LjhjMC02OS45LTUwLjUtMTI5LjUtMTE5LjQtMTQxQzM0NyAzNi41IDMwMC42IDUxLjQgMjY4IDg0TDI1NiA5NiAyNDQgODRjLTMyLjYtMzIuNi03OS00Ny41LTEyNC42LTM5LjlDNTAuNSA1NS42IDAgMTE1LjIgMCAxODUuMXY1LjhjMCA0MS41IDE3LjIgODEuMiA0Ny42IDEwOS41eiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjkyKSIvPjwvc3ZnPg==';

            function sanitizeHTML(str) {
                const d = document.createElement('div');
                d.textContent = String(str ?? '');
                return d.innerHTML;
            }

            /* ── Storage helpers ── */
            function loadFavourites() {
                try { return JSON.parse(localStorage.getItem(BZ_FAV_KEY) || '[]'); } catch (_) { return []; }
            }
            function saveFavourites(list) {
                localStorage.setItem(BZ_FAV_KEY, JSON.stringify(list));
            }
            function isFavourite(songId) {
                return loadFavourites().some(s => String(s.id || s) === String(songId));
            }

            /* ── Sync playlist into masterPool + localStorage ── */
            function syncFavouritesPlaylist() {
                const favs = loadFavourites();
                if (!window.masterPool) return;

                // Remove any stale instance
                let idx;
                while ((idx = window.masterPool.findIndex(p => p.id === BZ_FAV_PLAYLIST_ID)) !== -1) {
                    window.masterPool.splice(idx, 1);
                }

                try {
                    const saved = JSON.parse(localStorage.getItem('beatZen_importedPlaylists') || '[]');
                    const filtered = saved.filter(p => p.id !== BZ_FAV_PLAYLIST_ID);

                    if (favs.length === 0) {
                        localStorage.setItem('beatZen_importedPlaylists', JSON.stringify(filtered));
                        _refreshPlaylistsView();
                        return;
                    }

                    const favPlaylist = {
                        id: BZ_FAV_PLAYLIST_ID,
                        name: 'Favourites',
                        title: 'Favourites',
                        albumCover: BZ_FAV_HEART_IMG,
                        imageUrl: BZ_FAV_HEART_IMG,
                        songs: favs.map(s => ({ ...s })),
                        type: 'Playlist',
                        isImported: true,
                        _isFavourites: true
                    };

                    // Insert at front of Playlist section in masterPool
                    const firstPLIdx = window.masterPool.findIndex(p => p.type === 'Playlist');
                    if (firstPLIdx >= 0) {
                        window.masterPool.splice(firstPLIdx, 0, favPlaylist);
                    } else {
                        window.masterPool.unshift(favPlaylist);
                    }

                    // Persist to localStorage at position 0
                    filtered.unshift(favPlaylist);
                    localStorage.setItem('beatZen_importedPlaylists', JSON.stringify(filtered));
                } catch (_) { }

                _refreshPlaylistsView();
            }

            function _refreshPlaylistsView() {
                if (typeof window.syncPlaylistData === 'function') window.syncPlaylistData();
                setTimeout(() => {
                    if (typeof window.displayPlaylists === 'function') {
                        const view = window.lastActiveView || '';
                        const onPlaylists = view === 'playlists' ||
                            document.getElementById('playlists-view')?.classList.contains('active') ||
                            document.getElementById('playlists-container')?.closest('.view')?.classList.contains('active');
                        if (onPlaylists) window.displayPlaylists(true);
                    }
                }, 80);
            }

            /* ── Core actions ── */
            function addFavourite(song) {
                const favs = loadFavourites();
                if (favs.some(s => String(s.id || s) === String(song.id))) return;
                favs.unshift({ ...song });
                saveFavourites(favs);
                syncFavouritesPlaylist();
                _showFavToast(song.title, true);
                // Instantly push to cloud (if signed in & auto-sync on, or manual)
                setTimeout(() => { try { window.bzSilentUpload?.(); } catch (_) { } }, 200);
            }

            function removeFavourite(songId) {
                const favs = loadFavourites();
                const i = favs.findIndex(s => String(s.id || s) === String(songId));
                if (i === -1) return;
                const removed = favs[i];
                favs.splice(i, 1);
                saveFavourites(favs);
                syncFavouritesPlaylist();
                _showFavToast(removed.title || 'Song', false);
                // Instantly push to cloud (if signed in & auto-sync on, or manual)
                setTimeout(() => { try { window.bzSilentUpload?.(); } catch (_) { } }, 200);
            }

            function toggleFavourite(song) {
                if (isFavourite(song.id)) {
                    removeFavourite(song.id);
                } else {
                    addFavourite(song);
                }
                // Refresh queue if open
                if (typeof window.renderFullscreenQueue === 'function') window.renderFullscreenQueue();
            }

            /* ── Toast ── */
            function _showFavToast(songTitle, isAdded) {
                const container = document.getElementById('toast-container');
                if (!container) return;
                container.querySelector('.bz-fav-toast')?.remove();

                const toast = document.createElement('div');
                toast.className = 'bz-fav-toast';
                toast.innerHTML = `
                    <div class="bz-fav-toast-icon"><i class="fas fa-heart"></i></div>
                    <div class="bz-fav-toast-text">
                        <span class="bz-fav-toast-label">${isAdded ? 'Added to Favourites' : 'Removed from Favourites'}</span>
                        <span class="bz-fav-toast-song">${sanitizeHTML(songTitle || 'Song')}</span>
                    </div>`;

                container.appendChild(toast);
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    toast.style.opacity = '1';
                    toast.style.transform = 'translateY(0) scale(1)';
                }));

                const timer = setTimeout(() => {
                    toast.style.opacity = '0';
                    toast.style.transform = 'translateY(8px) scale(0.96)';
                    setTimeout(() => toast.remove(), 300);
                }, 3500);

                toast.addEventListener('click', () => {
                    clearTimeout(timer);
                    toast.style.opacity = '0';
                    toast.style.transform = 'translateY(8px) scale(0.96)';
                    setTimeout(() => toast.remove(), 280);
                }, { once: true });
            }

            /* ── Modal button wiring ── */
            function updateFavModalBtn(song) {
                const btn = document.getElementById('modal-fav-btn');
                if (!btn) return;
                if (song) btn._bzSongData = song;
                const songData = btn._bzSongData || window._bzMenuSong;
                if (!songData || !songData.id) return;
                const label = document.getElementById('modal-fav-btn-label');
                const icon = btn.querySelector('i');
                const favd = isFavourite(songData.id);
                if (label) label.textContent = favd ? 'Remove from Favourites' : 'Add to Favourites';
                if (icon) icon.className = (favd ? 'fas' : 'far') + ' fa-heart bz-fav-modal-icon';
                btn.classList.toggle('bz-fav-modal-btn--active', favd);
            }

            function wireFavModalBtn() {
                const btn = document.getElementById('modal-fav-btn');
                if (!btn || btn._bzWired) return;
                btn._bzWired = true;
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const songData = btn._bzSongData || window._bzMenuSong;
                    if (!songData || !songData.id) return;
                    toggleFavourite(songData);
                    updateFavModalBtn(songData);
                    setTimeout(() => {
                        if (typeof window.closePlaylistModal === 'function') window.closePlaylistModal();
                    }, 120);
                });
            }

            // Patch openSongMenu to capture song and refresh button
            function patchOpenSongMenuForFav() {
                if (window._bzFavMenuPatched) return;
                if (!window.openSongMenu) return;
                const _orig = window.openSongMenu;
                window.openSongMenu = function (song, triggerEvent) {
                    window._bzMenuSong = song;
                    const result = _orig.apply(this, arguments);
                    setTimeout(() => updateFavModalBtn(song), 0);
                    return result;
                };
                window._bzFavMenuPatched = true;
            }

            // MutationObserver safety net
            function watchModalForFav() {
                const modal = document.getElementById('playlist-modal');
                if (!modal) return;
                const obs = new MutationObserver(() => {
                    const isVisible = modal.style.display === 'flex' || modal.classList.contains('visible');
                    if (isVisible && window._bzMenuSong) updateFavModalBtn(window._bzMenuSong);
                });
                obs.observe(modal, { attributes: true, attributeFilter: ['style', 'class'] });
            }

            /* ── Boot ── */
            wireFavModalBtn();
            watchModalForFav();
            patchOpenSongMenuForFav();
            setTimeout(() => { wireFavModalBtn(); patchOpenSongMenuForFav(); }, 100);

            // Sync on load so Favourites playlist survives refresh
            setTimeout(() => syncFavouritesPlaylist(), 600);

            /* ── Expose globals (used by beatzen-pro.js queue rows) ── */
            window.bzIsFavourite = isFavourite;
            window.bzAddFavourite = addFavourite;
            window.bzRemoveFavourite = removeFavourite;
            window.bzToggleFavourite = toggleFavourite;
            window.bzSyncFavouritesPlaylist = syncFavouritesPlaylist;
            window.bzUpdateFavModalBtn = updateFavModalBtn;
        })();

        /* POSITION RESTORE
           ─────────────────────────────────────────────────────────────────────────
           Problem: on mobile (iOS Safari / Chrome Android) the audio element is
           in a low readyState after .load() — setting currentTime immediately just
           snaps back to 0 once buffering begins.  We need to:
             1. Wait for a readyState that guarantees the seek range is available
                (readyState >= 1, i.e. HAVE_METADATA, is enough for src/duration,
                 but readyState >= 2, i.e. HAVE_CURRENT_DATA, is needed to seek).
             2. Confirm the seek actually landed via the 'seeked' event.
             3. Retry up to N times if currentTime snapped back (iOS HLS quirk).
           ─────────────────────────────────────────────────────────────────────────*/
        window.applySavedTime = function () {
            // Parse position — supports both legacy plain-number and new {t, d, id} JSON format.
            let saved = NaN, savedSongId = '', savedDur = NaN;
            try {
                const raw = localStorage.getItem('beatZen_lastPosition');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed && typeof parsed === 'object' && 'id' in parsed) {
                        saved = parseFloat(parsed.t);
                        savedSongId = String(parsed.id || '');
                        savedDur = parseFloat(parsed.d);
                    } else {
                        saved = parseFloat(raw);
                    }
                }
            } catch (_) {
                saved = parseFloat(localStorage.getItem('beatZen_lastPosition') || '');
            }

            // FIX (critical): every early-return path below MUST set _restoreApplied = true.
            // syncProgressBar() refuses to paint progress/time/duration while the player is
            // paused until this flag is true (so it doesn't stomp the values painted from
            // localStorage before a pending seek lands). If there is nothing to seek to
            // (no saved position, position too small, or the position belongs to a
            // different song), there's nothing to wait for — so we must unblock immediately
            // instead of leaving the flag false forever, which froze the progress bar,
            // current-time, and duration display permanently while paused.
            if (!saved || isNaN(saved) || saved <= 2) {
                audioPlayer._restoreApplied = true;
                return;
            }

            if (savedSongId) {
                const currentSongId = String(
                    window.playingAlbum?.songs?.[window.currentSongIndex]?.id ?? ''
                );
                if (currentSongId && currentSongId !== savedSongId) {
                    localStorage.removeItem('beatZen_lastPosition');
                    audioPlayer._restoreApplied = true;
                    return;
                }
            }

            // Paint saved duration immediately from payload — no metadata wait
            if (isFinite(savedDur) && savedDur > 0) {
                const _fmtQ = (s) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
                document.querySelectorAll('#duration').forEach(el => el.textContent = _fmtQ(savedDur));
                document.querySelectorAll('#current-time').forEach(el => el.textContent = _fmtQ(saved));
                const pct = Math.min(100, (saved / savedDur) * 100);
                document.querySelectorAll('#progress').forEach(el => el.style.width = `${pct}%`);
            }

            if (audioPlayer._restoreApplied) return;

            let retries = 0;
            const MAX_RETRIES = 5;

            // Seeking reliably requires readyState >= 2 (HAVE_CURRENT_DATA) — duration
            // alone (readyState >= 1, HAVE_METADATA) is not enough. Attempting the seek
            // before this point is exactly the "iOS HLS quirk" described above: the
            // browser accepts the currentTime assignment but silently snaps back toward
            // 0 once real buffering starts, which is what made the saved position show
            // correctly for a moment and then jump back to 0:00.
            function _seekReady() {
                return isFinite(audioPlayer.duration) && audioPlayer.duration > 0
                    && audioPlayer.readyState >= 2;
            }

            function doSeek() {
                if (audioPlayer._restoreApplied) return;

                const dur = audioPlayer.duration;
                if (!isFinite(dur) || dur <= 0) {
                    // Duration not yet known — should not normally happen here, but guard anyway
                    return;
                }

                audioPlayer._restoreApplied = true;

                // Clean up all listeners we registered
                if (audioPlayer._restoreCPHandler) {
                    audioPlayer.removeEventListener('canplay', audioPlayer._restoreCPHandler);
                    audioPlayer.removeEventListener('loadedmetadata', audioPlayer._restoreCPHandler);
                    audioPlayer._restoreCPHandler = null;
                }

                const safe = Math.min(saved, dur - 1);
                audioPlayer.currentTime = safe;

                // Confirm the seek landed — iOS sometimes resets to 0 after first seek
                function confirmSeek() {
                    if (Math.abs(audioPlayer.currentTime - safe) > 2 && retries < MAX_RETRIES) {
                        retries++;
                        audioPlayer.currentTime = safe;
                        // Wait for next seeked event to re-confirm
                        audioPlayer.addEventListener('seeked', confirmSeek, { once: true });
                    } else if (Math.abs(audioPlayer.currentTime - safe) > 2) {
                        // FIX: retries exhausted and the seek still didn't land — the
                        // previous code fell through to the "success" branch below and
                        // repainted the UI with this wrong (near-zero) currentTime,
                        // overwriting the correct optimistic display. Leave the
                        // optimistic paint (saved position) as the visible state
                        // instead of overwriting it with a value we know is wrong.
                        console.warn('Beat Zen: position restore seek did not land after', MAX_RETRIES, 'retries — keeping last displayed position');
                    } else {
                        // Seek confirmed — update UI to match actual position
                        const actual = audioPlayer.currentTime;
                        const d = audioPlayer.duration;
                        if (isFinite(d) && d > 0) {
                            document.querySelectorAll('#progress').forEach(el => el.style.width = `${(actual / d) * 100}%`);
                            document.querySelectorAll('#current-time').forEach(el => el.textContent = formatTime(actual));
                            /* FIX: also update duration — was previously left as 0:00 / --:-- */
                            document.querySelectorAll('#duration').forEach(el => el.textContent = formatTime(d));
                        }
                    }
                }
                audioPlayer.addEventListener('seeked', confirmSeek, { once: true });

                // Also update UI immediately as optimistic feedback (both time AND duration)
                if (isFinite(dur) && dur > 0) {
                    document.querySelectorAll('#progress').forEach(el => el.style.width = `${(safe / dur) * 100}%`);
                    document.querySelectorAll('#current-time').forEach(el => el.textContent = formatTime(safe));
                    /* FIX: paint duration immediately so it never shows 0:00 */
                    document.querySelectorAll('#duration').forEach(el => el.textContent = formatTime(dur));
                }
            }

            // INSTANT RESTORE: Try immediately — readyState may already be >= 2 from
            // browser cache (common on refresh). If so, seek right now with zero delay.
            if (_seekReady()) {
                doSeek();
                return;
            }

            // Early fallback at 50ms — covers the case where the browser reaches
            // readyState >= 2 just after the call stack clears (very common on
            // Android Chrome with cache).
            setTimeout(() => {
                if (!audioPlayer._restoreApplied && _seekReady()) {
                    doSeek();
                }
            }, 50);

            // Also wait for audio events as a belt-and-suspenders path.
            // NOTE: 'canplay' itself guarantees readyState >= 3 (HAVE_FUTURE_DATA), so
            // by the time this event fires readyState >= 2 already holds — but we
            // still re-check via _seekReady() rather than assuming, since
            // 'loadedmetadata' alone (readyState 1) is not sufficient on its own.
            function onReady() {
                if (audioPlayer._restoreApplied) return;
                if (_seekReady()) {
                    doSeek();
                }
            }

            // Clean up any stale handlers from previous calls
            if (audioPlayer._restoreCPHandler) {
                audioPlayer.removeEventListener('canplay', audioPlayer._restoreCPHandler);
                audioPlayer.removeEventListener('loadedmetadata', audioPlayer._restoreCPHandler);
            }
            audioPlayer._restoreCPHandler = onReady;
            audioPlayer.addEventListener('canplay', onReady, { once: true });
            audioPlayer.addEventListener('loadedmetadata', onReady, { once: true });
            // 'progress' fires repeatedly as more of the stream buffers in — catches
            // the case where loadedmetadata already fired (readyState 1) but it takes
            // a bit longer to reach readyState 2.
            function onProgress() {
                if (audioPlayer._restoreApplied) return;
                if (_seekReady()) {
                    audioPlayer.removeEventListener('progress', onProgress);
                    doSeek();
                }
            }
            audioPlayer.addEventListener('progress', onProgress);

            // Final safety net: reduced from 4000ms to 800ms so the bar never
            // sits at 0:00 for more than a second if events are slow or never fire.
            clearTimeout(audioPlayer._restoreTimeout);
            audioPlayer._restoreTimeout = setTimeout(() => {
                if (audioPlayer._restoreApplied) return;
                audioPlayer.removeEventListener('progress', onProgress);
                if (isFinite(audioPlayer.duration) && audioPlayer.duration > 0) {
                    // Last resort — attempt the seek even if readyState never reached 2,
                    // since trying (and possibly landing late via confirmSeek's retry
                    // loop) is still better than giving up and showing 0:00 forever.
                    doSeek();
                } else {
                    // FIX: duration never became available (slow/broken network, bad
                    // source URL, etc). We can't seek, but we MUST still unblock
                    // _restoreApplied so syncProgressBar isn't frozen forever while
                    // paused — the user can still see live progress once they hit play.
                    audioPlayer._restoreApplied = true;
                    if (audioPlayer._restoreCPHandler) {
                        audioPlayer.removeEventListener('canplay', audioPlayer._restoreCPHandler);
                        audioPlayer.removeEventListener('loadedmetadata', audioPlayer._restoreCPHandler);
                        audioPlayer._restoreCPHandler = null;
                    }
                }
            }, 800);
        };

        /* REAL-TIME ENGINE — handled by syncProgressBar (ontimeupdate above) */

        /* ROUTING */
        function handleDeepLinking(navFromOverride) {
            const hash = window.location.hash;

            // ── Auth guard ────────────────────────────────────────────────────
            // Prevents guests from opening any view via direct URL/hash changes,
            // browser back/forward, or typed hashes (#home, #playlists, etc.).
            // Three states mirroring bzNavGuard:
            //   • bzIsAuthenticated === false → gate immediately
            //   • bzIsAuthenticated === undefined, no cached session
            //       → wait for bzAuthReady, then gate or retry
            //   • bzIsAuthenticated === true, or undefined + cached session
            //       → proceed normally
            if (window.bzIsAuthenticated === false) { showBzAuthGate(); return; }
            if (window.bzIsAuthenticated === undefined && !localStorage.getItem('beatZen_session_uid')) {
                // FIX: see _bzGetAuthReadyPromise comment near bzNavGuard — must not
                // treat a not-yet-defined window.bzAuthReady as already resolved.
                _bzGetAuthReadyPromise().then(function () {
                    if (!window.bzIsAuthenticated) { showBzAuthGate(); return; }
                    handleDeepLinking(navFromOverride); // retry now Firebase has resolved
                });
                return;
            }
            // ─────────────────────────────────────────────────────────────────

            /* ── Album deep-link: #album-{id} ── */
            if (hash.startsWith('#album-')) {
                const albumId = hash.replace('#album-', '').split('/')[0]; // strip /song- suffix if present
                if (!albumId) { displayHome(true); return; }

                /* Resolve which nav tab to highlight when restoring an album view:
                   1. Explicit argument from onpopstate (state.navFrom saved at open time)
                   2. The navFrom baked into the current history state
                   3. Default to 'home' for cold deep-links */
                const resolvedNavFrom = navFromOverride || history.state?.navFrom || 'home';

                /* masterPool may not be ready yet on cold boot — retry with back-off */
                function tryOpen(attemptsLeft) {
                    const found = window.masterPool?.find(a =>
                        String(a.id || a.name || a.title) === String(albumId)
                    );
                    if (found) {
                        const type = found.type || 'Movie';
                        const resolved = window.resolveData ? window.resolveData(found, type) : found;
                        window.selectAlbum(resolved, true, resolvedNavFrom);
                    } else if (attemptsLeft > 0) {
                        setTimeout(() => tryOpen(attemptsLeft - 1), 250);
                    } else {
                        // masterPool never contains smart playlists (bz-repeat-rewind,
                        // bz-daily-mix, etc.) — they are built on-demand by playlists.js
                        // and not globally registered.  Try the smart-playlist resolver
                        // as a last resort so hash-nav and bookmark links work for smart
                        // playlists, including the empty-songs case (which shows the
                        // descriptive empty state rather than falling back to home).
                        const smart = typeof window.bzGetSmartPlaylist === 'function'
                            ? window.bzGetSmartPlaylist(albumId)
                            : null;
                        if (smart) {
                            const smartType = smart.type || 'Playlist';
                            const smartResolved = window.resolveData
                                ? window.resolveData(smart, smartType)
                                : smart;
                            window.selectAlbum(smartResolved, true, resolvedNavFrom);
                        } else {
                            /* Album not found anywhere — fall back to home silently */
                            displayHome(true);
                        }
                    }
                }
                tryOpen(8); // up to 8 × 250ms = 2s of retries
                return;
            }

            if (hash === '#playlists') displayPlaylists(true);
            else if (hash === '#artists') displayArtists(true);
            else if (hash === '#about' || hash === '#settings') displaySettings(true);
            else if (hash === '#search') {
                hideAllViews();
                searchContainer?.classList.remove('hidden');
                if (searchResultsContainer) searchResultsContainer.style.display = 'block';
            }
            else displayHome(true);
        }

        /* BOOT */
        /* Guard: both popstate AND hashchange fire on back-navigation.
           Without this, displayPlaylists renders twice — the second rAF scroll
           restoration overwrites the first and the position resets to top.
           IMPORTANT: declared BEFORE onpopstate so the var is not undefined
           when the handler first runs (hoisting only gives var undefined, not let). */
        let _popstateHandled = false;

        window.onpopstate = (event) => {
            // FIX Bug 3: every popstate corresponds to one back/forward step away from
            // a pushState entry — decrement the SPA nav depth counter, floor at 0.
            window._bzSpaNavDepth = Math.max(0, window._bzSpaNavDepth - 1);
            /* Signal to the hashchange listener that this navigation is already handled */
            _popstateHandled = true;
            // Wrap in try/finally so EVERY early-return path (maximized player,
            // auth guard, etc.) still resets the flag — otherwise a single early
            // return permanently blocks all future hashchange events.
            try {
                // FIX Issue 5: Reset _popstateHandled synchronously at the END of the
                // handler (after the view-render function returns), not inside a
                // requestAnimationFrame. On some Android Chrome versions, hashchange fires
                // in the same animation frame as popstate — the rAF reset was too late,
                // letting both handlers run and causing displayPlaylists to render twice,
                // which corrupted the history stack (extra pushState → future Back jumps
                // to unexpected views). Wrap the entire handler in a try/finally so the
                // flag is cleared even if an error occurs.
                const hash = window.location.hash;
                const state = event.state || {};
                const mp = document.getElementById('main-player');
                if (mp?.classList.contains('maximized') && hash !== '#player') {
                    // toggleMaximize is a startApp() closure; use the exposed global
                    // so this works even if popstate fires before startApp() finishes.
                    if (window._bzToggleMaximize) window._bzToggleMaximize(true);
                    return;
                }

                // FIX: When the user presses Back from an album view, the album container is
                // still visible (display:'flex') at this point. Save the CALLER view's scroll
                // from the state object before we render the new view. Without this, the
                // caller view's scroll position was never captured on the back gesture path.
                if (albumViewContainer.style.display !== 'none') {
                    // We are navigating back from album view — capture the scroll that was
                    // stored in the history state when selectAlbum() opened this album.
                    // state.navFrom is the view that was active when the album was opened.
                    // state.scrollY is the scroll position of that view, saved by selectAlbum.
                    const callerView = state.navFrom || state.view || 'home';
                    if (typeof state.scrollY === 'number') {
                        window.scrollPositions[callerView] = state.scrollY;
                        localStorage.setItem('beatZen_scroll_' + callerView, String(state.scrollY));
                    }
                }

                // Auth guard for back-navigation — same rule as nav clicks:
                // if the target is a protected view and the user isn't signed in,
                // show the gate instead of rendering the view.
                // Uses localStorage session UID as synchronous fallback while Firebase resolves.
                const _guardedHashes = ['#home', '#playlists', '#artists', '#search', '#settings', '#about', ''];
                if (_guardedHashes.some(h => hash === h || (!hash && h === ''))) {
                    const _auth = window.bzIsAuthenticated;
                    const _uid = localStorage.getItem('beatZen_session_uid');
                    if (_auth === false) { showBzAuthGate(); return; }
                    if (_auth === undefined && !_uid) {
                        // Firebase not yet resolved and no cached session — wait then decide
                        // FIX: see _bzGetAuthReadyPromise comment near bzNavGuard — must not
                        // treat a not-yet-defined window.bzAuthReady as already resolved.
                        _bzGetAuthReadyPromise().then(function () {
                            if (!window.bzIsAuthenticated) showBzAuthGate();
                        });
                        return;
                    }
                    // _auth === true, or _auth undefined but cached UID present → allow
                }

                if (!hash || hash === '#home') {
                    /* If state carries a scrollY (written by selectAlbum when jumping from
                       a non-home tab), pre-load it into the scroll map so navigateToView
                       restores exactly that position when rendering the home grid. */
                    if (typeof state.scrollY === 'number') {
                        window.scrollPositions['home'] = state.scrollY;
                        localStorage.setItem('beatZen_scroll_home', String(state.scrollY));
                    }
                    displayHome(true);
                }
                else if (hash === '#playlists') {
                    /* If state carries a scrollY (written by selectAlbum when jumping from
                       the playlists tab), pre-load it into the scroll map so navigateToView
                       restores exactly that position when re-rendering the playlists view. */
                    if (typeof state.scrollY === 'number') {
                        window.scrollPositions['playlists'] = state.scrollY;
                        localStorage.setItem('beatZen_scroll_playlists', String(state.scrollY));
                    }
                    displayPlaylists(true);
                }
                else if (hash === '#artists') displayArtists(true);
                else if (hash === '#about' || hash === '#settings') displaySettings(true);
                else if (hash === '#updates') displayUpdates(true);
                else if (hash === '#search') { hideAllViews(); searchContainer?.classList.remove('hidden'); if (searchResultsContainer) searchResultsContainer.style.display = 'block'; }
                else if (hash.startsWith('#album-')) handleDeepLinking(state.navFrom);
            } finally {
                // FIX: always reset, even when an early return fires (maximized player,
                // auth guard). Without finally, any early return left _popstateHandled=true
                // permanently, silently swallowing every subsequent hashchange event.
                _popstateHandled = false;
            }
        };
        window.addEventListener('hashchange', () => {
            if (_popstateHandled) return; // popstate already handling this transition
            handleDeepLinking();
        });
        window.addEventListener('scroll', () => {
            if (albumViewContainer.style.display === 'none') {
                const id = window.lastActiveView || 'home';
                window.scrollPositions[id] = window.scrollY;
                localStorage.setItem(`beatZen_scroll_${id}`, window.scrollY);
                // FIX Bug F: keep the current history entry's scrollY up-to-date via
                // replaceState so onpopstate always restores the ACTUAL latest scroll,
                // not the pre-seeded value that was written when the entry was first
                // pushed (before the user had scrolled this view in the current session).
                try {
                    if (history.state && history.state.view === id) {
                        history.replaceState(
                            Object.assign({}, history.state, { scrollY: window.scrollY }),
                            '', window.location.hash
                        );
                    }
                } catch (_) { /* replaceState can throw on some browser edge cases */ }
            } else if (window.currentAlbum && window.currentAlbum.id != null) {
                // FIX: the album/song-list view's scroll was never saved at all — this
                // branch previously did nothing. Save it keyed by the open album's id
                // so reloading or deep-linking back into the same album restores where
                // the user left off instead of always landing at the top.
                window._bzSetAlbumScroll(window.currentAlbum.id, window.scrollY);
            }
        }, { passive: true });

        setTimeout(() => {
            const hash = window.location.hash;
            const extra = JSON.parse(localStorage.getItem('beatZen_importedPlaylists') || '[]');
            extra.forEach(pl => { if (!window.masterPool.some(m => String(m.id) === String(pl.id))) window.masterPool.push(pl); });
            if (typeof customGenreData !== 'undefined') {
                Object.values(customGenreData).flat().forEach(item => { if (!window.masterPool.find(m => String(m.id) === String(item.id))) window.masterPool.push(item); });
            }
            /* NOTE: Last-played song restore is handled exclusively by restoreMobileSession
               (mobile engine) which has robust retry logic for both mobile and desktop.
               Do NOT add a second restore here — it causes a race condition. */

            /* ── Auth-gated boot view restore ──────────────────────────────────
             * ALL views require sign-in. bzNavGuard handles every auth state:
             *   (1) Firebase resolved + signed in  → render the saved view now
             *   (2) Firebase resolved + guest      → show auth gate, render nothing
             *   (3) Firebase still resolving:
             *       • cached session UID  → optimistic render; Firebase rechecks async
             *       • no cached UID       → wait for bzAuthReady → gate if still guest
             *
             * The view-restore callback is defined inline so it captures `hash`
             * from the outer scope but re-reads `window.location.hash` internally
             * in case bzAuthReady takes a tick and the URL changes in between.
             * ──────────────────────────────────────────────────────────────────*/
            bzNavGuard(function _restoreBootView() {
                var _bh = window.location.hash; // re-read — may differ after async tick
                var persistedView = localStorage.getItem('beatZen_activeView');

                if (_bh.startsWith('#album-')) {
                    handleDeepLinking();
                } else if (persistedView === 'playlists') {
                    displayPlaylists(true);
                } else if (persistedView === 'search') {
                    hideAllViews();
                    searchContainer?.classList.remove('hidden');
                    if (searchResultsContainer) searchResultsContainer.style.display = 'block';
                    updateNav('search');
                } else if (persistedView === 'settings') {
                    // FIX: 'settings' was never handled here, so a refresh while on
                    // Settings always fell through to the "unknown -> Home" default,
                    // silently discarding the saved position.
                    displaySettings(true);
                } else if (_bh === '#playlists') {
                    displayPlaylists(true);
                } else if (_bh === '#artists') {
                    displayArtists(true);
                } else if (_bh === '#settings' || _bh === '#about') {
                    displaySettings(true);
                } else {
                    /* Home is always the safe default — no cache, settings, unknown hash */
                    displayHome(true);
                }

                // FIX Bug 4: removed the redundant window.scrollTo here. It fired on
                // skeleton content (insufficient height -> browser clamps to 0) before
                // the real grid was built, fighting the double-rAF scroll restoration
                // already handled inside navigateToView (which also falls back to
                // localStorage). Leaving navigateToView as the single source of truth.
            });
        }, 0);

    } // end startApp()

    /* ═══════════════════════════════════════════════════════════
       SMART DATA LOADER — Cache-first instant boot
       ───────────────────────────────────────────────────────────
       Strategy:
         1. If localStorage cache exists  → launch INSTANTLY (0 ms), always refresh in background
         2. If no cache                   → show loader, fetch from Sheets, cache & launch
         3. If Sheets fetch fails         → fall back to stale cache or show error
       Cache TTL: 24 h — background refresh still runs on every load to keep data fresh
    ═══════════════════════════════════════════════════════════ */

    /** Launch app once data is ready */
    /* ── Notify helper — fires after app is running so toast-container exists ── */
    function _bootToast(msg, delay) {
        setTimeout(() => { if (typeof showToast === 'function') showToast(msg, 5000); }, delay || 0);
    }

    // ── New-content diff helper ────────────────────────────────────────────────
    // Compares two sheet-data snapshots and returns albums that are brand-new
    // (i.e. their id was absent from the old data entirely) plus a count of
    // how many new songs those albums contain.
    function _bzFindNewAlbums(oldData, newData) {
        if (!oldData || !newData) return { albums: [], songCount: 0 };
        // Build a flat Set of every album id present in the cached (old) data
        const oldIds = new Set();
        Object.values(oldData).forEach(function (arr) {
            if (!Array.isArray(arr)) return;
            arr.forEach(function (a) { if (a && a.id != null) oldIds.add(String(a.id)); });
        });
        const newAlbums = [];
        let songCount = 0;
        Object.values(newData).forEach(function (arr) {
            if (!Array.isArray(arr)) return;
            arr.forEach(function (a) {
                if (!a || a.id == null) return;
                if (!oldIds.has(String(a.id))) {
                    newAlbums.push(a);
                    songCount += Array.isArray(a.songs) ? a.songs.length : 0;
                }
            });
        });
        return { albums: newAlbums, songCount };
    }

    function launchWhenReady(data, fromCache) {
        window.customYearAlbumsData = sanitizeSheetData(data);
        window._bzDataVersion = Date.now().toString();

        var _skipAnim = (function () {
            try {
                const ov = document.getElementById('bz-loader-overlay');
                return ov && ov.querySelector('.bz-loader-ring') &&
                    ov.querySelector('.bz-loader-ring').style.opacity === '0';
            } catch (_) { return false; }
        })();

        function _doHide() {
            if (_skipAnim) {
                const ov = document.getElementById('bz-loader-overlay');
                if (ov) ov.style.transition = 'none';
            }
            loaderHide();
        }

        /* ── Unified "ready to reveal" wait ──────────────────────────────────────
         * FIX: On a FRESH INSTALL there is no cache, so launchWhenReady used to
         * take the `else` branch below, which hid the loader via two rAFs +
         * setTimeout(0) — typically 1-2 frames (~16-32ms). bzNavGuard, however,
         * waits on window.bzAuthReady (Firebase onAuthStateChanged), which can
         * take anywhere from ~100ms to a couple of seconds on a cold PWA launch.
         * Result: loader disappears almost instantly, then the page sits BLANK
         * until Firebase resolves and showBzAuthGate() finally runs — exactly
         * the "empty homescreen" bug.
         *
         * Fix: both branches now poll (every 50ms, up to 1.5s) for either
         *   (a) .album-card elements rendered (signed-in user, home populated), or
         *   (b) the auth gate becoming visible (signed-out user → Sign Up/Sign In)
         * and only hide the loader once one of those is true (or the 1.5s
         * safety timeout is hit, so the loader never hangs forever).
         * ────────────────────────────────────────────────────────────────────── */
        function _waitForReadyThenHide() {
            var _attempts = 0;
            // Max wait: 2.5s (150 × ~16ms rAF ticks).
            // ─ Deep-link tryOpen() retries up to 8 × 250ms = 2s — still covered.
            // ─ Firebase onAuthStateChanged arrives in ~100-500ms for returning
            //   signed-in users — for them we now unblock hasCards immediately
            //   via the _likelySignedIn fast-path below, so we no longer need
            //   to size the cap around Firebase latency for that case.
            // ─ Safety net: genuine no-cache first-ever guests still get 2.5s.
            var _maxAttempts = 150; // 150 × ~16ms ≈ 2.5s max

            // Reuses the same synchronous "looks signed in" signal bzNavGuard uses
            // (cached session UID, or the bz-signed-in class set by index.html's
            // head fast-path script before first paint).
            var _likelySignedIn = _bzLikelySignedIn();

            function _check() {
                var ysc = document.getElementById('year-sections-container');
                var rawHasCards = ysc && ysc.querySelector('.album-card') && ysc.dataset.bzScrollReady === '1';
                var gate = document.getElementById('bz-auth-gate');
                var rawGateVisible = gate && gate.classList.contains('bz-gate-visible');

                // _stillResolvingGuestPath is true only when:
                //   • html still carries bz-guest (auth.js hasn't confirmed sign-in yet), AND
                //   • bzIsAuthenticated is still undefined (Firebase hasn't fired yet), AND
                //   • we have NO cached session signal (genuine guest or very first load).
                //
                // For a RETURNING signed-in user (_likelySignedIn = true), we treat
                // _stillResolvingGuestPath as false immediately — we already know
                // they're signed in from localStorage / the head fast-path class.
                // This lets hasCards go true as soon as the cards are rendered (~1 rAF),
                // without waiting for Firebase to fire onAuthStateChanged (~100-500ms).
                //
                // The loader's CSS fade takes 0.3s delay + 0.25s fade = 0.55s total,
                // so Firebase will have resolved and auth.js will have removed bz-guest
                // well before the overlay actually becomes invisible — no gate-flash risk.
                //
                // A genuine first-time guest (_likelySignedIn = false) still gets the
                // original behaviour: we wait for either the gate to become visible or
                // the max-attempts cap.
                var _stillResolvingGuestPath = !_likelySignedIn &&
                    document.documentElement.classList.contains('bz-guest') &&
                    window.bzIsAuthenticated === undefined;

                var hasCards = rawHasCards && !_stillResolvingGuestPath;
                // Don't let the gate's CSS pre-render count as "ready" while a
                // likely-signed-in user's Firebase confirmation is still pending —
                // only a genuine guest (no cached session) gets the instant gate.
                var gateVisible = rawGateVisible && !(_likelySignedIn && _stillResolvingGuestPath);
                // On an album deep-link reload (#album-...), handleDeepLinking() never
                // calls displayHome(), so .album-card elements never appear. Treat the
                // album view as ready once it has either real song rows or its
                // empty-state element (both replace .bz-song-skeleton), AND the
                // scroll-restore-or-skip decision has completed (bzScrollReady).
                var albumContainer = document.getElementById('album-view-container');
                var albumReady = albumContainer && albumContainer.style.display !== 'none' &&
                    albumContainer.dataset.bzScrollReady === '1' &&
                    (albumContainer.querySelector('.song-item') || albumContainer.querySelector('.bz-empty')) &&
                    !_stillResolvingGuestPath;
                if (hasCards || gateVisible || albumReady || _attempts >= _maxAttempts) {
                    requestAnimationFrame(_doHide);
                } else {
                    _attempts++;
                    // Poll every animation frame (~16ms) instead of every 50ms —
                    // cards are ready within 1-2 rAFs on a cache hit, so this
                    // cuts the wait from ~50ms to ~16ms in the common case.
                    requestAnimationFrame(_check);
                }
            }
            _check();
        }

        if (fromCache) {
            startApp();
            // startApp queues a setTimeout(0) for the boot view restore.
            // We queue our own setTimeout(0) after it so the wait loop starts
            // only after displayHome / bzNavGuard have had a chance to run.
            setTimeout(_waitForReadyThenHide, 0);
        } else {
            requestAnimationFrame(function () {
                startApp();
                requestAnimationFrame(function () {
                    setTimeout(_waitForReadyThenHide, 0);
                });
            });
        }
    }

    /* ── BOOT: always show the full logo + dots splash on every load ──────────
       FIX: previously a "max 3 loads/day" throttle (bz_loader_freq in
       localStorage) hid the ring/brand/tagline/dots instantly once quota was
       hit, leaving just the bare #08081a overlay background on screen with
       nothing on it — looked like a blank/broken page (esp. noticeable
       during dev/testing with frequent reloads). Throttle removed below so
       the splash is consistent and predictable on every load. ── */
    (function boot() {
        let launched = false;

        var cached = getCachedSheetData();
        var fromCache = !!cached;

        /* ── No artificial minimum delay ───────────────────────────────────────
           The launch gate below waits ONLY on real data (sheetsPromise):
             • Cache hit  → resolves on the same tick → app launches immediately,
               no manufactured wait. The splash still fades in/out smoothly via
               its own 0.5s CSS transition, it's just not held open on purpose.
             • No cache   → resolves whenever the network fetch actually
               finishes, so the splash (logo + dots) stays up for exactly as
               long as loading really takes — no more, no less.
        ──────────────────────────────────────────────────────────────────────── */

        /* ── Auth-ready promise ──────────────────────────────────────────────────
           auth.js fetches Firestore user data in the background in parallel, but
           we do NOT block the launch gate on it — Firebase onAuthStateChanged can
           take several seconds on cold starts, which would push the loader past 3
           dot cycles. Auth state is applied by auth.js once it resolves, exactly
           as it did before, so the app already handles this asynchronously.
        ──────────────────────────────────────────────────────────────────────── */
        // (auth runs in background — not included in the launch gate)

        /* ── Sheets data promise ─────────────────────────────────────────────────
           Cache hit  → resolve immediately with cached data; bg fetch runs fully
                        in the background and NEVER blocks the launch gate.
           No cache   → fetch from Sheets now (blocks gate until data arrives).
                        Uses cache:'no-store' to bypass GAS CDN stale responses.
        ──────────────────────────────────────────────────────────────────────── */
        var sheetsPromise;

        /* ── Background refresh helper — always runs but NEVER blocks launch ──── */
        function _bgRefresh(currentCached) {
            fetch(BEATZEN_SHEET_URL, { cache: 'no-store' })
                .then(function (r) {
                    if (!r.ok) throw new Error('HTTP ' + r.status);
                    return r.json();
                })
                .then(function (freshData) {
                    const diff = _bzFindNewAlbums(currentCached, freshData);
                    setCachedSheetData(freshData);
                    // Only update live app data if something actually changed
                    if (diff.albums.length > 0) {
                        window.customYearAlbumsData = sanitizeSheetData(freshData);
                        window._bzDataVersion = Date.now().toString();
                        if (typeof window.bzOnSheetDataRefresh === 'function') {
                            window.bzOnSheetDataRefresh(freshData);
                        }
                        const names = diff.albums
                            .map(function (a) { return a.title || a.name || ''; })
                            .filter(Boolean);
                        const MAX = 3;
                        let label;
                        if (names.length === 0) {
                            label = diff.albums.length + ' new album' + (diff.albums.length > 1 ? 's' : '');
                        } else if (names.length <= MAX) {
                            label = names.join(', ');
                        } else {
                            label = names.slice(0, MAX).join(', ') + ' +' + (names.length - MAX) + ' more';
                        }
                        const songWord = diff.songCount === 1 ? 'song' : 'songs';
                        _bootToast('✦ New: ' + label + ' (' + diff.songCount + ' ' + songWord + ')', 400);
                    }
                })
                .catch(function (err) {
                    console.warn('Beat Zen: Background refresh failed (using cache).', err);
                });
        }

        if (cached) {
            /* ── FAST PATH: cache hit → launch instantly ── */
            sheetsPromise = Promise.resolve(cached);
        } else {
            /* ── COLD PATH: no cache → fetch now with no-store to skip GAS cache ── */
            sheetsPromise = fetch(BEATZEN_SHEET_URL, { cache: 'no-store' })
                .then(function (r) {
                    if (!r.ok) throw new Error('HTTP ' + r.status);
                    return r.json();
                })
                .then(function (data) {
                    setCachedSheetData(data);
                    return data;
                });
        }

        /* ── Gate: wait for song data only — no artificial minimum ── */
        sheetsPromise
            .then(function (data) {
                if (launched) return;
                launched = true;
                launchWhenReady(data, fromCache);
            })
            .catch(function (err) {
                // FIX: previously this called loaderHide() WITHOUT calling startApp(),
                // leaving the user on a blank uninitialized page behind the overlay.
                // Now: try stale cache first. If cache exists, launch with it and show
                // a warning toast. Only show the hard error if there is truly nothing.
                console.error('Beat Zen: Boot failed.', err);
                if (!launched) {
                    launched = true;
                    var _staleData = getCachedSheetData();
                    if (_staleData) {
                        // Use stale cache — app boots normally, fresh data loads next time
                        var _el = document.getElementById('bz-loader-status');
                        if (_el) _el.textContent = 'Using saved data — music loads now';
                        launchWhenReady(_staleData, true);
                        _bootToast('Offline or slow connection — loaded from saved data', 600);
                    } else {
                        // Truly no data — show error and a retry button in the loader
                        var el = document.getElementById('bz-loader-status');
                        if (el) el.textContent = 'No connection — check your network and tap Retry';
                        var _sw = document.querySelector('.bz-loader-status-wrap');
                        if (_sw && !document.getElementById('bz-boot-retry-btn')) {
                            var _rb = document.createElement('button');
                            _rb.id = 'bz-boot-retry-btn';
                            _rb.textContent = 'Retry';
                            _rb.style.cssText = 'margin-top:12px;padding:9px 28px;border-radius:20px;border:none;background:linear-gradient(135deg,#7c3aed,#2575fc);color:#fff;font-size:0.85rem;font-weight:700;cursor:pointer;';
                            _rb.onclick = function () { window.location.reload(); };
                            _sw.appendChild(_rb);
                        }
                    }
                }
            });

        /* ── Hard safety net — loader ALWAYS hides even if everything fails ──── */
        setTimeout(function () {
            if (launched) return;
            // FIX: previously called only loaderHide() here — startApp() was never
            // called, so the app was blank behind the overlay. The user had to refresh
            // manually, and on slow connections the cycle repeated indefinitely.
            // Now: fall back to stale cache if available, show retry button if not.
            console.warn('Beat Zen: boot safety timeout — forcing launch.');
            launched = true;
            var _stale = getCachedSheetData();
            if (_stale) {
                // Stale cache available — launch with it, background refresh will catch up
                launchWhenReady(_stale, true);
                _bootToast('Slow connection — loaded from saved data', 400);
            } else {
                // No cache, no data — show retry UI; don't call startApp with empty data
                var el = document.getElementById('bz-loader-status');
                if (el) el.textContent = 'Could not connect — tap Retry to try again';
                var _sw = document.querySelector('.bz-loader-status-wrap');
                if (_sw && !document.getElementById('bz-boot-retry-btn')) {
                    var _rb = document.createElement('button');
                    _rb.id = 'bz-boot-retry-btn';
                    _rb.textContent = 'Retry';
                    _rb.style.cssText = 'margin-top:12px;padding:9px 28px;border-radius:20px;border:none;background:linear-gradient(135deg,#7c3aed,#2575fc);color:#fff;font-size:0.85rem;font-weight:700;cursor:pointer;';
                    _rb.onclick = function () { window.location.reload(); };
                    _sw.appendChild(_rb);
                }
            }
        }, 12000);

        /* ── Slow network detection ──────────────────────────────────────────────
           If still on the loader after 3s → show the in-splash warning banner.
           If fetch took >2s but eventually succeeded → show floating post-launch toast.
        ──────────────────────────────────────────────────────────────────────── */
        var _fetchStart = Date.now();
        var _slowBannerTimer = null;
        var _slowDetected = false;

        // Show in-splash banner after 3s if still loading
        _slowBannerTimer = setTimeout(function () {
            if (launched) return;
            _slowDetected = true;
            var banner = document.getElementById('bz-slow-net-banner');
            if (banner) banner.classList.add('bz-slow-net-visible');
            var status = document.getElementById('bz-loader-status');
            if (status) status.textContent = 'Still loading… this may take a moment';
        }, 3000);

        // After launch, show floating toast if fetch took longer than 2s
        sheetsPromise.then(function () {
            clearTimeout(_slowBannerTimer);
            var elapsed = Date.now() - _fetchStart;
            if (elapsed > 2000) {
                _slowDetected = true;
                // Show floating toast 500ms after app becomes visible
                setTimeout(function () {
                    var toast = document.getElementById('bz-slow-net-toast');
                    if (!toast) return;
                    toast.style.display = 'flex';
                    requestAnimationFrame(function () {
                        requestAnimationFrame(function () {
                            toast.classList.add('bz-snt-show');
                        });
                    });
                    // Auto-dismiss after 6s
                    setTimeout(function () {
                        toast.classList.remove('bz-snt-show');
                        setTimeout(function () { toast.style.display = 'none'; }, 350);
                    }, 6000);
                }, 1700);
            }
        }).catch(function () { clearTimeout(_slowBannerTimer); });

        // Wire dismiss button for the floating toast
        var _toastClose = document.getElementById('bz-slow-net-toast-close');
        if (_toastClose) {
            _toastClose.addEventListener('click', function () {
                var toast = document.getElementById('bz-slow-net-toast');
                if (!toast) return;
                toast.classList.remove('bz-snt-show');
                setTimeout(function () { toast.style.display = 'none'; }, 350);
            });
        }

        /* ── Offline / online detection ─────────────────────────────────────────
           - Offline  → red toast, sets window._bzOffline flag to block next-song loads
           - Online   → hides red toast, shows green "Back online" toast (auto-dismiss 4s),
                        clears flag so playback resumes normally
           Current song is NEVER interrupted — block only applies to loading the NEXT song.
        ──────────────────────────────────────────────────────────────────────── */
        window._bzOffline = !navigator.onLine;

        function _bzShowOfflineToast() {
            window._bzOffline = true;
            var t = document.getElementById('bz-offline-toast');
            if (!t) return;
            t.style.display = 'flex';
            requestAnimationFrame(function () {
                requestAnimationFrame(function () { t.classList.add('bz-snt-show'); });
            });
        }

        function _bzHideOfflineToast() {
            var t = document.getElementById('bz-offline-toast');
            if (!t) return;
            t.classList.remove('bz-snt-show');
            setTimeout(function () { t.style.display = 'none'; }, 350);
        }

        function _bzShowOnlineToast() {
            window._bzOffline = false;
            _bzHideOfflineToast();
            var t = document.getElementById('bz-online-toast');
            if (!t) return;
            t.style.display = 'flex';
            requestAnimationFrame(function () {
                requestAnimationFrame(function () { t.classList.add('bz-snt-show'); });
            });
            // Auto-dismiss after 4s
            setTimeout(function () {
                t.classList.remove('bz-snt-show');
                setTimeout(function () { t.style.display = 'none'; }, 350);
            }, 4000);
        }

        /* FIX (mobile): a single 'offline' event from the OS network stack is
           often just a brief blip — switching towers, waking from screen-lock,
           hopping WiFi↔mobile-data — that self-resolves in under a second.
           Previously _bzOffline flipped to true immediately and stayed true
           until a matching 'online' event fired, which on some Android devices
           never arrives for these blips — silently blocking playNextSong()
           (it calls stopAndReset() whenever _bzOffline is true) even though
           the connection was actually fine. Now we wait briefly and re-check
           real connectivity before committing to the offline state. */
        var _bzOfflineConfirmTimer = null;
        function _bzShowOfflineToastDebounced() {
            clearTimeout(_bzOfflineConfirmTimer);
            _bzOfflineConfirmTimer = setTimeout(function () {
                if (!navigator.onLine) _bzShowOfflineToast();
            }, 2500);
        }
        window.addEventListener('offline', _bzShowOfflineToastDebounced);
        window.addEventListener('online', function () {
            clearTimeout(_bzOfflineConfirmTimer);
            _bzShowOnlineToast();
        });

        // Show immediately if already offline on page load
        if (!navigator.onLine) _bzShowOfflineToast();

        // Wire dismiss buttons
        var _offlineClose = document.getElementById('bz-offline-toast-close');
        if (_offlineClose) _offlineClose.addEventListener('click', _bzHideOfflineToast);

        var _onlineClose = document.getElementById('bz-online-toast-close');
        if (_onlineClose) {
            _onlineClose.addEventListener('click', function () {
                var t = document.getElementById('bz-online-toast');
                if (!t) return;
                t.classList.remove('bz-snt-show');
                setTimeout(function () { t.style.display = 'none'; }, 350);
            });
        }
    })();

})();

/* sanitizeSheetData is defined inside the IIFE above — do NOT redeclare here */


/* ═══════════════════════════════════════════════════════════════════════
   BEAT ZEN — BeatZenButtons  (merged from buttons.js)
   Handles: Album action bar HTML, play/share event listeners, sync UI
   Structured Order: UI Helper Objects → called by beatzen-pro.js
════════════════════════════════════════════════════════════════════════ */

const BeatZenButtons = {

    /**
     * HTML
     */
    generateActionBarHTML: function (album, isPlaying) {
        const playBtnIcon = isPlaying ? 'fa-pause' : 'fa-play';
        const playBtnText = isPlaying ? 'Pause' : 'Play All';

        return `
            <div class="album-actions">
                <button id="album-sync-play" class="action-btn main-play">
                    <i class="fas ${playBtnIcon}"></i> <span>${playBtnText}</span>
                </button>

                <button id="share-status" class="action-btn secondary" title="Share to Status">
                    <i class="fas fa-share-nodes"></i>
                </button>
            </div>
        `;
    },

    /**
     * Logic
     */
    initEventListeners: function (album, playAllCallback, toggleCallback) {

        // Play
        const syncBtn = document.getElementById('album-sync-play');
        if (syncBtn) {
            syncBtn.onclick = () => {
                const isThisAlbumActive = (window.playingAlbum && String(window.playingAlbum.id) === String(album.id));

                if (isThisAlbumActive) {
                    toggleCallback();
                } else {
                    playAllCallback();
                }
                // Reset
                syncBtn.blur();
            };
        }

        // Share
        const shareBtn = document.getElementById('share-status');
        if (shareBtn) {
            shareBtn.onclick = async () => {
                const albumUrl = `${window.location.origin}${window.location.pathname}#album-${album.id}`;
                if (navigator.share) {
                    try {
                        await navigator.share({ title: `BeatZen — ${album.title}`, url: albumUrl });
                    } catch (err) { }
                } else {
                    try {
                        await navigator.clipboard.writeText(albumUrl);
                        showToast('✓ Album link copied!');
                    } catch (_) {
                        const ta = Object.assign(document.createElement('textarea'), { value: albumUrl });
                        Object.assign(ta.style, { position: 'fixed', opacity: '0' });
                        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
                        showToast('✓ Album link copied!');
                    }
                }
                shareBtn.blur();
            };
        }
    },

    /**
     * Sync
     */
    updateSyncButtonUI: function (isPaused) {
        const syncBtn = document.getElementById('album-sync-play');
        if (syncBtn) {
            const icon = syncBtn.querySelector('i');
            const span = syncBtn.querySelector('span');

            if (icon && span) {
                // Icons
                icon.className = isPaused ? 'fas fa-play' : 'fas fa-pause';
                span.textContent = isPaused ? 'Play All' : 'Pause';
            }
        }
    }
};

/* ═══════════════════════════════════════════════════════════════════════
   BEAT ZEN — Premium Mobile Engine  (merged from mobile.js)
   Handles: Persistence & Hardware Handshaking, Gestures, Session Restore
   Structured Order: Mobile/Device Layer → runs last, after all app logic
════════════════════════════════════════════════════════════════════════ */

(function () {
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

    /* Internal retry helper — waits for masterPool + playSong + resolveData to be ready */
    function _tryRestoreSession(attemptsLeft) {
        const savedSong = localStorage.getItem('lastPlayedSong');
        const audio = document.getElementById('audio-player');
        const mainPlayer = document.getElementById('main-player');

        // All three must be ready: audio element, saved data, and the app engine
        if (!audio || !savedSong || !window.masterPool || !window.masterPool.length ||
            !window.playSong || !window.resolveData) {
            if (attemptsLeft > 0) {
                setTimeout(() => _tryRestoreSession(attemptsLeft - 1), 300);
            } else {
                console.warn("Beat Zen: masterPool/playSong not ready after max retries — restore aborted");
                // FIX: without this, every togglePlayback() click while stuck re-triggers
                // restoreMobileSession() → another full 7.5s retry loop, forever.
                state.restored = true;
                if (window.syncPlaybackModesUI) window.syncPlaybackModesUI();
                // FIX (critical): a failed restore must NOT leave _bzAutoPlayAfterRestore
                // stuck at true — togglePlayback()'s "if (!window._bzAutoPlayAfterRestore)"
                // guard would then permanently skip ever calling restoreMobileSession()
                // again, leaving the play button dead until a full page refresh (this is
                // exactly what happens after a live code/data push when masterPool takes
                // longer than expected to populate).
                window._bzAutoPlayAfterRestore = false;
                if (typeof updatePlayPauseIcon === 'function') updatePlayPauseIcon();
                if (typeof showToast === 'function') showToast("Couldn't restore your last session — pick a song to start playing.");
            }
            return;
        }

        try {
            const data = JSON.parse(savedSong);
            const { albumId, songIndex, songId, type } = data;

            // 1. Re-link to master data pool.
            //    Match against all three raw ID fields because resolveData builds
            //    album id as String(raw.id || raw.name || raw.title).
            const obj = window.masterPool.find(a =>
                String(a.id || '') === String(albumId) ||
                String(a.name || '') === String(albumId) ||
                String(a.title || '') === String(albumId)
            );

            // Album not yet in masterPool — Sheets data may still be loading. Retry.
            // If retries are exhausted, fall back to the smart-playlist resolver before
            // giving up: smart playlists (bz-repeat-rewind, bz-daily-mix, bz-year-*,
            // bz-listen-again, bz-infinite-play) are NEVER stored in masterPool — they
            // are built on-demand by playlists.js. This mirrors the same fallback that
            // handleDeepLinking's tryOpen() already uses.
            if (!obj) {
                if (attemptsLeft > 0) {
                    setTimeout(() => _tryRestoreSession(attemptsLeft - 1), 300);
                    return;
                }

                // Out of masterPool retries — try the smart-playlist resolver first.
                const smart = typeof window.bzGetSmartPlaylist === 'function'
                    ? window.bzGetSmartPlaylist(albumId)
                    : null;

                if (smart) {
                    // Smart playlist found — rehydrate and restore exactly like a normal album.
                    const smartType = smart.type || 'Playlist';
                    const hydrated = window.resolveData
                        ? window.resolveData(smart, smartType)
                        : smart;

                    if (hydrated) {
                        window.playingAlbum = hydrated;
                        let resolvedIndex = -1;
                        if (songId) {
                            resolvedIndex = hydrated.songs.findIndex(s => String(s.id) === String(songId));
                        }
                        if (resolvedIndex < 0) {
                            const safeIndex = Math.max(0, parseInt(songIndex) || 0);
                            resolvedIndex = (hydrated.songs && hydrated.songs[safeIndex]) ? safeIndex : 0;
                        }
                        window.currentSongIndex = resolvedIndex;
                        window.playSong(window.currentSongIndex, false);

                        state.restored = true;
                        if (window.syncPlaybackModesUI) window.syncPlaybackModesUI();
                        return;
                    }
                }

                // Neither masterPool nor smart-playlist resolved the albumId — give up cleanly.
                console.warn("Beat Zen: Album not found after max retries:", albumId);
                // FIX: same as above — avoid endless re-trigger loops from togglePlayback().
                state.restored = true;
                if (window.syncPlaybackModesUI) window.syncPlaybackModesUI();
                // FIX (critical): this is the exact failure mode that follows a live
                // code/data push that renames or restructures an album — the saved
                // albumId no longer matches anything in the fresh masterPool. Without
                // resetting this flag, the play/pause button is permanently dead.
                window._bzAutoPlayAfterRestore = false;
                if (typeof updatePlayPauseIcon === 'function') updatePlayPauseIcon();
                if (typeof showToast === 'function') showToast("Couldn't restore your last session — pick a song to start playing.");
                return;
            }

            // 2. Rehydrate playing state — resolveData builds full song objects
            const hydrated = window.resolveData(obj, type || obj.type || 'Movie');

            if (!hydrated) {
                console.warn("Beat Zen: resolveData returned null for", albumId);
                if (attemptsLeft > 0) {
                    setTimeout(() => _tryRestoreSession(attemptsLeft - 1), 300);
                } else {
                    // FIX: same as above — avoid endless re-trigger loops from togglePlayback().
                    state.restored = true;
                    if (window.syncPlaybackModesUI) window.syncPlaybackModesUI();
                    window._bzAutoPlayAfterRestore = false;
                    if (typeof updatePlayPauseIcon === 'function') updatePlayPauseIcon();
                    if (typeof showToast === 'function') showToast("Couldn't restore your last session — pick a song to start playing.");
                }
                return;
            }

            // 3. Set global state BEFORE calling playSong so UI reads are always correct.
            //    Prefer songId lookup (immune to index shifts); fall back to songIndex.
            window.playingAlbum = hydrated;
            let resolvedIndex = -1;
            if (songId) {
                resolvedIndex = hydrated.songs.findIndex(s => String(s.id) === String(songId));
            }
            if (resolvedIndex < 0) {
                const safeIndex = Math.max(0, parseInt(songIndex) || 0);
                resolvedIndex = (hydrated.songs && hydrated.songs[safeIndex]) ? safeIndex : 0;
            }
            window.currentSongIndex = resolvedIndex;

            // 4. Populate player bar without autoplaying.
            window.playSong(window.currentSongIndex, false);

            // 4b. Force progress bar UI update once audio metadata is available.
            //     applySavedTime() already seeks the audio element, but the progress
            //     bar and time display need an explicit repaint while paused because
            //     ontimeupdate only fires during playback.
            (function syncRestoredPosition() {
                const _audio = document.getElementById('audio-player');
                if (!_audio) return;

                /* ── FIX: Robust restore repaint ────────────────────────────────────
                   Problem (original bug): on refresh the duration element shows 0:00
                   because audio metadata hasn't loaded when we first try to repaint,
                   and the events (canplay / loadedmetadata / seeked) may fire before
                   our listeners are attached (cache-hit case) or very late (cold
                   fetch case).

                   Problem (regression): once metadata DOES become available,
                   _repaintBar reads _audio.currentTime — but if a saved position is
                   still being restored, applySavedTime()'s seek (audioPlayer.currentTime
                   = safe) hasn't run yet, so currentTime is still 0. Painting at that
                   moment shows "0:00 / <duration>" / 0% progress, stomping the correct
                   values applySavedTime already painted from the saved payload — and
                   the old code then cancelled the polling loop unconditionally
                   (clearInterval on every event, even when _repaintBar returned
                   false), so nothing ever corrected it.

                   Solution: a short polling loop (max 8 s, 100 ms interval) that keeps
                   trying to repaint until it SUCCEEDS, covering every timing scenario:
                     • Instant cache hit  — first tick lands immediately
                     • Slow network fetch — polling catches it when it arrives
                     • Event-based paths  — _repaintBar is also wired to seeked /
                       loadedmetadata / canplay / durationchange as belt-and-suspenders
                   AND gating _repaintBar itself: while a position restore is pending
                   for the current song, it refuses to read currentTime (and thus
                   refuses to paint) until audioPlayer._restoreApplied is true — i.e.
                   until applySavedTime's doSeek() has actually issued the seek. Only
                   a successful repaint stops the polling/event listeners.
                ─────────────────────────────────────────────────────────────────── */
                const _fmt = (s) => isNaN(s) ? '0:00' : `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

                // Is a position restore pending for the song that was just loaded?
                // Mirrors the validity checks in applySavedTime() so the two stay
                // in sync: if applySavedTime won't call doSeek() (no saved position,
                // saved <= 2s, or the saved song id doesn't match the current song),
                // there's nothing to wait for and _repaintBar should paint as soon
                // as duration is known (cur will correctly be 0 in that case).
                let _restorePending = false;
                try {
                    const _raw = localStorage.getItem('beatZen_lastPosition');
                    if (_raw) {
                        const _parsed = JSON.parse(_raw);
                        const _t = (_parsed && typeof _parsed === 'object') ? parseFloat(_parsed.t) : parseFloat(_raw);
                        if (isFinite(_t) && _t > 2) {
                            const _savedId = (_parsed && typeof _parsed === 'object') ? String(_parsed.id || '') : '';
                            const _curId = String(window.playingAlbum?.songs?.[window.currentSongIndex]?.id ?? '');
                            _restorePending = !_savedId || !_curId || _savedId === _curId;
                        }
                    }
                } catch (_) { /* malformed payload — treat as nothing pending */ }

                function _repaintBar() {
                    // Hold off while a restore seek is still pending — currentTime
                    // would still read 0 and we'd paint over applySavedTime's values.
                    if (_restorePending && !_audio._restoreApplied) return false;
                    const cur = _audio.currentTime, dur = _audio.duration;
                    if (!isFinite(dur) || dur <= 0) return false; // not ready yet
                    const pct = (cur / dur) * 100;
                    document.querySelectorAll('#progress').forEach(el => el.style.width = `${pct}%`);
                    document.querySelectorAll('#current-time').forEach(el => el.textContent = _fmt(cur));
                    document.querySelectorAll('#duration').forEach(el => el.textContent = _fmt(dur));
                    return true; // success
                }

                // Try immediately in case readyState (and, if relevant, the restore
                // seek) is already settled
                if (_repaintBar()) return; // done — no polling needed

                // Polling loop: retry every 100 ms for up to 8 000 ms
                let _pollTicks = 0;
                const _pollMax = 80; // 80 × 100 ms = 8 000 ms
                const _pollTimer = setInterval(() => {
                    _pollTicks++;
                    if (_repaintBar() || _pollTicks >= _pollMax) {
                        _stop();
                    }
                }, 100);

                // Belt-and-suspenders: also repaint on audio events. Only stop
                // polling/listening once a repaint actually SUCCEEDS — an early
                // event (e.g. 'durationchange' firing before the restore seek has
                // landed) must not tear down the loop while we're still waiting.
                function _eventRepaint() {
                    if (_repaintBar()) _stop();
                }
                function _stop() {
                    clearInterval(_pollTimer);
                    _audio.removeEventListener('seeked', _eventRepaint);
                    _audio.removeEventListener('loadedmetadata', _eventRepaint);
                    _audio.removeEventListener('canplay', _eventRepaint);
                    _audio.removeEventListener('durationchange', _eventRepaint);
                }
                _audio.addEventListener('seeked', _eventRepaint);
                _audio.addEventListener('loadedmetadata', _eventRepaint);
                _audio.addEventListener('canplay', _eventRepaint);
                _audio.addEventListener('durationchange', _eventRepaint);
            })();

            // 5. Activate song-row highlight for the restored song so the
            //    album view shows the correct active row when opened.
            window._highlightActive = true;
            if (typeof window.updateActiveSongHighlight === 'function') {
                window.updateActiveSongHighlight();
            }

            // 6. Force Home View — never boot into maximized player
            if (mainPlayer) {
                mainPlayer.classList.remove('maximized');
                document.body.style.overflow = '';
                if (window.location.hash === '#player') {
                    history.replaceState(null, null, ' ');
                }
            }

            // Mark as restored — prevents the fallback doRestore() timer re-running
            state.restored = true;

        } catch (e) {
            console.error("Beat Zen: Recovery Error", e);
            // FIX: an unexpected exception mid-restore must not leave controls dead either.
            state.restored = true;
            window._bzAutoPlayAfterRestore = false;
            if (typeof updatePlayPauseIcon === 'function') updatePlayPauseIcon();
        }

        // Always restore Playback Modes (Shuffle/Loop) regardless of song outcome
        window.isShuffling = localStorage.getItem('beatZen_shuffle') === 'true';
        window.repeatMode = parseInt(localStorage.getItem('beatZen_repeat_mode') || '0', 10);
        if (![0, 1, 2].includes(window.repeatMode)) window.repeatMode = 0;
        window.isLooping = window.repeatMode === 2;
        if (window.syncPlaybackModesUI) window.syncPlaybackModesUI();
    }

    // ── FIX: Expose state object + reset hook so auth.js can clear the restore
    //    guard after a cloud download or live-sync update without needing to
    //    know the internal IIFE structure.
    window._bzMobileState = state;
    window._bzResetRestoredState = function () {
        state.restored = false;
    };

    window.restoreMobileSession = function () {
        // FIX Bug E: if a BroadcastChannel ping confirmed another tab is already
        // playing, skip restore entirely so we don't fight for audio ownership.
        if (window._bzTabIsSecondary) return;
        // If the fallback timer already restored successfully, just sync UI and bail.
        if (state.restored) {
            window.isShuffling = localStorage.getItem('beatZen_shuffle') === 'true';
            window.repeatMode = parseInt(localStorage.getItem('beatZen_repeat_mode') || '0', 10);
            if (![0, 1, 2].includes(window.repeatMode)) window.repeatMode = 0;
            window.isLooping = window.repeatMode === 2;
            if (window.syncPlaybackModesUI) window.syncPlaybackModesUI();
            return;
        }

        // Called from startApp() — masterPool is now guaranteed to be populated.
        // Clear the flag so _tryRestoreSession doesn't think it already exhausted.
        window._bzRestoreOnReady = false;

        /* On desktop, still restore last-played song + sync UI */
        if (!state.isMobile()) {
            _tryRestoreSession(20); // up to 20 x 300ms = 6s of retries on desktop
            return;
        }

        _tryRestoreSession(25); // up to 25 x 300ms = 7.5s of retries on mobile
    };

    /********************************/
    /* MOBILE GESTURE ENGINE        */
    /********************************/
    const initGestures = () => {
        const area = document.getElementById('main-player');
        if (!area) return;

        let _touchOnButton = false;

        area.addEventListener('touchstart', (e) => {
            state.startX = e.changedTouches[0].screenX;
            state.startY = e.changedTouches[0].screenY;
            // Guard: record if the touch started on a button/interactive element
            // so the swipe engine ignores it completely (prevents accidental skips
            // when tapping prev/next/play-pause buttons).
            const target = e.target;
            _touchOnButton = !!(target && (
                target.tagName === 'BUTTON' ||
                target.closest('button') ||
                target.tagName === 'INPUT' ||
                target.tagName === 'A'
            ));
        }, { passive: true });

        area.addEventListener('touchend', (e) => {
            const dx = state.startX - e.changedTouches[0].screenX;
            const dy = state.startY - e.changedTouches[0].screenY;

            // Detect horizontal swipe skip.
            // Guard 1: horizontal distance must exceed threshold.
            // Guard 2: horizontal component must be at least 2× the vertical component
            //          so a diagonal scroll never accidentally skips the track.
            // Guard 3: skip if the progress bar scrub is active (avoids seek+skip race).
            // Guard 4: skip if the touch started on a button (avoids swipe+tap conflict).
            const isHorizontalSwipe = Math.abs(dx) > CONFIG.SWIPE_LIMIT && Math.abs(dx) >= 2 * Math.abs(dy);
            const isScrubbing = !!(window._bzScrubbing); // set by progress bar touchstart handler
            if (isHorizontalSwipe && !isScrubbing && !_touchOnButton) {
                if ("vibrate" in navigator) navigator.vibrate(15);
                // Guard: playNextSong / playPrevSong are defined inside startApp().
                // initGestures() runs at boot so these may not exist yet on the first
                // touch — the window.* check makes the swipe gracefully skip until ready.
                if (dx > 0 && typeof window.playNextSong === 'function') window.playNextSong();
                if (dx < 0 && typeof window.playPrevSong === 'function') window.playPrevSong();
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

        // Boot Recovery:
        // Primary path — restoreMobileSession is called from inside startApp() the moment
        //   masterPool is ready. This is always the fastest and most reliable path.
        // Fallback path — if startApp hasn't fired by window.load + BOOT_DELAY (e.g. very
        //   slow Sheets fetch with no cache), start the retry loop from here.
        const doRestore = () => {
            setTimeout(() => {
                // Only run the fallback retry loop if startApp hasn't already triggered restore
                if (!state.restored && typeof window.restoreMobileSession === 'function') {
                    window.restoreMobileSession();
                }
            }, CONFIG.BOOT_DELAY);
        };

        if (document.readyState === 'complete') {
            doRestore();
        } else {
            window.addEventListener('load', doRestore);
        }
    };

    initMobileApp();

})();
/* ═══════════════════════════════════════════════════════════
   BEAT ZEN — Scroll to Top & Year Jump Bar
   Bar uses position:fixed — immune to overflow-x:hidden on body.
   JS manages a padding-top spacer on <main> so content isn't hidden.
═══════════════════════════════════════════════════════════ */
(function () {
    const $ = id => document.getElementById(id);

    let scrollTopBtn, yearJumpBar, yearJumpInner;

    function initRefs() {
        scrollTopBtn = $('bz-scroll-top-btn');
        yearJumpBar = $('bz-year-jump-bar');
        yearJumpInner = $('bz-year-jump-inner');
    }

    /* ── Detect whether the Home view is active ── */
    function isHomeActive() {
        const ysc = $('year-sections-container');
        if (!ysc) return false;
        return ysc.style.display !== 'none' && !ysc.classList.contains('hidden');
    }

    /* ── Spacer: push main content down by bar height when bar is visible ── */
    function updateMainPadding(visible) {
        const main = document.querySelector('main.main-content');
        if (!main) return;
        if (visible) {
            const barH = yearJumpBar.offsetHeight || 0;
            main.style.paddingTop = barH + 'px';
        } else {
            main.style.paddingTop = '';
        }
    }

    /* ── Build the year jump pill buttons once data is available ── */
    let jumpBarBuilt = false;
    let _pillScrolling = false;
    let _pillScrollTimer = null;

    function buildYearJumpBar() {
        if (jumpBarBuilt) return;
        const years = Object.keys(window.customYearAlbumsData || {}).sort().reverse();
        if (!years.length) return;
        jumpBarBuilt = true;
        yearJumpInner.innerHTML = '';
        years.forEach(year => {
            const btn = document.createElement('button');
            btn.className = 'bz-year-jump-pill';
            btn.textContent = year;
            btn.setAttribute('aria-label', 'Jump to ' + year);
            btn.addEventListener('click', () => {
                // FIX Issue 1: Always call displayHome(false, year) directly.
                // The old homeLink.click() + setTimeout(300) was racing against
                // the requestAnimationFrame inside displayHome — on slow devices
                // scrollToYear fired before year-sec-${year} existed in the DOM,
                // producing a blank screen. displayHome already handles the
                // targetYear scroll AFTER real cards are painted inside its own rAF.
                if (!isHomeActive()) {
                    if (typeof window.displayHome === 'function') {
                        window.displayHome(false, year);
                    }
                } else {
                    scrollToYear(year);
                }
                setActiveJumpPill(btn);
                _pillScrolling = true;
                clearTimeout(_pillScrollTimer);
                _pillScrollTimer = setTimeout(() => { _pillScrolling = false; }, 900);
            });
            yearJumpInner.appendChild(btn);
        });
    }

    function getTotalFixedOffset() {
        const navH = (document.querySelector('.navbar') || { offsetHeight: 70 }).offsetHeight;
        const barH = (yearJumpBar && isHomeActive()) ? (yearJumpBar.offsetHeight || 0) : 0;
        return navH + barH + 8;
    }

    function scrollToYear(year) {
        const el = $('year-sec-' + year);
        if (!el) return;
        const offset = getTotalFixedOffset();
        const top = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
    }

    function setActiveJumpPill(activeBtn) {
        yearJumpInner.querySelectorAll('.bz-year-jump-pill').forEach(b => b.classList.remove('active'));
        if (activeBtn) activeBtn.classList.add('active');
    }

    /* ── Show / hide bar & scroll button ── */
    function syncVisibility() {
        const home = isHomeActive();
        yearJumpBar.style.display = home ? 'flex' : 'none';
        scrollTopBtn.style.display = (home && window.scrollY > 300) ? 'flex' : 'none';
        updateMainPadding(home);
        if (home) highlightVisibleYear();   /* refresh active pill whenever Home re-appears */
    }

    /* ── Highlight the pill that matches the currently visible year ── */
    function highlightVisibleYear() {
        if (!isHomeActive() || _pillScrolling) return;
        const pills = yearJumpInner.querySelectorAll('.bz-year-jump-pill');
        if (!pills.length) return;
        const offset = getTotalFixedOffset();
        let current = null;
        document.querySelectorAll('.year-section').forEach(sec => {
            if (sec.getBoundingClientRect().top <= offset) current = sec.id.replace('year-sec-', '');
        });
        pills.forEach(p => p.classList.toggle('active', p.textContent === current));
        const activePill = yearJumpInner.querySelector('.bz-year-jump-pill.active');
        if (activePill) {
            const pillLeft = activePill.offsetLeft;
            const pillW = activePill.offsetWidth;
            const barW = yearJumpInner.offsetWidth;
            yearJumpInner.scrollTo({ left: pillLeft - barW / 2 + pillW / 2, behavior: 'smooth' });
        }
    }

    /* ── Scroll listener ── */
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            syncVisibility();
            highlightVisibleYear();   /* keep active pill in sync while scrolling */
            ticking = false;
        });
    }, { passive: true });

    /* ── Scroll-to-top click ── */
    function bindScrollTopBtn() {
        if (!scrollTopBtn) return;
        scrollTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    /* ── Watch for tab switches ── */
    function observeHomeTab() {
        const ysc = $('year-sections-container');
        if (!ysc) return;
        new MutationObserver(() => {
            buildYearJumpBar();
            syncVisibility();
        }).observe(ysc, { attributes: true, attributeFilter: ['style', 'class'] });
    }

    /* ── Poll until data is ready ── */
    function waitForData() {
        if (window.customYearAlbumsData && Object.keys(window.customYearAlbumsData).length) {
            buildYearJumpBar();
            syncVisibility();
        } else {
            setTimeout(waitForData, 300);
        }
    }

    function init() {
        initRefs();
        bindScrollTopBtn();
        observeHomeTab();
        waitForData();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
// ═══════════════════════════════════════════════════════════════════
// AUTH GATE WIRING  (moved from index.html inline <script>)
// Connects auth-gate overlay buttons to the Settings panel.
// ═══════════════════════════════════════════════════════════════════
(function () {
    // Gate buttons trigger sign-in flows directly — NO navigation, NO history push.
    // Previously gateGoSettings() clicked the settings nav link, which hit bzNavGuard
    // (user not signed in → gate re-opens) creating an infinite loop, and also pushed
    // #settings into history so every Back press re-triggered the auth gate.
    document.addEventListener('DOMContentLoaded', function () {

        // "Sign Up with Username" → show the signup form inside Settings without navigating
        const signupBtn = document.getElementById('bz-gate-signup-btn');
        if (signupBtn) signupBtn.addEventListener('click', function () {
            // Ensure settings container is rendered (may not be if user never visited)
            if (typeof window.displaySettings === 'function') window.displaySettings(true);
            setTimeout(() => {
                const btn = document.getElementById('bz-show-signup-btn');
                if (btn) btn.click();
                // Show settings container underneath the gate so form is accessible
                // once the user dismisses or signs up
                const gate = document.getElementById('bz-auth-gate');
                if (gate) gate.classList.remove('bz-gate-visible');
            }, 120);
        });

        // "Sign In with Username" → show the signin form inside Settings without navigating
        const signinBtn = document.getElementById('bz-gate-signin-btn');
        if (signinBtn) signinBtn.addEventListener('click', function () {
            if (typeof window.displaySettings === 'function') window.displaySettings(true);
            setTimeout(() => {
                const btn = document.getElementById('bz-show-signin-btn');
                if (btn) btn.click();
                const gate = document.getElementById('bz-auth-gate');
                if (gate) gate.classList.remove('bz-gate-visible');
            }, 120);
        });

        // Legacy text-link fallback
        const signinLink = document.getElementById('bz-gate-signin-link');
        if (signinLink) signinLink.addEventListener('click', function () {
            if (typeof window.displaySettings === 'function') window.displaySettings(true);
            setTimeout(() => {
                const btn = document.getElementById('bz-show-signin-btn');
                if (btn) btn.click();
                const gate = document.getElementById('bz-auth-gate');
                if (gate) gate.classList.remove('bz-gate-visible');
            }, 120);
        });


    });
})();

// FULLSCREEN HELPER
// • _bzAttachFullscreenOnGesture()  — enter fullscreen on next user gesture (desktop fallback)
// • _bzCancelFullscreenOnGesture()  — cancel pending next-gesture listener when toggle turned OFF
// • _bzApplyFullscreenScrollLock()  — block pull-to-refresh while in fullscreen
// • fullscreenchange listener        — syncs toggle + scroll-lock when user exits via browser UI
(function _bzRegisterFullscreenHelper() {
    var _bzFsHandler = null; // reference to the pending next-gesture handler

    /* ── Pull-to-refresh / overscroll lock ───────────────────────────────── */
    var _scrollLockActive = false;
    function _onTouchMove(e) {
        if (window.scrollY <= 0 && e.touches && e.touches.length === 1) {
            e.preventDefault();
        }
    }
    window._bzApplyFullscreenScrollLock = function (enable) {
        if (enable && !_scrollLockActive) {
            _scrollLockActive = true;
            document.documentElement.style.overscrollBehavior = 'none';
            document.body.style.overscrollBehavior = 'none';
            document.addEventListener('touchmove', _onTouchMove, { passive: false });
        } else if (!enable && _scrollLockActive) {
            _scrollLockActive = false;
            document.documentElement.style.overscrollBehavior = '';
            document.body.style.overscrollBehavior = '';
            document.removeEventListener('touchmove', _onTouchMove);
        }
    };

    /* ── Cancel any pending next-gesture listener ────────────────────────── */
    window._bzCancelFullscreenOnGesture = function () {
        if (_bzFsHandler) {
            ['click', 'touchstart'].forEach(function (ev) {
                document.removeEventListener(ev, _bzFsHandler, { capture: true });
            });
            _bzFsHandler = null;
        }
    };

    /* ── Attach next-gesture listener ────────────────────────────────────── */
    window._bzAttachFullscreenOnGesture = function () {
        if (_bzFsHandler) return; // already waiting
        if (!document.documentElement.requestFullscreen) return;

        _bzFsHandler = function () {
            _bzFsHandler = null;
            ['click', 'touchstart'].forEach(function (ev) {
                document.removeEventListener(ev, arguments.callee, { capture: true });
            });
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen({ navigationUI: 'hide' })
                    .then(function () { window._bzApplyFullscreenScrollLock(true); })
                    .catch(function () { });
            }
        };

        ['click', 'touchstart'].forEach(function (ev) {
            document.addEventListener(ev, _bzFsHandler, { capture: true, once: true, passive: true });
        });
    };

    /* ── Release scroll lock / cleanup when user exits fullscreen via browser UI ── */
    document.addEventListener('fullscreenchange', function () {
        if (!document.fullscreenElement) {
            window._bzCancelFullscreenOnGesture();
            window._bzApplyFullscreenScrollLock(false);
        } else {
            window._bzApplyFullscreenScrollLock(true);
        }
    });

    /* ── Fullscreen Mode setting removed — no longer auto-attaches on load.
         Stale 'beatZen_fullscreenMode' flags from older sessions are cleared
         below so they can't silently re-trigger this behavior later. ───── */
    try { localStorage.removeItem('beatZen_fullscreenMode'); } catch (_) { }
})();


// ═══════════════════════════════════════════════════════════════════
function bzTogglePw(inputId, btn) {
    var inp = document.getElementById(inputId);
    if (!inp) return;
    var show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    var icon = btn.querySelector('i');
    if (icon) icon.className = show ? 'fas fa-eye-slash' : 'fas fa-eye';
}

// ═══════════════════════════════════════════════════════════════════
// FEATURE: Status Bar Tinting  — keeps meta[theme-color] in sync
//          with the app's current background colour.
// ═══════════════════════════════════════════════════════════════════
(function bzStatusBarTint() {
    const metaTag = document.getElementById('bz-theme-color');
    if (!metaTag) return;

    function readBgColor() {
        // Use --bg-color if present, fall back to a safe dark default
        const raw = getComputedStyle(document.documentElement)
            .getPropertyValue('--bg-color').trim();
        return raw || '#1a1a1a';
    }

    function applyTint() {
        metaTag.setAttribute('content', readBgColor());
    }

    // Apply once on load
    applyTint();

    // Re-apply whenever dark-mode or theme class changes on <body> / <html>
    const observer = new MutationObserver(applyTint);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-theme'] });

    // Also expose so other code can trigger a manual refresh if needed
    window.bzUpdateThemeColor = applyTint;
})();
// ═══════════════════════════════════════════════════════════════════
// LYRICS ENGINE  v4
//   Sources: Firestore (admin-saved) → lrclib plainLyrics only → lyrics.ovh
//   NOTE: syncedLyrics (timestamped) intentionally NOT used — plain text only.
//   Admin: edit & save lyrics per song to Firestore collection "bz_lyrics".
//   Telugu transliteration: Telugu script → English phonetic (toggle).
// ═══════════════════════════════════════════════════════════════════
(function () {

    const BZ_LYRICS_ADMIN_EMAIL = 'sairuthwik2002@gmail.com'; // ← CHANGE THIS

    // Consonants carry an inherent "a" sound unless followed by a vowel-sign or halant (్)
    const TEL_CONSONANTS = {
        'క': 'k', 'ఖ': 'kh', 'గ': 'g', 'ఘ': 'gh', 'ఙ': 'ng',
        'చ': 'ch', 'ఛ': 'chh', 'జ': 'j', 'ఝ': 'jh', 'ఞ': 'ny',
        'ట': 't', 'ఠ': 'th', 'డ': 'd', 'ఢ': 'dh', 'ణ': 'n',
        'త': 't', 'థ': 'th', 'ద': 'd', 'ధ': 'dh', 'న': 'n',
        'ప': 'p', 'ఫ': 'ph', 'బ': 'b', 'భ': 'bh', 'మ': 'm',
        'య': 'y', 'ర': 'r', 'ల': 'l', 'వ': 'v',
        'శ': 'sh', 'ష': 'sh', 'స': 's', 'హ': 'h',
        'ళ': 'l', 'ఱ': 'r'
    };
    // Independent vowels (start of word/syllable)
    const TEL_VOWELS = {
        'అ': 'a', 'ఆ': 'aa', 'ఇ': 'i', 'ఈ': 'ee', 'ఉ': 'u', 'ఊ': 'oo', 'ఋ': 'ri',
        'ఎ': 'e', 'ఏ': 'e', 'ఐ': 'ai', 'ఒ': 'o', 'ఓ': 'o', 'ఔ': 'au'
    };
    // Vowel signs (matras) attached to a consonant — replace the inherent "a"
    const TEL_MATRAS = {
        'ా': 'a', 'ి': 'i', 'ీ': 'i', 'ు': 'u', 'ూ': 'u', 'ృ': 'ri',
        'ె': 'e', 'ే': 'e', 'ై': 'ai', 'ొ': 'o', 'ో': 'o', 'ౌ': 'au'
    };
    const TEL_OTHER = {
        'ం': 'n', 'ః': 'h',
        '౦': '0', '౧': '1', '౨': '2', '౩': '3', '౪': '4',
        '౫': '5', '౬': '6', '౭': '7', '౮': '8', '౯': '9'
    };

    // ── Devanagari (Hindi) phonetic maps — same syllable approach ──
    const DEV_CONSONANTS = {
        'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
        'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
        'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
        'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
        'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
        'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v',
        'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
        'ळ': 'l', 'क्ष': 'ksh', 'ज्ञ': 'gy'
    };
    const DEV_VOWELS = {
        'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri',
        'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au'
    };
    const DEV_MATRAS = {
        'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'ृ': 'ri',
        'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au'
    };
    const DEV_OTHER = {
        'ं': 'n', 'ँ': 'n', 'ः': 'h',
        '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
        '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
    };
    const DEV_HALANT = '्';

    // Capitalize first letter of each whitespace-separated word.
    // NOTE: \b is intentionally NOT used — it is ASCII-only and fires at every
    // ASCII↔non-ASCII boundary, incorrectly capitalising letters inside IAST words
    // (e.g. "bāruluNtāY" → "BĀRuluNtĀY"). Splitting on whitespace is safe and correct.
    function _capWords(s) {
        return s.split(/(\s+)/).map(seg =>
            (seg && !/^\s/.test(seg))
                ? seg.replace(/^\p{L}/u, c => c.toUpperCase())
                : seg
        ).join('');
    }

    function _toEnglish(text) {
        if (!text || !/[\u0900-\u097F\u0C00-\u0C7F]/.test(text)) return text;
        const ch = [...text];
        let out = '', i = 0;
        while (i < ch.length) {
            const c = ch[i];

            // Pick the script map for this character
            let CONS, VOW, MAT, OTH, HAL;
            if (/[\u0C00-\u0C7F]/.test(c)) {
                CONS = TEL_CONSONANTS; VOW = TEL_VOWELS; MAT = TEL_MATRAS; OTH = TEL_OTHER; HAL = '్';
            } else if (/[\u0900-\u097F]/.test(c)) {
                CONS = DEV_CONSONANTS; VOW = DEV_VOWELS; MAT = DEV_MATRAS; OTH = DEV_OTHER; HAL = DEV_HALANT;
            } else {
                // Pass through only plain ASCII (spaces, punctuation, English words).
                // Non-ASCII characters here are IAST/romanisation artifacts that leak
                // in when lyrics sources store both Telugu script and a pre-romanised
                // version on the same line (e.g. lyricstape.com). Skipping them prevents
                // duplicate words and garbled diacritical marks in the output.
                if (c.charCodeAt(0) <= 0x7F) out += c;
                i++;
                continue;
            }

            // Independent vowel
            if (VOW[c]) { out += VOW[c]; i++; continue; }

            // Anusvara / visarga / digits
            if (OTH[c]) { out += OTH[c]; i++; continue; }

            // Consonant — check what follows
            if (CONS[c]) {
                let base = CONS[c];
                i++;
                const next = ch[i];
                if (next === HAL) {
                    // Halant: drop inherent vowel, consonant joins the next syllable
                    out += base;
                    i++; // consume halant
                } else if (next && MAT[next]) {
                    // Consonant + vowel sign
                    out += base + MAT[next];
                    i++;
                } else {
                    // Bare consonant — inherent "a"
                    out += base + 'a';
                }
                continue;
            }

            out += c;
            i++;
        }
        return _capWords(out);
    }

    function _esc(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ── Parallel lyrics fetcher ───────────────────────────────────────────────
    // 1. Firestore first (admin-saved, authoritative) — awaited alone.
    // 2. If not found, fire lrclib + lyrics.ovh + lyricstape simultaneously;
    //    whichever resolves first with a non-empty string wins.
    async function _fetchLyrics(songId, title, artist, movie) {
        const t = (title || '').trim();
        const a = (artist || '').trim();
        const mv = (movie || '').trim();
        if (!t && !a) throw new Error('no-meta');

        // Step 1 — Firestore (admin-saved beats everything)
        const fromFs = await _fsGet(songId);
        if (fromFs) return fromFs;

        // Step 2 — lrclib first (prefers synced/timed); fallback to plain sources
        const lrclibResult = await _lrclib(t, a);
        // If lrclib returned synced LRC, use it immediately (best quality)
        if (lrclibResult && lrclibResult.startsWith('\x00LRC\x00')) return lrclibResult;

        // Step 3 — race plain sources + lrclib plain result together
        const plainWinner = await Promise.any([
            lrclibResult ? Promise.resolve(lrclibResult) : Promise.reject(),
            _ovh(t, a).then(r => r || Promise.reject()),
            _lyricstape(t, a, mv).then(r => r || Promise.reject())
        ]).catch(() => null);

        if (plainWinner) return plainWinner;
        throw new Error('not-found');
    }

    // ── LRC helpers ───────────────────────────────────────────────────────────
    const LRC_TAG = '\x00LRC\x00';
    function _isLRC(raw) { return raw && raw.startsWith(LRC_TAG); }
    function _stripLRC(raw) { return _isLRC(raw) ? raw.slice(LRC_TAG.length) : raw; }

    // Parse "[mm:ss.xx] line text" → [{t: seconds, text: string}, ...]
    function _parseLRC(lrc) {
        const lines = lrc.split('\n');
        const re = /^\[(\d+):(\d+(?:\.\d+)?)\](.*)/;
        const out = [];
        for (const line of lines) {
            const m = re.exec(line.trim());
            if (!m) continue;
            const t = parseInt(m[1], 10) * 60 + parseFloat(m[2]);
            const text = m[3].trim();
            if (text) out.push({ t, text });
        }
        return out.sort((a, b) => a.t - b.t);
    }

    // Render timed lines as spans with data-t attribute
    function _renderLRC(parsed, translit) {
        if (!parsed.length) return '';
        return parsed.map((line, idx) => {
            const txt = translit ? _toEnglish(line.text) : line.text;
            return `<span class="bz-lyr-line bz-lyr-timed" data-t="${line.t}" data-idx="${idx}">${_esc(txt)}</span>`;
        }).join('\n');
    }

    function _format(raw, translit) {
        const src = _stripLRC(raw);
        // Treat as LRC if (a) tagged with \x00LRC\x00, OR (b) the text itself opens
        // with a [mm:ss…] timestamp — handles Firestore-saved lyrics that were pasted
        // with timestamps but never received the internal LRC_TAG prefix.
        if (_isLRC(raw) || /^\s*\[\d+:\d+/.test(src)) {
            const parsed = _parseLRC(src);
            if (parsed.length) return _renderLRC(parsed, translit);
        }
        return src.trim().split('\n').map(line => {
            if (!line.trim()) return '<div class="bz-lyr-gap"></div>';
            const txt = translit ? _toEnglish(line) : line;
            return `<span class="bz-lyr-line">${_esc(txt)}</span>`;
        }).join('\n');
    }

    // ── Timestamp sync controller ─────────────────────────────────────────────
    // Returned object exposes .start() / .stop() — call start() after rendering
    // timed lines; call stop() when overlay closes.
    function _makeLRCSync(audio, bodyEl) {
        let _raf = null;
        let _lastIdx = -1;

        function _tick() {
            const ct = audio.currentTime;
            const lines = bodyEl.querySelectorAll('.bz-lyr-timed');
            if (!lines.length) { _raf = requestAnimationFrame(_tick); return; }

            // Binary-search for the last line whose timestamp <= currentTime
            let lo = 0, hi = lines.length - 1, best = -1;
            while (lo <= hi) {
                const mid = (lo + hi) >> 1;
                if (parseFloat(lines[mid].dataset.t) <= ct) { best = mid; lo = mid + 1; }
                else hi = mid - 1;
            }

            if (best !== _lastIdx) {
                _lastIdx = best;
                lines.forEach((el, i) => {
                    el.classList.toggle('bz-lyr-active', i === best);
                    el.classList.toggle('bz-lyr-past', i < best);
                    if (i !== best) el.style.removeProperty('--lyr-fill');
                });
                if (best >= 0) {
                    const active = lines[best];
                    // Smooth scroll active line to 40% from top of scroll container
                    const container = bodyEl;
                    const offset = active.offsetTop - container.clientHeight * 0.38;
                    container.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
                }
            }

            // Per-line fill progress: interpolate between this line's t and next line's t
            if (best >= 0) {
                const activeLine = lines[best];
                const tStart = parseFloat(activeLine.dataset.t);
                const tEnd = best + 1 < lines.length
                    ? parseFloat(lines[best + 1].dataset.t)
                    : (audio.duration || tStart + 4);
                const dur = tEnd - tStart;
                const fill = dur > 0 ? Math.min(1, (ct - tStart) / dur) : 1;
                activeLine.style.setProperty('--lyr-fill', fill);
            }

            _raf = requestAnimationFrame(_tick);
        }

        // Click-to-seek: tap any timed line to jump to its timestamp
        function _wireClicks() {
            const lines = bodyEl.querySelectorAll('.bz-lyr-timed');
            lines.forEach(el => {
                el.addEventListener('click', () => {
                    const t = parseFloat(el.dataset.t);
                    if (!isNaN(t) && audio) {
                        audio.currentTime = t;
                        if (audio.paused) audio.play().catch(() => { });
                    }
                });
            });
        }

        return {
            start() {
                if (!_raf) _raf = requestAnimationFrame(_tick);
                _wireClicks();
            },
            stop() { if (_raf) { cancelAnimationFrame(_raf); _raf = null; _lastIdx = -1; } }
        };
    }

    function _isAdmin() {
        try {
            const u = firebase.auth().currentUser;
            return !!(u && u.email && u.email.toLowerCase().trim() === BZ_LYRICS_ADMIN_EMAIL.toLowerCase().trim());
        } catch (_) { return false; }
    }

    // ── Firestore ─────────────────────────────────────────────────────────────
    async function _fsGet(songId) {
        try {
            const snap = await db.collection('bz_lyrics').doc(String(songId)).get();
            if (snap.exists) return (snap.data().lyrics || '').trim() || null;
        } catch (_) { }
        return null;
    }
    async function _fsSave(songId, lyrics) {
        await db.collection('bz_lyrics').doc(String(songId)).set({
            lyrics: lyrics.trim(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    // ── lrclib — syncedLyrics preferred, plainLyrics fallback ────────────────
    async function _lrclib(title, artist) {
        try {
            const t = encodeURIComponent(title.trim());
            const a = encodeURIComponent(artist.trim());
            let res = await fetch(`https://lrclib.net/api/search?track_name=${t}&artist_name=${a}`);
            let list = res.ok ? await res.json() : [];
            if (!Array.isArray(list) || !list.length) {
                res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent((title + ' ' + artist).trim())}`);
                list = res.ok ? await res.json() : [];
            }
            if (!Array.isArray(list) || !list.length) return null;
            const tl = title.toLowerCase();
            list.sort((a, b) => {
                const am = (a.trackName || '').toLowerCase() === tl ? 0 : 1;
                const bm = (b.trackName || '').toLowerCase() === tl ? 0 : 1;
                return am !== bm ? am - bm : (b.duration || 0) - (a.duration || 0);
            });
            // Prefer synced lyrics (LRC format with timestamps) for live sync
            const synced = (list[0].syncedLyrics || '').trim();
            if (synced) return '\x00LRC\x00' + synced; // tagged as LRC
            const plain = (list[0].plainLyrics || '').trim();
            return plain || null;
        } catch (_) { }
        return null;
    }

    // ── lyrics.ovh ────────────────────────────────────────────────────────────
    async function _ovh(title, artist) {
        try {
            const res = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
            if (!res.ok) return null;
            const j = await res.json();
            return (j.lyrics || '').trim() || null;
        } catch (_) { }
        return null;
    }

    // ── lyricstape.com — search then scrape lyric page ───────────────────────
    async function _lyricstape(title, artist, movie) {
        try {
            const query = (movie || title || '').trim();
            if (!query) return null;
            const searchUrl = `https://www.lyricstape.com/search?q=${encodeURIComponent(query)}`;
            const searchRes = await fetch(searchUrl);
            if (!searchRes.ok) return null;
            const searchHtml = await searchRes.text();

            // Extract candidate album/song links
            const linkRe = /href="(https:\/\/www\.lyricstape\.com\/album\/[^"]+)"[^>]*>([^<]*)</gi;
            let m, links = [];
            while ((m = linkRe.exec(searchHtml)) !== null) {
                links.push({ url: m[1], text: m[2].trim() });
            }
            if (!links.length) return null;

            const tl = (title || '').toLowerCase();
            // Prefer a link whose text matches the song title; else first result
            let best = links.find(l => tl && l.text.toLowerCase().includes(tl)) || links[0];

            const pageRes = await fetch(best.url);
            if (!pageRes.ok) return null;
            const pageHtml = await pageRes.text();

            // Try to find the lyrics block — commonly inside a div with id/class containing "lyrics"
            const blockRe = /<div[^>]*(?:id|class)="[^"]*lyrics[^"]*"[^>]*>([\s\S]*?)<\/div>/i;
            const blockMatch = pageHtml.match(blockRe);
            if (!blockMatch) return null;

            let text = blockMatch[1]
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<\/p>/gi, '\n')
                .replace(/<[^>]+>/g, '')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&nbsp;/g, ' ')
                .trim();

            return text || null;
        } catch (_) { }
        return null;
    }

    // ── Main ──────────────────────────────────────────────────────────────────
    window.bzShowLyrics = async function (songId, title, artist, movie) {
        document.getElementById('bz-lyr-overlay')?.remove();
        const isAdmin = _isAdmin();

        function _getMini() {
            const cover = document.getElementById('player-album-cover')?.src || '';
            const t = document.getElementById('player-song-title')?.textContent || title || '';
            const a = document.getElementById('player-song-artist')?.textContent || artist || '';
            const playing = !document.getElementById('audio-player')?.paused;
            return { cover, t, a, playing };
        }
        const mini = _getMini();

        const ov = document.createElement('div');
        ov.id = 'bz-lyr-overlay';
        ov.innerHTML = `
<div class="bz-lyr-wrap">
  <div class="bz-lyr-miniplayer">
    <div class="bz-lyr-mini-left">
      <img class="bz-lyr-mini-cover" id="bz-lyr-mini-cover" src="${_esc(mini.cover)}" alt="">
      <div class="bz-lyr-mini-info">
        <div class="bz-lyr-mini-title" id="bz-lyr-mini-title">${_esc(mini.t)}</div>
        <div class="bz-lyr-mini-artist" id="bz-lyr-mini-artist">${_esc(mini.a)}</div>
      </div>
    </div>
    <div class="bz-lyr-mini-controls">
      <button class="bz-lyr-ctrl" id="bz-lyr-prev"><i class="fas fa-step-backward"></i></button>
      <button class="bz-lyr-ctrl bz-lyr-pp" id="bz-lyr-pp"><i class="${mini.playing ? 'fas fa-pause' : 'fas fa-play'}"></i></button>
      <button class="bz-lyr-ctrl" id="bz-lyr-next"><i class="fas fa-step-forward"></i></button>
    </div>
    <div class="bz-lyr-mini-right">
      <label class="bz-lyr-translit-toggle" id="bz-lyr-translit-wrap" title="Show English lyrics">
        <span class="bz-lyr-translit-label">EN</span>
        <span class="bz-lyr-toggle-track" id="bz-lyr-translit">
          <span class="bz-lyr-toggle-thumb"></span>
        </span>
      </label>
      <button class="bz-lyr-sync-btn" id="bz-lyr-sync-btn" title="Sync lyrics to playback" aria-pressed="false">
        <i class="fas fa-align-center"></i>
      </button>
      ${isAdmin ? `<button class="bz-lyr-edit-btn" id="bz-lyr-edit" title="Edit lyrics"><i class="fas fa-pen"></i></button>` : ''}
      <button class="bz-lyr-close" id="bz-lyr-close" title="Close"><i class="fas fa-chevron-down"></i></button>
    </div>
  </div>

  <div class="bz-lyr-body" id="bz-lyr-body">
    <div class="bz-lyr-loading"><div class="bz-lyr-spinner"></div><span>Fetching lyrics…</span></div>
  </div>

  ${isAdmin ? `<div class="bz-lyr-editor" id="bz-lyr-editor" style="display:none">
    <textarea class="bz-lyr-textarea" id="bz-lyr-ta" placeholder="Paste lyrics here…" spellcheck="false"></textarea>
    <div class="bz-lyr-editor-btns">
      <button class="bz-lyr-cancel" id="bz-lyr-cancel">Cancel</button>
      <button class="bz-lyr-save" id="bz-lyr-save"><i class="fas fa-floppy-disk"></i> Save Lyrics</button>
    </div>
  </div>` : ''}
</div>`;
        document.body.appendChild(ov);

        // ── Apply song-color palette to lyrics overlay ──────────────────────────
        // Reads the current album-art URL, sets --lyr-cover-url for the blurred
        // background pseudo-element, then extracts dominant color via canvas and
        // sets --bg-color / --text-color / --accent-color on the overlay so every
        // CSS rule that references those vars automatically adapts.
        (function bzLyrApplyColor() {
            const coverSrc = mini.cover || '';
            if (!coverSrc) return;

            // Set the blurred background immediately (CSS ::before uses this)
            ov.style.setProperty('--lyr-cover-url', `url("${coverSrc}")`);

            // Extract dominant color via canvas for text-safe theming
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = function () {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = 16; canvas.height = 16;  // tiny = fast
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, 16, 16);
                    const data = ctx.getImageData(0, 0, 16, 16).data;

                    // Average all sampled pixels
                    let r = 0, g = 0, b = 0, total = 0;
                    for (let i = 0; i < data.length; i += 4) {
                        r += data[i];
                        g += data[i + 1];
                        b += data[i + 2];
                        total++;
                    }
                    r = Math.round(r / total);
                    g = Math.round(g / total);
                    b = Math.round(b / total);

                    // Darken heavily so it becomes a rich, readable bg tint
                    const darken = 0.22;
                    const dr = Math.round(r * darken);
                    const dg = Math.round(g * darken);
                    const db = Math.round(b * darken);

                    // Accent: boosted mid-brightness for highlights
                    const ar = Math.min(255, Math.round(r * 1.7));
                    const ag = Math.min(255, Math.round(g * 1.7));
                    const ab = Math.min(255, Math.round(b * 1.7));

                    ov.style.setProperty('--bg-color', `rgb(${dr},${dg},${db})`);
                    ov.style.setProperty('--text-color', '#ffffff');
                    ov.style.setProperty('--accent-color', `rgb(${ar},${ag},${ab})`);

                    // Tint the mini-player bar to a slightly lighter shade of bg
                    const lr = Math.min(255, dr + 20);
                    const lg = Math.min(255, dg + 20);
                    const lb = Math.min(255, db + 20);
                    const miniBar = ov.querySelector('.bz-lyr-miniplayer');
                    if (miniBar) {
                        miniBar.style.background = `rgba(${lr},${lg},${lb},0.82)`;
                        miniBar.style.backdropFilter = 'blur(18px)';
                        miniBar.style.webkitBackdropFilter = 'blur(18px)';
                        miniBar.style.borderBottom = `1px solid rgba(${ar},${ag},${ab},0.22)`;
                    }
                } catch (_e) {
                    // Canvas tainted or otherwise failed — leave CSS defaults
                }
            };
            img.onerror = function () { };
            img.src = coverSrc;
        })();
        // ─────────────────────────────────────────────────────────────────────────

        // Close
        function _close() {
            _stopSync();
            _audio?.removeEventListener('play', _syncPP);
            _audio?.removeEventListener('pause', _syncPP);
            _audio?.removeEventListener('playing', _syncPP);
            ov.classList.add('bz-lyr-exit');
            setTimeout(() => ov.remove(), 320);
        }
        document.getElementById('bz-lyr-close').onclick = _close;
        let _ty = 0;
        ov.addEventListener('touchstart', e => { _ty = e.changedTouches[0].clientY; }, { passive: true });
        ov.addEventListener('touchend', e => { if (e.changedTouches[0].clientY - _ty > 70) _close(); }, { passive: true });

        // Mini controls
        document.getElementById('bz-lyr-prev')?.addEventListener('click', () => document.getElementById('prev-btn')?.click());
        document.getElementById('bz-lyr-next')?.addEventListener('click', () => document.getElementById('next-btn')?.click());
        const ppBtn = document.getElementById('bz-lyr-pp');
        ppBtn?.addEventListener('click', () => {
            document.getElementById('play-pause-btn')?.click();
            setTimeout(() => {
                const icon = ppBtn.querySelector('i');
                if (icon) icon.className = document.getElementById('audio-player')?.paused ? 'fas fa-play' : 'fas fa-pause';
            }, 80);
        });
        // ── LRC sync controller (started only when sync is ON) ───────────────
        const _audio = document.getElementById('audio-player');
        let _lrcSync = null;
        let _syncEnabled = false; // OFF by default — user must turn on

        function _startSync(bodyEl) {
            if (_lrcSync) _lrcSync.stop();
            _lrcSync = null;
            if (!_syncEnabled) return; // only run when user toggled on
            if (_audio && bodyEl && bodyEl.querySelector('.bz-lyr-timed')) {
                _lrcSync = _makeLRCSync(_audio, bodyEl);
                _lrcSync.start();
            }
        }
        function _stopSync() { if (_lrcSync) { _lrcSync.stop(); _lrcSync = null; } }

        // Wire sync toggle button
        const _syncBtn = document.getElementById('bz-lyr-sync-btn');
        if (_syncBtn) {
            _syncBtn.addEventListener('click', function () {
                _syncEnabled = !_syncEnabled;
                _syncBtn.classList.toggle('active', _syncEnabled);
                _syncBtn.setAttribute('aria-pressed', String(_syncEnabled));
                const bodyEl = document.getElementById('bz-lyr-body');
                if (_syncEnabled) {
                    _startSync(bodyEl); // start immediately if LRC lines exist
                } else {
                    _stopSync();
                    // Reset line highlights when turned off
                    if (bodyEl) bodyEl.querySelectorAll('.bz-lyr-timed').forEach(el => {
                        el.classList.remove('bz-lyr-active', 'bz-lyr-past');
                    });
                }
            });
        }

        // ── Track last-seen song so we can detect actual song changes ──
        let _lastSongId = String(songId || '');

        // ── Reload lyrics + color theme for the new current song ──────────────
        async function _reloadForCurrentSong() {
            const song = window.playingAlbum?.songs?.[window.currentSongIndex];
            if (!song) return;
            const newId = String(song.id || '');
            if (newId === _lastSongId) return;
            _lastSongId = newId;

            const m = _getMini();
            const mc = document.getElementById('bz-lyr-mini-cover');
            const mt = document.getElementById('bz-lyr-mini-title');
            const ma = document.getElementById('bz-lyr-mini-artist');
            if (mc) mc.src = m.cover;
            if (mt) mt.textContent = m.t;
            if (ma) ma.textContent = m.a;

            const newCover = m.cover || '';
            if (newCover) {
                ov.style.setProperty('--lyr-cover-url', `url("${newCover}")`);
                const imgC = new Image();
                imgC.crossOrigin = 'anonymous';
                imgC.onload = function () {
                    try {
                        const cv = document.createElement('canvas');
                        cv.width = 16; cv.height = 16;
                        const cx = cv.getContext('2d');
                        cx.drawImage(imgC, 0, 0, 16, 16);
                        const d = cx.getImageData(0, 0, 16, 16).data;
                        let r = 0, g = 0, b = 0, tot = 0;
                        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; tot++; }
                        r = Math.round(r / tot); g = Math.round(g / tot); b = Math.round(b / tot);
                        const dr = Math.round(r * 0.22), dg = Math.round(g * 0.22), db = Math.round(b * 0.22);
                        const ar = Math.min(255, Math.round(r * 1.7)), ag = Math.min(255, Math.round(g * 1.7)), ab = Math.min(255, Math.round(b * 1.7));
                        ov.style.setProperty('--bg-color', `rgb(${dr},${dg},${db})`);
                        ov.style.setProperty('--text-color', '#ffffff');
                        ov.style.setProperty('--accent-color', `rgb(${ar},${ag},${ab})`);
                        const lr = Math.min(255, dr + 20), lg = Math.min(255, dg + 20), lb = Math.min(255, db + 20);
                        const miniBar = ov.querySelector('.bz-lyr-miniplayer');
                        if (miniBar) {
                            miniBar.style.background = `rgba(${lr},${lg},${lb},0.82)`;
                            miniBar.style.backdropFilter = 'blur(18px)';
                            miniBar.style.webkitBackdropFilter = 'blur(18px)';
                            miniBar.style.borderBottom = `1px solid rgba(${ar},${ag},${ab},0.22)`;
                        }
                    } catch (_e) { }
                };
                imgC.onerror = function () { };
                imgC.src = newCover;
            }

            _stopSync();
            const bodyEl2 = document.getElementById('bz-lyr-body');
            const editorEl2 = document.getElementById('bz-lyr-editor');
            if (bodyEl2) {
                if (editorEl2) editorEl2.style.display = 'none';
                bodyEl2.style.display = '';
                bodyEl2.innerHTML = '<div class="bz-lyr-loading"><div class="bz-lyr-spinner"></div><span>Fetching lyrics…</span></div>';
            }
            _raw = '';

            try {
                const nm = (song.movie || window.playingAlbum?.title || window.playingAlbum?.name || '').trim();
                const raw = await _fetchLyrics(newId, song.title, song.artist, nm);
                _raw = raw;
                if (bodyEl2) {
                    bodyEl2.innerHTML = `<div class="bz-lyr-text">${_format(raw, _translit)}</div>`;
                    // Auto-enable sync when _format() actually produced timed lines —
                    // this covers both \x00LRC\x00-tagged results and plain text with
                    // [mm:ss] timestamps loaded from Firestore (no LRC_TAG prefix).
                    if (bodyEl2.querySelector('.bz-lyr-timed')) {
                        _syncEnabled = true;
                        if (_syncBtn) { _syncBtn.classList.add('active'); _syncBtn.setAttribute('aria-pressed', 'true'); }
                        _startSync(bodyEl2);
                    } else {
                        _syncEnabled = false;
                        if (_syncBtn) { _syncBtn.classList.remove('active'); _syncBtn.setAttribute('aria-pressed', 'false'); }
                        _startSync(bodyEl2);
                    }
                }
            } catch (_err2) {
                const song2 = window.playingAlbum?.songs?.[window.currentSongIndex];
                const gq = encodeURIComponent(`${song2?.title || ''} ${song2?.movie || ''} lyrics`.trim().replace(/\s+/g, ' '));
                if (bodyEl2) bodyEl2.innerHTML = `
<div class="bz-lyr-error">
  <i class="fas fa-music"></i>
  <p>No lyrics available for this song.</p>
  <div class="bz-lyr-links">
    <a href="https://www.google.com/search?q=${gq}" target="_blank" rel="noopener">Google</a>
  </div>
  ${_isAdmin() ? '<p class="bz-lyr-admin-tip"><i class="fas fa-pen"></i> Use Edit to paste lyrics manually.</p>' : ''}
</div>`;
            }
        }

        function _syncPP() {
            const icon = ppBtn?.querySelector('i');
            if (icon) icon.className = _audio?.paused ? 'fas fa-play' : 'fas fa-pause';
            const m = _getMini();
            const mc = document.getElementById('bz-lyr-mini-cover');
            const mt = document.getElementById('bz-lyr-mini-title');
            const ma = document.getElementById('bz-lyr-mini-artist');
            if (mc) mc.src = m.cover;
            if (mt) mt.textContent = m.t;
            if (ma) ma.textContent = m.a;
            _reloadForCurrentSong();
        }
        _audio?.addEventListener('play', _syncPP);
        _audio?.addEventListener('pause', _syncPP);
        _audio?.addEventListener('playing', _syncPP);

        // Transliterate toggle — visible to everyone, default ON (English)
        let _translit = true, _raw = '';
        document.getElementById('bz-lyr-translit-wrap')?.classList.add('active');
        document.getElementById('bz-lyr-translit')?.addEventListener('click', function () {
            _translit = !_translit;
            document.getElementById('bz-lyr-translit-wrap')?.classList.toggle('active', _translit);
            const bodyEl = document.getElementById('bz-lyr-body');
            if (_raw && bodyEl) {
                _stopSync();
                bodyEl.innerHTML = `<div class="bz-lyr-text">${_format(_raw, _translit)}</div>`;
                _startSync(bodyEl);
            }
        });

        // Admin edit/save
        const bodyEl = document.getElementById('bz-lyr-body');
        const editorEl = document.getElementById('bz-lyr-editor');
        const taEl = document.getElementById('bz-lyr-ta');
        document.getElementById('bz-lyr-edit')?.addEventListener('click', () => {
            taEl.value = _raw;
            bodyEl.style.display = 'none';
            editorEl.style.display = 'flex';
            taEl.focus();
        });
        document.getElementById('bz-lyr-cancel')?.addEventListener('click', () => {
            editorEl.style.display = 'none';
            bodyEl.style.display = '';
        });
        const saveBtn = document.getElementById('bz-lyr-save');
        saveBtn?.addEventListener('click', async () => {
            const txt = taEl.value.trim();
            if (!txt) return;
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';
            try {
                await _fsSave(songId, txt);
                _raw = txt;
                _stopSync();
                bodyEl.innerHTML = `<div class="bz-lyr-text">${_format(txt, _translit)}</div>`;
                editorEl.style.display = 'none';
                bodyEl.style.display = '';
                // Auto-enable sync based on what _format() actually rendered —
                // _format() now handles both \x00LRC\x00-tagged and plain [mm:ss] text,
                // so a DOM check is the single source of truth.
                if (bodyEl.querySelector('.bz-lyr-timed')) {
                    _syncEnabled = true;
                    if (_syncBtn) { _syncBtn.classList.add('active'); _syncBtn.setAttribute('aria-pressed', 'true'); }
                    _startSync(bodyEl);
                } else {
                    _syncEnabled = false;
                    if (_syncBtn) { _syncBtn.classList.remove('active'); _syncBtn.setAttribute('aria-pressed', 'false'); }
                }
                if (typeof showToast === 'function') showToast('✓ Lyrics saved!');
            } catch (err) { bzAlert('danger', 'Save Failed', err.message); }
            finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-floppy-disk"></i> Save Lyrics';
            }
        });

        // Animate in
        requestAnimationFrame(() => requestAnimationFrame(() => ov.classList.add('bz-lyr-in')));

        // Fetch lyrics — Firestore first, then all external sources in parallel
        try {
            const raw = await _fetchLyrics(songId, title, artist, movie);
            _raw = raw;
            bodyEl.innerHTML = `<div class="bz-lyr-text">${_format(raw, _translit)}</div>`;
            // Auto-enable sync when _format() actually produced timed lines —
            // covers both lrclib LRC_TAG results and Firestore-saved plain LRC text.
            if (bodyEl.querySelector('.bz-lyr-timed')) {
                _syncEnabled = true;
                if (_syncBtn) { _syncBtn.classList.add('active'); _syncBtn.setAttribute('aria-pressed', 'true'); }
                _startSync(bodyEl);
            } else {
                _syncEnabled = false;
                if (_syncBtn) { _syncBtn.classList.remove('active'); _syncBtn.setAttribute('aria-pressed', 'false'); }
                _startSync(bodyEl);
            }
        } catch (_err) {
            const gq = encodeURIComponent(`${title || ''} ${movie || ''} lyrics`.trim().replace(/\s+/g, ' '));
            bodyEl.innerHTML = `
<div class="bz-lyr-error">
  <i class="fas fa-music"></i>
  <p>No lyrics available for this song.</p>
  <div class="bz-lyr-links">
    <a href="https://www.google.com/search?q=${gq}" target="_blank" rel="noopener">Google</a>
  </div>
  ${isAdmin ? '<p class="bz-lyr-admin-tip"><i class="fas fa-pen"></i> Use Edit to paste lyrics manually.</p>' : ''}
</div>`;
        }
    };

    /* ═══════════════════════════════════════════════════════════
       BEAT ZEN — IN-APP UPDATE NOTIFICATION CENTER
       ─────────────────────────────────────────────────────────
       HOW TO ADD A NEW NOTIFICATION:
       Add one object to BZ_UPDATES array below (newest first).
    
       Types:  'songs' | 'artist' | 'album' | 'feature' | 'fix' | 'announce'
    
       newLabel fields (adds a NEW badge on any card/section):
         targets : array of { type, id } objects
           type 'album'    → targets .album-card[data-album-id="id"]
           type 'year'     → targets the year heading section with that year
           type 'playlist' → targets #card-{id} in playlists tab
    
       Example entry:
       {
         id: 'u008', type: 'songs', date: '2026-06-27',
         title: '15 New Songs Added',
         desc: 'Fresh tracks from Anirudh, DSP and Thaman — check the 2026 section on Home.',
         newLabel: { targets: [{ type: 'year', id: '2026' }] }
       }
    ═══════════════════════════════════════════════════════════ */
    (function () {
        'use strict';

        /* ── UPDATE FEED — edit this array to post new notifications ── */
        const BZ_UPDATES = [
            /* ── Add new entries here (newest first) ── */
            {
                id: 'u017', type: 'fix', date: '2026-06-30',
                title: 'Splash Screen Removed',
                desc: 'The Beat Zen logo splash screen no longer appears when the app loads.',
                icon: { fa: 'fa-bolt', color: '#fbbf24', bg: 'rgba(251,191,36,0.16)' }
            },
            {
                id: 'u016', type: 'improvement', date: '2026-06-29',
                title: 'Sleep Timer — Enter Manually',
                desc: 'Tap the timer icon in the player and type your hours and minutes directly instead of scrolling a wheel.',
                icon: { fa: 'fa-moon', color: '#c4b5fd', bg: 'rgba(139,92,246,0.18)' }
            },
            {
                id: 'u014', type: 'improvement', date: '2026-06-29',
                title: 'Mark as Read Button',
                desc: 'Each update card now has a clear "Mark as Read" label beside the tick icon, making it easier to dismiss individual updates at a glance.',
                icon: { fa: 'fa-check', color: '#34d399', bg: 'rgba(52,211,153,0.14)' }
            },
            {
                id: 'u010', type: 'feature', date: '2026-06-28',
                title: 'New Playlist Nav Bar',
                desc: 'Open the Playlists tab to see the new sticky navigation bar with quick-jump pills for every section.',
                newLabel: { targets: [{ type: 'section', id: 'bz-playlist-nav-bar' }] }
            },

        ];
        /* ── END OF UPDATE FEED ── */

        const LS_READ_KEY = 'bz_notif_read_v2';   /* stores read notification IDs */
        const LS_SEEN_KEY = 'bz_notif_seen_v2';   /* stores seen newLabel IDs (badge dismissed) */
        const LS_CLEAR_KEY = 'bz_notif_cleared_v2'; /* stores user-cleared notification IDs */
        const LS_DYN_IDS_KEY = 'bz_notif_dyn_album_ids_v1'; /* stores album IDs already seen on first load */

        /* ─── Dynamic album id helpers ─────────────────────────────── */
        function getDynAlbumIds() { try { return new Set(JSON.parse(localStorage.getItem(LS_DYN_IDS_KEY) || '[]')); } catch (_) { return new Set(); } }
        function saveDynAlbumIds(s) { try { localStorage.setItem(LS_DYN_IDS_KEY, JSON.stringify([...s])); } catch (_) { } }

        /* ─── Dynamic update entries from Google Sheet ──────────────
           On every page load we compare the current album set in
           window.customYearAlbumsData against the ids saved in
           LS_DYN_IDS_KEY.  Any album whose id is NOT in that set is
           treated as "newly added" and gets a synthetic update entry.
           After building the list we persist the full current id set
           so the next load they are considered known.
        ─────────────────────────────────────────────────────────── */
        function buildDynamicUpdates() {
            const data = window.customYearAlbumsData;
            if (!data || typeof data !== 'object') return [];

            /* Collect all album IDs currently in the sheet data */
            const nowIds = new Set();
            Object.values(data).forEach(function (albums) {
                if (!Array.isArray(albums)) return;
                albums.forEach(function (a) {
                    if (a && a.id != null) nowIds.add(String(a.id));
                });
            });

            const knownIds = getDynAlbumIds();

            /* First run ever — save baseline and return nothing (no "new" entries yet).
               We ONLY save the baseline here, never again — the snapshot must stay
               frozen at the set of IDs the user already knew about on their previous
               page load. Live-sync calls _resetDynCache() which re-runs this function,
               but by then knownIds is already set so we go to the diff branch below. */
            if (knownIds.size === 0) {
                saveDynAlbumIds(nowIds);
                return [];
            }

            /* Diff: any ID in nowIds that wasn't in knownIds is a newly added album */
            const dynEntries = [];
            Object.entries(data).forEach(function ([year, albums]) {
                if (!Array.isArray(albums)) return;
                albums.forEach(function (a) {
                    if (!a || a.id == null) return;
                    const aid = String(a.id);
                    if (knownIds.has(aid)) return; /* already known — skip */
                    const dynId = 'dyn_album_' + aid;
                    const songCount = Array.isArray(a.songs) ? a.songs.length : 0;
                    dynEntries.push({
                        id: dynId,
                        type: 'songs',
                        date: new Date().toISOString().slice(0, 10),
                        title: (a.title || a.name || 'New Album') + ' — Added',
                        desc: (songCount > 0
                            ? songCount + ' new song' + (songCount !== 1 ? 's' : '') + ' from '
                            : 'Songs from ') +
                            (a.title || a.name || 'a new album') + ' (' + year + ') are now available.',
                        action: { label: 'Go to ' + year, tab: 'home', albumId: aid },
                        newLabel: { targets: [{ type: 'album', id: aid }] },
                        _dynamic: true
                    });
                });
            });

            /* Update the baseline to include newly discovered IDs so they are only
               shown as "new" once — after the user has seen the notification, the
               next page load will treat them as known. */
            if (dynEntries.length > 0) {
                saveDynAlbumIds(nowIds);
            }

            return dynEntries;
        }

        /* ─── allUpdates(): merge static BZ_UPDATES + dynamic entries ─
           Dynamic entries always come first (newest real-world additions).
        ─────────────────────────────────────────────────────────── */
        let _cachedDynUpdates = null; /* computed once per page-load */
        function allUpdates() {
            if (_cachedDynUpdates === null) {
                _cachedDynUpdates = buildDynamicUpdates();
            }
            return [..._cachedDynUpdates, ...BZ_UPDATES];
        }

        /* Called by bzOnSheetDataRefresh to bust the dyn-cache and refresh UI */
        function _resetDynCache() {
            _cachedDynUpdates = null;
            /* updateBadge, renderList, applyNewLabels are in this same IIFE closure
               so they're always accessible here */
            updateBadge();
            renderList();
            applyNewLabels();
        }

        const TYPE_META = {
            songs: { icon: 'fa-music', color: '#a78bfa', bg: 'rgba(124,58,237,0.18)' },
            artist: { icon: 'fa-microphone', color: '#38bdf8', bg: 'rgba(56,189,248,0.15)' },
            album: { icon: 'fa-compact-disc', color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
            feature: { icon: 'fa-star', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
            fix: { icon: 'fa-wrench', color: '#f87171', bg: 'rgba(248,113,113,0.15)' },
            announce: { icon: 'fa-bullhorn', color: '#fb923c', bg: 'rgba(251,146,60,0.15)' }
        };

        /* ─── Read/Seen/Cleared state helpers ─────────────────────── */
        function getReadIds() { try { return new Set(JSON.parse(localStorage.getItem(LS_READ_KEY) || '[]')); } catch (_) { return new Set(); } }
        function getSeenIds() { try { return new Set(JSON.parse(localStorage.getItem(LS_SEEN_KEY) || '[]')); } catch (_) { return new Set(); } }
        function getClearedIds() { try { return new Set(JSON.parse(localStorage.getItem(LS_CLEAR_KEY) || '[]')); } catch (_) { return new Set(); } }
        function saveReadIds(s) { try { localStorage.setItem(LS_READ_KEY, JSON.stringify([...s])); } catch (_) { } }
        function saveSeenIds(s) { try { localStorage.setItem(LS_SEEN_KEY, JSON.stringify([...s])); } catch (_) { } }
        function saveClearedIds(s) { try { localStorage.setItem(LS_CLEAR_KEY, JSON.stringify([...s])); } catch (_) { } }

        function markRead(id) { const s = getReadIds(); s.add(id); saveReadIds(s); }
        function markSeen(id) { const s = getSeenIds(); s.add(id); saveSeenIds(s); }
        function markAllRead() { saveReadIds(new Set(allUpdates().map(u => u.id))); }

        function unreadCount() {
            const read = getReadIds();
            const cleared = getClearedIds();
            return allUpdates().filter(u => !read.has(u.id) && !cleared.has(u.id)).length;
        }

        /* ─── NEW badge on cards/sections ─────────────────────────── */
        function applyNewLabels() {
            const seen = getSeenIds();
            allUpdates().forEach(u => {
                if (!u.newLabel || !Array.isArray(u.newLabel.targets)) return;
                const alreadySeen = seen.has(u.id);
                u.newLabel.targets.forEach(t => {
                    let el = null;
                    if (t.type === 'album') {
                        el = document.querySelector(`.album-card[data-album-id="${t.id}"]`);
                        if (el) {
                            const wrap = el.querySelector('.album-card-img-wrap');
                            if (wrap) applyBadgeToEl(wrap, u.id, alreadySeen, 'card');
                        }
                    } else if (t.type === 'year') {
                        /* Year section heading — look for the h2/h3 inside the year section */
                        el = document.querySelector(`[data-year="${t.id}"], #year-${t.id}, .year-section[data-year="${t.id}"]`);
                        if (!el) {
                            /* Fallback: scan all year headings for matching text */
                            document.querySelectorAll('.year-heading, .year-section-title, .bz-year-heading').forEach(h => {
                                if (h.textContent.trim().startsWith(t.id)) el = h.parentElement || h;
                            });
                        }
                        if (el) applyBadgeToEl(el, u.id, alreadySeen, 'year');
                    } else if (t.type === 'playlist') {
                        el = document.getElementById('card-' + t.id);
                        if (el) {
                            const wrap = el.querySelector('.bzp-card-cover') || el;
                            applyBadgeToEl(wrap, u.id, alreadySeen, 'card');
                        }
                    } else if (t.type === 'section') {
                        /* Section badge — targets an element directly by ID (e.g. bzp-your-playlists heading) */
                        el = document.getElementById(t.id);
                        if (!el) {
                            /* Fallback: look for a heading inside a section with that ID */
                            const sec = document.querySelector(`[id="${t.id}"]`);
                            if (sec) el = sec.querySelector('h2, h3, .bzp-section-heading, .section-title') || sec;
                        }
                        if (el) {
                            const heading = el.querySelector('h2, h3, .bzp-section-heading, .section-title') || el;
                            applyBadgeToEl(heading, u.id, alreadySeen, 'year');
                        }
                    }
                });
            });
        }

        function applyBadgeToEl(parent, notifId, alreadySeen, badgeType) {
            const existingId = 'bz-new-badge-' + notifId;
            if (document.getElementById(existingId)) return; /* already injected */
            if (alreadySeen) return; /* user has opened the panel — remove badge */

            const badge = document.createElement('span');
            badge.id = existingId;
            badge.className = 'bz-new-label-badge' + (badgeType === 'year' ? ' bz-new-label-year' : '');
            badge.innerHTML = '<i class="fas fa-certificate"></i> New';
            parent.appendChild(badge);
        }

        function removeAllNewLabels() {
            document.querySelectorAll('[id^="bz-new-badge-"]').forEach(el => el.remove());
        }

        function markAllSeen() {
            const s = getSeenIds();
            allUpdates().forEach(u => { if (u.newLabel) s.add(u.id); });
            saveSeenIds(s);
            removeAllNewLabels();
        }

        /* ─── Date formatter ───────────────────────────────────────── */
        function fmtDate(iso) {
            try {
                return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
            } catch (_) { return iso; }
        }

        /* ─── Render notification list ─────────────────────────────── */
        function renderList() {
            /* Support both the corrected ID and the original fallback */
            const list = document.getElementById('bz-notif-list')
                || document.getElementById('bz-updates-list');
            const countChip = document.getElementById('bz-notif-count');
            const toggleBtn = document.getElementById('bz-notif-toggle-read');
            if (!list) return;
            const read = getReadIds();
            const cleared = getClearedIds();
            const updates = allUpdates();  /* Change 3: use merged static + dynamic list */

            /* Filter out cleared updates */
            const visible = updates.filter(u => !cleared.has(u.id));

            if (visible.length === 0) {
                list.innerHTML = `
                <div class="bz-notif-empty">
                    <i class="fas fa-bell-slash"></i>
                    <p>All caught up! Check back soon.</p>
                </div>`;
                if (countChip) countChip.style.display = 'none';
                if (toggleBtn) toggleBtn.style.display = 'none';
                return;
            }

            if (countChip) {
                /* Show only today's notification count */
                const todayStr = new Date().toISOString().slice(0, 10);
                const todayCount = visible.filter(u => u.date === todayStr).length;
                if (todayCount > 0) {
                    countChip.textContent = 'Today: ' + todayCount + (todayCount === 1 ? ' update' : ' updates');
                    countChip.style.display = '';
                } else {
                    countChip.style.display = 'none';
                }
            }

            /* Toggle button — flips between Mark All as Read ↔ Unmark All, based on
               ALL visible (non-cleared) updates — not just today's. This keeps the
               button's label/action in sync with the unread badge (unreadCount()),
               which also counts across every update, not only today's.
               FIX: previously this scoped both the label/visibility AND the click
               handler to "today's" updates only. That meant whenever there were
               older unread notifications but nothing new today, the button still
               showed "Mark All as Read" (because overallUnread was true) but the
               click handler had nothing dated today to act on and silently did
               nothing — i.e. "Mark All as Read" appeared to not work. */
            if (toggleBtn) {
                const allRead = visible.every(u => read.has(u.id));
                if (allRead) {
                    toggleBtn.innerHTML = '<i class="fas fa-rotate-left"></i> Unmark All';
                    toggleBtn.dataset.state = 'unmark';
                    toggleBtn.className = 'bz-notif-toggle-read-btn bz-notif-toggle-unmark';
                } else {
                    toggleBtn.innerHTML = '<i class="fas fa-check-double"></i> Mark All as Read';
                    toggleBtn.dataset.state = 'mark';
                    toggleBtn.className = 'bz-notif-toggle-read-btn';
                }
                toggleBtn.style.display = '';
            }

            list.innerHTML = visible.map(u => {
                let m = TYPE_META[u.type] || TYPE_META.announce;
                if (u.icon) m = { icon: u.icon.fa || m.icon, color: u.icon.color || m.color, bg: u.icon.bg || m.bg };
                const isUnread = !read.has(u.id);
                return `
            <div class="bz-notif-card ${isUnread ? 'bz-notif-unread' : ''}" data-id="${u.id}">
                <div class="bz-notif-card-icon" style="background:${m.bg};color:${m.color};">
                    <i class="fas ${m.icon}"></i>
                </div>
                <div class="bz-notif-card-body">
                    <div class="bz-notif-card-top">
                        <span class="bz-notif-card-title">${u.title}</span>
                        ${isUnread ? '<span class="bz-notif-dot"></span>' : ''}
                    </div>
                    <p class="bz-notif-card-desc">${u.desc}</p>
                    <div class="bz-notif-card-footer">
                        <span class="bz-notif-card-date"><i class="fas fa-clock"></i> ${fmtDate(u.date)}</span>
                        <div class="bz-notif-card-actions">
                            ${isUnread ? `<button class="bz-notif-read-btn" data-id="${u.id}" title="Mark as read">
                                <i class="fas fa-check"></i> Mark as Read
                            </button>` : ''}
                        </div>
                    </div>
                </div>
            </div>`;
            }).join('');

            /* Wire individual mark-as-read buttons */
            list.querySelectorAll('.bz-notif-read-btn').forEach(btn => {
                btn.addEventListener('click', e => {
                    e.stopPropagation();
                    const id = btn.dataset.id;
                    markRead(id);
                    renderList();
                    updateBadge();
                });
            });
        }

        /* ─── Badge counter ────────────────────────────────────────── */
        function updateBadge() {
            const badge = document.getElementById('bz-notif-badge');
            const bellBtn = document.getElementById('updates-link');
            if (!badge) return;
            const n = unreadCount();
            const iconEl = bellBtn?.querySelector('.bz-notif-bell-icon-wrap i');
            if (n > 0) {
                badge.textContent = n > 9 ? '9+' : n;
                badge.style.display = '';
                /* Keep bell ringing continuously while there are unread updates */
                if (iconEl && !iconEl.classList.contains('bz-notif-bell-ring-continuous')) {
                    iconEl.classList.remove('bz-notif-bell-shake');
                    iconEl.classList.add('bz-notif-bell-ring-continuous');
                }
            } else {
                badge.style.display = 'none';
                /* Stop ringing once everything is read */
                if (iconEl) {
                    iconEl.classList.remove('bz-notif-bell-ring-continuous', 'bz-notif-bell-shake');
                }
            }
        }

        /* ─── Panel open / close — now just navigate to updates tab ── */
        function openPanel() {
            displayUpdates();
        }

        function closePanel() {
            /* No-op in in-page mode — navigation handles this */
        }

        /* ─── Init ─────────────────────────────────────────────────── */
        function init() {
            updateBadge();
            renderList();   /* populate the list on first load */

            /* Apply NEW badges after home grid renders — observe DOM for card injection */
            const _badgeObserver = new MutationObserver(() => {
                applyNewLabels();
            });
            _badgeObserver.observe(document.body, { childList: true, subtree: true });

            /* Also apply immediately in case cards are already present */
            applyNewLabels();

            const toggleBtn = document.getElementById('bz-notif-toggle-read');

            toggleBtn?.addEventListener('click', () => {
                const state = toggleBtn.dataset.state || 'mark';
                const cleared = getClearedIds();
                /* FIX: act on every visible (non-cleared) update, not just today's,
                   so "Mark All as Read" actually marks everything as read — matching
                   its label and the unread badge, which also counts across all
                   updates. Previously this filtered to today's date only, so it
                   silently did nothing whenever the unread items were from an
                   earlier day. */
                const targets = allUpdates().filter(u => !cleared.has(u.id));
                if (targets.length === 0) return;
                const read = getReadIds();
                if (state === 'mark') {
                    targets.forEach(u => { read.add(u.id); markSeen(u.id); });
                } else {
                    targets.forEach(u => read.delete(u.id));
                }
                saveReadIds(read);
                renderList();
                updateBadge();
            });
        }

        /* ─── Public refresh hook — must be defined before init() runs ── */
        window.bzNotifRefresh = function () { updateBadge(); renderList(); applyNewLabels(); };

        /* Change 4: expose dyn-cache reset so live-sync (bzOnSheetDataRefresh) can
           bust the cache and immediately surface new sheet albums in the Updates panel */
        window._bzResetDynCache = _resetDynCache;

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }

    })();
})();

/* ============================================================
   MERGED FROM: playlists.js
   ============================================================ */
/* ================================================================
   Beat Zen — playlists.js  (v2 — Beat Zen Universe update)
   Sections:
   0. Beat Zen Universe  — Infinite Play + year-wise collections (NEW)
   1. Playlists Made For You — signal-powered smart playlists
   2. Recommended For Today  — daily unplayed album suggestions (10 max)
   3. Listen Again           — recently played songs
   Live Sync                 — background sheet polling (NEW)
   ================================================================ */

/* ── HISTORY KEY (must match script.js) ── */
const BZ_HISTORY_KEY = 'beatZen_history_auto';
const BZ_SIGNALS_KEY = 'beatZen_signals';

/* ── SEEDED RNG ── */
function getTodaySeed() {
    const d = new Date();
    return parseInt(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`);
}
function seededShuffle(arr, seed) {
    const a = [...arr]; let s = seed;
    for (let i = a.length - 1; i > 0; i--) {
        s = ((s * 1664525) + 1013904223) & 0xffffffff;
        const j = Math.abs(s) % (i + 1);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/* ── FULL SONG POOL ── */
function getAllSongIds() {
    const seen = new Set(), pool = [];
    const data = window.customYearAlbumsData || {};
    Object.values(data).forEach(albums =>
        albums.forEach(album =>
            (album.songs || []).forEach(song => {
                if (song.id && !seen.has(song.id)) { seen.add(song.id); pool.push(song.id); }
            })
        )
    );
    return pool;
}

/* ── GET ALL ALBUMS FLAT ── */
function getAllAlbums() {
    const albums = [];
    const data = window.customYearAlbumsData || {};
    Object.values(data).forEach(yearAlbums => albums.push(...yearAlbums));
    return albums;
}

/* ── LOAD PLAY HISTORY ── */
function loadPlayHistory() {
    try { return JSON.parse(localStorage.getItem(BZ_HISTORY_KEY) || '[]'); } catch (_) { return []; }
}

/* ── LOAD BEHAVIOR SIGNALS ── */
function loadSignals() {
    try { return JSON.parse(localStorage.getItem(BZ_SIGNALS_KEY) || '[]'); } catch (_) { return []; }
}

/* ── BUILD SIGNAL SCORE MAP ── */
function buildSignalScores() {
    const WEIGHTS = { replay: 5, full_play: 2, add_playlist: 3, search_after: 2, skip_early: -4 };
    const scores = {};
    loadSignals().forEach(s => {
        const id = String(s.id || '');
        if (!id) return;
        const w = WEIGHTS[s.signal] || 0;
        scores[id] = (scores[id] || 0) + w;
    });
    return scores;
}

/* ── SONG PLAY COUNTS from history ── */
function getSongPlayCounts() {
    const counts = {};
    loadPlayHistory().forEach(e => {
        const id = String(e.id || '');
        if (id) counts[id] = (counts[id] || 0) + 1;
    });
    return counts;
}

/* ── ALBUM PLAY COUNTS ── */
function getAlbumPlayCounts() {
    const songCounts = getSongPlayCounts();
    const albumCounts = {};
    getAllAlbums().forEach(album => {
        const total = (album.songs || []).reduce((s, song) => s + (songCounts[song.id] || 0), 0);
        if (total > 0) albumCounts[album.id] = { album, count: total };
    });
    return albumCounts;
}

/* ── GET COVER FROM SONG IDs ── */
function getCoverFromSongs(songIds, usedCovers) {
    const map = window.allSongsMap;
    if (!map) return '';
    const freq = {};
    for (const id of songIds) {
        const entry = map.get(String(id));
        const url = entry?.album?.imageUrl || entry?.imageUrl;
        if (url) freq[url] = (freq[url] || 0) + 1;
    }
    const ranked = Object.entries(freq).sort((a, b) => b[1] - a[1]).map(x => x[0]);
    if (!usedCovers) return ranked[0] || '';
    for (const url of ranked) {
        if (!usedCovers.has(url)) { usedCovers.add(url); return url; }
    }
    return ranked[0] || '';
}

/* ── ms UNTIL MIDNIGHT ── */
function msUntilMidnight() {
    const now = new Date();
    const midnight = new Date(now); midnight.setHours(24, 0, 0, 0);
    return midnight - now;
}

/* ================================================================
   SECTION 0 — BEAT ZEN UNIVERSE
   Infinite Play  : every song from every year, newest year first,
                    in original album → song order
   Year playlists : one playlist per year, same ordering rule
   ================================================================ */

/* Colour ramp for year badges — cycles through warm/cool palette */
const BZ_YEAR_COLORS = [
    '#7c3aed', '#2575fc', '#10b981', '#f59e0b',
    '#ef4444', '#06b6d4', '#ec4899', '#8b5cf6',
    '#3b82f6', '#14b8a6', '#f97316', '#6366f1'
];
function getYearColor(year) {
    const idx = Math.abs(parseInt(year) || 0) % BZ_YEAR_COLORS.length;
    return BZ_YEAR_COLORS[idx];
}

/* Build the Infinite Play playlist — all songs, all years, newest first */
function buildInfinitePlay() {
    const data = window.customYearAlbumsData || {};
    const years = Object.keys(data).map(Number).filter(Boolean).sort((a, b) => b - a);
    const seen = new Set();
    const songIds = [];

    /* Collect 4 distinct covers — one from the 4 most recent years that have images */
    const collageCovers = [];
    years.forEach(year => {
        (data[String(year)] || []).forEach(album => {
            const img = album.imageUrl || album.albumCover || '';
            if (img && !collageCovers.includes(img) && collageCovers.length < 4) {
                collageCovers.push(img);
            }
            (album.songs || []).forEach(song => {
                const id = String(song.id || '');
                if (id && !seen.has(id)) { seen.add(id); songIds.push(id); }
            });
        });
    });

    return {
        id: 'bz-infinite-play',
        name: 'Infinite Play',
        desc: 'Every song · every year',
        icon: 'fa-infinity',
        color: '#7c3aed',
        songs: songIds,
        cover: collageCovers[0] || '',
        _collageCovers: collageCovers.length >= 2 ? collageCovers : null,
        _isInfinitPlay: true
    };
}

/* Build one playlist per year — songs ordered by album, then song position */
function buildYearPlaylists() {
    const data = window.customYearAlbumsData || {};
    const years = Object.keys(data).map(Number).filter(Boolean).sort((a, b) => b - a);

    return years.map(year => {
        const albums = data[String(year)] || [];
        const seen = new Set();
        const songIds = [];
        const collageCovers = [];

        albums.forEach(album => {
            const img = album.imageUrl || album.albumCover || '';
            if (img && !collageCovers.includes(img) && collageCovers.length < 4) {
                collageCovers.push(img);
            }
            (album.songs || []).forEach(song => {
                const id = String(song.id || '');
                if (id && !seen.has(id)) { seen.add(id); songIds.push(id); }
            });
        });

        if (!songIds.length) return null;

        return {
            id: `bz-year-${year}`,
            name: String(year),
            desc: `All songs from ${year}`,
            icon: 'fa-calendar',
            color: getYearColor(year),
            songs: songIds,
            cover: collageCovers[0] || '',
            _collageCovers: collageCovers.length >= 2 ? collageCovers : null,
            _yearLabel: String(year)
        };
    }).filter(Boolean);
}

/* Build Beat Zen Universe heading element */
/* Render the Beat Zen Universe section into a given container */
function renderBeatZenUniverseSection(container) {
    container.innerHTML = '';

    const sec = document.createElement('div');
    sec.id = 'bzp-universe-section';
    sec.className = 'bzp-section';

    sec.appendChild(makeHeading('fa-infinity', 'Beat Zen Universe', 'Your complete collection · all years · all albums'));

    const infinitePlay = buildInfinitePlay();
    const yearPlaylists = buildYearPlaylists();

    const cards = [];
    if (infinitePlay.songs.length) cards.push(makePlaylistCard(infinitePlay, 'Playlist'));
    yearPlaylists.forEach(yp => cards.push(makePlaylistCard(yp, 'Playlist')));

    if (cards.length) {
        sec.appendChild(makeRow(cards));
    } else {
        /* No songs yet — show empty state */
        const empty = document.createElement('p');
        empty.style.cssText = 'color:rgba(255,255,255,0.35);font-size:0.82rem;padding:4px 16px 16px;';
        empty.textContent = 'Add songs to your Google Sheet to see them here.';
        sec.appendChild(empty);
    }

    container.appendChild(sec);
}

/* Expose for script.js's displayPlaylists to call */
window.bzRenderUniverseSection = renderBeatZenUniverseSection;

/* ================================================================
   SECTION 1 — PLAYLISTS MADE FOR YOU (signal-powered)
   ================================================================ */

function buildMadeForYou() {
    const seed = getTodaySeed();
    const allIds = getAllSongIds();
    const history = loadPlayHistory();
    const counts = getSongPlayCounts();
    const signals = loadSignals();
    const scores = buildSignalScores();

    const likedIds = Object.entries(scores)
        .filter(([, s]) => s > 0)
        .sort((a, b) => b[1] - a[1])
        .map(x => x[0]);

    const skippedSet = new Set(
        Object.entries(scores).filter(([, s]) => s < 0).map(x => x[0])
    );

    const playedSet = new Set(Object.keys(counts));
    const neverPlayed = allIds.filter(id => !playedSet.has(id) && !skippedSet.has(id));
    const playedSorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(x => x[0]);

    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const weekCounts = {};
    history.filter(e => new Date(e.playedAt || 0).getTime() >= weekAgo)
        .forEach(e => { const id = String(e.id || ''); if (id) weekCounts[id] = (weekCounts[id] || 0) + 1; });
    const weekSorted = Object.entries(weekCounts).sort((a, b) => b[1] - a[1]).map(x => x[0]);

    const monthAgo = Date.now() - 30 * 24 * 3600 * 1000;
    const monthCounts = {};
    history.filter(e => new Date(e.playedAt || 0).getTime() >= monthAgo)
        .forEach(e => { const id = String(e.id || ''); if (id) monthCounts[id] = (monthCounts[id] || 0) + 1; });
    const monthSorted = Object.entries(monthCounts).sort((a, b) => b[1] - a[1]).map(x => x[0]);

    const recentSeen = new Set(), recentSongs = [];
    history.slice(0, 200).forEach(e => {
        const id = String(e.id || '');
        if (id && !recentSeen.has(id)) { recentSeen.add(id); recentSongs.push(id); }
    });

    const usedCovers = new Set();

    const quickBase = [...new Set([...likedIds.slice(0, 4), ...recentSongs])].filter(id => !skippedSet.has(id));
    const quickPicks = (quickBase.length >= 7 ? quickBase : seededShuffle(allIds, seed).filter(id => !skippedSet.has(id))).slice(0, 7);

    const weeklyMix = [...new Set([...weekSorted, ...seededShuffle(allIds, seed)])]
        .filter(id => !skippedSet.has(id)).slice(0, 40);

    const dailyTop = likedIds.length ? likedIds.slice(0, 20) : playedSorted.slice(0, 20);
    const dailyNew = seededShuffle(neverPlayed, seed).slice(0, 30);
    const dailyMix = [...new Set([...dailyTop, ...dailyNew])].slice(0, 50);

    /* ── REPEAT REWIND: use dedicated qualifying-plays store ──────────────────
       beatZen_rr_plays entries are only written after the user listened ≥ 10 s.
       We require BZ_RR_MIN_PLAYS (3) such entries to include a song.
       This is intentionally different from monthCounts which counts ALL history
       entries including instant-start records.                                  */
    let rrPlaysList = [];
    try { rrPlaysList = JSON.parse(localStorage.getItem('beatZen_rr_plays') || '[]'); } catch (_) { }
    const rrCounts = {};
    rrPlaysList.forEach(e => {
        const id = String(e.id || '');
        if (id) rrCounts[id] = (rrCounts[id] || 0) + 1;
    });
    /* Sort by qualifying-play count descending, then by most-recent qualifying play */
    const repeatRewind = Object.entries(rrCounts)
        .filter(([id, cnt]) => cnt >= 3 && !skippedSet.has(id))
        .sort((a, b) => {
            if (b[1] !== a[1]) return b[1] - a[1];
            const tsA = rrPlaysList.find(e => String(e.id) === a[0])?.ts || 0;
            const tsB = rrPlaysList.find(e => String(e.id) === b[0])?.ts || 0;
            return tsB - tsA;
        })
        .map(([id]) => id);
    /* When no songs qualify, show EMPTY playlist — do NOT fill with random songs */
    const repeatFinal = repeatRewind.length ? repeatRewind : [];


    const hiddenGems = seededShuffle(neverPlayed, seed ^ 12345).slice(0, 50);

    const listenAgainPl = buildListenAgainPlaylist(usedCovers);

    const playlists = [
        { id: 'bz-daily-mix', name: 'Daily Mix', icon: 'fa-sliders', color: '#3b82f6', desc: 'Favourites + new discoveries', songs: dailyMix, cover: getCoverFromSongs(dailyMix, usedCovers) },
        { id: 'bz-repeat-rewind', name: 'Repeat Rewind', icon: 'fa-rotate-left', color: '#10b981', desc: 'Songs you replayed upto 3+ times', songs: repeatFinal, cover: getCoverFromSongs(repeatFinal, usedCovers) },
        { id: 'bz-hidden-gems', name: 'Hidden Gems', icon: 'fa-gem', color: '#ec4899', desc: 'Great songs you haven\'t heard yet', songs: hiddenGems, cover: getCoverFromSongs(hiddenGems, usedCovers) },
    ];

    if (listenAgainPl) playlists.unshift(listenAgainPl);

    return playlists;
}

/* ================================================================
   SECTION 3 — RECOMMENDED FOR TODAY (refreshes daily at 12am)
   ================================================================ */

let _recToday_seed = null, _recToday_cache = null;

function buildRecommendedForToday() {
    const seed = getTodaySeed();
    if (_recToday_seed === seed && _recToday_cache) return _recToday_cache;
    const counts = getSongPlayCounts();
    const scores = buildSignalScores();
    const albums = getAllAlbums();

    const albumScores = albums.map(album => {
        const plays = (album.songs || []).reduce((s, song) => s + (counts[song.id] || 0), 0);
        const signal = (album.songs || []).reduce((s, song) => s + (scores[String(song.id)] || 0), 0);
        return { album, total: plays + signal };
    });

    // Only recommend albums the user has never opened or played
    const neverPlayed = albumScores.filter(x => x.total === 0).map(x => x.album);
    const shuffled = seededShuffle(neverPlayed, seed);

    const seenCovers = new Set(), result = [];
    for (const a of shuffled) {
        const cover = a.imageUrl || a.albumCover || '';
        if (seenCovers.has(cover) && cover) continue;
        if (cover) seenCovers.add(cover);
        result.push(a);
        if (result.length >= 10) break;
    }

    _recToday_seed = seed;
    _recToday_cache = result;
    return result;
}

/* ── Time-ago helper for Listen Again badges ── */
function timeAgo(isoString) {
    if (!isoString) return '';
    const diff = Date.now() - new Date(isoString).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return `${Math.floor(d / 7)}w ago`;
}

/* ── Build Listen Again: recent unique songs from play history ── */
function buildListenAgain() {
    /* Default ON: disabled only when user explicitly set it to 'false' */
    const historyEnabled = localStorage.getItem('beatzen_history') !== 'false';
    if (!historyEnabled) return [];
    let list = [];
    try { list = JSON.parse(localStorage.getItem(BZ_HISTORY_KEY) || '[]'); } catch (e) { list = []; }

    const seen = new Set(), result = [];
    for (const entry of list) {
        const id = String(entry.id || '');
        if (id && !seen.has(id)) { seen.add(id); result.push(entry); }
        if (result.length >= 20) break;
    }
    return result;
}

/* ── Build Listen Again as a smart playlist for Playlists Made for You ── */
function buildListenAgainPlaylist(usedCovers) {
    /* Default ON: disabled only when user explicitly set it to 'false' */
    const historyEnabled = localStorage.getItem('beatzen_history') !== 'false';
    if (!historyEnabled) return null;
    let list = [];
    try { list = JSON.parse(localStorage.getItem(BZ_HISTORY_KEY) || '[]'); } catch (e) { list = []; }

    const seen = new Set(), songIds = [];
    for (const entry of list) {
        const id = String(entry.id || '');
        if (id && !seen.has(id)) { seen.add(id); songIds.push(id); }
        if (songIds.length >= 30) break;
    }

    if (!songIds.length) return null;

    return {
        id: 'bz-listen-again',
        name: 'Recently Played',
        icon: 'fa-clock-rotate-left',
        color: '#06b6d4',
        desc: 'Your recently played songs',
        songs: songIds,
        cover: getCoverFromSongs(songIds, usedCovers)
    };
}


/* ================================================================
   CARD CLICK HANDLER
   ================================================================ */

function handlePlaylistsCardClick(item, type) {
    const songs = item.songs || [];
    if (!songs.length) {
        // bz-repeat-rewind: fall through to selectAlbum so the album view
        // opens with the descriptive empty state (skeleton loaders → animated
        // empty message). A blocking popup is the wrong UX here; the view
        // itself explains the situation.
        if (item.id !== 'bz-repeat-rewind' && item.type !== 'artist' && item.type !== 'hero') {
            if (window.bzAlert) bzAlert('warning', 'Empty Playlist', 'No songs found.');
            return;
        }
        // bz-repeat-rewind with 0 songs: intentional fall-through below
    }

    const normalized = {
        ...item,
        imageUrl: item.imageUrl || item.cover || item.albumCover || '',
        albumCover: item.albumCover || item.cover || item.imageUrl || ''
    };

    const resolvedType = type || 'Playlist';
    const navOverride = 'playlists';

    if (typeof window.resolveData === 'function') {
        const resolved = window.resolveData(normalized, resolvedType);
        if (resolved && typeof window.selectAlbum === 'function') {
            window.selectAlbum(resolved, false, navOverride);
        }
    } else if (typeof window.playSong === 'function') {
        if (typeof window.currentQueue !== 'undefined') {
            window.currentQueue = songs;
            window.currentQueueIndex = 0;
        }
        window.playSong(songs[0]);
    }
}

function handlePlaylistsCardPlay(item, type) {
    const songs = item.songs || [];
    if (!songs.length) return;

    const normalized = {
        ...item,
        imageUrl: item.imageUrl || item.cover || item.albumCover || '',
        albumCover: item.albumCover || item.cover || item.imageUrl || ''
    };

    const isThisActive = window.playingAlbum && String(window.playingAlbum.id) === String(normalized.id || normalized.name);

    if (isThisActive) {
        if (typeof window.togglePlayback === 'function') window.togglePlayback();
        return;
    }

    if (typeof window.resolveData === 'function') {
        const resolved = window.resolveData(normalized, type || 'Playlist');
        if (!resolved) return;
        window.playingAlbum = resolved;
        window._highlightActive = true;
        if (typeof window.playSong === 'function') {
            window.playSong(0);
            setTimeout(() => {
                if (typeof window.updateActiveSongHighlight === 'function') window.updateActiveSongHighlight();
                window.bzSyncPlaylistsPlayBtns && window.bzSyncPlaylistsPlayBtns();
            }, 120);
        }
    } else if (typeof window.playSong === 'function') {
        window.playSong(songs[0]);
    }
}

/* ── Sync all explore play buttons to reflect current playback state ── */
window.bzSyncPlaylistsPlayBtns = function () {
    const audioEl = document.getElementById('audio-player');
    const isPlaying = audioEl && !audioEl.paused;
    const activeAlbumId = window.playingAlbum ? String(window.playingAlbum.id) : null;
    const activeSong = window.playingAlbum?.songs?.[window.currentSongIndex];
    const activeSongId = activeSong ? String(activeSong.id) : null;

    /* Sync card playing state via CSS class only — no play button buttons exist */
    document.querySelectorAll('.bzp-card').forEach(card => {
        const cardId = String(card.dataset.bzId || '');
        const isAlbumMatch = activeAlbumId && cardId && cardId === activeAlbumId;
        const isSongMatch = activeSongId && cardId && cardId === activeSongId && card.classList.contains('bzp-la-card');
        const isActive = isAlbumMatch || isSongMatch;

        if (isActive && isPlaying) {
            card.classList.add('bzp-card--playing');
        } else {
            card.classList.remove('bzp-card--playing');
        }
    });

    document.querySelectorAll('.bzp-la-card').forEach(card => {
        const cardId = String(card.dataset.bzId || '');
        if (activeSongId && cardId === activeSongId) {
            card.classList.add('bzp-la-card--active');
        } else {
            card.classList.remove('bzp-la-card--active');
        }
    });
};

/* ================================================================
   UI BUILDERS
   ================================================================ */

/* Section heading with FA icon */
function makeHeading(icon, title, subtitle) {
    const wrap = document.createElement('div');
    wrap.className = 'bzp-section-head';
    wrap.innerHTML = `
        <div class="bzp-section-title-row">
            <span class="bzp-section-icon"><i class="fas ${icon}"></i></span>
            <div>
                <div class="bzp-section-title">${title}</div>
                ${subtitle ? `<div class="bzp-section-sub">${subtitle}</div>` : ''}
            </div>
        </div>`;
    return wrap;
}

/* ── Build a 2×2 collage cover div ── */
function makeCollageCover(urls) {
    const cols = [...urls];
    while (cols.length < 4) cols.push(cols[cols.length - 1] || '');
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;flex-wrap:wrap;width:100%;height:100%;';
    cols.slice(0, 4).forEach(u => {
        const img = document.createElement('img');
        img.src = u; img.alt = ''; img.loading = 'lazy';
        img.style.cssText = 'width:50%;height:50%;object-fit:cover;display:block;flex-shrink:0;';
        img.onerror = () => { img.style.background = 'rgba(124,58,237,0.3)'; img.src = ''; };
        div.appendChild(img);
    });
    return div;
}

/* ================================================================
   THREE-DOT MENU FOR SMART PLAYLIST CARDS
   ================================================================ */

/* Global dropdown — single instance, repositioned on each open */
let _bzCardMenuDropdown = null;
let _bzCardMenuCloseHandler = null;

function _bzGetOrCreateDropdown() {
    if (_bzCardMenuDropdown && document.body.contains(_bzCardMenuDropdown)) return _bzCardMenuDropdown;
    const d = document.createElement('div');
    d.id = 'bzp-card-menu-dropdown';
    d.className = 'bzp-card-menu-dropdown';
    d.style.display = 'none';
    document.body.appendChild(d);
    _bzCardMenuDropdown = d;
    return d;
}

function _bzCloseCardMenu() {
    if (_bzCardMenuDropdown) _bzCardMenuDropdown.style.display = 'none';
    if (_bzCardMenuCloseHandler) {
        document.removeEventListener('click', _bzCardMenuCloseHandler, true);
        _bzCardMenuCloseHandler = null;
    }
}

function _bzShowPlaylistCardMenu(triggerBtn, item) {
    _bzCloseCardMenu();
    const dropdown = _bzGetOrCreateDropdown();

    /* Check if already saved */
    const savedKey = 'beatZen_importedPlaylists';
    const savedList = JSON.parse(localStorage.getItem(savedKey) || '[]');
    const originalId = String(item.id || item.name || '');
    const savedId = 'user-saved-' + originalId;
    const isAlreadySaved = savedList.some(pl => String(pl.id) === savedId || pl._originalSmartId === originalId);

    dropdown.innerHTML = `
        <button class="bzp-card-menu-item" id="_bzMenuSave">
            <i class="fas ${isAlreadySaved ? 'fa-check-circle' : 'fa-bookmark'}" style="color:${isAlreadySaved ? '#1db954' : '#a78bfa'};font-size:0.9rem;width:16px;text-align:center;"></i>
            <span>${isAlreadySaved ? 'Saved to Your Playlists' : 'Save this playlist'}</span>
        </button>`;

    /* Position dropdown near the trigger button */
    const rect = triggerBtn.getBoundingClientRect();
    dropdown.style.display = 'block';
    const ddW = 200;
    const ddH = 52;
    let left = rect.right - ddW;
    let top = rect.bottom + 6;
    if (left < 8) left = 8;
    if (top + ddH > window.innerHeight - 8) top = rect.top - ddH - 6;
    dropdown.style.left = left + 'px';
    dropdown.style.top = top + 'px';

    /* Wire up actions */
    if (!isAlreadySaved) {
        dropdown.querySelector('#_bzMenuSave').addEventListener('click', (e) => {
            e.stopPropagation();
            _bzCloseCardMenu();
            _bzSaveSmartPlaylist(item);
        });
    }

    /* Close on outside click */
    _bzCardMenuCloseHandler = (e) => {
        if (!dropdown.contains(e.target) && e.target !== triggerBtn) {
            _bzCloseCardMenu();
        }
    };
    setTimeout(() => {
        document.addEventListener('click', _bzCardMenuCloseHandler, true);
    }, 0);
}

/* Save a smart playlist to "Your Playlists" */
function _bzSaveSmartPlaylist(item) {
    const savedKey = 'beatZen_importedPlaylists';
    const savedList = JSON.parse(localStorage.getItem(savedKey) || '[]');
    const originalId = String(item.id || item.name || '');
    const savedId = 'user-saved-' + originalId;

    /* Guard: already saved */
    if (savedList.some(pl => String(pl.id) === savedId || pl._originalSmartId === originalId)) {
        if (typeof showToast === 'function') showToast('Already in Your Playlists');
        return;
    }

    /* Resolve song IDs — store as string IDs; resolveData() will expand them at open time */
    const songs = (item.songs || []).map(s => String(s));

    const pl = {
        id: savedId,
        name: item.name,
        type: 'Playlist',
        isImported: true,
        songs,
        albumCover: item.cover || item.albumCover || item.imageUrl || '',
        desc: item.desc || ('Saved from ' + item.name),
        _savedFrom: 'smart',
        _originalSmartId: originalId
    };

    savedList.push(pl);
    localStorage.setItem(savedKey, JSON.stringify(savedList));

    /* Add to live masterPool so "Your Playlists" updates without reload */
    if (window.masterPool && !window.masterPool.some(m => String(m.id) === savedId)) {
        window.masterPool.push(pl);
    }

    /* Refresh Playlists tab if it is currently visible and no album card is open */
    const _bzAlbumView = document.getElementById('album-view-container');
    const _bzAlbumOpen = _bzAlbumView && _bzAlbumView.style.display !== 'none';
    if (!_bzAlbumOpen && window.lastActiveView === 'playlists' && typeof window.displayPlaylists === 'function') {
        window.displayPlaylists(true);
    }

    if (typeof showToast === 'function') showToast(`✓ "${item.name}" added to Your Playlists`);
}

/* Standard playlist card (square, cover image or gradient, name + count)
   Supports:
     item._collageCovers  → 2×2 collage from array of up to 4 URLs
     item.cover / albumCover / imageUrl → single image
     fallback            → gradient with icon
*/
function makePlaylistCard(item, type) {
    const card = document.createElement('div');
    card.className = 'bzp-card';
    card.dataset.bzId = String(item.id || item.name || '');

    const coverWrap = document.createElement('div');
    coverWrap.className = 'bzp-card-cover';

    /* ── Cover: collage > single image > gradient ── */
    if (item._collageCovers && item._collageCovers.length >= 2) {
        coverWrap.appendChild(makeCollageCover(item._collageCovers));
    } else if (item.cover || item.albumCover || item.imageUrl) {
        const img = document.createElement('img');
        img.src = item.cover || item.albumCover || item.imageUrl;
        img.alt = item.name;
        img.loading = 'lazy';
        img.onerror = () => { img.remove(); coverWrap.appendChild(makeGradientCover(item)); };
        coverWrap.appendChild(img);
    } else {
        coverWrap.appendChild(makeGradientCover(item));
    }

    /* Play button overlay removed */



    const info = document.createElement('div');
    info.className = 'bzp-card-info';

    const countLabel = (item.songs || []).length + ' songs';
    info.innerHTML = `
        <div class="bzp-card-name">${item.name}</div>
        <div class="bzp-card-meta">${countLabel}</div>`;

    card.appendChild(coverWrap);
    card.appendChild(info);
    card.addEventListener('click', () => handlePlaylistsCardClick(item, type));
    return card;
}

/* Gradient cover fallback with icon */
function makeGradientCover(item) {
    const div = document.createElement('div');
    div.className = 'bzp-card-gradient';
    const color = item.color || '#6d28d9';
    div.style.background = `linear-gradient(135deg, ${color}cc, ${color}44)`;
    div.innerHTML = `<i class="fas ${item.icon || 'fa-music'}"></i>`;
    return div;
}

/* Album card for Recommended / Listen Again */
function makeAlbumCard(album) {
    const card = document.createElement('div');
    card.className = 'bzp-card bzp-album-card';
    card.dataset.bzId = String(album.id || album.name || '');
    const coverWrap = document.createElement('div');
    coverWrap.className = 'bzp-card-cover';

    if (album.imageUrl || album.albumCover) {
        const img = document.createElement('img');
        img.src = album.imageUrl || album.albumCover;
        img.alt = album.title || album.name;
        img.loading = 'lazy';
        coverWrap.appendChild(img);
    } else {
        const ph = document.createElement('div');
        ph.className = 'bzp-card-gradient';
        ph.innerHTML = '<i class="fas fa-compact-disc"></i>';
        coverWrap.appendChild(ph);
    }

    const info = document.createElement('div');
    info.className = 'bzp-card-info';

    const title = album.title || album.name || 'Unknown';
    const year = album.year ? `· ${album.year}` : '';
    const songCount = (album.songs || []).length;
    info.innerHTML = `
        <div class="bzp-card-name">${title}</div>
        <div class="bzp-card-meta">${songCount} songs ${year}</div>`;

    /* FIX Issue 9: declare item BEFORE the play-button listener so the closure
       does not capture it in the temporal dead zone and throw a ReferenceError. */
    const item = {
        id: album.id,
        name: title,
        songs: (album.songs || []).map(s => s.id || s),
        albumCover: album.imageUrl || album.albumCover
    };

    /* Play button overlay removed */

    card.appendChild(coverWrap);
    card.appendChild(info);

    card.addEventListener('click', () => handlePlaylistsCardClick(item, 'Movie'));
    return card;
}

function makeListenAgainCard(entry) {
    const card = document.createElement('div');
    card.className = 'bzp-card bzp-la-card';
    card.dataset.bzId = String(entry.id || '');

    const cover = entry._coverUrl || entry.albumCover || '';
    const title = entry.title || 'Unknown';
    const source = entry.albumTitle || entry.sourceName || '';
    const artist = entry.artist || '';
    const ago = timeAgo(entry.playedAt);
    const dur = entry.duration || '';

    let sourceLabel = '';
    let movieLabel = '';
    const pid = entry.playingAlbumId ? String(entry.playingAlbumId) : '';

    if (entry.isAutoMix) {
        sourceLabel = '\u2736 Auto-Mix';
        movieLabel = entry.autoMixMovieName || entry.albumTitle || source || '';
    } else if (pid && BZ_SMART_PLAYLIST_NAMES[pid]) {
        sourceLabel = `playlists - ${BZ_SMART_PLAYLIST_NAMES[pid]}`;
        movieLabel = entry.albumTitle || source || '';
    } else if (entry.sourceView === 'Playlists' && entry.sourceName) {
        sourceLabel = `playlists - ${entry.sourceName}`;
        movieLabel = entry.albumTitle || source || '';
    } else if (entry.sourceView === 'Home') {
        sourceLabel = 'home';
        movieLabel = entry.albumTitle || source || '';
    } else if (pid && window.masterPool) {
        const found = window.masterPool.find(a => String(a.id || a.name || a.title) === pid);
        if (found) {
            const t = String(found.type || '').toLowerCase();
            const isPlaylist = t === 'playlist' || t === 'explore' || t === 'collection';
            sourceLabel = isPlaylist ? `playlists - ${found.name || found.title || ''}` : 'home';
            movieLabel = entry.albumTitle || source || '';
        }
    }
    if (!sourceLabel) sourceLabel = source || artist;

    const coverWrap = document.createElement('div');
    coverWrap.className = 'bzp-card-cover bzp-la-cover';

    if (cover) {
        const img = document.createElement('img');
        img.src = cover; img.alt = title; img.loading = 'lazy';
        img.onerror = () => { img.remove(); const ph = document.createElement('div'); ph.className = 'bzp-card-gradient'; ph.innerHTML = '<i class="fas fa-music"></i>'; coverWrap.prepend(ph); };
        coverWrap.appendChild(img);
    } else {
        const ph = document.createElement('div');
        ph.className = 'bzp-card-gradient';
        ph.style.background = 'linear-gradient(135deg,#6d28d9cc,#3b82f644)';
        ph.innerHTML = '<i class="fas fa-music"></i>';
        coverWrap.appendChild(ph);
    }

    if (ago) {
        const badge = document.createElement('div');
        badge.className = 'bzp-la-badge';
        badge.textContent = ago;
        coverWrap.appendChild(badge);
    }

    /* Play button overlay removed */

    const info = document.createElement('div');
    info.className = 'bzp-card-info bzp-la-info';
    const sourceClass = entry.isAutoMix ? 'bzp-la-source bzp-la-automix-source' : 'bzp-la-source';
    info.innerHTML = `
        <div class="bzp-la-song-name">${title}</div>
        <div class="${sourceClass}">${sourceLabel}</div>
        ${movieLabel && movieLabel !== sourceLabel ? `<div class="bzp-la-movie">${movieLabel}</div>` : ''}`;

    card.appendChild(coverWrap);
    card.appendChild(info);
    card.addEventListener('click', () => _bzPlayHistoryEntry(entry));
    return card;
}

/* ── Smart playlist name map (id → display name) ── */
const BZ_SMART_PLAYLIST_NAMES = {
    'bz-quick-picks': 'Quick Picks',
    'bz-weekly-mix': 'Weekly Mix',
    'bz-daily-mix': 'Daily Mix',
    'bz-repeat-rewind': 'Repeat Rewind',
    'bz-hidden-gems': 'Hidden Gems',
    'bz-listen-again': 'Recently Played',
    'bz-infinite-play': 'Infinite Play'
};

/* ── Add year playlist IDs to the smart name map dynamically ── */
function syncYearPlaylistNames() {
    const data = window.customYearAlbumsData || {};
    Object.keys(data).forEach(year => {
        BZ_SMART_PLAYLIST_NAMES[`bz-year-${year}`] = String(year);
    });
}

/* ── Rebuild and find a smart playlist by id ── */
function _getSmartPlaylistById(id) {
    if (id === 'bz-listen-again') return buildListenAgainPlaylist();
    if (id === 'bz-infinite-play') return buildInfinitePlay();
    if (id && id.startsWith('bz-year-')) {
        const year = id.replace('bz-year-', '');
        return buildYearPlaylists().find(yp => yp.id === id) || null;
    }
    return buildMadeForYou().find(pl => pl.id === id) || null;
}
// Expose so the hash-navigation tryOpen in script.js can resolve smart playlists
// that are never registered in masterPool (they are built on-demand here).
window.bzGetSmartPlaylist = _getSmartPlaylistById;

/* Play a history entry */
function _bzPlayHistoryEntry(entry) {
    if (typeof window.resolveData !== 'function' || typeof window.selectAlbum !== 'function') return;
    const canonical = window.allSongsMap?.get(String(entry.id));
    if (!canonical?.album) return;

    let targetRaw = null;
    let targetType = 'Movie';
    let navTab = 'home';

    if (entry.isAutoMix && entry.autoMixAlbumId) {
        const amId = String(entry.autoMixAlbumId);
        const amRaw = window.masterPool?.find(a =>
            String(a.id || a.name || a.title) === amId
        ) || canonical.album;
        const amType = entry.autoMixAlbumType || amRaw?.type || 'Movie';
        const amData = window.resolveData(amRaw, amType);
        if (amData) {
            window.currentAlbum = amData;
            window.lastActiveView = 'home';
            window._highlightActive = false;
            window.selectAlbum(amData, true, 'home', false);
            const targetSongId = String(entry.id);
            setTimeout(() => {
                const idx2 = (amData.songs || []).findIndex(x => String(x.id) === targetSongId);
                if (idx2 >= 0) {
                    const tSong = amData.songs[idx2];
                    const tCanonical = window.allSongsMap?.get(targetSongId);
                    const tSource = tCanonical?.album || amRaw;
                    const tCover = tSource?.imageUrl || tSource?.albumCover || amData.imageUrl || '';
                    const titleEl = document.getElementById('player-song-title');
                    const artistEl = document.getElementById('player-song-artist');
                    const coverEl = document.getElementById('player-album-cover');
                    if (titleEl && tSong?.title) titleEl.textContent = tSong.title;
                    if (artistEl && tSong?.artist !== undefined) artistEl.textContent = tSong.artist || '';
                    if (coverEl && tCover) coverEl.src = tCover;
                    // FIX Issue 20: do NOT set document.title directly with ⏸ symbol —
                    // this overwrote the currently-playing song's tab title. Delegate to
                    // updateDynamicTitle which uses actual audio play/pause state.
                    if (typeof window.updateDynamicTitle === 'function') window.updateDynamicTitle();
                }
                const container = document.getElementById('album-view-container') || document.querySelector('.album-view');
                if (container) {
                    const row = container.querySelector('.song-item[data-song-id="' + targetSongId + '"]');
                    if (row) {
                        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        row.classList.add('bz-history-target');
                        row.addEventListener('animationend', () => row.classList.remove('bz-history-target'), { once: true });
                    }
                }
            }, 120);
            return;
        }
    }

    if (entry.playingAlbumId) {
        const pid = String(entry.playingAlbumId);

        if (BZ_SMART_PLAYLIST_NAMES[pid]) {
            targetRaw = _getSmartPlaylistById(pid);
            targetType = 'Playlist';
            navTab = 'playlists';
        }

        if (!targetRaw && window.masterPool) {
            targetRaw = window.masterPool.find(a =>
                String(a.id || a.name || a.title) === pid
            );
            if (targetRaw) {
                targetType = entry.playingAlbumType || targetRaw.type || 'Movie';
                const t = String(targetType).toLowerCase();
                navTab = (t === 'playlist' || t === 'explore' || t === 'collection' || t === 'artist')
                    ? 'playlists' : 'home';
            }
        }
    }

    if (!targetRaw && entry.sourceView === 'Playlists' && entry.sourceName && window.masterPool) {
        targetRaw = window.masterPool.find(a =>
            (a.name || a.title || '') === entry.sourceName &&
            (a.type === 'Playlist' || a.type === 'Explore' || a.type === 'Collection')
        );
        if (targetRaw) {
            targetType = targetRaw.type || 'Playlist';
            navTab = 'playlists';
        }
    }

    if (!targetRaw) {
        targetRaw = canonical.album;
        targetType = canonical.album.type || 'Movie';
        navTab = 'home';
    }

    const data = window.resolveData(targetRaw, targetType);
    if (!data) return;

    window.currentAlbum = data;
    window.lastActiveView = navTab;
    window._highlightActive = false;
    window.selectAlbum(data, true, navTab, false);

    const targetSongId = String(entry.id);
    setTimeout(() => {
        const idx = (data.songs || []).findIndex(x => String(x.id) === targetSongId);
        if (idx >= 0) {
            const targetSong = data.songs[idx];
            const canonical = window.allSongsMap?.get(targetSongId);
            const sourceAlbum = canonical?.album || targetSong?._sourceAlbum || data;
            const coverUrl = sourceAlbum?.imageUrl || sourceAlbum?.albumCover || data.imageUrl || '';
            const titleEl = document.getElementById('player-song-title');
            const artistEl = document.getElementById('player-song-artist');
            const coverEl = document.getElementById('player-album-cover');
            if (titleEl && targetSong?.title) titleEl.textContent = targetSong.title;
            if (artistEl && targetSong?.artist !== undefined) artistEl.textContent = targetSong.artist || '';
            if (coverEl && coverUrl) coverEl.src = coverUrl;
            // FIX Issue 20: delegate tab title to updateDynamicTitle (uses actual
            // audio play/pause state) instead of writing ⏸ <highlighted song> directly,
            // which was overwriting the currently-playing song's title in the browser tab.
            if (typeof window.updateDynamicTitle === 'function') window.updateDynamicTitle();
        }
        const container = document.getElementById('album-view-container') || document.querySelector('.album-view');
        if (container) {
            const row = container.querySelector(`.song-item[data-song-id="${targetSongId}"]`);
            if (row) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                row.classList.add('bz-history-target');
                row.addEventListener('animationend', () => row.classList.remove('bz-history-target'), { once: true });
            }
        }
    }, 120);
}

/* ── Prepend a new song card to the left of the Listen Again row ── */
window.bzPrependListenAgainPLPL = function (entry) {
    let row = document.getElementById('bzp-la-row');

    if (!row) {
        const container = document.getElementById('bz-smart-playlists-wrap')
            || document.getElementById('playlists-container');
        if (container) {
            const laRow = makeRow([]);
            laRow.id = 'bzp-la-row';
            const section = makeSection(
                makeHeading('fa-clock-rotate-left', 'Listen Again', 'Your recently played songs'),
                laRow
            );
            section.id = 'bzp-la-section';
            container.appendChild(section);
            row = laRow;
        }
    }

    if (row) {
        const old = row.querySelector(`.bzp-la-card[data-bz-id="${CSS.escape(String(entry.id || ''))}"]`);
        if (old) old.remove();
        const card = makeListenAgainCard(entry);
        row.insertBefore(card, row.firstChild);
        // no horizontal scroll — grid layout, no scrollTo needed
    }

    const mfyRow = document.getElementById('bzp-mfy-row');
    if (!mfyRow) return;

    const pl = buildListenAgainPlaylist();
    if (!pl) return;

    const existingCard = mfyRow.querySelector('.bzp-card[data-bz-id="bz-listen-again"]');
    if (existingCard) {
        const meta = existingCard.querySelector('.bzp-card-meta');
        if (meta) meta.textContent = pl.songs.length + ' songs';
    } else {
        const newCard = makePlaylistCard(pl, 'Playlist');
        mfyRow.insertBefore(newCard, mfyRow.firstChild);
        // no horizontal scroll — grid layout, no scrollTo needed
    }
};

/* ── Remove Recently Played card from MFY + entire Listen Again section when history is cleared ── */
window.bzRemoveListenAgainPlaylist = function () {
    const mfyRow = document.getElementById('bzp-mfy-row');
    if (mfyRow) {
        const card = mfyRow.querySelector('.bzp-card[data-bz-id="bz-listen-again"]');
        if (card) {
            card.style.transition = 'opacity 0.25s, transform 0.25s';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.92)';
            setTimeout(() => card.remove(), 260);
        }
    }

    const laSection = document.getElementById('bzp-la-section');
    if (laSection) {
        laSection.style.transition = 'opacity 0.25s';
        laSection.style.opacity = '0';
        setTimeout(() => laSection.remove(), 260);
    } else {
        const laRow = document.getElementById('bzp-la-row');
        if (laRow) {
            const sec = laRow.closest('.bzp-section');
            if (sec) {
                sec.style.transition = 'opacity 0.25s';
                sec.style.opacity = '0';
                setTimeout(() => sec.remove(), 260);
            }
        }
    }
};

/* Wrapping grid row — matches home layout */
function makeRow(cards) {
    const row = document.createElement('div');
    row.className = 'bzp-row';
    cards.forEach(c => row.appendChild(c));
    return row;
}

/* Full section wrapper */
function makeSection(headingEl, rowEl) {
    const sec = document.createElement('div');
    sec.className = 'bzp-section';
    sec.appendChild(headingEl);
    sec.appendChild(rowEl);
    return sec;
}

/* ================================================================
   MAIN RENDER — Smart playlists (Playlists Made For You, etc.)
   Beat Zen Universe is injected ABOVE this by displayPlaylists()
   ================================================================ */

/* ================================================================
   SECTION — ARTISTS COLLECTIONS
   Songs are resolved dynamically from allSongsMap by matching
   each artist's name against song.artist — no manual lists.
   New songs added to the sheet appear automatically.
   ================================================================ */

function buildArtistsSection() {
    if (typeof customArtistsData === 'undefined') return null;

    const allCategories = Object.entries(customArtistsData);
    if (!allCategories.length) return null;

    const map = window.allSongsMap;

    /* Normalize a string for loose matching:
       lowercase, strip punctuation, collapse spaces */
    function norm(s) {
        return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    /* Resolve all songs from allSongsMap whose artist field
       contains (or is) the given artist name. */
    function songsForArtist(artistName) {
        if (!map) return [];
        const needle = norm(artistName);
        const results = [];
        map.forEach(function (entry) {
            const songArtist = norm(entry.artist || '');
            if (songArtist === needle || songArtist.includes(needle)) {
                results.push(entry);
            }
        });
        /* Sort: newest first (song id usually starts with year) */
        results.sort(function (a, b) {
            return String(b.id || '').localeCompare(String(a.id || ''));
        });
        return results;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'bzp-section';
    wrapper.id = 'bzp-artists-section';

    wrapper.appendChild(makeHeading(
        'fa-microphone-lines',
        'Artists',
        'Browse songs by your favourite artists'
    ));

    allCategories.forEach(function (entry) {
        const categoryName = entry[0];
        const artists = entry[1];
        if (!artists || !artists.length) return;

        /* Category sub-label */
        const subLabel = document.createElement('div');
        subLabel.className = 'bzp-artists-category-label';
        subLabel.textContent = categoryName;
        subLabel.style.cssText = [
            'font-size:0.78rem',
            'font-weight:700',
            'letter-spacing:0.07em',
            'text-transform:uppercase',
            'color:rgba(255,255,255,0.38)',
            'padding:4px 16px 8px',
            'margin-top:6px'
        ].join(';');
        wrapper.appendChild(subLabel);

        const cards = artists.map(function (artist) {
            const resolvedSongs = songsForArtist(artist.name);
            const artistItem = {
                id: artist.id,
                name: artist.name,
                title: artist.name,
                imageUrl: artist.imageUrl || '',
                albumCover: artist.imageUrl || '',
                cover: artist.imageUrl || '',
                icon: 'fa-microphone-lines',
                color: '#a855f7',
                type: 'artist',
                songs: resolvedSongs
            };
            return makePlaylistCard(artistItem, 'Artist');
        });

        wrapper.appendChild(makeRow(cards));
    });

    return wrapper;
}

/* ================================================================
   SECTION — HEROES COLLECTIONS
   Matches Artists' behaviour exactly: the sheet has an "Actors" column,
   which the Sheets → JSON pipeline exposes on each song entry. We match
   each hero's name against that field (loose, case-insensitive,
   substring match — same rule Artists uses against `song.artist`).
   No manual movie lists needed — new songs tagged with a hero's name
   in the sheet appear here automatically.
   ================================================================ */

function buildHeroesSection() {
    if (typeof customHeroesData === 'undefined') return null;

    const allCategories = Object.entries(customHeroesData);
    if (!allCategories.length) return null;

    const map = window.allSongsMap;

    function norm(s) {
        return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    /* Pull the actor/hero value off a song entry — tolerant of whichever
       key name the Sheets → JSON pipeline used for the "Actors" column,
       so this keeps working regardless of exact casing/naming on the
       backend (actor / actors / Actor / Actors / hero / heroes / Hero). */
    function actorFieldOf(entry) {
        if (!entry) return '';
        const album = entry.album || {};
        const direct = album.actors || album.actor || album.Actors || album.Actor ||
            album.hero || album.heroes || album.Hero || album.Heroes ||
            album.cast || album.Cast || album.starring || album.Starring ||
            entry.actor || entry.actors || entry.Actor || entry.Actors ||
            entry.hero || entry.heroes || entry.Hero || entry.Heroes ||
            entry.cast || entry.Cast || entry.starring || entry.Starring;
        if (direct) return Array.isArray(direct) ? direct.join(', ') : direct;
        /* Fallback: scan every key on the entry AND its album for one whose
           name contains "actor", "hero", or "cast" — covers whatever exact
           casing/spacing the Sheets → JSON backend used for that column. */
        for (const src of [entry, album]) {
            for (const k in src) {
                if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
                const kl = k.toLowerCase();
                if (kl.includes('actor') || kl.includes('hero') || kl.includes('cast')) {
                    const v = src[k];
                    if (v) return Array.isArray(v) ? v.join(', ') : v;
                }
            }
        }
        return '';
    }

    /* Resolve all songs from allSongsMap whose actor field contains
       (or is) the given hero name. The "Actors" column can list more
       than one name for multi-hero songs (e.g. "Prabhas, Anushka
       Shetty"), so we split on common separators before matching. */
    function songsForHero(heroName) {
        if (!map) return [];
        const needle = norm(heroName);
        if (!needle) return [];
        const seen = new Set();
        const results = [];
        map.forEach(function (entry) {
            const raw = actorFieldOf(entry);
            if (!raw) return;
            const parts = String(raw).split(/[,/&]| and /i);
            const isMatch = parts.some(function (part) {
                const songActor = norm(part);
                return songActor && (songActor === needle || songActor.includes(needle) || needle.includes(songActor));
            });
            const id = String(entry.id || '');
            if (isMatch && !seen.has(id)) {
                seen.add(id);
                results.push(entry);
            }
        });
        results.sort(function (a, b) {
            return String(b.id || '').localeCompare(String(a.id || ''));
        });
        return results;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'bzp-section';
    wrapper.id = 'bzp-heroes-section';

    wrapper.appendChild(makeHeading(
        'fa-star',
        'Heroes',
        'Browse songs by your favourite heroes'
    ));

    const allHeroes = allCategories.reduce(function (acc, entry) {
        const heroes = entry[1];
        if (heroes && heroes.length) acc.push.apply(acc, heroes);
        return acc;
    }, []);

    const cards = allHeroes.map(function (hero) {
        const resolvedSongs = songsForHero(hero.name);
        const heroItem = {
            id: hero.id,
            name: hero.name,
            title: hero.name,
            imageUrl: hero.imageUrl || '',
            albumCover: hero.imageUrl || '',
            cover: hero.imageUrl || '',
            icon: 'fa-star',
            color: '#f59e0b',
            type: 'hero',
            songs: resolvedSongs
        };
        return makePlaylistCard(heroItem, 'Hero');
    });

    wrapper.appendChild(makeRow(cards));

    /* Exposed so executeSearchLogic (script.js) can resolve real hero song
       lists for search results without duplicating the matching logic. */
    window.bzResolveHeroSongs = songsForHero;

    return wrapper;
}

function renderPlaylistsNew(container) {
    container.innerHTML = '';

    /* ── 1. PLAYLISTS MADE FOR YOU (signal-powered) ── */
    syncYearPlaylistNames();

    // Gate: new users (no listening history) see only the explainer card.
    // Returning users with at least one play see real personalised cards.
    const _mfyHist = loadPlayHistory();
    const _mfyHasData = _mfyHist.length > 0;

    const _mfyHeading = makeHeading(
        'fa-wand-magic-sparkles',
        'Playlists Made for You',
        'Personalised using your listening behaviour'
    );
    const mfySection = document.createElement('div');
    mfySection.className = 'bzp-section';
    mfySection.appendChild(_mfyHeading);

    if (_mfyHasData) {
        /* ── Returning user: personalised cards ── */
        const mfy = buildMadeForYou();
        const mfyRow = makeRow(mfy.map(pl => makePlaylistCard(pl, 'Playlist')));
        mfyRow.id = 'bzp-mfy-row';
        mfySection.appendChild(mfyRow);
    } else {
        /* ── New user: show explainer instead of random auto-filled cards ── */
        const _mfyCards = [
            { color: '#06b6d4', name: 'Recently Played', desc: 'Last 30 unique songs · most recent first' },
            { color: '#3b82f6', name: 'Daily Mix', desc: 'Top favourites + new discoveries · refreshes daily' },
            { color: '#10b981', name: 'Repeat Rewind', desc: 'Songs you replayed 5+ times this month' },
            { color: '#ec4899', name: 'Hidden Gems', desc: 'Unplayed tracks you\'ve never heard · ready to find' },
        ];

        const _mfyCardRows = _mfyCards.map(function (row, idx) {
            const c = row.color, nm = row.name, ds = row.desc;
            return '<div style="display:flex;align-items:center;gap:14px;padding:11px 14px;border-radius:13px;'
                + 'background:linear-gradient(90deg,' + c + '1a,' + c + '09);'
                + 'border:1px solid ' + c + '30;border-left:3px solid ' + c + ';">'
                + '<span style="width:30px;height:30px;border-radius:50%;'
                + 'background:linear-gradient(135deg,' + c + 'ee,' + c + '88);'
                + 'box-shadow:0 2px 10px ' + c + '55;'
                + 'display:flex;align-items:center;justify-content:center;flex-shrink:0;'
                + 'font-size:0.75rem;font-weight:900;color:#fff;">'
                + (idx + 1)
                + '</span>'
                + '<div style="flex:1;min-width:0;">'
                + '<div style="font-size:0.86rem;font-weight:700;color:' + c + ';line-height:1.25;">' + nm + '</div>'
                + '<div style="font-size:0.74rem;color:rgba(255,255,255,0.45);line-height:1.4;margin-top:3px;">' + ds + '</div>'
                + '</div>'
                + '</div>';
        }).join('');

        const mfyInfo = document.createElement('div');
        mfyInfo.style.cssText = [
            'background:linear-gradient(135deg,rgba(124,58,237,0.14) 0%,rgba(99,102,241,0.10) 50%,rgba(167,139,250,0.07) 100%)',
            'border:1.5px solid rgba(167,139,250,0.32)',
            'border-radius:20px',
            'padding:22px 24px',
            'margin:4px 16px 16px',
            'max-width:700px',
            'box-shadow:0 8px 32px rgba(99,102,241,0.15),0 1px 0 rgba(255,255,255,0.06) inset'
        ].join(';');
        mfyInfo.innerHTML =
            '<div style="font-size:1.0rem;font-weight:800;color:#ede9fe;letter-spacing:0.01em;margin-bottom:16px;">'
            + 'How Beat Zen builds these playlists</div>'
            + '<div style="display:flex;flex-direction:column;gap:8px;">'
            + _mfyCardRows
            + '</div>';
        mfySection.appendChild(mfyInfo);
    }
    container.appendChild(mfySection);

    /* ── 3. RECOMMENDED FOR TODAY ── */
    const recommended = buildRecommendedForToday();
    if (recommended.length) {
        const recRow = makeRow(recommended.map(a => makeAlbumCard(a)));
        container.appendChild(makeSection(
            makeHeading('fa-compass', 'Recommended for Today', 'Refreshes daily at midnight'),
            recRow
        ));
    }

    /* ── 4. BEAT ZEN UNIVERSE — after Recommended for Today ── */
    const universeWrap = document.createElement('div');
    universeWrap.id = 'bzp-universe-wrap';
    container.appendChild(universeWrap);
    renderBeatZenUniverseSection(universeWrap);

    /* ── 5. ARTISTS COLLECTIONS ── */
    const artistsSection = buildArtistsSection();
    if (artistsSection) container.appendChild(artistsSection);

    /* ── 5b. HEROES COLLECTIONS ── */
    const heroesSection = buildHeroesSection();
    if (heroesSection) container.appendChild(heroesSection);

    /* ── 6. LISTEN AGAIN (last) ── */
    var _laEnabled = localStorage.getItem('beatzen_history') !== 'false';
    const listenAgain = buildListenAgain();  // returns [] when disabled OR empty

    if (listenAgain.length) {
        /* User has history AND songs played -- show the cards row */
        const laRow = makeRow(listenAgain.map(e => makeListenAgainCard(e)));
        laRow.id = 'bzp-la-row';
        const laSection = makeSection(
            makeHeading('fa-clock-rotate-left', 'Listen Again', 'Your recently played songs'),
            laRow
        );
        laSection.id = 'bzp-la-section';
        container.appendChild(laSection);

    } else if (_laEnabled) {
        /* History is ON but no songs played yet -- show the empty-state info card */
        var _laSection = document.createElement('div');
        _laSection.className = 'bzp-section';
        _laSection.id = 'bzp-la-section';
        _laSection.appendChild(
            makeHeading('fa-clock-rotate-left', 'Listen Again', 'Your recently played songs')
        );

        var _laInfo = document.createElement('div');
        _laInfo.style.cssText = [
            'background:linear-gradient(135deg,rgba(6,182,212,0.12) 0%,rgba(59,130,246,0.08) 50%,rgba(6,182,212,0.04) 100%)',
            'border:1.5px solid rgba(6,182,212,0.28)',
            'border-radius:20px',
            'padding:22px 24px',
            'margin:4px 16px 16px',
            'max-width:700px',
            'box-shadow:0 8px 32px rgba(6,182,212,0.10),0 1px 0 rgba(255,255,255,0.05) inset'
        ].join(';');

        _laInfo.innerHTML =
            '<div style="font-size:1.0rem;font-weight:800;color:#e0f7fa;letter-spacing:0.01em;margin-bottom:16px;">'
            + 'Your recently played songs will appear here</div>'
            + '<div style="display:flex;flex-direction:column;gap:8px;">'
            + '<div style="display:flex;align-items:center;gap:14px;padding:11px 14px;border-radius:13px;'
            + 'background:linear-gradient(90deg,rgba(6,182,212,0.18),rgba(6,182,212,0.08));'
            + 'border:1px solid rgba(6,182,212,0.28);border-left:3px solid #06b6d4;">'
            + '<span style="width:30px;height:30px;border-radius:50%;'
            + 'background:linear-gradient(135deg,rgba(6,182,212,0.93),rgba(6,182,212,0.55));'
            + 'box-shadow:0 2px 10px rgba(6,182,212,0.45);'
            + 'display:flex;align-items:center;justify-content:center;flex-shrink:0;'
            + 'font-size:0.75rem;font-weight:900;color:#fff;">1</span>'
            + '<div style="flex:1;">'
            + '<span style="font-size:0.86rem;font-weight:700;color:#e0f7fa;">Go to </span>'
            + '<b style="font-size:0.86rem;color:#67e8f9;">Home</b>'
            + '<span style="font-size:0.86rem;font-weight:700;color:#e0f7fa;"> or </span>'
            + '<b style="font-size:0.86rem;color:#67e8f9;">Search</b>'
            + '<span style="font-size:0.74rem;color:rgba(255,255,255,0.42);margin-left:6px;">and open any song</span>'
            + '</div></div>'
            + '<div style="display:flex;align-items:center;gap:14px;padding:11px 14px;border-radius:13px;'
            + 'background:linear-gradient(90deg,rgba(59,130,246,0.16),rgba(59,130,246,0.08));'
            + 'border:1px solid rgba(59,130,246,0.26);border-left:3px solid #3b82f6;">'
            + '<span style="width:30px;height:30px;border-radius:50%;'
            + 'background:linear-gradient(135deg,rgba(59,130,246,0.93),rgba(59,130,246,0.55));'
            + 'box-shadow:0 2px 10px rgba(59,130,246,0.45);'
            + 'display:flex;align-items:center;justify-content:center;flex-shrink:0;'
            + 'font-size:0.75rem;font-weight:900;color:#fff;">2</span>'
            + '<div style="flex:1;">'
            + '<span style="font-size:0.86rem;font-weight:700;color:#e0f7fa;">Play a song</span>'
            + '<span style="font-size:0.74rem;color:rgba(255,255,255,0.42);margin-left:7px;">it shows up here instantly, every session</span>'
            + '</div></div>'
            + '</div>';

        _laSection.appendChild(_laInfo);
        container.appendChild(_laSection);
    }
    // If history is OFF and no songs: section is hidden entirely (expected).

    scheduleMidnightRefresh(container);
}

/* ── Midnight auto-refresh — fires for ALL sections ── */
let _midnightTimer = null;
function scheduleMidnightRefresh(container) {
    if (_midnightTimer) clearTimeout(_midnightTimer);
    _midnightTimer = setTimeout(() => {
        _recToday_seed = null;
        _recToday_cache = null;

        const expContainer = document.getElementById('bz-smart-playlists-wrap') || document.getElementById('playlists-container');
        if (expContainer && typeof window.displayPlaylists === 'function') {
            window.displayPlaylists();
        } else if (expContainer && typeof window._bzPlaylistsRender === 'function') {
            window._bzPlaylistsRender(expContainer);
        }
        scheduleMidnightRefresh(expContainer || container);
    }, msUntilMidnight());
}

/* ================================================================
   KEEP COMPATIBILITY with script.js's displayPlaylists()
   ================================================================ */

const customGenreData = {};
const dailyPlaylistSlots = [];
window.dailyPlaylistGroups = [];

function buildRecapData() { return []; }
function buildDailyPlaylists() { return []; }

window.renderPlaylists = function () {
    const wrap = document.getElementById('bz-smart-playlists-wrap');
    const container = wrap || document.getElementById('playlists-container');
    if (container) renderPlaylistsNew(container);
};

/* ================================================================
   LIVE SYNC — background sheet polling
   Polls Google Sheets every 5 minutes. If song count changes:
     • Updates window.customYearAlbumsData
     • Rebuilds allSongsMap
     • Re-renders the Beat Zen Universe section live (no page reload)
     • Shows a toast with the delta
   ================================================================ */

/* Hook registered by script.js's background fetch callback */
window.bzOnSheetDataRefresh = function (freshData) {
    const sanitize = typeof window.sanitizeSheetData === 'function'
        ? window.sanitizeSheetData
        : (d => d);
    const sanitized = sanitize(freshData);

    const oldCount = _bzCountSongs(window.customYearAlbumsData);
    const newCount = _bzCountSongs(sanitized);

    if (newCount !== oldCount) {
        window.customYearAlbumsData = sanitized;
        if (typeof window.rebuildMasterMap === 'function') window.rebuildMasterMap();
        _bzRefreshUniverseSection();

        // FIX Issue 19: also rebuild the Home grid when new albums arrive —
        // previously only the Beat Zen Universe section on the Playlists tab was
        // refreshed. Users on the Home tab would never see new album cards until
        // a manual page reload. Bump _bzDataVersion so displayHome detects a stale
        // grid and rebuilds it in-place; guard to avoid rendering a hidden view.
        window._bzDataVersion = Date.now().toString();
        if (window.lastActiveView === 'home' && typeof window.displayHome === 'function') {
            try { window.displayHome(true); } catch (_) { /* never interrupt playback */ }
        }

        /* Change 4: bust the dyn-updates cache so new albums immediately appear
           in the Updates panel with a NEW badge — no page reload required.
           _resetDynCache is defined inside the IIFE above; guard in case the
           IIFE hasn't run yet (extremely unlikely but safe). */
        if (typeof window._bzResetDynCache === 'function') {
            window._bzResetDynCache();
        }

        const diff = newCount - oldCount;
        _bzShowLiveSyncToast(diff > 0 ? `✓ +${diff} new song${diff !== 1 ? 's' : ''} added` : '✓ Songs updated — playlists refreshed');
    }
    /* No toast when nothing changed — silent background sync */
};

function _bzCountSongs(data) {
    if (!data || typeof data !== 'object') return 0;
    return Object.values(data).flat().reduce((s, a) => s + (Array.isArray(a && a.songs) ? a.songs.length : 0), 0);
}

function _bzRefreshUniverseSection() {
    const wrap = document.getElementById('bzp-universe-wrap');
    if (wrap) {
        renderBeatZenUniverseSection(wrap);
    }
}

/* Minimal toast that works without access to script.js's internal showToast */
function _bzShowLiveSyncToast(msg) {
    /* Try the app's own showToast first */
    if (typeof showToast === 'function') { showToast(msg); return; }
    /* Fallback: inject into #toast-container if present */
    const tc = document.getElementById('toast-container');
    if (!tc) return;
    const t = document.createElement('div');
    t.style.cssText = [
        'background:rgba(30,30,50,0.96)',
        'color:#fff',
        'padding:10px 18px',
        'border-radius:24px',
        'font-size:0.83rem',
        'box-shadow:0 4px 20px rgba(0,0,0,0.4)',
        'pointer-events:none',
        'opacity:0',
        'transition:opacity 0.25s'
    ].join(';');
    t.textContent = msg;
    tc.appendChild(t);
    requestAnimationFrame(() => { t.style.opacity = '1'; });
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3500);
}

/* Background polling — fires every 5 minutes while a user is signed in.
 *
 * The IIFE no longer self-starts.  auth.js calls window.bzStartLiveSync()
 * from inside onAuthStateChanged when a user signs in, and calls
 * window.bzStopLiveSync() when they sign out.  This prevents signed-out
 * guests from hitting the Google Apps Script endpoint and consuming quota.
 */
(function () {
    const POLL_MS = 5 * 60 * 1000; /* 5 minutes */
    let _pollTimer = null;

    async function poll() {
        const url = window.BEATZEN_SHEET_URL;
        if (!url) return;
        try {
            const res = await fetch(url);
            if (!res.ok) return;
            const data = await res.json();
            if (typeof window.bzOnSheetDataRefresh === 'function') {
                window.bzOnSheetDataRefresh(data);
            }
        } catch (_) { /* silent — never interrupt playback */ }
        _pollTimer = setTimeout(poll, POLL_MS);
    }

    /** Start live-sync polling.  Called by auth.js when a user signs in.
     *  Safe to call multiple times — ignored if polling is already running. */
    window.bzStartLiveSync = function () {
        if (_pollTimer !== null) return; // already running
        /* First poll 60 seconds after sign-in — let the app fully settle first */
        _pollTimer = setTimeout(poll, 60 * 1000);
    };

    /** Stop live-sync polling.  Called by auth.js when the user signs out. */
    window.bzStopLiveSync = function () {
        if (_pollTimer !== null) {
            clearTimeout(_pollTimer);
            _pollTimer = null;
        }
    };
})();

/* ================================================================
   INJECTED STYLES
   ================================================================ */
(function injectStyles() {
    if (document.getElementById('bzp-styles')) return;
    const s = document.createElement('style');
    s.id = 'bzp-styles';
    s.textContent = `
/* ── Container ── */
#playlists-container, .playlists-container {
    padding: 12px 0 120px;
    overflow-y: auto;
}

/* ── Section ── */
.bzp-section { margin: 1.25rem 0 32px; }

/* ── Section heading ── */
.bzp-section-head { padding: 0 0 12px 0; }
.bzp-section-title-row { display: flex; align-items: center; }
.bzp-section-icon { display: none; }
.bzp-section-title {
    font-size: 1.8rem;
    font-weight: 800;
    color: var(--text, #fff);
    letter-spacing: -0.2px;
    line-height: 1.2;
    margin: 0 0 0.45rem 16px;
}
.bzp-section-sub { display: none; }

@media (max-width: 767px) {
    .bzp-section-title { font-size: 1.4rem; margin-left: 14px; }
}
@media (max-width: 480px) {
    .bzp-section-title { font-size: 1.4rem; margin-left: 14px; }
}

/* ════════════════════════════════════════════════
   (Universe section now uses standard .bzp-section-head / .bzp-section-title styles)
════════════════════════════════════════════════ */

/* ── Wrapping grid row — matches home #year-sections-container layout ── */
.bzp-row {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 10px;
    padding: 4px 16px 16px 16px;
    overflow-x: visible;
    overflow-y: visible;
}

@media (max-width: 767px) {
    .bzp-row {
        grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
        gap: 8px;
        padding: 4px 14px 14px 14px;
    }
}
@media (max-width: 480px) {
    .bzp-row {
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        padding: 4px 12px 14px 12px;
    }
}
@media (max-width: 360px) {
    .bzp-row {
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
        padding: 4px 10px 12px 10px;
    }
}

/* ── Playlist / Album card ── */
.bzp-card {
    flex: unset;
    width: 100%;
    min-width: 0;
    cursor: pointer;
    border-radius: 14px;
    overflow: hidden;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    transition: transform 0.18s, background 0.18s;
}
.bzp-card:hover, .bzp-card:active {
    transform: scale(1.04);
    background: rgba(255,255,255,0.09);
}
.bzp-card-cover {
    width: 100%;
    height: auto;
    aspect-ratio: 1 / 1;
    position: relative;
    overflow: hidden;
}
.bzp-card-cover img {
    width: 100%; height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 0.3s;
}
.bzp-card:hover .bzp-card-cover img { transform: scale(1.06); }

.bzp-card-gradient {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    font-size: 2.2rem;
    color: rgba(255,255,255,0.40);
    background: linear-gradient(135deg, rgba(109,40,217,0.8), rgba(59,130,246,0.5));
}

/* Active / playing card highlight */
.bzp-card--playing,
.bzp-la-card--active {
    border-color: #1db954 !important;
    background: transparent !important;
    box-shadow: 0 0 0 2px #1db954;
}
.bzp-la-card--active .bzp-la-song-name { color: inherit; }


.bzp-card-info { padding: 8px 10px 10px; display: flex; flex-direction: column; align-items: center; text-align: center; }
.bzp-card-name {
    font-size: 0.86rem;
    font-weight: 700;
    color: var(--text, #fff);
    text-align: center;
    white-space: normal;
    overflow: hidden;
    max-height: calc(1.35em * 2);
    line-height: 1.35;
    word-break: break-word;
}
.bzp-card-meta {
    font-size: 0.70rem;
    color: rgba(255,255,255,0.42);
    margin-top: 3px;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

@media (max-width: 480px) {
    .bzp-card-name { font-size: 0.76rem; }
    .bzp-card-meta { font-size: 0.64rem; }
}

/* ── Listen Again insight cards ── */
.bzp-la-card { flex: unset; width: 100%; min-width: 0; background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.10); }
.bzp-la-cover { width: 100%; height: auto; aspect-ratio: 1 / 1; position: relative; }
.bzp-la-badge {
    position: absolute;
    bottom: 7px; left: 8px;
    background: rgba(0,0,0,0.72);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    color: rgba(255,255,255,0.82);
    font-size: 0.60rem;
    font-weight: 600;
    letter-spacing: 0.3px;
    padding: 2px 7px;
    border-radius: 20px;
    white-space: nowrap;
    pointer-events: none;
    z-index: 2;
}
.bzp-la-info { padding: 8px 10px 10px; align-items: flex-start; text-align: left; }
.bzp-la-song-name {
    font-size: 0.83rem;
    font-weight: 700;
    color: #fff;
    line-height: 1.3;
    max-height: calc(1.3em * 2);
    overflow: hidden;
    word-break: break-word;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
}
.bzp-la-source {
    font-size: 0.68rem;
    color: rgba(255,255,255,0.45);
    margin-top: 3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
}
.bzp-la-movie {
    font-size: 0.63rem;
    color: rgba(255,255,255,0.28);
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
}
.bzp-la-dur {
    font-size: 0.62rem;
    color: rgba(255,255,255,0.30);
    margin-top: 4px;
    display: flex;
    align-items: center;
    gap: 4px;
}
.bzp-la-dur i { font-size: 0.55rem; }

@media (max-width: 480px) {
    .bzp-la-song-name { font-size: 0.75rem; }
}
    `;
    document.head.appendChild(s);
})();

/* ================================================================
   INIT
   ================================================================ */
document.addEventListener('DOMContentLoaded', () => {
    /* Pre-expose so script.js's displayPlaylists can call it */
    window._bzPlaylistsRender = renderPlaylistsNew;
    /* Sync year names into the smart-playlist name map */
    syncYearPlaylistNames();
});

/* ============================================================
   MERGED FROM: artists.js
   ============================================================ */
/**
 * Beat Zen — Artists Data
 * ─────────────────────────────────────────────────────────────────
 * NO manual song lists needed.
 * Songs are resolved automatically at runtime by matching each
 * artist's name against the `artist` field of every song in
 * allSongsMap — so new songs added to the sheet appear here
 * automatically without any change to this file.
 *
 * imageUrl: paste the Cloudinary (or any direct) link here.
 *           Leave as '' to show a gradient + mic icon instead.
 * ─────────────────────────────────────────────────────────────────
 */

const customArtistsData = {
    "Male Artists": [
        { id: "anirudh", name: "Anirudh Ravichander", imageUrl: "" },
        { id: "dsp", name: "Devi Sri Prasad", imageUrl: "" },
        { id: "thaman", name: "Thaman S", imageUrl: "" },
        { id: "sid-sriram", name: "Sid Sriram", imageUrl: "" },
        { id: "armaan-malik", name: "Armaan Malik", imageUrl: "" },
        { id: "arijit-singh", name: "Arijit Singh", imageUrl: "" },
        { id: "javed-ali", name: "Javed Ali", imageUrl: "" },
        { id: "karthik", name: "Karthik", imageUrl: "" },
        { id: "nakash-aziz", name: "Nakash Aziz", imageUrl: "" },
        { id: "anurag-kulkarni", name: "Anurag Kulkarni", imageUrl: "" },
        { id: "revanth", name: "Revanth", imageUrl: "" },
        { id: "rahul-sipligunj", name: "Rahul Sipligunj", imageUrl: "" },
        { id: "ram-miriyala", name: "Ram Miriyala", imageUrl: "" },
        { id: "hema-chandra", name: "Hema Chandra", imageUrl: "" },
        { id: "keeravaani", name: "MM Keeravaani", imageUrl: "" },
        { id: "sreerama-chandra", name: "Sreerama Chandra", imageUrl: "" },
        { id: "vishal-mishra", name: "Vishal Mishra", imageUrl: "" },
        { id: "spb", name: "S.P. Balasubrahmanyam", imageUrl: "" },
        { id: "mano", name: "Mano", imageUrl: "" }
    ],
    "Female Artists": [
        { id: "shreya-ghoshal", name: "Shreya Ghoshal", imageUrl: "" },
        { id: "mangli", name: "Mangli", imageUrl: "" },
        { id: "chinmayi", name: "Chinmayi Sripada", imageUrl: "" },
        { id: "ramya-behara", name: "Ramya Behara", imageUrl: "" },
        { id: "geetha-madhuri", name: "Geetha Madhuri", imageUrl: "" },
        { id: "sahithi-chaganti", name: "Sahithi Chaganti", imageUrl: "" },
        { id: "haripriya", name: "Haripriya", imageUrl: "" },
        { id: "indravathi-chauhan", name: "Indravathi Chauhan", imageUrl: "" },
        { id: "sameera-bharadwaj", name: "Sameera Bharadwaj", imageUrl: "" },
        { id: "kanakavva", name: "Kanakavva", imageUrl: "" },
        { id: "madhu-priya", name: "Madhu Priya", imageUrl: "" }
    ]
};

/*
 * ─────────────────────────────────────────────────────────────────
 * HEROES COLLECTIONS DATA
 *
 * NO manual song/movie lists needed — just like Artists, songs are
 * resolved automatically at runtime by matching each hero's name
 * against the sheet's "Actors" column (exposed as `actor`/`actors`
 * on every song in allSongsMap; see buildHeroesSection above). New
 * songs tagged with a hero's name in the sheet appear here
 * automatically, with no code changes required.
 *
 * IMPORTANT — name matching: `name` below must match how the hero's
 * name is spelled in your sheet's Actors column (loose, case-
 * insensitive substring match, so "Jr NTR" also matches "Jr. NTR" or
 * "N.T. Rama Rao Jr" as long as one contains the other — but wildly
 * different spellings won't match, so keep these consistent with
 * your sheet).
 *
 * imageUrl: paste the Cloudinary (or any direct) link here.
 *           Leave as '' to show a gradient + star icon instead.
 * ─────────────────────────────────────────────────────────────────
 */

const customHeroesData = {
    "Legends": [
        { id: "chiranjeevi", name: "Chiranjeevi", imageUrl: "" },
        { id: "nagarjuna", name: "Nagarjuna", imageUrl: "" },
        { id: "venkatesh", name: "Venkatesh", imageUrl: "" },
        { id: "balakrishna", name: "Balakrishna", imageUrl: "" },
        { id: "mohan-babu", name: "Mohan Babu", imageUrl: "" },
        { id: "rajasekhar", name: "Rajasekhar", imageUrl: "" }
    ],
    "Superstars": [
        { id: "mahesh-babu", name: "Mahesh Babu", imageUrl: "" },
        { id: "prabhas", name: "Prabhas", imageUrl: "" },
        { id: "allu-arjun", name: "Allu Arjun", imageUrl: "" },
        { id: "jr-ntr", name: "Jr NTR", imageUrl: "" },
        { id: "ram-charan", name: "Ram Charan", imageUrl: "" },
        { id: "pawan-kalyan", name: "Pawan Kalyan", imageUrl: "" },
        { id: "ravi-teja", name: "Ravi Teja", imageUrl: "" },
        { id: "gopichand", name: "Gopichand", imageUrl: "" }
    ],
    "Young & New Gen": [
        { id: "nani", name: "Nani", imageUrl: "" },
        { id: "vijay-deverakonda", name: "Vijay Deverakonda", imageUrl: "" },
        { id: "nithiin", name: "Nithiin", imageUrl: "" },
        { id: "sharwanand", name: "Sharwanand", imageUrl: "" },
        { id: "naga-chaitanya", name: "Naga Chaitanya", imageUrl: "" },
        { id: "akhil-akkineni", name: "Akhil Akkineni", imageUrl: "" },
        { id: "sai-dharam-tej", name: "Sai Dharam Tej", imageUrl: "" },
        { id: "varun-tej", name: "Varun Tej", imageUrl: "" },
        { id: "ram-pothineni", name: "Ram Pothineni", imageUrl: "" },
        { id: "rana-daggubati", name: "Rana Daggubati", imageUrl: "" },
        { id: "nikhil-siddhartha", name: "Nikhil Siddhartha", imageUrl: "" },
        { id: "vishwak-sen", name: "Vishwak Sen", imageUrl: "" },
        { id: "sudheer-babu", name: "Sudheer Babu", imageUrl: "" },
        { id: "adivi-sesh", name: "Adivi Sesh", imageUrl: "" },
        { id: "sundeep-kishan", name: "Sundeep Kishan", imageUrl: "" },
        { id: "kalyan-ram", name: "Kalyan Ram", imageUrl: "" },
        { id: "bellamkonda-sreenivas", name: "Bellamkonda Sreenivas", imageUrl: "" },
        { id: "allari-naresh", name: "Allari Naresh", imageUrl: "" },
        { id: "raj-tarun", name: "Raj Tarun", imageUrl: "" },
        { id: "teja-sajja", name: "Teja Sajja", imageUrl: "" }
    ]
};

/* ============================================================
   MERGED FROM: beatzen-pro.js
   ============================================================ */
/* ═══════════════════════════════════════════════════════════════════════
   BEATZEN PRO  —  Playback Queue + Endless Auto-Mix Engine  v2.0
   Architecture:
     • Queue = two logical sections:
         1. "Up Next"   — songs the user/album explicitly queued
         2. "Auto-Mix"  — smart-injected songs after the explicit queue
     • Both sections live in window.playingAlbum.songs (single source of
       truth for the player) but we TRACK the boundary index so the UI
       can render them differently with a visual divider.
     • Auto-Mix fills whenever remaining auto-mix songs drop below
       AUTOMIX_LOW_THRESHOLD. This creates endless playback.
     • Scoring: history-weighted (recently played artists/albums rank
       higher), then views/likes fallback.
═══════════════════════════════════════════════════════════════════════ */

document.addEventListener("DOMContentLoaded", () => {

    // ────────────────────────────────────────────────────────────────────────
    // SECTION 0 — Local utilities
    // ────────────────────────────────────────────────────────────────────────
    function sanitizeHTML(str) {
        const d = document.createElement('div');
        d.textContent = String(str ?? '');
        return d.innerHTML;
    }

    function formatDuration(val) {
        if (!val && val !== 0) return '0:00';
        const str = String(val).trim();
        // Already a m:ss or h:mm:ss string — pass through unchanged
        if (/^\d+:\d{2}(:\d{2})?$/.test(str)) return str;
        // Raw seconds number — convert
        const s = parseInt(str) || 0;
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }

    // ────────────────────────────────────────────────────────────────────────
    // SECTION 1 — Auto-Mix boundary tracker
    //
    // window._bzAutoMixStartIndex  — first index in playingAlbum.songs that
    //   belongs to the Auto-Mix section. Everything BEFORE this index (and
    //   after currentSongIndex) is the "user queue". -1 = automix not active.
    // ────────────────────────────────────────────────────────────────────────
    if (window._bzAutoMixStartIndex === undefined) window._bzAutoMixStartIndex = -1;

    // Helpers to read / write the boundary
    function getAutoMixBoundary() { return window._bzAutoMixStartIndex ?? -1; }
    function setAutoMixBoundary(idx) { window._bzAutoMixStartIndex = idx; }
    function clearAutoMixBoundary() { window._bzAutoMixStartIndex = -1; }

    // ────────────────────────────────────────────────────────────────────────
    // SECTION 2 — DOM refs
    // ────────────────────────────────────────────────────────────────────────
    const overlay = document.getElementById('bz-queue-fullscreen');
    const queueList = document.getElementById('bz-queue-list');
    const queueStats = document.getElementById('bz-queue-stats');
    const queueBody = document.querySelector('.bz-queue-body');
    const emptyState = document.getElementById('bz-empty-state');
    const activeContainer = document.getElementById('bz-queue-active-container');
    const openBtn = document.getElementById('bz-queue-open-btn');
    const openBtnMini = document.getElementById('bz-queue-mini-btn');
    const closeBtn = document.getElementById('bz-queue-close');
    const clearBtn = document.getElementById('bz-queue-clear');
    const audioPlayer = document.getElementById('audio-player');

    let dragSrcIndex = null;
    let dragOverIndex = null;

    // ── Edge auto-scroll while dragging inside the queue body ──────────────
    // The browser's native overflow auto-scroll doesn't fire reliably inside
    // fixed-position overlays. This replaces it: when the drag cursor is
    // within EDGE_ZONE px of the top or bottom of queueBody we rAF-scroll it,
    // accelerating the closer you are to the edge.
    const EDGE_ZONE = 80;   // px from edge where scrolling kicks in
    const SCROLL_MAX = 18;  // max px scrolled per animation frame
    let _autoScrollRAF = null;

    function _startAutoScroll(clientY) {
        if (!queueBody) return;
        const rect = queueBody.getBoundingClientRect();
        const distTop = clientY - rect.top;
        const distBottom = rect.bottom - clientY;

        let speed = 0;
        if (distTop < EDGE_ZONE && distTop >= 0) {
            // Near top — scroll up; closer to edge = faster
            speed = -SCROLL_MAX * (1 - distTop / EDGE_ZONE);
        } else if (distBottom < EDGE_ZONE && distBottom >= 0) {
            // Near bottom — scroll down
            speed = SCROLL_MAX * (1 - distBottom / EDGE_ZONE);
        }

        if (speed !== 0) {
            queueBody.scrollTop += speed;
            _autoScrollRAF = requestAnimationFrame(() => _startAutoScroll(clientY));
        } else {
            _stopAutoScroll();
        }
    }

    function _stopAutoScroll() {
        if (_autoScrollRAF !== null) {
            cancelAnimationFrame(_autoScrollRAF);
            _autoScrollRAF = null;
        }
    }

    // Track cursor Y during drag via dragover on the whole overlay so we get
    // events even when cursor moves between rows or hovers over padding gaps.
    function _onOverlayDragOver(e) {
        if (dragSrcIndex === null) return; // not our drag
        e.preventDefault();
        _stopAutoScroll();
        _autoScrollRAF = requestAnimationFrame(() => _startAutoScroll(e.clientY));
    }

    function _onOverlayDragEnd() {
        _stopAutoScroll();
        overlay.removeEventListener('dragover', _onOverlayDragOver);
        overlay.removeEventListener('dragend', _onOverlayDragEnd);
        overlay.removeEventListener('drop', _onOverlayDragEnd);
    }

    // ────────────────────────────────────────────────────────────────────────
    // SECTION 3 — Open / Close
    // ────────────────────────────────────────────────────────────────────────
    function openQueue() {
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        renderFullscreenQueue();
        // Push a history entry so the browser back gesture / Escape key
        // pops THIS state and we intercept it — preventing the app from
        // falling through to the album song-list view.
        history.pushState({ bzQueue: true }, '', window.location.href);
    }
    let _closingFromPopstate = false;
    function closeQueue(fromPopstate = false) {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
        // If closed by button/Escape (not by popstate), pop the history entry
        // we pushed in openQueue so the URL stays clean.
        if (!fromPopstate) {
            _closingFromPopstate = true;
            history.back();
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // QUEUE PERSISTENCE — saves the full ordered queue to localStorage so that
    // auto-mix songs, manually-added songs, and drag-reordered positions all
    // survive a page refresh.  Only IDs are stored (never full objects) so the
    // payload is small and re-hydration goes through the normal resolveData path.
    // ══════════════════════════════════════════════════════════════════════════
    const QUEUE_KEY = 'beatZen_queueState';
    const QUEUE_MAX_AGE = 86400000; // 24 h

    function saveQueueState() {
        try {
            if (!window.playingAlbum?.songs?.length) return;
            const mainAlbumId = String(
                window.playingAlbum.id ||
                window.playingAlbum.name ||
                window.playingAlbum.title || ''
            );
            if (!mainAlbumId) return;

            const entries = window.playingAlbum.songs.map(s => {
                const entry = {
                    id: String(s.id || ''),
                    src: String(
                        s._sourceAlbum?.id ||
                        s._sourceAlbum?.name ||
                        s._sourceAlbum?.title ||
                        mainAlbumId
                    )
                };
                if (s._autoMix) entry.am = 1;
                return entry;
            });

            // Also persist the current song index + playback position so
            // restoreQueueState can seek back to the exact timestamp on reload.
            const _ci = window.currentSongIndex ?? 0;
            const _ct = (audioPlayer && !isNaN(audioPlayer.currentTime) && audioPlayer.currentTime > 2)
                ? audioPlayer.currentTime : 0;
            const _sid = String(window.playingAlbum.songs[_ci]?.id ?? '');

            localStorage.setItem(QUEUE_KEY, JSON.stringify({
                albumId: mainAlbumId,
                entries,
                boundary: getAutoMixBoundary(),
                savedAt: Date.now(),
                currentSongId: _sid,
                currentTime: _ct
            }));
        } catch (_) { /* quota full or private browsing — silently skip */ }
    }

    function restoreQueueState() {
        try {
            const raw = localStorage.getItem(QUEUE_KEY);
            if (!raw || !window.playingAlbum || !window.masterPool?.length) return;

            const saved = JSON.parse(raw);
            const mainAlbumId = String(
                window.playingAlbum.id ||
                window.playingAlbum.name ||
                window.playingAlbum.title || ''
            );

            // Guard: stale save from a different album or past the 24-h window
            if (saved.albumId !== mainAlbumId) return;
            if (Date.now() - (saved.savedAt || 0) > QUEUE_MAX_AGE) {
                localStorage.removeItem(QUEUE_KEY);
                return;
            }

            const savedEntries = saved.entries || [];
            const currentSongs = window.playingAlbum.songs;

            // Nothing to do if order + length are identical
            const savedIds = savedEntries.map(e => String(e.id));
            const currentIds = currentSongs.map(s => String(s.id));
            if (
                savedIds.length === currentIds.length &&
                savedIds.every((id, i) => id === currentIds[i])
            ) return;

            // Build fast lookup for currently loaded songs
            const currentMap = new Map(currentSongs.map(s => [String(s.id), s]));
            // Cache resolved albums so we call resolveData at most once per source
            const albumCache = new Map([[mainAlbumId, window.playingAlbum]]);

            const newSongs = [];
            for (const entry of savedEntries) {
                const sid = String(entry.id || '');
                if (!sid) continue;

                // Fast-path: song already in the loaded album
                if (currentMap.has(sid)) {
                    newSongs.push(currentMap.get(sid));
                    continue;
                }

                // Slow-path: song came from a different source (auto-mix) — re-hydrate
                const srcId = entry.src || mainAlbumId;
                if (!albumCache.has(srcId) && window.resolveData) {
                    const rawAlbum = window.masterPool.find(a =>
                        String(a.id || a.name || a.title || '') === srcId
                    );
                    if (rawAlbum) {
                        const h = window.resolveData(rawAlbum, rawAlbum.type || 'Movie');
                        if (h) albumCache.set(srcId, h);
                    }
                }
                const srcAlbum = albumCache.get(srcId);
                if (!srcAlbum) continue;

                const song = srcAlbum.songs?.find(s => String(s.id) === sid);
                if (!song) continue;

                const cloned = { ...song };
                if (entry.am) {
                    cloned._autoMix = true;
                    cloned._sourceAlbum = srcAlbum;
                }
                newSongs.push(cloned);
            }

            if (newSongs.length > 0) {
                window.playingAlbum.songs = newSongs;
                if (saved.boundary > 0) window._bzAutoMixStartIndex = saved.boundary;

                // FIX Issue 6: After rebuilding the queue, the song that was playing
                // before restore may now sit at a different index (AutoMix songs were
                // re-inserted, drag reorder was restored, etc.).
                // Re-resolve window.currentSongIndex by songId so applySavedTime
                // validates against the CORRECT song and doesn't clear the position.
                const _restoreSongId = String(
                    window.playingAlbum.songs[window.currentSongIndex]?.id ?? ''
                );
                if (_restoreSongId) {
                    const _newIdx = newSongs.findIndex(s => String(s.id) === _restoreSongId);
                    if (_newIdx >= 0) window.currentSongIndex = _newIdx;
                }

                // FIX (critical — race condition removed): this block used to seek
                // audioPlayer.currentTime directly using its OWN saved timestamp
                // (saved.currentTime from QUEUE_KEY, refreshed only on pause/every 10s)
                // on an 800ms deferred timer. script.js's applySavedTime() is the
                // authoritative restore path — it tracks position on every single
                // timeupdate tick (far more accurate), drives the _restoreApplied flag
                // that unblocks syncProgressBar, and repaints the progress bar/time/
                // duration UI elements after seeking. Running a second, independent
                // seek here raced against it: whichever fired last won, silently
                // jumping the audio position without ever updating the visible
                // progress bar/time, since this code never touched those elements.
                // That produced exactly the "progress/duration not restoring
                // correctly" symptom. Instead, just re-run the authoritative restore
                // now that the queue order (and therefore currentSongIndex) is final
                // — applySavedTime() is idempotent and a no-op if it already ran.
                if (window.applySavedTime && audioPlayer && !audioPlayer._restoreApplied) {
                    window.applySavedTime();
                }
            }
        } catch (e) {
            console.warn('BZ: restoreQueueState failed', e);
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // SECTION 4 — Clear confirm popup
    // ────────────────────────────────────────────────────────────────────────
    function showClearConfirm() {
        const songs = window.playingAlbum?.songs || [];
        const ci = window.currentSongIndex || 0;
        const upNextCount = songs.length - (ci + 1);
        if (upNextCount <= 0) return;

        dismissClearConfirm();

        const popup = document.createElement('div');
        popup.id = 'bz-clear-popup';
        popup.className = 'bz-clear-popup';
        popup.setAttribute('role', 'dialog');
        popup.setAttribute('aria-modal', 'true');
        popup.innerHTML = `
            <div class="bz-popup-box">
                <div class="bz-popup-icon"><i class="fas fa-trash-can"></i></div>
                <h3 class="bz-popup-title">Clear Up Next?</h3>
                <p class="bz-popup-body">
                    This will remove
                    <strong>${upNextCount} upcoming song${upNextCount !== 1 ? 's' : ''}</strong>
                    from the queue, including any Auto-Mix songs.<br>
                    <span class="bz-popup-note">
                        <i class="fas fa-circle-check"></i>
                        Now Playing will keep playing.
                    </span>
                </p>
                <div class="bz-popup-actions">
                    <button class="bz-popup-cancel" id="bz-popup-cancel">Keep Queue</button>
                    <button class="bz-popup-ok" id="bz-popup-ok">
                        <i class="fas fa-trash"></i> Clear All
                    </button>
                </div>
            </div>`;

        document.body.appendChild(popup);
        requestAnimationFrame(() => popup.classList.add('visible'));
        setTimeout(() => document.getElementById('bz-popup-cancel')?.focus(), 50);

        document.getElementById('bz-popup-cancel').addEventListener('click', dismissClearConfirm);
        document.getElementById('bz-popup-ok').addEventListener('click', () => {
            executeClearUpNext(); dismissClearConfirm();
        });
        popup.addEventListener('click', (e) => { if (e.target === popup) dismissClearConfirm(); });
        popup._keyHandler = (e) => { if (e.key === 'Escape') dismissClearConfirm(); };
        document.addEventListener('keydown', popup._keyHandler);
    }

    function dismissClearConfirm() {
        const popup = document.getElementById('bz-clear-popup');
        if (!popup) return;
        if (popup._keyHandler) document.removeEventListener('keydown', popup._keyHandler);
        popup.classList.remove('visible');
        setTimeout(() => popup.remove(), 300);
    }

    function executeClearUpNext() {
        if (!window.playingAlbum) return;
        const ci = window.currentSongIndex || 0;
        window.playingAlbum.songs.splice(ci + 1);
        clearAutoMixBoundary();
        saveQueueState();          // persist cleared state
        renderFullscreenQueue();
    }

    // ── Remove only AutoMix-flagged songs from the queue tail ────────────────
    // Called whenever AutoMix is toggled OFF so the Up Next panel is instantly
    // emptied of Auto-Mix entries while preserving any songs the user queued.
    function removeAutoMixSongsFromQueue() {
        if (!window.playingAlbum?.songs) return;
        const ci = window.currentSongIndex || 0;
        // Keep current song and any manually-queued (non-_autoMix) songs
        window.playingAlbum.songs = window.playingAlbum.songs.filter(
            (s, idx) => idx <= ci || !s._autoMix
        );
        clearAutoMixBoundary();
        if (typeof saveQueueState === 'function') saveQueueState();
    }

    // ────────────────────────────────────────────────────────────────────────
    // SECTION 5 — Per-item remove
    // ────────────────────────────────────────────────────────────────────────
    function removeSongAt(realIdx) {
        if (!window.playingAlbum?.songs) return;
        const ci = window.currentSongIndex || 0;
        if (realIdx <= ci) return;
        window.playingAlbum.songs.splice(realIdx, 1);
        // Adjust boundary
        const bnd = getAutoMixBoundary();
        if (bnd > 0 && realIdx < bnd) setAutoMixBoundary(bnd - 1);
        else if (bnd > 0 && realIdx === bnd && window.playingAlbum.songs.length <= bnd) clearAutoMixBoundary();
        saveQueueState();          // persist after removal
        renderFullscreenQueue();
    }

    // ────────────────────────────────────────────────────────────────────────
    // SECTION 6 — Jump to song
    // ────────────────────────────────────────────────────────────────────────
    function jumpToSong(realIdx) {
        if (!window.playSong) return;
        window.playSong(realIdx);
        setTimeout(renderFullscreenQueue, 80);
    }

    // ────────────────────────────────────────────────────────────────────────
    // SECTION 7 — Album cover helper
    // ────────────────────────────────────────────────────────────────────────
    function getCoverForSong(song) {
        if (!song) return '';
        const songId = String(song.id || '');
        const canon = window.allSongsMap?.get(songId)?.album;
        // FIX Issue 2: prefer _sourceAlbum (set by resolveData on every song object)
        // before falling back to window.playingAlbum, so AutoMix songs always show
        // their real movie poster rather than the queue-owning album's cover.
        return canon?.imageUrl || canon?.albumCover
            || song._sourceAlbum?.imageUrl || song._sourceAlbum?.albumCover
            || window.playingAlbum?.imageUrl || window.playingAlbum?.albumCover || '';
    }

    function getCurrentAlbumCover() {
        const ci = window.currentSongIndex ?? 0;
        return getCoverForSong(window.playingAlbum?.songs?.[ci]);
    }

    // ────────────────────────────────────────────────────────────────────────
    // SECTION 7b — Robust playback control helpers
    // Tries window.fn() first (script.js global), then falls back to clicking
    // the actual DOM button so controls always work regardless of naming.
    // ────────────────────────────────────────────────────────────────────────

    // Candidate button ID / selector lists — ordered by likelihood
    const _PREV_SELECTORS = ['#prev-btn', '#prev-song-btn', '#prevBtn', '#player-prev',
        '.prev-btn', '[data-action="prev"]', 'button.prev',
        '#back-btn', '#backward-btn'];
    const _NEXT_SELECTORS = ['#next-btn', '#next-song-btn', '#nextBtn', '#player-next',
        '.next-btn', '[data-action="next"]', 'button.next',
        '#forward-btn', '#skip-btn'];
    const _PLAY_SELECTORS = ['#play-pause-btn', '#play-btn', '#pause-btn', '#playPauseBtn',
        '#player-play', '#player-playpause', '.play-pause-btn',
        '[data-action="play-pause"]', '[data-action="toggle-play"]',
        'button.play-pause', '#togglePlay', '#play-pause'];

    function _clickFirst(selectors) {
        for (const sel of selectors) {
            try {
                const el = document.querySelector(sel);
                if (el) { el.click(); return true; }
            } catch (_) { }
        }
        return false;
    }

    function _bzPrevSong() {
        if (typeof window.playPrevSong === 'function') { window.playPrevSong(); return; }
        if (typeof window.prevSong === 'function') { window.prevSong(); return; }
        if (typeof window.playPrev === 'function') { window.playPrev(); return; }
        if (typeof window.skipPrev === 'function') { window.skipPrev(); return; }
        // Fallback: click the main player's prev button
        if (!_clickFirst(_PREV_SELECTORS)) {
            // Last resort: decrement index and playSong
            if (typeof window.playSong === 'function' && window.currentSongIndex > 0) {
                window.playSong(window.currentSongIndex - 1);
            }
        }
    }

    function _bzNextSong() {
        if (typeof window.playNextSong === 'function') { window.playNextSong(); return; }
        if (typeof window.nextSong === 'function') { window.nextSong(); return; }
        if (typeof window.playNext === 'function') { window.playNext(); return; }
        if (typeof window.skipNext === 'function') { window.skipNext(); return; }
        if (typeof window.skipForward === 'function') { window.skipForward(); return; }
        // Fallback: click the main player's next button
        if (!_clickFirst(_NEXT_SELECTORS)) {
            const songs = window.playingAlbum?.songs || [];
            const ci = window.currentSongIndex ?? 0;
            if (typeof window.playSong === 'function' && ci < songs.length - 1) {
                window.playSong(ci + 1);
            }
        }
    }

    function _bzTogglePlay() {
        if (typeof window.togglePlayback === 'function') { window.togglePlayback(); return; }
        if (typeof window.togglePlay === 'function') { window.togglePlay(); return; }
        if (typeof window.playPause === 'function') { window.playPause(); return; }
        if (typeof window.togglePause === 'function') { window.togglePause(); return; }
        // Fallback: click the main player's play/pause button
        if (!_clickFirst(_PLAY_SELECTORS) && audioPlayer) {
            // Last resort: directly toggle the audio element
            if (audioPlayer.paused) { audioPlayer.play().catch(() => { }); }
            else { audioPlayer.pause(); }
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // SECTION 8 — Now Playing card
    // ────────────────────────────────────────────────────────────────────────
    function renderNowPlaying(songs, ci) {
        if (ci < 0 || ci >= songs.length) { activeContainer.innerHTML = ''; return; }
        const cur = songs[ci];
        const cover = getCurrentAlbumCover();
        const isPlaying = audioPlayer ? !audioPlayer.paused : false;
        const favd = isFavourite(cur.id);

        activeContainer.innerHTML = `
            <div class="bz-q-item bz-now-card" style="cursor:default;">
                <img class="bz-q-img" src="${sanitizeHTML(cover)}"
                     onerror="this.style.background='rgba(255,255,255,0.06)'">
                <div class="bz-q-info">
                    <span class="bz-q-title">${sanitizeHTML(cur.title)}</span>
                    <span class="bz-q-artist">${sanitizeHTML(cur.artist || 'Unknown')}</span>
                </div>
                <div class="bz-q-now-controls">
                    <button class="bz-q-action-btn bz-q-fav-btn bz-q-now-fav-btn${favd ? ' bz-q-fav-btn--active' : ''}"
                            id="bz-q-now-fav-btn"
                            title="${favd ? 'Remove from Favourites' : 'Add to Favourites'}">
                        <i class="${favd ? 'fas fa-heart' : 'far fa-heart'}"></i>
                    </button>
                    <button class="bz-q-ctrl-btn" id="bz-q-prev-btn" title="Previous">
                        <i class="fas fa-backward-step"></i>
                    </button>
                    <button class="bz-q-ctrl-btn bz-q-playpause" id="bz-q-pp-btn" title="${isPlaying ? 'Pause' : 'Play'}">
                        <i class="fas ${isPlaying ? 'fa-pause' : 'fa-play'}"></i>
                    </button>
                    <button class="bz-q-ctrl-btn" id="bz-q-next-btn" title="Next">
                        <i class="fas fa-forward-step"></i>
                    </button>
                </div>
            </div>`;

        activeContainer.querySelector('#bz-q-now-fav-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavourite(cur);
        });
        activeContainer.querySelector('#bz-q-prev-btn').addEventListener('click', () => {
            _bzPrevSong(); setTimeout(renderFullscreenQueue, 80);
        });
        activeContainer.querySelector('#bz-q-pp-btn').addEventListener('click', () => {
            _bzTogglePlay(); setTimeout(renderFullscreenQueue, 80);
        });
        activeContainer.querySelector('#bz-q-next-btn').addEventListener('click', () => {
            _bzNextSong(); setTimeout(renderFullscreenQueue, 80);
        });
    }

    // ── Favourite Toast — delegate to script.js globals ─────────────────────
    function isFavourite(songId) { return window.bzIsFavourite ? window.bzIsFavourite(songId) : false; }
    function toggleFavourite(song) { if (window.bzToggleFavourite) window.bzToggleFavourite(song); renderFullscreenQueue(); }

    // ────────────────────────────────────────────────────────────────────────
    // SECTION 9 — Build one queue row element
    // ────────────────────────────────────────────────────────────────────────
    function buildQueueRow(song, realIdx, isAutoMix) {
        const cover = getCoverForSong(song);
        const row = document.createElement('div');
        row.className = 'bz-q-item draggable' + (isAutoMix ? ' bz-q-item--automix' : '');
        row.draggable = true;
        row.dataset.idx = realIdx;
        if (isAutoMix) row.dataset.automix = 'true';

        const favd = isFavourite(song.id);

        row.innerHTML = `
            <div class="bz-q-drag" title="Drag to reorder"><i class="fas fa-grip-lines"></i></div>
            <div class="bz-q-img-wrap">
                <img class="bz-q-img" src="${sanitizeHTML(cover)}"
                     onerror="this.style.background='rgba(255,255,255,0.06)'">
            </div>
            <div class="bz-q-info">
                <span class="bz-q-title">${sanitizeHTML(song.title)}</span>
                <span class="bz-q-artist">${sanitizeHTML(song.artist || 'Unknown')}</span>
            </div>
            <div class="bz-q-actions">
                <span class="bz-q-dur">${formatDuration(song.duration)}</span>
                <button class="bz-q-action-btn bz-q-menu-btn" data-action="menu" title="More options">
                    <i class="fas fa-ellipsis-vertical"></i>
                </button>
                <div class="bz-q-menu" draggable="false">
                    <button class="bz-q-menu-item" data-action="favourite">
                        <i class="${favd ? 'fas fa-heart' : 'far fa-heart'}"></i>
                        <span>${favd ? 'Remove from Favourites' : 'Add to Favourites'}</span>
                    </button>
                    <button class="bz-q-menu-item" data-action="play">
                        <i class="fas fa-play"></i>
                        <span>Play now</span>
                    </button>
                    <button class="bz-q-menu-item danger" data-action="remove">
                        <i class="fas fa-xmark"></i>
                        <span>Remove from queue</span>
                    </button>
                </div>
            </div>`;

        // Click row → play
        row.addEventListener('click', (e) => {
            if (e.target.closest('.bz-q-actions') || e.target.closest('.bz-q-drag')) return;
            jumpToSong(realIdx);
        });

        const menuBtn = row.querySelector('[data-action="menu"]');
        const menu = row.querySelector('.bz-q-menu');

        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = menu.classList.contains('open');
            document.querySelectorAll('.bz-q-menu.open').forEach(m => m.classList.remove('open'));
            menu.classList.toggle('open', !isOpen);
        });

        document.addEventListener('click', () => menu.classList.remove('open'));

        row.querySelector('[data-action="favourite"]').addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.remove('open');
            toggleFavourite(song);
        });

        row.querySelector('[data-action="play"]').addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.remove('open');
            jumpToSong(realIdx);
        });

        row.querySelector('[data-action="remove"]').addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.remove('open');
            row.style.transition = 'opacity 0.18s, transform 0.18s';
            row.style.opacity = '0';
            row.style.transform = 'translateX(18px)';
            setTimeout(() => removeSongAt(parseInt(row.dataset.idx)), 190);
        });

        row.addEventListener('touchstart', () => row.classList.add('touch-active'), { passive: true });
        row.addEventListener('touchend', () => setTimeout(() => row.classList.remove('touch-active'), 2200), { passive: true });

        // Drag & Drop — custom ghost shows full details; RAF-throttled dragover for fast drags
        let _rafDragPending = false;

        row.addEventListener('dragstart', (e) => {
            dragSrcIndex = realIdx;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(realIdx)); // required for Firefox

            // Attach overlay-level dragover so auto-scroll works even when
            // the cursor moves over padding/gaps between rows or exits the list.
            overlay.addEventListener('dragover', _onOverlayDragOver);
            overlay.addEventListener('dragend', _onOverlayDragEnd);
            overlay.addEventListener('drop', _onOverlayDragEnd);

            // Build a custom ghost so title + artist are never clipped
            const ghost = document.createElement('div');
            ghost.style.cssText = [
                'position:fixed',
                'top:-9999px',
                'left:-9999px',
                `width:${Math.min(row.offsetWidth, 420)}px`,
                'display:flex',
                'align-items:center',
                'padding:10px 14px 10px 10px',
                'gap:14px',
                'background:rgba(15,12,32,0.96)',
                'border:1.5px solid rgba(124,58,237,0.60)',
                'border-radius:14px',
                'box-shadow:0 8px 32px rgba(0,0,0,0.65)',
                'pointer-events:none',
                'z-index:99999',
                'box-sizing:border-box',
            ].join(';');

            // Thumbnail
            const img = document.createElement('img');
            img.src = cover;
            img.style.cssText = 'width:46px;height:46px;min-width:46px;border-radius:8px;object-fit:cover;flex-shrink:0;';
            img.onerror = () => { img.style.background = 'rgba(255,255,255,0.08)'; img.removeAttribute('src'); };
            ghost.appendChild(img);

            // Text block — no overflow clipping
            const info = document.createElement('div');
            info.style.cssText = 'display:flex;flex-direction:column;gap:4px;min-width:0;flex:1;overflow:hidden;';

            const titleEl = document.createElement('span');
            titleEl.textContent = song.title || '';
            titleEl.style.cssText = 'font-weight:700;font-size:0.90rem;color:#f1f0ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;';

            const artistEl = document.createElement('span');
            artistEl.textContent = song.artist || 'Unknown';
            artistEl.style.cssText = 'font-size:0.78rem;color:rgba(255,255,255,0.55);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;';

            info.appendChild(titleEl);
            info.appendChild(artistEl);
            ghost.appendChild(info);

            document.body.appendChild(ghost);
            // Offset so cursor is near the thumb, not at the corner
            e.dataTransfer.setDragImage(ghost, 26, ghost.offsetHeight / 2);
            // Remove ghost after browser captures the image (next frame)
            requestAnimationFrame(() => {
                if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
            });

            // Mark source row as placeholder AFTER browser snapshots ghost
            requestAnimationFrame(() => row.classList.add('dragging'));
        });

        row.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (_rafDragPending) return; // skip if a frame is already queued
            _rafDragPending = true;
            requestAnimationFrame(() => {
                _rafDragPending = false;
                if (dragOverIndex !== realIdx) {
                    dragOverIndex = realIdx;
                    queueList.querySelectorAll('.bz-q-item').forEach(el => el.classList.remove('drag-target'));
                    row.classList.add('drag-target');
                }
            });
        });

        row.addEventListener('dragleave', (e) => {
            // Only remove if we actually left this row (not a child element)
            if (!row.contains(e.relatedTarget)) {
                row.classList.remove('drag-target');
            }
        });

        row.addEventListener('drop', (e) => {
            e.preventDefault();
            _rafDragPending = false;
            _stopAutoScroll();

            // Clear all visual drag states immediately so nothing looks stuck
            queueList.querySelectorAll('.bz-q-item').forEach(el =>
                el.classList.remove('drag-target', 'dragging', 'drag-over')
            );

            if (dragSrcIndex !== null && dragSrcIndex !== realIdx) {
                const arr = window.playingAlbum.songs;
                // Capture the playing song ID BEFORE splice so we can re-find it after
                const playingSongId = String(arr[window.currentSongIndex ?? -1]?.id ?? '');
                const [moved] = arr.splice(dragSrcIndex, 1);
                const target = dragSrcIndex < realIdx ? realIdx - 1 : realIdx;
                arr.splice(target, 0, moved);
                // Recalculate currentSongIndex — index shifts after splice, ID stays stable
                if (playingSongId) {
                    const newIdx = arr.findIndex(s => String(s.id) === playingSongId);
                    if (newIdx >= 0) window.currentSongIndex = newIdx;
                }
                // Keep automix boundary accurate after drag
                const bnd = getAutoMixBoundary();
                if (bnd > 0) {
                    const src = dragSrcIndex, dst = target;
                    // Dragged from user → automix section
                    if (src < bnd && dst >= bnd) setAutoMixBoundary(bnd - 1);
                    // Dragged from automix → user section
                    else if (src >= bnd && dst < bnd) setAutoMixBoundary(bnd + 1);
                }

                // Smooth settle: fade list out → rebuild → fade back in.
                // Two nested RAFs ensure the browser paints the cleared drag
                // states BEFORE we wipe and rebuild the DOM, eliminating the
                // hang/flash that happens when splice + innerHTML reset fire in
                // the same frame as the drop event.
                queueList.style.transition = 'opacity 0.13s ease';
                queueList.style.opacity = '0';
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        renderFullscreenQueue();
                        requestAnimationFrame(() => {
                            queueList.style.opacity = '1';
                            setTimeout(() => { queueList.style.transition = ''; }, 160);
                        });
                    });
                });
            }

            dragSrcIndex = null; dragOverIndex = null;
        });

        row.addEventListener('dragend', () => {
            _rafDragPending = false;
            _stopAutoScroll();
            dragSrcIndex = null; dragOverIndex = null;
            // Clean up visual states; if drop already rebuilt the DOM these
            // querySelectorAll calls simply return empty NodeLists — safe.
            queueList.querySelectorAll('.bz-q-item').forEach(el =>
                el.classList.remove('dragging', 'drag-target', 'drag-over')
            );
            // Always restore visibility — covers cancelled drags (Escape /
            // dropping outside the list) where the fade-out may have fired
            // but drop never completed.
            queueList.style.opacity = '1';
            queueList.style.transition = '';
        });

        return row;
    }

    // ────────────────────────────────────────────────────────────────────────
    // SECTION 10 — Render Up Next list (with Auto-Mix divider)
    // ────────────────────────────────────────────────────────────────────────
    function renderUpNext(songs, ci) {
        queueList.innerHTML = '';

        const upNext = songs.slice(ci + 1);
        const automixOn = localStorage.getItem('beatzen_automix') === 'true';

        if (upNext.length === 0 && !automixOn) {
            emptyState.style.display = 'none';
            queueBody.style.opacity = '1';

            // ── End of Queue card — invite user to start Auto-Mix ──
            const eoqCard = document.createElement('div');
            eoqCard.className = 'bz-end-of-queue-card';
            eoqCard.innerHTML = `
                <div class="bz-eoq-icon-wrap">
                    <i class="fas fa-music bz-eoq-icon"></i>
                    <div class="bz-eoq-icon-ring"></div>
                </div>
                <div class="bz-eoq-text-group">
                    <div class="bz-eoq-title">That's the end of the queue</div>
                    <div class="bz-eoq-sub">Let Auto-Mix keep the music going with songs matched to your taste</div>
                </div>
                <button class="bz-eoq-btn" id="bz-eoq-start-automix">
                    <i class="fas fa-wand-magic-sparkles"></i>Start Auto-Mix
                </button>`;
            queueList.appendChild(eoqCard);

            document.getElementById('bz-eoq-start-automix')?.addEventListener('click', () => {
                const toggle = document.getElementById('automix-toggle');
                if (toggle && !toggle.checked) {
                    toggle.checked = true;
                    toggle.dispatchEvent(new Event('change'));
                } else if (typeof window.bzTriggerAutoMix === 'function') {
                    window.bzTriggerAutoMix();
                }
                renderFullscreenQueue();
            });
            return;
        }
        emptyState.style.display = 'none';
        queueBody.style.opacity = '1';

        // ── Shuffle-active notice: explains why order looks different ─────────
        // Only shown when there are actually upcoming songs so it's contextual.
        if (window.isShuffling && upNext.length > 0) {
            const shuffleNote = document.createElement('div');
            shuffleNote.className = 'bz-shuffle-notice';
            shuffleNote.innerHTML = `
                <i class="fas fa-shuffle bz-shuffle-notice-icon"></i>
                <span>Shuffle is on — songs are playing in random order</span>`;
            queueList.appendChild(shuffleNote);
        }

        const bnd = getAutoMixBoundary(); // absolute index in songs[]

        upNext.forEach((song, idx) => {
            const realIdx = ci + 1 + idx;
            const isAutoMix = automixOn && bnd > 0 && realIdx >= bnd;

            // ── Insert the "Auto-Mix" divider exactly once at the boundary ──
            if (automixOn && bnd > 0 && realIdx === bnd) {
                const divider = document.createElement('div');
                divider.className = 'bz-automix-divider';
                divider.innerHTML = `
                    <div class="bz-automix-divider-line"></div>
                    <div class="bz-automix-divider-label">
                        <i class="fas fa-wand-magic-sparkles"></i>
                        Auto-Mix
                    </div>
                    <div class="bz-automix-divider-line"></div>`;
                queueList.appendChild(divider);
            }

            queueList.appendChild(buildQueueRow(song, realIdx, isAutoMix));
        });

        // If automix is ON but boundary not set yet, show a hint
        if (automixOn && bnd <= 0 && upNext.length === 0) {
            const hint = document.createElement('div');
            hint.className = 'bz-upnext-empty';
            hint.innerHTML = `<i class="fas fa-wand-magic-sparkles" style="margin-right:6px;color:#2575fc;"></i>Auto-Mix will fill your queue shortly…`;
            queueList.appendChild(hint);
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // SECTION 10b — Header AutoMix toggle (injected once into title-group)
    // ────────────────────────────────────────────────────────────────────────
    function ensureHeaderAutoMixToggle() {
        if (document.getElementById('bz-header-automix-wrap')) return;

        const titleGroup = document.querySelector('.bz-queue-title-group');
        if (!titleGroup) return;

        // Title-group: heading only — no inline 3-dot; menu now lives in actions bar
        titleGroup.style.display = '';
        titleGroup.style.alignItems = '';
        titleGroup.style.gap = '';
        titleGroup.style.position = '';

        // Wire the Back button (replaces close button in top-right)
        const backBtn = document.getElementById('bz-queue-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => closeQueue());
        }

        // ── Shuffle toggle pill ───────────────────────────────────────────────
        const shuffleWrap = document.createElement('div');
        shuffleWrap.id = 'bz-header-shuffle-wrap';
        shuffleWrap.className = 'bz-header-shuffle-wrap';
        shuffleWrap.innerHTML = `
            <span class="bz-header-shuf-label">
                <i class="fas fa-shuffle"></i>Shuffle
            </span>
            <label class="bz-header-shuffle-toggle" title="Toggle Shuffle">
                <input type="checkbox" id="bz-header-shuffle-toggle">
                <span class="bz-header-shuf-slider"></span>
            </label>`;

        // ── Auto-Mix toggle pill ──────────────────────────────────────────────
        const wrap = document.createElement('div');
        wrap.id = 'bz-header-automix-wrap';
        wrap.className = 'bz-header-automix-wrap';
        wrap.innerHTML = `
            <span class="bz-header-am-label">
                <i class="fas fa-wand-magic-sparkles"></i>Auto-Mix
            </span>
            <label class="bz-header-automix-toggle" title="Toggle Auto-Mix">
                <input type="checkbox" id="bz-header-automix-toggle">
                <span class="bz-header-am-slider"></span>
            </label>`;

        // ── 3-dot menu button + dropdown, placed in the actions bar (top-right) ──
        const actionsBar = document.querySelector('.bz-queue-actions');

        const menuBtn = document.createElement('button');
        menuBtn.id = 'bz-queue-menu-btn';
        menuBtn.className = 'bz-queue-menu-btn';
        menuBtn.title = 'Queue options';
        menuBtn.innerHTML = '<i class="fas fa-ellipsis-vertical"></i>';

        const menu = document.createElement('div');
        menu.id = 'bz-queue-menu';
        menu.className = 'bz-queue-menu bz-queue-menu--right';

        // Pull the existing Save / Clear buttons into the dropdown
        const saveBtn = document.getElementById('bz-queue-save');
        const clearBtn = document.getElementById('bz-queue-clear');

        menu.appendChild(shuffleWrap);
        menu.appendChild(wrap);
        if (saveBtn) menu.appendChild(saveBtn);
        if (clearBtn) menu.appendChild(clearBtn);

        // Wrap menuBtn + menu together; menuWrap no longer needs position:relative
        // because the menu is now position:fixed (positioned by JS on open).
        const menuWrap = document.createElement('div');
        menuWrap.id = 'bz-queue-menu-wrap';
        menuWrap.style.cssText = 'display:flex;align-items:center;';
        menuWrap.appendChild(menuBtn);
        // Append menu directly to body so it's never clipped by any ancestor's
        // overflow:hidden (including .bz-queue-overlay). JS positions it via
        // getBoundingClientRect relative to the viewport on every open.
        document.body.appendChild(menu);

        if (actionsBar) {
            actionsBar.appendChild(menuWrap);
        }

        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = menu.classList.contains('open');
            if (!isOpen) {
                // Position the fixed menu flush with the right edge of the button,
                // below it — recalculated fresh each time in case of scroll/resize.
                const rect = menuBtn.getBoundingClientRect();
                menu.style.top = (rect.bottom + 8) + 'px';
                menu.style.right = (window.innerWidth - rect.right) + 'px';
                menu.style.left = 'auto';
            }
            menu.classList.toggle('open');
        });
        document.addEventListener('click', (e) => {
            if (!menu.contains(e.target) && e.target !== menuBtn) {
                menu.classList.remove('open');
            }
        });
        // Keep the menu open after interacting with the toggles inside it
        [shuffleWrap, wrap].forEach(el => el.addEventListener('click', (e) => e.stopPropagation()));

        // "Now Playing" label and the "Song X of Y" stats badge:
        // same line, same pill styling, pushed to opposite ends.
        const statsEl = document.getElementById('bz-queue-stats');
        const nowPlayingLabel = document.querySelector('.bz-now-playing .bz-label');
        if (statsEl && nowPlayingLabel) {
            let headerRow = document.getElementById('bz-now-playing-header');
            if (!headerRow) {
                headerRow = document.createElement('div');
                headerRow.id = 'bz-now-playing-header';
                headerRow.className = 'bz-now-playing-header';
                nowPlayingLabel.before(headerRow);
                headerRow.appendChild(nowPlayingLabel);
            }
            nowPlayingLabel.classList.add('bz-queue-pos-badge', 'bz-now-playing-badge');
            statsEl.classList.add('bz-queue-pos-badge');
            headerRow.appendChild(statsEl);
        }


        // ── Wire Shuffle toggle ───────────────────────────────────────────────
        const shuffleToggleEl = document.getElementById('bz-header-shuffle-toggle');
        if (shuffleToggleEl) {
            shuffleToggleEl.checked = !!window.isShuffling;
            shuffleToggleEl.addEventListener('change', () => {
                // Delegate to the existing toggleShuffle() so all logic runs
                if (typeof window.toggleShuffle === 'function') {
                    window.toggleShuffle();
                } else {
                    // Fallback: mirror the shuffle btn click
                    const sBtn = document.getElementById('shuffle-btn');
                    if (sBtn) sBtn.click();
                }
                // Re-sync the checkbox to the true state after toggleShuffle runs
                setTimeout(() => {
                    shuffleToggleEl.checked = !!window.isShuffling;
                    syncHeaderShuffleToggle();
                }, 50);
            });
        }

        // ── Wire Auto-Mix toggle ──────────────────────────────────────────────
        const toggleEl = document.getElementById('bz-header-automix-toggle');
        if (!toggleEl) return;

        // Set initial state from storage
        toggleEl.checked = localStorage.getItem('beatzen_automix') === 'true';

        toggleEl.addEventListener('change', () => {
            const isOn = toggleEl.checked;
            localStorage.setItem('beatzen_automix', String(isOn));

            // Sync the settings-page toggle (no re-dispatch to avoid loop)
            const settingsToggle = document.getElementById('automix-toggle');
            if (settingsToggle && settingsToggle.checked !== isOn) {
                settingsToggle.checked = isOn;
            }

            if (isOn) {
                // Every toggle-on = fresh new mix (clear session used IDs)
                _amUsedIds.clear();
                clearAutoMixBoundary();
                if (typeof window.bzTriggerAutoMix === 'function') {
                    window.bzTriggerAutoMix();
                }
                if (typeof window.showToast === 'function') {
                    window.showToast('Auto Mix enabled — queue will fill with your top songs');
                }
            } else {
                // OFF: stop engine + remove all AutoMix songs from queue immediately
                stopAutoMixTimer();
                removeAutoMixSongsFromQueue();
                if (typeof window.showToast === 'function') {
                    window.showToast('Auto Mix disabled');
                }
            }
            renderFullscreenQueue();
        });
    }

    function syncHeaderShuffleToggle() {
        const el = document.getElementById('bz-header-shuffle-toggle');
        if (!el) return;
        el.checked = !!window.isShuffling;
        const wrap = document.getElementById('bz-header-shuffle-wrap');
        if (wrap) wrap.classList.toggle('bz-header-shuffle-wrap--active', !!window.isShuffling);
    }

    function syncHeaderAutoMixToggle() {
        const el = document.getElementById('bz-header-automix-toggle');
        if (el) el.checked = localStorage.getItem('beatzen_automix') === 'true';
    }

    // ────────────────────────────────────────────────────────────────────────
    // SECTION 11 — Main render
    // ────────────────────────────────────────────────────────────────────────
    function renderFullscreenQueue() {
        const songs = window.playingAlbum?.songs || [];
        const ci = window.currentSongIndex ?? -1;
        const automixOn = localStorage.getItem('beatzen_automix') === 'true';
        const bnd = getAutoMixBoundary();

        // Ensure header toggle is present and synced every render
        ensureHeaderAutoMixToggle();
        syncHeaderAutoMixToggle();
        syncHeaderShuffleToggle();

        // ── Stats bar: "Song X of Y" — shuffle state shown via toggle pill ──
        const currentPosition = ci >= 0 ? ci + 1 : 0;
        // Only count non-AutoMix songs in the position denominator
        const regularSongsCount = (bnd > 0) ? bnd : songs.length;

        // True when the currently-playing song is an auto-mix injected song
        const isPlayingAutoMixSong = bnd > 0 && ci >= bnd;

        let statsHtml = '';
        if (currentPosition > 0 && songs.length > 0 && !isPlayingAutoMixSong) {
            statsHtml = `<span class="bz-queue-pos-badge">Song <strong>${currentPosition}</strong> <span class="bz-q-pos-sep">of</span> <strong>${regularSongsCount}</strong></span>`;
        } else if (songs.length > 0 && !isPlayingAutoMixSong) {
            statsHtml = `<span class="bz-queue-pos-badge">${regularSongsCount} song${regularSongsCount !== 1 ? 's' : ''}</span>`;
        }

        queueStats.style.display = '';
        queueStats.innerHTML = statsHtml;

        // ── Now Playing + Up Next always visible regardless of AutoMix state ──
        const nowPlayingSection = document.querySelector('.bz-now-playing');
        const queueBodySection = document.querySelector('.bz-queue-body');
        if (nowPlayingSection) nowPlayingSection.style.display = '';
        if (queueBodySection) queueBodySection.style.display = '';

        renderNowPlaying(songs, ci);
        renderUpNext(songs, ci);
    }

    // ────────────────────────────────────────────────────────────────────────
    // SECTION 12 — Hook playSong for live queue updates
    // ────────────────────────────────────────────────────────────────────────
    let _playSongPatched = false;
    function patchPlaySong() {
        if (_playSongPatched || !window.playSong) return;
        const original = window.playSong;
        window.playSong = async function (...args) {
            const result = await original.apply(this, args);
            if (overlay.classList.contains('active')) {
                setTimeout(renderFullscreenQueue, 70);
            }
            return result;
        };
        _playSongPatched = true;
    }
    // FIX Issues 3 & 7: patch immediately at parse time so that the restore
    // path (restoreMobileSession → _tryRestoreSession → playSong(idx, false))
    // — which can fire before DOMContentLoaded resolves — always gets the
    // patched version that triggers renderFullscreenQueue.
    // The 400ms / 1400ms retries remain as belt-and-suspenders for unusual
    // load orders, but the immediate call is now the primary path.
    patchPlaySong();
    // Retry after brief delays in case script.js hasn't defined playSong yet
    // when beatzen-pro.js first parses (unusual but possible on slow devices).
    setTimeout(patchPlaySong, 50);
    setTimeout(patchPlaySong, 400);
    setTimeout(patchPlaySong, 1400);

    // ── POST-RESTORE: highlight + queue ─────────────────────────────────────
    // playSong(idx, false) fires inside startApp() → requestAnimationFrame,
    // which runs before this DOMContentLoaded handler can patch window.playSong.
    // We poll until window.playingAlbum is populated (restore complete), then:
    //   1. Restore the extended queue order (auto-mix, reordered, added songs)
    //   2. Set _highlightActive so album views correctly show the active row
    (function ensureRestoredHighlight() {
        const deadline = Date.now() + 9000;
        function check() {
            if (window.playingAlbum && window.currentSongIndex >= 0) {
                restoreQueueState();           // rebuild extended queue from localStorage
                if (!window._highlightActive) {
                    window._highlightActive = true;
                    if (typeof window.updateActiveSongHighlight === 'function') {
                        window.updateActiveSongHighlight();
                    }
                }
                return;
            }
            if (Date.now() < deadline) setTimeout(check, 350);
        }
        setTimeout(check, 350);
    }());

    // Save queue right before the page unloads (covers manual refresh / tab close)
    window.addEventListener('beforeunload', saveQueueState);

    // Also save position on pause and every 10 s while playing so a crash / forced
    // close (mobile tab killed) still restores close to where the user left off.
    if (audioPlayer) {
        audioPlayer.addEventListener('pause', saveQueueState);
        let _autoSaveTimer = null;
        audioPlayer.addEventListener('play', () => {
            clearInterval(_autoSaveTimer);
            _autoSaveTimer = setInterval(saveQueueState, 10000);
        });
        audioPlayer.addEventListener('pause', () => clearInterval(_autoSaveTimer));
        audioPlayer.addEventListener('ended', () => clearInterval(_autoSaveTimer));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ADAPTIVE IMAGE LAZY LOADING
    // Enhances every <img loading="lazy"> in the app with IntersectionObserver:
    //   • Replaces src with a 1-px transparent placeholder immediately
    //   • Pre-loads the real image off-screen via a hidden Image() object
    //   • Swaps src + applies fade-in only when the img enters the viewport
    //   • MutationObserver intercepts new images added by any part of the app
    //     — no changes to script.js or any other file required
    // ══════════════════════════════════════════════════════════════════════════
    const BZ_PLACEHOLDER =
        'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 ' +
        'width=%221%22 height=%221%22%3E%3C/svg%3E';

    const _imgObserver = ('IntersectionObserver' in window)
        ? new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const img = entry.target;
                const realSrc = img.dataset.bzLazySrc;
                if (!realSrc) { obs.unobserve(img); return; }

                // Pre-load in background, then swap to avoid layout jump
                const loader = new Image();
                loader.onload = () => {
                    img.src = realSrc;
                    img.removeAttribute('data-bz-lazy-src');
                    img.classList.add('bz-lazy-loaded');
                };
                loader.onerror = () => {
                    // Keep placeholder on error — don't break layout
                    img.removeAttribute('data-bz-lazy-src');
                    img.classList.add('bz-lazy-error');
                };
                loader.src = realSrc;
                obs.unobserve(img);
            });
        }, { rootMargin: '300px 0px', threshold: 0.01 })
        : null;

    function upgradeLazyImg(img) {
        if (!_imgObserver) return;               // no IntersectionObserver support → native loading="lazy" takes over
        if (img.dataset.bzLazySrc) return;       // already upgraded
        if (!img.src || img.src === BZ_PLACEHOLDER) return;
        if (img.complete && img.naturalWidth > 0) return; // already loaded

        img.dataset.bzLazySrc = img.src;
        img.src = BZ_PLACEHOLDER;
        _imgObserver.observe(img);
    }

    // Watch for any new img[loading="lazy"] added anywhere in the DOM
    new MutationObserver(mutations => {
        mutations.forEach(m => {
            m.addedNodes.forEach(node => {
                if (node.nodeType !== 1) return;
                if (node.tagName === 'IMG' && node.getAttribute('loading') === 'lazy') {
                    upgradeLazyImg(node);
                }
                node.querySelectorAll?.('img[loading="lazy"]').forEach(upgradeLazyImg);
            });
        });
    }).observe(document.body || document.documentElement, { childList: true, subtree: true });

    // Also upgrade any already-present images on first load
    document.querySelectorAll('img[loading="lazy"]').forEach(upgradeLazyImg);

    // Audio events — sync play/pause icon in queue
    if (audioPlayer) {
        ['play', 'pause'].forEach(evt =>
            audioPlayer.addEventListener(evt, () => {
                if (overlay.classList.contains('active')) {
                    const songs = window.playingAlbum?.songs || [];
                    const ci = window.currentSongIndex ?? -1;
                    renderNowPlaying(songs, ci);
                }
            })
        );
    }

    // NOTE: "Add to Favourites" modal wiring is handled entirely in script.js.
    //       beatzen-pro.js delegates to window.bzToggleFavourite / window.bzIsFavourite.

    // SECTION 13 — Event listeners
    // ────────────────────────────────────────────────────────────────────────
    openBtn?.addEventListener('click', openQueue);
    openBtnMini?.addEventListener('click', openQueue);
    /* FIX: touchend shortcut for #bz-queue-open-btn so it opens instantly on
       mobile — mirrors the same pattern already in place for #timer-btn.
       Without this the button relies on the browser's synthesized click event
       which fires ~50-100 ms after touchend even with touch-action:manipulation.
       Guard: skip when non-cancelable (scroll in progress) or Y travel > 8 px
       so we never trigger the "[Intervention] Ignored attempt to cancel" error. */
    if (openBtn && !openBtn._bzTouchWired) {
        openBtn._bzTouchWired = true;
        let _queueTouchStartY = 0;
        openBtn.addEventListener('touchstart', (e) => {
            _queueTouchStartY = e.touches[0].clientY;
        }, { passive: true });
        openBtn.addEventListener('touchend', (e) => {
            if (!e.cancelable) return;
            if (Math.abs(e.changedTouches[0].clientY - _queueTouchStartY) > 8) return;
            e.preventDefault();
            e.stopPropagation();
            openQueue();
        }, { passive: false });
    }
    if (openBtnMini && !openBtnMini._bzTouchWired) {
        openBtnMini._bzTouchWired = true;
        let _queueMiniTouchStartY = 0;
        openBtnMini.addEventListener('touchstart', (e) => {
            _queueMiniTouchStartY = e.touches[0].clientY;
        }, { passive: true });
        openBtnMini.addEventListener('touchend', (e) => {
            if (!e.cancelable) return;
            if (Math.abs(e.changedTouches[0].clientY - _queueMiniTouchStartY) > 8) return;
            e.preventDefault();
            e.stopPropagation();
            openQueue();
        }, { passive: false });
    }
    closeBtn?.addEventListener('click', closeQueue);
    clearBtn?.addEventListener('click', showClearConfirm);

    // ── Save Queue as Playlist ──
    const saveQueueBtn = document.getElementById('bz-queue-save');
    if (saveQueueBtn) {
        saveQueueBtn.addEventListener('click', () => {
            const songs = window.playingAlbum?.songs || [];
            if (!songs.length) {
                window.bzAlert('info', 'Queue is Empty', 'Add some songs to the queue first.');
                return;
            }
            window.bzInput('playlist', 'Save Queue as Playlist', 'Enter playlist name…', (name) => {
                if (!name) return;
                // Build playlist using the correct format — player reads song.url not song.src
                const id = 'user-' + Date.now();
                const playlist = {
                    id,
                    name,
                    title: name,
                    albumCover: 'https://res.cloudinary.com/beatzenapp/image/upload/v1782654641/Logo_kmpfjf.jpg',
                    songs: songs.map(s => ({
                        id: s.id,
                        title: s.title,
                        artist: s.artist,
                        url: s.url,  // FIX: was src — audioPlayer reads song.url to set src
                        imageUrl: s._sourceAlbum?.imageUrl || s.album?.imageUrl || '',
                        duration: s.duration || ''
                    })),
                    type: 'Playlist',
                    isImported: true,
                    createdAt: Date.now()
                };
                // Save to the correct key — beatZen_importedPlaylists is what the app reads
                try {
                    const raw = localStorage.getItem('beatZen_importedPlaylists');
                    const list = raw ? JSON.parse(raw) : [];
                    list.push(playlist);
                    localStorage.setItem('beatZen_importedPlaylists', JSON.stringify(list));
                    // Inject into masterPool immediately so no page reload is needed
                    if (!window.masterPool.some(m => String(m.id) === String(playlist.id))) {
                        window.masterPool.push(playlist);
                    }
                    // Rebuild the live song map and re-render Playlists tab
                    if (typeof window.rebuildMasterMap === 'function') window.rebuildMasterMap();
                    if (typeof window.syncPlaylistData === 'function') window.syncPlaylistData();
                } catch (err) {
                    window.bzAlert('danger', 'Save Failed', 'Could not save the playlist. Please try again.');
                    return;
                }
                window.bzAlert('success', 'Playlist Saved!', `"​${name}" was saved with ${songs.length} song${songs.length !== 1 ? 's' : ''}.`);
            });
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('active')) {
            e.preventDefault(); // prevent browser back on Escape
            closeQueue();
        }
    });
    overlay?.addEventListener('click', (e) => { if (e.target === overlay) closeQueue(); });

    // Intercept popstate: if the queue is open (or we just pushed the queue state),
    // close it and consume the event — never let the app's popstate handler fire.
    window.addEventListener('popstate', (e) => {
        // FIX Issue 17: when closeQueue() called history.back() we get a synthetic
        // popstate for the entry we pushed in openQueue. Always stopImmediatePropagation
        // in this branch so script.js's window.onpopstate (bubble phase) never fires —
        // previously the flag was only checked but the event was not stopped, leaving a
        // race window on slow/Android Chrome where onpopstate still ran.
        if (_closingFromPopstate) {
            _closingFromPopstate = false;
            e.stopImmediatePropagation();
            return;
        }
        if (overlay.classList.contains('active')) {
            e.stopImmediatePropagation();
            closeQueue(true); // fromPopstate=true — don't call history.back() again
            return;
        }
    }, true); // capture phase — runs BEFORE script.js window.onpopstate

    // ────────────────────────────────────────────────────────────────────────
    // LYRICS PANEL — Back gesture / browser-back support
    // Mirrors the same history.pushState pattern used by the queue overlay so
    // that swiping back (or pressing the Android back button) closes the lyrics
    // panel instead of navigating away from the current page.
    // ────────────────────────────────────────────────────────────────────────
    (function bzLyricsBackGesture() {
        const LYR_ID = 'bz-lyr-overlay';
        const LYR_OPEN_CLASS = 'bz-lyr-in';
        let _lyrHistoryPushed = false;
        let _lyrClosingFromPopstate = false;

        /** Close the lyrics overlay the same way the close button does */
        function closeLyricsOverlay(fromPopstate) {
            const el = document.getElementById(LYR_ID);
            if (!el) return;
            // Mirror what script.js does: remove bz-lyr-in, add bz-lyr-exit
            el.classList.remove(LYR_OPEN_CLASS);
            el.classList.add('bz-lyr-exit');
            // Also click the close button if present so script.js can run its cleanup
            const closeBtn = el.querySelector('.bz-lyr-close');
            if (closeBtn) closeBtn.click();
            if (!fromPopstate && _lyrHistoryPushed) {
                _lyrHistoryPushed = false;
                _lyrClosingFromPopstate = true;
                history.back();
            } else {
                _lyrHistoryPushed = false;
            }
        }

        /** Returns true if the lyrics overlay is currently visible */
        function isLyricsOpen() {
            const el = document.getElementById(LYR_ID);
            return !!(el && el.classList.contains(LYR_OPEN_CLASS));
        }

        // Watch for bz-lyr-in being added/removed on #bz-lyr-overlay
        const lyrObserver = new MutationObserver(() => {
            if (isLyricsOpen() && !_lyrHistoryPushed) {
                // Overlay just opened — push a history entry to capture back gesture
                _lyrHistoryPushed = true;
                history.pushState({ bzLyrics: true }, '', window.location.href);
            } else if (!isLyricsOpen() && _lyrHistoryPushed) {
                // Overlay was closed by close button (not popstate) — pop our entry
                _lyrHistoryPushed = false;
                _lyrClosingFromPopstate = true;
                history.back();
            }
        });

        function attachLyrObserver() {
            const el = document.getElementById(LYR_ID);
            if (el) {
                lyrObserver.observe(el, { attributes: true, attributeFilter: ['class'] });
            } else {
                // Overlay not in DOM yet — watch body until it is injected by script.js
                const bodyObserver = new MutationObserver(() => {
                    const injected = document.getElementById(LYR_ID);
                    if (injected) {
                        bodyObserver.disconnect();
                        lyrObserver.observe(injected, { attributes: true, attributeFilter: ['class'] });
                    }
                });
                bodyObserver.observe(document.body || document.documentElement,
                    { childList: true, subtree: true });
            }
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', attachLyrObserver);
        } else {
            attachLyrObserver();
        }

        // Intercept popstate in capture phase — runs before script.js's own handler
        window.addEventListener('popstate', (e) => {
            // Synthetic popstate fired by our own history.back() call — consume silently
            if (_lyrClosingFromPopstate) {
                _lyrClosingFromPopstate = false;
                e.stopImmediatePropagation();
                return;
            }
            // Real back gesture / button while lyrics are open — close the panel
            if (isLyricsOpen()) {
                e.stopImmediatePropagation();
                closeLyricsOverlay(true);
                return;
            }
            // Our state was pushed but the overlay is already gone — just clean up
            if (e.state && e.state.bzLyrics && _lyrHistoryPushed) {
                e.stopImmediatePropagation();
                _lyrHistoryPushed = false;
            }
        }, true); // capture phase — same priority as queue handler above
    })();

    // ────────────────────────────────────────────────────────────────────────
    // SECTION 14 — Expose globals
    // ────────────────────────────────────────────────────────────────────────
    window.renderFullscreenQueue = renderFullscreenQueue;
    window.bzOpenQueue = openQueue;
    window.bzCloseQueue = closeQueue;


    // ────────────────────────────────────────────────────────────────────────
    // AUTO-MIX LOADING INDICATOR — shown in queue list during injection
    // ────────────────────────────────────────────────────────────────────────
    let _amLoadingEl = null;

    function showAutoMixLoading() {
        // Only show if queue overlay is open; otherwise it's invisible anyway
        if (!overlay.classList.contains('active')) return;
        hideAutoMixLoading(); // remove stale instance
        _amLoadingEl = document.createElement('div');
        _amLoadingEl.id = 'bz-automix-loading';
        _amLoadingEl.className = 'bz-automix-loading';
        _amLoadingEl.innerHTML = `
            <div class="bz-aml-header">
                <div class="bz-aml-dots">
                    <span></span><span></span><span></span>
                </div>
                <span class="bz-aml-text">
                    <i class="fas fa-wand-magic-sparkles"></i>
                    Finding songs for Auto-Mix…
                </span>
            </div>
            <div class="bz-aml-skeletons">
                <div class="bz-aml-skeleton-row">
                    <div class="bz-aml-skel-thumb"></div>
                    <div class="bz-aml-skel-lines">
                        <div class="bz-aml-skel-line bz-aml-skel-title"></div>
                        <div class="bz-aml-skel-line bz-aml-skel-artist"></div>
                    </div>
                </div>
                <div class="bz-aml-skeleton-row">
                    <div class="bz-aml-skel-thumb"></div>
                    <div class="bz-aml-skel-lines">
                        <div class="bz-aml-skel-line bz-aml-skel-title" style="width:55%"></div>
                        <div class="bz-aml-skel-line bz-aml-skel-artist" style="width:38%"></div>
                    </div>
                </div>
                <div class="bz-aml-skeleton-row">
                    <div class="bz-aml-skel-thumb"></div>
                    <div class="bz-aml-skel-lines">
                        <div class="bz-aml-skel-line bz-aml-skel-title" style="width:70%"></div>
                        <div class="bz-aml-skel-line bz-aml-skel-artist" style="width:45%"></div>
                    </div>
                </div>
            </div>`;
        queueList.appendChild(_amLoadingEl);
        _amLoadingEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function hideAutoMixLoading() {
        if (_amLoadingEl) { _amLoadingEl.remove(); _amLoadingEl = null; }
        const stale = document.getElementById('bz-automix-loading');
        if (stale) stale.remove();
    }

    // ════════════════════════════════════════════════════════════════════════
    // AUTO-MIX ENGINE  —  Endless playback with history-aware scoring
    // ════════════════════════════════════════════════════════════════════════

    const AUTOMIX_CHECK_MS = 6000;        // check interval while playing
    const AUTOMIX_LOW_THRESHOLD = 8;      // refill when <8 automix songs remain ahead
    const AUTOMIX_BATCH_SIZE = 20;        // always 20 songs — initial trigger
    const AUTOMIX_REFILL_SIZE = 20;       // always 20 songs — on refill / last song
    const AUTOMIX_MAX_AHEAD = 50;         // max automix songs allowed ahead (raised so 20 always fits)

    let automixTimer = null;
    let automixInjecting = false;

    // Session-level used-song tracker — prevents repeats within a session.
    // Cleared whenever user explicitly triggers AutoMix (toggle ON) so each
    // fresh enable starts with a completely new remix.
    let _amUsedIds = new Set();
    window._bzAmUsedIds = _amUsedIds; // exposed for queue-switch reset in script.js

    function stopAutoMixTimer() {
        if (automixTimer) { clearTimeout(automixTimer); automixTimer = null; }
    }

    function scheduleAutoMixCheck() {
        stopAutoMixTimer();
        automixTimer = setTimeout(() => {
            if (localStorage.getItem('beatzen_automix') === 'true') {
                maybeRefillAutoMix();
            }
            scheduleAutoMixCheck();
        }, AUTOMIX_CHECK_MS);
    }

    // ── How many automix songs are left ahead of now ─────────────────────────
    function countAutoMixRemaining() {
        const ci = window.currentSongIndex || 0;
        const bnd = getAutoMixBoundary();
        if (bnd <= 0) return 0;
        const songs = window.playingAlbum?.songs || [];
        return Math.max(0, songs.length - Math.max(bnd, ci + 1));
    }

    // ── Decide whether to refill ─────────────────────────────────────────────
    function maybeRefillAutoMix() {
        if (!window.playingAlbum) return;
        const remaining = countAutoMixRemaining();
        // Refill whenever below threshold OR completely empty (last song played)
        if (remaining < AUTOMIX_LOW_THRESHOLD) {
            injectAutoMixSongs(AUTOMIX_REFILL_SIZE);
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // SCORING ENGINE — builds a relevance score per song using:
    //   1. How recently/often the artist was in history (+heavy)
    //   2. How recently/often the album was in history (+medium)
    //   3. Song-level views & likes (+light)
    //   4. Strong random jitter so every call returns a fresh shuffle
    //      weighted toward user taste, not the same top-N every time
    // ────────────────────────────────────────────────────────────────────────
    function buildSongScores() {
        let histList = [];
        try { histList = JSON.parse(localStorage.getItem('beatZen_history_auto') || '[]'); } catch (_) { }

        // Build frequency maps from history
        const artistFreq = {};
        const albumFreq = {};
        histList.forEach((entry, i) => {
            const decay = 1 / (1 + i * 0.08); // recent entries score higher
            const artist = (entry.artist || '').toLowerCase().trim();
            const albumId = String(entry.albumId || '');
            if (artist) artistFreq[artist] = (artistFreq[artist] || 0) + decay;
            if (albumId) albumFreq[albumId] = (albumFreq[albumId] || 0) + decay;
        });

        // Now score every song in masterPool
        const allSongs = [];
        const scores = {};

        (window.masterPool || []).forEach(album => {
            const albumId = String(album.id || '');
            const albumScore = (albumFreq[albumId] || 0) * 3
                + (album.playCount || 0) * 0.2
                + (album.views || 0) * 0.05;

            (album.songs || []).forEach(song => {
                const sId = String(song.id || '');
                const artist = (song.artist || '').toLowerCase().trim();
                const artScore = (artistFreq[artist] || 0) * 5;
                const sngScore = (song.views || 0) * 0.08 + (song.likes || 0) * 0.04;

                // Strong random jitter: 0–2.5 range ensures even low-scored songs
                // occasionally surface, making every inject call unique.
                const jitter = Math.random() * 2.5;

                scores[sId] = artScore + albumScore + sngScore + jitter;
                allSongs.push(song);
            });
        });

        return { allSongs, scores };
    }

    // ── Weighted-random pick: returns `count` songs from scored candidates ───
    // Uses reservoir sampling weighted by score so higher-scored songs are more
    // likely to appear but NOT guaranteed — avoids same-list repetition.
    function weightedPick(candidates, scores, count) {
        if (!candidates.length) return [];
        // Assign a random key = rand^(1/weight) — higher score → higher key on avg
        const keyed = candidates.map(s => {
            const w = Math.max(scores[String(s.id || '')] || 0, 0.01);
            return { song: s, key: Math.pow(Math.random(), 1 / w) };
        });
        keyed.sort((a, b) => b.key - a.key);
        return keyed.slice(0, count).map(k => k.song);
    }

    // ────────────────────────────────────────────────────────────────────────
    // ────────────────────────────────────────────────────────────────────────
    // INJECT — appends `count` auto-mix songs at the END of the queue.
    // Uses session-used tracking (_amUsedIds) so every call — including
    // after a toggle off/on — produces a fresh, non-repeating batch.
    // ────────────────────────────────────────────────────────────────────────
    function injectAutoMixSongs(count) {
        if (automixInjecting) return;
        if (!window.masterPool?.length) {
            setTimeout(() => {
                if (localStorage.getItem('beatzen_automix') === 'true') injectAutoMixSongs(count);
            }, 3000);
            return;
        }
        if (!window.playingAlbum) return;

        // Count already-queued automix songs ahead; don't stack beyond cap
        const amRemain = countAutoMixRemaining();
        if (amRemain >= AUTOMIX_MAX_AHEAD) return;

        showAutoMixLoading();
        automixInjecting = true;

        try {
            const songs = window.playingAlbum.songs;
            const bnd = getAutoMixBoundary();

            // Always inject exactly `count` songs (not capped below count)
            const injectCount = count;

            // IDs already in the current queue (hard de-duplicate)
            const inQueue = new Set(songs.map(s => String(s.id || '')));

            const { allSongs, scores } = buildSongScores();

            // Filter out: in-queue AND already used this session
            let candidates = allSongs.filter(s => {
                const sid = String(s.id || '');
                return !inQueue.has(sid) && !_amUsedIds.has(sid);
            });

            // If pool is nearly exhausted, reset session-used so we can cycle again
            if (candidates.length < injectCount) {
                _amUsedIds.clear();
                candidates = allSongs.filter(s => !inQueue.has(String(s.id || '')));
            }

            const picks = weightedPick(candidates, scores, injectCount);

            if (!picks.length) {
                hideAutoMixLoading();
                automixInjecting = false;
                return;
            }

            picks.forEach(s => _amUsedIds.add(String(s.id || '')));

            const clonedPicks = picks.map(s => {
                const canonical = window.allSongsMap?.get(String(s.id || ''));
                return {
                    ...s,
                    _autoMix: true,
                    _sourceAlbum: s._sourceAlbum || canonical?.album || null
                };
            });

            // Set boundary at first inject
            if (bnd <= 0) setAutoMixBoundary(songs.length);

            songs.push(...clonedPicks);

            /* FIX: Shuffle Logic ─────────────────────────────────────────────
               If shuffle is currently ON, the player's song array is already in
               randomised order.  New AutoMix songs are appended to that shuffled
               array, but window._bzOriginalQueue (the saved un-shuffled tail) is
               NOT updated — so turning shuffle OFF would strip those songs.
               We append the same picks to _bzOriginalQueue here so the restore
               path in toggleShuffle sees them and keeps them in the queue.
               We also set _bzOriginalAutoMixBoundary on the first inject while
               shuffled so the boundary survives a shuffle-off/on cycle correctly.
            ─────────────────────────────────────────────────────────────────── */
            if (window.isShuffling && Array.isArray(window._bzOriginalQueue)) {
                if (window._bzOriginalAutoMixBoundary === undefined ||
                    window._bzOriginalAutoMixBoundary < 0) {
                    /* First AutoMix inject while shuffled: record boundary as the
                       position right after all existing original-queue entries     */
                    const _ci = window.currentSongIndex || 0;
                    window._bzOriginalAutoMixBoundary =
                        _ci + 1 + window._bzOriginalQueue.length;
                }
                window._bzOriginalQueue.push(...clonedPicks);
            }

            // Release flag BEFORE re-render so re-render doesn't re-trigger inject
            automixInjecting = false;
            saveQueueState();      // persist newly-injected auto-mix songs

            setTimeout(() => {
                hideAutoMixLoading();
                if (typeof window.renderFullscreenQueue === 'function') window.renderFullscreenQueue();
            }, 60);

        } catch (e) {
            hideAutoMixLoading();
            automixInjecting = false;
            throw e;
        }
    }

    // ── Audio event hooks ────────────────────────────────────────────────────
    if (audioPlayer) {
        audioPlayer.addEventListener('play', scheduleAutoMixCheck);
        audioPlayer.addEventListener('pause', stopAutoMixTimer);
        audioPlayer.addEventListener('ended', () => {
            if (localStorage.getItem('beatzen_automix') === 'true') {
                // Immediate check on every song end so 20 songs always stay ahead
                maybeRefillAutoMix();
            }
            scheduleAutoMixCheck();
        });
    }

    // ── Public trigger (called when settings toggle or header toggle turns ON) ──
    // Always resets session-used IDs → guarantees a completely fresh remix
    // every single time the user enables Auto-Mix (toggle off → on).
    window.bzTriggerAutoMix = function () {
        if (localStorage.getItem('beatzen_automix') !== 'true') return;
        // Clear used set + boundary so the new batch is genuinely fresh
        _amUsedIds.clear();
        clearAutoMixBoundary();
        if (overlay.classList.contains('active')) showAutoMixLoading();
        setTimeout(() => injectAutoMixSongs(AUTOMIX_BATCH_SIZE), 200);
        // Sync header toggle in case called from settings
        syncHeaderAutoMixToggle();
        syncHeaderShuffleToggle();
    };

    // ── When AutoMix is turned OFF — stop engine + clear AutoMix songs ───────
    // Removes all _autoMix-flagged songs from the Up Next queue so the panel
    // shows empty (or only manually-queued songs) the moment the toggle goes off.
    window.bzClearAutoMix = function () {
        stopAutoMixTimer();
        removeAutoMixSongsFromQueue();
        syncHeaderAutoMixToggle();
        syncHeaderShuffleToggle();
        renderFullscreenQueue();
    };

    // ── Sync header toggle whenever settings toggle changes ──────────────────
    // This runs after the DOMContentLoaded initialisation in script.js,
    // so we patch the settings toggle change-event to also update the header.
    function patchSettingsAutoMixToggle() {
        const settingsToggle = document.getElementById('automix-toggle');
        if (!settingsToggle || settingsToggle._bzPatched) return;
        settingsToggle._bzPatched = true;
        settingsToggle.addEventListener('change', () => {
            // Keep header toggle in sync (settings is source of truth here)
            syncHeaderAutoMixToggle();
            // When toggled OFF from settings panel, also clear AutoMix queue songs
            if (!settingsToggle.checked) {
                stopAutoMixTimer();
                removeAutoMixSongsFromQueue();
            }
            renderFullscreenQueue();
        });
    }
    // Try immediately and again after script.js initialises
    patchSettingsAutoMixToggle();
    setTimeout(patchSettingsAutoMixToggle, 600);
    setTimeout(patchSettingsAutoMixToggle, 1500);

    // ════════════════════════════════════════════════════════════════════════
    // LYRICS HIGHLIGHTING — BUG FIXES
    //
    // Fix 1 — Default-enable lyric highlighting on load.
    //          Reads whatever key the app uses (beatzen_lyrics / lyricsHighlight
    //          / lyrics_highlight) and sets it to true if not already stored.
    //
    // Fix 2 — Remove orange fill & fix fast-highlight sync issue.
    //          The main engine advances the active lyric line via a
    //          requestAnimationFrame / timeupdate loop.  When the audio clock
    //          jumps (seek, initial load) the engine can mark several lines
    //          active in rapid succession before the CSS transition finishes,
    //          making lines flash white too quickly.
    //          We patch the active-line setter to debounce rapid successive
    //          changes and always honour the audio currentTime rather than
    //          relying on stale timestamps.
    // ════════════════════════════════════════════════════════════════════════
    (function bzLyricsFixes() {

        // ── Fix 1: Default-enable lyric highlighting ────────────────────────
        // Common storage keys used by BeatZen apps for lyrics toggle.
        // We default every known key to 'true' if it has never been set,
        // and also flip any matching UI checkbox to checked.
        const LYRIC_STORAGE_KEYS = [
            'beatzen_lyrics',
            'lyricsHighlight',
            'lyrics_highlight',
            'beatzen_lyricsHighlight',
            'beatzen_lyrics_highlight',
        ];

        function enableLyricsDefault() {
            LYRIC_STORAGE_KEYS.forEach(key => {
                if (localStorage.getItem(key) === null) {
                    localStorage.setItem(key, 'true');
                }
            });

            // Sync any visible toggle checkboxes to ON
            const toggleSelectors = [
                '#lyrics-toggle',
                '#lyrics-highlight-toggle',
                '#lyric-toggle',
                '[data-setting="lyricsHighlight"]',
                '[data-toggle="lyrics"]',
                'input[name="lyricsHighlight"]',
            ];
            toggleSelectors.forEach(sel => {
                document.querySelectorAll(sel).forEach(el => {
                    if (el.type === 'checkbox' && !el.checked) {
                        el.checked = true;
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });
            });

            // If the app exposes a global toggle function, call it
            if (typeof window.enableLyricsHighlight === 'function') {
                window.enableLyricsHighlight();
            }
            if (typeof window.setLyricsHighlight === 'function') {
                window.setLyricsHighlight(true);
            }
        }

        // Run once on load, and once after script.js typically initialises
        enableLyricsDefault();
        setTimeout(enableLyricsDefault, 500);
        setTimeout(enableLyricsDefault, 1500);

        // ── Fix 2: Patch lyric-line activation to debounce rapid flashing ──
        // The engine typically calls something like:
        //   el.classList.add('active') / el.classList.remove('active')
        //   or sets el.dataset.active = 'true'
        // We install a MutationObserver on the lyrics container that
        // cancels a pending "deactivate" if the same line is immediately
        // re-activated, and also validates the change against audio time.
        const ACTIVE_CLASSES = ['active', 'current', 'lyric-active', 'active-lyric', 'current-lyric'];
        const LYRIC_LINE_SELECTORS = [
            '.lyrics-line', '.lrc-line', '.lyric-line',
            '[class*="lyric-"]', '[class*="lrc-line"]',
        ];

        // Minimum ms a lyric line must remain active before allowing transition
        // to the next (prevents flash-through on seek / rapid scroll).
        const MIN_LINE_DURATION_MS = 280;
        let _lastActivatedAt = 0;
        let _lastActiveEl = null;
        let _pendingDeactivate = null;

        function isLyricLine(el) {
            if (!el || el.nodeType !== 1) return false;
            return LYRIC_LINE_SELECTORS.some(sel => {
                try { return el.matches(sel); } catch (_) { return false; }
            });
        }

        function hasActiveClass(el) {
            return ACTIVE_CLASSES.some(cls => el.classList.contains(cls));
        }

        // Patch classList.add on lyric-line elements to enforce debounce
        function patchLyricElement(el) {
            if (!isLyricLine(el) || el._bzLyricPatched) return;
            el._bzLyricPatched = true;

            const origAdd = el.classList.add.bind(el.classList);
            el.classList.add = function (...classes) {
                const addingActive = classes.some(c => ACTIVE_CLASSES.includes(c));
                if (!addingActive) { origAdd(...classes); return; }

                const now = Date.now();
                const elapsed = now - _lastActivatedAt;

                // Cancel any pending deactivation of the previous line
                if (_pendingDeactivate) {
                    clearTimeout(_pendingDeactivate);
                    _pendingDeactivate = null;
                }

                // If a DIFFERENT line was active less than MIN_LINE_DURATION_MS ago,
                // delay this activation slightly so the CSS transition can complete.
                if (_lastActiveEl && _lastActiveEl !== el && elapsed < MIN_LINE_DURATION_MS) {
                    const delay = MIN_LINE_DURATION_MS - elapsed;
                    setTimeout(() => origAdd(...classes), delay);
                } else {
                    origAdd(...classes);
                }

                _lastActivatedAt = now;
                _lastActiveEl = el;
            };
        }

        // Watch for lyric containers and patch their children
        function patchLyricsContainer(container) {
            if (!container) return;
            container.querySelectorAll(LYRIC_LINE_SELECTORS.join(',')).forEach(patchLyricElement);
        }

        // MutationObserver: catch lyric containers added by the app at any time
        const _lyricsObserver = new MutationObserver(mutations => {
            mutations.forEach(m => {
                m.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;
                    // If a lyric container was injected, patch its lines
                    const containers = [
                        '.lyrics-container', '.lrc-container', '.lyrics-scroll',
                        '.lrc-scroll', '[class*="lyrics-wrap"]', '[class*="lrc-wrap"]',
                        '#lyrics', '#lrc', '.lyrics', '.lrc',
                    ];
                    containers.forEach(sel => {
                        if (node.matches?.(sel)) patchLyricsContainer(node);
                        node.querySelectorAll?.(sel).forEach(patchLyricsContainer);
                    });
                    // Also patch any lyric lines directly added
                    if (isLyricLine(node)) patchLyricElement(node);
                    node.querySelectorAll?.(LYRIC_LINE_SELECTORS.join(',')).forEach(patchLyricElement);
                });
            });
        });

        _lyricsObserver.observe(document.body || document.documentElement, {
            childList: true, subtree: true
        });

        // Patch any already-present lyric lines
        document.querySelectorAll(LYRIC_LINE_SELECTORS.join(',')).forEach(patchLyricElement);

    }());

});

/* ════════════════════════════════════════════════════════════════════════════
   SETTINGS PAGE — Section header & nav icon color fix (JS-side)
   Injects a scoped <style> tag that targets the real DOM structure as
   rendered, using attribute/text-content sniffing as a fallback when
   class names aren't known at build time.
════════════════════════════════════════════════════════════════════════════ */
(function bzSettingsColorFix() {

    const PURPLE = '#a78bfa';          // soft purple matching the nav gradient
    const PURPLE_GLOW = 'rgba(167,139,250,0.18)';

    /* ── Inject a <style> block that re-declares --primary-color only
       inside the settings section-header elements so the app's own
       color: var(--primary-color) rules pick up the override          ── */
    const styleId = 'bz-settings-color-fix';
    if (!document.getElementById(styleId)) {
        const s = document.createElement('style');
        s.id = styleId;
        s.textContent = `
            /* Override orange primary on settings section heads */
            .settings-section-title,
            .settings-section-label,
            .settings-category,
            .settings-category-label,
            .settings-group-label,
            .settings-group-title,
            .settings-heading,
            .settings-section-header,
            .settings-category-header,
            .settings-group-header,
            [class*="settings-section-head"],
            [class*="settings-group-head"] {
                --primary-color: ${PURPLE} !important;
                color: ${PURPLE} !important;
            }
            .settings-section-title i,  .settings-section-title svg,
            .settings-section-label i,  .settings-section-label svg,
            .settings-category i,       .settings-category svg,
            .settings-category-label i, .settings-category-label svg,
            .settings-group-label i,    .settings-group-label svg,
            .settings-heading i,        .settings-heading svg,
            .settings-section-header i, .settings-section-header svg,
            .settings-category-header i,.settings-category-header svg,
            [class*="settings-section-head"] i,
            [class*="settings-section-head"] svg {
                color: ${PURPLE} !important;
            }
            /* Nav: active settings tab icon */
            .nav-item.active i, .nav-item.active span,
            .nav-tab.active i,  .nav-tab.active span {
                /* Only override if the item is the Settings tab.
                   We can't easily scope by data-tab here, so we use
                   the JS DOM walk below instead.                      */
            }
        `;
        (document.head || document.documentElement).appendChild(s);
    }

    /* ── DOM walk: find and fix settings section header elements ── */
    function fixSettingsColors() {

        /* 1. Fix section header labels that contain known text content */
        const SECTION_KEYWORDS = ['account', 'data', 'privacy', 'cloud', 'sync',
            'playback', 'appearance', 'notifications', 'about', 'general',
            'audio', 'display', 'theme', 'language', 'storage', 'network'];

        // Common patterns: small-caps uppercase label elements
        const candidates = document.querySelectorAll(
            '.settings-section-title, .settings-section-label, ' +
            '.settings-category, .settings-category-label, ' +
            '.settings-group-label, .settings-group-title, ' +
            '.settings-heading, .settings-section-header, ' +
            '.settings-category-header, .settings-group-header, ' +
            '[class*="settings-section-head"], [class*="settings-group-head"]'
        );

        candidates.forEach(el => {
            el.style.setProperty('color', PURPLE, 'important');
            el.style.setProperty('--primary-color', PURPLE, 'important');
            el.querySelectorAll('i, svg').forEach(icon => {
                icon.style.setProperty('color', PURPLE, 'important');
            });
        });

        /* 2. Fallback: any element whose text is an all-caps section label
              and whose color is currently computed as orange-ish             */
        document.querySelectorAll(
            '#settings *, #settings-page *, [data-page="settings"] *, ' +
            '.settings-page *, [id*="settings"] *'
        ).forEach(el => {
            if (el.children.length > 3) return;           // skip container elements
            const text = (el.textContent || '').trim().toLowerCase();
            const isKeyword = SECTION_KEYWORDS.some(k => text.includes(k));
            if (!isKeyword) return;

            // Only touch elements that are visually label-like (small, uppercase, light-weight or bold)
            const cs = window.getComputedStyle(el);
            const fs = parseFloat(cs.fontSize) || 16;
            if (fs > 18) return;                          // skip large headings

            // Check if the current color is in the orange range (hue 20–50)
            const colorStr = cs.color;
            const rgb = colorStr.match(/\d+/g);
            if (!rgb || rgb.length < 3) return;
            const [r, g, b] = rgb.map(Number);
            // Simple orange detector: R >> G > B
            if (r > 180 && g > 100 && g < 200 && b < 80) {
                el.style.setProperty('color', PURPLE, 'important');
                el.querySelectorAll('i, svg').forEach(icon => {
                    icon.style.setProperty('color', PURPLE, 'important');
                });
            }
        });

        /* 3. Fix the active nav tab if it's the Settings tab ── */
        document.querySelectorAll(
            'nav .nav-item, nav .nav-tab, .bottom-nav .nav-item, ' +
            '.navbar .nav-item, [class*="nav-item"], [class*="nav-tab"]'
        ).forEach(el => {
            if (!el.classList.contains('active')) return;
            const text = (el.textContent || '').toLowerCase();
            if (!text.includes('setting')) return;
            el.style.setProperty('color', PURPLE, 'important');
            el.querySelectorAll('i, svg, span').forEach(child => {
                child.style.setProperty('color', PURPLE, 'important');
            });
        });
    }

    /* Run on load and whenever the DOM changes (e.g. tab navigation) */
    function scheduleFixSettings() {
        fixSettingsColors();
        setTimeout(fixSettingsColors, 300);
        setTimeout(fixSettingsColors, 800);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', scheduleFixSettings);
    } else {
        scheduleFixSettings();
    }

    /* MutationObserver: catch settings page being injected on tab switch */
    new MutationObserver(() => {
        // Only re-run if settings-related elements are visible
        const settingsVisible =
            document.querySelector('#settings, #settings-page, [data-page="settings"], .settings-page');
        if (settingsVisible) fixSettingsColors();
    }).observe(document.body || document.documentElement, {
        childList: true, subtree: true, attributes: true,
        attributeFilter: ['class', 'data-page', 'style']
    });

    /* Also re-run whenever hash changes (SPA navigation) */
    window.addEventListener('hashchange', () => {
        if (location.hash.includes('setting')) {
            setTimeout(fixSettingsColors, 100);
            setTimeout(fixSettingsColors, 400);
        }
    });

}());

/* ============================================================
   MERGED FROM: share.js
   ============================================================ */
/**
 * BeatZen — share.js  v12
 * Changes from v11:
 * - Theme labels renamed to plain color names (Purple, Amber, Cyan, Rose, Green, Indigo)
 * - 9:16 single song: movie title above cover same style as 16:9 (spaced caps, accent color)
 * - 9:16 single song: artist line spans full card width with only 4px left/right gap
 * - 16:9 single song: border rect wraps the cover image; artist line spans full right width with 4px gap
 * - 16:9 single song: artist line full-width with 4px gap
 * - Removed top-left brand logo from both 9:16 and 16:9 layouts
 */

(function () {
    "use strict";

    /* ═══════════════════════════════════════════════════════
       THEMES — plain color names
    ═══════════════════════════════════════════════════════ */
    const THEMES = [
        {
            id: 'red', label: 'Red',
            bg: ['#1a0000', '#2d0000', '#0d0000'],
            orb1: 'rgba(220,38,38,0.92)', orb2: 'rgba(185,28,28,0.70)', orb3: 'rgba(239,68,68,0.45)',
            accent: '#f87171', accentAlt: '#fca5a5',
            cardBg: 'rgba(35,4,4,0.75)', cardBorder: 'rgba(220,38,38,0.40)',
            pillBg: 'rgba(220,38,38,0.15)', pillBorder: 'rgba(220,38,38,0.40)',
            coverGlow: 'rgba(220,38,38,0.70)', num: '#fca5a5',
            geomColor: 'rgba(220,38,38,0.18)', geomStroke: 'rgba(248,113,113,0.32)',
        },
        {
            id: 'blue', label: 'Blue',
            bg: ['#000d2e', '#00071a', '#000410'],
            orb1: 'rgba(29,78,216,0.92)', orb2: 'rgba(37,99,235,0.72)', orb3: 'rgba(59,130,246,0.48)',
            accent: '#60a5fa', accentAlt: '#93c5fd',
            cardBg: 'rgba(0,6,28,0.75)', cardBorder: 'rgba(37,99,235,0.40)',
            pillBg: 'rgba(37,99,235,0.15)', pillBorder: 'rgba(37,99,235,0.40)',
            coverGlow: 'rgba(37,99,235,0.70)', num: '#93c5fd',
            geomColor: 'rgba(37,99,235,0.18)', geomStroke: 'rgba(96,165,250,0.32)',
        },
        {
            id: 'green', label: 'Green',
            bg: ['#001a08', '#002e12', '#00110a'],
            orb1: 'rgba(22,163,74,0.92)', orb2: 'rgba(21,128,61,0.72)', orb3: 'rgba(34,197,94,0.48)',
            accent: '#4ade80', accentAlt: '#86efac',
            cardBg: 'rgba(0,18,8,0.75)', cardBorder: 'rgba(22,163,74,0.40)',
            pillBg: 'rgba(22,163,74,0.15)', pillBorder: 'rgba(22,163,74,0.40)',
            coverGlow: 'rgba(22,163,74,0.68)', num: '#86efac',
            geomColor: 'rgba(22,163,74,0.18)', geomStroke: 'rgba(74,222,128,0.32)',
        },
        {
            id: 'yellow', label: 'Yellow',
            bg: ['#1a1300', '#2a1f00', '#0d0900'],
            orb1: 'rgba(202,138,4,0.92)', orb2: 'rgba(234,179,8,0.72)', orb3: 'rgba(250,204,21,0.48)',
            accent: '#fde047', accentAlt: '#fef08a',
            cardBg: 'rgba(22,14,0,0.75)', cardBorder: 'rgba(202,138,4,0.40)',
            pillBg: 'rgba(202,138,4,0.15)', pillBorder: 'rgba(202,138,4,0.40)',
            coverGlow: 'rgba(202,138,4,0.68)', num: '#fef08a',
            geomColor: 'rgba(202,138,4,0.18)', geomStroke: 'rgba(253,224,71,0.32)',
        },
        {
            id: 'orange', label: 'Orange',
            bg: ['#1a0800', '#2d1000', '#0d0400'],
            orb1: 'rgba(194,65,12,0.92)', orb2: 'rgba(234,88,12,0.72)', orb3: 'rgba(249,115,22,0.48)',
            accent: '#fb923c', accentAlt: '#fdba74',
            cardBg: 'rgba(26,7,0,0.75)', cardBorder: 'rgba(194,65,12,0.40)',
            pillBg: 'rgba(194,65,12,0.15)', pillBorder: 'rgba(194,65,12,0.40)',
            coverGlow: 'rgba(194,65,12,0.68)', num: '#fdba74',
            geomColor: 'rgba(194,65,12,0.18)', geomStroke: 'rgba(251,146,60,0.32)',
        },
        {
            id: 'purple', label: 'Purple',
            bg: ['#0f0030', '#1a0045', '#08001a'],
            orb1: 'rgba(109,40,217,0.92)', orb2: 'rgba(124,58,237,0.72)', orb3: 'rgba(167,139,250,0.48)',
            accent: '#c084fc', accentAlt: '#a78bfa',
            cardBg: 'rgba(12,0,35,0.75)', cardBorder: 'rgba(109,40,217,0.40)',
            pillBg: 'rgba(109,40,217,0.15)', pillBorder: 'rgba(109,40,217,0.40)',
            coverGlow: 'rgba(109,40,217,0.70)', num: '#d8b4fe',
            geomColor: 'rgba(109,40,217,0.18)', geomStroke: 'rgba(192,132,252,0.32)',
        },
        {
            id: 'pink', label: 'Pink',
            bg: ['#1a0014', '#2d0020', '#0d000c'],
            orb1: 'rgba(219,39,119,0.92)', orb2: 'rgba(236,72,153,0.72)', orb3: 'rgba(244,114,182,0.48)',
            accent: '#f472b6', accentAlt: '#f9a8d4',
            cardBg: 'rgba(28,0,18,0.75)', cardBorder: 'rgba(219,39,119,0.40)',
            pillBg: 'rgba(219,39,119,0.15)', pillBorder: 'rgba(219,39,119,0.40)',
            coverGlow: 'rgba(219,39,119,0.70)', num: '#f9a8d4',
            geomColor: 'rgba(219,39,119,0.18)', geomStroke: 'rgba(244,114,182,0.32)',
        },
        {
            id: 'black', label: 'Black',
            bg: ['#000000', '#070707', '#0e0e0e'],
            orb1: 'rgba(50,50,50,0.88)', orb2: 'rgba(35,35,35,0.72)', orb3: 'rgba(70,70,70,0.45)',
            accent: '#a3a3a3', accentAlt: '#d4d4d4',
            cardBg: 'rgba(10,10,10,0.92)', cardBorder: 'rgba(90,90,90,0.32)',
            pillBg: 'rgba(80,80,80,0.14)', pillBorder: 'rgba(80,80,80,0.30)',
            coverGlow: 'rgba(55,55,55,0.52)', num: '#d4d4d4',
            geomColor: 'rgba(55,55,55,0.15)', geomStroke: 'rgba(163,163,163,0.24)',
        },
        {
            id: 'brown', label: 'Brown',
            bg: ['#1a0c00', '#2d1800', '#0d0700'],
            orb1: 'rgba(146,64,14,0.92)', orb2: 'rgba(180,83,9,0.72)', orb3: 'rgba(217,119,6,0.48)',
            accent: '#d97706', accentAlt: '#f59e0b',
            cardBg: 'rgba(22,9,0,0.75)', cardBorder: 'rgba(146,64,14,0.40)',
            pillBg: 'rgba(146,64,14,0.15)', pillBorder: 'rgba(146,64,14,0.40)',
            coverGlow: 'rgba(146,64,14,0.68)', num: '#fbbf24',
            geomColor: 'rgba(146,64,14,0.18)', geomStroke: 'rgba(217,119,6,0.32)',
        },
    ];

    const RATIOS = [
        { id: '916', label: '9:16', w: 1080, h: 1920 },
        { id: '169', label: '16:9', w: 1920, h: 1080 },
    ];

    let currentThemeId = 'glow';
    let currentRatioId = '916';
    let currentAlbum = null;
    let offscreenCanvas = null;
    let lastBlob = null;
    let _shareHistoryPushed = false;

    /* ═══════════════════════════════════════════════════════
       AUTO THEME — pick the best-matching style from cover art
    ═══════════════════════════════════════════════════════ */
    function hexToRgb(hex) {
        const h = String(hex || '').replace('#', '');
        return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
    }
    function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0, l = (max + min) / 2;
        const d = max - min;
        if (d !== 0) {
            s = d / (1 - Math.abs(2 * l - 1));
            switch (max) {
                case r: h = ((g - b) / d) % 6; break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h *= 60; if (h < 0) h += 360;
        }
        return [h, s, l];
    }
    function hueDist(a, b) {
        const d = Math.abs(a - b) % 360;
        return Math.min(d, 360 - d);
    }
    function loadImgEl(src) {
        return new Promise((res, rej) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => res(img);
            img.onerror = rej;
            img.src = src;
        });
    }
    /* Samples the cover art and returns the theme whose accent color
       best matches the artwork's dominant hue (or 'black' for low-saturation art). */
    async function pickThemeForCover(url) {
        if (!url) return null;
        try {
            const img = await loadImgEl(url);
            const c = document.createElement('canvas');
            c.width = 16; c.height = 16;
            const ctx = c.getContext('2d');
            ctx.drawImage(img, 0, 0, 16, 16);
            const data = ctx.getImageData(0, 0, 16, 16).data;
            let r = 0, g = 0, b = 0, n = 0;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] < 10) continue;
                r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
            }
            if (!n) return null;
            r /= n; g /= n; b /= n;
            const [h, s] = rgbToHsl(r, g, b);
            if (s < 0.15) return THEMES.find(t => t.id === 'black') || null;
            let best = null, bestD = Infinity;
            for (const t of THEMES) {
                if (t.id === 'black') continue;
                const [tr, tg, tb] = hexToRgb(t.accent);
                const [th] = rgbToHsl(tr, tg, tb);
                const d = hueDist(h, th);
                if (d < bestD) { bestD = d; best = t; }
            }
            return best;
        } catch (_) { return null; }
    }
    /* Auto-selects currentThemeId based on cover art (best-effort, silent on failure). */
    async function autoPickTheme(coverUrl) {
        const t = await pickThemeForCover(coverUrl);
        if (t) currentThemeId = t.id;
    }

    /* ═══════════════════════════════════════════════════════
       CANVAS UTILITIES
    ═══════════════════════════════════════════════════════ */
    const esc = s => String(s || '');
    const shareUrl = () => `${location.origin}${location.pathname}#album-${currentAlbum?.id || ''}`;
    const safeFile = () => (currentAlbum?.title || 'beatzen').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const buildMeta = a => [a.year, a.songs?.length ? `${a.songs.length} songs` : null, a.type].filter(Boolean).join(' · ');

    function roundRect(ctx, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
    }

    function drawOrb(ctx, cx, cy, r, color) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.save(); ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }

    function fitText(ctx, text, maxW) {
        let t = esc(text);
        while (ctx.measureText(t).width > maxW && t.length > 2) t = t.slice(0, -1);
        if (t !== esc(text)) t = t.slice(0, -1) + '…';
        return t;
    }

    function wrapText(ctx, text, x, y, maxW, lineH) {
        const words = esc(text).split(' ');
        let line = '', ty = y;
        for (let i = 0; i < words.length; i++) {
            const test = line ? line + ' ' + words[i] : words[i];
            if (ctx.measureText(test).width > maxW && line) {
                ctx.fillText(line, x, ty); line = words[i]; ty += lineH;
            } else { line = test; }
        }
        if (line) ctx.fillText(line, x, ty);
        return ty + lineH - y;
    }

    function loadImage(src) {
        return new Promise(resolve => {
            if (!src) return resolve(null);
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = src;
        });
    }

    /* ─── Themed full-bleed background ─── */
    function drawBackground(ctx, CW, CH, theme) {
        const bgG = ctx.createLinearGradient(0, 0, CW, CH);
        bgG.addColorStop(0, theme.bg[0]);
        bgG.addColorStop(0.5, theme.bg[1]);
        bgG.addColorStop(1, theme.bg[2]);
        ctx.fillStyle = bgG;
        ctx.fillRect(0, 0, CW, CH);
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, CW, CH); ctx.clip();
        const orbR = Math.min(CW, CH) * 0.68;
        drawOrb(ctx, CW * 0.05, CH * 0.06, orbR, theme.orb1);
        drawOrb(ctx, CW * 0.95, CH * 0.90, orbR * 0.80, theme.orb2);
        drawOrb(ctx, CW * 0.85, CH * 0.35, orbR * 0.52, theme.orb3);
        drawOrb(ctx, CW * 0.20, CH * 0.75, orbR * 0.42, theme.orb2);
        ctx.restore();
    }

    /* ─── Decorative geometric arcs — removed ─── */
    function drawGeomAccent(ctx, CW, CH, theme) { /* intentionally empty */ }

    /* ─── Cover image with glow ─── */
    async function drawCover(ctx, cx, cy, sz, album, theme) {
        const img = await loadImage(album.imageUrl || album.albumCover || '');
        const hG = ctx.createRadialGradient(cx + sz / 2, cy + sz / 2, sz * 0.2, cx + sz / 2, cy + sz / 2, sz * 0.9);
        hG.addColorStop(0, theme.coverGlow); hG.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.save(); ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = hG; ctx.fillRect(cx - sz * .4, cy - sz * .4, sz * 1.8, sz * 1.8); ctx.restore();
        ctx.save(); roundRect(ctx, cx, cy, sz, sz, sz * 0.08); ctx.clip();
        if (img) ctx.drawImage(img, cx, cy, sz, sz);
        else { ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(cx, cy, sz, sz); }
        ctx.restore();
        ctx.save(); roundRect(ctx, cx, cy, sz, sz, sz * 0.08);
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    }

    /* ─── Song pill row ─── */
    function drawPill(ctx, x, y, w, h, theme, num, name, dur, fs) {
        const r = Math.round(h * 0.28);
        const sans = `-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif`;
        ctx.save(); roundRect(ctx, x, y, w, h, r);
        ctx.fillStyle = theme.pillBg; ctx.fill();
        ctx.strokeStyle = theme.pillBorder; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
        const mid = y + h / 2;
        ctx.save();
        ctx.font = `bold ${Math.round(12 * fs)}px ${sans}`; ctx.fillStyle = theme.num;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(String(num), x + Math.round(13 * fs), mid); ctx.restore();
        ctx.save();
        ctx.font = `400 ${Math.round(11 * fs)}px ${sans}`; ctx.fillStyle = 'rgba(255,255,255,0.38)';
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        const ds = esc(dur); ctx.fillText(ds, x + w - Math.round(13 * fs), mid);
        const dw = ctx.measureText(ds).width; ctx.restore();
        const nx = x + Math.round(30 * fs);
        const nmw = w - Math.round(30 * fs) - dw - Math.round(24 * fs);
        ctx.save();
        ctx.font = `500 ${Math.round(13 * fs)}px ${sans}`; ctx.fillStyle = 'rgba(255,255,255,0.90)';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.beginPath(); ctx.rect(nx, y, nmw, h); ctx.clip();
        ctx.fillText(fitText(ctx, name, nmw), nx, mid); ctx.restore();
    }

    function drawMore(ctx, cx, y, n, fs) {
        ctx.save();
        ctx.font = `400 ${Math.round(12 * fs)}px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.30)';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`+ ${n} more song${n > 1 ? 's' : ''}`, cx, y); ctx.restore();
    }

    /* ─── BeatZen brand (bottom only) ─── */
    function drawBrand(ctx, x, y, theme, fs, align) {
        align = align || 'left';
        const sans = `-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif`;
        const iconR = Math.round(9 * fs);
        const iconX = align === 'right' ? x - iconR : x + iconR;
        ctx.save();
        ctx.beginPath(); ctx.arc(iconX, y, iconR, 0, Math.PI * 2);
        ctx.fillStyle = theme.accent; ctx.fill(); ctx.restore();
        ctx.save();
        ctx.font = `bold ${Math.round(10 * fs)}px ${sans}`;
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('♪', iconX, y + Math.round(0.5 * fs)); ctx.restore();
        ctx.save();
        ctx.font = `700 ${Math.round(13 * fs)}px ${sans}`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = align === 'right' ? 'right' : 'left';
        ctx.textBaseline = 'middle';
        ctx.letterSpacing = `${Math.round(1 * fs)}px`;
        const wordX = align === 'right' ? x - iconR * 2 - Math.round(5 * fs) : x + iconR * 2 + Math.round(5 * fs);
        ctx.fillText('BEATZEN', wordX, y);
        ctx.letterSpacing = '0px'; ctx.restore();
    }

    /* ═══════════════════════════════════════════════════════
       MASTER DRAW CARD
    ═══════════════════════════════════════════════════════ */
    async function drawCard(album, theme, ratio) {
        const DPR = 2;
        const CW = ratio.w / DPR;
        const CH = ratio.h / DPR;
        const canvas = document.createElement('canvas');
        canvas.width = ratio.w; canvas.height = ratio.h;
        const ctx = canvas.getContext('2d');
        ctx.scale(DPR, DPR);

        const isLandscape = CW > CH;
        const isSingleSong = !!album._isSingleSong;
        const sans = `-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif`;

        drawBackground(ctx, CW, CH, theme);
        drawGeomAccent(ctx, CW, CH, theme);

        /* ════════════════════════════════════════
           SINGLE SONG — PORTRAIT (9:16)
           - NO top-left brand
           - Movie title above cover (spaced caps, accent color)
           - Artist line full card width, 4px gap each side
        ════════════════════════════════════════ */
        if (isSingleSong && !isLandscape) {
            const PAD = Math.round(CW * 0.10);   // more outer padding L/R
            const FS = CW / 280;

            // Glass card panel — more top/bottom breathing room
            const CARD_X = PAD;
            const CARD_Y = Math.round(CH * 0.10);
            const CARD_W = CW - PAD * 2;
            const CARD_H = CH - CARD_Y - Math.round(CH * 0.10);
            const CARD_R = Math.round(CW * 0.055);

            // Shadow
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.60)';
            ctx.shadowBlur = Math.round(CW * 0.10);
            ctx.shadowOffsetY = Math.round(CW * 0.03);
            roundRect(ctx, CARD_X, CARD_Y, CARD_W, CARD_H, CARD_R);
            ctx.fillStyle = theme.cardBg; ctx.fill(); ctx.restore();

            // Border
            ctx.save();
            roundRect(ctx, CARD_X, CARD_Y, CARD_W, CARD_H, CARD_R);
            ctx.strokeStyle = theme.cardBorder; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();

            // Clip card content
            ctx.save();
            roundRect(ctx, CARD_X, CARD_Y, CARD_W, CARD_H, CARD_R);
            ctx.clip();

            // Inner top glow
            const ig = ctx.createRadialGradient(CARD_X + CARD_W * 0.5, CARD_Y, 0, CARD_X + CARD_W * 0.5, CARD_Y, CARD_H * 0.7);
            ig.addColorStop(0, theme.geomColor); ig.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = ig; ctx.fillRect(CARD_X, CARD_Y, CARD_W, CARD_H);

            const IPAD = Math.round(CARD_W * 0.085); // inner padding

            // Pre-calculate cover position so movie title uses same width & centering
            const COVER_SZ = Math.round(CARD_W * 0.72);
            const coverX = CARD_X + (CARD_W - COVER_SZ) / 2;

            // ── Movie title — centered, cover-width, wraps to 2 lines ──
            const MOVIE_FS = Math.round(11 * FS);
            const MOVIE_LINE = Math.round(16 * FS);   // line height
            let topY = CARD_Y + Math.round(IPAD * 1.0);

            if (album._albumName) {
                ctx.save();
                ctx.font = `700 ${MOVIE_FS}px ${sans}`;
                ctx.fillStyle = theme.accent;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.letterSpacing = `${Math.round(3 * FS)}px`;

                const fullText = album._albumName.toUpperCase();
                const maxW = COVER_SZ; // exactly cover width

                // Try single line first
                if (ctx.measureText(fullText).width <= maxW) {
                    ctx.fillText(fullText, coverX + COVER_SZ / 2, topY + Math.round(8 * FS));
                    topY += MOVIE_LINE + Math.round(8 * FS);
                } else {
                    // Split into two balanced lines by words
                    const words = fullText.split(' ');
                    let line1 = '', line2 = '';
                    let split = Math.ceil(words.length / 2);
                    // nudge split point to balance line widths
                    for (let tries = 0; tries < words.length - 1; tries++) {
                        const l1 = words.slice(0, split).join(' ');
                        const l2 = words.slice(split).join(' ');
                        const w1 = ctx.measureText(l1).width;
                        const w2 = ctx.measureText(l2).width;
                        if (w1 <= maxW && w2 <= maxW) { line1 = l1; line2 = l2; break; }
                        if (w1 > maxW) split--; else split++;
                        if (split <= 0 || split >= words.length) { line1 = l1; line2 = l2; break; }
                    }
                    if (!line1) { line1 = fullText; line2 = ''; }
                    const cy = topY + Math.round(8 * FS);
                    if (line2) {
                        ctx.fillText(line1, coverX + COVER_SZ / 2, cy);
                        ctx.fillText(line2, coverX + COVER_SZ / 2, cy + MOVIE_LINE);
                        topY += MOVIE_LINE * 2 + Math.round(8 * FS);
                    } else {
                        ctx.fillText(line1, coverX + COVER_SZ / 2, cy);
                        topY += MOVIE_LINE + Math.round(8 * FS);
                    }
                }
                ctx.letterSpacing = '0px'; ctx.restore();
            } else {
                topY += Math.round(12 * FS);
            }

            // Cover — draw now (position already calculated above)
            const coverY = topY;
            await drawCover(ctx, coverX, coverY, COVER_SZ, album, theme);

            // Text aligns to LEFT EDGE OF COVER
            const TEXT_X = coverX;
            const TEXT_W = COVER_SZ; // same width as cover
            let ty = coverY + COVER_SZ + Math.round(CARD_H * 0.030);

            // Song title
            ctx.save();
            ctx.font = `800 ${Math.round(16 * FS)}px ${sans}`;
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left'; ctx.textBaseline = 'top';
            ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 14;
            ctx.fillText(fitText(ctx, album.title, TEXT_W), TEXT_X, ty);
            ctx.shadowBlur = 0; ctx.restore();
            ty += Math.round(21 * FS);

            // Artist
            if (album._artistName) {
                ctx.save();
                ctx.font = `400 ${Math.round(9 * FS)}px ${sans}`;
                ctx.fillStyle = 'rgba(255,255,255,0.62)';
                ctx.textAlign = 'left'; ctx.textBaseline = 'top';
                ctx.fillText(fitText(ctx, album._artistName, TEXT_W), TEXT_X, ty);
                ctx.restore();
                ty += Math.round(13 * FS);
            }

            // Accent divider — same width as cover/text
            ctx.save();
            const divG = ctx.createLinearGradient(TEXT_X, 0, TEXT_X + TEXT_W, 0);
            divG.addColorStop(0, theme.accent);
            divG.addColorStop(0.6, theme.accentAlt);
            divG.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.strokeStyle = divG; ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(TEXT_X, ty + Math.round(4 * FS));
            ctx.lineTo(TEXT_X + TEXT_W, ty + Math.round(4 * FS));
            ctx.stroke(); ctx.restore();

            // Brand at bottom — aligned to TEXT_X
            const BRAND_Y = CARD_Y + CARD_H - Math.round(CARD_H * 0.068);
            drawBrand(ctx, TEXT_X, BRAND_Y, theme, FS * 0.92, 'left');

            ctx.restore(); // end card clip
            return canvas;
        }

        /* ════════════════════════════════════════
           SINGLE SONG — LANDSCAPE (16:9)
           - NO top-left brand
           - Movie name: center top of the full card
           - Border rect wraps cover image
           - Song title: normal size in right panel, above artist
           - Artist line full right-panel width, 4px gap
        ════════════════════════════════════════ */
        if (isSingleSong && isLandscape) {
            const PAD = Math.round(CW * 0.075);  // left/right outer gap
            const LEFT_PAD = Math.round(CW * 0.095);  // extra left indent for cover
            const FS = CH / 280;

            // Cover — moved further from left edge, closer to right text
            const COVER_SZ = Math.round(Math.min(CH * 0.55, CW * 0.30));
            const coverX = LEFT_PAD;
            const coverY = (CH - COVER_SZ) / 2;

            // Border/card
            const BORDER_GAP = Math.round(CW * 0.018);
            const MOVIE_LABEL_H = Math.round(CH * 0.13);
            const EXTRA_BOTTOM = Math.round(CH * 0.06);
            const BORDER_X = coverX - BORDER_GAP;
            const BORDER_Y = coverY - BORDER_GAP - MOVIE_LABEL_H;
            const BORDER_W = CW - BORDER_X - PAD;
            const BORDER_H = COVER_SZ + BORDER_GAP * 2 + MOVIE_LABEL_H + EXTRA_BOTTOM;
            const BORDER_R = Math.round(COVER_SZ * 0.09);

            // Card shadow
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.55)';
            ctx.shadowBlur = Math.round(CW * 0.04);
            ctx.shadowOffsetY = Math.round(CH * 0.02);
            roundRect(ctx, BORDER_X, BORDER_Y, BORDER_W, BORDER_H, BORDER_R);
            ctx.fillStyle = theme.cardBg; ctx.fill(); ctx.restore();

            // Border stroke
            ctx.save();
            roundRect(ctx, BORDER_X, BORDER_Y, BORDER_W, BORDER_H, BORDER_R);
            ctx.strokeStyle = theme.cardBorder; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();

            // ── Movie name — inside border, top center ──
            if (album._albumName) {
                ctx.save();
                ctx.font = `700 ${Math.round(11 * FS)}px ${sans}`;
                ctx.fillStyle = theme.accent;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.letterSpacing = `${Math.round(3 * FS)}px`;
                ctx.fillText(fitText(ctx, album._albumName.toUpperCase(), BORDER_W - BORDER_GAP * 2), BORDER_X + BORDER_W / 2, BORDER_Y + MOVIE_LABEL_H / 2);
                ctx.letterSpacing = '0px'; ctx.restore();
            }

            // Cover image
            await drawCover(ctx, coverX, coverY, COVER_SZ, album, theme);

            // Right text column — tight gap between cover and text
            const RIGHT_GAP = Math.round(CW * 0.035);  // small gap cover → text
            const RIGHT_X = coverX + COVER_SZ + RIGHT_GAP;
            const RIGHT_W = (BORDER_X + BORDER_W) - RIGHT_X - Math.round(PAD * 0.4);

            // Text vertically centered in cover zone
            let ry = coverY + Math.round(COVER_SZ * 0.20);

            // Song title
            ctx.save();
            ctx.font = `800 ${Math.round(22 * FS)}px ${sans}`;
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left'; ctx.textBaseline = 'top';
            ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 12;
            ctx.fillText(fitText(ctx, album.title, RIGHT_W), RIGHT_X, ry);
            ctx.shadowBlur = 0; ctx.restore();
            ry += Math.round(32 * FS);

            // Artist
            if (album._artistName) {
                ctx.save();
                ctx.font = `400 ${Math.round(13 * FS)}px ${sans}`; ctx.fillStyle = 'rgba(255,255,255,0.60)';
                ctx.textAlign = 'left'; ctx.textBaseline = 'top';
                const artH = wrapText(ctx, album._artistName, RIGHT_X, ry, RIGHT_W, Math.round(18 * FS));
                ctx.restore();
                ry += artH + Math.round(16 * FS);
            }

            // Accent divider — full right panel width
            ctx.save();
            const divG2 = ctx.createLinearGradient(RIGHT_X, 0, RIGHT_X + RIGHT_W, 0);
            divG2.addColorStop(0, theme.accent);
            divG2.addColorStop(0.7, theme.accentAlt);
            divG2.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.strokeStyle = divG2; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(RIGHT_X, ry); ctx.lineTo(RIGHT_X + RIGHT_W, ry); ctx.stroke();
            ctx.restore();
            ry += Math.round(18 * FS);

            // Brand — CENTERED in right panel, below divider
            const BRAND_CENTER_X = RIGHT_X + RIGHT_W / 2;
            drawBrand(ctx, BRAND_CENTER_X - Math.round(35 * FS * 0.88), ry, theme, FS * 0.88, 'left');

            return canvas;
        }

        /* ════════════════════════════════════════
           ALBUM — PORTRAIT (9:16)
           Max 6 songs + "+N more", no bottom brand, bigger cover
        ════════════════════════════════════════ */
        if (!isLandscape) {
            const MAX_SONGS = 6;
            const PAD = Math.round(CW * 0.060);
            const FS = CW / 290;
            const songs = album.songs || [];
            const preview = songs.slice(0, MAX_SONGS);
            const more = songs.length > MAX_SONGS ? songs.length - MAX_SONGS : 0;
            const nShow = preview.length;

            /* fixed row heights */
            const BRAND_H = Math.round(28 * FS);
            const TOP_PAD = Math.round(PAD * 0.7);
            const COVER_GAP = Math.round(14 * FS);
            const TITLE_H = Math.round(30 * FS);
            const META_H = Math.round(20 * FS);
            const DIV_H = Math.round(12 * FS);
            const MORE_H = more > 0 ? Math.round(28 * FS) : 0; // "+N more" row
            const BOTTOM_PAD = Math.round(CH * 0.025);
            const PILL_GAP = Math.round(6 * FS);

            /* space available for cover + pills (no bottom brand) */
            const usedFixed = TOP_PAD + BRAND_H + Math.round(14 * FS)
                + COVER_GAP + TITLE_H + META_H + DIV_H + MORE_H + BOTTOM_PAD;
            const availH = CH - usedFixed;

            /* pill height: fixed 6 slots, clamped 34-52 */
            const PILL_H = Math.min(52, Math.max(34,
                Math.floor((availH * 0.46) / Math.max(1, nShow + (nShow - 1) * 0.13))
            ));
            const allPillsH = nShow * PILL_H + Math.max(0, nShow - 1) * PILL_GAP;

            /* cover — bigger: fill remaining space, max 62% width */
            const COVER_SZ = Math.min(
                Math.round(CW * 0.62),
                Math.max(Math.round(CW * 0.38), availH - allPillsH - COVER_GAP)
            );

            let y = TOP_PAD;

            /* brand — top center only */
            drawBrand(ctx, CW / 2 - Math.round(35 * FS), y + Math.round(9 * FS), theme, FS, 'left');
            y += BRAND_H + Math.round(14 * FS);

            /* cover — horizontally centered, bigger */
            const coverX = (CW - COVER_SZ) / 2;
            await drawCover(ctx, coverX, y, COVER_SZ, album, theme);
            y += COVER_SZ + COVER_GAP;

            /* album title */
            ctx.save();
            ctx.font = `800 ${Math.round(20 * FS)}px ${sans}`; ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0,0,0,0.70)'; ctx.shadowBlur = 12;
            ctx.fillText(fitText(ctx, album.title, CW - PAD * 2), CW / 2, y + Math.round(12 * FS));
            ctx.shadowBlur = 0; ctx.restore();
            y += TITLE_H;

            /* meta */
            ctx.save();
            ctx.font = `400 ${Math.round(12 * FS)}px ${sans}`; ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(fitText(ctx, buildMeta(album), CW - PAD * 2), CW / 2, y + Math.round(8 * FS));
            ctx.restore();
            y += META_H;

            /* divider */
            ctx.save();
            const dg = ctx.createLinearGradient(PAD, 0, CW - PAD, 0);
            dg.addColorStop(0, 'rgba(255,255,255,0)');
            dg.addColorStop(0.5, theme.accent);
            dg.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.strokeStyle = dg; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(CW - PAD, y); ctx.stroke();
            ctx.restore();
            y += DIV_H;

            /* max 6 song pills */
            for (let i = 0; i < nShow; i++) {
                drawPill(ctx, PAD, y, CW - PAD * 2, PILL_H, theme, i + 1, preview[i].title, preview[i].duration, FS);
                y += PILL_H + PILL_GAP;
            }

            /* "+N more songs" centered below list */
            if (more > 0) {
                y += Math.round(4 * FS);
                ctx.save();
                ctx.font = `500 ${Math.round(13 * FS)}px ${sans}`;
                ctx.fillStyle = 'rgba(255,255,255,0.45)';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(`+ ${more} more songs`, CW / 2, y + Math.round(10 * FS));
                ctx.restore();
            }

            return canvas;
        }

        /* ════════════════════════════════════════
           ALBUM — LANDSCAPE (16:9)
           Max 6 songs + "+N more", no bottom brand, bigger cover
        ════════════════════════════════════════ */
        const MAX_SONGS_L = 6;
        const PAD = Math.round(CW * 0.048);
        const FS = CH / 300;
        const songs = album.songs || [];
        const preview = songs.slice(0, MAX_SONGS_L);
        const more = songs.length > MAX_SONGS_L ? songs.length - MAX_SONGS_L : 0;
        const nShow = preview.length;

        /* left column */
        const LEFT_W = CW * 0.42;
        const RIGHT_X = LEFT_W + Math.round(PAD * 0.6);
        const RIGHT_W = CW - RIGHT_X - PAD;

        /* cover — bigger: 70% of left col, vertically centered with top bias */
        const COVER_SZ = Math.round(Math.min(LEFT_W * 0.70, CH * 0.62));
        const coverX = (LEFT_W - COVER_SZ) / 2;
        const coverY = Math.round(CH * 0.10);
        await drawCover(ctx, coverX, coverY, COVER_SZ, album, theme);

        /* brand — left col, below cover */
        const BRAND_FS = FS * 0.88;
        drawBrand(ctx, (LEFT_W - COVER_SZ) / 2, coverY + COVER_SZ + Math.round(CH * 0.03), theme, BRAND_FS, 'left');

        /* right column layout */
        const TITLE_H = Math.round(30 * FS);
        const META_H = Math.round(22 * FS);
        const DIV_H = Math.round(14 * FS);
        const MORE_H = more > 0 ? Math.round(26 * FS) : 0;
        const PILL_GAP = Math.round(Math.max(4, CH * 0.010));

        /* pill height: fixed 6 slots, clamped */
        const rightAvailH = CH - Math.round(CH * 0.08) - TITLE_H - META_H - DIV_H - MORE_H - Math.round(CH * 0.06);
        const PILL_H = Math.min(Math.round(CH * 0.090), Math.max(Math.round(CH * 0.058),
            Math.floor((rightAvailH - (nShow - 1) * PILL_GAP) / Math.max(1, nShow))
        ));
        const allPillsH = nShow * PILL_H + Math.max(0, nShow - 1) * PILL_GAP;
        const blockH = TITLE_H + META_H + DIV_H + allPillsH + MORE_H;

        /* vertically center right block */
        let ry = Math.max(PAD, (CH - blockH) / 2);

        /* album title */
        ctx.save();
        ctx.font = `800 ${Math.round(20 * FS)}px ${sans}`; ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 10;
        ctx.fillText(fitText(ctx, album.title, RIGHT_W), RIGHT_X, ry);
        ctx.shadowBlur = 0; ctx.restore();
        ry += TITLE_H;

        /* meta */
        ctx.save();
        ctx.font = `400 ${Math.round(13 * FS)}px ${sans}`; ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(fitText(ctx, buildMeta(album), RIGHT_W), RIGHT_X, ry);
        ctx.restore();
        ry += META_H;

        /* divider */
        ctx.save();
        const ldg = ctx.createLinearGradient(RIGHT_X, 0, RIGHT_X + RIGHT_W, 0);
        ldg.addColorStop(0, theme.accent); ldg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = ldg; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(RIGHT_X, ry); ctx.lineTo(RIGHT_X + RIGHT_W, ry); ctx.stroke();
        ctx.restore();
        ry += DIV_H;

        /* max 6 song pills */
        for (let i = 0; i < nShow; i++) {
            drawPill(ctx, RIGHT_X, ry, RIGHT_W, PILL_H, theme, i + 1, preview[i].title, preview[i].duration, FS);
            ry += PILL_H + PILL_GAP;
        }

        /* "+N more songs" centered in right panel */
        if (more > 0) {
            ry += Math.round(4 * FS);
            ctx.save();
            ctx.font = `500 ${Math.round(13 * FS)}px ${sans}`;
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(`+ ${more} more songs`, RIGHT_X + RIGHT_W / 2, ry + Math.round(10 * FS));
            ctx.restore();
        }

        return canvas;
    }

    /* ═══════════════════════════════════════════════════════
       BLOB CACHE
    ═══════════════════════════════════════════════════════ */
    function getBlob() {
        if (lastBlob) return Promise.resolve(lastBlob);
        if (!offscreenCanvas) return Promise.resolve(null);
        return new Promise(r => offscreenCanvas.toBlob(b => { lastBlob = b; r(b); }, 'image/png', 1.0));
    }

    /* ═══════════════════════════════════════════════════════
       MODAL SHELL
    ═══════════════════════════════════════════════════════ */
    function injectModalShell() {
        if (document.getElementById('bz-share-overlay')) return;

        const tTabs = THEMES.map(t =>
            `<button class="bz-style-tab${t.id === currentThemeId ? ' active' : ''}" data-style="${t.id}">${t.label}</button>`
        ).join('');
        const rTabs = RATIOS.map(r =>
            `<button class="bz-ratio-tab${r.id === currentRatioId ? ' active' : ''}" data-ratio="${r.id}">${r.label}</button>`
        ).join('');

        const SVG_COPY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
        const SVG_SAVE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
        const SVG_MORE = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="12" r="2.2" fill="currentColor"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/><circle cx="19" cy="12" r="2.2" fill="currentColor"/></svg>`;
        const SVG_CLOSE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" xmlns="http://www.w3.org/2000/svg"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        const SVG_SHARE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`;

        const ACTIONS_HTML = `
          <div class="bz-share-actions" id="bz-share-actions">
            <button class="bz-action-btn bz-btn-copy" id="bz-btn-copy">
              ${SVG_COPY}<span>Copy Image</span>
            </button>
            <button class="bz-action-btn bz-btn-save" id="bz-btn-save">
              ${SVG_SAVE}<span>Save</span>
            </button>
            <button class="bz-action-btn bz-btn-more" id="bz-btn-more">
              ${SVG_MORE}<span>More</span>
            </button>
          </div>`;

        document.body.insertAdjacentHTML('beforeend', `
        <div id="bz-share-overlay">
          <div class="bz-share-modal">
            <div class="bz-share-header">
              <div class="bz-share-header-title">
                ${SVG_SHARE}
                <span>Share Album</span>
              </div>
              <button class="bz-share-close" id="bz-share-close" title="Close">
                ${SVG_CLOSE}
              </button>
            </div>
            <div class="bz-share-body">
              <div class="bz-controls-panel">
                <div class="bz-section-label">Style</div>
                <div class="bz-style-tabs" id="bz-style-tabs">${tTabs}</div>
                <div class="bz-section-label">Format</div>
                <div class="bz-ratio-tabs" id="bz-ratio-tabs">${rTabs}</div>
                <div class="bz-desktop-actions">${ACTIONS_HTML}</div>
              </div>
              <div class="bz-preview-panel">
                <div id="bz-card-stage"></div>
              </div>
            </div>
            <div class="bz-mobile-footer">${ACTIONS_HTML.replace(/id="bz-share-actions"/, 'id="bz-share-actions-mobile"').replace(/id="bz-btn-copy"/, 'id="bz-btn-copy-m"').replace(/id="bz-btn-save"/, 'id="bz-btn-save-m"').replace(/id="bz-btn-more"/, 'id="bz-btn-more-m"')}</div>
          </div>
        </div>
        <div id="bz-share-toast"></div>`);

        document.getElementById('bz-share-close').onclick = closeShareModal;
        document.getElementById('bz-share-overlay').onclick = e => {
            if (e.target.id === 'bz-share-overlay') closeShareModal();
        };

        document.getElementById('bz-style-tabs').addEventListener('click', e => {
            const b = e.target.closest('.bz-style-tab'); if (!b) return;
            document.querySelectorAll('.bz-style-tab').forEach(t => t.classList.remove('active'));
            b.classList.add('active');
            currentThemeId = b.dataset.style;
            offscreenCanvas = null; lastBlob = null;
            triggerRender();
        });

        document.getElementById('bz-ratio-tabs').addEventListener('click', e => {
            const b = e.target.closest('.bz-ratio-tab'); if (!b) return;
            document.querySelectorAll('.bz-ratio-tab').forEach(t => t.classList.remove('active'));
            b.classList.add('active');
            currentRatioId = b.dataset.ratio;
            offscreenCanvas = null; lastBlob = null;
            triggerRender();
        });

        const wireBtns = (copyId, saveId, moreId) => {
            document.getElementById(copyId)?.addEventListener('click', handleCopyImage);
            document.getElementById(saveId)?.addEventListener('click', handleSave);
            document.getElementById(moreId)?.addEventListener('click', handleMore);
        };
        wireBtns('bz-btn-copy', 'bz-btn-save', 'bz-btn-more');
        wireBtns('bz-btn-copy-m', 'bz-btn-save-m', 'bz-btn-more-m');
    }

    function triggerRender() {
        renderPreview(
            currentAlbum,
            THEMES.find(t => t.id === currentThemeId) || THEMES[0],
            RATIOS.find(r => r.id === currentRatioId) || RATIOS[0]
        );
    }

    async function renderPreview(album, theme, ratio) {
        const stage = document.getElementById('bz-card-stage');
        if (!stage) return;
        stage.innerHTML = '<div class="bz-generating"><div class="bz-spinner"></div><span>Crafting your card…</span></div>';
        try {
            offscreenCanvas = await drawCard(album, theme, ratio);
            lastBlob = null;
            const pi = document.createElement('img');
            pi.src = offscreenCanvas.toDataURL('image/png');
            pi.style.cssText = 'display:block;border-radius:12px;box-shadow:0 12px 48px rgba(0,0,0,0.80);max-width:100%;max-height:100%;width:auto;height:auto;';
            stage.innerHTML = '';
            stage.appendChild(pi);
        } catch (e) {
            console.error('BeatZen share draw failed', e);
            stage.innerHTML = '<p style="color:rgba(255,255,255,.38);font-size:13px;padding:28px 0;text-align:center;">Could not render card.</p>';
        }
    }

    /* ═══════════════════════════════════════════════════════
       BUTTON STATE HELPERS
    ═══════════════════════════════════════════════════════ */
    function setBtnState(id, loading, label) {
        [id, id + '-m'].forEach(bid => {
            const b = document.getElementById(bid); if (!b) return;
            b.disabled = loading;
            const sp = b.querySelector('span');
            if (loading) { b._saved = sp?.textContent; if (sp) sp.textContent = label || '…'; }
            else { if (sp && b._saved != null) sp.textContent = b._saved; b._saved = null; }
        });
    }

    function showToast(msg) {
        if (typeof window.showToast === 'function') { window.showToast(msg); return; }
        const t = document.getElementById('bz-share-toast');
        if (t) { t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2500); }
    }

    /* ═══════════════════════════════════════════════════════
       ACTION HANDLERS
    ═══════════════════════════════════════════════════════ */
    async function handleSave() {
        setBtnState('bz-btn-save', true, 'Saving…');
        const blob = await getBlob();
        if (blob) {
            const url = URL.createObjectURL(blob);
            const a = Object.assign(document.createElement('a'), { href: url, download: `beatzen_${safeFile()}.png` });
            document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
            showToast('✓ Image saved!');
        } else { showToast('Nothing to save yet.'); }
        setBtnState('bz-btn-save', false);
    }

    async function handleMore() {
        setBtnState('bz-btn-more', true, '…');
        const blob = await getBlob();
        if (navigator.share) {
            const payload = { title: `BeatZen — ${currentAlbum?.title || ''}`, url: shareUrl() };
            if (blob) {
                const f = new File([blob], `beatzen_${safeFile()}.png`, { type: 'image/png' });
                if (navigator.canShare?.({ files: [f] })) payload.files = [f];
            }
            try { await navigator.share(payload); } catch (e) {
                if (e.name !== 'AbortError') { try { await navigator.share({ title: payload.title, url: payload.url }); } catch (_) { } }
            }
        } else if (blob && window.ClipboardItem && navigator.clipboard?.write) {
            try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); showToast('✓ Image copied!'); }
            catch (_) { await handleSave(); }
        } else { await handleSave(); }
        setBtnState('bz-btn-more', false);
    }

    async function handleCopyImage() {
        setBtnState('bz-btn-copy', true, 'Copying…');
        const blob = await getBlob();
        if (blob && window.ClipboardItem && navigator.clipboard?.write) {
            try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); showToast('✓ Image copied!'); }
            catch (_) { await handleSave(); showToast('✓ Image saved (clipboard unavailable)'); }
        } else if (blob) {
            await handleSave(); showToast('✓ Image saved (clipboard unavailable)');
        } else { showToast('Nothing to copy yet.'); }
        setBtnState('bz-btn-copy', false);
    }

    /* ═══════════════════════════════════════════════════════
       OPEN / CLOSE
    ═══════════════════════════════════════════════════════ */
    function closeShareModal(fromPop) {
        document.getElementById('bz-share-overlay')?.classList.remove('active');
        document.body.style.overflow = '';
        if (_shareHistoryPushed) {
            _shareHistoryPushed = false;
            if (!fromPop) history.back();
        }
    }
    window.bzCloseShareModal = closeShareModal;

    /* If the share card is opened while the fullscreen player is open, push a
       lightweight history entry so the device/browser Back button closes the
       share card and returns to the fullscreen player view instead of leaving it. */
    function pushShareHistoryIfFullscreen() {
        _shareHistoryPushed = false;
        if (document.getElementById('main-player')?.classList.contains('maximized')) {
            history.pushState({ view: 'share-overlay' }, '', window.location.hash || '#player');
            _shareHistoryPushed = true;
        }
    }

    /* Capture-phase listener runs before the app's main popstate handler, so when
       the share card is open we close it and stop the fullscreen player from
       being torn down by the app's own back-navigation logic. */
    window.addEventListener('popstate', function (e) {
        const ov = document.getElementById('bz-share-overlay');
        if (_shareHistoryPushed && ov && ov.classList.contains('active')) {
            closeShareModal(true);
            e.stopImmediatePropagation();
        }
    }, true);

    window.openShareModal = async function (album) {
        currentAlbum = album || window.currentAlbum;
        offscreenCanvas = null; lastBlob = null;
        if (!currentAlbum) return;
        await autoPickTheme(currentAlbum.imageUrl || currentAlbum.albumCover);
        injectModalShell();
        const headerSpan = document.querySelector('#bz-share-overlay .bz-share-header-title span');
        if (headerSpan) headerSpan.textContent = 'Share Album';
        document.getElementById('bz-share-overlay').classList.add('active');
        document.body.style.overflow = 'hidden';
        document.querySelectorAll('.bz-style-tab').forEach(t => t.classList.toggle('active', t.dataset.style === currentThemeId));
        document.querySelectorAll('.bz-ratio-tab').forEach(t => t.classList.toggle('active', t.dataset.ratio === currentRatioId));
        pushShareHistoryIfFullscreen();
        triggerRender();
    };

    window.openShareSongModal = async function (song) {
        if (!song) return;

        const albumData = window.allSongsMap?.get(String(song.id))?.album
            || song._sourceAlbum
            || window.playingAlbum
            || {};

        const singleSongAlbum = {
            id: song.id,
            title: song.title || 'Unknown Song',
            name: song.title || 'Unknown Song',
            songs: [{ title: song.title, duration: song.duration }],
            imageUrl: albumData.imageUrl || albumData.albumCover || '',
            albumCover: albumData.imageUrl || albumData.albumCover || '',
            year: albumData.year || '',
            type: 'Song',
            _isSingleSong: true,
            _artistName: song.artist || '',
            _albumName: albumData.title || albumData.name || '',
        };

        currentAlbum = singleSongAlbum;
        offscreenCanvas = null; lastBlob = null;

        await autoPickTheme(singleSongAlbum.imageUrl || singleSongAlbum.albumCover);

        injectModalShell();

        const headerSpan = document.querySelector('#bz-share-overlay .bz-share-header-title span');
        if (headerSpan) headerSpan.textContent = 'Share Song';

        document.getElementById('bz-share-overlay').classList.add('active');
        document.body.style.overflow = 'hidden';
        document.querySelectorAll('.bz-style-tab').forEach(t => t.classList.toggle('active', t.dataset.style === currentThemeId));
        document.querySelectorAll('.bz-ratio-tab').forEach(t => t.classList.toggle('active', t.dataset.ratio === currentRatioId));
        pushShareHistoryIfFullscreen();
        triggerRender();
    };

    /* ═══════════════════════════════════════════════════════
       WIRE UP
    ═══════════════════════════════════════════════════════ */
    function wireShareButton() {
        const root = document.getElementById('album-view-container') || document.body;
        root.addEventListener('click', e => {
            if (!e.target.closest('.share-album-btn')) return;
            e.stopPropagation(); window.openShareModal(window.currentAlbum);
        });
        document.addEventListener('click', e => {
            if (!e.target.closest('#share-status')) return;
            e.stopPropagation(); window.openShareModal(window.playingAlbum || window.currentAlbum);
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireShareButton);
    else wireShareButton();

})();

/* ================================================================
   PLAYLIST SECTION NAV BAR
   Shows below the top nav when the Playlists tab is active.
   Pills scroll to: Your Playlists · Playlists Made for You ·
   Recommended for Today · Beat Zen Universe · Artists · Listen Again
   Active pill tracks whichever section is nearest the top of the
   viewport — same pattern as the Year Jump Bar.
   ================================================================ */
(function () {
    'use strict';

    /* ── DOM refs ── */
    var navBar, navInner, pills;

    function initRefs() {
        navBar = document.getElementById('bz-playlist-nav-bar');
        navInner = document.getElementById('bz-playlist-nav-inner');
        pills = navInner ? Array.from(navInner.querySelectorAll('.bz-playlist-nav-pill')) : [];
    }

    /* ── Is the Playlists tab currently the visible view? ── */
    function isPlaylistsActive() {
        var pc = document.getElementById('playlists-container');
        if (!pc) return false;
        return pc.style.display !== 'none' && !pc.classList.contains('hidden');
    }

    /* ── Total fixed header height (navbar + this bar when visible) ── */
    function getOffset() {
        var navH = (document.querySelector('.navbar') || { offsetHeight: 70 }).offsetHeight;
        var barH = (navBar && isPlaylistsActive()) ? (navBar.offsetHeight || 0) : 0;
        return navH + barH + 8;
    }

    /* ── Push <main> down by bar height so content isn't hidden under it ── */
    /* ── Show / hide bar; toggle padding class on playlists-container ── */
    var _barCurrentlyVisible = false;

    function syncVisibility() {
        if (!navBar) return;
        var on = isPlaylistsActive();
        if (on === _barCurrentlyVisible) return;
        _barCurrentlyVisible = on;
        navBar.style.display = on ? 'flex' : 'none';
        var pc = document.getElementById('playlists-container');
        if (pc) pc.classList.toggle('bzp-nav-visible', on);
        if (on) highlightVisible();
    }

    /* ── Stamp stable IDs on freshly rendered sections ── */
    /* "Your Playlists" section is the first .dp-section inside
       #playlists-container and has no id set by script.js */
    function stampSectionIds() {
        var pc = document.getElementById('playlists-container');
        if (!pc) return;

        /* Your Playlists */
        var yourSec = pc.querySelector('.dp-section');
        if (yourSec && !yourSec.id) yourSec.id = 'bzp-your-playlists';

        /* Playlists Made for You — first .bzp-section inside smart wrap */
        var smartWrap = document.getElementById('bz-smart-playlists-wrap');
        if (smartWrap) {
            var sections = smartWrap.querySelectorAll('.bzp-section');
            if (sections[0] && !sections[0].id) sections[0].id = 'bzp-mfy-section';
            /* Recommended for Today is the second .bzp-section */
            if (sections[1] && !sections[1].id) sections[1].id = 'bzp-rec-section';
        }
        /* bzp-universe-wrap, bzp-artists-section, bzp-heroes-section, bzp-la-section
           already have IDs set by playlists.js — nothing to do */
    }

    /* ── Smooth-scroll to a target section ── */
    function scrollToSection(targetId) {
        stampSectionIds();
        var el = document.getElementById(targetId);
        if (!el) return;
        var offset = getOffset();
        var top = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }

    /* ── Set the active pill ── */
    function setActive(pill) {
        pills.forEach(function (p) { p.classList.remove('active'); });
        if (pill) {
            pill.classList.add('active');
            /* Auto-scroll the pill into view inside the inner scroller */
            var pillLeft = pill.offsetLeft;
            var pillW = pill.offsetWidth;
            var barW = navInner ? navInner.offsetWidth : 0;
            if (navInner) navInner.scrollTo({ left: pillLeft - barW / 2 + pillW / 2, behavior: 'smooth' });
        }
    }

    /* ── Highlight whichever section is closest to the top of viewport ── */
    var _scrolling = false;
    var _scrollTimer = null;

    function highlightVisible() {
        if (!isPlaylistsActive() || _scrolling) return;
        stampSectionIds();
        var offset = getOffset();
        var current = null;
        var targets = ['bzp-your-playlists', 'bzp-mfy-section', 'bzp-rec-section', 'bzp-universe-wrap', 'bzp-artists-section', 'bzp-heroes-section', 'bzp-la-section'];
        targets.forEach(function (id) {
            var el = document.getElementById(id);
            if (el && el.getBoundingClientRect().top <= offset + 30) current = id;
        });
        pills.forEach(function (p) {
            p.classList.toggle('active', p.getAttribute('data-target') === current);
        });
        /* Auto-scroll active pill into view */
        var activePill = navInner ? navInner.querySelector('.bz-playlist-nav-pill.active') : null;
        if (activePill && navInner) {
            var pillLeft = activePill.offsetLeft;
            var pillW = activePill.offsetWidth;
            var barW = navInner.offsetWidth;
            navInner.scrollTo({ left: pillLeft - barW / 2 + pillW / 2, behavior: 'smooth' });
        }
    }

    /* ── Wire pill clicks ── */
    function bindPills() {
        pills.forEach(function (pill) {
            pill.addEventListener('click', function () {
                var target = pill.getAttribute('data-target');
                setActive(pill);
                _scrolling = true;
                clearTimeout(_scrollTimer);
                _scrollTimer = setTimeout(function () { _scrolling = false; }, 900);
                scrollToSection(target);
            });
        });
    }

    /* ── Scroll listener ── */
    var _ticking = false;
    window.addEventListener('scroll', function () {
        if (_ticking) return;
        _ticking = true;
        requestAnimationFrame(function () {
            highlightVisible();
            _ticking = false;
        });
    }, { passive: true });

    /* ── Watch playlists-container for tab switches and re-renders ── */
    function observePlaylistsTab() {
        var pc = document.getElementById('playlists-container');
        if (!pc) return;

        /* Show/hide bar when display style changes (tab switch) */
        new MutationObserver(function () {
            syncVisibility();
        }).observe(pc, { attributes: true, attributeFilter: ['style', 'class'] });

        /* Re-stamp IDs whenever content is re-rendered (childList) */
        new MutationObserver(function () {
            if (isPlaylistsActive()) {
                setTimeout(function () {
                    stampSectionIds();
                    highlightVisible();
                }, 60);
            }
        }).observe(pc, { childList: true, subtree: false });
    }

    /* ── Init ── */
    function init() {
        initRefs();
        bindPills();
        observePlaylistsTab();
        syncVisibility();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

/* ============================================================
   Scripts extracted from index.html inline <script> blocks
   ============================================================ */

/* ── Extracted inline script block ── */
function toggleAboutDetails() {
    const details = document.getElementById('about-details');
    const label = document.getElementById('know-more-label');
    const icon = document.getElementById('know-more-icon');
    const isOpen = details.classList.contains('stg-about-details--open');
    if (isOpen) {
        details.classList.remove('stg-about-details--open');
        label.textContent = 'Know More';
        icon.style.transform = 'rotate(0deg)';
    } else {
        details.classList.add('stg-about-details--open');
        label.textContent = 'Show Less';
        icon.style.transform = 'rotate(180deg)';
    }
}

function toggleContactDetails() {
    const details = document.getElementById('contact-details');
    const label = document.getElementById('contact-us-label');
    const icon = document.getElementById('contact-us-icon');
    const isOpen = details.classList.contains('stg-about-details--open');
    if (isOpen) {
        details.classList.remove('stg-about-details--open');
        label.textContent = 'Contact Us';
        icon.style.transform = 'rotate(0deg)';
    } else {
        details.classList.add('stg-about-details--open');
        label.textContent = 'Show Less';
        icon.style.transform = 'rotate(180deg)';
    }
}

/* ── Extracted inline script block ── */
(function () {
    var _bzAllowed = ['beatzen.in', 'www.beatzen.in', 'beatzen.app', 'www.beatzen.app',
        'mr-ruthwik.github.io' /* GitHub Pages test deployment — remove once no longer needed */];
    var _onAllowed = _bzAllowed.indexOf(location.hostname) !== -1;

    /* 1. Register service worker
       FIX: register with relative paths (resolved against the page's own URL)
       instead of absolute "/..." paths. Absolute paths assume the site is
       served from the domain root — they break under a subpath deployment
       like GitHub Pages project sites (https://user.github.io/RepoName/),
       where "/notifications-control.js" resolves to the wrong location
       entirely. Relative paths resolve correctly both at a domain root and
       under a subpath. */
    if ('serviceWorker' in navigator && _onAllowed) {
        window.addEventListener('load', function () {
            navigator.serviceWorker.register('notifications-control.js', { scope: './' })
                .catch(function (err) { console.warn('Beat Zen SW:', err); });
        });
    }

    /* ── Shared deferred prompt — set by beforeinstallprompt ── */
    var _deferred = null;

    /* ── 3-second beforeinstallprompt timeout handle ── */
    var _bipTimer = null;

    /* ── Detect current state ── */
    var _isStandalone = window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;
    var _wasInstalled = false;
    try { _wasInstalled = localStorage.getItem('bz_app_installed') === '1'; } catch (_) { }

    /* Set true only when we concluded "installed" from beforeinstallprompt
       NOT firing (the _bipTimer / _showInstallUnavailableHint heuristics),
       rather than from a real getInstalledRelatedApps()/matchMedia signal.
       _resolveInstalled() below trusts this and skips re-asking the live
       API on every poll tick — otherwise the tick immediately after the
       heuristic fires would call getInstalledRelatedApps(), see it disagree
       (that disagreement is *why* the heuristic fired), and flip the UI
       straight back to "Install" within ~1s. Cleared the moment
       beforeinstallprompt fires for real — see that handler below. */
    var _assumedInstalled = false;
    try { _assumedInstalled = localStorage.getItem('bz_assumed_installed') === '1'; } catch (_) { }

    /* Track whether user dismissed the nudge this session */
    var _nudgeDismissed = false;

    var _isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    var _isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    /* Does this browser support a LIVE installed-check?
       NOTE: _onAllowed gate removed — getInstalledRelatedApps works on
       any origin as long as related_applications are listed in manifest. */
    var _hasLiveCheck = 'getInstalledRelatedApps' in navigator;

    /* Current install status — true = installed, false = not installed, null = unknown */
    var _currentlyInstalled = null;

    /* ── Polling interval handle ── */
    var _pollInterval = null;
    var _POLL_MS = 1000; /* check every 1 second */

    /* ════════════════════════════════════════════════════════════════
       FIREBASE INSTALL TRACKING
       Mirrors this device's install status into Firestore so it can be
       checked across sessions/devices for a signed-in account. Firestore
       is a SECONDARY record — the local live-check above (matchMedia /
       getInstalledRelatedApps) stays the authority for "is it installed
       on THIS device right now", because a webpage has no way to be
       notified that a PWA was uninstalled from the home screen while the
       page wasn't open. We simply keep Firestore in sync with whatever
       that local check already resolved, plus log the Install button
       click itself.
       Requires a signed-in user (auth.currentUser) — writes are skipped
       for guests since there's no uid to key the document on.
       ════════════════════════════════════════════════════════════════ */
    var FIRESTORE_INSTALLS_COLLECTION = 'beatzen_installs';

    /* Stable per-browser id so one account can have multiple devices
       tracked separately (installing on your phone shouldn't make the
       site think it's installed on your laptop too). */
    function _bzGetDeviceId() {
        try {
            var id = localStorage.getItem('bz_device_id');
            if (!id) {
                id = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
                localStorage.setItem('bz_device_id', id);
            }
            return id;
        } catch (_) {
            return 'dev_unknown';
        }
    }
    var _bzDeviceId = _bzGetDeviceId();

    /* script.js runs BEFORE the Firebase SDK / auth.js in this page's
       <script> order (see index.html), so `auth`, `db`, and
       `window.bzAuthReady` don't exist yet the instant this file's
       top-level code runs. This polls until auth.js has declared
       bzAuthReady, then waits for it to resolve (Firebase's first
       auth-state check), so `auth.currentUser` is reliably known before
       any Firestore call is made. Gives up gracefully after ~10s. */
    function _bzWaitForAuthReady(cb) {
        var tries = 0;
        (function poll() {
            if (window.bzAuthReady) { window.bzAuthReady.then(function () { cb(); }); return; }
            if (++tries > 200) { cb(); return; }
            setTimeout(poll, 50);
        })();
    }

    /* Merges fields onto this device's entry at
       beatzen_installs/{uid}.devices.{deviceId}. Uses set(..., {merge:true})
       with a nested object so it only touches this one device's fields —
       other devices on the same account, and other fields on this device,
       are left untouched. Never throws into the caller; install tracking
       must not be able to break the actual install flow. */
    function _bzWriteInstallStatus(fields) {
        _bzWaitForAuthReady(function () {
            try {
                if (typeof db === 'undefined' || typeof auth === 'undefined' || !auth.currentUser) return;
                var deviceFields = Object.assign({
                    platform: navigator.platform || '',
                    userAgent: navigator.userAgent || ''
                }, fields);
                var nested = { devices: {}, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
                nested.devices[_bzDeviceId] = deviceFields;
                db.collection(FIRESTORE_INSTALLS_COLLECTION).doc(auth.currentUser.uid)
                    .set(nested, { merge: true })
                    .catch(function (err) { console.warn('[BeatZen] install-status Firestore write failed:', err && err.message); });
            } catch (err) {
                console.warn('[BeatZen] install-status Firestore write skipped:', err && err.message);
            }
        });
    }

    /* Reads this device's last-known status back from Firestore.
       Callback receives the device's field object, or null if signed
       out / no record / read failed. */
    function _bzReadInstallStatus(cb) {
        _bzWaitForAuthReady(function () {
            try {
                if (typeof db === 'undefined' || typeof auth === 'undefined' || !auth.currentUser) { cb(null); return; }
                db.collection(FIRESTORE_INSTALLS_COLLECTION).doc(auth.currentUser.uid).get()
                    .then(function (snap) {
                        var data = snap && snap.exists ? snap.data() : null;
                        cb((data && data.devices && data.devices[_bzDeviceId]) || null);
                    })
                    .catch(function (err) {
                        console.warn('[BeatZen] install-status Firestore read failed:', err && err.message);
                        cb(null);
                    });
            } catch (err) { cb(null); }
        });
    }

    function _persist(flag) {
        try {
            if (flag) localStorage.setItem('bz_app_installed', '1');
            else localStorage.removeItem('bz_app_installed');
        } catch (_) { }
        _wasInstalled = flag;
    }

    function _persistAssumed(flag) {
        try {
            if (flag) localStorage.setItem('bz_assumed_installed', '1');
            else localStorage.removeItem('bz_assumed_installed');
        } catch (_) { }
        _assumedInstalled = flag;
    }

    /* ── Show the "Already Installed" row, hide the "Install" row ── */
    function _showInstalledState() {
        var installItem = document.getElementById('bz-install-setting-item');
        var installedItem = document.getElementById('bz-installed-setting-item');
        if (installItem) installItem.style.display = 'none';
        if (installedItem) installedItem.style.display = '';
        /* Force-hide the nudge banner immediately (no transition race) */
        if (typeof _hideNudgeForce === 'function') _hideNudgeForce();
        else _hideNudge();
        /* Update live status text in settings */
        var desc = document.getElementById('bz-installed-setting-desc');
        if (desc) desc.textContent = 'Beat Zen is installed on your device ✓';
    }

    /* ── Show the "Install" row, hide the "Already Installed" row ── */
    function _showInstallState() {
        var installItem = document.getElementById('bz-install-setting-item');
        var installedItem = document.getElementById('bz-installed-setting-item');
        if (installItem) installItem.style.display = '';
        if (installedItem) installedItem.style.display = 'none';
        /* Show the nudge banner (unless dismissed this session) */
        if (!_nudgeDismissed) _showNudge();
    }

    /* ── Nudge banner helpers ── */
    function _showNudge() {
        /* Don't show while in standalone / if user dismissed */
        if (_isStandalone || _nudgeDismissed) return;
        var nudge = document.getElementById('bz-install-nudge');
        if (!nudge) return;
        nudge.classList.add('bz-nudge-visible');
    }

    function _hideNudge() {
        var nudge = document.getElementById('bz-install-nudge');
        if (!nudge) return;
        nudge.style.animation = 'none';
        nudge.style.opacity = '0';
        nudge.style.transform = 'translateX(-50%) translateY(20px)';
        nudge.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
        setTimeout(function () {
            nudge.classList.remove('bz-nudge-visible');
            nudge.style.cssText = ''; /* reset inline so CSS class re-applies cleanly next time */
        }, 260);
    }

    /* ── Core install-status resolver ── */
    /* Returns a Promise<boolean> — true = installed */
    function _resolveInstalled() {
        /* Re-check standalone LIVE on every tick — not just at startup.
           _isStandalone is frozen at page-load; this re-reads it dynamically
           so installing the PWA mid-session is detected without a refresh. */
        var _liveStandalone = window.matchMedia('(display-mode: standalone)').matches
            || window.navigator.standalone === true;
        if (_liveStandalone) return Promise.resolve(true);

        /* Trust a prior "assumed installed" heuristic conclusion over the
           live API — see _assumedInstalled declaration above for why. */
        if (_assumedInstalled) return Promise.resolve(true);

        /* Prefer getInstalledRelatedApps when available (Chromium ≥85) */
        if (_hasLiveCheck) {
            return navigator.getInstalledRelatedApps()
                .then(function (apps) { return !!(apps && apps.length > 0); })
                .catch(function () { return _wasInstalled; });
        }

        /* Fallback: use the localStorage flag (set by appinstalled event) */
        return Promise.resolve(_wasInstalled);
    }

    /* ── Instant detection via matchMedia display-mode change ──────────────
       Fires the moment the browser switches to/from standalone mode,
       i.e. immediately when the user launches/uninstalls the PWA.
       This is the most reliable cross-browser real-time signal. */
    (function _bzWatchDisplayMode() {
        var mql = window.matchMedia('(display-mode: standalone)');
        var _onChange = function (e) {
            _currentlyInstalled = null; /* force re-evaluate on next tick */
            _tick();                    /* fire immediately — don’t wait for interval */
        };
        if (mql.addEventListener) {
            mql.addEventListener('change', _onChange);
        } else if (mql.addListener) {
            mql.addListener(_onChange); /* Safari <14 fallback */
        }
    })();

    /* ── The polling tick — runs every _POLL_MS ms ── */
    function _tick() {
        _resolveInstalled().then(function (installed) {
            if (installed === _currentlyInstalled) return; /* no change — skip DOM work */
            _currentlyInstalled = installed;
            if (installed) {
                _persist(true);
                _showInstalledState();
                _bzWriteInstallStatus({ installed: true, installedAt: firebase.firestore.FieldValue.serverTimestamp() });
            } else {
                _persist(false);
                _showInstallState();
                _bzWriteInstallStatus({ installed: false, uninstalledAt: firebase.firestore.FieldValue.serverTimestamp() });
            }
        });
    }

    /* ── Start / stop polling ── */
    function _startPolling() {
        if (_pollInterval) return; /* already running */
        _pollInterval = setInterval(_tick, _POLL_MS);
    }

    function _stopPolling() {
        if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null; }
    }

    /* 2. Apply initial state as soon as DOM is ready */
    function _applyInitialState() {
        /* Instant best-guess from cached signal */
        if (_isStandalone) {
            _persist(true);
            _currentlyInstalled = true;
            _showInstalledState();
        } else if (_wasInstalled) {
            _currentlyInstalled = true;
            _showInstalledState();

            /* ── One-time revalidation of an "assumed installed" guess ──
               _resolveInstalled()'s per-tick short-circuit on
               _assumedInstalled exists to stop the heuristic fighting the
               live API within a session (see its declaration above) — but
               that also means, left unchecked, it would never again learn
               about a real uninstall that happens between visits, since
               nothing but beforeinstallprompt firing again clears it, and
               Chrome can delay/throttle that event. So on every FRESH page
               load only (not on every poll tick), if the current "installed"
               belief rests on the assumption rather than a real signal,
               ask the live API once and correct immediately if it disagrees.
               If it agrees (or errors), leave things as they are. */
            if (_assumedInstalled && _hasLiveCheck) {
                navigator.getInstalledRelatedApps().then(function (apps) {
                    if (!(apps && apps.length > 0)) {
                        _persistAssumed(false);
                        _persist(false);
                        _currentlyInstalled = false;
                        _showInstallState();
                        _bzWriteInstallStatus({ installed: false, uninstalledAt: firebase.firestore.FieldValue.serverTimestamp() });
                    }
                }).catch(function () { /* inconclusive — leave the assumption as-is */ });
            }
        } else {
            _currentlyInstalled = false;
            _showInstallState();

            /* ── Firestore fallback (narrow case) ─────────────────────────
               Covers a device where `bz_app_installed` got cleared from
               localStorage (e.g. storage was wiped) but `bz_device_id`
               survived, so this device still matches a Firestore record.
               It does NOT help if both were cleared together (the more
               common case for "cleared storage"), since a fresh device id
               won't match any existing Firestore entry — the local
               live-check above/below remains the real source of truth for
               whether THIS device currently has it installed. */
            _bzReadInstallStatus(function (deviceData) {
                if (deviceData && deviceData.installed && _currentlyInstalled === false) {
                    _persist(true);
                    _currentlyInstalled = true;
                    _showInstalledState();
                }
            });

            /* ── beforeinstallprompt timeout (Chromium only) ─────────────────
               Chrome fires beforeinstallprompt only when the PWA is NOT yet
               installed. If 3 s pass without it firing AND no deferred prompt
               exists, the app is almost certainly already installed (Chrome
               suppresses the event for installed PWAs). This heuristic patches
               the async gap while getInstalledRelatedApps() is still pending.
               Guarded by _hasLiveCheck so it only runs on Chromium ≥85. */
            if (_hasLiveCheck) {
                _bipTimer = setTimeout(function () {
                    if (!_deferred && _currentlyInstalled === false) {
                        _persist(true);
                        _persistAssumed(true);
                        _currentlyInstalled = true;
                        _showInstalledState();
                    }
                }, 3000);
            }
        }

        /* Wire the settings Install button (non-iOS) */
        if (!_isIOS || !_isSafari) {
            var btn = document.getElementById('bz-settings-install-btn');
            if (btn && !btn._bzWired) {
                btn._bzWired = true;
                btn.onclick = _triggerInstall;
            }
        }

        /* iOS Safari: update install button to show instructions */
        if (_isIOS && _isSafari && !(_isStandalone || _wasInstalled)) {
            var desc = document.getElementById('bz-install-setting-desc');
            if (desc) desc.textContent = 'Tap Share → "Add to Home Screen" in Safari';
            var btn = document.getElementById('bz-settings-install-btn');
            if (btn) {
                btn.innerHTML = '<i class="fas fa-circle-info"></i> How';
                btn.onclick = _showIOSBanner;
            }
            /* iOS nudge: update to "How to Install" text */
            var ndesc = document.getElementById('bz-nudge-desc');
            if (ndesc) ndesc.textContent = 'Tap Share → "Add to Home Screen" in Safari';
            var nBtn = document.getElementById('bz-nudge-install-btn');
            if (nBtn) {
                nBtn.innerHTML = '<i class="fas fa-circle-info"></i> How';
                nBtn.onclick = function () { _showIOSBanner(); _hideNudge(); };
            }
        }

        /* Wire the nudge install button */
        var nBtn = document.getElementById('bz-nudge-install-btn');
        if (nBtn && !nBtn._bzWired && !(_isIOS && _isSafari)) {
            nBtn._bzWired = true;
            nBtn.onclick = function () { _triggerInstall(); };
        }

        /* Wire the nudge close button */
        var nClose = document.getElementById('bz-nudge-close-btn');
        if (nClose && !nClose._bzWired) {
            nClose._bzWired = true;
            nClose.onclick = function () {
                _nudgeDismissed = true;
                _hideNudge();
            };
        }

        /* ── Start the 1-second polling loop ── */
        _startPolling();
        /* Immediate first tick to override the cached guess */
        _tick();

        /* ── Check if we just installed and should scroll to Settings ── */
        _checkJustInstalled();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _applyInitialState);
    } else {
        _applyInitialState();
    }

    /* Pause polling while tab is hidden; resume + immediate tick on return */
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') {
            _startPolling();
            _tick(); /* instant refresh without waiting for next interval */
        } else {
            _stopPolling(); /* save battery / CPU when tab is in background */
        }
    });

    /* Extra immediate tick on window focus (switching app → browser) */
    window.addEventListener('focus', function () { _tick(); });

    /* 3. Android / Desktop — capture beforeinstallprompt. */
    window.addEventListener('beforeinstallprompt', function (e) {
        /* beforeinstallprompt fired → app is NOT installed; cancel the
           3-second "assume installed" timer so it doesn't flip the UI. */
        clearTimeout(_bipTimer);
        _bipTimer = null;
        e.preventDefault();
        _deferred = e;

        /* beforeinstallprompt firing is concrete evidence the browser
           considers the app NOT installed — strong enough to clear any
           earlier "assumed installed" heuristic conclusion. */
        if (_assumedInstalled) _persistAssumed(false);

        /* Wire settings button */
        var btn = document.getElementById('bz-settings-install-btn');
        if (btn && !btn._bzWired) {
            btn._bzWired = true;
            btn.onclick = _triggerInstall;
        }

        /* Wire nudge button */
        var nBtn = document.getElementById('bz-nudge-install-btn');
        if (nBtn && !nBtn._bzWired) {
            nBtn._bzWired = true;
            nBtn.onclick = function () { _triggerInstall(); };
        }

        if (_hasLiveCheck) return; /* live check / polling owns the UI */
        if (_isStandalone || _wasInstalled) return;
        _currentlyInstalled = false;
        _showInstallState();
    });

    /* 4. After install confirmed → switch immediately to "Already Installed" */
    window.addEventListener('appinstalled', function () {
        _persist(true);
        _deferred = null;
        _currentlyInstalled = true;
        _hideNudgeForce(); /* kill nudge instantly — no "Installing…" stuck state */
        _showInstalledState();
        /* Redundant with the write in _triggerInstall's userChoice handler —
           set(...,{merge:true}) makes this idempotent, and appinstalled is
           the one signal that also covers install paths that didn't go
           through our button (e.g. the browser's own omnibox install icon). */
        _bzWriteInstallStatus({ installed: true, installedAt: firebase.firestore.FieldValue.serverTimestamp() });
    });

    /* ── Feedback shown when Install is clicked but there's no prompt to
       trigger yet. Temporarily swaps the button label/icon, then restores
       it — mirrors the existing progress-label pattern used during a real
       install so it doesn't need any new toast/UI dependency. ── */
    function _showInstallUnavailableHint(sBtn, nBtn) {
        function flash(msg, icon) {
            [sBtn, nBtn].forEach(function (btn) {
                if (!btn) return;
                var original = btn.innerHTML;
                btn.innerHTML = icon + msg;
                setTimeout(function () { btn.innerHTML = original; }, 2600);
            });
        }

        if (_isIOS && !_isSafari) {
            /* iOS only supports the install prompt inside Safari itself */
            flash('Open in Safari to install', '<i class="fas fa-circle-info"></i> ');
            return;
        }

        if (_hasLiveCheck) {
            /* Chrome/Edge only fire beforeinstallprompt when the PWA is NOT
               already installed — the same signal the 3s _bipTimer above
               relies on to auto-flip the UI. If Install still gets clicked
               with _deferred null (e.g. right inside that 3s window before
               the timer runs), treat it the same way _bipTimer would a
               moment later: the app is already installed. Flip straight to
               the persistent "Installed" state — in Settings this swaps
               "Install Beat Zen / Add to your home screen…" over to
               "Beat Zen Installed" — rather than just flashing a label on
               the button, since _showInstalledState() hides both sBtn and
               nBtn immediately anyway, so a temporary text swap on them
               would never actually be seen. */
            _persist(true);
            _persistAssumed(true);
            _currentlyInstalled = true;
            _showInstalledState();
            _bzWriteInstallStatus({ installed: true, installedAt: firebase.firestore.FieldValue.serverTimestamp() });
            return;
        }

        /* Firefox / desktop Safari: no getInstalledRelatedApps and no live
           display-mode signal to lean on, so a null _deferred here can't be
           told apart from "this browser just doesn't support the install
           prompt at all" — don't claim installed when we're not sure. */
        flash('Not ready yet — try again shortly', '<i class="fas fa-circle-info"></i> ');
    }

    /* ── Trigger the browser install dialog ── */
    function _triggerInstall() {
        var sBtn = document.getElementById('bz-settings-install-btn');
        var nBtn = document.getElementById('bz-nudge-install-btn');

        /* Log the click immediately, regardless of what happens next — this
           only records that the user tapped Install, not that anything was
           actually installed (that's written separately, only on a real
           accepted outcome, further below). */
        _bzWriteInstallStatus({
            clicked: true,
            clickedAt: firebase.firestore.FieldValue.serverTimestamp(),
            promptAvailable: !!_deferred
        });

        /* FIX: previously this just did `if (!_deferred) return;` — if the
           browser hadn't fired beforeinstallprompt yet (very common: Chrome
           only fires it once its own engagement/installability heuristics are
           met, and it never fires at all on iOS Chrome or in browsers that
           don't support the install prompt), clicking "Install" silently did
           nothing with zero feedback, which reads as "the button isn't
           clicking". Now we tell the person what's going on instead. */
        if (!_deferred) {
            _showInstallUnavailableHint(sBtn, nBtn);
            return;
        }

        /* ── Fixed 10s "Downloading…" bar ──────────────────────────────
           This is a cosmetic pacing device, not a real download — a PWA
           install has no multi-second download stage of its own, and the
           actual install is entirely decided by the native dialog `.prompt()`
           opens below. We run the real prompt AND this 10s bar in parallel,
           then only finish once BOTH are done — so the bar always shows for
           a believable 10s, but we never report "installed" to Firestore or
           the UI unless the user genuinely accepted the native dialog. */
        var DOWNLOAD_MS = 10000;
        var _startTime = Date.now();
        var _pct = 0;
        var _progressInterval = null;
        var _minDurationDone = false;
        var _realOutcome = null; /* set to 'accepted' | 'dismissed' once userChoice resolves */

        function _setProgress(pct, label) {
            _pct = pct;
            var text = (label || 'Downloading\u2026') + ' ' + pct + '%';
            var icon = '<i class="fas fa-spinner fa-spin" style="margin-right:6px;"></i>';
            if (sBtn) { sBtn.innerHTML = icon + text; sBtn.disabled = true; }
            if (nBtn) { nBtn.innerHTML = icon + text; nBtn.disabled = true; }
        }

        _setProgress(0);
        _progressInterval = setInterval(function () {
            var elapsed = Date.now() - _startTime;
            _setProgress(Math.min(96, Math.round((elapsed / DOWNLOAD_MS) * 96)));
            if (elapsed >= DOWNLOAD_MS) {
                _minDurationDone = true;
                clearInterval(_progressInterval);
                _progressInterval = null;
                _maybeFinish();
            }
        }, 100);

        /* The real native install dialog — this is what actually installs
           the app. The bar above is purely visual and doesn't install
           anything by itself. */
        _deferred.prompt();
        _deferred.userChoice.then(function (r) {
            _realOutcome = r.outcome; /* 'accepted' or 'dismissed' */
            _deferred = null;
            _maybeFinish();
        });

        function _maybeFinish() {
            if (!_minDurationDone || _realOutcome === null) return; /* still waiting on one of the two */
            if (_progressInterval) { clearInterval(_progressInterval); _progressInterval = null; }

            if (_realOutcome === 'accepted') {
                _setProgress(100, 'Installing');
                setTimeout(function () {
                    var doneIcon = '<i class="fas fa-check-circle" style="margin-right:6px;color:#1db954;"></i>';
                    if (sBtn) { sBtn.innerHTML = doneIcon + 'Installed!'; }
                    if (nBtn) { nBtn.innerHTML = doneIcon + 'Installed!'; }

                    _bzWriteInstallStatus({ installed: true, installedAt: firebase.firestore.FieldValue.serverTimestamp() });
                    /* Flag so post-reload we know to scroll to install section */
                    try { localStorage.setItem('bz_just_installed', '1'); } catch (_) { }
                    _persist(true);
                    _currentlyInstalled = true;
                    _hideNudgeForce();

                    setTimeout(function () {
                        /* Best-effort only — browsers block window.close() on
                           any tab the page itself didn't open via
                           window.open(), which is true for almost every real
                           visit (typed URL, bookmark, link from another
                           site), so this will silently no-op most of the
                           time; there is no permission a user can grant to
                           allow it. Reload is the real fallback that always
                           works, and lands them on the "Installed" state.
                           On desktop Chrome/Edge the browser already opens
                           the newly-installed app in its own window
                           automatically once accepted — no JS needed for
                           that. There is no equivalent JS API to force-launch
                           an installed PWA on Android, and iOS has no
                           install-prompt API at all, so neither of those can
                           be triggered from here. */
                        try { window.close(); } catch (_) { }
                        location.reload();
                    }, 1200);
                }, 350);

            } else {
                /* User dismissed the real dialog — nothing was installed.
                   The click was already logged above; deliberately NOT
                   writing installed:true here. */
                if (sBtn) { sBtn.innerHTML = '<i class="fas fa-plus"></i> Install'; sBtn.disabled = false; }
                if (nBtn) { nBtn.innerHTML = '<i class="fas fa-plus"></i> Install'; nBtn.disabled = false; }
            }
        }
    }

    /* ── Post-reload: if bz_just_installed flag is set, navigate to
       Settings and scroll to the Install section with a highlight ── */
    function _checkJustInstalled() {
        try {
            if (localStorage.getItem('bz_just_installed') !== '1') return;
            localStorage.removeItem('bz_just_installed');
        } catch (_) { return; }

        /* Poll for displaySettings (defined by script.js which loads async) */
        var _tries = 0;
        var _maxTries = 120; /* up to ~4 s */

        function _goToSettings() {
            _tries++;
            if (typeof window.displaySettings === 'function') {
                window.displaySettings(true);
            } else {
                var settingsLink = document.getElementById('settings-link');
                if (settingsLink) { settingsLink.click(); }
                else if (_tries < _maxTries) { setTimeout(_goToSettings, 35); return; }
            }
            /* After settings tab is active, scroll to install section */
            setTimeout(function () {
                var installSection = document.getElementById('bz-install-setting-section');
                if (!installSection && _tries < _maxTries) { setTimeout(_goToSettings, 100); return; }
                if (!installSection) return;
                installSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                /* Pulse green so the user sees the installed state */
                installSection.style.transition = 'box-shadow 0.4s ease, border-radius 0.4s ease';
                installSection.style.borderRadius = '16px';
                installSection.style.boxShadow = '0 0 0 3px rgba(29,185,84,0.70), 0 8px 32px rgba(29,185,84,0.25)';
                setTimeout(function () {
                    installSection.style.boxShadow = '';
                    installSection.style.borderRadius = '';
                }, 2400);
            }, 700);
        }

        /* Give the app shell 500ms to finish rendering before navigating */
        setTimeout(_goToSettings, 500);
    }

    /* ── Force-hide nudge instantly (no transition, no race) ── */
    function _hideNudgeForce() {
        _nudgeDismissed = true; /* prevent it re-showing from _tick() */
        var nudge = document.getElementById('bz-install-nudge');
        if (!nudge) return;
        nudge.style.cssText = 'display:none !important;'; /* instant, no transition */
        nudge.classList.remove('bz-nudge-visible');
    }

    /* ── iOS manual steps banner ── */
    function _showIOSBanner() {
        var b = document.getElementById('bz-ios-banner');
        if (b) b.classList.add('visible');
    }
})();