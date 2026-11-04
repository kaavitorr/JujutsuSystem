import assert from "node:assert/strict";
import { test } from "node:test";
import { activationChoices, activationContext } from "../module/applications/activity/legacy2-activation.mjs";

globalThis.game = { settings: { get: () => "2.0" } };
globalThis.CONFIG = { DND5E: { abilities: {} } };
const events = new Map();
globalThis.Hooks = { on: (key, callback) => events.set(key, callback) };
globalThis.ui = { notifications: { warn() {}, info() {} } };
const { custoEfetivoEmAcoes } = await import("../module/systems/acoes-combate.mjs");

function fixture({ count = 1, spent = 0, actions = 6, cost = 3, type = "character" } = {}) {
  const names = ["Explosão de Velocidade", "Passo Esguio", "Reação Acelerada", "Punho Devastador"];
  const actor = { type, items: [], flags: {}, system: { legacy2: { actions: { value: actions } }, energy: {}, abilities: {} },
    getFlag(scope, key) { return this.flags[scope]?.[key]; } };
  actor.items = names.slice(0, count).map((name, index) => ({ id: `feat${index}`, type: "feat", name, actor,
    system: { identifier: index === 0 ? "explosao-de-velocidade" : "", uses: { max: "5", spent: index === 0 ? spent : 0, recovery: [] } },
    flags: { "jujutsu-system": { especializacao: { categoria: "Proezas Físicas", caminho: index % 2 ? "Corpo do Guerreiro" : "Corpo de Guerreiro" } } } }));
  const activity = { actor, type: "save", activation: { value: cost },
    item: { actor, type: "spell", name: "Técnica", system: {} } };
  return { actor, activity, base: actor.items[0] };
}

test("potential capacity counts distinct body-path abilities, including the initial ability, for PCs and NPCs", () => {
  for (const type of ["character", "npc"]) for (const [count, max] of [[1, 5], [2, 6], [3, 6], [4, 7]]) {
    const { actor, activity } = fixture({ count, spent: 2, type });
    assert.deepEqual(activationContext(activity).potentialInfo, { max, current: max - 2 });
    actor.items.push(actor.items[0]);
    assert.deepEqual(activationContext(activity).potentialInfo, { max, current: max - 2 });
  }
});
test("potential discounts stop at one action, never apply to weapons, and never spend beyond the available pool", () => {
  const { actor, activity } = fixture({ spent: 3 });
  assert.equal(custoEfetivoEmAcoes(activity, { legacy2: { potencial: 99 } }, actor), 1);
  activity.activation.value = 5;
  assert.equal(custoEfetivoEmAcoes(activity, { legacy2: { potencial: 99 } }, actor), 3);
  activity.item.type = "weapon";
  assert.equal(custoEfetivoEmAcoes(activity, { legacy2: { potencial: 99 } }, actor), 5);
  assert.equal(activationChoices(activity, { potencial: 99 }).potencial, 0);
  activity.item.type = "spell"; actor.items.length = 0;
  assert.equal(custoEfetivoEmAcoes(activity, { legacy2: { potencial: 99 } }, actor), 5);
});
test("the modal accepts a technique that becomes affordable with PP and rechecks actions before consuming resources", () => {
  const { activity } = fixture({ actions: 1 });
  assert.notEqual(events.get("dnd5e.preUseActivity")(activity, {}, { configure: true }), false);
  assert.equal(events.get("dnd5e.preUseActivity")(activity, {}), false);
  assert.equal(typeof events.get("dnd5e.preActivityConsumption"), "function");
  assert.equal(events.get("dnd5e.preActivityConsumption")(activity, { legacy2: { potencial: 0 } }), false);
  assert.notEqual(events.get("dnd5e.preActivityConsumption")(activity, { legacy2: { potencial: 2 } }), false);
});
test("successful PP consumption joins the native batch and does not debit actions or PP again after use", async () => {
  const { actor, activity, base } = fixture({ actions: 3, cost: 4 });
  const usage = { legacy2: { potencial: 2 } }, updates = { actor: {}, item: [] };
  assert.equal(typeof events.get("dnd5e.activityConsumption"), "function");
  events.get("dnd5e.activityConsumption")(activity, usage, {}, updates);
  assert.deepEqual(updates.actor, { "system.legacy2.actions.value": 1 });
  assert.deepEqual(updates.item, [{ _id: base.id, "system.uses.spent": 2 }]);
  // Apply the actual batch at the framework boundary, then deliver the successful-use hooks.
  actor.system.legacy2.actions.value = 1; base.system.uses.spent = 2;
  events.get("dnd5e.postActivityConsumption")(activity, usage);
  actor.update = async () => assert.fail("the native batch already paid for the actions");
  await events.get("dnd5e.postUseActivity")(activity, usage);
  assert.equal(actor.system.legacy2.actions.value, 1); assert.equal(base.system.uses.spent, 2);
});
test("the PP debit is limited to the effective discount, including combined hand seals", async () => {
  const { actor, activity, base } = fixture({ cost: 3 }); actor.flags["jujutsu-system"] = { selos: 1 };
  const usage = { legacy2: { potencial: 5, selos: 1 } }, updates = { actor: {}, item: [] };
  const prepare = events.get("dnd5e.activityConsumption"); assert.equal(typeof prepare, "function");
  prepare(activity, usage, {}, updates);
  assert.equal(updates.item[0]["system.uses.spent"], 1);
  assert.equal(updates.actor["system.legacy2.actions.value"], 5);
  assert.equal(updates.actor["flags.jujutsu-system.selos"], 0);
  assert.equal(base.system.uses.spent, 0);
  base.system.uses.spent = 1; actor.system.legacy2.actions.value = 5; actor.flags["jujutsu-system"].selos = 0;
  events.get("dnd5e.postActivityConsumption")(activity, usage);
  actor.update = async () => assert.fail("the native batch already paid both actions and seals");
  await events.get("dnd5e.postUseActivity")(activity, usage);
});

export { fixture };
