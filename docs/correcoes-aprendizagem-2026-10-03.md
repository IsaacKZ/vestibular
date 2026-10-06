# Correções dos caminhos de aprendizagem

Data: 3 de outubro de 2026. Implementação das recomendações do
[parecer de aprendizagem](avaliacao-aprendizagem-2026-10-02.md).

## O que mudou

| Falha identificada                              | Comportamento implementado                                                                                                                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Novidades concentradas na ordem dos IDs         | O plano distribui disciplinas e habilidades, considerando a carga já escolhida.                                                                                                                         |
| Teto fixo de revisões alimentava atrasos        | Revisões vencidas recebem capacidade antes de novidades; atrasos não atendidos suspendem novos itens. O vencimento original permanece.                                                                  |
| Todas as tarefas valiam dez minutos             | Estimativa pela mediana do tempo ativo, com margem de 25% para correção, limitada a 5–30 minutos. Sem amostra, usa dez. UI e armazenamento somam os minutos reais, com limite separado de doze tarefas. |
| Data da prova sem efeito nas revisões           | Retornos produzidos antes da prova ficam limitados à data-alvo. Antecipar uma revisão não reduz o intervalo exigido para contar evidência.                                                              |
| Recuperação restrita à mesma questão            | O progresso separa retenção do item e aplicação posterior em itens diferentes da habilidade, com denominadores, datas, itens distintos e dificuldade declarada.                                         |
| Apoio não orientado pela causa do erro          | O caderno apresenta ação e pergunta de autoexplicação conforme a causa, com conceito/exemplo conferidos ou resolução revisada. Sugere outro problema ou pré-requisito disponível.                       |
| Prática após apoio poderia parecer independente | Sessões guiadas registram consulta obrigatoriamente, inclusive em rascunhos, envios repetidos e backups.                                                                                                |
| Simulados não preservavam um conjunto inédito   | Avaliação reservada exige itens conferidos, habilidades e dificuldade, sem exposição anterior por sessão, tentativa ou feedback. Escassez bloqueia o início; não entram itens já estudados.             |

Os módulos centrais são [planejamento](../src/domain/planning.ts),
[evidência por habilidade](../src/domain/skill-evidence.ts),
[recuperação](../src/domain/remediation.ts) e
[avaliação](../src/domain/assessment.ts). A
[conferência do conteúdo](../content/README.md) descreve os novos metadados.

## Integridade do histórico

Uma exposição guarda a revisão da correção efetivamente aberta. As telas mantêm
essa resolução e sua avaliação juntas; abrir uma decisão posterior registra
nova exposição. Baselines por habilidade são capturados no envio e não mudam
quando o aluno consulta uma resolução depois.

Feedback antigo sem revisão identificável é preservado como incerteza, sem
atribuir retroativamente o conceito de uma revisão diferente. Uma exposição
posterior explicitamente registrada pode resolver essa incerteza. Snapshots
antigos sem habilidades não iniciam novos treinos, mas sessões existentes podem
continuar e seu histórico permanece restaurável.

O início da avaliação valida o ineditismo dentro da transação, inclusive em abas
concorrentes. A ordem persistida das sessões distingue operações no mesmo instante
e preserva a possibilidade de estudar depois uma revisão que tenha sido retirada
da reserva. O item continua inelegível para outra avaliação inédita.

## Verificação

A revisão independente final não deixou defeitos críticos ou importantes abertos.
`npm test` passou com **256 testes em 36 arquivos** e `npm run build` passou,
incluindo a checagem TypeScript. A importação é determinística: as três saídas
JSON permaneceram idênticas após regeneração; a auditoria do acervo passou.
`npm run test:e2e` passou com **21 cenários** no Chromium, usando o build final.
Incluem celular, offline, planejamento, retomada, prazo, backup, prática guiada
e avaliação reservada. Nenhuma dependência nova foi adicionada.

As regressões cobrem seleção equilibrada, fila de atrasos, orçamento variável,
prova próxima, repetição do item, exposição compartilhada, apoio sem procedência,
avaliação já iniciada, abas concorrentes, revisão exibida versus revisão nova e
restauração de registros antigos e novos. Casos finais verificam sessões legadas
mistas e o relógio anterior à exposição. Simulados vencidos finalizam respostas
em branco ou rascunhos mesmo após apoio posterior em outra questão; quando a
cronologia não sustenta um baseline, ele fica desconhecido.

## Limites que permanecem

O acervo continua com **420 itens e zero questões certificadas**. Faltam originais,
gabaritos, figuras e resoluções reais conferidas; as habilidades recebidas também
estão vazias. As novas rotinas estão verificadas com fixtures isoladas em testes,
sem adicioná-las ao material publicado.

A dificuldade declarada é uma classificação humana, sem calibração estatística.
Reserva no fluxo do app não impede consultar os arquivos públicos ou o material
fora dele. O simulado cobre as cinco disciplinas atuais; preparação integral,
redação e regras de prova dependem do edital vigente.

Os testes confirmam comportamento e integridade de dados. Não demonstram ganho
real de aprendizagem, aumento de nota ou probabilidade de aprovação. As fontes
científicas e os limites da consulta online permanecem no parecer original.
