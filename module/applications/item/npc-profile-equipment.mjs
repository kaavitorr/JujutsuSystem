import { canReadNpcEquipment, validNpcEquipment } from "../../systems/legacy2-npc-equipment.mjs";

export async function npcEquipmentContext(item) {
  const equipment = item.system._source.equipamentos ?? {};
  const resolve = async (uuid, kind) => {
    const doc = await fromUuid(uuid).catch(() => null);
    return { uuid, kind, name: doc?.name ?? "Equipamento indisponível", img: doc?.img ?? "icons/svg/item-bag.svg" };
  };
  return {
    taxonomy: item.type === "taxonomy",
    armor: equipment.armadura ? await resolve(equipment.armadura, "armadura") : null,
    weapons: await Promise.all((equipment.armas ?? []).map(uuid => resolve(uuid, "armas")))
  };
}

/** Drop/configuration writes are limited to editable NPC profiles. */
export async function configureNpcEquipment(sheet, target, dropped) {
  if (!["taxonomy", "archetype"].includes(sheet.item.type)) return false;
  const { operation, kind, uuid } = target?.dataset ?? {};
  if (operation === "open") {
    const doc = await fromUuid(uuid).catch(() => null);
    if (doc && canReadNpcEquipment(doc)) return doc.sheet.render({ force: true });
    return false;
  }
  if (!sheet.isEditable || !sheet.isEditMode) return false;
  const equipment = structuredClone(sheet.item.system._source.equipamentos ?? { armadura: null, armas: [] });
  if (dropped) {
    const slot = validNpcEquipment(dropped, "armadura") ? "armadura" : validNpcEquipment(dropped, "armas") ? "armas" : null;
    if (!slot || !canReadNpcEquipment(dropped)) {
      ui.notifications.warn("Arraste uma Armadura Natural ou uma Arma para esta aba."); return false;
    }
    if (slot === "armadura") {
      if (equipment.armadura === dropped.uuid) return false;
      equipment.armadura = dropped.uuid;
    } else {
      equipment.armas ??= [];
      if (equipment.armas.includes(dropped.uuid)) return false;
      equipment.armas.push(dropped.uuid);
    }
  } else if (operation === "remove" && ["armadura", "armas"].includes(kind)) {
    if (kind === "armadura") equipment.armadura = null;
    else equipment.armas = (equipment.armas ?? []).filter(value => value !== uuid);
  } else return false;
  return sheet.item.update({ "system.equipamentos": equipment });
}
