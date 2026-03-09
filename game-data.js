export const GAME_DATA = {
    conter_ameaca: {
        label: "Conter ameaça principal",
        options: [
            { id: "opt1", text: "Prisão pela retaguarda", correct: true },
            { id: "opt2", text: "Atingir com taser", failMsg: "O terrorista apertou involuntariamente o detonador após o taser.", correct: false },
            { id: "opt3", text: "Correr para agarrar", failMsg: "Quando você correu o terrorista se assustou e acionou o detonador.", correct: false },
            { id: "opt4", text: "Atirar no Terrorista", failMsg: "Quando você atirou o terrorista percebeu e acionou o detonador.", correct: false }
        ]
    },
    reduzir_risco: {
        label: "Reduzir risco por negociação",
        options: [
            { id: "opt1", text: "Negociação emocional", correct: true },
            { id: "opt2", text: "Negociação técnica", failMsg: "O terrorista ignorou a negociação técnica e ficou nervoso detonando a bomba.", correct: false },
            { id: "opt3", text: "Negociação com base em trocas", failMsg: "O terrorista não quer nada em troca e ficou agitado detonando a bomba.", correct: false },
            { id: "opt4", text: "Negociação religiosa", failMsg: "O terrorista não acredita em Deus, por isso detonou a bomba.", correct: false }
        ]
    },
    estabilizar_passageiros: {
        label: "Estabilizar os passageiros",
        options: [
            { id: "opt1", text: "Manter passageiros calmos", correct: true },
            { id: "opt2", text: "Esconder passageiros", failMsg: "Movimentação brusca alertou o terrorista, ele detonou a bomba.", correct: false },
            { id: "opt3", text: "Levar água para o Terrorista", failMsg: "O terrorista achou que vc era uma policial disfarçada, e detonou a bomba.", correct: false },
            { id: "opt4", text: "Tentar negociar com o Terrorista", failMsg: "O terrorista cansou de se explicar e achou que era muita gente falando e detonou a bomba.", correct: false }
        ]
    },
    neutralizar_explosivo: {
        label: "Neutralizar o explosivo",
        options: [
            { id: "opt1", text: "Cortar fio vermelho", correct: true },
            { id: "opt2", text: "Cortar fio preto", failMsg: "Fio preto detonou o explosivo deste dispositivo.", correct: false },
            { id: "opt3", text: "Apertar o botão desligar", failMsg: "Apertar o botão desligar era uma das formas de detonar o explosivo.", correct: false },
            { id: "opt4", text: "Chutar o dispositivo", failMsg: "Chutar o dispositivo detonou o explosivo.", correct: false }
        ]
    }
};

export const ROLE_MAP_G3 = {
    comando: "conter_ameaca",
    negociador: "reduzir_risco",
    cabine: "estabilizar_passageiros",
    esquadrao_antibomba: "neutralizar_explosivo"
};
