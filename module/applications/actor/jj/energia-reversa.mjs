import Ruleset from "../../../systems/ruleset.mjs";

/**
 * ── ENERGIA REVERSA (2.0) ───────────────────────────────────────────────────
 * Cada Ponto de Reversa (PER) recupera PV e reduz ferimentos pelo atributo de
 * Constituição. Limite por rodada configurável (base 3 PER). Por 2 PER é possível
 * recuperar um membro perdido.
 */

const MAXIMO_PADRAO_POR_RODADA = 3;
const PERMISSAO = "energiaReversaRodada";
const CUSTO_RECUPERACAO = 3;
const transacoes = new WeakSet();
const dialogos = new WeakSet();
const resetsPendentes = new WeakMap();
const integer = value => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;

/** Reconcile missed turn events without granting an allowance on global round changes. */
function usoReversaNoCombate(actor, combate) {
  const flag = actor?.getFlag?.("jujutsu-system", PERMISSAO);
  if (!combate?.started) return { pontos: 0 };
  const combatante = combate.combatant;
  const mesmoActor = combatante?.actor === actor
    || (actor?.uuid && combatante?.actor?.uuid === actor.uuid);
  const turnKey = Ruleset.isV2() && mesmoActor && combatante.id ? `${combate.round}:${combatante.id}` : null;
  if (flag?.combatId !== combate.id) return { pontos: 0, turnKey };
  // Old flags lack a turn key. Preserve same-round spending when loading an existing session.
  const turnoNovo = turnKey && (flag.turnKey ? flag.turnKey !== turnKey : integer(flag.rodada) < combate.round);
  return { pontos: turnoNovo ? 0 : integer(flag.pontos), turnKey: turnKey ?? flag.turnKey };
}

export function contextoEnergiaReversa(actor) {
  const reversa = actor?.system?.legacy2?.reverseEnergy ?? { value: 0, max: 30 };
  const combate = game.combat?.started ? game.combat : null;
  const rodada = combate?.round ?? null;
  // Spending stays counted across global round changes until this actor starts their next turn.
  const pontosNaRodada = usoReversaNoCombate(actor, combate).pontos;
  const value = integer(reversa.value), max = integer(reversa.max ?? 30);
  const maximoRodada = integer(reversa.maxPerRound ?? MAXIMO_PADRAO_POR_RODADA);
  const marcas = Math.min(6, maximoRodada);
  const energia = integer(actor?.system?.energy?.total);
  const recuperavel = Ruleset.isRestringido(actor) ? 0
    : Math.min(Math.max(0, max - value), Math.floor(energia / CUSTO_RECUPERACAO));
  return {
    value, max, energia, recuperavel, podeRecuperar: recuperavel > 0, custoRecuperacao: CUSTO_RECUPERACAO,
    pct: max ? Math.min(100, 100 * value / max) : 0,
    pontosNaRodada, restanteRodada: Math.max(0, maximoRodada - pontosNaRodada),
    rodadaPontos: Array.from({ length: marcas }, (_, index) => ({ usado: pontosNaRodada >= Math.ceil((index + 1) * maximoRodada / marcas) })),
    emCombate: rodada !== null,
    maximoRodada, con: Number(actor?.system?.abilities?.con?.value ?? 1)
  };
}

/** Native and tracker events share one reset per combatant turn. */
export async function resetarUsoReversaNoTurno(actor, combate, combatante = combate?.combatant) {
  if (!Ruleset.isV2() || !combate?.started || !actor?.system?.legacy2?.reverseEnergy) return false;
  const turnKey = combatante?.id ? `${combate.round}:${combatante.id}` : null;
  const pendente = resetsPendentes.get(actor);
  if (pendente) {
    await pendente.promise;
    if (pendente.combatId === combate.id && pendente.turnKey === turnKey) return false;
    return resetarUsoReversaNoTurno(actor, combate, combatante);
  }
  const flag = actor.getFlag?.("jujutsu-system", PERMISSAO);
  if (flag?.combatId === combate.id && (turnKey ? flag.turnKey === turnKey : integer(flag.pontos) === 0)) return false;
  const promise = actor.update({ [`flags.jujutsu-system.${PERMISSAO}`]: {
    combatId: combate.id, rodada: combate.round, pontos: 0, ...(turnKey ? { turnKey } : {})
  } });
  resetsPendentes.set(actor, { combatId: combate.id, turnKey, promise });
  try {
    await promise;
    return true;
  } finally { resetsPendentes.delete(actor); }
}

/** Detect entry into an actual turn, including changes to initiative order. */
async function resetarAoTrocarTurno(combate, anterior, atual, userId) {
  if (!Ruleset.isV2() || !combate.started || !atual?.combatantId) return;
  if (anterior?.combatantId === atual.combatantId && anterior.round === atual.round) return;
  const combatante = combate.combatants?.get(atual.combatantId) ?? combate.combatant;
  const actor = combatante?.actor;
  if (!actor) return;
  // Prefer the GM who advances the tracker: another GM session may still run older code.
  const autor = game.users?.get?.(userId ?? combate._stats?.lastModifiedBy);
  const autoridade = (autor?.active && autor.isGM ? autor : null) ?? game.users?.activeGM
    ?? game.users?.find?.(user => user.active && actor.testUserPermission?.(user, "OWNER"));
  if (autoridade ? autoridade.id !== game.user.id : !(game.user.isGM || actor.isOwner)) return;
  await resetarUsoReversaNoTurno(actor, combate, combatante);
}

Hooks.on("updateCombat", (combate, alteracoes, options, userId) => {
  if (options?.turnEvents === false || !("turn" in alteracoes || "round" in alteracoes)) return;
  return resetarAoTrocarTurno(combate, combate.previous, combate.current, userId);
});
Hooks.on("combatTurnChange", (combate, anterior, atual) => resetarAoTrocarTurno(combate, anterior, atual));

/** Convert total cursed energy into PER; refinement and the healing round allowance remain intact. */
export async function recuperarEnergiaReversa(actor, pontos = 1) {
  if (!Ruleset.isV2() || !actor || actor.isOwner === false || transacoes.has(actor)) return false;
  const quantidade = Number(pontos);
  const context = contextoEnergiaReversa(actor);
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > context.recuperavel) {
    ui.notifications.warn("Confira o saldo de Energia Total e a capacidade: recuperar 1 PER custa 3 PA.");
    return false;
  }
  transacoes.add(actor);
  try {
    const custo = quantidade * CUSTO_RECUPERACAO;
    await actor.update({ "system.energy.total": context.energia - custo,
      "system.legacy2.reverseEnergy.value": context.value + quantidade });
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }),
      content: `<strong>${foundry.utils.escapeHTML(actor.name)}</strong> converte <strong>${custo} PA</strong> de Energia Total em <strong>${quantidade} PER</strong>.` });
    return true;
  } finally { transacoes.delete(actor); }
}

/** Select a quantity, preview its cost, then revalidate the live actor balance on acceptance. */
export async function escolherRecuperacaoReversa(actor) {
  if (!Ruleset.isV2() || !actor || actor.isOwner === false || dialogos.has(actor)) return false;
  const context = contextoEnergiaReversa(actor);
  if (!context.podeRecuperar) return recuperarEnergiaReversa(actor, 1);
  dialogos.add(actor);
  try {
    const quantidade = await foundry.applications.api.DialogV2.wait({
      classes: ["dnd5e2", "jj2-document", "jj2-er-recovery-dialog"],
      window: { title: "Recuperar Energia Reversa" },
      content: `<div class="jj2-er-recovery-form">
        <p>Converta Energia Total em Energia Reversa.</p>
        <label class="jj2-er-quantity">PER a recuperar <input type="number" name="per" value="1" min="1" max="${context.recuperavel}" step="1" required></label>
        <div class="jj2-er-conversion"><strong><output data-er-cost>3</output> PA</strong><span aria-hidden="true">→</span><strong><output data-er-gain>1</output> PER</strong></div>
        <p class="hint">${context.energia} PA de Energia Total disponíveis. Até ${context.recuperavel} PER nesta conversão.</p>
      </div>`,
      render: (event, dialog) => {
        const root = dialog.element;
        const input = root.querySelector('[name="per"]');
        const preview = () => {
          const amount = Number(input.value);
          const valid = Number.isInteger(amount) && amount >= 1 && amount <= context.recuperavel;
          root.querySelector('[data-er-cost]').textContent = valid ? String(amount * CUSTO_RECUPERACAO) : "—";
          root.querySelector('[data-er-gain]').textContent = valid ? String(amount) : "—";
          const button = root.querySelector('[data-action="recover"]');
          if (button) button.disabled = !valid;
        };
        input.addEventListener("input", preview);
        preview();
      },
      buttons: [{ action: "recover", label: "Converter", default: true,
        callback: (event, button, dialog) => Number(dialog.element.querySelector('[name="per"]').value) },
      { action: "cancel", label: "Cancelar", callback: () => null }],
      rejectClose: false, close: () => null
    });
    if (quantidade === null || quantidade === undefined) return false;
    return recuperarEnergiaReversa(actor, quantidade);
  } finally { dialogos.delete(actor); }
}

/**
 * Usa PER: 1 ponto cura Constituição em PV e ferimentos; 2 pontos curam o dobro e
 * recuperam um membro perdido. Respeita o limite preparado do ator por rodada.
 */
export async function usarEnergiaReversa(actor, pontos = 1) {
  if (!Ruleset.isV2() || !actor || actor.isOwner === false || transacoes.has(actor)) return false;
  pontos = (pontos === 2) ? 2 : 1;
  const reversa = actor?.system?.legacy2?.reverseEnergy;
  const pool = Number(reversa?.value ?? 0);
  if (pool < pontos) {
    ui.notifications.warn(`Energia Reversa insuficiente — precisa de ${pontos} PER (disponível: ${pool}).`);
    return false;
  }
  const context = contextoEnergiaReversa(actor);
  const rodada = context.emCombate ? game.combat.round : null;
  const usados = context.pontosNaRodada;
  if (rodada !== null && (usados + pontos) > context.maximoRodada) {
    ui.notifications.warn(`Máximo de ${context.maximoRodada} PER por rodada — ${usados} já usados. O limite renova no início do seu turno.`);
    return false;
  }
  const con = Number(actor?.system?.abilities?.con?.value ?? 1);
  const cura = con * pontos;

  const updates = { [`system.legacy2.reverseEnergy.value`]: Math.max(0, pool - pontos) };
  const hp = actor.system.attributes.hp;
  const feridas = actor.type === "npc" ? 0 : integer(actor.system.legacy2?.wounds?.value);
  const feridasFinais = Math.max(0, feridas - cura);
  const feridasCuradas = feridas - feridasFinais;
  if (feridasCuradas > 0) updates["system.legacy2.wounds.value"] = feridasFinais;
  // The character model reduces maximum HP by one for each two wound points.
  // Heal against the ceiling after the wounds are reduced, in the same actor update.
  const teto = Math.max(0, feridasCuradas > 0
    ? Number(hp.max ?? 0) - Math.floor(feridasFinais / 2) + Number(hp.tempmax ?? 0)
    : Number(hp.effectiveMax ?? hp.max ?? 0));
  const vidaAtual = Number(hp.value ?? 0);
  const vidaFinal = Math.min(teto, vidaAtual + cura);
  const pvRecuperados = Math.max(0, vidaFinal - vidaAtual);
  updates["system.attributes.hp.value"] = vidaFinal;
  if ( rodada !== null ) {
    const { turnKey } = usoReversaNoCombate(actor, game.combat);
    updates[`flags.jujutsu-system.${PERMISSAO}`] = {
      combatId: game.combat.id, rodada, pontos: usados + pontos,
      ...(turnKey ? { turnKey } : {})
    };
  }
  transacoes.add(actor);
  try {
    await actor.update(updates);

    const detalhe = `recupera <strong>${pvRecuperados} PV</strong>`
      + (feridasCuradas > 0 ? ` e cura <strong>${feridasCuradas} ferimentos</strong>` : "")
      + (pontos === 2 ? ` e recupera <strong>um membro perdido</strong>` : "");
    const rodadaTexto = rodada !== null ? ` (${usados + pontos}/${context.maximoRodada} PER desde o início do seu turno)` : "";
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }),
      content: `<strong>${foundry.utils.escapeHTML(actor.name)}</strong> usa ${pontos} PER de Energia Reversa e ${detalhe}.${rodadaTexto}` });
    return true;
  } finally { transacoes.delete(actor); }
}

// Fim do combate: limpa o contador de PER por rodada de todos os combatentes.
Hooks.on("deleteCombat", async (combat) => {
  if (!Ruleset.isV2() || !game.user.isGM) return;
  for (const combatente of combat.combatants) {
    await combatente.actor?.unsetFlag?.("jujutsu-system", PERMISSAO);
  }
});
