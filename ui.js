// Arquivo: ui.js
import { GAME_CONFIG as CFG } from "./config.js";
import {
  makeInitialState,
  resetForNewMode,
  startVotingRound,
  tickVoting,
  submitVote,
  resolveResponsibility,
  getVoteSummaryForResponsibility,
  formatLogForUI,
} from "./engine.js";
import { db, ref, set, onValue, onChildAdded, push, remove } from "./db.js";

const params = new URLSearchParams(window.location.search);
const isMaster = params.get("master") === "true";

// Extrai o papel da URL ou define como comando por padrão
const validRoles = ["comando", "negociador", "cabine", "esquadrao_antibomba"];
let rawRole = (params.get("role") || "comando").toLowerCase();
const myRole = validRoles.includes(rawRole) ? rawRole : "comando";

const DB = { gameState: "gameState", phaseInfo: "phaseInfo", inputs: "inputs" };
const RESPONSIBILITIES = Object.keys(CFG.responsibilities);
const MODE_ORDER = ["G1", "G2", "G3"];

let state = makeInitialState();
let running = false;
let timer = null;
let selectedResponsibility = CFG.roles[myRole].responsibility;
let selectedAction = null;
let masterSelectedResponsibility = "command";
let masterSelectedAction = null;
let introShownInRound = false;
let pendingRoundStart = false;

// Controle de transição automática de rodada
let pendingAutoAdvance = false;

function normalizeStateShape(nextState) {
  const fresh = makeInitialState();
  const merged = { ...fresh, ...(nextState || {}) };
  merged.roundInfo = {
    ...fresh.roundInfo,
    ...(nextState?.roundInfo || {}),
    resolved: { ...fresh.roundInfo.resolved, ...(nextState?.roundInfo?.resolved || {}) },
  };
  merged.votes = { ...fresh.votes, ...(nextState?.votes || {}) };
  merged.stats = { ...fresh.stats, ...(nextState?.stats || {}) };
  merged.log = Array.isArray(nextState?.log) ? nextState.log : [];
  return merged;
}

const OBJECTIVES_TEXT = `\
Rodada 1 (Modo G1) — Hierarquia Total:
Apenas o COMANDO vota e decide as ações de todas as 4 áreas.
Objetivo: testar a capacidade de decisão centralizada sob pressão extrema.

Rodada 2 (Modo G2) — Decisão Coletiva:
TODA A EQUIPE pode votar nas 4 áreas.
Objetivo: avaliar o alinhamento. Cuidado: votos divergentes na mesma área geram conflito no relatório!

Rodada 3 (Modo G3) — Especialização:
Cada agente vota APENAS na sua própria área de atuação.
Objetivo: consolidar a confiança na autonomia técnica de cada especialista da equipe.`;

const INSTRUCTIONS_TEXT = `\
MANUAL DE OPERAÇÕES DE CRISE:
Lembre-se: O terrorista está altamente nervoso. Evite abordagens que causem susto, confronto desnecessário ou barulho.

Comando: Impeça a ação sem alertar o suspeito.
Negociador: Foque na estabilidade emocional, ele não quer trocas ou sermões.
Cabine: Evite movimentos bruscos dos passageiros.
Esquadrão Antibomba: Cortes exatos. Nada de chutes ou botões desconhecidos.`;

const STORYTELLING_TEXT = `\
Atenção Equipe!
O voo para Brasília foi comprometido. O suspeito está nervoso, instável e segura um detonador.
Qualquer erro de cálculo e perderemos a aeronave. 
Acessem seus painéis táticos e decidam as abordagens para as 4 áreas críticas. Boa sorte, a vida de todos depende de vocês.`;

const $ = (id) => document.getElementById(id);
const ui = {
  bootScreen: $("bootScreen"),
  gameScreen: $("gameScreen"),
  loadingStatus: $("loadingStatus"),
  startExperienceBtn: $("startExperienceBtn"),
  objectivesBtn: $("objectivesBtn"),
  instructionsBtn: $("instructionsBtn"),
  modeBadge: $("modeBadge"),
  phase: $("phase"),
  round: $("round"),
  timer: $("timer"),
  cockpitTitle: $("cockpitTitle"),
  myRoleImage: $("myRoleImage"),
  myRoleLabel: $("myRoleLabel"),
  modeHint: $("modeHint"),
  characterChoiceLabel: $("characterChoiceLabel"),
  actionChoiceLabel: $("actionChoiceLabel"),
  roleChoice: $("roleChoice"),
  actionButtons: $("actionButtons"),
  submitBtn: $("submitBtn"),
  startBtn: $("startBtn"),
  resetBtn: $("resetBtn"),
  masterCockpitControls: $("masterCockpitControls"),
  masterVotes: $("masterVotes"),
  masterVotesCard: $("masterVotesCard"),
  masterRespButtons: $("masterRespButtons"),
  masterActionButtons: $("masterActionButtons"),
  masterExecuteBtn: $("masterExecuteBtn"),
  masterEndTimeBtn: $("masterEndTimeBtn"),
  masterNextModeBtn: $("masterNextModeBtn"),
  log: $("log"),
  popup: $("statusPopup"),
  popupTitle: $("popupTitle"),
  popupMessage: $("popupMessage"),
  popupCloseBtn: $("popupCloseBtn"),
};

function show(screenId) {
  [ui.bootScreen, ui.gameScreen].forEach((s) => s?.classList.remove("active"));
  $(screenId)?.classList.add("active");
}

function showPopup(title, message) {
  ui.popupTitle.textContent = title;
  ui.popupMessage.textContent = message;
  ui.popup.classList.add("active");
}

function hidePopup() {
  ui.popup.classList.remove("active");

  if (pendingRoundStart && isMaster && state.phase === "IDLE") {
    pendingRoundStart = false;
    runTimerLoop();
  }

  // Avanço automático de rodada após o Mestre fechar o aviso de Fim de Jogo/Falha
  if (pendingAutoAdvance && isMaster) {
    pendingAutoAdvance = false;
    nextMode();
  }
}

function canRoleVote(role, responsibility) {
  if (state.mode === "G1") return role === "comando";
  if (state.mode === "G2") return true;
  return CFG.roles[role].responsibility === responsibility;
}

function publishState() {
  return set(ref(db, DB.gameState), JSON.parse(JSON.stringify(state)));
}

function publishPhase() {
  return set(ref(db, DB.phaseInfo), {
    mode: state.mode,
    phase: state.phase,
    round: state.round,
    timeLeft: state.roundInfo.timeLeft,
    waitingForResult: state.waitingForResult,
    gameOver: state.gameOver,
    lastFailure: state.lastFailure ?? null,
  });
}

function modeHint() {
  if (state.mode === "G1") return "Rodada 1 (G1): Apenas o COMANDO vota em tudo.";
  if (state.mode === "G2") return "Rodada 2 (G2): Todos votam em tudo.";
  return "Rodada 3 (G3): Cada agente vota na sua própria área.";
}

function renderRoleChoice() {
  ui.roleChoice.innerHTML = "";
  const allowed = state.mode === "G2" || (state.mode === "G1" && myRole === "comando");
  const ownResponsibility = CFG.roles[myRole].responsibility;

  if (state.mode === "G3") selectedResponsibility = ownResponsibility;
  if (!RESPONSIBILITIES.includes(selectedResponsibility)) selectedResponsibility = ownResponsibility;

  RESPONSIBILITIES.forEach((resp) => {
    const btn = document.createElement("button");
    btn.className = `btn ${selectedResponsibility === resp ? "active" : ""}`;
    btn.textContent = CFG.responsibilities[resp].menuTitle;
    btn.disabled = !allowed;
    btn.addEventListener("click", () => {
      selectedResponsibility = resp;
      selectedAction = null;
      render();
    });
    ui.roleChoice.appendChild(btn);
  });
}

function renderActions() {
  ui.actionButtons.innerHTML = "";
  const actions = CFG.responsibilities[selectedResponsibility].actions;

  Object.entries(actions).forEach(([actionId, def]) => {
    const btn = document.createElement("button");
    btn.className = `btn ${selectedAction === actionId ? "active" : ""}`;
    btn.textContent = def.label;
    btn.addEventListener("click", () => {
      selectedAction = actionId;
      renderActions();
      renderSubmitBtn();
    });
    ui.actionButtons.appendChild(btn);
  });
}

function renderMasterVotes() {
  if (!isMaster) {
    ui.masterVotesCard.style.display = "none";
    return;
  }

  const blocks = RESPONSIBILITIES.map((resp) => {
    const summary = getVoteSummaryForResponsibility(state, resp);
    const actions = summary.actions
      .map((a) => {
        const label = CFG.responsibilities[resp].actions[a.actionId].label;
        return `<div style="margin-bottom: 4px;">- ${label}: <b style="color:var(--stamp-red)">${a.votes}</b> votos (${a.pct}%)</div>`;
      })
      .join("");

    return `<div class="card" style="margin-bottom:12px; border-color: var(--ink);">
      <b style="color: var(--stamp-red); text-transform: uppercase;">${CFG.responsibilities[resp].label}</b>
      <div style="margin-bottom: 8px;"><small>Área: ${CFG.responsibilities[resp].menuTitle}</small></div>
      <div>${actions || "<i>Nenhuma interceptação de voto.</i>"}</div>
    </div>`;
  }).join("");

  ui.masterVotes.innerHTML = blocks;
}

function renderMasterSelectors() {
  if (!isMaster) return;

  const activeResp = state.roundInfo.activeResponsibility || RESPONSIBILITIES[0];
  const unresolved = RESPONSIBILITIES.filter((resp) => !state.roundInfo.resolved[resp]);

  if (state.phase === "RESOLUTION") {
    if (!unresolved.includes(masterSelectedResponsibility)) {
      masterSelectedResponsibility = unresolved[0] || activeResp;
    }
  } else if (!RESPONSIBILITIES.includes(masterSelectedResponsibility)) {
    masterSelectedResponsibility = activeResp;
  }

  ui.masterRespButtons.innerHTML = RESPONSIBILITIES.map((resp) => `
    <button class="btn ${masterSelectedResponsibility === resp ? "active" : ""}" data-master-resp="${resp}" ${state.roundInfo.resolved[resp] ? "disabled" : ""}>${CFG.responsibilities[resp].label}</button>
  `).join("");

  ui.masterRespButtons.querySelectorAll("[data-master-resp]").forEach((btn) => {
    btn.addEventListener("click", () => {
      masterSelectedResponsibility = btn.dataset.masterResp;
      masterSelectedAction = null;
      renderMasterSelectors();
    });
  });

  updateMasterActionOptions();
}

function updateMasterActionOptions() {
  const resp = masterSelectedResponsibility;
  const actions = CFG.responsibilities[resp].actions;
  const summary = getVoteSummaryForResponsibility(state, resp);
  const winner = summary.actions[0]?.actionId || Object.keys(actions)[0];

  if (!masterSelectedAction || !actions[masterSelectedAction]) masterSelectedAction = winner;

  ui.masterActionButtons.innerHTML = Object.entries(actions)
    .map(([id, def]) => `<button class="btn ${masterSelectedAction === id ? "active" : ""}" data-master-action="${id}">${def.label}</button>`)
    .join("");

  ui.masterActionButtons.querySelectorAll("[data-master-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      masterSelectedAction = btn.dataset.masterAction;
      renderMasterSelectors();
    });
  });
}

function renderSubmitBtn() {
  const canVote = canRoleVote(myRole, selectedResponsibility) && state.phase === "VOTING" && !state.gameOver;
  ui.submitBtn.style.display = isMaster ? "none" : "inline-block";
  ui.submitBtn.disabled = !canVote || !selectedAction || state.phase === "RESOLUTION" || state.phase === "END";
}

function render() {
  ui.modeBadge.textContent = state.mode;
  ui.phase.textContent = state.phase;
  ui.round.textContent = String(state.round);
  ui.timer.textContent = String(Math.ceil(state.roundInfo.timeLeft));

  const roleCfg = CFG.roles[myRole];
  if (ui.myRoleImage) ui.myRoleImage.src = isMaster ? "master-icon.png" : roleCfg.image;
  ui.myRoleLabel.textContent = isMaster ? "Comando Central (Mestre)" : `${roleCfg.label} (Agente em campo)`;
  ui.cockpitTitle.textContent = isMaster ? "Painel Geral da Operação" : `Dossiê: ${roleCfg.label}`;
  ui.modeHint.textContent = modeHint();

  renderRoleChoice();
  renderActions();
  renderSubmitBtn();
  renderMasterVotes();
  renderMasterSelectors();

  ui.startBtn.style.display = isMaster ? "inline-block" : "none";
  ui.resetBtn.style.display = isMaster ? "inline-block" : "none";
  
  ui.roleChoice.style.display = isMaster ? "none" : "grid";
  ui.actionButtons.style.display = isMaster ? "none" : "grid";
  ui.characterChoiceLabel.style.display = isMaster ? "none" : "block";
  ui.actionChoiceLabel.style.display = isMaster ? "none" : "block";
  ui.masterCockpitControls.style.display = isMaster ? "block" : "none";

  if (isMaster) {
    ui.masterExecuteBtn.disabled = state.phase !== "RESOLUTION" || state.gameOver;
    ui.masterExecuteBtn.textContent = state.phase === "RESOLUTION" ? "Validar Execução Tática" : "Aguarde os votos para executar";
    if (ui.masterEndTimeBtn) ui.masterEndTimeBtn.disabled = state.phase !== "VOTING" || state.gameOver;
    if (ui.masterNextModeBtn) ui.masterNextModeBtn.disabled = state.phase === "VOTING";
  }

  if (!isMaster && state.waitingForResult && state.phase === "RESOLUTION" && !state.gameOver) {
    showPopup("Ações em Progresso", "Sua equipe já decidiu. Aguarde o Mestre validar as operações no painel principal.");
  }

  ui.log.innerHTML = state.log.slice(-30).map(formatLogForUI).map((l) => `<div class="${l.cls}">${l.text}</div>`).join("");
}

async function processInput(payload) {
  const result = submitVote(state, payload);
  if (!result.ok) return result;
  await publishState();
  await publishPhase();
  return result;
}

function bindRealtime() {
  onValue(ref(db, DB.gameState), (snap) => {
    const v = snap.val();
    if (!v) return;
    state = normalizeStateShape(v);
    render();
  });

  onValue(ref(db, DB.phaseInfo), (snap) => {
    const v = snap.val();
    if (!v || isMaster) return;
    state.phase = v.phase;
    state.round = v.round;
    state.roundInfo.timeLeft = v.timeLeft;
    state.waitingForResult = !!v.waitingForResult;
    state.gameOver = !!v.gameOver;
    state.lastFailure = v.lastFailure || null;
    state.mode = v.mode || state.mode;

    if (state.gameOver && state.lastFailure) {
      showPopup("OPERAÇÃO FALHOU", state.lastFailure);
    }

    render();
  });

  if (isMaster) {
    onChildAdded(ref(db, DB.inputs), async (snap) => {
      const val = snap.val();
      if (!val) return;
      await processInput(val);
      await remove(ref(db, `${DB.inputs}/${snap.key}`));
    });
  }
}

async function runTimerLoop() {
  if (!isMaster || running) return;
  running = true;
  startVotingRound(state);
  await publishState();
  await publishPhase();
  render();

  timer = setInterval(async () => {
    tickVoting(state, 1);
    await publishState();
    await publishPhase();
    render();

    if (state.phase !== "VOTING" || state.gameOver) {
      clearInterval(timer);
      timer = null;
      running = false;
    }
  }, 1000);
}

async function startRoundWithStorytelling() {
  if (!isMaster || running || state.phase === "VOTING") return;
  if (!introShownInRound) {
    showPopup("Briefing da Missão", STORYTELLING_TEXT);
    introShownInRound = true;
    pendingRoundStart = true;
    return;
  }
  await runTimerLoop();
}

async function forceEndVotingNow() {
  if (!isMaster || state.phase !== "VOTING") return;
  tickVoting(state, state.roundInfo.timeLeft || 0);
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  running = false;
  await publishState();
  await publishPhase();
  render();
}

async function nextMode() {
  if (!isMaster || state.phase === "VOTING") return;
  const idx = MODE_ORDER.indexOf(state.mode);
  const next = MODE_ORDER[(idx + 1) % MODE_ORDER.length];
  
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  running = false;
  resetForNewMode(state, next);
  introShownInRound = false;
  masterSelectedResponsibility = "command";
  masterSelectedAction = null;
  await remove(ref(db, DB.inputs));
  await publishState();
  await publishPhase();
  render();
}

function bindUI() {
  ui.popupCloseBtn?.addEventListener("click", hidePopup);
  ui.startExperienceBtn?.addEventListener("click", () => show("gameScreen"));
  ui.objectivesBtn?.addEventListener("click", () => showPopup("Dossiê da Missão", OBJECTIVES_TEXT));
  ui.instructionsBtn?.addEventListener("click", () => showPopup("Manual de Crise", INSTRUCTIONS_TEXT));

  ui.submitBtn?.addEventListener("click", async () => {
    if (isMaster || !selectedAction) return;
    if (state.phase !== "VOTING" || state.gameOver) {
      showPopup("Sistema bloqueado", "As comunicações não estão ativas neste momento.");
      return;
    }

    const payload = {
      playerRole: myRole,
      responsibility: selectedResponsibility,
      actionId: selectedAction,
      sentAt: Date.now(),
    };

    await push(ref(db, DB.inputs), payload);
    showPopup("Voto Interceptado", "Sua decisão foi enviada para o comando central do Mestre.");
    render();
  });

  ui.masterExecuteBtn?.addEventListener("click", async () => {
    if (!isMaster || state.phase !== "RESOLUTION") return;
    const responsibility = masterSelectedResponsibility;
    const actionId = masterSelectedAction;
    if (!responsibility || !actionId) return;
    
    const result = resolveResponsibility(state, responsibility, actionId);
    
    if (!result.ok) {
      showPopup("Erro Tático", result.reason || "Não é possível executar isso agora.");
      return;
    }
    
    await publishState();
    await publishPhase();
    render();

    if (result.failed) {
      pendingAutoAdvance = true; 
      showPopup("FALHA NA OPERAÇÃO", `${state.lastFailure}\n\nO avião sofreu danos críticos. A rodada atual foi perdida. Reagrupando equipe para nova dinâmica tática.`);
      return;
    }

    if (result.completedAllResponsibilities) {
      pendingAutoAdvance = true; 
      if (state.mode === "G3") {
         showPopup("MISSÃO CUMPRIDA!", "A equipe agiu de forma impecável. Terrorista contido e bomba desarmada sem nenhuma baixa.\n\nFim de jogo. Parabéns a todos!");
         pendingAutoAdvance = false; 
      } else {
         showPopup("RODADA CON
