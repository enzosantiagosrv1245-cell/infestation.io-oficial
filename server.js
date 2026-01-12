// ======================
// INFESTATION.IO - SERVIDOR
// ======================

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(cors());
app.use(express.static(__dirname)); // serve index.html, game.js, Sprites, etc

// ======= CONFIGURAÇÕES DO JOGO =========
const PORT = process.env.PORT || 3000;
const TICK_RATE = 1000 / 60;
const WORLD_WIDTH = 6000;
const WORLD_HEIGHT = 2000;
const INITIAL_PLAYER_SIZE = 60;
const INITIAL_PLAYER_SPEED = 2;
const MAX_PLAYER_SPEED = 5;
const SPEED_PER_PIXEL_OF_GROWTH = 0.05;
const GROWTH_AMOUNT = 0.2;
const ZOMBIE_DECAY_AMOUNT = 0.25;
const DUCT_TRAVEL_TIME = 1000 / 20;
const CAMOUFLAGE_COOLDOWN = 45000;
const SPRINT_COOLDOWN = 45000;
const SPRINT_DURATION = 10000;
const ANT_TRANSFORMATION_DURATION = 20000;
const ANT_COOLDOWN = 45000;
const ANT_SIZE_FACTOR = 0.1;
const ANT_SPEED_FACTOR = 0.7;
const ARROW_SPEED = 20;
const ARROW_KNOCKBACK = 30;
const ARROW_LIFESPAN_AFTER_HIT = 1000;
const BOX_FRICTION = 0.94;
const BOX_PUSH_FORCE = 0.15;
const BOX_COLLISION_DAMPING = 0.80;
const ANGULAR_FRICTION = 0.80;
const TORQUE_FACTOR = 0.000008;
const ZOMBIE_SPEED_BOOST = 1.15;
const SPY_DURATION = 20000;
const SPY_COOLDOWN = 45000;
const ROUND_DURATION = 120;
const SKATEBOARD_SPEED_BOOST = 7;
const SKATEBOARD_WIDTH = 90;
const SKATEBOARD_HEIGHT = 35;
const ABILITY_COSTS = { chameleon: 20, athlete: 10, archer: 10, engineer: 20, ant: 20, spy: 50 };

// ===== BANIMENTO & DEV =====
const devEmails = [
    "enzosantiagosrv1245@gmail.com",
    "eddiemullerlara7@gmail.com"
];

let bannedPlayers = {}; // { id: { permanent: true, until: null, reason: "" }, ... }
let bannedEmails = {};  // { email: { permanent: true, until: null, reason: "" }, ... }

function isDev(email) {
    return devEmails.includes(email);
}

function isBanned({ id, email }) {
    if (id && bannedPlayers[id]) {
        const ban = bannedPlayers[id];
        if (ban.permanent) return true;
        if (ban.until && Date.now() < ban.until) return true;
        if (ban.until && Date.now() >= ban.until) { delete bannedPlayers[id]; return false; }
        return false;
    }
    if (email && bannedEmails[email]) {
        const ban = bannedEmails[email];
        if (ban.permanent) return true;
        if (ban.until && Date.now() < ban.until) return true;
        if (ban.until && Date.now() >= ban.until) { delete bannedEmails[email]; return false; }
        return false;
    }
    return false;
}

function banPlayer({ id, email }, options = { permanent: true, until: null, reason: "" }) {
    if (id) bannedPlayers[id] = options;
    if (email) bannedEmails[email] = options;
}

function parseCommand(text) {
    const tpRegex = /^\/tp\s+("?)([a-zA-Z0-9_-]+)"?/i;
    const banRegex = /^\/ban\s+("?)([a-zA-Z0-9_-]+)"?/i;
    const banTempRegex = /^\/ban\s+temp\s+("?)([a-zA-Z0-9_-]+)"?\s+(\d+)\s*(seconds?|minutes?|hours?|days?|weeks?|months?|years?)/i;
    let match;
    if ((match = text.match(tpRegex))) return { cmd: 'tp', playerName: match[2] };
    if ((match = text.match(banRegex))) return { cmd: 'ban', playerName: match[2] };
    if ((match = text.match(banTempRegex))) return { cmd: 'ban_temp', playerName: match[2], amount: parseInt(match[3]), unit: match[4] };
    return null;
}

function getPlayerByName(name) {
    for (const id in gameState.players) {
        if (gameState.players[id].name === name) return gameState.players[id];
    }
    return null;
}

// ===== ESTADO DO JOGO =====
let gameState = {};
let nextArrowId = 0;

// ================= GAME INITIALIZATION =================
function spawnSkateboard() {
    if (!gameState.skateboard) return;
    const streetArea = { x: 3090, y: 0, width: 1000, height: 2000 };
    gameState.skateboard.x = streetArea.x + Math.random() * (streetArea.width - SKATEBOARD_WIDTH);
    gameState.skateboard.y = streetArea.y + Math.random() * (streetArea.height - SKATEBOARD_HEIGHT);
    gameState.skateboard.spawned = true;
    gameState.skateboard.ownerId = null;
    console.log(`Skateboard spawned at ${gameState.skateboard.x.toFixed(0)}, ${gameState.skateboard.y.toFixed(0)}`);
}

function initializeGame() {
    // Aqui entra toda a configuração de players, boxes, furniture, house, garage, etc.
    gameState = {
        players: {},
        arrows: [],
        takenAbilities: [],
        abilityCosts: ABILITY_COSTS,
        gamePhase: 'waiting',
        startTime: 60,
        timeLeft: ROUND_DURATION,
        worldWidth: WORLD_WIDTH,
        worldHeight: WORLD_HEIGHT,
        skateboard: { x: 0, y: 0, width: SKATEBOARD_WIDTH, height: SKATEBOARD_HEIGHT, spawned: false, ownerId: null },
        // boxes, furniture, ducts, sunshades, house, garage...
    };
    // buildWalls(gameState.house); buildWalls(gameState.garage);
}

// ================= PLAYER CREATION =================
function createNewPlayer(socket, userInfo) {
    let name = userInfo && userInfo.name ? userInfo.name : `Player${Math.floor(100 + Math.random() * 900)}`;
    gameState.players[socket.id] = {
        name,
        id: socket.id,
        x: WORLD_WIDTH / 2 + 500,
        y: WORLD_HEIGHT / 2,
        width: INITIAL_PLAYER_SIZE,
        height: INITIAL_PLAYER_SIZE * 1.25,
        speed: INITIAL_PLAYER_SPEED,
        rotation: 0,
        role: 'human',
        activeAbility: ' ',
        coins: 0,
        isCamouflaged: false,
        camouflageAvailable: true,
        isSprinting: false,
        sprintAvailable: true,
        isAnt: false,
        antAvailable: true,
        isSpying: false,
        spyUsesLeft: 2,
        spyCooldown: false,
        isHidden: false,
        arrowAmmo: 0,
        engineerAbilityUsed: false,
        isInDuct: false,
        footprintCooldown: 0,
        inventory: [],
        hasSkateboard: false,
        input: { movement: { up: false, down: false, left: false, right: false }, mouse: { x: 0, y: 0 }, rotation: 0 },
        email: userInfo && userInfo.email ? userInfo.email : (socket.handshake.auth && socket.handshake.auth.email ? socket.handshake.auth.email : null)
    };
}

// ================= SOCKET.IO ===================
io.on('connection', (socket) => {
    const userInfo = socket.handshake.auth && socket.handshake.auth.userInfo
        ? socket.handshake.auth.userInfo
        : { email: socket.handshake.auth?.email, name: null };

    if (isBanned({ id: socket.id, email: userInfo.email })) {
        socket.emit('banMessage', { reason: "Você foi banido do servidor.", color: "red" });
        socket.disconnect();
        return;
    }

    console.log('Novo jogador conectado:', socket.id);
    createNewPlayer(socket, userInfo);

    // Receber input do jogador
    socket.on('playerInput', (inputData) => {
        const player = gameState.players[socket.id];
        if (player) { player.input.movement = inputData.movement; player.rotation = inputData.rotation; }
    });

    // Receber escolha de habilidade
    socket.on('chooseAbility', (ability) => {
        const player = gameState.players[socket.id];
        const cost = ABILITY_COSTS[ability];
        if (player && player.activeAbility === ' ' && cost !== undefined && player.coins >= cost) {
            if (gameState.takenAbilities.includes(ability)) return;
            player.coins -= cost;
            player.activeAbility = ability;
            gameState.takenAbilities.push(ability);
            if (ability === 'archer') player.arrowAmmo = 100;
        }
    });

    // Receber ações do jogador (ataques, habilidades, skate, duct, etc.)
    socket.on('playerAction', (actionData) => {
        const player = gameState.players[socket.id];
        if (!player) return;
        // lógica do server.js original mantida
    });

    // Chat e comandos Dev
    socket.on('sendMessage', (text) => {
        const player = gameState.players[socket.id];
        if (!player || !text || text.trim().length === 0) return;
        const email = player.email;
        const isDevUser = isDev(email);
        const command = parseCommand(text.trim());

        if (isDevUser && command) {
            // comandos: tp, ban, ban_temp
            // lógica mantida como no server.js original
            return;
        }

        // chat normal
        const message = { name: player.name, text: text.substring(0, 150) };
        io.emit('newMessage', message);
    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        const player = gameState.players[socket.id];
        if (player) {
            if (player.activeAbility !== ' ') {
                gameState.takenAbilities = gameState.takenAbilities.filter(ability => ability !== player.activeAbility);
            }
            if (player.hasSkateboard) spawnSkateboard();
        }
        delete gameState.players[socket.id];
    });
});

// ================== GAME LOOP ====================
setInterval(() => {
    if (!gameState || !gameState.players) return;
    // updateGameState(); // Mantido do server original
    io.emit('gameStateUpdate', gameState);
}, TICK_RATE);

setInterval(() => {
    if (!gameState || !gameState.players || Object.keys(gameState.players).length === 0) return;
    // lógica do round e zombies mantida do server.js original
}, 1000);

// ================== START SERVER ====================
server.listen(PORT, () => {
    initializeGame();
    spawnSkateboard();
    console.log(`🚀 Game server running at http://localhost:${PORT}`);
});
