import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
const registered = new Map();
globalThis.Hooks = { on: (event, handler) => registered.set(event, handler), call: () => true, callAll() {} };
globalThis.game = { settings: { get: () => "2.0" }, user: {}, combat: null };
globalThis.CONFIG = { DND5E: { abilities: {} } };
globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };
globalThis.ui = { notifications: { warn() {}, info() {}, error() {} } };
let choice = { incrementos: 1, persistente: false };
const fields = Object.fromEntries(["ArrayField", "DocumentUUIDField", "FilePathField", "NumberField", "SchemaField", "StringField", "BooleanField", "SetField", "ObjectField"].map(key => [key, class {}]));
globalThis.KeyboardManager = { MODIFIER_CODES: { Alt: [], Control: [], Meta: [], Shift: [] }, MODIFIER_KEYS: [] };
globalThis.foundry = { data: { fields }, applications: { api: { DialogV2: { wait: async () => choice } } } };
globalThis.Roll = class { static validate() { return true; } constructor(formula) { this.formula = formula;this.total = 12; } async evaluate() { return this; } async toMessage() {} };
const { activateDamageReduction } = await import("../module/applications/actor/jj/reducao-dano.mjs");
function fixture(energy = 10, actions = 6) {
  const writes = [], actor = { type: "character", name: "Alvo", items: [], getFlag: () => null, getRollData: () => ({}),
    system: { details: { level: 7 }, energy: { generated: energy, total: 100 }, legacy2: { actions: { value: actions } } },
    async update(data) { writes.push(data); } };
  return { actor, writes, activity: { item: { actor, type: "spell", system: {} }, type: "reduction", activation: { value: 2 },
    reduction: { formula: "4d8" }, consumption: { targets: [{ target: "energy.generated", value: "4" }] }, jjScale: { formula: "1d8", cost: 1, maxPA: 7 } } };
}
test("a reduction technique pays activation, scale and actions once alongside its pending protection", async () => {
  const { activity, writes } = fixture();
  await activateDamageReduction(activity, { consume: true });
  assert.equal(writes.length, 1);assert.equal(writes[0]["system.energy.generated"], 5);
  assert.equal(writes[0]["system.legacy2.actions.value"], 4);
  assert.deepEqual(writes[0]["flags.jujutsu-system.reducaoDano"], { valor: 12, persistente: false });
});
test("canceling or lacking actions or energy never prepares a free technique reduction", async () => {
  const previous = choice; choice = null;
  const a = fixture();await activateDamageReduction(a.activity, { consume: true });assert.deepEqual(a.writes, []);
  choice = previous;
  for (const [energy, actions] of [[3,6], [10,1]]) {
    const a = fixture(energy, actions);await activateDamageReduction(a.activity, { consume: true });assert.deepEqual(a.writes, []);
  }
});
test("the native activity awaits the custom reduction flow after ordinary pre-use validation", async () => {
  const mixin = readFileSync(new URL("../module/documents/activity/mixin.mjs", import.meta.url), "utf8");
  const body = mixin.match(/async use\(usage=\{\}, dialog=\{\}, message=\{\}\) \{([\s\S]*?)\n    \}/)[1];
  const use = new Function("TargetsField", `return async function(usage={},dialog={},message={}){${body}}`)({ getDescriptors: () => [] });
  foundry.utils = { mergeObject: (left, right) => ({ ...left, ...right }) };
  let complete, called = false;
  const completion = new Promise(resolve => { complete = resolve; });
  const activity = { _prepareUsageConfig: value => value, metadata: { usage: {} }, _useCustom: async () => { called = true;await completion;return { reduction: 12 }; } };
  const item = { isEmbedded: true, isOwner: true, system: { activities: { get: () => activity } } };item.clone = () => item;
  let returned = false;
  const result = use.call({ item, canUse: true, metadata: activity.metadata }).then(value => { returned = true;return value; });
  await Promise.resolve();assert.equal(called, true);assert.equal(returned, false);
  complete();assert.deepEqual(await result, { reduction: 12 });
  const reduction = readFileSync(new URL("../module/documents/activity/reduction.mjs", import.meta.url), "utf8");
  assert.match(reduction, /_useCustom[\s\S]*activateDamageReduction/);
});
test("persistent reduction expires on its owner's next native tracker turn, including a new solo round", async () => {
  const expire = registered.get("updateCombat");
  for (const previous of [{ combatantId: "other", round: 1 }, { combatantId: "self", round: 0 }]) {
    let pending = { valor: 12, persistente: true }, deleted = 0;
    const actor = { name: "Alvo", isOwner: true, getFlag: () => pending, async unsetFlag() { pending = null;deleted++; } };
    const combat = { started: true, current: { combatantId: "self", round: 1 }, previous,
      combatants: new Map([["self", { actor }]]) };
    await expire(combat, { turn: 0 }, {});assert.equal(deleted, 1);
  }
  const actor = { isOwner: true, getFlag: () => ({ valor: 12, persistente: true }), unsetFlag: () => assert.fail("same turn") };
  const current = { combatantId: "self", round: 1 };
  await expire({ started: true, current, previous: current, combatants: new Map([["self", { actor }]]) }, { turn: 0 }, {});
});
test("the actual granted Defesa Sólida spends resources and protects a player or NPC on the next native damage", async () => {
  const { channelingTechniqueGrants } = await import("../module/systems/legacy2-channeling-techniques.mjs");
  const { absorbShieldDamage } = await import("../module/systems/legacy2-shield.mjs");
  const { default: Ruleset } = await import("../module/systems/ruleset.mjs");
  const source = readFileSync(new URL("../module/documents/actor/actor.mjs", import.meta.url), "utf8");
  const body = source.match(/async applyDamage\(damages, options=\{\}\) \{([\s\S]*?)\n  \}/)[1];
  const apply = new Function("Ruleset", "absorbShieldDamage", `return async function(damages,options={}){${body}}`)(Ruleset, absorbShieldDamage);
  Number.isNumeric ??= value => typeof value === "number";
  Math.clamp ??= (value, min, max) => Math.min(max, Math.max(min, value));
  for (const type of ["character", "npc"]) {
    const { actor } = fixture();actor.type = type;actor.system.legacy2.nd = "7";
    actor.system.attributes = { hp: { value: 30, damage: 0, temp: 0 } };
    actor.system._source = { attributes: { hp: { tempmax: 0 } } };
    const flags = {};actor.getFlag = (scope, key) => flags[key];
    actor.calculateDamage = damages => ({ amount: damages[0].value, temp: 0, tempMax: 0 });
    actor.update = async data => { for (const [path, value] of Object.entries(data)) {
      if (path.startsWith("flags.jujutsu-system.-=")) delete flags[path.split("-=")[1]];
      else if (path.startsWith("flags.jujutsu-system.")) flags[path.split(".").pop()] = value;
      else { const parts = path.split("."), key = parts.pop();parts.reduce((obj, part) => obj[part], actor)[key] = value; }
    } };
    const item = channelingTechniqueGrants([{ name: "Canalização de Combate", type: "feat" }], 7).find(item => item.name === "Defesa Sólida");
    item.actor = actor;actor.items = [item];
    const activity = { ...Object.values(item.system.activities)[0], item };
    await activateDamageReduction(activity, { consume: true });
    assert.equal(actor.system.energy.generated, 5);assert.equal(actor.system.legacy2.actions.value, 4);
    await apply.call(actor, [{ value: 20 }]);assert.equal(actor.system.attributes.hp.value, 22);assert.equal(flags.reducaoDano, undefined);
    await apply.call(actor, [{ value: 5 }]);assert.equal(actor.system.attributes.hp.value, 17);
  }
});
