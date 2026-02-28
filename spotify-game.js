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
        
        if (spotifyBtn) {
            spotifyBtn.addEventListener('click', () => this.loginToSpotify());
        }
        
        if (loadPlaylistBtn) {
            loadPlaylistBtn.addEventListener('click', () => this.loadSelectedPlaylist());
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
            const playlistSelect = document.getElementById('playlist-select');
            
            if (!playlistSelect) return;
            
            playlistSelect.innerHTML = '<option value="">Select a playlist...</option>';
            
            playlists.forEach(playlist => {
                const option = document.createElement('option');
                option.value = playlist.id;
                option.textContent = `${playlist.name} (${playlist.tracks.total} tracks)`;
                playlistSelect.appendChild(option);
            });
            
        } catch (error) {
            console.error('Error loading playlists:', error);
            this.showMessage('Error loading playlists: ' + error.message, 'error');
        }
    }
    
    async loadSelectedPlaylist() {
        const playlistSelect = document.getElementById('playlist-select');
        const playlistId = playlistSelect?.value;
        
        if (!playlistId) {
            this.showMessage('Please select a playlist', 'info');
            return;
        }
        
        try {
            this.showMessage('Loading playlist tracks...', 'info');
            
            const tracks = await this.spotifyAuth.getPlaylistTracks(playlistId);
            
            this.spotifyTracks = tracks
                .filter(item => item.track && item.track.preview_url)
                .map(item => ({
                    id: item.track.id,
                    title: item.track.name,
                    artist: item.track.artists.map(a => a.name).join(', '),
                    year: new Date(item.track.album.release_date).getFullYear(),
                    preview_url: item.track.preview_url,
                    image_url: item.track.album.images[0]?.url || '',
                    album: item.track.album.name
                }));
            
            if (this.spotifyTracks.length === 0) {
                this.showMessage('No tracks with previews found in this playlist', 'error');
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
