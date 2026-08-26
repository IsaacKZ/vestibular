'use strict';

const assert = require('assert');
const core = require('./core.js');

const {
  toDay,
  addDays,
  diffDays,
  FASES,
  buildQueue,
  criarErro,
  revisarErro,
  getVencidas,
  calcRitmo,
  isVespera,
  statusInscricao,
  computeTimerState,
} = core;

let passed = 0;
let failed = 0;

/**
 * @param {string} name
 * @param {() => void} fn
 */
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${name}`);
    console.log(`      ${e.message}`);
  }
}

function approx(a, b, eps, msg) {
  assert.ok(Math.abs(a - b) <= eps, `${msg || ''} esperado ~${b}, obtido ${a}`);
}

// ---------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------

test('addDays vira o mês', () => {
  assert.strictEqual(addDays('2026-08-30', 3), '2026-09-02');
});

test('addDays vira o ano', () => {
  assert.strictEqual(addDays('2026-12-30', 5), '2027-01-04');
});

test('addDays dentro do mesmo mês', () => {
  assert.strictEqual(addDays('2026-10-20', 30), '2026-11-19');
});

test('diffDays hoje até a prova', () => {
  assert.strictEqual(diffDays('2026-08-25', '2026-11-29'), 96);
});

// ---------------------------------------------------------------------------
// Fila
// ---------------------------------------------------------------------------

const queue = buildQueue(FASES);

test('a fila tem exatamente 65 sessões e 130 blocos', () => {
  assert.strictEqual(queue.length, 65);
  const totalBlocos = queue.reduce((acc, s) => acc + s.blocks.length, 0);
  assert.strictEqual(totalBlocos, 130);
});

test('as horas por matéria na fila batem com as horas somadas do FASES', () => {
  const esperado = {};
  for (const fase of FASES) {
    for (const [materia, , horas] of fase.itens) {
      esperado[materia] = (esperado[materia] || 0) + horas;
    }
  }
  const obtido = {};
  for (const s of queue) {
    for (const b of s.blocks) {
      obtido[b.materia] = (obtido[b.materia] || 0) + 1;
    }
  }
  assert.deepStrictEqual(obtido, esperado);
});

test('no máximo 3 sessões repetem a mesma matéria nos dois blocos', () => {
  const repetidas = queue.filter(
    (s) => s.blocks.length === 2 && s.blocks[0].materia === s.blocks[1].materia
  );
  assert.ok(
    repetidas.length <= 3,
    `esperado <= 3, obtido ${repetidas.length}: ${JSON.stringify(repetidas.map((s) => s.index))}`
  );
});

test('os índices são contíguos de 0 a 64', () => {
  queue.forEach((s, i) => assert.strictEqual(s.index, i));
});

test('as fases aparecem na ordem Fundação, Volume, Consolidação', () => {
  const ordemVista = [];
  for (const s of queue) {
    if (ordemVista[ordemVista.length - 1] !== s.fase) ordemVista.push(s.fase);
  }
  assert.deepStrictEqual(ordemVista, ['Fundação', 'Volume', 'Consolidação']);
});

test('nenhum bloco de Física aparece fora da fase Consolidação', () => {
  for (const s of queue) {
    for (const b of s.blocks) {
      if (b.materia === 'Física') {
        assert.strictEqual(s.fase, 'Consolidação');
      }
    }
  }
});

test('o primeiro bloco da sessão 0 é Química, funções orgânicas', () => {
  assert.strictEqual(queue[0].blocks[0].materia, 'Química');
  assert.strictEqual(queue[0].blocks[0].topico, 'Funções orgânicas e nomenclatura');
});

// ---------------------------------------------------------------------------
// Revisão
// ---------------------------------------------------------------------------

test('erro novo em 25/08 -> próxima em 26/08', () => {
  const erro = criarErro(
    { materia: 'Matemática', topico: 'Trigonometria', causa: 'nao-sabia' },
    'e1',
    '2026-08-25'
  );
  assert.strictEqual(erro.proxima, '2026-08-26');
  assert.strictEqual(erro.nivel, 0);
});

test('caminho de revisão completo: 26/08 -> 29/08 -> 05/09 -> erro -> 06/09 -> conclusão', () => {
  let erro = criarErro(
    { materia: 'Matemática', topico: 'Trigonometria', causa: 'nao-sabia' },
    'e2',
    '2026-08-25'
  );

  erro = revisarErro(erro, '2026-08-26', true);
  assert.strictEqual(erro.proxima, '2026-08-29');
  assert.strictEqual(erro.nivel, 1);

  erro = revisarErro(erro, '2026-08-29', true);
  assert.strictEqual(erro.proxima, '2026-09-05');
  assert.strictEqual(erro.nivel, 2);

  erro = revisarErro(erro, '2026-09-05', false);
  assert.strictEqual(erro.proxima, '2026-09-06');
  assert.strictEqual(erro.nivel, 0);
  assert.strictEqual(erro.erros, 1);

  // refaz o caminho até o nível 3 e conclui no 4º acerto
  erro = revisarErro(erro, '2026-09-06', true); // nivel 1
  erro = revisarErro(erro, '2026-09-09', true); // nivel 2
  erro = revisarErro(erro, '2026-09-16', true); // nivel 3
  erro = revisarErro(erro, '2026-10-16', true); // conclui
  assert.strictEqual(erro.proxima, '');

  const vencidas = getVencidas([erro], '2027-01-01');
  assert.strictEqual(vencidas.length, 0);
});

test('um erro atrasado e um recém-vencido: ambos aparecem, o atrasado primeiro', () => {
  const atrasado = criarErro(
    { materia: 'Física', topico: 'Mecânica', causa: 'nao-sabia' },
    'e3',
    '2026-08-01'
  ); // próxima 2026-08-02
  const recente = criarErro(
    { materia: 'Química', topico: 'Estequiometria', causa: 'errou-conta' },
    'e4',
    '2026-08-09'
  ); // próxima 2026-08-10
  const vencidas = getVencidas([recente, atrasado], '2026-08-10');
  assert.strictEqual(vencidas.length, 2);
  assert.strictEqual(vencidas[0].id, 'e3');
  assert.strictEqual(vencidas[1].id, 'e4');
});

// ---------------------------------------------------------------------------
// Ritmo
// ---------------------------------------------------------------------------

test('sem sessões: ritmo 0, projeção 0, necessário ~5,1 por semana', () => {
  const r = calcRitmo('2026-08-25', []);
  assert.strictEqual(r.ritmo, 0);
  assert.strictEqual(r.projecao, 0);
  approx(r.necessario, 5.1, 0.05);
});

test('três sessões no primeiro dia: ritmo <= 3,1 (janela mínima segura)', () => {
  const r = calcRitmo('2026-08-25', ['2026-08-25', '2026-08-25', '2026-08-25']);
  assert.ok(r.ritmo <= 3.1, `ritmo obtido ${r.ritmo}`);
});

test('projeção nunca passa de 65 nem fica abaixo do número de concluídas', () => {
  const casos = [
    calcRitmo('2026-08-25', []),
    calcRitmo('2026-11-01', Array(40).fill('2026-08-25')),
    calcRitmo('2026-11-20', Array(65).fill('2026-08-25')),
  ];
  for (const r of casos) {
    assert.ok(r.projecao <= 65);
    assert.ok(r.projecao >= r.concluidas);
  }
});

test('em 28/11 (depois da véspera): semanas restantes = 0 e necessario é finito', () => {
  const r = calcRitmo('2026-11-28', Array(30).fill('2026-08-25'));
  assert.strictEqual(r.semanasRestantes, 0);
  assert.strictEqual(r.necessario, 0);
  assert.ok(Number.isFinite(r.necessario));
});

// ---------------------------------------------------------------------------
// Marcos
// ---------------------------------------------------------------------------

test('21/11 não é véspera; 22/11 e 29/11 são', () => {
  assert.strictEqual(isVespera('2026-11-21'), false);
  assert.strictEqual(isVespera('2026-11-22'), true);
  assert.strictEqual(isVespera('2026-11-29'), true);
});

test('08/10 é o limite da inscrição; 09/10 já está vencido', () => {
  assert.strictEqual(statusInscricao('2026-10-08', false), 'fixo');
  assert.strictEqual(statusInscricao('2026-10-09', false), 'critico');
  assert.strictEqual(statusInscricao('2026-10-09', true), 'ok');
});

// ---------------------------------------------------------------------------
// Timer
// ---------------------------------------------------------------------------

test('timer 50/10: aos 10min está em estudo com 40min restantes', () => {
  const r = computeTimerState(0, '50/10', 10 * 60000);
  assert.strictEqual(r.fase, 'estudo');
  assert.strictEqual(Math.round(r.restanteMs / 60000), 40);
});

test('timer 50/10: aos 55min está em pausa', () => {
  const r = computeTimerState(0, '50/10', 55 * 60000);
  assert.strictEqual(r.fase, 'pausa');
});

test('timer 25/5: dois ciclos completam o bloco de 60min', () => {
  const meio = computeTimerState(0, '25/5', 59 * 60000);
  assert.strictEqual(meio.ciclo, 2);
  const fim = computeTimerState(0, '25/5', 60 * 60000);
  assert.strictEqual(fim.concluido, true);
});

// ---------------------------------------------------------------------------

console.log(`\n${passed} passaram, ${failed} falharam.`);
if (failed > 0) process.exit(1);
