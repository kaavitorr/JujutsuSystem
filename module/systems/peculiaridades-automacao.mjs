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

import { applyGameCondition } from "../applications/actor/jj/conditions.mjs";
import { temPeculiaridade, imunidadeCondicao } from "./peculiaridades-data.mjs";
import { registerPeculiarityEffectHooks } from "./peculiaridades-effects.mjs";
export { PECULIARIDADES, temPeculiaridade, imunidadeCondicao } from "./peculiaridades-data.mjs";
registerPeculiarityEffectHooks();

/** Chave → nome do feat no compendium. */

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
  if (gm) return gm === game.user;
  const owners = Array.from(game.users ?? []).filter(user => user.active && actor?.testUserPermission?.(user, "OWNER"))
    .sort((a, b) => a.id.localeCompare(b.id));
  return owners.length ? owners[0].id === game.user.id : actor?.isOwner === true;
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

/**
 * Condições que o 1 natural da Rastro da Desgraça pode aplicar.
 * Ajuste os custos conforme o livro (a regra limita a "até 7 PA").
 * @type {string[]}
 */
export const CONDICOES_RASTRO = Object.freeze([
  "jj-caido", "jj-lento", "jj-estremecido", "jj-desorientado", "jj-surdo"
]);

/** Aplica uma condição jj como efeito, com duração opcional em rodadas. */
async function aplicarCondicaoJj(actor, condId, label, duracaoRodadas = null, expiry = null) {
  if ( imunidadeCondicao(actor, condId) ) {
    avisar(actor, `${actor.name} é imune a ${condId} (peculiaridade).`);
    return;
  }
  const combat = game.combat;
  const combatant = combat?.getCombatantsByActor?.(actor)?.[0];
  const rounds = expiry === "turnEnd" && combatant && combat.combatant?.id !== combatant.id ? 0 : duracaoRodadas;
  const start = { time: game.time?.worldTime ?? 0, combat: combat?.started ? combat.id : null,
    combatant: combatant?.id ?? combat?.combatant?.id ?? null, round: combat?.round ?? null, turn: combat?.turn ?? null };
  return applyGameCondition(actor, condId, { name: label, start,
    ...(duracaoRodadas ? { duration: { units: "rounds", value: rounds, expiry } } : {}),
    flags: { origemPeculiaridade: true } });
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
  const seen = new Set();
  for ( const combatant of combat.combatants ) {
    const actor = combatant.actor;
    if ( !actor || !temPeculiaridade(actor, "ferida-amaldicoada") || !actor.isOwner || seen.has(actor.uuid ?? actor.id) ) continue;
    seen.add(actor.uuid ?? actor.id);
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
  if (!combat.started) return;
  const seen = new Set();
  for ( const combatant of combat.combatants ) {
    const actor = combatant.actor;
    if ( !actor || !temPeculiaridade(actor, "corpo-exaurido") || !podeAgir(actor) || seen.has(actor.uuid ?? actor.id) ) continue;
    seen.add(actor.uuid ?? actor.id);
    const cd = Math.max(18, Number(actor.getFlag("jujutsu-system", "corpoExauridoCD") ?? 18));
    const rolled = await actor.rollSavingThrow({ ability: "con", target: cd }, {}, { data: {
      flavor: `Corpo Exaurido — Salvaguarda de Constituição CD ${cd}` } });
    const roll = Array.isArray(rolled) ? rolled[0] : rolled;
    if (!roll || !Number.isFinite(roll.total)) continue;
    const exaustao = Number(actor.system.attributes.exhaustion) || 0;
    if ( roll.total < cd ) {
      await actor.update({ "system.attributes.exhaustion": exaustao + 1 });
      avisar(actor, `😮‍💨 <strong>${actor.name}</strong> falhou ( CD ${cd}) e recebe <strong>1 nível de exaustão</strong>. A CD sobe para <strong>${cd + 5}</strong>.`);
      await actor.setFlag("jujutsu-system", "corpoExauridoCD", cd + 5);
    } else {
      avisar(actor, `😮‍💨 <strong>${actor.name}</strong> resistiu ( CD ${cd}). A CD sobe para <strong>${cd + 5}</strong>.`);
      await actor.setFlag("jujutsu-system", "corpoExauridoCD", cd + 5);
    }
  }
});

/* ── 07 Pesadelos Terríveis + resets por descanso longo ───────────────────── */

/** Awaited by Actor._rest before its single bulk update; hooks cannot await a roll. */
export async function preparePeculiarityRest(actor, result) {
  if (!actor || !result?.longRest || !temPeculiaridade(actor, "pesadelos-terriveis")) return;
  const source = Math.min(5, Math.max(0, Number(actor.getFlag("jujutsu-system", "pesadelosNivel")) || 0));
  const before = Math.max(0, Number(actor.system.attributes.exhaustion) || 0);
  const rolled = await rolarD20(actor, "Pesadelos Terríveis — 1d20 (≤ 10 traz exaustão)");
  result.updateData ??= {};
  const planned = Number(result.updateData["system.attributes.exhaustion"] ?? before);
  const level = rolled <= 10 ? Math.min(5, source + 1) : 0;
  result.updateData["system.attributes.exhaustion"] = rolled <= 10
    ? Math.max(level, planned + Math.max(0, level - source))
    : Math.max(0, planned - source);
  result.updateData["flags.jujutsu-system.pesadelosNivel"] = level;
}

Hooks.on("preUpdateActor", (actor, changed, options) => {
  if (!temPeculiaridade(actor, "pesadelos-terriveis")) return;
  const value = changed["system.attributes.exhaustion"] ?? changed.system?.attributes?.exhaustion;
  if (!Number.isFinite(value)) return;
  const level = changed["flags.jujutsu-system.pesadelosNivel"] ?? changed.flags?.["jujutsu-system"]?.pesadelosNivel
    ?? actor.getFlag("jujutsu-system", "pesadelosNivel") ?? 0;
  const protectedLevel = Math.min(5, Math.max(0, Number(level) || 0));
  if (value < protectedLevel) {
    if (changed.system?.attributes) changed.system.attributes.exhaustion = protectedLevel;
    else changed["system.attributes.exhaustion"] = protectedLevel;
  }
});

Hooks.on("dnd5e.restCompleted", async (actor, result) => {
  if ( !actor || !result?.longRest ) return;
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
  const actor = ChatMessage.getSpeakerActor?.(message.speaker) ?? game.actors.get(message.speaker?.actor ?? "");
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
  energiaAntesDoUso.set(usageConfig, {
    gerada: Number(actor.system.energy?.generated) || 0,
    total: Number(actor.system.energy?.total) || 0
  });
});

Hooks.on("dnd5e.postUseActivity", async (activity, usageConfig, results) => {
  const actor = activity?.item?.actor;
  const antes = energiaAntesDoUso.get(usageConfig);
  energiaAntesDoUso.delete(usageConfig);
  if ( !actor || !antes || !temPeculiaridade(actor, "energia-destrutiva") ) return;
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
export async function preparePeculiarityDamage(actor, damages, options = {}) {
  if (!temPeculiaridade(actor, "corpo-fragil") || !Array.isArray(damages)
    || !damages.some(damage => damage.value > 0)) return damages;
  const origem = options.origin ?? options.originatingMessage;
  const snapshot = origem?.flags?.["jujutsu-system"]?.peculiarityDamageSource;
  const rolls = origem?.rolls ?? [];
  const dados = (snapshot?.dice ?? rolls.flatMap(roll => roll.dice ?? [])).filter(die => die.faces > 0 && die.faces !== 20);
  if ( !dados.length ) return damages;
  // Comum (arma): +1 dado · Técnica (spell/feat): +1/3 dos dados totais (teto p/ cima).
  const tipoItem = snapshot?.itemType ?? origem?.item?.type ?? origem?.getAssociatedItem?.()?.type;
  const tecnica = (tipoItem === "spell") || (tipoItem === "feat");
  const quantidade = tecnica
    ? Math.ceil(dados.reduce((soma, d) => soma + (d.number ?? 1), 0) / 3)
    : 1;
  const faces = dados[0].faces ?? 6;
  const tipo = snapshot?.type ?? rolls.find(roll => roll.options?.type)?.options.type ?? damages.find(damage => damage.value > 0)?.type ?? "bludgeoning";
  const extra = await new Roll(`${quantidade}d${faces}`).evaluate();
  await extra.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: `Corpo Frágil — dano adicional (${quantidade}d${faces})` });
  return [...damages, { value: Math.max(0, extra.total), type: tipo, properties: new Set() }];
}

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
  await aplicarCondicaoJj(actor, "jj-inconsciente", "Inconsciente (Doença Sobrenatural)", 1, "turnEnd");
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
  const roll = await new Roll("1d6").evaluate();
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: "Desejo Sombrio — 1d6 (≥ 4 manifesta)" });
  const resultado = roll.dice[0].results[0].result;
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
  const existentes = actor.effects.filter(e => e.getFlag("jujutsu-system", "desejoSombrioPenalidade"));
  for (const existente of existentes) await existente.delete();
  if ( !ativo ) return;
  const familias = ["ability.check", "ability.save", "attack"];
  await actor.createEmbeddedDocuments("ActiveEffect", [{
    name: "Desejo Sombrio (−4)",
    icon: "icons/magic/death/hand-undead-strike.webp",
    disabled: false,
    changes: familias.map(familia => ({
      key: `system.rolls.${familia}.bonus`,
      mode: CONST.ACTIVE_EFFECT_MODES.ADD,
      value: -4
    })),
    flags: { "jujutsu-system": { desejoSombrioPenalidade: true } }
  }]);
}
