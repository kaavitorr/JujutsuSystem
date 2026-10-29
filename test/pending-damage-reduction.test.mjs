import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import Ruleset from "../module/systems/ruleset.mjs";
import { absorbShieldDamage } from "../module/systems/legacy2-shield.mjs";
globalThis.game = { settings: { get: () => "2.0" } };
globalThis.Hooks = { on() {}, call: () => true, callAll() {} };
globalThis.ChatMessage = { create: async () => {}, getSpeaker: () => ({}) };
globalThis.ui = { notifications: { info() {} } };
Number.isNumeric ??= value => typeof value === "number";
Math.clamp ??= (value, min, max) => Math.min(max, Math.max(min, value));
const source = readFileSync(new URL("../module/documents/actor/actor.mjs", import.meta.url), "utf8");
const body = source.match(/async applyDamage\(damages, options=\{\}\) \{([\s\S]*?)\n  \}/)[1];
const native = new Function("Ruleset", "absorbShieldDamage", `return async function(damages,options={}){${body}}`)(Ruleset, absorbShieldDamage);
const { applyDamageToActor } = await import("../module/applications/actor/jj/damage-application.mjs");
function fixture(type, flags = {}) {
  const hp = { value: 30, temp: 5, damage: 0 };
  return { type, name: "Alvo", flags,
    system: { armorPoints: { value: 2 }, attributes: { hp }, _source: { attributes: { hp: { tempmax: 0 } } } },
    getFlag: (scope, key) => flags[key], calculateDamage: damages => ({ amount: damages[0].value, temp: 0, tempMax: 0 }),
    async update(updates) { for (const [path, value] of Object.entries(updates)) {
      if (path.startsWith("flags.jujutsu-system.-=")) delete flags[path.split("-=")[1]];
      else { const parts = path.split("."), key = parts.pop();parts.reduce((obj, part) => obj[part], this)[key] = value; }
    } }
  };
}
for (const route of ["native", "custom"]) for (const type of ["character", "npc"]) {
  const apply = (actor, amount) => route === "native" ? native.call(actor, [{ value: amount }]) : applyDamageToActor(actor, amount);
  test(`${route}/${type}: burst and technique reduction both protect before shield and temporary life`, async () => {
    const a = fixture(type, { explosaoDefensivaPendente: { reducao: 8 }, reducaoDano: { valor: 4, persistente: false } });
    await apply(a, 20);
    assert.equal(a.system.armorPoints.value, 0);assert.equal(a.system.attributes.hp.temp, 1);assert.equal(a.system.attributes.hp.value, 30);
    assert.equal(a.flags.explosaoDefensivaPendente, undefined);assert.equal(a.flags.reducaoDano, undefined);
    await apply(a, 6);assert.equal(a.system.attributes.hp.value, 25);
  });
  test(`${route}/${type}: persistent technique reduces each hit without being consumed`, async () => {
    const a = fixture(type, { reducaoDano: { valor: 4, persistente: true } });
    await apply(a, 4);await apply(a, 4);
    assert.equal(a.system.attributes.hp.temp, 5);assert.equal(a.system.armorPoints.value, 2);assert.equal(a.flags.reducaoDano.valor, 4);
  });
}
test("native healing does not consume either pending protection", async () => {
  const a = fixture("character", { explosaoDefensivaPendente: { reducao: 8 }, reducaoDano: { valor: 4 } });
  a.system.attributes.hp.damage = 10;
  await native.call(a, [{ value: -3 }]);
  assert.equal(a.system.attributes.hp.value, 33);assert.equal(a.flags.reducaoDano.valor, 4);assert.equal(a.flags.explosaoDefensivaPendente.reducao, 8);
});
