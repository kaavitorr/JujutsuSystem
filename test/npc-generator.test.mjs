import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { readFileSync } from "node:fs";
import { syncNpcProfileEquipment } from "../module/systems/legacy2-npc-equipment.mjs";

globalThis.Hooks = { on() {} };
globalThis.game = { user: { isGM: true }, settings: { get: () => "2.0" }, items: [], packs: [] };
globalThis.ui = { notifications: { warn() {}, error() {}, info() {} } };
globalThis.CONFIG = { JUJUTSU: { taxonomias: { animal: { label: "Animal" } }, arquetipos: { bruto: { label: "Bruto" } } } };
const generator = await import("../module/applications/actor/jj/npc-generator-dialog.mjs");
const weights = { str: 3, dex: 2, con: 3, int: 1, wis: 2, cha: 1 };
function profile(type, id, system = {}) {
  return { id, uuid: `Item.${id}`, name: id, type, visible: true, system: { pesos: weights, ...system },
    toObject() { return { _id: id, name: id, type, img: "icons/svg/pawprint.svg", system: structuredClone(this.system), folder: "source", ownership: {} }; } };
}

beforeEach(() => {
  game.user.isGM = true;
  game.items = [];
  game.packs = [];
  game.settings.get = () => "2.0";
});

for (const [world, chosen, expected] of [["2.0", "1.0", "jj-npcgen-tipo"], ["1.0", "2.0", 'name="taxonomia"']]) {
  test(`the ${world} world can explicitly open the ${chosen} generator`, async () => {
    game.settings.get = () => world;
    const dialogs = [];
    globalThis.foundry = { applications: { api: { DialogV2: { wait: async options => {
      dialogs.push(options);
      return dialogs.length === 1
        ? options.buttons.find(button => button.action === "continue")?.callback(null, { form: { elements: { version: { value: chosen } } } })
        : null;
    } } } } };
    await generator.openNpcGenerator();
    assert.equal(dialogs.length, 2);
    assert.match(dialogs[0].content, /1\.0/);
    assert.match(dialogs[0].content, /2\.0/);
    assert.match(dialogs[1].content, new RegExp(expected));
  });
}

test("cancelling version selection does not open a generator or create an actor", async () => {
  let dialogs = 0;
  globalThis.foundry = { applications: { api: { DialogV2: { wait: async () => { dialogs++; return null; } } } } };
  globalThis.Actor = { implementation: { create() { assert.fail("Cancelled generation created an actor"); } } };
  await generator.openNpcGenerator();
  assert.equal(dialogs, 1);
});

test("non-GMs cannot open either generator directly", async () => {
  game.user.isGM = false;
  globalThis.foundry = { applications: { api: { DialogV2: { wait() { assert.fail("Non-GM opened a generator"); } } } } };
  await generator.openNpcGenerator();
  await generator.openNpcGenerator1();
  await generator.openNpcGenerator2();
});

test("the 2.0 selector includes world and compendium profiles with escaped names", async () => {
  game.items = [profile("taxonomy", "Felinos & <feras>")];
  game.packs = [{ documentName: "Item", visible: true, collection: "test.profiles", metadata: { label: "Perfis" },
    getIndex: async () => [{ _id: "hunter", name: "Caçador", type: "archetype" }, { _id: "sword", name: "Espada", type: "weapon" }] }];
  let content;
  globalThis.foundry = { applications: { api: { DialogV2: { wait: async options => { content = options.content; return null; } } } } };
  await generator.openNpcGenerator2();
  assert.match(content, /Felinos &amp; &lt;feras&gt;/);
  assert.match(content, /Compendium\.test\.profiles\.Item\.hunter/);
  assert.match(content, /Espada/);
});

test("2.0 generation copies real profiles, grants only features due at the selected ND and equips their weapons", async () => {
  const tax = profile("taxonomy", "Felinos", { habilidades: [{ uuid: "Item.sense", nd: 1 }, { uuid: "Item.future", nd: 5 }],
    equipamentos: { armas: ["Item.claws"] } });
  const arq = profile("archetype", "Caçador");
  const docs = new Map([[tax.uuid, tax], [arq.uuid, arq], ["Item.sense", profile("feat", "Sentidos")],
    ["Item.claws", { ...profile("weapon", "Garras"), system: {} }]]);
  globalThis.fromUuid = async uuid => docs.get(uuid);
  let data;
  let sequence = 0;
  const actor = { type: "npc", name: "Caçador Felinos", isOwner: true, items: [], system: {},
    createEmbeddedDocuments: async (_, items) => {
      const created = items.map(item => ({ ...item, id: `owned${sequence++}` }));
      actor.items.push(...created); return created;
    },
    deleteEmbeddedDocuments: async (_, ids) => { actor.items = actor.items.filter(item => !ids.includes(item.id)); },
    update: async update => { actor.lastUpdate = update; }, sheet: { render() {} } };
  globalThis.Actor = { implementation: { create: async input => {
    data = input;
    actor.items = input.items.map((item, i) => ({ ...item, id: `initial${i}` }));
    actor.system = { ...input.system, attributes: { hp: { max: 120 } }, energy: { max: 90 } };
    return actor;
  } } };
  const result = await generator.createNpc2({ taxonomia: tax.uuid, arquetipo: arq.uuid, nd: 3 });
  assert.equal(result, actor);
  assert.deepEqual(data.items.slice(0, 2).map(item => item.type), ["taxonomy", "archetype"]);
  assert.equal(data.items[0].folder, undefined);
  assert.equal(data.items[0]._id, undefined);
  assert.equal(data.items[0].flags["jujutsu-system"].npcProfileSource, "Item.Felinos");
  assert(actor.items.some(item => item.name === "Sentidos"));
  assert(!actor.items.some(item => item.name === "future"));
  assert.equal(actor.items.find(item => item.name === "Garras").system.equipped, true);
  assert.equal(actor.lastUpdate["system.attributes.hp.value"], 120);
  assert.equal(actor.lastUpdate["system.energy.total"], 90);
});

test("invalid or unavailable profiles never create an incomplete 2.0 actor", async () => {
  globalThis.fromUuid = async () => null;
  globalThis.Actor = { implementation: { create() { assert.fail("Invalid profiles created an actor"); } } };
  assert.equal(await generator.createNpc2({ taxonomia: "Item.missing", arquetipo: "Item.missing", nd: 3 }), null);
});

test("choosing model 2.0 in a 1.0 world creates a usable profile-based snapshot with its grants", async () => {
  game.settings.get = () => "1.0";
  const tax = profile("taxonomy", "Felinos", { habilidades: [{ uuid: "Item.sense", nd: 1 }], equipamentos: { armas: ["Item.claws"] } });
  const arq = profile("archetype", "Caçador");
  globalThis.fromUuid = async uuid => ({ [tax.uuid]: tax, [arq.uuid]: arq,
    "Item.sense": profile("feat", "Sentidos"), "Item.claws": profile("weapon", "Garras") })[uuid];
  const actor = { type: "npc", isOwner: true, name: "NPC", items: [], system: {}, sheet: { render() {} },
    update: async update => { actor.lastUpdate = update; },
    createEmbeddedDocuments: async (_, items) => { const created = items.map((item, i) => ({ ...item, id: `grant${i}` })); actor.items.push(...created); return created; },
    deleteEmbeddedDocuments: async () => {} };
  globalThis.Actor = { implementation: { create: async data => {
    actor.items = data.items.map((item, i) => ({ ...item, id: `profile${i}` }));
    // Native 1.0 preparation keeps authored values; it does not derive 2.0 profiles.
    actor.system = { ...data.system, attributes: { ...data.system.attributes,
      hp: { ...data.system.attributes.hp, max: data.system.attributes.hp.max ?? 0 } },
    energy: { ...data.system.energy, max: data.system.energy.max ?? 0 } };
    return actor;
  } } };
  assert.equal(await generator.createNpc2({ taxonomia: tax.uuid, arquetipo: arq.uuid, nd: 1 }), actor);
  // Twenty initial points: For 5, Agi 3, Con 5, Int 2, Sab 3, Pre 2.
  assert.equal(actor.system.abilities?.con?.value, 5);
  assert.equal(actor.lastUpdate["system.attributes.hp.value"], 85);
  assert.equal(actor.lastUpdate["system.energy.total"], 30);
  assert.equal(actor.items.filter(item => item.name === "Sentidos").length, 1);
  assert.equal(actor.items.find(item => item.name === "Garras").system.equipped, true);
  assert.equal(game.settings.get(), "1.0");
});

function weapon(id, { pack = "test.weapons", container = null } = {}) {
  const data = { _id: id, name: id, type: "weapon", folder: "source-folder", ownership: { default: 0 },
    system: { equipped: false, container, activities: { attack: { type: "attack", activation: { type: "action", value: 3 },
      damage: { parts: [{ formula: "@npcDamageDice + @npcPrincipal", types: ["fire"] }] } } } },
    effects: [{ _id: "condition", name: "Queimadura", transfer: false, statuses: ["jj-queimadura"] }],
    flags: { "jujutsu-system": { ataqueNatural: true, condicaoAoAtingir: "Queimadura" } } };
  return { ...data, id, pack, visible: true, uuid: pack ? `Compendium.${pack}.Item.${id}` : `Item.${id}`,
    toObject: () => structuredClone(data) };
}

function actorBoundary() {
  let sequence = 0;
  const actor = { type: "npc", name: "NPC", isOwner: true, items: [], system: {}, sheet: { render() {} },
    createEmbeddedDocuments: async (_, items) => {
      const copies = items.map(item => ({ ...structuredClone(item), id: `grant${sequence++}` }));
      actor.items.push(...copies); return copies;
    },
    deleteEmbeddedDocuments: async (_, ids) => { actor.items = actor.items.filter(item => !ids.includes(item.id)); },
    update: async () => actor };
  globalThis.Actor = { implementation: { create: async data => {
    actor.items = data.items.map((item, index) => ({ ...structuredClone(item), id: `initial${index}` }));
    actor.system = data.system;
    return actor;
  } } };
  return actor;
}

test("every authored NPC weapon, including all elemental limbs and bites, can be selected by source UUID", async () => {
  const source = JSON.parse(readFileSync(new URL("../packs/_source/ataques-naturais.json", import.meta.url), "utf8"));
  const items = Object.values(source).flat().filter(item => item?.type === "weapon");
  assert.equal(items.filter(item => item.type === "weapon").length, 160);
  game.packs = [{ documentName: "Item", visible: true, collection: "jujutsu-compendium.equipamento-pdn",
    metadata: { label: "Equipamentos PdN" }, getIndex: async () => items }];
  let content;
  globalThis.foundry = { applications: { api: { DialogV2: { wait: async options => { content = options.content; return null; } } } } };
  await generator.openNpcGenerator2();
  const values = new Set([...content.matchAll(/name="npcWeapons"[^>]*value="([^"]+)"/g)].map(match => match[1]));
  assert.equal(values.size, 160);
  for (const item of items.filter(item => item.type === "weapon")) {
    assert(values.has(`Compendium.jujutsu-compendium.equipamento-pdn.Item.${item._id}`), item.name);
  }
});

test("selected weapons become equipped native Items, retain activities/effects and survive profile removal", async () => {
  const selected = weapon("Tentáculos Flamejantes", { container: "other-actor-container" });
  const automatic = weapon("Garras");
  const tax = profile("taxonomy", "Felinos", { equipamentos: { armas: [automatic.uuid] } });
  const arq = profile("archetype", "Lutador");
  const docs = new Map([tax, arq, selected, automatic].map(item => [item.uuid, item]));
  globalThis.fromUuid = async uuid => docs.get(uuid);
  const actor = actorBoundary();
  assert.equal(await generator.createNpc2({ taxonomia: tax.uuid, arquetipo: arq.uuid, nd: 3,
    armas: [selected.uuid, selected.uuid] }), actor);
  const copies = actor.items.filter(item => item.type === "weapon" && item.name === "Tentáculos Flamejantes");
  assert.equal(copies.length, 1);
  const copy = copies[0];
  assert.equal(copy.system.equipped, true);
  assert.equal(copy.system.container, null);
  assert.equal(copy.system.activities.attack.activation.value, 3);
  assert.equal(copy.system.activities.attack.damage.parts[0].formula, "@npcDamageDice + @npcPrincipal");
  assert.equal(copy.effects[0]._id, "condition");
  assert.equal(copy.effects[0].statuses[0], "jj-queimadura");
  assert.equal(copy.flags["jujutsu-system"].npcArchetypeEquipment, undefined);
  assert.equal(copy._stats.compendiumSource, selected.uuid);
  assert.equal(copy._id, undefined);
  assert.equal(copy.folder, undefined);
  assert.equal(copy.ownership, undefined);
  assert.equal(selected.toObject().system.equipped, false);
  assert(actor.items.some(item => item.name === "Garras"));
  actor.items = actor.items.filter(item => !["taxonomy", "archetype"].includes(item.type));
  actor.system.legacy2.taxonomia = actor.system.legacy2.arquetipo = null;
  await syncNpcProfileEquipment(actor);
  assert.equal(actor.items.filter(item => item.type === "weapon").length, 1);
  assert.equal(actor.items.find(item => item.type === "weapon").name, "Tentáculos Flamejantes");
});

for (const pack of ["test.weapons", null]) {
  test(`a selected ${pack ? "compendium" : "world"} weapon also granted by a profile is copied once`, async () => {
    const selected = weapon("Mordida", { pack });
    const tax = profile("taxonomy", "Felinos", { equipamentos: { armas: [selected.uuid] } });
    const arq = profile("archetype", "Caçador");
    const docs = new Map([tax, arq, selected].map(item => [item.uuid, item]));
    globalThis.fromUuid = async uuid => docs.get(uuid);
    const actor = actorBoundary();
    await generator.createNpc2({ taxonomia: tax.uuid, arquetipo: arq.uuid, nd: 1, armas: [selected.uuid] });
    await syncNpcProfileEquipment(actor);
    const copies = actor.items.filter(item => item.type === "weapon");
    assert.equal(copies.length, 1);
    assert.equal(copies[0].flags["jujutsu-system"].npcArchetypeEquipment, undefined);
    assert.equal(copies[0].flags["jujutsu-system"].npcGeneratorWeaponSource, selected.uuid);
  });
}

test("an unavailable, unreadable or non-weapon selection cannot silently create an incomplete NPC", async () => {
  const tax = profile("taxonomy", "Felinos"), arq = profile("archetype", "Lutador");
  const denied = { ...weapon("Privada"), visible: false };
  const wrongType = profile("feat", "Efeito");
  const docs = new Map([tax, arq, denied, wrongType].map(item => [item.uuid, item]));
  globalThis.fromUuid = async uuid => docs.get(uuid);
  let creations = 0;
  globalThis.Actor = { implementation: { create() { creations++; return null; } } };
  for (const uuid of ["Item.missing", denied.uuid, wrongType.uuid]) {
    assert.equal(await generator.createNpc2({ taxonomia: tax.uuid, arquetipo: arq.uuid, nd: 1, armas: [uuid] }), null);
  }
  assert.equal(creations, 0);
});
