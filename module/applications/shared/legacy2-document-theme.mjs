/** Presentation only: native form fields, documents and controls keep their identity. */
const KINDS = { item: "jj2-item-sheet", activity: "jj2-activity-sheet", "activity-create": "jj2-activity-create", "activity-choice": "jj2-activity-choice", "weapon-choice": "jj2-weapon-choice", "energy-generation": "jj2-energy-generation", activation: "jj2-activation", attack: "jj2-attack-dialog", roll: "jj2-roll-dialog", defense: "jj2-defensive-burst", health: "jj2-health-config" };
const paths = {
  edit: 'm4 16 12-12 4 4L8 20l-5 1zM13 7l4 4',
  delete: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  close: 'm6 6 12 12M6 18 18 6', menu: 'M12 4v2m0 5v2m0 5v2', check: 'm5 12 4 4 10-10',
  add: 'M12 4v16M4 12h16', arrow: 'm9 5 7 7-7 7', down: 'm5 9 7 7 7-7',
  subtract: 'M4 12h16',
  copy: 'M8 8h13v13H8zM16 8V3H3v13h5',
  book: 'M12 5C8 2 4 3 2 4v15c3-2 7-2 10 0 3-2 7-2 10 0V4c-2-1-6-2-10 1v14',
  settings: 'M9.81 4.83L10.26 2.15L13.74 2.15L14.19 4.83L15.52 5.38L17.74 3.81L20.19 6.26L18.62 8.48L19.17 9.81L21.85 10.26L21.85 13.74L19.17 14.19L18.62 15.52L20.19 17.74L17.74 20.19L15.52 18.62L14.19 19.17L13.74 21.85L10.26 21.85L9.81 19.17L8.48 18.62L6.26 20.19L3.81 17.74L5.38 15.52L4.83 14.19L2.15 13.74L2.15 10.26L4.83 9.81L5.38 8.48L3.81 6.26L6.26 3.81L8.48 5.38ZM15 12a3 3 0 1 0-6 0 3 3 0 0 0 6 0',
  attack: 'm4 20 3-3m-3-3 6 6M7 17 13 4h-5L7 12zM15 14l6 6m-5 0 4-4',
  heal: 'M8 3h8v5h5v8h-5v5H8v-5H3V8h5z',
  damage: 'm13 2-9 12h7l-1 8 10-12h-7z',
  forward: 'M3 7h13m-5-5 5 5-5 5M21 17H8m5-5-5 5 5 5',
  enchant: 'M4 20 17 7l3 3L7 23M14 4V1m5 3h3M5 7V3m-2 2h4M17 17v-4m-2 2h4',
  summon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 1 2 5 5 1-4 4 1 5-4-2-4 2 1-5-4-4 5-1z',
  reduction: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12h8',
  save: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6',
  teleport: 'M3 6h18M6 3l-3 3 3 3m12 6 3 3-3 3M3 18h18M12 7v10m-3-7 3-3 3 3m-6 4 3 3 3-3',
  checkActivity: 'M4 4h16v16H4zM8 8h1m6 0h1M12 12h.01M8 16h1m6 0h1',
  transform: 'M3 5h14l-3-3m3 3-3 3M21 19H7l3 3m-3-3 3-3M5 10v6m14-8v6',
  utility: 'M21 3a6 6 0 0 0-8 8L3 21l-2-2 10-10a6 6 0 0 1 8-8l-4 4 4 4z',
  cast: 'm13 2-9 12h7l-1 8 10-12h-7z', order: 'M3 5h18v12H9l-5 4v-4H3zM7 9h10m-10 4h6',
  "switch-on": 'M8 6h8a6 6 0 0 1 0 12H8A6 6 0 0 1 8 6ZM16 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  "switch-off": 'M8 6h8a6 6 0 0 1 0 12H8A6 6 0 0 1 8 6ZM8 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  tag: 'M3 3h8l10 10-8 8L3 11zM7 7h.01', clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7v5l3 2',
  target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
  effects: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',
  inventory: 'M5 8h14l2 12H3zM8 8V6a4 4 0 0 1 8 0v2M8 12v2m8-2v2'
};
const restored = new WeakMap();
const NATIVE_EDITOR = "prose-mirror, .prosemirror, .ProseMirror, .editor-menu";
function icon(document, key, cls = "") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [name, value] of Object.entries({ class: `jj2-document-icon ${cls}`.trim(), viewBox: "0 0 24 24", width: "16", height: "16", fill: "none", stroke: "currentColor", "stroke-width": "1.7", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" })) svg.setAttribute(name, value);
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", paths[key] ?? paths.settings); svg.append(path); return svg;
}
function replace(element, original, key) {
  if (original.parentElement?.closest(NATIVE_EDITOR)) return;
  const svg = icon(element.ownerDocument, key), entries = restored.get(element) ?? [];
  entries.push({ original, svg }); restored.set(element, entries); original.replaceWith(svg);
}
const actions = { close: "close", toggleControls: "menu", copyUuid: "copy", editDocument: "edit", editDescription: "edit", edit: "edit", deleteDocument: "delete", delete: "delete", addDocument: "add", addRecovery: "add", addConsumption: "add", addDamagePart: "add", addEffect: "add", addBehavior: "add", deleteRecovery: "delete", deleteConsumption: "delete", deleteDamagePart: "delete", deleteEffect: "delete", deleteBehavior: "delete", showConfiguration: "settings", showSource: "book" };
const glyphs = [[/toggle-on/, "switch-on"], [/toggle-off/, "switch-off"], [/cog|gear/, "settings"], [/trash/, "delete"],
  [/pen|edit|feather/, "edit"], [/xmark/, "close"], [/bolt/, "damage"], [/check/, "check"], [/plus/, "add"],
  [/ellipsis/, "menu"], [/book/, "book"], [/tag/, "tag"], [/clock|clapper/, "clock"], [/bullseye/, "target"],
  [/expand|compress|chevron/, "down"], [/sun|spark|magic/, "effects"], [/boxes|box/, "inventory"]];

/** Native energy cost controls may be inserted after the sheet render. */
export function paintLegacy2DocumentIcons(element) {
  if (restored.has(element)) restored.set(element, restored.get(element).filter(entry => {
    if (!element.contains(entry.svg)) return false;
    if (entry.svg.closest(NATIVE_EDITOR)) { entry.svg.replaceWith(entry.original); return false; }
    return true;
  }));
  for (const original of element.querySelectorAll("button > i, a[data-action] > i, nav.tabs .item > i, .source-book > i")) {
    if (original.closest(NATIVE_EDITOR)) continue;
    const key = actions[original.parentElement.dataset.action] ?? glyphs.find(([pattern]) => pattern.test(original.className))?.[1] ?? "settings";
    replace(element, original, key);
  }
  for (const button of element.querySelectorAll(".window-header .header-control[data-action]")) {
    if (!button.querySelector("svg")) button.append(icon(element.ownerDocument, actions[button.dataset.action], "jj2-native-control-icon"));
  }
  // DialogV2 cleans string content and removes SVGs; restore empty counter signs after rendering.
  for (const button of element.querySelectorAll('button[data-action="jj2StepCounter"][data-step]')) {
    const step = Number(button.dataset.step);
    if (!Number.isFinite(step) || !step || button.textContent.trim() || button.querySelector("svg")
      || button.closest(NATIVE_EDITOR)) continue;
    button.append(icon(element.ownerDocument, step < 0 ? "subtract" : "add", "jj2-counter-icon"));
  }
  for (const header of element.querySelectorAll(".item-descriptions .description.collapsible > .header")) {
    if (!header.querySelector(".jj2-description-chevron")) header.prepend(icon(element.ownerDocument, "down", "jj2-description-chevron"));
  }
  for (const button of element.querySelectorAll(".jj-pa-clear")) {
    if (!button.querySelector("svg")) for (const node of [...button.childNodes].filter(node => node.nodeType === 3)) replace(element, node, "close");
  }
  for (const option of element.querySelectorAll(".jj-pa-pool option")) {
    const label = option.value === "generated" ? "Gerada" : option.value === "total" ? "Total" : null;
    if (label && option.textContent !== label) option.textContent = label;
  }
}

export function mountLegacy2DocumentTheme(element, kind, { enabled = true, itemType } = {}) {
  if (!element || !KINDS[kind]) return;
  element.classList.toggle("jj2-document", enabled);
  for (const [key, cls] of Object.entries(KINDS)) element.classList.toggle(cls, enabled && key === kind);
  if (!enabled) {
    for (const { svg, original } of restored.get(element) ?? []) svg.replaceWith(original);
    restored.delete(element);
    element.querySelectorAll(".jj2-document-masthead, .jj2-description-chevron, .jj2-native-control-icon, .jj2-choice-chevron").forEach(node => node.remove());
    return;
  }
  if (itemType) element.dataset.jj2ItemType = itemType;
  paintLegacy2DocumentIcons(element);
  if (kind === "activity-create" || kind === "activity-choice") {
    const content = element.querySelector(".window-content");
    if (content && !content.querySelector(".jj2-document-masthead")) {
      const header = element.ownerDocument.createElement("header"), title = element.ownerDocument.createElement("h2");
      header.className = "jj2-document-masthead"; title.textContent = kind === "activity-create" ? "Nova atividade" : "Escolher atividade";
      header.append(icon(element.ownerDocument, "damage"), title); content.prepend(header);
    }
  }
  if (kind === "activity-create") for (const input of element.querySelectorAll('input[type="radio"][name="type"]')) {
    const original = input.closest("label")?.querySelector("dnd5e-icon, img");
    const key = input.value === "check" ? "checkActivity" : input.value;
    if (original && key in paths) replace(element, original, key);
  }
  if (kind === "activity-choice") for (const button of element.querySelectorAll('[data-action="choose"][data-activity-id]')) {
    if (!button.querySelector(".jj2-choice-chevron")) button.append(icon(element.ownerDocument, "arrow", "jj2-choice-chevron"));
  }
}
