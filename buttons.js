/**
 * Beat Zen - buttons.js
 * * Handles the logic for specialized album action buttons:
 * 1. Play/Pause Sync: A dynamic button that starts the album or toggles current playback.
 * 2. Status Sharing: Opens the device's native share sheet for WhatsApp/Instagram.
 */

const BeatZenButtons = {

    /**
     * GENERATE HTML
     * Creates the button structure to be injected into the album view.
     * Note: The "Copy Link" button has been removed from this layout.
     * * @param {Object} album - The current album object.
     * @param {Boolean} isPlaying - Current global playback state.
     */
    generateActionBarHTML: function(album, isPlaying) {
        // Determine icons and labels based on whether this specific album is playing
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
     * ATTACH LOGIC & EVENT LISTENERS
     * Initializes the functionality for buttons after they are added to the DOM.
     * * @param {Object} album - The album data context.
     * @param {Function} playAllCallback - Function to start album from song 0.
     * @param {Function} toggleCallback - Function to toggle play/pause state.
     */
    initEventListeners: function(album, playAllCallback, toggleCallback) {
        
        // --- LOGIC: SYNCED PLAY/PAUSE ---
        const syncBtn = document.getElementById('album-sync-play');
        if (syncBtn) {
            syncBtn.onclick = () => {
                // Check if the album the user is looking at is the one currently playing
                const isThisAlbumActive = (window.playingAlbum && String(window.playingAlbum.id) === String(album.id));
                
                if (isThisAlbumActive) {
                    // If active, just toggle (Pause/Resume)
                    toggleCallback();
                } else {
                    // If not active, load this album and start from the first song
                    playAllCallback();
                }
            };
        }

        // --- LOGIC: STATUS/STORY SHARING ---
        const shareBtn = document.getElementById('share-status');
        if (shareBtn) {
            shareBtn.onclick = async () => {
                const shareData = {
                    title: `Beat Zen - ${album.title}`,
                    text: `Check out the songs from "${album.title}" on Beat Zen!`,
                    url: `${window.location.origin}${window.location.pathname}#album-${album.id}`
                };

                // Use Web Share API (Mobile Browsers)
                if (navigator.share) {
                    try {
                        await navigator.share(shareData);
                    } catch (err) { 
                        console.log("Share interaction ended."); 
                    }
                } else {
                    // Desktop Fallback: Open WhatsApp directly
                    const waUrl = `https://wa.me/?text=${encodeURIComponent(shareData.text + " " + shareData.url)}`;
                    window.open(waUrl, '_blank');
                }
            };
        }
    },

    /**
     * UI UPDATER
     * Syncs the Album View button state when changes occur via the bottom player or keyboard.
     * Called from script.js inside the updatePlayPauseIcon function.
     * * @param {Boolean} isPaused - Current state of the audio element.
     */
    updateSyncButtonUI: function(isPaused) {
        const syncBtn = document.getElementById('album-sync-play');
        if (syncBtn) {
            const icon = syncBtn.querySelector('i');
            const span = syncBtn.querySelector('span');
            
            if (icon && span) {
                // Update icon and text to reflect global state
                icon.className = isPaused ? 'fas fa-play' : 'fas fa-pause';
                span.textContent = isPaused ? 'Play All' : 'Pause';
            }
        }
    }
};