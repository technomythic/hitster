class SpotifyAuth {
    constructor() {
        this.clientId = localStorage.getItem('spotify_client_id') || '';
        this.redirectUri = window.location.origin + window.location.pathname;
        this.scopes = [
            'user-read-private',
            'user-read-email',
            'playlist-read-private',
            'playlist-read-collaborative'
        ];
        this.accessToken = null;
        this.tokenExpiry = null;
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
            throw new Error('Spotify Client ID not set. Please configure in settings.');
        }

        const codeVerifier = this.generateCodeVerifier();
        localStorage.setItem('code_verifier', codeVerifier);

        const codeChallenge = await this.generateCodeChallenge(codeVerifier);

        const authUrl = new URL('https://accounts.spotify.com/authorize');
        authUrl.searchParams.append('client_id', this.clientId);
        authUrl.searchParams.append('response_type', 'code');
        authUrl.searchParams.append('redirect_uri', this.redirectUri);
        authUrl.searchParams.append('scope', this.scopes.join(' '));
        authUrl.searchParams.append('code_challenge_method', 'S256');
        authUrl.searchParams.append('code_challenge', codeChallenge);

        window.location.href = authUrl.toString();
    }

    async handleCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

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
            
            if (data.access_token) {
                this.accessToken = data.access_token;
                this.tokenExpiry = Date.now() + (data.expires_in * 1000);
                
                localStorage.setItem('spotify_access_token', this.accessToken);
                localStorage.setItem('spotify_token_expiry', this.tokenExpiry.toString());
                localStorage.removeItem('code_verifier');

                window.history.replaceState({}, document.title, window.location.pathname);
                
                return true;
            }
        } catch (error) {
            console.error('Error exchanging code for token:', error);
        }

        return false;
    }

    isAuthenticated() {
        const token = localStorage.getItem('spotify_access_token');
        const expiry = localStorage.getItem('spotify_token_expiry');
        
        if (!token || !expiry) return false;
        
        if (Date.now() >= parseInt(expiry)) {
            this.logout();
            return false;
        }

        this.accessToken = token;
        this.tokenExpiry = parseInt(expiry);
        return true;
    }

    logout() {
        this.accessToken = null;
        this.tokenExpiry = null;
        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_token_expiry');
    }

    async fetchSpotifyAPI(endpoint) {
        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
            },
        });

        if (!response.ok) {
            if (response.status === 401) {
                this.logout();
                throw new Error('Session expired. Please login again.');
            }
            if (response.status === 403) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Spotify 403 Error:', errorData);
                throw new Error('Access forbidden. This playlist may be private or you need additional permissions. Try: 1) Use your own playlists, 2) Re-login to Spotify, 3) Check playlist is public');
            }
            const errorData = await response.json().catch(() => ({}));
            console.error('Spotify API Error:', response.status, errorData);
            throw new Error(`Spotify API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
        }

        return response.json();
    }

    async getUserPlaylists() {
        const data = await this.fetchSpotifyAPI('/me/playlists?limit=50&fields=items(id,name,tracks.total,images)');
        return data.items;
    }

    async getPlaylistTracks(playlistId) {
        const tracks = [];
        let url = `/playlists/${playlistId}/tracks?limit=100`;
        let retries = 0;
        const maxRetries = 3;

        while (url) {
            try {
                const data = await this.fetchSpotifyAPI(url);
                
                if (!data || !data.items) {
                    console.error('Invalid response from Spotify API:', data);
                    break;
                }
                
                tracks.push(...data.items);
                url = data.next ? data.next.replace('https://api.spotify.com/v1', '') : null;
                retries = 0;
                
            } catch (error) {
                retries++;
                console.error(`Error fetching tracks (attempt ${retries}/${maxRetries}):`, error);
                
                if (retries >= maxRetries) {
                    throw new Error(`Failed to load playlist after ${maxRetries} attempts: ${error.message}`);
                }
                
                await new Promise(resolve => setTimeout(resolve, 1000 * retries));
            }
        }

        return tracks;
    }

    async getUserProfile() {
        return await this.fetchSpotifyAPI('/me');
    }
}

window.SpotifyAuth = SpotifyAuth;
