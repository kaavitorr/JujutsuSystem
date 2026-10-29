import assert from "node:assert/strict";
import { test } from "node:test";
globalThis.Hooks = { on() {}, once() {} };
globalThis.CONST = { ACTIVE_EFFECT_MODES: { ADD: 2, OVERRIDE: 5 } };
globalThis.CONFIG = { statusEffects: { stunned: { id: "stunned" }, "jj-atordoado": { id: "jj-atordoado", name: "Atordoado" } } };
globalThis.game = { settings: { get: () => "2.0" }, time: { worldTime: 100 } };
globalThis.ui = { notifications: { warn() {} } };
const { applyGameCondition } = await import("../module/applications/actor/jj/conditions.mjs");
function fixture() {
  const created = [], updates = [];
  return { created, updates, actor: { name: "Alvo", isOwner: true, items: [], effects: [],
    system: { legacy2: { actions: { value: 6, max: 2 } }, traits: { ci: { value: new Set() } } },
    async createEmbeddedDocuments(type, rows) { created.push(...rows); }, async update(data) { updates.push(data); } } };
}
test("applying a game condition includes its real modifiers and equivalent core status", async () => {
  const f = fixture();assert.equal(await applyGameCondition(f.actor, "jj-atordoado", { origin: "ChatMessage.usage" }), true);
  assert.deepEqual(f.created[0].statuses, ["jj-atordoado", "stunned"]);
  assert.ok(f.created[0].changes.some(change => change.key === "system.legacy2.actions.max" && change.value === -4));
  assert.ok(f.created[0].changes.some(change => change.key === "system.attributes.movement.walk"));
  assert.equal(f.created[0].origin, "ChatMessage.usage");
});
test("condition immunity and ownership are respected; an existing condition is not duplicated", async () => {
  const f = fixture();f.actor.system.traits.ci.value.add("stunned");
  assert.equal(await applyGameCondition(f.actor, "jj-atordoado"), false);assert.equal(f.created.length, 0);
  f.actor.system.traits.ci.value.clear();f.actor.isOwner = false;
  assert.equal(await applyGameCondition(f.actor, "jj-atordoado"), false);assert.equal(f.created.length, 0);
  f.actor.isOwner = true;f.actor.effects = [{ statuses: new Set(["jj-atordoado"]) }];
  assert.equal(await applyGameCondition(f.actor, "jj-atordoado"), true);assert.equal(f.created.length, 0);
});
test("automatically applying an action penalty never restores actions that have already been spent", async () => {
  for (const current of [0, 1, 6]) {
    const f = fixture();f.actor.system.legacy2.actions.value = current;
    await applyGameCondition(f.actor, "jj-atordoado");
    const value = f.updates.at(-1)?.["system.legacy2.actions.value"] ?? current;
    assert.equal(value, Math.min(current, 2), `${current} actions before the condition`);
  }
});
test("source-dependent conditions retain their caster independently of a chat card", async () => {
  CONFIG.statusEffects["jj-amedrontado"] = { id: "jj-amedrontado", name: "Amedrontado" };
  globalThis.fromUuidSync = uuid => uuid === "ChatMessage.usage" ? { getAssociatedActor: () => ({ uuid: "Actor.caster" }) } : null;
  try {
    const f = fixture();
    await applyGameCondition(f.actor, "jj-amedrontado", { origin: "ChatMessage.usage" });
    assert.equal(f.created[0].flags["jujutsu-system"].conditionSourceActor, "Actor.caster");
    const updates = [];
    f.actor.effects = [{ statuses: new Set(["jj-amedrontado"]), update: async data => updates.push(data) }];
    await applyGameCondition(f.actor, "jj-amedrontado", { origin: "ChatMessage.usage" });
    assert.equal(updates[0]["flags.jujutsu-system.conditionSourceActor"], "Actor.caster");
  } finally { delete globalThis.fromUuidSync; }
});
