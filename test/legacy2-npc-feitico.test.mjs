import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import Ruleset from "../module/systems/ruleset.mjs";
import { NPC2_TABS, configureNpc2Parts } from "../module/applications/actor/jj/legacy2-npc-sheet.mjs";
import { INHERENT_FEITICO_SLOT } from "../module/systems/feitico-inerente.mjs";
let version = "2.0";
globalThis.game = { settings: { get: () => version }, user: { isGM: true },
  i18n: { localize: key => ({ "JUJUTSU.Feitico.Inherent.New": "Novo Feitiço Inerente" })[key] ?? key } };
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
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        const deletion = key.lastIndexOf(".-=");
        if (deletion >= 0) delete getProperty(this, key.slice(0, deletion))?.[key.slice(deletion + 3)];
        else if (key !== "_id") setProperty(this, key, value);
      }
      return this;
    },
    toObject() { return { _id: this.id, name: this.name, type: this.type, system: structuredClone(this.system), flags: structuredClone(this.flags) }; }
  };
}
function fixture(items = []) {
  version = "2.0";
  items.get = id => items.find(i => i.id === id);
  const actor = { type: "npc", isOwner: true, limited: false, items, system: { legacy2: { nd: "8" }, details: { level: 99 }, masteryLevel: 0, attributes: { prof: 2 } }, getFlag() {} };
  actor.updateEmbeddedDocuments = async (name, updates) => {
    assert.equal(name, "Item");
    return Promise.all(updates.map(update => items.get(update._id).update(update)));
  };
  actor.deleteEmbeddedDocuments = async (name, ids) => {
    assert.equal(name, "Item");
    return ids.map(id => items.splice(items.findIndex(item => item.id === id), 1)[0]);
  };
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

function playerFixture(items = []) {
  const { actor } = fixture(items);
  version = "1.0";
  actor.type = "character";
  return { actor, sheet: new (FeiticoSheetMixin(Boundary))(actor) };
}

test("the 1.0 character's final Feitiço section lists inherent spell Items without a manifestation prerequisite", async () => {
  const ordinary = spell("ordinary", { parent: "m1" });
  const inherent = spell("inherent", { parent: "inerente" }, 2);
  const auxiliary = spell("inherent-aux", { parent: "inerente" }, 0);
  const { sheet } = playerFixture([ordinary, inherent, auxiliary]);
  const { feitico } = await sheet._prepareFeiticoContext({});
  const last = feitico.slots.at(-1);
  assert.equal(last.id, "inerente");
  assert.equal(last.techniquesOnly, true);
  assert.equal(last.manifestacao, null);
  assert.equal(last.blocked, false);
  assert.deepEqual(last.tecnicasGrau.map(item => item.id), ["inherent"]);
  assert.deepEqual(last.tecnicasAux.map(item => item.id), ["inherent-aux"]);
  assert.equal(feitico.slots.find(slot => slot.id === "m1").tecnicas[0].id, "ordinary");
});

test("dragging an external technique into the inherent section copies its native activities/effects and removal returns it to Techniques", async () => {
  const { actor, sheet } = playerFixture();
  const raw = { _id: "source", name: "Poder Inerente", type: "spell", system: { level: 2, method: "innate",
    activities: { attack: { type: "attack", damage: { parts: [{ formula: "3d6" }] } } } },
  effects: [{ _id: "effect", name: "Condição", statuses: ["jj-queimadura"] }], flags: {} };
  const incoming = { type: "spell", toObject: () => structuredClone(raw) };
  globalThis.Item = { implementation: { create: async (data, options) => {
    assert.equal(options.parent, actor);
    const item = spell("owned-inherent");
    item.system = structuredClone(data.system);
    item.effects = structuredClone(data.effects);
    item.parent = actor;
    actor.items.push(item); return item;
  } } };
  const zone = { dataset: { feiticoDrop: "tecnica" }, closest: () => ({ dataset: { feiticoSlot: "inerente" } }) };
  await sheet._onDropItem({ target: { closest: () => zone } }, incoming);
  const owned = actor.items[0];
  const { feitico } = await sheet._prepareFeiticoContext({});
  assert.equal(feitico.slots.at(-1).tecnicas[0]?.id, "owned-inherent");
  assert.equal(owned.system.activities.attack.damage.parts[0].formula, "3d6");
  assert.equal(owned.effects[0].statuses[0], "jj-queimadura");
  assert.equal(owned.system.method, "innate");
  assert.deepEqual(raw.flags, {});
  let uses = 0; owned.use = async () => ++uses;
  await sheet._onClickAction({}, { dataset: { action: "feitico-roll", itemId: owned.id } });
  assert.equal(uses, 1);
  const context = { itemCategories: { spells: [owned] } };
  assert.equal(sheet._prepareSpellbook(context).length, 0);
  await sheet._onClickAction({}, { dataset: { action: "feitico-unassign-tecnica", itemId: owned.id } });
  assert.equal(sheet._prepareSpellbook(context)[0], owned);
  assert.equal(actor.items.length, 1);
});

test("the inherent create action opens a genuine at-will spell and respects sheet ownership", async () => {
  const { actor, sheet } = playerFixture();
  let data, opened = 0, creations = 0;
  globalThis.Item = { implementation: { create: async (input, options) => {
    creations++; data = input[0]; assert.equal(options.parent, actor);
    return [{ sheet: { render: () => ++opened } }];
  } } };
  const target = { dataset: { action: "feitico-create-tecnica", slot: "inerente" } };
  await sheet._onClickAction({}, target);
  assert.equal(data.type, "spell");
  assert.equal(data.name, "Novo Feitiço Inerente");
  assert.equal(data.system.method, "atwill");
  assert.equal(data.flags["jujutsu-system"].feitico.parent, "inerente");
  assert.equal(opened, 1);
  actor.isOwner = false;
  await sheet._onClickAction({}, target);
  assert.equal(creations, 1);
});

test("a 1.0 inherent technique remains accessible in the ordinary spellbook after switching to 2.0", async () => {
  const inherent = spell("inherent", { parent: "inerente" });
  const ordinary = spell("ordinary", { parent: "m1" });
  const { sheet } = playerFixture([inherent, ordinary]);
  version = "2.0";
  const { feitico } = await sheet._prepareFeiticoContext({});
  assert(!feitico.slots.some(slot => slot.id === "inerente"));
  assert.deepEqual(sheet._prepareSpellbook({ itemCategories: { spells: [inherent, ordinary] } }).map(item => item.id), ["inherent"]);
});

test("installing a spell mold restores inherent techniques into their section with their activities and effects", async () => {
  const { actor, sheet } = playerFixture();
  const raw = { _id: "old", name: "Inerente", type: "spell", system: { level: 2, method: "atwill",
    activities: { heal: { type: "heal", healing: { number: 2, denomination: 6 } } } }, effects: [{ name: "Efeito" }],
  flags: { "jujutsu-system": { feiticoTemplate: "template", feitico: { parent: "inerente" } } } };
  let received;
  globalThis.Item = { implementation: { create: async (data, options) => {
    assert.equal(options.parent, actor);
    received = data[0];
    const owned = spell("installed", structuredClone(received.flags["jujutsu-system"].feitico));
    owned.system = structuredClone(received.system); actor.items.push(owned);
    return [owned];
  } } };
  await sheet._onFeiticoInstallTemplate({ system: { contents: [{ toObject: () => structuredClone(raw) }] } });
  const { feitico } = await sheet._prepareFeiticoContext({});
  assert.equal(feitico.slots.at(-1).tecnicas[0].id, "installed");
  assert.equal(received.system.activities.heal.healing.denomination, 6);
  assert.equal(received.effects[0].name, "Efeito");
  assert.equal(received.flags["jujutsu-system"].feiticoTemplate, undefined);
  assert.equal(raw.flags["jujutsu-system"].feiticoTemplate, "template");
});

test("the mold editor exposes inherent techniques in 1.0 and keeps existing inherent contents visible in 2.0", async () => {
  const source = readFileSync(new URL("../module/applications/item/feitico-template-sheet.mjs", import.meta.url), "utf8")
    .replace(/^import\s[\s\S]*?;\r?\n/gm, "")
    .replace("export default class FeiticoTemplateSheet", "class FeiticoTemplateSheet");
  class ItemBoundary extends Boundary {
    static PARTS = { header: {}, tabs: {}, description: {} };
  }
  const MoldSheet = new Function("ItemSheet5e", "Ruleset", "INHERENT_FEITICO_SLOT", `${source}\nreturn FeiticoTemplateSheet;`)
    (ItemBoundary, Ruleset, INHERENT_FEITICO_SLOT);
  const sheet = new MoldSheet();
  for (const rules of ["1.0", "2.0"]) {
    version = rules;
    sheet.item = { system: { contents: [spell("inherent", { parent: "inerente" })] } };
    const { feitico } = await sheet._prepareFeiticoContext({ tabs: { feitico: {} } });
    assert.equal(feitico.slots.at(-1).id, "inerente");
    assert.equal(feitico.slots.at(-1).techniquesOnly, true);
    assert.equal(feitico.slots.at(-1).tecnicas[0].id, "inherent");
  }
});
