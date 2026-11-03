import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import FeiticoSheetMixin from "../module/applications/actor/jj/feitico-sheet.mjs";
import Ruleset from "../module/systems/ruleset.mjs";
import { INHERENT_FEITICO_SLOT } from "../module/systems/feitico-inerente.mjs";
import { setFeiticoAssociation } from "../module/systems/feitico-associations.mjs";

const scope = "jujutsu-system";
let version = "1.0";
const getProperty = (object, key) => key.split(".").reduce((value, part) => value?.[part], object);
function setProperty(object, key, value) {
  const keys = key.split("."), last = keys.pop();
  let target = object;
  for (const part of keys) target = target[part] ??= {};
  target[last] = value;
}
function applyUpdate(item, update) {
  for (const [key, value] of Object.entries(update)) {
    if (key === "_id") continue;
    const deletion = key.lastIndexOf(".-=");
    if (deletion >= 0) delete getProperty(item, key.slice(0, deletion))?.[key.slice(deletion + 3)];
    else setProperty(item, key, structuredClone(value));
  }
  return item;
}
globalThis.game = { settings: { get: () => version }, user: { isGM: true } };
globalThis.CONFIG = { DND5E: { spellSchools: {} } };
globalThis.foundry = { utils: { deepClone: structuredClone, getProperty, setProperty },
  applications: { api: { DialogV2: { confirm: async () => true } } } };
globalThis.ui = { notifications: { info() {}, warn() {}, error() {} } };
globalThis.window = {};

class Boundary {
  static PARTS = { header: {}, tabs: {}, description: {} };
  constructor(actor) { this.actor = actor; }
  get isEditable() { return this.actor?.isOwner; }
  _onDropItem() { return "native-drop"; }
  _prepareSpellbook(context) { return context.itemCategories.spells; }
  render() {}
}
function spell(id, association = {}) {
  return { id, name: id, type: "spell", flags: { [scope]: { feitico: structuredClone(association) } },
    system: { level: 1, method: "atwill", activities: { attack: { type: "attack" } } },
    effects: [{ name: "Effect", statuses: ["jj-queimadura"] }],
    getFlag(namespace, key) { return getProperty(this.flags[namespace], key); },
    async setFlag(namespace, key, value) {
      // Foundry merges objects; old association keys survive unless explicitly deleted.
      const current = getProperty(this.flags[namespace], key);
      setProperty(this.flags[namespace], key, value && current && typeof value === "object"
        ? { ...current, ...structuredClone(value) } : structuredClone(value));
      return this;
    },
    async unsetFlag(namespace, key) { delete this.flags[namespace][key]; return this; },
    async update(update) { return applyUpdate(this, update); },
    toObject() { return structuredClone({ _id: this.id, name: this.name, type: this.type,
      flags: this.flags, system: this.system, effects: this.effects }); }
  };
}
function fixture(items = [], { type = "character", rules = "1.0" } = {}) {
  version = rules;
  items.get = id => items.find(item => item.id === id);
  const actor = { type, isOwner: true, limited: false, items,
    system: { masteryLevel: 1, legacy2: { nd: "1" }, attributes: { prof: 2 } },
    getFlag() {},
    async updateEmbeddedDocuments(name, updates) {
      assert.equal(name, "Item");
      return updates.map(update => applyUpdate(items.get(update._id), update));
    },
    async deleteEmbeddedDocuments(name, ids) {
      assert.equal(name, "Item");
      return ids.map(id => items.splice(items.findIndex(item => item.id === id), 1)[0]);
    }
  };
  for (const item of items) item.parent = actor;
  let sequence = 0;
  globalThis.Item = { implementation: { create: async (data, { parent }) => {
    assert.equal(parent, actor);
    const created = (Array.isArray(data) ? data : [data]).map(raw => {
      const item = spell(`created-${sequence++}`);
      Object.assign(item, structuredClone(raw), { parent });
      items.push(item); return item;
    });
    return Array.isArray(data) ? created : created[0];
  } } };
  return { actor, sheet: new (FeiticoSheetMixin(Boundary))(actor) };
}
const zone = (slot, type = "manif") => ({ dataset: { feiticoDrop: type },
  closest: () => ({ dataset: { feiticoSlot: slot } }) });
const event = target => ({ target: { closest: () => target } });
async function expectedFailure(callback) {
  const original = console.error;
  console.error = () => {};
  try { return await callback(); } catch { /* The assertion below checks persisted state. */ }
  finally { console.error = original; }
}

for (const config of [{ type: "character", rules: "1.0" }, { type: "character", rules: "2.0" }, { type: "npc", rules: "2.0" }]) {
  test(`${config.type} ${config.rules}: dragging a manifestation preserves its requirements and removes stale association keys`, async () => {
    const manifestation = spell("manifestation", { slot: "m1", requirements: [{ level: 7 }] });
    const { sheet } = fixture([manifestation], config);
    await sheet._onDropItem(event(zone("m1")), manifestation);
    assert.deepEqual(manifestation.getFlag(scope, "feitico.requirements"), [{ level: 7 }]);
    assert(sheet._isFeiticoItemBlocked(manifestation));
    await sheet._onDropItem(event(zone("m2", "tecnica")), manifestation);
    assert.equal(manifestation.getFlag(scope, "feitico.slot"), undefined);
    assert.equal(manifestation.getFlag(scope, "feitico.parent"), "m2");
    await sheet._onDropItem(event(zone("m3")), manifestation);
    assert.equal(manifestation.getFlag(scope, "feitico.parent"), undefined);
    assert.equal(manifestation.getFlag(scope, "feitico.slot"), "m3");
    assert.deepEqual(manifestation.getFlag(scope, "feitico.requirements"), [{ level: 7 }]);
  });
}

test("failed mold creation leaves the old manifestation and techniques assigned", async () => {
  const old = spell("old", { slot: "m1", requirements: [{ level: 3 }] });
  const child = spell("old child", { parent: "m1" });
  const { actor, sheet } = fixture([old, child]);
  Item.implementation.create = async () => { throw Error("Create failed"); };
  await expectedFailure(() => sheet._installFeiticoItems([spell("incoming", { slot: "m1" }).toObject()]));
  assert.equal(old.getFlag(scope, "feitico.slot"), "m1");
  assert.equal(child.getFlag(scope, "feitico.parent"), "m1");
  assert.equal(actor.items.length, 2);
});

test("unassigning and reassigning a spell preserves its requirements", async () => {
  const item = spell("manifestation", { slot: "m1", requirements: [{ level: 7 }] });
  const { actor, sheet } = fixture([item]);
  await sheet._onFeiticoUnassign("m1");
  assert.deepEqual(item.getFlag(scope, "feitico"), { requirements: [{ level: 7 }] });
  await sheet._onDropItem(event(zone("m2", "tecnica")), item);
  await sheet._onFeiticoUnassignTecnica(item.id);
  assert.deepEqual(item.getFlag(scope, "feitico"), { requirements: [{ level: 7 }] });
  assert.equal(actor.items.length, 1);
});

test("Foundry may omit unchanged Items from the update result without rejecting a same-slot drop", async () => {
  const item = spell("old", { slot: "m1", requirements: [{ level: 7 }] });
  const { actor, sheet } = fixture([item]);
  actor.updateEmbeddedDocuments = async () => [];
  const result = await expectedFailure(() => sheet._onDropItem(event(zone("m1")), item));
  assert.equal(result, item);
  assert.deepEqual(item.getFlag(scope, "feitico.requirements"), [{ level: 7 }]);
});

test("vetoed reassignment restores the old group instead of accepting a partial update", async () => {
  const old = spell("old", { slot: "m1" }), child = spell("child", { parent: "m1" });
  const { actor, sheet } = fixture([old, child]);
  const update = actor.updateEmbeddedDocuments.bind(actor);
  let first = true;
  actor.updateEmbeddedDocuments = (name, updates) => {
    if (first) { first = false; return update(name, updates.slice(0, 1)); }
    return update(name, updates);
  };
  await expectedFailure(() => sheet._installFeiticoItems([spell("incoming", { slot: "m1" }).toObject()]));
  assert.equal(old.getFlag(scope, "feitico.slot"), "m1");
  assert.equal(child.getFlag(scope, "feitico.parent"), "m1");
  assert.equal(actor.items.length, 2);
});

test("replacing a mold detaches only the replaced groups and preserves all old Item data", async () => {
  const old = spell("old", { slot: "m1", requirements: [{ level: 3 }] });
  const child = spell("old child", { parent: "m1" });
  const other = spell("other", { slot: "m2" }), otherChild = spell("other child", { parent: "m2" });
  const inherent = spell("inherent", { parent: "inerente" });
  const { actor, sheet } = fixture([old, child, other, otherChild, inherent]);
  const oldData = child.toObject();
  const raw = [spell("incoming", { slot: "m1", requirements: [{ level: 2 }] }).toObject(),
    spell("incoming child", { parent: "m1" }).toObject()];
  await sheet._installFeiticoItems(raw);
  const { feitico } = await sheet._prepareFeiticoContext({});
  const slot = feitico.slots.find(slot => slot.id === "m1");
  assert.equal(slot.manifestacao.name, "incoming");
  assert.deepEqual(slot.tecnicas.map(item => item.name), ["incoming child"]);
  assert.deepEqual(sheet._prepareSpellbook({ itemCategories: { spells: actor.items } }).map(item => item.id), [old.id, child.id]);
  assert.equal(other.getFlag(scope, "feitico.slot"), "m2");
  assert.equal(otherChild.getFlag(scope, "feitico.parent"), "m2");
  assert.equal(inherent.getFlag(scope, "feitico.parent"), "inerente");
  assert.deepEqual(old.getFlag(scope, "feitico.requirements"), [{ level: 3 }]);
  assert.deepEqual(child.system, oldData.system);
  assert.deepEqual(child.effects, oldData.effects);
  assert.equal(raw[0]._id, "incoming");
});

test("a child-only import appends techniques without replacing its existing manifestation or siblings", async () => {
  const old = spell("old", { slot: "m1" }), child = spell("child", { parent: "m1" });
  const { sheet } = fixture([old, child]);
  await sheet._installFeiticoItems([spell("new child", { parent: "m1" }).toObject()]);
  const { feitico } = await sheet._prepareFeiticoContext({});
  assert.deepEqual(feitico.slots.find(slot => slot.id === "m1").tecnicas.map(item => item.name), ["child", "new child"]);
});

test("a partial or vetoed creation never frees old slots and removes any partial copies", async () => {
  for (const partial of [false, true]) {
    const old = spell("old", { slot: "m1" }), { actor, sheet } = fixture([old]);
    const create = Item.implementation.create;
    Item.implementation.create = async (data, options) => partial ? create(data.slice(0, 1), options) : [];
    await expectedFailure(() => sheet._installFeiticoItems([spell("incoming", { slot: "m1" }).toObject(),
      spell("child", { parent: "m1" }).toObject()]));
    assert.equal(old.getFlag(scope, "feitico.slot"), "m1");
    assert.deepEqual(actor.items.map(item => item.id), ["old"]);
  }
});

test("failed reassignment restores old bindings and removes new mold copies", async () => {
  const old = spell("old", { slot: "m1" }), child = spell("child", { parent: "m1" });
  const { actor, sheet } = fixture([old, child]);
  const update = actor.updateEmbeddedDocuments.bind(actor);
  let first = true;
  actor.updateEmbeddedDocuments = async (name, updates) => {
    if (first) { first = false; await update(name, updates.slice(0, 1)); throw Error("Partial update failed"); }
    return update(name, updates);
  };
  await expectedFailure(() => sheet._installFeiticoItems([spell("incoming", { slot: "m1" }).toObject()]));
  assert.equal(old.getFlag(scope, "feitico.slot"), "m1");
  assert.equal(child.getFlag(scope, "feitico.parent"), "m1");
  assert.deepEqual(actor.items.map(item => item.id), ["old", "child"]);
});

function moldFixture() {
  const source = readFileSync(new URL("../module/applications/item/feitico-template-sheet.mjs", import.meta.url), "utf8")
    .replace(/^import\s[\s\S]*?;\r?\n/gm, "")
    .replace("export default class FeiticoTemplateSheet", "class FeiticoTemplateSheet");
  const MoldSheet = new Function("ItemSheet5e", "Ruleset", "INHERENT_FEITICO_SLOT", "ensureFeiticoPack", "setFeiticoAssociation",
    `${source}\nreturn FeiticoTemplateSheet;`)(Boundary, Ruleset, INHERENT_FEITICO_SLOT,
    async () => ({ metadata: { id: "world.feitico-tecnicas" } }), setFeiticoAssociation);
  const old = spell("old", { slot: "m1" }), contents = [old];
  old.delete = async () => { contents.splice(contents.indexOf(old), 1); return old; };
  const sheet = new MoldSheet();
  sheet.item = { id: "mold", system: { contents, ensureFolder: async () => ({ id: "folder" }) } };
  return { old, contents, sheet };
}

test("the mold editor preserves the previous manifestation when creation throws or is vetoed", async () => {
  for (const throws of [true, false]) {
    const { old, contents, sheet } = moldFixture();
    Item.implementation.fromDropData = async () => spell("incoming", { slot: "m2" });
    Item.implementation.create = async () => { if (throws) throw Error("Create failed"); return []; };
    await expectedFailure(() => sheet._onDropItem(event(zone("m1")), {}));
    assert.deepEqual(contents, [old]);
    assert.equal(old.getFlag(scope, "feitico.slot"), "m1");
  }
});

test("the mold editor creates the replacement before deletion and retains the incoming requirements, activities and effects", async () => {
  const { old, contents, sheet } = moldFixture();
  const incoming = spell("incoming", { parent: "m2", requirements: [{ level: 5 }] });
  const original = incoming.toObject();
  let created;
  Item.implementation.fromDropData = async () => incoming;
  Item.implementation.create = async data => {
    assert(contents.includes(old), "old item survives until creation succeeds");
    created = spell("created"); Object.assign(created, data[0]); contents.push(created);
    return [created];
  };
  await sheet._onDropItem(event(zone("m1")), {});
  assert.deepEqual(contents, [created]);
  assert.deepEqual(created.getFlag(scope, "feitico"), { slot: "m1", requirements: [{ level: 5 }] });
  assert.deepEqual(created.system.activities, original.system.activities);
  assert.deepEqual(created.effects, original.effects);
  assert.deepEqual(incoming.toObject(), original);
});

test("the real click event reaches native Item.use so Shift bypasses the activity chooser", async () => {
  const source = readFileSync(new URL("../module/documents/item.mjs", import.meta.url), "utf8");
  const start = source.indexOf("  async use(config={}, dialog={}, message={}) {");
  const end = source.indexOf("\n  }", start) + 4;
  let choices = 0, uses = 0;
  const click = { shiftKey: true };
  const activity = { canUse: true, async use(config) { assert.equal(config.event, click); uses++; } };
  const nativeUse = new Function("ActivityChoiceDialog", "consumirPAItem",
    `return class {${source.slice(start, end)}}.prototype.use;`)
    ({ create: async () => { choices++; return activity; } }, async () => true);
  const item = spell("inherent", { parent: "inerente" }), { sheet } = fixture([item]);
  item.system.activities = [activity, { ...activity }]; item.use = nativeUse;
  await sheet._onClickAction(click, { dataset: { action: "feitico-roll", itemId: item.id } });
  assert.equal(uses, 1);
  assert.equal(choices, 0);
  click.shiftKey = false;
  await sheet._onClickAction(click, { dataset: { action: "feitico-roll", itemId: item.id } });
  assert.equal(uses, 2); assert.equal(choices, 1);
});
