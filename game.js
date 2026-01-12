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

// Google Sign-In
const GOOGLE_CLIENT_ID = "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";
const loginBtn = document.getElementById('googleLoginBtn');

// Botão login Google
loginBtn.onclick = () => {
    window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleLogin
    });
    window.google.accounts.id.prompt(notification => {
        if(notification.isNotDisplayed() || notification.isSkippedMoment()){
            alert('Falha ao abrir o popup de login Google!');
        }
    });
};

function handleGoogleLogin(response){
    const payload = JSON.parse(atob(response.credential.split('.')[1]));
    myEmail = payload.email;
    myName = payload.name;
    googleUserInfo = { email: myEmail, name: myName };

    // Só permitir dev
    if(myEmail !== 'enzosantiagosrv1245@gmail.com'){
        alert('Acesso negado! Você não é dev.');
        return;
    }

    loginScreen.style.display = 'none';
    gameCanvas.style.display = 'block';
    chatInput.style.display = 'none';
    connectSocketWithAuth();
}

// --------- Socket.IO Game ---------
function connectSocketWithAuth(){
    socket = io({
        auth: { userInfo: googleUserInfo }
    });

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
})();

// --------- Input ---------
window.addEventListener('keydown', (event)=>{
    const key = event.key.toLowerCase();
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

    if(key==='b'){ if(me && me.role!=='zombie') isMenuOpen=!isMenuOpen; }
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
    const key = event.key.toLowerCase();
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
        const abilitiesTabBtn = getAbilitiesTabRect();
        const itemsTabBtn = getItemsTabRect();

        if(isClickInside(mouse, abilitiesTabBtn)) { activeMenuTab='abilities'; return; }
        if(isClickInside(mouse, itemsTabBtn)) { activeMenuTab='items'; return; }

        if(activeMenuTab==='abilities' && me.activeAbility===' '){
            const buttons = getAbilitiesLayout().buttons;
            for(const btn of buttons){
                const cost = gameState.abilityCosts[btn.ability]||0;
                const canAfford = me.coins>=cost;
                const isTaken = gameState.takenAbilities.includes(btn.ability);
                if(isClickInside(mouse, btn.rect) && !isTaken && canAfford){
                    socket.emit('chooseAbility',btn.ability);
                    isMenuOpen=false;
                    return;
                }
            }
        }
    }else{
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
    let cameraX = me.x - canvas.width/2;
    let cameraY = me.y - canvas.height/2;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.save();
    ctx.translate(-cameraX,-cameraY);
    ctx.drawImage(grass,0,0,3100,2000);
    ctx.drawImage(floors,200,200,2697,1670);

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
