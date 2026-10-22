import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import Ruleset from "../module/systems/ruleset.mjs";

let version = "2.0";
globalThis.game = { settings: { get: () => version } };
globalThis.CONFIG = { JUJUTSU: {}, DND5E: { defaultAbilities: { hitPoints: "con" }, abilities: { con: { label: "Constituição" } } } };
Math.clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const character = read("module/data/actor/character.mjs"), npc = read("module/data/actor/npc.mjs");
const prepareCharacter = new Function("Ruleset", "actor2", character.match(/const hp2 = this.attributes.hp;([\s\S]*?)\r?\n      let energyMax2/)[0].replace(/\r?\n      let energyMax2$/, ""));
const prepareNpc = new Function("Ruleset", "actor2", npc.match(/const hpN = this.attributes.hp;([\s\S]*?)\r?\n      \/\/ Energia 2.0/)[0].replace(/\r?\n      \/\/ Energia 2.0$/, ""));
function actor(type = "character", maximum = null) {
  version = "2.0";
  const source = { max: type === "npc" ? 777 : maximum, maxOverride: type === "npc" ? maximum : null,
    value: 80, tempmax: 3, temp: 0 };
  const system = { details: { level: 5 }, abilities: { con: { value: 3 } },
    attributes: { hp: { ...source, max: 1, effectiveMax: 1, value: 1 } },
    legacy2: { nd: "5", wounds: { value: 10 } }, _source: { attributes: { hp: source } } };
  return { type, system, itemTypes: {}, items: [], classes: {}, _prepareActiveEffectAttributions: () => [] };
}

test("player maximum override survives 2.0 preparation while wounds and temporary maximum still apply", () => {
  const a = actor("character", 120);
  assert.equal(Ruleset.maxHitPoints(a), 120);
  prepareCharacter.call(a.system, Ruleset, a);
  assert.equal(a.system.attributes.hp.max, 120);
  assert.equal(a.system.attributes.hp.effectiveMax, 118);
  assert.equal(a.system.attributes.hp.value, 80);
  assert.equal(a.system.attributes.hp.damage, 38);
});

test("NPC overrides use the existing manual field and do not mistake legacy maximum HP for a 2.0 override", () => {
  const a = actor("npc", 120);
  assert.equal(Ruleset.maxHitPoints(a), 120);
  prepareNpc.call(a.system, Ruleset, a);
  assert.equal(a.system.attributes.hp.max, 120); assert.equal(a.system.attributes.hp.effectiveMax, 123);
  a.system._source.attributes.hp.maxOverride = null;
  a.system.attributes.hp.maxOverride = null;
  prepareNpc.call(a.system, Ruleset, a);
  assert.equal(a.system.attributes.hp.max, 95); assert.equal(a.system.attributes.hp.effectiveMax, 98);
});

test("blank restores automatic HP, zero is an explicit override and repeated preparation never latches onto derived maximum", () => {
  for (const type of ["character", "npc"]) {
    const a = actor(type, 120), prepare = type === "npc" ? prepareNpc : prepareCharacter;
    assert.equal(Ruleset.maxHitPoints(a, { ignoreOverride: true }), type === "npc" ? 95 : 32);
    const key = type === "npc" ? "maxOverride" : "max";
    a.system._source.attributes.hp[key] = 0;
    if (type === "npc") a.system.attributes.hp.maxOverride = 0;
    prepare.call(a.system, Ruleset, a); assert.equal(a.system.attributes.hp.max, 0);
    for (const value of [null, ""]) {
      a.system._source.attributes.hp[key] = value;
      if (type === "npc") a.system.attributes.hp.maxOverride = value;
      for (let i = 0; i < 3; i++) prepare.call(a.system, Ruleset, a);
      assert.equal(a.system.attributes.hp.max, type === "npc" ? 95 : 32);
    }
  }
});

const configSource = read("module/applications/actor/config/hit-points-config.mjs");
const contextBody = configSource.match(/async _preparePartContext\(partId, context, options\) \{([\s\S]*?)\r?\n  \}/)[1];
class Base {
  async _preparePartContext(_part, context) { return context; }
  async _processSubmitData(_event, _form, data) { await Promise.resolve(); this.persisted = structuredClone(data); return { updated: this.document }; }
}
const submitBody = configSource.match(/_processSubmitData\(event, form, submitData\) \{([\s\S]*?)\r?\n  \}/)[1];
const HealthConfig = new Function("Base", "Ruleset", `return class extends Base {async _preparePartContext(partId,context,options){${contextBody}} _processSubmitData(event,form,submitData){${submitBody}}}`)(Base, Ruleset);

test("the 2.0 health dialog edits the actual override field for each actor and shows the automatic maximum", async () => {
  for (const type of ["character", "npc"]) {
    const a = actor(type, 120);
    a.system.schema = { fields: { attributes: { fields: { hp: { fields: {} } } } } };
    const config = Object.assign(new HealthConfig(), { document: a });
    const context = await config._preparePartContext("config", {}, {});
    assert(context.jj2Health, "2.0 requires a dedicated maximum override context");
    assert.equal(context.jj2Health.maximumPath, type === "npc" ? "system.attributes.hp.maxOverride" : "system.attributes.hp.max");
    assert.equal(context.jj2Health.maximumOverride, 120);
    assert.equal(context.jj2Health.automaticMax, type === "npc" ? 95 : 32);
  }
});

test("saving maximum HP awaits persistence and preserves lost HP when setting or clearing an override", async () => {
  globalThis.foundry = { utils: { deepClone: structuredClone, setProperty(object, path, value) {
    const keys = path.split("."), last = keys.pop();
    for (const key of keys) object = object[key] ??= {};
    object[last] = value;
  } } };
  for (const [type, maximum, wantedMax, wantedValue] of [["character", 150, 150, 110], ["npc", 150, 150, 110], ["npc", null, 95, 55]]) {
    const a = actor(type, 120), prepare = type === "npc" ? prepareNpc : prepareCharacter;
    prepare.call(a.system, Ruleset, a);
    a.clone = updates => {
      const clone = { ...a, system: structuredClone(a.system) };
      Object.assign(clone.system._source.attributes.hp, updates.system.attributes.hp);
      Object.assign(clone.system.attributes.hp, updates.system.attributes.hp);
      prepare.call(clone.system, Ruleset, clone);
      return clone;
    };
    const config = Object.assign(new HealthConfig(), { document: a });
    const data = { system: { attributes: { hp: { [type === "npc" ? "maxOverride" : "max"]: maximum, value: 80 } } } };
    const result = await config._processSubmitData({}, {}, data);
    assert.equal(result?.updated, a);
    assert.equal(config.persisted.system.attributes.hp.value, wantedValue);
    assert.equal(a.clone(config.persisted).system.attributes.hp.max, wantedMax);
  }
});

test("1.0 retains its original health configuration and does not use the 2.0 maximum rule", async () => {
  const a = actor("character", 120);
  a.system.schema = { fields: { attributes: { fields: { hp: { fields: {} } } } } };
  version = "1.0";
  globalThis.formatNumber = String;
  const config = Object.assign(new HealthConfig(), { document: a });
  const context = await config._preparePartContext("config", {}, {});
  assert.equal(context.jj2Health, undefined);
  assert.equal(context.source.max, 120);
  assert.equal(Ruleset.maxHitPoints(a), 32);
});
