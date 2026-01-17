/**
 * Beat Zen - buttons.js
 */

const BeatZenButtons = {

    /**
     * HTML
     */
    generateActionBarHTML: function(album, isPlaying) {
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
    initEventListeners: function(album, playAllCallback, toggleCallback) {
        
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
                const shareData = {
                    title: `Beat Zen - ${album.title}`,
                    text: `Check out the songs from "${album.title}" on Beat Zen!`,
                    url: `${window.location.origin}${window.location.pathname}#album-${album.id}`
                };

                // Browser
                if (navigator.share) {
                    try {
                        await navigator.share(shareData);
                    } catch (err) { 
                        // End
                    }
                } else {
                    // Fallback
                    const waUrl = `https://wa.me/?text=${encodeURIComponent(shareData.text + " " + shareData.url)}`;
                    window.open(waUrl, '_blank');
                }
                // Reset
                shareBtn.blur();
            };
        }
    },

    /**
     * Sync
     */
    updateSyncButtonUI: function(isPaused) {
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