class SpotifyMelodyTimeline extends MelodyTimeline {
    constructor() {
        super();
        this.spotifyAuth = new SpotifyAuth();
        this.spotifyMode = false;
        this.currentPlaylistId = null;
        this.spotifyTracks = [];
        
        this.initializeSpotifyUI();
        this.checkSpotifyAuth();
    }
    
    initializeSpotifyUI() {
        const spotifyBtn = document.getElementById('spotify-login-btn');
        const playlistSelect = document.getElementById('playlist-select');
        const loadPlaylistBtn = document.getElementById('load-playlist-btn');
        const spotifyStatus = document.getElementById('spotify-status');
        const localModeBtn = document.getElementById('local-mode-btn');
        const clientIdInput = document.getElementById('spotify-client-id');
        const saveClientIdBtn = document.getElementById('save-client-id-btn');
        const playlistUrlInput = document.getElementById('playlist-url-input');
        const loadUrlBtn = document.getElementById('load-url-btn');
        const toggleMultiMode = document.getElementById('toggle-multi-mode');
        const toggleSingleMode = document.getElementById('toggle-single-mode');
        const loadMixedBtn = document.getElementById('load-mixed-playlists-btn');
        const selectAllBtn = document.getElementById('select-all-playlists');
        const deselectAllBtn = document.getElementById('deselect-all-playlists');
        
        if (spotifyBtn) {
            spotifyBtn.addEventListener('click', () => this.loginToSpotify());
        }
        
        if (loadPlaylistBtn) {
            loadPlaylistBtn.addEventListener('click', () => this.loadSelectedPlaylist());
        }
        
        if (loadUrlBtn) {
            loadUrlBtn.addEventListener('click', () => this.loadPlaylistFromUrl());
        }
        
        if (loadMixedBtn) {
            loadMixedBtn.addEventListener('click', () => this.loadMixedPlaylists());
        }
        
        if (toggleMultiMode) {
            toggleMultiMode.addEventListener('click', () => this.togglePlaylistMode(true));
        }
        
        if (toggleSingleMode) {
            toggleSingleMode.addEventListener('click', () => this.togglePlaylistMode(false));
        }
        
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => this.selectAllPlaylists(true));
        }
        
        if (deselectAllBtn) {
            deselectAllBtn.addEventListener('click', () => this.selectAllPlaylists(false));
        }
        
        if (localModeBtn) {
            localModeBtn.addEventListener('click', () => this.switchToLocalMode());
        }
        
        if (saveClientIdBtn) {
            saveClientIdBtn.addEventListener('click', () => {
                const clientId = clientIdInput.value.trim();
                if (clientId) {
                    this.spotifyAuth.setClientId(clientId);
                    this.showMessage('Spotify Client ID saved!', 'success');
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
        return match ? match[1] : url;
    }
    
    async loadPlaylistFromUrl() {
        const urlInput = document.getElementById('playlist-url-input');
        const url = urlInput?.value.trim();
        
        if (!url) {
            this.showMessage('Please enter a Spotify playlist URL or ID', 'info');
            return;
        }
        
        const playlistId = this.extractPlaylistId(url);
        await this.loadPlaylistById(playlistId);
    }
    
    async checkSpotifyAuth() {
        const authenticated = await this.spotifyAuth.handleCallback();
        
        if (authenticated) {
            this.showMessage('Successfully connected to Spotify!', 'success');
            await this.updateSpotifyUI();
        } else if (this.spotifyAuth.isAuthenticated()) {
            await this.updateSpotifyUI();
        }
    }
    
    async updateSpotifyUI() {
        const spotifyStatus = document.getElementById('spotify-status');
        const playlistContainer = document.getElementById('playlist-container');
        const spotifyLoginBtn = document.getElementById('spotify-login-btn');
        
        if (!this.spotifyAuth.isAuthenticated()) {
            if (spotifyStatus) spotifyStatus.textContent = 'Not connected';
            if (playlistContainer) playlistContainer.classList.add('hidden');
            if (spotifyLoginBtn) spotifyLoginBtn.classList.remove('hidden');
            return;
        }
        
        try {
            const profile = await this.spotifyAuth.getUserProfile();
            if (spotifyStatus) {
                spotifyStatus.textContent = `Connected as ${profile.display_name}`;
            }
            if (spotifyLoginBtn) spotifyLoginBtn.classList.add('hidden');
            
            await this.loadPlaylists();
            if (playlistContainer) playlistContainer.classList.remove('hidden');
            
        } catch (error) {
            console.error('Error updating Spotify UI:', error);
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
    
    async loadPlaylists() {
        try {
            const playlists = await this.spotifyAuth.getUserPlaylists();
            this.allPlaylists = playlists;
            
            const playlistSelect = document.getElementById('playlist-select');
            
            if (!playlistSelect) return;
            
            playlistSelect.innerHTML = '<option value="">Select a playlist...</option>';
            
            const topHitsOption = document.createElement('option');
            topHitsOption.value = '37i9dQZF1DXcBWIGoYBM5M';
            topHitsOption.textContent = '🔥 Today\'s Top Hits (Spotify)';
            topHitsOption.style.background = '#1a1a2e';
            topHitsOption.style.color = 'white';
            playlistSelect.appendChild(topHitsOption);
            
            const divider = document.createElement('option');
            divider.disabled = true;
            divider.textContent = '─────── Your Playlists ───────';
            divider.style.background = '#1a1a2e';
            divider.style.color = '#888';
            playlistSelect.appendChild(divider);
            
            playlists.forEach(playlist => {
                const option = document.createElement('option');
                option.value = playlist.id;
                const trackCount = playlist.tracks?.total ?? playlist.tracks?.href ? 'Loading...' : '?';
                option.textContent = `${playlist.name} (${trackCount} tracks)`;
                option.style.background = '#1a1a2e';
                option.style.color = 'white';
                playlistSelect.appendChild(option);
                
                // Debug log to see what we're getting
                if (!playlist.tracks || !playlist.tracks.total) {
                    console.log('Playlist missing track count:', playlist.name, playlist);
                }
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
        
        const topHitsCheckbox = this.createPlaylistCheckbox({
            id: '37i9dQZF1DXcBWIGoYBM5M',
            name: '🔥 Today\'s Top Hits',
            tracks: { total: '?' }
        });
        container.appendChild(topHitsCheckbox);
        
        const divider = document.createElement('div');
        divider.className = 'border-t border-white/20 my-2';
        container.appendChild(divider);
        
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
        checkbox.className = 'w-4 h-4';
        
        const text = document.createElement('span');
        text.className = 'text-sm flex-1';
        const trackCount = playlist.tracks?.total || '?';
        text.textContent = `${playlist.name} (${trackCount} tracks)`;
        
        label.appendChild(checkbox);
        label.appendChild(text);
        
        return label;
    }
    
    togglePlaylistMode(isMulti) {
        const singleContainer = document.getElementById('playlist-select')?.parentElement;
        const multiContainer = document.getElementById('multi-playlist-container');
        
        if (isMulti) {
            singleContainer?.classList.add('hidden');
            multiContainer?.classList.remove('hidden');
        } else {
            singleContainer?.classList.remove('hidden');
            multiContainer?.classList.add('hidden');
        }
    }
    
    selectAllPlaylists(select) {
        const checkboxes = document.querySelectorAll('#playlist-checkboxes input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = select);
    }
    
    async loadMixedPlaylists() {
        const checkboxes = document.querySelectorAll('#playlist-checkboxes input[type="checkbox"]:checked');
        const selectedIds = Array.from(checkboxes).map(cb => cb.value);
        
        if (selectedIds.length === 0) {
            this.showMessage('Please select at least one playlist', 'info');
            return;
        }
        
        try {
            this.showMessage(`Loading ${selectedIds.length} playlists...`, 'info');
            
            const allTracks = [];
            
            for (const playlistId of selectedIds) {
                try {
                    const tracks = await this.spotifyAuth.getPlaylistTracks(playlistId);
                    if (tracks && Array.isArray(tracks)) {
                        allTracks.push(...tracks);
                    }
                } catch (err) {
                    console.warn(`Failed to load playlist ${playlistId}:`, err);
                }
            }
            
            this.spotifyTracks = allTracks
                .filter(item => {
                    if (!item || !item.track) return false;
                    if (!item.track.preview_url) return false;
                    if (!item.track.name || !item.track.id) return false;
                    if (!item.track.album || !item.track.album.release_date) return false;
                    if (!item.track.artists || !Array.isArray(item.track.artists)) return false;
                    return true;
                })
                .map(item => {
                    try {
                        return {
                            id: item.track.id,
                            title: item.track.name,
                            artist: item.track.artists.map(a => a.name).join(', '),
                            year: new Date(item.track.album.release_date).getFullYear(),
                            preview_url: item.track.preview_url,
                            image_url: item.track.album.images?.[0]?.url || '',
                            album: item.track.album.name || 'Unknown Album'
                        };
                    } catch (err) {
                        console.warn('Skipping track due to error:', err);
                        return null;
                    }
                })
                .filter(track => track !== null);
            
            const uniqueTracks = this.deduplicateTracks(this.spotifyTracks);
            this.spotifyTracks = this.shuffleArray(uniqueTracks);
            
            if (this.spotifyTracks.length === 0) {
                this.showMessage('No tracks with previews found in selected playlists', 'error');
                return;
            }
            
            this.gameData = this.spotifyTracks;
            this.spotifyMode = true;
            
            this.showMessage(`🎵 Mixed ${selectedIds.length} playlists! ${this.spotifyTracks.length} unique tracks loaded!`, 'success');
            
            this.startGame();
            
        } catch (error) {
            console.error('Error loading mixed playlists:', error);
            this.showMessage('Error loading playlists: ' + error.message, 'error');
        }
    }
    
    deduplicateTracks(tracks) {
        const seen = new Set();
        return tracks.filter(track => {
            if (seen.has(track.id)) {
                return false;
            }
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
            this.showMessage('Loading playlist tracks...', 'info');
            
            const tracks = await this.spotifyAuth.getPlaylistTracks(playlistId);
            
            if (!tracks || !Array.isArray(tracks)) {
                throw new Error('Invalid playlist data received');
            }
            
            this.spotifyTracks = tracks
                .filter(item => {
                    if (!item || !item.track) return false;
                    if (!item.track.preview_url) return false;
                    if (!item.track.name || !item.track.id) return false;
                    if (!item.track.album || !item.track.album.release_date) return false;
                    if (!item.track.artists || !Array.isArray(item.track.artists)) return false;
                    return true;
                })
                .map(item => {
                    try {
                        return {
                            id: item.track.id,
                            title: item.track.name,
                            artist: item.track.artists.map(a => a.name).join(', '),
                            year: new Date(item.track.album.release_date).getFullYear(),
                            preview_url: item.track.preview_url,
                            image_url: item.track.album.images?.[0]?.url || '',
                            album: item.track.album.name || 'Unknown Album'
                        };
                    } catch (err) {
                        console.warn('Skipping track due to error:', err, item);
                        return null;
                    }
                })
                .filter(track => track !== null);
            
            if (this.spotifyTracks.length === 0) {
                this.showMessage('No tracks with previews found in this playlist. Try a different playlist.', 'error');
                return;
            }
            
            this.gameData = this.spotifyTracks;
            this.spotifyMode = true;
            this.currentPlaylistId = playlistId;
            
            this.showMessage(`Loaded ${this.spotifyTracks.length} tracks with previews!`, 'success');
            
            this.startGame();
            
        } catch (error) {
            console.error('Error loading playlist:', error);
            this.showMessage('Error loading playlist: ' + error.message, 'error');
        }
    }
    
    switchToLocalMode() {
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
    
    loadAudio() {
        if (this.currentCard) {
            if (this.spotifyMode && this.currentCard.preview_url) {
                this.audioElement.src = this.currentCard.preview_url;
            } else {
                this.audioElement.src = `assets/music/${this.currentCard.id}.mp3`;
            }
            this.audioElement.load();
            this.isPlaying = false;
            this.playPauseBtn.textContent = '▶️ Play';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SpotifyMelodyTimeline();
});
