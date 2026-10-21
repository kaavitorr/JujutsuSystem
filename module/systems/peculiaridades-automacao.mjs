/**
 * systems/peculiaridades-automacao.mjs
 * Automações das Peculiaridades (2.0) que exigem modificação direta no código —
 * os casos que Active Effects não cobrem: rolagens em gatilhos (início de
 * encontro, descanso, uso de técnica), interrupção de fluxo, aplicação de
 * condições por evento e contadores por descanso.
 *
 * Convenção: a peculiaridade é identificada pelo NOME do feat na ficha
 * (feats da seção jj-peculiarities), com chave estável na tabela
 * PECULIARIDADES abaixo. O item do compendium pode opcionalmente carregar
 * flags["jujutsu-system"].peculiaridade = chave como atalho.
 *
 * Cobertura atual:
 *   02 Ferida Amaldiçoada  — início de encontro: 1d20 ≤ 10 → Incapacitado por
 *                            3 rodadas (1× até o próximo descanso longo).
 *   06 Corpo Exaurido      — fim de combate: Salv. CON contra CD dinâmica
 *                            (18 · +5 por encontro · −5 por descanso longo);
 *                            falha = 1 nível de exaustão.
 *   07 Pesadelos Terríveis — pós-descanso longo: 1d20 ≤ 10 → +1 exaustão
 *                            (acumula até 5; sucesso zera o contador).
 *   12 Azar Absurdo        — 20 natural em d20 próprio → recupera Energia
 *                            Total igual ao atributo de Intelecto.
 *   14 Energia Destrutiva  — usar técnica: dano direto no PV igual ao custo
 *                            em PA consumido.
 *   16 Rastro da Desgraça  — margem do Crítico Excedente vira 8 (usada por
 *                            native-cards via `margemExcedente`).
 *   21 Corpo Frágil        — sofrer ataque comum: +1 dado de dano; sofrer
 *                            técnica: +1/3 dos dados (arredondado p/ cima) ·
 *                            imune à redução de PA das condições.
 *   25 Doença Sobrenatural — crítico próprio: interrompe o dano automático e
 *                            aplica Inconsciente até o fim do próximo turno
 *                            (1×/descanso longo) · imune às condições de DANO.
 *   27 Desejo Sombrio      — rolagem de sessão (1d6 ≥ 4 manifesta) e toggle
 *                            da penalidade −4 em d20 enquanto não cumprido.
 */

import { statusesParaCondicao } from "../applications/actor/jj/conditions.mjs";

/** Chave → nome do feat no compendium. */
export const PECULIARIDADES = Object.freeze({
  "ferida-amaldicoada": "Ferida Amaldiçoada",
  "corpo-exaurido": "Corpo Exaurido",
  "pesadelos-terriveis": "Pesadelos Terríveis",
  "azar-absurdo": "Azar Absurdo",
  "energia-destrutiva": "Energia Destrutiva",
  "rastro-da-desgraca": "Rastro Da Desgraça",
  "corpo-fragil": "Corpo Frágil",
  "doenca-sobrenatural": "Doença Sobrenatural",
  "desejo-sombrio": "Desejo Sombrio"
});

/** O ator possui a peculiaridade (pelo nome do feat da seção jj-peculiarities)? */
export function temPeculiaridade(actor, chave) {
  const nome = PECULIARIDADES[chave];
  if ( !nome || !actor?.items ) return false;
  return actor.items.some(item => item.type === "feat"
    && item.name === nome
    && (item.getFlag?.("jujutsu-system", "featureSection")
      ?? item.flags?.["jujutsu-system"]?.featureSection) === "jj-peculiarities");
}

/**
 * Bônus de efeitos sobre a margem do Crítico Excedente — Active Effect em
 * flags.jujutsu-system.excedenteBonus (somatório; negativo facilita).
 * @param {Actor5e} actor Ator atacante.
 * @returns {number}
 */
export function bonusExcedente(actor) {
  return Math.trunc(Number(actor?.flags?.["jujutsu-system"]?.excedenteBonus) || 0);
}

/**
 * Margem do Crítico Excedente
/**
 * Margem do Crítico Excedente (acerto que supera a CA do alvo por X):
 * 10 de base, −2 com Rastro da Desgraça, somado ao bônus de efeitos —
 * attribute key para Active Effects: flags.jujutsu-system.excedenteBonus
 * (negativo facilita o Excedente, positivo dificulta). Piso em 0.
 * @param {Actor5e} actor Ator atacante.
 * @returns {number}
 */
export function margemExcedente(actor) {
  return Math.max(0, 10 - (temPeculiaridade(actor, "rastro-da-desgraca") ? 2 : 0) + bonusExcedente(actor));
}

/** Só um cliente age: GM ativo (se houver) ou o dono do ator. */
function podeAgir(actor) {
  const gm = game.users?.activeGM;
  return gm ? (gm === game.user) : (actor?.isOwner === true);
}

/**
 * Imunidade a condição concedida por peculiaridade:
 *   Pesadelos Terríveis → imune a Amedrontado ·
 *   Olhar do Abismo     → imune a Atordoado.
 * Consultada pelo toggle da aba de Efeitos e pelos aplicadores automáticos.
 * @param {Actor5e} actor  Ator alvo.
 * @param {string}  condId Id da condição (ex.: "jj-amedrontado").
 * @returns {boolean}
 */
export function imunidadeCondicao(actor, condId) {
  if ( (condId === "jj-amedrontado") && temPeculiaridade(actor, "pesadelos-terriveis") ) return true;
  if ( (condId === "jj-atordoado") && temPeculiaridade(actor, "olhar-do-abismo") ) return true;
  return false;
}

/**
 * Condições que o 1 natural da Rastro da Desgraça pode aplicar.
 * Ajuste os custos conforme o livro (a regra limita a "até 7 PA").
 * @type {string[]}
 */
export const CONDICOES_RASTRO = Object.freeze([
  "jj-caido", "jj-lento", "jj-estremecido", "jj-desorientado", "jj-surdo"
]);

/** Aplica uma condição jj como efeito, com duração opcional em rodadas. */
async function aplicarCondicaoJj(actor, condId, label, duracaoRodadas = null) {
  if ( imunidadeCondicao(actor, condId) ) {
    avisar(actor, `${actor.name} é imune a ${condId} (peculiaridade).`);
    return;
  }
  await actor.createEmbeddedDocuments("ActiveEffect", [{
    name: label,
    icon: "icons/svg/aura.svg",
    statuses: statusesParaCondicao(condId),
    ...(duracaoRodadas ? { duration: { rounds: duracaoRodadas, combat: game.combat?.id ?? null } } : {}),
    flags: { "jujutsu-system": { isJujutsuCondition: true, origemPeculiaridade: true } }
  }]);
}

/** Rola 1d20 postando o resultado no chat do ator. */
async function rolarD20(actor, sabor) {
  const roll = await new Roll("1d20").evaluate();
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: sabor });
  return roll.dice[0].results[0].result;
}

function avisar(actor, conteudo) {
  ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: conteudo });
}

/* ── 02 Ferida Amaldiçoada ────────────────────────────────────────────────── */

Hooks.on("combatStart", async (combat) => {
  for ( const combatant of combat.combatants ) {
    const actor = combatant.actor;
    if ( !actor || !temPeculiaridade(actor, "ferida-amaldicoada") || !podeAgir(actor) ) continue;
    if ( actor.getFlag("jujutsu-system", "feridaAfetada") ) continue;
    const resultado = await rolarD20(actor, "🩸 Ferida Amaldiçoada — 1d20 (≤ 10 ressurge a dor)");
    if ( resultado > 10 ) continue;
    await actor.setFlag("jujutsu-system", "feridaAfetada", true);
    await aplicarCondicaoJj(actor, "jj-incapacitado", "Incapacitado (Ferida Amaldiçoada)", 3);
    avisar(actor, `🩸 <strong>${actor.name}</strong>: a Ferida Amaldiçoada ressurgiu — <strong>Incapacitado por 3 rodadas</strong> (não repete até o próximo descanso longo).`);
  }
});

/* ── 06 Corpo Exaurido ────────────────────────────────────────────────────── */

// CD dinâmica: base 18 · +5 por combate encerrado · −5 por descanso longo.
// (O texto cita "mínimo de 20" na redução por descanso, mas a base é 18 —
// o piso adotado aqui é a própria base, pendente de confirmação do autor.)
Hooks.on("deleteCombat", async (combat) => {
  for ( const combatant of combat.combatants ) {
    const actor = combatant.actor;
    if ( !actor || !temPeculiaridade(actor, "corpo-exaurido") || !podeAgir(actor) ) continue;
    const cd = Math.max(18, Number(actor.getFlag("jujutsu-system", "corpoExauridoCD") ?? 18));
    const roll = await new Roll("1d20 + @abilities.con.save", actor.getRollData()).evaluate();
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `😮‍💨 Corpo Exaurido — Salvaguarda de Constituição CD ${cd}` });
    const exaustao = Number(actor.system.attributes.exhaustion) || 0;
    if ( roll.total < cd ) {
      await actor.update({ "system.attributes.exhaustion": Math.min(5, exaustao + 1) });
      avisar(actor, `😮‍💨 <strong>${actor.name}</strong> falhou ( CD ${cd}) e recebe <strong>1 nível de exaustão</strong>. A CD sobe para <strong>${cd + 5}</strong>.`);
      await actor.setFlag("jujutsu-system", "corpoExauridoCD", cd + 5);
    } else {
      avisar(actor, `😮‍💨 <strong>${actor.name}</strong> resistiu ( CD ${cd}). A CD sobe para <strong>${cd + 5}</strong>.`);
      await actor.setFlag("jujutsu-system", "corpoExauridoCD", cd + 5);
    }
  }
});

/* ── 07 Pesadelos Terríveis + resets por descanso longo ───────────────────── */

Hooks.on("dnd5e.restCompleted", async (actor, result) => {
  if ( !actor || !result?.longRest || !podeAgir(actor) ) return;
  // Ferida Amaldiçoada: volta a poder afetar após o descanso longo.
  if ( temPeculiaridade(actor, "ferida-amaldicoada") && actor.getFlag("jujutsu-system", "feridaAfetada") ) {
    await actor.unsetFlag("jujutsu-system", "feridaAfetada");
    avisar(actor, "🩸 A Ferida Amaldiçoada pode ressurgir novamente no próximo encontro.");
  }
  // Doença Sobrenatural: o próximo crítico volta a ser interrompido.
  if ( temPeculiaridade(actor, "doenca-sobrenatural") && actor.getFlag("jujutsu-system", "doencaUsada") ) {
    await actor.unsetFlag("jujutsu-system", "doencaUsada");
    avisar(actor, "🤕 A Doença Sobrenatural pode interromper o próximo ataque crítico novamente.");
  }
  // Pesadelos Terríveis: rola após cada descanso longo.
  if ( temPeculiaridade(actor, "pesadelos-terriveis") ) {
    const nivel = Math.min(5, Number(actor.getFlag("jujutsu-system", "pesadelosNivel")) || 0);
    const resultado = await rolarD20(actor, " Nightmare 😱 Pesadelos Terríveis — 1d20 (≤ 10 traz 1 exaustão)");
    if ( resultado <= 10 && nivel < 5 ) {
      const exaustao = Number(actor.system.attributes.exhaustion) || 0;
      await actor.update({ "system.attributes.exhaustion": Math.min(5, exaustao + 1) });
      await actor.setFlag("jujutsu-system", "pesadelosNivel", nivel + 1);
      avisar(actor, `😱 <strong>${actor.name}</strong> acordou em pânico: <strong>+1 exaustão</strong> (${nivel + 1} de 5 por esta característica).`);
    } else if ( resultado > 10 && nivel > 0 ) {
      await actor.setFlag("jujutsu-system", "pesadelosNivel", 0);
      avisar(actor, `😌 <strong>${actor.name}</strong> dormiu bem — o ciclo de pesadelos foi interrompido.`);
    }
  }
  // Corpo Exaurido: descanso longo reduz a CD em −5 (piso na base 18).
  if ( temPeculiaridade(actor, "corpo-exaurido") ) {
    const cd = Number(actor.getFlag("jujutsu-system", "corpoExauridoCD") ?? 18);
    await actor.setFlag("jujutsu-system", "corpoExauridoCD", Math.max(18, cd - 5));
  }
});

/* ── 12 Azar Absurdo · 16 Rastro da Desgraça (1 natural) ──────────────────── */

Hooks.on("createChatMessage", async (message) => {
  const roll = message.rolls?.find(r => r.dice?.some(d => d.faces === 20));
  if ( !roll ) return;
  const d20 = roll.dice.find(d => d.faces === 20);
  const natural = d20?.results.find(r => !r.discarded)?.result;
  if ( ![1, 20].includes(natural) ) return;
  const actor = game.actors.get(message.speaker?.actor ?? "");
  if ( !actor || !podeAgir(actor) ) return;

  // 12 Azar Absurdo — 20 natural recupera Energia Total = INT.
  if ( (natural === 20) && temPeculiaridade(actor, "azar-absurdo") ) {
    const intelecto = Number(actor.system.abilities?.int?.value) || 0;
    if ( intelecto > 0 ) {
      const maximo = Math.max(0, Number(actor.system.energy?.max) || 0);
      const atual = Math.max(0, Number(actor.system.energy?.total) || 0);
      await actor.update({ "system.energy.total": Math.min(maximo, atual + intelecto) });
      avisar(actor, `🍀 <strong>${actor.name}</strong>: 20 natural — recupera <strong>${intelecto}</strong> de Energia Amaldiçoada Total.`);
    }
  }

  // 16 Rastro da Desgraça — 1 natural: condição aleatória da tabela (≤ 7 PA).
  if ( (natural === 1) && temPeculiaridade(actor, "rastro-da-desgraca") ) {
    const condId = CONDICOES_RASTRO[Math.floor(Math.random() * CONDICOES_RASTRO.length)];
    await aplicarCondicaoJj(actor, condId, `Condição (Rastro da Desgraça — ${condId})`);
    avisar(actor, `🌀 <strong>Rastro da Desgraça</strong>: 1 natural em ${actor.name} — aplicada a condição <strong>${condId}</strong> (1 natural).`);
  }
});

/* ── 14 Energia Destrutiva ────────────────────────────────────────────────── */

const energiaAntesDoUso = new WeakMap();

Hooks.on("dnd5e.preUseActivity", (activity, usageConfig) => {
  const actor = activity?.item?.actor;
  if ( !actor || (activity.item?.type !== "spell") || !temPeculiaridade(actor, "energia-destrutiva") ) return;
  energiaAntesDoUso.set(actor, {
    gerada: Number(actor.system.energy?.generated) || 0,
    total: Number(actor.system.energy?.total) || 0
  });
});

Hooks.on("dnd5e.postUseActivity", async (activity, usageConfig, results) => {
  const actor = activity?.item?.actor;
  const antes = energiaAntesDoUso.get(actor);
  energiaAntesDoUso.delete(actor);
  if ( !actor || !antes || !temPeculiaridade(actor, "energia-destrutiva") ) return;
  if ( !podeAgir(actor) ) return;
  const gerada = Number(actor.system.energy?.generated) || 0;
  const total = Number(actor.system.energy?.total) || 0;
  // Custo em PA = o que saiu das duas reservas com o uso da técnica.
  const custo = Math.max(0, (antes.gerada - gerada) + (antes.total - total));
  if ( custo <= 0 ) return;
  const hp = actor.system.attributes.hp;
  if ( !hp ) return;
  await actor.update({ "system.attributes.hp.value": Math.max(0, (hp.value ?? 0) - custo) });
  avisar(actor, `☠️ <strong>Energia Destrutiva</strong>: ${actor.name} sofre <strong>${custo}</strong> de dano direto na vida pelo uso da técnica.`);
});

/* ── 21 Corpo Frágil ──────────────────────────────────────────────────────── */

// Reflexo de aplicação: evita recursão quando o dano extra reaplica applyDamage.
const aplicandoCorpoFragil = new WeakSet();

Hooks.on("dnd5e.applyDamage", async (actor, amount, options) => {
  if ( !actor || (amount <= 0) || aplicandoCorpoFragil.has(actor) ) return;
  if ( !temPeculiaridade(actor, "corpo-fragil") || !podeAgir(actor) ) return;
  const origem = options?.originatingMessage;
  const rolls = origem?.rolls ?? [];
  const dados = rolls.flatMap(roll => roll.dice ?? []);
  if ( !dados.length ) return;
  // Comum (arma): +1 dado · Técnica (spell/feat): +1/3 dos dados totais (teto p/ cima).
  const tipoItem = origem.item?.type;
  const tecnica = (tipoItem === "spell") || (tipoItem === "feat");
  const quantidade = tecnica
    ? Math.ceil(dados.reduce((soma, d) => soma + (d.number ?? 1), 0) / 3)
    : 1;
  const faces = dados[0].faces ?? 6;
  const tipo = rolls.find(roll => roll.options?.type)?.options.type ?? "bludgeoning";
  aplicandoCorpoFragil.add(actor);
  try {
    const extra = await new Roll(`${quantidade}d${faces}`).evaluate();
    await extra.toMessage({ speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `🩹 Corpo Frágil — dano adicional (${tecnica ? `⅓ de ${dados.length} dados` : "1 dado"})` });
    await actor.applyDamage([{
      value: Math.max(0, extra.total),
      type: tipo,
      properties: new Set()
    }], { isDelta: true, ignore: { vulnerability: true } });
  } finally {
    aplicandoCorpoFragil.delete(actor);
  }
});

/* ── 25 Doença Sobrenatural ───────────────────────────────────────────────── */

/**
 * O crítico próprio deve ser interrompido pela Doença Sobrenatural?
 * (1× por descanso longo — a flag `doencaUsada` reseta em `dnd5e.restCompleted`.)
 * @param {Actor5e} actor Ator atacante.
 * @returns {boolean}
 */
export function doencaInterrompeAtaque(actor) {
  return temPeculiaridade(actor, "doenca-sobrenatural")
    && !actor?.getFlag?.("jujutsu-system", "doencaUsada");
}

/**
 * Aplica a interrupção da Doença Sobrenatural: marca o uso e impõe
 * Inconsciente até o fim do próximo turno.
 * @param {Actor5e} actor Ator atacante.
 */
export async function marcarDoencaUsada(actor) {
  await actor?.setFlag?.("jujutsu-system", "doencaUsada", true);
  await aplicarCondicaoJj(actor, "jj-inconsciente", "Inconsciente (Doença Sobrenatural)", 1);
  avisar(actor, `🤕 <strong>Doença Sobrenatural</strong>: o ataque crítico de ${actor.name} foi interrompido e ele fica <strong>Inconsciente</strong> até o fim do próximo turno.`);
}

// A imunidade às condições de DANO é intercedida dentro de aplicarCondicaoDano
// (condicoes-dano.mjs), que consulta temPeculiaridade(alvo, "doenca-sobrenatural").

/* ── 27 Desejo Sombrio ────────────────────────────────────────────────────── */

/**
 * Rolagem de fim de sessão do Desejo Sombrio: 1d6 ≥ 4 manifesta o desejo
 * (o narrador e o jogador definiram os três níveis previamente).
 * @param {Actor5e} actor Ator com a peculiaridade.
 * @returns {Promise<{manifestou: boolean, resultado: number}>}
 */
export async function rolarDesejoSombrio(actor) {
  const resultado = await rolarD20(actor, "🌑 Desejo Sombrio — 1d6 (≥ 4 manifesta)");
  const manifestou = resultado >= 4;
  await actor.setFlag("jujutsu-system", "desejoPendente", manifestou);
  if ( manifestou ) {
    avisar(actor, `🌑 <strong>O Desejo Sombrio de ${actor.name} se manifesta!</strong> Role 1d3 entre os três desejos definidos. Enquanto não for cumprido: <strong>−4 em rolagens</strong> não relacionadas a cumpri-lo.`);
  } else {
    await actor.unsetFlag("jujutsu-system", "desejoPendente");
  }
  return { manifestou, resultado };
}

/**
 * Liga/desliga a penalidade −4 em todas as rolagens d20 do Desejo Sombrio
 * (aplicada como efeito nos modificadores globais de rolagem).
 * @param {Actor5e} actor   Ator afetado.
 * @param {boolean} ativo   Estado da penalidade.
 */
export async function alternarPenalidadeDesejo(actor, ativo) {
  const existente = actor.effects.find(e => e.getFlag("jujutsu-system", "desejoSombrioPenalidade"));
  if ( existente ) await existente.delete();
  if ( !ativo ) return;
  const familias = ["ability.check", "ability.save"];
  for ( const chave of Object.keys(CONFIG.DND5E.abilities ?? {}) ) {
    familias.push(`skills.${chave}.roll`);
  }
  await actor.createEmbeddedDocuments("ActiveEffect", [{
    name: "Desejo Sombrio (−4)",
    icon: "icons/magic/death/hand-undead-strike.webp",
    disabled: false,
    changes: familias.map(familia => ({
      key: `system.bonuses.rolls.${familia}.mode`,
      mode: CONST.ACTIVE_EFFECT_MODES.CUSTOM,
      value: -4
    })),
    flags: { "jujutsu-system": { desejoSombrioPenalidade: true } }
  }]);
}
