# Aprendizagem e preparação para o vestibular: parecer sobre o Caderno UDESC

Data: 2 de outubro de 2026. Avaliação do código e do acervo presentes no checkout.

Este parecer registra a versão avaliada naquela data. As correções posteriores
estão documentadas em [correções de aprendizagem](correcoes-aprendizagem-2026-10-03.md).

## Parecer

O app tem uma base compatível com métodos que favorecem aprendizagem: tentativa
antes da correção, feedback, prática espaçada e distinção entre respostas
independentes e assistidas. **A versão atual ainda não está pronta para ser o
instrumento principal de preparação para aprovação.** O catálogo contém 420
questões, mas nenhuma está certificada para treino; os caminhos de aquisição de
conteúdo, aplicação em questões diferentes e planejamento ainda precisam avançar.

Não há resultados de alunos ou avaliações posteriores que demonstrem eficácia
desse produto. Os testes de software verificam funcionamento e integridade dos
dados; não medem aprendizagem, aumento de nota ou probabilidade de aprovação.

## Fontes e limite desta consulta

Foram lidos o PDF enviado, `Pesquisa_metodos_de_estudo_app_vestibular.pdf`
(páginas 1–6), a habilidade `udesc-vestibular`, os contratos, mecanismos de estudo,
telas e arquivos do acervo. Duas auditorias independentes examinaram os métodos
implementados e a cobertura da preparação.

Tentativas de acessar Crossref, PubMed Central e UDESC foram recusadas pelo proxy
com HTTP 403. Portanto, esta é uma síntese crítica da pesquisa fornecida e de suas
referências, confrontada com o código. **Os artigos originais e o edital vigente
não foram consultados online nesta execução.** Os DOI abaixo identificam as fontes
citadas pelo PDF; não representam uma nova verificação de seu texto integral.

## O que a pesquisa sustenta e como o app atende

| Método                               | Evidência sintetizada no PDF                                                                                                     | Implementação e avaliação                                                                                                                                     |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recuperação ativa                    | Testar o que se sabe favorece aprendizagem em pesquisas de sala de aula [1, 2, 3]                                                | Salva a resposta antes de liberar a resolução. Está bem alinhado; múltipla escolha ainda permite reconhecimento ou acerto casual.                             |
| Prática espaçada                     | Distribuir tentativas entre dias favorece retenção; não há uma sequência universal de intervalos [4, 5]                          | Retornos em outros dias e manutenção estão implementados. Os parâmetros 3/14/14 dias e dois sucessos são heurísticas ajustáveis, sem validação individual.    |
| Feedback informativo                 | O benefício depende do conteúdo da correção, não apenas de marcar certo/errado [6]                                               | Há espaço para resolução e procedência, mas todas as resoluções reais estão ausentes. A qualidade pedagógica precisa ser avaliada na conferência do conteúdo. |
| Intercalamento                       | Pode ajudar a distinguir métodos em problemas; o resultado varia com o material e a tarefa [7, 8]                                | As listas mistas distribuem disciplinas e podem alternar habilidades introduzidas. O plano diário não usa essa seleção.                                       |
| Exemplos resolvidos e autoexplicação | Há suporte para exemplos em matemática e explicações dos passos; exigir justificativa em todo item não garante benefício [9, 10] | A resolução textual pode apoiar isso, mas faltam caminhos específicos de exemplo → prática independente e perguntas pontuais sobre o método.                  |

O PDF relata, para a meta-análise de Yang e colegas, 222 estudos e 48.478
estudantes, com efeito médio `g = 0,499` [2]. Essa magnitude se refere aos estudos
reunidos, **não é 49,9% de aumento de nota e não é uma estimativa do efeito deste
app**. Também não permite ordenar técnicas de estudos diferentes como um ranking.

O objetivo relevante para o vestibular é conseguir resolver uma questão ainda
não estudada, sem consulta, sob as condições da avaliação. Reconhecer a alternativa
de uma questão repetida fornece uma evidência mais limitada.

## Achados no produto atual

### 1. O conteúdo impede o ciclo real de aprendizagem

`public/content/questions.json` está vazio; a auditoria registra 420 itens e zero
prontos. Todos os itens têm gabarito e resolução nulos, habilidades vazias e
conferências de texto/taxonomia pendentes. O app bloqueia treino e simulado nesses
casos, corretamente: retirar esse bloqueio faria o aluno estudar material não
conferido.

As 205 questões sem marcação de OCR/incerteza são candidatas à conferência,
não questões utilizáveis. A inspeção encontrou incompletude também nesse grupo.
Assim, a afirmação antiga da skill de que determinadas edições estão “perfeitas”
não deve orientar a liberação automática.

Evidência: [auditoria](../public/content/audit.json),
[questões de treino](../public/content/questions.json),
[critérios de liberação](../src/content/quality.ts).

### 2. Recuperar uma questão ainda não confirma domínio da habilidade

As lacunas são indexadas por `questionId`. Dois acertos posteriores independentes
podem recuperar **a mesma questão**, sem exigir um enunciado diferente. Isso é
útil para verificar retorno ao item, mas pode incluir lembrança da alternativa ou
da resolução. A interface descreve recuperação do item, não certificação de domínio.

A métrica de aplicação em item novo é um começo: procura um primeiro acerto
independente em questão que compartilhe uma habilidade anteriormente tentada.
Não exige intervalo desde o estudo daquela habilidade, dificuldade comparável
ou um conjunto de avaliação reservado. Atualmente, as habilidades vazias também
impedem sua utilidade no acervo real.

Recomendação: manter as evidências por questão e acrescentar uma verificação por
habilidade com itens diferentes. Mostrar acertos/total de oportunidades, intervalo
real, ajuda e quantidade de itens distintos, sem transformar um único acerto em
domínio do assunto.

Evidência: [projeção de aprendizagem](../src/domain/learning.ts),
[métricas](../src/domain/metrics.ts).

### 3. Falta transformar a causa do erro em uma ação de estudo

O caderno registra conceito, método, pré-requisito, cálculo, interpretação ou tempo.
Hoje, a causa fica como anotação; a ação disponível é repetir a mesma questão.
Se o aluno ainda não conhece a base, errar e tentar novamente pode ser insuficiente.

O ciclo recomendado é: tentativa diagnóstica breve → explicação ou exemplo
conforme o erro → questão diferente → retorno em outro dia → lista mista. Para
pré-requisito, retornar à habilidade anterior; para interpretação, variar o
enunciado; para escolha do método, comparar situações parecidas.

A autoexplicação deve ser curta e específica, por exemplo: “Qual característica
do problema fez você escolher esse método?”. Não é necessário impor um texto
longo em toda questão. Flashcards podem complementar conceitos já compreendidos;
não substituem aprender a resolver problemas.

Evidência: [caderno](../src/features/notebook/GapDetails.tsx),
[correção](../src/features/practice/FeedbackPanel.tsx); PDF, páginas 2–5.

### 4. O plano diário precisa favorecer cobertura e aquisição

As questões novas entram pela ordem do inventário. O catálogo começa com 14 itens
de Matemática; se todos fossem certificados, o primeiro plano de 120 minutos
selecionaria 12 dessa disciplina. É uma consequência da ordem dos IDs, não uma
priorização pedagógica. As listas mistas disponíveis em outra tela não corrigem
essa seleção automaticamente.

Cada item recebe dez minutos. Revisões vencidas têm um limite fixo de quatro
itens num dia de 120 minutos; novos itens podem entrar enquanto atrasos continuam
adiados. A data-alvo da prova não participa da seleção nem do cálculo dos retornos,
que podem cair depois dela.

Recomendação: distribuir a rotina entre as matérias escolhidas, ajustar tempo
estimado pela experiência real e reduzir novidades quando o atraso de revisões
crescer. Considerar o horizonte da prova e as lacunas persistentes. Manter o teto
de 10 horas semanais registrado na skill, incluindo correção, exemplos e avaliações.
Frequência histórica pode apoiar uma decisão, mas não mede dificuldade, retorno
por hora ou probabilidade de um assunto cair.

Evidência: [planejamento](../src/domain/planning.ts),
[intervalos padrão](../src/content/constants.ts),
[seleção de listas mistas](../src/content/catalogue.ts).

### 5. A medição e o simulado ainda não demonstram prontidão para aprovação

O simulado é expressamente parcial e usa as cinco matérias escolhidas para este
app. Não reserva questões exclusivamente para avaliação e pode repetir itens já
estudados. Não controla dificuldade nem reproduz toda a duração/distribuição oficial.
Redação e as outras disciplinas não fazem parte desta entrega.

O foco nas cinco matérias pode ser mantido. Para acompanhar preparação integral,
é necessário também avaliar a prova completa e a redação, mesmo usando materiais
fora do app. A estrutura de 100 objetivas citada na skill depende de conferência no
edital vigente, assim como calendário, obras, regras e critérios de seleção. Não há
base para calcular uma probabilidade de aprovação com os dados disponíveis.

O registro de ajuda, dúvida, chute e confiança é um ponto forte. Já a fórmula de
“correção de chute” descrita na skill é apenas uma estimativa sob hipóteses fortes
de resposta ao acaso; **não revela quantas questões um indivíduo realmente sabia**.
Acertos em itens inéditos, explicação do método e repetição posterior fornecem
evidências mais úteis, ainda com incerteza e dependência da dificuldade.

Evidência: [configuração do simulado](../src/features/assessment/AssessmentPage.tsx),
[seleção de avaliação](../src/domain/assessment.ts),
[métricas e seus denominadores](../src/domain/metrics.ts).

## Ordem prática para melhorar o produto

1. **Certificar um lote útil de questões reais**, cobrindo as matérias escolhidas:
   original legível, alternativas/figuras/textos de apoio, gabarito oficial,
   resolução revisada e habilidades. Demonstrar o ciclo completo com esse lote.
2. **Criar recuperação com ensino e questões diferentes**: ligar causa do erro,
   explicação/exemplo, pré-requisito e uma aplicação posterior independente.
3. **Melhorar o plano diário**: distribuição entre matérias, tempo realista,
   carga de atrasos e data da prova; sem aumentar o teto semanal.
4. **Reservar avaliações comparáveis**, com questões inéditas e cobertura definida.
   Acompanhar também redação e um simulado integral fora do app, se necessário.
5. Só depois expandir apoio opcional, como flashcards, autoexplicação e tutor.
   Não há evidência aqui de que acrescentar gamificação ou IA seja o próximo passo
   com maior retorno para o objetivo informado.

## Como verificar se você está aprendendo

Depois de certificar o conteúdo:

- Fazer uma avaliação inicial sem ajuda, com itens não estudados e cobertura definida.
- Estudar dentro do orçamento real, registrando também o tempo de correção e apoio.
- Aplicar outra avaliação com questões diferentes e dificuldade semelhante.
- Verificar novamente após um intervalo, por exemplo 7–14 dias, com mais itens
  reservados. Esse prazo é uma escolha operacional para o piloto, não um ótimo universal.
- Comparar acertos/total em primeiras tentativas, dependência de ajuda, erros
  recorrentes e tempo de resolução correta. Informar a quantidade de itens e as
  diferenças de dificuldade; evitar comparar percentuais de provas muito diferentes.

Esse acompanhamento avalia progresso individual; uma comparação antes/depois não
isola o efeito causal do app. Para avaliar uma funcionalidade, um piloto controlado
deve comparar condições com conteúdo e tempo semelhantes, preferencialmente com
alocação aleatória e avaliação posterior em itens inéditos.

## Referências identificadas na pesquisa fornecida

1. Dunlosky et al. (2013). _Improving Students’ Learning With Effective Learning Techniques._
   [DOI: 10.1177/1529100612453266](https://doi.org/10.1177/1529100612453266).
2. Yang et al. (2021). _Testing (quizzing) boosts classroom learning: A systematic and meta-analytic review._
   [DOI: 10.1037/bul0000309](https://doi.org/10.1037/bul0000309).
3. Agarwal, Nunes e Blunt (2021). _Retrieval Practice Consistently Benefits Student Learning: a Systematic Review of Applied Research in Schools and Classrooms._
   [DOI: 10.1007/s10648-021-09595-9](https://doi.org/10.1007/s10648-021-09595-9).
4. Mawson e Kang (2025). _The Distributed Practice Effect on Classroom Learning: A Meta-Analytic Review of Applied Research._
   [DOI: 10.3390/bs15060771](https://doi.org/10.3390/bs15060771).
5. Latimier, Peyre e Ramus (2021). _A Meta-Analytic Review of the Benefit of Spacing out Retrieval Practice Episodes on Retention._
   [DOI: 10.1007/s10648-020-09572-8](https://doi.org/10.1007/s10648-020-09572-8).
6. Wisniewski, Zierer e Hattie (2020). _The Power of Feedback Revisited: A Meta-Analysis of Educational Feedback Research._
   [DOI: 10.3389/fpsyg.2019.03087](https://doi.org/10.3389/fpsyg.2019.03087).
7. Rohrer et al. (2020). _A Randomized Controlled Trial of Interleaved Mathematics Practice._
   [DOI: 10.1037/edu0000367](https://doi.org/10.1037/edu0000367).
8. Brunmair e Richter (2019). _Similarity matters: A meta-analysis of interleaved learning and its moderators._
   [DOI: 10.1037/bul0000209](https://doi.org/10.1037/bul0000209).
9. Barbieri et al. (2023). _A Meta-analysis of the Worked Examples Effect on Mathematics Performance._
   [DOI: 10.1007/s10648-023-09745-1](https://doi.org/10.1007/s10648-023-09745-1).
10. Bisra et al. (2018). _Inducing Self-Explanation: a Meta-Analysis._
    [DOI: 10.1007/s10648-018-9434-x](https://doi.org/10.1007/s10648-018-9434-x).
