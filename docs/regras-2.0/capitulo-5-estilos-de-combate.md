# Capítulo 5 — Estilos de Combate (Jujutsu Legacy 2.0)

> Fonte: texto fornecido pelo autor (organizado sem alteração de regra).
> Implementado no compendium **"Geral - 2.0"** (itens de Classe).

## Estilos de Combate

O Estilo de Combate é a principal definição das habilidades e da abordagem de
um personagem no jogo, moldando como ele percebe e interage com o mundo, além
de influenciar seu relacionamento com outras pessoas. Cada Estilo oferece
características especiais — proficiências e habilidades únicas — concedidas
aos poucos nos primeiros níveis e aprimoradas conforme a evolução.

| Categoria | Pontos de Vida | Atributo Principal |
|---|---|---|
| Restringido | 7 | Força ou Agilidade |
| Lutador | 7 | Força ou Agilidade |
| Sentinela | 6 | Agilidade |
| Especialista | 5 | Intelecto |
| Estrategista | 4 | Sabedoria |

### Salvaguardas
Cada categoria concede proficiência em Salvaguardas, permitindo que o jogador
receba duas opções. Ao escolher sua categoria, você ganha proficiência
permanentemente nos atributos listados ao realizar a rolagem de Salvaguarda dele.

### Pontos de Vida
Cada Estilo de Combate concede um valor base de Pontos de Vida, recebido
adicionalmente a cada vez que o personagem sobe de nível ou aumenta seu valor
de Constituição.

### Pontos de Proficiência
Você recebe **1 Ponto de Proficiência** toda vez que sobe de nível,
permitindo aumentar sua proficiência em um conjunto de armas ou em uma
perícia específica.

### Lança e Escudo
Você aprendeu a utilizar sua energia amaldiçoada para aumentar o dano de seus
ataques e reduzir os golpes inimigos. Você recebe acesso às seguintes
características:

- **Explosão Ofensiva**: ao realizar uma jogada de ataque (Comum ou de
  Técnica), gaste **1 PA** para adicionar **1d4** de dano adicional, até um
  máximo igual a **metade do seu nível** (arredondado para baixo).
- **Explosão Defensiva**: gaste **1 PA** para reduzir **1d4** do próximo dano
  sofrido, até um máximo igual a **metade do seu nível** (arredondado para baixo).

### Habilidades de Especialização
A cada **nível par**, você recebe **2 habilidades de especialização** do
Capítulo 6. Existem 4 categorias: **Técnica Inata, Físico Treinado, Técnicas
de Barreira e Técnica de Reversão**. Um personagem deve seguir a progressão
de cada especialização para avançar como Feiticeiro.

### Calculando a Classe de Resistência e o Dano
- **CR (sem armadura)** = `10 + (atributo principal + agilidade + constituição) / 3`
  (fração arredonda para baixo).
- **Dano Padrão = 1d4**, a menos que uma habilidade altere o dado base.
  Aumenta **um passo a cada 4 níveis**, máximo **1d12**:
  `1d4 → 1d6 → 1d8 → 1d10 → 1d12`.

### Tabela de Nível de Maestria
| Nível | Feiticeiro | Evolução do Feitiço |
|---|---|---|
| 1º | 4º Grau | Feitiço Básico |
| 2º | — | — |
| 3º | — | — |
| 4º | 3º Grau | Feitiço Estendido |
| 5º | — | — |
| 6º | — | — |
| 7º | 2º Grau | — |
| 8º | — | Feitiço Máximo |
| 9º | — | — |
| 10º | 1º Grau | Expansão de Domínio |
| 11º | — | — |
| 12º | Especial | — |
| 13º | — | — |
| 14º | — | — |
| 16º | — | Expansão sem Barreiras |

---

## 5.3 Escolhendo seu Estilo de Combate

*(Textos completos de cada estilo vivem nos itens de Classe do compendium
"Geral - 2.0" — ver `utils/geral-2-0.mjs`, fonte geradora dos YAML.)*

### Restringido
- **Vida**: base 7 por nível; 7 por ponto de Constituição.
- **Proficiências**: 4 pontos entre armas; 3 pontos entre Salvaguardas;
  4 pontos entre Perícias (exceto Feitiço).
- **Principal**: Força ou Agilidade (à escolha). **Especialização**: 1
  habilidade de "Proeza Física".
- **Equipamentos**: arma amaldiçoada de 4º grau; óculos/lentes que veem
  energia amaldiçoada; ¥ 5.000.
- **Arsenal Vazio**: Espírito com "Inventário" (9 níveis para amadurecer;
  armazena 10 ferramentas; não sofre dano/não é alvo junto ao corpo).

**VAZIO DE ENERGIA**: imune ao acerto garantido de Expansões de Domínio;
imune a "Sentir Maldição"; atravessa livremente domínios/barreiras;
proficiência **Mestre** em Atletismo e Coordenação; **4 + CON em Pontos de
Estamina (PE)** (recuperados no início de cada turno; a partir do 10º nível,
8 + atributo). Não se beneficia de Manipulação de Energia nem de
Especializações de Feiticeiro.

**FÍSICO PERFEITO**: **Gênio Marcial** (5 PT → cria técnica de até 7º grau);
**Metabolismo Extremo** (longo 2 h, curto 5 min); **Impulso Físico** (1 PE →
+2d4 dano ou reduz dano sofrido, máx meio nível); **Sentidos Extremos**
(Sentido Verdadeiro 36 m).

### Lutador
- **Vida**: base 7; 7 por CON. **Energia**: base 10 por nível.
- **Proficiências**: 2 pontos em armas; 2 em Salvaguardas; 3 em Perícias.
- **Principal**: Força. **Especialização**: 2 habilidades de "Proeza Física".
- **Equipamentos**: arma marcial ou ¥ 3.000; ¥ 5.000.

**GUERRILHEIRO** — especializa-se em armas OU desarmado:
- **MESTRE DAS ARMAS**: Maestria (2 pontos num tipo de Ferramenta
  Amaldiçoada); Imbuir Feitiço (a cada 5 níveis com a mesma arma, evolui 1
  grau); Arma Favorita (Mestre numa ferramenta específica por level-up);
  **Posições de Combate** (troca por 1 PA, usável como Reação): Defensiva
  (+2 CR, +2 engajamento até Totalmente Engajado) / Ofensiva (+5 m
  deslocamento, +1 dano por grau de proficiência: Treinado +1 … Mestre +4);
  **Sentinela** (Reação, 1 PA, máx 3/rodada: ataque contra quem mirar você ou
  aliado, movendo até 3 m antes).
- **PUNHO ARDENTE**: Golpe Brutal (dano máximo/crítico → ataque adicional com
  custo −1 PA); Interceptar (2 PA como Reação em erro contra você → arremessa
  ao chão, Caído se falhar Salvaguarda AGI, Estremecido se levantar cedo);
  Mãos Letais (ataques desarmados usam propriedades de arma marcial, troca por
  nível); Corpo Forjado (resistência +5 a Contundente/Cortante/Perfurante).

### Sentinela
- **Vida**: base 6; 6 por CON. **Energia**: base 10 por nível.
- **Proficiências**: 3 em armas; 3 em Salvaguardas; 5 em Perícias.
- **Principal**: Agilidade. **Especialização**: 2 de "Novo Estilo das Sombras".
- **Equipamentos**: ferramenta amaldiçoada de 4º grau; ¥ 5.000.

**PECULIARIDADES**: perito do Novo Estilo das Sombras; mesmo com feitiço
inato, é **incapaz de usá-lo em combate**.

**DOMÍNIO DO SENTINELA**: Aprendizado Focado (especialização adicional a cada
nível par); Forma Dominada (aprende "Domínio Simples"): 2×/rodada ataque
(Comum) como Reação com custo −1 PA (gatilho: ação de criatura no alcance);
ao atacar, **ignora até 10 Pontos de Resistência** do inimigo.

### Especialista
- **Vida**: base 5; 5 por CON. **Energia**: base 15 por nível.
- **Proficiências**: 1 em armas; 2 em Salvaguardas; 3 em Perícias.
- **Principal**: Intelecto. **Especialização**: 2 de "Feitiço Inato".
- **Equipamentos**: arma cortante/especial ou ¥ 3.000; ¥ 8.000.
- **Criação rápida**: atributos altos em INT e CON; origem Anomalia (Corpo
  Amaldiçoado, Feto Amaldiçoado, Receptáculo) ou Feitiço Inato/Linhagem
  Herdada; talentos de Acrobacia, Feitiço, Intuição, Percepção, Sobrenatural.

**MANIPULAÇÃO DE FEITIÇO**: ao executar feitiço/técnica de manipulação (por si
ou por Shikigami), recebe **2 Dados de Técnica (d6)** — máx
**1 + bônus de proficiência**; gaste-os no turno por: **Aprimoramento** (soma
ao dano, antes de saber acerto), **Regenerar Maldição** (cura Shikigami) ou
**Ativação Secundária** (reduz custo da técnica). +1 especialização de
Feitiço Inato imediata.

### Estrategista
- **Vida**: base 4; 4 por CON. **Energia**: base 15 por nível.
- **Proficiências**: 2 em armas; 2 em Salvaguardas; 5 em Perícias.
- **Principal**: Sabedoria. **Especialização**: 1 de "Feitiço Inato".
- **Equipamentos**: arma cortante/especial ou ¥ 3.000; ¥ 8.000.

**AMALDIÇOADO COM CONHECIMENTO**: rolar **1 natural** no d20 → re-roll e usa o
novo resultado; cria barreiras gastando da reserva **Total** sem consumir o
Refinamento. Escolha uma especialização:
- **MESTRE DE BARREIRAS**: 3 habilidades de Barreira; barreiras ganham +2 PV
  por PA gasto na criação.
- **MÉDICO DE CAMPO**: desbloqueia **Energia Reversa** + 1 especialização
  dela; técnicas de dano custam **+1 PA**; limite de Energia Reversa
  **30 → 60**.
