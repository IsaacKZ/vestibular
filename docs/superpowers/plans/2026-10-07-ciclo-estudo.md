# Ciclo de estudo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox syntax for tracking.

**Goal:** Disponibilizar apoio e prática em questões oficiais comparáveis, inclusive para erros históricos.
**Architecture:** Camada de registros pedagógicos versionados pelo importador; API explícita de exposição ao apoio, seleção por exposição e caderno. Histórico imutável e contratos existentes.
**Tech Stack:** React19, TypeScript, Dexie/IndexedDB, Vitest/Playwright, Node24.
**Spec:** docs/superpowers/specs/2026-10-07-ciclo-estudo-design.md

## Global Constraints

-420IDs,404respostas/16anulações;84prontas após conferir seis novos itens definidos na spec.
- Apoio revisado nas84; habilidades originais conservadas; mínimo20itens com pares e grupo por disciplina.
- Nenhuma alteração de rawText/hash/gabarito/figura já publicada, snapshot, tentativa ou grade antiga.
- Nenhuma dependência/migração de banco; base Pages/vestibular;320px e alvos44px preservados.
- Prática após apoio é consulta; pares não demonstram consistência ou eficácia do produto.

## Review Focus

- Tentativa antiga consulta apoio novo sem substituir correção antiga ou retroagir evidência.
- Token repetido com apoio mudado retorna exposição original, com snapshot correspondente.
- Simulado iniciado concorrentemente bloqueia apoio e candidatos; falha de escrita mantém UI fechada.
- Questão nova sugerida prefere IDs nunca iniciados, sem tratar revisão nova do mesmo ID como inédita.
- Apoio/skills não liberam item incompleto, anulado ou sem procedência; textos portugueses incluem continuação e marcas significativas.

### Task1: Camada de conteúdo pedagógico

**Files:** scripts/import-corpus.ts, scripts/audit-content.ts; tests/content/import.test.ts.
**Interfaces:** Consumes ContentRecords; produces PedagogyRecord {id,skills,learning}, readPedagogyRecords(root=content/pedagogy):PedagogyRecord[], ContentRecords.pedagogy optional.

- [x] Escrever regressões: overlay mantém skills/rawText/key, gera revisão nova determinística; rejeita ID duplicado/desconhecido e apoio sobre transcrição não conferida.
- [x] Rodar npm test -- tests/content/import.test.ts e observar falha esperada.
- [x] Aplicar pedagogy depois de gabaritos/resoluções, unir skills conservando ordem e deduplicando; copiar learning; incluir IDs no versionamento. Ler arrays JSON em ordem de nome; ligar geração e auditoria à mesma leitura.
- [x] Verificar testes e tipos. Revisão de tarefa antes da integração.

### Task2: Conteúdo oficial e apoio

**Files:** content/pedagogy/{biologia,fisica,quimica,matematica-portugues}.json; content/reviews.json; relatório docs/conteudo-pedagogico-2026-10-07.md; tests/content/learning-corpus.test.ts.
**Interfaces:** Consumes84objetos publicados/conferidos e PedagogyRecord; produces84apoios, grupos comparáveis e seis novas revisões integrais.

- [x] Escrever teste de corpus real:84prontas, suporte validado em todas, grupos por matéria e20itens com pares, vínculos válidos, invariantes de originais/keys/assets.
- [x] Observar RED antes de adicionar conteúdo.
- [x] Curar três disciplinas existentes e novo lote math/português em arquivos disjuntos; justificar agrupamentos e conferir os dois textos de apoio no original. Root une os seis reviews; corrige também os distratores comprovadamente divergentes da Física2025/2Q14.
- [x] Revisar ciência, contas, letras e granularidade por conferência independente; corrigir antes de importar.
- [x] Gerar conteúdo, auditar, conferir determinismo e testes. Não adicionar fixtures ao produto.

### Task3: Apoio histórico e preferência por questão nova

**Files:** src/storage/study-service.ts, src/domain/remediation.ts, src/features/notebook/GapDetails.tsx, src/content/types.ts; tests/storage/learning-support.test.ts, tests/domain/remediation.test.ts, tests/ui/gap-remediation.test.tsx.
**Interfaces:** Consumes QuestionRevision.learning e immutable snapshots; produces revealLearningSupport signature da spec, optional exposedIds quinto argumento, caderno com gravação antes de exibição.

- [x] Escrever/rodar RED para novo apoio em tentativa antiga: preserva tentativa/grade/snapshot, token idempotente, backup válido, bloqueio de avaliação e tempo.
- [x] Escrever/rodar RED para seleção priorizando não iniciados e mantendo fallback/bloqueios.
- [x] Implementar a API com transação e namespace support; seguir cronologia e guards de revealFeedback; usar snapshot do evento na UI.
- [x] Passar todos os IDs iniciados/tentados/expostos; identificar candidato e avisar já estudado. Conservar prática guiada e títulos de correção.
- [x] Testar falha/concorrência, metadados atualizados depois do token, e UI que só abre após escrita. Revisão de tarefa.

### Task4: Integração, evidência e publicação

**Files:** tests/e2e/published-learning.spec.ts; ajustes assertion Resolução da prática se necessários; README/docs de entrega.
**Interfaces:** Consumes tarefas1–3; produces ciclo real demonstrado e publicação verificada.

- [x] Adicionar E2E de integração real, após RED do corpus/UI: erro→apoio→outro item guiado com consulta; fonte/figura/texto, persistência e backup. Testar ao menos math e português carregando suporte.
- [x] Verificar base legada em storage: exposição nova aparece só em envios futuros; não altera projeção antiga; prática guiada nunca conta como evidência independente.
- [x] npm test, content:audit, build raiz+test:e2e; depois build:pages+test:pages.
- [x] Revisão final independente; corrigir achados materiais com regressões.
Publicação operacional: commit/push normal para main já autorizado, acompanhar Actions e comparar artefatos publicados ao build validado. Atualizar docs/contagens e relatar limites reais.
