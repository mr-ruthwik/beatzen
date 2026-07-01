// ════════════════════════════════════════════════
//  Beat Zen — Firebase Auth + Cloud Sync (auth.js)
//  Sign In  → Google only
//  Live Sync → onSnapshot listener (real-time, free reads) + debounced writes
//              every 2 s after a change — no manual Upload/Download buttons
// ════════════════════════════════════════════════

// ── Firebase Config ───────────────────────────────────────────────────────────
const firebaseConfig = {
    apiKey: "AIzaSyDdUpkeGD-imTIpiU4tSDUannXS0hIQr1w",
    // authDomain: Always use the default Firebase auth domain.
    // GitHub Pages cannot serve the /__/auth/handler endpoint that Firebase
    // requires when a custom hostname is set, so the custom-domain IIFE has
    // been removed and the value is hardcoded to the firebaseapp.com domain.
    authDomain: 'beatzen-e1112.firebaseapp.com',
    projectId: "beatzen-e1112",
    storageBucket: "beatzen-e1112.firebasestorage.app",
    messagingSenderId: "556167519281",
    appId: "1:556167519281:web:3c1fd3a58aa89802688910"
};

// ── SDK guard ─────────────────────────────────────────────────────────────────
// auth.js depends on the Firebase compat globals created by the SDK <script>
// tags in index.html. All scripts carry `defer` to preserve execution order.
if (typeof firebase === 'undefined') {
    throw new Error(
        '[BeatZen] Firebase SDK not loaded. ' +
        'auth.js must appear AFTER the three firebase-compat <script> tags in index.html ' +
        'and all four must carry the defer attribute.'
    );
}

// ── Init ──────────────────────────────────────────────────────────────────────
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// ── Firestore network control — stops Firebase from hammering the network ─────
// when the device is offline, eliminating WebChannelConnection / ERR_TIMED_OUT
// / ERR_NAME_NOT_RESOLVED errors in the console. Network is re-enabled as soon
// as connectivity returns so sync resumes automatically.
(function bzFirestoreNetworkControl() {
    function disableFS() { try { db.disableNetwork(); } catch (_) { } }
    function enableFS() { try { db.enableNetwork(); } catch (_) { } }
    window.addEventListener('offline', disableFS);
    window.addEventListener('online', enableFS);
    if (!navigator.onLine) disableFS();
})();

// Persistence: keep Google session alive across refreshes on ALL mobile browsers.
// Firebase defaults to indexedDB-backed LOCAL persistence, but several mobile
// environments silently fall back to in-memory (session-only) storage:
//   - Samsung Internet blocks indexedDB in some versions / private mode
//   - iOS WKWebView / in-app browsers have third-party storage restrictions
//   - Some Android OEM builds clear indexedDB state on navigation
// Explicitly calling setPersistence(LOCAL) forces Firebase to use localStorage
// as the underlying store, which is universally supported across all mobile
// browsers and versions. This fixes the 'sign in again after refresh' bug.
(function applyAuthPersistence() {
    try {
        auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function (e) {
            console.warn('[BeatZen] setPersistence failed (non-critical):', e.code);
        });
    } catch (e) {
        console.warn('[BeatZen] setPersistence not available:', e.message);
    }
})();

// ── Background-sync audio protection ─────────────────────────────────────────
// Prevents cloud sync / restore from interrupting active audio playback.
let _isSyncingInBackground = false;
let _audioStateBeforeSync = null;

function _bzRestoreAudio(audioEl, wasPlaying, time, rate) {
    if (!audioEl || !wasPlaying) return;
    try {
        if (audioEl.paused) {
            audioEl.currentTime = time || 0;
            audioEl.playbackRate = rate || 1;
            const p = audioEl.play();
            if (p !== undefined) p.catch(() => { });
        }
    } catch (_) { }
}

function _bzSaveAudioState() {
    const audioEl = document.getElementById('audio-player');
    return {
        el: audioEl,
        wasPlaying: !!(audioEl && !audioEl.paused && audioEl.currentTime > 0 && !audioEl.ended),
        time: audioEl?.currentTime || 0,
        rate: audioEl?.playbackRate || 1
    };
}

// ── Local-storage keys to sync ────────────────────────────────────────────────
// Order here controls the field order written to Firestore. Lightweight/identity
// fields come first; large payload fields (queue, favourites) go last so the
// Firestore document reads cleanly top-to-bottom in the Firebase console.
const SYNC_KEYS = [
    // ── Preferences ─────────────────────────────────────────────────────────
    'beatzen_dark_mode',
    'beatzen_shortcuts',
    'beatZen_shuffle',
    'beatZen_loop',
    'beatzen_automix',
    'beatzen_history',              // history enabled/disabled toggle
    'beatZen_volume',               // volume level follows user across devices
    'beatZen_activeView',           // last active tab restores on any device
    // ── Scheduled Dark Mode ── all 5 keys sync so the full schedule
    //    is restored on any device the user signs in to.
    'beatzen_schedule_dm_set',      // whether a schedule is currently active
    'beatzen_schedule_dm_enabled',  // the scheduled-DM on/off master toggle
    'beatzen_schedule_dm_days',     // JSON array of days e.g. [1,3,5] or ['daily']
    'beatzen_schedule_dm_on',       // schedule ON time as 'HH:MM' (24-hour)
    'beatzen_schedule_dm_off',      // schedule OFF time as 'HH:MM' (24-hour)
    // ── Search ──────────────────────────────────────────────────────────────
    'beatZen_recentSearches',
    'beatZen_recentSearchesEnabled',
    // ── History + Signals — synced so smart playlists (Daily Mix, Repeat Rewind,
    //    Hidden Gems, Recommended) and Favourites expansion work identically on
    //    every device. Capped at 100 entries (matches HISTORY_MAX in script.js)
    //    and 500 signals so the Firestore document stays well under 1 MB.
    'beatZen_history_auto',
    'beatZen_signals',
    'beatZen_rr_plays',             // Repeat Rewind qualifying plays (≥10 s listens, ≥3 = enters RR)
    // ── Player state ────────────────────────────────────────────────────────
    // NOTE: beatZen_currentSong/Album/AlbumName/Index/Time are legacy fields
    // never written by the app — fully replaced by lastPlayedSong. Removed from
    // SYNC_KEYS to stop uploading empty values; moved to PURGE_KEYS so existing
    // Firestore documents are cleaned on the next sync automatically.
    'beatZen_currentSongTitle',
    'beatZen_currentSongArtist',
    'beatZen_currentSongCover',
    // lastPlayedSong / beatZen_lastPosition — synced across devices so a song
    // paused (or a tab closed) on one device can be picked up on another,
    // instead of only ever restoring the locally-remembered song. These two
    // are ALSO listed in PLAYBACK_STATE_KEYS below: while this device is
    // actively playing, a remote change to either is never applied silently —
    // the user gets a "Play here" toast instead (Spotify Connect behaviour).
    // They only merge automatically when this device is idle or on fresh boot.
    'lastPlayedSong',
    'beatZen_lastPosition',
    // ── Heavy/large fields — stored with z_ prefix in Firestore so they sort
    //    to the bottom of the console view (Firestore orders fields alphabetically).
    //    localStorage keys are unchanged — only the Firestore field name differs.
    //    Mapping: beatZen_importedPlaylists→z_importedPlaylists
    //             beatZen_queueState→z_queueState, beatZen_favourites→z_favourites
    'beatZen_importedPlaylists',
    'beatZen_queueState',
    'beatZen_favourites',
];

// ── Fields removed from sync — deleted from Firestore on every upload ─────────
// These were removed intentionally; this list ensures old Firestore documents
// get cleaned up automatically on the next sync without any manual intervention.
const PURGE_KEYS = [
    '_username',                   // no longer written — purge from old Firestore docs
    '_connectionType',             // old field — removed
    // Device-specific fields removed — storage is now purely account-based
    '_deviceId',
    '_deviceType',
    '_browserName',
    '_onlineStatus',
    '_devices',                    // entire devices map — no longer used
    // NOTE: Flat dot-notation device fields like '_devices.bz_xxx.deviceId' are
    // handled separately in silentUploadToCloud() via a deep-scan purge, because
    // Firestore update() interprets dotted keys as nested paths — not literal names.
    // Legacy player-state keys replaced by lastPlayedSong — purge from old Firestore docs
    'beatZen_currentSong',
    'beatZen_currentAlbum',
    'beatZen_currentAlbumName',
    'beatZen_currentIndex',
    'beatZen_currentTime',
    // Old Firestore field names for the 3 heavy fields — replaced by z_ prefixed names.
    // Purge removes them from existing documents on the next sync automatically.
    'beatZen_importedPlaylists',
    'beatZen_queueState',
    'beatZen_favourites',
    // z_lastPlayedSong — leftover from an old app version that synced lastPlayedSong
    // to Firestore under a z_ prefixed heavy-field name. lastPlayedSong is synced
    // again today (see SYNC_KEYS), but under its plain, non-prefixed name, so this
    // old field name is still dead weight in existing Firestore documents.
    // NOTE: 'lastPlayedSong' and 'beatZen_lastPosition' themselves must NOT be
    // purge keys any more — they are live SYNC_KEYS entries now, and purging a
    // key on every upload would delete the value that same upload just wrote.
    'z_lastPlayedSong',
];

// ── Two-tier sync split ───────────────────────────────────────────────────────
// PLAYBACK_STATE_KEYS: keys that describe active playback on a specific device.
// These are NEVER silently merged while this device is actively playing — the
// user sees a "Play here" toast instead (Spotify Connect behaviour).
// Everything else in SYNC_KEYS is a preference and always merges silently.
const PLAYBACK_STATE_KEYS = new Set([
    'beatZen_queueState',
    'lastPlayedSong',
    'beatZen_lastPosition',
]);

// ── Account-based echo guard — uses _savedAt timestamp only ──────────────────
// No device IDs needed. Each upload stamps _savedAt = Date.now().
// The onSnapshot handler compares the remote _savedAt with the locally stored
// _bz_lastSavedAt to detect and skip echoes of our own write.

// ── Player-state keys — cleared on user-switch and sign-out ──────────────────
// These are the keys that paint the player bar. Clearing them prevents a
// previous user's song from being shown to the next user who signs in.
const PLAYER_STATE_KEYS = [
    'lastPlayedSong',
    'beatZen_lastPosition',
    'beatZen_currentSong',
    'beatZen_currentAlbum',
    'beatZen_currentAlbumName',
    'beatZen_currentIndex',
    'beatZen_currentTime',
    'beatZen_currentSongTitle',
    'beatZen_currentSongArtist',
    'beatZen_currentSongCover',
    'beatZen_queueState',          // FIX 2: stale queue must never bleed to next user
];

// Wipes every player-related localStorage key, resets in-memory playback
// globals, and restores the player bar to its HTML default state so the
// next user always starts with "Select a song to play".
function clearPlayerState() {
    // 1. Remove all player localStorage keys
    PLAYER_STATE_KEYS.forEach(k => localStorage.removeItem(k));

    // 2. Stop audio playback immediately.
    //    Calling .pause() fires the audioPlayer.onpause handler in script.js,
    //    which automatically calls updatePlayPauseIcon(), updateDynamicTitle(),
    //    bzSyncPlaylistsPlayBtns() and sets mediaSession.playbackState — so
    //    all card/button icons flip back to ▶ without any extra work here.
    const audioEl = document.getElementById('audio-player');
    if (audioEl) {
        audioEl.pause();
        audioEl.currentTime = 0;
        // Remove the src so the browser stops buffering the signed-out
        // user's track entirely. Wrapped in try-catch because some browsers
        // fire a benign AbortError when src is cleared mid-stream.
        try { audioEl.removeAttribute('src'); audioEl.load(); } catch (_) { }
    }

    // 3. Reset ALL playback-mode settings to OFF.
    //    Shuffle, loop and auto-mix must never carry over to the next
    //    session — the user must re-enable each one manually after sign-in.
    //    Both the localStorage value AND the in-memory flag are cleared so
    //    nothing can re-read a stale value from either source.
    localStorage.setItem('beatZen_shuffle', 'false');
    localStorage.setItem('beatZen_loop', 'false');
    localStorage.setItem('beatzen_automix', 'false');

    window.isShuffling = false;
    window.isLooping = false;
    window.shuffledIndices = null;  // discard any active shuffled order

    // Flip the shuffle / loop button highlight states back to inactive.
    if (typeof window.syncPlaybackModesUI === 'function') {
        window.syncPlaybackModesUI();
    }

    // Uncheck the Auto-Mix toggle if it is currently in the DOM.
    const autoMixToggle = document.getElementById('automix-toggle');
    if (autoMixToggle) autoMixToggle.checked = false;

    // 4. Clear the OS media session so the signed-out user's song no longer
    //    appears on the lock screen, notification shade, or headphone controls.
    if ('mediaSession' in navigator) {
        try {
            navigator.mediaSession.metadata = null;
            navigator.mediaSession.playbackState = 'none';
        } catch (_) { }
    }

    // 5. Cancel any pending history-record timer so the signed-out user's
    //    listen event is never written to history after sign-out.
    if (window._bzHistoryTimer) {
        clearTimeout(window._bzHistoryTimer);
        window._bzHistoryTimer = null;
    }
    window._bzHistoryPending = null;
    window._bzRestoreOnReady = false;

    // 6. Reset the browser-tab title back to the app name.
    document.title = 'Beat Zen';

    // 7. Reset in-memory globals so _tryRestoreSession / restoreMobileSession
    //    find nothing to restore — prevents cross-user song bleed-through even
    //    when sign-in happens on the same page load without a full reload.
    window.playingAlbum = null;
    window.currentSongIndex = -1;

    // 8. Restore the player bar to its HTML defaults.
    const titleEl = document.getElementById('player-song-title');
    const artistEl = document.getElementById('player-song-artist');
    const coverEl = document.getElementById('player-album-cover');
    if (titleEl) titleEl.textContent = 'Select a song to play';
    if (artistEl) artistEl.textContent = '';
    if (coverEl) coverEl.src =
        'https://res.cloudinary.com/beatzenapp/image/upload/v1782654641/Logo_kmpfjf.jpg';
}

// AUTO_SYNC_KEY ('beatzen_autosync') retired — replaced by AUTO_SYNC_ENABLED_KEY in wireSyncButtons section.

// ── DOM helper ────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── Panel toggle ──────────────────────────────────────────────────────────────
function showSignedOut() {
    // Remove the fast-path class so the CSS overrides from index.html <head> are
    // cancelled — this fires when Firebase confirms the user is truly signed out.
    document.documentElement.classList.remove('bz-signed-in');
    // Re-apply guest mode so navbar/player/main content are hidden and gate is shown
    document.documentElement.classList.add('bz-guest');
    const out = $('bz-auth-signedout');
    const inn = $('bz-auth-signedin');
    // bz-auth-signedout defaults to display:none in HTML (prevents flash for signed-in
    // users). We must explicitly show it here when the user is confirmed signed out.
    if (out) out.style.display = 'block';
    if (inn) inn.classList.remove('bz-auth-visible');
    // Hide cloud sync controls and all settings features until signed in
    const syncSec = $('bz-sync-section');
    if (syncSec) syncSec.style.display = 'none';
    const locked = $('bz-settings-locked');
    if (locked) locked.style.display = 'none';
    // Show the auth gate overlay
    const gate = $('bz-auth-gate');
    if (gate) gate.classList.add('bz-gate-visible');
    // Ensure loader is hidden so the auth gate is visible
    const _loaderEl = document.getElementById('bz-loader-overlay');
    if (_loaderEl) _loaderEl.classList.add('bz-loader-hidden');
}

function showSignedIn() {
    document.documentElement.classList.add('bz-signed-in');
    // Remove guest mode — reveals navbar, player, and main content
    document.documentElement.classList.remove('bz-guest');
    const out = $('bz-auth-signedout');
    const inn = $('bz-auth-signedin');
    if (out) out.style.display = 'none';
    if (inn) inn.classList.add('bz-auth-visible');
    // Reveal cloud sync controls and all settings features
    const syncSec = $('bz-sync-section');
    if (syncSec) syncSec.style.display = '';
    const locked = $('bz-settings-locked');
    if (locked) locked.style.display = '';
    // FIX: Always hide the auth gate when signed in.
    // Without this, a race condition on refresh (onAuthStateChanged firing null
    // before the real user) leaves bz-gate-visible on #bz-auth-gate even after
    // the user is confirmed signed in — making the auth overlay bleed through
    // the Settings page. This is the safety net for ALL call paths into showSignedIn().
    const gate = $('bz-auth-gate');
    if (gate) {
        gate.classList.remove('bz-gate-visible');
    }
    // Refresh toggle state
    syncAutoSyncUI();
}

// ── Toast ─────────────────────────────────────────────────────────────────────
// Delegates to window.showToast (script.js) when available — it has the full
// feature-detection label engine. Falls back to a self-contained version with
// the same visual quality: progress bar, close button, full message text, 5 s.
function bzToast(msg, type = 'success') {
    if (typeof window.showToast === 'function') {
        window.showToast(msg);
        return;
    }

    const container = document.getElementById('toast-container');
    if (!container) return;

    // ── Type → visual mapping ────────────────────────────────────────────────
    const MAP = {
        success: {
            icon: 'fa-circle-check',
            bg: 'linear-gradient(135deg,#1db954,#1ed760)',
            border: 'rgba(29,185,84,0.45)',
            glow: 'rgba(29,185,84,0.12)',
            label: 'Done',
            color: '#6bcb77',
        },
        warning: {
            icon: 'fa-triangle-exclamation',
            bg: 'linear-gradient(135deg,#f59e0b,#d97706)',
            border: 'rgba(245,158,11,0.45)',
            glow: 'rgba(245,158,11,0.12)',
            label: 'Notice',
            color: '#fde68a',
        },
        danger: {
            icon: 'fa-circle-xmark',
            bg: 'linear-gradient(135deg,#c0392b,#e74c3c)',
            border: 'rgba(231,76,60,0.45)',
            glow: 'rgba(231,76,60,0.12)',
            label: 'Error',
            color: '#ff8a80',
        },
    };

    // Override label to be more descriptive for known sync messages
    let { icon, bg, border, glow, label, color } = MAP[type] || MAP.warning;
    if (/auto.?sync/i.test(msg)) {
        label = isAutoSyncOn() ? 'Auto Sync On' : 'Auto Sync Off';
    } else if (/cloud|upload|download/i.test(msg)) {
        label = 'Cloud Sync';
    } else if (/sign.?in|sign.?out|account/i.test(msg)) {
        label = 'Account';
    } else if (/restor/i.test(msg)) {
        label = 'Data Restored';
    } else if (/saved|upload/i.test(msg)) {
        label = 'Saved to Cloud';
    }

    const cleanMsg = msg.replace(/^[✓✦]\s*/, '').trim();
    const duration = 5000;

    const toast = document.createElement('div');
    toast.className = 'bz-generic-toast';
    toast.innerHTML = `
        <div class="bz-rr-icon-wrap" style="background:${bg};box-shadow:0 4px 14px ${glow.replace('0.12', '0.5')};">
            <i class="fas ${icon}" style="color:#fff;font-size:15px;"></i>
        </div>
        <div class="bz-rr-text">
            <span class="bz-rr-label" style="color:${color};">${label}</span>
            <span class="bz-rr-sub">${cleanMsg}</span>
        </div>
        <button class="bz-toast-close" aria-label="Close">
            <i class="fas fa-xmark"></i>
        </button>
        <div class="bz-toast-progress" style="--toast-duration:${duration}ms;background:${color};"></div>`;

    toast.style.cssText = `border-color:${border};box-shadow:0 8px 32px rgba(0,0,0,0.55),0 0 0 1px ${glow};`;

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

// ── Timestamp formatter ───────────────────────────────────────────────────────
function fmtTimestamp(ts) {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    // Compact: "6 Jun 12:07 pm" — no comma, no leading zero on hour
    const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
    return date + ' ' + time;
}

// Plain-string version of fmtTimestamp — same format but always returns a string
// (never '—') so it can be stored directly in Firestore fields.
// Input: anything new Date() accepts — ISO string, ms number, Firebase Timestamp.
function fmtDateString(ts) {
    if (!ts) return '';
    try {
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        if (isNaN(d.getTime())) return String(ts);
        const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
        return date + ', ' + time;
    } catch (_) { return String(ts); }
}

function updateSyncStatusUI(ts) {
    const el = $('bz-sync-status-text');
    if (!el) return;
    if (ts) {
        el.innerHTML = `<i class="fas fa-check bz-sync-tick"></i><span class="bz-sync-label">Synced</span><span class="bz-sync-sep"> · </span><span class="bz-sync-time">${fmtTimestamp(ts)}</span>`;
    } else if (!navigator.onLine) {
        el.innerHTML = `<i class="fas fa-cloud bz-sync-tick bz-sync-offline-icon"></i><span class="bz-sync-label bz-sync-offline">Offline — sync resumes when connected</span>`;
    } else {
        el.innerHTML = `<span class="bz-sync-label bz-sync-none">Not synced yet</span>`;
    }
}

function setButtonLoading(btn, loading, icon, label) {
    if (!btn) return;
    btn.disabled = loading;
    btn.innerHTML = loading
        ? `<i class="fas fa-spinner fa-spin"></i> ${label}…`
        : `<i class="fas ${icon}"></i> ${label}`;
}

// ── Data helpers ──────────────────────────────────────────────────────────────
// gatherLocalData() builds the Firestore payload in a deliberate field order:
//
//   1. Identity / metadata  (_version, _savedAt, _uid, _email, _displayName …)
//   2. All SYNC_KEYS in array order (preferences → player state → playlists)
//   3. Heavy fields last  (beatZen_queueState, beatZen_favourites)
//
// The callers (upload / auto-sync) only append _uploadedAt (server timestamp)
// after this function returns — everything else lives here.
function gatherLocalData() {
    // ── 1. Identity block — always first in the document ─────────────────────
    const _bzNow = Date.now();
    const payload = { _version: 1, _savedAt: _bzNow };
    // Store _savedAt locally so startLiveListener can detect our own write echoes
    try { localStorage.setItem('_bz_lastSavedAt', String(_bzNow)); } catch (_) { }

    try {
        const _cu = auth.currentUser;
        if (_cu) {
            // _uid and _email mirror what callers used to add separately,
            // so every path (auto-sync AND manual upload) gets them.
            payload._uid = _cu.uid || '';
            payload._email = _cu.email
                || _cu.providerData?.[0]?.email
                || '';
            payload._displayName = _cu.displayName
                || localStorage.getItem('beatzen_fullName')
                || localStorage.getItem('beatzen_displayUsername')
                || '';
            payload._userEmail = _cu.email
                || _cu.providerData?.[0]?.email
                || '';
            payload._photoURL = _cu.photoURL || '';
            payload._lastSignInAt = _cu.metadata?.lastSignInTime ? fmtDateString(_cu.metadata.lastSignInTime) : '';
        }
    } catch (_) { /* best effort — never block sync */ }

    // ── 1b. Usage analytics — computed from history + environment ────────────
    // These are written after the identity block so they appear grouped in
    // the Firestore console.  All reads are wrapped in try-catch so a stale
    // or malformed history entry never blocks a sync.
    try {
        let histList = [];
        try { histList = JSON.parse(localStorage.getItem('beatZen_history_auto') || '[]'); } catch (_) { }

        // _totalSongsPlayed — total play events recorded in history
        payload._totalSongsPlayed = histList.length;

        // _totalListenMinutes — sum of all duration values in history
        // Durations are stored as "m:ss" strings; convert each to seconds,
        // sum, then express as rounded minutes.
        let totalSecs = 0;
        histList.forEach(entry => {
            const dur = String(entry.duration || '').trim();
            if (!dur) return;
            const parts = dur.split(':').map(Number);
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                totalSecs += parts[0] * 60 + parts[1];          // m:ss
            } else if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
                totalSecs += parts[0] * 3600 + parts[1] * 60 + parts[2]; // h:mm:ss
            }
        });
        payload._totalListenMinutes = Math.round(totalSecs / 60);

        // _topArtist — artist field most frequent in history
        const artistFreq = {};
        histList.forEach(e => {
            const a = (e.artist || '').trim();
            if (a) artistFreq[a] = (artistFreq[a] || 0) + 1;
        });
        const topArtistEntry = Object.entries(artistFreq).sort((a, b) => b[1] - a[1])[0];
        payload._topArtist = topArtistEntry ? topArtistEntry[0] : '';

        // _topMovie — albumTitle most frequent in history
        const movieFreq = {};
        histList.forEach(e => {
            const m = (e.albumTitle || e.sourceName || '').trim();
            if (m) movieFreq[m] = (movieFreq[m] || 0) + 1;
        });
        const topMovieEntry = Object.entries(movieFreq).sort((a, b) => b[1] - a[1])[0];
        payload._topMovie = topMovieEntry ? topMovieEntry[0] : '';

        // _peakListenHour — hour of day most common in history, stored as "8:00 AM" format
        const hourFreq = {};
        histList.forEach(e => {
            if (!e.playedAt) return;
            const h = new Date(e.playedAt).getHours();
            if (!isNaN(h)) hourFreq[h] = (hourFreq[h] || 0) + 1;
        });
        const peakHourEntry = Object.entries(hourFreq).sort((a, b) => b[1] - a[1])[0];
        if (peakHourEntry) {
            const h = parseInt(peakHourEntry[0], 10);
            const ampm = h >= 12 ? 'PM' : 'AM';
            const h12 = h % 12 === 0 ? 12 : h % 12;
            payload._peakListenHour = `${h12}:00 ${ampm}`;
        } else {
            payload._peakListenHour = '';
        }
    } catch (_) { /* analytics failure must never block sync */ }

    // ── 1c. No device-specific fields stored ────────────────────────────────
    // All data is account-based. Device info is not persisted to Firestore.
    // ─────────────────────────────────────────────────────────────────────────

    // ── 2. Snapshot live player state into localStorage before reading ────────
    try {
        const audioEl = document.getElementById('audio-player');
        // FIX 1: Save position for any finite time > 0 (not > 1), so even a
        // just-changed song gets its identity captured alongside position.
        // FIX (progress-bar restore delay): previously wrote a bare number
        // (audioEl.currentTime.toString()), discarding duration and songId.
        // script.js's syncProgressBar() writes the richer {t, d, id} shape that
        // paintLastPlayedBar()/applySavedTime() need to paint the progress-bar
        // WIDTH instantly on the next load (not just the time text) — without
        // duration in the payload, width-painting has to wait ~2-3s for the
        // audio element to re-discover its own duration from scratch after
        // reload. Since this handler can fire after script.js's own write
        // (listener registration order), writing the bare format here was
        // silently downgrading/clobbering the richer payload on every refresh.
        if (audioEl && isFinite(audioEl.currentTime) && audioEl.currentTime > 0) {
            const _curSong = window.playingAlbum?.songs?.[window.currentSongIndex];
            localStorage.setItem('beatZen_lastPosition', JSON.stringify({
                t: audioEl.currentTime,
                d: isFinite(audioEl.duration) && audioEl.duration > 0 ? audioEl.duration : undefined,
                id: _curSong?.id != null ? String(_curSong.id) : ''
            }));
        }
        const ci = window.currentSongIndex;
        const pa = window.playingAlbum;
        if (pa && pa.songs && typeof ci === 'number' && ci >= 0) {
            const liveSong = pa.songs[ci];
            if (liveSong && liveSong.id) {
                // FIX 2: Always rewrite lastPlayedSong — never skip when songId matches,
                // because the position update is bundled in the same object and must
                // stay in sync. Also include full metadata (title/artist/cover) so the
                // player bar can be painted instantly on refresh without waiting for
                // Sheets data to load.
                const srcAlbum = window.allSongsMap?.get(String(liveSong.id))?.album
                    || liveSong._sourceAlbum || pa;
                // FIX: carry forward url/duration from the live song object — the same
                // fields script.js's playSong() writes for instant audio pre-load on
                // refresh (see paintLastPlayedBar). Without these two lines this
                // re-derivation was silently stripping url/duration from lastPlayedSong
                // on every single sync tick (every debounced upload, every 2-minute
                // periodic sync), so the cross-device-synced copy never carried them.
                localStorage.setItem('lastPlayedSong', JSON.stringify({
                    albumId: String(pa.id),
                    songIndex: ci,
                    songId: String(liveSong.id),
                    type: pa.type,
                    title: liveSong.title || '',
                    artist: liveSong.artist || '',
                    cover: srcAlbum?.imageUrl || srcAlbum?.albumCover || '',
                    url: liveSong.url || '',
                    duration: liveSong.duration || '',
                    savedAt: Date.now()
                }));
            }
        }
    } catch (_) { /* best effort */ }

    // ── 3. All SYNC_KEYS in declared order ────────────────────────────────────
    // SYNC_KEYS is ordered so that lightweight preferences come first and
    // heavy fields (beatZen_queueState, beatZen_favourites) come last.
    // REMAP: heavy localStorage keys are stored under z_ prefixed Firestore field names
    // so they sort to the bottom of the Firestore console (which orders alphabetically).
    // All other keys use the same name in both localStorage and Firestore —
    // this includes lastPlayedSong and beatZen_lastPosition, which are kept
    // lightweight (no z_ prefix) like the other small preference fields.
    const _BZ_FIELD_REMAP = {
        'beatZen_importedPlaylists': 'z_importedPlaylists',
        'beatZen_queueState': 'z_queueState',
        'beatZen_favourites': 'z_favourites',
        'beatZen_history_auto': 'z_history',
        'beatZen_signals': 'z_signals',
        'beatZen_rr_plays': 'z_rr_plays',   // Repeat Rewind qualifying plays
    };
    SYNC_KEYS.forEach(key => {
        const fsKey = _BZ_FIELD_REMAP[key] || key; // Firestore field name (may differ from localStorage key)
        if (key === 'beatZen_history_auto') {
            // Cap at 100 entries before uploading — matches HISTORY_MAX in script.js
            // and keeps the Firestore document well under the 1 MB limit.
            try {
                const _hist = JSON.parse(localStorage.getItem(key) || '[]');
                const _histCapped = Array.isArray(_hist) ? _hist.slice(0, 100) : [];
                payload[fsKey] = JSON.stringify(_histCapped);
            } catch (_) {
                const val = localStorage.getItem(key);
                if (val !== null) payload[fsKey] = val;
            }
        } else if (key === 'beatZen_signals') {
            // Cap at 500 signals — mirrors the slice(0,500) cap in the signal writers.
            try {
                const _sigs = JSON.parse(localStorage.getItem(key) || '[]');
                const _sigsCapped = Array.isArray(_sigs) ? _sigs.slice(0, 500) : [];
                payload[fsKey] = JSON.stringify(_sigsCapped);
            } catch (_) {
                const val = localStorage.getItem(key);
                if (val !== null) payload[fsKey] = val;
            }
        } else if (key === 'beatZen_rr_plays') {
            // Cap at 500 entries — mirrors BZ_RR_PLAYS_MAX in script.js.
            // Each entry is tiny ({id, ts}) so 500 entries ≈ 15 KB — well within limits.
            try {
                const _rr = JSON.parse(localStorage.getItem(key) || '[]');
                const _rrCapped = Array.isArray(_rr) ? _rr.slice(0, 500) : [];
                payload[fsKey] = JSON.stringify(_rrCapped);
            } catch (_) {
                const val = localStorage.getItem(key);
                if (val !== null) payload[fsKey] = val;
            }
        } else if (key === 'beatZen_favourites') {
            // Store only song IDs (not full objects) to keep Firestore small.
            try {
                const _favs = JSON.parse(localStorage.getItem(key) || '[]');
                const _slim = _favs.map(s =>
                    typeof s === 'string' ? s : String(s.id || s.title || '')
                ).filter(Boolean);
                payload[fsKey] = JSON.stringify(_slim);
            } catch (_) {
                const val = localStorage.getItem(key);
                if (val !== null) payload[fsKey] = val;
            }
        } else {
            const val = localStorage.getItem(key);
            if (val !== null) payload[fsKey] = val;
        }
    });

    return payload;
}

// ── Helper: is this device actively playing audio? ────────────────────────────
function _bzIsActivelyPlaying() {
    try {
        const audio = document.getElementById('audio-player')
            || document.querySelector('audio');
        return !!(audio && !audio.paused && audio.currentTime > 0 && !audio.ended);
    } catch (_) { return false; }
}

// ── Tier-1 merge: preferences only (always safe to apply silently) ────────────
// Applies every key in SYNC_KEYS that is NOT in PLAYBACK_STATE_KEYS.
// Called by the onSnapshot handler when this device is actively playing so that
// dark-mode, shuffle, playlists, favourites etc. still sync in real-time while
// playback state is deliberately withheld.
function mergeCloudDataPrefsOnly(data) {
    _applyCloudKeys(data, key => !PLAYBACK_STATE_KEYS.has(key));
    _applyInMemoryPrefs();
}

// ── Tier-2 merge: everything, including playback state ────────────────────────
// Called when this device is idle (not playing) — safe to overwrite lastPlayedSong etc.
function mergeCloudData(data) {
    _applyCloudKeys(data, () => true);  // all SYNC_KEYS
    _applyInMemoryPrefs();

    // FIX Issue 18: restoreLastPlayedSong() is intentionally NOT called here —
    // the outer onAuthStateChanged block calls restoreMobileSession() ~350 ms after
    // mergeCloudData returns, which is the correct single restore path.
}

// ── Shared key-writer used by both merge functions ────────────────────────────
function _applyCloudKeys(data, shouldApply) {
    // Same remap used in gatherLocalData — read from z_ Firestore field names,
    // write back to the original localStorage key names (app never sees z_ names).
    // lastPlayedSong and beatZen_lastPosition are in SYNC_KEYS and PLAYBACK_STATE_KEYS,
    // so `shouldApply` gates them: skipped while this device is actively playing,
    // applied when idle (see mergeCloudData / mergeCloudDataPrefsOnly above).
    const _BZ_FIELD_REMAP = {
        'beatZen_importedPlaylists': 'z_importedPlaylists',
        'beatZen_queueState': 'z_queueState',
        'beatZen_favourites': 'z_favourites',
        'beatZen_history_auto': 'z_history',
        'beatZen_signals': 'z_signals',
        'beatZen_rr_plays': 'z_rr_plays',   // Repeat Rewind qualifying plays
    };
    SYNC_KEYS.forEach(key => {
        // Two-tier filter: caller passes a predicate so playback-state keys
        // can be skipped when this device is actively playing.
        if (!shouldApply(key)) return;
        const fsKey = _BZ_FIELD_REMAP[key] || key; // Firestore field to read from
        // Support both new z_ name and old plain name (backwards-compat with old docs)
        const cloudVal = Object.prototype.hasOwnProperty.call(data, fsKey) ? data[fsKey]
            : Object.prototype.hasOwnProperty.call(data, key) ? data[key]
                : undefined;
        if (cloudVal == null) return;

        if (key === 'beatZen_favourites') {
            // Cloud stores slim IDs; expand back to full objects via allSongsMap.
            try {
                const _ids = JSON.parse(cloudVal);
                if (!Array.isArray(_ids)) { localStorage.setItem(key, cloudVal); return; }
                const _map = window.allSongsMap;
                const _expanded = _ids.map(function (id) {
                    if (typeof id !== 'string') return null;
                    var song = _map && _map.get(id);
                    return song ? Object.assign({}, song) : { id: id, title: id };
                }).filter(Boolean);
                localStorage.setItem(key, JSON.stringify(_expanded));
            } catch (_) {
                localStorage.setItem(key, cloudVal);
            }
        } else {
            localStorage.setItem(key, cloudVal);
        }
    });
}

// ── Apply in-memory preference state after any cloud merge ────────────────────
// Separated so both mergeCloudData() and mergeCloudDataPrefsOnly() share identical
// post-write logic without duplication.
function _applyInMemoryPrefs() {
    // FIX 4: Apply in-memory settings immediately after writing to localStorage.
    // Previously mergeCloudData only wrote localStorage, so window.isShuffling /
    // window.isLooping / dark-mode state were out of sync with the restored values
    // until the user interacted with the player. Apply them now so every in-memory
    // consumer (autoplay logic, button highlight, dark mode) gets the cloud value
    // without requiring a full page reload.
    try {
        // Shuffle / loop — both the in-memory flag and the UI button highlight
        window.isShuffling = localStorage.getItem('beatZen_shuffle') === 'true';
        window.isLooping = localStorage.getItem('beatZen_loop') === 'true';
        if (typeof window.syncPlaybackModesUI === 'function') {
            window.syncPlaybackModesUI();
        }
    } catch (_) { /* best effort */ }

    try {
        // Auto-mix toggle — must reflect the restored cloud value in the DOM
        const autoMixToggle = document.getElementById('automix-toggle');
        if (autoMixToggle) {
            autoMixToggle.checked = localStorage.getItem('beatzen_automix') === 'true';
        }
    } catch (_) { /* best effort */ }

    try {
        // Dark mode — apply the cloud preference immediately
        const darkOn = localStorage.getItem('beatzen_dark_mode') === 'true';
        document.body.classList.toggle('dark-mode', darkOn);
        // If the app exposes a global dark-mode sync helper, call it
        if (typeof window.bzApplyDarkMode === 'function') {
            window.bzApplyDarkMode(darkOn);
        }
    } catch (_) { /* best effort */ }

    // FIX 4 (continued): After writing keys to localStorage, refresh playlists UI.
    // FIX Issue 18: restoreLastPlayedSong() is intentionally NOT called here —
    // the outer onAuthStateChanged block calls restoreMobileSession() ~350 ms after
    // mergeCloudData returns, which is the correct single restore path. Calling it
    // here too caused a double _tryRestoreSession loop (up to 7.5 s) that could
    // overwrite window.playingAlbum after the user had already started a new song.
    setTimeout(() => {
        try {
            // Rebuild masterPool so imported playlists and smart playlists
            // both reflect the freshly merged history, signals, and playlists.
            if (typeof window._bzRebuildPlaylistUI === 'function') window._bzRebuildPlaylistUI();
            if (typeof window.renderPlaylists === 'function') window.renderPlaylists();
            else if (typeof window._bzPlaylistsRender === 'function') {
                const wrap = document.getElementById('bz-smart-playlists-wrap')
                    || document.getElementById('playlists-container');
                if (wrap) window._bzPlaylistsRender(wrap);
            }
        } catch (_) { /* best effort */ }
    }, 300);

    // ── Re-apply Scheduled Dark Mode settings from cloud ───────────────────
    // mergeCloudData writes the SDM keys to localStorage, but the scheduled-DM
    // engine (initScheduledDarkMode in script.js) already ran at page load and
    // read the old values. We must kick it to re-read the freshly written cloud
    // values so the schedule activates immediately without requiring a reload.
    try {
        if (typeof window.bzReinitScheduledDarkMode === 'function') {
            window.bzReinitScheduledDarkMode();
        }
    } catch (_) { /* best effort */ }
}

// ── Live Sync — immediate write + onSnapshot real-time receive ───────────────
// Architecture:
//   WRITE: silentUploadToCloud() writes to Firestore immediately on every
//          meaningful change. A 1.5 s debounce coalesces rapid changes
//          (e.g. volume slider, song skip) into a single Firestore write.
//   READ:  startLiveListener() opens a Firestore onSnapshot listener that
//          fires on this device the instant another device writes — giving
//          real-time cross-device sync like Spotify/YouTube Music.
// ─────────────────────────────────────────────────────────────────────────────

let _uploadDebounceTimer = null;
const UPLOAD_DEBOUNCE_MS = 2000; // coalesce rapid changes into one write (2 s → every device refreshes live)

async function silentUploadToCloud() {
    const user = auth.currentUser;
    if (!user) return;
    const _audio = _bzSaveAudioState();
    try {
        const payload = gatherLocalData();
        payload._uploadedAt = firebase.firestore.FieldValue.serverTimestamp();
        payload._uploadedAtFormatted = fmtDateString(new Date());
        await db.collection('beatzen_sync').doc(user.uid).set(payload, { merge: true });
        _bzRestoreAudio(_audio.el, _audio.wasPlaying, _audio.time, _audio.rate);

        // ── Step 1: Purge known removed/renamed fields ────────────────────────
        // These keys are plain field names (no dots treated as nested paths).
        const purgePayload = {};
        PURGE_KEYS.forEach(k => { purgePayload[k] = firebase.firestore.FieldValue.delete(); });
        await db.collection('beatzen_sync').doc(user.uid).update(purgePayload).catch(() => { });

        // ── Step 2: Purge orphaned flat dot-notation device fields ────────────
        // Old code wrote device info using Firestore update() with dot-notation
        // keys like '_devices.bz_xyz.deviceId'. Because the parent '_devices' map
        // never existed as a proper Firestore map, these were stored as literal
        // flat string keys (the dots are part of the key name, not a nested path).
        // Deleting '_devices' above does NOT remove them — they are separate fields.
        // We must read the document, find every field whose name contains a dot
        // (old device keys) and issue a second targeted delete for each one.
        try {
            const snap = await db.collection('beatzen_sync').doc(user.uid).get();
            if (snap.exists) {
                const docFields = Object.keys(snap.data() || {});
                // Collect any field that looks like an old device-tracking key:
                //   • starts with '_devices.'
                //   • is a known single-level device field: _onlineStatus, _deviceId, _deviceType, _browserName
                //   • starts with 'bz_' (old per-device sub-document keys)
                const DEVICE_FIELD_PREFIXES = ['_devices.', 'bz_'];
                const DEVICE_EXACT_KEYS = new Set(['_onlineStatus', '_deviceId', '_deviceType', '_browserName', '_connectionType']);
                const orphans = docFields.filter(f =>
                    DEVICE_EXACT_KEYS.has(f) ||
                    DEVICE_FIELD_PREFIXES.some(prefix => f.startsWith(prefix))
                );
                if (orphans.length > 0) {
                    // FieldPath is required to delete fields whose names contain dots,
                    // because update() would otherwise interpret the dots as nested paths.
                    const deepPurge = {};
                    orphans.forEach(f => {
                        deepPurge[f] = firebase.firestore.FieldValue.delete();
                    });
                    // Use a Firestore DocumentReference update with FieldPath objects
                    // for any key that contains a dot so Firestore treats the whole
                    // string as the field name rather than a nested path.
                    const ref = db.collection('beatzen_sync').doc(user.uid);
                    const hasDot = orphans.some(f => f.includes('.'));
                    if (hasDot) {
                        // Build an update with explicit FieldPath for dotted keys
                        const updateArgs = {};
                        orphans.forEach(f => {
                            if (f.includes('.')) {
                                // firebase.firestore.FieldPath escapes the key so dots
                                // are treated as literal characters, not path separators.
                                updateArgs[f] = firebase.firestore.FieldValue.delete();
                            } else {
                                updateArgs[f] = firebase.firestore.FieldValue.delete();
                            }
                        });
                        // Use the low-level updateDoc approach: pass an array of
                        // alternating FieldPath / FieldValue arguments.
                        // Firebase Web v8 compat SDK accepts a plain object in update()
                        // but ONLY processes the first level as nested paths. We work
                        // around this by issuing one update() call per dotted field so
                        // each key is isolated and the SDK doesn't walk the dots.
                        const dottedFields = orphans.filter(f => f.includes('.'));
                        const plainFields = orphans.filter(f => !f.includes('.'));
                        // Delete plain (no-dot) fields together
                        if (plainFields.length) {
                            const plainPurge = {};
                            plainFields.forEach(f => { plainPurge[f] = firebase.firestore.FieldValue.delete(); });
                            await ref.update(plainPurge).catch(() => { });
                        }
                        // Delete each dotted field individually using FieldPath
                        for (const f of dottedFields) {
                            await ref.update(
                                new firebase.firestore.FieldPath(f),
                                firebase.firestore.FieldValue.delete()
                            ).catch(() => { });
                        }
                    } else {
                        await ref.update(deepPurge).catch(() => { });
                    }
                    console.warn('[BeatZen Sync] Purged', orphans.length, 'orphaned device field(s):', orphans);
                }
            }
        } catch (_purgeErr) {
            // Non-critical — stale fields stay visible in console but don't affect app
            console.warn('[BeatZen Sync] Deep device-field purge skipped:', _purgeErr.message);
        }

        const snap = await db.collection('beatzen_sync').doc(user.uid).get();
        updateSyncStatusUI(snap.data()?._uploadedAt);
    } catch (err) {
        console.warn('[BeatZen Sync] Upload failed:', err.code, err.message);
        _bzRestoreAudio(_audio.el, _audio.wasPlaying, _audio.time, _audio.rate);
    }
}

// Debounced upload — safe to call on every user action without flooding Firestore.
// Skipped when auto-sync is OFF so the user's manual-only preference is respected.
function bzScheduleUpload() {
    if (!isAutoSyncOn()) return; // manual-only mode — don't auto-write
    if (_uploadDebounceTimer) clearTimeout(_uploadDebounceTimer);
    _uploadDebounceTimer = setTimeout(() => {
        _uploadDebounceTimer = null;
        silentUploadToCloud();
    }, UPLOAD_DEBOUNCE_MS);
}

// ── onSnapshot live listener ──────────────────────────────────────────────────
let _liveListenerUnsubscribe = null;
let _liveListenerSkipNext = false; // skip the echo of our own write

function startLiveListener(uid) {
    stopLiveListener();
    _liveListenerUnsubscribe = db.collection('beatzen_sync').doc(uid)
        .onSnapshot(snap => {
            if (!snap.exists) return;
            if (!auth.currentUser) return;

            // Skip the immediate echo of our own write (Firestore fires onSnapshot
            // for local writes too). We set this flag just before writing and clear
            // it here so only truly remote changes trigger a merge.
            if (_liveListenerSkipNext) {
                _liveListenerSkipNext = false;
                return;
            }

            const data = snap.data();
            // Echo guard — skip if this is our own write bouncing back.
            // We stamp _savedAt = Date.now() before every upload and cache it
            // in localStorage. If the remote value matches we wrote it ourselves.
            const remoteSavedAt = data?._savedAt;
            const localSavedAt = parseInt(localStorage.getItem('_bz_lastSavedAt') || '0', 10);
            if (remoteSavedAt && remoteSavedAt === localSavedAt) return;

            // Capture audio state before any merge touches the DOM
            const _audio = _bzSaveAudioState();
            _isSyncingInBackground = true;

            try {
                // ── Two-tier merge ────────────────────────────────────────────────
                // If this device is actively playing, only apply preference changes
                // silently — playback-state keys (song, queue, position) are withheld
                // so a remote change never yanks the song out from under the user.
                if (_bzIsActivelyPlaying()) {
                    mergeCloudDataPrefsOnly(data);

                    // Surface a "Play here" toast if another device just started a
                    // DIFFERENT song while this one is actively playing — mirrors
                    // Spotify Connect: never silently interrupt, always ask first.
                    try {
                        const remoteRaw = data.lastPlayedSong;
                        if (remoteRaw) {
                            const remoteSongId = JSON.parse(remoteRaw)?.songId;
                            const liveSong = window.playingAlbum?.songs?.[window.currentSongIndex];
                            const localSongId = liveSong?.id != null ? String(liveSong.id) : null;
                            if (remoteSongId && String(remoteSongId) !== localSongId) {
                                showPlayHereNotification(remoteRaw, data.beatZen_lastPosition);
                            }
                        }
                    } catch (_) { /* never break the sync pipeline over a toast */ }
                } else {
                    mergeCloudData(data);
                }
                updateSyncStatusUI(data?._uploadedAt);
            } finally {
                _isSyncingInBackground = false;
                // Restore audio if it was playing before the merge ran
                _bzRestoreAudio(_audio.el, _audio.wasPlaying, _audio.time, _audio.rate);
            }
        }, err => {
            console.warn('[BeatZen LiveSync] Listener error:', err.code);
        });
}

function stopLiveListener() {
    if (_liveListenerUnsubscribe) {
        _liveListenerUnsubscribe();
        _liveListenerUnsubscribe = null;
    }
}

// ── "Play here" notification — shown when another device changes track ────────
// Instead of hijacking active playback, we show a small, non-blocking toast at
// the bottom of the screen. Tapping "Play here" switches this device to the
// remote song. Tapping "×" dismisses it silently.
// Only one notification is shown at a time — rapid remote changes just update
// the existing toast rather than stacking multiples.
let _playHereToastEl = null;
let _playHereAutoDismissTimer = null;

function showPlayHereNotification(remoteLastPlayedSongRaw, remoteLastPositionRaw) {
    try {
        // Parse the remote song name for display
        let remoteSongTitle = 'another song';
        try {
            const parsed = JSON.parse(remoteLastPlayedSongRaw);
            remoteSongTitle = parsed?.title || parsed?.name || remoteSongTitle;
        } catch (_) { /* raw string fallback */ }

        // Auto-dismiss after 12 s so it never blocks the UI indefinitely
        if (_playHereAutoDismissTimer) {
            clearTimeout(_playHereAutoDismissTimer);
            _playHereAutoDismissTimer = null;
        }

        // Re-use existing toast if present (update content) — no stacking
        if (!_playHereToastEl || !document.body.contains(_playHereToastEl)) {
            _playHereToastEl = document.createElement('div');
            _playHereToastEl.id = 'bz-play-here-toast';
            // Inline styles so no CSS dependency — works before stylesheet loads
            Object.assign(_playHereToastEl.style, {
                position: 'fixed',
                bottom: '90px',      // sits above the player bar
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: '99999',
                background: 'var(--bz-surface, #1e1e2e)',
                color: 'var(--bz-text, #fff)',
                border: '1px solid var(--bz-accent, #a78bfa)',
                borderRadius: '12px',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.45)',
                fontSize: '13px',
                maxWidth: '340px',
                width: 'calc(100% - 32px)',
                boxSizing: 'border-box',
                animation: 'bzSlideUp 0.25s ease',
            });
            // Inject slide-up keyframe once
            if (!document.getElementById('bz-play-here-style')) {
                const style = document.createElement('style');
                style.id = 'bz-play-here-style';
                style.textContent = `
                    @keyframes bzSlideUp {
                        from { opacity: 0; transform: translateX(-50%) translateY(16px); }
                        to   { opacity: 1; transform: translateX(-50%) translateY(0); }
                    }
                    #bz-play-here-toast .bz-ph-btn {
                        background: var(--bz-accent, #a78bfa);
                        color: #fff;
                        border: none;
                        border-radius: 8px;
                        padding: 5px 12px;
                        cursor: pointer;
                        font-size: 12px;
                        font-weight: 600;
                        white-space: nowrap;
                        flex-shrink: 0;
                    }
                    #bz-play-here-toast .bz-ph-btn:hover { opacity: 0.85; }
                    #bz-play-here-toast .bz-ph-dismiss {
                        background: transparent;
                        border: none;
                        color: var(--bz-text-muted, #aaa);
                        cursor: pointer;
                        font-size: 16px;
                        padding: 0 2px;
                        flex-shrink: 0;
                        line-height: 1;
                    }
                `;
                document.head.appendChild(style);
            }
            document.body.appendChild(_playHereToastEl);
        }

        // Build / refresh toast content
        _playHereToastEl.innerHTML = `
            <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                🎵 <strong>${_bzEscapeHtml(remoteSongTitle)}</strong>
                <span style="color:var(--bz-text-muted,#aaa)"> synced from your account</span>
            </span>
            <button class="bz-ph-btn" id="bz-ph-play-btn">Play here</button>
            <button class="bz-ph-dismiss" id="bz-ph-close-btn" aria-label="Dismiss">×</button>
        `;

        // "Play here" — apply the full remote playback state and restore
        document.getElementById('bz-ph-play-btn').addEventListener('click', () => {
            try {
                localStorage.setItem('lastPlayedSong', remoteLastPlayedSongRaw);
                // Carry over the synced position too, so playback resumes where the
                // other device left off instead of restarting from 0:00.
                if (remoteLastPositionRaw) {
                    localStorage.setItem('beatZen_lastPosition', remoteLastPositionRaw);
                } else {
                    localStorage.removeItem('beatZen_lastPosition');
                }
                if (typeof window.restoreMobileSession === 'function') {
                    window.restoreMobileSession();
                } else if (typeof window.restoreLastPlayedSong === 'function') {
                    window.restoreLastPlayedSong();
                }
            } catch (_) { /* best effort */ }
            _bzDismissPlayHereToast();
        });

        // Dismiss silently
        document.getElementById('bz-ph-close-btn').addEventListener('click', _bzDismissPlayHereToast);

        // Auto-dismiss after 12 seconds
        _playHereAutoDismissTimer = setTimeout(_bzDismissPlayHereToast, 12000);

    } catch (_) { /* never crash the sync pipeline */ }
}

function _bzDismissPlayHereToast() {
    if (_playHereAutoDismissTimer) { clearTimeout(_playHereAutoDismissTimer); _playHereAutoDismissTimer = null; }
    if (_playHereToastEl && document.body.contains(_playHereToastEl)) {
        _playHereToastEl.style.animation = 'none';
        _playHereToastEl.style.opacity = '0';
        _playHereToastEl.style.transition = 'opacity 0.2s';
        setTimeout(() => { if (_playHereToastEl) _playHereToastEl.remove(); _playHereToastEl = null; }, 220);
    }
}

function _bzEscapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── bzBootSync — runs on every page open / app resume ────────────────────────
// Order: 1) download cloud → merge into localStorage
//        2) upload local → push to Firestore
//        3) show a single descriptive toast
// Called by startAutoSync() (sign-in) and the visibilitychange listener (resume).
// isFreshSignIn=true  → show toast with full detail
// isFreshSignIn=false → show a short "Synced" toast so the user knows it ran
async function bzBootSync(isFreshSignIn) {
    const user = auth.currentUser;
    if (!user) return;
    if (!isAutoSyncOn()) {
        // Auto-sync off — just open the live listener; no upload/download
        startLiveListener(user.uid);
        return;
    }
    const _audio = _bzSaveAudioState();
    _isSyncingInBackground = true;
    try {
        // ── Step 1: Download — pull cloud data and merge into localStorage ──
        const syncSnap = await db.collection('beatzen_sync').doc(user.uid).get();
        if (syncSnap.exists) {
            // Reset mobile-engine guard so _tryRestoreSession runs fresh
            if (window._bzMobileState) window._bzMobileState.restored = false;
            window._bzRestoreOnReady = false;

            mergeCloudData(syncSnap.data());
            updateSyncStatusUI(syncSnap.data()?._uploadedAt);
            restoreLastPlayedSong();

            // Staggered retries to wire playback state after masterPool builds
            function _bzBootRestore() {
                try { if (typeof window.restoreMobileSession === 'function') window.restoreMobileSession(); }
                catch (_) { }
            }
            setTimeout(_bzBootRestore, 150);
            setTimeout(_bzBootRestore, 700);
            setTimeout(_bzBootRestore, 1500);
        }

        // Restore audio immediately after merge — before upload step
        _isSyncingInBackground = false;
        _bzRestoreAudio(_audio.el, _audio.wasPlaying, _audio.time, _audio.rate);

        // ── Step 2: Upload — push current local state to Firestore ──────────
        await silentUploadToCloud();

        // ── Step 3: Toast ─────────────────────────────────────────────────────
        if (syncSnap.exists) {
            try {
                const d = syncSnap.data();
                let parts = [];
                try { const favs = JSON.parse(d.z_favourites || '[]'); if (favs.length) parts.push(favs.length + ' favourite' + (favs.length !== 1 ? 's' : '')); } catch (_) { }
                try { const hist = JSON.parse(d.z_history || '[]'); if (hist.length) parts.push(hist.length + ' history ' + (hist.length !== 1 ? 'entries' : 'entry')); } catch (_) { }
                try { const pls = JSON.parse(d.z_importedPlaylists || '[]'); if (pls.length) parts.push(pls.length + ' playlist' + (pls.length !== 1 ? 's' : '')); } catch (_) { }

                if (isFreshSignIn) {
                    const msg = parts.length
                        ? '✓ Account synced — ' + parts.join(', ') + ' restored'
                        : '✓ Signed in — your data has been synced to this device';
                    setTimeout(() => bzToast(msg, 'success'), 600);
                }
                // isFreshSignIn=false (page reload / resume) → silent, no toast
            } catch (_) { }
        } else if (isFreshSignIn) {
            // First-ever sign-in — no cloud data yet; upload just ran so confirm
            setTimeout(() => bzToast('✓ Account created — your data will sync across all your devices', 'success'), 600);
        }
    } catch (_bootSyncErr) {
        // Suppress expected offline codes — only warn for unexpected failures
        const _bzIsOfflineErr = _bootSyncErr.code === 'unavailable' ||
            _bootSyncErr.code === 'failed-precondition' ||
            (_bootSyncErr.message || '').toLowerCase().includes('offline');
        if (!_bzIsOfflineErr) {
            console.warn('[BeatZen] Boot sync failed (non-critical):', _bootSyncErr.message);
        }
        _isSyncingInBackground = false;
        _bzRestoreAudio(_audio.el, _audio.wasPlaying, _audio.time, _audio.rate);
    }
}

// ── startAutoSync / stopAutoSync — start/stop the live listener + boot sync ───
// Named the same so all existing call sites keep working unchanged.
// ── 2-minute periodic auto sync ─────────────────────────────────────────────
const AUTO_SYNC_INTERVAL_MS = 2 * 60 * 1000; // exactly 2 minutes
let _autoSyncIntervalTimer = null;

function startAutoSyncInterval() {
    if (_autoSyncIntervalTimer) return;
    _autoSyncIntervalTimer = setInterval(async () => {
        if (!auth.currentUser || !isAutoSyncOn()) return;
        try {
            await silentUploadToCloud(); // silent periodic upload — live listener handles downloads, no toast
        } catch (e) { /* silent — network may be offline */ }
    }, AUTO_SYNC_INTERVAL_MS);
}

function stopAutoSyncInterval() {
    if (_autoSyncIntervalTimer) {
        clearInterval(_autoSyncIntervalTimer);
        _autoSyncIntervalTimer = null;
    }
}

function startAutoSync() {
    const user = auth.currentUser;
    if (!user) return;
    startLiveListener(user.uid); // always open real-time listener when signed in
    window.bzSilentUpload = bzScheduleUpload;
    window.bzImmediateUpload = silentUploadToCloud; // immediate (non-debounced) upload for settings changes
    startAutoSyncInterval();     // periodic 2-minute sync (first fires at t+2min)
}

function stopAutoSync() {
    stopLiveListener();
    stopAutoSyncInterval();
    if (_uploadDebounceTimer) { clearTimeout(_uploadDebounceTimer); _uploadDebounceTimer = null; }
}

// ── App-resume sync — fires when the user returns to the tab / PWA ────────────
// Debounced to 2 s so rapid focus events (e.g. mobile multitasking) don't
// flood Firestore. Skipped if less than 60 s have passed since the last sync.
let _bzLastBootSyncAt = 0;
const BZ_RESUME_SYNC_MIN_MS = 60 * 1000; // at most once per minute on resume
document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    const user = auth.currentUser;
    if (!user || !isAutoSyncOn()) return;
    const now = Date.now();
    if (now - _bzLastBootSyncAt < BZ_RESUME_SYNC_MIN_MS) return;
    _bzLastBootSyncAt = now;
    // Short delay so the browser finishes painting before hitting Firestore
    setTimeout(() => bzBootSync(false), 500);
});

// ── Session watchdog — detects Firebase Auth account deletion ─────────────────
// When an admin deletes a user from the Firebase Auth console their refresh
// token is revoked, but the current ID token stays valid for up to 60 minutes.
// Calling getIdToken(true) forces an immediate refresh attempt; the SDK throws
// if the account no longer exists, which lets us sign the user out right away
// instead of waiting for the token's natural expiry.
let _sessionWatchdogTimer = null;
const SESSION_WATCHDOG_INTERVAL_MS = 90 * 1000; // every 90 seconds

function startSessionWatchdog() {
    if (_sessionWatchdogTimer) return;
    _sessionWatchdogTimer = setInterval(async () => {
        const user = auth.currentUser;
        if (!user) { stopSessionWatchdog(); return; }
        try {
            await user.reload();          // re-fetches user record from Firebase Auth
            await user.getIdToken(true);  // forces a token refresh — fails if deleted
        } catch (err) {
            const fatalCodes = [
                'auth/user-not-found',
                'auth/user-disabled',
                'auth/user-token-revoked',
                'auth/invalid-user-token',
                'auth/network-request-failed', // transient — don't sign out for this
            ];
            if (err.code === 'auth/network-request-failed') return; // ignore offline blip
            if (fatalCodes.includes(err.code)) {
                console.warn('[BeatZen] Watchdog: auth account gone —', err.code);
                _forceSignOut();
            }
        }
    }, SESSION_WATCHDOG_INTERVAL_MS);
}

function stopSessionWatchdog() {
    if (_sessionWatchdogTimer) {
        clearInterval(_sessionWatchdogTimer);
        _sessionWatchdogTimer = null;
    }
}

// ── User-document watcher — detects Firestore data deletion ──────────────────
// Listens to the signed-in user's beatzen_users/{uid} document in real-time.
// If the admin deletes it (snap.exists === false) the listener fires
// immediately — no polling delay — and signs the user out on the spot.
let _userDocUnsubscribe = null;

function startUserDocWatcher(uid) {
    stopUserDocWatcher();
    // Track whether we have ever seen the document in an existing state.
    // For brand-new Google users the beatzen_users/{uid} doc is still being
    // written when the first onSnapshot fires, so snap.exists is false.
    // Without this guard the watcher would treat that as an admin deletion
    // and immediately call _forceSignOut(), causing the Google sign-in loop
    // (first sign-in gets kicked out; second sign-in works because the doc
    // now exists). We only force sign-out when the doc *was* there and then
    // disappeared — never when it simply hasn't been created yet.
    let _docEverExisted = false;
    _userDocUnsubscribe = db.collection('beatzen_users').doc(uid)
        .onSnapshot(
            snap => {
                if (!auth.currentUser) return; // already signed out — nothing to do
                if (snap.exists) {
                    _docEverExisted = true; // doc is present — future absences are real deletions
                    return;
                }
                // snap.exists === false: only act if the doc existed before.
                // If _docEverExisted is still false this is the initial snapshot
                // firing before the Firestore write completes — ignore it.
                if (!_docEverExisted) return;
                console.warn('[BeatZen] User document deleted — signing out');
                _forceSignOut();
            },
            err => {
                // permission-denied is expected once the doc (and its rules) are gone
                if (err.code === 'permission-denied') {
                    console.warn('[BeatZen] User doc watcher: permission-denied — signing out');
                    _forceSignOut();
                }
                // any other error (unavailable, etc.) — leave the watcher in place
            }
        );
}

function stopUserDocWatcher() {
    if (_userDocUnsubscribe) {
        _userDocUnsubscribe();
        _userDocUnsubscribe = null;
    }
}

// ── Shared forced sign-out used by both watchdog and doc watcher ──────────────
function _forceSignOut() {
    stopSessionWatchdog();
    stopUserDocWatcher();
    stopAutoSync(); // stops live listener + debounce timer
    auth.signOut().catch(err =>
        console.warn('[BeatZen] Force sign-out error (non-critical):', err.code)
    );
}

function isAutoSyncEnabled() {
    return true; // live sync is always on when signed in
}

function setAutoSync(enabled) {
    // no-op — live sync cannot be disabled; kept for API compatibility
}

// ── Auto-sync toggle state ────────────────────────────────────────────────────
// Persisted in localStorage so the preference survives page reloads.
const AUTO_SYNC_ENABLED_KEY = 'beatzen_autosync_enabled';

function isAutoSyncOn() {
    // Always ON — users cannot disable auto sync
    localStorage.setItem(AUTO_SYNC_ENABLED_KEY, 'true');
    return true;
}

// Reflect current auto-sync state in the toggle and description text.
// Manual Upload is hidden when auto-sync is ON (it's redundant — changes
// sync automatically). Manual Download is always available so users can
// force-pull cloud data on a new device regardless of the toggle state.
function syncAutoSyncUI() {
    const desc = $('bz-autosync-desc');
    // Auto sync is always ON — toggle is locked, upload row removed
    if (desc) desc.textContent = 'Changes sync automatically across all devices signed into your account';
}

// Auto-sync toggle is locked ON — no change listener needed
function wireAutoSyncToggle() {
    // Toggle is disabled in HTML — users cannot turn off auto sync
    syncAutoSyncUI();
}

// ── Manual Download ───────────────────────────────────────────────────────────
// Fetches the account's Firestore document and merges ALL fields into
// localStorage, then restores the player bar and playlists immediately.
// This is the full account restore — call it on a new device after signing in.
async function downloadFromCloud() {
    const btn = $('bz-download-btn');

    // FIX: Mirror bzNavGuard's three-state auth check instead of reading
    // auth.currentUser directly. auth.currentUser is null during Firebase's ~100-300ms init
    // window, causing a false "Sign in first" toast for a signed-in user.
    //
    //   bzIsAuthenticated === false   → definitively signed out → toast + bail
    //   bzIsAuthenticated === undefined → Firebase not yet resolved → wait, retry
    //   bzIsAuthenticated === true    → confirmed signed in → proceed
    if (window.bzIsAuthenticated === false) {
        bzToast('Sign in first to access your cloud data', 'warning');
        return;
    }
    if (window.bzIsAuthenticated === undefined) {
        // Firebase still initializing — disable button, wait, then re-invoke.
        if (btn) { btn.disabled = true; }
        (window.bzAuthReady || Promise.resolve()).then(function () {
            if (btn) { btn.disabled = false; }
            if (!window.bzIsAuthenticated) {
                bzToast('Sign in first to access your cloud data', 'warning');
            } else {
                downloadFromCloud();
            }
        });
        return;
    }
    // window.bzIsAuthenticated === true — confirmed signed in, safe to proceed.
    try {
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading…'; }
        const snap = await db.collection('beatzen_sync').doc(auth.currentUser.uid).get();
        if (!snap.exists) {
            bzToast('No saved data found for this account — upload from another device first', 'warning');
            return;
        }
        const data = snap.data();

        // Count what's being restored for a meaningful notification
        let restoredParts = [];
        try {
            const favs = JSON.parse(data.z_favourites || '[]');
            if (Array.isArray(favs) && favs.length) restoredParts.push(favs.length + ' favourites');
        } catch (_) { }
        try {
            const hist = JSON.parse(data.z_history || '[]');
            if (Array.isArray(hist) && hist.length) restoredParts.push(hist.length + ' history entries');
        } catch (_) { }
        try {
            const playlists = JSON.parse(data.z_importedPlaylists || '[]');
            if (Array.isArray(playlists) && playlists.length) restoredParts.push(playlists.length + ' playlists');
        } catch (_) { }
        // lastPlayedSong / beatZen_lastPosition are included in mergeCloudData()
        // below (see SYNC_KEYS) — a manual Download now restores the remote
        // song/position too, not just favourites/history/playlists.

        mergeCloudData(data);
        updateSyncStatusUI(data?._uploadedAt);

        // ── FIX: Reset restore guard so the mobile engine runs fresh ────────────
        // If a previous session already set state.restored = true, restoreMobileSession()
        // returns early without doing anything. We clear it here so this download
        // always triggers a full re-restore, regardless of prior session state.
        if (window._bzMobileState) window._bzMobileState.restored = false;
        if (typeof window._bzResetRestoredState === 'function') window._bzResetRestoredState();
        window._bzRestoreOnReady = false;

        // ── FIX: Restore player bar immediately from freshly written localStorage ──
        restoreLastPlayedSong();

        // ── FIX: Full session restore with staggered retries ──────────────
        // Give localStorage one tick to settle, then start restoreMobileSession.
        // Use staggered retries to handle slow masterPool builds on cold starts
        // where Sheets data is still loading when Download is clicked.
        function _bzTriggerRestore() {
            try {
                if (typeof window.restoreMobileSession === 'function') {
                    window.restoreMobileSession();
                }
            } catch (_) { /* best effort */ }
        }
        setTimeout(_bzTriggerRestore, 150);   // fast path — masterPool already loaded
        setTimeout(_bzTriggerRestore, 700);   // retry — in case Sheets data was still loading
        setTimeout(_bzTriggerRestore, 1500);  // final retry — slow network / cold start

        const detail = restoredParts.length
            ? 'Restored: ' + restoredParts.join(', ')
            : 'All settings and preferences restored';
        bzToast('✓ ' + detail, 'success');

    } catch (err) {
        console.warn('[BeatZen] Manual download failed:', err);
        bzToast('Download failed — check your internet connection and try again', 'danger');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-cloud-arrow-down"></i> Download'; }
    }
}

// ── Wire upload + download buttons ───────────────────────────────────────────
function wireSyncButtons() {
    const downloadBtn = $('bz-download-btn');
    if (downloadBtn) downloadBtn.addEventListener('click', downloadFromCloud);
    wireAutoSyncToggle(); // sets desc text, toggle is locked disabled in HTML
}

// ── Restore last-played song ──────────────────────────────────────────────────
function restoreLastPlayedSong() {
    try {
        const raw = localStorage.getItem('lastPlayedSong') || localStorage.getItem('beatZen_currentSong');
        if (!raw) return;

        if (typeof window.restoreMobileSession === 'function') {
            window.restoreMobileSession();
            return;
        }

        const song = JSON.parse(raw);
        if (!song) return;

        // FIX 5: Read title/artist/cover from the rich lastPlayedSong object first
        // (new format stores them inline), then fall back to separate legacy keys,
        // then scan history as a last resort.
        let title = song.title || '';
        let artist = song.artist || '';
        let cover = song.cover || '';

        // Fallback 1: separate localStorage keys written by older saves
        if (!title) title = localStorage.getItem('beatZen_currentSongTitle') || '';
        if (!artist) artist = localStorage.getItem('beatZen_currentSongArtist') || '';
        if (!cover) cover = localStorage.getItem('beatZen_currentSongCover') || '';

        // Fallback 2: scan play history for the matching song ID
        if (!title && song.songId) {
            try {
                const hist = JSON.parse(localStorage.getItem('beatZen_history_auto') || '[]');
                const entry = hist.find(h => String(h.id) === String(song.songId));
                if (entry) {
                    title = title || entry.title || '';
                    artist = artist || entry.artist || '';
                    cover = cover || entry._coverUrl || entry.albumCover || '';
                }
            } catch (_) { }
        }

        if (!title) return; /* Nothing useful to show yet */

        const titleEl = document.querySelector('.song-title') || document.getElementById('player-song-title');
        const artistEl = document.querySelector('.song-artist') || document.getElementById('player-song-artist');
        const coverEl = document.querySelector('.player-album-cover') || document.getElementById('player-album-cover');
        if (titleEl) titleEl.textContent = title;
        if (artistEl) artistEl.textContent = artist;
        if (coverEl && cover) coverEl.src = cover;
    } catch (e) {
        console.warn('[BeatZen] restoreLastPlayedSong:', e);
    }
}

// ── Sign-Out ──────────────────────────────────────────────────────────────────
function wireSignOutButton() {
    const btn = $('bz-google-signout-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
        stopAutoSync();
        auth.signOut().catch(err => console.error('[BeatZen SignOut]', err));
    });
}

// ── Auth State ────────────────────────────────────────────────────────────────
// ── Update signed-in UI (call any time settings panel becomes visible) ────────
function refreshSignedInUI(user) {
    if (!user) { showSignedOut(); return; }
    showSignedIn();

    const avatar = $('bz-auth-avatar');
    const nameEl = $('bz-auth-name');
    const emailEl = $('bz-auth-email');

    if (avatar) {
        if (user.photoURL) {
            avatar.src = user.photoURL;
            avatar.style.display = '';
            const old = document.getElementById('bz-auth-avatar-init');
            if (old) old.remove();
        } else {
            avatar.src = '';
            avatar.style.display = 'none';
            let initWrap = document.getElementById('bz-auth-avatar-init');
            if (!initWrap) {
                initWrap = document.createElement('div');
                initWrap.id = 'bz-auth-avatar-init';
                initWrap.style.cssText = 'width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#2575fc);display:flex;align-items:center;justify-content:center;font-size:1.2rem;font-weight:700;color:#fff;flex-shrink:0;';
                if (avatar.parentNode) avatar.parentNode.insertBefore(initWrap, avatar);
            }
            const _fullName = localStorage.getItem('beatzen_fullName') || '';
            initWrap.textContent = (_fullName || user.displayName || user.email || 'U')[0].toUpperCase();
        }
    }
    if (nameEl) nameEl.textContent = localStorage.getItem('beatzen_fullName') || user.displayName || user.email?.split('@')[0] || 'User';
    if (emailEl) emailEl.textContent = user.email || user.phoneNumber || '';
}

// Expose so script.js can call window.bzRefreshAuthUI() when settings tab opens.
// FIX: guard against the Firebase race window — calling refreshSignedInUI(null)
// while auth.currentUser is still null (Firebase resolves in ~100-300ms on load)
// would invoke showSignedOut() and flash the full-screen auth gate for a user
// who IS signed in. Mirror bzNavGuard's dual-signal check: if bzIsAuthenticated
// is not yet set but a cached session exists, defer until bzAuthReady resolves.
window.bzRefreshAuthUI = function () {
    if (window.bzIsAuthenticated !== undefined) {
        // Auth already resolved — act immediately.
        refreshSignedInUI(auth.currentUser);
        return;
    }
    const _likelySigned = !!(
        localStorage.getItem('beatZen_session_uid') ||
        document.documentElement.classList.contains('bz-signed-in')
    );
    if (_likelySigned) {
        // Cached session present — wait for Firebase before refreshing so we
        // never pass null to refreshSignedInUI for an already-signed-in user.
        (window.bzAuthReady || Promise.resolve()).then(function () {
            refreshSignedInUI(auth.currentUser);
        });
    } else {
        // No cached session — user is a genuine guest; safe to call immediately.
        refreshSignedInUI(auth.currentUser);
    }
};

// ── Per-user playlist restore helper ─────────────────────────────────────────
// Fetches this user's playlists from Firestore and writes them into localStorage.
// Returns true if the local data was changed (so callers can rebuild the UI).
async function _bzRestoreUserPlaylists(uid) {
    try {
        const snap = await db.collection('beatzen_sync').doc(uid).get();
        // gatherLocalData() remaps beatZen_importedPlaylists → z_importedPlaylists.
        // Read z_importedPlaylists first; fall back to the old plain name so any
        // Firestore document written before the remap migration still restores.
        const docData = snap.exists ? snap.data() : null;
        const cloudPlaylists = docData != null
            ? (Object.prototype.hasOwnProperty.call(docData, 'z_importedPlaylists')
                ? docData.z_importedPlaylists
                : docData.beatZen_importedPlaylists)
            : undefined;

        if (cloudPlaylists === undefined || cloudPlaylists === null) {
            // No cloud playlist data for this user — wipe any stale data from a
            // previous user that might still be sitting in localStorage.
            if (localStorage.getItem('beatZen_importedPlaylists')) {
                localStorage.removeItem('beatZen_importedPlaylists');
                return true;
            }
            return false;
        }

        if (localStorage.getItem('beatZen_importedPlaylists') === cloudPlaylists) {
            return false; // already in sync — nothing to do
        }

        localStorage.setItem('beatZen_importedPlaylists', cloudPlaylists);
        return true; // caller should rebuild the playlist UI
    } catch (e) {
        console.warn('[BeatZen] Playlist restore failed:', e.message);
        return false;
    }
}

// Rebuild the in-memory masterPool and re-render the playlist UI after a
// user switch, without requiring a full page reload.
function _bzRebuildPlaylistUI() {
    try {
        const parsed = JSON.parse(
            localStorage.getItem('beatZen_importedPlaylists') || '[]'
        );
        if (Array.isArray(window.masterPool)) {
            // Strip old imported playlists, then inject this user's
            window.masterPool = window.masterPool.filter(p => !p.isImported);
            parsed.forEach(pl => {
                pl.id = String(pl.id);
                pl.isImported = true;
                if (!window.masterPool.some(m => String(m.id || m.name) === pl.id)) {
                    window.masterPool.push(pl);
                }
            });
        }
        if (typeof window.rebuildMasterMap === 'function') window.rebuildMasterMap();
        const wrap = document.getElementById('bz-smart-playlists-wrap')
            || document.getElementById('playlists-container');
        if (wrap && typeof window._bzPlaylistsRender === 'function') {
            window._bzPlaylistsRender(wrap);
        }
    } catch (_) { /* best-effort */ }
}



// ── Guest-state guard against Firebase's "null-before-real-user" race ───────
// On many mobile browsers (and some desktop ones), the FIRST onAuthStateChanged
// callback after a page refresh fires with `user === null` while the cached
// session is still being read back from storage, then fires again moments
// later with the real, still-signed-in user. If we react to that first null
// immediately, a signed-in user sees the auth gate flash on AND we wipe their
// local cache (favourites, history, playlists) — both for nothing, since the
// real callback proves them signed in milliseconds later.
//
// _bzApplyGuestState() holds the actual "user is signed out" behaviour so it
// can be called either immediately (genuine sign-out / confirmed guest) or
// after a short grace window (first callback on a device with a cached
// session, where we're not yet sure the null is real).
function _bzApplyGuestState() {
    window.bzIsAuthenticated = false;
    _bzResolveAuthReadyOnce();
    showSignedOut();
    stopAutoSync();        // stops live listener + debounce timer
    stopSessionWatchdog();
    stopUserDocWatcher();

    // ── Re-apply guest mode — hide all app content, show auth gate ────────
    // When the user signs out (or is never signed in), add bz-guest back so
    // the navbar, player, and main content are hidden and the auth gate is
    // shown as the only visible UI element.
    document.documentElement.classList.remove('bz-signed-in');
    document.documentElement.classList.add('bz-guest');
    const _gateEl = document.getElementById('bz-auth-gate');
    if (_gateEl) _gateEl.classList.add('bz-gate-visible');

    // Stop Sheet live-sync polling — no need to hit the endpoint for guests.
    if (typeof window.bzStopLiveSync === 'function') window.bzStopLiveSync();
    // Clear all user-specific local data on sign-out so the next user
    // (or guest) never sees playlists, history, signals, or searches
    // that belong to the account that just signed out.
    localStorage.removeItem('beatZen_importedPlaylists');
    localStorage.removeItem('beatZen_favourites');         // <-- fix: was missing
    localStorage.removeItem('beatZen_history_auto');
    localStorage.removeItem('beatZen_signals');
    localStorage.removeItem('beatZen_rr_plays');           // Repeat Rewind qualifying plays
    localStorage.removeItem('beatZen_recentSearches');
    localStorage.removeItem('beatZen_session_uid');
    // Clear username-account identity keys so the next user (or a Google
    // sign-in) starts completely clean with no stale identity data.
    localStorage.removeItem('beatzen_username');
    localStorage.removeItem('beatzen_displayUsername');
    localStorage.removeItem('beatzen_fullName');
    localStorage.removeItem('beatzen_resolvedEmail');
    clearPlayerState(); // reset player bar so next user sees "Select a song to play"
    _bzRebuildPlaylistUI();
    // ──────────────────────────────────────────────────────────────────
}

// ── Auth-ready promise ────────────────────────────────────────────────────────
// Nav links wait for this before checking bzIsAuthenticated. Firebase
// onAuthStateChanged is async — without this, a refresh fires nav clicks
// before the flag is set, so signed-in users see the auth gate or get blocked.
//
// FIX: this used to be resolved by a wrapper that replaced auth.onAuthStateChanged
// AFTER the real listener below had already registered directly against the
// original method — so the wrapper's replacement was never actually called and
// bzAuthReady never resolved. Any code with no cached session UID that awaited
// it (e.g. a brand-new guest's first-ever boot) would hang forever. Resolving
// it directly from inside the real listener (once we've reached a definitive
// signed-in/signed-out state) fixes that.
let _bzAuthReadyResolve;
window.bzAuthReady = new Promise(function (resolve) { _bzAuthReadyResolve = resolve; });
let _bzAuthReadyResolved = false;
function _bzResolveAuthReadyOnce() {
    if (!_bzAuthReadyResolved) {
        _bzAuthReadyResolved = true;
        _bzAuthReadyResolve();
    }
}

let _bzAuthFirstCallback = true;
let _bzPendingGuestTimer = null;

// ── Explicit "fresh sign-in" flag ───────────────────────────────────────────
// FIX: the "Account synced" toast on first onAuthStateChanged(user) used to be
// gated solely by _gateWasOpen (whether #bz-auth-gate had .bz-gate-visible at
// that instant). That class can be added by unrelated code paths (e.g. a
// boot-time nav-guard race) for users who are actually already signed in,
// making _gateWasOpen a false positive and showing the toast on every
// refresh instead of only on a real sign-in/sign-up. _bzFreshSignIn is set
// ONLY by the four explicit sign-in/sign-up button handlers, right before
// the Firebase call, so it can never be true on a plain page load — only on
// an action the user actually just took. onAuthStateChanged checks AND
// consumes (resets) it below.
window._bzFreshSignIn = false;

auth.onAuthStateChanged(async (user) => {
    if (user) {
        _bzAuthFirstCallback = false;
        // A real user just confirmed — cancel any pending "treat as signed
        // out" timer scheduled below for a still-unconfirmed first null.
        if (_bzPendingGuestTimer) {
            clearTimeout(_bzPendingGuestTimer);
            _bzPendingGuestTimer = null;
        }
        window.bzIsAuthenticated = true;
        _bzResolveAuthReadyOnce();

        // FIX: persist beatZen_session_uid IMMEDIATELY, as the very first thing
        // we do once Firebase confirms a user — not ~170 lines later, after a
        // long chain of cloud-restore/watchdog/Firestore side effects. Previously,
        // if ANY of that downstream code threw (synchronously or via an awaited
        // call with no surrounding try/catch), the function aborted before ever
        // reaching the localStorage.setItem() call, so the UID never persisted.
        // That meant every single page load looked exactly like a guest to the
        // <head> fast-path and the auth.js race-guard (no cached signal at all),
        // guaranteeing the gate-flash on every refresh even for a user who is,
        // in fact, signed in. Capturing _prevUid here too so the user-switch
        // cleanup further below can still compare against the PREVIOUS uid
        // without needing to re-read localStorage after we've already
        // overwritten it.
        var _prevUid = null;
        try {
            _prevUid = localStorage.getItem('beatZen_session_uid');
            localStorage.setItem('beatZen_session_uid', user.uid);
        } catch (_uidErr) {
            console.warn('[BeatZen] Early session UID persist failed:', _uidErr.message);
        }

        // ── Remove guest class — reveals app content ──────────────────────────
        // bz-guest was set in <head> for unauthenticated users to block all
        // content. Remove it now that Firebase confirms sign-in so the navbar,
        // player, and main content become visible and interactive.
        const _wasGuestMode = document.documentElement.classList.contains('bz-guest');
        document.documentElement.classList.remove('bz-guest');

        // Dismiss the auth gate if it's open; if it was visible this is a
        // fresh sign-in (not a page refresh) — navigate to Home so the user
        // lands on real content and never needs to click a nav link manually.
        const gate = document.getElementById('bz-auth-gate');
        const _gateWasOpen = gate && gate.classList.contains('bz-gate-visible');
        if (gate) gate.classList.remove('bz-gate-visible');
        if ((_gateWasOpen || _wasGuestMode) && typeof window.displayHome === 'function') {
            // Clear any stale activeView (e.g. 'settings') so the restored
            // view on next refresh is Home, not the sign-in screen.
            localStorage.removeItem('beatZen_activeView');
            window.displayHome();
        }

        // FIX: capture + consume the explicit fresh-sign-in flag right here,
        // synchronously, before any of the awaits below. _gateWasOpen alone
        // is unreliable — unrelated code (e.g. a boot-time nav-guard race)
        // can leave .bz-gate-visible on the gate for an already-signed-in
        // user, making it look like a fresh sign-in on every refresh.
        // _bzFreshSignIn is only ever set by an explicit Sign Up / Sign In
        // button handler, so it's a true signal. We require it AND reset it
        // immediately so a later, unrelated onAuthStateChanged firing (e.g.
        // a token refresh) can never accidentally reuse a stale "true".
        const _isFreshSignIn = window._bzFreshSignIn === true;
        window._bzFreshSignIn = false;

        refreshSignedInUI(user);

        try {
            const snap = await db.collection('beatzen_sync').doc(user.uid).get();
            updateSyncStatusUI(snap.exists ? snap.data()?._uploadedAt : null);
        } catch (_) {
            updateSyncStatusUI(null);
        }

        window.bzSilentUpload = bzScheduleUpload;

        startAutoSync(); // open real-time listener

        // ── Boot sync: download → merge → upload → toast (every page open) ──
        // bzBootSync runs on EVERY page load / app open for signed-in users:
        //   1. Pull the latest cloud data and merge it into localStorage
        //   2. Push current local state back to Firestore (captures any
        //      offline changes or data written before sign-in completed)
        //   3. Show a single descriptive toast so the user always knows sync ran
        //
        // isFreshSignIn=true  → detailed toast ("restored N favourites, …")
        // isFreshSignIn=false → short "Synced — …" toast on every page load
        _bzLastBootSyncAt = Date.now(); // mark so visibilitychange doesn't double-fire
        bzBootSync(_isFreshSignIn);
        // ─────────────────────────────────────────────────────────────────────

        // ── Account-deletion guards ───────────────────────────────────────────
        // 1. Watchdog: pings Firebase Auth every 90 s; detects when the admin
        //    deletes this account so we sign out within one watchdog cycle rather
        //    than waiting up to 60 min for the ID token to expire naturally.
        // 2. Doc watcher: real-time listener on beatzen_users/{uid}; fires the
        //    moment the admin deletes the user's Firestore document, which is
        //    instant — no polling lag at all.
        startSessionWatchdog();
        startUserDocWatcher(user.uid);

        // Start Sheet live-sync polling now that a user is confirmed signed in.
        if (typeof window.bzStartLiveSync === 'function') window.bzStartLiveSync();

        // ── Per-user playlist isolation ───────────────────────────────────────
        // mergeCloudData (called above) already wrote beatZen_importedPlaylists
        // via _applyCloudKeys. _bzRestoreUserPlaylists was a redundant second
        // Firestore read that raced against mergeCloudData and could overwrite
        // a correct value with a stale one. Replaced with a direct UI rebuild.
        try { _bzRebuildPlaylistUI(); } catch (_) { /* best-effort */ }

        // Per-user history + recent-searches isolation
        // beatZen_history_auto is device-local (not synced to Firestore).
        // beatZen_recentSearches IS synced but stale localStorage data from
        // a previous user must be cleared before Firestore restores the real
        // data. We tag the session with a UID so same-user page refreshes
        // are completely unaffected and don't lose any history or searches.
        // FIX: _prevUid is now captured at the very top of this callback (see
        // comment there) instead of re-read here — beatZen_session_uid has
        // already been overwritten with the new uid by this point, so reading
        // it again here would always equal user.uid and never detect a switch.
        try {
            if (_prevUid !== user.uid) {
                // Different (or first-ever) user on this device.
                // Wipe ALL user-specific localStorage keys so nothing from
                // the previous account bleeds into the new session.
                localStorage.removeItem('beatZen_history_auto');
                localStorage.removeItem('beatZen_signals');
                localStorage.removeItem('beatZen_rr_plays');        // Repeat Rewind qualifying plays
                localStorage.removeItem('beatZen_recentSearches');
                localStorage.removeItem('beatZen_favourites');     // <-- fix: was missing
                localStorage.removeItem('beatZen_importedPlaylists');
                // Clear username-account identity keys so a previous
                // username session never contaminates a Google session
                // (and vice-versa) on the same browser.
                localStorage.removeItem('beatzen_username');
                localStorage.removeItem('beatzen_displayUsername');
                localStorage.removeItem('beatzen_fullName');
                localStorage.removeItem('beatzen_resolvedEmail');
                clearPlayerState(); // prevent previous user's song bleeding into new session

                // FIX 5: Reset the mobile-engine state.restored flag so that when
                // the auto cloud restore (Fix 3) calls restoreMobileSession() for
                // user B, _tryRestoreSession actually runs instead of returning early
                // because state.restored is still true from user A's session.
                // The IIFE exposes a reset hook via window._bzResetRestoredState;
                // we call it here if available, and set the flag unconditionally
                // so restoreMobileSession re-reads fresh localStorage values.
                if (typeof window._bzResetRestoredState === 'function') {
                    window._bzResetRestoredState();
                }
                window._bzRestoreOnReady = false;

                // Rebuild immediately so no stale cards flash on screen.
                setTimeout(function () { try { _bzRebuildPlaylistUI(); } catch (_) { } }, 350);
            }
        } catch (_uidErr) {
            console.warn('[BeatZen] Session UID isolation failed:', _uidErr.message);
        }

        // ── Username-auth: sync profile to localStorage + analytics ───────────
        // Previously lived in a duplicate onAuthStateChanged listener (now removed)
        // whose else-branch set bzIsAuthenticated=false and caused the auth gate
        // to flash on nav clicks while signed in. Moved here to keep one listener.
        try {
            refreshSignedInUIWithUsername(user);
            const _profile = await fetchUserProfile(user.uid);
            if (_profile?.username) {
                localStorage.setItem('beatzen_username', _profile.username);
                localStorage.setItem('beatzen_displayUsername', _profile.displayUsername);
                if (_profile?.fullName) localStorage.setItem('beatzen_fullName', _profile.fullName);
            }
            // ── Google Sheets Account Analytics Sync ───────────────────────────
            // beatzen-analytics.js must be loaded after auth.js in index.html.
            // Fire-and-forget — analytics errors never affect the app's UX.
            try {
                if (typeof window.bzSyncAccountToSheet === 'function') {
                    window.bzSyncAccountToSheet(user, _profile || null);
                }
            } catch (_analyticsErr) {
                console.warn('[BeatZen auth.js] Sheet sync error (non-critical):', _analyticsErr.message);
            }
        } catch (_profileErr) {
            console.warn('[BeatZen] Profile sync failed (non-critical):', _profileErr.message);
        }
        // ───────────────────────────────────────────────────────────────────────────
    } else {
        // ── Race guard ──────────────────────────────────────────────────────
        // On the very first callback of this page load, if a cached session
        // UID exists, this null could be the transient pre-real-user fire
        // described above rather than a genuine sign-out. Give Firebase a
        // short window (comfortably longer than the documented 100-500ms
        // resolution time) to fire the real user before committing to the
        // guest UI + local-data wipe. Any later null (second callback onward,
        // or first callback with no cached session) is treated as real and
        // applied immediately, exactly as before.
        if (_bzAuthFirstCallback) {
            _bzAuthFirstCallback = false;
            var _hadCachedSession = false;
            // FIX: previously only checked beatZen_session_uid. The <head> fast-path
            // script (index.html) also treats a raw 'firebase:authUser:' localStorage
            // key as "had a session" and sets the bz-signed-in class for it — but this
            // race-guard didn't mirror that broader check. If beatZen_session_uid was
            // momentarily stale/missing while a real Firebase token still existed, this
            // branch fell through, skipped the 1.5s grace window, and committed to
            // _bzApplyGuestState() immediately — flashing the auth gate until the real,
            // signed-in onAuthStateChanged(user) callback arrived a moment later and
            // corrected it. Checking bz-signed-in here closes that gap, mirroring the
            // exact same dual-signal check bzNavGuard (script.js) already uses.
            try {
                _hadCachedSession = !!localStorage.getItem('beatZen_session_uid') ||
                    document.documentElement.classList.contains('bz-signed-in');
            } catch (_) { /* private mode */ }
            if (_hadCachedSession) {
                _bzPendingGuestTimer = setTimeout(function () {
                    _bzPendingGuestTimer = null;
                    // Re-check right before committing — auth.currentUser may
                    // have been populated by a real callback that, for some
                    // reason, didn't reach this listener in time.
                    if (!auth.currentUser) _bzApplyGuestState();
                }, 1500);
                return;
            }
        }
        _bzApplyGuestState();
    }
});


// ── Bootstrap ────────────────────────────────────────────────────────────────
// (bzAuthReady is declared and resolved above, directly inside the real
// auth.onAuthStateChanged listener — see the "Auth-ready promise" comment
// before that listener for why it lives there now instead of in a wrapper.)

function onDOMReady() {
    // Do NOT call showSignedOut() here. onAuthStateChanged controls the UI.
    // Calling showSignedOut() on every page load flashes the sign-in card to
    // already signed-in users before Firebase resolves (~100-300ms on refresh).

    // ── Optimistic pre-show for returning users ───────────────────────────────
    // The HTML starts with bz-settings-locked hidden (display:none). On a refresh,
    // Firebase takes 100-500 ms to fire onAuthStateChanged. During that window a
    // signed-in user landing on Settings sees only the Sign In / Sign Up card.
    // Fix: if beatZen_session_uid exists in localStorage the user was previously
    // signed in on this device — show the settings content immediately as an
    // optimistic render. onAuthStateChanged will call showSignedOut() and hide it
    // again within milliseconds if the session is no longer valid.
    try {
        if (localStorage.getItem('beatZen_session_uid')) {
            // Optimistic pre-show for returning users — avoids flash of empty settings
            // while Firebase resolves (~100-500ms). onAuthStateChanged will hide these
            // immediately if the session is no longer valid.
            const locked = document.getElementById('bz-settings-locked');
            if (locked) locked.style.display = '';
            const syncSec = document.getElementById('bz-sync-section');
            if (syncSec) syncSec.style.display = '';

            // FIX: the block above only ever revealed the two Settings-page
            // sections — it never touched the full-screen auth gate or the
            // bz-guest class that hides the navbar/player/main-content. So a
            // returning, still-signed-in user restoring the app would see the
            // Sign Up / Sign In gate (and a hidden app shell) for the entire
            // 100-500ms it takes Firebase to confirm them, even though we
            // already know — from this very session UID — that they were
            // signed in. Mirror what showSignedIn() does so the optimistic
            // state is consistent everywhere, not just on the Settings page.
            // onAuthStateChanged is still the source of truth and will correct
            // this within milliseconds if the cached session turns out to be
            // stale (revoked token, deleted account, etc.).
            document.documentElement.classList.remove('bz-guest');
            document.documentElement.classList.add('bz-signed-in');
            const _gate = document.getElementById('bz-auth-gate');
            if (_gate) _gate.classList.remove('bz-gate-visible');
        }
    } catch (_) { /* private-mode Safari may block localStorage reads */ }
    wireSignOutButton();
    wireSyncButtons();          // wire upload, download, and auto-sync toggle
    // FIX: previously a flat setTimeout(restoreLastPlayedSong, 400) — a guess
    // at how long script.js takes to finish defining window.restoreMobileSession
    // (script.js is the much larger file and is deferred BEFORE auth.js, but
    // "loaded before" doesn't mean "finished executing first"; both are huge).
    // 400ms was too slow on a fast load (player bar sat blank/stale that whole
    // time even though localStorage already has everything needed) and not a
    // guarantee on a slow one. Now: paint the basic title/artist/cover RIGHT
    // NOW from localStorage (restoreLastPlayedSong's own manual-paint fallback
    // path handles this when restoreMobileSession isn't defined yet — pure
    // synchronous localStorage read, zero network, zero delay), then poll for
    // restoreMobileSession to exist and call it the instant it's ready for the
    // full restore (queue, playback position, etc.) instead of betting on a
    // fixed delay.
    restoreLastPlayedSong();
    (function _bzPollForFullRestore() {
        var _tries = 0;
        var _maxTries = 100; // 100 × 20ms = 2s ceiling — script.js should be long done by then
        (function _poll() {
            if (typeof window.restoreMobileSession === 'function') {
                window.restoreMobileSession();
            } else if (++_tries < _maxTries) {
                setTimeout(_poll, 20);
            }
            // else: give up silently — the basic paint above already covered the
            // visible title/artist/cover, so there's nothing left blank to show.
        })();
    })();

    window.addEventListener('beforeunload', () => {
        try {
            const audioEl = document.getElementById('audio-player');
            const ci = window.currentSongIndex;
            const pa = window.playingAlbum;
            const liveSong = (pa && pa.songs && typeof ci === 'number' && ci >= 0) ? pa.songs[ci] : null;
            // FIX 3a: Save position for any finite time > 0 (mirrors gatherLocalData fix).
            // FIX (progress-bar restore delay): this is the handler most likely to be
            // the LAST write before reload (registered after script.js's own beforeunload
            // listener), so writing a bare number here was silently downgrading the
            // richer {t, d, id} payload script.js maintains via syncProgressBar() on
            // every single refresh — discarding duration and songId. Without duration,
            // paintLastPlayedBar()/applySavedTime() can't paint the progress-bar WIDTH
            // instantly on the next load; they have to wait for the audio element to
            // re-discover its own duration from scratch, which is the visible 2-3s gap
            // between the time text restoring instantly and the bar filling in late.
            if (audioEl && isFinite(audioEl.currentTime) && audioEl.currentTime > 0) {
                localStorage.setItem('beatZen_lastPosition', JSON.stringify({
                    t: audioEl.currentTime,
                    d: isFinite(audioEl.duration) && audioEl.duration > 0 ? audioEl.duration : undefined,
                    id: liveSong?.id != null ? String(liveSong.id) : ''
                }));
            }
            if (liveSong && liveSong.id) {
                const srcAlbum = window.allSongsMap?.get(String(liveSong.id))?.album
                    || liveSong._sourceAlbum || pa;
                // FIX 3b: Always overwrite with full metadata (no songId-match guard).
                // FIX: carry forward url/duration (see matching fix in gatherLocalData)
                // so this — the very last localStorage write before a real tab close —
                // doesn't strip the fields needed for instant audio pre-load on reload.
                localStorage.setItem('lastPlayedSong', JSON.stringify({
                    albumId: String(pa.id),
                    songIndex: ci,
                    songId: String(liveSong.id),
                    type: pa.type,
                    title: liveSong.title || '',
                    artist: liveSong.artist || '',
                    cover: srcAlbum?.imageUrl || srcAlbum?.albumCover || '',
                    url: liveSong.url || '',
                    duration: liveSong.duration || '',
                    savedAt: Date.now()
                }));
            }
            // FIX Bug C: previously used isAutoSyncEnabled() which always returns true,
            // bypassing the Auto Sync toggle and uploading on every page close even when
            // the user had disabled Auto Sync. Now guarded by isAutoSyncOn().
            // FIX Bug D: removed sendBeacon to Firestore REST endpoint — Firestore REST
            // requires a Bearer auth token in the Authorization header which sendBeacon
            // cannot set. Every call silently returned 401 and wasted bandwidth.
            // The async silentUploadToCloud() below is sufficient for backgrounded tabs;
            // for true tab-close scenarios the next startAutoSync() on the next page load
            // re-syncs the saved localStorage state to the server.
            if (auth.currentUser && isAutoSyncOn()) {
                silentUploadToCloud(); // may complete if page is backgrounded, not truly closed
            }
        } catch (_) { /* non-critical */ }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onDOMReady);
} else {
    onDOMReady();
}
// ════════════════════════════════════════════════════════════════════════════
//  USERNAME + PASSWORD AUTH — BeatZen
//  Sign Up : username + password (no email asked — internal email generated)
//  Sign In : username + password
//  Firebase Auth uses  username@beatzen.app  internally (never shown to user)
//  Real email stored in Firestore only — used for forgot password
//  Username rules: 3-20 chars, start with letter, letters/numbers/._-
//  Unique, case-insensitive (stored lowercase in Firestore)
// ════════════════════════════════════════════════════════════════════════════

// ── Email format validation (strict — format + domain + TLD checks) ──────────
function isValidEmail(email) {
    if (!email) return { ok: false, reason: 'Email is required.' };

    const trimmed = email.trim().toLowerCase();

    // Must contain exactly one @ symbol
    const atCount = (trimmed.match(/@/g) || []).length;
    if (atCount !== 1) return { ok: false, reason: 'Enter a valid email address.' };

    const [localPart, domain] = trimmed.split('@');

    // Local part checks
    if (!localPart || localPart.length === 0)
        return { ok: false, reason: 'Email address is missing a username before @.' };
    if (localPart.length > 64)
        return { ok: false, reason: 'The part before @ is too long.' };
    if (localPart.startsWith('.') || localPart.endsWith('.'))
        return { ok: false, reason: 'Email username cannot start or end with a dot.' };
    if (/\.{2,}/.test(localPart))
        return { ok: false, reason: 'Email username cannot have consecutive dots.' };
    if (!/^[a-zA-Z0-9._%+\-]+$/.test(localPart))
        return { ok: false, reason: 'Email username contains invalid characters.' };

    // Domain checks
    if (!domain || domain.length === 0)
        return { ok: false, reason: 'Email address is missing a domain after @.' };
    if (domain.length > 253)
        return { ok: false, reason: 'Email domain is too long.' };
    if (!domain.includes('.'))
        return { ok: false, reason: 'Enter a valid email domain (e.g. gmail.com).' };
    if (domain.startsWith('.') || domain.endsWith('.'))
        return { ok: false, reason: 'Email domain cannot start or end with a dot.' };
    if (/\.{2,}/.test(domain))
        return { ok: false, reason: 'Email domain cannot have consecutive dots.' };
    if (!/^[a-zA-Z0-9.\-]+$/.test(domain))
        return { ok: false, reason: 'Email domain contains invalid characters.' };

    // TLD check — must be at least 2 letters
    const tld = domain.split('.').pop();
    if (!tld || tld.length < 2 || !/^[a-zA-Z]{2,}$/.test(tld))
        return { ok: false, reason: 'Enter a valid top-level domain (e.g. .com, .in, .org).' };

    // Block obviously invalid / placeholder domains
    const BLOCKED_DOMAINS = new Set([
        'example.com', 'example.org', 'example.net', 'test.com', 'test.org',
        'mailinator.com', 'guerrillamail.com', 'throwam.com', 'trashmail.com',
        'yopmail.com', 'tempmail.com', 'dispostable.com', 'sharklasers.com',
        'guerrillamailblock.com', 'grr.la', 'guerrillamail.info', 'spam4.me',
        'fakeinbox.com', 'maildrop.cc', 'spamgourmet.com', 'mytemp.email',
        'discard.email', 'tempr.email', 'throwit.email', 'burnermail.io'
    ]);
    if (BLOCKED_DOMAINS.has(domain))
        return { ok: false, reason: 'Please use a valid personal email address.' };

    return { ok: true, reason: null };
}

// ── Reserved words ────────────────────────────────────────────────────────────
const RESERVED_USERNAMES = new Set([
    'admin', 'root', 'system', 'null', 'undefined', 'beatzen', 'support',
    'moderator', 'mod', 'staff', 'official', 'login', 'signup', 'home',
    'profile', 'settings', 'search', 'playlist', 'help', 'contact'
]);

// ── Username validation ───────────────────────────────────────────────────────
const USERNAME_REGEX = /^[a-zA-Z][a-zA-Z0-9._-]{2,19}$/;

function validateUsername(username) {
    if (!username || username.length < 3) return 'Username must be at least 3 characters.';
    if (username.length > 20) return 'Username must be 20 characters or less.';
    if (!USERNAME_REGEX.test(username)) return 'Start with a letter; only letters, numbers, . _ - allowed.';
    if (username.includes('..') || username.includes('--') || username.includes('__'))
        return 'No consecutive dots, hyphens, or underscores.';
    if (RESERVED_USERNAMES.has(username.toLowerCase()))
        return 'That username is reserved. Please choose another.';
    return null; // valid
}


// ── Internal email helper (Firebase Auth requires an email) ───────────────────
function usernameToEmail(username) {
    return username.toLowerCase() + '@beatzen.app';
}

// ── Check username uniqueness in Firestore ────────────────────────────────────
async function isUsernameTaken(username) {
    const snap = await db.collection('beatzen_usernames')
        .doc(username.toLowerCase()).get();
    return snap.exists;
}

// ── Save username → Firestore ─────────────────────────────────────────────────
async function saveUsernameToFirestore(uid, username, fullName, email) {
    const lower = username.toLowerCase();
    const batch = db.batch();

    // beatzen_usernames/{lower} → uid  (uniqueness index)
    batch.set(db.collection('beatzen_usernames').doc(lower), {
        uid,
        username: lower,
        displayUsername: username,
        fullName: fullName,
        email: email.toLowerCase(),   // real email — for forgot password only
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // beatzen_users/{uid} → full profile
    batch.set(db.collection('beatzen_users').doc(uid), {
        uid,
        username: lower,
        displayUsername: username,
        fullName: fullName,
        email: email.toLowerCase(),   // real email — for forgot password only
        provider: 'username',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await batch.commit();
}

// ── Fetch user profile ────────────────────────────────────────────────────────
async function fetchUserProfile(uid) {
    try {
        const snap = await db.collection('beatzen_users').doc(uid).get();
        return snap.exists ? snap.data() : null;
    } catch (_) { return null; }
}

// ── Refresh signed-in UI with Firestore username ──────────────────────────────
async function refreshSignedInUIWithUsername(user) {
    if (!user) { showSignedOut(); return; }
    showSignedIn();

    const avatar = $('bz-auth-avatar');
    const nameEl = $('bz-auth-name');
    const emailEl = $('bz-auth-email');

    const profile = await fetchUserProfile(user.uid);
    const fullName = profile?.fullName || user.displayName || localStorage.getItem('beatzen_fullName') || '';
    const displayUsername = profile?.displayUsername || '';

    // Cache fullName locally so the non-async refreshSignedInUI can use it immediately
    if (fullName) localStorage.setItem('beatzen_fullName', fullName);

    const avatarLetter = (fullName[0] || displayUsername[0] || user.email?.[0] || 'U').toUpperCase();

    if (avatar) {
        avatar.src = '';
        avatar.style.display = 'none';
        let initWrap = document.getElementById('bz-auth-avatar-init');
        if (!initWrap) {
            initWrap = document.createElement('div');
            initWrap.id = 'bz-auth-avatar-init';
            initWrap.style.cssText = 'width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#2575fc);display:flex;align-items:center;justify-content:center;font-size:1.2rem;font-weight:700;color:#fff;flex-shrink:0;';
            if (avatar.parentNode) avatar.parentNode.insertBefore(initWrap, avatar);
        }
        initWrap.textContent = avatarLetter;
    }

    if (nameEl) nameEl.textContent = fullName || displayUsername || user.email?.split('@')[0] || 'User';
    if (emailEl) emailEl.textContent = displayUsername ? '@' + displayUsername : user.email || '';
}

// FIX: guard against the Firebase race window — calling
// refreshSignedInUIWithUsername(null) while auth.currentUser is still null
// (Firebase resolves in ~100-300ms on load) invokes showSignedOut() and
// flashes the full-screen auth gate for a signed-in user. Mirror bzNavGuard's
// dual-signal check: if bzIsAuthenticated is not yet set but a cached session
// exists, defer until bzAuthReady resolves before refreshing the UI.
window.bzRefreshAuthUI = function () {
    if (window.bzIsAuthenticated !== undefined) {
        // Auth already resolved — act immediately.
        refreshSignedInUIWithUsername(auth.currentUser);
        return;
    }
    const _likelySigned = !!(
        localStorage.getItem('beatZen_session_uid') ||
        document.documentElement.classList.contains('bz-signed-in')
    );
    if (_likelySigned) {
        // Cached session present — wait for Firebase before refreshing so we
        // never pass null to refreshSignedInUIWithUsername for a signed-in user.
        (window.bzAuthReady || Promise.resolve()).then(function () {
            refreshSignedInUIWithUsername(auth.currentUser);
        });
    } else {
        // No cached session — genuine guest; safe to call immediately.
        refreshSignedInUIWithUsername(auth.currentUser);
    }
};

// ── Show / hide forms ─────────────────────────────────────────────────────────
function showAuthForm(formId) {
    ['bz-email-signup-form', 'bz-email-signin-form', 'bz-forgot-password-form'].forEach(id => {
        const el = $(id);
        if (el) el.style.display = (id === formId) ? '' : 'none';
    });
    // Hide username toggle buttons and divider while a form is open
    const toggleBtns = document.querySelector('.bz-email-auth-btns');
    if (toggleBtns) toggleBtns.style.display = 'none';


    // Reset forgot form state when opening it
    if (formId === 'bz-forgot-password-form') {
        const eInput = $('bz-forgot-email');
        if (eInput) eInput.value = '';
        setFormError('bz-forgot-error', '');
        // Reset to step 1, hide all other steps
        showForgotStep('bz-forgot-step-input');
    }
}
function hideAllAuthForms() {
    ['bz-email-signup-form', 'bz-email-signin-form', 'bz-forgot-password-form'].forEach(id => {
        const el = $(id);
        if (el) el.style.display = 'none';
    });
    // Restore username toggle buttons
    const toggleBtns = document.querySelector('.bz-email-auth-btns');
    if (toggleBtns) toggleBtns.style.display = '';

}

// ── Inline error helper ───────────────────────────────────────────────────────
function setFormError(elId, msg) {
    const el = $(elId);
    if (!el) return;
    el.textContent = msg || '';
    el.style.display = msg ? '' : 'none';
}

// ── Email confirmation modal ───────────────────────────────────────────────────
// Shows a styled overlay asking the user to confirm their email before the
// account is actually created. Email is the password-reset address — must be right.
function showEmailConfirmModal(email, onConfirm) {
    const existing = document.getElementById('bz-email-confirm-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'bz-email-confirm-modal';
    overlay.style.cssText = [
        'position:fixed;inset:0;z-index:999999;',
        'background:rgba(0,0,0,0.72);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);',
        'display:flex;align-items:center;justify-content:center;padding:20px;',
        'animation:bzEcmIn 0.22s cubic-bezier(0.34,1.4,0.64,1) both;'
    ].join('');

    overlay.innerHTML = `
        <style>
            @keyframes bzEcmIn{from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)}}
            #bz-email-confirm-modal .bzecm-yes:hover{filter:brightness(1.12);}
            #bz-email-confirm-modal .bzecm-no:hover{background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.9);}
        </style>
        <div style="
            background:linear-gradient(145deg,#1c1040 0%,#0e0b22 100%);
            border:1.5px solid rgba(124,58,237,0.45);border-radius:22px;
            padding:30px 24px 24px;max-width:360px;width:100%;
            box-shadow:0 24px 64px rgba(0,0,0,0.75),0 0 0 1px rgba(124,58,237,0.12);
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
            animation:bzEcmIn 0.22s cubic-bezier(0.34,1.4,0.64,1) both;
        ">
            <!-- icon -->
            <div style="text-align:center;margin-bottom:18px;">
                <div style="
                    width:60px;height:60px;border-radius:50%;
                    background:linear-gradient(135deg,#7c3aed,#2575fc);
                    display:inline-flex;align-items:center;justify-content:center;
                    box-shadow:0 8px 28px rgba(124,58,237,0.55);
                ">
                    <i class="fas fa-envelope-open-text" style="color:#fff;font-size:1.5rem;"></i>
                </div>
            </div>
            <!-- title -->
            <h3 style="text-align:center;margin:0 0 8px;font-size:1.08rem;font-weight:800;color:#fff;letter-spacing:-0.2px;">
                Confirm Your Email
            </h3>
            <!-- subtitle -->
            <p style="text-align:center;margin:0 0 20px;font-size:0.8rem;color:rgba(255,255,255,0.5);line-height:1.6;">
                This email is used to <strong style="color:#a78bfa;">reset your password</strong> if you forget it.<br>
                Make sure it is correct before creating your account.
            </p>
            <!-- email pill -->
            <div style="
                background:rgba(124,58,237,0.14);
                border:1.5px solid rgba(124,58,237,0.38);
                border-radius:14px;padding:13px 16px;
                text-align:center;margin-bottom:24px;
            ">
                <div style="font-size:0.65rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#a78bfa;margin-bottom:5px;">
                    <i class="fas fa-envelope" style="margin-right:4px;"></i>YOUR EMAIL ADDRESS
                </div>
                <div style="font-size:0.97rem;font-weight:700;color:#fff;word-break:break-all;">${email}</div>
            </div>
            <!-- buttons -->
            <button class="bzecm-yes" style="
                width:100%;padding:13px;border-radius:12px;border:none;cursor:pointer;
                background:linear-gradient(135deg,#7c3aed,#2575fc);
                color:#fff;font-size:0.9rem;font-weight:700;
                box-shadow:0 4px 18px rgba(124,58,237,0.5);
                margin-bottom:10px;transition:filter 0.15s;
                display:flex;align-items:center;justify-content:center;gap:8px;
            ">
                <i class="fas fa-check-circle"></i> Yes, Create My Account
            </button>
            <button class="bzecm-no" style="
                width:100%;padding:11px;border-radius:12px;
                border:1.5px solid rgba(255,255,255,0.1);cursor:pointer;
                background:transparent;color:rgba(255,255,255,0.55);
                font-size:0.85rem;font-weight:600;transition:background 0.15s,color 0.15s;
            ">
                <i class="fas fa-pen"></i> Change Email
            </button>
        </div>`;

    document.body.appendChild(overlay);

    // "Yes" → proceed with account creation
    overlay.querySelector('.bzecm-yes').addEventListener('click', () => {
        overlay.remove();
        onConfirm();
    });

    // "Change email" → dismiss and focus the email field
    overlay.querySelector('.bzecm-no').addEventListener('click', () => {
        overlay.remove();
        const emailInput = $('bz-signup-email');
        if (emailInput) { emailInput.focus(); emailInput.select(); }
    });

    // Click outside the card → dismiss (treat same as "change email")
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// ── SIGN UP: full name + email + password + confirm ───────────────────────────
// Step 1 — validate all fields.
// Step 2 — show email confirmation modal so the user double-checks their address.
// Step 3 — onConfirm callback calls doCreateAccount to actually create the Firebase user.
function handleEmailSignUp() {
    const fullName = ($('bz-signup-fullname')?.value || '').trim();
    const email = ($('bz-signup-email')?.value || '').trim();
    const password = $('bz-signup-password')?.value || '';
    const confirm = $('bz-signup-confirm')?.value || '';

    setFormError('bz-signup-error', '');

    // ── Validate ──────────────────────────────────────────────────────────────
    if (!fullName) return setFormError('bz-signup-error', 'Please enter your full name.');
    if (fullName.length < 2) return setFormError('bz-signup-error', 'Full name must be at least 2 characters.');

    const emailCheck = isValidEmail(email);
    if (!emailCheck.ok) return setFormError('bz-signup-error', emailCheck.reason);

    if (password.length < 6)
        return setFormError('bz-signup-error', 'Password must be at least 6 characters.');
    if (password !== confirm)
        return setFormError('bz-signup-error', 'Passwords do not match.');

    // ── All valid — show confirmation modal before touching Firebase ──────────
    showEmailConfirmModal(email, () => doCreateAccount(fullName, email, password));
}

// ── Actual Firebase account creation (called after the user confirms email) ───
async function doCreateAccount(fullName, email, password) {
    const btn = $('bz-signup-submit-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating…'; }
    window._bzFreshSignIn = true; // explicit user action — see flag declaration above

    try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);

        // Set displayName in Firebase Auth so it is available immediately
        try { await cred.user.updateProfile({ displayName: fullName }); } catch (_) { }

        // Save full profile to Firestore so user-doc watcher and settings UI work
        await db.collection('beatzen_users').doc(cred.user.uid).set({
            uid: cred.user.uid,
            email: email.toLowerCase(),
            fullName: fullName,
            provider: 'email',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Persist fullName locally so avatar/settings render before next Firestore fetch
        localStorage.setItem('beatzen_fullName', fullName);

        bzToast('✓ Account created! Welcome to Beat Zen', 'success');
        hideAllAuthForms();

    } catch (err) {
        console.error('[BeatZen SignUp] code:', err.code, '| message:', err.message, '| full:', err);
        let msg = 'Sign-up failed. Try again.';
        if (err.code === 'auth/email-already-in-use') msg = 'That email is already registered. Try signing in.';
        else if (err.code === 'auth/weak-password') msg = 'Password is too weak (min 6 characters).';
        else if (err.code === 'auth/network-request-failed') msg = 'Network error. Check your connection.';
        else if (err.code === 'permission-denied') msg = 'Firestore rules blocked signup. Check rules.';
        else if (err.code === 'auth/invalid-email') msg = 'Enter a valid email address.';
        else msg = 'Sign-up failed: ' + (err.message || err.code || 'unknown error');
        setFormError('bz-signup-error', msg);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account'; }
    }
}

// ── SIGN IN: email + password ──────────────────────────────────────────────
async function handleEmailSignIn() {
    const email = ($('bz-signin-email')?.value || '').trim();
    const password = $('bz-signin-password')?.value || '';

    setFormError('bz-signin-error', '');

    if (!email) return setFormError('bz-signin-error', 'Enter your email address.');
    const emailCheck = isValidEmail(email);
    if (!emailCheck.ok) return setFormError('bz-signin-error', emailCheck.reason);
    if (!password) return setFormError('bz-signin-error', 'Enter your password.');

    const btn = $('bz-signin-submit-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in…'; }
    window._bzFreshSignIn = true; // explicit user action — see flag declaration above

    try {
        await auth.signInWithEmailAndPassword(email, password);
        bzToast('✓ Welcome back!', 'success');
        hideAllAuthForms();
    } catch (err) {
        console.error('[BeatZen SignIn]', err.code, err.message);
        let msg = 'Sign-in failed. Try again.';
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential')
            msg = 'Incorrect email or password.';
        else if (err.code === 'auth/too-many-requests') msg = 'Too many attempts. Wait a moment and try again.';
        else if (err.code === 'auth/network-request-failed') msg = 'Network error. Check your connection.';
        else if (err.code === 'auth/invalid-email') msg = 'Enter a valid email address.';
        setFormError('bz-signin-error', msg);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In'; }
    }
}

// ── FORGOT PASSWORD ───────────────────────────────────────────────────────────
// Flow:
//  Step 1 — User enters email → sendPasswordResetEmail with continueUrl → show "Check inbox"
//  Step 2 — User clicks link in email → lands on BeatZen with ?mode=resetPassword&oobCode=
//  Step 3 — BeatZen detects oobCode on load → shows "Set New Password" form
//  Step 4 — confirmPasswordReset(oobCode, newPassword) succeeds → show "Password Changed" screen

// ── Helper: show only one step inside the forgot form ────────────────────────
function showForgotStep(stepId) {
    ['bz-forgot-step-input', 'bz-forgot-step-sent', 'bz-forgot-step-reset', 'bz-forgot-step-done'].forEach(id => {
        const el = $(id);
        if (!el) return;
        if (id === stepId) {
            el.classList.remove('bz-hidden');
            el.style.display = '';
        } else {
            el.classList.add('bz-hidden');
            el.style.display = 'none';
        }
    });
}

// ── Step 1 → Step 2: send the reset email ────────────────────────────────────
async function handleForgotPassword() {
    const email = ($('bz-forgot-email')?.value || '').trim();
    setFormError('bz-forgot-error', '');

    if (!email) return setFormError('bz-forgot-error', 'Enter your email address.');
    const forgotEmailCheck = isValidEmail(email);
    if (!forgotEmailCheck.ok) return setFormError('bz-forgot-error', forgotEmailCheck.reason);

    const btn = $('bz-forgot-submit-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending…'; }

    try {
        // continueUrl brings the user back to BeatZen after Firebase validates the oobCode
        const actionCodeSettings = {
            url: window.location.origin + window.location.pathname,
            handleCodeInApp: true
        };

        // Send the reset email directly via Firebase Auth.
        // Firebase throws auth/user-not-found if no account with this email exists.
        await auth.sendPasswordResetEmail(email.toLowerCase(), actionCodeSettings);

        // ✅ Step 2: show "Check your inbox"
        showForgotStep('bz-forgot-step-sent');

        // Listen for reset completion from the new tab that opens via the email link.
        // When that tab finishes, it broadcasts 'beatzen_reset_complete' and this tab
        // jumps straight to sign-in instead of staying stuck on "Check Your Inbox".
        try {
            const resetChannel = new BroadcastChannel('beatzen_reset_complete');
            resetChannel.onmessage = () => {
                resetChannel.close();
                hideAllAuthForms();
                showAuthForm('bz-email-signin-form');
            };
        } catch (e) { /* BroadcastChannel not supported in this browser */ }

    } catch (err) {
        console.error('[BeatZen ForgotPw]', err.code, err.message);
        let msg = 'Failed to send reset email. Try again.';
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential')
            msg = 'No account found with that email address.';
        else if (err.code === 'auth/network-request-failed') msg = 'Network error. Check your connection.';
        else if (err.code === 'auth/too-many-requests') msg = 'Too many attempts. Wait a few minutes.';
        else if (err.code === 'auth/invalid-email') msg = 'Enter a valid email address.';
        setFormError('bz-forgot-error', msg);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Reset Link'; }
    }
}

// ── Step 3 → Step 4: user submits new password ───────────────────────────────
async function handleSetNewPassword(oobCode) {
    const newPw = $('bz-reset-password')?.value || '';
    const confirmPw = $('bz-reset-password-confirm')?.value || '';
    setFormError('bz-reset-error', '');

    if (newPw.length < 6) return setFormError('bz-reset-error', 'Password must be at least 6 characters.');
    if (newPw !== confirmPw) return setFormError('bz-reset-error', 'Passwords do not match.');

    const btn = $('bz-reset-submit-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…'; }

    try {
        await auth.confirmPasswordReset(oobCode, newPw);

        // Clean the oobCode from the URL so it can't be replayed
        window.history.replaceState({}, document.title,
            window.location.origin + window.location.pathname);

        // ✅ Step 4: show "Password Changed Successfully"
        showForgotStep('bz-forgot-step-done');

        // Update the success screen: this is a dedicated reset tab opened from email,
        // so direct the user back to their original tab instead of navigating here.
        const doneP = $('bz-forgot-step-done')?.querySelector('p');
        if (doneP) doneP.innerHTML = 'Your password has been updated. Head back to your <strong style="color:#a78bfa;">previous tab</strong> to sign in.';
        const doneBtn = $('bz-forgot-done-signin-btn');
        if (doneBtn) {
            doneBtn.innerHTML = '<i class="fas fa-times"></i> Close this tab';
            doneBtn.onclick = () => { window.close(); };
        }

        // Notify the original tab (stuck on "Check Your Inbox") — it will
        // jump straight to the sign-in form via BroadcastChannel.
        try {
            const resetChannel = new BroadcastChannel('beatzen_reset_complete');
            resetChannel.postMessage('done');
            resetChannel.close();
        } catch (e) { /* BroadcastChannel not supported in this browser */ }

    } catch (err) {
        console.error('[BeatZen ResetPw]', err.code, err.message);
        if (err.code === 'auth/expired-action-code' || err.code === 'auth/invalid-action-code') {
            // Link expired or already used — send them back to step 1 to request a new one
            window.history.replaceState({}, document.title,
                window.location.origin + window.location.pathname);
            showForgotStep('bz-forgot-step-input');
            setFormError('bz-forgot-error',
                err.code === 'auth/expired-action-code'
                    ? 'This reset link has expired. Enter your email to get a new one.'
                    : 'This link has already been used. Enter your email to get a new one.');
        } else {
            const msg = (err.code === 'auth/weak-password')
                ? 'Password is too weak. Use at least 6 characters.'
                : 'Failed to reset password. Please try again.';
            setFormError('bz-reset-error', msg);
        }
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-key"></i> Set New Password'; }
    }
}

// ── Page-load: detect Firebase oobCode in URL ────────────────────────────────
async function handlePasswordResetCode() {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const oobCode = params.get('oobCode');

    if (mode !== 'resetPassword' || !oobCode) return; // Not a password reset link

    // Navigate to the Settings tab so the reset form is actually on screen.
    // window.displaySettings is defined by script.js which loads after auth.js.
    // We wait for DOMContentLoaded (already fired here) but script.js initialises
    // its globals asynchronously; poll for up to 2 s before falling back to a link click.
    function _goToSettings() {
        if (typeof window.displaySettings === 'function') {
            window.displaySettings();
            return;
        }
        // Fallback: click the settings nav link directly
        const sLink = document.getElementById('settings-link');
        if (sLink) sLink.click();
    }

    // Give script.js a tick to finish registering globals, then navigate
    setTimeout(_goToSettings, 80);

    try {
        // Verify the code is still valid before showing the form
        await auth.verifyPasswordResetCode(oobCode);

        // Open the forgot-password form and jump straight to step 3 (new password)
        showAuthForm('bz-forgot-password-form');
        showForgotStep('bz-forgot-step-reset');

        // Make sure the signed-out auth panel is visible
        const authOut = $('bz-auth-signedout');
        if (authOut) authOut.style.display = '';

        // Wire the submit button with the confirmed oobCode
        const btn = $('bz-reset-submit-btn');
        if (btn) {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', () => handleSetNewPassword(oobCode));
        }

        // Enter key on confirm-password field
        const confirmInput = $('bz-reset-password-confirm');
        if (confirmInput) {
            confirmInput.addEventListener('keydown', e => {
                if (e.key === 'Enter') handleSetNewPassword(oobCode);
            });
        }

    } catch (err) {
        console.error('[BeatZen oobCode verify]', err.code, err.message);

        // Code expired or already used — stay on Settings, land on step 1 so the
        // user can immediately request a fresh link without switching tabs manually.
        const authOut = $('bz-auth-signedout');
        if (authOut) authOut.style.display = '';

        showAuthForm('bz-forgot-password-form');
        showForgotStep('bz-forgot-step-input');

        const msg = (err.code === 'auth/expired-action-code')
            ? 'This reset link has expired. Enter your email below to get a new one.'
            : 'This reset link has already been used. Enter your email below to get a new one.';
        setFormError('bz-forgot-error', msg);

        window.history.replaceState({}, document.title,
            window.location.origin + window.location.pathname);
    }
}

// ── Wire all email-auth buttons ───────────────────────────────────────────────
function wireEmailAuthButtons() {
    const showSignup = $('bz-show-signup-btn');
    const showSignin = $('bz-show-signin-btn');
    if (showSignup) showSignup.addEventListener('click', () => showAuthForm('bz-email-signup-form'));
    if (showSignin) showSignin.addEventListener('click', () => showAuthForm('bz-email-signin-form'));

    ['bz-signup-back-btn', 'bz-signin-back-btn', 'bz-forgot-back-btn'].forEach(id => {
        const el = $(id);
        if (el) el.addEventListener('click', hideAllAuthForms);
    });

    const signupBtn = $('bz-signup-submit-btn');
    if (signupBtn) signupBtn.addEventListener('click', handleEmailSignUp);

    const signinBtn = $('bz-signin-submit-btn');
    if (signinBtn) {
        signinBtn.disabled = true;
        signinBtn.style.opacity = '0.45';
        signinBtn.style.cursor = 'not-allowed';
        signinBtn.addEventListener('click', handleEmailSignIn);
    }

    // Forgot password link from sign-in form
    const forgotLink = $('bz-forgot-link-btn');
    if (forgotLink) forgotLink.addEventListener('click', () => showAuthForm('bz-forgot-password-form'));

    // Forgot password submit (step 1)
    const forgotBtn = $('bz-forgot-submit-btn');
    if (forgotBtn) forgotBtn.addEventListener('click', handleForgotPassword);

    // Enter key on forgot email field
    const forgotEmailInput = $('bz-forgot-email');
    if (forgotEmailInput) {
        forgotEmailInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') handleForgotPassword();
        });
    }

    // Step 2 "Check inbox" → Back to Sign In button
    const gotoSignin = $('bz-forgot-goto-signin');
    if (gotoSignin) gotoSignin.addEventListener('click', () => {
        hideAllAuthForms();
        showAuthForm('bz-email-signin-form');
    });

    // Step 4 "Password Changed" — if this is the reset tab (opened from email link),
    // the button closes the tab; the original tab handles sign-in via BroadcastChannel.
    // If somehow reached on the original tab, fall back to showing sign-in.
    const doneSininBtn = $('bz-forgot-done-signin-btn');
    if (doneSininBtn) doneSininBtn.addEventListener('click', () => {
        if (!window.close()) {
            // window.close() is blocked (tab not opened by script) — fall back gracefully
            hideAllAuthForms();
            showAuthForm('bz-email-signin-form');
        }
    });

    // Enable Sign In button only when email field has valid content
    const signinEmailInput = $('bz-signin-email');
    function updateSignInBtnState() {
        const btn = $('bz-signin-submit-btn');
        if (!btn) return;
        const val = (signinEmailInput?.value || '').trim();
        const valid = val.length >= 5 && isValidEmail(val).ok;
        btn.disabled = !valid;
        btn.style.opacity = valid ? '1' : '0.45';
        btn.style.cursor = valid ? 'pointer' : 'not-allowed';
    }
    if (signinEmailInput) {
        signinEmailInput.addEventListener('input', updateSignInBtnState);
    }

    // Enter key support
    const signupConfirm = $('bz-signup-confirm');
    if (signupConfirm) signupConfirm.addEventListener('keydown', e => { if (e.key === 'Enter') handleEmailSignUp(); });
    const signinPw = $('bz-signin-password');
    if (signinPw) signinPw.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            const val = ($('bz-signin-email')?.value || '').trim();
            if (val.length >= 5 && isValidEmail(val).ok) handleEmailSignIn();
        }
    });
}

// NOTE: Username localStorage sync + Google Sheets analytics were previously
// in a separate auth.onAuthStateChanged listener here, which caused a race:
// both listeners fire on every auth change, and this one's else-branch set
// window.bzIsAuthenticated = false, making bzNavGuard show the auth gate on
// every nav click while the user was logged in. Both tasks are now handled
// inside the single main onAuthStateChanged block above (search for
// '── Username-auth: sync profile + analytics ──' inside that block).

// ── Bootstrap email auth wiring ───────────────────────────────────────────────
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        wireEmailAuthButtons();
        handlePasswordResetCode(); // detect ?mode=resetPassword&oobCode= on page load
    });
} else {
    wireEmailAuthButtons();
    handlePasswordResetCode(); // detect ?mode=resetPassword&oobCode= on page load
}
// ════════════════════════════════════════════════════════════════════════════
//  AUTH GATE INLINE FORMS — wires the sign-up/sign-in/forgot forms
//  that live INSIDE #bz-auth-gate so no app content is ever shown to
//  unauthenticated users. These forms mirror the Settings panel forms
//  but are completely self-contained inside the gate overlay.
// ════════════════════════════════════════════════════════════════════════════

function bzGateShowPanel(panelId) {
    const panels = [
        'bz-gate-landing',
        'bz-gate-signup-form',
        'bz-gate-signin-form',
        'bz-gate-forgot-form'
    ];
    panels.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = (id === panelId) ? '' : 'none';
    });
}

function bzGateSetError(elId, msg) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent = msg || '';
    el.style.display = msg ? '' : 'none';
}

// ── Gate Sign Up handler ──────────────────────────────────────────────────────
function bzGateHandleSignUp() {
    const fullName = (document.getElementById('bz-gate-su-fullname')?.value || '').trim();
    const email = (document.getElementById('bz-gate-su-email')?.value || '').trim();
    const password = document.getElementById('bz-gate-su-password')?.value || '';
    const confirm = document.getElementById('bz-gate-su-confirm')?.value || '';

    bzGateSetError('bz-gate-su-error', '');

    if (!fullName) return bzGateSetError('bz-gate-su-error', 'Please enter your full name.');
    if (fullName.length < 2) return bzGateSetError('bz-gate-su-error', 'Full name must be at least 2 characters.');

    const emailCheck = isValidEmail(email);
    if (!emailCheck.ok) return bzGateSetError('bz-gate-su-error', emailCheck.reason);
    if (password.length < 6) return bzGateSetError('bz-gate-su-error', 'Password must be at least 6 characters.');
    if (password !== confirm) return bzGateSetError('bz-gate-su-error', 'Passwords do not match.');

    showEmailConfirmModal(email, () => bzGateDoCreateAccount(fullName, email, password));
}

async function bzGateDoCreateAccount(fullName, email, password) {
    const btn = document.getElementById('bz-gate-su-submit');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating…'; }
    window._bzFreshSignIn = true; // explicit user action — see flag declaration above
    try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        try { await cred.user.updateProfile({ displayName: fullName }); } catch (_) { }
        await db.collection('beatzen_users').doc(cred.user.uid).set({
            uid: cred.user.uid,
            email: email.toLowerCase(),
            fullName: fullName,
            provider: 'email',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        localStorage.setItem('beatzen_fullName', fullName);
        bzToast('✓ Account created! Welcome to Beat Zen', 'success');
        // onAuthStateChanged will fire and dismiss the gate automatically
    } catch (err) {
        let msg = 'Sign-up failed. Try again.';
        if (err.code === 'auth/email-already-in-use') msg = 'That email is already registered. Try signing in.';
        else if (err.code === 'auth/weak-password') msg = 'Password is too weak (min 6 characters).';
        else if (err.code === 'auth/network-request-failed') msg = 'Network error. Check your connection.';
        else if (err.code === 'auth/invalid-email') msg = 'Enter a valid email address.';
        else msg = 'Sign-up failed: ' + (err.message || err.code || 'unknown error');
        bzGateSetError('bz-gate-su-error', msg);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account'; }
    }
}

// ── Gate Sign In handler ──────────────────────────────────────────────────────
async function bzGateHandleSignIn() {
    const email = (document.getElementById('bz-gate-si-email')?.value || '').trim();
    const password = document.getElementById('bz-gate-si-password')?.value || '';

    bzGateSetError('bz-gate-si-error', '');

    if (!email) return bzGateSetError('bz-gate-si-error', 'Enter your email address.');
    const emailCheck = isValidEmail(email);
    if (!emailCheck.ok) return bzGateSetError('bz-gate-si-error', emailCheck.reason);
    if (!password) return bzGateSetError('bz-gate-si-error', 'Enter your password.');

    const btn = document.getElementById('bz-gate-si-submit');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in…'; }
    window._bzFreshSignIn = true; // explicit user action — see flag declaration above

    try {
        await auth.signInWithEmailAndPassword(email, password);
        bzToast('✓ Welcome back!', 'success');
        // onAuthStateChanged will fire and dismiss the gate automatically
    } catch (err) {
        let msg = 'Sign-in failed. Try again.';
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential')
            msg = 'Incorrect email or password.';
        else if (err.code === 'auth/too-many-requests') msg = 'Too many attempts. Wait a moment and try again.';
        else if (err.code === 'auth/network-request-failed') msg = 'Network error. Check your connection.';
        else if (err.code === 'auth/invalid-email') msg = 'Enter a valid email address.';
        bzGateSetError('bz-gate-si-error', msg);
    } finally {
        if (btn) {
            const emailVal = (document.getElementById('bz-gate-si-email')?.value || '').trim();
            const isValid = emailVal.length >= 5 && isValidEmail(emailVal).ok;
            btn.disabled = !isValid;
            btn.style.opacity = isValid ? '1' : '0.45';
            btn.style.cursor = isValid ? 'pointer' : 'not-allowed';
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
        }
    }
}

// ── Gate Forgot Password handler ──────────────────────────────────────────────
async function bzGateHandleForgotPassword() {
    const email = (document.getElementById('bz-gate-fp-email')?.value || '').trim();
    bzGateSetError('bz-gate-fp-error', '');

    if (!email) return bzGateSetError('bz-gate-fp-error', 'Enter your email address.');
    const emailCheck = isValidEmail(email);
    if (!emailCheck.ok) return bzGateSetError('bz-gate-fp-error', emailCheck.reason);

    const btn = document.getElementById('bz-gate-fp-submit');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending…'; }

    try {
        const actionCodeSettings = {
            url: window.location.origin + window.location.pathname,
            handleCodeInApp: true
        };
        await auth.sendPasswordResetEmail(email.toLowerCase(), actionCodeSettings);
        // Show step 2
        const step1 = document.getElementById('bz-gate-forgot-step1');
        const step2 = document.getElementById('bz-gate-forgot-step2');
        if (step1) step1.style.display = 'none';
        if (step2) step2.style.display = '';
    } catch (err) {
        let msg = 'Failed to send reset email. Try again.';
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential')
            msg = 'No account found with that email address.';
        else if (err.code === 'auth/network-request-failed') msg = 'Network error. Check your connection.';
        else if (err.code === 'auth/too-many-requests') msg = 'Too many attempts. Wait a few minutes.';
        else if (err.code === 'auth/invalid-email') msg = 'Enter a valid email address.';
        bzGateSetError('bz-gate-fp-error', msg);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Reset Link'; }
    }
}

// ── Wire gate form buttons ────────────────────────────────────────────────────
function wireAuthGateForms() {
    // Landing → forms
    const signupBtn = document.getElementById('bz-gate-signup-btn');
    if (signupBtn) signupBtn.addEventListener('click', () => bzGateShowPanel('bz-gate-signup-form'));

    const signinBtn = document.getElementById('bz-gate-signin-btn');
    if (signinBtn) signinBtn.addEventListener('click', () => bzGateShowPanel('bz-gate-signin-form'));

    // Back buttons
    const suBack = document.getElementById('bz-gate-signup-back');
    if (suBack) suBack.addEventListener('click', () => bzGateShowPanel('bz-gate-landing'));

    const siBack = document.getElementById('bz-gate-signin-back');
    if (siBack) siBack.addEventListener('click', () => bzGateShowPanel('bz-gate-landing'));

    const fpBack = document.getElementById('bz-gate-forgot-back');
    if (fpBack) fpBack.addEventListener('click', () => bzGateShowPanel('bz-gate-signin-form'));

    // Cross-links
    const suToSi = document.getElementById('bz-gate-su-to-si');
    if (suToSi) suToSi.addEventListener('click', () => bzGateShowPanel('bz-gate-signin-form'));

    const siToSu = document.getElementById('bz-gate-si-to-su');
    if (siToSu) siToSu.addEventListener('click', () => bzGateShowPanel('bz-gate-signup-form'));

    const fpToSi = document.getElementById('bz-gate-fp-to-si');
    if (fpToSi) fpToSi.addEventListener('click', () => bzGateShowPanel('bz-gate-signin-form'));

    const siForgot = document.getElementById('bz-gate-si-forgot');
    if (siForgot) siForgot.addEventListener('click', () => {
        bzGateShowPanel('bz-gate-forgot-form');
        // Reset forgot form
        const step1 = document.getElementById('bz-gate-forgot-step1');
        const step2 = document.getElementById('bz-gate-forgot-step2');
        if (step1) step1.style.display = '';
        if (step2) step2.style.display = 'none';
        const fpInput = document.getElementById('bz-gate-fp-email');
        if (fpInput) fpInput.value = '';
        bzGateSetError('bz-gate-fp-error', '');
    });

    const fpGotoSi = document.getElementById('bz-gate-fp-goto-si');
    if (fpGotoSi) fpGotoSi.addEventListener('click', () => bzGateShowPanel('bz-gate-signin-form'));

    // Submit buttons
    const suSubmit = document.getElementById('bz-gate-su-submit');
    if (suSubmit) suSubmit.addEventListener('click', bzGateHandleSignUp);

    const siSubmit = document.getElementById('bz-gate-si-submit');
    if (siSubmit) siSubmit.addEventListener('click', bzGateHandleSignIn);

    const fpSubmit = document.getElementById('bz-gate-fp-submit');
    if (fpSubmit) fpSubmit.addEventListener('click', bzGateHandleForgotPassword);

    // Enter key support
    const suConfirmInput = document.getElementById('bz-gate-su-confirm');
    if (suConfirmInput) suConfirmInput.addEventListener('keydown', e => { if (e.key === 'Enter') bzGateHandleSignUp(); });

    const siPwInput = document.getElementById('bz-gate-si-password');
    if (siPwInput) siPwInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            const val = (document.getElementById('bz-gate-si-email')?.value || '').trim();
            if (val.length >= 5 && isValidEmail(val).ok) bzGateHandleSignIn();
        }
    });

    const fpEmailInput = document.getElementById('bz-gate-fp-email');
    if (fpEmailInput) fpEmailInput.addEventListener('keydown', e => { if (e.key === 'Enter') bzGateHandleForgotPassword(); });

    // Enable sign-in button only when email is valid
    const siEmailInput = document.getElementById('bz-gate-si-email');
    if (siEmailInput) {
        siEmailInput.addEventListener('input', function () {
            const btn = document.getElementById('bz-gate-si-submit');
            if (!btn) return;
            const val = (this.value || '').trim();
            const valid = val.length >= 5 && isValidEmail(val).ok;
            btn.disabled = !valid;
            btn.style.opacity = valid ? '1' : '0.45';
            btn.style.cursor = valid ? 'pointer' : 'not-allowed';
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireAuthGateForms);
} else {
    wireAuthGateForms();
}