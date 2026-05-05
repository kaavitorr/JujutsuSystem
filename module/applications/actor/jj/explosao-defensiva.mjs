/**
 * jj/explosao-defensiva.mjs
 * Explosão Defensiva — botão na sidebar, dialog, aplicação de dano.
 * Energia Reversa   — botão na sidebar, dialog, cura própria.
 */

// ══════════════════════════════════════════════════════
//  EXPLOSÃO DEFENSIVA
// ══════════════════════════════════════════════════════

/**
 * Handler do botão de Explosão Defensiva — chamado pelo listener no _onRender.
 */
export async function onExplosaoDefensiva(actor) {
  const flagData      = actor.getFlag("jujutsu-system", "explosaoDefensivaPendente") ?? null;
  const pendente      = flagData?.reducao ?? 0;
  const pendenteCusto = flagData?.paCusto ?? 0;

  if ( pendente > 0 ) {
    const cancel = await foundry.applications.api.DialogV2.confirm({
      window: { title: "🛡️ Explosão Defensiva Ativa" },
      content: `<p>Há uma redução de <strong>${pendente}</strong> pontos pendente (custo: <strong>${pendenteCusto} PA</strong>).</p><p>Deseja cancelar e recuperar a PA?</p>`,
      yes: { label: "Cancelar e Devolver PA" },
      no:  { label: "Manter" }
    });
    if ( !cancel ) return;
    await actor.unsetFlag("jujutsu-system", "explosaoDefensivaPendente");
    const paAtual = actor.system?.energy?.generated ?? 0;
    await actor.update({ "system.energy.generated": paAtual + pendenteCusto });
    ui.notifications.info("Explosão Defensiva cancelada. PA devolvida.");
    return;
  }

  const result = await explosaoDefensivaDialog(actor);
  if ( !result ) return;

  await actor.setFlag("jujutsu-system", "explosaoDefensivaPendente", { reducao: result.reducao, paCusto: result.paCusto });
  const paAtual = actor.system?.energy?.generated ?? 0;
  await actor.update({ "system.energy.generated": Math.max(0, paAtual - result.paCusto) });
  ui.notifications.info(`🛡️ Explosão Defensiva ativa! Próximo dano reduzido em ${result.reducao} (${result.paCusto} PA gasto).`);
}

/**
 * Dialog de escolha de PA para Explosão Defensiva.
 */
async function explosaoDefensivaDialog(actor) {
  const paDisp = actor.system?.energy?.generated ?? 0;
  const maxPA  = paDisp;

  if ( maxPA === 0 ) {
    ui.notifications.warn("PA Gerada insuficiente para Explosão Defensiva!");
    return null;
  }

  const paGasto = await foundry.applications.api.DialogV2.wait({
    window: { title: "🛡️ Explosão Defensiva" },
    content: `
      <div style="padding:8px 0">
        <p style="margin:0 0 8px">Gastar PA para reduzir o próximo dano?</p>
        <p style="margin:0 0 4px; font-size:12px; color:#aaa;">
          PA Gerada disponível: <strong>${paDisp}</strong> &nbsp;|&nbsp;
          Máximo: <strong>${maxPA}</strong> d4
        </p>
        <div style="display:flex; align-items:center; gap:8px; margin-top:8px;">
          <label style="flex:0 0 auto">Dados d4:</label>
          <input type="number" id="jj-expdef-input"
                 value="0" min="0" max="${maxPA}"
                 style="width:60px; text-align:center;">
          <span style="font-size:12px; color:#aaa;">1 PA por dado</span>
        </div>
      </div>`,
    buttons: [
      {
        label:   "Rolar",
        action:  "ok",
        default: true,
        callback: (event, button, dialog) => {
          const input = dialog.element?.querySelector("#jj-expdef-input") ?? document.querySelector("#jj-expdef-input");
          return Math.max(0, Math.min(Number(input?.value ?? 0), maxPA));
        }
      },
      {
        label:    "Cancelar",
        action:   "cancel",
        callback: () => null
      }
    ],
    rejectClose: false,
    close: () => null
  });

  if ( paGasto === null || paGasto === undefined || paGasto === 0 ) return paGasto ?? 0;

  const roll = await new Roll(`${paGasto}d4`).evaluate();
  if ( game.dice3d ) await game.dice3d.showForRoll(roll, game.user, true);
  const total = roll.total;

  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor:  `🛡️ <strong>${actor.name}</strong> usa Explosão Defensiva — reduz <strong>${total}</strong> do próximo dano!`,
    rollMode: game.settings.get("core", "rollMode")
  });

  return { reducao: total, paCusto: paGasto };
}

// ══════════════════════════════════════════════════════
//  ENERGIA REVERSA
// ══════════════════════════════════════════════════════

/**
 * Handler do botão de Energia Reversa — cura própria via PA.
 * 1 PA = 1d4 PV recuperado.
 */
export async function onEnergiaReversa(actor) {
  const paDisp = actor.system?.energy?.generated ?? 0;
  const prof    = actor.system?.attributes?.prof ?? 2;
  const maxDados = prof * 2; // máximo de dados por rodada = dobro do bônus de proficiência
  const maxPA   = Math.min(paDisp, maxDados);

  if ( paDisp === 0 ) {
    ui.notifications.warn("PA Gerada insuficiente para Energia Reversa!");
    return;
  }

  const paGasto = await foundry.applications.api.DialogV2.wait({
    window: { title: "💚 Energia Reversa" },
    content: `
      <div style="padding:8px 0">
        <p style="margin:0 0 8px">Gastar PA para se curar (1d4 PV por PA)?</p>
        <p style="margin:0 0 4px; font-size:12px; color:#aaa;">
          PA disponível: <strong>${paDisp}</strong> &nbsp;|&nbsp;
          Máximo por rodada: <strong>${maxPA}</strong> d4
        </p>
        <div style="display:flex; align-items:center; gap:8px; margin-top:8px;">
          <label style="flex:0 0 auto">Dados d4:</label>
          <input type="number" id="jj-enrev-input"
                 value="1" min="1" max="${maxPA}"
                 style="width:60px; text-align:center;">
          <span style="font-size:12px; color:#aaa;">1 PA por dado</span>
        </div>
      </div>`,
    buttons: [
      {
        label:   "Curar",
        action:  "ok",
        default: true,
        callback: (event, button, dialog) => {
          const input = dialog.element?.querySelector("#jj-enrev-input") ?? document.querySelector("#jj-enrev-input");
          return Math.max(1, Math.min(Number(input?.value ?? 1), maxPA));
        }
      },
      {
        label:    "Cancelar",
        action:   "cancel",
        callback: () => null
      }
    ],
    rejectClose: false,
    close: () => null
  });

  if ( !paGasto ) return;

  // Rolar cura
  const roll = await new Roll(`${paGasto}d4`).evaluate();
  if ( game.dice3d ) await game.dice3d.showForRoll(roll, game.user, true);
  const cura = roll.total;

  // Aplicar cura ao HP do ator
  const hpAtual  = actor.system?.attributes?.hp?.value ?? 0;
  const hpMax    = actor.system?.attributes?.hp?.max   ?? 0;
  const hpNovo   = Math.min(hpMax, hpAtual + cura);
  const paNovaPA = Math.max(0, paDisp - paGasto);

  await actor.update({
    "system.attributes.hp.value": hpNovo,
    "system.energy.generated": paNovaPA
  });

  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor:  `💚 <strong>${actor.name}</strong> usa Energia Reversa — recupera <strong>${cura} PV</strong>! (${paGasto} PA gasto)`,
    rollMode: game.settings.get("core", "rollMode")
  });

  ui.notifications.info(`💚 ${actor.name} recuperou ${cura} PV com Energia Reversa.`);
}
