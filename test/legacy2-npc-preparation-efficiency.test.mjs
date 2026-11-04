import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import Ruleset from "../module/systems/ruleset.mjs";
import * as profiles from "../module/systems/legacy2-npc-profiles.mjs";
import { npcFeatureRollData } from "../module/systems/legacy2-npc-features.mjs";
import { buildNpc2Context } from "../module/applications/actor/jj/legacy2-npc-sheet.mjs";
import { buildLegacy2Context } from "../module/applications/actor/jj/legacy2-sheet.mjs";

let combined = false, version = "2.0";
globalThis.game = { settings: { get: (_scope, key) => key === "rulesetVersion" ? version : combined } };
globalThis.CONFIG = { JUJUTSU: {} };
const config = { abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"]
  .map(key => [key, { label: key, abbreviation: key }])) };

// Exercise the native actor boundary without loading Foundry's browser document classes.
const actorSource = readFileSync(new URL("../module/documents/actor/actor.mjs", import.meta.url), "utf8");
function actorMethod(signature) {
  const start = actorSource.indexOf(`  ${signature} {`);
  assert.notEqual(start, -1);
  return actorSource.slice(start + `  ${signature} {`.length, actorSource.indexOf("\n  }", start));
}
class BaseActor { _clearCachedValues() {} getRollData() { return {}; } }
const NativeActor = new Function("BaseActor", "Ruleset", "npcFeatureRollData", "resetNpcProfilePreparation",
  "ConditionData", "IdentifiedItemsMap", "SourcedItemsMap", `return class extends BaseActor {
    _clearCachedValues() {${actorMethod("_clearCachedValues()")}}
    getRollData(options={}) {${actorMethod("getRollData(options={})")}}
  }`)(BaseActor, Ruleset, npcFeatureRollData, profiles.resetNpcProfilePreparation,
    { hasLevels: () => false }, Map, Map);

function fixture(itemCount = 100) {
  combined = false; version = "2.0";
  const counts = { iterations: 0, visits: 0, orderReads: 0 };
  const order = (original, alternative) => ({
    get original() { counts.orderReads++; return original; },
    get alternative() { counts.orderReads++; return alternative; }
  });
  const owned = [
    { id: "tax", type: "taxonomy", name: "Taxonomia", system: { atributoPrincipal: "str",
      proficiencyOrder: order(["skills.ste", "saves.dex"], ["skills.ste", "alternativeSaves.reflexo"]) } },
    { id: "arch", type: "archetype", name: "Arquétipo", system: { atributoPrincipal: "dex",
      proficiencyOrder: order(["skills.sur", "skills.ste"], ["skills.sur", "skills.ste"]) } },
    ...Array.from({ length: itemCount - 2 }, (_, index) => ({ id: `feat${index}`, type: "feat", system: {} }))
  ];
  const actor = Object.assign(new NativeActor(), { type: "npc", uuid: "Actor.same", name: "NPC", flags: {},
    statuses: new Set(), overrides: { system: { legacy2: { skills: { ste: 2 } } } },
    items: { get size() { return owned.length; }, *[Symbol.iterator]() {
      counts.iterations++; for (const item of owned) { counts.visits++; yield item; }
    } }, itemTypes: { race: [], class: [] },
    system: {
      attributes: { hp: { value: 20, max: 20 }, movement: {} }, energy: {},
      abilities: Object.fromEntries(Object.keys(config.abilities).map(key => [key, { value: 6 }])),
      _source: { legacy2: { skills: { ste: 1 }, saves: { dex: 1 }, alternativeSaves: { reflexo: 1 } } },
      legacy2: { nd: "8", taxonomia: "tax", arquetipo: "arch", skills: { ste: 2 }, saves: { dex: 1 },
        alternativeSaves: { reflexo: 1 }, armas: {}, pontos: {} },
      getRollData() { return { liveDex: this.abilities.dex.value }; }
    } });
  return { actor, counts, owned, reset() { for (const key of Object.keys(counts)) counts[key] = 0; } };
}

test("native actor preparation resolves profile items once for one hundred live roll data requests", () => {
  const { actor, counts } = fixture();
  actor._clearCachedValues();
  const first = actor.getRollData();
  for (let request = 1; request < 100; request++) assert.equal(actor.getRollData().npcPrincipal, 6);
  assert.equal(counts.visits, 100);
  assert.equal(counts.iterations, 1);
  assert.equal(first.npcDamageDice, "1d12");
  actor.system.abilities.dex.value = 10;
  actor.system.legacy2.nd = "20";
  actor.statuses.add("poisoned");
  const changed = actor.getRollData({ roll: true });
  assert.notEqual(changed, first);
  assert.equal(changed.liveDex, 10);
  assert.equal(changed.npcPrincipal, 10);
  assert.equal(changed.npcDamageDice, "4d8");
  assert.deepEqual(changed.statuses, { poisoned: 1 });
  assert.deepEqual(changed.roll, {});
});

test("profile preparation follows live references, profile edits, inventory replacement and independent synthetic actors", () => {
  const { actor, owned, counts } = fixture();
  const token = fixture().actor;
  actor._clearCachedValues(); token._clearCachedValues();
  assert.equal(Ruleset.npcPrincipal(actor), "dex");
  owned[1].system = { atributoPrincipal: "wis" };
  owned[1].name = "Revisado";
  assert.equal(Ruleset.npcPrincipal(actor), "wis");
  assert.equal(profiles.npcProfile(actor, "archetype").label, "Revisado");
  assert.equal(Ruleset.npcPrincipal(token), "dex");
  owned.push({ id: "other", type: "archetype", name: "Outro", system: { atributoPrincipal: "cha" } });
  actor.system.legacy2.arquetipo = "other";
  assert.equal(Ruleset.npcPrincipal(actor), "cha");
  actor.system.legacy2.arquetipo = "arch";
  assert.equal(Ruleset.npcPrincipal(actor), "wis");
  owned.splice(0, owned.length, { id: "replacement", type: "taxonomy", name: "Nova", system: { atributoPrincipal: "con" } },
    ...Array.from({ length: 100 }, (_, index) => ({ id: `replacement${index}`, type: "feat", system: {} })));
  actor._clearCachedValues();
  assert.equal(Ruleset.npcPrincipal(actor), "con");
  assert.equal(counts.iterations, 3);
  version = "1.0";
  actor._clearCachedValues();
  assert.equal(actor.getRollData().npcPrincipal, undefined);
  version = "2.0";
  actor._clearCachedValues();
  assert.equal(actor.getRollData().npcPrincipal, 6);
});

test("NPC contexts distribute ND proficiency once while retaining manual and effect ranks in both save modes", () => {
  const { actor, counts, reset } = fixture();
  for (const alternative of [false, true]) {
    combined = alternative; reset();
    const data = buildNpc2Context(actor, config, Ruleset);
    assert.equal(counts.orderReads, 2, `one distribution, alternative=${alternative}`);
    const stealth = data.skills.find(skill => skill.key === "ste");
    const survival = data.skills.find(skill => skill.key === "sur");
    const save = data.saves.find(save => save.key === (alternative ? "reflexo" : "dex"));
    assert.deepEqual([stealth.rank, stealth.grantedRank, stealth.total], [4, 4, 9]);
    assert.deepEqual([survival.rank, survival.grantedRank, survival.total], [2, 2, 7]);
    assert.deepEqual([save.rank, save.grantedRank, save.total], [3, 2, 8]);
    assert.equal(data.npc.proficiency.budget, 7);
  }
});

test("new shared contexts recalculate ND, priorities, manual ranks, effects and ruleset without persistent distribution cache", () => {
  const { actor, counts, owned, reset } = fixture();
  assert.equal(buildLegacy2Context(actor, config, Ruleset).skills.find(skill => skill.key === "sur").rank, 2);
  reset();
  actor.system.legacy2.nd = "3";
  actor.system.legacy2.proficiencyOrder = { original: ["skills.sur"] };
  actor.system.legacy2.skills.sur = 1;
  actor.system._source.legacy2.skills.sur = 1;
  let data = buildNpc2Context(actor, config, Ruleset);
  assert.equal(counts.orderReads, 2);
  assert.deepEqual(data.skills.filter(skill => ["ste", "sur"].includes(skill.key)).map(skill =>
    [skill.key, skill.rank, skill.grantedRank]), [["ste", 2, 1], ["sur", 3, 2]]);
  actor.system.legacy2.proficiencyOrder.original = null;
  owned[0].system.proficiencyOrder = { original: ["saves.con"] };
  owned[1].system.proficiencyOrder = { original: [] };
  actor.system.legacy2.skills.ste = 3;
  actor.overrides.system.legacy2.skills.ste = 3;
  data = buildNpc2Context(actor, config, Ruleset);
  assert.deepEqual(data.skills.find(skill => skill.key === "ste").grantedRank, 2);
  assert.deepEqual([data.saves.find(save => save.key === "con").rank, data.npc.proficiency.budget], [2, 2]);
  version = "1.0";
  data = buildLegacy2Context(actor, config, Ruleset);
  assert.equal(data.saves.find(save => save.key === "con").rank, 0);
});

test("failed NPC context assembly releases its distribution before another render or synthetic actor", () => {
  const { actor } = fixture();
  const token = fixture().actor;
  const failingRules = Object.create(Ruleset);
  failingRules.rankLabel = () => { throw new Error("render interrupted"); };
  assert.throws(() => buildNpc2Context(actor, config, failingRules), /render interrupted/);
  actor.system.legacy2.nd = "2";
  assert.equal(buildNpc2Context(actor, config, Ruleset).skills.find(skill => skill.key === "sur").rank, 0);
  assert.equal(buildNpc2Context(token, config, Ruleset).skills.find(skill => skill.key === "sur").rank, 2);
});
