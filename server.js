const express = require('express');
const app = express();
const http = require('http').createServer(app);
const path = require('path');
const io = require('socket.io')(http, { cors: { origin: "*" } });

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const players = {};
const hexColors = [0xdcb85c, 0xc15c5c, 0x5cc1a7, 0x8a5cc1, 0xc18a5c];
const MAX_MOVEMENT_UPDATES_PER_SECOND = 20;
const MOVEMENT_INTERVAL_MS = 1000 / MAX_MOVEMENT_UPDATES_PER_SECOND;
const WORLD_LIMIT = 1000;

function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function validateMovement(data) {
    if (!data || !data.pos || !isFiniteNumber(data.rotY)) return null;
    const { x, y, z } = data.pos;
    if (![x, y, z].every(isFiniteNumber)) return null;
    if ([x, y, z].some(value => Math.abs(value) > WORLD_LIMIT) || Math.abs(data.rotY) > Math.PI * 4) return null;
    return {
        pos: { x, y, z },
        rotY: data.rotY
    };
}

function publicPlayer(player) {
    return {
        pos: { x: player.pos.x, y: player.pos.y, z: player.pos.z },
        rotY: player.rotY,
        color: player.color,
        flashlightOn: player.flashlightOn,
        nickname: player.nickname
    };
}

io.on('connection', (socket) => {
    console.log(`User mapped into matrix zone: ${socket.id}`);
    
    socket.on('joinGame', (data) => {
        if (socket.data.joined) return;
        const nickname = typeof (data && data.nickname) === 'string'
            ? data.nickname.trim().slice(0, 14)
            : '';
        players[socket.id] = {
            pos: { x: 3, y: 0, z: 3 },
            rotY: 0,
            color: hexColors[Math.floor(Math.random() * hexColors.length)],
            flashlightOn: false,
            nickname: nickname || "Unregistered"
        };
        socket.data.joined = true;
        socket.data.lastMovementAt = 0;

        const snapshot = {};
        Object.keys(players).forEach(id => { snapshot[id] = publicPlayer(players[id]); });
        socket.emit('currentPlayers', snapshot);
        socket.broadcast.emit('newPlayer', { id: socket.id, info: publicPlayer(players[socket.id]) });
        io.emit('updatePlayerList', players);
    });

    socket.on('playerMovement', (movementData) => {
        if (!socket.data.joined || !players[socket.id]) return;
        const now = Date.now();
        if (now - socket.data.lastMovementAt < MOVEMENT_INTERVAL_MS) return;
        const movement = validateMovement(movementData);
        if (!movement) return;
        socket.data.lastMovementAt = now;
        players[socket.id].pos = movement.pos;
        players[socket.id].rotY = movement.rotY;
            
        socket.broadcast.emit('playerMoved', {
            id: socket.id,
            nickname: players[socket.id].nickname,
            color: players[socket.id].color,
            pos: movement.pos,
            rotY: movement.rotY
        });
    });

    socket.on('webrtc-signal', (data) => {
        if (socket.data.joined && data && typeof data.to === 'string' && data.signal && players[data.to]) {
            io.to(data.to).emit('webrtc-signal', {
                from: socket.id,
                signal: data.signal
            });
        }
    });

    socket.on('admin-toggle-alarm', (state) => { io.emit('sync-alarm', state); });
    socket.on('admin-toggle-blackout', (state) => { io.emit('sync-blackout', state); });
    socket.on('admin-trigger-flicker', () => { io.emit('sync-flicker'); });

    socket.on('disconnect', () => {
        console.log(`User decoupled from matrix zone: ${socket.id}`);
        if (!socket.data.joined) return;
        delete players[socket.id];
        io.emit('userDisconnected', socket.id);
        io.emit('updatePlayerList', players);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`Backrooms matrix active on port ${PORT}`);
});
