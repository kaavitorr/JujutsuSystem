# Capítulo 1 — Fundamentos (Jujutsu Legacy 2.0)

> Fonte: texto fornecido pelo autor (organizado sem alteração de regra).

## 0. Como o jogo se desenvolve

1. **O Narrador descreve o ambiente** — cenário, arredores e um escopo básico de opções.
2. **Os jogadores descrevem o que querem fazer** — cada Feiticeiro pode tomar um **Ponto de Ação** diferente; não é preciso agir em turnos fora do combate. O Narrador decide como resolver cada ação.
3. **O Narrador narra os resultados** — levando a outro ponto de decisão (volta ao passo 1).

Em combate a ação é mais estruturada, com turnos para escolher e resolver ações.

## 0.1 Dados de jogo

- Dados poliédricos: **d4, d6, d8, d10, d12, d20**; **d100** com dois d10 (dezenas × unidades; dois 0 = 100).
- Notação: `3d8 + 5` = role três d8, some, adicione 5.
- `1d3` = 1d6 ÷ 2 (arredondando para cima). `1d2` = 1 para ímpar, 2 para par.

### O d20
Usado para determinar sucessos/falhas em situações incertas (acertar um ataque, testes de atributo, salvaguardas).

**Passos de uma jogada com d20:**
1. Role o d20 e **adicione modificadores** (um Atributo correspondente e, em alguns casos, bônus de proficiência).
2. Aplique **bônus/penalidades circunstanciais** (características de combate, condições, outros efeitos).
3. Compare o total ao **Número-Alvo**:
   - Testes de Atributo/Salvaguardas → **Classe de Dificuldade (CD)**, definida pelo Narrador.
   - Jogadas de Ataque → **Classe de Resistência (CR)** do alvo.

### Vantagem e Desvantagem
- **Vantagem**: **+2** no resultado por vantagem, até **6 vantagens**.
- **Desvantagem**: **−2** por desvantagem, até **6 desvantagens**.
- Ex.: em desvantagem, um 17 no d20 vale 16; com vantagem, vale 18.

### Princípios gerais
- **O específico vence o geral**: Traços de Origem de Poder, Características de Combate, feitiços inatos/herdados, armas etc. podem introduzir exceções às regras gerais.
- **Arredondar para baixo**: qualquer divisão com fração arredonda para baixo (mesmo que a fração passe de metade).

## 1.2 Valores de Atributos

- Seis atributos: **Força, Agilidade, Constituição, Intelecto, Sabedoria, Presença**.
- Valor **mínimo 1**, **máximo 12** por atributo (2–3 = pessoa mediana; 12+ reservado a entidades sobrenaturais/feiticeiros incomparáveis).
- **Criação**: **20 Pontos de Atributo** distribuídos livremente; máximo **6** por atributo na criação, mínimo 1.
- **Progressão**: **+1 Ponto de Atributo** a cada subir de nível.
- Todos os testes são modificados por ao menos um atributo; valores também alimentam atributos secundários (Defesas, reservas de recursos).

### Estrutura simétrica
| Categoria | Físico | Mental |
|---|---|---|
| **Poder** | Força | Sabedoria |
| **Resiliência** | Constituição | Presença |
| **Rapidez** | Agilidade | Intelecto |

### Atributo 0 (casos raros)
Indica que a capacidade não se aplica à criatura:
- **Força 0**: incapaz de influência física; não pode possuir equipamentos, interagir com objetos nem realizar Ações exclusivamente físicas (FOR/CON/AGI).
- **Constituição 1** (menor citado): febril, ferimentos quase mortais. *(O texto não define CON 0.)*
- **Agilidade 0**: Iniciativa sempre 0; não pode realizar ações com marcador **Reação**.
- **Sabedoria 0**: não senciente; sem influência mental/espiritual; não pode realizar Ações exclusivamente mentais (SAB/PRE/INT).
- **Presença 0**: sem senso de identidade; não influencia nem é influenciado por outras mentes.
- **Intelecto 0**: incapaz de se concentrar ou tomar decisões rápidas.

### Papéis por atributo
- **Força** (Físico/Poder): potência, vigor muscular; Capacidade de Carga e armas que escalam com FOR.
- **Constituição** (Físico/Resiliência): robustez; **cada ponto de CON concede Vida adicional igual à base do Estilo de Combate** (ex.: Restringido base 7 → +7 PV por ponto).
- **Agilidade** (Físico/Rapidez): **Iniciativa**, **Classe de Resistência** e armas ágeis/à distância.
- **Sabedoria** (Mental/Poder): convicções, conhecimento, paciência.
- **Presença** (Mental/Resiliência): personalidade, inspiração, aura.
- **Intelecto** (Mental/Rapidez): velocidade de pensamento; influencia a **Iniciativa**.

## 1.3 Recursos

Recursos têm valor atual/máximo; mínimo sempre 0.

### Saúde: Vida e Ferimentos
- **Vida**: recurso temporário; começa no máximo e cai com dano.
- **Ferimentos**: recurso permanente; aumenta com lesões graves.
- Vida a **zero** → **Incapacitado** + começa a sofrer Ferimentos; **dano crítico** também causa Ferimentos.
- **Ferimentos máximos = 2 × Pontos de Vida**. Reserva de Ferimentos cheia → **Morto**.

### Capacidade de Ação
- **Pontos de Ação**: **6 pontos** por personagem; os seis são **recuperados no início do próprio turno** em combate.
- **Energia Amaldiçoada**: combustível de técnicas; com **0 Pontos de Energia** o personagem fica **indefeso** e sofre o **dobro de dano** de ataques com energia amaldiçoada.

### Recuperando recursos
- **Descanso Curto** (30 min): restaura **Vida completamente** + **10% da Energia Amaldiçoada total**; remove efeitos temporários de curta duração; **não reduz Ferimentos**; **até 5 vezes por dia**.
- **Descanso Longo** (8 h): restaura **Vida e Energia completamente**; reduz **Ferimentos em 20%**; remove efeitos de duração mais longa; só é possível **após 14 horas** do anterior.
- Em combate, Vida só é recuperada por habilidades de cura.

## 1.4 Defesa

### Classe de Resistência (CR)
Protege da maioria dos danos; mede a resistência geral a ataques físicos.

```
CR = 10 + (Atributo Principal + Agilidade + Constituição) / 3
```

- Se o **principal for Agilidade**: soma "Agilidade + Agilidade + Constituição".
- Arredondar para baixo (regra geral).

### Salvaguardas
- Uma por atributo; resistem a efeitos impossíveis de errar totalmente.
- **Cálculo (sem proficiência)**: `1d20 + Valor de Atributo − 4` — proficiência segue a progressão padrão (cap. 1.7).
- **CD** de efeitos/condições/técnicas em área:

```
CD = 10 + atributo principal do Estilo de Combate
```

| Salvaguarda | Uso típico |
|---|---|
| **Força** | efeitos puramente físicos: empurrões, quedas, esmagamentos |
| **Agilidade** | ataques em área que podem ser desviados; desequilíbrios |
| **Constituição** | ataques em área não-desviáveis (onda de choque); condições do corpo |
| **Intelecto** | efeitos de energia amaldiçoada e seu controle (feitiços) |
| **Sabedoria** | efeitos sobre a mente (confusão, alucinações não-químicas) |
| **Presença** | charmes, imposições de presença, ataques contra a alma |

## 1.5 Resistências e Vulnerabilidades

**12 tipos de dano**, cada um com Resistência/Vulnerabilidade correspondente e uma **Condição associada** (normalmente em Acerto Crítico):

| Grupo | Tipo de dano | Condição relacionada |
|---|---|---|
| Físico | Contundente | Atordoado |
| Físico | Perfurante | Sangrando |
| Físico | Cortante | Sangrando |
| Elemental | Veneno | Envenenado |
| Elemental | Ácido | Corroído |
| Elemental | Fogo | Queimando |
| Elemental | Frio | Congelando |
| Elemental | Eletricidade | Chocado |
| Elemental | Energia | Irradiado |
| Espiritual | Psíquico | Confuso |
| Espiritual | Alma | Entropia |

- **Resistência** (`+X`): reduz o dano daquele tipo (pode chegar a zero). Ex.: resistência +5 contra 13 de corte → 8.
- **Vulnerabilidade** (`−X`): aumenta o dano, **limitado ao dobro do dano base**. Ex.: vulnerabilidade −20 contra 7 de frio → 14.
- **Imunidade**: nunca sofre daquele tipo.
- **Aplicando a condição**: ao causar **20 natural** com um tipo de dano, o alvo faz **Salvaguarda de Constituição** (ou **Sabedoria** para Entropia e Confuso) para não receber a condição pelo número de rodadas do Cap. 8.3.
- **Remover condição**: consumir **2 Pontos de Ação** com a ação "Remover" + **Teste de Sabedoria (Medicina)**.
- A maioria das criaturas resistentes a um tipo é vulnerável a outro.

## 1.6 Perícias

Evoluem quando o personagem seleciona um **Talento de Perícia**; alguns são concedidos pelo **Antecedente** na criação.

### Exploração
| Perícia | Atributo | Descrição |
|---|---|---|
| **Atletismo** | Força | escalada, corrida, natação, feitos físicos |
| **Coordenação** | Agilidade | parkour, gazua, desafios de destreza |
| **Percepção** | Sabedoria | notar, interpretar sentidos, reagir a ameaças |
| **Furtividade** | Agilidade | esconder-se, mover-se em silêncio, disfarces |
| **Sobrevivência** | Sabedoria | abrigo, água, alimento, ambientes hostis |

### Conhecimento
| Perícia | Atributo | Descrição |
|---|---|---|
| **Feitiçaria** | Intelecto | estudo da energia amaldiçoada e dos feitiços |
| **Medicina** | Sabedoria | corpo, enfermidades, tratamento de ferimentos/doenças |
| **Investigação** | Sabedoria *ou* Intelecto | pistas, dedução (INT puxa para lógica) |
| **História** | Intelecto | pesquisa, passado, sociedades, lore |
| **Sobrenatural** | Sabedoria | mitos, espíritos amaldiçoados, entidades |

### Influência
| Perícia | Atributo | Descrição |
|---|---|---|
| **Enganação** | Presença | mentir, falsificar, perceber mentiras |
| **Persuasão** | Presença | convencer, retórica, apelos emocionais |
| **Intimidação** | Presença | medo, domínio, submissão |
| **Atuação** | Presença | música, dança, narrativa, arte |
| **Sorte** | Presença | conceito esotérico; inclina probabilidades ao favor |

## 1.7 Progressão de Proficiência

Perícias, **Armas** e **Salvaguardas** compartilham a mesma escada de 5 degraus:

| Bônus | Grau | Escala |
|---|---|---|
| −4 | **Destreinado** | habilidade de pessoa comum sem educação/treinamento |
| 0 | **Treinado** | treinamento nas práticas básicas e comuns |
| +1 | **Proficiente** | treinamento avançado; conhece princípios menos comuns |
| +2 | **Especialista** | além do treinamento profissional; só resta aperfeiçoar |
| +3 | **Mestre** | domínio completo; nada mais a aprender |

- Destreinado sofre **−4 em todas as rolagens** daquela estatística.
- **Pontos de Proficiência**: os **Estilos de Combate** concedem pontos **na criação e ao subir de nível** (a quantidade destinada a cada lugar é definida pelo Estilo). Além disso, **+1 Ponto de Proficiência** por subir de nível.
- Aplicáveis a: **Armas, Perícias, Salvaguardas**.

---

## Notas de implementação (não fazem parte das regras)

- Skills da 2.0 **substituem** a lista dnd5e (16 perícias próprias, com Investigação dual-attribute e a inédita Sorte).
- Tipos de dano "Energia" e "Alma" são novos (CONFIG de dano + condições associadas).
- **Ferimentos** (2×PV) e **Pontos de Ação** (6/turno) são recursos novos; descansos têm regras próprias (ver divergências-implementacao.md).
