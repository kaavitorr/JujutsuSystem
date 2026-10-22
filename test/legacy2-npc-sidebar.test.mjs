import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { configureNpc2Parts } from "../module/applications/actor/jj/legacy2-npc-sheet.mjs";

globalThis.Hooks = { on() {} };
let version = "2.0", selected = "stored", dialog, warnings = [];
globalThis.game = { settings: { get: () => version } };
globalThis.ui = { notifications: { warn: message => warnings.push(message), info() {} } };
globalThis.foundry = { utils: { escapeHTML: text => String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;") },
  applications: { api: { DialogV2: { async wait(options) {
    dialog = options;
    if (selected === null) return null;
    const button = options.buttons[selected === "cancel" ? 1 : 0];
    return (await button.callback({}, {}, { element: { querySelector: () => ({ value: selected }) } })) ?? button.action;
  } } } } };
const { useSheetAction, removeSheetDamageCondition } = await import("../module/applications/actor/jj/sheet-actions-2.mjs");
const { prepareNpcFavorites, useNpcFavorite, deleteNpcFavorite, dropNpcFavorite, configureNpcFavorite } =
  await import("../module/applications/actor/jj/npc-favorites-2.mjs");

function fixture(type = "npc") {
  version = "2.0"; selected = "stored"; dialog = null; warnings = [];
  const uses = [], writes = [], rolls = [];
  const attack = { type: "attack", async use(...args) { uses.push(args); } };
  const actor = { type, name: "NPC", statuses: new Set(), effects: [], system: { favorites: [], legacy2: { actions: { value: 6 } } },
    itemTypes: { weapon: [] }, items: new Map(),
    async update(data) {
      writes.push(data);
      if ("system.legacy2.actions.value" in data) this.system.legacy2.actions.value = data["system.legacy2.actions.value"];
      if ("system.favorites" in data) this.system.favorites = data["system.favorites"];
    }, async rollSkill(data) { rolls.push(data); } };
  for (const [id, equipped] of [["equipped", true], ["stored", false]]) {
    const item = { id, name: id === "stored" ? 'Katana <especial>' : "Lança", type: "weapon", parent: actor,
      system: { equipped, activities: { contents: [attack] } }, async use(...args) { uses.push(args); } };
    actor.items.set(id, item); actor.itemTypes.weapon.push(item);
  }
  return { sheet: { actor, isEditable: true, isEditMode: true }, actor, uses, writes, rolls, attack };
}

test("NPC 2.0 sidebar has one integrated SVG collapse control and no obsolete native trait blocks", () => {
  const parts = configureNpc2Parts({ sidebar: {}, sidebarCollapser: { template: "native-collapser" } });
  assert.equal(parts.sidebarCollapser, undefined);
  const template = readFileSync(new URL("../templates/actors/npc-sidebar-2.hbs", import.meta.url), "utf8");
  assert.equal((template.match(/data-action="toggleSidebar"/g) ?? []).length, 1);
  assert.match(template, /class="sidebar jj2-sidebar jj2-npc-sidebar"/);
  assert.ok(!template.includes('templates/actors/npc-sidebar.hbs'));
  assert.ok(!template.includes('maxOverride'));
});

test("player and NPC Attack shortcuts offer every owned weapon, use the selected native activity once and do not debit PA twice", async () => {
  for (const type of ["npc", "character"]) {
    const { sheet, uses, writes } = fixture(type);
    await useSheetAction(sheet, {}, { dataset: { acao: "ataque" } });
    assert.ok(dialog.content.includes('value="equipped"'));
    assert.ok(dialog.content.includes('value="stored"'));
    assert.ok(dialog.content.includes("Katana &lt;especial>"));
    assert.equal(uses.length, 1);
    assert.equal(uses[0][1].configure, true);
    assert.equal(uses[0][1].options.sheet, sheet);
    assert.deepEqual(writes, []);
  }
});

test("cancel, invalid weapon and missing weapons never spend resources or invoke an activity", async () => {
  const { sheet, uses, writes } = fixture();
  for (const selection of [null, "cancel", "missing"]) {
    selected = selection;
    await useSheetAction(sheet, {}, { dataset: { acao: "ataque" } });
  }
  sheet.actor.itemTypes.weapon = [];
  await useSheetAction(sheet, {}, { dataset: { acao: "ataque" } });
  assert.deepEqual(uses, []); assert.deepEqual(writes, []);
});

test("NPC action shortcuts use native skills and enforce costs, reactions and condition restrictions before spending", async () => {
  const { sheet, actor, rolls, writes, uses } = fixture();
  await useSheetAction(sheet, {}, { dataset: { acao: "esconder" } });
  await useSheetAction(sheet, {}, { dataset: { acao: "procurar" } });
  assert.deepEqual(rolls.map(roll => roll.skill), ["ste", "prc"]);
  assert.equal(actor.system.legacy2.actions.value, 4);
  actor.statuses.add("jj-enfurecido");
  await useSheetAction(sheet, {}, { dataset: { acao: "interagir" } });
  assert.equal(writes.length, 2);
  actor.statuses.add("jj-desatento");
  await useSheetAction(sheet, {}, { dataset: { acao: "reativo" } });
  assert.deepEqual(uses, []);
  actor.statuses.clear(); actor.system.legacy2.actions.value = 0;
  await useSheetAction(sheet, {}, { dataset: { acao: "procurar" } });
  assert.equal(writes.length, 2);
  sheet.isEditable = false;
  await useSheetAction(sheet, {}, { dataset: { acao: "ataque" } });
  await removeSheetDamageCondition(sheet);
  assert.deepEqual(uses, []);
});

test("native NPC favorites persist, deduplicate, remove only the selected shortcut and reject missing relative documents", async () => {
  const source = readFileSync(new URL("../module/data/actor/npc.mjs", import.meta.url), "utf8");
  const start = source.indexOf("  hasFavorite(favoriteId) {"), end = source.indexOf("  /* -------------------------------------------- */", start);
  const Model = new Function(`return class {${source.slice(start, end)}}`)();
  const data = Object.assign(new Model(), { favorites: [] });
  globalThis.CONST = { SORT_INTEGER_DENSITY: 100000 };
  globalThis.fromUuidSync = id => id === ".Item.missing" ? null : {};
  const writes = [];
  data.parent = { async update(update) { writes.push(update); data.favorites = update["system.favorites"]; } };
  await data.addFavorite({ type: "item", id: ".Item.stored" });
  await data.addFavorite({ type: "item", id: ".Item.stored" });
  await data.addFavorite({ type: "skill", id: "ste" });
  assert.equal(writes.length, 2);
  assert.deepEqual(data.favorites.map(entry => entry.sort), [100000, 200000]);
  await data.removeFavorite(".Item.stored");
  assert.deepEqual(data.favorites.map(entry => entry.id), ["ste"]);
  assert.throws(() => data.addFavorite({ type: "item", id: ".Item.missing" }));
});

test("NPC favorite buttons invoke the owned item's native use once, roll skills and remove shortcuts in edit mode", async () => {
  const { sheet, actor, uses, rolls } = fixture();
  const item = actor.items.get("stored");
  actor.system.favorites = [{ type: "item", id: ".Item.stored", sort: 0 }, { type: "skill", id: "ste", sort: 1 }];
  globalThis.fromUuid = async id => id === ".Item.stored" ? item : null;
  const favorites = await prepareNpcFavorites(sheet);
  assert.deepEqual(favorites.map(entry => entry.title), ["Katana <especial>", "Furtividade"]);
  const target = id => ({ closest: () => ({ dataset: { favoriteId: id } }) });
  await useNpcFavorite(sheet, {}, target(".Item.stored"));
  await useNpcFavorite(sheet, {}, target("ste"));
  assert.equal(uses.length, 1); assert.equal(rolls[0].skill, "ste");
  const removed = []; actor.system.removeFavorite = async id => removed.push(id);
  await deleteNpcFavorite({ ...sheet, isEditMode: false }, target("ste"));
  await deleteNpcFavorite(sheet, target("ste"));
  assert.deepEqual(removed, ["ste"]);
});

test("dropping owned items creates shortcuts while foreign documents and read-only sheets cannot add them", async () => {
  const { sheet, actor } = fixture(), added = [];
  actor.system.addFavorite = async entry => added.push(entry);
  const item = actor.items.get("stored");
  globalThis.fromUuid = async id => id === "owned" ? item : { ...item, parent: {} };
  foundry.utils.buildRelativeUuid = doc => `.Item.${doc.id}`;
  await dropNpcFavorite(sheet, { type: "Item", uuid: "owned" });
  await dropNpcFavorite(sheet, { type: "Item", uuid: "foreign" });
  await dropNpcFavorite({ ...sheet, isEditable: false }, { type: "Item", uuid: "owned" });
  assert.deepEqual(added, [{ type: "item", id: ".Item.stored" }]);
});

test("shortcut configuration adds the selected owned item without duplicating it in inventory", async () => {
  const { sheet, actor } = fixture(), added = [];
  actor.items = Array.from(actor.items.values());
  actor.system.hasFavorite = () => false;
  actor.system.addFavorite = async entry => added.push(entry);
  foundry.utils.buildRelativeUuid = doc => `.Item.${doc.id}`;
  selected = "0";
  await configureNpcFavorite(sheet);
  assert.equal(actor.items.length, 2);
  assert.deepEqual(added, [{ type: "item", id: ".Item.equipped" }]);
  selected = "cancel";
  await configureNpcFavorite(sheet);
  assert.equal(added.length, 1);
});

test("the native Cancel button in condition selection never rolls Medicine or consumes action points", async () => {
  const { sheet, actor, rolls, writes } = fixture();
  actor.effects = ["jj-em-chamas", "jj-estremecido"].map(status => ({
    name: status, statuses: new Set([status]), getFlag: () => ({ cd: 12 })
  }));
  selected = "cancel";
  await removeSheetDamageCondition(sheet);
  assert.equal(dialog.window.title, "Remover Condição de Dano");
  assert.deepEqual(rolls, []);
  assert.deepEqual(writes, []);
});
