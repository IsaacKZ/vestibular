# Métodos de estudo para o Caderno UDESC

Pesquisa em 6 de outubro de 2026, confrontada com o código e o conteúdo do
commit `908c672`. Objetivo: preparar para resolver questões de vestibular
sem ajuda, incluindo problemas ainda não estudados e uma avaliação posterior.

Esta é uma consulta dirigida a revisões e meta-análises, não uma revisão
sistemática completa. A tabela de fontes distingue resumos indexados de
trechos consultados nos textos integrais. As propostas abaixo são decisões
de produto; não são resultados já demonstrados neste app.

## Recomendação

Priorizar recuperação ativa, prática espaçada e correção informativa. O app
já possui esses mecanismos. O próximo avanço mais útil é completar o ciclo
com apoio à compreensão e questões diferentes que exercitem a mesma habilidade.
Para isso, o acervo e sua classificação precisam avançar junto com a interface.

Um ciclo possível é: tentativa sem ajuda → identificar o erro → explicação
curta → aplicação em outra questão → retorno em outro dia → avaliação sem ajuda.
O intervalo e a carga devem caber na rotina; a literatura não estabelece uma
sequência de dias universal para todos os conteúdos e estudantes.

## Métodos e aplicação

| Método | O que a evidência consultada permite dizer | Aplicação proposta |
| --- | --- | --- |
| Recuperação ativa | Testar o que se sabe favorece aprendizagem em diferentes contextos, inclusive sala de aula [1–3]. O resultado depende de formato, material e feedback. | Resolver antes de abrir a correção. Oferecer um registro opcional e curto do raciocínio ou cálculo antes de marcar, sem exigir redação em toda questão. |
| Prática espaçada | Distribuir encontros com o conteúdo entre sessões favorece retenção [1, 4, 5]. Há evidência aplicada a currículos; intervalos ótimos e resultados em tarefas complexas continuam dependentes do contexto. | Manter retornos em outros dias e prioridade para atrasos. Explicar que os parâmetros atuais são ajustáveis. Avaliar a rotina antes de substituir o agendamento por um algoritmo mais complexo. |
| Correção informativa | Feedback tem efeitos heterogêneos; seu conteúdo importa [6]. Um indicador de certo/errado não é equivalente a uma explicação de como melhorar. | Mostrar o princípio usado, a etapa decisiva e um erro plausível. Transformar a causa registrada no caderno em uma próxima ação concreta. |
| Intercalamento | A meta-análise encontra benefícios que variam com o material; problemas matemáticos tiveram efeito positivo menor, e palavras favoreceram prática em blocos [7]. | Depois de uma introdução ao conteúdo, alternar problemas que exijam escolher entre métodos parecidos. Equilibrar matérias não basta para demonstrar esse benefício. |
| Autoexplicação | A revisão de Dunlosky classifica a técnica como promissora, com limites de generalização [1]. | Pedir uma explicação específica: “Qual dado fez você escolher esse princípio?” ou “Em que etapa o raciocínio mudou?”. Usar a anotação existente e comparar com apoio conferido. |
| Flashcards | A justificativa aqui é o mecanismo de recuperação ativa e espaçamento [1–3], não superioridade de um formato ou algoritmo de flashcards. | Usar como complemento para conceitos, condições de aplicação e relações já compreendidas. Não substituir a resolução de problemas por memorização da letra correta. |
| Pausas e organização do tempo | A meta-análise de micro-pausas encontrou melhora de vigor e fadiga, mas não efeito significativo sobre desempenho geral [8]. Não testa um protocolo universal de Pomodoro para vestibular. | Manter pausas opcionais e ajustar blocos à tarefa. Não interromper obrigatoriamente uma resolução a cada 25 minutos nem apresentar o cronômetro como prova de aprendizagem. |

Exemplos resolvidos podem dar forma ao apoio de compreensão: princípio,
passos e aplicação. A recomendação é pedagógica e precisa de conteúdo
conferido. Não foi possível consultar nesta execução o texto da meta-análise
específica sobre exemplos em matemática citada no parecer antigo; não se
atribui aqui uma magnitude de efeito a esse formato. A autoexplicação tem
fonte própria na revisão consultada [1].

“Feynman” pode descrever uma atividade de explicar com palavras próprias,
mas o nome do método não garante aprendizagem. A tarefa precisa de uma
pergunta concreta e de um meio de conferir a explicação. Também não há motivo
para tomar releitura, grifos ou uma sequência de acessos ao app como evidência
suficiente de retenção. Isso não impede ler para aprender conteúdo novo.

## O que já existe no app

A inspeção atual encontrou:

- Resposta registrada antes da correção e controle de consulta, dica, chute
  e confiança: `PracticePage`, `attempts` e serviço de estudo.
- Revisões em dias posteriores, parâmetros ajustáveis, prioridade para
  atrasos e limite pela data-alvo: `learning` e `planning`.
- Caderno com causa, anotação, pergunta de autoexplicação e próxima ação:
  `remediation` e `GapDetails`.
- Separação entre retenção do mesmo item e aplicação em itens diferentes:
  `skill-evidence` e tela de progresso.
- Avaliação com itens reservados e sem exposição anterior, quando houver
  conteúdo elegível: `assessment`.

Os pareceres de 2 e 3 de outubro são históricos. Seus registros de zero
questões prontas não descrevem o lote atual.

## Limitações concretas do conteúdo atual

Contagem direta de `public/content/questions.json` e `audit.json`:

| Indicador | Resultado |
| --- | --- |
| Itens no catálogo | 420 |
| Questões prontas para treino | 78 |
| Biologia / Física / Química prontas | 26 / 27 / 25 |
| Matemática / Português e Literatura prontas | 0 / 0 |
| Questões com resolução revisada | 78 |
| Questões com apoio estruturado no campo `learning` | 0 |
| Questões com outra pronta que compartilhe exatamente uma habilidade | 0 |
| Questões reservadas prontas para avaliação inédita | 0 |

Cada uma das 78 questões tem uma habilidade cadastrada, e as descrições são
distintas dentro da disciplina. `selectRemediationQuestions` compara essas
habilidades literalmente. Portanto, o caminho para outra questão da mesma
habilidade não encontra pares nesse lote. A mesma limitação afeta o
agrupamento necessário para observar aplicação em itens diferentes.

Isso é um limite da classificação e cobertura disponíveis; não demonstra
que os conceitos das questões sejam todos diferentes. A ausência do campo
`learning` também não significa ausência de ensino: as 78 resoluções já dão
apoio, mas não há conceitos e pré-requisitos estruturados para aquele fluxo.

O simulado parcial existente pode usar questões de treino. O modo de
avaliação reservada tem implementação, mas não dispõe de itens publicados.
Cobertura integral da prova e redação exigem ampliação de conteúdo e
conferência do edital; não devem ser inferidas do resultado desse simulado.

## Ordem de aplicação recomendada

1. **Criar grupos de habilidades realmente comparáveis.** Revisar a
   taxonomia e conferir mais questões oficiais por habilidade prioritária,
   incluindo Matemática e Português/Literatura. Compartilhar uma habilidade
   precisa representar uma exigência de aprendizagem comum; não basta
   juntar itens pela matéria ou tornar as descrições iguais. Preservar as
   revisões e os snapshots do histórico ao publicar novos metadados.
2. **Completar o apoio por erro.** Acrescentar conceito curto, exemplo
   comentado e pré-requisito quando pertinente, com procedência e revisão.
   Aproveitar “Entender o erro” e as perguntas existentes. A prática após
   apoio continua assistida; aplicar em outro dia sem ajuda é outra evidência.
3. **Preparar listas intercaladas por decisão de método.** Introduzir a base
   primeiro e depois alternar problemas comparáveis que exijam escolher
   uma estratégia. Na tentativa, evitar um rótulo que entregue essa escolha.
   Não misturar qualquer conteúdo aleatoriamente nem tratar alternância
   entre Biologia, Física e Química como validação do efeito de intercalamento.
4. **Disponibilizar avaliações inéditas.** Conferir e reservar itens
   adicionais antes de expô-los no treino. Registrar cobertura, dificuldade
   declarada e condição de ajuda. Não retirar arbitrariamente questões do
   lote pequeno atual nem completar uma avaliação inédita com itens já vistos.
5. **Adicionar complementos após esse núcleo.** Flashcards conceituais,
   registro opcional do raciocínio e calibração de confiança podem apoiar o
   ciclo. Lembretes de pausa ficam opcionais. Eles não resolvem a falta de
   questões comparáveis e apoio de conteúdo.

Há três caminhos de produto: completar esse núcleo; adicionar primeiro uma
área de flashcards; ou substituir primeiro o agendamento por um modelo
adaptativo. Recomenda-se o primeiro porque aproveita funções existentes e
ataca limitações observadas no material. Flashcards são um complemento;
um agendador mais complexo exige dados e validação para justificar a troca.

## Como acompanhar aprendizagem

Avaliar respostas independentes em dias posteriores e em problemas
diferentes, com cobertura comparável. Informar acertos/oportunidades,
quantidade de itens distintos, intervalo e uso de ajuda. Tempo e confiança
são informações auxiliares; confiança alta não transforma erro em domínio,
e velocidade sozinha não demonstra aprendizagem.

Uma avaliação inicial e outra posterior podem acompanhar progresso pessoal.
Um retorno de 7–14 dias pode servir como decisão operacional de um piloto,
não como intervalo ótimo demonstrado. Comparações precisam considerar
diferenças de dificuldade e cobertura. Dificuldade declarada pelo revisor
não equivale a calibração estatística de provas paralelas.

Para estimar o efeito de uma nova funcionalidade, comparar condições com
conteúdo e tempo semelhantes e uma avaliação posterior, preferencialmente
com alocação aleatória. Não atribuir causalidade a um simples antes/depois.
Testes de software verificam o mecanismo, não a aprendizagem dos usuários.

Os efeitos `g = 0,499` de testes em sala [2] e `d = 0,54` de espaçamento
aplicado [5] são diferenças padronizadas entre condições de estudos. Não
significam 49,9% ou 54% de aumento de nota, não preveem o resultado do app e
não permitem ordenar diretamente técnicas estudadas em contextos diferentes.

## Fontes e material efetivamente consultado

| Ref. | Fonte | Material consultado nesta execução |
| --- | --- | --- |
| 1 | Dunlosky et al., 2013, *Improving Students’ Learning With Effective Learning Techniques* | Resumo completo indexado no Europe PMC, incluindo avaliação das dez técnicas. |
| 2 | Yang et al., 2021, *Testing (quizzing) boosts classroom learning* | Resumo indexado: 222 estudos independentes e 48.478 estudantes. |
| 3 | McDermott, 2021, *Practicing Retrieval Facilitates Learning* | Resumo indexado da revisão. |
| 4 | Cepeda et al., 2006, *Distributed practice in verbal recall tasks* | Resumo indexado; limites da relação entre intervalo de estudo e retenção. |
| 5 | Mawson e Kang, 2025, *The Distributed Practice Effect on Classroom Learning* | Resumo e discussão no texto integral via Europe PMC, incluindo heterogeneidade, tempos e limitações. |
| 6 | Wisniewski, Zierer e Hattie, 2020, *The Power of Feedback Revisited* | Resumo e trechos da discussão no texto integral via Europe PMC. |
| 7 | Brunmair e Richter, 2019, *Similarity matters* | Resumo indexado da meta-análise de intercalamento e moderadores. |
| 8 | Albulescu et al., 2022, *Give me a break!* | Resumo e trechos da discussão/limites no texto integral via Europe PMC. |

1. [DOI 10.1177/1529100612453266](https://doi.org/10.1177/1529100612453266) · [Registro e resumo](https://europepmc.org/article/MED/26173288).
2. [DOI 10.1037/bul0000309](https://doi.org/10.1037/bul0000309) · [Registro e resumo](https://europepmc.org/article/MED/33683913).
3. [DOI 10.1146/annurev-psych-010419-051019](https://doi.org/10.1146/annurev-psych-010419-051019) · [Registro e resumo](https://europepmc.org/article/MED/33006925).
4. [DOI 10.1037/0033-2909.132.3.354](https://doi.org/10.1037/0033-2909.132.3.354) · [Registro e resumo](https://europepmc.org/article/MED/16719566).
5. [DOI 10.3390/bs15060771](https://doi.org/10.3390/bs15060771) · [Texto integral](https://europepmc.org/articles/PMC12189222).
6. [DOI 10.3389/fpsyg.2019.03087](https://doi.org/10.3389/fpsyg.2019.03087) · [Texto integral](https://europepmc.org/articles/PMC6987456).
7. [DOI 10.1037/bul0000209](https://doi.org/10.1037/bul0000209) · [Registro e resumo](https://europepmc.org/article/MED/31556629).
8. [DOI 10.1371/journal.pone.0272460](https://doi.org/10.1371/journal.pone.0272460) · [Texto integral](https://europepmc.org/articles/PMC9432722).

As revisões fora do índice consultado e a API Crossref não ficaram acessíveis
nesta execução. Nenhum resumo ou texto ausente foi tratado como lido. Esta
consulta não verificou o edital vigente nem mediu resultados de usuários.
