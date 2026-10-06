# Interface editorial — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Dar identidade ao app e colocar o estudo à frente dos controles de edição.

**Architecture:** Manter regras de domínio e armazenamento. Alterar tokens e apresentação compartilhada; reorganizar a tela Hoje e a coluna de prática. Usar fontes locais de sistema e preservar assets oficiais.

**Tech Stack:** React 19, TypeScript, Vite, IndexedDB/Dexie, Vitest e Playwright, Node 24.

**Spec:** `docs/superpowers/specs/2026-10-06-interface-editorial-design.md`

## Global Constraints

- Respeitar cores e contratos da spec; não atribuir melhora de memória à paleta.
- Preservar as 78 questões conferidas, PDFs e figuras oficiais.
- Não alterar modelos de dados ou regras de correção e revisão.
- Manter raiz no desenvolvimento e `/vestibular/` no build Pages.
- Textos comuns ≥ 4,5:1; controles necessários e foco ≥ 3:1; alvos de toque ≥ 44px.

## Review Focus

- Planos vazios, concluídos ou bloqueados: início e edição continuam coerentes.
- Controles de edição ocultos: ordem e orçamento persistem após fechar ou recarregar.
- Tela de 320px e zoom: ações e campos não invadem a navegação nem alargam a página.
- Sessão ativa e atualização PWA: rascunho e prazo permanecem salvos.
- Feedback incorreto, pulado ou anulado: cor e título representam o estado real.

### Task 1: Evidências e regressões

**Files:** pesquisa, spec e plano; `tests/e2e/editorial-interface.spec.ts`.
**Interfaces:** Consumes páginas e corpus de testes existentes; produces critérios de apresentação verificáveis.

- [x] Consultar fontes, registrar resultados e limites.
- [x] Rodar o teste antes da mudança: início abaixo da dobra e edição sempre exposta devem falhar.
- [x] Confirmar falha de contraste do limite de controle anterior.

### Task 2: Identidade e tela Hoje

**Files:** `src/styles/tokens.css`, `src/styles/global.css`, `src/styles/today.css`, `src/ui/AppShell.tsx`, `src/features/today/TodayPage.tsx`, `index.html`, `vite.config.ts`, identidade em `public/`.
**Interfaces:** Consumes useStudy e callbacks existentes; produces classe `study-start`, lista `plan-tasks` e edição local com persistência existente.

- [x] Aplicar cores, escala tipográfica, navegação e tema.
- [x] Mover início para o topo e revelar edição pelo botão Editar plano.
- [x] Manter estados vazios, concluídos, continuidade e bloqueio.
- [x] Atualizar testes existentes para abrir a edição antes de editar.
- [x] Rodar Vitest e os cinco testes de interface; confirmar persistência e contraste.

### Task 3: Leitura, feedback e textos

**Files:** `src/features/practice/PracticePage.tsx`, `FeedbackPanel.tsx`, `src/features/catalogue/CataloguePage.tsx`, estilos compartilhados.
**Interfaces:** Consumes registro e grade existentes; produces coluna de leitura e feedback com classes de estado, preservando títulos e semântica.

- [x] Organizar prática e dados de confiança sem mudar callbacks ou campos.
- [x] Distinguir feedback correto, incorreto e neutro por cor e título.
- [x] Refinar listas, filtros e textos compartilhados.
- [x] Conferir screenshots e rodar os testes de navegador completos.

### Task 4: Verificação e publicação

**Files:** README e registro de entrega.
**Interfaces:** Consumes app validado; produces commit publicado e URL verificada.

- [x] Rodar `npm test`, `npm run content:audit`, build raiz + `npm run test:e2e`.
- [x] Rodar build Pages + `npm run test:pages`; não servir dist enquanto outro build o sobrescreve.
- [x] Pedir revisão independente e corrigir problemas materiais.
- [ ] Publicar em main, acompanhar Actions e verificar HTML, assets e catálogo públicos.
