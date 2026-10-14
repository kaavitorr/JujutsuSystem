# Ficha Ruptura 2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Aplicar a ficha aprovada em CSS na instalação local do Foundry, com retrato e recursos na sidebar.

**Architecture:** Templates exclusivos da 2.0 reutilizam os controles nativos de retrato, rolagens, inventário, efeitos e itens. Um módulo de contexto prepara grupos de perícias, proficiências e recursos; CSS restrito à classe `jj2-ruptura` mantém a ficha 1.0 intacta.

**Tech Stack:** Foundry V14 ApplicationV2, Handlebars, JavaScript ES modules, CSS e testes Node.

**Spec:** Prévia aprovada `ficha-ruptura-css.html` da conversa, ajustada pelo pedido de sidebar. Abas: Resumo, Técnicas, Perícias, Características, Inventário, Efeitos, Biografia. Armas: Pesada, Leve, Projétil, Desarmado, Natural.

## Global Constraints

- Aplicar diretamente ao sistema instalado conforme autorização do usuário; preservar arquivos alheios e a versão 1.0.
- Sidebar: retrato, Vida, Ferimentos, Energia, Refinamento, Ações, CR, Iniciativa e Movimento.
- Salvaguardas e todas as proficiências exibem os cinco graus 0–4 e respeitam pontos disponíveis e propriedade do ator.
- Recursos usam dados reais e persistentes; nenhum valor demonstrativo na ficha instalada.
- Manter handlers nativos, imagem/vídeo de retrato, edição e modo de jogo.
- O botão da árvore abre a interface de progressão do estilo; não inventar uma árvore completa sem regras fornecidas.

## Review Focus

- Ator antigo sem campos novos: Ferimentos 0 e Ações 6.
- Ator sem estilo ou estilo com principal escalar: ficha renderiza.
- Usuário sem propriedade: não pode alterar proficiências nem recursos.
- Atualização parcial de partes: sidebar e navegação continuam coerentes.
- Fórmula de bônus visual deve corresponder às rolagens existentes; não mudar regras sob um ajuste de layout.

### Task 1: Contexto e dados

**Files:** `module/applications/actor/jj/legacy2-sheet.mjs`, `module/data/actor/legacy2-schema.mjs`, `test/legacy2-sheet.test.mjs`.

- [x] Escrever testes de agrupamento, defaults de recursos, clamping visual e principal escalar; executar e observar falha.
- [x] Implementar contexto puro e adicionar Ferimentos/Ações ao sub-schema.
- [x] Executar os testes novos e existentes.

### Task 2: Integração e templates

**Files:** `module/applications/actor/character-sheet.mjs`, templates 2.0 de cabeçalho, sidebar, resumo, perícias e navegação; wrapper de características.

- [x] Conectar partes/navegação/contexto somente na 2.0, mantendo permissões e rolagens.
- [x] Implementar sidebar completa e cinco bolinhas por proficiência.
- [x] Preservar itens individuais de características e botão da progressão existente.

### Task 3: CSS e verificação

**Files:** `less/jujutsu-ruptura-2.css`, `system.json`.

- [x] Aplicar estilo aprovado, fontes locais e ícones SVG, com sidebar recolhível.
- [x] Compilar/renderizar os templates reais em fixture com CSS existente; verificar campos, abas e telas estreitas.
- [x] Executar suite, sintaxe e revisão independente do diff; corrigir achados importantes.

## Registro de execução

- Base: `80e341fc09417189113e2a8d599accd0e5f84f9e`.
- Baseline: 22 testes existentes passaram.
- A instalação local não responde em localhost:30000; validação visual será feita com templates e CSS reais. Reiniciar/recarregar Foundry será necessário para carregar JavaScript atualizado.
- Verificação final: 33 testes passaram, incluindo 11 testes da ficha. Sintaxe dos módulos alterados e whitespace verificados.
- Revisão independente concluída sem achados importantes pendentes. Ficha e rolagens agora compartilham o resolvedor de grupos de armas, preservando aliases antigos; o teste novo reproduziu a falha antes da correção.
- Fixture local compilou os templates reais de Resumo, Perícias e Características com todos os estilos do manifesto. Conferidos agrupamentos, 5 graus, sidebar, fontes locais, janela de 640 px e controles desabilitados sem propriedade (100 bolinhas e 5 recursos).
- Não foi validado o ciclo completo de eventos/atualização parcial em mundo Foundry ativo. A interface da árvore usa a progressão existente do Estilo de Combate; um construtor completo de ficha permanece fora desta implementação de layout.
- O checkout é compartilhado com outra conversa; parte das mudanças foi incorporada por ela durante a execução. Nenhum commit/stage global foi realizado nesta tarefa.
