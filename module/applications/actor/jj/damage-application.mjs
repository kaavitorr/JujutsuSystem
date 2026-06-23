/**
 * jj/damage-application.mjs
 * Aplicação de dano com a ordem de absorção do sistema:
 *   1. Reduções pendentes (Explosão Defensiva)
 *   2. Pontos de Armadura (Foco Defensivo)
 *   3. Pontos de Vida Temporários
 *   4. Pontos de Vida
 */

/**
 * Aplica dano a um único ator seguindo a ordem de absorção.
 * Posta a mensagem de chat da Explosão Defensiva (uso único) quando aplicável.
 *
 * @param {Actor5e} actor    Ator que recebe o dano
 * @param {number}  amount   Quantidade bruta de dano
 * @param {object}  [options]
 * @param {string[]|string} [options.damageTypes]  Tipo(s) de dano (chaves do sistema).
 *          Usado pela resistência por Pontos de Armadura: enquanto houver PA, a
 *          criatura resiste (metade) a tudo, exceto Verdadeiro (force).
 * @returns {Promise<{resist:number, reducao:number, armor:number, temp:number, hp:number}|null>}
 *          Resumo do que foi absorvido em cada camada, ou null se o ator não tem PV.
 */
export async function applyDamageToActor(actor, amount, { damageTypes = [] } = {}) {
  const hp = actor?.system?.attributes?.hp;
  if ( !hp ) return null;

  let restante = Math.max(0, Number(amount) || 0);
  const updates = {};
  const log = { resist: 0, reducao: 0, armor: 0, temp: 0, hp: 0 };

  const armorAtual = actor.system?.armorPoints?.value ?? 0;

  // A resistência é dos PONTOS DE ARMADURA, não do personagem: ela só vale na
  // camada de PA (ver passo 2). O dano que passa para o PV NÃO é reduzido.
  // Exceção: dano Verdadeiro (force) ignora a resistência da armadura.
  const tipos = (Array.isArray(damageTypes) ? damageTypes : [damageTypes])
    .filter(Boolean).map(t => String(t).toLowerCase());
  const soVerdadeiro = tipos.length > 0 && tipos.every(t => t === "force");

  // 1. Reduções pendentes (Explosão Defensiva) — uso único
  let reduExpDef = 0, reduEscudo = 0;
  const expDefPendente = actor.getFlag("jujutsu-system", "explosaoDefensivaPendente")?.reducao ?? 0;
  if ( expDefPendente > 0 && restante > 0 ) {
    reduExpDef = Math.min(expDefPendente, restante);
    restante -= reduExpDef;
    log.reducao += reduExpDef;
    // Remove a flag no mesmo update (atômico) — uso único
    updates["flags.jujutsu-system.-=explosaoDefensivaPendente"] = null;
  }

  // 1b. Redução de Dano (escudo da atividade): único consome; persistente fica até o turno
  const red = actor.getFlag("jujutsu-system", "reducaoDano");
  const redValor = red?.valor ?? 0;
  if ( redValor > 0 && restante > 0 ) {
    reduEscudo = Math.min(redValor, restante);
    restante -= reduEscudo;
    log.reducao += reduEscudo;
    if ( !red.persistente ) updates["flags.jujutsu-system.-=reducaoDano"] = null;
  }

  // 2. Pontos de Armadura (Foco Defensivo) — a armadura TEM resistência: cada
  //    ponto absorve 2 de dano (metade), parando o dobro do valor em PA. O que
  //    sobra segue para o PV em cheio. Contra Verdadeiro (force) não há
  //    resistência: 1 ponto absorve 1 de dano.
  if ( armorAtual > 0 && restante > 0 ) {
    if ( soVerdadeiro ) {
      const consumido = Math.min(armorAtual, restante);
      restante -= consumido;
      log.armor = consumido;
      updates["system.armorPoints.value"] = armorAtual - consumido;
    } else {
      const maxAbsorvivel = armorAtual * 2;                 // cada PA para 2 de dano
      const absorvido = Math.min(restante, maxAbsorvivel);  // dano bruto parado pela armadura
      const paGasto = Math.ceil(absorvido / 2);             // pontos consumidos (metade)
      restante -= absorvido;
      log.armor = absorvido;
      log.resist = absorvido - paGasto;                     // dano extra evitado pela resistência
      updates["system.armorPoints.value"] = armorAtual - paGasto;
    }
  }

  // 3. Pontos de Vida Temporários
  const tempAtual = hp.temp ?? 0;
  if ( tempAtual > 0 && restante > 0 ) {
    const consumido = Math.min(tempAtual, restante);
    restante -= consumido;
    log.temp = consumido;
    updates["system.attributes.hp.temp"] = tempAtual - consumido;
  }

  // 4. Pontos de Vida
  if ( restante > 0 ) {
    log.hp = restante;
    updates["system.attributes.hp.value"] = Math.max(0, (hp.value ?? 0) - restante);
    restante = 0;
  }

  if ( Object.keys(updates).length ) await actor.update(updates);

  // Feedback — só após o update ser aplicado, descrevendo cada camada
  const partes = [];
  if ( log.armor > 0 ) {
    const paGasto = armorAtual - (updates["system.armorPoints.value"] ?? armorAtual);
    const extra = log.resist > 0 ? ` — resistência evitou ${log.resist} a mais` : "";
    partes.push(`Pontos de Armadura absorveram <strong>${log.armor}</strong> (${paGasto} PA${extra})`);
  }
  if ( reduExpDef ) partes.push(`Explosão Defensiva reduziu <strong>${reduExpDef}</strong>`);
  if ( reduEscudo ) partes.push(`Redução de Dano reduziu <strong>${reduEscudo}</strong>`);
  if ( partes.length ) {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `🛡️ <strong>${actor.name}</strong>: ${partes.join("; ")}.`
    });
  }

  return log;
}

/**
 * Aplica dano a todos os tokens selecionados no canvas, seguindo a ordem de
 * absorção, e dá feedback visual num botão do card.
 *
 * @param {number}       amount   Dano bruto
 * @param {HTMLElement}  card     Card de chat
 * @param {string}       btnSelector  Seletor do botão "Aplicar" para feedback
 * @param {string[]|string} [damageTypes]  Tipo(s) de dano (para a resistência de PA)
 */
export async function applyDamageToSelectedTokens(amount, card, btnSelector, damageTypes = []) {
  const tokens = canvas.tokens?.controlled ?? [];
  if ( !tokens.length ) {
    ui.notifications.warn("Selecione um ou mais tokens no canvas antes de aplicar o dano.");
    return;
  }

  for ( const token of tokens ) {
    if ( token.actor ) await applyDamageToActor(token.actor, amount, { damageTypes });
  }

  const nomes = tokens.map(t => t.name).join(", ");
  ui.notifications.info(`${amount} de dano aplicado em: ${nomes}`);

  const btn = btnSelector ? card?.querySelector(btnSelector) : null;
  if ( btn ) {
    btn.textContent = `✓ ${amount} aplicado`;
    btn.disabled = true;
    btn.style.opacity = "0.6";
  }
}
