class SpotifyMelodyTimeline extends MelodyTimeline {
    constructor() {
        super();
        this.spotifyAuth = new SpotifyAuth();
        this.spotifyMode = false;
        this.currentPlaylistId = null;
        this.spotifyTracks = [];
        this.activeDeviceId = null;
        this.connectAvailable = false;
        this.spotifyPlaying = false;
        this.initializeSpotifyUI();
        this.checkSpotifyAuth();
    }

    initializeSpotifyUI() {
        const spotifyBtn = document.getElementById('spotify-login-btn');
        const loadPlaylistBtn = document.getElementById('load-playlist-btn');
        const localModeBtn = document.getElementById('local-mode-btn');
        const clientIdInput = document.getElementById('spotify-client-id');
        const saveClientIdBtn = document.getElementById('save-client-id-btn');
        const loadUrlBtn = document.getElementById('load-url-btn');
        const toggleMultiMode = document.getElementById('toggle-multi-mode');
        const toggleSingleMode = document.getElementById('toggle-single-mode');
        const loadMixedBtn = document.getElementById('load-mixed-playlists-btn');
        const selectAllBtn = document.getElementById('select-all-playlists');
        const deselectAllBtn = document.getElementById('deselect-all-playlists');
        const logoutBtn = document.getElementById('spotify-logout-btn');

        if (spotifyBtn) spotifyBtn.addEventListener('click', () => this.loginToSpotify());
        if (loadPlaylistBtn) loadPlaylistBtn.addEventListener('click', () => this.loadSelectedPlaylist());
        if (loadUrlBtn) loadUrlBtn.addEventListener('click', () => this.loadPlaylistFromUrl());
        if (loadMixedBtn) loadMixedBtn.addEventListener('click', () => this.loadMixedPlaylists());
        if (toggleMultiMode) toggleMultiMode.addEventListener('click', () => this.togglePlaylistMode(true));
        if (toggleSingleMode) toggleSingleMode.addEventListener('click', () => this.togglePlaylistMode(false));
        if (selectAllBtn) selectAllBtn.addEventListener('click', () => this.selectAllPlaylists(true));
        if (deselectAllBtn) deselectAllBtn.addEventListener('click', () => this.selectAllPlaylists(false));
        if (localModeBtn) localModeBtn.addEventListener('click', () => this.switchToLocalMode());
        if (logoutBtn) logoutBtn.addEventListener('click', () => this.logoutSpotify());

        if (saveClientIdBtn) {
            saveClientIdBtn.addEventListener('click', () => {
                const clientId = clientIdInput?.value.trim();
                if (clientId) {
                    this.spotifyAuth.setClientId(clientId);
                    this.showMessage('Spotify Client ID saved!', 'success');
                } else {
                    this.showMessage('Please enter a Client ID', 'error');
                }
            });
        }

        const savedClientId = this.spotifyAuth.getClientId();
        if (savedClientId && clientIdInput) {
            clientIdInput.value = savedClientId;
        }
    }

    extractPlaylistId(url) {
        const match = url.match(/playlist\/([a-zA-Z0-9]+)/);
        return match ? match[1] : url.trim();
    }

    async loadPlaylistFromUrl() {
        const urlInput = document.getElementById('playlist-url-input');
        const url = urlInput?.value.trim();

        if (!url) {
            this.showMessage('Please enter a Spotify playlist URL or ID', 'info');
            return;
        }

        const playlistId = this.extractPlaylistId(url);
        if (!playlistId) {
            this.showMessage('Invalid Spotify URL or ID', 'error');
            return;
        }
        await this.loadPlaylistById(playlistId);
    }

    async checkSpotifyAuth() {
        const authenticated = await this.spotifyAuth.handleCallback();

        if (authenticated) {
            this.showMessage('Connected to Spotify!', 'success');
            await this.updateSpotifyUI();
        } else if (this.spotifyAuth.isAuthenticated()) {
            await this.updateSpotifyUI();
        }
    }

    async updateSpotifyUI() {
        const spotifyStatus = document.getElementById('spotify-status');
        const playlistContainer = document.getElementById('playlist-container');
        const spotifyLoginBtn = document.getElementById('spotify-login-btn');
        const logoutBtn = document.getElementById('spotify-logout-btn');

        if (!this.spotifyAuth.isAuthenticated()) {
            if (spotifyStatus) spotifyStatus.textContent = 'Not connected';
            if (spotifyStatus) spotifyStatus.className = 'font-bold text-red-400';
            if (playlistContainer) playlistContainer.classList.add('hidden');
            if (spotifyLoginBtn) spotifyLoginBtn.classList.remove('hidden');
            if (logoutBtn) logoutBtn.classList.add('hidden');
            return;
        }

        try {
            const profile = await this.spotifyAuth.getUserProfile();
            if (spotifyStatus) {
                spotifyStatus.textContent = `✅ ${profile.display_name || profile.id}`;
                spotifyStatus.className = 'font-bold text-green-400';
            }
            if (spotifyLoginBtn) spotifyLoginBtn.classList.add('hidden');
            if (logoutBtn) logoutBtn.classList.remove('hidden');

            await this.loadPlaylists();
            if (playlistContainer) playlistContainer.classList.remove('hidden');

            await this.detectDevices();

        } catch (error) {
            console.error('Error updating Spotify UI:', error);
            if (spotifyStatus) {
                spotifyStatus.textContent = 'Connection error';
                spotifyStatus.className = 'font-bold text-red-400';
            }
            this.showMessage(error.message, 'error');
        }
    }

    async loginToSpotify() {
        try {
            await this.spotifyAuth.login();
        } catch (error) {
            this.showMessage(error.message, 'error');
        }
    }

    logoutSpotify() {
        this.spotifyAuth.logout();
        this.spotifyMode = false;
        this.spotifyTracks = [];
        this.activeDeviceId = null;
        this.connectAvailable = false;
        this.updateSpotifyUI();
        this.showMessage('Logged out of Spotify', 'info');
    }

    async loadPlaylists() {
        try {
            const playlists = await this.spotifyAuth.getUserPlaylists();
            this.allPlaylists = playlists;

            const playlistSelect = document.getElementById('playlist-select');
            if (!playlistSelect) return;

            playlistSelect.innerHTML = '';

            const defaultOpt = document.createElement('option');
            defaultOpt.value = '';
            defaultOpt.textContent = 'Select a playlist...';
            defaultOpt.style.cssText = 'background:#1a1a2e;color:white';
            playlistSelect.appendChild(defaultOpt);

            if (playlists.length === 0) {
                this.showMessage('No playlists found in your Spotify account', 'info');
                return;
            }

            const divider = document.createElement('option');
            divider.disabled = true;
            divider.textContent = '─────── Your Playlists ───────';
            divider.style.cssText = 'background:#1a1a2e;color:#888';
            playlistSelect.appendChild(divider);

            playlists.forEach(playlist => {
                const option = document.createElement('option');
                option.value = playlist.id;
                const count = (playlist.tracks && typeof playlist.tracks.total === 'number')
                    ? playlist.tracks.total
                    : '?';
                option.textContent = `${playlist.name} (${count} tracks)`;
                option.style.cssText = 'background:#1a1a2e;color:white';
                playlistSelect.appendChild(option);
            });

            this.populatePlaylistCheckboxes(playlists);

        } catch (error) {
            console.error('Error loading playlists:', error);
            this.showMessage('Error loading playlists: ' + error.message, 'error');
        }
    }

    populatePlaylistCheckboxes(playlists) {
        const container = document.getElementById('playlist-checkboxes');
        if (!container) return;

        container.innerHTML = '';

        playlists.forEach(playlist => {
            const checkbox = this.createPlaylistCheckbox(playlist);
            container.appendChild(checkbox);
        });
    }

    createPlaylistCheckbox(playlist) {
        const label = document.createElement('label');
        label.className = 'flex items-center gap-2 cursor-pointer hover:bg-white/10 p-2 rounded';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = playlist.id;
        checkbox.className = 'w-4 h-4 accent-purple-500';

        const text = document.createElement('span');
        text.className = 'text-sm flex-1';
        const count = (playlist.tracks && typeof playlist.tracks.total === 'number')
            ? playlist.tracks.total
            : '?';
        text.textContent = `${playlist.name} (${count} tracks)`;

        label.appendChild(checkbox);
        label.appendChild(text);

        return label;
    }

    togglePlaylistMode(isMulti) {
        const singleContainer = document.getElementById('single-playlist-section');
        const multiContainer = document.getElementById('multi-playlist-container');

        if (isMulti) {
            if (singleContainer) singleContainer.classList.add('hidden');
            if (multiContainer) multiContainer.classList.remove('hidden');
        } else {
            if (singleContainer) singleContainer.classList.remove('hidden');
            if (multiContainer) multiContainer.classList.add('hidden');
        }
    }

    selectAllPlaylists(select) {
        const checkboxes = document.querySelectorAll('#playlist-checkboxes input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = select);
    }

    _processRawTracks(rawTracks) {
        const totalRaw = rawTracks.length;
        const processed = [];

        rawTracks.forEach(item => {
            try {
                if (!item || !item.track) return;
                if (!item.track.name || !item.track.id) return;
                if (!item.track.artists || !Array.isArray(item.track.artists) || item.track.artists.length === 0) return;
                if (!item.track.album) return;

                const year = this._extractYear(item.track.album.release_date);
                if (!year || year < 1900 || year > new Date().getFullYear() + 1) return;

                processed.push({
                    id: item.track.id,
                    title: item.track.name,
                    artist: item.track.artists.map(a => a.name).join(', '),
                    year: year,
                    image_url: item.track.album.images?.[0]?.url || '',
                    album: item.track.album.name || 'Unknown Album'
                });
            } catch (err) {
                console.warn('Skipping malformed track:', err);
            }
        });

        return { processed, totalRaw };
    }

    _extractYear(dateStr) {
        if (!dateStr) return null;
        const year = parseInt(dateStr.substring(0, 4));
        return isNaN(year) ? null : year;
    }

    async loadMixedPlaylists() {
        const checkboxes = document.querySelectorAll('#playlist-checkboxes input[type="checkbox"]:checked');
        const selectedIds = Array.from(checkboxes).map(cb => cb.value);

        if (selectedIds.length === 0) {
            this.showMessage('Please select at least one playlist', 'info');
            return;
        }

        try {
            this.showMessage(`Loading ${selectedIds.length} playlist${selectedIds.length > 1 ? 's' : ''}...`, 'info');

            const allRawTracks = [];
            let failedCount = 0;

            for (const playlistId of selectedIds) {
                try {
                    const tracks = await this.spotifyAuth.getPlaylistTracks(playlistId);
                    if (tracks && Array.isArray(tracks)) {
                        allRawTracks.push(...tracks);
                    }
                } catch (err) {
                    failedCount++;
                    console.warn(`Failed to load playlist ${playlistId}:`, err.message);
                }
            }

            if (failedCount > 0) {
                this.showMessage(`${failedCount} playlist(s) failed to load (403 access denied). Using the rest.`, 'info');
            }

            this._finishLoadingTracks(allRawTracks, true);

        } catch (error) {
            console.error('Error loading mixed playlists:', error);
            this.showMessage('Error: ' + error.message, 'error');
        }
    }

    async loadSelectedPlaylist() {
        const playlistSelect = document.getElementById('playlist-select');
        const playlistId = playlistSelect?.value;

        if (!playlistId) {
            this.showMessage('Please select a playlist', 'info');
            return;
        }

        await this.loadPlaylistById(playlistId);
    }

    async loadPlaylistById(playlistId) {
        try {
            this.showMessage('Loading playlist...', 'info');

            const rawTracks = await this.spotifyAuth.getPlaylistTracks(playlistId);

            if (!rawTracks || !Array.isArray(rawTracks)) {
                throw new Error('Invalid data received from Spotify');
            }

            if (rawTracks.length === 0) {
                this.showMessage('This playlist is empty', 'error');
                return;
            }

            this._finishLoadingTracks(rawTracks, false);

        } catch (error) {
            console.error('Error loading playlist:', error);
            this.showMessage('Error: ' + error.message, 'error');
        }
    }

    _finishLoadingTracks(rawTracks, isMixed) {
        const { processed, totalRaw } = this._processRawTracks(rawTracks);

        if (processed.length === 0) {
            this.showMessage(
                `No playable tracks found (${totalRaw} in playlist). ` +
                'Try one of YOUR OWN playlists — Spotify blocks access to other people\'s playlists in Developer Mode.',
                'error'
            );
            return;
        }

        const unique = this.deduplicateTracks(processed);
        this.spotifyTracks = this.shuffleArray(unique);

        this.gameData = this.spotifyTracks;
        this.spotifyMode = true;

        const msg = isMixed
            ? `� Mixed! ${this.spotifyTracks.length} tracks ready to stream!`
            : `� ${this.spotifyTracks.length} tracks ready to stream!`;
        this.showMessage(msg, 'success');

        this.startGame();
    }

    deduplicateTracks(tracks) {
        const seen = new Set();
        return tracks.filter(track => {
            if (seen.has(track.id)) return false;
            seen.add(track.id);
            return true;
        });
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    drawNextCard() {
        if (this.spotifyMode && this.spotifyPlaying) {
            this.connectSkip();
        }
        super.drawNextCard();
    }

    switchToLocalMode() {
        if (this.spotifyPlaying) this.connectSkip();
        this.spotifyMode = false;
        this.currentPlaylistId = null;
        this.spotifyTracks = [];
        this.showMessage('Switched to local mode', 'info');
        this.startGame();
    }

    async loadGameData() {
        if (this.spotifyMode && this.spotifyTracks.length > 0) {
            this.gameData = this.spotifyTracks;
            return true;
        }
        return await super.loadGameData();
    }

    createCardElement(card, className = '', hideYear = false) {
        const cardDiv = document.createElement('div');
        cardDiv.className = `card ${className}`;

        const img = document.createElement('img');

        if (this.spotifyMode && card.image_url) {
            img.src = card.image_url;
            img.alt = 'Album Cover';
            img.onerror = () => {
                img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="180"%3E%3Crect fill="%23333" width="200" height="180"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%23fff" font-family="Arial" font-size="40"%3E🎵%3C/text%3E%3C/svg%3E';
            };
        } else {
            img.src = `assets/images/${card.id}_thumb.jpg`;
            img.alt = 'Album Cover';
            img.onerror = () => {
                img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="180"%3E%3Crect fill="%23333" width="200" height="180"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%23fff" font-family="Arial" font-size="16"%3ENo Image%3C/text%3E%3C/svg%3E';
            };
        }

        const titleDiv = document.createElement('div');
        titleDiv.className = `title ${hideYear && !this.yearsRevealed ? 'hidden' : ''}`;
        titleDiv.textContent = hideYear && !this.yearsRevealed ? '???' : card.title;

        const artistDiv = document.createElement('div');
        artistDiv.className = `artist ${hideYear && !this.yearsRevealed ? 'hidden' : ''}`;
        artistDiv.textContent = hideYear && !this.yearsRevealed ? '???' : card.artist;

        const yearDiv = document.createElement('div');
        yearDiv.className = `year ${hideYear && !this.yearsRevealed ? 'hidden' : ''}`;
        yearDiv.textContent = hideYear && !this.yearsRevealed ? '????' : card.year;

        cardDiv.appendChild(img);
        cardDiv.appendChild(titleDiv);
        cardDiv.appendChild(artistDiv);
        cardDiv.appendChild(yearDiv);

        return cardDiv;
    }

    // ── Spotify Connect: device detection & playback ──

    async detectDevices() {
        const deviceInfo = document.getElementById('device-info');
        const deviceSelect = document.getElementById('device-select');
        const refreshDevicesBtn = document.getElementById('refresh-devices-btn');

        if (refreshDevicesBtn) {
            refreshDevicesBtn.onclick = () => this.detectDevices();
        }

        try {
            const devices = await this.spotifyAuth.getDevices();

            if (deviceSelect) {
                deviceSelect.innerHTML = '';
                if (devices.length === 0) {
                    deviceSelect.innerHTML = '<option value="">No Spotify devices found</option>';
                    this.connectAvailable = false;
                } else {
                    this.connectAvailable = true;
                    devices.forEach(d => {
                        const opt = document.createElement('option');
                        opt.value = d.id;
                        opt.textContent = `${d.name} (${d.type})`;
                        if (d.is_active) opt.selected = true;
                        opt.style.cssText = 'background:#1a1a2e;color:white';
                        deviceSelect.appendChild(opt);
                    });
                    this.activeDeviceId = devices.find(d => d.is_active)?.id || devices[0].id;
                }
            }

            if (deviceInfo) {
                deviceInfo.classList.remove('hidden');
            }

            if (devices.length === 0) {
                this.showMessage('Open Spotify on your phone or computer, then click Refresh Devices', 'info');
            } else {
                this.showMessage(`Found ${devices.length} Spotify device(s)`, 'success');
            }
        } catch (e) {
            console.warn('Could not detect devices:', e);
            this.connectAvailable = false;
        }
    }

    revealYears() {
        this.yearsRevealed = true;
        this.renderCurrentCard();
        this.renderTimeline();

        const wrapper = document.querySelector('.spotify-embed-wrapper');
        if (wrapper) wrapper.classList.remove('hide-info');

        this.showMessage('Song information revealed!', 'info');
    }

    async loadAudio() {
        if (!this.currentCard) return;

        const embedContainer = document.getElementById('spotify-embed-container');
        const audioPlayer = document.getElementById('audio-player');
        const connectPlayer = document.getElementById('spotify-connect-player');

        if (!this.spotifyMode) {
            // Local mode
            if (audioPlayer) audioPlayer.classList.remove('hidden');
            if (embedContainer) embedContainer.classList.add('hidden');
            if (connectPlayer) connectPlayer.classList.add('hidden');
            this.audioElement.src = `assets/music/${this.currentCard.id}.mp3`;
            this.audioElement.load();
            this.isPlaying = false;
            this.playPauseBtn.textContent = '▶️ Play';
            return;
        }

        // Spotify mode — try Connect first, fallback to embed
        if (audioPlayer) audioPlayer.classList.add('hidden');

        // Get selected device
        const deviceSelect = document.getElementById('device-select');
        if (deviceSelect?.value) {
            this.activeDeviceId = deviceSelect.value;
        }

        if (this.connectAvailable && this.activeDeviceId) {
            // Spotify Connect mode — play on real Spotify app
            if (embedContainer) embedContainer.classList.add('hidden');
            if (connectPlayer) {
                connectPlayer.classList.remove('hidden');
                this.spotifyPlaying = false;
                const connectPlayBtn = document.getElementById('connect-play-btn');
                if (connectPlayBtn) connectPlayBtn.textContent = '▶️ Play on Spotify';
            }
        } else {
            // Embed fallback
            if (connectPlayer) connectPlayer.classList.add('hidden');
            if (embedContainer) {
                embedContainer.classList.remove('hidden');
                const hideClass = this.yearsRevealed ? '' : 'hide-info';
                embedContainer.innerHTML = `
                    <div class="spotify-embed-wrapper ${hideClass}">
                        <iframe
                            src="https://open.spotify.com/embed/track/${this.currentCard.id}?utm_source=generator&theme=0"
                            width="100%" height="80" frameBorder="0"
                            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                            loading="lazy"
                            style="border-radius:12px;"></iframe>
                        <div class="embed-overlay">
                            <span>🎵 Press play — guess the song!</span>
                        </div>
                    </div>`;
            }
        }
    }

    async connectPlay() {
        if (!this.currentCard) return;
        const connectPlayBtn = document.getElementById('connect-play-btn');

        try {
            if (this.spotifyPlaying) {
                await this.spotifyAuth.pausePlayback();
                this.spotifyPlaying = false;
                if (connectPlayBtn) connectPlayBtn.textContent = '▶️ Play on Spotify';
            } else {
                await this.spotifyAuth.playTrack(this.currentCard.id, this.activeDeviceId);
                this.spotifyPlaying = true;
                if (connectPlayBtn) connectPlayBtn.textContent = '⏸️ Pause';
                this.showMessage('🎵 Now playing on your Spotify!', 'success');
            }
        } catch (err) {
            if (err.message === 'NO_DEVICE') {
                this.showMessage('No active Spotify device. Open Spotify on your phone/computer and try again.', 'error');
                await this.detectDevices();
            } else if (err.message === 'PREMIUM_REQUIRED') {
                this.showMessage('Spotify Premium required for playback control. Using embed player instead.', 'info');
                this.connectAvailable = false;
                this.loadAudio();
            } else {
                this.showMessage('Playback error: ' + err.message, 'error');
            }
        }
    }

    async connectSkip() {
        try {
            await this.spotifyAuth.pausePlayback();
        } catch (e) { /* ignore */ }
        this.spotifyPlaying = false;
        const connectPlayBtn = document.getElementById('connect-play-btn');
        if (connectPlayBtn) connectPlayBtn.textContent = '▶️ Play on Spotify';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.spotifyGame = new SpotifyMelodyTimeline();
});
