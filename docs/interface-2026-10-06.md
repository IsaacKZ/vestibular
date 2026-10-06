# Redesenho da interface — 6 de outubro de 2026

## Resultado

A tela Hoje apresenta o início do estudo e o orçamento diário antes do
roteiro. A lista mostra matéria, número original, assunto, edição, motivo
e duração; Editar plano abre reordenação, remoção e adição. Concluir edição
fecha os controles, preservando as mudanças salvas. Um dia sem tarefas
permite abrir a edição e adicionar uma questão dentro do orçamento.

A apresentação usa fundo de papel, azul ardósia para ações e títulos em
serifa. A prática tem uma coluna de leitura, alternativas com contorno
visível e registro de confiança e ajuda. A correção distingue resposta
correta, incorreta e estados neutros por título e cor. O manifesto, o tema
e os ícones do app instalável acompanham a identidade.

A pesquisa e seus limites estão em
[pesquisa-cores-interface-2026-10-06.md](pesquisa-cores-interface-2026-10-06.md).
A cor escolhida não é apresentada como intervenção de memória ou garantia
de aprovação.

## Verificação antes da publicação

- 263 testes de módulos em 37 arquivos passaram.
- 31 testes de navegador na raiz passaram, incluindo cinco novos para
  início sem rolagem, edição persistente, contraste e plano vazio.
- Três testes de Pages passaram: subdiretório, figura/retomada e offline.
- Verificação de tipos e builds raiz e Pages passaram.
- Auditoria confirmou 420 itens no catálogo e 78 prontos para treino.
- Screenshots com conteúdo real foram conferidos em desktop, 390 px e
  320 px. Início do plano fica visível nas dimensões testadas.
- Fonte raiz ampliada a 200%, em janela de 640 px, não alargou Hoje,
  Questões, Caderno, Progresso, Configurações ou Prática.
- Uma tentativa real incorreta apresentou título e cor correspondentes;
  a correção salva voltou a abrir após recarregar.
- Revisão independente não encontrou problemas críticos, importantes ou
  menores neste escopo; conferiu telas compactas, ordem/orçamento
  persistidos, contrastes reais e manifesto.

Os novos testes foram observados falhando antes das respectivas mudanças.
Na última rodada, Pages precisou de nova execução após encerrar o servidor
de inspeção que mantinha a porta ocupada; a execução seguinte passou.

A revisão independente não repetiu as suítes nem reproduziu atualização
real de service worker ou feedback anulado. A validação não comprova ganho
de aprendizagem, nem certifica toda a aplicação segundo WCAG.

## Publicação

O workflow [Deploy to GitHub Pages](../.github/workflows/pages.yml) executa
auditoria, testes e build em cada envio a main. A etapa remota de entrega
consiste em acompanhar esse workflow e conferir o HTML, o CSS, o JavaScript,
o manifesto, os novos ícones e o catálogo servidos em
https://isaackz.github.io/vestibular/.
