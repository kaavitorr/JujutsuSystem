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
  const level     = actor.system?.details?.level ?? 1;
  const prof      = actor.system?.attributes?.prof ?? 2;
  const maxDados  = prof * 2;       // máximo de dados por rodada = dobro do bônus de proficiência
  const threshold = level * 10;     // limite de cura usando Energia TOTAL (10× nível)

  // Enquanto não curou 10× nível pela Total, gasta da TOTAL; depois, da GERADA
  // (até descanso longo ou Fulgor Negro, que resetam o acumulado).
  const jaCurado    = Number(actor.getFlag("jujutsu-system", "energiaReversaTotalCurado")) || 0;
  const usandoTotal = jaCurado < threshold;
  const pool        = usandoTotal ? "total" : "generated";
  const poolLabel   = usandoTotal ? "Energia Total" : "Energia Gerada";
  const paDisp      = actor.system?.energy?.[pool] ?? 0;
  const maxPA       = Math.min(paDisp, maxDados);

  if ( paDisp <= 0 ) {
    ui.notifications.warn(`${poolLabel} insuficiente para Energia Reversa!`);
    return;
  }

  // Reversão Dominada (TREINAMENTO): gastar 4+ PA soma o modificador de atributo
  // principal (atributo de conjuração) ao resultado da cura.
  const temReversaoDominada = (Number(actor.system?.trainings?.reversaoDominada?.rank) || 0) > 0;
  const abilPrinc = actor.system?.attributes?.spellcasting;
  const modPrinc  = abilPrinc ? (actor.system?.abilities?.[abilPrinc]?.mod ?? 0) : 0;

  // Alvo: se o usuário mirou outra criatura, só cura ela se tiver Energia Flexível (metade do valor)
  const temFlexivel = actor.system?.manipulation?.abilities?.energiaFlexivel?.unlocked === true;
  const ownTokens   = actor.getActiveTokens?.() ?? [];
  const targets     = [...(game.user?.targets ?? [])];
  if ( targets.length > 1 ) {
    ui.notifications.info("Múltiplos alvos mirados: Energia Reversa afeta apenas o primeiro.");
  }
  const targetToken = targets[0] ?? null;
  const alvoOutro   = !!(targetToken?.actor && !ownTokens.includes(targetToken));
  let alvoActor = actor;
  let metade = false;
  if ( alvoOutro ) {
    if ( !temFlexivel ) {
      ui.notifications.warn("Para usar Energia Reversa em outra criatura é necessário a habilidade Energia Flexível.");
      return;
    }
    // Precisa de permissão de dono no alvo para aplicar a cura (evita falha de update pós-rolagem)
    if ( !targetToken.actor.isOwner ) {
      ui.notifications.warn(`Você não tem permissão para curar ${targetToken.actor.name}. Peça ao GM.`);
      return;
    }
    alvoActor = targetToken.actor;
    metade = true;
  }
  const alvoNome = alvoActor === actor ? actor.name : alvoActor.name;

  const paGasto = await foundry.applications.api.DialogV2.wait({
    window: { title: "💚 Energia Reversa" },
    content: `
      <div style="padding:8px 0">
        <p style="margin:0 0 8px">Gastar <strong>${poolLabel}</strong> para curar <strong>${alvoNome}</strong> (1d4 PV por PA${metade ? ", <em>metade</em> — Energia Flexível" : ""})?</p>
        <p style="margin:0 0 4px; font-size:12px; color:#aaa;">
          ${poolLabel} disponível: <strong>${paDisp}</strong> &nbsp;|&nbsp;
          Máximo por rodada: <strong>${maxPA}</strong> d4
        </p>
        <p style="margin:0 0 4px; font-size:12px; color:${usandoTotal ? "#9be29b" : "#e6c06a"};">
          ${usandoTotal
            ? `Usando Energia Total — restam <strong>${threshold - jaCurado}</strong> de cura antes de trocar para a Gerada.`
            : `Limite de 10× nível atingido — usando Energia Gerada até descanso longo / Fulgor Negro.`}
        </p>
        ${temReversaoDominada
          ? `<p style="margin:4px 0 0; font-size:12px; color:#c0a8ff;">Reversão Dominada: gastar <strong>4+ PA</strong> adiciona <strong>+${Math.max(0, modPrinc)}</strong> ao resultado.</p>`
          : ""}
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

  // Reversão Dominada: +modificador principal embutido NA ROLAGEM (4d4 + mod)
  // se gastou 4+ PA. Modificador negativo conta como 0 (mínimo).
  const bonusMod = (temReversaoDominada && paGasto >= 4) ? Math.max(0, modPrinc) : 0;
  const formula = bonusMod > 0 ? `${paGasto}d4 + ${bonusMod}` : `${paGasto}d4`;

  // Rolar cura
  const roll = await new Roll(formula).evaluate();
  if ( game.dice3d ) await game.dice3d.showForRoll(roll, game.user, true);

  const curaBase = Math.max(0, roll.total);
  const cura     = metade ? Math.floor(curaBase / 2) : curaBase;

  // Aplicar cura ao HP do alvo; o custo de PA sai sempre do usuário
  const hp       = alvoActor.system?.attributes?.hp ?? {};
  const hpMax    = hp.effectiveMax ?? hp.max ?? 0;
  const hpNovo   = Math.min(hpMax, (hp.value ?? 0) + cura);
  const novaPool = Math.max(0, paDisp - paGasto);

  // Custo de PA sai SEMPRE do usuário, do pool atual (Total ou Gerada).
  const userUpdate = { [`system.energy.${pool}`]: novaPool };
  // Enquanto usa a Total, acumula o quanto já curou (rumo ao limite de 10× nível).
  if ( usandoTotal ) userUpdate["flags.jujutsu-system.energiaReversaTotalCurado"] = jaCurado + cura;

  if ( alvoActor === actor ) {
    userUpdate["system.attributes.hp.value"] = hpNovo;
    await actor.update(userUpdate, { isEnergySystem: true });
  } else {
    await alvoActor.update({ "system.attributes.hp.value": hpNovo });
    await actor.update(userUpdate, { isEnergySystem: true });
  }

  const bonusNota = bonusMod ? ` (com Reversão Dominada)` : "";
  const detalhe = (metade ? ` (metade de ${curaBase} — Energia Flexível)` : "") + bonusNota;
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor:  `💚 <strong>${actor.name}</strong> usa Energia Reversa em <strong>${alvoNome}</strong> — recupera <strong>${cura} PV</strong>${detalhe}! (${paGasto} ${poolLabel} gasto)`,
    rollMode: game.settings.get("core", "rollMode")
  });

  ui.notifications.info(`💚 ${alvoNome} recuperou ${cura} PV com Energia Reversa.`);
}

// Reset do limite de cura por Energia Total (10× nível): descanso longo ou Fulgor Negro.
function _resetEnergiaReversaTotal(actor, motivo) {
  const gm = game.users?.activeGM;
  const podeAgir = gm ? (gm === game.user) : (actor?.isOwner === true);
  if ( !actor || !podeAgir ) return;
  if ( (Number(actor.getFlag("jujutsu-system", "energiaReversaTotalCurado")) || 0) === 0 ) return;
  actor.unsetFlag("jujutsu-system", "energiaReversaTotalCurado");
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `💚 <b>${actor.name}</b> — Energia Reversa: limite de cura por Energia Total resetado (${motivo}).`
  });
}

Hooks.on("dnd5e.restCompleted", (actor, result) => {
  if ( result?.longRest ?? (result?.type === "long") ) _resetEnergiaReversaTotal(actor, "descanso longo");
});
Hooks.on("jujutsu.fulgorNegro", (actor) => _resetEnergiaReversaTotal(actor, "Fulgor Negro"));

// ══════════════════════════════════════════════════════
//  FOCO DEFENSIVO — ativar/desativar Pontos de Armadura
// ══════════════════════════════════════════════════════

/**
 * Alterna o Foco Defensivo:
 *  - Inativo (valor 0)  → ativa, enchendo os Pontos de Armadura até o máximo
 *    (20 base + 20 do Fluxo Constante + rank×Nível de Maestria da Resistência
 *    Aprimorada — o máximo já é derivado em character.mjs).
 *  - Ativo (valor > 0)  → desativa, zerando os Pontos de Armadura.
 *
 * @param {Actor5e} actor
 */
export async function onFocoDefensivo(actor) {
  const armor = actor.system?.armorPoints;
  const max = armor?.max ?? 0;

  if ( max <= 0 ) {
    ui.notifications.warn("Foco Defensivo não está disponível (habilidade não desbloqueada).");
    return;
  }

  const ativo = (armor?.value ?? 0) > 0;

  if ( ativo ) {
    await actor.update({ "system.armorPoints.value": 0 });
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `🛡️ <strong>${actor.name}</strong> desativou o <strong>Foco Defensivo</strong>.`
    });
    ui.notifications.info("Foco Defensivo desativado.");
  } else {
    await actor.update({ "system.armorPoints.value": max });
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `🛡️ <strong>${actor.name}</strong> ativou o <strong>Foco Defensivo</strong> — recebe <strong>${max} Pontos de Armadura</strong>!`
    });
    ui.notifications.info(`Foco Defensivo ativado: ${max} Pontos de Armadura.`);
  }
}
