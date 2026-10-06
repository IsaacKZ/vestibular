# Correções pedagógicas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Preserve existing work and use the cloud checkout.

**Goal:** Corrigir os caminhos de estudo e medição descritos no parecer.
**Architecture:** Contratos opcionais preservam registros antigos. Novos módulos puros
isolam evidência por habilidade e recuperação; a persistência valida reservas e baselines.
**Tech Stack:** React, TypeScript, Dexie, Zod, Vitest, Playwright; sem dependências novas.
**Spec:** docs/superpowers/specs/2026-10-02-pedagogia-design.md

## Global Constraints

- Manter as cinco disciplinas, 120 minutos/dia e cinco dias/semana.
- Não inventar gabaritos, originais, habilidades revisadas ou resoluções reais.
- Não alterar fontes brutas, publicar, fazer push ou criar worktree adicional.
- Campo novo opcional: backup antigo deve continuar válido e não ganhar certezas retroativas.
- Tarefas paralelas têm propriedade exclusiva; root mantém contratos/persistência e integração.

## Review Focus

- Aba concorrente tenta consumir questão reservada: recusar antes de gravar.
- Uma correção posterior muda o histórico de exposição: preservar o baseline da tentativa.
- Poucos itens/dificuldade desconhecida: apresentar falta de evidência, não completar com vistos.
- Prova próxima e poucos dias: não backdatear nem contar acerto imediato como retenção.
- Plano com oito revisões de durações diferentes: aceitar se cabe no orçamento e restaurar.

## Tasks e propriedade

### 1. Contratos e persistência — root

- [x] Testes RED para metadados opcionais, habilidades, reserva, guided, exposição por habilidade e orçamento.
- [x] Tipos/schemas/quality/constants, estudo/backup, proteção de catálogo e snapshots.
- [x] GREEN de contratos/storage e roundtrip antigo/novo; proteger IDs/procedência.

### 2. Plano diário — implementer planning

Files: domain/planning.ts, features/today/{fitDailyPlan,TodayPage}, tests de planejamento.
Consumes: canPractice e os contratos opcionais da spec.

- [x] RED: novidades abrangem cinco matérias; atrasos suprimem novidades; tempos diferentes cabem; reservados excluídos.
- [x] Implementar distribuição, estimativa e carga adaptada; integrar ajuste de plano/UI.
- [x] GREEN focado; reportar mudanças e resultados, sem build/commit.

### 3. Evidências e calendário — implementer evidence

Files: domain/{skill-evidence,learning,metrics}, features/progress/ProgressPage, seus testes.

- [x] RED: mesmo item não confirma habilidade; itens novos atrasados e sem ajuda contam; exposição compartilhada bloqueia; feedback posterior não altera evidência; escopo por matéria.
- [x] Implementar projectSkillEvidence, denominadores/UI e targetExamDate opcional na projeção.
- [x] GREEN e compatibilidade histórica, sem editar storage/shared contracts.

### 4. Recuperação — implementer recovery

Files: domain/remediation.ts, features/notebook/GapDetails, features/practice/FeedbackPanel, testes novos.

- [x] RED: causa determina ação; alternativa compartilha habilidade/é distinta; pré-requisito conferido; reservado e bloqueado excluídos.
- [x] Integrar apoio após exposição, pergunta curta e startSession purpose guided.
- [x] GREEN focado e navegador/React se pertinente; sem editar PracticePage/shared contracts.

### 5. Avaliações — implementer assessment

Files: domain/assessment.ts, features/assessment/AssessmentPage, testes assessment e browser novo.

- [x] RED: benchmark só reservado/inédito/classificado; prática exclui reserva; distribuição e falta explícita; repetir não é inédito.
- [x] Implementar seleções compatíveis, controles e purpose no início.
- [x] GREEN; root implementa proteção transacional e catálogo.

### 6. Integração e revisão — root/reviewer

- [x] Revisar tarefas, corrigir integração, manter evidência de regressões.
- [x] Formatar; typecheck, testes completos, import/audit determinístico, build, todos E2E.
- [x] Revisão independente final e documentação dos limites e resultados.

## Ledger

Ruling: executar sem pedir confirmação — o pedido atual autoriza as correções do
parecer, e o usuário já pediu continuidade sem perguntas. Os originais oficiais
ausentes são dependência externa; implementar mecanismos e manter bloqueio honesto.
Ruling: distribuir implementadores por arquivos exclusivos em paralelo — instrução
de colaboração ativa exige paralelização útil; contratos são centralizados no root.

Task 1: contratos e persistência implementados; revisão identificou inferência
indevida de revisão antiga, reserva posterior no backup e continuação de legado.
Correções cobertas por regressões; 66 testes de armazenamento antes da onda final.
Task 2: planejamento concluído; 23 testes focados.
Task 3: evidência e calendário concluídos; 58 testes focados após corrigir a
fronteira de data: o mesmo instante não representa espaçamento.
Task 4: recuperação concluída; 16 testes focados e um fluxo de navegador.
Task 5: avaliações concluídas; 14 testes focados e um fluxo de navegador.
Task 6: primeira integração com 245 testes e build aprovados. Navegador: 19/21;
as duas falhas dependiam do sábado da máquina, corrigidas fixando sexta-feira
nos testes de planejamento; 2/2 focados aprovados.
Task 6: revisão independente encontrou backup legado misto; correção por
questão/revisão e proteção de relógio cobertas por nove regressões, 75 testes de
armazenamento e integração com 254 testes. Revisor encontrou bloqueio de
encerramento de simulado vencido com feedback posterior de outra questão;
finalização conservadora está sendo verificada antes de concluir.

Ruling: guardar a revisão exibida no feedback e ordem causal das sessões —
timestamps iguais ou relógio corrigido não representam a ordem das operações;
o custo é manter metadados opcionais e tratar legado sem prova como incerteza.
Ruling: finalizar avaliações vencidas com baseline desconhecido quando há
exposição posterior incompatível com o instante sintético — não deixar uma sessão
presa nem produzir confirmação retrospectiva; o custo é deixar de contar algumas
aplicações cuja cronologia não pode ser assegurada.

Task 6: regressão de encerramento vencido corrigida e aprovada em revisão
independente do diff; respostas/rascunhos e horário-limite preservados, baseline
incerto omitido. 77 testes de armazenamento, 256 testes completos e build
aprovados. Verificação final de 21 cenários do navegador em execução.

Task 6: complete — revisão final e emendas aprovadas; sem defeitos críticos ou
importantes abertos. Validação final: 256 testes de módulos em 36 arquivos,
21 cenários de navegador, TypeScript/build e auditoria aprovados. Importação
determinística (três arquivos JSON idênticos após regeneração). Sem commit,
push ou publicação; alterações no checkout autorizado. Acervo real ainda
aguarda originais/gabaritos e conferência, com 420 itens e zero certificados.
