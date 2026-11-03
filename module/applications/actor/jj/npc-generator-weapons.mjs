import { canReadNpcEquipment, validNpcEquipment } from "../../../systems/legacy2-npc-equipment.mjs";

const escape = value => String(value ?? "").replace(/[&<>"']/g,
  char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const normalize = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Render real weapon UUIDs from all readable Item compendiums and world Items. */
export function npcGeneratorWeaponPicker(choices) {
  const groups = [...new Set(choices.map(choice => choice.group))];
  return `<section class="jj-npcgen-weapons" data-npc-weapon-picker>
    <h3>Armas, membros e ataques</h3>
    <p class="hint">As armas da Taxonomia e do Arquétipo entram automaticamente. Selecione aqui as armas adicionais.</p>
    <div class="jj-npcgen-weapon-filters">
      <input type="search" data-weapon-search aria-label="Buscar arma, membro ou ataque" placeholder="Buscar arma, membro ou ataque…">
      <select data-weapon-source aria-label="Origem das armas">
        <option value="">Todas as origens</option>
        ${groups.map(group => `<option value="${escape(group)}">${escape(group)}</option>`).join("")}
      </select>
    </div>
    <p class="jj-npcgen-weapon-count" data-weapon-count aria-live="polite">${choices.length} armas · 0 selecionadas</p>
    <div class="jj-npcgen-weapon-list">
      ${choices.map(choice => `<label class="jj-npcgen-weapon-row" data-weapon-name="${escape(choice.label)}" data-weapon-group="${escape(choice.group)}">
        <input type="checkbox" name="npcWeapons" value="${escape(choice.value)}">
        <span><strong>${escape(choice.label)}</strong><small>${escape(choice.group)}</small></span>
      </label>`).join("")}
    </div>
    <p class="hint" data-weapon-empty${choices.length ? " hidden" : ""}>Nenhuma arma encontrada.</p>
  </section>`;
}

/** Filtering never clears checked choices, including those outside the visible results. */
export function activateNpcGeneratorWeapons(root) {
  const picker = root.querySelector("[data-npc-weapon-picker]");
  if (!picker) return;
  const search = picker.querySelector("[data-weapon-search]");
  const source = picker.querySelector("[data-weapon-source]");
  const rows = Array.from(picker.querySelectorAll(".jj-npcgen-weapon-row"));
  const sync = () => {
    const query = normalize(search.value);
    let visible = 0, selected = 0;
    for (const row of rows) {
      row.hidden = !!((source.value && row.dataset.weaponGroup !== source.value)
        || !normalize(row.dataset.weaponName).includes(query));
      if (!row.hidden) visible++;
      if (row.querySelector("input").checked) selected++;
    }
    picker.querySelector("[data-weapon-count]").textContent = `${visible} de ${rows.length} armas · ${selected} selecionadas`;
    picker.querySelector("[data-weapon-empty]").hidden = visible !== 0;
  };
  search.addEventListener("input", sync);
  source.addEventListener("change", sync);
  picker.addEventListener("change", sync);
  sync();
}

/** Validate the whole selection before actor creation, preserving native activities and effects. */
export async function prepareNpcGeneratorWeapons(uuids, { resolve = globalThis.fromUuid } = {}) {
  if (!Array.isArray(uuids)) throw new Error("A seleção de armas é inválida.");
  const items = [];
  for (const uuid of new Set(uuids)) {
    let source;
    try { source = typeof uuid === "string" ? await resolve?.(uuid) : null; } catch { /* Report unavailable selections below. */ }
    if (!validNpcEquipment(source, "armas") || !canReadNpcEquipment(source)) {
      throw new Error("Uma arma selecionada está indisponível ou não é uma arma. Revise a seleção antes de gerar o NPC.");
    }
    const data = source.toObject();
    delete data._id;
    delete data.folder;
    delete data.ownership;
    data.system.equipped = true;
    if ("container" in data.system) data.system.container = null;
    const flags = (data.flags ??= {})["jujutsu-system"] ??= {};
    delete flags.npcArchetypeEquipment;
    flags.npcGeneratorWeaponSource = source.uuid;
    data._stats = { compendiumSource: source.pack ? source.uuid : (data._stats?.compendiumSource ?? null) };
    items.push(data);
  }
  return items;
}
