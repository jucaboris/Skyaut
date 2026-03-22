export const GAME_DATA = {
    conter_ameaca: {
        label: "Conter ameaça principal",
        options: [
            { id: "opt1", text: "Exploração de ponto cego tático na retaguarda", successMsg: "Utilizando a brecha na linha de visão do alvo, você se posiciona pela retaguarda e realiza uma contenção rápida e precisa.", correct: true },
            { id: "opt2", text: "Intervenção de por arma não letal de Choque", failMsg: "Ao ser atingido pelo choque, o terrorista teve uma contração involuntária e acionou o detonador.", correct: false },
            { id: "opt3", text: "Avanço físico imediato", failMsg: "O movimento brusco assustou o terrorista, que reagiu acionando o detonador.", correct: false },
            { id: "opt4", text: "Neutralização por disparo direto", failMsg: "Ao perceber a ameaça, o terrorista entrou em pânico e acionou o detonador.", correct: false }
        ]
    },
    reduzir_risco: {
        label: "Reduzir risco por negociação",
        options: [
            { id: "opt1", text: "Ancoragem emocional", successMsg: "Ao explorar o vínculo com o filho, você estabelece uma conexão emocional profunda e começa a quebrar a resistência do alvo.", correct: true },
            { id: "opt2", text: "Racionalização do conflito", failMsg: "O terrorista ignorou os argumentos lógicos e, sob pressão, detonou a bomba.", correct: false },
            { id: "opt3", text: "Proposta de compensação", failMsg: "O terrorista não buscava ganhos e, irritado com a proposta, detonou a bomba.", correct: false },
            { id: "opt4", text: "Apelo de crença", failMsg: "A abordagem não gerou identificação, e o terrorista detonou a bomba.", correct: false }
        ]
    },
    estabilizar_passageiros: {
        label: "Orientação e controle dos passageiros",
        options: [
            { id: "opt1", text: "Protocolo de estabilização coletiva", successMsg: "Com instruções firmes e discretas, você mantém os passageiros calmos e evita o colapso emocional na cabine.", correct: true },
            { id: "opt2", text: "Redistribuição silenciosa do grupo", failMsg: "A movimentação chamou a atenção do terrorista, que acionou o detonador.", correct: false },
            { id: "opt3", text: "Aproximação assistencial ao alvo", failMsg: "O terrorista interpretou a aproximação como uma ameaça e detonou a bomba.", correct: false },
            { id: "opt4", text: "Protocolo de Mediação simultânea", failMsg: "A confusão de vozes irritou o terrorista, que acionou o detonador.", correct: false }
        ]
    },
    neutralizar_explosivo: {
        label: "Neutralizar o explosivo",
        options: [
            { id: "opt1", text: "Corte do fio vermelho do condutor", successMsg: "Com base na análise da fiação, você identifica o fio vermelho e realiza o corte correto, neutralizando o dispositivo.", correct: true },
            { id: "opt2", text: "Corte do fio preto do circuito", failMsg: "A ação acionou o gatilho do dispositivo, resultando na detonação.", correct: false },
            { id: "opt3", text: "Desativação via interface do dispositivo", failMsg: "O comando acionou um mecanismo oculto de detonação.", correct: false },
            { id: "opt4", text: "Desestabilização por impacto externo", failMsg: "O impacto ativou o mecanismo e detonou o explosivo.", correct: false }
        ]
    }
};

export const ROLE_MAP_G3 = {
    comando: "conter_ameaca",
    negociador: "reduzir_risco",
    cabine: "estabilizar_passageiros",
    esquadrao_antibomba: "neutralizar_explosivo"
};
