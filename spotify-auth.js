class SpotifyAuth {
    constructor() {
        this.clientId = localStorage.getItem('spotify_client_id') || '';
        this.redirectUri = window.location.origin + window.location.pathname;
        this.scopes = 'user-read-private user-read-email playlist-read-private playlist-read-collaborative user-modify-playback-state user-read-playback-state user-read-currently-playing';
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
        this.userMarket = null;
        this._loadTokens();
    }

    _loadTokens() {
        this.accessToken = localStorage.getItem('spotify_access_token');
        this.refreshToken = localStorage.getItem('spotify_refresh_token');
        const expiry = localStorage.getItem('spotify_token_expiry');
        this.tokenExpiry = expiry ? parseInt(expiry) : null;
    }

    _saveTokens(accessToken, refreshToken, expiresIn) {
        this.accessToken = accessToken;
        if (refreshToken) {
            this.refreshToken = refreshToken;
            localStorage.setItem('spotify_refresh_token', refreshToken);
        }
        this.tokenExpiry = Date.now() + (expiresIn * 1000);
        localStorage.setItem('spotify_access_token', accessToken);
        localStorage.setItem('spotify_token_expiry', this.tokenExpiry.toString());
    }

    setClientId(clientId) {
        this.clientId = clientId;
        localStorage.setItem('spotify_client_id', clientId);
    }

    getClientId() {
        if (!this.clientId) {
            this.clientId = localStorage.getItem('spotify_client_id') || '';
        }
        return this.clientId;
    }

    generateCodeVerifier() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return btoa(String.fromCharCode.apply(null, array))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    async generateCodeChallenge(verifier) {
        const encoder = new TextEncoder();
        const data = encoder.encode(verifier);
        const digest = await crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode.apply(null, new Uint8Array(digest)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    async login() {
        if (!this.getClientId()) {
            throw new Error('Spotify Client ID not set. Please enter it above.');
        }

        const codeVerifier = this.generateCodeVerifier();
        localStorage.setItem('code_verifier', codeVerifier);

        const codeChallenge = await this.generateCodeChallenge(codeVerifier);

        const authUrl = new URL('https://accounts.spotify.com/authorize');
        authUrl.searchParams.append('client_id', this.clientId);
        authUrl.searchParams.append('response_type', 'code');
        authUrl.searchParams.append('redirect_uri', this.redirectUri);
        authUrl.searchParams.append('scope', this.scopes);
        authUrl.searchParams.append('code_challenge_method', 'S256');
        authUrl.searchParams.append('code_challenge', codeChallenge);

        window.location.href = authUrl.toString();
    }

    async handleCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');

        if (error) {
            console.error('Spotify auth error:', error);
            return false;
        }

        if (!code) return false;

        const codeVerifier = localStorage.getItem('code_verifier');
        if (!codeVerifier) {
            console.error('Code verifier not found');
            return false;
        }

        try {
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_id: this.getClientId(),
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: this.redirectUri,
                    code_verifier: codeVerifier,
                }),
            });

            const data = await response.json();

            if (data.error) {
                console.error('Token exchange error:', data);
                return false;
            }

            if (data.access_token) {
                this._saveTokens(data.access_token, data.refresh_token, data.expires_in);
                localStorage.removeItem('code_verifier');
                window.history.replaceState({}, document.title, window.location.pathname);
                return true;
            }
        } catch (error) {
            console.error('Error exchanging code for token:', error);
        }

        return false;
    }

    async refreshAccessToken() {
        if (!this.refreshToken || !this.getClientId()) {
            return false;
        }

        try {
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_id: this.getClientId(),
                    grant_type: 'refresh_token',
                    refresh_token: this.refreshToken,
                }),
            });

            const data = await response.json();

            if (data.error) {
                console.error('Token refresh error:', data);
                this.logout();
                return false;
            }

            if (data.access_token) {
                this._saveTokens(data.access_token, data.refresh_token, data.expires_in);
                return true;
            }
        } catch (error) {
            console.error('Error refreshing token:', error);
        }

        this.logout();
        return false;
    }

    isAuthenticated() {
        if (!this.accessToken) return false;
        if (this.tokenExpiry && Date.now() >= this.tokenExpiry) {
            return !!this.refreshToken;
        }
        return true;
    }

    async ensureAuthenticated() {
        if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return true;
        }
        if (this.refreshToken) {
            return await this.refreshAccessToken();
        }
        return false;
    }

    logout() {
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
        this.userMarket = null;
        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_refresh_token');
        localStorage.removeItem('spotify_token_expiry');
    }

    async fetchSpotifyAPI(endpoint) {
        if (!await this.ensureAuthenticated()) {
            throw new Error('Not authenticated. Please connect to Spotify.');
        }

        let response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
            headers: { 'Authorization': `Bearer ${this.accessToken}` },
        });

        if (response.status === 401) {
            const refreshed = await this.refreshAccessToken();
            if (refreshed) {
                response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
                    headers: { 'Authorization': `Bearer ${this.accessToken}` },
                });
            } else {
                this.logout();
                throw new Error('Session expired. Please connect to Spotify again.');
            }
        }

        if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('Retry-After') || '3');
            console.warn(`Rate limited by Spotify. Retrying in ${retryAfter}s...`);
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            return this.fetchSpotifyAPI(endpoint);
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.error?.message || `HTTP ${response.status}`;
            console.error('Spotify API Error:', response.status, errorData);

            if (response.status === 403) {
                throw new Error(
                    `Access denied: ${errorMsg}. ` +
                    'Go to developer.spotify.com/dashboard → your app → Settings → User Management → ' +
                    'add your Spotify email, then log out and back in here.'
                );
            }

            throw new Error(`Spotify error (${response.status}): ${errorMsg}`);
        }

        return response.json();
    }

    async getUserPlaylists() {
        const data = await this.fetchSpotifyAPI('/me/playlists?limit=50');
        return data.items || [];
    }

    async getPlaylistTracks(playlistId) {
        const market = await this._getMarket();
        const marketParam = market ? `&market=${market}` : '';

        const tracks = [];
        let url = `/playlists/${playlistId}/tracks?limit=100${marketParam}`;

        while (url) {
            const data = await this.fetchSpotifyAPI(url);

            if (!data || !data.items) {
                console.warn('Empty response from playlist tracks API');
                break;
            }

            tracks.push(...data.items);
            url = data.next ? data.next.replace('https://api.spotify.com/v1', '') : null;
        }

        return tracks;
    }

    async _getMarket() {
        if (this.userMarket) return this.userMarket;
        try {
            const profile = await this.getUserProfile();
            this.userMarket = profile.country || 'US';
        } catch (e) {
            this.userMarket = 'US';
        }
        return this.userMarket;
    }

    async getUserProfile() {
        return await this.fetchSpotifyAPI('/me');
    }

    // ── Spotify Connect: control the real Spotify app ──

    async getDevices() {
        const data = await this.fetchSpotifyAPI('/me/player/devices');
        return data.devices || [];
    }

    async getPlaybackState() {
        try {
            if (!await this.ensureAuthenticated()) return null;
            const response = await fetch('https://api.spotify.com/v1/me/player', {
                headers: { 'Authorization': `Bearer ${this.accessToken}` },
            });
            if (response.status === 204 || response.status === 404) return null;
            if (!response.ok) return null;
            return await response.json();
        } catch (e) {
            console.warn('Could not get playback state:', e);
            return null;
        }
    }

    async playTrack(trackId, deviceId) {
        if (!await this.ensureAuthenticated()) {
            throw new Error('Not authenticated');
        }

        const url = deviceId
            ? `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`
            : 'https://api.spotify.com/v1/me/player/play';

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                uris: [`spotify:track:${trackId}`],
            }),
        });

        if (response.status === 404) {
            throw new Error('NO_DEVICE');
        }
        if (response.status === 403) {
            throw new Error('PREMIUM_REQUIRED');
        }
        if (!response.ok && response.status !== 204) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || `Playback failed (${response.status})`);
        }
        return true;
    }

    async pausePlayback() {
        if (!await this.ensureAuthenticated()) return;
        await fetch('https://api.spotify.com/v1/me/player/pause', {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${this.accessToken}` },
        });
    }

    async resumePlayback() {
        if (!await this.ensureAuthenticated()) return;
        await fetch('https://api.spotify.com/v1/me/player/play', {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${this.accessToken}` },
        });
    }

    async transferPlayback(deviceId) {
        if (!await this.ensureAuthenticated()) return;
        await fetch('https://api.spotify.com/v1/me/player', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ device_ids: [deviceId], play: false }),
        });
    }
}

window.SpotifyAuth = SpotifyAuth;
