import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import Ruleset from "../module/systems/ruleset.mjs";
import { applyNumericResistances } from "../module/systems/legacy2-resistances.mjs";

let version = "2.0";
globalThis.game = { settings: { get: () => version } };
globalThis.CONFIG = { DND5E: { damageTypes: { slashing: { isPhysical: true }, force: {}, fire: {} },
  healingTypes: { healing: {}, temphp: {}, maximum: {} } } };
globalThis.foundry = { utils: { deepClone: structuredClone } };
globalThis.Hooks = { on() {}, call: () => true, callAll() {} };
globalThis.ChatMessage = { create: async () => {}, getSpeaker: () => ({}) };
Number.isNumeric ??= n => typeof n === "number" && Number.isFinite(n);
Math.clamp ??= (n, min, max) => Math.min(max, Math.max(min, n));
const { applyDamageToActor } = await import("../module/applications/actor/jj/damage-application.mjs");
const { absorbShieldDamage } = await import("../module/systems/legacy2-shield.mjs").catch(() => ({}));
const source = readFileSync(new URL("../module/data/actor/character.mjs", import.meta.url), "utf8");
const armorPreparation = new Function("Ruleset", source.match(/    \/\/ Pontos de Armadura \(Foco Defensivo\)[\s\S]*?\r?\n  }/)[0].replace(/\r?\n  }$/, ""));

test("2.0 Foco Múltiplo prepares its twenty shield points without requiring the old manipulation unlock", () => {
  const system = { _source: { armorPoints: { value: 12 } }, armorPoints: { value: 12 },
    parent: { itemTypes: { feat: [{ name: "Custom name", system: { identifier: "foco-multiplo" } }] } } };
  armorPreparation.call(system, Ruleset);
  assert.equal(system.armorPoints.value, 12);
  assert.equal(system.armorPoints.max, 20);
  system.parent.itemTypes.feat = [];
  armorPreparation.call(system, Ruleset);
  assert.equal(system.armorPoints.value, 12, "manual points must survive preparation");
  assert.equal(system.armorPoints.max, 0);
});

const actorSource = readFileSync(new URL("../module/documents/actor/actor.mjs", import.meta.url), "utf8");
const methods = actorSource.slice(actorSource.indexOf("  async applyDamage(damages, options={})"), actorSource.indexOf("  async applyTempHP("));
const NativeActor = new Function("Ruleset", "applyNumericResistances", "absorbShieldDamage", "simplifyBonus",
  `return class { getRollData(){return {}} ${methods} }`)(Ruleset, applyNumericResistances, absorbShieldDamage, Number);
function actor(shield = 20, temp = 0) {
  const a = new NativeActor();
  a.name = "Alvo";
  a.system = { armorPoints: { value: shield }, legacy2: {}, traits: {},
    attributes: { hp: { value: 100, temp, tempmax: 0, damage: 0 } },
    _source: { attributes: { hp: { tempmax: 0 } } } };
  a.getFlag = () => null;
  a.update = async data => {
    for (const [key, value] of Object.entries(data)) {
      const parts = key.split("."), last = parts.pop();
      parts.reduce((obj, part) => obj[part] ??= {}, a)[last] = value;
    }
  };
  return a;
}

for (const route of ["native", "custom"]) {
  const apply = async (a, amount, type = "slashing") => route === "native"
    ? a.applyDamage([{ type, value: amount }]) : applyDamageToActor(a, amount, { damageTypes: [type] });
  test(`${route}: twenty shield points absorb forty damage and overflow reaches life at full value`, async () => {
    version = "2.0";
    for (const [amount, shield, hp] of [[20, 10, 100], [39, 0, 100], [40, 0, 100], [45, 0, 95]]) {
      const a = actor();
      await apply(a, amount);
      assert.equal(a.system.armorPoints.value, shield);
      assert.equal(a.system.attributes.hp.value, hp);
    }
  });
  test(`${route}: all damage types use the shield and it is consumed before temporary life`, async () => {
    version = "2.0";
    const a = actor(20, 3);
    await apply(a, 45, "force");
    assert.equal(a.system.armorPoints.value, 0);
    assert.equal(a.system.attributes.hp.temp, 0);
    assert.equal(a.system.attributes.hp.value, 98);
  });
  test(`${route}: numeric resistance and pending defense apply before shield absorption`, async () => {
    version = "2.0";
    const a = actor();
    a.system.legacy2.resistances = { slashing: { value: 5 } };
    a.getFlag = (scope, key) => key === "explosaoDefensivaPendente" ? { physicalImpulse: true, reducao: 3 } : null;
    await apply(a, 20);
    assert.equal(a.system.armorPoints.value, 14);
    assert.equal(a.system.attributes.hp.value, 100);
  });
}

test("native healing and temporary life grants preserve shield points", async () => {
  version = "2.0";
  const a = actor();a.system.attributes.hp.value = 80;a.system.attributes.hp.damage = 20;
  await a.applyDamage([{ type: "healing", value: 5 }]);
  assert.equal(a.system.attributes.hp.value, 85);
  assert.equal(a.system.armorPoints.value, 20);
  await a.applyDamage([{ type: "temphp", value: 8 }]);
  assert.equal(a.system.attributes.hp.temp, 8);
  assert.equal(a.system.armorPoints.value, 20);
});

test("1.0 keeps the existing native and true damage behavior", async () => {
  version = "1.0";
  const a = actor();await a.applyDamage([{ type: "slashing", value: 10 }]);
  assert.equal(a.system.armorPoints.value, 20);assert.equal(a.system.attributes.hp.value, 90);
  const b = actor();await applyDamageToActor(b, 25, { damageTypes: ["force"] });
  assert.equal(b.system.armorPoints.value, 0);assert.equal(b.system.attributes.hp.value, 95);
  version = "2.0";
});
