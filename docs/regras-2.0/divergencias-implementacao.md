# Divergências — implementação atual × regras do Capítulo 1

> Onde a camada 2.0 já implementada difere do que o texto de regras define,
> ou precisa ser estendida quando o compendium for construído.
> Cada item vira tarefa (ou correção) na ordem em que o compendium avançar.

## Perícias — SUBSTITUIR a lista (impacto alto)

A 2.0 tem **16 perícias próprias**; o dnd5e usa outra lista. É preciso trocar
`CONFIG.DND5E.skills` (só no modo 2.0) e mapear as chaves:

| Nova perícia | Atributo | Nota |
|---|---|---|
| Atletismo | FOR | já existe |
| Coordenação | AGI | nova (subpapel de destreza) |
| Percepção | SAB | já existe |
| Furtividade | AGI | já existe (stealth) |
| Sobrevivência | SAB | já existe |
| Feitiçaria | INT | nova |
| Medicina | SAB | já existe |
| Investigação | SAB **ou** INT | dual-attribute (selecionável) |
| História | INT | já existe |
| Sobrenatural | SAB | nova |
| Enganação | PRE | já existe (deception) |
| Persuasão | PRE | já existe |
| Intimidação | PRE | já existe |
| Atuação | PRE | já existe (performance) |
| Sorte | PRE | nova |

Consequências em cascata: `prepareSkills`, antecedentes/talentos de perícia
(compendium), tooltips e a aba Detalhes 2.0.

## Recursos — Ferimentos e Pontos de Ação (novos)

- **Ferimentos**: reserva permanente, **máx = 2×PV**; Vida a 0 → Incapacitado +
  ferimentos; dano crítico → ferimento; cheia → Morto. Descanso longo reduz 20%.
- **Pontos de Ação**: **6/turno**, recuperados no início do turno — não é o
  sistema de Ação/Bônus/Reação atual do dnd5e (ação econômica nova).
- **Energia 0 = indefeso + dobro de dano de energia** (gatilho a implementar).

## Descansos — regras próprias da 2.0

- **Curto** (30 min): Vida **completa** + **10% da Energia total**; máx **5/dia**; não reduz Ferimentos.
- **Longo** (8 h; nova tentativa só após 14 h): tudo completo; **−20% Ferimentos**.
- Diverge do fluxo atual (dado de vida/energia) — precisa branch próprio no rest
  quando `isV2()`.

## Classe de Resistência — detalhe faltante

Regra: se o **principal for Agilidade**, soma AGI+AGI+CON.
`Ruleset.resistanceClass` hoje soma `principal+AGI+CON` simples → **corrigir**
(duplicar AGI quando `atributoPrincipal === "dex"`).

## CD — regra confirmada

```
CD = 10 + atributo principal do Estilo de Combate
```
Aplicar às salvaguardas de técnicas quando `isV2()` (hoje usa fórmula 1.0).

## Proficiência — pontos vêm do Estilo

`Ruleset.trainingPointsTotal` usa `CONFIG.JUJUTSU.trainingPoints.criacao` +
1/nível + extra. As regras dizem: **o Estilo de Combate define os pontos
concedidos na criação e por nível** (+1 genérico por nível) → o pool passa a
ler o Estilo do compendium quando existir.

## Tipos de dano — adicionar "Energia" e "Alma"

CONFIG de dano 2.0 + condições associadas (Irradiado, Entropia etc.) e o
gatilho de **20 natural → condição** (Salvaguarda CON; SAB para
Entropia/Confuso). Ação "Remover" (2 PA + Teste de SAB/Medicina).

## Espíritos — confirmado e já implementado

PV = 20×ND×categoria; vida = energia (hook `vida-energia.mjs`). Alinhar o
texto final do capítulo de NPCs quando chegar.

## Já alinhado (sem ação)

- Escada −4/0/+1/+2/+3 e bolinhas ✓
- Vantagens ±2 até 6 ✓ (falta UI de steppers no diálogo)
- Flanqueamento estilo Crucible, 1 grau = 1 vantagem ✓
- Atributos 1-12 direto no d20, sem modificador ✓
- Sem dados de Vida/Energia ✓ (Dice Row sai da ficha 2.0)
- CR base `10 + (principal+AGI+CON)/3` arredondado p/ baixo ✓ (exceto AGI principal, acima)
- Arredondar para baixo em divisões ✓ (fórmulas usam floor)
- CD = 10 + principal ✓ (pendente aplicar nas técnicas)


## Capítulo 2 — Combate (novo material a implementar)

### Energia 2.0 — REWORK do sistema de PA (impacto alto)
Modelo 2.0 ≠ modelo 1.0 (total/generated + geração por turno):
- **Energia Total** = único reservatório (o "PA Gerado" da 1.0 não existe na
  2.0); **Máxima** = teto; **Refinamento = 2 × nível** (cap de gasto/rodada).
- **Acúmulo**: +1 de Refinamento por ação sobressalente da rodada anterior;
  5+ ações sobrando dobram o Refinamento do turno. (Substitui o fluxo de
  "gerar energia"/Acúmulo de Energia nv5 da 1.0.)
- Início de combate: pode usar até o Refinamento (surpreso: metade).
- Energia 0 → condição **Energia Esgotada** (e cap. 1: indefeso + dobro de
  dano de energia).
- Sidebar 2.0, diálogos (Explosão Ofensiva/Escala/generação) e hooks
  (preActivityConsumption, jj-scale, native-cards) precisam do novo modelo.

### Iniciativa 2.0
`1d20[±vantagens] + ((AGI + INT) / 2)`; **Reservas de Ação** (PA não gastos)
dão +1 vantagem cada na iniciativa da rodada seguinte; **iniciativa dinâmica**
(re-roll por rodada, recomendada) como opção de setting; Incapacitados/Mortos
= 0; Desatentos = 1; desempate documentado.

### Ações por Pontos de Ação (economia nova)
6 PA/turno; tabela geral: Ataque 2 · Ataque Reativo 1-2 · Remover 2 ·
Técnicas 1-6 · Esconder/Procurar/Interagir 1. Substitui ação/bônus/reação do
dnd5e — impacto no HUD, activities e custos de activity.

### Crítico/Falha crítica por margem
Crítico: 20 natural **ou** CR+10; Falha crítica: 1 natural **ou** CR−10
(permite Ataque Reativo do inimigo). Crítico rola os dados de dano **uma
segunda vez** (não dobra o total). Ajustar regra de crit da 1.0 (hoje
"Excedente" CA+10) quando isV2().

### Fulgor Negro 2.0 — diverge do implementado na 1.0
Gatilho: 20 natural → rola 1d20 (15+ ativa a primeira); depois disso todo
20 ativa; dano ×2,5 ceil sobrepondo o crítico; cada tentativa falhada amplia
a margem em 1 até ativar (reseta após). **Zona**: dobra dados da Explosão
Ofensiva, +3 vantagens em ataques, +2 CR (≠ +5 de ataque da 1.0). Portar no
fulgor-negro.mjs quando isV2().

### Flanqueamento — refinamentos do capítulo
Condição **Flanqueado** por níveis (cada nível = +1 vantagem CAC contra o
alvo) ✓ (grau = vantagem já implementado). Engajamento base: **personagens
2**; **adversários 1 + 1 por tamanho acima de Médio** — ajustar a
capacidade fixa por tamanho em flanking.mjs. Desengajamento dispara **Ataque
Reativo** (depende do sistema de Reações/PA).

### Movimento, cobertura e posições (futuro)
Grade 1 m, movimento gratuito 10 m, tipos de movimento ×2, terreno difícil,
cobertura (+1/+3/+5 desvantagens, área ignora), colisão, movimento forçado —
provavelmente custom canvas/activity; registrar como milestone próprio.

### Feridas (2.10) — refino do Ferimentos da 1.x
"20 PV base" citado no texto (reconciliar com cap. 1 — PV por estilo).
Dano crítico → metade (ceil) em feridas; dano a partir de 0 PV → direto nas
feridas; cheias = morte.

### Iniciativa (2.1) — implementada
Iniciativa = 1d20 [Vantagens] + ((AGI + INT) / 2). Soma ímpar arredonda para
BAIXO (o texto não define; convensão d20). Proficiência/alerta/bônus do 1.0
fora da fórmula. Reservas de Ação (cada PA não gasto = +1 vantagem na
iniciativa da rodada seguinte) depende da economia de PA — pendente.
