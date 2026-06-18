const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });

const players = {};
const hexColors = [0xdcb85c, 0xc15c5c, 0x5cc1a7, 0x8a5cc1, 0xc18a5c];

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    
    players[socket.id] = {
        pos: { x: 3, y: 0, z: 3 },
        rotY: 0,
        color: hexColors[Math.floor(Math.random() * hexColors.length)],
        flashlightOn: false
    };

    socket.emit('currentPlayers', players);
    socket.broadcast.emit('newPlayer', { id: socket.id, info: players[socket.id] });

    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].pos = movementData.pos;
            players[socket.id].rotY = movementData.rotY;
            players[socket.id].flashlightOn = movementData.flashlightOn;
            socket.broadcast.emit('playerMoved', { id: socket.id, ...movementData });
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        delete players[socket.id];
        io.emit('userDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`Backrooms signaling matrix active on port ${PORT}`);
});