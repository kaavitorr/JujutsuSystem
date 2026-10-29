import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import Ruleset from "../module/systems/ruleset.mjs";
import { activationChoices, activationContext, hasLegacy2Activation, energyConsumptionPlan, withoutEnergyConsumption } from "../module/applications/activity/legacy2-activation.mjs";

globalThis.game = { settings: { get: () => "2.0" } };
globalThis.CONFIG = { DND5E: { abilities: { int: { label: "Intelecto" } } } };
// Native cards import the damage aggregator; these tests exercise consumption, not dice terms.
globalThis.foundry = { dice: { terms: Object.fromEntries(
  ["DiceTerm", "NumericTerm", "OperatorTerm", "PoolTerm", "RollTerm"].map(key => [key, class {}])
) } };
function fixture(level = 5, generated = 10) {
  const actor = { system: { details: { level }, energy: { generated, total: 100 }, abilities: { int: { value: 7 } } }, items: [], getFlag: () => null };
  const activity = { type: "attack", item: { type: "spell", name: "Técnica", actor, system: {} }, damage: { parts: [{}] },
    attack: { ability: "int" }, range: { value: 12, units: "m" }, target: { template: { type: "cone" } },
    consumption: { targets: [{ target: "energy.generated", value: "4" }, { target: "legacy2.reverseEnergy.value", value: "2" }] } };
  return { actor, activity };
}
test("advantages and disadvantages use integer counters; offensive burst is capped at ceil(level/2)", () => {
  const { activity } = fixture();
  assert.deepEqual(activationChoices(activity, { vantagens: 3, desvantagens: 1, pa: 99, bonus: -2, gesture: "sphere" }),
    { vantagens: 3, desvantagens: 1, pa: 3, bonus: -2, gesture: "cone", ability: "int", attackMode: undefined, ammunition: undefined,
      gesto: null, condicao: false, manipulacao: false, selos: 0, danoAdicional: "", recarga: null, recarregar: false });
  const context = activationContext(activity, { vantagens: 3, desvantagens: 1, pa: 2 });
  assert.equal(context.advantageBonus, 2);
  assert.equal(context.burstLimit, 3);
  assert.equal(context.burstFormula, "2d4");
  assert.equal(context.abilityValue, 7);
});
test("only the native ranged gesture can be selected; melee hides gestures", () => {
  const { activity } = fixture();
  const context = activationContext(activity);
  assert.equal(context.gestures.length, 6);
  assert.deepEqual(context.gestures.filter(g => !g.disabled).map(g => g.value), ["cone"]);
  activity.target.template.type = "";
  activity.range = { units: "touch" };
  assert.equal(activationContext(activity).showGestures, false);
});
test("burst and selected technique PA costs are validated together before any write", () => {
  const { activity } = fixture(5, 6);
  assert.throws(() => energyConsumptionPlan(activity, { consume: { resources: [0, 1] }, legacy2: { pa: 3 } }), /7 PA/);
  const plan = energyConsumptionPlan(activity, { consume: { resources: [0, 1] }, legacy2: { pa: 2 } });
  assert.deepEqual(plan.updates, { "system.energy.generated": 0 });
  assert.deepEqual(withoutEnergyConsumption(activity, { consume: { resources: [0, 1] } }).consume.resources, [1]);
  const unchecked = energyConsumptionPlan(activity, { consume: { resources: [1] }, legacy2: { pa: 3 } });
  assert.equal(unchecked.updates["system.energy.generated"], 3);
});
test("NPC burst and energy costs use threat level rather than the inherited character level", () => {
  const { actor, activity } = fixture(20, 8);
  actor.type = "npc";
  actor.system.legacy2 = { nd: 5 };
  const choices = activationChoices(activity, { pa: 99 });
  assert.equal(choices.pa, 3);
  assert.equal(activationContext(activity, choices).burstLimit, 3);
  const plan = energyConsumptionPlan(activity, { consume: { resources: [0] }, legacy2: choices });
  assert.equal(plan.updates["system.energy.generated"], 1);
  assert.equal(actor.system.energy.generated, 8);
  actor.system.energy.generated = 6;
  assert.throws(() => energyConsumptionPlan(activity, { consume: { resources: [0] }, legacy2: choices }), /7 PA/);
  assert.equal(actor.system.energy.generated, 6);
});
test("summon payer and Seis Olhos reduction apply once while burst stays real PA", () => {
  const { actor, activity } = fixture();
  const payer = { system: { energy: { generated: 20, total: 100 } } };
  actor.flags = { JujutsuLegacy: { summon: { origin: "Actor.summoner", consumeSummoner: true } } };
  globalThis.fromUuidSync = () => payer;
  actor.items.push({ name: "Seis Olhos", type: "feat" });
  actor.system.attributes = { prof: 2 };
  actor.getFlag = () => "full";
  const plan = energyConsumptionPlan(activity, { consume: { resources: true }, legacy2: { pa: 3 } });
  assert.equal(plan.payer, payer);
  assert.equal(plan.updates["system.energy.generated"], 15);
  assert.equal(actor.system.energy.generated, 10);
});
test("invalid counters cannot produce NaN, negative costs or fractional dice", () => {
  const { activity } = fixture(3);
  const config = activationChoices(activity, { vantagens: "bad", desvantagens: -1, pa: 1.9, bonus: Infinity });
  assert.equal(config.vantagens, 0); assert.equal(config.desvantagens, 0);
  assert.equal(config.pa, 1); assert.equal(config.bonus, 0);
  const { activity: low } = fixture(1, 0);
  assert.equal(activationContext(low).burstLimit, 1);
  assert.equal(activationContext(low).burstMax, 0);
});

const registered = new Map();
globalThis.Hooks = { on: (name, callback) => registered.set(name, callback), call: () => true };
globalThis.ui = { notifications: { warn: () => {} } };
const cards = await import("../module/applications/actor/jj/native-cards.mjs");

test("accepted direct attacks spend PA once and inject exactly Nd4; prepaid activation never spends again", async () => {
  const { actor, activity } = fixture();
  actor.id = "actor"; activity.item.id = "item"; activity.id = "attack";
  const writes = [];
  actor.update = async data => { writes.push(data); actor.system.energy.generated = data["system.energy.generated"]; };
  activity.getRollData = () => ({});
  assert.equal(await cards.prepareJJAttackContext(activity), true);
  assert.equal(writes.length, 0);
  assert.equal(await cards.commitLegacy2Attack(activity, { pa: 3 }), true);
  assert.equal(writes.length, 1); assert.equal(actor.system.energy.generated, 7);
  assert.equal(await cards.commitLegacy2Attack(activity, { pa: 3 }, { prepaid: true }), true);
  assert.equal(writes.length, 1);
  const config = { subject: activity, rolls: [{ parts: ["2d8"] }] };
  registered.get("dnd5e.preRollDamage")(config);
  assert.deepEqual(config.rolls[1].parts, ["3d4"]);
  await cards.finishLegacy2Damage(activity, config);
  const repeat = { subject: activity, rolls: [{ parts: ["2d8"] }] };
  registered.get("dnd5e.preRollDamage")(repeat);
  assert.equal(repeat.rolls.length, 1);
});

test("insufficient PA aborts the attack without a debit or damage stash", async () => {
  const { actor, activity } = fixture(5, 1);
  actor.id = "poor"; activity.item.id = "item"; activity.id = "attack";
  actor.update = async () => assert.fail("must not spend PA");
  assert.equal(await cards.commitLegacy2Attack(activity, { pa: 3 }), false);
  assert.equal(cards.popPendingDamage(activity), null);
});

test("native PA consumption joins the normal batch, preserves PER and validates the combined cost", async () => {
  const source = readFileSync(new URL("../module/documents/activity/mixin.mjs", import.meta.url), "utf8");
  const body = source.match(/async consume\(usageConfig, messageConfig\) \{([\s\S]*?)\n    \}/)[1];
  globalThis.foundry = { utils: { isEmpty: object => !Object.keys(object).length, setProperty: () => {} } };
  const Consumption = new Function("Ruleset", "energyConsumptionPlan", "withoutEnergyConsumption", `return class {
    async consume(usageConfig, messageConfig) {${body}}
    async #applyUsageUpdates(updates) { this.applied = updates; return {}; }
  }`)(Ruleset, energyConsumptionPlan, withoutEnergyConsumption);
  const { actor, activity } = fixture(5, 6), doc = Object.assign(new Consumption(), activity);
  doc.actor = actor;
  doc._prepareUsageUpdates = async config => {
    assert.deepEqual(config.consume.resources, [1]);
    return { actor: { "system.legacy2.reverseEnergy.value": 28 }, item: [], create: [], delete: [], rolls: [] };
  };
  assert.equal(await doc.consume({ consume: { resources: [0, 1] }, legacy2: { pa: 3 } }, {}), false);
  assert.equal(doc.applied, undefined);
  await doc.consume({ consume: { resources: [0, 1] }, legacy2: { pa: 2 } }, {});
  assert.equal(doc.applied.actor["system.energy.generated"], 0);
  assert.equal(doc.applied.actor["system.legacy2.reverseEnergy.value"], 28);
});

test("the real attack builder applies form counters and bonus without granting extra d20s", () => {
  const source = readFileSync(new URL("../module/documents/activity/attack.mjs", import.meta.url), "utf8");
  const body = source.match(/_buildAttackConfig\(process, config, formData, index\) \{([\s\S]*?)\n  \}/)[1];
  const modification = { combineFields: () => ({}) };
  CONFIG.Dice = { D20Roll: { ADV_MODE: { NORMAL: 0 }, mergeOptions: (a, b) => ({ ...a, ...b }) } };
  const Attack = new Function("Ruleset", "activationChoices", "D20RollModificationField", `return class {
    _buildAttackConfig(process, config, formData, index) {${body}}
  }`)(Ruleset, activationChoices, modification);
  const { actor, activity } = fixture(), attack = Object.assign(new Attack(), activity);
  attack.actor = actor;
  attack.getActionType = () => "rsak";
  attack.getAttackData = ({ legacy2 }) => ({ parts: ["@mod", "@legacyAdv"], data: { mod: 7, legacyAdv: Ruleset.advantagePart(legacy2) } });
  const form = new Map([["legacy2.vantagens", "3"], ["legacy2.desvantagens", "1"], ["legacy2.bonus", "5"]]);
  const config = { options: { advantage: true, advantageMode: 1 } }, process = { ability: "int" };
  attack._buildAttackConfig(process, config, form, 0);
  assert.equal(config.data.legacyAdv, 2); assert.equal(config.data.jj2ManualBonus, 5);
  assert.equal(config.options.advantageMode, 0); assert.equal(config.options.advantage, false);
  assert.equal(config.parts.filter(part => part === "@jj2ManualBonus").length, 1);
});

test("native scaled PA costs and energy scale remain part of the combined transaction", () => {
  const { activity } = fixture(5, 20);
  activity.consumption.targets[0].resolveCost = ({ config, evaluate }) => {
    assert.equal(evaluate, false);
    return { isDeterministic: true, evaluateSync: () => ({ total: 4 + config.scaling * 2 }) };
  };
  activity.jjScale = { formula: "2d8", cost: 2, maxPA: 10 };
  const plan = energyConsumptionPlan(activity, { scaling: 1, consume: { resources: [0] }, legacy2: { pa: 2, scale: 2 } });
  assert.equal(plan.updates["system.energy.generated"], 8);
  cards.stashLegacy2Activation(activity, { pa: 2, scale: 2 });
  const extras = cards.popPendingDamage(activity);
  assert.equal(extras.paDenomination, 4);
  assert.deepEqual(extras.rolls.map(r => r.parts), [["2d"], ["4d8"]]);
});

test("spending the last PA never removes already purchased scale dice", async () => {
  const { actor, activity } = fixture(5, 3);
  activity.jjScale = { formula: "1d6", cost: 1, maxPA: 0 };
  actor.update = async data => { actor.system.energy.generated = data["system.energy.generated"]; };
  assert.equal(await cards.commitLegacy2Attack(activity, { scale: 3 }), true);
  assert.equal(actor.system.energy.generated, 0);
  assert.deepEqual(cards.popPendingDamage(activity).rolls.map(r => r.parts), [["3d6"]]);
});

test("cancelled damage keeps paid dice; a successful damage card consumes them exactly once", async () => {
  const { activity } = fixture();
  activity.id = "cancelled"; activity.item.id = "item"; activity.item.actor.id = "actor";
  activity.getRollData = () => ({});
  const activation = { pa: 3, scale: 0, prepaid: true }, writes = [];
  const message = { flags: { "jujutsu-system": { activation } }, async update(data) {
    writes.push(data); activation.damageApplied = true;
  } };
  game.messages = new Map([["usage", message]]);
  cards.stashLegacy2Activation(activity, activation, { origin: "usage" });
  for (let attempt = 0; attempt < 2; attempt++) {
    const config = { subject: activity, jj2Origin: "usage", rolls: [{ parts: ["1d8"] }] };
    registered.get("dnd5e.preRollDamage")(config);
    assert.deepEqual(config.rolls[1].parts, ["3d4"]);
    assert.equal(writes.length, 0);
  }
  game.messages.set("damage", { flags: { "jujutsu-system": { activationDamage: "usage" } } });
  await cards.finishLegacy2Damage(activity, { jj2Origin: "usage" });
  assert.equal(writes.length, 0);
  assert.equal(cards.legacy2DamageContext(activity, { jj2Origin: "usage" }).rolls.length, 0);
  await cards.finishLegacy2Damage(activity, { jj2Origin: "usage" }); assert.equal(writes.length, 0);
});

test("paid extras survive reload and two activations keep their own burst and scale", async () => {
  const { activity } = fixture();
  activity.id = "multi"; activity.item.id = "item"; activity.item.actor.id = "actor";
  const first = { pa: 1, scale: 2, scaleFormula: "1d6" }, second = { pa: 3 };
  const message = activation => ({ flags: { "jujutsu-system": { activation } }, async update() { activation.damageApplied = true; } });
  game.messages = new Map([["first", message(first)], ["second", message(second)]]);
  cards.stashLegacy2Activation(activity, second, { origin: "second" });
  assert.deepEqual(cards.legacy2DamageContext(activity, { jj2Origin: "first" }).rolls.map(r => r.parts), [["1d"], ["2d6"]]);
  await cards.finishLegacy2Damage(activity, { jj2Origin: "first" });
  assert.deepEqual(cards.legacy2DamageContext(activity, { jj2Origin: "second" }).rolls.map(r => r.parts), [["3d"]]);
  cards.popPendingDamage(activity); // Simulate a fresh client with no local pending context.
  assert.deepEqual(cards.legacy2DamageContext(activity, { jj2Origin: "second" }).rolls.map(r => r.parts), [["3d"]]);
});

test("non-spell healing keeps its configured energy scale without gaining offensive burst", () => {
  const { activity } = fixture();
  activity.type = "heal"; activity.item.type = "feat";
  activity.jjScale = { formula: "1d8", cost: 1 };
  assert.equal(hasLegacy2Activation(activity), true);
  const choices = activationChoices(activity, { scale: 2, pa: 3 });
  assert.equal(choices.pa, 0); assert.equal(choices.scale, 2);
  assert.equal(activationContext(activity, choices).canBurst, false);
  const plan = energyConsumptionPlan(activity, { consume: false, legacy2: choices });
  assert.equal(plan.updates["system.energy.generated"], 8);
});

test("damage completion on a shared GM card never requires updating somebody else's message", async () => {
  const { activity } = fixture();
  activity.id = "shared";
  game.messages = new Map([["gm-card", { id: "gm-card", isOwner: false,
    flags: { "jujutsu-system": { activation: { pa: 2 } } },
    async update() { throw new Error("Player cannot update GM's message"); } }]]);
  cards.stashLegacy2Activation(activity, { pa: 2 }, { origin: "gm-card" });
  await cards.finishLegacy2Damage(activity, { jj2Origin: "gm-card" });
});

test("1.0 retains the separate PA dialog, proficiency limit and the technique's original damage die", async () => {
  const original = game.settings.get;
  game.settings.get = () => "1.0";
  try {
    const { actor, activity } = fixture(9, 10);
    activity.damage.parts[0].denomination = 8;
    actor.update = async data => { actor.system.energy.generated = data["system.energy.generated"]; };
    let dialogs = 0;
    foundry.applications = { api: { DialogV2: { async wait(options) {
      dialogs++; assert.match(options.content, /Máximo: <strong>2<\/strong> d8/); return 2;
    } } } };
    assert.equal(hasLegacy2Activation(activity), false);
    assert.equal(await cards.prepareJJAttackContext(activity), true);
    assert.equal(dialogs, 1); assert.equal(actor.system.energy.generated, 8);
    const extras = cards.popPendingDamage(activity);
    assert.equal(extras.paDenomination, 8);
  } finally { game.settings.get = original; }
});
