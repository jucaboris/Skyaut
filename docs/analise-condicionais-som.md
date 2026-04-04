# Análise das condicionais de Som

## Visão geral
O projeto possui controle de áudio focado na trilha de fundo (`trilha.mp3`) e nos vídeos (intro, vitória e falha).

## Condicionais por tipo de usuário

### 1) Mestre (`?master=true`)
- O estado de som é lido do `localStorage` em `initializeAudioSettings()`.
- Se não houver preferência salva como `'false'`, o áudio inicia **ligado por padrão**.
- O botão **Som: Ligado/Desligado** aparece apenas na tela do mestre e alterna:
  - flag `isMasterAudioEnabled`
  - persistência em `localStorage`
  - execução/parada da trilha.

### 2) Jogadores (`?role=...`)
- A trilha de fundo fica habilitada por padrão (`isMasterAudioEnabled = true`).
- Não há botão de mute dedicado na interface do jogador.

## Condicionais por momento do jogo

### Boot / carregamento
- `bootstrapApplication()` chama `initializeAudioSettings()` antes do preload.
- O preload carrega também `trilha.mp3` via `loadAudioAsset()` quando o asset termina com `.mp3`.

### Intro
- `playIntroByIndex()` tenta tocar vídeo com áudio (`muted = false`).
- Se autoplay com som falhar, cai no fallback silencioso (`muted = true`).
- Quando entra no 2º vídeo da intro (`currentIntroIndex > 0`), tenta iniciar trilha de fundo com `ensureBackgroundAudio()`.

### Tela de menu / navegação
- `openMainMenu()` chama `ensureBackgroundAudio()`.
- `btnNewSim` (ao iniciar simulação) também chama `ensureBackgroundAudio()`.
- `showMainMenuFromGame()` chama `ensureBackgroundAudio()` ao voltar para menu.
- `showContinueScreen()` só força parada da trilha se `isMasterAudioEnabled` estiver false.

### Tela in-game (master/player)
- `ensureBackgroundAudio()` ajusta volume dinamicamente por contexto:
  - Menu: `MENU_AUDIO_VOLUME` (0.5)
  - Em jogo (master/player screen visível): `GAME_AUDIO_VOLUME` (0.025)

### Fim de jogo e controle explícito
- `toggleMasterAudio()`:
  - se ligar: chama `ensureBackgroundAudio()`
  - se desligar: chama `stopBackgroundAudio()`
- `endGame()` sempre chama `stopBackgroundAudio()` antes de voltar ao menu.

## Regras centrais de decisão de som
1. **Gate global**: `ensureBackgroundAudio()` retorna imediatamente quando `isMasterAudioEnabled` é false.
2. **Volume contextual**: `getBackgroundAudioVolume()` decide volume de menu vs jogo pela visibilidade de telas.
3. **Autoplay resiliente**: intro tenta com áudio e, em bloqueio do browser, tenta novamente mutado.
4. **Persistência somente do mestre**: preferência é salva em `skyaut-master-audio-enabled`.

## Observações
- Vídeos de vitória/falha não possuem condicional de mute dedicada no código atual; eles apenas executam `play()` e fazem fallback para continuar fluxo caso falhe.
- O texto do botão do mestre é atualizado por `updateMasterAudioButtonLabel()`.
