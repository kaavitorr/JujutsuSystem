import Ruleset from "../../../systems/ruleset.mjs";
import { SKILL_GROUPS } from "../../../systems/legacy2-skills.mjs";
import { mountLegacy2DocumentTheme } from "../../shared/legacy2-document-theme.mjs";

const canUse = sheet => Ruleset.isV2() && sheet.isEditable && sheet.actor?.type === "npc";
const skills = SKILL_GROUPS.flatMap(group => group.skills);

export async function prepareNpcFavorites(sheet) {
  const actor = sheet.actor, result = [];
  for (const favorite of [...(actor.system.favorites ?? [])].sort((a, b) => a.sort - b.sort)) {
    if (favorite.type === "skill") {
      const skill = skills.find(([key]) => key === favorite.id);
      if (skill) result.push({ ...favorite, title: skill[1], key: skill[0] });
      continue;
    }
    const doc = await fromUuid(favorite.id, { relative: actor }).catch(() => null);
    if (!doc || doc.dependentOrigin?.active === false) continue;
    const item = favorite.type === "activity" ? doc.item : doc;
    if (actor.hiddenItems?.has(item?.id)) continue;
    result.push({ ...favorite, title: doc.name, img: doc.img ?? item?.img,
      itemId: ["item", "activity"].includes(favorite.type) ? item?.id : null });
  }
  return result;
}

export async function useNpcFavorite(sheet, event, target) {
  if (!canUse(sheet)) return;
  const id = target.closest("[data-favorite-id]")?.dataset.favoriteId;
  const favorite = sheet.actor.system.favorites.find(entry => entry.id === id);
  if (!favorite) return;
  if (favorite.type === "skill") return sheet.actor.rollSkill({ skill: id, event });
  const doc = await fromUuid(id, { relative: sheet.actor }).catch(() => null);
  if (!doc) return ui.notifications.warn("Este atalho não está mais disponível. Remova-o e escolha outro.");
  if (favorite.type === "effect") return doc.update({ disabled: !doc.disabled });
  if (doc.type === "container") return sheet._renderChild(doc.sheet);
  if (favorite.type === "activity" && doc.canUse === false) return;
  return doc.use({ event }, { configure: true, options: { sheet } });
}

export function deleteNpcFavorite(sheet, target) {
  if (!canUse(sheet) || !sheet.isEditMode) return;
  const id = target.closest("[data-favorite-id]")?.dataset.favoriteId;
  if (id) return sheet.actor.system.removeFavorite(id);
}

/** Configure using owned documents, so shortcuts never create another item or spend resources themselves. */
export async function configureNpcFavorite(sheet) {
  if (!canUse(sheet) || !sheet.isEditMode) return;
  const actor = sheet.actor, entries = [];
  for (const item of actor.items) {
    const id = foundry.utils.buildRelativeUuid(item, actor);
    entries.push({ type: "item", id, label: item.name });
    for (const activity of item.system.activities?.contents ?? []) entries.push({ type: "activity",
      id: `${id}.Activity.${activity.id}`, label: `${item.name} · ${activity.name}` });
  }
  entries.push(...skills.map(([id, label]) => ({ type: "skill", id, label: `${label} · Perícia` })));
  const available = entries.filter(entry => !actor.system.hasFavorite(entry.id));
  const escape = foundry.utils.escapeHTML;
  const choice = await foundry.applications.api.DialogV2.wait({
    classes: ["dnd5e2", "jj2-document", "jj2-weapon-choice"], window: { title: "Adicionar atalho" },
    render: (_event, dialog) => mountLegacy2DocumentTheme(dialog.element, "weapon-choice"),
    content: `<p>Escolha um item, atividade ou perícia da ficha.</p><select aria-label="Atalho">${available.map((entry, index) => `<option value="${index}">${escape(entry.label)}</option>`).join("")}</select>`,
    buttons: [{ label: "Adicionar", action: "add", default: true,
      callback: (_event, _button, dialog) => {
        const value = dialog.element?.querySelector("select")?.value;
        return typeof value === "string" && /^\d+$/.test(value) ? available[Number(value)] ?? false : false;
      } },
    { label: "Cancelar", action: "cancel", callback: () => false }], rejectClose: false, close: () => null
  });
  if (choice) return actor.system.addFavorite({ type: choice.type, id: choice.id });
}

export async function dropNpcFavorite(sheet, data) {
  if (!canUse(sheet)) return;
  if (data.dnd5e?.action === "favorite" && data.dnd5e.type === "skill") {
    if (skills.some(([id]) => id === data.dnd5e.id))
      return sheet.actor.system.addFavorite({ type: "skill", id: data.dnd5e.id });
    return;
  }
  const doc = data.uuid ? await fromUuid(data.uuid).catch(() => null) : null;
  const activity = data.type === "Activity", effect = data.type === "ActiveEffect";
  if (!doc || (activity ? doc.actor : effect ? doc.target : doc.parent) !== sheet.actor) {
    return ui.notifications.warn("Escolha um item ou atividade que já esteja nesta ficha para criar o atalho.");
  }
  const id = activity ? `${foundry.utils.buildRelativeUuid(doc.item, sheet.actor)}.Activity.${doc.id}`
    : foundry.utils.buildRelativeUuid(doc, sheet.actor);
  return sheet.actor.system.addFavorite({ type: activity ? "activity" : effect ? "effect" : "item", id });
}
