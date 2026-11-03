/**
 * jj/explosao-defensiva.mjs
 * Explosão Defensiva — botão na sidebar, dialog, aplicação de dano.
 * Energia Reversa   — botão na sidebar, dialog, cura própria.
 */
import Ruleset from "../../../systems/ruleset.mjs";
import { rollModeAtual } from "../../../utils.mjs";

import { defensiveBurstContent, mountDefensiveBurstDialog } from "./defensive-burst-dialog-2.mjs";
import { stepActivationCounter } from "../../activity/legacy2-activation.mjs";
import { onPhysicalImpulseDefense } from "./physical-impulse-2.mjs";

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
    rollMode: rollModeAtual()
  });

  return { reducao: total, paCusto: paGasto };
}

// ══════════════════════════════════════════════════════
//  EXPLOSÃO DEFENSIVA — 2.0
// ══════════════════════════════════════════════════════

/**
 * 2.0: habilidade padrão (não exige manipulação). Sempre d4; limite de
 * dados = metade do nível arredondada para cima, com 1 PA de energia refinada
 * por dado. Pontos de Ação são um recurso separado e não são consumidos aqui.
 */
export async function onExplosaoDefensiva2(actor) {
  if (Ruleset.isRestringido(actor)) return onPhysicalImpulseDefense(actor);
  const pending = actor.getFlag("jujutsu-system", "explosaoDefensivaPendente");
  if (Number(pending?.reducao) > 0) {
    const replace = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Explosão Defensiva ativa" },
      content: `<p>Você ainda tem <strong>${Number(pending.reducao)}</strong> de redução aguardando o próximo dano. Deseja substituí-la por uma nova rolagem? O novo uso terá seu próprio custo.</p>`,
      yes: { label: "Substituir" }, no: { label: "Manter redução" }
    });
    if (!replace) return;
  }
  const nivel = Ruleset.nivel(actor);
  const limiteDados = Math.ceil(nivel / 2);
  const available = Math.max(0, Math.floor(Number(actor.system.energy?.generated) || 0));
  const maxDados = Math.min(limiteDados, available);
  if (!maxDados) { ui.notifications.warn("Energia refinada insuficiente para Explosão Defensiva."); return; }

  const dados = await foundry.applications.api.DialogV2.wait({
    classes: ["dnd5e2", "jj2-document", "jj2-defensive-burst"],
    position: { width: 400 },
    window: { title: "Explosão Defensiva" },
    content: defensiveBurstContent({ limiteDados, nivel, maxDados, available }),
    actions: { jj2StepCounter: stepActivationCounter },
    render: (event, dialog) => mountDefensiveBurstDialog(dialog),
    buttons: [
      {
        label: "Preparar defesa",
        action: "ok",
        default: true,
        callback: (event, button, dialog) => {
          const input = dialog.element?.querySelector("#jj2-expdef-input") ?? document.querySelector("#jj2-expdef-input");
          const n = Number(input?.value ?? 1);
          return Math.max(1, Math.min(Number.isFinite(n) ? Math.floor(n) : 1, maxDados));
        }
      },
      { label: "Cancelar", action: "cancel", callback: () => false }
    ],
    rejectClose: false,
    close: () => null
  });
  if ( !dados ) return;
  if (Number(actor.system.energy?.generated) < dados) { ui.notifications.warn("Energia refinada insuficiente para Explosão Defensiva."); return; }

  const roll = await new Roll(`${dados}d4`).evaluate();
  const current = Number(actor.system.energy?.generated) || 0;
  if (current < dados) { ui.notifications.warn("Energia refinada insuficiente para Explosão Defensiva."); return; }
  await actor.update({ "system.energy.generated": current - dados,
    "flags.jujutsu-system.explosaoDefensivaPendente": { reducao: roll.total, paCusto: dados }
  }, { isEnergySystem: true });
  if ( game.dice3d ) await game.dice3d.showForRoll(roll, game.user, true);
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `<strong>${foundry.utils.escapeHTML(actor.name)}</strong> usa Explosão Defensiva — reduz <strong>${roll.total}</strong> do próximo dano!`,
    rollMode: rollModeAtual()
  });

  ui.notifications.info(`Explosão Defensiva ativa! Próximo dano reduzido em ${roll.total}. ${dados} PA de energia refinada gastos.`);
}

// ══════════════════════════════════════════════════════
//  ENERGIA REVERSA
// ══════════════════════════════════════════════════════

export { curarEnergiaReversa1 as onEnergiaReversa } from "./energia-reversa-1.mjs";

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
