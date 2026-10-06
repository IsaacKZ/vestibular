# Correções de aprendizagem do Caderno UDESC

O pedido “arrume os erros” autoriza executar as recomendações concretas do
parecer de aprendizagem. O usuário já pediu continuidade sem perguntas. As
mudanças ficam no checkout existente, sem publicação, dependências novas ou
alteração das fontes brutas. O acervo continua bloqueado até conferência real.

## Resultado esperado

O plano distribui as matérias, prioriza atrasos sem alimentar uma fila crescente,
estima a carga a partir do histórico e considera a data da prova. O caderno leva
da causa do erro a apoio conferido e a outro problema. O progresso diferencia
retenção de um item de aplicação posterior em itens diferentes da mesma habilidade.
Uma avaliação reservada usa itens que o aluno ainda não estudou.

## Contratos compatíveis com registros antigos

Campos opcionais em `QuestionRevision`:

- `difficulty?: "easy" | "medium" | "hard"`, classificação humana, não calibração estatística.
- `assessmentOnly?: boolean`, reserva explícita. Itens reservados não entram em treino/listas/plano.
- `learning?: { concept: string; workedExample: string; prerequisites: { subject: Subject; skill: string }[]; reviewed: boolean; source: string; reviewer: string }`.
  Apoio só pode ser exibido se conferido e com procedência; resolução existente é fallback.

Campos opcionais em `StudySession`: `purpose?: "practice" | "guided" | "benchmark"`.
Benchmark exige modo assessment. Guided exige study e grava consulta no envio.

Campo opcional em `Attempt`:
`skillFeedback?: { subject: Subject; skill: string; at: Instant; studyDate: StudyDate }[]`.
O serviço captura a última exposição já persistida para cada habilidade da questão,
antes do envio, incluindo exposições no mesmo instante. Esse baseline é imutável;
correções posteriores não apagam evidências. Registros antigos continuam restauráveis,
mas ausência do baseline limita a confirmação de aplicação posterior.
`FeedbackEvent.questionRevision?` preserva a revisão da correção exibida, inclusive
depois de uma reclassificação; eventos antigos continuam sem esse campo.

`isReady` passa a exigir habilidades revisadas não vazias; bloqueio `missing_skills`.
`canPractice(q)` exige `isReady(q) && !q.assessmentOnly`.

## Planejamento e calendário

- Selecionar novidades com distribuição entre disciplinas e métodos, sem depender dos IDs.
- Até 12 tarefas e 120 minutos/dia, cinco dias/semana. Estimar 5–30 minutos por item,
  com mediana do tempo ativo histórico acrescida de margem para correção; fallback10.
- Atrasos que ocupam a capacidade diária reduzem novidades até zero. A regra fixa
  de quatro revisões deixa de ser validação de persistência ou backup.
- Não antecipar revisões futuras nem mudar datas originais de atrasos.
- `projectLearning(history, now, policy, targetExamDate?)` limita retornos que surgem
  antes da prova à data-alvo, sem mover retorno para antes da tentativa. Evidência
  continua exigindo espaçamento: agendar mais cedo não fabrica retenção.
- `fitDailyPlan` usa minutos reais das tarefas, preserva data e adiados e não aplica
  teto de 40% de revisões. UI e persistência devem seguir os mesmos limites.

## Evidência por habilidade

Novo módulo puro `src/domain/skill-evidence.ts` calcula evidências por
`subject + skill` usando snapshots imutáveis, grades atuais e sessões liberadas.
Tentativas com ajuda/chute/dúvida, sem baseline de exposição, imediatas, anuladas
ou antes do encerramento de um simulado não comprovam aplicação posterior.
Uma evidência de aplicação usa uma questão diferente da introdução daquela
habilidade, independente e atrasada pelo intervalo mínimo. Se houver dificuldade
declarada nos dois itens, distinguir níveis em vez de afirmar equivalência.
Exibir oportunidades/acertos, itens distintos e datas; pelo menos dois itens
diferentes e separados para sinalizar evidência consistente, sem chamar isso de
domínio comprovado ou probabilidade de aprovação.

## Recuperação

Novo módulo puro `src/domain/remediation.ts` sugere ação por causa do erro e
seleciona questões prontas diferentes com a mesma habilidade; pré-requisitos
usam vínculos conferidos no apoio. Reservados ficam fora de todas as sugestões.
No caderno, “Entender o erro” grava exposição antes de mostrar apoio/autoexplicação.
Uma prática logo após esse apoio inicia sessão guided, marcada como consulta.
Uma tentativa normal em outro dia pode servir como evidência posterior.
Se faltar apoio ou alternativa pronta, dizer isso; não gerar conteúdo ou respostas.

## Avaliações reservadas

`AssessmentConfig` recebe `purpose?: "practice" | "benchmark"` e
`difficulty?: "easy" | "medium" | "hard" | null`.
`selectAssessment(items, config, seed, history?)` mantém chamadas antigas.
Prática exclui reservados; benchmark só usa reservados com habilidades e
dificuldade declarada, sem tentativas, feedback, rascunho/sessão anterior exposta.
Distribuir as matérias; não preencher falta com itens vistos ou duplicados.
Serviço de início valida novamente isso dentro da transação, inclusive abas
concorrentes. Questões reservadas não mostram enunciado/texto bruto fora de sua
avaliação; após conclusão, correção fica disponível e o item não volta a ser inédito.
Simulado continua parcial. Medição integral e redação podem ocorrer fora do app.

## Verificação

Regressões de seleção por IDs, atraso crescente, orçamento variável, prova próxima,
memória do mesmo item, exposição em outra questão da habilidade, feedback posterior,
apoio sem procedência, reservado contaminado/aba concorrente e backup antigo/novo.
Usar fixtures somente em testes. Conferir typecheck, suíte, auditoria, build e navegador.
