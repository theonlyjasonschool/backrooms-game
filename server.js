const express = require('express');
const app = express();
const http = require('http').createServer(app);
const path = require('path');
const io = require('socket.io')(http, { cors: { origin: "*" } });

// Serve static assets out of the root project folder
app.use(express.static(__dirname));

// Primary route handler mapping to the 3D game client canvas
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const players = {};
// Hex color presets assigned randomly to incoming lost researchers (Minecraft shirts)
const hexColors = [0xdcb85c, 0xc15c5c, 0x5cc1a7, 0x8a5cc1, 0xc18a5c];

io.on('connection', (socket) => {
    console.log(`User mapped into matrix zone: ${socket.id}`);
    
    // Netjes afgesloten baseline object voor de speler
    players[socket.id] = {
        pos: { x: 3, y: 0, z: 3 },
        rotY: 0,
        color: hexColors[Math.floor(Math.random() * hexColors.length)],
        flashlightOn: false
    };

    // Synchronize network state configurations
    socket.emit('currentPlayers', players);
    socket.broadcast.emit('newPlayer', { id: socket.id, info: players[socket.id] });

    // Stream position state variations downstream
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].pos = movementData.pos;
            players[socket.id].rotY = movementData.rotY;
            players[socket.id].flashlightOn = movementData.flashlightOn;
            socket.broadcast.emit('playerMoved', { id: socket.id, ...movementData });
        }
    });

    // Forward WebRTC signals voor de voice chat
    socket.on('webrtc-signal', (data) => {
        if (players[data.to]) {
            io.to(data.to).emit('webrtc-signal', {
                from: socket.id,
                signal: data.signal
            });
        }
    });

    // Admin Events: Stuur knop-acties direct door naar ALLE actieve spelers
    socket.on('admin-toggle-alarm', (state) => {
        io.emit('sync-alarm', state);
    });

    socket.on('admin-toggle-blackout', (state) => {
        io.emit('sync-blackout', state);
    });

    socket.on('admin-trigger-flicker', () => {
        io.emit('sync-flicker');
    });

    socket.on('disconnect', () => {
        console.log(`User decoupled from matrix zone: ${socket.id}`);
        delete players[socket.id];
        io.emit('userDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`Backrooms signaling matrix active on port ${PORT}`);
});
