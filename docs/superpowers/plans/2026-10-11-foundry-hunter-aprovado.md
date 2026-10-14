# Aplicar o layout Hunter aprovado na ficha Foundry 2.0

Objetivo: reproduzir a prévia aprovada no sistema instalado do Foundry, usando os dados, permissões e ações reais da ficha 2.0.

O usuário confirmou explicitamente que o destino é a ficha do Foundry. A alteração será aplicada no sistema instalado, sem modificar as regras ou a ficha 1.0.

- [x] Cabeçalho: retrato real do ator, nome, estilo, nível, descansos, Vida/Ferimentos, Energia/Refinamento, aura roxa original e Ações.
- [x] Corpo: atalhos e favoritos à esquerda; atributos persistentes acima das páginas; navegação por ícones à direita.
- [x] Resumo: métricas, Fulgor Negro, salvaguardas em bolinhas, identidade e grupos de perícias.
- [x] Preservar Perícias/Armas, Características/skill tree, Técnicas, Inventário, Efeitos e Biografia com os controles existentes.
- [x] Conferir renderizações parciais, abas inativas, permissões, rolagens e unicidade dos campos de recursos.
- [x] Executar os testes 2.0 existentes e verificar a composição visual com os templates reais e CSS carregado pelo Foundry.

Arquivos principais: `character-header-hunter-2.hbs`, `character-sidebar-hunter-2.hbs`, `character-tabs-hunter-2.hbs`, `character-summary-hunter-2.hbs`, `character-ability-scores-2.hbs`, `legacy2-sheet.mjs`, `legacy2-layout.mjs`, `character-sheet.mjs` e `jujutsu-hunter-approved-2.css`. O CSS novo é importado pelo endereço de estilo já carregado, `jujutsu-hunter-2.css`.

Validação: 21 testes de regras passaram; sete templates renderizados com Handlebars; montagem idempotente de partes e substituições parciais conferidas em DOM; campos sem duplicação; aura original idêntica; revisão encontrou e corrigiu a preservação das classes de rolagem dos favoritos. No navegador, todas as sete abas foram mantidas no DOM e apenas a ativa exibida. Navegação por clique e editor de biografia conferidos em fixture de 800 px. A verificação visual usa dados de teste e não a sessão de mestre, que já estava conectada em outro cliente.
