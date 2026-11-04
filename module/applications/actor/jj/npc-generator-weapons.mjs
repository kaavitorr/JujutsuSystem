import { canReadNpcEquipment, validNpcEquipment } from "../../../systems/legacy2-npc-equipment.mjs";

const escape = value => String(value ?? "").replace(/[&<>"']/g,
  char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const normalize = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** The (NPC) attacks belong to 1.0 and must not enter the 2.0 generator. */
export const isNpcGenerator2Weapon = item => validNpcEquipment(item, "armas") && !/\(\s*npc\s*\)/i.test(item.name ?? "");

export const NPC_WEAPON_FOLDERS = Object.freeze([
  { key: "base", label: "Base", words: [] },
  { key: "fire", label: "Fogo", words: ["fire", "fogo", "flamejante", "flamejantes"] },
  { key: "acid", label: "Ácido", words: ["acid", "acido", "caustica", "causticas", "caustico", "causticos"] },
  { key: "lightning", label: "Elétrico", words: ["lightning", "eletrico", "eletrica", "carregado", "carregada", "carregados", "carregadas"] },
  { key: "cold", label: "Frio", words: ["cold", "frio", "gelo", "frigido", "frigida", "frigidos", "frigidas"] },
  { key: "thunder", label: "Trovejante", words: ["thunder", "trovejante", "estrondoso", "estrondosa", "estrondosos", "estrondosas"] },
  { key: "psychic", label: "Psíquico", words: ["psychic", "psiquico", "psiquica", "psiquicos", "psiquicas"] },
  { key: "radiant", label: "Energia", words: ["radiant", "radiante", "radiantes", "energia"] },
  { key: "poison", label: "Veneno", words: ["poison", "veneno", "venenoso", "venenosa", "venenosos", "venenosas"] },
  { key: "soul", label: "Alma", words: ["soul", "alma", "shadow", "sombrio", "sombria", "sombrios", "sombrias"] }
]);

/** Classify by damage, never by names such as "Armas de Fogo". Metadata supports older Items without damage data. */
export function npcGeneratorWeaponFolder(item) {
  const types = new Set();
  const addTypes = values => {
    for (const value of typeof values === "string" ? [values] : values ?? []) types.add(normalize(value));
  };
  const addDamage = damage => {
    addTypes(damage?.types);
    for (const part of damage?.parts ?? []) addTypes(Array.isArray(part) ? part[1] : part.types);
  };
  const system = item.system;
  addDamage(system?.damage?.base);
  addDamage(system?.damage?.versatile);
  addDamage(system?.damage);
  for (const activity of Object.values(system?.activities ?? {})) {
    if (activity.type !== "heal") addDamage(activity.damage);
  }
  const element = normalize(item.flags?.["jujutsu-system"]?.elemento);
  const authored = NPC_WEAPON_FOLDERS.find(folder => folder.words.includes(element));
  if (!types.size) return authored?.key ?? "base";
  const matches = NPC_WEAPON_FOLDERS.filter(folder => folder.words.some(type => types.has(type)));
  return (matches.find(folder => folder === authored) ?? matches[0])?.key ?? "base";
}

const folderIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M3 7v12a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-9l-2-3H4a1 1 0 0 0-1 1z"/></svg>';

/** Render real weapon UUIDs from all readable Item compendiums and world Items. */
export function npcGeneratorWeaponPicker(choices) {
  const groups = [...new Set(choices.map(choice => choice.group))];
  const entries = choices.map(choice => ({ ...choice, folder: NPC_WEAPON_FOLDERS.some(folder => folder.key === choice.folder)
    ? choice.folder : npcGeneratorWeaponFolder({ name: choice.label }) }));
  const folders = NPC_WEAPON_FOLDERS.map(folder => ({ ...folder, count: entries.filter(choice => choice.folder === folder.key).length }));
  const button = folder => `<button type="button" class="jj-npcgen-folder" data-weapon-folder-button data-weapon-folder="${folder.key}" aria-pressed="${folder.key === "base"}">${folderIcon}<span>${folder.label}</span><small>${folder.count}</small></button>`;
  return `<section class="jj-npcgen-weapons" data-npc-weapon-picker>
    <h3>Armas, membros e ataques</h3>
    <p class="hint">As armas do perfil entram automaticamente. Marque as adicionais.</p>
    <div class="jj-npcgen-weapon-filters">
      <label class="jj-npcgen-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input type="search" data-weapon-search aria-label="Buscar arma, membro ou ataque" placeholder="Buscar nesta pasta…"></label>
      <select data-weapon-source aria-label="Origem das armas">
        <option value="">Todas as origens</option>
        ${groups.map(group => `<option value="${escape(group)}">${escape(group)}</option>`).join("")}
      </select>
    </div>
    <div class="jj-npcgen-weapon-browser">
      <nav class="jj-npcgen-folders" aria-label="Pastas de equipamentos">
        ${button(folders[0])}
        <details open><summary>${folderIcon}<span>Elementais</span><svg class="jj-npcgen-folder-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></summary><div class="jj-npcgen-element-folders">
          ${folders.slice(1).filter(folder => folder.count).map(button).join("")}
        </div></details>
        ${button({ key: "all", label: "Todas", count: entries.length })}
      </nav>
      <div class="jj-npcgen-weapon-results">
        <h4 data-weapon-heading>Base</h4>
        <p class="jj-npcgen-weapon-count" data-weapon-count aria-live="polite">${folders[0].count} armas · 0 selecionadas</p>
        <div class="jj-npcgen-weapon-list">
      ${entries.map(choice => `<label class="jj-npcgen-weapon-row" data-weapon-name="${escape(choice.label)}" data-weapon-group="${escape(choice.group)}" data-weapon-folder="${choice.folder}"${choice.folder !== "base" ? " hidden" : ""}>
        <input type="checkbox" name="npcWeapons" value="${escape(choice.value)}">
        <img src="${escape(choice.img || "icons/svg/sword.svg")}" alt="" loading="lazy" width="36" height="36">
        <span><strong>${escape(choice.label)}</strong><small title="${escape(choice.group)}">${escape(choice.group)}</small></span>
      </label>`).join("")}
        </div>
        <p class="hint" data-weapon-empty${folders[0].count ? " hidden" : ""}>Nenhuma arma encontrada nesta pasta. Ajuste a busca ou escolha outra pasta.</p>
      </div>
    </div>
  </section>`;
}

/** Filtering never clears checked choices, including those outside the visible results. */
export function activateNpcGeneratorWeapons(root) {
  const picker = root.querySelector("[data-npc-weapon-picker]");
  if (!picker) return;
  const search = picker.querySelector("[data-weapon-search]");
  const source = picker.querySelector("[data-weapon-source]");
  const rows = Array.from(picker.querySelectorAll(".jj-npcgen-weapon-row"), row => ({
    element: row,
    input: row.querySelector("input"),
    name: normalize(row.dataset.weaponName),
    group: row.dataset.weaponGroup,
    folder: row.dataset.weaponFolder
  }));
  const folders = Array.from(picker.querySelectorAll("[data-weapon-folder-button]"));
  const count = picker.querySelector("[data-weapon-count]");
  const empty = picker.querySelector("[data-weapon-empty]");
  const heading = picker.querySelector("[data-weapon-heading]");
  let active = "base";
  const sync = () => {
    const query = normalize(search.value);
    const group = source.value;
    let visible = 0, selected = 0;
    for (const row of rows) {
      const hidden = !!((active !== "all" && row.folder !== active)
        || (group && row.group !== group)
        || !row.name.includes(query));
      if (row.element.hidden !== hidden) row.element.hidden = hidden;
      if (!hidden) visible++;
      if (row.input.checked) selected++;
    }
    count.textContent = `${visible} de ${rows.length} armas · ${selected} ${selected === 1 ? "selecionada" : "selecionadas"}`;
    if (empty.hidden !== (visible !== 0)) empty.hidden = visible !== 0;
    heading.textContent = NPC_WEAPON_FOLDERS.find(folder => folder.key === active)?.label ?? "Todas as pastas";
  };
  for (const folder of folders) folder.addEventListener("click", () => {
    active = folder.dataset.weaponFolder;
    for (const button of folders) button.setAttribute("aria-pressed", String(button === folder));
    sync();
  });
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
    if (!isNpcGenerator2Weapon(source)) {
      throw new Error("Um ataque da versão 1.0 foi selecionado. Reabra o gerador e escolha os equipamentos da versão 2.0.");
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
