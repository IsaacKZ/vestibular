// @ts-check
'use strict';

/**
 * Fila UDESC — lógica pura, sem DOM, sem side effects não declarados.
 * Testável via `node core.test.js`. Este arquivo também é inlinado
 * (copiado, função por função) no <script> de index.html.
 */

/** @typedef {[string, string, number, string]} ItemPlano matéria, tópico, horas, modo */
/** @typedef {{fase: string, itens: ItemPlano[]}} Fase */
/** @typedef {{materia: string, topico: string, modo: string}} Bloco */
/** @typedef {{index: number, fase: string, blocks: Bloco[]}} Sessao */

// ---------------------------------------------------------------------------
// Datas — sempre como número de dias UTC, nunca Date local.
// ---------------------------------------------------------------------------

/**
 * @param {string} iso
 * @returns {number}
 */
function toDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/**
 * @param {number} day
 * @returns {string}
 */
function toISO(day) {
  const d = new Date(day * 86400000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * @param {string} iso
 * @param {number} n
 * @returns {string}
 */
function addDays(iso, n) {
  return toISO(toDay(iso) + n);
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function diffDays(a, b) {
  return toDay(b) - toDay(a);
}

// ---------------------------------------------------------------------------
// Dados do plano — seção 5. Não reordenar, não redistribuir horas.
// ---------------------------------------------------------------------------

/** @type {Fase[]} */
const FASES = [
  {
    fase: 'Fundação',
    itens: [
      ['Química', 'Funções orgânicas e nomenclatura', 7, '25/5'],
      ['Matemática', 'Probabilidade e combinatória', 5, '50/10'],
      ['Biologia', 'Ecologia e meio ambiente (SC)', 5, '25/5'],
      ['Biologia', 'Microbiologia, vírus e doenças', 5, '25/5'],
      ['Matemática', 'Matrizes, determinantes e sistemas', 4, '50/10'],
      ['Português', 'Obras obrigatórias', 4, '25/5'],
      ['Química', 'Tabela periódica e propriedades', 3, '25/5'],
      ['Matemática', 'Geometria plana', 3, '50/10'],
      ['Química', 'Estrutura atômica e modelos', 2, '25/5'],
      ['Matemática', 'Progressões e sequências', 2, '50/10'],
      ['Redação', 'Uma redação completa, cronometrada', 5, '50/10'],
      ['Simulado', 'Bloco de questões da UDESC, cronometrado', 5, '50/10'],
    ],
  },
  {
    fase: 'Volume',
    itens: [
      ['Português', 'Obras obrigatórias', 8, '25/5'],
      ['Matemática', 'Funções, logaritmo e exponencial', 5, '50/10'],
      ['Matemática', 'Geometria analítica e cônicas', 4, '50/10'],
      ['Química', 'Ligações e forças intermoleculares', 4, '25/5'],
      ['Biologia', 'Fisiologia humana', 4, '25/5'],
      ['Matemática', 'Geometria espacial', 3, '50/10'],
      ['Biologia', 'Citologia e biologia molecular', 3, '25/5'],
      ['Biologia', 'Botânica e fisiologia vegetal', 3, '25/5'],
      ['Química', 'Soluções, concentração e diluição', 3, '50/10'],
      ['Biologia', 'Genética e hereditariedade', 2, '50/10'],
      ['Química', 'Química ambiental e cotidiano', 2, '25/5'],
      ['Química', 'Eletroquímica e oxirredução', 1, '25/5'],
      ['Redação', 'Uma redação completa, cronometrada', 5, '50/10'],
      ['Simulado', 'Bloco de questões da UDESC, cronometrado', 3, '50/10'],
    ],
  },
  {
    fase: 'Consolidação',
    itens: [
      ['Física', 'Física moderna (só conceito)', 3, '25/5'],
      ['Física', 'Termodinâmica conceitual', 3, '25/5'],
      ['Física', 'Óptica e ondas conceitual', 3, '25/5'],
      ['Matemática', 'Trigonometria', 3, '50/10'],
      ['Física', 'Gravitação', 2, '50/10'],
      ['Biologia', 'Zoologia', 2, '25/5'],
      ['Biologia', 'Evolução', 2, '25/5'],
      ['Biologia', 'Taxonomia e embriologia', 2, '25/5'],
      ['Química', 'Cinética, equilíbrio e termoquímica', 2, '50/10'],
      ['Matemática', 'Geometria — revisão geral', 2, '50/10'],
      ['Português', 'Obras obrigatórias', 2, '25/5'],
      ['Física', 'Leis de Newton (só conceito)', 1, '25/5'],
      ['Química', 'Funções inorgânicas e ácido-base', 1, '25/5'],
      ['Química', 'Radioatividade', 1, '25/5'],
      ['Redação', 'Uma redação completa, cronometrada', 1, '50/10'],
    ],
  },
];

/** Peso por tópico — questões por prova (seção 5). Usado na tela Progresso. */
const PESOS = {
  Matemática: [
    ['Geometria plana, espacial e analítica', 4.3],
    ['Funções, logaritmo e exponencial', 3.5],
    ['Probabilidade, combinatória e estatística', 2.2],
    ['Matrizes, determinantes e sistemas', 1.7],
    ['Trigonometria', 1.5],
    ['Progressões e sequências', 1.2],
    ['Polinômios', 0.5],
  ],
  Física: [
    ['Mecânica', 2.7],
    ['Eletricidade e circuitos', 2.5],
    ['Termologia e termodinâmica', 2.3],
    ['Energia e quantidade de movimento', 1.8],
    ['Ondas e óptica', 1.8],
    ['Gravitação', 1.0],
    ['Física moderna', 1.0],
    ['Fluidos', 0.8],
  ],
  Química: [
    ['Funções orgânicas e nomenclatura', 2.8],
    ['Ligações e forças intermoleculares', 1.7],
    ['Tabela periódica', 1.5],
    ['Soluções e concentração', 1.3],
    ['Química ambiental', 1.3],
    ['Estrutura atômica e modelos', 1.0],
    ['Eletroquímica e oxirredução', 1.0],
    ['Cinética, equilíbrio e termoquímica', 1.0],
    ['Funções inorgânicas e ácido-base', 0.8],
    ['Radioatividade', 0.7],
    ['Estequiometria', 0.5],
    ['Propriedades coligativas', 0.3],
  ],
  Biologia: [
    ['Ecologia e meio ambiente', 2.7],
    ['Microbiologia, vírus e doenças', 2.0],
    ['Fisiologia humana', 1.8],
    ['Citologia e biologia molecular', 1.7],
    ['Botânica e fisiologia vegetal', 1.7],
    ['Zoologia', 1.2],
    ['Evolução', 1.2],
    ['Genética', 1.0],
    ['Taxonomia', 0.7],
    ['Embriologia e reprodução', 0.7],
    ['Imunologia', 0.3],
  ],
};

const MATERIAS_FOCO = ['Matemática', 'Física', 'Química', 'Biologia', 'Português'];

// ---------------------------------------------------------------------------
// Montagem da fila — algoritmo determinístico (seção 5).
// ---------------------------------------------------------------------------

/**
 * @param {Fase[]} fases
 * @returns {Sessao[]}
 */
function buildQueue(fases) {
  /** @type {Sessao[]} */
  const sessions = [];
  let globalIndex = 0;

  for (const faseObj of fases) {
    const pools = faseObj.itens.map((item, idx) => ({
      materia: item[0],
      topico: item[1],
      modo: item[3],
      remaining: item[2],
      order: idx,
    }));

    /**
     * @param {string|null} excludeMateria
     */
    function pickBest(excludeMateria) {
      let candidates = pools.filter(
        (p) => p.remaining > 0 && (excludeMateria === null || p.materia !== excludeMateria)
      );
      if (candidates.length === 0 && excludeMateria !== null) {
        candidates = pools.filter((p) => p.remaining > 0);
      }
      if (candidates.length === 0) return null;
      candidates.sort((a, b) => {
        if (b.remaining !== a.remaining) return b.remaining - a.remaining;
        if (a.materia !== b.materia) return a.materia < b.materia ? -1 : 1;
        return a.order - b.order;
      });
      return candidates[0];
    }

    while (pools.some((p) => p.remaining > 0)) {
      const first = pickBest(null);
      if (!first) break;
      first.remaining--;
      /** @type {Bloco[]} */
      const blocks = [{ materia: first.materia, topico: first.topico, modo: first.modo }];

      const second = pickBest(first.materia);
      if (second) {
        second.remaining--;
        blocks.push({ materia: second.materia, topico: second.topico, modo: second.modo });
      }

      sessions.push({ index: globalIndex++, fase: faseObj.fase, blocks });
    }
  }

  return sessions;
}

// ---------------------------------------------------------------------------
// Revisão espaçada (seção 6).
// ---------------------------------------------------------------------------

const INTERVALOS_REVISAO = [1, 3, 7, 30];

/**
 * @param {{materia:string, topico:string, causa:string, origem?:string, anotacao?:string}} dados
 * @param {string} id
 * @param {string} dataRegistro
 */
function criarErro(dados, id, dataRegistro) {
  return {
    id,
    materia: dados.materia,
    topico: dados.topico,
    causa: dados.causa,
    origem: dados.origem || '',
    anotacao: dados.anotacao || '',
    dataRegistro,
    nivel: 0,
    proxima: addDays(dataRegistro, INTERVALOS_REVISAO[0]),
    acertos: 0,
    erros: 0,
  };
}

/**
 * @param {*} erro
 * @param {string} hoje
 * @param {boolean} acertou
 */
function revisarErro(erro, hoje, acertou) {
  if (acertou) {
    if (erro.nivel >= INTERVALOS_REVISAO.length - 1) {
      return { ...erro, proxima: '', acertos: erro.acertos + 1 };
    }
    const novoNivel = erro.nivel + 1;
    return {
      ...erro,
      nivel: novoNivel,
      proxima: addDays(hoje, INTERVALOS_REVISAO[novoNivel]),
      acertos: erro.acertos + 1,
    };
  }
  return {
    ...erro,
    nivel: 0,
    proxima: addDays(hoje, INTERVALOS_REVISAO[0]),
    erros: erro.erros + 1,
  };
}

/**
 * @param {any[]} erros
 * @param {string} hoje
 */
function getVencidas(erros, hoje) {
  return erros
    .filter((e) => e.proxima !== '' && e.proxima <= hoje)
    .slice()
    .sort((a, b) => (a.proxima < b.proxima ? -1 : a.proxima > b.proxima ? 1 : 0));
}

// ---------------------------------------------------------------------------
// Ritmo (seção 6).
// ---------------------------------------------------------------------------

const DATA_LIMITE_FILA = '2026-11-22';
const DATA_PROVA = '2026-11-29';
const DATA_LIMITE_INSCRICAO = '2026-10-08';
const TOTAL_SESSOES = 65;

/**
 * @param {string} hoje
 * @param {string[]} datasConcluidas datas (YYYY-MM-DD) em que cada sessão foi concluída, em ordem
 * @param {{total?:number, dataLimite?:string}} [opts]
 */
function calcRitmo(hoje, datasConcluidas, opts) {
  const total = (opts && opts.total) || TOTAL_SESSOES;
  const dataLimite = (opts && opts.dataLimite) || DATA_LIMITE_FILA;
  const semanasRestantes = Math.max(0, diffDays(hoje, dataLimite)) / 7;
  const concluidas = datasConcluidas.length;

  let ritmo = 0;
  if (concluidas > 0) {
    const primeira = datasConcluidas[0];
    const dias = Math.max(7, diffDays(primeira, hoje) + 1);
    ritmo = (concluidas / dias) * 7;
  }

  const projecao = Math.min(total, Math.round(concluidas + ritmo * semanasRestantes));
  const necessario = semanasRestantes > 0 ? (total - concluidas) / semanasRestantes : 0;

  return { concluidas, ritmo, projecao, necessario, semanasRestantes };
}

/**
 * @param {string} hoje
 * @param {string} [dataLimite]
 */
function isVespera(hoje, dataLimite) {
  return toDay(hoje) >= toDay(dataLimite || DATA_LIMITE_FILA);
}

/**
 * @param {string} hoje
 * @param {string} [dataProva]
 */
function diasRestantesProva(hoje, dataProva) {
  return diffDays(hoje, dataProva || DATA_PROVA);
}

/**
 * @param {string} hoje
 * @param {boolean} inscricaoFeita
 * @param {string} [limite]
 * @returns {'ok'|'fixo'|'critico'}
 */
function statusInscricao(hoje, inscricaoFeita, limite) {
  if (inscricaoFeita) return 'ok';
  return toDay(hoje) > toDay(limite || DATA_LIMITE_INSCRICAO) ? 'critico' : 'fixo';
}

// ---------------------------------------------------------------------------
// Simulados e desempenho.
// ---------------------------------------------------------------------------

/**
 * @param {number} acertosTotal
 * @param {number} notaRedacao
 */
function calcDesempenho(acertosTotal, notaRedacao) {
  return ((acertosTotal + notaRedacao) / 110) * 100;
}

/**
 * Interpretação do gargalo dominante de causa de erro (tela Progresso).
 * @param {{naoSabia:number, errouConta:number, interpretouMal:number}} contagens
 */
function interpretarGargalo(contagens) {
  const { naoSabia, errouConta, interpretouMal } = contagens;
  if (naoSabia === 0 && errouConta === 0 && interpretouMal === 0) return '';
  if (errouConta >= naoSabia && errouConta >= interpretouMal) return 'o gargalo é base algébrica';
  if (naoSabia >= errouConta && naoSabia >= interpretouMal) return 'o gargalo é cobertura de conteúdo';
  return 'o gargalo é leitura sob pressão — treine cronometrado';
}

// ---------------------------------------------------------------------------
// Timer por timestamp (seção 4) — nunca por contador incrementado.
// ---------------------------------------------------------------------------

/**
 * @param {number} iniciadoEm epoch ms de quando o timer do bloco começou
 * @param {string} modo '50/10' ou '25/5'
 * @param {number} nowMs epoch ms atual
 */
function computeTimerState(iniciadoEm, modo, nowMs) {
  const [estudoMin, pausaMin] = modo.split('/').map(Number);
  const estudoMs = estudoMin * 60000;
  const pausaMs = pausaMin * 60000;
  const cicloMs = estudoMs + pausaMs;
  const ciclos = Math.max(1, Math.round(3600000 / cicloMs));
  const totalMs = ciclos * cicloMs;
  const elapsed = Math.max(0, nowMs - iniciadoEm);

  if (elapsed >= totalMs) {
    return { concluido: true, ciclo: ciclos, totalCiclos: ciclos, fase: 'concluido', restanteMs: 0 };
  }
  const cicloIdx = Math.floor(elapsed / cicloMs);
  const dentroCiclo = elapsed - cicloIdx * cicloMs;
  if (dentroCiclo < estudoMs) {
    return {
      concluido: false,
      ciclo: cicloIdx + 1,
      totalCiclos: ciclos,
      fase: 'estudo',
      restanteMs: estudoMs - dentroCiclo,
    };
  }
  return {
    concluido: false,
    ciclo: cicloIdx + 1,
    totalCiclos: ciclos,
    fase: 'pausa',
    restanteMs: cicloMs - dentroCiclo,
  };
}

// ---------------------------------------------------------------------------
// Modo véspera (seção 6) — lista fixa, sem conteúdo novo.
// ---------------------------------------------------------------------------

const BLOCOS_VESPERA = [
  'Caderno de erros — revisar tudo que venceu',
  'Caderno de erros — só os marcados como "não sabia"',
  'Química: orgânica e tabela periódica, releitura ativa',
  'Biologia: ecologia SC e microbiologia, releitura ativa',
  'Física: física moderna, releitura ativa',
  'Português: obras obrigatórias, enredo e temas',
  'Caderno de erros — passada final',
  'Uma redação, cronometrada',
];

// eslint-disable-next-line no-undef
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    toDay,
    toISO,
    addDays,
    diffDays,
    FASES,
    PESOS,
    MATERIAS_FOCO,
    buildQueue,
    INTERVALOS_REVISAO,
    criarErro,
    revisarErro,
    getVencidas,
    calcRitmo,
    isVespera,
    diasRestantesProva,
    statusInscricao,
    calcDesempenho,
    interpretarGargalo,
    computeTimerState,
    BLOCOS_VESPERA,
    DATA_LIMITE_FILA,
    DATA_PROVA,
    DATA_LIMITE_INSCRICAO,
    TOTAL_SESSOES,
  };
}
