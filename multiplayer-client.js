class MultiplayerClient {
    constructor() {
        this.ws = null;
        this.roomCode = null;
        this.playerId = this.generatePlayerId();
        this.playerName = localStorage.getItem('playerName') || 'Player';
        this.isHost = false;
        this.players = [];
        this.teams = [];
        this.onRoomCreated = null;
        this.onRoomJoined = null;
        this.onPlayerJoined = null;
        this.onPlayerLeft = null;
        this.onTeamsUpdated = null;
        this.onGameStarted = null;
        this.onGameAction = null;
        this.onError = null;
        this.serverUrl = 'ws://localhost:3001';
    }
    
    generatePlayerId() {
        return 'player_' + Math.random().toString(36).substring(2, 15);
    }
    
    connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.serverUrl);
            
            this.ws.onopen = () => {
                console.log('Connected to multiplayer server');
                resolve();
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                reject(error);
            };
            
            this.ws.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data));
            };
            
            this.ws.onclose = () => {
                console.log('Disconnected from server');
            };
        });
    }
    
    handleMessage(data) {
        switch(data.type) {
            case 'room_created':
                this.roomCode = data.roomCode;
                this.isHost = true;
                if (this.onRoomCreated) this.onRoomCreated(data);
                break;
            case 'room_joined':
                this.roomCode = data.roomCode;
                this.isHost = data.isHost;
                this.players = data.players;
                this.teams = data.teams;
                if (this.onRoomJoined) this.onRoomJoined(data);
                break;
            case 'player_joined':
                this.players.push(data.player);
                if (this.onPlayerJoined) this.onPlayerJoined(data.player);
                break;
            case 'player_left':
                this.players = this.players.filter(p => p.id !== data.playerId);
                if (this.onPlayerLeft) this.onPlayerLeft(data.playerId);
                break;
            case 'teams_updated':
                this.teams = data.teams;
                data.playerTeams.forEach(pt => {
                    const player = this.players.find(p => p.id === pt.playerId);
                    if (player) player.team = pt.team;
                });
                if (this.onTeamsUpdated) this.onTeamsUpdated(data);
                break;
            case 'game_started':
                if (this.onGameStarted) this.onGameStarted(data.gameState);
                break;
            case 'game_action':
                if (this.onGameAction) this.onGameAction(data);
                break;
            case 'host_transferred':
                this.isHost = true;
                break;
            case 'error':
                console.error('Server error:', data.message);
                if (this.onError) this.onError(data.message);
                break;
        }
    }
    
    createRoom(settings) {
        this.send({
            type: 'create_room',
            playerId: this.playerId,
            playerName: this.playerName,
            settings: settings
        });
    }
    
    joinRoom(roomCode) {
        this.send({
            type: 'join_room',
            roomCode: roomCode,
            playerId: this.playerId,
            playerName: this.playerName
        });
    }
    
    leaveRoom() {
        this.send({
            type: 'leave_room'
        });
    }
    
    updateTeams(teams, playerTeams) {
        this.send({
            type: 'update_teams',
            teams: teams,
            playerTeams: playerTeams
        });
    }
    
    startGame(gameState) {
        this.send({
            type: 'start_game',
            gameState: gameState
        });
    }
    
    sendGameAction(action, data) {
        this.send({
            type: 'game_action',
            action: action,
            data: data
        });
    }
    
    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }
    
    setPlayerName(name) {
        this.playerName = name;
        localStorage.setItem('playerName', name);
    }
}

window.MultiplayerClient = MultiplayerClient;
