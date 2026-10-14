# Resistências numéricas 2.0

Pedido aprovado: painel compartilhado nas fichas de jogador/NPC, visual mangá/persona/jujutsu, com Contundente, Perfurante, Cortante, Veneno, Ácido, Fogo, Frio, Eletricidade, Energia, Psíquico e Alma. Campo numérico e imunidade explícita por tipo; chaves para automação.

Regra esclarecida pelo usuário: resistência +5 transforma 13 em 8; vulnerabilidade −20 transforma 7 em 14 (teto de dobro do dano base); imunidade zera o dano. Agrupar partes do mesmo tipo antes de aplicar resistência. Cura e dano não tipado não ganham um tipo por suposição. Resistências/imunidades/vulnerabilidades/modificações antigas ficam dormentes na 2.0, preservadas na 1.0.

1. Campos persistentes `system.legacy2.resistances.<tipo>.value` e `.immune`, padrões 0/false e compatibilidade com atores antigos. Usar `radiant` para Energia, `lightning` para Eletricidade e registrar `soul` para Alma.
2. Painel reutilizável no Resumo, com estados positivo/negativo/imune, edição nativa e chaves de atributos acessíveis; retirar controles antigos da apresentação 2.0.
3. Aplicação no cálculo nativo e nos cards especiais, preservando dano separado por tipo, imunidade, limite de vulnerabilidade, ignorar defesas e modo 1.0. Extras de dano herdam o tipo principal selecionado.
4. Testes com exemplos do usuário, partes repetidas/mistas, imunidade, fontes/effects, salvamento e versão 1.0; renderização e revisão independente.
