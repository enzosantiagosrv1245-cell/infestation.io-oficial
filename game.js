// ================== GAME CLIENT ==================

// --------- Login & Google Auth ---------
let myId = null;
let myName = null;
let myEmail = null;
let googleUserInfo = null;

const loginScreen = document.getElementById('loginScreen');
const nameInput = document.getElementById('nameInput');
const playBtn = document.getElementById('playBtn');
const gameCanvas = document.getElementById('gameCanvas');
const chatInput = document.getElementById('chatInput');

let socket = null;


// --------- Socket.IO Game ---------
function connectSocketWithAuth(){
    if(typeof io === 'undefined'){
        // try to load socket.io client dynamically and retry
        const s = document.createElement('script');
        s.src = '/socket.io/socket.io.js';
        s.onload = () => { connectSocketWithAuth(); };
        s.onerror = () => { alert('Falha ao carregar Socket.IO client.'); };
        document.head.appendChild(s);
        return;
    }
    socket = io({ auth: { userInfo: googleUserInfo } });

    socket.on('connect', ()=>{
        myId = socket.id;
    });

    socket.on('gameStateUpdate', (serverState)=>{
        gameState = serverState;
    });

    socket.on('newMessage', (message)=>{
        chatMessages.push(message);
        if(chatMessages.length > MAX_MESSAGES) chatMessages.shift();
    });

    socket.on('banMessage', (data)=>{
        alert(data.reason);
        document.body.innerHTML = `<h1 style="color:${data.color};text-align:center;margin-top:40vh;">${data.reason}</h1>`;
    });
}

// --------- Game Vars ---------
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const movement = { up:false, down:false, left:false, right:false };
let mouse = { x:0, y:0 };
let isMenuOpen = false;
let activeMenuTab = 'items';
let isChatting = false;
let chatMessages = [];
const MAX_MESSAGES = 7;

let gameState = {
    players:{}, arrows:[], timeLeft:120, startTime:60, gamePhase:'waiting',
    abilityCosts:{}, takenAbilities:[], skateboard:null, ducts:[], box:[], furniture:[], house:{walls:[]}, garage:{walls:[]}
};

// --------- Images ---------
function loadImage(src){ const img = new Image(); img.src=src; return img; }
const human = loadImage('Sprites/Human.png');
const zombie = loadImage('Sprites/Zombie.png');
const box = loadImage('Sprites/Box.png');
const grass = loadImage('Sprites/Grass.png');
const street = loadImage('Sprites/Street.png');
const sand = loadImage('Sprites/Sand.png');
const sea = loadImage('Sprites/Sea.png');
const sunshade = loadImage('Sprites/Sunshade.png');
const sunshadeII = loadImage('Sprites/SunshadeII.png');
const sunshadeIII = loadImage('Sprites/SunshadeII.png');
const ductSprite = loadImage('Sprites/Duct.png');
const chest = loadImage('Sprites/Chest.png');
const floors = loadImage('Sprites/Floor.png');
const garageFloor = loadImage('Sprites/garageFloor.png');
const ant = loadImage('Sprites/Ant.png');
const smallBed = loadImage('Sprites/smallBed.png');
const smallTable = loadImage('Sprites/smallTable.png');
const bigTable = loadImage('Sprites/bigTable.png');
const car = loadImage('Sprites/Car.png');
const skateboardSprite = loadImage('Sprites/Skateboard.png');

// --------- Visual Setup ---------
(function setup(){
    document.body.style.backgroundColor = '#000';
    document.body.style.margin='0';
    document.body.style.overflow='hidden';

    chatInput.style.display='none';
    chatInput.style.position='absolute';
    chatInput.style.bottom='20px';
    chatInput.style.left='50%';
    chatInput.style.transform='translateX(-50%)';
    chatInput.style.width='50%';
    chatInput.style.maxWidth='800px';
    chatInput.style.padding='10px';
    chatInput.style.fontSize='16px';
    chatInput.style.border='2px solid #555';
    chatInput.style.backgroundColor='rgba(0,0,0,0.7)';
    chatInput.style.color='white';
    chatInput.style.borderRadius='8px';
    chatInput.style.outline='none';
    chatInput.style.zIndex='10';

    function resizeCanvas(){ canvas.width=window.innerWidth; canvas.height=window.innerHeight; }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Create a simple DOM menu overlay (hidden by default)
    const menu = document.createElement('div');
    menu.id = 'gameMenu';
    menu.style.position = 'fixed';
    menu.style.left = '50%';
    menu.style.top = '50%';
    menu.style.transform = 'translate(-50%, -50%)';
    menu.style.width = '640px';
    menu.style.maxWidth = '90%';
    menu.style.height = '420px';
    menu.style.background = 'rgba(20,20,30,0.95)';
    menu.style.border = '2px solid rgba(255,255,255,0.08)';
    menu.style.borderRadius = '12px';
    menu.style.boxShadow = '0 8px 30px rgba(0,0,0,0.6)';
    menu.style.display = 'none';
    menu.style.zIndex = 9999;
    menu.style.color = 'white';
    menu.innerHTML = `
        <div style="padding:16px;display:flex;justify-content:space-between;align-items:center;">
            <div style="font-size:20px;font-weight:700;">Menu</div>
            <div>
                <button id="menuTabAbilities" style="margin-right:8px;padding:8px 12px;border-radius:8px;">Habilidades</button>
                <button id="menuTabItems" style="padding:8px 12px;border-radius:8px;">Itens</button>
                <button id="menuClose" style="margin-left:12px;padding:8px 12px;border-radius:8px;background:#c0392b;border:none;color:white;">Fechar</button>
            </div>
        </div>
        <div id="menuContent" style="padding:12px;height:330px;overflow:auto;"></div>
    `;
    document.body.appendChild(menu);

    const menuContent = document.getElementById('menuContent');
    const menuTabAbilities = document.getElementById('menuTabAbilities');
    const menuTabItems = document.getElementById('menuTabItems');
    const menuClose = document.getElementById('menuClose');

    function populateAbilities(){
        menuContent.innerHTML = '';
        const costs = gameState.abilityCosts || {};
        const me = gameState.players[myId];
        const keys = Object.keys(costs);
        if(keys.length===0){ menuContent.innerHTML = '<div>Nenhuma habilidade disponível.</div>'; return; }
        for(const a of keys){
            const cost = costs[a];
            const taken = gameState.takenAbilities && gameState.takenAbilities.includes(a);
            const disabled = taken || !me || (me.coins < cost);
            const btn = document.createElement('button');
            btn.textContent = `${a} — ${cost} coins`;
            btn.style.display = 'block';
            btn.style.width = '100%';
            btn.style.margin = '8px 0';
            btn.style.padding = '10px';
            btn.style.borderRadius = '8px';
            btn.style.border = 'none';
            btn.style.background = disabled ? '#444' : '#27ae60';
            btn.style.color = 'white';
            btn.disabled = disabled;
            btn.onclick = () => { socket && socket.emit('chooseAbility', a); menu.style.display='none'; isMenuOpen=false; };
            menuContent.appendChild(btn);
        }
    }

    menuTabAbilities.onclick = () => { populateAbilities(); };
    menuTabItems.onclick = () => { menuContent.innerHTML = '<div>Inventário (em breve)</div>'; };
    menuClose.onclick = () => { menu.style.display='none'; isMenuOpen=false; };

    // expose helper to toggle the menu from key handlers
    window.__toggleGameMenu = function(show){ isMenuOpen = !!show; menu.style.display = isMenuOpen ? 'block' : 'none'; if(isMenuOpen) populateAbilities(); };
})();

// --------- Input ---------
    window.addEventListener('keydown', (event)=>{
    const key = (event && event.key) ? event.key.toLowerCase() : '';
    const me = gameState.players[myId];

    if(key==='enter'){
        event.preventDefault();
        if(isChatting){
            const msg=chatInput.value.trim();
            if(msg) socket.emit('sendMessage', msg);
            chatInput.value='';
            chatInput.blur();
        }else{
            chatInput.style.display='block';
            chatInput.focus();
        }
    }

    if(key==='escape' && isChatting){
        chatInput.value='';
        chatInput.blur();
    }

    chatInput.onfocus=()=>{ isChatting=true; };
    chatInput.onblur=()=>{ isChatting=false; chatInput.style.display='none'; };

    if(key==='b'){ if(me && me.role!=='zombie') { window.__toggleGameMenu(!isMenuOpen); } }
    if(isMenuOpen || isChatting) return;

    switch(key){
        case 'w': case 'arrowup': movement.up=true; break;
        case 's': case 'arrowdown': movement.down=true; break;
        case 'a': case 'arrowleft': movement.left=true; break;
        case 'd': case 'arrowright': movement.right=true; break;
        case 'e': if(me && me.role!=='zombie') socket.emit('playerAction',{type:'interact'}); break;
        case 'c': if(me && me.role!=='zombie') socket.emit('playerAction',{type:'ability'}); break;
        case 'g': socket.emit('playerAction',{type:'drop_skateboard'}); break;
    }
});
    window.addEventListener('keyup',(event)=>{
    const key = (event && event.key) ? event.key.toLowerCase() : '';
    switch(key){
        case 'w': case 'arrowup': movement.up=false; break;
        case 's': case 'arrowdown': movement.down=false; break;
        case 'a': case 'arrowleft': movement.left=false; break;
        case 'd': case 'arrowright': movement.right=false; break;
    }
});

// --------- Mouse ----------
canvas.addEventListener('mousemove', (e)=>{
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
});

canvas.addEventListener('mousedown',(e)=>{
    const me = gameState.players[myId];
    if(!me) return;

        if(isMenuOpen){
            // menu is handled via DOM overlay, ignore canvas clicks while open
            return;
        } else {
            socket.emit('playerAction',{type:'primary_action'});
        }
});

function isClickInside(pos,rect){ return pos.x>rect.x && pos.x<rect.x+rect.width && pos.y>rect.y && pos.y<rect.y+rect.height; }
function getPlayerAngle(player){ if(!player) return 0; const cx=canvas.width/2; const cy=canvas.height/2; const dx=mouse.x-cx; const dy=mouse.y-cy; return Math.atan2(dy,dx); }

// --------- Commands ----------
window.addEventListener('keydown', (event)=>{
    if(event.key==='/' && !isChatting){
        chatInput.style.display='block';
        chatInput.focus();
        isChatting=true;
    }
});
chatInput.addEventListener('keypress', (e)=>{
    if(e.key==='Enter'){
        const msg = chatInput.value.trim();
        if(!msg) return;
        chatInput.value='';
        chatInput.blur();
        isChatting=false;

        // Comandos dev
        if(msg.startsWith('/')){
            if(myEmail==='enzosantiagosrv1245@gmail.com'){
                const args = msg.split(' ');
                const cmd = args[0].toLowerCase();
                if(cmd==='/ban'){ socket.emit('devCommand',{type:'ban',player:args[1],temp:args[2]||null}); }
                if(cmd==='/tp'){ socket.emit('devCommand',{type:'tp',player:args[1]}); }
                if(cmd==='/coins'){ socket.emit('devCommand',{type:'coins',player:args[2],coins:parseInt(args[1])||0}); }
            }else{
                chatMessages.push({name:'Servidor',text:'Você não tem permissão para comandos.'});
            }
            return;
        }

        // Mensagem normal
        socket.emit('sendMessage',msg);
    }
});

// --------- Chat em balão ----------
function drawBalloonChat(player,msg){
    if(!player) return;
    ctx.save();
    ctx.font='16px Arial';
    ctx.textAlign='center';
    ctx.fillStyle='white';
    ctx.strokeStyle='black';
    ctx.lineWidth=3;
    const x = player.x + player.width/2;
    const y = player.y - 40;
    ctx.strokeText(msg,x,y);
    ctx.fillText(msg,x,y);
    ctx.restore();
}

// --------- Render e game loop ----------
function draw(){
    if(!myId || !gameState.players || !gameState.players[myId]){
        ctx.fillStyle='black';
        ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle='white';
        ctx.textAlign='center';
        ctx.font='30px Arial';
        ctx.fillText('Waiting for game state...',canvas.width/2,canvas.height/2);
        return;
    }
    const me = gameState.players[myId];
    // compute world size (use server-provided or sensible defaults)
    const worldW = gameState.worldWidth || 6000;
    const worldH = gameState.worldHeight || 2000;
    let cameraX = me.x - canvas.width/2;
    let cameraY = me.y - canvas.height/2;
    // clamp camera so it doesn't show outside the world bounds
    cameraX = Math.max(0, Math.min(cameraX, Math.max(0, worldW - canvas.width)));
    cameraY = Math.max(0, Math.min(cameraY, Math.max(0, worldH - canvas.height)));
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.save();
    ctx.translate(-cameraX,-cameraY);
    // draw background stretched to world size (tiles/sprites should ideally be repeated)
    ctx.drawImage(grass,0,0,worldW,worldH);
    // floors image is drawn at its intended position if available
    ctx.drawImage(floors,200,200,Math.min(worldW,2697),Math.min(worldH,1670));

    // Sprites, players e balões
    for(const playerId in gameState.players){
        const player = gameState.players[playerId];
        if(!player) continue;
        ctx.save();
        ctx.translate(player.x+player.width/2,player.y+player.height/2);
        ctx.drawImage(human,-player.width/2,-player.height/2,player.width,player.height);
        ctx.restore();

        // Chat balão
        if(player.chatMessage) drawBalloonChat(player,player.chatMessage);
    }
    ctx.restore();
}
function gameLoop(){
    if(myId && gameState.players[myId]){
        const me = gameState.players[myId];
        const rot = getPlayerAngle(me);
        socket.emit('playerInput',{movement,mouse,rotation:rot});
    }
    draw();
    requestAnimationFrame(gameLoop);
}
gameLoop();
