# Pesquisa dos gabaritos UDESC — 03/10/2026

> Registro histórico da pesquisa inicial. Em 06/10, o acesso ao portal já
> estava disponível, os seis gabaritos enviados foram incorporados e os
> 12 cadernos oficiais estavam preservados no projeto. Estado atual:
> [publicacao-2026-10-06.md](publicacao-2026-10-06.md).

Nenhum gabarito oficial foi obtido ou incorporado nesta pesquisa. O proxy
do ambiente recusou as consultas HTTPS antes de estabelecer conexão com
a UDESC. O mapeamento abaixo foi conferido no catálogo e no material da
habilidade; ainda precisa ser comparado com os cadernos oficiais.

## Acesso às fontes

O ponto de partida é o [portal de vestibulares da UDESC](https://www.udesc.br/vestibular).
A consulta não retornou conteúdo; não foi possível descobrir os links de
provas, gabaritos definitivos, retificações ou anulações.

| URL consultada | Resultado observado |
|---|---|
| `https://www.udesc.br/vestibular` | `Tunnel connection failed: 403 Forbidden` |
| `https://www.udesc.br/vestibular/provas` | Mesmo bloqueio; caminho exploratório, existência não confirmada |
| `https://www.udesc.br/vestibular/vestibular2026-2` | Mesmo bloqueio; caminho exploratório, existência não confirmada |

O HTTP 403 veio do proxy na abertura do túnel HTTPS. Não é evidência de
que a UDESC tenha recusado a consulta ou de que um gabarito não exista.
Nenhum HTML ou PDF dessas URLs foi recebido.

A leitura da configuração salva mostrou acesso restrito, com o preset
`package_managers` e nenhuma regra personalizada. Foi salva no rascunho
a regra personalizada `www.udesc.br`, pelo campo `network.allowed_domains`.
Uma leitura posterior confirmou a nova regra, o preset e os demais
campos preservados. O salvamento foi confirmado pela ferramenta;
isso **não aplica a regra à máquina em execução**.

Para retomar a consulta, é necessário revisar e salvar essa configuração
nas configurações do ambiente. Depois, conferir novamente o acesso ao
portal. Se os documentos estiverem em outro domínio, identificar esse
domínio nos links oficiais antes de solicitar sua inclusão. Não é
necessário fornecer credenciais para consultar documentos públicos.

Também foi tentada a leitura do chat de importação referenciado pelo
usuário (`01a0fcc1-4de0-7040-8376-3beb05ec5125`). A ferramenta informou
que não conseguiu determinar sua existência por indisponibilidade do
host. Nenhum conteúdo desse chat foi usado como fonte nesta pesquisa.

## Correspondência das questões

A chave de correspondência é **edição + período + número original**.
O campo `subjectNumber` reinicia em cada disciplina e não identifica
sozinho uma questão no gabarito. O número 1, por exemplo, existe nos dois
turnos.

| Período | Disciplina no app | Número original no caderno | Questões por edição |
|---|---|---|---:|
| Matutino | Matemática | 1–14 | 14 |
| Matutino | Biologia | 15–28 | 14 |
| Matutino | Português/Literatura | 37–50 | 14 |
| Vespertino | Física | 1–14 | 14 |
| Vespertino | Química | 15–28 | 14 |

No matutino, Língua Estrangeira ocupa os números 29–36 e está fora deste
acervo. As demais disciplinas do vespertino também estão fora do escopo
atual. São 42 questões matutinas e 28 vespertinas por edição.

| Edição rotulada no acervo | Matutino a conferir | Vespertino a conferir | Total |
|---|---:|---:|---:|
| 2024/1 | 42 | 28 | 70 |
| 2024/2 | 42 | 28 | 70 |
| 2025/1 | 42 | 28 | 70 |
| 2025/2 | 42 | 28 | 70 |
| 2026/1 | 42 | 28 | 70 |
| 2026/2 | 42 | 28 | 70 |
| **Total** | **252** | **168** | **420** |

Isso corresponde a 12 blocos de edição/turno a conferir; o número de
arquivos oficiais depende de como a UDESC publicou os documentos.
Não foram encontrados IDs ou combinações edição/período/número duplicados.
Os números “Questão” no texto bruto dos 420 registros correspondem a
`originalNumber`.

O catálogo não registra cor ou tipo do caderno. Estas referências locais
ajudam a reconhecer o material, mas não substituem a comparação integral
dos enunciados e da ordem das alternativas:

| Edição | Matemática, questão 1 | Física, questão 1 |
|---|---|---|
| 2024/1 | Senha JF3 | Veículos A e B em uma rodovia |
| 2024/2 | Triângulo ABC com coordenadas (1,2) | Pista circular de 800 m e 10 min |
| 2025/1 | Mediatriz de segmento | Carro em rotatória de 100 m e 72 km/h |
| 2025/2 | Sistema linear possível e determinado | F1, reta de 500 m e 225 km/h |
| 2026/1 | Combos de hamburgueria, R$ 35,10 | LIGO em 2015 |
| 2026/2 | Triângulo inscrito, raio 1 | Jogador chuta bola em trajetória parabólica |

## Conferência após liberar o acesso

1. Seguir os links publicados no portal oficial e localizar os cadernos
   e gabaritos de cada edição/turno. Confirmar o cabeçalho e eventual tipo
   ou cor de prova, comparando enunciados e ordem das alternativas.
2. Identificar o gabarito definitivo e verificar publicações posteriores
   de retificação ou anulação. Se apenas um preliminar for encontrado,
   registrar essa condição sem tratá-lo como definitivo.
3. Guardar os documentos consultados, URLs, SHA-256, data de consulta,
   localização de cada resposta e identificação da publicação. Manter
   a rastreabilidade quando houver uma revisão posterior.
4. Importar as letras por edição/turno/número original em
   `content/answer-keys.json`, com revisão, fonte, localização e revisor
   exigidos pelo contrato. Registrar anulações como anulações, sem
   escolher uma letra para a questão anulada.
5. Conferir também texto, fórmulas, figuras, habilidades e resoluções
   antes de liberar treino corrigido. Executar a importação e a
   auditoria de conteúdo após incorporar dados verificados.

## Estado preservado

Os 420 registros continuam sem gabarito e sem registro de anulação;
`null` significa informação ausente, não confirmação de que nenhuma
questão foi anulada. Os arquivos de gabaritos, conferências e resoluções
continuam vazios. Há 168 registros marcados como OCR e 68 classificações
sinalizadas como incertas; obter um gabarito não resolve essas pendências.
Nenhuma questão está liberada para treino corrigido.

As fontes locais da habilidade mencionam 12 PDFs em
`Downloads/vestibulares_udesc` no computador do usuário, mas esses PDFs
não foram localizados nos caminhos pesquisados neste ambiente. Parte
de `/tmp` não permite leitura. As fontes locais não contêm URLs de
gabaritos oficiais nem identificam variantes de prova.

O processo de incorporação está descrito em
[content/README.md](../content/README.md); os contratos de gabarito e
anulação estão em [src/content/schema.ts](../src/content/schema.ts).
