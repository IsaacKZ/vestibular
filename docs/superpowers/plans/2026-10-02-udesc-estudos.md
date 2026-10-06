# App de estudos UDESC — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar um app pessoal em que questões reais conferidas da UDESC alimentem tentativa, correção, lacuna, revisão posterior, plano diário e avaliação.

**Architecture:** PWA estática React/TypeScript; domínio independente da interface; persistência transacional em IndexedDB. Catálogo e conteúdo versionados, com bloqueio por qualidade. Todos os fluxos usam as mesmas tentativas imutáveis.

**Tech Stack:** Node 24.19.0, React, React Router, TypeScript, Vite, Dexie, Zod, Vitest, Playwright e vite-plugin-pwa. KaTeX apenas para fórmulas conferidas, com saída HTML+MathML.

**Spec:** `docs/superpowers/specs/2026-10-02-udesc-estudos-design.md`. Ler também `docs/requisitos-do-app.md` e `.agents/skills/udesc-vestibular/SKILL.md`.

**Estado:** plano para revisão; comandos, arquivos de produto e testes abaixo ainda não foram executados/criados. Documentos são a entrega desta etapa.

## Global Constraints

- Usar apenas as questões do acervo da skill; não gerar substitutas nem reparar fórmulas por inferência.
- Inventário: 420 questões, 84 por matéria, 14 por matéria/edição; cinco matérias e seis edições.
- Os 215 itens marcados ficam bloqueados; os outros 205 são candidatos, não itens prontos.
- Para treino corrigido, exigir enunciado/alternativas/ativos/classificação/gabarito/resolução conferidos; anuladas são excluídas.
- Gabaritos oficiais e originais necessários ainda não foram fornecidos.
- Até 120 minutos/dia e cinco dias/semana; data-alvo informada 29/11/2026, com regras oficiais a confirmar.
- Intervalos iniciais 3 e 14 dias; duas evidências posteriores separadas por ao menos 3 dias para recuperar o item; valores configuráveis.
- Tentativa imutável, primeira tentativa preservada, versão do conteúdo explícita.
- Não revelar feedback sem persistência; avaliação mantém feedback fechado até finalizar.
- Português, celular/desktop, 320 px/zoom 200%, teclado/foco e toque de 44×44 px.
- Não inventar métricas, gráficos, provas completas, imagens ou fontes.
- Usar o checkout existente; não criar worktree adicional sem pedido.
- Não instalar dependências nem escrever produto durante a etapa atual de planejamento.

## Review Focus

1. Texto sem marcação com alternativa vazia/fórmula perdida: continua bloqueado (Tarefa 2).
2. Virada de dia no Brasil quando UTC já mudou: retenção usa America/Sao_Paulo (Tarefas 1 e 6).
3. Duplo clique ou falha de gravação: uma tentativa ou nenhuma; feedback fechado (Tarefas 3 e 4).
4. Backup repetido, conflito de IDs ou versão futura: não duplica nem apaga histórico (Tarefa 9).
5. Recarga/offline/atualização durante avaliação: respostas e estado fechado sobrevivem (Tarefas 10 e 12).

## Entregas

| Etapa | Tarefas | Saída revisável |
| --- | --- | --- |
| Acervo | 1–2 | Inventário auditado e seleção conferida |
| Primeiro ciclo | 3–6, 9 | Questão → correção → lacuna → revisão, com backup |
| Rotina | 7–8 | Filtros, listas e plano do dia |
| Avaliação | 10–11 | Simulados parciais e métricas honestas |
| Acabamento | 12 | PWA, atualização segura, celular e teclado |

Pode-se construir mecânica com fixtures isoladas enquanto o conteúdo é conferido.
Aceite do ciclo real depende de ao menos uma questão verdadeira com gabarito e
resolução revisados. Não apresentar testes sintéticos como validação do acervo.

## Estrutura de arquivos

```text
.agents/skills/udesc-vestibular/       fonte recebida; preservar
content/source/                      cópia fiel dos cinco bancos e do mapa histórico
content/reviews.json                  conferências e localização nos originais
content/answer-keys.json              gabaritos e revisões com procedência
content/explanations.json             resoluções revisadas e autoria
content/assets/                      figuras reais dos mesmos itens
scripts/import-corpus.ts              conversão dos cinco Markdown
scripts/audit-content.ts              bloqueios e manifesto
public/content/catalog.json          inventário publicado
public/content/questions.json        revisões prontas para treino
src/content/{types,schema,quality,catalogue}.ts
src/domain/{clock,attempts,learning,planning,metrics,assessment}.ts
src/storage/{db,study-service,backup}.ts
src/features/{today,catalogue,practice,notebook,progress,assessment,settings}/
src/ui/{AppShell,QuestionContent,FormControls}.tsx
src/styles/{tokens,global}.css
src/main.tsx
tests/fixtures.ts
tests/content/
tests/domain/
tests/storage/
tests/e2e/
vite.config.ts
vitest.config.ts
playwright.config.ts
index.html
package.json
package-lock.json
README.md
```

### Contratos compartilhados

Tarefa 1 define estes tipos em `src/content/types.ts`; tarefas posteriores não
renomeiam campos unilateralmente. Instantes são ISO UTC; dia de estudo é ISO local.

```ts
type Letter = 'A' | 'B' | 'C' | 'D' | 'E';
type StudyDate = string;
type Instant = string;
type Subject = 'matematica' | 'biologia' | 'portugues-literatura' | 'fisica' | 'quimica';
type Blocker = 'ocr' | 'uncertain' | 'missing_text' | 'missing_options'
  | 'missing_assets' | 'unreviewed' | 'missing_key' | 'missing_explanation' | 'annulled';
type ErrorCause = 'concept' | 'method' | 'prerequisite' | 'calculation' | 'interpretation' | 'time';

interface QuestionRevision {
  id: string; revision: string; subject: Subject; edition: string;
  period: 'matutino' | 'vespertino'; originalNumber: number; subjectNumber: number;
  topics: string[]; skills: string[]; rawText: string; stem: string;
  options: { letter: Letter; text: string }[];
  assets: { path: string; alt: string; required: boolean; verified: boolean;
    source: string; anchor: { target:'stem'|'support'|'option';
      optionLetter:Letter|null; afterBlock:number } }[];
  source: { file: string; section: string; sha256: string; originalPdf?: string; page?: number };
  quality: { reviewed: boolean; ocr: boolean; uncertain: boolean;
    textComplete: boolean; assetsComplete: boolean; taxonomyReviewed: boolean;
    annulled: boolean; reviewer?: string; reviewedAt?: Instant };
  key: null | { letter: Letter; revision: string; verified: boolean;
    source: string; location: string; reviewer: string };
  annulment: null | { revision:string; verified:boolean;
    source:string; location:string; reviewer:string };
  explanation: null | { text: string; reviewed: boolean;
    authorKind: 'official' | 'prepared'; author:string; source: string; reviewer: string };
}
interface AttemptInput {
  submissionId: string; sessionId: string; questionId: string; questionRevision: string;
  response: Letter | null; confidence: 'low' | 'medium' | 'high';
  guessed: boolean; doubt: boolean; usedHint: boolean; consulted: boolean; activeMs: number;
}
interface Attempt extends AttemptInput {
  id: string; at: Instant; studyDate: StudyDate; mode: 'study' | 'assessment';
  firstAttempt: boolean; priorFeedbackAt: Instant | null;
  priorFeedbackDate: StudyDate | null;
}
interface DraftRecord extends AttemptInput { updatedAt: Instant; }
interface Grade {
  id:string; attemptId:string; keyRevision:string|null; decisionRevision:string;
  questionRevision:string; correct:boolean|null;
  kind: 'initial' | 'regrade'; exclusionReason:'annulled'|null; at: Instant;
}
interface FeedbackEvent {
  id:string; attemptId:string; questionId:string; at:Instant; studyDate:StudyDate;
}
interface StudySession {
  id: string; mode: 'study' | 'assessment'; status: 'active' | 'completed';
  questions: { id: string; revision: string }[]; startedAt: Instant;
  deadlineAt: Instant | null; completedAt: Instant | null;
}
interface Gap {
  questionId: string; status: 'open' | 'in_review' | 'recovered';
  cause: ErrorCause | null; note: string; evidenceAttemptIds: string[];
  lastFailureDate:StudyDate;
}
interface Review {
  questionId: string; dueDate: StudyDate; kind: 'gap' | 'maintenance';
  lastEvidenceDate: StudyDate | null;
}
interface ReviewPolicy {
  initialDays: number; repeatDays: number; maintenanceDays: number;
  recoverySuccesses: number; minEvidenceDays: number;
}
interface Settings {
  timezone: string; dailyMinutes: 30 | 60 | 90 | 120; studyWeekdays: number[];
  targetExamDate: StudyDate; reviewPolicy: ReviewPolicy;
}
interface LearningHistory {
  attempts: Attempt[]; grades: Grade[]; feedback: FeedbackEvent[]; sessions:StudySession[];
}
interface LearningProjection { gaps: Gap[]; reviews: Review[]; }
interface PlanTask {
  questionId: string; minutes: number; reason: 'review' | 'gap' | 'maintenance' | 'new';
}
interface DailyPlan { date: StudyDate; tasks: PlanTask[]; deferredQuestionIds: string[]; }
```

Snapshots, rascunhos e configurações usam os tipos acima. `StudyDb` é a subclasse
Dexie criada na Tarefa 3. BackupEnvelope é definido na Tarefa 9, não um formato
informal inventado por cada tela.

### Tarefa 1: base tipada, relógio e contratos

**Files:** criar `package.json`, lockfile, configurações TS/Vite/Vitest/Playwright,
`.node-version` (24.19.0), `.gitignore`,
`src/content/types.ts`, `src/content/schema.ts`, `src/domain/clock.ts`,
`tests/fixtures.ts`, `tests/domain/clock.test.ts`, `tests/content/schema.test.ts`;
substituir README/index.html do app antigo pelo projeto novo quando a execução começar.

**Interfaces:** produzir `QuestionRevisionSchema` e `SettingsSchema` (Zod),
`studyDate(at: Instant, timezone: string): StudyDate`,
`dayDistance(from: StudyDate, to: StudyDate): number`,
`addStudyDays(date: StudyDate, days: number): StudyDate`.
Fixtures: `makeReadyQuestion(overrides?: Partial<QuestionRevision>): QuestionRevision`;
conteúdo sintético existe exclusivamente em tests, nunca nos arquivos publicados.

- [ ] Criar manifesto privado ES modules; scripts `dev`, `build`, `test`, `test:e2e`,
  `content:import`, `content:audit`, `check` e `preview`. `check` executa
  `tsc --noEmit`; `build` executa `npm run check && vite build`.
  Ignorar node_modules, dist, coverage, playwright-report, test-results e .agents;
  manter a skill local intacta. Os bancos usados pelo importador vão para content/source.
- [ ] Instalar com `npm install --save-exact react react-dom react-router-dom dexie zod katex` e
  `npm install --save-dev --save-exact vite typescript @vitejs/plugin-react vitest
  @playwright/test @testing-library/react @testing-library/user-event jsdom
  fake-indexeddb tsx vite-plugin-pwa @types/react @types/react-dom @types/node @types/katex`.
  Resolver compatibilidade com Node 24.19.0 e registrar versões exatas/lockfile.
- [ ] Escrever estes testes antes do corpo dos contratos:

```ts
expect(studyDate('2026-10-03T01:00:00Z', 'America/Sao_Paulo')).toBe('2026-10-02');
expect(dayDistance('2026-10-02', '2026-10-05')).toBe(3);
expect(addStudyDays('2026-12-30', 3)).toBe('2027-01-02');
expect(SettingsSchema.safeParse({ ...settings, studyWeekdays: [1,2,3,4,5,6] }).success).toBe(false);
expect(QuestionRevisionSchema.safeParse({ ...makeReadyQuestion(), options: [] }).success).toBe(true);
```

  `settings` em fixtures: timezone America/Sao_Paulo, dailyMinutes 120,
  studyWeekdays [1,2,3,4,5], targetExamDate 2026-11-29 e policy 3/14/14/2/3.
  Schema aceita inventário incompleto; prontidão é responsabilidade da Tarefa 2.
- [ ] Rodar `npm test -- tests/domain/clock.test.ts tests/content/schema.test.ts`;
  primeiro falha por export ausente. Implementar schemas/relógio e repetir até passar.
- [ ] Verificar `npm run check`; commit sugerido `build: establish typed study app foundation`.

### Tarefa 2: inventário, conferência e gate de conteúdo

**Files:** criar `scripts/import-corpus.ts`, `scripts/audit-content.ts`,
`src/content/quality.ts`, arquivos content/public da estrutura e
`tests/content/import.test.ts`, `tests/content/quality.test.ts`.

**Interfaces:** `parseCorpus(files: { path: string; text: string }[]): QuestionRevision[]`;
`getBlockers(q: QuestionRevision): Blocker[]`; `isReady(q: QuestionRevision): boolean`;
`auditCorpus(items: QuestionRevision[]): CorpusAudit`, sendo CorpusAudit
`{ total:number; bySubject:Record<Subject,number>; byEdition:Record<string,number>;
bySubjectEdition:Record<Subject,Record<string,number>>;
flags:{ocr:number;uncertain:number;both:number;blocked:number;candidates:number} }`.

- [ ] Testar o acervo recebido e o bloqueio independentemente da edição:

```ts
expect(audit.total).toBe(420);
expect(Object.values(audit.bySubject)).toEqual([84,84,84,84,84]);
expect(Object.values(audit.bySubjectEdition).flatMap(Object.values)).toHaveLength(30);
expect(Object.values(audit.bySubjectEdition).flatMap(Object.values).every(n => n===14)).toBe(true);
expect(audit.flags).toEqual({ ocr:168, uncertain:68, both:21, blocked:215, candidates:205 });
expect(isReady(makeReadyQuestion({ options: [] }))).toBe(false);
expect(isReady(makeReadyQuestion({ key: null }))).toBe(false);
expect(isReady(makeReadyQuestion({ quality: { ...q.quality, ocr:true, reviewed:false } }))).toBe(false);
```

  Definir `q = makeReadyQuestion()`. Incluir testes nomeados para figura obrigatória
  ausente, alternativa vazia, fórmula não conferida, anulação e duplicata de ID.
  Alternativa pode ter texto ou figura verificada vinculada à sua letra; não
  exigir texto artificial para alternativa legitimamente gráfica. Testar o vínculo.
- [ ] Rodar `npm test -- tests/content`; verificar falha antes das implementações.
- [ ] Converter os cinco arquivos por headings, mantendo rawText/hash e a numeração
  original. Não tratar todo bloco depois de A como alternativa: Física pode separar
  letras e textos. Parsing ambíguo registra missing_options, sem rearranjar por chute.
  Mapear matutino para Matemática/Biologia/Português e vespertino para Física/Química.
  Copiar sem alterações os cinco bancos e topicos.md da skill para content/source;
  importer usa essa cópia rastreável, tornando a geração reprodutível no checkout
  sem publicar o restante do contexto pessoal do SKILL.md. Documentar a origem.
  Asset restaurado recebe posição/vínculo/fonte; preservar a ordem. Flags da
  importação não desaparecem por edição: revisão conferida no original é necessária.
- [ ] Criar registros vazios de conferência/keys/resoluções; conferir uma seleção real
  contra originais e gabaritos fornecidos. Revisor registra fonte/localização.
  Liberar item só quando os seis critérios da spec passarem. Sem material, catálogo
  tem zero prontos e diagnóstico explícito; continuar apenas mecânica independente.
- [ ] Rodar `npm run content:import && npm run content:audit && npm test -- tests/content`;
  esperado inventário 420 sem duplicatas e bloqueios preservados, sem quantidade
  inventada de prontos. Commit `feat: import auditable UDESC question catalogue`.

### Tarefa 3: persistência transacional e sessão recuperável

**Files:** criar `src/storage/db.ts`, `src/storage/study-service.ts`,
`src/domain/attempts.ts`, `tests/domain/attempts.test.ts`,
`tests/storage/db.test.ts`, `tests/storage/study-service.test.ts`.

**Interfaces:** `StudyDb extends Dexie`; stores questionSnapshots, sessions, drafts,
attempts, grades, feedback, gaps, reviews, settings, plans, submissionReceipts.
questionSnapshots usa chave `[id+revision]`; drafts usa `[sessionId+questionId]`;
plans usa `date`; submissionReceipts usa `submissionId`. Guardar versões distintas.
`startSession(db: StudyDb, input: {questions: QuestionRevision[]; mode:'study'|'assessment';
durationMs:number|null}, now: Instant): Promise<StudySession>`.
`saveDraft(db: StudyDb, input: AttemptInput, now:Instant): Promise<void>`.
`submitAttempt(db: StudyDb, input: AttemptInput, now: Instant): Promise<Attempt>`.
Produzir `gradeAttempt(attempt:Attempt,q:QuestionRevision,now:Instant):Grade`
em attempts.ts; usa gabarito conferido, pulo=false, anulação=null com exclusionReason.
decisionRevision usa `key:` + key.revision ou `annulment:` + annulment.revision;
na anulação keyRevision é null. questionRevision identifica o snapshot da decisão.
Fixtures: `createTestDb(): Promise<StudyDb>` usa fake-indexeddb e nome único;
`makeAttemptInput(overrides?: Partial<AttemptInput>): AttemptInput` aponta à fixture pronta.

- [ ] Cobrir transação e idempotência:

```ts
const a = await submitAttempt(db, input, '2026-10-02T12:00:00Z');
const b = await submitAttempt(db, input, '2026-10-02T12:00:01Z');
expect(b.id).toBe(a.id);
expect(await db.attempts.count()).toBe(1);
expect(await db.questionSnapshots.count()).toBe(1);
await expect(submitAttempt(failingDb, input, now)).rejects.toThrow();
expect(await failingDb.attempts.count()).toBe(0);
expect(await failingDb.feedback.count()).toBe(0);
```

  `failingDb` é createTestDb com gravação de submissionReceipts rejeitada dentro
  da transação; `input` usa submissionId fixo e sessão criada por startSession.
- [ ] Rodar `npm test -- tests/storage/study-service.test.ts`; esperado falhar antes do serviço.
- [ ] Em startSession, persistir snapshots de TODOS os itens; em envio, persistir
  snapshot, tentativa, grade e recibo em transação única; bloquear
  questão não pronta/sessão finalizada/revisão errada. Modo avaliação recebe grade
  internamente, mas não evento de feedback. Projeções só são integradas na Tarefa 5.
  Rejeitar confidence/flags/tempo inválidos e alteração quando now >= deadlineAt.
  Recibo idêntico já existente retorna resultado sem modificar dados, inclusive após o prazo.
  Capturar priorFeedbackAt/Date somente da mesma questão e anterior ao envio;
  esses valores imutáveis não mudam ao mostrar a correção da própria tentativa.
- [ ] Testar fechar/reabrir DB recuperando draft e sessão; envio duplo com MESMO
  submissionId e resposta diferente deve rejeitar conflito, sem reaproveitar silenciosamente.
  Acrescentar testes de duas revisões do mesmo item e sessão sem respostas que
  preserva todos os snapshots. saveDraft grava updatedAt para o encerramento seguro.
- [ ] Repetir testes/check; commit `feat: persist study attempts atomically`.

### Tarefa 4: primeira questão e feedback após envio

**Files:** criar `src/main.tsx`, `src/ui/QuestionContent.tsx`,
`src/ui/FormControls.tsx`, `src/features/practice/PracticePage.tsx`,
`src/features/practice/FeedbackPanel.tsx`, `src/features/practice/useActiveTimer.ts`,
`tests/domain/timer.test.ts`, `tests/e2e/practice.spec.ts`;
modificar `src/domain/attempts.ts`, `tests/domain/attempts.test.ts` e study-service.

**Interfaces:** consumir gradeAttempt da Tarefa 3; produzir
`canRevealFeedback(session: StudySession): boolean`;
`isReleasedAttempt(attempt:Attempt,sessions:StudySession[]):boolean`;
`revealFeedback(db: StudyDb, attemptId: string, now: Instant): Promise<FeedbackEvent>`.
`useActiveTimer(input:{enabled:boolean;running:boolean;targetMs:number|null}):
{activeMs:number;reminderReached:boolean;start():void;pause():void;reset():void}`
em useActiveTimer.ts. O aviso de estudo não é o prazo absoluto do simulado.
QuestionContent recebe `{question:QuestionRevision; revealTopic:boolean}`;
PracticePage recebe sessionId, db e catálogo.

- [ ] Testar critérios de resposta e bloqueio:

```ts
expect(gradeAttempt({ ...attempt, response:'B' }, q, now).correct).toBe(true);
expect(gradeAttempt({ ...attempt, response:null }, q, now).correct).toBe(false);
expect(canRevealFeedback({ ...session, mode:'assessment', status:'active' })).toBe(false);
await expect(revealFeedback(db, 'attempt-not-persisted', now)).rejects.toThrow();
```

  Aqui `q` tem key B, `attempt` vem do serviço da Tarefa 3 e `session` de startSession.
- [ ] Rodar os testes de domínio; implementar avaliação e autorização de feedback.
- [ ] Renderizar rádio A–E, confiança, indicadores de ajuda e pulo. Envio persiste
  antes de revelar. Em falha, manter formulário/rascunho, mensagem e opção de tentar
  novamente. Gravar feedback e exibir fonte, raciocínio e autoria da resolução.
  isReleasedAttempt inclui estudo, mas exclui avaliação ativa em qualquer tela.
  Timer de estudo ajustável/não obrigatório registra tempo ativo, pausa quando
  document.visibilityState vira hidden e não encerra questão no alerta. Testar
  relógio controlado: 10 s visível + 20 s oculta resultam em 10 s ativos.
- [ ] Teste Playwright: selecionar não revela correção; enviar revela; recarregar
  mantém tentativa; interceptar erro de armazenamento mantém feedback fechado;
  repetir envio rápido não cria duas tentativas.
- [ ] Rodar `npm test -- tests/domain/attempts.test.ts` e
  `npm run test:e2e -- tests/e2e/practice.spec.ts`; commit
  `feat: complete attempt before feedback flow`.

### Tarefa 5: caderno de lacunas e causas confirmadas

**Files:** criar `src/domain/learning.ts`,
`src/features/notebook/NotebookPage.tsx`, `src/features/notebook/GapDetails.tsx`,
`tests/domain/learning.test.ts`, `tests/e2e/notebook.spec.ts`.

**Interfaces:** `projectLearning(history: LearningHistory, now: Instant,
policy: ReviewPolicy): LearningProjection`;
`updateGapNote(db: StudyDb, questionId:string, cause:ErrorCause|null,
note:string): Promise<void>` em study-service.
Fixtures: `makeHistory(rows: {date:StudyDate; correct:boolean; response:Letter|null;
assisted:boolean; feedbackViewed:boolean}[]): LearningHistory`, com dias/flags explícitos.

- [ ] Testar entrada no caderno e preservação da causa:

```ts
const result = projectLearning(makeHistory([
  { date:'2026-10-02', correct:true, response:'B', assisted:true, feedbackViewed:true }
]), now, settings.reviewPolicy);
expect(result.gaps[0].status).toBe('open');
expect(result.gaps[0].cause).toBe(null);
expect(result.reviews[0].dueDate).toBe('2026-10-05');
```

  Acrescentar casos separados: erro; pulo; baixa confiança; dúvida; chute; dica;
  consulta. Tempo baixo/alto não preenche cause.
- [ ] Rodar `npm test -- tests/domain/learning.test.ts`; esperado falhar antes da projeção.
- [ ] Projetar lacunas pelo histórico sem alterar tentativas; merge preserva note e
  cause confirmados. Acerto independente sem lacuna recebe manutenção, não erro.
  Consumir isReleasedAttempt da Tarefa 4; avaliação ativa não cria lacuna/revisão
  visível. Integrar projectLearning em submitAttempt dentro da transação existente.
  Testar erro em sessão assessment active: zero lacunas publicadas; após completed,
  a mesma tentativa aparece no caderno sem duplicação.
- [ ] Montar caderno com filtro por status/data, causas da spec, anotação opcional,
  vínculos de tentativa e resolução. Playwright confirma nota após recarga.
- [ ] Repetir testes; commit `feat: track learning gaps and learner explanations`.

### Tarefa 6: revisão espaçada e evidência posterior

**Files:** modificar `src/domain/learning.ts`, `src/features/notebook/NotebookPage.tsx`;
criar `tests/domain/reviews.test.ts`, `tests/e2e/review.spec.ts`.

**Interfaces:** manter projectLearning; produzir
`isRetentionEvidence(attempt:Attempt, grade:Grade, baselineDate:StudyDate,
previousEvidenceDate:StudyDate|null, policy:ReviewPolicy): boolean`.
Recebe datas reais; não consulta Date.now internamente.
baselineDate é a tentativa que abriu/reabriu a lacuna; exposição anterior usa
priorFeedbackAt/Date imutáveis. Manutenção usa a data da última tentativa independente.

- [ ] Fixar o calendário no teste:

```ts
expect(projectLearning(historyOnOct02, oct02, policy).reviews[0].dueDate).toBe('2026-10-05');
expect(projectLearning(historyWithSameDayCorrect, oct02, policy).gaps[0].status).toBe('open');
expect(projectLearning(historyWithOct05Independent, oct05, policy).reviews[0].dueDate).toBe('2026-10-19');
expect(projectLearning(historyWithOct19Independent, oct19, policy).gaps[0].status).toBe('recovered');
```

  Fixtures nomeadas usam makeHistory: erro dia02; acerto mesmo dia após feedback;
  primeira evidência dia05; segunda dia19. `policy` tem 3/14/14/2/3. Incluir acerto
  assistido dia05, duas tentativas no mesmo dia e mudança de dia UTC sem mudança no Brasil.
  Acrescentar invariância: adicionar feedback da própria tentativa DEPOIS dela
  não altera sua elegibilidade. Apenas feedback da mesma questão ANTERIOR a
  attempt.at pode desqualificar a tentativa. Primeiro retorno elegível exige
  minEvidenceDays desde a tentativa que abriu/reabriu a lacuna.
- [ ] Rodar `npm test -- tests/domain/reviews.test.ts`; esperado falhar nos novos casos.
- [ ] Creditar apenas dias elegíveis; erro/ajuda reinicia retorno curto; segunda
  evidência recupera o item e mantém manutenção. Não comparar repetição com
  transferência; acertar de forma independente item novo, sem exposição prévia
  e após introdução da habilidade relacionada, recebe “Aplicação em item novo”.
  Item novo errado/assistido não incrementa transferEvidence (Tarefa 11).
- [ ] Testar no navegador com relógio controlado: enunciado reaparece com feedback
  fechado; após nova tentativa mostrar intervalo efetivo e fonte da evidência.
- [ ] Repetir testes/check; commit `feat: schedule delayed independent reviews`.

### Tarefa 7: catálogo, filtros e listas

**Files:** criar `src/content/catalogue.ts`, `src/features/catalogue/CataloguePage.tsx`,
`src/features/catalogue/QuestionDetails.tsx`,
`tests/content/catalogue.test.ts`, `tests/e2e/catalogue.spec.ts`.

**Interfaces:** `filterQuestions(items:QuestionRevision[], filter:{subject?:Subject;
edition?:string; topics?:string[]; skills?:string[]; readiness?:'all'|'ready'|'blocked'}):
QuestionRevision[]`;
`buildMixedList(items:QuestionRevision[], history:LearningHistory,
count:number, seed:number): QuestionRevision[]`.

- [ ] Testar múltiplos assuntos e lista só de prontas:

```ts
expect(filterQuestions([q], {topics:[q.topics[1]]})).toEqual([q]);
expect(buildMixedList([q, blocked], emptyHistory, 10, 7)).toEqual([q]);
expect(buildMixedList(readyItems, history, 4, 7).map(q => q.id))
  .toEqual(buildMixedList(readyItems, history, 4, 7).map(q => q.id));
```

  `q` fixture tem dois assuntos; blocked tem key null; emptyHistory tem quatro arrays
  vazios. Não duplicar questões para preencher count. Seed garante reprodutibilidade.
- [ ] Rodar testes; implementar filtros AND entre categorias/OR dentro da categoria.
  Mistura alterna exatas já introduzidas; inclui manutenção/novas quando existirem.
  Biologia permite bloco por tópico. Não selecionar material bloqueado.
- [ ] Catálogo exibe contagens de inventário e prontidão separadas, motivo do bloqueio,
  origem e detalhes consultáveis. Não oferecer exercício corrigido para item bloqueado.
- [ ] Playwright: selecionar matéria/edição/assunto filtra; navegar diretamente para
  item bloqueado não libera envio; lista mista oculta tópicos até resposta.
- [ ] Repetir content/e2e; commit `feat: add honest catalogue filters and study lists`.

### Tarefa 8: plano diário com capacidade e ajustes

**Files:** criar `src/domain/planning.ts`, `src/features/today/TodayPage.tsx`,
`tests/domain/planning.test.ts`, `tests/e2e/today.spec.ts`.

**Interfaces:** `buildDailyPlan(items:QuestionRevision[], history:LearningHistory,
projection:LearningProjection, settings:Settings, date:StudyDate): DailyPlan`;
`updateDailyPlan(db:StudyDb, plan:DailyPlan, settings:Settings): Promise<void>`.

- [ ] Testar capacidade e excesso:

```ts
const p = buildDailyPlan(readyItems, history, projection, settings, '2026-10-02');
expect(p.tasks.reduce((n,t) => n+t.minutes, 0)).toBeLessThanOrEqual(120);
expect(p.tasks.length).toBeLessThanOrEqual(12);
expect(p.tasks.filter(t => t.reason==='review').length).toBeLessThanOrEqual(4);
expect(p.deferredQuestionIds.length).toBeGreaterThan(0);
expect(buildDailyPlan([], emptyHistory, emptyProjection, settings, '2026-10-02').tasks).toEqual([]);
```

  projection no teste contém 20 revisões vencidas e readyItems contém seus itens
  prontos. Para 12 vagas, floor(12×0,4)=4 revisões; as demais são deferred.
- [ ] Rodar testes; implementar vagas de 10 minutos, floor de capacidade, até 40%
  de revisões e demais lacunas/manutenção/novas. Dias não selecionados começam
  sem plano; estudo manual continua permitido sem fingir ser tarefa prevista.
- [ ] Permitir remover/reordenar/trocar tarefas dentro da capacidade. Nunca apagar
  o vencimento original das revisões adiadas. Exibir quantidade adiada e nova distribuição.
- [ ] Testar sem itens, poucos itens e limite30min; Playwright ajusta120→30,
  reordena e confirma persistência. Sem histórico, criar plano a partir de prontas.
- [ ] Repetir testes; commit `feat: plan sustainable daily study sessions`.

### Tarefa 9: backup validado e restauração sem perda

**Files:** criar `src/storage/backup.ts`, `src/features/settings/BackupPanel.tsx`,
`tests/storage/backup.test.ts`, `tests/e2e/backup.spec.ts`.

**Interfaces:** `BackupEnvelope = {format:'udesc-study';schemaVersion:1;
exportedAt:Instant;data:{questionSnapshots:QuestionRevision[];sessions:StudySession[];
attempts:Attempt[];grades:Grade[];feedback:FeedbackEvent[];gaps:Gap[];reviews:Review[];
settings:Settings;drafts:DraftRecord[];plans:DailyPlan[];submissionReceipts:
{submissionId:string;attemptId:string;payloadHash:string}[]}}`.
`exportBackup(db:StudyDb, now:Instant):Promise<BackupEnvelope>`;
`previewImport(db:StudyDb, json:unknown):Promise<{valid:boolean;added:number;
duplicates:number;conflicts:string[];errors:string[]}>`;
`mergeBackup(db:StudyDb, envelope:BackupEnvelope):Promise<void>`.

- [ ] Testar repetição, conflito e versão futura:

```ts
await mergeBackup(db, backup); await mergeBackup(db, backup);
expect(await db.attempts.count()).toBe(backup.data.attempts.length);
expect((await previewImport(db, { ...backup, schemaVersion:2 })).valid).toBe(false);
expect((await previewImport(db, conflictingBackup)).conflicts.length).toBeGreaterThan(0);
await expect(mergeBackup(db, conflictingBackup)).rejects.toThrow();
expect(await exportBackup(db, now)).toEqual(beforeConflict);
```

  conflictingBackup repete um attempt.id com response diferente; beforeConflict
  vem de exportBackup com mesmo now. Snapshot usado por tentativa deve existir.
  Incluir sessão sem respostas: exportar/restaurar mantém todos os snapshots e
  permite retomar sem depender da versão atual do catálogo.
- [ ] Rodar testes; validar arrays/IDs/vínculos e conflito antes da transação única.
  Dados desconhecidos/versão futura são recusados sem importação parcial.
- [ ] Mostrar prévia e confirmação da operação de merge na interface do app;
  exportar arquivo versionado. Erro preserva o histórico atual e oferece diagnóstico.
- [ ] Playwright exporta, limpa apenas DB de teste, restaura e confirma notas/
  histórico/rascunho; segunda importação não duplica. Verificar arquivoJSON completo.
- [ ] Repetir testes; commit `feat: add validated versioned study backups`.

### Tarefa 10: avaliação parcial sem feedback antecipado

**Files:** criar `src/domain/assessment.ts`,
`src/features/assessment/AssessmentPage.tsx`,
`tests/domain/assessment.test.ts`, `tests/e2e/assessment.spec.ts`;
modificar serviço para encerramento transacional.

**Interfaces:** `AssessmentConfig = {count:number;durationMinutes:number;
subjects:Subject[];edition:string|null}`;
`selectAssessment(items:QuestionRevision[], config:AssessmentConfig, seed:number):
QuestionRevision[]` lança erro de quantidade insuficiente;
`completeAssessment(db:StudyDb, sessionId:string, now:Instant):Promise<StudySession>`.

- [ ] Testar seleção e fechamento:

```ts
expect(() => selectAssessment([q], {count:10,durationMinutes:30,subjects:[q.subject],edition:null},7))
  .toThrow('Questões prontas insuficientes');
await expect(revealFeedback(db, assessmentAttempt.id, now)).rejects.toThrow();
await completeAssessment(db, session.id, now);
expect((await revealFeedback(db, assessmentAttempt.id, now)).attemptId).toBe(assessmentAttempt.id);
```

  Sessão criada active em assessment; usar serviço da Tarefa3 para assessmentAttempt.
- [ ] Rodar testes; gerar sessão configurável com rótulo “Simulado parcial”.
  Não alegar prova100/duraçãooficial; não fabricar itens se seleção insuficiente.
- [ ] Ao finalizar ou expirar, promover o último DraftRecord válido salvo antes
  do prazo a tentativa; criar pulo somente onde não houver resposta. Persistir
  tentativas restantes, estado completed e projeções liberadas em uma transação
  idempotente. Em expiração usar o deadlineAt como instante de encerramento;
  retomada tardia não aceita alteração e conclui com os dados duráveis anteriores.
  Tentativas já enviadas não são sobrescritas. Retomada mantém o prazo original.
  Sem dicas, resoluções ou rota de correção antes do encerramento.
- [ ] Playwright testa recarga e navegação direta para feedback antes/depois do fim;
  confirma que pulos entram no caderno e envio final duplicado é idempotente.
  Testar draft B → prazo vencido → uma tentativa B; item vazio → um pulo;
  segundo encerramento → nenhuma duplicata. Testar caderno/progresso durante
  avaliação ativa: nenhum novo acerto/erro; esses resultados aparecem após o fim.
- [ ] Repetir domain/e2e; commit `feat: add resumable partial assessments`.

### Tarefa 11: progresso com denominadores e versões

**Files:** criar `src/domain/metrics.ts`, `src/features/progress/ProgressPage.tsx`,
`tests/domain/metrics.test.ts`, `tests/e2e/progress.spec.ts`;
modificar study-service e criar `tests/storage/regrade.test.ts`.

**Interfaces:** `computeMetrics(history:LearningHistory, snapshots:QuestionRevision[],
filter:{from:StudyDate;to:StudyDate;subject?:Subject;topic?:string}): StudyMetrics`.
StudyMetrics definido no arquivo:
`{newItems:number;repeatAttempts:number;firstAttemptCorrect:number;
firstAttemptTotal:number;independentCorrect:number;independentTotal:number;
assistedCorrect:number;assistedTotal:number;activeMs:number;
retentionEvidence:number;transferEvidence:number;annulledExcluded:number;
keyRevisions:string[];decisionRevisions:string[]}`.
Produzir `regradeAttempt(db:StudyDb,attemptId:string,newQuestionRevision:
QuestionRevision,now:Instant):Promise<Grade>` em study-service. Exigir gabarito
novo conferido (ou annulment verificado com procedência), persistir novo snapshot/evento kind=regrade
e recalcular projeções em transação, preservando tentativa/grade/snapshot originais.
Mesmo attemptId+decisionRevision retorna a reavaliação já feita, sem duplicá-la.
Rejeitar newQuestionRevision.id diferente da questão da tentativa. Anulação tem
decisão própria mesmo que o gabarito antigo seja mantido ou key seja null.

- [ ] Testar resultados separados:

```ts
expect(metrics.firstAttemptTotal).toBe(1);
expect(metrics.firstAttemptCorrect).toBe(0);
expect(metrics.repeatAttempts).toBe(1);
expect(metrics.assistedCorrect).toBe(1);
expect(emptyMetrics.independentTotal).toBe(0);
expect(annulledMetrics.annulledExcluded).toBe(1);
```

  Primeiro item: erro inicial, depois acerto com consulta. emptyMetrics vem de
  emptyHistory. annulledMetrics usa evento de anulação com correct=null e
  exclusionReason=annulled sobre tentativa histórica antes válida.
  Adicionar teste: grade inicial B → novo gabarito C → duas grades, mesma tentativa,
  ambos snapshots preservados e métricas atuais com a grade mais recente.
  Depois, anulação verificada → terceiro evento com decisionRevision próprio,
  keyRevision=null e exclusionReason=annulled; repetir anulação não cria evento.
  Aplicação em item novo: questão diferente, habilidade introduzida previamente,
  acerto independente sem exposição prévia; erro, baixa confiança ou assistência
  geram zero transferEvidence. Avaliação ativa gera zero métricas publicadas.
- [ ] Rodar testes; computar primeira tentativa por item/histórico inteiro antes
  de filtrar período. Retentativa no período não passa a ser “primeira”.
  Sem denominador, não calcular percentual. Para cada tentativa usar a última
  Grade explícita; exclusionReason=annulled sai do denominador. Exibir a revisão
  aplicada e permitir consultar a inicial. Regrade que invalida evidência reabre
  lacuna e mantém causa/anotação, sem apagar a tentativa original.
- [ ] Renderizar tabela por matéria/assunto com acertos/total, datas, ajuda e
  amostra; distinguir retenção/transferência. Histórico de frequência6provas é
  consulta do mapa, nunca curva de evolução individual.
  Rotular o mapa como provisório e mostrar quantidade de classificações sinalizadas
  incertas na amostra (68 no total); prontidão de treino é outro indicador.
- [ ] Playwright sem dados mostra texto vazio sem gráfico preenchido; com fixture
  confirma numerador/denominador/período e separação novas/repetidas/assistidas.
- [ ] Repetir testes/check; commit `feat: show evidence based study progress`.

### Tarefa 12: offline, direção visual e aceite do MVP

**Files:** criar `src/ui/AppShell.tsx`, estilos, ícones reais do app e manifesto PWA;
modificar vite.config para cache versionado; criar `tests/e2e/offline.spec.ts`,
`tests/e2e/mobile.spec.ts`; atualizar README e instruções do ambiente após validação.

**Interfaces:** AppShell fornece rotas Hoje/Questões/Caderno/Progresso,
`/practice/:sessionId`, `/assessment/:sessionId` e configurações/backup.
UpdatePrompt recebe `{sessionActive:boolean;onApply:()=>void}`; nunca recarrega
automaticamente com sessão ativa.

- [ ] Escrever testes de produção local:

```ts
await page.goto('/'); await page.waitForFunction(() => navigator.serviceWorker.controller);
await context.setOffline(true);
await page.reload();
await expect(page.getByRole('navigation')).toBeVisible();
await expect(page.getByText('Você ainda não registrou tentativas.')).toBeVisible();
```

  Executar contra build/preview, não servidordev. Para DB com sessão ativa,
  confirmar retorno à mesma questão e feedback fechado. Limpar cache/DB entre cenários.
- [ ] Implementar precache do shell/catálogo/questões/ativos locais; assets remotos
  não são dependência de treino offline. Atualização solicita ação depois da sessão.
  Em cache incompleto, informar quais conteúdos ainda precisam de conexão.
- [ ] Aplicar tokens da spec e controles sem decoração. Verificar contraste nas
  cores usadas, foco, rádio rotulado, navegação por teclado, descrição de figuras
  e saída MathML. Inspecionar320px/zoom200%; sem prosa cortada ou botão sobre alternativa.
- [ ] Rodar `npm run content:audit`, `npm run check`, `npm test`,
  `npm run build` e `npm run test:e2e`. Confirmar testes executados, sem confundir
  fixture, skip e falha. Falha de conteúdo impede afirmar treino pronto.
- [ ] Validar primeiro ciclo com questão real certificada, backup/recarga e revisão
  com relógio controlado. Documentar evidência e limites; commit
  `feat: finish offline accessible UDESC study app`.
- [ ] Depois de testar npm ci/dev/preview, salvar install_script e start_skill
  reutilizáveis nas configurações cloud. Scripts usam npm ci e checkout atual;
  processos reiniciam por tarefa. Não publicar/deployar como consequência do plano.

## Conferência de cobertura

| Requisito | Tarefas |
| --- | --- |
| Fontes/questões/múltiplos assuntos | 1, 2, 7 |
| Tentativa antes de resposta | 3, 4 |
| Correção comentada e autoria | 2, 4 |
| Caderno e intervenção pelo aluno | 5 |
| Revisão posterior independente | 6 |
| Listas mistas sem indicar método | 7 |
| Plano sustentável e ajustes | 8 |
| Backup/persistência | 3, 9 |
| Simulados com mesmo histórico | 10 |
| Painel sem confundir atividade/domínio | 11 |
| Offline/celular/teclado | 12 |

## Execução e decisões externas

Recomendação de execução: nativa com revisão independente do conjunto e
paralelização das tarefas que já têm contratos estabilizados. Importação e
conferência do conteúdo podem caminhar enquanto a mecânica é implementada. O
serviço transacional, o domínio e a revisão final precisam de revisão cuidadosa
porque erro nesses pontos altera o histórico de aprendizagem.

Antes de aprovar o primeiro treino como pronto, fornecer ou obter cadernos e
gabaritos oficiais dos mesmos itens do acervo. Originais também permitem corrigir
notação/recuperar figuras com procedência. Não há credencial obrigatória para o
app local. Acesso a fontes oficiais, se necessário, exige permitir o destino
correto nas configurações de rede; não substituir uma allowlist desconhecida.

Estimativas de prazo devem ser feitas depois da primeira seleção conferida; o
maior desconhecido atual é o trabalho de validar conteúdo, não o framework.
