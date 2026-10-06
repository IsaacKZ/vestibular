# Cores e leitura na interface de estudo

Consulta em 6 de outubro de 2026. Objetivo: orientar o redesenho do Caderno
UDESC sem atribuir à aparência ganhos de memória ou de aprovação que não
foram medidos.

## Evidências consultadas

| Fonte | Material consultado | Resultado e limite para o app |
| --- | --- | --- |
| Elliot, 2015 [1] | Texto integral via Europe PMC, especialmente avaliação e conclusão | Efeitos dependem do contexto, tarefa, cultura, luminosidade e saturação. A revisão aponta controle insuficiente das cores e estudos com amostras pequenas. Não estabelece uma cor ideal para aprender. |
| Gnambs, 2020 [2] | Texto integral via Europe PMC, incluindo discussão e conclusão | Meta-análise de 67 efeitos, em 38 amostras. Não encontrou diferenças significativas em anagramas e testes de conhecimento. O efeito em raciocínio perdeu sustentação após correção de viés de publicação. Não sustenta escolher ou proibir vermelho para melhorar desempenho intelectual. |
| Mehta e Zhu, 2009 [3] | Resumo indexado no Europe PMC | Encontrou resultados diferentes para tarefas de detalhe e criatividade. São tarefas experimentais; não demonstram aumento de retenção ou aprovação no vestibular com uma interface azul. |
| Piepenbrock et al., 2013 e 2014 [4–5] | Resumos indexados no Europe PMC | Texto escuro em fundo claro favoreceu acuidade visual e revisão de texto nos experimentos, incluindo caracteres menores. Esse resultado orienta legibilidade; não mede aprendizagem no app ou conforto em todas as condições de iluminação. |
| WCAG 2.2 [6–8] | Documentação oficial e fontes do repositório W3C | Contraste mínimo de 4,5:1 para texto comum e 3:1 para informação visual necessária dos controles. Cor não pode ser a única indicação de estado. |

A revisão sobre cor e memória de Dzulkifli e Mustafar, 2013 [9], foi localizada
e seu resumo foi consultado. Não foi usada para atribuir benefício a uma
paleta: o texto integral não estava disponível na primeira requisição.

## Decisões de interface

- Fundo claro e texto escuro como padrão de leitura.
- Azul ardósia identifica ações e seleção; verde indica resposta correta;
  vermelho indica resposta incorreta; estados neutros ou de revisão recebem
  texto explícito. Essas são convenções de interface, não intervenções para
  aumentar memória.
- Poucas cores em áreas de leitura. Figuras oficiais mantêm suas cores e
  proporções originais.
- A alternativa selecionada continua visível pelo rádio e pelo contorno.
  Certo e errado continuam identificados pelos títulos da correção.
- Tipografia e organização procuram facilitar a leitura e reconhecer o
  próximo passo. A família tipográfica escolhida é uma decisão visual;
  não foi demonstrada superioridade pedagógica de uma fonte.

## Paleta adotada

| Função | Cor | Contraste calculado |
| --- | --- | --- |
| Fundo | `#F8F5EE` | — |
| Superfície | `#FFFFFF` | — |
| Texto principal | `#242A30` | 13,31:1 sobre o fundo |
| Texto secundário | `#59636D` | 5,62:1 sobre o fundo |
| Ação | `#234B63` | 9,30:1 com texto branco |
| Correto | `#2D674D` | 6,65:1 sobre branco |
| Incorreto | `#A13E32` | 6,46:1 sobre branco |
| Revisão/aviso | `#805C12` | 6,07:1 sobre branco |
| Foco | `#0073B1` | 4,72:1 sobre o fundo |
| Contorno de controle | `#7F898F` | 3,57:1 sobre branco |

Valores calculados pela luminância relativa sRGB da WCAG, arredondados
apenas para apresentação. Os testes usam os valores sem arredondamento.
Esses pares não certificam, sozinhos, a acessibilidade de toda a aplicação.
O verde da interface anterior também tinha bom contraste; a mudança de
matiz serve à identidade visual e à distinção entre seleção e correção.

## Validação

Testar início de estudo sem rolagem em desktop e celular, edição e retomada
de plano, navegação por teclado, contraste dos controles, figuras e fórmulas,
correção após registro, restrições durante simulado, backup e uso offline.
Não usar velocidade de clique ou preferência visual como prova de retenção.
Uma avaliação futura de aprendizagem deve comparar respostas independentes
em dias posteriores e questões equivalentes, considerando o tamanho da amostra.

## Fontes

1. Elliot AJ. *Color and psychological functioning: a review of theoretical and empirical work*. 2015. DOI: [10.3389/fpsyg.2015.00368](https://doi.org/10.3389/fpsyg.2015.00368). [Texto integral](https://pmc.ncbi.nlm.nih.gov/articles/PMC4383146/).
2. Gnambs T. *Limited evidence for the effect of red color on cognitive performance: A meta-analysis*. 2020. DOI: [10.3758/s13423-020-01772-1](https://doi.org/10.3758/s13423-020-01772-1). [Registro e resumo](https://europepmc.org/article/MED/32696125).
3. Mehta R, Zhu RJ. *Blue or red? Exploring the effect of color on cognitive task performances*. 2009. DOI: [10.1126/science.1169144](https://doi.org/10.1126/science.1169144). [Registro e resumo](https://europepmc.org/article/MED/19197022).
4. Piepenbrock C, Mayr S, Mund I, Buchner A. *Positive display polarity is advantageous for both younger and older adults*. 2013. DOI: [10.1080/00140139.2013.790485](https://doi.org/10.1080/00140139.2013.790485).
5. Piepenbrock C, Mayr S, Buchner A. *Positive display polarity is particularly advantageous for small character sizes: implications for display design*. 2014. DOI: [10.1177/0018720813515509](https://doi.org/10.1177/0018720813515509).
6. W3C. [Understanding Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
7. W3C. [Understanding Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html).
8. W3C. [Understanding Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
9. Dzulkifli MA, Mustafar MF. *The influence of colour on memory performance: a review*. 2013. [Registro e resumo](https://europepmc.org/article/MED/23983571).
