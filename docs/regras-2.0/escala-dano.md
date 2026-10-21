# Escala de Dano de NPC (2.0)

Toda arma de NPC é configurada dentro da escala: os **dados de dano saem da
linha do ND do atacante** e o "+ atributo" é o valor do atributo selecionado
do ataque (o `@mod` dos cards, mesma convenção do bônus de acerto).

| ND | Dano | ND | Dano | ND | Dano |
|----|------|----|------|----|------|
| 0 a 1 | 1d4 + atributo | 11 | — | 21 | — |
| 2 | 1d6 + atributo | 12 | 3d6 + atributo | 22 | 3d12 + atributo |
| 3 | — | 13 | — | 23 | — |
| 4 | 1d8 + atributo | 14 | 2d10 + atributo | 24 | 3d12 + atributo |
| 5 | — | 15 | — | 25 | — |
| 6 | 1d10 + atributo | 16 | 3d8 + atributo | 26 | 5d8 + atributo |
| 7 | — | 17 | — | 27 | — |
| 8 | 1d12 + atributo | 18 | 3d10 + atributo | 28 | 4d12 + atributo |
| 9 | — | 19 | — | 29 | — |
| 10 | 2d8 + atributo | 20 | 4d8 + atributo | 30 | 5d10 + atributo |

## Como o sistema aplica

- **ND ímpar** cai na linha do **par anterior** (ND 11 usa a linha do 10, ND 25
  a do 24). ND acima de 30 usa a última linha; ND 0–1 usa `1d4`.
- A tabela canônica é [`module/systems/escala-dano.mjs`](../../module/systems/escala-dano.mjs):
  `ESCALA_DANO`, `linhaEscalaDano(nd)` e `formulaEscalaDano(nd, { atributo })`.
- `Ruleset.escalaDano(nd)` / `Ruleset.formulaEscalaDano(nd, { atributo })`
  delegam para o módulo.

## Como configurar uma arma de NPC

No dano da arma, use **`@escala + @mod`**. O rolldata de ataques de NPC resolve
`@escala` com a linha do ND do ator (`AttackActivity#getRollData`), e `@mod`
é o atributo selecionado no ataque. Exemplo: NPC ND 9, atributo FOR 12 →
`1d12 + 12`.

Personagens não recebem `@escala` no rolldata (a escala é exclusiva de NPC).

## Ataques Naturais

O compêndio **JLRPG - Equipamentos PdN** (`jujutsu-compendium.equipamento-pdn`, módulo jujutsu-compendium)
traz as armas naturais de NPC já configuradas com dano na escala:

- **16 partes base** (Galhada, Bico, Mordida, Garras, Presas, Punhos, Cascos,
  Chifres, Pseudópode, Pinças, Farpas, Ferrão, Cauda, Unhas, Tentáculos,
  Espinhos): as 13 simples custam **1 Ponto de Ação**; **Mordida, Chifres e
  Ferrão** têm o modificador **"+1 dado de dano a cada 4 ND"** (rolldata
  `@escalaExtra`, mesmo tipo de dado da linha da escala) e custam **2 Pontos
  de Ação**.
- **9 Mordidas Elementais** (Flamejante, Caustica, Carregada, Frigida,
  Estrondosa, Psíquica, Radiante, Venenosa, Sombria): dano do elemento e a
  condição **aplicada ao atingir** (efeitos aplicados da activity). Herdam o
  dado extra e custam 2 PA.
- **135 Membros Elementais** (15 partes × 9 elementos, organizados em pastas
  por elemento): o dano é do elemento, mas a condição **não** é garantida —
  ela acontece **apenas em acerto crítico de 20 natural** (ou Fulgor Negro),
  quando o alvo faz a Salvaguarda da condição 8.3 (Constituição; Sabedoria
  para Entropia e Confuso). O tipo `soul` (Alma) dispara a Entropia, igual ao
  necrótico. Herdam o custo e o dado extra da parte original.

A fonte editável fica em `packs/_source/ataques-naturais.json` e o macro de
(manutenção)/importação em `packs/_source/importar-ataques-naturais-macro.txt`.

## Armaduras Naturais

A pasta **Armaduras Naturais** do mesmo compêndio traz as 23 armaduras da
tabela (itens `equipment`, tipo `natural`), com automação por efeitos
equipáveis:

- **Classe de Resistência**: cada armadura soma `base + atributo` ao CR
  (`system.attributes.ac.bonus`, ADD) — o mesmo caminho que o cálculo de CR de
  NPC já respeita. Ex.: Carapaça Pesada → `13 + @abilities.str.mod`.
- **Casca**: +3 de Resistência a dano Contundente
  (`system.legacy2.resistances.bludgeoning.value` ADD 3).
- **Ossada**: imunidade a Perfurante (`...piercing.immune` override "true") e
  Vulnerabilidade 10 a Contundente (`...bludgeoning.value` ADD −10).
- **Armadura Elemental, Membrana Fina e Placas Cristalizadas** têm retorno de
  dano ao atacante (espinhos) registrado nas flags
  (`thorns: { tipo, atributo/tipoDano }`) — a automação desses três casos é
  feita em código, e ainda não está implementada.
