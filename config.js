// Arquivo: config.js

export const GAME_CONFIG = {
  version: "1.0.0", // Versão inicial do novo repositório Skyaut
  roundDurationSec: 120, // 2 minutos
  maxRounds: 3, // G1, G2 e G3

  // Mapeamento dos perfis/personagens baseados nas URLs
  roles: {
    comando: { label: "Comando", image: "dossier-comando.png", responsibility: "command" },
    negociador: { label: "Negociador", image: "dossier-negociador.png", responsibility: "negotiator" },
    cabine: { label: "Cabine", image: "dossier-cabine.png", responsibility: "cabin" },
    esquadrao_antibomba: { label: "Esquadrão Antibomba", image: "dossier-antibomba.png", responsibility: "bomb" },
  },

  // Mapeamento das Áreas (Tipos de Ação / Responsabilidades)
  responsibilities: {
    command: {
      label: "Comando",
      menuTitle: "Conter ameaça principal",
      actions: {
        rearArrest: { label: "Prisão pela retaguarda" },
        taser: { label: "Atingir com taser", failReason: "O terrorista apertou involuntariamente o detonador após o taser." },
        runGrab: { label: "Correr para agarrar", failReason: "Quando você correu o terrorista se assustou e acionou o detonador." },
        shoot: { label: "Atirar no Terrorista", failReason: "Quando você atirou o terrorista percebeu e acionou o detonador." }
      },
      correctAction: "rearArrest"
    },
    negotiator: {
      label: "Negociador",
      menuTitle: "Reduzir risco por negociação",
      actions: {
        emotional: { label: "Negociação emocional" },
        technical: { label: "Negociação técnica", failReason: "O terrorista ignorou a negociação técnica e ficou nervoso detonando a bomba." },
        trade: { label: "Negociação com base em trocas", failReason: "O terrorista não quer nada em troca e ficou agitado detonando a bomba." },
        religion: { label: "Negociação religiosa", failReason: "O terrorista não acredita em Deus, por isso detonou a bomba." }
      },
      correctAction: "emotional"
    },
    cabin: {
      label: "Cabine",
      menuTitle: "Estabilizar os passageiros",
      actions: {
        calmPassengers: { label: "Manter passageiros calmos" },
        hide: { label: "Esconder passageiros", failReason: "Movimentação brusca alertou o terrorista, ele detonou a bomba." },
        water: { label: "Levar agua para o Terrorista", failReason: "O terrorista achou que vc era uma policial disfarçada, e detonou a bomba." },
        negotiate: { label: "Tentar negociar com o Terrorista", failReason: "O terrorista cansou de se explicar e achou que era muita gente falando e detonou a bomba." }
      },
      correctAction: "calmPassengers"
    },
    bomb: {
      label: "Esquadrão Antibomba",
      menuTitle: "Neutralizar o explosivo",
      actions: {
        cutRedWire: { label: "Cortar fio vermelho" },
        cutBlackWire: { label: "Cortar fio preto", failReason: "Fio preto detonou o explosivo deste dispositivo." },
        pushOff: { label: "Apertar o botão desligar", failReason: "Apertar o botão desligar era uma das formas de detonar o explosivo." },
        kick: { label: "Chutar o dispositivo", failReason: "Chutar o dispositivo detonou o explosivo." }
      },
      correctAction: "cutRedWire"
    },
  },
};
