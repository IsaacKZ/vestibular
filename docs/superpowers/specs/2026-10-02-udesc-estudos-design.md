# App de estudos UDESC: especificação

Data: 02/10/2026. Estado: implementação concluída e revisada no checkout.
Validação e limites atuais: [relatório de revisão](../../revisao-2026-10-02.md).
Diretrizes: Superpowers para planejamento; Slop Curator para conteúdo e direção visual.

## 1. Entendimento do pedido

Isaac quer um app pessoal para estudar para o vestibular UDESC, com as questões
da habilidade `udesc-vestibular` e os métodos do PDF enviado. O resultado esperado
é conseguir tentar, entender a correção, registrar a lacuna e confirmar o retorno
em outro dia, sem confundir acerto assistido com aprendizagem independente.

Restrições confirmadas: Matemática, Biologia, Português/Literatura, Física e
Química; até 120 minutos por dia, cinco dias por semana. O acervo analisado cobre
70 das 100 objetivas de cada edição, não a prova completa. A data-alvo informada
na skill é 29/11/2026; regras decisivas e obras exigidas devem ser conferidas no
edital vigente. A decisão antiga da skill sobre fazer o app no Claude Code foi
substituída pelo pedido atual de fazê-lo neste repositório.

Assumimos uso individual em celular e computador, com app web instalável e
persistência local. Sincronização automática entre dispositivos não está incluída:
backup exportável permite transferência manual, com limites explícitos.

## 2. Fontes disponíveis e limites

- Pesquisa enviada: `Pesquisa_metodos_de_estudo_app_vestibular.pdf`, páginas 2–4
  para requisitos essenciais; páginas 1 e 5 para evidência e limites.
- Skill lida: `.agents/skills/udesc-vestibular/SKILL.md`.
- Acervo autorizado: cinco arquivos em
  `.agents/skills/udesc-vestibular/references/questoes/`.
- Mapa histórico: `.agents/skills/udesc-vestibular/references/topicos.md`.
- Contexto metodológico: `.agents/skills/udesc-vestibular/references/metodo.md`.
- A conversa referenciada não pôde ser lida. Nenhuma afirmação depende de seu
  conteúdo; a skill veio do arquivo anexado e foi lida diretamente.

Auditoria estrutural do arquivo recebido:

| Matéria | Itens | OCR sinalizado | Incerteza sinalizada | Candidatos sem marcação |
| --- | ---: | ---: | ---: | ---: |
| Matemática | 84 | 56 | 12 | 22 |
| Biologia | 84 | 0 | 8 | 76 |
| Português/Literatura | 84 | 0 | 22 | 62 |
| Física | 84 | 56 | 7 | 25 |
| Química | 84 | 56 | 19 | 20 |
| Total | 420 | 168 | 68 | 205 |

Há 21 itens com as duas marcações; a união bloqueia 215 itens. Os demais 205 são
apenas candidatos à conferência. Encontramos alternativas vazias e símbolos
corrompidos mesmo em itens sem marcação. Edição e ausência de marcações não são
critérios suficientes para liberar uma questão.

O arquivo recebido não fornece gabaritos oficiais, resoluções comentadas nem
figuras dos cadernos. Neste momento, zero itens estão certificados como prontos
para o ciclo de treino corrigido. O acesso tentado a `www.udesc.br` foi recusado
pelo proxy com HTTP 403; isso não demonstra que os documentos não existam.

Não gerar questões substitutas, completar alternativas por inferência nem
apresentar respostas calculadas pelo app como gabarito oficial. Restaurar um
enunciado a partir do original é permitido, mantendo a mesma identidade e
registrando a nova revisão. Resolução elaborada para estudo pode existir, desde
que tenha autoria identificada e revisão registrada.

## 3. Arquitetura recomendada e alternativas

**Recomendação:** React + TypeScript + Vite; IndexedDB com Dexie; Zod para
contratos/importação; Vitest e Playwright. PWA estática com assets locais, sem
serviços obrigatórios ou credenciais para o estudo individual.

| Alternativa | Quando faz sentido | Custo neste projeto |
| --- | --- | --- |
| React/Vite local | Fluxos de estudo, muitas interações, testes e evolução incremental | Requer cuidar de backup e de dados locais |
| HTML e módulos JS | App pequeno com poucos fluxos | Mais trabalho manual para tipos, formulários e estados do histórico |
| Next.js com backend | Contas, sincronização e colaboração já necessárias | Adiciona autenticação, banco remoto e operação antes do núcleo |

Escolhemos a primeira. Não há preferência de framework declarada; essa escolha
pode ser revisada sem alterar os requisitos de aprendizagem.

Módulos:
- `src/content`: contratos, qualidade, procedência e filtros do acervo.
- `src/domain`: tentativas, avaliação, lacunas, revisão, plano e métricas.
- `src/storage`: transações, snapshots de conteúdo, migrações e backup.
- `src/features`: telas organizadas por fluxo de estudo.
- `src/ui`: controles acessíveis e tokens visuais compartilhados.
- `scripts`: conversão e auditoria do material autorizado.

Usar o checkout existente em `/workspace/vestibular`. Cada tarefa cloud já é
isolada; não criar worktree adicional sem pedido do usuário. A implementação
gera package manifest e lockfile; onboarding posterior usa instalação congelada.

## 4. Identidade, qualidade e histórico

Identificador canônico: `udesc-AAAA-S-periodo-NN`, onde S é 1 ou 2, período é
`matutino` ou `vespertino`, e NN é o número original no caderno. Número dentro
da matéria fica separado. Assim Matemática 1 e Física 1 não colidem.

Uma questão possui revisões; cada revisão preserva arquivo/heading de origem,
SHA-256 do texto bruto, enunciado, cinco alternativas, múltiplos assuntos,
habilidades, ativos e estados de conferência. O texto bruto não é corrigido
automaticamente. Classificação inicial vem do mapa, com revisão posterior.
Cada ativo registra posição no enunciado/texto de apoio ou vínculo à alternativa
A–E, ordem, descrição e fonte. Alternativa gráfica precisa dessa associação.
Flags da importação permanecem no histórico; só uma nova revisão comprovada no
original pode retirar o bloqueio. Uma edição considerada melhor não basta.

Liberar para treino corrigido exige cumulativamente:
1. Enunciado e cinco alternativas conferidos, sem fórmula ambígua.
2. Textos de apoio e figuras necessários presentes, legíveis e com procedência.
3. Classificação revisada.
4. Gabarito conferido no documento oficial, com localização registrada.
5. Resolução útil revisada, identificada como oficial ou elaborada.
6. Item não anulado.

Estados de inventário: pendente, precisa de original, falta gabarito,
falta resolução, pronta, anulada. Motivos acumulam; o primeiro motivo não oculta
os demais. A ausência de figura não será resolvida com imagem gerada.

Tentativas são imutáveis. Guardar a revisão da questão, resposta ou pulo,
confiança antes da correção, dúvida, chute, dica, consulta, tempo ativo, modo,
sessão, instante, dia local, primeira tentativa e exposição anterior ao feedback.
Uma avaliação usa uma revisão de gabarito explícita. Mudança de gabarito cria
evento de reavaliação, sem sobrescrever o resultado anterior.
Métricas atuais usam a última avaliação explícita de cada tentativa; o histórico
mostra a inicial e as reavaliações. Anulação posterior cria avaliação excluída do
denominador. Lacunas e revisões são recalculadas preservando notas do aluno.

Revelação da correção é evento separado. Atualizações do banco preservam snapshots
das revisões usadas. Sem armazenamento confirmado, não revelar o feedback.
Tentativas de avaliação ativa ficam fora de resultados, caderno e projeções
visíveis; encerrar a sessão publica esses efeitos de forma transacional.

## 5. Experiência e direção visual

Quatro áreas principais:
- **Hoje:** tempo disponível, tarefas do dia, próxima sessão e ajuste manual.
- **Questões:** filtros, inventário, fontes, listas e acesso a simulados.
- **Caderno:** lacunas, revisões por data, anotações e histórico.
- **Progresso:** resultados por matéria/assunto e evidências posteriores.

No celular, navegação inferior; na questão, dar espaço ao enunciado e ao envio.
No desktop, navegação lateral e coluna de leitura de até 720 px. Selecionar uma
alternativa não envia a resposta; exigir ação explícita. Oferecer pulo registrado.
Dicas, consulta, dúvida e chute são registráveis antes do envio.

Direção de caderno de trabalho: fundo `#F7F5EF`, texto `#1F2529`, texto secundário
`#5A6266`, superfície branca, ação `#1B6658`. Fonte do sistema, enunciado de
18 px/1,6, controles com texto legível, bordas discretas e espaçamento consistente.
Verificar contraste nas combinações realmente usadas, inclusive estados e foco.

Cada tela tem uma ação principal. Não usar hero promocional, gradiente aleatório,
vidro translúcido, brilho, coleção de cartões decorativos, gamificação ou métricas
ilustrativas. Ícone precisa ajudar uma ação; cor deve acompanhar texto.

Estados de produto:
- Sem histórico: “Você ainda não registrou tentativas.”
- Gabarito ausente: “Sem gabarito confirmado.”
- OCR pendente: “Texto matemático a conferir.”
- Figura ausente: “Falta uma figura do enunciado.”
- Acerto assistido: “Acerto com consulta”, “Acerto com dica” ou “Acerto por chute”.
- Repetição imediata: “Nova tentativa no mesmo dia.”
- Sem item liberado: informar os motivos e permitir consultar o inventário.

Não anunciar “dominado” por uma questão ou horas acumuladas. Fórmulas só recebem
renderização matemática depois de conferidas no original; apresentar MathML
acessível. Imagens reais têm ampliação por teclado e descrição revisada.

## 6. Regras de estudo e revisão

Enviar primeiro, corrigir depois. O feedback mostra gabarito/fonte, raciocínio,
etapa decisiva e próximo passo; a causa depende da confirmação do aluno.

Causas: conceito, método, pré-requisito, cálculo/sinal, interpretação/unidade,
tempo. Caderno inclui erro, pulo e acerto com ajuda, chute ou dúvida. Baixa confiança
é tratada como dúvida para a fila, sem dizer que a causa foi diagnosticada.

Parâmetros iniciais escolhidos para este produto:
- retorno de aquisição/erro em 3 dias;
- após primeira evidência independente posterior, novo retorno em 14 dias;
- após recuperação, manutenção a cada 14 dias;
- recuperação daquele item exige duas evidências corretas sem ajuda, sem chute
  ou dúvida, em dias distintos, com pelo menos 3 dias entre evidências;
- acerto no dia da visualização da correção não conta como evidência de retenção.

Esses valores são heurísticos configuráveis, não intervalo cientificamente
ótimo. A pesquisa mais recente enviada tem prioridade sobre generalizações da
skill: não comparar tamanhos de efeito de estudos diferentes como ranking.
O PDF apresenta 1/3/7/14/30 como exemplo ajustável; a skill recomenda outra
calibragem. A escolha 3/14 reduz carga inicial e mantém a decisão explícita.

Uma tentativa posterior correta e independente fornece evidência de retenção do
item. Acerto independente em questão diferente, sem exposição prévia à sua
resolução, após introdução da habilidade relacionada, registra “Aplicação em item
novo”. Questão nova errada/assistida não conta. Não depender de um segundo item
inexistente para permitir revisão, nem alegar domínio de assunto por repetição.

A regra de exposição considera apenas feedback da mesma questão anterior ao
instante da tentativa. Mostrar a correção depois de uma revisão correta não
apaga a evidência que ela acabou de produzir. Primeira revisão elegível deve
ocorrer pelo menos 3 dias após a tentativa que abriu/reabriu a lacuna.

Intercalar habilidades já introduzidas em Matemática, Física e Química; não
anunciar método/tópico antes da resposta numa lista mista ou avaliação.
Quando falta o conceito, permitir apoio concentrado e tentativa independente
posterior. Terminologia de Biologia não será misturada automaticamente.

Timer ajustável e pausas autorreguladas; alerta não interrompe a questão.
Tempo ativo pausa quando a página fica oculta. Tempo não diagnostica o erro.

## 7. Plano diário, avaliação e métricas

Plano: 30/60/90/120 minutos; seleção inicial 120; no máximo cinco dias de estudo
por semana. Cada tarefa de questão reserva 10 minutos para tentativa e correção.
Máximo 12 questões previstas num dia de 120 minutos; nenhuma precisa ser concluída
à força nesse tempo. Reservar até 40% das vagas para revisões vencidas; usar o
restante para lacunas, manutenção e novidades, nessa ordem. Sem histórico, preencher
com questões novas prontas. Redistribuir excesso sem alterar a data de vencimento
histórica. Permitir reordenar/remover, sem ultrapassar a capacidade.

A frequência histórica usa as seis edições e as 420 classificações iniciais, com
amostra e período visíveis. Exibir “Contagens provisórias do mapa histórico” e
quantas classificações foram sinalizadas como incertas na amostra (68 no total).
Conferência posterior da taxonomia pode gerar nova revisão do mapa. Quantidade
pronta para treino é outra métrica; bloqueio de treino não altera retroativamente
as contagens da revisão original. Não prever acertos garantidos nem excluir
assuntos por zero ocorrências. Literatura antiga não comprova a lista de 2027/1.

Simulados são parciais das cinco matérias. Configuração inicial: treino de 10
questões em 30 minutos, claramente configurável, sem alegação de duração oficial.
Bloquear início se não houver itens suficientes. Uma composição de 14 por matéria
só pode ser oferecida quando houver 70 itens prontos adequados; continua parcial.
Sem incluir idiomas, humanas ou redação por substituição.

Avaliação não disponibiliza dica, consulta, resolução ou rota de feedback antes do
encerramento. Retomar após recarga preserva estado. Ao finalizar, pulos e lacunas
alimentam o mesmo caderno. Timer vencido registra encerramento e não perde respostas.
Encerramento promove os últimos rascunhos válidos salvos antes do prazo a
tentativas; cria pulo apenas para item sem resposta. Após o prazo, rejeitar novas
alterações, sem perder rascunhos duráveis. Ao reabrir depois da expiração, concluir
com os dados existentes. Finalização repetida é idempotente.

Progresso mostra acertos/total, período, quantidade de evidências, tempo ativo,
confiança e ajuda. Separar novas/repetidas, antes/depois de ver a resolução,
primeiras tentativas/retentativas, independentes/assistidas e retenção/transferência.
Itens anulados não entram no denominador de acertos. Não preencher gráficos antes
de existir dado. A correção de chute é estimativa sob hipótese de chute aleatório,
não medição individual de “conhecimento real”; fica fora da primeira versão.

## 8. Persistência, offline e erros

IndexedDB guarda histórico e sessão em andamento. Cada envio grava tentativa,
snapshot e efeitos na mesma transação. Falha de gravação mantém rascunho na tela
e bloqueia feedback. Cliques duplos usam o mesmo token de submissão e não duplicam
tentativas. Histórico não depende de localStorage.
Ao iniciar sessão, preservar snapshots de todos os itens, inclusive os ainda
não respondidos. Planos por data e rascunhos por sessão/item também são duráveis.

Backup JSON versionado com snapshots e procedência. Importar valida schema,
IDs, vínculos e conflitos antes de qualquer gravação. Mostrar prévia, mesclar
sem apagar o histórico atual, deduplicar IDs idênticos e rejeitar colisões com
conteúdo diferente. Versão futura não suportada não é importada parcialmente.

Offline: cache do app, catálogo e ativos liberados. Dados do aluno ficam no
IndexedDB. Atualização de service worker espera o término da sessão. Não prometer
restauração se o navegador apagar os dados locais; oferecer exportação fácil.
Migração tem validação e caminho de exportação antes de modificar dados.

## 9. Fases e critérios de conclusão

**Fase 1 — conteúdo auditável:** inventário dos 420, proveniência e quarentena;
uma pequena seleção real conferida com gabarito e resolução. Não fixar uma
quantidade fictícia liberada; ao menos um item confirmado para demonstrar o ciclo.

**Fase 2 — primeiro ciclo funcional:** tentar → persistir → corrigir → caderno →
revisar em outro dia → registrar evidência, com recarga e backup.

**Fase 3 — rotina:** filtros, listas mistas, plano diário e redistribuição de atraso.

**Fase 4 — avaliação:** simulados parciais, histórico compartilhado e métricas.

**Fase 5 — acabamento:** offline, atualização segura, celular, teclado e instalação.

Aceite depende de testes reais de cada fase. Fixtures de teste não entram no banco
de produção. O primeiro fluxo precisa ser verificado com questão real, fonte
conferida e resultado conhecido; testes com fixtures sozinhos não certificam
conteúdo nem completam o MVP.

Material externo necessário: cadernos/imagens/gabaritos que complementem as mesmas
questões do acervo; edital vigente para regras decisivas e obras de 2027/1.
Pode ser fornecido por anexos ou acesso permitido à fonte oficial. Sem isso, parte
da engenharia progride, mas o aceite de treino corrigido continua bloqueado.

Fora desta entrega: login, sincronização remota, IA tutora, rankings, flashcards,
diagnóstico, redação e conteúdos fora das cinco matérias. São possíveis extensões
com planos próprios após estabilizar o núcleo.

## 10. Validação do projeto

- Importação: 420 IDs únicos, 84/matéria, 14/matéria/edição; nenhum item incompleto
  ou sem gabarito confirmado vira pronto.
- Domínio: tentativa imutável, ajuda/pulo no caderno, recuperação posterior,
  relógio e fuso explícitos, manutenção e plano com capacidade.
- Banco local: transação abortada não revela feedback; envio duplo não duplica;
  backup repetido é idempotente e conflito não apaga histórico.
- Navegador: fluxo real completo, avaliação fechada até término, recarga,
  importação/exportação e offline após cache.
- Interface: teclado, foco, leitor de tela, 320 px e zoom 200%, alvos de toque
  44×44 px, fórmulas e imagens legíveis, nenhum gráfico ou dado fictício.
