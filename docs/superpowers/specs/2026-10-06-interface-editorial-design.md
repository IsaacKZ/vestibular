# Interface editorial do Caderno UDESC

O usuário pediu pesquisa sobre cores e uma interface com mais identidade,
autorizando implementação e continuidade sem perguntas em 6 de outubro de
2026. A direção escolhida é papel e tinta, comparada previamente com verde
profundo e grafite/âmbar. A decisão estética não implica ganho de memória.
As evidências e cores estão em [pesquisa de cores](../../pesquisa-cores-interface-2026-10-06.md).

## Escopo e contratos

- Redesenhar a apresentação; preservar IndexedDB, histórico, conteúdo
  oficial, regras de planejamento e restrições de correção em simulados.
- Usar a paleta documentada, tipografia serifada nos títulos e fonte de
  sistema nos controles. Não depender de fontes ou APIs externas para usar o app.
- Manter as quatro rotas principais e os rótulos usados para estudo.
- Começar o plano sem rolagem em 1440×900 e 320×700, descontando a navegação
  inferior no celular. A retomada de sessões aparece antes do novo início.
- Mostrar a lista completa do dia; revelar reordenação, remoção e adição ao
  acionar “Editar plano”. “Concluir edição” fecha esses controles sem apagar
  as mudanças persistidas. Plano concluído, bloqueio de simulado e capacidade
  diária mantêm o comportamento existente.
- Tornar a lista mais informativa: matéria, assunto conferido, edição,
  número original, motivo e estimativa de duração.
- Em prática, concentrar enunciado, alternativas e metacognição na coluna
  de leitura; preservar figuras, fórmulas, timer, rascunhos e registro antes
  da correção. Seleção usa azul; feedback usa cor e título explícito.
- Reescrever somente instruções genéricas ou repetitivas; preservar fatos,
  contagens, ressalvas pedagógicas pertinentes e procedência.
- Atualizar cores de tema e identidade do app instalável.

## Composição

A navegação desktop ocupa uma faixa lateral clara, com marca tipográfica,
separadores e estado ativo simples. No celular, a navegação inferior mantém
alvos de toque e espaço para a área segura do dispositivo. Títulos serifados
e linhas de separação organizam o conteúdo; sombras, ilustrações decorativas
e cartões repetidos não são necessários.

A tela Hoje tem cabeçalho curto, início de estudo e orçamento diário no
primeiro bloco, roteiro abaixo e links de revisão e configurações no fim.
As demais telas compartilham escala de texto, cores e controles. A prática
usa largura de leitura limitada e apresenta a confiança e os marcadores de
ajuda como parte do registro da tentativa.

## Verificação e publicação

Testes novos demonstram falha da interface anterior para posição do início,
controles de edição e contraste de limites. Testes existentes preservam
planejamento, armazenamento, acessibilidade, aprendizagem e offline.
Verificar screenshots de desktop, celular e correção real. Executar auditoria,
testes, builds raiz/Pages e publicar em main; confirmar GitHub Actions e o
conteúdo servido em https://isaackz.github.io/vestibular/.
