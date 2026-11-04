import { npcGeneratorArchetypesForTaxonomy } from "./npc-generator-profiles.mjs";
import { NPC_CLASSIFICATIONS } from "../../../systems/legacy2-npc-classification.mjs";

const PROFILE_PREVIEWS = {
  taxonomy: { field: "taxonomia", fallback: "icons/svg/pawprint.svg" },
  archetype: { field: "arquetipo", fallback: "icons/svg/sword.svg" }
};

const PAINTED_ICONS = "systems/jujutsu-system/assets/gerador-pdn-pintado-v1";

/** Painted creature illustration used in the generator header. */
export function npcGeneratorIcon() {
  return `<img src="${PAINTED_ICONS}/gerador.webp" alt="" draggable="false">`;
}

const EXISTENCE_ICONS = Object.freeze({
  lacaio: "lacaio.webp",
  normal: "normal.webp",
  elite: "elite.webp",
  chefe: "chefe.webp"
});

/** Each existence rank has its own painted creature portrait. */
export function npcGeneratorExistenceIcon(category) {
  const key = Object.hasOwn(EXISTENCE_ICONS, category) ? category : "normal";
  return `<img src="${PAINTED_ICONS}/${EXISTENCE_ICONS[key]}" alt="" draggable="false">`;
}

/** Native radio inputs provide a single classification value and keyboard navigation. */
export function npcGeneratorExistencePicker() {
  return `<fieldset class="jj-npcgen-existence"><legend>Classificação de Existência</legend>
    <div class="jj-npcgen-existence-choices">${Object.entries(NPC_CLASSIFICATIONS).map(([key, classification]) => `
      <label class="jj-npcgen-existence-choice">
        <input type="radio" name="categoria" value="${key}" aria-label="${classification.label}"${key === "normal" ? " checked" : ""}>
        <span class="jj-npcgen-existence-button">
          ${npcGeneratorExistenceIcon(key)}
          <span><strong>${classification.label}</strong>
            <small>×${String(classification.hpMultiplier).replace(".", ",")} PV</small>
            <small>${classification.actions} ações</small>
          </span>
        </span>
      </label>`).join("")}</div></fieldset>`;
}

/** Remove incompatible options from the native dropdown, retaining templates for taxonomy changes. */
function activateArchetypeFilter(root, profiles) {
  const taxonomy = root.querySelector('select[name="taxonomia"]');
  const archetype = root.querySelector('select[name="arquetipo"]');
  if (!taxonomy || !archetype) return;
  const groups = Array.from(archetype.children, group => group.cloneNode(true));
  const sync = () => {
    const previous = archetype.value;
    const choices = npcGeneratorArchetypesForTaxonomy(profiles, taxonomy.value);
    const allowed = new Set(choices.map(choice => choice.value));
    const visibleGroups = groups.flatMap(group => {
      const options = Array.from(group.children).filter(option => allowed.has(option.value));
      if (!options.length) return [];
      const visible = group.cloneNode(false);
      visible.append(...options.map(option => option.cloneNode(true)));
      return [visible];
    });
    archetype.replaceChildren(...visibleGroups);
    archetype.value = allowed.has(previous) ? previous : choices[0]?.value ?? "";
    if (archetype.value !== previous) archetype.dispatchEvent(new Event("change", { bubbles: true }));
  };
  taxonomy.addEventListener("change", sync);
  sync();
}

/** Use the selected UUID's image, keeping same-name profiles from different sources distinct. */
export function activateNpcGeneratorPreviews(root, profiles) {
  activateArchetypeFilter(root, profiles);
  // Mount with the other previews after DialogV2 has created its content.
  const generatorIcon = root.querySelector("[data-generator-icon]");
  if (generatorIcon) generatorIcon.innerHTML = npcGeneratorIcon();
  for (const [type, { field, fallback }] of Object.entries(PROFILE_PREVIEWS)) {
    const select = root.querySelector(`select[name="${field}"]`);
    const image = root.querySelector(`[data-profile-preview="${type}"]`);
    if (!select || !image) continue;
    const choices = new Map(profiles[type].map(choice => [choice.value, choice]));
    const sync = () => {
      const choice = choices.get(select.value);
      image.src = choice?.img || fallback;
      image.title = select.title = choice?.label ?? "";
    };
    image.addEventListener("error", () => {
      if (image.getAttribute("src") !== fallback) image.src = fallback;
    });
    select.addEventListener("change", sync);
    sync();
  }
}
