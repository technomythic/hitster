class HotSeatMelodyTimeline extends MelodyTimeline {
    constructor() {
        super();
        this.players = [];
        this.currentPlayerIndex = 0;
        this.roundNumber = 1;
        this.setupHotSeat();
    }
    
    setupHotSeat() {
        const setupScreen = document.getElementById('setup-screen');
        const gameScreen = document.getElementById('game-screen');
        const playerCountBtns = document.querySelectorAll('.player-count-btn');
        const startGameBtn = document.getElementById('start-game-btn');
        const playerNamesContainer = document.getElementById('player-names-container');
        const playerInputs = document.getElementById('player-inputs');
        
        playerCountBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                playerCountBtns.forEach(b => b.classList.remove('bg-purple-600'));
                btn.classList.add('bg-purple-600');
                
                const count = parseInt(btn.dataset.count);
                this.createPlayerInputs(count);
                playerNamesContainer.classList.remove('hidden');
                startGameBtn.classList.remove('hidden');
            });
        });
        
        startGameBtn.addEventListener('click', () => {
            const inputs = playerInputs.querySelectorAll('input');
            this.players = Array.from(inputs).map((input, index) => ({
                name: input.value.trim() || `Player ${index + 1}`,
                score: 0,
                cardsPlaced: 0
            }));
            
            setupScreen.classList.add('hidden');
            gameScreen.classList.remove('hidden');
            
            this.initializeGame();
        });
        
        document.getElementById('end-turn-btn').addEventListener('click', () => this.endTurn());
        document.getElementById('play-again-btn').addEventListener('click', () => this.playAgain());
    }
    
    createPlayerInputs(count) {
        const container = document.getElementById('player-inputs');
        container.innerHTML = '';
        
        for (let i = 0; i < count; i++) {
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = `Player ${i + 1} Name`;
            input.className = 'w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white';
            container.appendChild(input);
        }
    }
    
    initializeGame() {
        this.renderPlayerIndicators();
        this.updateCurrentPlayerDisplay();
        this.startGame();
    }
    
    renderPlayerIndicators() {
        const container = document.getElementById('player-indicators');
        container.innerHTML = '';
        
        this.players.forEach((player, index) => {
            const indicator = document.createElement('div');
            indicator.className = `player-indicator px-4 py-2 rounded-lg bg-white/10 border-2 ${
                index === this.currentPlayerIndex ? 'player-active border-yellow-400' : 'border-white/20'
            }`;
            indicator.id = `player-indicator-${index}`;
            
            const name = document.createElement('div');
            name.className = 'font-bold';
            name.textContent = player.name;
            
            const score = document.createElement('div');
            score.className = 'text-sm text-purple-300';
            score.textContent = `Score: ${player.score}`;
            score.id = `player-score-${index}`;
            
            indicator.appendChild(name);
            indicator.appendChild(score);
            container.appendChild(indicator);
        });
    }
    
    updateCurrentPlayerDisplay() {
        const currentPlayer = this.players[this.currentPlayerIndex];
        document.getElementById('current-player-name').textContent = currentPlayer.name;
        
        this.players.forEach((_, index) => {
            const indicator = document.getElementById(`player-indicator-${index}`);
            if (index === this.currentPlayerIndex) {
                indicator.classList.add('player-active', 'border-yellow-400');
                indicator.classList.remove('border-white/20');
            } else {
                indicator.classList.remove('player-active', 'border-yellow-400');
                indicator.classList.add('border-white/20');
            }
        });
    }
    
    endTurn() {
        this.yearsRevealed = false;
        
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        
        if (this.currentPlayerIndex === 0) {
            this.roundNumber++;
            document.getElementById('round-number').textContent = this.roundNumber;
        }
        
        this.updateCurrentPlayerDisplay();
        
        if (this.deck.length > 0) {
            this.drawNextCard();
            this.showMessage(`${this.players[this.currentPlayerIndex].name}'s turn!`, 'info');
        } else {
            this.endGame();
        }
    }
    
    placeCard(position) {
        if (!this.currentCard) return;
        
        if (position === 'before') {
            this.timeline.unshift(this.currentCard);
        } else {
            this.timeline.push(this.currentCard);
        }
        
        const currentPlayer = this.players[this.currentPlayerIndex];
        currentPlayer.cardsPlaced++;
        
        let isCorrect = true;
        for (let i = 0; i < this.timeline.length - 1; i++) {
            if (this.timeline[i].year > this.timeline[i + 1].year) {
                isCorrect = false;
                break;
            }
        }
        
        if (isCorrect) {
            currentPlayer.score += 10;
            this.showMessage('✅ Correct placement! +10 points', 'success');
        } else {
            this.showMessage('❌ Incorrect order!', 'error');
        }
        
        this.renderTimeline();
        this.updatePlayerScore(this.currentPlayerIndex);
        
        document.getElementById('cards-placed').textContent = this.timeline.length;
        
        this.placementControls.classList.add('hidden');
    }
    
    updatePlayerScore(playerIndex) {
        const scoreElement = document.getElementById(`player-score-${playerIndex}`);
        if (scoreElement) {
            scoreElement.textContent = `Score: ${this.players[playerIndex].score}`;
        }
    }
    
    drawNextCard() {
        if (this.deck.length === 0) {
            this.endGame();
            return;
        }
        
        super.drawNextCard();
    }
    
    endGame() {
        document.getElementById('game-screen').classList.add('hidden');
        document.getElementById('gameover-screen').classList.remove('hidden');
        
        const sortedPlayers = [...this.players].sort((a, b) => b.score - a.score);
        
        const finalScores = document.getElementById('final-scores');
        finalScores.innerHTML = '<h3 class="text-3xl font-bold mb-6">Final Scores</h3>';
        
        sortedPlayers.forEach((player, index) => {
            const position = index + 1;
            let medal = '';
            if (position === 1) medal = '🥇';
            else if (position === 2) medal = '🥈';
            else if (position === 3) medal = '🥉';
            
            const playerDiv = document.createElement('div');
            playerDiv.className = `bg-white/10 rounded-xl p-4 mb-3 flex justify-between items-center ${
                position === 1 ? 'border-2 border-yellow-400' : ''
            }`;
            
            playerDiv.innerHTML = `
                <div class="flex items-center gap-3">
                    <span class="text-3xl">${medal}</span>
                    <div>
                        <div class="font-bold text-xl">${player.name}</div>
                        <div class="text-sm text-purple-300">${player.cardsPlaced} cards placed</div>
                    </div>
                </div>
                <div class="text-3xl font-bold text-yellow-400">${player.score}</div>
            `;
            
            finalScores.appendChild(playerDiv);
        });
    }
    
    playAgain() {
        window.location.reload();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new HotSeatMelodyTimeline();
});
