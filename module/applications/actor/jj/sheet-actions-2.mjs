import Ruleset from "../../../systems/ruleset.mjs";
import { mountLegacy2DocumentTheme } from "../../shared/legacy2-document-theme.mjs";
import { condicoesDanoAtivas, removerCondicaoDano } from "../../../systems/condicoes-dano.mjs";

/** Player and NPC shortcuts use the same native activity, including its configured costs. */
export async function attackWithWeapon(sheet, event) {
  const actor = sheet.actor, weapons = actor.itemTypes?.weapon ?? [];
  if (!weapons.length) return ui.notifications.warn(`${actor.name} não tem nenhuma arma para atacar.`);
  const escape = foundry.utils.escapeHTML;
  const options = [...weapons].sort((a, b) => Number(!!b.system.equipped) - Number(!!a.system.equipped))
    .map(weapon => `<option value="${escape(weapon.id)}">${escape(weapon.name)}${weapon.system.equipped ? "" : " (não equipada)"}</option>`).join("");
  const id = await foundry.applications.api.DialogV2.wait({
    classes: ["dnd5e2", "jj2-document", "jj2-weapon-choice"], window: { title: "Escolher arma" },
    render: (_event, dialog) => mountLegacy2DocumentTheme(dialog.element, "weapon-choice"),
    content: `<p>Com qual arma você vai atacar?</p><select name="arma" aria-label="Arma para atacar">${options}</select>`,
    buttons: [{ label: "Atacar", action: "ok", default: true,
      callback: (_event, _button, dialog) => dialog.element?.querySelector("select")?.value || false },
    { label: "Cancelar", action: "cancel", callback: () => false }], rejectClose: false, close: () => null
  });
  if (!id) return;
  const weapon = actor.items.get(id);
  const activity = weapon?.system.activities?.contents?.find(activity => activity.type === "attack")
    ?? weapon?.system.activities?.contents?.[0];
  if (!activity) return ui.notifications.warn(`"${weapon?.name ?? "Arma"}" não tem atividade de ataque configurada.`);
  return activity.use({ event }, { configure: true, options: { sheet } });
}

export async function useSheetAction(sheet, event, target) {
  if (!Ruleset.isV2() || !sheet.isEditable) return;
  const actor = sheet.actor, action = target.dataset.acao;
  const cost = { esconder: 1, procurar: 1, interagir: 1 }[action] ?? 0;
  const names = { esconder: "Esconder", procurar: "Procurar", interagir: "Interagir com Objeto" };
  if (!cost && !["ataque", "reativo"].includes(action)) return;
  if (cost && actor.statuses?.has("jj-enfurecido"))
    return ui.notifications.warn(`${actor.name} está Enfurecido — só pode gastar PA com ataques.`);
  if (action === "reativo" && actor.statuses?.has("jj-desatento"))
    return ui.notifications.warn(`${actor.name} está Desatento — sem Reações neste turno.`);
  if (["ataque", "reativo"].includes(action)) return attackWithWeapon(sheet, event);
  const available = Number(actor.system?.legacy2?.actions?.value ?? 0);
  if (available < cost) return ui.notifications.warn(`${names[action]} custa ${cost} PA — ${actor.name} tem apenas ${available} Pontos de Ação.`);
  await actor.update({ "system.legacy2.actions.value": available - cost });
  if (action === "esconder") return actor.rollSkill({ skill: "ste", event });
  if (action === "procurar") return actor.rollSkill({ skill: "prc", event });
  return ui.notifications.info(`${actor.name} interage com um objeto (1 PA consumido).`);
}

export async function removeSheetDamageCondition(sheet) {
  if (!Ruleset.isV2() || !sheet.isEditable) return;
  const active = condicoesDanoAtivas(sheet.actor);
  if (!active.length) return ui.notifications.info(`${sheet.actor.name} não tem nenhuma condição de dano ativa.`);
  const escape = foundry.utils.escapeHTML;
  const selected = active.length === 1 ? active[0] : await foundry.applications.api.DialogV2.wait({
    classes: ["dnd5e2", "jj2-document"], window: { title: "Remover Condição de Dano" },
    content: `<p>Custa <strong>2 Pontos de Ação</strong> e rola Medicina contra a CD da condição.</p>
      <select name="condicao">${active.map(entry => `<option value="${escape(entry.status)}">${escape(entry.label)} — CD ${entry.cd ?? 10}</option>`).join("")}</select>`,
    buttons: [{ label: "Remover", action: "ok", default: true,
      callback: (_event, _button, dialog) => active.find(entry => entry.status === dialog.element?.querySelector("select")?.value) ?? false },
    { label: "Cancelar", action: "cancel", callback: () => false }], rejectClose: false, close: () => null
  });
  if (selected) return removerCondicaoDano(sheet.actor, selected);
}
