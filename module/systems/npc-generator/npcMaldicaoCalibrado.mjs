// ════════════════════════════════════════════════════════════════════════════
// PORTADO VERBATIM do NpcTab.jsx (Commission Manager / app Electron). NÃO reescrever
// o conteúdo das listas — é texto calibrado à mão pelo dono. Sync MANUAL: se mudar
// no Electron, re-extrair estas listas + resolverFormulasND.
//
// resolverFormulasND faz o AUTO-CÁLCULO por ND no texto da habilidade:
//   "3×ND" → metros · "(½ND↑)d6"/"(⅓ND↑)d6" → dado real · "(ND)d8" → ND dados ·
//   "+ND" → bônus · "10×ND" → valor · "[NDx: texto]" → trecho só se ND ≥ x.
// dmg(nd) → { qtd, faces, tipo } dá o dado de dano já resolvido.
// ════════════════════════════════════════════════════════════════════════════

const _NDFRAC = { '½': 2, '¼': 4, '⅓': 3 };
function resolverFormulasND(desc, nd) {
  if (!desc) return desc;
  const arred = (denom, seta) => {
    const v = nd / denom;
    return seta === '↓' ? Math.floor(v) : Math.ceil(v); // sem seta → cima
  };
  return String(desc)
    // [NDx: texto] → mantém o texto SÓ se a criatura for ND ≥ x (efeito que só
    // passa a existir a partir de tal ND); abaixo disso, o trecho some por completo.
    .replace(/\s*\[ND(\d+):\s*([^\]]*)\]/g, (_, lim, txt) => (nd >= Number(lim) ? ` ${txt}` : ''))
    // (fração ND [seta]) dX  → qtd dX
    .replace(/\(([½¼⅓])ND([↑↓]?)\)\s*d(\d+)/g, (_, fr, seta, faces) =>
      `${Math.max(1, arred(_NDFRAC[fr], seta))}d${faces}`)
    // (ND) dX  → ND dados (ex.: "(ND)d8" → "10d8")
    .replace(/\(ND\)\s*d(\d+)/g, (_, faces) => `${Math.max(1, nd)}d${faces}`)
    // (fração ND [seta]) sozinho → número (ex.: bônus de acerto)
    .replace(/\(([½¼⅓])ND([↑↓]?)\)/g, (_, fr, seta) =>
      `${Math.max(0, arred(_NDFRAC[fr], seta))}`)
    // multiplicador N×ND (com vírgula e/ou 'm') → valor calculado (piso 1).
    .replace(/(\d+(?:,\d+)?)(m)?×ND/g, (_, num, m) => {
      const val = Math.max(1, parseFloat(num.replace(',', '.')) * nd); // ND baixo nunca < 1
      const txt = Number.isInteger(val) ? String(val) : String(val).replace('.', ',');
      return m ? `${txt}m` : txt;
    })
    // bônus pelo ND: "+ND" / "+ ND" → "+<valor>" (piso 1; não toca em limiares
    // como "ND 12+", "≤ ND", "de ND menor" nem em "por 5 ND", sem o '+' antes).
    .replace(/\+\s*ND\b/g, () => `+${Math.max(1, nd)}`);
}


function dadoMaldicao(target) {
  const alvo = Math.max(2, Math.round(Number(target) || 0));
  const q = (f) => Math.max(1, Math.round(alvo / ((f + 1) / 2)));
  const bons = [6, 8, 10, 12].filter(f => q(f) <= 5);
  const faces = bons.length ? bons[Math.floor(Math.random() * bons.length)] : 12;
  const qtd = q(faces);
  return { expr: `${qtd}d${faces}`, avg: Math.round(qtd * (faces + 1) / 2) };
}

// Alcance dos ataques À DISTÂNCIA da maldição: 9m base, +3m a cada 3 de ND.
//   ND ≤2 → 9 · 3-5 → 12 · 6-8 → 15 · 9-11 → 18 · 12-14 → 21 · 15-17 → 24 …
function alcanceDistancia(nd) {
  return 9 + Math.floor((Number(nd) || 0) / 3) * 3;
}


const avgDado = (qtd, faces) => (qtd > 0 ? (qtd * (faces + 1)) / 2 : 0);
// Dano sempre ≥ 1 dado: cálculo de dado < 1 vira 1 dado (regra do sistema).
const fmtDado = (d) => (d && d.qtd != null ? `${Math.max(1, Math.ceil(d.qtd))}d${d.faces}${d.tipo ? ' ' + d.tipo : ''}` : null);
const parseDado = (s) => { const m = /(\d+)d(\d+)/.exec(String(s || '')); return m ? { qtd: +m[1], faces: +m[2] } : null; };

// dmg(nd) → { qtd, faces, tipo } | null. media:true → entra na média de dano/rodada.
const ACAO_PODER_MALDICAO = [
  { nome: 'Abalo Sísmico', dmg: nd => ({ qtd: Math.floor(nd / 2), faces: 6, tipo: 'energia' }), media: true,
    desc: 'Uma vez por rodada, o espírito pode causar um tremor por meio de ondas de choque em uma área com raio de 3×ND metros. Todas as criaturas que estiverem voando são derrubadas instantaneamente, e todas as criaturas no chão devem realizar uma Salvaguarda de Agilidade para não sofrerem a condição "Caído". As criaturas que falharem na salvaguarda recebem (½ND↓)d6 de dano.' },
  { nome: 'Aura de Terror', dmg: nd => ({ qtd: Math.ceil(nd / 3), faces: 6, tipo: 'psíquico' }), media: true,
    desc: 'A criatura libera uma aura aterradora que impõe medo profundo em todas as criaturas dentro de uma área com raio de 3×ND metros. No início de cada um dos turnos do espírito, todas as criaturas na área devem realizar uma Salvaguarda de Sabedoria. Em caso de falha, elas recebem (⅓ND↑)d6 de dano psíquico.' },
  { nome: 'Carne Amaldiçoada', dmg: nd => ({ qtd: Math.ceil(nd / 2), faces: 6, tipo: 'energia' }), media: false,
    desc: 'Ao realizar uma jogada de ataque contra um alvo, você infecta sua carne, deixando uma marca de podridão que se intensifica conforme ele utiliza energia amaldiçoada e entra em combate.\nAo ser atingida, a criatura deve realizar uma Salvaguarda de Intelecto. Em caso de falha, ela recebe (½ND↑)d6 de dano e sofre 1d6 de dano verdadeiro sempre que realizar uma ação ou se movimentar.' },
  { nome: 'Dimensão Instável', dmg: nd => ({ qtd: Math.ceil(nd / 2), faces: 6, tipo: 'verdadeiro' }), media: false,
    desc: 'Ao ativar essa habilidade, uma área com raio de 6 metros ao redor do espírito é corrompida, adquirindo uma coloração arroxeada. No início de cada um de seus turnos, o raio da área aumenta em 6 metros, até um máximo de 3×ND metros. Enquanto estiverem dentro da área:\n• As Salvaguardas têm −2;\n• O Espírito Amaldiçoado tem vantagem em seus ataques;\n• As criaturas que entrarem em contato com a área pela primeira vez sofrem (½ND↑)d6 de dano Verdadeiro.\nA dimensão instável dura por 1 minuto, a menos que seja criada por uma habilidade com barreira.' },
  { nome: 'Lamento Desesperador', dmg: nd => ({ qtd: Math.ceil(nd / 2), faces: 6, tipo: 'psíquico' }), media: true,
    desc: 'A criatura emite um grito ensurdecedor que causa desespero e corrói a mente. As criaturas recebem efeitos variados conforme a distância em relação ao grito:\n• Até 3 metros: realizam uma Salvaguarda de Sabedoria — em caso de falha, sofrem (½ND↑)d6 de dano psíquico e a condição "Inconsciente" até o final de seus turnos; em caso de sucesso, metade do dano;\n• De 4,5 a 9 metros: o mesmo, mas a condição passa a ser "Incapacitado";\n• A 10,5 metros ou mais: recebem a condição "Surdo" até o final de seus próximos turnos, sem necessidade de Salvaguarda.' },
  { nome: 'Parasita Amaldiçoado', dmg: nd => ({ qtd: Math.ceil(nd / 3), faces: 6, tipo: 'energia' }), media: false,
    desc: 'A criatura realiza uma rolagem de ataque contra o alvo para tentar injetar energia amaldiçoada, que se prende e se alimenta de sua vitalidade. O alvo deve realizar uma Salvaguarda de Intelecto. Em caso de falha, ele sofre (⅓ND↑)d6 de dano no início de cada um dos turnos do espírito.\nO alvo pode repetir a Salvaguarda ao final de cada um de seus turnos para tentar encerrar o efeito.' },
  { nome: 'Distorção Espacial', dmg: () => null, media: false,
    desc: 'A criatura torna o espaço ao seu redor caótico, fazendo com que ele se dobre e se expanda aleatoriamente. Até o final de seu próximo turno:\n• Ela aumenta a própria Classe de Resistência em +3;\n• Pode, uma vez por rodada, se teletransportar em um alcance de 3×ND metros sem consumir nenhuma ação.' },
  { nome: 'Barreira Negativa', dmg: () => null, media: false,
    desc: 'O espírito escolhe uma criatura no campo de batalha e cria um cubo de energia amaldiçoada ao redor dela. O cubo possui as seguintes características:\n• Impede a visão e o movimento da criatura;\n• Possui Pontos de Vida iguais a 10×ND e Classe de Resistência 15;\n• Se a criatura for uma maldição relacionada ao espaço, impede teletransportes para fora da área;\n• Dura 3 rodadas ou até ser destruído, e só pode existir um cubo por vez para cada 5 de ND do espírito.' },
  { nome: 'Dreno de Vitalidade', dmg: nd => ({ qtd: Math.floor(nd / 2), faces: 6, tipo: 'energia' }), media: true,
    desc: 'O espírito absorve a vitalidade de todas as criaturas em uma área com raio de 3×ND metros. Todas as criaturas devem realizar uma Salvaguarda de Intelecto. Em caso de falha, recebem (½ND↓)d6 de dano e o espírito recupera uma quantidade de Pontos de Vida igual à metade do dano causado.' },
  { nome: 'Revelar Forma', dmg: () => null, media: false,
    desc: 'O espírito abandona sua máscara, revelando sua verdadeira forma e recebendo, por 1 minuto:\n• +ND de dano em todas as fontes de dano;\n• Seus ataques passam a ignorar resistências e invulnerabilidades;\n• Ele perde todas as resistências que tiver.' },
  { nome: 'Invocação Fragmentada', dmg: () => null, media: false,
    desc: 'O espírito pode separar parte de si mesmo para criar um clone idêntico, sacrificando 1 Ponto de Atributo à sua escolha. O clone possui sempre a mesma quantidade de atributos e as mesmas características, mas tem metade dos Pontos de Vida do original. Se um clone for destruído, o espírito só recupera o atributo ao final de um descanso longo.\nO espírito deve tocar um clone com uma ação para recuperá-lo de volta ao seu corpo.' },
  { nome: 'Colapso Interno', dmg: nd => ({ qtd: Math.ceil(nd / 2), faces: 10, tipo: 'energia' }), media: true,
    desc: 'O espírito desfere um golpe que injeta uma grande quantidade de energia amaldiçoada no alvo, causando (½ND↑)d10 de dano. O alvo deve realizar uma Salvaguarda de Constituição. Em caso de falha, sofre a condição "Letárgico" até o final de seu próximo turno.' },
  { nome: 'Prisão do Medo', dmg: () => ({ qtd: 1, faces: 8, tipo: 'psíquico' }), media: false,
    desc: 'O espírito escolhe uma criatura a uma distância de até 3×ND metros e prende o alvo em uma ilusão de terror. O alvo deve realizar uma Salvaguarda de Sabedoria; em caso de falha, fica com a condição "Atordoado" até sofrer dano ou por até 1 hora.\nO alvo pode repetir a Salvaguarda ao final de cada um de seus turnos para tentar se libertar, sofrendo 1d8 de dano psíquico por rodada em que permanecer aprisionado na ilusão.' },
  { nome: 'Chuva Amaldiçoada', dmg: nd => ({ qtd: Math.ceil(nd / 2), faces: 6, tipo: 'ácido' }), media: true,
    desc: 'O espírito libera uma enorme quantidade de energia amaldiçoada no ar, que se condensa em gotas e precipita sobre um ponto à sua escolha, a até 60 metros, em uma área com raio de 3×ND metros.\nTodas as criaturas na área devem realizar uma Salvaguarda de Constituição. Em caso de falha, sofrem (½ND↑)d6 de dano ácido; em caso de sucesso, sofrem apenas metade desse dano.' },
  { nome: 'Olhar Aterrador', dmg: () => null, media: false,
    desc: 'O espírito fixa o olhar em uma criatura à sua escolha, a até 3×ND metros de distância. O alvo deve realizar uma Salvaguarda de Sabedoria para não receber a condição "Paralisado" enquanto o espírito mantiver o olhar sobre ele e não atacar outra criatura.\nO alvo pode repetir a Salvaguarda ao final de cada um de seus turnos para tentar se libertar.' },
  { nome: 'Sobrecarga de Energia', dmg: () => null, media: false,
    desc: 'O espírito sobrecarrega sua própria energia amaldiçoada a um estado crítico. Pelo próximo minuto, ele passa a causar 1 dado de dano adicional +ND em todo dano que causar. Enquanto essa habilidade estiver ativa, o espírito sofre 3 pontos de dano adicionais de todas as fontes de dano.' },
  { nome: 'Letargia Constante', dmg: () => ({ qtd: 2, faces: 8, tipo: 'verdadeiro' }), media: true,
    desc: 'O espírito começa a corromper lentamente o corpo de todas as criaturas em uma área com raio de 3×ND metros, pelo próximo minuto. No início de cada um de seus turnos, todas as criaturas na área devem realizar uma Salvaguarda de Constituição. Em caso de falha, recebem desvantagem em todas as Salvaguardas físicas e sofrem 2d8 de dano Verdadeiro.' },
  { nome: 'Eco Doloroso', recarga: '4-6', dmg: () => null, media: false,
    desc: 'O espírito escolhe uma criatura inimiga a uma distância de 3×ND metros. O alvo deve realizar uma Salvaguarda de Sabedoria; em caso de falha, sofre como dano psíquico todo o dano que recebeu no último turno; em caso de sucesso, sofre apenas metade desse valor.\nA cada vez que uma criatura falhar nessa Salvaguarda, recebe +2 na próxima tentativa.' },
  { nome: 'Explosão Elemental', dmg: nd => ({ qtd: Math.ceil(nd / 2), faces: 8, tipo: 'energia' }), media: true,
    desc: 'Caso o espírito tenha sofrido dano desde o final de seu turno anterior, ele pode ativar esta habilidade para causar uma explosão de energia amaldiçoada, que causa (½ND↑)d8 de dano de energia em uma área com raio de 1,5×ND metros.\nTodas as criaturas na área devem realizar uma Salvaguarda de Agilidade. Em caso de falha, sofrem todo o dano; em caso de sucesso, sofrem apenas metade.' },
  { nome: 'Fragmentação de Realidade', dmg: () => null, media: false,
    desc: 'O espírito estilhaça o espaço ao seu redor, fazendo com que rachaduras, como as de um espelho, se espalhem por todo o local. Pelas próximas duas rodadas:\n• O espírito pode realizar um ataque (Comum) adicional por rodada;\n• Toda vez que uma criatura realizar uma rolagem de acerto, ela deve rolar 1d4, e em um resultado de 1 ou 2 o ataque falha automaticamente.\nO espírito só pode ativar essa habilidade 3 vezes por encontro.' },
  { nome: 'Presença Opressora', dmg: () => null, media: false,
    desc: 'O espírito libera uma enorme pressão na área, fazendo com que o corpo das criaturas pareça mais pesado. Pelo próximo minuto, no início de cada um de seus turnos, todas as criaturas em uma área com raio de 3×ND metros devem realizar uma Salvaguarda de Força. Em caso de falha, recebem a condição "Pesado" até o início do próximo turno do espírito.' },
  { nome: 'Fome Voraz', dmg: () => null, media: false,
    desc: 'Quando o espírito se aproximar a até 1,5 metros de uma criatura incapacitada com 0 Pontos de Vida, ele pode tocar seu corpo para absorvê-la instantaneamente, recuperando uma quantidade de Pontos de Vida igual à metade do seu máximo (limitado a 150). A criatura morre instantaneamente ao ser afetada por essa habilidade.' },
  // ── Novas Ações de Poder ─────────────────────────────────────────────────
  { nome: 'Vinhas Amaldiçoadas', dmg: nd => ({ qtd: Math.ceil(nd / 2), faces: 6, tipo: 'energia' }), media: true,
    desc: 'O espírito faz brotar vinhas de energia amaldiçoada do chão em uma área com raio de 3×ND metros. Todas as criaturas na área devem realizar uma Salvaguarda de Força. Em caso de falha, sofrem (½ND↑)d6 de dano e recebem a condição "Impedido" até o início do próximo turno do espírito; em caso de sucesso, metade do dano e sem a condição.' },
  { nome: 'Sopro Corrosivo', dmg: nd => ({ qtd: Math.ceil(nd / 2), faces: 8, tipo: 'ácido' }), media: true,
    desc: 'O espírito expele um cone de bile corrosiva de 1,5×ND metros. Todas as criaturas na área devem realizar uma Salvaguarda de Agilidade. Em caso de falha, sofrem (½ND↑)d8 de dano ácido; em caso de sucesso, metade.' },
  { nome: 'Maldição da Cegueira', dmg: () => null, media: false,
    desc: 'O espírito arranca a luz dos olhos de uma criatura a até 3×ND metros. O alvo deve realizar uma Salvaguarda de Intelecto para não receber a condição "Cego" por 1 minuto.\nO alvo pode repetir a Salvaguarda ao final de cada um de seus turnos para encerrar o efeito.' },
  { nome: 'Pulso de Podridão', dmg: nd => ({ qtd: Math.ceil(nd / 2), faces: 6, tipo: 'energia' }), media: true,
    desc: 'Uma onda de podridão se expande a partir do espírito em uma área com raio de 3×ND metros. Todas as criaturas devem realizar uma Salvaguarda de Constituição. Em caso de falha, sofrem (½ND↑)d6 de dano de energia e têm seus Pontos de Vida máximos reduzidos no mesmo valor até o fim de um descanso longo; em caso de sucesso, metade do dano e sem redução.' },
  { nome: 'Toque Petrificante', dmg: () => null, media: false,
    desc: 'O espírito realiza uma rolagem de ataque corpo-a-corpo. Se acertar, o alvo deve realizar uma Salvaguarda de Constituição. Em caso de falha, recebe a condição "Impedido" e, ao falhar novamente no início de seu próximo turno, recebe a condição "Petrificado".\nEm caso de sucesso em qualquer uma das salvaguardas, o efeito termina.' },
  { nome: 'Enxame Devorador', dmg: nd => ({ qtd: Math.floor(nd / 2), faces: 6, tipo: 'energia' }), media: true,
    desc: 'Um enxame de insetos amaldiçoados emerge do corpo do espírito e cobre uma área com raio de 3×ND metros pelo próximo minuto. Toda criatura que iniciar seu turno na área sofre (½ND↓)d6 de dano e tem desvantagem em rolagens de ataque até o fim do turno.' },
  { nome: 'Veneno Persistente', dmg: nd => ({ qtd: Math.ceil(nd / 3), faces: 6, tipo: 'energia' }), media: false,
    desc: 'O espírito realiza uma rolagem de ataque à distância (até 6 metros), cuspindo um veneno espesso. Se acertar, o alvo deve realizar uma Salvaguarda de Constituição. Em caso de falha, recebe a condição "Envenenado" e sofre (⅓ND↑)d6 de dano no início de cada um de seus turnos.\nO alvo pode repetir a Salvaguarda ao final de cada um de seus turnos para encerrar o efeito.' },
  { nome: 'Grito Dissonante', dmg: nd => ({ qtd: Math.ceil(nd / 3), faces: 6, tipo: 'psíquico' }), media: true,
    desc: 'O espírito emite um som agudo e antinatural em uma área com raio de 3×ND metros. Todas as criaturas na área devem realizar uma Salvaguarda de Constituição. Em caso de falha, sofrem (⅓ND↑)d6 de dano psíquico e recebem a condição "Surdo" até o fim de seu próximo turno; criaturas que dependam da audição também ficam "Atordoadas" no mesmo período.' },
  { nome: 'Chamas Espectrais', dmg: nd => ({ qtd: Math.ceil(nd / 2), faces: 6, tipo: 'fogo' }), media: true,
    desc: 'O espírito conjura labaredas geladas em uma área com raio de 1,5×ND metros. Todas as criaturas na área devem realizar uma Salvaguarda de Agilidade. Em caso de falha, sofrem (½ND↑)d6 de dano de fogo e recebem a condição "Queimado"; em caso de sucesso, metade do dano e sem a condição.' },
  { nome: 'Lâminas de Vácuo', dmg: nd => ({ qtd: Math.ceil(nd / 2), faces: 8, tipo: 'cortante' }), media: true,
    desc: 'O espírito projeta lâminas de ar comprimido em uma linha reta de 3×ND metros. Cada criatura na linha deve realizar uma Salvaguarda de Agilidade. Em caso de falha, sofre (½ND↑)d8 de dano cortante e recebe a condição "Sangramento"; em caso de sucesso, metade do dano.' },
  { nome: 'Domínio do Frio', dmg: nd => ({ qtd: Math.ceil(nd / 2), faces: 6, tipo: 'frio' }), media: true,
    desc: 'O espírito congela o ar em uma área com raio de 3×ND metros pelo próximo minuto. No início de cada um de seus turnos, as criaturas na área devem realizar uma Salvaguarda de Constituição. Em caso de falha, sofrem (½ND↑)d6 de dano de frio e recebem a condição "Hipotérmico"; uma criatura que falhe duas vezes seguidas recebe a condição "Congelado" até o fim de seu próximo turno.' },
  { nome: 'Miragem Cruel', dmg: () => null, media: false,
    desc: 'O espírito tece ilusões aterrorizantes ao redor de uma criatura a até 3×ND metros. O alvo deve realizar uma Salvaguarda de Sabedoria. Em caso de falha, recebe a condição "Alucinado" até o fim de seu próximo turno.' },
  { nome: 'Corrente de Almas', dmg: nd => ({ qtd: Math.floor(nd / 2), faces: 6, tipo: 'energia' }), media: true,
    desc: 'O espírito lança correntes espectrais que se prendem a todas as criaturas a até 3×ND metros. Cada alvo deve realizar uma Salvaguarda de Força. Em caso de falha, sofre (½ND↓)d6 de dano e é puxado 6 metros em direção ao espírito; em caso de sucesso, metade do dano e não é puxado.' },
  { nome: 'Maldição do Peso', dmg: () => null, media: false,
    desc: 'O espírito multiplica a gravidade sobre uma criatura a até 3×ND metros. O alvo deve realizar uma Salvaguarda de Força para não receber a condição "Pesado" até o início do próximo turno do espírito. Se o alvo já estiver "Pesado", em vez disso recebe a condição "Caído".' },
  { nome: 'Explosão de Esporos', dmg: nd => ({ qtd: Math.ceil(nd / 3), faces: 6, tipo: 'energia' }), media: true,
    desc: 'O espírito libera uma nuvem de esporos amaldiçoados em uma área com raio de 3×ND metros. Todas as criaturas na área devem realizar uma Salvaguarda de Constituição. Em caso de falha, sofrem (⅓ND↑)d6 de dano e recebem a condição "Sonolento" até o fim de seu próximo turno.' },
  { nome: 'Olhar Hipnótico', dmg: () => null, media: false,
    desc: 'O espírito encara profundamente uma criatura a até 3×ND metros, impondo sua vontade. O alvo deve realizar uma Salvaguarda de Sabedoria. Em caso de falha, recebe a condição "Enfeitiçado" pelo espírito por até 1 minuto; o efeito termina se o alvo sofrer dano do espírito ou de seus aliados.' },
  { nome: 'Mãos da Sepultura', dmg: nd => ({ qtd: Math.floor(nd / 2), faces: 6, tipo: 'energia' }), media: true,
    desc: 'Mãos descarnadas brotam do chão em uma área com raio de 3×ND metros. Todas as criaturas na área devem realizar uma Salvaguarda de Agilidade. Em caso de falha, sofrem (½ND↓)d6 de dano e recebem a condição "Agarrado"; escapar exige um Teste de Força contra a Classe de Dificuldade do espírito.' },
  { nome: 'Pústulas Explosivas', dmg: nd => ({ qtd: Math.ceil(nd / 2), faces: 8, tipo: 'energia' }), media: false,
    desc: 'O espírito cobre uma criatura de bolhas de energia instável com uma rolagem de ataque corpo-a-corpo. Da próxima vez que o alvo sofrer dano antes do início do próximo turno do espírito, as pústulas explodem, causando (½ND↑)d8 de dano a ele e a todas as criaturas a até 1,5 metros dele.' },
  { nome: 'Cântico Enlouquecedor', dmg: nd => ({ qtd: Math.ceil(nd / 3), faces: 6, tipo: 'psíquico' }), media: true,
    desc: 'O espírito entoa um cântico dissonante pelo próximo minuto. No início de cada um de seus turnos, todas as criaturas a até 3×ND metros devem realizar uma Salvaguarda de Presença. Em caso de falha, sofrem (⅓ND↑)d6 de dano psíquico e têm desvantagem na próxima rolagem de ataque que realizarem.' },
  { nome: 'Maré de Ácido', dmg: nd => ({ qtd: Math.ceil(nd / 2), faces: 6, tipo: 'ácido' }), media: true,
    desc: 'O espírito faz uma onda de ácido varrer uma área com raio de 3×ND metros. Todas as criaturas na área devem realizar uma Salvaguarda de Agilidade. Em caso de falha, sofrem (½ND↑)d6 de dano ácido e têm sua Classe de Resistência reduzida em 1 até o fim de seu próximo turno; em caso de sucesso, metade do dano.' },
];

// ─── MALDIÇÕES: Habilidades de Ação Bônus ─────────────────────────────────────

const ACAO_BONUS_MALDICAO = [
  { nome: 'Ataque de Garra', dmg: () => null, media: false, extraAtaque: true,
    desc: 'A criatura desfere uma jogada de ataque (Comum) adicional contra uma criatura qualquer.' },
  { nome: 'Passo Distorcido', dmg: () => null, media: false,
    desc: 'O espírito desaparece de vista e se materializa em um ponto a até 3×ND metros. Esse movimento não provoca reações, como "Ataque de Oportunidade".' },
  { nome: 'Golpes Disformes', dmg: () => null, media: false,
    desc: 'O espírito recebe +1,5 metros de alcance e um bônus de acerto de +(½ND↓) até o final do turno atual.' },
  { nome: 'Revestimento Maldito', dmg: () => null, media: false,
    desc: 'O espírito endurece a superfície de seu corpo, recebendo resistência a danos contundentes, cortantes e perfurantes até o final de seu próximo turno.' },
  { nome: 'Marca Efêmera', dmg: nd => ({ qtd: Math.ceil(nd / 2), faces: 6, tipo: 'energia' }), media: false,
    desc: 'O espírito realiza uma rolagem de ataque para tocar uma criatura e marcá-la. Até o início de seu próximo turno, o próximo dano que o alvo receber faz com que a marca exploda, causando (½ND↑)d6 de dano.' },
  { nome: 'Avanço Predatório', dmg: () => null, media: false,
    desc: 'O espírito dispara em direção a uma criatura que esteja a mais de 6 metros de distância. Se ele alcançar o alvo, sua próxima rolagem de ataque é realizada com vantagem.' },
  { nome: 'Sussurros da Loucura', dmg: () => null, media: false,
    desc: 'O espírito escolhe uma criatura dentro do alcance de 3×ND metros. O alvo deve realizar uma Salvaguarda de Presença. Em caso de falha, sofre desvantagem na próxima rolagem de ataque que realizar.' },
  { nome: 'Recuperação Rápida', cura: nd => ({ qtd: Math.floor(nd / 2), faces: 8 }), dmg: () => null, media: false,
    desc: 'O espírito regenera seu corpo usando sua energia amaldiçoada como combustível. Ele recupera (½ND↓)d8 Pontos de Vida. Ele não pode recuperar mais do que metade do dano que sofreu.' },
  { nome: 'Expulsão Violenta', dmg: nd => ({ qtd: Math.ceil(nd / 2), faces: 8, tipo: 'contundente' }), media: false,
    desc: 'O espírito libera uma explosão de energia amaldiçoada que gera uma onda de choque ao seu redor. Todas as criaturas a até 6 metros devem realizar uma Salvaguarda de Força para não serem empurradas a uma distância de 1,5m×ND.\nSe, durante o empurrão, as criaturas colidirem contra um objeto ou estrutura com pelo menos 1,5 metros de raio, elas recebem (½ND↑)d8 de dano contundente.' },
  { nome: 'Olhar Desconcertante', dmg: () => null, media: false,
    desc: 'O espírito ativa esta habilidade contra uma criatura, fazendo com que ela seja pressionada por uma energia amaldiçoada invasiva. Enquanto mantiver o foco exclusivamente nesse alvo, sem trocá-lo, a criatura não pode obter vantagem contra o espírito. Em contrapartida, o espírito sofre uma penalidade de −1 em sua Classe de Resistência contra todas as outras criaturas.' },
  { nome: 'Instinto do Assassinato', dmg: () => null, media: false,
    desc: 'O espírito ignora quaisquer bônus de Classe de Resistência concedidos por qualquer meio que não seja Habilidade Básica ou Treinamentos até o início de seu próximo turno.' },
  { nome: 'Forma Etérea', dmg: () => null, media: false,
    desc: 'O espírito se torna intangível, permitindo que ele atravesse criaturas e objetos até o final do turno atual, ignorando ataques e qualquer tipo de dano. No entanto, ele não pode atacar enquanto estiver nessa forma e não pode atravessar estruturas ou barreiras.' },
  { nome: 'Rastro Amaldiçoado', dmg: () => ({ qtd: 1, faces: 8, tipo: 'energia' }), media: false,
    desc: 'O espírito deixa um rastro residual enquanto se move. Cada quadrado por onde ele passar passa a causar dano até o início de seu próximo turno. Sempre que uma criatura entrar ou passar por um desses quadrados, ela recebe 1d8 de dano, à escolha do narrador.' },
  // ── Novas Ações Bônus ────────────────────────────────────────────────────
  { nome: 'Bote Sombrio', dmg: () => null, media: false,
    desc: 'O espírito mergulha nas sombras e ressurge a até 3×ND metros de onde estava. Sua próxima rolagem de ataque neste turno é feita com vantagem.' },
  { nome: 'Casulo Regenerativo', cura: nd => ({ qtd: Math.floor(nd / 2), faces: 8 }), dmg: () => null, media: false,
    desc: 'O espírito se envolve em uma casca de energia amaldiçoada e recupera (½ND↓)d8 Pontos de Vida. Até o início de seu próximo turno, ele não pode realizar reações.' },
  { nome: 'Salto Aberrante', dmg: () => null, media: false,
    desc: 'O espírito dobra os próprios membros de forma antinatural e salta para um ponto a até 1,5×ND metros, sem provocar reações.' },
  { nome: 'Garras Dilacerantes', dmg: () => null, media: false, extraAtaque: true,
    desc: 'O espírito desfere uma rolagem de ataque (Comum) adicional. Se acertar, o alvo deve realizar uma Salvaguarda de Constituição ou recebe a condição "Sangramento".' },
  { nome: 'Véu de Sombras', dmg: () => null, media: false,
    desc: 'O espírito se cobre de uma névoa escura. Até o início de seu próximo turno, rolagens de ataque contra ele são feitas com desvantagem.' },
  { nome: 'Sopro Gélido', dmg: nd => ({ qtd: Math.ceil(nd / 3), faces: 6, tipo: 'frio' }), media: false,
    desc: 'O espírito exala uma rajada gélida sobre uma criatura a até 6 metros. O alvo deve realizar uma Salvaguarda de Constituição. Em caso de falha, sofre (⅓ND↑)d6 de dano de frio e recebe a condição "Hipotérmico" até o fim de seu próximo turno.' },
  { nome: 'Pele de Aço', dmg: () => null, media: false,
    desc: 'O espírito enrijece sua superfície. Até o início de seu próximo turno, ele recebe +2 de Classe de Resistência, mas seu deslocamento é reduzido pela metade.' },
  { nome: 'Investida Espectral', dmg: () => null, media: false,
    desc: 'O espírito avança 6 metros em linha reta e termina o movimento colidindo com uma criatura, que deve realizar uma Salvaguarda de Força ou recebe a condição "Caído".' },
  { nome: 'Lamúria Aterradora', dmg: () => null, media: false,
    desc: 'O espírito solta um gemido perturbador. Uma criatura a até 3×ND metros deve realizar uma Salvaguarda de Sabedoria ou recebe a condição "Amedrontado" até o fim de seu próximo turno.' },
  { nome: 'Drenagem Tátil', dmg: nd => ({ qtd: Math.ceil(nd / 3), faces: 6, tipo: 'energia' }), media: false,
    desc: 'O espírito toca uma criatura a até 1,5 metros, causando (⅓ND↑)d6 de dano e recuperando Pontos de Vida iguais ao dano causado.' },
  { nome: 'Aceleração Maldita', dmg: () => null, media: false,
    desc: 'O espírito sobrecarrega os próprios músculos com energia amaldiçoada. Até o fim do turno, seu deslocamento dobra e seus movimentos não provocam reações.' },
  { nome: 'Cuspe Aprisionante', dmg: () => null, media: false,
    desc: 'O espírito cospe uma resina viscosa em uma criatura a até 6 metros. O alvo deve realizar uma Salvaguarda de Agilidade ou recebe a condição "Impedido" até o início do próximo turno do espírito.' },
  { nome: 'Reconfigurar Membros', dmg: () => null, media: false,
    desc: 'O espírito reorganiza o próprio corpo. Até o início de seu próximo turno, ele recebe +1,5 metros de alcance corpo-a-corpo OU +3 metros de deslocamento, à sua escolha.' },
  { nome: 'Marca de Caça', dmg: () => null, media: false,
    desc: 'O espírito marca uma criatura visível a até 3×ND metros. Até o fim do encontro ou até marcar outra criatura, ele recebe +1 de acerto e causa +1d6 de dano contra o alvo marcado.' },
  { nome: 'Esporos Cegantes', dmg: () => null, media: false,
    desc: 'O espírito estala uma bolsa de esporos sobre uma criatura a até 3 metros. O alvo deve realizar uma Salvaguarda de Constituição ou recebe a condição "Cego" até o fim de seu próximo turno.' },
  { nome: 'Sussurro Confuso', dmg: () => null, media: false,
    desc: 'O espírito sussurra mentiras na mente de uma criatura a até 3×ND metros. O alvo deve realizar uma Salvaguarda de Presença ou não pode realizar reações até o início do próximo turno do espírito.' },
  { nome: 'Tentáculo Súbito', dmg: () => null, media: false, extraAtaque: true,
    desc: 'Um tentáculo irrompe do corpo do espírito em uma rolagem de ataque (Comum) adicional contra uma criatura a até 3 metros. Se acertar, o alvo recebe a condição "Agarrado".' },
  { nome: 'Camuflagem Cromática', dmg: () => null, media: false,
    desc: 'O espírito altera a coloração do próprio corpo para se fundir ao ambiente. Se não se mover neste turno, fica efetivamente "Invisível" até o início de seu próximo turno ou até atacar.' },
  { nome: 'Mordida Infecciosa', dmg: () => null, media: false, extraAtaque: true,
    desc: 'O espírito crava as presas em uma rolagem de ataque (Comum) adicional. Se acertar, o alvo deve realizar uma Salvaguarda de Constituição ou recebe a condição "Envenenado" por 1 minuto.' },
  { nome: 'Fenda Instável', dmg: () => null, media: false,
    desc: 'O espírito abre uma pequena fenda no espaço e troca de lugar com uma criatura a até 3×ND metros. A criatura deve realizar uma Salvaguarda de Sabedoria para resistir; em caso de sucesso, a troca não ocorre.' },
  // ── Lote 2 de Ações Bônus (foco em condições/efeitos negativos) ───────────
  { nome: 'Toque Entorpecente', dmg: () => null, media: false,
    desc: 'O espírito toca uma criatura a até 1,5 metros. O alvo deve realizar uma Salvaguarda de Constituição ou recebe a condição "Letárgico" até o início do próximo turno do espírito.' },
  { nome: 'Marca da Fraqueza', dmg: () => null, media: false,
    desc: 'O espírito marca uma criatura a até 3×ND metros. Até o fim de seu próximo turno, o alvo tem desvantagem na próxima Salvaguarda que realizar.' },
  { nome: 'Olhar Vil', dmg: () => null, media: false,
    desc: 'O espírito encara uma criatura a até 3×ND metros. O alvo deve realizar uma Salvaguarda de Sabedoria ou recebe a condição "Amedrontado" até o fim de seu próximo turno.' },
  { nome: 'Jato Cegante', dmg: () => null, media: false,
    desc: 'O espírito lança um fluido sobre os olhos de uma criatura a até 6 metros. O alvo deve realizar uma Salvaguarda de Agilidade ou recebe a condição "Cego" até o fim de seu próximo turno.' },
  { nome: 'Estalo Ensurdecedor', dmg: () => null, media: false,
    desc: 'O espírito produz um estalo agudo. Criaturas a até 3 metros devem realizar uma Salvaguarda de Constituição ou recebem a condição "Surdo" até o fim de seu próximo turno.' },
  { nome: 'Toque Adormecedor', dmg: () => null, media: false,
    desc: 'O espírito toca uma criatura a até 1,5 metros. O alvo deve realizar uma Salvaguarda de Constituição ou recebe a condição "Sonolento" até o fim de seu próximo turno.' },
  { nome: 'Presas Peçonhentas', dmg: () => null, media: false, extraAtaque: true,
    desc: 'O espírito desfere uma rolagem de ataque (Comum) adicional. Se acertar, o alvo deve realizar uma Salvaguarda de Constituição ou recebe a condição "Envenenado" por 1 minuto.' },
  { nome: 'Passo de Névoa', dmg: () => null, media: false,
    desc: 'O espírito se dissolve em névoa e reaparece a até 1,5×ND metros. Sua Classe de Resistência aumenta em +2 contra a próxima jogada de ataque até seu próximo turno.' },
  { nome: 'Resina Imobilizante', dmg: () => null, media: false,
    desc: 'O espírito cospe uma resina pegajosa numa criatura a até 6 metros. O alvo deve realizar uma Salvaguarda de Agilidade ou recebe a condição "Impedido" até o início do próximo turno do espírito.' },
  { nome: 'Vinha Súbita', dmg: () => null, media: false,
    desc: 'Uma vinha irrompe do chão sob uma criatura a até 3×ND metros. O alvo deve realizar uma Salvaguarda de Força ou recebe a condição "Agarrado"; escapar exige um Teste de Força contra a Classe de Dificuldade do espírito.' },
  { nome: 'Pulso Estonteante', recarga: '5-6', dmg: () => null, media: false,
    desc: 'O espírito emite um pulso de energia amaldiçoada. Uma criatura a até 3×ND metros deve realizar uma Salvaguarda de Intelecto ou recebe a condição "Atordoado" até o fim de seu próximo turno.' },
  { nome: 'Maldição da Lentidão', dmg: () => null, media: false,
    desc: 'O espírito aumenta a gravidade sobre uma criatura a até 3×ND metros, impedindo seu movimento. O alvo deve realizar uma Salvaguarda de Força ou recebe a condição "Pesado" até o início do próximo turno do espírito.' },
  { nome: 'Toque Debilitante', dmg: () => null, media: false,
    desc: 'O espírito drena a força de uma criatura a até 1,5 metros. Até o fim de seu próximo turno, o alvo causa metade do dano com ataques baseados em Força.' },
  { nome: 'Lâmina Sangrenta', dmg: () => null, media: false, extraAtaque: true,
    desc: 'O espírito desfere uma rolagem de ataque (Comum) adicional. Se acertar, o alvo recebe a condição "Sangramento".' },
  { nome: 'Toque Gélido', dmg: nd => ({ qtd: Math.ceil(nd / 3), faces: 6, tipo: 'frio' }), media: false,
    desc: 'O espírito toca uma criatura a até 1,5 metros, causando (⅓ND↑)d6 de dano de frio. O alvo deve realizar uma Salvaguarda de Constituição ou recebe a condição "Hipotérmico" até o fim de seu próximo turno.' },
  { nome: 'Toque Flamejante', dmg: nd => ({ qtd: Math.ceil(nd / 3), faces: 6, tipo: 'fogo' }), media: false, extraAtaque: true,
    desc: 'O espírito desfere uma rolagem de ataque (Comum) adicional com chamas, causando (⅓ND↑)d6 de dano de fogo extra. Se acertar, o alvo recebe a condição "Queimado".' },
  { nome: 'Grito de Pavor', dmg: () => null, media: false,
    desc: 'O espírito solta um grito aterrador contra uma criatura a até 3×ND metros. O alvo deve realizar uma Salvaguarda de Sabedoria ou recebe a condição "Amedrontado", ficando também "Caído" se falhar por 5 ou mais.' },
  { nome: 'Tropeço Espectral', dmg: () => null, media: false,
    desc: 'Garras espectrais agarram os pés de uma criatura a até 3 metros. O alvo deve realizar uma Salvaguarda de Agilidade ou recebe a condição "Caído".' },
  { nome: 'Maldição Silenciadora', dmg: () => null, media: false,
    desc: 'O espírito sela a garganta de uma criatura a até 3×ND metros. O alvo deve realizar uma Salvaguarda de Intelecto ou recebe a condição "Mudo" até o início do próximo turno do espírito.' },
  { nome: 'Corromper a Mente', dmg: () => null, media: false,
    desc: 'O espírito injeta imagens caóticas na mente de uma criatura a até 3×ND metros. O alvo deve realizar uma Salvaguarda de Presença ou recebe a condição "Alucinado" até o fim de seu próximo turno.' },
  { nome: 'Garra Trêmula', dmg: () => null, media: false,
    desc: 'O espírito crava energia instável numa criatura a até 1,5 metros. O alvo deve realizar uma Salvaguarda de Constituição ou recebe a condição "Estremecido" até o fim de seu próximo turno.' },
  { nome: 'Toque Drenante', dmg: nd => ({ qtd: Math.ceil(nd / 3), faces: 6, tipo: 'energia' }), media: false,
    desc: 'O espírito toca uma criatura a até 1,5 metros, causando (⅓ND↑)d6 de dano e recuperando Pontos de Vida iguais ao dano causado.' },
  { nome: 'Maldição da Exaustão', recarga: '5-6', dmg: () => null, media: false,
    desc: 'O espírito acelera o cansaço de uma criatura a até 3×ND metros. O alvo deve realizar uma Salvaguarda de Constituição ou recebe 1 nível da condição "Exausto".' },
  { nome: 'Espinhos Súbitos', dmg: () => null, media: false,
    desc: 'O espírito cobre seu corpo de espinhos até o início de seu próximo turno. Qualquer criatura que o atinja com um ataque corpo-a-corpo nesse período sofre 1d6 de dano perfurante.' },
  { nome: 'Manto de Escuridão', dmg: () => null, media: false,
    desc: 'O espírito apaga a luz numa área com raio de 3 metros ao seu redor até o início de seu próximo turno. Criaturas sem visão no escuro dentro da área ficam efetivamente cegas (recebem a condição "Cego").' },
  { nome: 'Salto Esmagador', dmg: () => null, media: false,
    desc: 'O espírito salta e aterrissa perto de uma criatura a até 6 metros. O alvo deve realizar uma Salvaguarda de Força ou recebe a condição "Caído".' },
  { nome: 'Toque Embriagante', dmg: () => null, media: false,
    desc: 'O espírito libera esporos tontos sobre uma criatura a até 3 metros. O alvo deve realizar uma Salvaguarda de Constituição ou recebe a condição "Bêbado" até o fim de seu próximo turno.' },
  { nome: 'Marca da Morte', dmg: () => null, media: false,
    desc: 'O espírito marca uma criatura visível a até 3×ND metros. O próximo dano que ela sofrer antes do fim do próximo turno do espírito é aumentado em (½ND↑).' },
  { nome: 'Bruma Tóxica', dmg: () => null, media: false,
    desc: 'O espírito exala uma bruma venenosa em um cone de 3 metros. As criaturas na área devem realizar uma Salvaguarda de Constituição ou recebem a condição "Envenenado" até o fim de seu próximo turno.' },
  { nome: 'Reflexo Acelerado', dmg: () => null, media: false,
    desc: 'O espírito antecipa os golpes. Até o início de seu próximo turno, ele recebe +2 de Classe de Resistência e vantagem em Salvaguardas de Agilidade.' },
  { nome: 'Olhar Confuso', dmg: () => null, media: false,
    desc: 'O espírito turva a percepção de uma criatura a até 3×ND metros. O alvo deve realizar uma Salvaguarda de Presença ou ataca um alvo aleatório (à escolha do narrador) em seu próximo turno.' },
  { nome: 'Sopro Paralisante', recarga: '5-6', dmg: () => null, media: false,
    desc: 'O espírito exala um gás rígido sobre uma criatura a até 6 metros. O alvo deve realizar uma Salvaguarda de Constituição ou recebe a condição "Paralisado" até o fim de seu próximo turno.' },
  { nome: 'Carga Trovejante', dmg: nd => ({ qtd: Math.ceil(nd / 3), faces: 6, tipo: 'trovejante' }), media: false,
    desc: 'O espírito avança contra uma criatura a até 6 metros, causando (⅓ND↑)d6 de dano trovejante. O alvo deve realizar uma Salvaguarda de Constituição ou recebe a condição "Atordoado" até o fim de seu próximo turno.' },
  { nome: 'Faísca Reativa', dmg: nd => ({ qtd: Math.ceil(nd / 3), faces: 6, tipo: 'elétrico' }), media: false, extraAtaque: true,
    desc: 'O espírito desfere uma rolagem de ataque (Comum) adicional carregada de eletricidade, causando (⅓ND↑)d6 de dano elétrico extra. Se acertar, o alvo não pode realizar reações até o início do próximo turno do espírito.' },
  { nome: 'Olhar Imobilizante', dmg: () => null, media: false,
    desc: 'O espírito fixa o olhar numa criatura a até 3 metros. O alvo deve realizar uma Salvaguarda de Intelecto ou recebe a condição "Impedido" até o fim de seu próximo turno.' },
  { nome: 'Sussurro Desencorajador', dmg: () => null, media: false,
    desc: 'O espírito sussurra dúvidas na mente de uma criatura a até 3×ND metros. O alvo deve realizar uma Salvaguarda de Presença ou tem desvantagem em sua próxima rolagem de ataque.' },
  { nome: 'Toque Ácido', dmg: nd => ({ qtd: Math.ceil(nd / 3), faces: 6, tipo: 'ácido' }), media: false,
    desc: 'O espírito toca uma criatura a até 1,5 metros, causando (⅓ND↑)d6 de dano ácido e reduzindo a Classe de Resistência dela em 1 até o fim de seu próximo turno.' },
  { nome: 'Convocar Frieza', dmg: () => null, media: false,
    desc: 'O ar congela ao redor de uma criatura a até 3×ND metros. O alvo deve realizar uma Salvaguarda de Constituição ou tem seu deslocamento reduzido à metade até o fim de seu próximo turno.' },
  { nome: 'Aperto Sufocante', dmg: () => null, media: false,
    desc: 'O espírito comprime o ar na garganta de uma criatura agarrada por ele. O alvo deve realizar uma Salvaguarda de Constituição ou recebe a condição "Sufocado".' },
  { nome: 'Investida Cega', dmg: () => null, media: false,
    desc: 'O espírito ataca em fúria. Até o fim do turno, suas rolagens de ataque têm vantagem, mas as jogadas de ataque contra ele têm vantagem até o início de seu próximo turno.' },
];

// ─── MALDIÇÕES: Habilidades de Reação ─────────────────────────────────────────

const REACAO_MALDICAO = [
  { nome: 'Reflexo Amaldiçoado', dmg: () => null, media: false,
    desc: 'Quando o espírito for alvo de uma rolagem de ataque, ele pode aumentar sua própria Classe de Resistência em +3. Se a criatura errar o ataque, o espírito pode realizar uma rolagem de ataque (Comum) contra a criatura atacante. O bônus de Classe de Resistência aumenta em +1 para cada 5 de ND que o espírito possuir.' },
  { nome: 'Distorção Defensiva', reduz: nd => ({ qtd: nd, faces: 8 }), dmg: () => null, media: false,
    desc: 'Quando o espírito for alvo de um ataque, técnica, ou tiver que realizar uma Salvaguarda para sofrer todo ou metade do dano, ele pode ativar esta habilidade para reduzir o dano sofrido em (ND)d8.\nEssa característica só pode ser usada uma vez por rodada, mesmo que o espírito possua mais de uma reação.' },
  { nome: 'Rejeição Violenta', dmg: () => null, media: false,
    desc: 'Quando uma criatura a até 3 metros do espírito realizar um ataque que tenha ele como alvo, ele pode usar sua reação para liberar uma onda de energia amaldiçoada. O alvo deve realizar uma Salvaguarda de Força para não ser empurrado a uma distância de 1,5m×ND e receber a condição "Caído".' },
  { nome: 'Movimento Maldito', dmg: () => null, media: false,
    desc: 'Quando for alvo de um ataque (Comum), o espírito pode desaparecer e reaparecer em um local a uma distância de 1,5×ND metros, desviando automaticamente do ataque.' },
  { nome: 'Apetite Voraz', recarga: '4-6', reduz: nd => ({ qtd: Math.floor(nd / 2), faces: 8 }), dmg: () => null, media: false,
    desc: 'Quando o espírito for alvo de um ataque que gaste Pontos de Energia Amaldiçoada, ele pode usar sua reação para reduzir o dano em (½ND↓)d8 e recuperar uma quantidade de Pontos de Vida equivalente ao dano reduzido.' },
  { nome: 'Visão da Desgraça', recarga: '4-6', dmg: () => null, media: false,
    desc: 'Quando uma criatura a até 3×ND metros do espírito realizar um ataque, conjurar um feitiço ou ativar uma habilidade que consuma Pontos de Energia Amaldiçoada, ela deve realizar uma Salvaguarda de Sabedoria. Em caso de falha, ela sofre 1d8 de dano psíquico para cada Ponto de Energia Amaldiçoada consumido pela técnica, e a técnica falha.' },
  { nome: 'Persistência Maldita', dmg: () => null, media: false,
    desc: 'Quando o espírito seria reduzido a 0 Pontos de Vida, ele desaparece e se forma em um local a uma distância de 3×ND metros, com 1 Ponto de Vida. Essa característica é recuperada após 10 minutos.' },
  { nome: 'Marca Reativa', dmg: () => null, media: false,
    desc: 'Quando o espírito sofrer dano de uma criatura, ele pode marcar esse alvo. Enquanto a marca estiver ativa, o espírito tem vantagem em suas rolagens de ataque contra essa criatura até o início de seu próximo turno.' },
  { nome: 'Ruptura de Concentração', dmg: () => null, media: false,
    desc: 'Quando o espírito sofrer um acerto crítico, ele pode ativar esta habilidade para enviar uma grande quantidade de energia negativa ao corpo da criatura. Isso cancela todas as habilidades do alvo que exijam "Concentração", bem como uma habilidade adicional aleatória com duração de 1 minuto ou mais.' },
  { nome: 'Corpo Intangível', dmg: () => null, media: false,
    desc: 'Quando o espírito sofrer qualquer tipo de dano, ele pode reduzir esse dano pela metade e se tornar intangível até o final do turno atual.' },
  { nome: 'Eco Violento', recarga: '4-6', dmg: nd => ({ qtd: Math.floor(nd / 2), faces: 8, tipo: 'psíquico' }), media: false,
    desc: 'Quando o espírito sofrer qualquer quantidade de dano, o atacante sofre (½ND↓)d8 de dano psíquico.' },
  { nome: 'Aura de Lentidão', dmg: () => null, media: false,
    desc: 'Quando o espírito for alvo de uma jogada de ataque ou técnica, ele libera uma aura de lentidão em um raio de 3 metros ao seu redor. Todas as criaturas dentro do alcance devem realizar uma Salvaguarda de Sabedoria. Em caso de falha, ficam limitadas a realizar apenas uma jogada de ataque (Comum) por turno até o fim de seus respectivos turnos.' },
  { nome: 'Deslocamento Caótico', dmg: () => null, media: false,
    desc: 'Quando o espírito for alvo de uma jogada de ataque (Comum) à distância, ele pode redirecionar o ataque para outra criatura a até 3 metros dele.[ND12: Ele também pode redirecionar técnicas, mas essa habilidade possui recarga de 5–6.]' },
  // ── Novas Reações ────────────────────────────────────────────────────────
  { nome: 'Contra-Investida', dmg: () => null, media: false,
    desc: 'Quando uma criatura errar uma rolagem de ataque contra o espírito, ele pode realizar imediatamente uma rolagem de ataque (Comum) contra essa criatura.' },
  { nome: 'Casca Refletora', dmg: () => null, media: false,
    desc: 'Quando o espírito sofrer dano de um ataque à distância, ele pode refletir metade desse dano de volta ao atacante, que deve realizar uma Salvaguarda de Agilidade para reduzir o reflexo à metade.' },
  { nome: 'Espinhos Reativos', dmg: nd => ({ qtd: Math.floor(nd / 2), faces: 8, tipo: 'perfurante' }), media: false,
    desc: 'Quando uma criatura atingir o espírito com um ataque corpo-a-corpo, espinhos irrompem de seu corpo e a criatura sofre (½ND↓)d8 de dano perfurante.' },
  { nome: 'Recuo Fantasma', dmg: () => null, media: false,
    desc: 'Quando o espírito for alvo de uma rolagem de ataque, ele pode se tornar intangível e deslizar 1,5×ND metros antes de o ataque ser resolvido; se sair do alcance, o ataque falha.' },
  { nome: 'Maldição de Espelho', dmg: () => null, media: false,
    desc: 'Quando o espírito falhar em uma Salvaguarda forçada por uma criatura, ele pode obrigar essa criatura a realizar a mesma Salvaguarda; em caso de falha dela, o efeito também a atinge.' },
  { nome: 'Substituição Sombria', dmg: () => null, media: false,
    desc: 'Quando o espírito for alvo de uma rolagem de ataque, ele pode trocar de lugar com uma criatura aliada a até 3×ND metros, que se torna o novo alvo do ataque.' },
  { nome: 'Lufada Repulsora', dmg: () => null, media: false,
    desc: 'Quando uma criatura entrar a até 1,5 metros do espírito, ele pode liberar uma lufada de energia. A criatura deve realizar uma Salvaguarda de Força ou é empurrada 3 metros e recebe a condição "Caído".' },
  { nome: 'Grito de Dor', recarga: '5-6', dmg: () => null, media: false,
    desc: 'Quando o espírito sofrer dano, ele solta um grito agonizante. Todas as criaturas a até 3 metros devem realizar uma Salvaguarda de Constituição ou recebem a condição "Atordoado" até o fim de seu próximo turno.' },
  { nome: 'Absorção Parcial', reduz: nd => ({ qtd: Math.floor(nd / 2), faces: 8 }), dmg: () => null, media: false,
    desc: 'Quando o espírito sofrer dano, ele pode reduzi-lo em (½ND↓)d8 e recuperar Pontos de Vida iguais à metade do valor reduzido.' },
  { nome: 'Olhar Mortal', dmg: () => null, media: false,
    desc: 'Quando uma criatura realizar uma rolagem de ataque contra o espírito, ele pode encará-la. A criatura deve realizar uma Salvaguarda de Sabedoria ou recebe a condição "Amedrontado" até o fim de seu próximo turno.' },
  { nome: 'Endurecimento Reflexo', dmg: () => null, media: false,
    desc: 'Quando o espírito for alvo de uma rolagem de ataque, ele pode aumentar a própria Classe de Resistência em +(½ND↓) contra esse ataque.' },
  { nome: 'Substância Viscosa', dmg: () => null, media: false,
    desc: 'Quando uma criatura atingir o espírito com um ataque corpo-a-corpo, ela deve realizar uma Salvaguarda de Agilidade ou recebe a condição "Impedido" até o início do próximo turno do espírito, presa à substância pegajosa do corpo dele.' },
  { nome: 'Resposta Tóxica', dmg: () => null, media: false,
    desc: 'Quando o espírito sofrer dano corpo-a-corpo, o atacante deve realizar uma Salvaguarda de Constituição ou recebe a condição "Envenenado" por 1 minuto.' },
  { nome: 'Distorção Evasiva', recarga: '5-6', dmg: () => null, media: false,
    desc: 'Quando o espírito for alvo de um efeito que exija uma Salvaguarda de Agilidade para sofrer todo ou metade do dano, ele obtém sucesso automático e não sofre dano algum.' },
  { nome: 'Casulo Instantâneo', recarga: '4-6', dmg: () => null, media: false,
    desc: 'Quando o espírito sofreria, de uma só vez, dano que reduziria seus Pontos de Vida em mais de um quarto do máximo, ele pode se encasular: o dano é reduzido à metade e ele ganha resistência a todo dano até o início de seu próximo turno, mas fica "Incapacitado" nesse período.' },
  { nome: 'Eco da Agonia', dmg: () => null, media: false,
    desc: 'Quando uma criatura a até 3×ND metros do espírito for reduzida a 0 Pontos de Vida, o espírito recupera 1d8 Pontos de Vida e tem vantagem em sua próxima rolagem de ataque.' },
  { nome: 'Reflexo Espinhoso', dmg: nd => ({ qtd: Math.floor(nd / 2), faces: 6, tipo: 'perfurante' }), media: false,
    desc: 'Quando uma criatura iniciar seu turno agarrando o espírito ou agarrada por ele, ela sofre (½ND↓)d6 de dano perfurante.' },
  { nome: 'Pulso de Pânico', recarga: '5-6', dmg: () => null, media: false,
    desc: 'Quando o espírito for reduzido a menos da metade dos Pontos de Vida, ele emite um pulso de terror. Todas as criaturas a até 3×ND metros devem realizar uma Salvaguarda de Presença ou recebem a condição "Amedrontado" até o fim de seu próximo turno.' },
  { nome: 'Maldição de Troca', dmg: () => null, media: false,
    desc: 'Quando o espírito sofrer um acerto crítico, ele pode transferir metade do dano sofrido para uma criatura aliada a até 3 metros, sem que ela possa resistir.' },
  // ── Lote 2 de Reações (foco em condições/efeitos negativos) ───────────────
  { nome: 'Contra-Veneno', dmg: () => null, media: false,
    desc: 'Quando o espírito for atingido por um ataque corpo-a-corpo, o atacante deve realizar uma Salvaguarda de Constituição ou recebe a condição "Envenenado" até o fim de seu próximo turno.' },
  { nome: 'Repelir Sombrio', dmg: () => null, media: false,
    desc: 'Quando o espírito for alvo de uma jogada de ataque, ele libera uma onda escura. O atacante deve realizar uma Salvaguarda de Força ou é empurrado 3 metros e recebe a condição "Caído".' },
  { nome: 'Grito Reativo', recarga: '5-6', dmg: () => null, media: false,
    desc: 'Quando o espírito sofrer dano, ele solta um grito. Criaturas a até 3 metros devem realizar uma Salvaguarda de Constituição ou recebem a condição "Atordoado" até o fim de seu próximo turno.' },
  { nome: 'Pele Gélida', dmg: () => null, media: false,
    desc: 'Quando uma criatura atingir o espírito com um ataque corpo-a-corpo, ela deve realizar uma Salvaguarda de Constituição ou recebe a condição "Hipotérmico" até o fim de seu próximo turno.' },
  { nome: 'Cinzas Reativas', dmg: () => null, media: false,
    desc: 'Quando uma criatura atingir o espírito com um ataque corpo-a-corpo, ela deve realizar uma Salvaguarda de Agilidade ou recebe a condição "Queimado".' },
  { nome: 'Vínculo Doloroso', dmg: () => null, media: false,
    desc: 'Quando o espírito sofrer dano de uma criatura, ele pode vinculá-la: ela sofre metade do dano que o espírito recebeu, como dano psíquico.' },
  { nome: 'Reflexo Cegante', dmg: () => null, media: false,
    desc: 'Quando o espírito for alvo de uma jogada de ataque, ele emite um clarão de energia amaldiçoada. O atacante deve realizar uma Salvaguarda de Intelecto ou recebe a condição "Cego" até o fim de seu próximo turno.' },
  { nome: 'Lamento Reflexo', dmg: () => null, media: false,
    desc: 'Quando o espírito sofrer dano, o atacante deve realizar uma Salvaguarda de Constituição ou recebe a condição "Surdo" até o fim de seu próximo turno.' },
  { nome: 'Teia Reativa', dmg: () => null, media: false,
    desc: 'Quando uma criatura a até 3 metros atacar o espírito, ele lança uma teia. O alvo deve realizar uma Salvaguarda de Agilidade ou recebe a condição "Impedido" até o início do próximo turno do espírito.' },
  { nome: 'Maldição Espinhenta', dmg: nd => ({ qtd: Math.ceil(nd / 3), faces: 6, tipo: 'perfurante' }), media: false,
    desc: 'Quando uma criatura atingir o espírito com um ataque corpo-a-corpo, ela sofre (⅓ND↑)d6 de dano perfurante e deve realizar uma Salvaguarda de Constituição ou recebe a condição "Sangramento".' },
  { nome: 'Bruma Defensiva', dmg: () => null, media: false,
    desc: 'Quando o espírito for alvo de um ataque à distância, ele se envolve em bruma e o atacante tem desvantagem nessa jogada de ataque.' },
  { nome: 'Recuo Tóxico', recarga: '4-6', dmg: () => null, media: false,
    desc: 'Quando o espírito for alvo de um ataque, ele recua 1,5×ND metros e deixa uma nuvem de veneno no lugar; criaturas que terminarem o turno na nuvem recebem a condição "Envenenado".' },
  { nome: 'Aura de Terror Reflexa', recarga: '5-6', dmg: () => null, media: false,
    desc: 'Quando o espírito for reduzido a menos da metade dos Pontos de Vida, todas as criaturas a até 3×ND metros devem realizar uma Salvaguarda de Sabedoria ou recebem a condição "Amedrontado" até o fim de seu próximo turno.' },
  { nome: 'Lentidão Punitiva', dmg: () => null, media: false,
    desc: 'Quando uma criatura atingir o espírito com um ataque, ela deve realizar uma Salvaguarda de Constituição ou tem seu deslocamento reduzido à metade até o fim de seu próximo turno.' },
  { nome: 'Resposta Atordoante', dmg: () => null, media: false,
    desc: 'Quando o espírito sofrer um acerto crítico, o atacante deve realizar uma Salvaguarda de Constituição ou recebe a condição "Atordoado" até o fim de seu próximo turno.' },
  { nome: 'Drenar ao Ferir', dmg: () => null, media: false,
    desc: 'Quando o espírito sofrer dano corpo-a-corpo, ele recupera (½ND↓) Pontos de Vida absorvendo a energia do atacante.' },
  { nome: 'Maldição da Queda', dmg: () => null, media: false,
    desc: 'Quando uma criatura errar um ataque corpo-a-corpo contra o espírito, ela deve realizar uma Salvaguarda de Agilidade ou recebe a condição "Caído".' },
  { nome: 'Eco Mental', dmg: nd => ({ qtd: Math.ceil(nd / 3), faces: 6, tipo: 'psíquico' }), media: false,
    desc: 'Quando uma criatura a até 3×ND metros ativar uma técnica, ela deve realizar uma Salvaguarda de Presença ou sofre (⅓ND↑)d6 de dano psíquico.' },
  { nome: 'Sopro Reativo', recarga: '4-6', dmg: nd => ({ qtd: Math.ceil(nd / 3), faces: 6, tipo: 'energia' }), media: false,
    desc: 'Quando uma criatura entrar a até 3 metros do espírito, ele exala um cone. A criatura deve realizar uma Salvaguarda de Agilidade ou sofre (⅓ND↑)d6 de dano.' },
  { nome: 'Explosão Defensiva', recarga: '5-6', dmg: nd => ({ qtd: Math.ceil(nd / 3), faces: 6, tipo: 'fogo' }), media: false,
    desc: 'Quando o espírito sofrer dano, ele explode em chamas. Criaturas a até 3 metros sofrem (⅓ND↑)d6 de dano de fogo e recebem a condição "Queimado" se falharem numa Salvaguarda de Agilidade.' },
  { nome: 'Permuta Ilusória', dmg: () => null, media: false,
    desc: 'Quando o espírito for alvo de uma jogada de ataque, ele troca de lugar com uma ilusão de si mesmo a até 3×ND metros; o ataque atinge a ilusão e falha.' },
  { nome: 'Olhar Endurecedor', dmg: () => null, media: false,
    desc: 'Quando uma criatura atacar o espírito, ela deve realizar uma Salvaguarda de Constituição ou recebe a condição "Impedido" até o fim de seu próximo turno.' },
  { nome: 'Resposta Sonora', dmg: nd => ({ qtd: Math.ceil(nd / 3), faces: 6, tipo: 'trovejante' }), media: false,
    desc: 'Quando o espírito sofrer dano, o atacante sofre (⅓ND↑)d6 de dano trovejante e deve realizar uma Salvaguarda de Constituição ou recebe a condição "Surdo".' },
  { nome: 'Reflexo Apavorante', dmg: () => null, media: false,
    desc: 'Quando uma criatura realizar uma jogada de ataque contra o espírito, ela deve realizar uma Salvaguarda de Sabedoria ou recebe a condição "Amedrontado" e ataca com desvantagem nesse turno.' },
  { nome: 'Carapaça Reativa', dmg: () => null, media: false,
    desc: 'Quando o espírito sofrer dano, ele endurece: ganha +2 de Classe de Resistência e resistência ao tipo de dano sofrido até o início de seu próximo turno.' },
  { nome: 'Veneno Borbulhante', dmg: () => null, media: false,
    desc: 'Quando o espírito sofrer dano, todas as criaturas a até 1,5 metros devem realizar uma Salvaguarda de Constituição ou recebem a condição "Envenenado" até o fim de seu próximo turno.' },
  { nome: 'Frieza Punitiva', dmg: () => null, media: false,
    desc: 'Quando uma criatura atingir o espírito com um ataque corpo-a-corpo, ela deve realizar uma Salvaguarda de Constituição ou recebe a condição "Hipotérmico" e tem o deslocamento reduzido à metade até o fim de seu próximo turno.' },
  { nome: 'Esporos Reativos', dmg: () => null, media: false,
    desc: 'Quando uma criatura atingir o espírito com um ataque corpo-a-corpo, ela deve realizar uma Salvaguarda de Constituição ou recebe a condição "Sonolento" até o fim de seu próximo turno.' },
  { nome: 'Recuo Instantâneo', dmg: () => null, media: false,
    desc: 'Quando o espírito for alvo de uma jogada de ataque, ele se desloca 3 metros sem provocar reações antes de o ataque ser resolvido.' },
  { nome: 'Maldição do Eco', dmg: nd => ({ qtd: Math.ceil(nd / 3), faces: 6, tipo: 'energia' }), media: false,
    desc: 'Quando uma criatura a até 3×ND metros do espírito conjurar uma técnica que gaste Pontos de Energia Amaldiçoada, ela sofre (⅓ND↑)d6 de dano de energia.' },
  { nome: 'Punir Movimento', dmg: nd => ({ qtd: Math.ceil(nd / 3), faces: 6, tipo: 'energia' }), media: false,
    desc: 'Quando uma criatura sair do alcance corpo-a-corpo do espírito, ela sofre (⅓ND↑)d6 de dano e deve realizar uma Salvaguarda de Agilidade ou recebe a condição "Impedido".' },
  { nome: 'Casulo de Trevas', dmg: () => null, media: false,
    desc: 'Quando o espírito sofrer dano, ele se envolve em sombras: rolagens de ataque contra ele têm desvantagem até o início de seu próximo turno.' },
  { nome: 'Resposta Ácida', dmg: () => null, media: false,
    desc: 'Quando uma criatura atingir o espírito com um ataque corpo-a-corpo, a arma ou membro usado é corroído: o atacante acumula −1 de dano até reparar ou descansar.' },
  { nome: 'Grito Final', dmg: () => null, media: false,
    desc: 'Quando o espírito for reduzido a 0 Pontos de Vida, ele solta um último grito. Criaturas a até 3×ND metros devem realizar uma Salvaguarda de Constituição ou recebem a condição "Atordoado" até o fim de seu próximo turno.' },
  { nome: 'Maldição Reativa do Peso', dmg: () => null, media: false,
    desc: 'Quando uma criatura atacar o espírito, ela deve realizar uma Salvaguarda de Força ou recebe a condição "Pesado" até o início do próximo turno do espírito.' },
  { nome: 'Reflexo Embriagante', dmg: () => null, media: false,
    desc: 'Quando uma criatura atingir o espírito com um ataque corpo-a-corpo, ela deve realizar uma Salvaguarda de Constituição ou recebe a condição "Bêbado" até o fim de seu próximo turno.' },
  { nome: 'Espelho Doloroso', dmg: () => null, media: false,
    desc: 'Quando o espírito for forçado a realizar uma Salvaguarda por uma criatura, ele pode obrigar essa criatura a realizar a mesma Salvaguarda; em caso de falha, ela sofre o mesmo efeito.' },
  { nome: 'Aura de Decadência', dmg: () => null, media: false,
    desc: 'Quando o espírito sofrer dano, todas as criaturas a até 1,5 metros têm desvantagem na próxima rolagem de ataque até o fim de seu próximo turno.' },
  { nome: 'Contra-Olhar', dmg: () => null, media: false,
    desc: 'Quando uma criatura realizar uma jogada de ataque contra o espírito usando a visão, ela deve realizar uma Salvaguarda de Intelecto ou recebe a condição "Cego" até o fim de seu próximo turno.' },
  { nome: 'Rejeição Paralisante', recarga: '5-6', dmg: () => null, media: false,
    desc: 'Quando o espírito for atingido por um ataque corpo-a-corpo, o atacante deve realizar uma Salvaguarda de Constituição ou recebe a condição "Paralisado" até o fim de seu próximo turno.' },
];

// ─── MALDIÇÕES: Aspectos (traços passivos) ────────────────────────────────────
// Passivos (sentidos, resistências, auras, regeneração) — sem rolagem de dano
// própria. Tokens de ND no texto são resolvidos normalmente.

const ASPECTOS_MALDICAO = [
  { nome: 'Fúria Vingativa',
    desc: 'Quando o espírito for reduzido a menos da metade de seus Pontos de Vida pela primeira vez, ele entra em frenesi: até o fim do encontro, causa +1d6 de dano em todos os seus ataques.' },
  { nome: 'Regeneração Amaldiçoada',
    desc: 'No início de cada um de seus turnos, o espírito recupera (½ND↑) Pontos de Vida, a menos que tenha sofrido dano de fogo ou ácido desde seu último turno.' },
  { nome: 'Forma Amorfa',
    desc: 'O espírito pode se espremer por qualquer espaço de pelo menos 2,5 centímetros de largura sem que isso lhe custe ação ou deslocamento extra.' },
  { nome: 'Visão na Escuridão',
    desc: 'O espírito enxerga normalmente na escuridão, mágica ou não, a até 3×ND metros.' },
  { nome: 'Sentido Sísmico',
    desc: 'O espírito percebe a localização de qualquer criatura em contato com o solo a até 3×ND metros, mesmo sem visão.' },
  { nome: 'Aparição Aterradora',
    desc: 'A primeira vez que uma criatura vê o espírito em um encontro, ela deve realizar uma Salvaguarda de Sabedoria ou recebe a condição "Amedrontado" enquanto puder vê-lo.' },
  { nome: 'Corpo Venenoso',
    desc: 'Uma criatura que toque o espírito ou o atinja com um ataque corpo-a-corpo desarmado deve realizar uma Salvaguarda de Constituição ou recebe a condição "Envenenado" até o fim de seu próximo turno.' },
  { nome: 'Resistência Aberrante',
    desc: 'O espírito tem resistência a dano contundente, cortante e perfurante de fontes não-amaldiçoadas.' },
  { nome: 'Imunidade Mental',
    desc: 'O espírito é imune a dano psíquico e às condições "Amedrontado", "Enfeitiçado" e "Alucinado".' },
  { nome: 'Membros Regenerativos',
    desc: 'Membros decepados do espírito continuam se movendo e podem ser reconectados; o espírito não fica incapacitado por perda de membros.' },
  { nome: 'Deslizar nas Sombras',
    desc: 'Enquanto estiver em uma área de penumbra ou escuridão, o deslocamento do espírito aumenta em 3 metros e seus movimentos não provocam reações.' },
  { nome: 'Pele Camaleônica',
    desc: 'O espírito tem vantagem em testes para se esconder enquanto estiver parado, podendo se ocultar mesmo apenas levemente obscurecido.' },
  { nome: 'Sangue Corrosivo',
    desc: 'Sempre que o espírito sofrer dano cortante ou perfurante de um ataque corpo-a-corpo, a criatura que causou o dano sofre (⅓ND↑) de dano ácido.' },
  { nome: 'Presença Sufocante',
    desc: 'Toda criatura que iniciar seu turno a até 1,5 metros do espírito tem desvantagem na primeira Salvaguarda que realizar naquele turno.' },
  { nome: 'Múltiplos Olhos',
    desc: 'O espírito não pode ser surpreendido e ataques contra ele não recebem vantagem por partirem de fora de seu campo de visão.' },
  { nome: 'Teia de Energia',
    desc: 'O terreno a até 1,5×ND metros do espírito é considerado terreno difícil para todas as outras criaturas.' },
  { nome: 'Mente Coletiva',
    desc: 'O espírito compartilha visão e audição com outras maldições a até 30 metros e tem vantagem em rolagens de ataque contra alvos que um aliado seu possa ver.' },
  { nome: 'Anfíbio',
    desc: 'O espírito respira ar e água e possui deslocamento de natação igual ao seu deslocamento normal.' },
  { nome: 'Escalador Aderente',
    desc: 'O espírito pode escalar superfícies difíceis, inclusive de cabeça para baixo em tetos, sem precisar de teste.' },
  { nome: 'Aura Corrosiva',
    desc: 'Armas não-amaldiçoadas que atinjam o espírito em corpo-a-corpo acumulam −1 de dano a cada acerto, até serem destruídas ou reparadas.' },
  { nome: 'Corpo Falso',
    desc: 'A primeira vez por encontro em que o espírito seria reduzido a 0 Pontos de Vida, em vez disso ele se revela um chamariz e ressurge ileso a até 3×ND metros. Isso não funciona contra dano causado dentro de uma Expansão de Domínio.' },
];

// ─── MALDIÇÕES: Habilidades com Barreiras ─────────────────────────────────────
// Barreira padrão: PV 20×ND · CR 15+ND · raio 1,5–6m × ND.

const HABILIDADES_BARREIRA = [
  { nome: 'Santuário da Morte', desc: 'Uma barreira que toma a forma de um espaço vazio cheio de caveiras e ossos espalhados por todo o local; normalmente é formada por criaturas com grande sede de sangue. Enquanto essa habilidade estiver manifestada, o usuário causa 2 dados de dano adicionais em todos os seus ataques e técnicas e recebe +1 de Classe de Resistência.' },
  { nome: 'Estreito Espaço-Temporal', desc: 'Uma barreira que normalmente toma a forma de um túnel ou corredor interminável, refazendo o loop a cada 30 metros; cada 1 hora aqui dentro equivale a 1 dia do lado de fora. A cada loop que a criatura realizar, ela perde 10 Pontos de Energia Amaldiçoada da Energia Total sem perceber, mas pode realizar uma Salvaguarda de Sabedoria (Classe de Dificuldade 18) a cada loop para tentar notar que há algo errado e localizar a criatura que o está criando.' },
  { nome: 'Inferno Sacrifical', desc: 'Uma barreira que toma a forma de uma caverna cheia de núcleos (espíritos menores) presos a pontos no chão. Cada vez que uma criatura morre dentro dela, um novo núcleo se forma. O espírito pode sacrificar qualquer quantidade de núcleos para receber um ou mais benefícios:\n• Recupera 20 Pontos de Vida por sacrifício;\n• Os ataques e técnicas causam 1 dado de dano adicional por sacrifício até o início do próximo turno (máximo 2);\n• Aumenta a Classe de Dificuldade de um efeito ou condição em +1 por sacrifício.\nCada núcleo possui 30 Pontos de Vida e 15 de Classe de Resistência e é considerado uma criatura.' },
  { nome: 'Loop Temporal Completo', desc: 'Uma barreira que não muda a aparência do local: um espaço vazio que reverte o tempo de uma área a cada X horas, mas apenas o tempo de coisas orgânicas, sem afetar objetos, estruturas ou o inanimado. A cada vez que o tempo volta, todas as criaturas perdem as memórias, a menos que passem em um Teste de Intelecto (Classe de Dificuldade 20) — em caso de sucesso, retêm até 5 minutos de informação do ciclo anterior. Essa habilidade tem um núcleo dentro da zona afetada, que deve ser desativado para desfazê-la; o método de desativação pode ser outro que não a destruição.' },
  { nome: 'Espaço do Sono Eterno', desc: 'Uma barreira que faz todas as criaturas em sua zona adormecerem com o passar do tempo, para nunca acordarem. A cada 1 minuto dentro da área, as criaturas devem realizar uma Salvaguarda de Constituição (Classe de Dificuldade 1). Em caso de falha, caem no sono até sofrerem dano ou serem acordadas. A cada 1 minuto que permanecem dentro da habilidade, a Classe de Dificuldade aumenta em +1. Eventualmente, todas morrem de fome ou desidratação, alimentando o espírito que criou a barreira.' },
];

// Escapa HTML e converte quebras de linha.

// ── Glue p/ o gerador: lookup por nome + resolução pronta ──────────────────────
const _BY_NOME = new Map();
for (const list of [ACAO_PODER_MALDICAO, ACAO_BONUS_MALDICAO, REACAO_MALDICAO, ASPECTOS_MALDICAO, HABILIDADES_BARREIRA])
  for (const h of list) if (!_BY_NOME.has(h.nome)) _BY_NOME.set(h.nome, h);

const _CAP = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const _dadoStr = (x) => (x && x.qtd != null ? `${Math.max(1, Math.ceil(x.qtd))}d${x.faces}` : '');

// Sufixo escrito do tipo de dano (segue a redação do catálogo: "de energia", "ácido"…).
const _SUFIXO_TIPO_DANO = {
  energia: 'de energia', fogo: 'de fogo', frio: 'de frio',
  acido: 'ácido', psiquico: 'psíquico', eletrico: 'elétrico', trovejante: 'trovejante',
  contundente: 'contundente', cortante: 'cortante', perfurante: 'perfurante', verdadeiro: 'verdadeiro',
};
const _semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Garante que TODA menção de dano por dado ("XdY de dano") cite o tipo. Só insere quando
// ainda não há um tipo escrito logo após "de dano" (não duplica os já tipados no texto).
function _injetaTipoDano(desc, d) {
  const tipo = d && d.tipo ? d.tipo : '';
  if (!desc || !tipo) return desc;
  const suf = _SUFIXO_TIPO_DANO[_semAcento(tipo)] || tipo;
  return desc.replace(
    /(\d+d\d+(?:\s*[+-]\s*\d+)?\s+de dano)\b(?!\s+(?:de\s+)?(?:energia|fogo|frio|ácido|psíquico|elétrico|trovejante|contundente|cortante|perfurante|verdadeiro))/gi,
    `$1 ${suf}`,
  );
}

// Resolve uma habilidade calibrada por NOME, no ND dado (igual resolveHab do NpcTab):
// dano/cura/redução via dmg(nd) + texto via resolverFormulasND. null se nome ausente.
export function resolverHabCalibrada(nome, nd) {
  const h = _BY_NOME.get(nome);
  if (!h) return null;
  const d = h.dmg ? h.dmg(nd) : null;
  return {
    nome: h.nome,
    recarga: h.recarga || '',
    dano: _dadoStr(d),
    tipo: _CAP(d && d.tipo || ''),
    cura: _dadoStr(h.cura ? h.cura(nd) : null),
    reduz: _dadoStr(h.reduz ? h.reduz(nd) : null),
    desc: _injetaTipoDano(resolverFormulasND(h.desc, nd), d),
  };
}

// Média de dano RESERVADA pelas habilidades selecionadas (Electron): a média das
// médias das que têm media:true + dmg — reserva o espaço de 1 ação de poder/rodada
// no orçamento de dano. Recebe os NOMES das habilidades + o ND.
export function mediaDanoHabilidades(nomes, nd) {
  const medias = [];
  for (const nome of (nomes || [])) {
    const h = _BY_NOME.get(nome);
    if (!h || !h.media || !h.dmg) continue;
    const d = h.dmg(nd);
    if (!d || d.qtd == null) continue;
    medias.push(avgDado(Math.max(1, d.qtd), d.faces));
  }
  return medias.length ? medias.reduce((a, b) => a + b, 0) / medias.length : 0;
}

export { resolverFormulasND, ACAO_PODER_MALDICAO, ACAO_BONUS_MALDICAO, REACAO_MALDICAO, ASPECTOS_MALDICAO, HABILIDADES_BARREIRA };
