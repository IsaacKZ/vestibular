# Ciclo de estudo com questões comparáveis e apoio por erro

O usuário autorizou aplicar as pesquisas, começando pelos pontos mais importantes,
e mantém a orientação de executar sem perguntas. Esta mudança envolve conteúdo,
registro de consulta e caderno; será planejada como alteração arquitetural e
executada com tarefas independentes e revisão. A autorização prévia de publicação
no GitHub Pages permanece. Objetivo: tentar, compreender o erro e praticar outro
problema oficial, com registro honesto de ajuda e histórico preservado.

## Escopo

1. Enriquecer as 78 questões prontas com conceito, exemplo da própria questão,
   pré-requisitos disponíveis e habilidades comuns pedagogicamente justificadas.
2. Conferir seis itens oficiais adicionais: Matemática2024/1Q1,2025/1Q10,
   2026/1Q11,2026/2Q10; Português2025/2Q38,Q41, incluindo textos de apoio completos.
3. Preferir problemas ainda não expostos na sugestão de prática guiada; usar já
   expostos como alternativa explicitamente identificada. Preservar exclusões.
4. Permitir consultar apoio atualizado no caderno mesmo após tentativa antiga,
   registrando a revisão realmente exibida antes de mostrá-la.
5. Validar o ciclo com conteúdo real, histórico, backup, celular e offline; publicar.

Não será criado um novo agendador, área de flashcards ou reserva artificial de
avaliações. Os parâmetros de revisão e o mecanismo de aplicação posterior já
existentes permanecem. A expansão integral dos342itens pendentes é outro lote.

## Conteúdo e contratos

- Manter420identidades do inventário e404gabaritos/16anulações; liberar apenas os
  seis itens especificados após confronto com originais. Treino esperado:84itens.
- Não alterar rawText/hash/identidade dos registros, gabaritos oficiais, figuras
  publicadas ou snapshots antigos. Novos metadados geram nova revisão determinística.
- Apoio em todas as84questões; não inventar enunciados de treino. Exemplos comentam
  a própria questão oficial e se identificam como apoio elaborado para estudo.
- Habilidades comuns usam igualdade exata de disciplina e descrição; conservar
  habilidades originais. No mínimo um grupo válido por disciplina disponível e
  pelo menos20itens com outro pronto da mesma habilidade. Não agrupar só por matéria.
- Pré-requisito só aponta a outra questão pronta de habilidade efetivamente
  anterior; se não existir, usar lista vazia. Nenhum vínculo inventado por cobertura.
- Novos registros pedagógicos ficam em content/pedagogy/*.json como arrays de
  {id,skills,learning}. skills são adicionais; learning usa o contrato existente.
  Os seis novos registros de conferência ficam em content/reviews.json.
- Cada apoio inclui fonte e revisor identificado como Codex; conferência técnica
  independente precede publicação. Apoio elaborado não é resolução oficial.

## Registro e histórico

Adicionar revealLearningSupport(db,attemptId,currentQuestion,at,exposureId?)
retornando FeedbackEvent. Na transação: validar a questão e apoio, localizar
mesmo questionId da tentativa, bloquear simulado ativo para o item e correção
prematura de avaliação; aplicar limites cronológicos existentes; guardar snapshot
imutável e evento com namespace support e revisão atual. Idempotência por token:
reutilizar o mesmo evento/snapshot, inclusive se o catálogo mudar depois.

Não criar ou substituir Grade, Attempt ou snapshots existentes. revealFeedback
continua mostrando a correção histórica registrada. A descrição de questionRevision
no FeedbackEvent passa a abranger apoio e correção consultados. Backups existentes
continuam válidos; o backup novo preserva as exposições. Baselines de envios futuros
podem reconhecer a habilidade do apoio novo; não reconstruir evidência retroativa.

selectRemediationQuestions mantém os quatro parâmetros atuais e recebe exposedIds
opcional como quinto parâmetro. Expostos incluem qualquer sessão iniciada, tentativa
ou feedback. Ordenar inéditos primeiro, estável entre equivalentes. Excluir questão
atual, IDs protegidos, reservados, bloqueados e duplicados. Expostos não são proibidos
para prática guiada; essa prática continua marcada como consulta e não confirma domínio.

## Caderno e leitura

Entender o erro registra a consulta ao apoio atual revisado e mostra o snapshot do
evento depois que a escrita termina. Falha ou simulado concorrente mantém apoio
fechado. Mostrar conceito, exemplo da questão, ação por causa e pergunta específica.
Identificar sugestão por matéria/edição/número, e avisar quando já foi exposta.
Não revelar enunciado de candidato antes de iniciar a sessão. Estado sem alternativa
continua explícito. Correção da prática continua com título Resolução e fonte.

Um par permite uma oportunidade posterior; consistência exige pelo menos três
itens em dias posteriores, conforme o mecanismo existente. Não apresentar pares,
consulta ou um acerto como certificação de domínio ou promessa de aprovação.

## Restrições globais

Node24, React/TypeScript existentes, nenhuma dependência nova, nenhuma migração de
banco. Preservar tema editorial e contraste, alvos44px,320px e rotas raiz/Pages.
Nenhum build concorrente deve sobrescrever dist enquanto testes o servem.
