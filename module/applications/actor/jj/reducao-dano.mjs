/**
 * jj/reducao-dano.mjs
 * Comportamento da atividade "Redução de Dano".
 *
 * Ao usar a atividade, abre um diálogo onde o jogador digita a fórmula do escudo
 * e marca se a redução vale para um único ataque ou dura até o início do seu
 * próximo turno (reduzindo cada ataque). O resultado da rolagem vira o valor do
 * escudo, armazenado na flag `reducaoDano` e consumido pela pipeline de absorção
 * de dano (damage-application.mjs), na mesma camada das "Reduções".
 */

import { getScaleOptions, applyScaleChoice } from "./jj-scale.mjs";
import { activateUpkeep } from "./constant-cost.mjs";
import { resetHealLimitsByTechnique } from "./heal-limit.mjs";

const FLAG = "reducaoDano";

// ── Intercepta o uso da atividade de tipo "reduction" ───────────────────────────
Hooks.on("dnd5e.preUseActivity", (activity) => {
  if ( activity?.type !== "reduction" ) return;
  activateUpkeep(activity); // ativa Custo Constante/Concentração/Duração antes do veto
  resetHealLimitsByTechnique(activity); // reset-por-técnica (o veto abaixo barraria o listener global)
  _ativarReducao(activity);
  return false; // cancela o comportamento nativo — tratamos tudo aqui
});

/**
 * Abre o diálogo, rola a fórmula e cria o escudo de redução.
 * @param {Activity} activity
 */
async function _ativarReducao(activity) {
  const actor = activity.item?.actor ?? activity.actor;
  if ( !actor ) return;

  // Fórmula base configurada na atividade (aba Efeito) — somente leitura aqui
  const baseFormula = (activity.reduction?.formula ?? "").trim();
  const baseDisplay = baseFormula || "—";
  if ( baseFormula && !Roll.validate(baseFormula) ) {
    ui.notifications.error(`Fórmula do escudo inválida: "${baseFormula}".`);
    return;
  }

  // Opções de escala embutidas no próprio diálogo (a ativação ainda NÃO foi paga
  // na Redução — o fluxo nativo é cancelado, então o custo de ativação dá a base)
  const scaleData = getScaleOptions({ actor, activity, baseLabel: baseFormula || "0", activationPaid: false });
  const scaleHtml = scaleData.available
    ? `<div style="display:flex; align-items:center; gap:8px; margin:0 0 4px;">
         <label style="flex:0 0 auto;">Custo / Escala (${scaleData.poolLabel}):</label>
         <select id="jj-red-scale" style="flex:1 1 auto;">${scaleData.optionsHtml}</select>
       </div>
       <p style="margin:0 0 10px; font-size:11px; color:#8080a0;">
         Ativação: <strong>${scaleData.activationCost}</strong> ${scaleData.poolLabel} → base.
         Cada <strong>+${scaleData.cost}</strong> ${scaleData.poolLabel} → +<strong>${scaleData.formula}</strong>${scaleData.maxPA > 0 ? ` (teto ${scaleData.maxPA} PA de escala)` : ""}.
       </p>`
    : "";

  const escolha = await foundry.applications.api.DialogV2.wait({
    window: { title: "🛡️ Redução de Dano" },
    content: `
      <div style="padding:8px 0; font-size:13px; color:#ccc; line-height:1.6;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
          <span style="flex:0 0 auto;">Fórmula do escudo:</span>
          <strong style="flex:1 1 auto; text-align:center; color:#c0a8ff;">${baseDisplay}</strong>
        </div>
        ${scaleHtml}
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
          <input type="checkbox" id="jj-red-persistente">
          <span>Durar até o início do meu próximo turno (reduz <em>cada</em> ataque)</span>
        </label>
        <p style="margin:8px 0 0; font-size:11px; color:#8080a0;">
          Desmarcado = reduz apenas o próximo ataque (uso único).
        </p>
      </div>`,
    buttons: [
      {
        label: "Ativar Escudo",
        action: "ok",
        default: true,
        callback: (event, button, dialog) => {
          const root = dialog.element ?? document;
          return {
            incrementos: Number(root.querySelector("#jj-red-scale")?.value ?? 0),
            persistente: root.querySelector("#jj-red-persistente")?.checked === true
          };
        }
      },
      { label: "Cancelar", action: "cancel", callback: () => null }
    ],
    rejectClose: false,
    close: () => null
  });

  if ( !escolha ) return;

  // Modo persistente depende do início do próximo turno → exige combate ativo
  if ( escolha.persistente && !game.combat ) {
    ui.notifications.warn("O modo persistente (até o próximo turno) requer um combate ativo. Use o modo de ataque único fora de combate.");
    return;
  }

  // Aplica ativação + escala (deduz PA) e soma à base numa única rolagem
  const escala = await applyScaleChoice({ actor, activity, incrementos: escolha.incrementos, activationPaid: false });
  if ( escala.activationOk === false ) {
    ui.notifications.warn("PA insuficiente para ativar a Redução de Dano.");
    return;
  }

  const parts = [];
  if ( baseFormula ) parts.push(baseFormula);
  if ( escala.bonusFormula ) parts.push(escala.bonusFormula);
  const fullFormula = parts.join(" + ") || "0";

  let roll;
  try {
    roll = await new Roll(fullFormula, actor.getRollData()).evaluate();
  } catch(err) {
    ui.notifications.error(`Fórmula inválida para Redução de Dano: "${fullFormula}".`);
    return;
  }
  if ( game.dice3d ) await game.dice3d.showForRoll(roll, game.user, true);
  const valor = roll.total;

  // Escudo só faz sentido com valor positivo
  if ( !(valor > 0) ) {
    ui.notifications.warn(`Redução de Dano resultou em ${valor} — escudo não criado.`);
    return;
  }

  await actor.setFlag("jujutsu-system", FLAG, { valor, persistente: escolha.persistente });

  const modo = escolha.persistente
    ? "dura até o início do próximo turno (reduz cada ataque)"
    : "reduz o próximo ataque (uso único)";
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `🛡️ <strong>${actor.name}</strong> ativa <strong>Redução de Dano</strong> — escudo de <strong>${valor}</strong> — ${modo}.`,
    rollMode: game.settings.get("core", "rollMode")
  });
  ui.notifications.info(`Redução de Dano ativa: escudo de ${valor}.`);
}

/**
 * Define qual cliente é responsável por limpar a flag do ator (evita dupla
 * execução e cobre o caso sem GM). GM primário age; sem GM ativo, o dono age.
 * @param {Actor5e} actor
 * @returns {boolean}
 */
function _podeLimpar(actor) {
  const gm = game.users?.activeGM;
  return gm ? (gm === game.user) : (actor?.isOwner === true);
}

// ── Limpa a redução persistente no início do próximo turno do conjurador ────────
Hooks.on("combatTurnChange", async (combat, prior, current) => {
  const combatant = combat.combatants.get(current?.combatantId);
  const actor = combatant?.actor;
  if ( !actor || !_podeLimpar(actor) ) return;
  const red = actor.getFlag("jujutsu-system", FLAG);
  if ( red?.persistente ) {
    await actor.unsetFlag("jujutsu-system", FLAG);
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `🛡️ A Redução de Dano de <strong>${actor.name}</strong> se dissipa no início do turno.`
    });
  }
});

// ── Rede de segurança: ao encerrar o combate, limpa escudos persistentes que
//    porventura tenham sobrado dos combatentes daquele combate ────────────────
Hooks.on("deleteCombat", async (combat) => {
  for ( const combatant of (combat?.combatants ?? []) ) {
    const actor = combatant?.actor;
    if ( !actor || !_podeLimpar(actor) ) continue;
    if ( actor.getFlag("jujutsu-system", FLAG)?.persistente ) {
      await actor.unsetFlag("jujutsu-system", FLAG);
    }
  }
});
