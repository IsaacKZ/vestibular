# Caderno UDESC

App de estudos para o vestibular UDESC, com questões da habilidade
`udesc-vestibular`, planejamento diário, registro de tentativas, caderno de
erros e revisões espaçadas. O histórico fica no navegador; o backup em JSON
permite guardar uma cópia e transferir os dados entre dispositivos.

## Desenvolvimento

Use Node 24 (versão registrada em `.node-version`).

```sh
npm ci
npm run content:import
npm run dev
```

Na máquina da nuvem, use `npm ci --cache /tmp/udesc-npm-cache` porque o
diretório pessoal não permite escrita. O repositório fica em
`/workspace/vestibular`. Não há serviço de backend, credenciais ou API
externa obrigatória nesta versão.

```sh
npm run check
npm test
npm run content:audit
npm run build
npm run test:e2e
```

Os testes de navegador usam Chromium. Neste ambiente, o executável
`/usr/bin/chromium` é detectado automaticamente. Em outra máquina, instale
o navegador com `npx playwright install chromium`. Para usar outro
executável, defina `PLAYWRIGHT_CHROMIUM_EXECUTABLE` com o caminho local.

## Hospedagem no GitHub Pages

O app está em https://isaackz.github.io/vestibular/.
O workflow [Deploy to GitHub Pages](.github/workflows/pages.yml) audita o
conteúdo, executa os testes e publica o build após cada envio à branch `main`.
No repositório, configure **Settings → Pages → Build and deployment → Source →
GitHub Actions**. Para repetir a publicação, use **Actions → Deploy to GitHub
Pages → Run workflow**.

```sh
npm run build:pages
npm run test:pages
```

O build para Pages usa o caminho `/vestibular/` e rotas como
`/vestibular/#/questions`, que permitem abrir links e recarregar telas em
uma hospedagem estática. O desenvolvimento e o build padrão continuam na
raiz. Os testes de Pages verificam o catálogo, figuras, retomada de tentativas,
navegação por teclado e funcionamento offline em um servidor sem fallback
de rotas.

## Conteúdo disponível

O catálogo tem **420 questões**, de cinco disciplinas e seis edições de
2024/1 a 2026/2. Os seis gabaritos oficiais enviados foram incorporados:
**404 respostas e 16 anulações**, vinculadas por edição, período e número
original. Os 12 cadernos oficiais estão preservados em PDF, com procedência
e SHA-256 registrados.

O primeiro lote libera **78 questões para treino corrigido**: 26 de Biologia,
27 de Física e 25 de Química, das edições 2025/2 e 2026/1. Enunciados,
alternativas, figuras e resoluções elaboradas foram conferidos contra os
originais. As outras **342 questões permanecem bloqueadas**, incluindo
as anuladas. Ter gabarito confirmado não basta para liberar uma transcrição
incompleta ou uma resolução pendente.

Matemática e Português/Literatura ainda aguardam a conferência necessária
para treino. Ainda não há itens reservados para avaliações inéditas.
O processo e as pendências estão em [content/README.md](content/README.md)
e [docs/publicacao-2026-10-06.md](docs/publicacao-2026-10-06.md).

Os exemplos sintéticos usados para testar o estudo estão somente em
`tests/`; eles não fazem parte do app publicado.

Validação em 06/10/2026: 263 testes de módulos, 31 testes de navegador na
raiz e três testes específicos de Pages passaram, além da auditoria de
conteúdo e dos dois builds com verificação de tipos.
Os comandos de validação acima verificam também celular, offline, retomada de rascunhos,
encerramento por prazo, transferência de backup e bloqueio da correção
durante simulados.

A revisão e as correções estão registradas em
[docs/revisao-2026-10-02.md](docs/revisao-2026-10-02.md). As correções pedagógicas
e sua validação estão em
[docs/correcoes-aprendizagem-2026-10-03.md](docs/correcoes-aprendizagem-2026-10-03.md).

## Interface e leitura

A interface usa fundo de papel, texto escuro, azul para ações e títulos em
serifa. A tela Hoje apresenta o início do estudo antes do roteiro; os
controles de organização aparecem ao abrir Editar plano. A prática usa uma
coluna de leitura e identifica cada correção por título e cor.

As fontes, decisões e limites da pesquisa estão em
[docs/pesquisa-cores-interface-2026-10-06.md](docs/pesquisa-cores-interface-2026-10-06.md).
A entrega e os testes estão em [docs/interface-2026-10-06.md](docs/interface-2026-10-06.md).
A paleta foi escolhida para identidade e legibilidade; não há evidência de
que, por si, melhore retenção ou aprovação no vestibular.

## Regras de estudo

A tentativa é salva antes de abrir a correção. Erros, respostas em branco,
chutes, dúvidas e uso de ajuda entram no caderno. A recuperação exige
acertos independentes em dias posteriores, com intervalo configurável;
reler uma solução no mesmo dia não comprova retenção. O plano respeita
até 120 minutos por dia e cinco dias por semana, preservando as datas de
revisões atrasadas.

O simulado permite selecionar as disciplinas com questões conferidas e
apresenta a correção depois do encerramento. Neste lote, o simulado parcial
usa Biologia, Física e Química. Não representa a prova completa de 100
questões. A retomada mantém o prazo original e os rascunhos salvos.

As contagens de progresso distinguem primeira tentativa, repetição e uso
de ajuda. Os intervalos iniciais são heurísticas ajustáveis; tempo de
estudo e acertos com ajuda não são apresentados como domínio de conteúdo.

## Uso offline e dados

O build inclui o app, o catálogo, as figuras conferidas e os gabaritos no
cache offline após o primeiro acesso com conexão. Os cadernos completos
são arquivos maiores e não entram no cache inicial. A instalação como app
depende do suporte do navegador.
Atualizações aguardam o encerramento de sessões ativas. Limpar os dados
do navegador apaga o histórico local; exporte um backup antes.

O plano e as decisões de implementação estão em
[docs/superpowers/plans/2026-10-02-udesc-estudos.md](docs/superpowers/plans/2026-10-02-udesc-estudos.md)
e [docs/superpowers/specs/2026-10-02-udesc-estudos-design.md](docs/superpowers/specs/2026-10-02-udesc-estudos-design.md).

## Correções pedagógicas

O plano distribui novidades entre matérias e habilidades e prioriza revisões
atrasadas antes de incluir mais conteúdo. A duração usa a mediana do tempo
ativo com margem para correção, entre 5 e 30 minutos por item; sem histórico,
usa 10 minutos. São estimativas ajustáveis pelo orçamento diário. A data da
prova limita os próximos retornos, sem contar revisões antecipadas como retenção.

No caderno, a causa do erro orienta uma ação e uma pergunta de autoexplicação.
O apoio precisa de revisão e procedência. Depois dele, o app sugere outra
questão da habilidade ou um pré-requisito conferido, quando houver; a prática
guiada registra consulta. A recuperação do mesmo item e a aplicação posterior
em itens diferentes aparecem separadas no progresso, com acertos, oportunidades,
datas e dificuldade declarada. Histórico antigo sem baseline não ganha
evidências por inferência.

Avaliações inéditas usam somente itens reservados, com habilidades e dificuldade
conferidas. Abrir uma sessão já exclui o item de avaliações inéditas futuras,
mesmo sem resposta. O app não completa a lista com questões já estudadas quando
faltam itens. A reserva protege o fluxo de estudo; os arquivos públicos e a
consulta externa ao material não permitem garantir ineditismo fora do app.

O parecer de aprendizagem e as fontes estão em
[docs/avaliacao-aprendizagem-2026-10-02.md](docs/avaliacao-aprendizagem-2026-10-02.md).
As correções não demonstram, por si, ganho real de aprendizagem ou probabilidade
de aprovação. Isso exige uso, avaliações comparáveis e preparação integral,
incluindo a redação e o edital vigente.
