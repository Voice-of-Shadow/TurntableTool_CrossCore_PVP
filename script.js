// ========== Global State ==========
const State = {
    currentState: 'A', 
    players: [],
    matchList: [],
    drawCount: 0,
    usedAvatars: [],
    isSpinning: false,
    backgroundImages: [],
    currentBgIndex: 0,
    bgInterval: null,
    totalRotation: 0,
    
    audio: {
        files: [],
        currentIndex: 0,
        players: [new Audio(), new Audio()],
        activePlayerId: 0,
        isFading: false,
        hasStarted: false
    }
};

// Color palette
const SECTOR_COLORS = ["#FF8080B3", "#FFFF80B3", "#80FF80B3", "#80BFFFB3", "#FF80BFB3"];

// ========== Initialization ==========
document.addEventListener('DOMContentLoaded', () => {
    if (typeof Config === 'undefined') {
        alert("错误：未找到 config.js 配置文件！");
        return;
    }

    initializeBackgroundSystem();
    initializeAudioSystem();
    initializeControls();
    initializeWheel();
    setupDragAndDrop();
    setupModalClick();
});

// ========== Audio System ==========
function initializeAudioSystem() {
    for (let i = 1; i <= Config.audioCount; i++) {
        State.audio.files.push(`./audio/${String(i).padStart(2, '0')}.mp3`);
    }

    State.audio.players.forEach((player, idx) => {
        player.volume = 0;
        player.preload = 'auto';

        player.addEventListener('error', (e) => {
            console.warn(`Audio load failed (skip): ${player.src}`);
            if (State.audio.isFading && ((State.audio.activePlayerId + 1) % 2 === idx)) {
               playNextTrack(); 
            }
        });

        player.addEventListener('timeupdate', () => {
            if (State.audio.isFading) return;
            if (player.duration && (player.duration - player.currentTime <= 1.5)) {
                playNextTrack();
            }
        });

        player.addEventListener('ended', () => {
            if (!State.audio.isFading) {
                playNextTrack();
            }
        });
    });

    playNextTrack(true);
}

function playNextTrack(isFirst = false) {
    if (State.audio.files.length === 0) return;

    State.audio.isFading = true;

    const outgoingId = State.audio.activePlayerId;
    const incomingId = (State.audio.activePlayerId + 1) % 2;
    
    const outgoingPlayer = State.audio.players[outgoingId];
    const incomingPlayer = State.audio.players[incomingId];

    if (!isFirst) {
        State.audio.currentIndex = (State.audio.currentIndex + 1) % State.audio.files.length;
    }

    incomingPlayer.src = State.audio.files[State.audio.currentIndex];
    incomingPlayer.volume = 0; 

    const playPromise = incomingPlayer.play();

    if (playPromise !== undefined) {
        playPromise.then(() => {
            State.audio.hasStarted = true;
            performCrossfade(outgoingPlayer, incomingPlayer, incomingId);
        }).catch(error => {
            console.log("Auto-play blocked. Waiting for interaction...");
            State.audio.isFading = false;
            const startOnInteraction = () => {
                incomingPlayer.play().then(() => {
                    State.audio.hasStarted = true;
                    performCrossfade(outgoingPlayer, incomingPlayer, incomingId);
                });
            };
            document.addEventListener('click', startOnInteraction, { once: true });
        });
    }
}

function performCrossfade(outgoing, incoming, newActiveId) {
    const fadeDuration = 1000;
    const steps = 20;          
    const intervalTime = fadeDuration / steps; 
    const volStep = 1.0 / steps;

    let currentStep = 0;

    const fadeInterval = setInterval(() => {
        currentStep++;
        
        const inVol = currentStep * volStep;
        incoming.volume = Math.min(1, inVol);

        if (outgoing.src && State.audio.hasStarted && outgoing !== incoming) {
            const outVol = 1.0 - (currentStep * volStep);
            outgoing.volume = Math.max(0, outVol);
        }

        if (currentStep >= steps) {
            clearInterval(fadeInterval);
            if (outgoing.src && outgoing !== incoming) {
                outgoing.pause();
                outgoing.currentTime = 0;
            }
            incoming.volume = 1;
            State.audio.activePlayerId = newActiveId;
            State.audio.isFading = false;
        }
    }, intervalTime);
}

// ========== Background System ==========
function initializeBackgroundSystem() {
    for (let i = 1; i <= Config.bgCount; i++) {
        State.backgroundImages.push(`./images/BG/${String(i).padStart(2, '0')}.webp`);
    }

    const bg1 = document.getElementById('bg-image-1');
    const bg2 = document.getElementById('bg-image-2');

    if (State.backgroundImages.length > 0) {
        bg1.style.backgroundImage = `url('${State.backgroundImages[0]}')`;
        bg1.classList.add('active');
    }

    State.bgInterval = setInterval(() => {
        if (State.backgroundImages.length < 2) return;

        const currentBg = State.currentBgIndex % 2 === 0 ? bg1 : bg2;
        const nextBg = State.currentBgIndex % 2 === 0 ? bg2 : bg1;

        State.currentBgIndex = (State.currentBgIndex + 1) % State.backgroundImages.length;
        nextBg.style.backgroundImage = `url('${State.backgroundImages[State.currentBgIndex]}')`;

        currentBg.classList.remove('active');
        nextBg.classList.add('active');
    }, 10000); 
}

// ========== Controls ==========
function initializeControls() {
    const blurSlider = document.getElementById('blur-slider');
    const opacitySlider = document.getElementById('opacity-slider');
    const bg1 = document.getElementById('bg-image-1');
    const bg2 = document.getElementById('bg-image-2');
    const whiteOverlay = document.getElementById('white-overlay');

    blurSlider.addEventListener('input', (e) => {
        const blurValue = e.target.value;
        bg1.style.filter = `blur(${blurValue}px)`;
        bg2.style.filter = `blur(${blurValue}px)`;

        if (blurValue > 0) {
            const padding = blurValue * 2;
            bg1.style.transform = `scale(${1 + padding / 1920})`;
            bg2.style.transform = `scale(${1 + padding / 1920})`;
        } else {
            bg1.style.transform = 'scale(1)';
            bg2.style.transform = 'scale(1)';
        }
    });

    opacitySlider.addEventListener('input', (e) => {
        const opacityValue = e.target.value / 100;
        whiteOverlay.style.opacity = opacityValue;
    });
}

// ========== Wheel Rendering ==========
function initializeWheel() {
    State.players = ['选项 1', '选项 2', '选项 3', '选项 4', '选项 5'];
    renderWheel();
}

function renderWheel() {
    const wheelGroup = document.getElementById('wheel-group');
    wheelGroup.innerHTML = '';

    wheelGroup.style.transition = 'none';
    wheelGroup.style.transformOrigin = '640px 540px';
    
    if(State.players.length === 0 || State.currentState === 'B') {
        State.totalRotation = 0;
    }
    wheelGroup.style.transform = `rotate(${State.totalRotation}deg)`;

    const centerX = 640;
    const centerY = 540;
    const radius = 500;
    const playerCount = State.players.length;
    const anglePerSector = (Math.PI * 2) / playerCount;

    const colorIndices = generateColorIndices(playerCount);

    for (let i = 0; i < playerCount; i++) {
        const startAngle = i * anglePerSector - Math.PI / 2;
        const endAngle = startAngle + anglePerSector;

        const x1 = centerX + radius * Math.cos(startAngle);
        const y1 = centerY + radius * Math.sin(startAngle);
        const x2 = centerX + radius * Math.cos(endAngle);
        const y2 = centerY + radius * Math.sin(endAngle);

        const largeArcFlag = anglePerSector > Math.PI ? 1 : 0;

        const pathData = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('fill', SECTOR_COLORS[colorIndices[i]]);
        path.classList.add('wheel-sector');
        path.dataset.index = i;
        wheelGroup.appendChild(path);

        const midAngle = startAngle + anglePerSector / 2;
        const textRadius = radius * 0.65;
        const textX = centerX + textRadius * Math.cos(midAngle);
        const textY = centerY + textRadius * Math.sin(midAngle);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', textX);
        text.setAttribute('y', textY);
        text.setAttribute('class', 'wheel-text');

        const rotationAngle = (midAngle * 180 / Math.PI) + 180;
        text.setAttribute('transform', `rotate(${rotationAngle}, ${textX}, ${textY})`);
        text.textContent = State.players[i];

        wheelGroup.appendChild(text);
    }

    const svg = document.getElementById('turntable-svg');
    svg.onclick = handleWheelClick;
}

function generateColorIndices(count) {
    const indices = [];
    for (let i = 0; i < count; i++) indices.push(i % SECTOR_COLORS.length);
    for (let i = 0; i < count; i++) {
        const prev = (i - 1 + count) % count;
        const next = (i + 1) % count;
        if (indices[i] === indices[prev]) indices[i] = (indices[i] + 1) % SECTOR_COLORS.length;
        if (indices[i] === indices[next] && count > 2) indices[i] = (indices[i] + 1) % SECTOR_COLORS.length;
    }
    if (count > 1 && indices[0] === indices[count - 1]) indices[count - 1] = (indices[count - 1] + 1) % SECTOR_COLORS.length;
    return indices;
}

// ========== Wheel Click Handler ==========
function handleWheelClick(e) {
    if (State.isSpinning) return;
    if (State.currentState === 'A') {
        showModal('请导入参赛数据(.txt)', null, 'black');
        return;
    }
    if (State.currentState === 'D') return;

    spinWheel();
}

function spinWheel() {
    State.isSpinning = true;
    const wheelGroup = document.getElementById('wheel-group');
    const playerCount = State.players.length;

    const fullRotations = 3 + Math.random() * 2; 
    const anglePerSector = 360 / playerCount;
    const randomSectorIndex = Math.floor(Math.random() * playerCount);
    
    const addedRotation = (360 * fullRotations) + (randomSectorIndex * anglePerSector);
    const newTotalRotation = State.totalRotation + addedRotation;

    wheelGroup.style.transition = 'transform 3s cubic-bezier(0.25, 0.1, 0.25, 1)';
    wheelGroup.style.transform = `rotate(${newTotalRotation}deg)`;

    State.totalRotation = newTotalRotation;

    setTimeout(() => {
        const pointerAngle = 270;
        const normalizedRotation = newTotalRotation % 360;
        const adjustedAngle = (pointerAngle - normalizedRotation + 360) % 360;
        
        const selectedIndex = Math.floor(adjustedAngle / anglePerSector) % playerCount;
        const selectedPlayer = State.players[selectedIndex];

        State.drawCount++;
        const isOdd = State.drawCount % 2 === 1;
        const color = isOdd ? 'pink' : 'blue';

        setTimeout(() => {
            showModal(selectedPlayer, getRandomAvatar(), color);
        }, 500);

        State.selectedIndex = selectedIndex;
        State.selectedPlayer = selectedPlayer;
        State.isSpinning = false;
    }, 3000);
}

function getRandomAvatar() {
    const availableAvatars = [];

    for (let i = 1; i <= Config.avatarCount; i++) {
        if (!State.usedAvatars.includes(i)) availableAvatars.push(i);
    }
    if (availableAvatars.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * availableAvatars.length);
    const selectedAvatar = availableAvatars[randomIndex];
    State.usedAvatars.push(selectedAvatar);
    return `./images/PN/${String(selectedAvatar).padStart(2, '0')}.png`;
}

// ========== Modal System ==========
function showModal(text, avatarPath, colorClass) {
    const modal = document.getElementById('modal-overlay');
    const modalText = document.getElementById('modal-text');
    const modalAvatar = document.getElementById('modal-avatar');

    modalText.className = '';
    modalText.textContent = text;

    if (colorClass === 'pink') modalText.classList.add('modal-text-pink');
    else if (colorClass === 'blue') modalText.classList.add('modal-text-blue');
    else modalText.classList.add('modal-text-black');

    if (avatarPath) {
        modalAvatar.style.backgroundImage = `url('${avatarPath}')`;
        modalAvatar.style.display = 'block';
    } else {
        modalAvatar.style.display = 'none';
    }
    modal.classList.remove('hidden');
}

function setupModalClick() {
    const modal = document.getElementById('modal-overlay');
    modal.addEventListener('click', () => {
        modal.classList.add('hidden');
        if (State.currentState === 'B' || State.currentState === 'C') {
            if (State.selectedPlayer) processSelection();
        }
    });
}

function processSelection() {
    const player = State.selectedPlayer;
    const index = State.selectedIndex;

    State.matchList.push(player);

    const isOdd = State.drawCount % 2 === 1;
    const listContent = isOdd ? document.getElementById('left-content') : document.getElementById('right-content');
    const entry = document.createElement('div');
    entry.className = `match-entry ${isOdd ? 'pink' : 'blue'}`;
    const paddedNumber = String(State.drawCount).padStart(2, '0');
    entry.textContent = `${paddedNumber}. ${player}`;
    listContent.appendChild(entry);

    State.players.splice(index, 1);

    if (State.players.length === 1) {
        State.drawCount++;
        const lastPlayer = State.players[0];
        const isLastOdd = State.drawCount % 2 === 1;
        State.matchList.push(lastPlayer);
        const lastListContent = isLastOdd ? document.getElementById('left-content') : document.getElementById('right-content');
        const lastEntry = document.createElement('div');
        lastEntry.className = `match-entry ${isLastOdd ? 'pink' : 'blue'}`;
        const paddedLastNumber = String(State.drawCount).padStart(2, '0');
        lastEntry.textContent = `${paddedLastNumber}. ${lastPlayer}`;
        lastListContent.appendChild(lastEntry);

        exportMatchList();
        State.currentState = 'D';
        State.players = [];
        document.getElementById('turntable-svg').classList.add('disabled');
        
        const triangle = document.querySelector('#turntable-svg polygon');
        if (triangle) triangle.style.display = 'none';

        renderWheel();
    } else {
        renderWheel();
        State.currentState = 'C';
    }
    State.selectedPlayer = null;
    State.selectedIndex = null;
}

function exportMatchList() {
    let content = '';
    for (let i = 0; i < State.matchList.length; i += 2) {
        if (i + 1 < State.matchList.length) content += `${State.matchList[i]} ${State.matchList[i + 1]}\n`;
        else content += `${State.matchList[i]}\n`;
    }
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '对战列表.txt';
    a.click();
    URL.revokeObjectURL(url);
}

// ========== Drag and Drop ==========
function setupDragAndDrop() {
    const body = document.body;
    const dropIndicator = document.getElementById('drop-indicator');

    body.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropIndicator.classList.remove('hidden');
    });

    body.addEventListener('dragleave', (e) => {
        if (e.target === body) dropIndicator.classList.add('hidden');
    });

    body.addEventListener('drop', (e) => {
        e.preventDefault();
        dropIndicator.classList.add('hidden');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.name.endsWith('.txt')) loadPlayerData(file);
        }
    });
}

function loadPlayerData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result;
        const lines = content.split('\n');
        State.players = [];

        for (let i = 0; i < Math.min(Config.playerCount, lines.length); i++) {
            const line = lines[i].trim();
            if (line) State.players.push(line.substring(0, 16));
        }

        while (State.players.length < Config.playerCount) {
            State.players.push(`占位选项 ${State.players.length + 1}`);
        }

        State.currentState = 'B';
        State.matchList = [];
        State.drawCount = 0;
        State.usedAvatars = [];
        State.totalRotation = 0; 
        document.getElementById('left-content').innerHTML = '';
        document.getElementById('right-content').innerHTML = '';
        document.getElementById('turntable-svg').classList.remove('disabled');

        const triangle = document.querySelector('#turntable-svg polygon');
        if (triangle) triangle.style.display = '';

        renderWheel();
    };
    reader.readAsText(file);
}