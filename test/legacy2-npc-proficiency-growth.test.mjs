import assert from "node:assert/strict";
import { test } from "node:test";
import Ruleset from "../module/systems/ruleset.mjs";
import * as profiles from "../module/systems/legacy2-npc-profiles.mjs";
import { buildNpc2Context } from "../module/applications/actor/jj/legacy2-npc-sheet.mjs";
import { prepareRankUpdate } from "../module/applications/actor/jj/legacy2-sheet.mjs";

let combined = false, version = "2.0";
globalThis.game = { settings: { get: (_scope, key) => key === "rulesetVersion" ? version : combined } };
globalThis.CONFIG = { JUJUTSU: {} };
const abilities = Object.fromEntries(profiles.NPC_ABILITIES.map(key => [key, { label: key, abbreviation: key }]));
function npc(nd = 1) {
  version = "2.0"; combined = false;
  return { type: "npc", items: [
    { type: "taxonomy", id: "tax", name: "Taxonomia", system: { proficiencyOrder: {
      original: ["skills.ste", "saves.dex"], alternative: ["skills.ste", "alternativeSaves.reflexo"] } } },
    { type: "archetype", id: "arch", name: "Assassino", system: { proficiencyOrder: {
      original: ["skills.sur", "skills.ste"], alternative: ["skills.sur", "skills.ste"] } } }
  ], system: { attributes: { hp: { value: 20, max: 20 }, movement: {} }, energy: {},
    abilities: Object.fromEntries(profiles.NPC_ABILITIES.map(key => [key, { value: 6 }])),
    legacy2: { nd: String(nd), skills: {}, saves: {}, alternativeSaves: {}, armas: {}, pontos: {} } } };
}

test("one proficiency step per ND increase follows the merged priority order in a round robin", () => {
  const actor = npc(5);
  assert.equal(Ruleset.skillRank(actor, "ste"), 2);
  assert.equal(Ruleset.skillRank(actor, "sur"), 1);
  assert.equal(Ruleset.saveRank(actor, "dex"), 1);
  actor.system.legacy2.nd = "1";
  assert.equal(Ruleset.skillRank(actor, "ste"), 0);
  actor.system.legacy2.nd = "2";
  assert.equal(Ruleset.skillRank(actor, "ste"), 1);
});

test("direct creation at high ND and repeated rendering derive the same allocation without changing saved ranks", () => {
  const actor = npc(9), before = structuredClone(actor);
  for (let i = 0; i < 3; i++) {
    const context = buildNpc2Context(actor, { abilities }, Ruleset);
    assert.equal(context.npc.proficiency.budget, 8);
    assert.deepEqual(context.npc.proficiency.entries.map(entry => entry.id), ["skills.ste", "skills.sur", "saves.dex"]);
    assert.equal(context.skills.find(skill => skill.key === "ste").rank, 3);
    assert.equal(context.skills.find(skill => skill.key === "sur").rank, 3);
    assert.equal(context.saves.find(save => save.key === "dex").rank, 2);
  }
  assert.deepEqual(actor, before);
  actor.system.legacy2.nd = "3";
  assert.equal(Ruleset.skillRank(actor, "ste"), 1);
  assert.equal(Ruleset.skillRank(actor, "sur"), 1);
  assert.equal(Ruleset.saveRank(actor, "dex"), 0);
});

test("the NPC's final order overrides suggestions, ignores duplicates and leaves excess growth unspent at Master", () => {
  const actor = npc(12);
  actor.system.legacy2.proficiencyOrder = { original: ["skills.sur", "skills.sur", "bogus", "skills.ste"] };
  assert.equal(Ruleset.skillRank(actor, "sur"), 4);
  assert.equal(Ruleset.skillRank(actor, "ste"), 4);
  assert.equal(Ruleset.saveRank(actor, "dex"), 0);
  const distribution = profiles.npcProficiencyDistribution(actor);
  assert.equal(distribution.budget, 11);
  assert.equal(distribution.allocated, 8);
  assert.equal(distribution.unspent, 3);
  actor.system.legacy2.proficiencyOrder.original = [];
  assert.equal(Ruleset.skillRank(actor, "ste"), 0);
});

test("original and alternative save priority lists remain separate and chat/save rolls use the active allocation", () => {
  const actor = npc(4);
  actor.system.legacy2.proficiencyOrder = { alternative: ["alternativeSaves.vontade", "skills.ste"] };
  combined = true;
  assert.equal(Ruleset.alternativeSave(actor, "vontade").rank, 2);
  assert.equal(Ruleset.saveRank(actor, "con"), 2);
  assert.equal(Ruleset.saveRank(actor, "cha"), 2);
  assert.equal(Ruleset.skillRank(actor, "ste"), 1);
  combined = false;
  assert.equal(Ruleset.saveRank(actor, "dex"), 1);
  assert.equal(Ruleset.saveRank(actor, "con"), 0);
});

test("manual sheet points remain independent of growth and survive order and ND changes", () => {
  const actor = npc(5);
  actor.system.legacy2.skills.ste = 1;
  assert.equal(Ruleset.skillRank(actor, "ste"), 3);
  const result = prepareRankUpdate(actor, "skills", "ste", 4, Ruleset, abilities);
  assert.equal(result.update["system.legacy2.skills"].ste, 2);
  actor.system.legacy2.skills = result.update["system.legacy2.skills"];
  actor.system.legacy2.nd = "2";
  assert.equal(Ruleset.skillRank(actor, "ste"), 3);
  actor.system.legacy2.proficiencyOrder = { original: ["skills.sur"] };
  assert.equal(Ruleset.skillRank(actor, "ste"), 2);
  version = "1.0";
  assert.equal(Ruleset.skillRank(actor, "ste"), 2);
});

test("legacy profile selections become priority suggestions instead of granting immediate ranks", () => {
  const actor = npc(1);
  actor.items = [{ type: "archetype", id: "arch", name: "Assassino", system: {
    proficiencias: { skills: { ste: 3, sur: 1 }, saves: { dex: 2 } } } }];
  assert.equal(Ruleset.skillRank(actor, "ste"), 0);
  actor.system.legacy2.nd = "4";
  assert.equal(Ruleset.skillRank(actor, "ste"), 1);
  assert.equal(Ruleset.saveRank(actor, "dex"), 1);
  assert.equal(Ruleset.skillRank(actor, "sur"), 1);
});
