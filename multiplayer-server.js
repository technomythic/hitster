// Simple WebSocket signaling server for multiplayer
// Run with: node multiplayer-server.js

const WebSocket = require('ws');
const http = require('http');

const PORT = 3001;
const server = http.createServer();
const wss = new WebSocket.Server({ server });

const rooms = new Map();

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

wss.on('connection', (ws) => {
    console.log('New client connected');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            switch(data.type) {
                case 'create_room':
                    handleCreateRoom(ws, data);
                    break;
                case 'join_room':
                    handleJoinRoom(ws, data);
                    break;
                case 'leave_room':
                    handleLeaveRoom(ws, data);
                    break;
                case 'game_action':
                    handleGameAction(ws, data);
                    break;
                case 'update_teams':
                    handleUpdateTeams(ws, data);
                    break;
                case 'start_game':
                    handleStartGame(ws, data);
                    break;
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    });
    
    ws.on('close', () => {
        handleDisconnect(ws);
    });
});

function handleCreateRoom(ws, data) {
    const roomCode = generateRoomCode();
    const room = {
        code: roomCode,
        host: ws,
        players: [{ id: data.playerId, name: data.playerName, ws: ws, team: null }],
        teams: [],
        gameState: null,
        settings: data.settings || { teamCount: 2, cardsPerTeam: 10 }
    };
    
    rooms.set(roomCode, room);
    ws.roomCode = roomCode;
    ws.playerId = data.playerId;
    
    ws.send(JSON.stringify({
        type: 'room_created',
        roomCode: roomCode,
        isHost: true
    }));
    
    console.log(`Room ${roomCode} created`);
}

function handleJoinRoom(ws, data) {
    const room = rooms.get(data.roomCode);
    
    if (!room) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Room not found'
        }));
        return;
    }
    
    if (room.players.length >= 10) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Room is full'
        }));
        return;
    }
    
    const player = {
        id: data.playerId,
        name: data.playerName,
        ws: ws,
        team: null
    };
    
    room.players.push(player);
    ws.roomCode = data.roomCode;
    ws.playerId = data.playerId;
    
    ws.send(JSON.stringify({
        type: 'room_joined',
        roomCode: data.roomCode,
        isHost: false,
        players: room.players.map(p => ({ id: p.id, name: p.name, team: p.team })),
        teams: room.teams,
        settings: room.settings
    }));
    
    broadcastToRoom(data.roomCode, {
        type: 'player_joined',
        player: { id: player.id, name: player.name, team: player.team }
    }, ws);
    
    console.log(`Player ${data.playerName} joined room ${data.roomCode}`);
}

function handleLeaveRoom(ws, data) {
    const room = rooms.get(ws.roomCode);
    if (!room) return;
    
    room.players = room.players.filter(p => p.id !== ws.playerId);
    
    if (room.players.length === 0) {
        rooms.delete(ws.roomCode);
        console.log(`Room ${ws.roomCode} deleted (empty)`);
    } else {
        if (room.host === ws && room.players.length > 0) {
            room.host = room.players[0].ws;
            room.host.send(JSON.stringify({
                type: 'host_transferred'
            }));
        }
        
        broadcastToRoom(ws.roomCode, {
            type: 'player_left',
            playerId: ws.playerId
        });
    }
}

function handleDisconnect(ws) {
    if (ws.roomCode) {
        handleLeaveRoom(ws, {});
    }
}

function handleGameAction(ws, data) {
    broadcastToRoom(ws.roomCode, {
        type: 'game_action',
        action: data.action,
        playerId: ws.playerId,
        data: data.data
    }, ws);
}

function handleUpdateTeams(ws, data) {
    const room = rooms.get(ws.roomCode);
    if (!room || room.host !== ws) return;
    
    room.teams = data.teams;
    
    data.playerTeams.forEach(pt => {
        const player = room.players.find(p => p.id === pt.playerId);
        if (player) {
            player.team = pt.team;
        }
    });
    
    broadcastToRoom(ws.roomCode, {
        type: 'teams_updated',
        teams: room.teams,
        playerTeams: data.playerTeams
    });
}

function handleStartGame(ws, data) {
    const room = rooms.get(ws.roomCode);
    if (!room || room.host !== ws) return;
    
    room.gameState = data.gameState;
    
    broadcastToRoom(ws.roomCode, {
        type: 'game_started',
        gameState: data.gameState
    });
}

function broadcastToRoom(roomCode, message, excludeWs = null) {
    const room = rooms.get(roomCode);
    if (!room) return;
    
    const messageStr = JSON.stringify(message);
    
    room.players.forEach(player => {
        if (player.ws !== excludeWs && player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(messageStr);
        }
    });
}

server.listen(PORT, () => {
    console.log(`Multiplayer server running on port ${PORT}`);
});
