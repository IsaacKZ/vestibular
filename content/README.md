# Conferência do conteúdo

Execute `npm run content:import` para gerar `public/content/catalog.json`,
`questions.json` e `audit.json`, e `npm run content:audit` para verificar a
consistência. O catálogo contém todo o inventário; `questions.json` contém
somente questões conferidas, incluindo as reservadas para avaliação.
O lote de 2026-10-07 tem 420 itens no catálogo, 84 prontos para
treino e nenhum reservado para avaliação inédita. Os demais continuam
bloqueados até concluir as conferências necessárias.

`reviews.json` é um array de objetos `QuestionRevision` completos. Uma
conferência precisa de nova `revision`, `source.originalPdf`, `source.page`,
`quality.reviewer` e `quality.reviewedAt`. A identidade e o texto bruto/hash
da importação devem permanecer iguais; enunciado, alternativas, ativos e
taxonomia podem ser conferidos contra o original. Habilidades (`skills`) não
podem ficar vazias para liberar novos treinos. O arquivo fonte preserva
as marcações iniciais, que permanecem nas contagens históricas.

`answer-keys.json` recebe `{ "id": "...", "key": { ... } }`, com os campos
do contrato de gabarito, incluindo documento oficial, localização, revisão
e revisor. Anulações usam `key: null` e uma decisão `annulment` verificada;
uma anulação confirmada permanece fora do treino. O arquivo registra
404 respostas e 16 anulações dos gabaritos oficiais enviados.
`answer-key-sources.json` identifica os seis PDFs e seus hashes.

`explanations.json` recebe `{ "id": "...", "explanation": { ... } }`,
com texto, autoria oficial/elaborada, fonte e revisor. Há 78 resoluções
no arquivo e seis adicionais nas novas revisões de Matemática/Português.
Não adicione respostas presumidas
ou questões de fixture.

`booklet-sources.json` identifica os 12 cadernos oficiais, seus URLs, hashes
e caminhos locais em `public/content/documents/cadernos/`. Os gabaritos
originais ficam em `public/content/documents/gabaritos/`. Os recortes
publicados são das figuras dos originais. Os relatórios de cada disciplina
estão em `review-batches/`; registros com `quality.reviewed: false` nesses
lotes representam trabalho pendente e não entram em `reviews.json`.

O importador calcula uma revisão publicada `content-<SHA-256>` para o objeto
final conferido, incluindo gabarito, resolução, anulação, pedagogia e metadados dos ativos.
Alterar qualquer um desses registros produz outro snapshot sem reescrever o
histórico. Gerar novamente os mesmos registros mantém a mesma identidade;
o SHA-256 do texto bruto continua sendo o da importação original.

Ativos reais devem estar em `public/content/assets/`, com caminho relativo
`content/assets/...`, fonte e descrição revisada. O importador verifica sua
existência e impede caminhos que saiam de `public`. Cada alternativa gráfica
precisa de `anchor.target: "option"` e `anchor.optionLetter` correspondente.
Sem original, figura ausente ou fórmula corrompida continua bloqueada.
Os caminhos dos ativos publicados são imutáveis: se os bytes de uma figura
mudarem, publique-a em outro caminho e atualize a conferência. Não substitua
uma imagem já referenciada pelos snapshots antigos; prefira nomes com seu hash.

Seções explícitas `TEXTO N` após as alternativas não pertencem à alternativa E.
O importador conserva esses bytes no texto bruto e não os associa automaticamente
a outra questão. Referências a textos numerados ausentes do enunciado ficam
marcadas como incompletas até a conferência no original.

Contagens de frequência são provisórias, baseadas na classificação original
das 420 questões, incluindo 68 classificações sinalizadas. Não representam
previsão de prova nem quantidade pronta para treino.

Campos pedagógicos opcionais também entram em `reviews.json` e no hash da
revisão publicada. `difficulty` aceita `easy`, `medium` ou `hard`: trata-se de
classificação humana, sem equivalência estatística entre questões. Reserve
itens com `assessmentOnly: true` antes de estudar: eles ficam fora do plano,
listas e apoio, e o enunciado fica fechado no catálogo. Avaliações inéditas
exigem dificuldade e habilidades conferidas; uma sessão anterior já consome
o ineditismo, mesmo sem resposta. A reserva é uma proteção do fluxo do app;
o conteúdo público não impede consulta externa ao material.

O campo `learning` recebe `concept`, `workedExample`, `prerequisites` (array
de `{subject, skill}`), `reviewed`, `source` e `reviewer`. Conceito e exemplo
só aparecem com texto, conferência e procedência. Vínculos de pré-requisito
devem ser conferidos por quem revisa o apoio. Na ausência de apoio próprio,
o app pode usar a resolução revisada existente, sem inventar uma aula ou
prometer uma alternativa pronta. Uma prática feita após esse apoio registra
consulta; evidência posterior exige outra tentativa independente e espaçada.

`pedagogy/*.json` contém arrays de `{id, skills, learning}` para apoio elaborado
e habilidades adicionais. O importador conserva as habilidades da conferência
original e aplica esse apoio somente a questões já prontas. Metadados não
liberam texto incompleto ou anulado. IDs desconhecidos/duplicados, apoio sem
conferência e fontes vazias interrompem a importação. Os 84 itens prontos têm
apoio específico; habilidades comuns só vinculam problemas comparáveis e
pré-requisitos só apontam a habilidades anteriores com questão pronta.

No caderno, a consulta ao apoio atualizado guarda seu snapshot e um evento
próprio. A tentativa e sua correção histórica permanecem iguais. Ao repetir
uma exposição com o mesmo identificador, retorna a revisão originalmente
consultada mesmo que o catálogo tenha mudado. Backups preservam ambos.

Backups antigos preservam campos ausentes e tentativas já feitas. Snapshots
históricos sem habilidades podem ser restaurados, mas não iniciam novos
treinos nem confirmam aplicação entre questões. O novo baseline de exposição
por habilidade é capturado no envio e não é reconstruído retroativamente.
