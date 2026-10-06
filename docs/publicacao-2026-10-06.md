# Conteúdo preparado para publicação — 06/10/2026

O usuário autorizou publicar o app no repositório `IsaacKZ/vestibular`,
substituindo os arquivos anteriores. O novo projeto usa React, TypeScript,
Vite e IndexedDB; não depende de um backend ou de credenciais externas.

## Conteúdo incorporado

| Registro | Quantidade |
|---|---:|
| Questões no catálogo | 420 |
| Respostas oficiais confirmadas | 404 |
| Anulações oficiais confirmadas | 16 |
| PDFs de gabaritos enviados | 6 |
| Cadernos oficiais preservados | 12 |
| Questões liberadas para treino | 78 |
| Questões fora do treino | 342 |
| Questões reservadas para avaliação inédita | 0 |

O lote de treino contém 26 questões de Biologia, 27 de Física e 25 de
Química, das edições 2025/2 e 2026/1. As resoluções são elaboradas para
estudo, com conferência e procedência; não são apresentadas como resoluções
publicadas pela UDESC. As figuras são recortes dos cadernos originais.

A correspondência dos gabaritos usa edição, período e número original,
preservando a separação entre os turnos. Cada decisão tem documento,
localização, revisão e revisor. Os PDFs originais e seus SHA-256 estão
identificados em `content/answer-key-sources.json` e
`content/booklet-sources.json`.

## Pendências preservadas

Matemática e Português/Literatura aguardam conferência integral; as quatro
outras edições de Biologia, Física e Química também não estão liberadas.
Os relatórios em `content/review-batches/` registram as anulações e três
questões mantidas bloqueadas por ambiguidade no original. As letras
oficiais dessas questões permanecem registradas, sem resolução certificada.

O simulado parcial pode usar as três matérias com conteúdo conferido. A
avaliação reservada inédita permanece indisponível enquanto não houver
itens reservados. O app não completa essas listas com material pendente.

## Reprodução da validação

```sh
npm ci
npm run content:import
npm run content:audit
npm test
npm run build
npm run test:e2e
```

O build verifica os tipos. Os testes de navegador usam Chromium e incluem
consulta do catálogo real, treino e simulado com o conteúdo publicado,
figuras, offline, retomada, backup e proteção da correção durante o simulado.

Resultados nesta versão: 263 testes de módulos e 26 testes de navegador
aprovados, auditoria de conteúdo aprovada e build com verificação de tipos
aprovado. A revisão independente conferiu as 420 decisões oficiais, os
hashes dos 18 PDFs e os recortes das figuras; o único recorte incompleto
identificado foi corrigido e conferido novamente antes da publicação.
