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

// DOM Elements
const briefingScreen = document.getElementById('briefing-screen');
const masterScreen = document.getElementById('master-screen');
const playerScreen = document.getElementById('player-screen');
const playerDashboard = document.getElementById('player-dashboard');
const masterDashboard = document.getElementById('master-dashboard');
const playerWarning = document.getElementById('player-warning');

// Game State
let currentState = null;

// Inicialização
document.getElementById('btn-start-briefing').addEventListener('click', () => {
    briefingScreen.classList.add('hidden');
    if (isMaster) {
        masterScreen.classList.remove('hidden');
        initMaster();
    } else if (playerRole) {
        playerScreen.classList.remove('hidden');
        document.getElementById('player-role-title').innerText = `Agente: ${playerRole.toUpperCase().replace('_', ' ')}`;
        initPlayer();
    } else {
        alert("Parâmetros de URL inválidos. Use ?master=true ou ?role=comando");
    }
});

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
    document.getElementById('player-mode').innerText = `Modo: ${currentState.mode}`;
    document.getElementById('player-timer').innerText = `${currentState.timer}s`;
    
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
            if (currentState.votes && currentState.votes[actionKey] && currentState.votes[actionKey][playerRole] === opt.id) {
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
        [playerRole]: optionId
    });
}

// --- LÓGICA DO MESTRE ---
let timerInterval;

function initMaster() {
    // Estado inicial padrão se não existir
    set(ref(db, 'gameState'), {
        phase: 'IDLE',
        mode: 'G1',
        timer: 120,
        votes: {}
    });

    onValue(ref(db, 'gameState'), (snapshot) => {
        currentState = snapshot.val();
        if(!currentState) return;
        
        document.getElementById('master-mode').innerText = `Rodada: ${currentState.mode}`;
        document.getElementById('master-timer').innerText = `Tempo: ${currentState.timer}s`;
        
        renderMasterUI();
    });

    document.getElementById('btn-start-round').onclick = startRound;
    document.getElementById('btn-next-mode').onclick = advanceMode;
    document.getElementById('btn-close-result').onclick = () => {
        document.getElementById('result-modal').classList.add('hidden');
        advanceMode();
    };
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
    let nextMode = 'G1';
    if (currentState.mode === 'G1') nextMode = 'G2';
    else if (currentState.mode === 'G2') nextMode = 'G3';
    else alert("Missão concluída com sucesso! Jogo finalizado.");

    update(ref(db, 'gameState'), { phase: 'IDLE', mode: nextMode, timer: 120, votes: {} });
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
            const uniqueVotes = new Set(Object.values(votesForThisAction));
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
                    if(v === opt.id) voteCount++;
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
        showResultModal("FALHA CRÍTICA", optionData.failMsg, true);
    } else {
        alert("Ação executada com sucesso. Prossiga para as demais.");
        // A lógica de vitória total exigiria rastrear se as 4 corretas foram clicadas.
        // Para simplificar: O Mestre clica na correta e segue. Se errar, falha instantânea.
    }
}

function showResultModal(title, message, isFailure) {
    document.getElementById('result-title').innerText = title;
    document.getElementById('result-message').innerText = message;
    const btnClose = document.getElementById('btn-close-result');
    
    if (isFailure) {
        btnClose.classList.remove('hidden');
    }
    
    document.getElementById('result-modal').classList.remove('hidden');
}
