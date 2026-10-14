import Ruleset from "../../../systems/ruleset.mjs";
import { rollModeAtual } from "../../../utils.mjs";
import { defensiveBurstContent, mountDefensiveBurstDialog } from "./defensive-burst-dialog-2.mjs";
import { stepActivationCounter } from "../../activity/legacy2-activation.mjs";

/** The existing pending-defense flag lets both damage pipelines consume this protection once. */
export async function onPhysicalImpulseDefense(actor) {
  if (!Ruleset.isRestringido(actor)) return;
  const limit = Ruleset.physicalImpulseLimit(actor), available = Math.max(0, Math.floor(Number(actor.system.energy?.generated) || 0));
  const maximum = Math.min(limit, available);
  if (!maximum) {
    ui.notifications.warn(limit ? "Estamina insuficiente para Impulso Físico." : "O nível do personagem não permite usar Impulso Físico.");
    return;
  }
  const chosen = await foundry.applications.api.DialogV2.wait({
    classes: ["dnd5e2", "jj2-document", "jj2-defensive-burst"], position: { width: 400 },
    window: { title: "Impulso Físico · Defesa" },
    content: defensiveBurstContent({ limiteDados: limit, nivel: Ruleset.nivel(actor), maxDados: maximum, physicalImpulse: true, available }),
    actions: { jj2StepCounter: stepActivationCounter }, render: (event, dialog) => mountDefensiveBurstDialog(dialog),
    buttons: [{ label: "Preparar defesa", action: "ok", default: true, callback: (event, button, dialog) => {
      const value = Number(dialog.element?.querySelector("#jj2-expdef-input")?.value);
      return Number.isFinite(value) ? Math.max(1, Math.min(Math.floor(value), maximum)) : 1;
    } }, { label: "Cancelar", action: "cancel", callback: () => null }], rejectClose: false, close: () => null
  });
  if (!chosen) return;
  const pe = Math.min(maximum, Math.max(1, Math.floor(Number(chosen))));
  if (!Number.isFinite(pe) || actor.system.energy.generated < pe) {
    ui.notifications.warn("Estamina insuficiente para Impulso Físico."); return;
  }
  const roll = await new Roll(`${2 * pe}d4`).evaluate();
  // Revalidate after the asynchronous roll before spending and preparing the defense atomically.
  const current = Number(actor.system.energy.generated) || 0;
  if (current < pe) { ui.notifications.warn("Estamina insuficiente para Impulso Físico."); return; }
  await actor.update({ "system.energy.generated": current - pe,
    "flags.jujutsu-system.explosaoDefensivaPendente": { reducao: roll.total, physicalImpulse: true, peCusto: pe } }, { isEnergySystem: true });
  if (game.dice3d) await game.dice3d.showForRoll(roll, game.user, true);
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), rollMode: rollModeAtual(),
    flavor: `<strong>${foundry.utils.escapeHTML(actor.name)}</strong> usa Impulso Físico (${pe} PE) — reduz <strong>${roll.total}</strong> do próximo dano!` });
  ui.notifications.info(`Impulso Físico preparado: ${roll.total} de redução, ${pe} PE gastos.`);
}
