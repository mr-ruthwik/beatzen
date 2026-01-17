document.addEventListener('DOMContentLoaded', () => {

    /****************/
    /* VALIDATION   */
    /****************/
    // Verifies that all external data dependencies are loaded before starting
    if (typeof customYearAlbumsData === 'undefined' ||
        typeof customPlaylistsData === 'undefined' ||
        typeof customArtistsData === 'undefined') {
        console.error("Beat Zen: Critical data files missing.");
        return;
    }

    /***************/
    /* STATE       */
    /***************/
    // Global container for the current view and active playback status
    window.currentAlbum = null;
    window.playingAlbum = null;
    window.currentSongIndex = -1;
    window.isShuffling = false;
    window.isLooping = false;
    window.shuffledIndices = [];

    /****************/
    /* VARIABLES    */
    /****************/
    // Local variables for managing the sleep timer interval and selection values
    let timerInterval = null;
    let isDragging = false; // Move this here!
    let selH = 0, selM = 0, selS = 0;

    /****************/
    /* DATA POOLING */
    /****************/
    const allYears = Object.keys(customYearAlbumsData).sort().reverse();
    const allAlbums = Object.values(customYearAlbumsData).flat();
    const exploreList = typeof customGenreData !== 'undefined' ? Object.values(customGenreData).flat() : [];
    const playlistList = typeof customPlaylistsData !== 'undefined' ? Object.values(customPlaylistsData).flat() : [];

    // FEATURE: Persistent Data Merger
    // Instead of just creating a list, we merge to ensure no data is lost during runtime updates
    if (!window.masterPool) {
        window.masterPool = [];
    }

    const newItems = [...allAlbums, ...exploreList, ...playlistList];

    newItems.forEach(newItem => {
        const itemId = String(newItem.id || newItem.name || newItem.title);
        const exists = window.masterPool.some(existing => String(existing.id || existing.name || existing.title) === itemId);

        if (!exists) {
            window.masterPool.push(newItem);
        } else {
            // If it exists, update the songs array to include new songs without removing old ones
            const index = window.masterPool.findIndex(existing => String(existing.id || existing.name || existing.title) === itemId);
            const existingSongs = window.masterPool[index].songs || [];
            const incomingSongs = newItem.songs || [];

            // Merge songs and remove duplicates by ID
            const mergedSongs = [...existingSongs, ...incomingSongs];
            window.masterPool[index].songs = Array.from(new Map(mergedSongs.map(s => [s.id || s, s])).values());
        }
    });

    // minimize button for maximise feature
    const minimizeBtn = document.getElementById('minimize-btn');

    // Create the master list first
    const masterPool = [...allAlbums, ...exploreList, ...playlistList];

    //  EXPORT TO WINDOW: This allows mobile.js to access data on refresh
    window.masterPool = masterPool;

    // Ensure the pool created by the Merger is the one used globally
    if (window.masterPool.length === 0) {
        window.masterPool = [...allAlbums, ...exploreList, ...playlistList];
    } else {
        // Just export the existing merged pool
        const masterPool = window.masterPool;
    }

    /****************/
    /* MAPPING      */
    /****************/
    // Creates a high-speed Map for O(1) song lookups by ID
    // Modified to be additive: preserves existing mappings when new data scripts load
    if (!window.allSongsMap) window.allSongsMap = new Map();

    window.masterPool.forEach(album => {
        album.songs?.forEach(song => {
            const sId = String(typeof song === 'string' ? song : song.id);
            const sData = typeof song === 'object' ? song : null;

            if (!sData) {
                // Look for song data in all possible sources if only an ID was provided
                const found = allAlbums.find(mov => mov.songs.some(x => String(x.id) === sId));
                if (found) {
                    const songObj = found.songs.find(x => String(x.id) === sId);
                    window.allSongsMap.set(sId, { ...songObj, album: found });
                }
            } else {
                window.allSongsMap.set(sId, { ...sData, album: album });
            }
        });
    });

    /************************************************/
    /* EXPLORE VIEW ENGINE: CATEGORIZED RENDERING   */
    /************************************************/
    function displayexplore(isBack = false) {
        // 1. Setup the View and reset container
        navigateToView('explore', exploreContainer, isBack);
        
        if (exploreContainer) {
            exploreContainer.style.display = 'block';
            exploreContainer.innerHTML = ''; // Clear previous content
        } else {
            console.error("Beat Zen: exploreContainer not found.");
            return;
        }

        // 2. Loop through your specific categories in explore.js
        if (typeof customGenreData !== 'undefined') {
            Object.keys(customGenreData).forEach(categoryName => {
                // Create a section for each category (e.g., "Just Arrived", "Recap")
                const section = document.createElement('div');
                section.className = 'year-section';
                section.innerHTML = `<h2>${categoryName}</h2><div class="albums-grid"></div>`;
                
                const grid = section.querySelector('.albums-grid');

                // 3. Render items within this specific category
                customGenreData[categoryName].forEach(item => {
                    // Standardize data for playback resolution
                    const itemId = String(item.id || item.name);
                    
                    // Render the visual card using your master renderCard utility
                    const card = renderCard(
                        item.name || item.title, 
                        item.albumCover || item.imageUrl, 
                        () => selectAlbum(resolveData(item, "Collection")), 
                        itemId
                    );
                    grid.appendChild(card);
                });

                exploreContainer.appendChild(section);
            });
        }

        // 4. Update History and Scroll position
        if (!isBack) {
            history.pushState({ view: 'explore' }, 'Explore', '#explore');
        }

        // Auto-scroll to top of explore view
        window.scrollTo({ top: 0, behavior: 'instant' });
    }


    /********************************/
    /* GLOBAL EXPORTS (RECOVERY)    */
    /********************************/

    // EXPORT: Logic
    window.resolveData = function (data, type) {
        if (!data) return null;

        // ID
        const consistentId = data.id || data.name || data.title;

        // SONGS
        const songs = (data.songs || []).map(id =>
            typeof id === 'string' ? allSongsMap.get(id) : id
        ).filter(Boolean);

        // TIME
        const durationStr = (function () {
            let total = 0;
            songs.forEach(s => {
                if (s?.duration) {
                    const p = s.duration.split(':');
                    total += parseInt(p[0]) * 60 + parseInt(p[1]);
                }
            });
            const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
            return `${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm ' : ''}${s}s`.trim();
        })();

        // HTML
        let details = (type === "Artist" || type === "Playlist" || type === "Collection")
            ? `<p><strong>Songs :</strong> ${songs.length} &nbsp;&nbsp; <strong>Duration :</strong> ${durationStr}</p>`
            : `<p><strong>Actors:</strong> ${data.actors || 'N/A'}</p><p><strong>Year:</strong> ${data.year || 'N/A'}</p>`;

        return {
            id: String(consistentId),
            title: data.name || data.title || 'Unknown',
            imageUrl: data.imageUrl || data.albumCover || '',
            songs: songs,
            detailsHtml: details,
            type: type,
            year: data.year || null
        };
    };

    // EXPORT: Methods
    window.togglePlayback = togglePlayback;
    window.playNextSong = playNextSong;
    window.playPrevSong = playPrevSong;

    /************************************************/
    /* ADVANCED PLAY ENGINE: THE 10-FEATURE STACK   */
    /************************************************/
    window.playSong = async function (index, shouldPlay = true) {
        // 1. DATA VALIDATION & SAFETY
        if (!window.playingAlbum || !window.playingAlbum.songs || !window.playingAlbum.songs[index]) return;

        window.currentSongIndex = index;
        const song = window.playingAlbum.songs[index];

        // 2. FEATURE: STRICT STRING ID MAPPING
        // Ensures data-type consistency across storage and URL lookups
        const albumIdStr = String(window.playingAlbum.id);
        const songIdStr = String(song.id);

        // 3. FEATURE: BROWSER HISTORY SYNC (Deep Linking)
        const historyTitle = `${song.title} • ${window.playingAlbum.title}`;
        const historyUrl = `#album-${albumIdStr}/song-${songIdStr}`;

        if (shouldPlay) {
            history.pushState({
                view: 'album',
                albumId: albumIdStr,
                songIndex: index,
                songId: songIdStr
            }, historyTitle, historyUrl);

            // 4. FEATURE: DYNAMIC BROWSER TAB BRANDING
            document.title = historyTitle;
        }

        // 5. FEATURE: PERSISTENT SESSION STORAGE
        localStorage.setItem('lastPlayedSong', JSON.stringify({
            albumId: albumIdStr,
            songIndex: index,
            type: window.playingAlbum.type
        }));

        // 6. FEATURE: METADATA RESOLUTION & UI SYNC
        const songMasterData = allSongsMap.get(songIdStr);
        const albumData = songMasterData?.album || window.playingAlbum;

        if (playerSongTitle) playerSongTitle.textContent = song.title;
        if (playerSongArtist) playerSongArtist.textContent = song.artist;
        if (playerAlbumCover) playerAlbumCover.src = albumData.imageUrl;

        // --- FULLSCREEN HEADER SYNC ---
        const headerLabel = document.getElementById('header-playing-from');
        const headerMovie = document.getElementById('header-movie-name');

        if (headerLabel && headerMovie && window.playingAlbum) {
            // Determine the label based on the source type
            let labelText = "PLAYING FROM";
            const type = window.playingAlbum.type;

            if (type === "Movie") labelText = "PLAYING FROM MOVIE";
            else if (type === "Artist") labelText = "PLAYING FROM ARTIST";
            else if (type === "Playlist") labelText = "PLAYING FROM PLAYLIST";
            else if (type === "Collection") labelText = "PLAYING FROM COLLECTION";

            headerLabel.textContent = labelText;
            headerMovie.textContent = window.playingAlbum.title || window.playingAlbum.name || "Unknown";
        }

        // 7. FEATURE: AUDIO HARDWARE HANDSHAKING
        // Cleanly detaches events to prevent "Skip Bugs" during source change
        audioPlayer.onended = null;
        audioPlayer.pause();
        audioPlayer.src = song.url;
        audioPlayer.load();

        // 8. FEATURE: STABLE MEDIASESSION (Lock Screen Control)
        // Set metadata once per track to prevent notification panel flickering
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: song.title,
                artist: song.artist,
                album: albumData.title || albumData.name || "Beat Zen",
                artwork: [{ src: albumData.imageUrl, sizes: '512x512', type: 'image/jpeg' }]
            });

            // Mapping Action Handlers to Global Window Methods for stability
            const actions = [
                ['play', () => window.togglePlayback()],
                ['pause', () => window.togglePlayback()],
                ['previoustrack', () => window.playPrevSong()],
                ['nexttrack', () => window.playNextSong()],
                ['seekto', (details) => {
                    if (details.seekTime && isFinite(details.seekTime)) {
                        audioPlayer.currentTime = details.seekTime;
                    }
                }]
            ];
            actions.forEach(([action, handler]) => {
                try { navigator.mediaSession.setActionHandler(action, handler); } catch (e) { }
            });
        }

        // 9. FEATURE: ASYNC EXECUTION & RECOVERY HANDSHAKE
        if (shouldPlay) {
            audioPlayer.play().then(() => {
                updatePlayPauseIcon();
                updateDynamicTitle();
                audioPlayer.onended = handleTrackEnded;
            }).catch((err) => {
                audioPlayer.onended = handleTrackEnded;
            });
        } else {
            // SILENT RESTORATION MODE (Triggers on Page Refresh)
            updatePlayPauseIcon();
            updateDynamicTitle();

            // We must wait for the audio engine to "wake up" before asking for saved time
            audioPlayer.addEventListener('loadedmetadata', () => {
                if (window.applySavedTime) window.applySavedTime();

                // Small buffer before allowing the player to "end" naturally
                setTimeout(() => { audioPlayer.onended = handleTrackEnded; }, 1500);
            }, { once: true });

            // Fallback for browsers that cached the audio and skip 'loadedmetadata'
            if (audioPlayer.readyState >= 1) {
                if (window.applySavedTime) window.applySavedTime();
            }
        }

        // 10. FEATURE: ACTIVE QUEUE HIGHLIGHTING
        if (typeof updateActiveSongHighlight === 'function') {
            updateActiveSongHighlight();
        }
    };


    // MASTER CONTROLLER: Handles what happens when a track finishes naturally
    function handleTrackEnded() {
        console.log("Beat Zen: Track finished naturally.");
        if (window.isLooping) {
            audioPlayer.currentTime = 0;
            audioPlayer.play().catch(() => { });
        } else {
            playNextSong();
        }
    }

    /************************************************/
    /* HARDWARE POSITION SYNC (Lock Screen Timer)   */
    /************************************************/
    function updateMediaPositionState() {
        if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
            const dur = audioPlayer.duration;
            const cur = audioPlayer.currentTime;

            // Validation: Only sync if duration is a real number > 0
            if (isFinite(dur) && dur > 0 && isFinite(cur)) {
                try {
                    navigator.mediaSession.setPositionState({
                        duration: dur,
                        playbackRate: audioPlayer.playbackRate || 1,
                        position: cur
                    });
                } catch (e) {
                    // Fail silently if the browser is mid-update
                }
            }
        }
    }


    /************************************************/
    /* ADVANCED SESSION RECOVERY & ROUTING ENGINE   */
    /************************************************/
    (function initializeApp() {
        // A. PERSISTENT EVENT OBSERVERS
        window.addEventListener('hashchange', () => {
            // Save position of the view we are leaving before the hash actually changes the UI
            const lastView = window.lastActiveView;
            if (lastView && window.scrollPositions.hasOwnProperty(lastView)) {
                window.scrollPositions[lastView] = window.scrollY;
                localStorage.setItem(`beatZen_scroll_${lastView}`, window.scrollY);
            }
            handleDeepLinking();
        });

        // B. SCROLL MEMORY CAPTURE
        window.addEventListener('scroll', () => {
            // Only capture scroll when in a main grid view (Home, Artists, etc.)
            if (albumViewContainer.style.display === 'none') {
                const activeId = window.lastActiveView;
                if (activeId && window.scrollPositions.hasOwnProperty(activeId)) {
                    window.scrollPositions[activeId] = window.scrollY;
                }
            }
        }, { passive: true });

        // C. ADVANCED BOOT SEQUENCE
        // We use a small delay to ensure external data scripts (data.js, explore.js) 
        // have finished parsing and attached to the window object.
        setTimeout(() => {
            const currentHash = window.location.hash;

            /** * 1. MASTER POOL RE-HYDRATION
             * Ensures custom explore and playlists are in the searchable memory 
             * so the recovery engine can find the metadata for the last played song.
             */
            if (typeof customGenreData !== 'undefined' && window.masterPool) {
                Object.values(customGenreData).flat().forEach(item => {
                    const exists = window.masterPool.some(m => String(m.id) === String(item.id));
                    if (!exists) window.masterPool.push(item);
                });
            }

            /** * 2. HIGH-PRECISION PLAYER RECOVERY
             * Priority: Restore Album Object -> Load Audio Source -> Inject Seconds.
             */
            const savedSession = localStorage.getItem('lastPlayedSong');
            if (savedSession) {
                try {
                    const { albumId, songIndex, type } = JSON.parse(savedSession);
                    const found = masterPool.find(a => String(a.id || a.name || a.title) === String(albumId));

                    if (found) {
                        window.playingAlbum = resolveData(found, type);

                        // Handshake: Load the song without autoplay (shouldPlay = false)
                        // This populates the player UI (title, artist, cover) immediately
                        window.playSong(songIndex, false);

                        // Injection: Wait for hardware metadata before seeking to saved seconds
                        if (window.applySavedTime) window.applySavedTime();

                        console.log("Beat Zen: Player state re-hydrated.");
                    }
                } catch (e) {
                    console.error("Beat Zen: Session integrity check failed.", e);
                }
            }

            /** * 3. SMART VIEWPORT ROUTING
             * Determines exactly which page the user should land on based on the URL hash.
             */
            const routes = {
                '#artists': () => displayArtists(true),
                '#playlists': () => displayPlaylists(true),
                '#explore': () => displayexplore(true),
                '#about': () => displayAbout(true),
                '#contact': () => displayContact(true)
            };

            if (currentHash.startsWith('#album-')) {
                handleDeepLinking();
            } else if (routes[currentHash]) {
                routes[currentHash]();
            } else if (currentHash === '#search') {
                hideAllViews();
                searchContainer.classList.remove('hidden');
                searchResultsContainer.style.display = 'block';
                actualSearchBar.focus();
            } else {
                displayHome(true);
            }

            /** * 4. SCROLL MEMORY RESTORATION
             * Restores exactly where the user was looking before the refresh.
             */
            const viewKey = currentHash.replace('#', '') || 'home';
            const savedScroll = localStorage.getItem(`beatZen_scroll_${viewKey}`);

            if (savedScroll && !currentHash.startsWith('#album-')) {
                window.scrollTo({
                    top: parseInt(savedScroll),
                    behavior: 'instant'
                });
            }

            /** * 5. HISTORY CLEANUP
             * Prevents the '#player' hash from cluttering the back-button stack.
             */
            if (currentHash === '#player') {
                history.replaceState(null, null, ' ');
            }

        }, 200);
    })();

    /****************/
    /* MAPPING      */
    /****************/
    // Creates a high-speed Map for O(1) song lookups by ID
    let allSongsMap = new Map();
    masterPool.forEach(album => {
        album.songs?.forEach(song => {
            const sId = typeof song === 'string' ? song : song.id;
            const sData = typeof song === 'object' ? song : null;

            if (!sData) {
                const found = allAlbums.find(mov => mov.songs.some(x => String(x.id) === String(sId)));
                if (found) {
                    const songObj = found.songs.find(x => String(x.id) === String(sId));
                    allSongsMap.set(String(sId), { ...songObj, album: found });
                }
            } else {
                allSongsMap.set(String(sId), { ...sData, album: album });
            }
        });
    });

    /****************/
    /* SYNC         */
    /****************/
    // Ensures all artist objects have a valid songs array to prevent runtime errors
    (function syncArtistData() {
        if (typeof customArtistsData !== 'undefined') {
            Object.values(customArtistsData).flat().forEach(artist => {
                if (!artist.songs) artist.songs = [];
            });
        }
    })();

    /****************/
    /* PLAYER       */
    /****************/
    // Caching references to the audio engine and primary player buttons
    const audioPlayer = document.getElementById('audio-player');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');

    /****************/
    /* MODES        */
    /****************/
    // Selecting shuffle and loop buttons for state visualization
    const shuffleBtn = document.getElementById('shuffle-btn');
    const loopBtn = document.getElementById('loop-btn');

    /****************/
    /* METADATA     */
    /****************/
    // UI elements used to show current song title, artist name, and album art
    const playerSongTitle = document.getElementById('player-song-title');
    const playerSongArtist = document.getElementById('player-song-artist');
    const playerAlbumCover = document.getElementById('player-album-cover');

    /****************/
    /* SEEKBAR      */
    /****************/
    // Interactive progress bar and time-stamping labels
    const progressBar = document.getElementById('progress-bar');
    const progress = document.getElementById('progress');
    const currentTimeSpan = document.getElementById('current-time');
    const durationSpan = document.getElementById('duration');

    /****************/
    /* LINKS        */
    /****************/
    // Navigation controls for switching between all nav links
    const homeLink = document.getElementById('home-link');
    const searchLink = document.getElementById('search-link');
    const playlistsLink = document.getElementById('playlists-link');
    const artistsLink = document.getElementById('artists-link');
    const exploreLink = document.getElementById('explore-link');
    const aboutLink = document.getElementById('about-link');

    /****************/
    /* CONTAINERS   */
    /****************/
    // Content areas that are toggled visible/invisible during navigation
    const searchContainer = document.getElementById('search-container');
    const yearSectionsContainer = document.getElementById('year-sections-container');
    const playlistsContainer = document.getElementById('playlists-container');
    const artistsContainer = document.getElementById('artists-container');
    const exploreContainer = document.getElementById('explore-container');

    /****************/
    /* VIEWS        */
    /****************/
    // Dynamic containers for About page, Contact form, and the Song list view
    const aboutContainer = document.getElementById('about-container');
    const albumViewContainer = document.getElementById('album-view-container');
    const albumMainContent = document.getElementById('album-main-content');
    const searchResultsContainer = document.getElementById('search-results-container');

    /****************/
    /* POPUPS       */
    /****************/
    // Selection for timer settings and feedback popups
    const timerBtn = document.getElementById('timer-btn');
    const timerPopup = document.getElementById('timer-popup');
    const timerMainHeading = timerPopup.querySelector('h3');
    const cancelTimerBtn = document.getElementById('cancel-timer-btn');
    const timerDisplay = document.getElementById('timer-display');
    const timerHeading = document.getElementById('timer-heading');

    /****************/
    /* UTILITIES    */
    /****************/
    // Functionality-specific buttons like full-screen, queue display, and track locator
    const maximizeBtn = document.getElementById('maximize-btn');
    const mainPlayer = document.getElementById('main-player');
    const closeTimerBtn = document.getElementById('close-timer-popup');
    const contactForm = document.getElementById('contact-form');
    const successPopup = document.getElementById('success-popup');
    const closeSuccessBtn = document.getElementById('close-success-popup');
    const timerEndedPopup = document.getElementById('timer-ended-popup');
    const queueBtn = document.getElementById('queue-btn'); // NEW: For showing the song list

    /****************/
    /* WHEELS       */
    /****************/
    // DOM references for the triple-wheel scrollable time picker
    const hWrapper = document.getElementById('hours-wrapper');
    const mWrapper = document.getElementById('mins-wrapper');
    const sWrapper = document.getElementById('secs-wrapper');
    const startTimerBtn = document.getElementById('start-timer-btn');

    /****************/
    /* CONTACT FORM */
    /****************/
    // Handles AJAX form submission to Formspree with success feedback
    if (contactForm) {
        contactForm.onsubmit = async (e) => {
            e.preventDefault();
            const submitBtn = contactForm.querySelector('.submit-btn');
            submitBtn.disabled = true; // Prevent double submission

            try {
                const response = await fetch(contactForm.action, {
                    method: 'POST',
                    body: new FormData(contactForm),
                    headers: { 'Accept': 'application/json' }
                });

                if (response.ok) {
                    successPopup.style.display = 'flex';
                    successPopup.classList.add('visible');
                    contactForm.reset();
                } else {
                    throw new Error("Form submission failed");
                }
            } catch (error) {
                alert("Something went wrong. Please try again.");
            } finally {
                submitBtn.disabled = false;
            }
        };
    }

    // Close Success Popup
    if (closeSuccessBtn) {
        closeSuccessBtn.onclick = () => {
            successPopup.style.display = 'none';
            successPopup.classList.remove('visible');
        };
    }

    /****************/
    /* SEARCHBAR    */
    /****************/
    // Handling search input focus and clear button visibility
    const actualSearchBar = document.getElementById('search-bar');
    const clearSearchBtn = document.getElementById('clear-search');

    /**************/
    /* BRANDING   */
    /**************/
    function updateDynamicTitle() {
        // Find the current song using the global playing state
        const song = window.playingAlbum?.songs?.[window.currentSongIndex];
        const isPlaying = audioPlayer && !audioPlayer.paused;

        if (song && isPlaying) {
            // If music is playing: "Song Title • Album Name"
            document.title = `${song.title} • ${window.playingAlbum.title}`;
        } else if (song && !isPlaying) {
            // If music is paused: "Paused: Song Title"
            document.title = `Paused: ${song.title}`;
        } else {
            // Default state
            document.title = "Beat Zen";
        }
    }

    /****************/
    /* SYNC-ICONS   */
    /****************/
    // Ensures play/pause icons match the audio player state across all UI modules
    function updatePlayPauseIcon() {
        const isPaused = audioPlayer.paused;

        // Bottom Player Bar Icon
        if (playPauseBtn) {
            playPauseBtn.innerHTML = isPaused ? '<i class="fas fa-play"></i>' : '<i class="fas fa-pause"></i>';
        }

        // Album View Button Sync (BeatZenButtons Module)
        if (typeof BeatZenButtons !== 'undefined' && BeatZenButtons.updateSyncButtonUI) {
            BeatZenButtons.updateSyncButtonUI(isPaused);
        }

        // Browser Media Session State
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = isPaused ? "paused" : "playing";
        }
    }

    /************************************************/
    /* ADVANCED PLAYBACK CONTROLLER (togglePlayback)*/
    /************************************************/
    /**
     * Handles starting and pausing music with full synchronization 
     * across the App UI, Browser Tab, and System Notifications.
     */
    function togglePlayback() {
        // 1. VALIDATION: Ensure a valid audio source is actually loaded
        const hasValidSrc = audioPlayer.src &&
            audioPlayer.src !== window.location.href &&
            !audioPlayer.src.endsWith('/');

        if (!hasValidSrc) {
            console.warn("Beat Zen: No valid track loaded to play.");
            return;
        }

        if (audioPlayer.paused) {
            // 2. ATTEMPT PLAYBACK (Handling Browser Autoplay Policies)
            audioPlayer.play()
                .then(() => {
                    // Update visuals once playback is confirmed
                    updatePlayPauseIcon();
                    updateDynamicTitle();

                    // Sync System playback state
                    if ('mediaSession' in navigator) {
                        navigator.mediaSession.playbackState = "playing";
                    }
                })
                .catch(err => {
                    console.warn("Beat Zen: Playback blocked by browser policy. User interaction required.");
                });
        } else {
            // 3. HANDLE PAUSE
            audioPlayer.pause();

            // Sync visuals immediately
            updatePlayPauseIcon();
            updateDynamicTitle();

            // Sync System playback state
            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = "paused";
            }
        }
    }

    /****************/
    /* LISTENERS    */
    /****************/
    // Sync Play State to UI and Browser Tab Title
    audioPlayer.onplay = () => {
        updatePlayPauseIcon();
        updateDynamicTitle(); // Update title when music starts
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "playing";
    };

    audioPlayer.onpause = () => {
        updatePlayPauseIcon();
        updateDynamicTitle(); // Update title to show "Paused"
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "paused";
    };

    /**************/
    /* OVERLAYS   */
    /**************/
    // Event listener to close popups and success messages when clicking outside
    document.addEventListener('mousedown', (e) => {
        const popups = [
            { el: timerPopup, trigger: timerBtn },
            { el: successPopup, trigger: null },
            { el: timerEndedPopup, trigger: null }
        ];

        popups.forEach(popup => {
            const isVisible = popup.el && (popup.el.classList.contains('visible') || popup.el.style.display === 'flex' || popup.el.style.display === 'block');
            if (isVisible) {
                if (!popup.el.contains(e.target) && (!popup.trigger || !popup.trigger.contains(e.target))) {
                    popup.el.classList.remove('visible');
                    if (popup.el === successPopup) popup.el.style.display = 'none';
                }
            }
        });
    });

    /****************/
    /* MAXIMIZE     */
    /****************/
    // Enlarges the player and activates the full-screen visuals
    function handleMaximize() {
        if (!window.playingAlbum) return;
        toggleMaximize();
    }

    /****************/
    /* QUEUE        */
    /****************/
    // Navigates directly to the song list of the currently playing album
    function showCurrentQueue() {
        if (!window.playingAlbum) return;
        if (mainPlayer.classList.contains('maximized')) {
            toggleMaximize();
        }
        selectAlbum(window.playingAlbum);
    }

    // Attach Event Listeners
    if (maximizeBtn) maximizeBtn.onclick = handleMaximize;
    if (queueBtn) queueBtn.onclick = showCurrentQueue;
    // Keep your album cover click for maximize
    playerAlbumCover.onclick = handleMaximize;

    // Add this near maximizeBtn.onclick
    if (minimizeBtn) {
        minimizeBtn.onclick = (e) => {
            e.stopPropagation();
            toggleMaximize();
        };
    }

    /****************/
    /* SHORTCUTS    */
    /****************/
    document.addEventListener('keydown', (e) => {
        // Typing Check
        const isTyping = e.target.closest('input, textarea, select, [contenteditable="true"]');

        // Input Protection
        if (isTyping) {

            // Unfocus Input
            if (e.code === 'Escape') e.target.blur();
            return;
        }

        // Universal Exit
        if (e.code === 'Escape') {
            // Restore Screen
            if (mainPlayer.classList.contains('maximized')) {
                toggleMaximize();
            }

            // Close Popups
            [timerPopup, successPopup, timerEndedPopup].forEach(p => {
                if (p) {
                    p.classList.remove('visible');
                    if (p === successPopup) p.style.display = 'none';
                }
            });
            return;
        }

        // Action Router
        switch (e.code) {
            case 'Space':
                // Play/Pause
                e.preventDefault();
                togglePlayback();
                break;

            case 'ArrowRight':
                // Next song
                e.preventDefault();
                playNextSong();
                break;

            case 'ArrowLeft':
                // Previous song
                e.preventDefault();
                playPrevSong();
                break;

            case 'ArrowUp':
                // Volume Up
                e.preventDefault();
                audioPlayer.volume = Math.min(1, parseFloat((audioPlayer.volume + 0.1).toFixed(1)));
                break;

            case 'ArrowDown':
                // Volume Down
                e.preventDefault();
                audioPlayer.volume = Math.max(0, parseFloat((audioPlayer.volume - 0.1).toFixed(1)));
                break;

            case 'KeyM':
                // Mute Toggle
                e.preventDefault();
                audioPlayer.muted = !audioPlayer.muted;
                break;

            case 'KeyF':
                // Fullscreen Player
                e.preventDefault();
                toggleMaximize();
                break;
        }
    });

    /************************************************************/
    /* PROGRESS & SCRUBBING ENGINE                              */
    /************************************************************/
    function syncProgressBar() {
        if (!audioPlayer) return;
        const cur = audioPlayer.currentTime;
        const dur = audioPlayer.duration;
        const per = (dur > 0) ? (cur / dur) * 100 : 0;

        document.querySelectorAll('#progress').forEach(fill => fill.style.width = `${per}%`);
        document.querySelectorAll('#current-time').forEach(el => el.textContent = formatTime(cur));

        // Ensure duration count is always visible
        if (!isNaN(dur) && dur > 0) {
            document.querySelectorAll('#duration').forEach(el => el.textContent = formatTime(dur));
        }
    }


    // --- EVENT ATTACHMENTS ---

    // Time Tracking: Primary engine for real-time UI updates
    audioPlayer.ontimeupdate = syncProgressBar;

    // Metadata Handshake: Ensures total duration (0:00) updates immediately when file loads
    audioPlayer.addEventListener('loadedmetadata', syncProgressBar);

    /************************************************************/
    /* UNIFIED SCRUBBING ENGINE (SMOOTH & FLICKER-FREE)         */
    /************************************************************/
    if (progressBar) {
        let isDragging = false;

        const handleScrub = (e) => {
            const dur = audioPlayer.duration;
            if (!dur || isNaN(dur)) return;

            const rect = progressBar.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clickX = Math.max(0, Math.min(clientX - rect.left, rect.width));
            const percentage = (clickX / rect.width);
            const newTime = percentage * dur;

            // --- A. INSTANT VISUAL FEEDBACK (No flickering) ---
            // We update the CSS width directly for 60fps smoothness
            if (progress) progress.style.width = `${percentage * 100}%`;
            if (currentTimeSpan) currentTimeSpan.textContent = formatTime(newTime);

            // --- B. AUDIO SYNC ---
            audioPlayer.currentTime = newTime;

            // --- C. SYSTEM SYNC (Anti-Flicker) ---
            // We only update PositionState, NEVER Metadata here.
            if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
                try {
                    navigator.mediaSession.setPositionState({
                        duration: dur,
                        playbackRate: audioPlayer.playbackRate || 1,
                        position: newTime
                    });
                } catch (e) { }
            }
        };

        // Desktop
        progressBar.onmousedown = (e) => { isDragging = true; handleScrub(e); };
        window.addEventListener('mousemove', (e) => { if (isDragging) handleScrub(e); });
        window.addEventListener('mouseup', () => { isDragging = false; });

        // Mobile (Touch-specific smoothness)
        progressBar.ontouchstart = (e) => { isDragging = true; handleScrub(e); };
        progressBar.ontouchmove = (e) => {
            if (isDragging) {
                if (e.cancelable) e.preventDefault(); // Stop page from shaking
                handleScrub(e);
            }
        };
        progressBar.ontouchend = () => { isDragging = false; };
    }

    /****************/
    /* FORMATTER    */
    /****************/
    // Formats seconds into M:SS or H:MM:SS
    const formatTime = (s) => {
        if (isNaN(s)) return "0:00";
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60).toString().padStart(2, '0');
        return `${m}:${sec}`;
    };

    /****************/
    /* RESOLVE      */
    /****************/
    // Standardizes data objects from movies, artists, and playlists into a single schema
    function resolveData(data, type) {
        if (!data) return null;

        // ENSURE CONSISTENT ID:
        // Artists use data.id (e.g., "arijit-singh")
        // explore use the key/name
        // Movies use data.id
        const consistentId = data.id || data.name || data.title;

        const songs = (data.songs || []).map(id => typeof id === 'string' ? allSongsMap.get(id) : id).filter(Boolean);

        const durationStr = (function () {
            let total = 0;
            songs.forEach(s => {
                if (s?.duration) {
                    const p = s.duration.split(':');
                    total += parseInt(p[0]) * 60 + parseInt(p[1]);
                }
            });
            const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
            return `${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm ' : ''}${s}s`.trim();
        })();

        let details = (type === "Artist" || type === "Playlist" || type === "Collection")
            ? `<p><strong>Songs :</strong> ${songs.length} &nbsp;&nbsp; <strong>Duration :</strong> ${durationStr}</p>`
            : `<p><strong>Actors:</strong> ${data.actors || 'N/A'}</p><p><strong>Year:</strong> ${data.year || 'N/A'}</p>`;

        return {
            id: String(consistentId), // Store as String for exact CSS matching
            title: data.name || data.title || 'Unknown',
            imageUrl: data.imageUrl || data.albumCover || '',
            songs: songs,
            detailsHtml: details,
            type: type,
            year: data.year || null
        };
    }

    /***********/
    /* VIEWS   */
    /***********/
    // Efficiently clears all views using a more performant array-based check
    function hideAllViews() {
        const views = [
            yearSectionsContainer,
            searchResultsContainer,
            playlistsContainer,
            artistsContainer,
            albumViewContainer,
            exploreContainer,
            aboutContainer
        ];

        views.forEach(v => {
            // Only update the DOM if the display isn't already 'none' to save processing
            if (v && v.style.display !== 'none') {
                v.style.display = 'none';
            }
        });

        // Ensure search container is properly toggled
        if (searchContainer && !searchContainer.classList.contains('hidden')) {
            searchContainer.classList.add('hidden');
        }
    }

    // Updates navigation highlights with improved selector safety
    function updateNav(id) {
        // Use a more specific selector to avoid touching unrelated elements
        const navLinks = document.querySelectorAll('.nav-link-content');
        navLinks.forEach(l => l.classList.remove('active'));
        const el = document.getElementById(`${id}-link`);
        if (el) {
            const innerContent = el.querySelector('.nav-link-content');
            if (innerContent) innerContent.classList.add('active');
        }
    }

    // High-performance card renderer with unique identity for 'Locate' feature
    function renderCard(title, img, onClick, albumId) {
        const div = document.createElement('div');
        div.className = 'album-card';
        div.setAttribute('data-album-id', String(albumId));

        // CLEAR QUALITY FIX: larger width (300px-400px) so cards look sharp on all screens
        let highQualityImg = img;
        if (img.includes('cloudinary')) {
            highQualityImg = img.replace('/upload/', '/upload/f_auto,q_auto,w_400/');
        }

        div.innerHTML = `
        <img src="${highQualityImg}" alt="${title}" loading="lazy" 
             style="background: #2c3e50; min-height: 150px; object-fit: cover;">
        <div class="album-info">
            <h2>${title}</h2>
        </div>
    `;

        div.addEventListener('click', (e) => {
            e.preventDefault();
            onClick();
        });

        return div;
    }

    /********************************/
    /* SCROLL MEMORY STATE          */
    /********************************/
    window.scrollPositions = {
        home: 0,
        artists: 0,
        playlists: 0,
        explore: 0,
        search: 0
    };
    window.lastActiveView = 'home';

    /****************/
    /* SECTIONS     */
    /****************/
    // Logic to show years/movies
    function displayHome(isBack = false, targetYear = null) {
        // 1. Reset View Visibility
        // Ensures other containers are hidden and navigation highlights 'home'
        navigateToView('home', yearSectionsContainer, isBack);

        // 2. Safety Check & Force Display
        // Even if navigateToView runs, we force block display here to ensure UI renders
        if (yearSectionsContainer) {
            yearSectionsContainer.style.display = 'block';
            yearSectionsContainer.innerHTML = ''; // Clear previous content
        } else {
            console.error("Beat Zen: yearSectionsContainer not found in DOM.");
            return;
        }

        // 3. Render Loop
        allYears.forEach(year => {
            // Create the wrapper for the year (e.g., 2025, 2024)
            const sec = document.createElement('div');
            sec.className = 'year-section';
            sec.id = `year-sec-${year}`;

            // Build the inner grid structure
            sec.innerHTML = `<h2>${year}</h2><div class="albums-grid"></div>`;
            const grid = sec.querySelector('.albums-grid');

            // Verify data exists for this year before looping
            if (customYearAlbumsData[year]) {
                customYearAlbumsData[year].forEach(a => {
                    if (grid) {
                        // Create the album card and append to the grid
                        const albumCard = renderCard(
                            a.title,
                            a.imageUrl,
                            () => selectAlbum(resolveData(a, "Movie")),
                            a.id
                        );
                        grid.appendChild(albumCard);
                    }
                });
            }

            // Add the completed year section to the main container
            yearSectionsContainer.appendChild(sec);
        });

        // 4. State & Scrolling
        if (!isBack) {
            history.pushState({ view: 'home' }, 'Home', '#home');
        }

        // If a specific year was requested (via search or link), scroll to it
        if (targetYear) {
            const el = document.getElementById(`year-sec-${targetYear}`);
            if (el) {
                setTimeout(() => {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 150);
            }
        }
    }

    //    Logic to show playlists
    function displayPlaylists(isBack = false) {
        navigateToView('playlists', playlistsContainer, isBack);
        // REMOVED <h2>Browse Playlists</h2>
        playlistsContainer.innerHTML = `<div class="year-section"><div class="albums-grid"></div></div>`;
        const grid = playlistsContainer.querySelector('.albums-grid');
        if (typeof customPlaylistsData !== 'undefined') {
            Object.values(customPlaylistsData).flat().forEach(p => {
                grid.appendChild(renderCard(p.name, p.albumCover, () => selectAlbum(resolveData(p, "Playlist")), p.id || p.name));
            });
        }
        if (!isBack) history.pushState({ view: 'playlists' }, 'Playlists', '#playlists');
    }

    // Logic to show artists
    function displayArtists(isBack = false) {
        navigateToView('artists', artistsContainer, isBack);
        // REMOVED <h2>Artists</h2>
        artistsContainer.innerHTML = `<div class="year-section"><div class="albums-grid"></div></div>`;
        const grid = artistsContainer.querySelector('.albums-grid');
        Object.keys(customArtistsData).forEach(cat => {
            customArtistsData[cat].forEach(art => {
                grid.appendChild(renderCard(art.name, art.imageUrl, () => selectAlbum(resolveData(art, "Artist")), art.id));
            });
        });
        if (!isBack) history.pushState({ view: 'artists' }, 'Artists', '#artists');
    }

    /********************************/
    /* ALBUM DETAIL VIEW ENGINE     */
    /********************************/
    function selectAlbum(album, isBack = false) {
        if (!album || !album.id) return;

        /**
         * 1. PRE-HIDE SCROLL CAPTURE
         * We must save the scroll position of the grid BEFORE we hide it.
         */
        if (!isBack && window.lastActiveView) {
            const currentY = window.scrollY;
            window.scrollPositions[window.lastActiveView] = currentY;
            localStorage.setItem('beatZen_scroll_' + window.lastActiveView, currentY);
            console.log(`Saved ${window.lastActiveView} position: ${currentY}px`);
        }

        window.currentAlbum = album;

        // Hide the grid and show the card details
        hideAllViews();
        albumViewContainer.style.display = 'flex';

        /**
         * 2. CARD VIEW RESET
         * The album view itself should always start at the top.
         */
        window.scrollTo({ top: 0, behavior: 'instant' });

        const isThisPlaying = window.playingAlbum?.id === album.id && !audioPlayer.paused;

        albumMainContent.innerHTML = `
            <div class="album-info-section">
                <img src="${album.imageUrl}" class="album-details-img">
                <div class="album-text-info">
                    <h2>${album.title}</h2>
                    <div class="internal-details">${album.detailsHtml}</div>
                    ${BeatZenButtons.generateActionBarHTML(album, isThisPlaying)}
                </div>
            </div>
            <div class="songs-list"></div>`;

        BeatZenButtons.initEventListeners(album,
            () => { window.playingAlbum = window.currentAlbum; window.playSong(0); },
            () => { window.togglePlayback(); }
        );

        const list = albumMainContent.querySelector('.songs-list');
        album.songs.forEach((song, i) => {
            const item = document.createElement('div');
            item.className = 'song-item';
            item.dataset.songId = String(song.id);
            const original = allSongsMap.get(String(song.id))?.album;
            const prefix = original ? `<img src="${original.imageUrl}" class="playlist-song-cover">` : `<span>${i + 1}.</span>`;
            item.innerHTML = `
                <div class="song-details">
                    <div class="song-number-wrapper">${prefix}</div>
                    <div class="song-text-details">
                        <span class="song-item-title">${song.title}</span>
                        <span class="song-item-artist">${song.artist}</span>
                    </div>
                </div>
                <span class="song-item-duration">${song.duration}</span>`;
            item.onclick = () => { window.playingAlbum = window.currentAlbum; window.playSong(i); };
            list.appendChild(item);
        });

        if (!isBack) history.pushState({ view: 'album', albumId: album.id, albumData: album }, album.title, `#album-${album.id}`);
        updateActiveSongHighlight();
        updateDynamicTitle();
    }

    

    /**
     * STATIC PAGE RENDERING
     */
    function displayAbout(isBack = false) {
        navigateToView('about', aboutContainer, isBack);
        if (!isBack) history.pushState({ view: 'about' }, 'About', '#about');
    }


    /***********************************************/
    /* HORIZONTAL SCROLL FOR explore ONLY      */
    /***********************************************/
    (function () {
        const originalDisplayexplore = window.displayexplore;

        window.displayexplore = function (isBack = false) {
            // Execute the original logic first to render the elements
            if (typeof originalDisplayexplore === 'function') {
                originalDisplayexplore(isBack);
            }

            // Apply Right-to-Left initial scroll position
            const container = document.querySelector('#explore-container .albums-grid');
            if (container) {
                // Short delay to ensure DOM is painted before calculating width
                setTimeout(() => {
                    container.scrollLeft = container.scrollWidth;
                }, 100);
            }
        };
    })();
    /****************/
    /* NOTIFICATION */
    /****************/
    // Syncs playback info with the OS (Lock screen controls and Bluetooth data)
    function updateMediaMetadata() {
        if (!('mediaSession' in navigator) || !window.playingAlbum || window.currentSongIndex === -1) return;

        const song = window.playingAlbum.songs[window.currentSongIndex];
        const albumData = allSongsMap.get(String(song.id))?.album || window.playingAlbum;

        // Set the notification details
        navigator.mediaSession.metadata = new MediaMetadata({
            title: song.title,
            artist: song.artist,
            album: albumData.title || albumData.name,
            artwork: [
                { src: albumData.imageUrl, sizes: '512x512', type: 'image/jpeg' }
            ]
        });

        // Reset position state for the new track
        if ('setPositionState' in navigator.mediaSession) {
            navigator.mediaSession.setPositionState({
                duration: audioPlayer.duration || 0,
                playbackRate: audioPlayer.playbackRate || 1,
                position: 0
            });
        }

        // Set playback actions
        const actions = [
            ['play', window.togglePlayback],
            ['pause', window.togglePlayback],
            ['previoustrack', window.playPrevSong],
            ['nexttrack', window.playNextSong],
            ['seekto', (details) => {
                if (details.seekTime) {
                    audioPlayer.currentTime = details.seekTime;
                    if (window.syncProgressBar) window.syncProgressBar();
                }
            }]
        ];

        actions.forEach(([action, handler]) => {
            try { navigator.mediaSession.setActionHandler(action, handler); } catch (e) { }
        });
    }

    // GLOBAL AUDIO MONITORING
    audioPlayer.addEventListener('waiting', () => {
        // Show a circle notch spinner to indicate buffering at slow speeds
        if (playPauseBtn) playPauseBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
    });

    audioPlayer.addEventListener('playing', () => {
        updatePlayPauseIcon();
        if (typeof updateMediaPositionState === 'function') updateMediaPositionState();
    });

    audioPlayer.addEventListener('pause', () => {
        updatePlayPauseIcon();
        updateMediaPositionState();
    });

    // Ensure duration updates as soon as the file is reachable
    audioPlayer.addEventListener('loadeddata', () => {
        if (!isNaN(audioPlayer.duration)) {
            document.querySelectorAll('#duration').forEach(el => {
                el.textContent = formatTime(audioPlayer.duration);
            });
        }
    });

    //  State-Aware Error Handling
    audioPlayer.addEventListener('error', () => {
        // Only skip if the player was already actively playing (not during a refresh restoration)
        if (audioPlayer.src && audioPlayer.src !== window.location.href && !audioPlayer.paused) {
            console.warn("Playback error, skipping to next track...");
            setTimeout(() => playNextSong(), 2000);
        } else {
            console.warn("Audio source handshake during restoration; skip prevented.");
        }
    });

    // Sync immediately when the user drags the bar (Scrubbing)
    audioPlayer.addEventListener('seeked', () => {
        updateMediaPositionState();
    });

    // Sync when metadata is ready (Required for Android to show total duration)
    audioPlayer.addEventListener('loadedmetadata', () => {
        updateMediaPositionState();
        if (durationSpan) durationSpan.textContent = formatTime(audioPlayer.currentTime);
    });

    // Sync when speed changes (e.g., if you add a 1.5x speed feature later)
    audioPlayer.addEventListener('ratechange', () => {
        updateMediaPositionState();
    });

    /*************/
    /* HIGHLIGHT */
    /*************/
    function updateActiveSongHighlight() {
        // Cleanup
        document.querySelectorAll('.song-item').forEach(el => el.classList.remove('active'));

        // Match
        if (playingAlbum && currentAlbum && playingAlbum.id === currentAlbum.id) {
            const currentSong = playingAlbum.songs[currentSongIndex];
            const activeEl = document.querySelector(`.song-item[data-song-id="${currentSong?.id}"]`);

            // Apply
            if (activeEl) activeEl.classList.add('active');
        }
    }


    /****************/
    /* TIMER        */
    /****************/
    // Build scrollable wheels
    const populateWheel = (id, max) => {
        const wheel = document.getElementById(id);
        if (!wheel) return;
        const fragment = document.createDocumentFragment();
        for (let i = 0; i <= max; i++) {
            const div = document.createElement('div');
            div.className = 'picker-item';
            div.textContent = i.toString().padStart(2, '0');
            fragment.appendChild(div);
        }
        wheel.innerHTML = '';
        wheel.appendChild(fragment);
    };

    // Init wheels
    ['hours-wheel', 'mins-wheel', 'secs-wheel'].forEach((id, i) => populateWheel(id, i === 0 ? 23 : 59));

    // Detect centered item
    const setupWheelScroll = (wrapper, callback) => {
        if (!wrapper) return;
        wrapper.onscroll = () => {
            const items = wrapper.querySelectorAll('.picker-item');
            const wrapperRect = wrapper.getBoundingClientRect();
            const wrapperCenter = wrapperRect.top + wrapperRect.height / 2;
            items.forEach(item => {
                const itemRect = item.getBoundingClientRect();
                const itemCenter = itemRect.top + itemRect.height / 2;
                if (Math.abs(wrapperCenter - itemCenter) < itemRect.height / 2) {
                    item.classList.add('active');
                    callback(parseInt(item.textContent));
                } else {
                    item.classList.remove('active');
                }
            });
        };
    };

    // Bind scroll variables
    setupWheelScroll(hWrapper, val => selH = val);
    setupWheelScroll(mWrapper, val => selM = val);
    setupWheelScroll(sWrapper, val => selS = val);

    // Toggle popup
    timerBtn.onclick = (e) => {
        e.stopPropagation();
        timerPopup.style.zIndex = "10002";
        timerPopup.classList.toggle('visible');
    };

    // Close on background click
    window.addEventListener('mousedown', (e) => {
        if (timerPopup.classList.contains('visible')) {
            const content = timerPopup.querySelector('.timer-popup-content');
            if (e.target === timerPopup && !content.contains(e.target)) timerPopup.classList.remove('visible');
        }
    });

    /****************/
    /* TIMER RESET  */
    /****************/
    function resetTimerUI() {
        // 1. Clear Engine
        clearInterval(timerInterval);
        timerInterval = null;

        // 2. Release System Wake Lock (10/10 Feature)
        if (typeof releaseWakeLock === 'function') releaseWakeLock();

        // 3. Reset Text & Labels
        timerDisplay.textContent = '';
        timerHeading.style.display = 'none';
        cancelTimerBtn.style.display = 'none';
        startTimerBtn.style.display = 'block';

        // 4. Restore Wheel Visibility
        const wheelContainer = document.querySelector('.timer-columns-container');
        if (wheelContainer) wheelContainer.style.display = 'flex';

        // 5. Pulse Cleanup
        // Removes active/urgent animations so button returns to default state
        timerBtn.classList.remove('active', 'timer-pulse-active', 'timer-pulse-urgent');

        // 6. Close UI
        timerMainHeading.textContent = 'Set Sleep Timer';
        timerPopup.classList.remove('visible');
    }

    /****************/
    /* TIMER START  */
    /****************/
    startTimerBtn.onclick = () => {
        let totalSeconds = (selH * 3600) + (selM * 60) + selS;
        if (totalSeconds <= 0) return;

        // 1. Request Wake Lock (Prevents timer freeze on mobile)
        if (typeof requestWakeLock === 'function') requestWakeLock();

        clearInterval(timerInterval);

        // 2. UI Transitions
        const wheelContainer = document.querySelector('.timer-columns-container');
        if (wheelContainer) wheelContainer.style.display = 'none';
        startTimerBtn.style.display = 'none';
        cancelTimerBtn.style.display = 'block';

        // 3. Update Headings
        timerMainHeading.textContent = 'Sleep Timer Started';
        timerHeading.textContent = 'The songs will stop in : ';
        timerHeading.style.display = 'block';
        timerBtn.classList.add('active');

        const updateDisp = (time) => {
            const h = Math.floor(time / 3600).toString().padStart(2, '0');
            const m = Math.floor((time % 3600) / 60).toString().padStart(2, '0');
            const s = (time % 60).toString().padStart(2, '0');
            timerDisplay.textContent = `${h}:${m}:${s}`;
        };

        updateDisp(totalSeconds);
        const originalVolume = audioPlayer.volume;

        // 4. Main Interval Engine
        timerInterval = setInterval(() => {
            totalSeconds--;
            updateDisp(totalSeconds);

            // 5. Visual Pulse Logic (Synchronized with Fade-out)
            // Starts Red pulse at 15 seconds to match the audio fade start
            if (totalSeconds > 15) {
                // State: Running (Slow Green Pulse)
                timerBtn.classList.add('timer-pulse-active');
                timerBtn.classList.remove('timer-pulse-urgent');
            } else if (totalSeconds <= 15 && totalSeconds > 0) {
                // State: Urgent (Fast Red Pulse synchronized with 15s fade-out)
                timerBtn.classList.remove('timer-pulse-active');
                timerBtn.classList.add('timer-pulse-urgent');
            }

            // 6. Stepped Fade-out Logic (UX Excellence)
            if (totalSeconds <= 15 && totalSeconds > 0) {
                let volFactor = 1.0;
                if (totalSeconds <= 4) volFactor = 0.1;
                else if (totalSeconds <= 8) volFactor = 0.2;
                else if (totalSeconds <= 10) volFactor = 0.5;
                else if (totalSeconds <= 12) volFactor = 0.7;
                else if (totalSeconds <= 15) volFactor = 0.9;
                audioPlayer.volume = originalVolume * volFactor;
            }

            // 7. Finish Logic
            if (totalSeconds <= 0) {
                audioPlayer.pause();
                audioPlayer.volume = originalVolume; // Restore for next session
                resetTimerUI(); // Cleans up everything automatically
                timerEndedPopup.classList.add('visible');
                if (typeof updatePlayPauseIcon === 'function') updatePlayPauseIcon();
            }
        }, 1000);
    };

    // Modal listeners
    cancelTimerBtn.onclick = resetTimerUI;
    closeTimerBtn.onclick = () => timerPopup.classList.remove('visible');
    const closeTimerEndedBtn = document.getElementById('close-timer-ended');
    if (closeTimerEndedBtn) closeTimerEndedBtn.onclick = () => timerEndedPopup.classList.remove('visible');

    /***********/
    /* SEARCH  */
    /***********/
    // Open Search View
    searchLink.onclick = (e) => {
        e.preventDefault();
        hideAllViews();
        searchContainer.classList.remove('hidden');
        searchResultsContainer.style.display = 'block';
        updateNav('search');
        actualSearchBar.focus();
        history.pushState({ view: 'search' }, 'Search', '#search');
    };

    // Reset Search Interface
    clearSearchBtn.onclick = () => {
        actualSearchBar.value = '';
        searchResultsContainer.innerHTML = '';
        clearSearchBtn.style.display = 'none';
        actualSearchBar.focus();
    };

    /****************/
    /* SEARCH       */
    /****************/
    // Filters the master pool based on user input with a performance buffer
    let searchTimeout = null;

    actualSearchBar.oninput = (e) => {
        const q = e.target.value.toLowerCase().trim();

        // Instant visual feedback for the 'X' button
        clearSearchBtn.style.display = q ? 'block' : 'none';

        // Clear the previous timer to reset the wait period
        clearTimeout(searchTimeout);

        // Execute search logic only after a 300ms pause in typing
        searchTimeout = setTimeout(() => {
            executeSearchLogic(q);
        }, 300);
    };

    // Encapsulated to keep the initialization script clean and organized. 
    /************************************************/
    /* UPDATED: PREFIX-ONLY SEARCH LOGIC            */
    /************************************************/
    function executeSearchLogic(q) {
        searchResultsContainer.innerHTML = '';
        if (!q) return;

        const sw = q.split(/\s+/); // Search words
        const MAX_RESULTS = 8;

        // Helper to check if any search word matches the start of any word in the target string
        const matchesStart = (targetString) => {
            if (!targetString) return false;
            const targetWords = targetString.toLowerCase().split(/\s+/);
            // Returns true if any word in the target starts with any of the user's search words
            return sw.some(sWord =>
                targetWords.some(tWord => tWord.startsWith(sWord))
            );
        };

        const mt = {
            // Match Years (usually starts with the number)
            y: allYears.filter(y => sw.some(w => y.startsWith(w))).slice(0, 5),

            // Match Artists from starting only
            a: Object.values(customArtistsData).flat().filter(art =>
                matchesStart(art.name)
            ).slice(0, MAX_RESULTS),

            // Match explore from starting only
            c: Object.keys(customGenreData).filter(key => {
                const col = customGenreData[key];
                const collectionName = col.name || key;
                return matchesStart(collectionName);
            }).slice(0, MAX_RESULTS),

            // Match Playlists from starting only
            p: playlistList.filter(pl =>
                matchesStart(pl.name || pl.title)
            ).slice(0, MAX_RESULTS),

            // Match Albums (Movies) from starting only
            al: allAlbums.filter(alb =>
                matchesStart(alb.title)
            ).slice(0, MAX_RESULTS),

            // Match Songs from starting only
            s: Array.from(allSongsMap.values()).filter(s =>
                matchesStart(s.title)
            ).slice(0, MAX_RESULTS)
        };

        const createSection = (title) => {
            const sec = document.createElement('div');
            sec.className = 'year-section';
            sec.innerHTML = `<h2>${title}</h2><div class="albums-grid"></div>`;
            return sec;
        };

        // 1. Render Years
        if (mt.y.length) {
            const sec = createSection('Years');
            const grid = sec.querySelector('.albums-grid');
            mt.y.forEach(y => {
                const b = document.createElement('a');
                b.className = 'year-button';
                b.textContent = y;
                b.onclick = () => { hideAllViews(); displayHome(false, y); };
                grid.appendChild(b);
            });
            searchResultsContainer.appendChild(sec);
        }

        // 2. Render Artists
        if (mt.a.length) {
            const sec = createSection('Artists');
            const grid = sec.querySelector('.albums-grid');
            mt.a.forEach(art => {
                grid.appendChild(renderCard(art.name, art.imageUrl, () => {
                    hideAllViews();
                    selectAlbum(resolveData(art, "Artist"));
                }, art.id));
            });
            searchResultsContainer.appendChild(sec);
        }

        // 3. Render explore
        if (mt.c.length) {
            const sec = createSection('explore');
            const grid = sec.querySelector('.albums-grid');
            mt.c.forEach(key => {
                const col = customGenreData[key];
                grid.appendChild(renderCard(col.name || key, col.albumCover, () => {
                    hideAllViews();
                    selectAlbum(resolveData(col, "Collection"));
                }, key));
            });
            searchResultsContainer.appendChild(sec);
        }

        // 4. Render Playlists
        if (mt.p.length) {
            const sec = createSection('Playlists');
            const grid = sec.querySelector('.albums-grid');
            mt.p.forEach(pl => grid.appendChild(renderCard(pl.name || pl.title, pl.albumCover || pl.imageUrl, () => {
                hideAllViews(); selectAlbum(resolveData(pl, "Playlist"));
            })));
            searchResultsContainer.appendChild(sec);
        }

        // 5. Render Albums
        if (mt.al.length) {
            const sec = createSection('Albums');
            const grid = sec.querySelector('.albums-grid');
            mt.al.forEach(alb => grid.appendChild(renderCard(alb.title, alb.imageUrl, () => {
                hideAllViews(); selectAlbum(resolveData(alb, "Movie"));
            })));
            searchResultsContainer.appendChild(sec);
        }

        // 6. Render Songs
        if (mt.s.length) {
            const sec = createSection('Songs');
            const list = document.createElement('div');
            list.className = 'songs-list';
            mt.s.forEach(s => {
                const i = document.createElement('div');
                i.className = 'song-item';
                const songAlbImg = s.album?.imageUrl || s.album?.albumCover || "";
                i.innerHTML = `
                    <div class="song-details">
                        <img src="${songAlbImg}" class="playlist-song-cover">
                        <div class="song-text-details">
                            <span class="song-item-title">${s.title}</span>
                            <span class="song-item-artist">${s.artist}</span>
                        </div>
                    </div>`;
                i.onclick = () => {
                    hideAllViews();
                    const playingData = resolveData(s.album, s.album?.type || "Movie");
                    window.playingAlbum = playingData;
                    selectAlbum(playingData);
                    const idx = playingData.songs.findIndex(x => String(x.id) === String(s.id));
                    playSong(idx !== -1 ? idx : 0);
                };
                list.appendChild(i);
            });
            sec.appendChild(list);
            searchResultsContainer.appendChild(sec);
        }

        const total = mt.y.length + mt.a.length + mt.c.length + mt.p.length + mt.al.length + mt.s.length;
        if (total === 0) {
            searchResultsContainer.innerHTML = `<div class="no-results">No matches for "${q}"</div>`;
        }
    }

    /****************/
    /* TRANSPORT    */
    /****************/
    // Binding hardware-style playback controls to the logic engine
    nextBtn.onclick = () => playNextSong();
    prevBtn.onclick = () => playPrevSong();
    playPauseBtn.onclick = togglePlayback;
    audioPlayer.onended = () => playNextSong();

    /********************************/
    /* TRACK NAVIGATION ENGINE   */
    /********************************/
    function playNextSong() {
        if (!window.playingAlbum) return;

        if (window.isLooping) {
            audioPlayer.currentTime = 0;
            audioPlayer.play();
            return;
        }

        let nextIdx;
        if (window.isShuffling) {
            if (!window.shuffledIndices || window.shuffledIndices.length === 0) window.generateShufflePool();
            const currPos = window.shuffledIndices.indexOf(window.currentSongIndex);
            if (currPos === -1 || currPos >= window.shuffledIndices.length - 1) return stopAndReset();
            nextIdx = window.shuffledIndices[currPos + 1];
        } else {
            nextIdx = window.currentSongIndex + 1;
            if (nextIdx >= window.playingAlbum.songs.length) return stopAndReset();
        }

        window.playSong(nextIdx);
    }

    function playPrevSong() {
        if (!window.playingAlbum) return;

        if (audioPlayer.currentTime > 3) {
            audioPlayer.currentTime = 0;
            return;
        }

        let prevIdx;
        if (window.isShuffling) {
            const currPos = window.shuffledIndices.indexOf(window.currentSongIndex);

            // If we are at the very first song of the shuffle, just restart it
            if (currPos <= 0) {
                audioPlayer.currentTime = 0;
                return;
            }
            prevIdx = window.shuffledIndices[currPos - 1];
        } else {
            prevIdx = window.currentSongIndex - 1;
            if (prevIdx < 0) {
                audioPlayer.currentTime = 0;
                return;
            }
        }
        window.playSong(prevIdx);
    }

    /*****************/
    /* SHUFFLE       */
    /*****************/
    // Dedicated function to build the sequence once and lock it
    window.generateShufflePool = function () {
        if (!window.playingAlbum || !window.playingAlbum.songs.length) return;

        // Create an array of indices [0, 1, 2, ... lastIndex]
        let indices = Array.from({ length: window.playingAlbum.songs.length }, (_, i) => i);

        // Fisher-Yates Shuffle Algorithm
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }

        // UX OPTIMIZATION: Move the currently playing song to the very first position
        // This prevents the "next" button from accidentally playing the same song again.
        const currentPos = indices.indexOf(window.currentSongIndex);
        if (currentPos > -1) {
            indices.splice(currentPos, 1);
            indices.unshift(window.currentSongIndex);
        }

        window.shuffledIndices = indices;
        console.log("Shuffle Deck Generated:", window.shuffledIndices);
    };


    /**
     * END OF TRACK EVENT
     * Priority: 
     * 1. If LOOP is ON: Ignore all else and repeat the current track infinitely.
     * 2. If LOOP is OFF: Proceed to the next track (which handles Shuffle logic).
     */

    audioPlayer.onended = () => {
        console.log("Track Ended naturally. Moving to next...");
        if (window.isLooping) {
            audioPlayer.currentTime = 0;
            audioPlayer.play().catch(err => console.warn("Loop interrupted."));
        } else {
            playNextSong();
        }
    };

    /**
     * STOP AND RESET
     * Cleanly stops the player when an album or shuffle pool is exhausted.
     */
    function stopAndReset() {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
        updatePlayPauseIcon();

        // Sync progress bars and UI titles to resting state
        if (window.syncProgressBar) window.syncProgressBar();
        if (typeof updateDynamicTitle === 'function') updateDynamicTitle();
    }

    /****************/
    /* SYNC MODES   */
    /****************/
    function syncPlaybackModesUI() {
        const shuffleBtns = document.querySelectorAll('#shuffle-btn');
        const loopBtns = document.querySelectorAll('#loop-btn');

        shuffleBtns.forEach(btn => {
            if (window.isShuffling) {
                btn.classList.add('active');
                btn.style.color = 'var(--primary-color)';
            } else {
                btn.classList.remove('active');
                btn.style.color = '';
            }
        });

        loopBtns.forEach(btn => {
            if (window.isLooping) {
                btn.classList.add('active');
                btn.style.color = 'var(--primary-color)';
            } else {
                btn.classList.remove('active');
                btn.style.color = '';
            }
        });
    }

    /********************/
    /* MAXIMIZE LOGIC   */
    /********************/
    function toggleMaximize(isBack = false) {
        const mainPlayer = document.getElementById('main-player');
        if (!mainPlayer) return;

        const isCurrentlyMaximized = mainPlayer.classList.contains('maximized');

        if (!isCurrentlyMaximized) {
            mainPlayer.classList.add('maximized');
            document.body.style.overflow = 'hidden';

            // ONLY force display on mobile (768px or less)
            if (window.innerWidth <= 768) {
                const timerContainer = document.querySelector('.timer-btn-container');
                const queueBtn = document.getElementById('maximize-btn');
                if (timerContainer) timerContainer.style.setProperty('display', 'flex', 'important');
                if (queueBtn) queueBtn.style.setProperty('display', 'flex', 'important');
            }

            history.pushState({ view: 'fullscreen-player' }, 'Player', '#player');
        } else {
            mainPlayer.classList.remove('maximized');
            document.body.style.overflow = '';

            const timerContainer = document.querySelector('.timer-btn-container');
            const queueBtn = document.getElementById('maximize-btn');

            if (window.innerWidth <= 768) {
                if (timerContainer) timerContainer.style.display = 'none';
                if (queueBtn) queueBtn.style.display = 'none';
            } else {
                // On desktop, clear the inline styles so CSS display:none !important can work
                if (timerContainer) timerContainer.style.display = '';
                if (queueBtn) queueBtn.style.display = '';
            }

            if (!isBack && window.location.hash === '#player') {
                history.back();
            }
        }
    }

    /****************/
    /* CLICK EVENTS */
    /****************/
    // Clicking the small album cover expands the player
    playerAlbumCover.onclick = (e) => {
        e.stopPropagation();
        toggleMaximize();
    };

    // Expands the player to full-screen when clicking the song title
    playerSongTitle.onclick = (e) => {
        e.stopPropagation();
        toggleMaximize();
    };

    // Expands the player to full-screen when clicking the artist name
    playerSongArtist.onclick = (e) => {
        e.stopPropagation();
        toggleMaximize();
    };

    // Handles the dedicated minimize button to exit full-screen mode
    if (minimizeBtn) {
        minimizeBtn.onclick = (e) => {
            e.stopPropagation();
            toggleMaximize();
        };
    }

    /****************/
    /* QUEUE        */
    /****************/
    maximizeBtn.onclick = (e) => {
        e.stopPropagation();

        if (!window.playingAlbum) return;

        // 1. If we are currently maximized, close the fullscreen view first
        if (mainPlayer.classList.contains('maximized')) {
            toggleMaximize();
        }

        // 2. Delay the navigation slightly to allow the 'un-maximize' animation to finish
        setTimeout(() => {
            // Navigate to the current playing album
            selectAlbum(window.playingAlbum);

            // 3. Scroll to the active song so it's centered in the queue
            const activeItem = document.querySelector(`.song-item[data-song-id="${window.playingAlbum.songs[window.currentSongIndex]?.id}"]`);
            if (activeItem) {
                activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 300);
    };

    /*******************/
    /* EVENT LISTENERS */
    /*******************/
    // Home Link Navigation
    homeLink.onclick = (e) => {
        e.preventDefault();
        displayHome();
    };

    // Playlists Link Navigation
    playlistsLink.onclick = (e) => {
        e.preventDefault();
        displayPlaylists();
    };

    // Artists Link Navigation
    artistsLink.onclick = (e) => {
        e.preventDefault();
        displayArtists();
    };

    // explore Link Navigation
    exploreLink.onclick = (e) => {
        e.preventDefault();
        displayexplore();
    };

    // About Link Navigation
    aboutLink.onclick = (e) => {
        e.preventDefault();
        displayAbout();
    };




    /************************************************/
    /* ADVANCED REAL-TIME SYNC & HARDWARE ENGINE    */
    /************************************************/
    audioPlayer.ontimeupdate = () => {
        if (isDragging) return;

        const cur = audioPlayer.currentTime;
        const dur = audioPlayer.duration;

        if (!dur || isNaN(dur)) return;

        // 1. App UI Sync
        const per = (cur / dur) * 100;
        if (progress) progress.style.width = `${per}%`;
        if (currentTimeSpan) currentTimeSpan.textContent = formatTime(cur);

        // 2. System Notification Sync
        if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
            if (isFinite(dur) && dur > 0) {
                try {
                    navigator.mediaSession.setPositionState({
                        duration: dur,
                        playbackRate: audioPlayer.playbackRate || 1,
                        position: cur
                    });
                } catch (e) { }
            }
        }

        // 3. PERSISTENCE: Save exact float to Disk
        localStorage.setItem('beatZen_lastPosition', cur.toString());
    };


    /**
     * RESTORE: Hardware-safe high-precision time injection
     * Works after infinite refreshes by waiting for hardware readyState.
     */
    window.applySavedTime = function () {
        const savedTime = localStorage.getItem('beatZen_lastPosition');
        if (!savedTime || isNaN(parseFloat(savedTime))) return;

        const seekTime = parseFloat(savedTime);
        if (seekTime <= 0) return;

        let attempts = 0;
        const maxAttempts = 30; // Wait up to 6 seconds for slow networks

        const attemptRestore = () => {
            // readyState 1 means metadata is loaded, 4 means enough data to play
            if (audioPlayer.readyState >= 1 && audioPlayer.duration > 0) {

                const safeSeek = Math.min(seekTime, audioPlayer.duration - 0.5);

                // Perform the injection
                audioPlayer.currentTime = safeSeek;

                // Force-update the Progress Bar immediately
                const per = (safeSeek / audioPlayer.duration) * 100;
                if (progress) progress.style.width = `${per}%`;
                if (currentTimeSpan) currentTimeSpan.textContent = formatTime(safeSeek);

                console.log("Beat Zen Engine: Recovery Successful at " + safeSeek);
            } else if (attempts < maxAttempts) {
                attempts++;
                setTimeout(attemptRestore, 200); // Poll hardware every 200ms
            }
        };

        attemptRestore();
    };

    /****************************/
    /*  Global State Watchers  */
    /****************************/

    // Sync Play State to OS
    audioPlayer.addEventListener('play', () => {
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "playing";
    });
    audioPlayer.addEventListener('pause', () => {
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "paused";
    });

    // Cleanup OS notification when sequence ends
    audioPlayer.addEventListener('ended', () => {
        if (!window.isLooping && 'mediaSession' in navigator) {
            navigator.mediaSession.playbackState = "none";
        }
    });

    /*************/
    /* HISTORY   */
    /*************/
    window.onpopstate = (e) => {
        const hash = window.location.hash;

        // 1. Handle Fullscreen Player logic first
        if (mainPlayer.classList.contains('maximized')) {
            // Only back out of fullscreen if the hash is no longer #player
            if (hash !== '#player') {
                toggleMaximize(true);
            }
            return; 
        }

        const s = e.state;

        // 2. Consistent View Restoration
        if (!s || s.view === 'home' || hash === '' || hash === '#home') {
            displayHome(true);
        } else if (s.view === 'search' || hash === '#search') {
            hideAllViews();
            updateNav('search');
            searchContainer.classList.remove('hidden');
            searchResultsContainer.style.display = 'block';
        } else if (s.view === 'album' || hash.startsWith('#album-')) {
            // Re-run deep link logic to ensure data-sync after adding songs
            handleDeepLinking();
        } else {
            // Map state views to their display functions
            const stateRoutes = {
                'playlists': displayPlaylists,
                'artists': displayArtists,
                'explore': displayexplore,
                'about': displayAbout,
                'contact': displayContact
            };
            if (s && stateRoutes[s.view]) {
                stateRoutes[s.view](true);
            }
        }
    };

    /********************************/
    /* DEEP LINKING ROUTER          */
    /********************************/
    function handleDeepLinking() {
        const hash = window.location.hash;

        // Ensure player is minimized when navigating via deep link
        if (mainPlayer.classList.contains('maximized') && hash !== '#player') {
            mainPlayer.classList.remove('maximized');
            document.body.style.overflow = '';
        }

        if (!hash || hash === '#home') {
            displayHome(true);
            return;
        }

        const navViews = {
            '#playlists': displayPlaylists,
            '#artists': displayArtists,
            '#explore': displayexplore,
            '#about': displayAbout,
            '#contact': displayContact
        };

        if (navViews[hash]) {
            navViews[hash](true);
            return;
        }

        if (hash.startsWith('#album-')) {
            const rawSharedId = decodeURIComponent(hash.replace('#album-', ''));
            
            // Re-scan masterPool (important after adding new songs)
            const foundObj = masterPool.find(a => String(a.id || a.name || a.title) === rawSharedId);

            if (foundObj) {
                let type = foundObj.type || "Movie";
                selectAlbum(resolveData(foundObj, type), true);
            } else {
                displayHome(true);
            }
        }
    }


    /********************************/
    /* UNIFIED PLAYBACK MODES       */
    /********************************/
    // This function now handles BOTH Desktop and Mobile Button IDs
    window.syncPlaybackModesUI = function () {
        // We select ALL buttons because mobile has its own ID in the maximized grid
        const shuffleBtns = document.querySelectorAll('#shuffle-btn');
        const loopBtns = document.querySelectorAll('#loop-btn');

        shuffleBtns.forEach(btn => {
            if (window.isShuffling) {
                btn.classList.add('active');
                btn.style.setProperty('color', 'var(--primary-color)', 'important');
            } else {
                btn.classList.remove('active');
                btn.style.setProperty('color', '', '');
            }
        });

        loopBtns.forEach(btn => {
            if (window.isLooping) {
                btn.classList.add('active');
                btn.style.setProperty('color', 'var(--primary-color)', 'important');
            } else {
                btn.classList.remove('active');
                btn.style.setProperty('color', '', '');
            }
        });
    };

    // Global listener for dynamic control buttons
    // This catches clicks on the sidebar, the bottom bar, and the mobile grid
    document.addEventListener('click', (e) => {
        const sBtn = e.target.closest('#shuffle-btn');
        const lBtn = e.target.closest('#loop-btn');

        // --- SHUFFLE TOGGLE ---
        if (sBtn) {
            e.stopPropagation();
            window.isShuffling = !window.isShuffling;

            if (window.isShuffling) {
                // Instantly refresh the shuffle deck when turned ON
                window.generateShufflePool();
                console.log("Shuffle Enabled - Pool Refreshed");
            } else {
                // Wipe the deck when turned OFF
                window.shuffledIndices = [];
                console.log("Shuffle Disabled - Linear Playback Restored");
            }

            window.syncPlaybackModesUI();
            localStorage.setItem('beatZen_shuffle', window.isShuffling);

            // MODIFIED: Force the button to lose focus so color resets on mobile
            sBtn.blur();
        }

        // --- LOOP TOGGLE ---
        if (lBtn) {
            e.stopPropagation();
            window.isLooping = !window.isLooping;
            window.syncPlaybackModesUI();
            localStorage.setItem('beatZen_loop', window.isLooping);

            // MODIFIED: Force the button to lose focus so color resets on mobile
            lBtn.blur();
        }
    });

    /************************************************/
    /* INITIALIZATION & SESSION RECOVERY            */
    /************************************************/
    (function initializeApp() {
        window.addEventListener('hashchange', handleDeepLinking);
        window.addEventListener('scroll', () => {
            if (albumViewContainer.style.display === 'none') {
                window.scrollPositions[window.lastActiveView] = window.scrollY;
            }
        }, { passive: true });

        setTimeout(() => {
            const currentHash = window.location.hash;

            // 1. DATA POOL RE-SYNC
            if (typeof customGenreData !== 'undefined' && window.masterPool) {
                Object.values(customGenreData).flat().forEach(item => {
                    if (!window.masterPool.find(m => m.id === item.id)) {
                        window.masterPool.push(item);
                    }
                });
            }

            // 2. FULL SESSION RECOVERY (Fixed for Refresh Bug)
            const savedSession = localStorage.getItem('lastPlayedSong');
            if (savedSession) {
                try {
                    const { albumId, songIndex, type } = JSON.parse(savedSession);
                    const found = masterPool.find(a => String(a.id || a.name || a.title) === String(albumId));
                    if (found) {
                        window.playingAlbum = resolveData(found, type);

                        // Set index first
                        window.currentSongIndex = songIndex;

                        // Detach onended temporarily so the load doesn't trigger a skip
                        const originalEnded = audioPlayer.onended;
                        audioPlayer.onended = null;

                        // Pass 'false' to ensure it stays paused on refresh
                        window.playSong(songIndex, false);

                        if (window.applySavedTime) window.applySavedTime();

                        // Restore skip logic after stability window
                        setTimeout(() => { audioPlayer.onended = originalEnded; }, 1500);
                    }
                } catch (e) { console.error("Beat Zen: Session restore failed", e); }
            }

            // 3. DEEP LINKING ROUTER
            if (currentHash.startsWith('#album-')) {
                handleDeepLinking();
            } else if (currentHash === '#explore') {
                displayexplore(true);
            } else if (currentHash === '#artists') {
                displayArtists(true);
            } else {
                displayHome(true);
            }

            // 4. SCROLL MEMORY
            const savedScroll = localStorage.getItem('beatZen_scroll_' + (currentHash.replace('#', '') || 'home'));
            if (savedScroll) window.scrollTo({ top: parseInt(savedScroll), behavior: 'instant' });

        }, 200);
    })();
    /********************************/
    /* SCROLL-AWARE VIEW SWITCHER   */
    /********************************/
    // Update your navigateToView to support the memory system

    const navigateToView = (id, container, isBack) => {
        // 1. Save the state of the view we are leaving
        if (window.lastActiveView && window.scrollPositions.hasOwnProperty(window.lastActiveView)) {
            const leavePos = window.scrollY;
            // Only save if we are actually on a grid (not inside a card)
            if (albumViewContainer.style.display === 'none') {
                window.scrollPositions[window.lastActiveView] = leavePos;
                localStorage.setItem('beatZen_scroll_' + window.lastActiveView, leavePos);
            }
        }

        hideAllViews();
        updateNav(id);
        if (container) container.style.display = 'block';

        window.lastActiveView = id;

        // 2. Restore position with a "Double-Lock" (RAF + Timeout)
        // This ensures the scroll happens AFTER the cards are rendered
        const targetPos = window.scrollPositions[id] || parseInt(localStorage.getItem('beatZen_scroll_' + id)) || 0;

        if (targetPos > 0) {
            requestAnimationFrame(() => {
                setTimeout(() => {
                    window.scrollTo({ top: targetPos, behavior: 'instant' });
                }, 50); // 50ms is enough to let the browser paint the grid
            });
        } else {
            window.scrollTo({ top: 0, behavior: 'instant' });
        }

        updateDynamicTitle();
    };

});

