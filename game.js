class MelodyTimeline {
    constructor() {
        this.gameData = [];
        this.deck = [];
        this.timeline = [];
        this.currentCard = null;
        this.score = 0;
        this.yearsRevealed = false;
        this.audioElement = document.getElementById('audio-element');
        this.isPlaying = false;
        
        this.initializeElements();
        this.attachEventListeners();
    }
    
    initializeElements() {
        this.startScreen = document.getElementById('start-screen');
        this.gameScreen = document.getElementById('game-screen');
        this.startGameBtn = document.getElementById('start-game-btn');
        this.newGameBtn = document.getElementById('new-game-btn');
        this.revealBtn = document.getElementById('reveal-btn');
        this.checkOrderBtn = document.getElementById('check-order-btn');
        this.placementControls = document.getElementById('placement-controls');
        this.placeBeforeBtn = document.getElementById('place-before-btn');
        this.placeAfterBtn = document.getElementById('place-after-btn');
        this.currentCardContainer = document.getElementById('current-card');
        this.timelineContainer = document.getElementById('timeline');
        this.scoreDisplay = document.getElementById('score');
        this.cardsPlacedDisplay = document.getElementById('cards-placed');
        this.playPauseBtn = document.getElementById('play-pause-btn');
        this.progressBar = document.getElementById('progress-bar');
        this.timeDisplay = document.getElementById('time-display');
        this.messageContainer = document.getElementById('message-container');
    }
    
    attachEventListeners() {
        this.startGameBtn.addEventListener('click', () => this.startGame());
        this.newGameBtn.addEventListener('click', () => this.startGame());
        this.revealBtn.addEventListener('click', () => this.revealYears());
        this.checkOrderBtn.addEventListener('click', () => this.checkOrder());
        this.placeBeforeBtn.addEventListener('click', () => this.placeCard('before'));
        this.placeAfterBtn.addEventListener('click', () => this.placeCard('after'));
        this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        
        this.audioElement.addEventListener('timeupdate', () => this.updateProgress());
        this.audioElement.addEventListener('ended', () => this.onAudioEnded());
    }
    
    async loadGameData() {
        try {
            const response = await fetch('assets/game_data.json');
            this.gameData = await response.json();
            return true;
        } catch (error) {
            this.showMessage('Error loading game data. Please ensure assets are generated.', 'error');
            console.error('Error loading game data:', error);
            return false;
        }
    }
    
    async startGame() {
        const loaded = await this.loadGameData();
        if (!loaded) return;
        
        this.startScreen.classList.add('hidden');
        this.gameScreen.classList.remove('hidden');
        
        this.deck = this.shuffleArray([...this.gameData]);
        this.timeline = [];
        this.score = 0;
        this.yearsRevealed = false;
        
        this.updateScore();
        
        const anchorCard = this.deck.pop();
        this.timeline.push(anchorCard);
        this.renderTimeline();
        
        this.drawNextCard();
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
            this.showMessage('🎉 Congratulations! You\'ve placed all the songs!', 'success');
            this.placementControls.classList.add('hidden');
            return;
        }
        
        this.currentCard = this.deck.pop();
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
        
        this.timeline.forEach((card, index) => {
            const isAnchor = index === 0 && this.timeline.length === 1;
            const cardElement = this.createCardElement(card, isAnchor ? 'anchor' : '', false);
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
        
        this.renderTimeline();
        this.updateScore();
        this.drawNextCard();
        
        this.showMessage(`Card placed ${position} the timeline!`, 'info');
    }
    
    revealYears() {
        this.yearsRevealed = true;
        this.renderCurrentCard();
        this.renderTimeline();
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
            this.score += this.timeline.length * 10;
            this.updateScore();
            this.showMessage('✅ Perfect! Your timeline is in correct chronological order!', 'success');
        } else {
            this.showMessage('❌ Oops! The timeline is not in correct order. Keep trying!', 'error');
        }
    }
    
    updateScore() {
        this.scoreDisplay.textContent = this.score;
        this.cardsPlacedDisplay.textContent = this.timeline.length;
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
    new MelodyTimeline();
});
