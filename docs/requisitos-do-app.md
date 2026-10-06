# App de estudos para o vestibular UDESC

## Objetivo e fontes

Construir um app em português para resolver questões, receber feedback e verificar
retenção em tentativas posteriores sem ajuda.

Requisitos de estudo extraídos de `Pesquisa_metodos_de_estudo_app_vestibular.pdf`,
enviado pelo usuário em 02/10/2026, especialmente páginas 2 a 4. O PDF é uma fonte
de requisitos pedagógicos; não é um banco de questões nem uma configuração de
ferramentas.

O usuário determinou que as questões sejam as da habilidade `udesc-vestibular`,
referenciada pela conversa `01a0fcc1-4de0-7040-8376-3beb05ec5125`.
A habilidade foi recebida no arquivo `udesc-vestibular.skill`, extraída em
`.agents/skills/udesc-vestibular` e lida. Os cinco bancos contêm 420 questões,
84 por matéria, das seis edições de 2024/1 a 2026/2. A conversa referenciada
continuou inacessível; nenhum conteúdo dela foi lido ou utilizado.

A auditoria encontrou 215 itens com marcações de OCR/incompletude. Os outros
205 são candidatos à conferência, não itens liberados. Faltam gabaritos oficiais,
resoluções e imagens. Ausência de marcação não garante integridade.

A [especificação do app](superpowers/specs/2026-10-02-udesc-estudos-design.md)
registra as decisões de arquitetura, interface, aprendizagem e escopo. O
[plano de implementação](superpowers/plans/2026-10-02-udesc-estudos.md) detalha
os arquivos, contratos, testes e sequência de entregas.

## Requisitos de conteúdo

- Importar apenas questões pertencentes ao acervo da habilidade indicada.
- Preservar prova, edição, ano, número original, enunciado, textos de apoio,
  figuras, alternativas, gabarito e referência à fonte.
- Permitir múltiplos assuntos e habilidades por questão.
- Identificar questões anuladas e ausência de gabarito; não inventar respostas.
- Verificar se a habilidade fornece resoluções comentadas. Quando não fornecer,
  organizar sua elaboração e revisão sem apresentá-las como conteúdo oficial.
- Conferir duração, distribuição e regras de simulados com as fontes da habilidade.
- Validar acervo e identificadores antes de integrar o banco ao app.

## Primeira versão

| Área | Comportamento |
| --- | --- |
| Hoje | Plano ajustável ao tempo disponível, com revisões, lacunas, manutenção e questões novas. |
| Questões | Filtros por prova, ano, matéria, assuntos e habilidades; listas individuais ou mistas. |
| Resolver | Registrar resposta, dúvida, chute, dica, consulta e confiança antes de liberar o feedback. |
| Correção | Gabarito e raciocínio após a tentativa; identificar etapa decisiva e próximo passo. |
| Caderno de erros | Incluir erros, itens pulados e acertos com dúvida, chute ou ajuda; permitir anotações e causa confirmada pelo aluno. |
| Revisões | Fila por data, tentativa sem consulta e histórico vinculado; distribuir atrasos conforme capacidade diária. |
| Simulados | Duração e composição configuradas pela prova; guardar primeira tentativa e revelar feedback apenas ao finalizar. |
| Progresso | Acertos/total, tempo, ajuda, confiança e datas por assunto; distinguir primeira tentativa, repetição e consulta anterior. |

## Dados necessários

### Questão

Identificador estável, origem, prova/edição, ano, número, matéria, assuntos,
habilidades, enunciado, imagens e textos de apoio, alternativas, gabarito,
anulação, resolução comentada e procedência da resolução.

### Tentativa

Identificador, questão, sessão, modo de estudo ou avaliação, data e hora,
resposta ou indicação de pulo, tempo ativo, confiança e ajuda declarada.
Preservar se era a primeira tentativa e se a resolução já havia sido vista.
Registrar o momento da revelação do feedback. Tentativas posteriores não
sobrescrevem a primeira tentativa.

### Lacuna e revisão

Questão/assuntos relacionados, tentativas de origem, causa confirmada pelo aluno,
anotação da correção, estado, próxima data, histórico de revisões e evidências
posteriores de resolução independente.

### Plano e simulado

Tempo disponível, tarefas propostas, ajustes manuais, tarefas concluídas,
configuração da prova, itens selecionados, duração e estado da sessão.
Estudo, revisão e simulado compartilham o histórico de tentativas e lacunas.

## Regras de aprendizagem

1. Registrar a tentativa antes de revelar resposta e resolução.
2. Distinguir tentativa independente, chute, consulta e uso de dica.
3. Um acerto imediato após ler a resolução não comprova recuperação.
4. A recuperação exige evidência em outro dia sem ajuda. Quantidade de evidências
   e intervalo são parâmetros de implementação a validar.
5. Os intervalos iniciais sugeridos pelo PDF (1, 3, 7, 14 e 30 dias) são
   heurísticos e ajustáveis, não um calendário cientificamente ideal.
6. Erros e acertos assistidos retornam mais cedo; acertos independentes em dias
   distintos permitem espaçar. Preservar manutenção de conteúdos fortes.
7. Listas mistas combinam habilidades já introduzidas e questões novas, sem
   anunciar antecipadamente o método de resolução.
8. Causas de erro: conceito, escolha do método, pré-requisito, cálculo/sinal,
   interpretação/unidade ou falta de tempo. O aluno confirma a causa;
   o cronômetro não produz diagnóstico automático.
9. Mostrar quantidade de evidências e incerteza; horas estudadas não equivalem
   a domínio. Exibir frequência histórica apenas com amostra e período conhecidos.
10. Avaliação mantém feedback fechado até a conclusão. Itens pulados também
    alimentam o caderno de erros.

## Critérios de aceite

- Uma questão real do acervo pode ser filtrada, respondida e corrigida com fonte.
- Resposta enviada e indicadores de ajuda/confiança são preservados após recarga.
- Erro, pulo e acerto assistido geram registros no caderno e revisão futura.
- Acerto no mesmo dia após consultar feedback não encerra uma lacuna.
- Uma revisão posterior independente registra o intervalo real e sua evidência.
- Simulado não revela correções antes do término e usa o mesmo histórico.
- Estatísticas separam tentativas novas, repetidas, assistidas e independentes.
- Plano respeita o tempo disponível e não transfere todo atraso para um único dia.
- Fluxos essenciais funcionam em celular e com teclado; figuras são legíveis.
- Preservar dados existentes ao atualizar ou importar; exportação tem versão.

## Ordem de implementação

1. Ler a habilidade e seus recursos; inspecionar o acervo e regras da prova.
2. Definir e validar banco de questões, tentativas, correções e persistência.
3. Construir fluxo completo de questão, correção, lacuna e revisão posterior.
4. Adicionar filtros, listas mistas e plano diário.
5. Integrar simulados e painel por assunto ao mesmo histórico.
6. Testar regras de aprendizagem, recarga, avaliações e layout móvel.

Depois do núcleo: flashcards, diagnóstico, mapa de pré-requisitos, redação,
autoexplicação pontual e apoio de tutor. A primeira versão não depende desses
recursos opcionais.

## Pré-requisito pendente

Conferir o conteúdo, obter gabaritos oficiais e recuperar figuras/fórmulas/textos
de apoio necessários a partir dos mesmos cadernos. A skill e os bancos já estão
disponíveis. A implementação ainda não foi iniciada. Não substituir o acervo por
questões geradas ou de outra fonte.
