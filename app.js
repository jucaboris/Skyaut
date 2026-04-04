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
const loadingScreen = document.getElementById('loading-screen');
const loadingStatus = document.getElementById('loading-status');
const loadingProgressFill = document.getElementById('loading-progress-fill');
const loadingPercentage = document.getElementById('loading-percentage');
const btnStartAfterLoading = document.getElementById('btn-start-after-loading');
const introVideo = document.getElementById('intro-video');
const introContainer = document.getElementById('intro-video-container');
const continueScreen = document.getElementById('continue-screen');
const mainMenu = document.getElementById('main-menu');
const masterScreen = document.getElementById('master-screen');
const playerScreen = document.getElementById('player-screen');
const victoryCinematic = document.getElementById('victory-cinematic');
const victoryVideo = document.getElementById('victory-video');
const failureCinematic = document.getElementById('failure-cinematic');
const failureVideo = document.getElementById('failure-video');
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
const VICTORY_FREEZE_MS = 150;
const VICTORY_FADE_MS = 700;
const FAILURE_FADE_MS = 700;
const MODE_LABELS = {
    G1: 'Centralizado',
    G2: 'Livre',
    G3: 'Descentralizado'
};
const MENU_AUDIO_VOLUME = 0.5;
const GAME_AUDIO_VOLUME = MENU_AUDIO_VOLUME * 0.5;
const AUDIO_ASSETS = {
    BACKGROUND: 'trilha.mp3',
    CORRECT_ANSWER: 'fanfare.wav',
    START_ROUND: 'Ready_go.mp3'
};
const backgroundAudio = new Audio(encodeURI(AUDIO_ASSETS.BACKGROUND));
const correctAnswerAudio = new Audio(encodeURI(AUDIO_ASSETS.CORRECT_ANSWER));
const startRoundAudio = new Audio(encodeURI(AUDIO_ASSETS.START_ROUND));
backgroundAudio.loop = true;
backgroundAudio.volume = MENU_AUDIO_VOLUME;
backgroundAudio.preload = 'auto';
correctAnswerAudio.preload = 'auto';
correctAnswerAudio.volume = GAME_AUDIO_VOLUME;
startRoundAudio.preload = 'auto';
startRoundAudio.volume = GAME_AUDIO_VOLUME;
let isMasterAudioEnabled = false;
let hasTriggeredVictoryCinematic = false;
let hasTriggeredFailureCinematic = false;
const INTRO_PLAYLIST = [
    'ILA ENTRANCE.mp4',
    'Edição_de_Vídeo_Sem_Título_e_Barra.mp4'
];
const CRITICAL_ASSETS = [
    'ILA ENTRANCE.mp4',
    'Edição_de_Vídeo_Sem_Título_e_Barra.mp4',
    AUDIO_ASSETS.BACKGROUND,
    AUDIO_ASSETS.CORRECT_ANSWER,
    AUDIO_ASSETS.START_ROUND,
    'Avião_Explodindo_Vídeo_Pronto.mp4',
    'VICTORY.mp4',
    'menu-background-landscape.png',
    'menu-background-portrait.png',
    'background-landscape.png',
    'background-portrait.png'
];
const PRELOAD_CACHE_KEY = 'skyaut-critical-assets-loaded-v2';
let currentIntroIndex = 0;
let loadingCompleted = false;
let audioUnlockedByGesture = false;

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

function formatMode(mode) {
    return MODE_LABELS[mode] || mode;
}

function loadImageAsset(src) {
    return new Promise((resolve) => {
        const image = new Image();
        image.onload = resolve;
        image.onerror = resolve;
        image.src = encodeURI(src);
    });
}

function loadVideoAsset(src) {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        const timeoutId = setTimeout(() => finish(), 6000);
        const finish = () => {
            clearTimeout(timeoutId);
            video.removeEventListener('canplaythrough', finish);
            video.removeEventListener('canplay', finish);
            video.removeEventListener('loadedmetadata', finish);
            video.removeEventListener('error', finish);
            video.removeEventListener('stalled', finish);
            video.removeEventListener('abort', finish);
            video.removeEventListener('suspend', finish);
            resolve();
        };

        video.preload = 'auto';
        video.muted = true;
        video.src = encodeURI(src);
        video.addEventListener('canplaythrough', finish, { once: true });
        video.addEventListener('canplay', finish, { once: true });
        video.addEventListener('loadedmetadata', finish, { once: true });
        video.addEventListener('error', finish, { once: true });
        video.addEventListener('stalled', finish, { once: true });
        video.addEventListener('abort', finish, { once: true });
        video.addEventListener('suspend', finish, { once: true });
        video.load();
    });
}

function loadAudioAsset(src) {
    return new Promise((resolve) => {
        const audio = new Audio();
        const timeoutId = setTimeout(() => finish(), 6000);
        const finish = () => {
            clearTimeout(timeoutId);
            audio.removeEventListener('canplaythrough', finish);
            audio.removeEventListener('canplay', finish);
            audio.removeEventListener('loadedmetadata', finish);
            audio.removeEventListener('error', finish);
            audio.removeEventListener('stalled', finish);
            audio.removeEventListener('abort', finish);
            audio.removeEventListener('suspend', finish);
            resolve();
        };

        audio.preload = 'auto';
        audio.src = encodeURI(src);
        audio.addEventListener('canplaythrough', finish, { once: true });
        audio.addEventListener('canplay', finish, { once: true });
        audio.addEventListener('loadedmetadata', finish, { once: true });
        audio.addEventListener('error', finish, { once: true });
        audio.addEventListener('stalled', finish, { once: true });
        audio.addEventListener('abort', finish, { once: true });
        audio.addEventListener('suspend', finish, { once: true });
        audio.load();
    });
}

function updateLoadingProgress(percentage, message) {
    const safePercentage = Math.max(0, Math.min(100, Math.round(percentage)));
    loadingProgressFill.style.width = `${safePercentage}%`;
    loadingPercentage.innerText = `${safePercentage}%`;
    if (message) {
        loadingStatus.innerText = message;
    }
}

async function animateProgress(toPercentage, durationMs, message) {
    const current = Number(loadingProgressFill.style.width.replace('%', '')) || 0;
    const target = Math.max(current, Math.min(100, Math.round(toPercentage)));
    const distance = target - current;
    if (distance <= 0) {
        updateLoadingProgress(target, message);
        return;
    }

    const steps = Math.max(1, Math.round(durationMs / 30));
    for (let step = 1; step <= steps; step++) {
        const nextValue = current + ((distance * step) / steps);
        updateLoadingProgress(nextValue, message);
        await new Promise((resolve) => setTimeout(resolve, Math.max(16, durationMs / steps)));
    }
}

function hasPreloadCache() {
    return localStorage.getItem(PRELOAD_CACHE_KEY) === 'ready';
}

function markPreloadCache() {
    localStorage.setItem(PRELOAD_CACHE_KEY, 'ready');
}

async function preloadCriticalAssets() {
    if (hasPreloadCache()) {
        await animateProgress(100, 420, 'Recursos locais encontrados. Pronto para iniciar.');
        return;
    }

    updateLoadingProgress(0, 'Preparando recursos da missão...');
    let completedAssets = 0;
    const totalAssets = CRITICAL_ASSETS.length;

    const loadTasks = CRITICAL_ASSETS.map(async (asset) => {
        const lowerAsset = asset.toLowerCase();

        if (lowerAsset.endsWith('.mp4')) {
            await loadVideoAsset(asset);
        } else if (lowerAsset.endsWith('.mp3') || lowerAsset.endsWith('.wav')) {
            await loadAudioAsset(asset);
        } else {
            await loadImageAsset(asset);
        }

        completedAssets += 1;
        updateLoadingProgress((completedAssets / totalAssets) * 100, `Carregando recursos... (${completedAssets}/${totalAssets})`);
    });

    await Promise.all(loadTasks);
    markPreloadCache();
}

function unlockExperienceStart() {
    loadingCompleted = true;
    btnStartAfterLoading.classList.remove('hidden');
    loadingStatus.innerText = 'Tudo pronto. Clique em INICIAR MISSÃO.';
}

async function startExperience() {
    if (!loadingCompleted) return;
    await unlockAudioOnGesture();
    loadingScreen.classList.add('hidden');
    playIntroByIndex(0);
}

async function bootstrapApplication() {
    initializeAudioSettings();
    setupAudioUnlockListeners();
    updateLoadingProgress(0);
    await preloadCriticalAssets();
    unlockExperienceStart();
}

// Inicialização
window.addEventListener('load', () => {
    bootstrapApplication();
});
btnStartAfterLoading.onclick = startExperience;

introVideo.onended = handleIntroEnded;
introVideo.onerror = handleIntroError;
document.getElementById('skip-intro').onclick = skipCurrentIntroSegment;
continueScreen.onclick = openMainMenu;

function initializeAudioSettings() {
    const savedPreference = localStorage.getItem(MASTER_AUDIO_PREF_KEY);
    if (!isMaster) {
        isMasterAudioEnabled = true;
        return;
    }
    isMasterAudioEnabled = savedPreference !== 'false';
}

function skipCurrentIntroSegment() {
    introVideo.pause();
    handleIntroEnded();
}

async function unlockAudioOnGesture() {
    if (audioUnlockedByGesture) return;
    const audiosToUnlock = [backgroundAudio, correctAnswerAudio, startRoundAudio];
    let unlockedCount = 0;

    await Promise.all(audiosToUnlock.map(async (audio) => {
        const originalMuted = audio.muted;
        const originalVolume = audio.volume;

        try {
            audio.muted = true;
            audio.volume = 0;
            audio.currentTime = 0;
            await audio.play();
            audio.pause();
            audio.currentTime = 0;
            unlockedCount += 1;
        } catch (_) {
            // Ignora bloqueios de navegador. Novas tentativas ocorrerão em interações futuras.
        } finally {
            audio.muted = originalMuted;
            audio.volume = originalVolume;
        }
    }));

    audioUnlockedByGesture = unlockedCount === audiosToUnlock.length;
}

function setupAudioUnlockListeners() {
    const tryUnlock = async () => {
        await unlockAudioOnGesture();
        if (audioUnlockedByGesture) {
            document.removeEventListener('pointerdown', tryUnlock);
            document.removeEventListener('keydown', tryUnlock);
        }
    };

    document.addEventListener('pointerdown', tryUnlock);
    document.addEventListener('keydown', tryUnlock);
}

function ensureBackgroundAudio() {
    if (!isMasterAudioEnabled) return;
    backgroundAudio.muted = false;
    backgroundAudio.volume = getBackgroundAudioVolume();

    backgroundAudio.play().catch(() => {
        // Pode falhar sem interação do usuário em alguns navegadores.
    });
}

function getBackgroundAudioVolume() {
    const isInGame = !mainMenu.classList.contains('hidden') ? false : (!masterScreen.classList.contains('hidden') || !playerScreen.classList.contains('hidden'));
    return isInGame ? GAME_AUDIO_VOLUME : MENU_AUDIO_VOLUME;
}

function playIntroByIndex(index) {
    if (!INTRO_PLAYLIST[index]) {
        showMainMenu();
        return;
    }

    currentIntroIndex = index;
    introVideo.src = encodeURI(INTRO_PLAYLIST[currentIntroIndex]);
    introVideo.muted = false;
    introVideo.load();
    introVideo.play().catch(() => {
        // Alguns navegadores bloqueiam autoplay com áudio.
        // Tentamos reprodução silenciosa para garantir que o vídeo inicial seja exibido.
        introVideo.muted = true;
        introVideo.play().catch(() => {
            // Mantemos a tela de introdução e deixamos o usuário iniciar/ignorar manualmente.
        });
    });

    if (currentIntroIndex > 0) {
        ensureBackgroundAudio();
    }
}

function handleIntroEnded() {
    const nextIndex = currentIntroIndex + 1;
    if (INTRO_PLAYLIST[nextIndex]) {
        playIntroByIndex(nextIndex);
        return;
    }

    showMainMenu();
}

function handleIntroError() {
    const nextIndex = currentIntroIndex + 1;
    if (INTRO_PLAYLIST[nextIndex]) {
        playIntroByIndex(nextIndex);
        return;
    }

    showMainMenu();
}

function showMainMenu() {
    if (introContainer.classList.contains('hidden')) return;
    introContainer.classList.add('hidden');
    continueScreen.classList.remove('hidden');
}

function openMainMenu() {
    unlockAudioOnGesture();
    continueScreen.classList.add('hidden');
    mainMenu.classList.remove('hidden');
    ensureBackgroundAudio();
}

btnNewSim.onclick = () => {
    unlockAudioOnGesture();
    mainMenu.classList.add('hidden');
    ensureBackgroundAudio();

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

    if (!isMasterAudioEnabled) {
        stopBackgroundAudio();
    }
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
    document.getElementById('player-mode').innerText = `Rodada: ${formatMode(currentState.mode)}`;
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
                mode: 'G2',
                timer: 0,
                votes: {},
                resolvedActions: {}
            });
            return;
        }

        currentState = snapshot.val();
        if(!currentState) return;

        document.getElementById('master-mode').innerText = `Rodada: ${formatMode(currentState.mode)}`;
        const timerText = currentState.phase === 'VOTING' ? formatCountdown(currentState.timer) : '00:00';
        document.getElementById('master-timer').innerText = `TEMPO RESTANTE: ${timerText}`;

        if (currentState.phase !== 'VOTING') clearInterval(timerInterval);

        renderMasterUI();
    });

    document.getElementById('btn-start-round').onclick = startRound;
    document.getElementById('btn-next-mode').onclick = advanceMode;
    document.getElementById('btn-end-game').onclick = endGame;
    btnToggleMasterAudio.onclick = toggleMasterAudio;
}

function setupMasterAudio() {
    updateMasterAudioButtonLabel();

    if (isMasterAudioEnabled) {
        ensureBackgroundAudio();
    }
}

function stopBackgroundAudio() {
    backgroundAudio.pause();
    backgroundAudio.currentTime = 0;
}

function playEffect(audioElement) {
    if (!audioElement || !isMasterAudioEnabled) return;
    audioElement.currentTime = 0;
    audioElement.play().catch(() => {
        // Ignora bloqueios de autoplay sem interromper o fluxo do jogo.
    });
}

function updateMasterAudioButtonLabel() {
    if (!btnToggleMasterAudio) return;
    btnToggleMasterAudio.innerText = isMasterAudioEnabled ? 'Som: Ligado' : 'Som: Desligado';
}

function toggleMasterAudio() {
    isMasterAudioEnabled = !isMasterAudioEnabled;
    localStorage.setItem(MASTER_AUDIO_PREF_KEY, String(isMasterAudioEnabled));
    updateMasterAudioButtonLabel();

    if (isMasterAudioEnabled) {
        ensureBackgroundAudio();
        return;
    }

    stopBackgroundAudio();
}

function endGame() {
    clearInterval(timerInterval);
    update(ref(db, 'gameState'), { phase: 'IDLE', mode: 'G2', timer: 0, votes: {}, resolvedActions: {} });
    stopBackgroundAudio();
    resetVictoryCinematicState();
    resetFailureCinematicState();
    showMainMenuFromGame();
}

function showMainMenuFromGame() {
    masterScreen.classList.add('hidden');
    playerScreen.classList.add('hidden');
    mainMenu.classList.remove('hidden');
    ensureBackgroundAudio();
}

function startRound() {
    hasTriggeredVictoryCinematic = false;
    hasTriggeredFailureCinematic = false;
    resetVictoryCinematicState();
    resetFailureCinematicState();
    playEffect(startRoundAudio);
    update(ref(db, 'gameState'), { phase: 'VOTING', timer: 120, votes: {}, resolvedActions: {} });
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

    if (currentState.mode === 'G2') nextMode = 'G1';
    else if (currentState.mode === 'G1') nextMode = 'G3';
    else {
        nextPhase = 'END';
        alert("Missão concluída com sucesso! Jogo finalizado.");
    }

    clearInterval(timerInterval);
    hasTriggeredVictoryCinematic = false;
    hasTriggeredFailureCinematic = false;
    resetVictoryCinematicState();
    resetFailureCinematicState();
    update(ref(db, 'gameState'), { phase: nextPhase, mode: nextMode, timer: 0, votes: {}, resolvedActions: {} });
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
            const isActionResolved = Boolean(currentState.resolvedActions && currentState.resolvedActions[actionKey]);
            btn.disabled = isActionResolved;

            // Apenas o Mestre pode "Executar" a ação
            btn.onclick = () => resolveAction(actionKey, opt);
            grid.appendChild(btn);
        });

        card.appendChild(grid);
        masterDashboard.appendChild(card);
    });
}

function resolveAction(actionKey, optionData) {
    const isMasterExecutionPhase = currentState.phase === 'VOTING' || currentState.phase === 'RESOLUTION';
    if (!isMasterExecutionPhase) return;

    if (currentState.resolvedActions && currentState.resolvedActions[actionKey]) {
        return;
    }

    if (!optionData.correct) {
        update(ref(db, 'gameState'), { phase: 'END', timer: 0 });
        playFailureCinematic(optionData.failMsg);
    } else {
        playEffect(correctAnswerAudio);
        const nextResolvedActions = {
            ...(currentState.resolvedActions || {}),
            [actionKey]: true
        };

        update(ref(db, 'gameState'), { resolvedActions: nextResolvedActions });

        const totalActions = Object.keys(GAME_DATA).length;
        const totalResolved = Object.keys(nextResolvedActions).length;
        const isLastCorrectDecisionOfDecentralizedRound = currentState.mode === 'G3' && totalResolved === totalActions;

        if (isLastCorrectDecisionOfDecentralizedRound) {
            update(ref(db, 'gameState'), { phase: 'RESOLUTION', timer: 0 });
            playVictoryCinematic();
            return;
        }

        alert(optionData.successMsg || "Ação executada com sucesso. Prossiga para as demais.");
    }
}

function playVictoryCinematic() {
    if (hasTriggeredVictoryCinematic) return;
    hasTriggeredVictoryCinematic = true;
    document.body.classList.add('app-frozen');

    setTimeout(() => {
        victoryCinematic.classList.remove('hidden');
        victoryCinematic.classList.remove('fade-out', 'darkened');
        requestAnimationFrame(() => {
            victoryCinematic.classList.add('active');
        });

        victoryVideo.currentTime = 0;
        victoryVideo.onended = finishVictoryCinematic;
        victoryVideo.onerror = finishVictoryCinematic;
        victoryVideo.play().catch(() => {
            finishVictoryCinematic();
        });
    }, VICTORY_FREEZE_MS);
}

function finishVictoryCinematic() {
    if (!hasTriggeredVictoryCinematic) return;

    victoryCinematic.classList.add('fade-out');
    setTimeout(() => {
        victoryCinematic.classList.add('darkened');
        resetVictoryVideoPlayback();
        document.body.classList.remove('app-frozen');
        update(ref(db, 'gameState'), { phase: 'END', timer: 0 });
        showResultModal({
            title: 'SUCESSO TOTAL',
            message: 'Missão concluída com sucesso no round Descentralizado.',
            buttonText: 'Voltar ao menu',
            onButtonClick: () => {
                document.getElementById('result-modal').classList.add('hidden');
                showMainMenuFromGame();
            }
        });
    }, VICTORY_FADE_MS);
}

function playFailureCinematic(message) {
    if (hasTriggeredFailureCinematic) return;
    hasTriggeredFailureCinematic = true;
    document.body.classList.add('app-frozen');

    failureCinematic.classList.remove('hidden');
    failureCinematic.classList.remove('fade-out', 'darkened');
    requestAnimationFrame(() => {
        failureCinematic.classList.add('active');
    });

    failureVideo.currentTime = 0;
    failureVideo.onended = () => finishFailureCinematic(message);
    failureVideo.onerror = () => finishFailureCinematic(message);
    failureVideo.play().catch(() => {
        finishFailureCinematic(message);
    });
}

function finishFailureCinematic(message) {
    failureCinematic.classList.add('fade-out');
    setTimeout(() => {
        failureCinematic.classList.add('darkened');
        resetFailureVideoPlayback();
        document.body.classList.remove('app-frozen');
        showResultModal({
            title: 'FALHA CRÍTICA',
            message,
            buttonText: 'Fechar e Tentar Novamente',
            onButtonClick: () => {
                document.getElementById('result-modal').classList.add('hidden');
                advanceMode();
            }
        });
    }, FAILURE_FADE_MS);
}

function resetVictoryVideoPlayback() {
    victoryVideo.pause();
    victoryVideo.currentTime = 0;
    victoryVideo.onended = null;
    victoryVideo.onerror = null;
}

function resetFailureVideoPlayback() {
    failureVideo.pause();
    failureVideo.currentTime = 0;
    failureVideo.onended = null;
    failureVideo.onerror = null;
}

function resetVictoryCinematicState() {
    document.body.classList.remove('app-frozen');
    victoryCinematic.classList.add('hidden');
    victoryCinematic.classList.remove('active', 'fade-out', 'darkened');
    resetVictoryVideoPlayback();
}

function resetFailureCinematicState() {
    document.body.classList.remove('app-frozen');
    failureCinematic.classList.add('hidden');
    failureCinematic.classList.remove('active', 'fade-out', 'darkened');
    resetFailureVideoPlayback();
}

function showResultModal({ title, message, buttonText, onButtonClick }) {
    document.getElementById('result-title').innerText = title;
    document.getElementById('result-message').innerText = message;
    const btnClose = document.getElementById('btn-close-result');
    btnClose.innerText = buttonText;
    btnClose.onclick = onButtonClick;
    btnClose.classList.remove('hidden');

    document.getElementById('result-modal').classList.remove('hidden');
}
