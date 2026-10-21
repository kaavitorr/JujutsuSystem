# Plano de Automação — Peculiaridades (2.0)

Auditoria das 27 peculiaridades do compendium com plano de automação por item.

## 1. Alavancas disponíveis hoje

| Alavanca | Mecanismo | Exemplo em uso |
|---|---|---|
| Efeito com chave de atributo | ActiveEffect (ADD/override) | condições de defesa no CR, atributos, `pvEspecie`, `energiaEspecie`, `actions.max` |
| Flags consumidas por código | `selosBonus`, `refinamentoBonus`, `energiaColossal`, `fulgorZona` | Energia Colossal, Estrutura Corporal |
| Pontos de Proficiência | `system.legacy2.pontos.extra` (+N no pool) | Concessão do Mestre |
| Escolhas de especialização | `system.legacy2.especiaisExtra` (+N escolhas) ou concessão direta (`conceder`) | botão Conceder (Mestre) |
| Exaustão | `system.attributes.exhaustion` (AE ou update) | condições/exaustão |
| Hooks já existentes | `combatStart`/`deleteCombat`, descansos dnd5e, `dnd5e.preRollDamage`/`rollDamage`, `applyDamage`, consumo de PA | Fulgor Negro, condições de dano |

## 2. Infraestrutura nova (construir uma vez)

1. **Convenção de chave**: cada peculiaridade ganha uma chave no item (`flags["jujutsu-system"].peculiaridade: "visoes-fugazes"`) e um helper `temPeculiaridade(actor, chave)` — mesmo padrão do `selosBonus`.
2. **Painel "Peculiaridade" na aba de Efeitos** (mesmo padrão das margens do Kokusen): mostra a peculiaridade ativa com seus contadores, botões do narrador e toggles.
3. **Contadores do narrador**: flags por ator com botões ± no painel, com reset automático (combate/descanso) conforme a regra.

## 3. Classificação por peculiaridade

### Onda 1 — só Active Effects / alavancas existentes (sem código novo)

| # | Peculiaridade | Penalidade (automação) | Benefício (automação) |
|---|---|---|---|
| 04 | Físico Limitado | CON máx 10 (override) · −1 PV Base (`pvEspecie` −1) | Energia Base +2 (`energiaEspecie` +2) · INT ou SAB +1 (grava no atributo escolhido) |
| 08 | Má Cicatrização | — (onda 3, ver abaixo) | +1 PV Base +1 Energia Base (`pvEspecie`/`energiaEspecie` +1) |
| 09 | Tremores Involuntários | — (onda 2) | Refinamento +2 (`refinamentoBonus` +2) |
| 14 | Energia Destrutiva | — (onda 2) | Energia Base +3 (`energiaEspecie` +3) |
| 17 | Reflexo Amaldiçoado | — (onda 3) | +1 PV Base (`pvEspecie` +1) · 2 especializações (especiaisExtra +2) |
| 18 | Sede de Sangue | — (aviso ao narrador, onda 3) | +1 PV Base +1 PRE (`pvEspecie` +1 · `abilities.pre.value` +1) |
| 24 | Destino Entrelaçado | — (narrador) | +2 PV Base +5 Energia Base (`pvEspecie` +2 · `energiaEspecie` +5) |
| 13 | Lembrete Sombrio | −1 em todos os d20 (AE nos modos `system.bonuses.rolls.*`) · gatilho −3 por 4h (toggle no painel) | SAB +1 · 2 especializações (especiaisExtra +2) |
| 01 | Visões Fugazes | contador do narrador (onda 3) | 1 especialização adicional (especiaisExtra +1) |
| 06 | Corpo Exaurido | — (onda 2) | +2 Pontos de Proficiência (`pontos.extra` +2) + 1 Energia Base (`energiaEspecie` +1) |
| 07 | Pesadelos Terríveis | — (onda 2) | imunidade a Amedrontado (guarda no toggle) + 4 degraus em Intimidação (AE `skills.intimidation` +4) |
| 19 | Olhar do Abismo | — (onda 3) | +3 Pontos de Proficiência (`pontos.extra` +3) + imunidade a Atordoado (guarda no toggle) |
| 26 | Caçador Sombrio | — (onda 3) | INT +1 (AE) + 2 degraus em Feitiçaria (AE `trainings.feitico` +2) + 2 especializações de Canalização de Energia (concessão restrita) |
| 22 | Voto Vinculativo | — (toggles do narrador, onda 3) | desbloqueia Energia Reversa + 3 especializações da árvore (concessão restrita) |
| 05 | Apetite Canibal | — (contador mensal, onda 3) | 1 especialização de Proezas Físicas (concessão restrita) |

### Onda 2 — código sobre hooks que já existem

| # | Peculiaridade | Automação da penalidade |
|---|---|---|
| 02 | Ferida Amaldiçoada | `combatStart` → 1d20 ≤ 10 aplica jj-incapacitado com duração de 3 rodadas; flag "já afetada" reseta no descanso longo |
| 06 | Corpo Exaurido | fim de combate → Salv. CON contra CD dinâmica (flag: 18, +5 por encontro, −5 por descanso longo, mín. 20); falha = exaustão +1 |
| 07 | Pesadelos Terríveis | pós-descanso longo → 1d20 ≤ 10 = exaustão +1 não removível (contador até 5) |
| 09 | Tremores Involuntários | sofrer crítico (aplicação de dano com origem crítica) → jj-estremecido até o fim do próximo turno, 1×/rodada |
| 12 | Azar Absurdo | 20 natural em d20 próprio → recupera Energia Total = INT (o 1 natural fica para o narrador) |
| 14 | Energia Destrutiva | uso de técnica → dano direto no PV igual ao custo em PA (hook no consumo de PA) |
| 16 | Rastro da Desgraça | margem de Excedente 8 (flag `excedenteReducao` −2 consumida pelo critério de excedente) · 1 natural → condição aleatória (tabela a definir) |
| 21 | Corpo Frágil | sofrer ataque comum → +1 dado; sofrer técnica → +1/3 dos dados (hook de aplicação) · imunidade à redução de PA das condições (filtro no mapa de modificadores por ator) |
| 25 | Doença Sobrenatural | crítico próprio → interrompe o dano automático e aplica jj-inconsciente até o fim do próximo turno (1×/descanso longo) · imunidade às condições de DANO (filtro em `aplicarCondicaoDano`) |
| 27 | Desejo Sombrio | botão "fim de sessão" → 1d6 ≥ 4 registra a manifestação (os 3 desejos ficam gravados em flags) + toggle −4 até cumprir |

### Onda 3 — complexos / centrados no narrador

| # | Peculiaridade | Por quê é complexa |
|---|---|---|
| 03 | Gêmeo Amaldiçoado | exige vínculo entre dois atores (metade de Energia/Refinamento para cada um) |
| 05 | Apetite Canibal | contador mensal acumulativo (−1/d20 por mês não saciado, trava em −1 quando impedido) |
| 08 | Má Cicatrização | reduzir cura por tipo (−2 dados · −CON/2 · −1/3 de cura grande) — hook na aplicação de cura |
| 10 | Presença Incômoda | −2 em interações sociais visíveis (definir quais testes são "interação") · +2 em Intimidação/Sobrevivência (modos numéricos) |
| 11 | Respiração Instável | rastrear PA gastos em movimento por turno (>3 = exaustão acumulável) |
| 15 | Voz Amaldiçoada | pool diário (1d20 guardado para substituir rolagens a 30 m) + escalada de CD do narrador |
| 17 | Reflexo Amaldiçoado | contador de Pontos de Reflexo (falha por 10+ ou 1 natural) + botão do narrador para forçar falha |
| 18 | Sede de Sangue | aviso quando o PV cruza <50% (as criaturas mudam de alvo por decisão do narrador) |
| 19 | Olhar do Abismo | checar ND do inimigo vs nível (Sab. CD 10+4/ND) + 1d4 por turno + limite de 3×/descanso |
| 20 | Maldição Descontrolada | maldição é NPC do narrador (ND 17) + 3 Pontos de Foco (novo recurso) + gastar 1 para negar condição |
| 22 | Voto Vinculativo | toggles do narrador (Letárgico 24h · −3 em d20) + 3 concessões restritas à Energia Reversa |
| 23 | Visão Deturpada | escolher 1 técnica (≥4 PA) e reduzir o custo em 1 permanentemente (edição no item) + escalada de CD |
| 26 | Caçador Sombrio | 1×/dia ao usar o feitiço inato → 1d12 = 1 soma Marca de Presa (5 marcas = alerta ao narrador) |

## 4. Decisões pendentes do autor

1. **"Habilidades de Especialização adicionais"** (01, 13, 17, 22, 26): conta como **escolha extra** (o jogador escolhe na árvore, via `especiaisExtra`) ou **concessão direita** (o Narrador escolhe a habilidade)? Sugestão: escolha extra.
2. **"Pontos de Proficiência em Intimidação/Feitiçaria"** (07, 19, 26): são **degraus diretos** na perícia/treino (fora do orçamento do pool) — confirmar.
3. **16**: existe tabela de custo em PA por condição para a "condição aleatória de até 7 PA"? Preciso da lista para o rolo.
4. **03**: os gêmeos serão dois atores ligados por flag (preciso de uma UI mínima de vínculo) ou fica manual?
5. **Imunidades a condições** (07 Amedrontado · 19 Atordoado · 25 DANO · 21 redução de PA): aplico como guardas no toggle/aplicador das condições (o jogador não consegue marcar) — confirmar.

## 5. Ordem sugerida de implementação

1. **Infraestrutura comum** (chave de peculiaridade + painel na aba de Efeitos).
2. **Onda 1** (14 benefícios por AE — rápido, sem risco).
3. **Onda 2** (10 automações por hook — o grosso do valor).
4. **Onda 3** (13 itens — por ordem de uso na mesa; vários podem ficar manuais com só o painel de contador).
