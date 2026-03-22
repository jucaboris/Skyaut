import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, onValue, set, update } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { GAME_DATA, ROLE_MAP_G3 } from "./game-data.js";

const firebaseConfig = {
    apiKey: "AIzaSyB4wLn89l7vHd8ZBuO0_xyMGLVpUQo3Dm0",
    authDomain: "plane-2026.firebaseapp.com",
    databaseURL: "https://plane-2026-default-rtdb.firebaseio.com",
    projectId: "plane-2026",
    storageBucket: "plane-2026.firebasestorage.app",
    messagingSenderId: "517130848502",
    appId: "1:517130848502:web:7a2b5bdd139549be3444d7"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// URL Parsing
const urlParams = new URLSearchParams(window.location.search);
const isMaster = urlParams.get('master') === 'true';
const playerRole = urlParams.get('role');
const voterId = !isMaster && playerRole ? getOrCreateVoterId(playerRole) : null;

// DOM Elements
const introVideo = document.getElementById('intro-video');
const introContainer = document.getElementById('intro-video-container');
const continueScreen = document.getElementById('continue-screen');
const mainMenu = document.getElementById('main-menu');
const masterScreen = document.getElementById('master-screen');
const playerScreen = document.getElementById('player-screen');
const playerDashboard = document.getElementById('player-dashboard');
const masterDashboard = document.getElementById('master-dashboard');
const playerWarning = document.getElementById('player-warning');
const btnNewSim = document.getElementById('btn-new-sim');
const instructionsModal = document.getElementById('instructions-modal');
const btnInstructions = document.getElementById('btn-instructions');
const btnCloseInstructions = document.getElementById('btn-close-instructions');
const btnToggleMasterAudio = document.getElementById('btn-toggle-master-audio');

// Game State
let currentState = null;
const MASTER_AUDIO_PREF_KEY = 'skyaut-master-audio-enabled';
const masterAudio = new Audio('trilha.mp3');
masterAudio.loop = true;
masterAudio.volume = 0.35;
let isMasterAudioEnabled = false;

function getOrCreateVoterId(role) {
    const storageKey = `skyaut-voter-id-${role}`;
    const savedId = localStorage.getItem(storageKey);
    if (savedId) return savedId;

    const suffix = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const newId = `${role}-${suffix}`;
    localStorage.setItem(storageKey, newId);
    return newId;
}

function getVoteOptionId(voteValue) {
    if (!voteValue) return null;
    return typeof voteValue === 'object' ? voteValue.optionId : voteValue;
}

function formatCountdown(totalSeconds) {
    const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
    const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0');
    const seconds = String(safeSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
}

// Inicialização
window.addEventListener('load', () => {
    introVideo.play().catch(() => {
        // Alguns navegadores podem bloquear autoplay mesmo com vídeo mutado.
        // Mantemos a tela de introdução e deixamos o usuário iniciar/ignorar manualmente.
    });
});

introVideo.onended = showMainMenu;
introVideo.onerror = showMainMenu;
document.getElementById('skip-intro').onclick = showMainMenu;
continueScreen.onclick = openMainMenu;

function showMainMenu() {
    if (introContainer.classList.contains('hidden')) return;
    introContainer.classList.add('hidden');
    continueScreen.classList.remove('hidden');
}

function openMainMenu() {
    continueScreen.classList.add('hidden');
    mainMenu.classList.remove('hidden');
}

btnNewSim.onclick = () => {
    mainMenu.classList.add('hidden');
    if (isMaster) {
        masterScreen.classList.remove('hidden');
        initMaster();
    } else if (playerRole) {
        playerScreen.classList.remove('hidden');
        document.getElementById('player-role-title').innerText = `Agente: ${playerRole.toUpperCase().replace('_', ' ')}`;
        initPlayer();
    } else {
        alert("Parâmetros de URL inválidos. Use ?master=true ou ?role=comando");
        showContinueScreen();
    }
};

btnInstructions.onclick = () => {
    instructionsModal.classList.remove('hidden');
};

btnCloseInstructions.onclick = () => {
    instructionsModal.classList.add('hidden');
};


instructionsModal.addEventListener('click', (event) => {
    if (event.target === instructionsModal) {
        instructionsModal.classList.add('hidden');
    }
});

document.getElementById('btn-exit').onclick = () => {
    showContinueScreen();
};

function showContinueScreen() {
    mainMenu.classList.add('hidden');
    masterScreen.classList.add('hidden');
    playerScreen.classList.add('hidden');
    continueScreen.classList.remove('hidden');
    stopMasterAudio();
}

// --- LÓGICA DO JOGADOR ---
function initPlayer() {
    const stateRef = ref(db, 'gameState');
    onValue(stateRef, (snapshot) => {
        currentState = snapshot.val();
        if(!currentState) return;
        renderPlayerUI();
    });
}

function renderPlayerUI() {
    document.getElementById('player-mode').innerText = `Rodada: ${currentState.mode}`;
    const timerLabel = currentState.phase === 'VOTING' ? formatCountdown(currentState.timer) : '00:00';
    document.getElementById('player-timer').innerText = `TEMPO RESTANTE: ${timerLabel}`;
    
    playerDashboard.innerHTML = '';
    playerWarning.classList.add('hidden');

    const isVotingPhase = currentState.phase === 'VOTING';
    const isTimeout = currentState.phase === 'RESOLUTION' || currentState.phase === 'END';

    if (isTimeout) {
        playerWarning.innerText = "Ações em progresso...";
        playerWarning.classList.remove('hidden');
    }

    // Regras de bloqueio G1
    if (currentState.mode === 'G1' && playerRole !== 'comando') {
        playerWarning.innerText = "Decisão centralizada exclusivamente no Comando. Aguarde.";
        playerWarning.classList.remove('hidden');
    }

    Object.keys(GAME_DATA).forEach(actionKey => {
        // Regras de bloqueio G3 (Especialização)
        if (currentState.mode === 'G3' && ROLE_MAP_G3[playerRole] !== actionKey) return;

        const actionData = GAME_DATA[actionKey];
        const card = document.createElement('div');
        card.className = 'action-card';
        card.innerHTML = `<h3>${actionData.label}</h3>`;
        
        const grid = document.createElement('div');
        grid.className = 'options-grid';

        // Bloqueia os botões baseados na fase e nas regras de rodada
        const isDisabled = !isVotingPhase || 
                           (currentState.mode === 'G1' && playerRole !== 'comando');

        actionData.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.innerText = opt.text;
            btn.disabled = isDisabled;
            
            // Marca se já votou
            const myVote = currentState.votes && currentState.votes[actionKey] ? currentState.votes[actionKey][voterId] : null;
            if (getVoteOptionId(myVote) === opt.id) {
                btn.classList.add('selected');
            }

            btn.onclick = () => submitVote(actionKey, opt.id);
            grid.appendChild(btn);
        });

        card.appendChild(grid);
        playerDashboard.appendChild(card);
    });
}

function submitVote(actionKey, optionId) {
    update(ref(db, `gameState/votes/${actionKey}`), {
        [voterId]: {
            role: playerRole,
            optionId
        }
    });
}

// --- LÓGICA DO MESTRE ---
let timerInterval;

function initMaster() {
    setupMasterAudio();

    onValue(ref(db, 'gameState'), (snapshot) => {
        if (!snapshot.exists()) {
            // Estado inicial padrão apenas quando o jogo ainda não existe
            set(ref(db, 'gameState'), {
                phase: 'IDLE',
                mode: 'G1',
                timer: 0,
                votes: {}
            });
            return;
        }

        currentState = snapshot.val();
        if(!currentState) return;
        
        document.getElementById('master-mode').innerText = `Rodada: ${currentState.mode}`;
        const timerText = currentState.phase === 'VOTING' ? formatCountdown(currentState.timer) : '00:00';
        document.getElementById('master-timer').innerText = `TEMPO RESTANTE: ${timerText}`;

        if (currentState.phase !== 'VOTING') clearInterval(timerInterval);
        
        renderMasterUI();
    });

    document.getElementById('btn-start-round').onclick = startRound;
    document.getElementById('btn-next-mode').onclick = advanceMode;
    document.getElementById('btn-end-game').onclick = endGame;
    btnToggleMasterAudio.onclick = toggleMasterAudio;
    document.getElementById('btn-close-result').onclick = () => {
        document.getElementById('result-modal').classList.add('hidden');
        advanceMode();
    };
}

function setupMasterAudio() {
    if (!isMaster) return;
    const savedPreference = localStorage.getItem(MASTER_AUDIO_PREF_KEY);
    isMasterAudioEnabled = savedPreference !== 'false';
    updateMasterAudioButtonLabel();

    if (isMasterAudioEnabled) {
        startMasterAudio();
    }
}

function startMasterAudio() {
    if (!isMaster || !isMasterAudioEnabled) return;
    masterAudio.play().catch(() => {
        // Pode falhar sem gesto explícito em alguns navegadores.
    });
}

function stopMasterAudio() {
    if (!isMaster) return;
    masterAudio.pause();
    masterAudio.currentTime = 0;
}

function updateMasterAudioButtonLabel() {
    if (!btnToggleMasterAudio) return;
    btnToggleMasterAudio.innerText = isMasterAudioEnabled ? 'Som: Ligado' : 'Som: Desligado';
}

function toggleMasterAudio() {
    if (!isMaster) return;
    isMasterAudioEnabled = !isMasterAudioEnabled;
    localStorage.setItem(MASTER_AUDIO_PREF_KEY, String(isMasterAudioEnabled));
    updateMasterAudioButtonLabel();

    if (isMasterAudioEnabled) {
        startMasterAudio();
        return;
    }

    stopMasterAudio();
}

function endGame() {
    clearInterval(timerInterval);
    update(ref(db, 'gameState'), { phase: 'IDLE', mode: 'G1', timer: 0, votes: {} });
    stopMasterAudio();
    showMainMenuFromGame();
}

function showMainMenuFromGame() {
    masterScreen.classList.add('hidden');
    playerScreen.classList.add('hidden');
    mainMenu.classList.remove('hidden');
}

function startRound() {
    update(ref(db, 'gameState'), { phase: 'VOTING', timer: 120, votes: {} });
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (currentState.timer > 0) {
            update(ref(db, 'gameState'), { timer: currentState.timer - 1 });
        } else {
            clearInterval(timerInterval);
            update(ref(db, 'gameState'), { phase: 'RESOLUTION' });
        }
    }, 1000);
}

function advanceMode() {
    let nextMode = currentState.mode;
    let nextPhase = 'IDLE';

    if (currentState.mode === 'G1') nextMode = 'G2';
    else if (currentState.mode === 'G2') nextMode = 'G3';
    else {
        nextPhase = 'END';
        alert("Missão concluída com sucesso! Jogo finalizado.");
    }

    clearInterval(timerInterval);
    update(ref(db, 'gameState'), { phase: nextPhase, mode: nextMode, timer: 0, votes: {} });
}

function renderMasterUI() {
    masterDashboard.innerHTML = '';
    
    Object.keys(GAME_DATA).forEach(actionKey => {
        const actionData = GAME_DATA[actionKey];
        const card = document.createElement('div');
        card.className = 'action-card';
        card.innerHTML = `<h3>${actionData.label}</h3>`;
        
        // Verifica conflitos no modo G2
        let votesForThisAction = currentState.votes ? currentState.votes[actionKey] : null;
        if (currentState.mode === 'G2' && votesForThisAction) {
            const uniqueVotes = new Set(Object.values(votesForThisAction).map(getVoteOptionId).filter(Boolean));
            if (uniqueVotes.size > 1) {
                card.innerHTML += `<div style="color:red; font-weight:bold; margin-bottom:10px;">⚠️ CONFLITO DETECTADO NA EQUIPE</div>`;
            }
        }

        const grid = document.createElement('div');
        grid.className = 'options-grid';

        actionData.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            
            // Conta os votos para esta opção
            let voteCount = 0;
            if (votesForThisAction) {
                Object.values(votesForThisAction).forEach(v => {
                    if(getVoteOptionId(v) === opt.id) voteCount++;
                });
            }
            
            btn.innerText = `${opt.text} (${voteCount} votos)`;
            
            // Apenas o Mestre pode "Executar" a ação
            btn.onclick = () => resolveAction(actionKey, opt);
            grid.appendChild(btn);
        });

        card.appendChild(grid);
        masterDashboard.appendChild(card);
    });
}

function resolveAction(actionKey, optionData) {
    if (!optionData.correct) {
        update(ref(db, 'gameState'), { phase: 'END', timer: 0 });
        showResultModal("FALHA CRÍTICA", optionData.failMsg, true);
    } else {
        alert(optionData.successMsg || "Ação executada com sucesso. Prossiga para as demais.");
        // A lógica de vitória total exigiria rastrear se as 4 corretas foram clicadas.
        // Para simplificar: O Mestre clica na correta e segue. Se errar, falha instantânea.
    }
}

function showResultModal(title, message, isFailure) {
    document.getElementById('result-title').innerText = title;
    document.getElementById('result-message').innerText = message;
    const btnClose = document.getElementById('btn-close-result');
    
    btnClose.classList.toggle('hidden', !isFailure);
    
    document.getElementById('result-modal').classList.remove('hidden');
}
