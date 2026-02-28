class MultiplayerMelodyTimeline {
    constructor() {
        this.client = new MultiplayerClient();
        this.gameData = [];
        this.deck = [];
        this.timeline = [];
        this.currentCard = null;
        this.teams = [];
        this.currentTeamIndex = 0;
        this.yearsRevealed = false;
        this.isPlaying = false;
        this.spotifyMode = false;
        this.spotifyAuth = null;
        
        this.initializeUI();
        this.setupEventListeners();
        this.loadPlayerName();
    }
    
    initializeUI() {
        this.lobbyScreen = document.getElementById('lobby-screen');
        this.gameScreen = document.getElementById('game-screen');
        this.nameSetup = document.getElementById('name-setup');
        this.modeSelection = document.getElementById('mode-selection');
        this.roomLobby = document.getElementById('room-lobby');
        
        this.playerNameInput = document.getElementById('player-name-input');
        this.roomCodeInput = document.getElementById('room-code-input');
        this.displayRoomCode = document.getElementById('display-room-code');
        this.playersList = document.getElementById('players-list');
        this.playerCount = document.getElementById('player-count');
        this.teamScores = document.getElementById('team-scores');
        this.currentTurnDisplay = document.getElementById('current-turn');
        
        this.audioElement = document.getElementById('audio-element');
        this.playPauseBtn = document.getElementById('play-pause-btn');
        this.progressBar = document.getElementById('progress-bar');
        this.timeDisplay = document.getElementById('time-display');
        this.currentCardContainer = document.getElementById('current-card');
        this.timelineContainer = document.getElementById('timeline');
        this.placementControls = document.getElementById('placement-controls');
        
        this.messageContainer = document.getElementById('message-container');
    }
    
    setupEventListeners() {
        document.getElementById('save-name-btn').addEventListener('click', () => this.saveName());
        document.getElementById('host-btn').addEventListener('click', () => this.hostGame());
        document.getElementById('join-btn').addEventListener('click', () => this.joinGame());
        document.getElementById('solo-mode-btn').addEventListener('click', () => this.goToSoloMode());
        document.getElementById('copy-code-btn').addEventListener('click', () => this.copyRoomCode());
        document.getElementById('leave-room-btn').addEventListener('click', () => this.leaveRoom());
        document.getElementById('start-game-btn').addEventListener('click', () => this.startGame());
        document.getElementById('team-count-select').addEventListener('change', (e) => this.updateTeamCount(e.target.value));
        
        document.getElementById('place-before-btn').addEventListener('click', () => this.placeCard('before'));
        document.getElementById('place-after-btn').addEventListener('click', () => this.placeCard('after'));
        document.getElementById('play-pause-btn').addEventListener('click', () => this.togglePlayPause());
        
        document.getElementById('mobile-reveal-btn').addEventListener('click', () => this.revealYears());
        document.getElementById('mobile-check-btn').addEventListener('click', () => this.checkOrder());
        
        this.audioElement.addEventListener('timeupdate', () => this.updateProgress());
        this.audioElement.addEventListener('ended', () => this.onAudioEnded());
        
        this.roomCodeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });
        
        this.setupMultiplayerCallbacks();
    }
    
    setupMultiplayerCallbacks() {
        this.client.onRoomCreated = (data) => this.handleRoomCreated(data);
        this.client.onRoomJoined = (data) => this.handleRoomJoined(data);
        this.client.onPlayerJoined = (player) => this.handlePlayerJoined(player);
        this.client.onPlayerLeft = (playerId) => this.handlePlayerLeft(playerId);
        this.client.onTeamsUpdated = (data) => this.handleTeamsUpdated(data);
        this.client.onGameStarted = (gameState) => this.handleGameStarted(gameState);
        this.client.onGameAction = (data) => this.handleGameAction(data);
        this.client.onError = (message) => this.showMessage(message, 'error');
    }
    
    loadPlayerName() {
        const savedName = localStorage.getItem('playerName');
        if (savedName) {
            this.playerNameInput.value = savedName;
        }
    }
    
    saveName() {
        const name = this.playerNameInput.value.trim();
        if (!name) {
            this.showMessage('Please enter your name', 'error');
            return;
        }
        
        this.client.setPlayerName(name);
        this.nameSetup.classList.add('hidden');
        this.modeSelection.classList.remove('hidden');
    }
    
    async hostGame() {
        try {
            await this.client.connect();
            
            const settings = {
                teamCount: 2,
                cardsToWin: 10,
                musicSource: 'local'
            };
            
            this.client.createRoom(settings);
        } catch (error) {
            this.showMessage('Failed to connect to server. Make sure the server is running.', 'error');
        }
    }
    
    async joinGame() {
        const roomCode = this.roomCodeInput.value.trim().toUpperCase();
        if (!roomCode || roomCode.length !== 6) {
            this.showMessage('Please enter a valid 6-character room code', 'error');
            return;
        }
        
        try {
            await this.client.connect();
            this.client.joinRoom(roomCode);
        } catch (error) {
            this.showMessage('Failed to connect to server', 'error');
        }
    }
    
    handleRoomCreated(data) {
        this.modeSelection.classList.add('hidden');
        this.roomLobby.classList.remove('hidden');
        this.displayRoomCode.textContent = data.roomCode;
        
        document.getElementById('host-settings').classList.remove('hidden');
        document.getElementById('start-game-btn').classList.remove('hidden');
        
        this.updatePlayersList();
        this.updateTeamCount(2);
    }
    
    handleRoomJoined(data) {
        this.modeSelection.classList.add('hidden');
        this.roomLobby.classList.remove('hidden');
        this.displayRoomCode.textContent = data.roomCode;
        
        if (data.isHost) {
            document.getElementById('host-settings').classList.remove('hidden');
            document.getElementById('start-game-btn').classList.remove('hidden');
        }
        
        this.updatePlayersList();
        if (data.teams.length > 0) {
            this.renderTeamAssignment(data.teams);
        }
    }
    
    handlePlayerJoined(player) {
        this.updatePlayersList();
        this.showMessage(`${player.name} joined the room`, 'info');
    }
    
    handlePlayerLeft(playerId) {
        this.updatePlayersList();
        this.showMessage('A player left the room', 'info');
    }
    
    handleTeamsUpdated(data) {
        this.teams = data.teams;
        this.renderTeamAssignment(data.teams);
    }
    
    handleGameStarted(gameState) {
        this.gameData = gameState.songs;
        this.deck = [...gameState.deck];
        this.teams = gameState.teams;
        this.currentTeamIndex = 0;
        
        this.lobbyScreen.classList.add('hidden');
        this.gameScreen.classList.remove('hidden');
        
        this.drawNextCard();
        this.renderTeamScores();
        this.updateCurrentTurn();
    }
    
    handleGameAction(data) {
        switch(data.action) {
            case 'place_card':
                this.syncPlaceCard(data.data);
                break;
            case 'reveal_years':
                this.yearsRevealed = true;
                this.renderCurrentCard();
                this.renderTimeline();
                break;
            case 'next_turn':
                this.currentTeamIndex = data.data.teamIndex;
                this.updateCurrentTurn();
                break;
        }
    }
    
    updatePlayersList() {
        this.playersList.innerHTML = '';
        this.playerCount.textContent = this.client.players.length;
        
        this.client.players.forEach(player => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'flex items-center justify-between bg-white/5 rounded-lg p-3';
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = player.name;
            
            const teamBadge = document.createElement('span');
            if (player.team !== null && player.team !== undefined) {
                teamBadge.className = 'team-badge';
                teamBadge.style.backgroundColor = this.getTeamColor(player.team);
                teamBadge.textContent = `Team ${player.team + 1}`;
            }
            
            playerDiv.appendChild(nameSpan);
            playerDiv.appendChild(teamBadge);
            this.playersList.appendChild(playerDiv);
        });
    }
    
    updateTeamCount(count) {
        count = parseInt(count);
        
        if (count === 0) {
            document.getElementById('team-assignment').classList.add('hidden');
            this.teams = [];
            return;
        }
        
        document.getElementById('team-assignment').classList.remove('hidden');
        
        this.teams = [];
        for (let i = 0; i < count; i++) {
            this.teams.push({
                id: i,
                name: `Team ${i + 1}`,
                score: 0,
                color: this.getTeamColor(i)
            });
        }
        
        this.renderTeamAssignment(this.teams);
    }
    
    renderTeamAssignment(teams) {
        const container = document.getElementById('team-containers');
        container.innerHTML = '';
        container.className = `grid gap-4 grid-cols-${Math.min(teams.length, 2)}`;
        
        teams.forEach((team, index) => {
            const teamDiv = document.createElement('div');
            teamDiv.className = 'bg-white/5 rounded-lg p-4';
            teamDiv.style.borderLeft = `4px solid ${team.color}`;
            
            const title = document.createElement('h4');
            title.className = 'font-bold mb-2';
            title.textContent = team.name;
            
            const playerList = document.createElement('div');
            playerList.className = 'space-y-1 text-sm';
            
            const teamPlayers = this.client.players.filter(p => p.team === index);
            teamPlayers.forEach(player => {
                const playerSpan = document.createElement('div');
                playerSpan.textContent = player.name;
                playerList.appendChild(playerSpan);
            });
            
            if (this.client.isHost) {
                const assignBtn = document.createElement('button');
                assignBtn.className = 'mt-2 w-full bg-white/10 hover:bg-white/20 py-1 px-2 rounded text-xs';
                assignBtn.textContent = 'Auto-Assign Players';
                assignBtn.addEventListener('click', () => this.autoAssignTeams());
                teamDiv.appendChild(assignBtn);
            }
            
            teamDiv.appendChild(title);
            teamDiv.appendChild(playerList);
            container.appendChild(teamDiv);
        });
    }
    
    autoAssignTeams() {
        const playerTeams = [];
        this.client.players.forEach((player, index) => {
            const teamIndex = index % this.teams.length;
            playerTeams.push({ playerId: player.id, team: teamIndex });
        });
        
        this.client.updateTeams(this.teams, playerTeams);
    }
    
    getTeamColor(index) {
        const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
        return colors[index % colors.length];
    }
    
    copyRoomCode() {
        navigator.clipboard.writeText(this.client.roomCode);
        this.showMessage('Room code copied!', 'success');
    }
    
    leaveRoom() {
        this.client.leaveRoom();
        this.roomLobby.classList.add('hidden');
        this.modeSelection.classList.remove('hidden');
    }
    
    async startGame() {
        await this.loadGameData();
        
        const deck = this.shuffleArray([...Array(this.gameData.length).keys()]);
        
        const gameState = {
            songs: this.gameData,
            deck: deck,
            teams: this.teams
        };
        
        this.client.startGame(gameState);
    }
    
    async loadGameData() {
        try {
            const response = await fetch('assets/game_data.json');
            this.gameData = await response.json();
        } catch (error) {
            this.gameData = [
                { id: 'demo_1', title: 'Demo Song 1', artist: 'Artist 1', year: 1980 },
                { id: 'demo_2', title: 'Demo Song 2', artist: 'Artist 2', year: 1990 },
                { id: 'demo_3', title: 'Demo Song 3', artist: 'Artist 3', year: 2000 }
            ];
        }
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
        if (this.deck.length === 0) {
            this.showMessage('🎉 Game Over!', 'success');
            return;
        }
        
        const cardIndex = this.deck.pop();
        this.currentCard = this.gameData[cardIndex];
        this.yearsRevealed = false;
        this.renderCurrentCard();
        this.loadAudio();
        
        if (this.timeline.length > 0) {
            this.placementControls.classList.remove('hidden');
        }
    }
    
    renderCurrentCard() {
        this.currentCardContainer.innerHTML = '';
        const cardElement = this.createCardElement(this.currentCard, 'mystery', true);
        this.currentCardContainer.appendChild(cardElement);
    }
    
    renderTimeline() {
        this.timelineContainer.innerHTML = '';
        
        if (this.timeline.length === 0) {
            this.timelineContainer.innerHTML = '<div class="text-gray-400 text-xl">Timeline will appear here...</div>';
            return;
        }
        
        this.timeline.forEach((card) => {
            const cardElement = this.createCardElement(card, '', false);
            this.timelineContainer.appendChild(cardElement);
        });
    }
    
    createCardElement(card, className = '', hideYear = false) {
        const cardDiv = document.createElement('div');
        cardDiv.className = `card ${className}`;
        
        const img = document.createElement('img');
        img.src = `assets/images/${card.id}_thumb.jpg`;
        img.alt = 'Album Cover';
        img.onerror = () => {
            img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="180"%3E%3Crect fill="%23333" width="200" height="180"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%23fff" font-family="Arial" font-size="16"%3ENo Image%3C/text%3E%3C/svg%3E';
        };
        
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
    
    placeCard(position) {
        if (!this.currentCard) return;
        
        if (position === 'before') {
            this.timeline.unshift(this.currentCard);
        } else {
            this.timeline.push(this.currentCard);
        }
        
        this.client.sendGameAction('place_card', { position, card: this.currentCard });
        
        this.renderTimeline();
        this.drawNextCard();
        this.nextTurn();
    }
    
    syncPlaceCard(data) {
        if (data.position === 'before') {
            this.timeline.unshift(data.card);
        } else {
            this.timeline.push(data.card);
        }
        this.renderTimeline();
    }
    
    revealYears() {
        this.yearsRevealed = true;
        this.renderCurrentCard();
        this.renderTimeline();
        this.client.sendGameAction('reveal_years', {});
        this.showMessage('Song information revealed!', 'info');
    }
    
    checkOrder() {
        if (this.timeline.length < 2) {
            this.showMessage('Place at least 2 cards before checking order!', 'info');
            return;
        }
        
        let isCorrect = true;
        for (let i = 0; i < this.timeline.length - 1; i++) {
            if (this.timeline[i].year > this.timeline[i + 1].year) {
                isCorrect = false;
                break;
            }
        }
        
        if (isCorrect) {
            const currentTeam = this.teams[this.currentTeamIndex];
            currentTeam.score += this.timeline.length * 10;
            this.renderTeamScores();
            this.showMessage('✅ Perfect! Your timeline is correct!', 'success');
        } else {
            this.showMessage('❌ Oops! The timeline is not in correct order.', 'error');
        }
    }
    
    nextTurn() {
        this.currentTeamIndex = (this.currentTeamIndex + 1) % this.teams.length;
        this.updateCurrentTurn();
        this.client.sendGameAction('next_turn', { teamIndex: this.currentTeamIndex });
    }
    
    updateCurrentTurn() {
        if (this.teams.length > 0) {
            this.currentTurnDisplay.textContent = this.teams[this.currentTeamIndex].name;
        }
    }
    
    renderTeamScores() {
        this.teamScores.innerHTML = '';
        
        if (this.teams.length === 0) return;
        
        this.teamScores.className = `grid gap-4 grid-cols-${Math.min(this.teams.length, 4)}`;
        
        this.teams.forEach(team => {
            const teamDiv = document.createElement('div');
            teamDiv.className = 'text-center p-4 rounded-lg';
            teamDiv.style.backgroundColor = team.color + '33';
            teamDiv.style.borderLeft = `4px solid ${team.color}`;
            
            const name = document.createElement('div');
            name.className = 'font-bold mb-1';
            name.textContent = team.name;
            
            const score = document.createElement('div');
            score.className = 'text-2xl font-bold';
            score.textContent = team.score;
            
            teamDiv.appendChild(name);
            teamDiv.appendChild(score);
            this.teamScores.appendChild(teamDiv);
        });
    }
    
    loadAudio() {
        if (this.currentCard) {
            this.audioElement.src = `assets/music/${this.currentCard.id}.mp3`;
            this.audioElement.load();
            this.isPlaying = false;
            this.playPauseBtn.textContent = '▶️ Play';
        }
    }
    
    togglePlayPause() {
        if (this.isPlaying) {
            this.audioElement.pause();
            this.isPlaying = false;
            this.playPauseBtn.textContent = '▶️ Play';
        } else {
            this.audioElement.play();
            this.isPlaying = true;
            this.playPauseBtn.textContent = '⏸️ Pause';
        }
    }
    
    updateProgress() {
        const progress = (this.audioElement.currentTime / this.audioElement.duration) * 100;
        this.progressBar.style.width = `${progress}%`;
        
        const currentTime = this.formatTime(this.audioElement.currentTime);
        const duration = this.formatTime(this.audioElement.duration);
        this.timeDisplay.textContent = `${currentTime} / ${duration}`;
    }
    
    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    onAudioEnded() {
        this.isPlaying = false;
        this.playPauseBtn.textContent = '▶️ Play';
        this.progressBar.style.width = '0%';
    }
    
    goToSoloMode() {
        window.location.href = 'index.html';
    }
    
    showMessage(text, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = text;
        
        this.messageContainer.appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.style.opacity = '0';
            messageDiv.style.transform = 'translateX(100%)';
            setTimeout(() => messageDiv.remove(), 300);
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new MultiplayerMelodyTimeline();
});
