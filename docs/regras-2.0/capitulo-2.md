# Capítulo 2 — Combate (Jujutsu Legacy 2.0)

> Fonte: texto fornecido pelo autor (organizado sem alteração de regra).
> *Nota de organização: a numeração original do texto pula e repete trechos
> (dois "2.3", salto 2.6→2.9); foi preservada a ordem do conteúdo.*

## 2.1 Iniciativa e Ordem de Turno

A Iniciativa representa a rapidez mental/física do personagem. No combate é
determinada por Agilidade e Intelecto, bônus passivos de Iniciativa, bônus
situacionais e um elemento de aleatoriedade.

### Rodadas e Turnos
- **Rodada**: ciclo completo de ações de todos os envolvidos; ≈ **6 segundos** (10 rodadas ≈ 1 minuto).
- **Turno**: momento em que um único personagem age, conforme sua Iniciativa.

### Calculando a Iniciativa
```
Iniciativa = 1d20 [Vantagens, Desvantagens] + ((Agilidade + Intelecto) / 2)
```

### Reservas de Ação
Pontos de Ação não utilizados ao final da rodada viram **Reservas de Ação**
(se não estiver Imobilizado/Incapacitado). **Cada Reserva de Ação concede 1
vantagem** à rolagem de Iniciativa da rodada seguinte.

### Iniciativa Fixa e Dinâmica
- **Fixa**: rola uma vez no início do encontro (mais rápido, menos caos).
- **Dinâmica** *(recomendada)*: todas as iniciativas são roladas novamente
  de forma automática no início de cada rodada.

### Modificadores de Iniciativa
- **Incapacitados/Mortos**: Iniciativa **0** (agem por último).
- **Desatentos (surpresos)**: agem na Iniciativa **1**; a condição é removida
  no início do próprio turno, que então rola Iniciativa normalmente.
- **Desempate**, em ordem: (1) maior bônus passivo de Iniciativa; (2) maior
  quantidade máxima de Pontos de Ação; (3) adversários antes de jogadores;
  (4) ordem alfabética.

## 2.2 Ações

- **Custo de Ação**: a maioria das Ações custa Pontos de Ação.
- **Custo de Energia Amaldiçoada**: algumas Ações custam PA.
- **Palavras-chave (Marcadores)**: descrevem pré-requisitos, alvo, tipo de
  dano, rolagem, vantagens/penalidades etc.
- **Tipo de Alvo**: ver lista abaixo.
- **Escopo do Alvo**: "Todas as Criaturas", "Somente Aliados", "Somente
  Inimigos", "Somente Você", "Nenhum".
- **Condição de Ativação**: pré-requisito indicado na Ação (ex.: Ataque
  Violento — "a criatura tentar sair do seu alcance").
- **Efeitos Aplicados**: efeitos ativos com duração em **rodadas**; alguns
  ilimitados até removidos.

### Tipos de Alvo
| Tipo | Regras |
|---|---|
| **Esfera** | área circular com **Tamanho** (raio) e **Distância** (alcance do centro) |
| **Cone** | cone estreito de **55°**, origina-se no usuário; rotação em incrementos de **15°** |
| **Emanação** | área circular centralizada no usuário (raio = Distância) |
| **Raio** | linha reta a partir do usuário (comprimento = Distância) |
| **Pessoal** | afeta apenas o usuário; sem alcance |
| **Alvo Único** | **Número** de criaturas individuais + **Distância** |
| **Muralha** | linha perpendicular ao usuário; **Tamanho** (largura) + **Distância** |
| **Invocação** | invoca criaturas em área retangular próxima |
| **Movimento** | deslocamento; resolvido pela distância percorrida |
| **Nenhum** | efeito sem direcionamento |

## 2.3 Movimento

Grade detalhada de **1 metro**. **Sem direção/orientação**: o token percebe e
age em 360° salvo efeito/condição.

### Custo do movimento
- Distância medida **centro a centro**; **diagonais custam o dobro**.
- **Distância Efetiva** aplica modificadores nesta ordem: **Condições de
  Estado → Terreno → Tipo de Movimento**.
- **Movimento Gratuito**: **10 m por turno**; a cada **5 m adicionais**, custo
  de **1 ação**.

### Condições de movimento
| Condição | Efeito |
|---|---|
| **Lento** | cada 1 m consome 1 m adicional |
| **Acelerado** | cada 2 m consomem apenas 1 m |
| **Contido** | movimento impossível |

### Tipos de movimento
| Tipo | Distância Efetiva | Notas |
|---|---|---|
| **Caminhar** | normal | — |
| **Passo** | ×2 | movimento cuidadoso |
| **Rastejar** | ×2 | enquanto Caído |
| **Saltar** | ×2 | necessário para certas ações/obstáculos; nunca é bloqueado |
| **Escalar** | ×2 | superfícies verticais |
| **Nadar** | ×2 | água na cintura ou mais funda |
| **Voar** | mais rápido | termina voando → condição **Voando** |
| **Teleporte** | ignora terreno/custos | nunca é bloqueado |
| **Escavar** | ×2 | passa sob paredes/criaturas; termina escavando → condição **Escavando** |

### Movimento Gratuito por rodada
A primeira Ação da rodada com o marcador **Movimento** recebe **−1 no custo**
(normalmente gratuita). Indisponível para criaturas **Enfraquecidas, Caídas
ou Lentas**; equipamentos pesados removem, salvo o talento **Eficiência com
Armadura**.

### Terreno
**Terreno Difícil**: cada metro atravessado consome 1 m adicional.

### Colisão entre criaturas
Criaturas bloqueiam movimento (aliadas ou inimigas); mortas e em elevações
diferentes (voando/escavando) não bloqueiam. Pode tocar/sobrepor
parcialmente a borda, nunca atravessar completamente.

### Movimento Forçado
Sem Custo de Ação e não consome o Movimento Gratuito; executado pela Ação
causadora no momento do impacto; **não atravessa paredes nem criaturas**;
deslocado além de uma borda, **Cai**.

### Quebrando o deslocamento
Pode-se dividir o deslocamento antes/depois de ações no turno — e **entre
ataques** de um mesmo Ponto de Ação.

### Cobertura
Aplicável quando um ataque direto a alvo único atravessa obstáculos:

| Tipo | Penalidade |
|---|---|
| **Total** | ataques diretos impossíveis |
| **Pesada** | +5 desvantagens |
| **Pesada Parcial** | +3 desvantagens |
| **Macia ou Leve** | +1 desvantagem |

Ataques de área (**Cone, Raio, Emanação**) **ignoram** Cobertura.

### Bloqueando movimento
Forçar passagem: **Teste de Atletismo** do invasor contra a **Constituição**
de quem bloqueia. **Saltar** e **Teleporte** nunca são bloqueados.

### Engajamento e Flanqueamento
- **Engajamento**: quantos inimigos você enfrenta simultaneamente sem ficar
  mais vulnerável. Base de **personagens: 2**; **Adversários: 1 + 1 por
  categoria de tamanho acima de "Médio"**.
- **Totalmente Engajado**: inimigos adjacentes ≥ Engajamento.
- **Flanqueado**: engajado por mais criaturas que o próprio Engajamento →
  condição **Flanqueado** por **níveis**; cada nível = **+1 vantagem** nas
  rolagens de ataque corpo-a-corpo contra a criatura.
- Aliados adjacentes **com inimigos em comum** somam o próprio valor de
  Engajamento para neutralizar o Flanqueamento.
- **Desengajamento**: quem desengaja sofre um **Ataque Reativo** (ataque com
  arma como Reação) do oponente — indisponível se você estiver Desatento ou
  Flanqueado por outros que permaneçam.

## 2.3 Rolagens de Ataque

```
Rolagem de Ataque = 1d20 [+Vantagens, -Desvantagens] + Atributo + Bônus Adicionais
```

- Quem **ataca** rola; o defensor é medido por seus valores de Defesa.
- **Atributo**: determinado pelo **Estilo de Combate**.
- **Bônus de Perícia**: treinamento naquele tipo de arma (escada de proficiência).
- **Bônus de Encantamento**: propriedades especiais da arma.
- **Acerto**: resultado ≥ Classe de Resistência do alvo.

### Acertos e Falhas Críticas
| Resultado | Efeito |
|---|---|
| **Falha Crítica** | 1 natural **ou** errar por **10 ou mais** → o inimigo pode usar "Ataque Reativo" |
| **Falha** | abaixo da CR: sem dano |
| **Acerto** | igual/maior que a CR: causa a rolagem de dano |
| **Crítico** | 20 natural **ou** ultrapassar a CR em **10+**: rola todos os dados de dano **uma segunda vez** e soma |

### Fulgor Negro
- Ao obter **20 natural** num acerto, role **1d20 novamente**: resultado
  **15 ou maior** ativa o Fulgor Negro **pela primeira vez** — daí até o fim
  do encontro, **todo 20 natural** ativa.
- Fulgor ativado: **dano ×2,5** (arredondado para cima); **sobrepõe** o
  crítico normal do 20 natural; não pode ser ignorado, salvo característica
  que diga especificamente o contrário.
- Cada 20 natural que **não** ativa aumenta a margem em 1 (20 → 19-20…)
  até a primeira ativação no encontro; **reseta após alcançar o Fulgor**.

### Zona
Ao atingir um Fulgor Negro, até o fim do seu turno seguinte:
- **Dobra** os dados utilizáveis na "Explosão Ofensiva";
- **+3 vantagens** em todas as jogadas de ataque (Comuns e de Técnica);
- **+2** na Classe de Resistência.

## 2.4 Reações
- Só durante o turno de **outra criatura**; possuem condições de ativação
  ("quando você for alvo de uma jogada de ataque…").
- Custam PA e/ou energia; sem recursos, não ocorrem mesmo com a condição
  cumprida. **Desatento ou Incapacitado** não podem realizar Reações.
- Ex.: 6 PA → gasta 4 atacando; no turno do inimigo, um desengajamento
  permite um **Ataque Reativo** com os 2 PA restantes.

## 2.5 Ocultação e Surpresa
- **Furtividade** + ocultação do terreno → criatura indetectada; detecção
  via teste resistido ou passivo de **Percepção**.
- **Desatento**: Iniciativa **1**; a condição cai no início do próprio
  turno, que então rola Iniciativa e age normalmente nas rodadas seguintes.

## 2.6 Equilíbrio e Dificuldade
- **Ameaça total dos inimigos = Ameaça total dos personagens + aliados NPC**.
- Encontros equilibrados: ~50% favorecem o grupo, 50% os inimigos — na
  prática, ~50% dos encontros causam alguma quantidade de Ferimentos.
- **Ferimentos regulam a sorte**: adversários não têm Ferimentos (só Vida) —
  vantagem intencional dos personagens de jogador.
- Inimigos são otimizados em seu estilo; o Mestre ajusta o nível de
  otimização ao grupo e à narrativa.

## 2.9 Tipos diferentes de Ações
**6 Pontos de Ação** no início de cada turno; cada Ação custa a quantidade
indicada (alterável por talentos).

### Ações gerais
| Ação | Custo |
|---|---|
| **Ataque** | 2 PA por ataque (Comum) |
| **Ataque Reativo** | 1 ou 2 PA por ataque reativo |
| **Remover** | 2 PA para tentar remover uma condição de dano |
| **Técnicas** | 1 a 6 PA por técnica |
| **Esconder** | 1 PA (entrar em furtividade) |
| **Procurar** | 1 PA (Teste de Percepção) |
| **Interagir com Objeto** | 1 PA |

## 2.10 Ferimentos
Regras de acumulação (Mestre pode optar ao receber carga massiva de dano):
- Cada personagem tem **20 Pontos de Vida base** e sempre o **dobro** desse
  valor em capacidade de **"Feridas"**.
- **Dano Crítico**: metade do dano sofrido (arredondado para cima) vira Feridas.
- **Dano Caído**: dano sofrido a partir de **0 PV** vai **direto** para as Feridas.
- Feridas no máximo → **Morte** (independente da situação).

## 2.11 Lutando com Energia Amaldiçoada
- Criatura sem energia amaldiçoada **não recebe os benefícios** de ataques
  com energia amaldiçoada.

### Os três valores
- **Energia Máxima**: teto do reservatório; normalmente não muda em combate.
  Ex.: personagem de 10º nível sem treinamento adicional = **200**.
- **Energia Total**: quantidade atual; diminui com uso; nunca acima da
  Máxima (ex.: 200/200 → 180/200 após gastar 20).
- **Refinamento**: limite de energia utilizável **por rodada** =
  **2 × Nível** (ex.: 5º nível → 10 PA/rodada). A cada início de turno o
  personagem recebe um limite de uso igual ao seu Refinamento; toda energia
  usada sai da **Energia Total**.

### Energia para ataque
- **Ataque Comum**: normalmente **não** consome energia; pode-se ativar
  **Explosão Ofensiva** (manipulação básica — Cap. 7) para adicionar dados de
  dano usando parte da energia do turno. Colocar energia no ataque é visível
  (diferencia ataque comum de habilidade).
- **Técnicas**: gastam a energia descrita no **Manual de Técnicas**; dano
  pode ser aumentado como no ataque comum.

### Energia para defesa
Ao receber um ataque ou dano de técnica: **Explosão Defensiva**
(característica **"Lança e Escudo"** do capítulo de Estilos de Combate).

### Acumulando energia
- **Acúmulo**: no início do turno, **+1 PA de Refinamento** por ação
  sobressalente não usada na rodada anterior; com **5 ações ou mais**
  sobrando, o **Refinamento dobra** durante o turno.

### Energia Esgotada
A **0 PA** → condição **"Energia Esgotada"** até recuperar pelo menos 1 PA.

### Iniciando um combate
Ao rolar a iniciativa, toda criatura pode **usar energia igual ao Refinamento**
(preparando-se); **surpresa**: apenas **metade** do Refinamento.
