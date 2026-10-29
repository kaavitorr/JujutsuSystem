import assert from "node:assert/strict";
import { test } from "node:test";
import Ruleset from "../module/systems/ruleset.mjs";
globalThis.game = { settings: { get: () => "2.0" } };
const helper = await import("../module/applications/dice/legacy2-test-roll.mjs").catch(() => ({}));
const actor = { name: "Teste", documentName: "Actor", system: { abilities: { dex: { value: 5 }, str: { value: 8 } } } };
function process() { return { subject: actor, ability: "dex", skill: "acr", legacy2: {}, rolls: [] }; }
function initiative() { return { subject: actor, hookNames: ["initiativeDialog", "abilityCheck", "d20Test"],
  rolls: [{ parts: ["@mod", "@ruleBonus"], data: { mod: 5, ruleBonus: 3 }, options: { advantage: true } }] }; }
test("each advantage contributes +1 and each disadvantage -1, with cancellation and the existing cap", () => {
  for (const [advantages, disadvantages, expected] of [[0,0,0],[1,0,1],[0,1,-1],[3,1,2],[1,3,-2],[6,0,6],[0,6,-6],[9.8,2.5,4]])
    assert.equal(Ruleset.netAdvantageBonus(advantages, disadvantages), expected);
  assert.equal(Ruleset.advantagePart({vantagens:1,desvantagens:2,grausFlanqueamento:3}),2);
});
test("initiative without an ability selector uses numeric counters and preserves prepared bonuses", () => {
  const p = initiative();
  assert(helper.hasLegacy2Test(p));
  assert.deepEqual(helper.testRollChoices(p), { vantagens: 1, desvantagens: 0 });
  const roll = structuredClone(p.rolls[0]);
  helper.applyLegacy2TestRoll(roll, p, new Map([["jj2Test.vantagens", "2"], ["jj2Test.desvantagens", "6"]]));
  assert.equal(roll.data.legacyAdv, -4);
  assert.equal(roll.data.mod, 5);
  assert.equal(roll.data.ruleBonus, 3);
  assert.equal(roll.options.advantageMode, 0);
  assert.equal(roll.options.advantage, false);
  const breakdown = helper.testRollBreakdown(p, roll);
  assert.equal(breakdown.attributeLabel, "Iniciativa");
  assert.equal(breakdown.abilityValue, 5);
  assert.deepEqual(breakdown.extras, [{ label: "Efeitos", value: "+3" }]);
  game.settings.get = () => "1.0";
  assert(!helper.hasLegacy2Test(p));
  game.settings.get = () => "2.0";
});
test("test counters independently cap at six and preserve automatic advantage defaults", () => {
  assert.equal(typeof helper.testRollChoices, "function");
  assert.deepEqual(helper.testRollChoices({ legacy2: { vantagens: 9.8, desvantagens: 2.5 } }), { vantagens: 6, desvantagens: 2 });
  assert.deepEqual(helper.testRollChoices({ advantage: true, disadvantage: true }), { vantagens: 1, desvantagens: 1 });
  assert.deepEqual(helper.testRollChoices({ legacy2: { vantagens: NaN, desvantagens: -8 } }), { vantagens: 0, desvantagens: 0 });
});
test("six advantages are +6 on one d20 and replace existing advantage parts exactly once", () => {
  assert.equal(typeof helper.applyLegacy2TestRoll, "function");
  const p = process(), roll = { parts: ["@mod", "@legacyRank", "@legacyAdv", "@legacyAdv", "@ruleBonus"], data: { mod: 5, legacyRank: -4, legacyAdv: 2, ruleBonus: 3 }, options: { advantageMode: 1, advantage: true } };
  helper.applyLegacy2TestRoll(roll, p, new Map([["jj2Test.vantagens", "6"],["jj2Test.desvantagens","0"]]));
  assert.equal(roll.data.legacyAdv, 6);
  assert.equal(roll.parts.filter(p=>p==="@legacyAdv").length, 1);
  assert.equal(roll.options.advantageMode, 0);
  assert.equal(roll.options.advantage, false);
  assert.equal(roll.data.ruleBonus, 3);
  assert.deepEqual(p.legacy2, { vantagens: 6, desvantagens: 0 });
});
test("opposing counts cancel and remove stale bonuses without removing conditions or situational bonuses", () => {
  assert.equal(typeof helper.applyLegacy2TestRoll, "function");
  const p = process(), roll = { parts: ["@mod", "@legacyAdv", "@situational", "@exhaustion"], data: { mod:5, legacyAdv:8, situational:"1d4", exhaustion:-2 }, options:{} };
  helper.applyLegacy2TestRoll(roll,p,new Map([["jj2Test.vantagens","3"],["jj2Test.desvantagens","3"]]));
  assert(!roll.parts.includes("@legacyAdv"));assert(roll.parts.includes("@situational"));assert(roll.parts.includes("@exhaustion"));
  assert.equal(roll.data.situational,"1d4");assert.equal(roll.data.legacyAdv,0);
});
test("breakdown uses the actual prepared attribute, rank, and additional formula terms", () => {
  assert.equal(typeof helper.testRollBreakdown,"function");
  const roll = { data: { abilityId:"str",mod:8,legacyRank:2,ruleBonus:3,situational:"1d4" }, parts: ["@mod","@legacyRank","@ruleBonus","@situational","@legacyAdv"] };
  const result = helper.testRollBreakdown(process(),roll);
  assert.equal(result.abilityValue,8);assert.equal(result.ability,"str");assert.equal(result.rankValue,2);assert.equal(result.situational,"1d4");
  assert.deepEqual(result.extras.map(e=>e.value),["+3"]);
});
test("attack activities and V1 rolls remain outside the attribute-test pipeline", () => {
  assert.equal(typeof helper.hasLegacy2Test,"function");
  assert(helper.hasLegacy2Test(process()));
  assert(!helper.hasLegacy2Test({subject:{item:{actor}},ability:"dex"}));
  game.settings.get=()=>"1.0";assert(!helper.hasLegacy2Test(process()));game.settings.get=()=>"2.0";
});
