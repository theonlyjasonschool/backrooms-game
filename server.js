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

io.on('connection', (socket) => {
    console.log(`User mapped into matrix zone: ${socket.id}`);
    
    // De basisregistratie wacht nu tot de client 'joinGame' triggert met een nickname
    socket.on('joinGame', (data) => {
        players[socket.id] = {
            pos: { x: 3, y: 0, z: 3 },
            rotY: 0,
            color: hexColors[Math.floor(Math.random() * hexColors.length)],
            flashlightOn: false,
            nickname: data.nickname || "Unregistered"
        };

        // Synchroniseer de nieuwe speler naar iedereen en vice versa
        socket.emit('currentPlayers', players);
        socket.broadcast.emit('newPlayer', { id: socket.id, info: players[socket.id] });
        io.emit('updatePlayerList', players);
    });

    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].pos = movementData.pos;
            players[socket.id].rotY = movementData.rotY;
            players[socket.id].flashlightOn = movementData.flashlightOn;
            
            // Stuur de update inclusief nickname door voor de Command Centre kaart
            socket.broadcast.emit('playerMoved', { 
                id: socket.id, 
                nickname: players[socket.id].nickname,
                ...movementData 
            });
        }
    });

    socket.on('webrtc-signal', (data) => {
        if (players[data.to]) {
            io.to(data.to).emit('webrtc-signal', {
                from: socket.id,
                signal: data.signal
            });
        }
    });

    // Admin Events
    socket.on('admin-toggle-alarm', (state) => { io.emit('sync-alarm', state); });
    socket.on('admin-toggle-blackout', (state) => { io.emit('sync-blackout', state); });
    socket.on('admin-trigger-flicker', () => { io.emit('sync-flicker'); });

    socket.on('disconnect', () => {
        console.log(`User decoupled from matrix zone: ${socket.id}`);
        delete players[socket.id];
        io.emit('userDisconnected', socket.id);
        io.emit('updatePlayerList', players);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`Backrooms signaling matrix active on port ${PORT}`);
});
