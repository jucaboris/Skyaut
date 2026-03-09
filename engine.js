// Arquivo: engine.js
import { GAME_CONFIG as CFG } from "./config.js";

const RESPONSIBILITIES = Object.keys(CFG.responsibilities);
const ROLES = Object.keys(CFG.roles);

function now() {
  return Date.now();
}

// Registra os eventos no Relatório Oficial da Operação
function logLine(state, text, kind = "info") {
  state.log.push({ ts: now(), kind, text });
}

function blankVoteState() {
  const votes = {};
  for (const responsibility of RESPONSIBILITIES) {
    const actionMap = {};
    const actions = CFG.responsibilities[responsibility].actions;
    for (const actionId of Object.keys(actions)) actionMap[actionId] = { total: 0, byRole: {} };
    votes[responsibility] = actionMap;
  }
  return votes;
}

function blankResolved() {
  return RESPONSIBILITIES.reduce((acc, item) => {
    acc[item] = null;
    return acc;
  }, {});
}

export function makeInitialState() {
  return {
    mode: "G1",
    phase: "IDLE", // IDLE | VOTING | RESOLUTION | END
    round: 1,
    gameOver: false,
    waitingForResult: false,
    roundInfo: {
      durationSec: CFG.roundDurationSec,
      timeLeft: CFG.roundDurationSec,
      g1LockedCommander: null,
      resolved: blankResolved(),
      activeResponsibility: "command",
    },
    votes: blankVoteState(),
    stats: { totalVotes: 0, conflictsG2: 0 },
    log: [],
    lastFailure: null,
  };
}

// Prepara a mesa para a próxima rodada/modo
export function resetForNewMode(state, mode) {
  const fresh = makeInitialState();
  state.mode = mode;
  state.phase = "IDLE";
  state.round = mode === "G1" ? 1 : mode === "G2" ? 2 : 3;
  state.gameOver = false;
  state.waitingForResult = false;
  state.roundInfo = { ...fresh.roundInfo, resolved: blankResolved() };
  state.votes = blankVoteState();
  state.stats = { totalVotes: 0, conflictsG2: 0 };
  state.log = [];
  state.lastFailure = null;
  logLine(state, `Operação atualizada: Modo ${mode} ativado.`, "warn");
}

export function startVotingRound(state) {
  state.phase = "VOTING";
  state.waitingForResult = false;
  state.roundInfo.timeLeft = CFG.roundDurationSec;
  state.roundInfo.g1LockedCommander = null;
  state.roundInfo.resolved = blankResolved();
  state.roundInfo.activeResponsibility = "command";
  state.votes = blankVoteState();
  logLine(state, `Rodada ${state.round} iniciada. Janela de decisão tática aberta (${CFG.roundDurationSec}s).`, "ok");
}

// O guardião das regras de G1, G2 e G3
function canVoteForResponsibility(state, playerRole, responsibility) {
  if (!ROLES.includes(playerRole)) return false;
  if (!RESPONSIBILITIES.includes(responsibility)) return false;

  // G1: Apenas o Comando decide tudo
  if (state.mode === "G1") {
    if (playerRole !== "comando") return false;
    return true;
  }

  // G2: Decisão Coletiva (todos votam em tudo)
  if (state.mode === "G2") return true;

  // G3: Especialização (cada um no seu quadrado)
  return CFG.roles[playerRole].responsibility === responsibility;
}

export function submitVote(state, { playerRole, responsibility, actionId }) {
  if (state.phase !== "VOTING" || state.gameOver) return { ok: false, reason: "Votação inativa no momento." };

  if (!canVoteForResponsibility(state, playerRole, responsibility)) {
    return { ok: false, reason: "blocked_by_rules" };
  }

  const respCfg = CFG.responsibilities[responsibility];
  if (!respCfg || !respCfg.actions[actionId]) return { ok: false, reason: "Ação tática inválida." };

  if (state.mode === "G1" && !state.roundInfo.g1LockedCommander) {
    state.roundInfo.g1LockedCommander = "comando";
  }

  const bucket = state.votes[responsibility][actionId];
  bucket.total += 1;
  bucket.byRole[playerRole] = (bucket.byRole[playerRole] || 0) + 1;

  state.stats.totalVotes += 1;
  logLine(state, `Agente ${CFG.roles[playerRole].label} sugeriu [${respCfg.actions[actionId].label}] para a área: ${respCfg.label}.`, "info");
  return { ok: true };
}

export function tickVoting(state, deltaSec = 1) {
  if (state.phase !== "VOTING" || state.gameOver) return;
  state.roundInfo.timeLeft = Math.max(0, state.roundInfo.timeLeft - deltaSec);

  if (state.roundInfo.timeLeft <= 0) {
    state.phase = "RESOLUTION";
    state.waitingForResult = true;
    logLine(state, "Tempo esgotado. Aguardando o Mestre confirmar as ações da equipe.", "warn");
  }
}

// Resumo dos votos para o Painel do Mestre
export function getVoteSummaryForResponsibility(state, responsibility) {
  const respVotes = state.votes[responsibility] || {};
  const total = Object.values(respVotes).reduce((sum, v) => sum + (v.total || 0), 0);
  const actions = Object.entries(respVotes).map(([actionId, obj]) => ({
    actionId,
    votes: obj.total || 0,
    pct: total > 0 ? Math.round(((obj.total || 0) / total) * 100) : 0,
  }));
  actions.sort((a, b) => b.votes - a.votes); // Ordena do mais votado para o menos
  return { total, actions };
}

function hasConflictG2(state, responsibility) {
  if (state.mode !== "G2") return false;
  const values = Object.values(state.votes[responsibility] || {});
  const votedActions = values.filter((v) => (v.total || 0) > 0).length;
  return votedActions > 1; // Se votaram em mais de uma ação diferente na mesma responsabilidade
}

// O momento da verdade: Mestre executa a ação
export function resolveResponsibility(state, responsibility, actionId) {
  if (state.phase !== "RESOLUTION" || state.gameOver) return { ok: false, reason: "Execução indisponível no momento." };
  if (!RESPONSIBILITIES.includes(responsibility)) return { ok: false, reason: "Área de atuação inválida." };
  if (state.roundInfo.resolved[responsibility]) return { ok: false, reason: "Esta área já foi resolvida." };

  const cfg = CFG.responsibilities[responsibility];
  if (!cfg.actions[actionId]) return { ok: false, reason: "Ação inválida." };

  if (hasConflictG2(state, responsibility)) {
    state.stats.conflictsG2 += 1;
    logLine(state, `[ALERTA] Divergência na equipe detectada em: ${cfg.label}.`, "warn");
  }

  const correct = cfg.correctAction === actionId;
  const pickedLabel = cfg.actions[actionId].label;

  state.roundInfo.resolved[responsibility] = {
    actionId,
    correct,
    at: now(),
  };

  // Se o Mestre errar a ação...
  if (!correct) {
    state.phase = "END";
    state.gameOver = true;
    state.lastFailure = cfg.actions[actionId].failReason || "Falha crítica não catalogada.";
    logLine(state, `[FALHA CRÍTICA] Decisão incorreta executada em ${cfg.label}: ${pickedLabel}. ${state.lastFailure}`, "bad");
    return { ok: true, failed: true, completedAllResponsibilities: false };
  }

  logLine(state, `[SUCESSO] Área contornada: ${cfg.label} -> ${pickedLabel}.`, "ok");

  const pending = RESPONSIBILITIES.find((r) => !state.roundInfo.resolved[r]);
  state.roundInfo.activeResponsibility = pending || null;

  // Se acertou todas as responsabilidades...
  if (!pending) {
    state.waitingForResult = false;
    const completedAllResponsibilities = true;
    
    state.phase = "END";
    state.gameOver = true; 
    logLine(state, `[VITÓRIA NA RODADA] Todas as ameaças da rodada ${state.round} foram neutralizadas!`, "ok");

    return { ok: true, failed: false, completedAllResponsibilities };
  }

  return { ok: true, failed: false, completedAllResponsibilities: false };
}

export function formatLogForUI(item) {
  const cls = item.kind === "ok" ? "ok" : item.kind === "warn" ? "warn" : item.kind === "bad" ? "bad" : "";
  return { cls, text: item.text };
}
