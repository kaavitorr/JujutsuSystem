import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import Ruleset from "../module/systems/ruleset.mjs";
import { NPC2_TABS, configureNpc2Parts } from "../module/applications/actor/jj/legacy2-npc-sheet.mjs";
let version = "2.0";
globalThis.game = { settings: { get: () => version }, user: { isGM: true } };
globalThis.CONFIG = { DND5E: { spellSchools: {} } };
const getProperty = (object, key) => key.split(".").reduce((v, k) => v?.[k], object);
const setProperty = (object, key, value) => { const keys = key.split("."), last = keys.pop(); let target = object; for (const part of keys) target = target[part] ??= {}; target[last] = value; };
globalThis.foundry = { applications: { ux: { TextEditor: { implementation: {} } }, api: { DialogV2: { confirm: async () => true } } }, utils: { deepClone: structuredClone, getProperty, setProperty } };
globalThis.ui = { notifications: { warn() {}, info() {}, error() {} } };
globalThis.window = {};
const { default: FeiticoSheetMixin } = await import("../module/applications/actor/jj/feitico-sheet.mjs").catch(e => {
  if (e.code === "ERR_MODULE_NOT_FOUND") return { default: Base => Base }; throw e;
});
class Boundary {
  constructor(actor) { this.actor = actor; }
  get isEditable() { return this.actor.isOwner; }
  get isEditMode() { return true; }
  _configureRenderParts() { return structuredClone(this.constructor.PARTS); }
  _getTabs() { return { native: {} }; }
  async _preparePartContext(id, context) { return context; }
  _onClickAction() { return "native-action"; }
  _onDropItem() { return "native-drop"; }
  _prepareSpellbook(context) { return [...context.itemCategories.spells]; }
}
const source = readFileSync(new URL("../module/applications/actor/npc-sheet.mjs", import.meta.url), "utf8")
  .replace(/^import\s[\s\S]*?;\r?\n/gm, "").replace("export default class NPCActorSheet", "class NPCActorSheet");
const NPCSheet = new Function("BaseActorSheet", "FeiticoSheetMixin", "Ruleset", "NPC2_TABS", "configureNpc2Parts", `${source}\nreturn NPCActorSheet;`)
  (Boundary, FeiticoSheetMixin, Ruleset, NPC2_TABS, configureNpc2Parts);
function spell(id, flags = {}, level = 1) {
  return { id, type: "spell", name: id, system: { level }, flags: { "jujutsu-system": { feitico: flags } },
    getFlag(scope, key) { return getProperty(this.flags[scope], key); },
    async setFlag(scope, key, value) { setProperty(this.flags[scope], key, value); },
    async unsetFlag(scope, key) { delete this.flags[scope][key]; },
    async update(data) { for (const [key, value] of Object.entries(data)) setProperty(this, key, value); },
    toObject() { return { _id: this.id, name: this.name, type: this.type, system: structuredClone(this.system), flags: structuredClone(this.flags) }; }
  };
}
function fixture(items = []) {
  version = "2.0";
  items.get = id => items.find(i => i.id === id);
  const actor = { type: "npc", isOwner: true, limited: false, items, system: { legacy2: { nd: "8" }, details: { level: 99 }, masteryLevel: 0, attributes: { prof: 2 } }, getFlag() {} };
  for (const item of items) item.parent = actor;
  return { actor, sheet: new NPCSheet(actor) };
}
test("NPC navigation uses the requested order, keeps the other tabs and exposes a working 2.0 Feitiço part", () => {
  const { sheet } = fixture(); sheet.tabGroups.primary = "feitico";
  assert.deepEqual(Object.values(sheet._getTabs()).slice(0, 5).map(t => t.label), ["Resumo", "Inventário", "Características", "Feitiço", "Perícias"]);
  assert.deepEqual(Object.keys(sheet._getTabs()).slice(5), ["spells", "effects", "biography", "specialTraits"]);
  assert.equal(sheet._getTabs().feitico.active, true);
  assert.equal(sheet._configureRenderParts({}).feitico.template, "systems/jujutsu-system/templates/actors/tabs/character-feitico-2.hbs");
  version = "1.0"; assert.equal(sheet._configureRenderParts({}).feitico, undefined);
  assert.deepEqual(sheet._getTabs(), { native: {} });
});
test("NPC Feitiço uses ND for evolution/requirements and shows its existing manifestation and techniques", async () => {
  const { sheet } = fixture([spell("manifestation", { slot: "m1", requirements: [{ level: 9 }] }), spell("attack", { parent: "m1" }, 2), spell("auxiliary", { parent: "m1" }, 0)]);
  const { feitico } = await sheet._preparePartContext("feitico", {}, {});
  assert.equal(feitico.nivel, 8); assert.equal(feitico.proficiencia.id, "maximo");
  const slot = feitico.slots.find(s => s.id === "m1");
  assert.equal(slot.blocked, true); assert.equal(slot.manifestacao.id, "manifestation");
  assert.deepEqual(slot.tecnicasGrau.map(t => t.id), ["attack"]);
  assert.deepEqual(slot.tecnicasAux.map(t => t.id), ["auxiliary"]);
});
test("NPC Feitiço action uses its native Item once, respects requirements and blocks read-only actions", async () => {
  const technique = spell("attack", { parent: "m1" }), manifestation = spell("manifestation", { slot: "m1", requirements: [{ level: 9 }] });
  const { actor, sheet } = fixture([manifestation, technique]); let uses = 0;
  technique.use = async () => ++uses;
  const target = { dataset: { action: "feitico-roll", itemId: "attack" } };
  await sheet._onClickAction({}, target); assert.equal(uses, 0);
  actor.system.legacy2.nd = "9";
  await sheet._onClickAction({}, target); assert.equal(uses, 1);
  actor.isOwner = false;
  await sheet._onClickAction({}, target); assert.equal(uses, 1);
});
test("NPC Feitiço drop assigns an owned spell without duplicating it; linked spells stay out of the separate spellbook", async () => {
  const technique = spell("attack"), { actor, sheet } = fixture([technique]);
  const zone = { dataset: { feiticoDrop: "tecnica" }, closest: () => ({ dataset: { feiticoSlot: "m1" } }) };
  const event = { target: { closest: selector => selector === "[data-feitico-drop]" ? zone : null } };
  await sheet._onDropItem(event, technique);
  assert.equal(technique.getFlag("jujutsu-system", "feitico.parent"), "m1"); assert.equal(actor.items.length, 1);
  const context = { itemCategories: { spells: [technique, spell("standalone")] } };
  assert.deepEqual(sheet._prepareSpellbook(context).map(i => i.id), ["standalone"]);
  assert.equal(context.itemCategories.spells.length, 2);
  actor.isOwner = false; technique.flags["jujutsu-system"].feitico = {};
  await sheet._onDropItem(event, technique); assert.deepEqual(technique.flags["jujutsu-system"].feitico, {});
});
test("NPC buttons create native manifestation/technique Items and import an existing mold through the shared controller", async () => {
  const { actor, sheet } = fixture(); let opened = 0;
  globalThis.Item = { implementation: { create: async (data, { parent }) => {
    assert.equal(parent, actor);
    return (Array.isArray(data) ? data : [data]).map(raw => {
      const item = spell(`created${actor.items.length}`, structuredClone(raw.flags?.["jujutsu-system"]?.feitico ?? {}), raw.system?.level ?? 0);
      item.sheet = { render: () => ++opened }; item.parent = parent;
      actor.items.push(item); return item;
    });
  } } };
  const click = (action, slot = "m1") => sheet._onClickAction({}, { dataset: { action, slot } });
  await click("feitico-create-manif"); await click("feitico-create-manif");
  assert.equal(actor.items.length, 1); assert.equal(opened, 2);
  await click("feitico-create-tecnica"); assert.equal(actor.items.length, 2);
  assert.equal(actor.items[1].getFlag("jujutsu-system", "feitico.parent"), "m1");
  const incoming = { type: "spell", name: "Importada", flags: { "jujutsu-system": { feitico: { slot: "m1" }, feiticoTemplate: "old-template" } } };
  foundry.applications.api.DialogV2.wait = async () => ({ texto: JSON.stringify([incoming]) });
  await click("feitico-import-json");
  assert.equal(actor.items.length, 3);
  assert.equal(actor.items[0].getFlag("jujutsu-system", "feitico.slot"), undefined, "replaced manifestation stays owned and unassigned");
  assert.equal(actor.items[2].getFlag("jujutsu-system", "feitico.slot"), "m1");
  assert.equal(incoming.flags["jujutsu-system"].feiticoTemplate, "old-template", "the imported source is never mutated");
});
