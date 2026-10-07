# Ciclo de estudo — entrega de 07/10/2026

A mudança aplica as duas primeiras prioridades da pesquisa: conectar problemas
oficiais que praticam raciocínios comparáveis e oferecer apoio para entender o erro.
O percurso é tentar, identificar a dificuldade, consultar conceito e exemplo da
própria questão e praticar outro problema, com a consulta registrada.

## Conteúdo

O catálogo conserva 420 questões, 404 respostas oficiais e 16 anulações. Há 84
questões prontas: 26 de Biologia, 27 de Física, 25 de Química, quatro de Matemática
e duas de Português/Literatura. Todas têm conceito e exemplo comentado conferidos,
com autoria e fonte identificadas. As seis novas questões foram confrontadas com
PDFs e gabaritos; os dois textos de Português incluem suas continuações e créditos.

São 26 grupos de habilidades comuns, 53 itens com outro problema comparável e
oito vínculos a pré-requisitos disponíveis. Habilidades anteriores, texto bruto,
hashes e gabaritos permanecem. A importação publica nova revisão determinística
quando o apoio muda; a auditoria usa os mesmos registros.

Também foram corrigidas as alternativas C/D/E da Física 2025/2, questão 14,
conforme a página 9 do caderno. O gabarito B é o mesmo.

## Histórico e prática

O caderno grava a consulta antes de abrir o apoio atual e mostra exatamente o
snapshot registrado. Tentativas antigas podem consultar explicações atualizadas
sem substituir a resposta, a grade, o baseline ou a correção histórica. Repetir
o identificador de uma exposição recupera o apoio originalmente consultado.

O app prioriza candidatos cuja identidade ainda não foi iniciada em uma sessão.
Quando só há alternativas já expostas, identifica essa condição. A sugestão
respeita questões bloqueadas, reservadas e protegidas por simulados ativos.
O treino após o apoio fica marcado como consulta e não conta como evidência
independente de aplicação posterior.

O backup preserva o evento de consulta e seu snapshot. Não houve migração do
banco, dependência nova ou alteração do agendador. A interface editorial e o
funcionamento offline continuam.

## Verificação

- 283 testes de módulos, em 39 arquivos, passaram após os ajustes de conteúdo.
- 33 testes de navegador na raiz passaram, incluindo erro → conceito → outro
  item oficial de Matemática com consulta persistida e Português completo em 320px.
- Três testes de Pages passaram: catálogo no subdiretório, figura/retomada e offline.
- Builds raiz e Pages com TypeScript, auditoria do conteúdo e diff sem erros.
- Importação repetida produziu os mesmos bytes de catálogo, treino e auditoria.

As revisões independentes do importador, domínio, conteúdo e integração foram
aprovadas. A revisão científica releu os 84 apoios, conferiu suas 84 letras nos
cinco gabaritos pertinentes e confrontou visualmente os seis novos itens. Dois
ajustes de Química foram incorporados: exceções d/f no preenchimento eletrônico
e remoção de um vínculo redox que a questão não exigia praticar.

Os testes de integração no navegador foram acrescentados após as falhas observadas
nos testes do corpus e da interface. Não houve um ciclo RED/GREEN específico do
navegador antes da implementação; os percursos finais foram verificados diretamente.

## Publicação

Destino: https://isaackz.github.io/vestibular/. O workflow de GitHub Actions
audita o conteúdo, executa os testes de módulos e Pages e publica o build da
`main`. A verificação externa compara HTML, JS/CSS, catálogo, treino, auditoria,
manifesto e service worker com o build validado, incluindo resposta HTTP200.

## Limites

Um par permite praticar em outro item; não basta para demonstrar aplicação
consistente em vários itens e dias. Há 336 questões bloqueadas e nenhum item
reservado para avaliações inéditas. A expansão do corpus, a reserva de avaliações
e outras metodologias continuam como próximos lotes. Esta entrega não mede ganho
real de aprendizagem ou probabilidade de aprovação.

Fontes e agrupamentos estão em
[conteudo-pedagogico-2026-10-07.md](conteudo-pedagogico-2026-10-07.md). A base da
pesquisa está em [metodologias-estudo-2026-10-06.md](metodologias-estudo-2026-10-06.md).
