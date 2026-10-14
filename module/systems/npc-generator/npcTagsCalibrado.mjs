// ════════════════════════════════════════════════════════════════════════════
// Sistema de TAGS/ANIMAIS portado VERBATIM do NpcTab.jsx (Electron). Dá à maldição
// uma FORMA animal temática ("forma de X"), os traços dela (Ações Comuns) e um
// aspecto coerente com o medo. Sync MANUAL. As descrições dos aspectos vêm de
// ASPECTOS_MALDICAO (npcMaldicaoCalibrado.js).
// ════════════════════════════════════════════════════════════════════════════
import { ASPECTOS_MALDICAO, resolverFormulasND } from './npcMaldicaoCalibrado.mjs';

// Ações Comuns (traços de animal) — pool com descrições.
const ACOES_PODER = [
  { nome: 'Ataque com Asas', animal: true, nota: 'Aumenta o dano efetivo por rodada (acerta 2 alvos)', desc: 'Bate as asas. Cada alvo a até 6m faz Salvaguarda de Agilidade ou sofre (½ND↑)d6 de dano Contundente e fica Caído. Depois pode voar até metade do deslocamento.' },
  { nome: 'Ataque de Mergulho', animal: true, nota: 'Aumenta o dano efetivo na 1ª rodada', desc: 'Se estiver voando e mergulhar ≥6m em linha reta e atingir um alvo com ataque corpo-a-corpo, causa (½ND↑)d10 de dano adicional.' },
  { nome: 'Bote Sônico', animal: true, nota: 'Aumenta o dano efetivo na 1ª rodada', desc: 'Percorre ≥6m em linha reta livre em direção ao alvo e o atinge com ataque corpo-a-corpo, com (½ND↑)d10 de dano adicional. O alvo faz Salvaguarda de Força para não cair. O movimento não provoca ataque de oportunidade.' },
  { nome: 'Bote', animal: true, nota: 'Aumenta o dano efetivo na 1ª rodada', desc: 'Move ≥6m em direção a um alvo e ataca corpo-a-corpo; o alvo faz Salvaguarda de Força ou fica Caído. Se cair, ação bônus para um novo ataque.' },
  { nome: 'Corte Sangrento', nota: null, desc: '1×/turno, após acertar com arma cortante, o alvo faz Salvaguarda de Constituição ou recebe Sangramento. Até 5×/dia, recarrega após descanso longo.' },
  { nome: 'Cuspir Veneno', animal: true, nota: null, desc: 'Ataque à distância (até 6m). Se acertar, o alvo faz Salvaguarda de Constituição ou fica Envenenado por 1 min; depois fica imune ao veneno por 24h.' },
  { nome: 'Descuidado', nota: null, desc: 'No início do turno, ganha vantagem em todos os ataques corpo-a-corpo no turno, mas os ataques contra ela têm vantagem até o início do próximo turno.' },
  { nome: 'Impacto Atordoante', nota: 'Aumenta o bônus de ataque efetivo em 3', desc: '1×/rodada, ao causar dano Contundente, o alvo faz Salvaguarda de Constituição ou fica Atordoado até o fim do próximo turno dele.' },
  { nome: 'Inflar', animal: true, nota: null, desc: 'Aumenta o tamanho para "Enorme" e não recebe dano de queda.' },
  { nome: 'Investida Derrubadora', nota: 'Aumenta o dano efetivo na 1ª rodada', desc: 'Move ≥3m em direção a um alvo e ataca corpo-a-corpo, causando (½ND↑)d10 de dano Contundente adicional. Se for criatura, faz Salvaguarda de Força (CD) ou é empurrada 6m e cai.' },
  { nome: 'Investida', nota: 'Aumenta o dano efetivo na 1ª rodada', desc: 'Move ≥3m em direção a um alvo e ataca corpo-a-corpo, causando (½ND↑)d10 de dano adicional.' },
  { nome: 'Soltar Tinta', animal: true, nota: null, desc: 'Ação: solta tinta num cone de 6m. Todo alvo na área que use os olhos faz Salvaguarda de Agilidade ou fica Cego até limpar a tinta ou ser coberto por água corrente.' },
  { nome: 'Teia', animal: true, nota: 'Aumenta a CR efetiva em 1', desc: 'Ataque à distância (9/18m) contra alvo Grande ou menor. Se acertar, o alvo fica Impedido. Com uma ação, faz Teste de Força para escapar. A teia tem CR 10, 5 PV, resistência a Contundente e imunidade a Psíquico e Veneno.' },
  // ── Novos traços ─────────────────────────────────────────────────────────
  { nome: 'Ferrão Venenoso', animal: true, nota: null, desc: 'Ataque corpo-a-corpo. Se acertar, o alvo deve realizar uma Salvaguarda de Constituição ou recebe a condição "Envenenado" por 1 minuto.' },
  { nome: 'Cauda Constritora', animal: true, nota: 'Aumenta o dano efetivo por rodada', desc: 'Ataque corpo-a-corpo com a cauda contra um alvo Grande ou menor. Se acertar, o alvo recebe a condição "Agarrado" e sofre o dano da cauda novamente no início de cada turno do espírito enquanto permanecer preso.' },
  { nome: 'Investida com Chifres', animal: true, nota: 'Aumenta o dano efetivo na 1ª rodada', desc: 'Move-se ao menos 3 metros em direção a um alvo e o ataca corpo-a-corpo, causando (½ND↑)d10 de dano adicional. Se for uma criatura, ela faz Salvaguarda de Força ou é empurrada 3 metros e recebe a condição "Caído".' },
  { nome: 'Pinça Esmagadora', animal: true, nota: null, desc: 'Ataque corpo-a-corpo. Em caso de acerto contra um alvo Grande ou menor, ele recebe a condição "Agarrado"; enquanto estiver preso, tem desvantagem em ataques que não sejam contra o espírito.' },
  { nome: 'Guincho Ensurdecedor', animal: true, nota: null, desc: 'Solta um guincho agudo. Todas as criaturas a até 6 metros devem realizar uma Salvaguarda de Constituição ou recebem a condição "Surdo" até o fim de seu próximo turno.' },
  { nome: 'Mordida Dilacerante', animal: true, nota: 'Aumenta o dano efetivo por rodada', desc: 'Ataque corpo-a-corpo. Se acertar, o alvo deve realizar uma Salvaguarda de Constituição ou recebe a condição "Sangramento".' },
  { nome: 'Salto Predatório', animal: true, nota: 'Aumenta o dano efetivo na 1ª rodada', desc: 'Salta até 6 metros em direção a um alvo e o ataca corpo-a-corpo com (½ND↑)d10 de dano adicional. Se acertar, o alvo faz Salvaguarda de Força ou recebe a condição "Caído".' },
  { nome: 'Descarga Elétrica', animal: true, nota: null, desc: 'Ataque corpo-a-corpo carregado de eletricidade. Se acertar, o alvo deve realizar uma Salvaguarda de Constituição ou recebe a condição "Atordoado" até o fim de seu próximo turno.' },
  { nome: 'Golpe Esmagador', nota: 'Aumenta o dano efetivo por rodada', desc: '1×/rodada, ao causar dano Contundente, o alvo Grande ou menor deve realizar uma Salvaguarda de Força ou recebe a condição "Caído".' },
  { nome: 'Finta Brutal', nota: 'Aumenta o bônus de ataque efetivo em 2', desc: 'O espírito engana o alvo com um movimento falso. Sua próxima rolagem de ataque contra essa criatura neste turno é feita com vantagem.' },
];

// ─── Reações (humanoides — Casco Protetor IGNORADO, é de animal) ──────────────

// Animais → traços (Ações Comuns) + aspecto.
const ANIMAIS = [
  { nome: 'Aranha',              tracos: ['Teia', 'Cuspir Veneno'],                              aspecto: 'Escalador Aderente' },
  { nome: 'Serpente',            tracos: ['Cuspir Veneno', 'Bote'],                              aspecto: 'Corpo Venenoso' },
  { nome: 'Serpente Constritora', tracos: ['Cauda Constritora', 'Bote'],                         aspecto: 'Sentido Sísmico' },
  { nome: 'Morcego',             tracos: ['Ataque com Asas', 'Bote Sônico'],                     aspecto: 'Visão na Escuridão' },
  { nome: 'Ave de Rapina',       tracos: ['Ataque com Asas', 'Ataque de Mergulho'],              aspecto: 'Múltiplos Olhos' },
  { nome: 'Felino',              tracos: ['Bote', 'Salto Predatório'],                           aspecto: 'Pele Camaleônica' },
  { nome: 'Matilha',             tracos: ['Salto Predatório', 'Mordida Dilacerante'],            aspecto: 'Mente Coletiva' },
  { nome: 'Cefalópode',          tracos: ['Soltar Tinta', 'Cuspir Veneno'],                      aspecto: 'Anfíbio' },
  { nome: 'Anfíbio',             tracos: ['Inflar'],                                             aspecto: 'Anfíbio' },
  { nome: 'Enguia Elétrica',     tracos: ['Descarga Elétrica'],                                  aspecto: 'Anfíbio' },
  { nome: 'Inseto Alado',        tracos: ['Ataque com Asas', 'Ferrão Venenoso'],                 aspecto: 'Corpo Venenoso' },
  { nome: 'Escorpião',           tracos: ['Ferrão Venenoso', 'Pinça Esmagadora'],                aspecto: 'Corpo Venenoso' },
  { nome: 'Crustáceo',           tracos: ['Pinça Esmagadora', 'Inflar'],                         aspecto: 'Resistência Aberrante' },
  { nome: 'Besta Cornuda',       tracos: ['Investida com Chifres', 'Golpe Esmagador'],           aspecto: 'Resistência Aberrante' },
  { nome: 'Verme Subterrâneo',   tracos: ['Cauda Constritora', 'Mordida Dilacerante'],           aspecto: 'Sentido Sísmico' },
  { nome: 'Réptil Alado',        tracos: ['Ataque com Asas', 'Ataque de Mergulho', 'Cuspir Veneno'], aspecto: 'Resistência Aberrante' },
];

// Tag do medo → arquétipos de animal coerentes. Ao sortear a forma animal, em vez
// de aleatório puro, escolhemos um animal que combine com o TEMA da maldição
// (ex.: "Enxame de Vespas" tem tag 'inseto' → Inseto Alado, não Serpente).
const ANIMAL_POR_TAG = {
  inseto:    ['Inseto Alado', 'Escorpião'],
  aracnideo: ['Aranha', 'Escorpião'],
  enxame:    ['Inseto Alado'],
  veneno:    ['Serpente', 'Escorpião', 'Aranha'],
  fera:      ['Felino', 'Matilha', 'Besta Cornuda', 'Réptil Alado'],
  animal:    ['Felino', 'Matilha', 'Besta Cornuda'],
  predador:  ['Felino', 'Matilha', 'Ave de Rapina'],
  matilha:   ['Matilha'],
  voo:       ['Ave de Rapina', 'Morcego'],
  altura:    ['Ave de Rapina', 'Morcego'],
  agua:      ['Cefalópode', 'Enguia Elétrica', 'Anfíbio'],
  afogamento:['Cefalópode', 'Anfíbio'],
  profundeza:['Cefalópode', 'Enguia Elétrica'],
  sangue:    ['Felino', 'Verme Subterrâneo'],
  carne:     ['Verme Subterrâneo', 'Felino'],
  terra:     ['Verme Subterrâneo', 'Crustáceo'],
  ossos:     ['Verme Subterrâneo'],
};
// Escolhe um animal coerente com as tags do medo (a tag mapeada mais forte);
// se nenhuma tag animal estiver presente, cai no aleatório.
function escolherAnimalTematico(tags) {
  const acha = (nome) => ANIMAIS.find(a => a.nome === nome);
  if (tags) {
    const mapeadas = Object.keys(ANIMAL_POR_TAG)
      .filter(t => (tags[t] || 0) > 0)
      .sort((a, b) => (tags[b] || 0) - (tags[a] || 0));
    if (mapeadas.length) {
      const nomes = ANIMAL_POR_TAG[mapeadas[0]];
      const a = acha(nomes[Math.floor(Math.random() * nomes.length)]);
      if (a) return a;
    }
  }
  return ANIMAIS[Math.floor(Math.random() * ANIMAIS.length)];
}

// Tag do medo → aspectos (passivos) coerentes. Evita coisas sem sentido como
// "Anfíbio" numa maldição de fogo. Sem tag mapeada → um aspecto neutro genérico.
const ASPECTO_POR_TAG = {
  agua: ['Anfíbio'], afogamento: ['Anfíbio'], profundeza: ['Anfíbio'],
  escuridao: ['Visão na Escuridão', 'Deslizar nas Sombras'], cegueira: ['Visão na Escuridão'],
  furtividade: ['Pele Camaleônica', 'Deslizar nas Sombras'], emboscada: ['Pele Camaleônica'],
  veneno: ['Corpo Venenoso'], acido: ['Sangue Corrosivo', 'Aura Corrosiva'],
  mente: ['Imunidade Mental'], psiquico: ['Imunidade Mental'], loucura: ['Imunidade Mental'],
  medo: ['Aparição Aterradora', 'Presença Sufocante'], pesadelo: ['Aparição Aterradora'],
  regeneracao: ['Regeneração Amaldiçoada'], carne: ['Membros Regenerativos', 'Regeneração Amaldiçoada'],
  sangue: ['Regeneração Amaldiçoada'], morte: ['Membros Regenerativos'], cadaver: ['Membros Regenerativos'],
  inseto: ['Escalador Aderente'], aracnideo: ['Escalador Aderente', 'Teia de Energia'],
  enxame: ['Mente Coletiva'], matilha: ['Mente Coletiva'], animal: ['Múltiplos Olhos'],
  terra: ['Sentido Sísmico'], ossos: ['Sentido Sísmico'],
  espacial: ['Corpo Falso'], dimensao: ['Corpo Falso'], vazio: ['Corpo Falso'],
  raiva: ['Fúria Vingativa'], rancor: ['Fúria Vingativa'], vinganca: ['Fúria Vingativa'], odio: ['Fúria Vingativa'],
};
const _ASPECTO_NEUTRO = ['Regeneração Amaldiçoada', 'Visão na Escuridão', 'Múltiplos Olhos', 'Forma Amorfa', 'Resistência Aberrante'];
function escolherAspectoTematico(tags) {
  if (tags) {
    const mapeadas = Object.keys(ASPECTO_POR_TAG)
      .filter(t => (tags[t] || 0) > 0)
      .sort((a, b) => (tags[b] || 0) - (tags[a] || 0));
    if (mapeadas.length) {
      const opts = ASPECTO_POR_TAG[mapeadas[0]];
      return opts[Math.floor(Math.random() * opts.length)];
    }
  }
  return _ASPECTO_NEUTRO[Math.floor(Math.random() * _ASPECTO_NEUTRO.length)];
}


// Resolve nome de aspecto → {nome, desc} (de ASPECTOS_MALDICAO; fallback genérico).
const _aspMap = Object.fromEntries(ASPECTOS_MALDICAO.map(a => [a.nome, a.desc]));
export function aspectoTematicoResolvido(nome) { return { nome, desc: _aspMap[nome] || '' }; }
export function tracoComum(nome, nd = 5) { const t = ACOES_PODER.find(a => a.nome === nome); return t ? { nome: t.nome, desc: resolverFormulasND(t.desc, Math.max(1, Math.round(Number(nd) || 5))) } : { nome, desc: '' }; }
export { ACOES_PODER, ANIMAIS, ANIMAL_POR_TAG, escolherAnimalTematico, ASPECTO_POR_TAG, escolherAspectoTematico };
