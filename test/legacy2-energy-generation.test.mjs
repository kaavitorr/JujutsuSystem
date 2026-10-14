import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { EnergySystem } from "../module/systems/energy.mjs";
import Ruleset from "../module/systems/ruleset.mjs";

let version = "2.0";
globalThis.game = { settings: { get: () => version } };
function fixture({ generated = 0, total = 100, base = 4 } = {}) {
  const writes = [];
  const actor = { name: "Feiticeiro", system: { details: { level: 5 }, energy: {
    total, generated, generation: { baseMultiplier: base, turnMultiplier: 3, bonusFlat: 0 },
    bonuses: { generatedEnergy: 0 }, intensiveTraining: { generatedEnergy: 2 }
  }, energyAbilities: { accumulation: { enabled: true, uses: 3, max: 3 }, liberation: { enabled: true, uses: 1 } } },
  async update(data) { writes.push(data); for (const [path, value] of Object.entries(data)) {
    const keys = path.split('.'), key = keys.pop(); keys.reduce((obj, part) => obj[part], this)[key] = value;
  } } };
  return { actor, writes };
}

test("2.0 ignores old multipliers and accumulation/liberation choices but applies additional PA", async () => {
  version = "2.0";
  const { actor, writes } = fixture();
  await EnergySystem.processTurnStartWithChoices(actor, { baseMultiplier: 4, useAccumulation: true, useLiberation: true, flatBonus: 7 });
  assert.equal(actor.system.energy.generated, 19);
  assert.equal(actor.system.energy.total, 81);
  assert.equal(actor.system.energyAbilities.accumulation.uses, 3);
  assert.equal(actor.system.energyAbilities.liberation.uses, 1);
  assert.equal(writes.length, 1);
});

test("automatic 2.0 generation uses the normal limit and turn-end preserves already refined energy", async () => {
  version = "2.0";
  const { actor } = fixture();
  await EnergySystem.processTurnStart(actor);
  assert.equal(actor.system.energy.generated, 12);
  actor.system.energy.generated = 30;
  await EnergySystem.processTurnEnd(actor);
  assert.equal(actor.system.energy.generated, 30);
});

test("additional PA can exceed refinement but cannot exceed the available reserve", async () => {
  version = "2.0";
  const { actor } = fixture({ generated: 12, total: 5 });
  await EnergySystem.processTurnStartWithChoices(actor, { flatBonus: 9 });
  assert.equal(actor.system.energy.generated, 17);
  assert.equal(actor.system.energy.total, 0);
  const empty = fixture({ generated: 12 });
  await EnergySystem.processTurnStartWithChoices(empty.actor, { flatBonus: 0 });
  assert.equal(empty.writes.length, 0);
});

test("1.0 retains its multipliers, accumulation and liberation uses", async () => {
  version = "1.0";
  const { actor, writes } = fixture();
  await EnergySystem.processTurnStartWithChoices(actor, { baseMultiplier: 4, useAccumulation: true, useLiberation: true });
  assert.equal(actor.system.energy.generated, 17);
  assert.equal(actor.system.energyAbilities.accumulation.uses, 2);
  assert.equal(actor.system.energyAbilities.liberation.uses, 0);
  assert.equal(writes.length, 3);
  actor.system.energy.generated = 40;
  await EnergySystem.processTurnEnd(actor);
  assert.equal(actor.system.energy.generated, 22);
});

test("the real generation dialog hides old choices only in 2.0 and matches the combat limit", async () => {
  const source = readFileSync(new URL("../module/applications/actor/energy-generation-dialog.mjs", import.meta.url), "utf8");
  const body = source.match(/async _prepareContext\(options\) \{([\s\S]*?)\n  \}/)[1];
  const Dialog = new Function("Ruleset", "EnergySystem", `return class extends class { async _prepareContext() { return {}; } } { async _prepareContext(options) {${body}} }`)(Ruleset, EnergySystem);
  for (const v2 of [true, false]) {
    version = v2 ? "2.0" : "1.0";
    const dialog = new Dialog(); dialog.actor = fixture({ base: 3 }).actor;
    const context = await dialog._prepareContext({});
    assert.equal(context.baseMultiplier, v2 ? 2 : 3);
    assert.equal(context.limite, v2 ? 12 : 17);
    assert.equal(context.hasAccumulation, !v2);
    assert.equal(context.hasLiberation, !v2);
  }
});
