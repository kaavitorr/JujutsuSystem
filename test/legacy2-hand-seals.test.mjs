import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import * as YAML from "js-yaml";
import { selosMax } from "../module/applications/activity/legacy2-activation.mjs";
import { HAND_SEALS_DESCRIPTION, handSealProgressUpdates, handSealsRestUpdates } from "../module/systems/legacy2-hand-seals.mjs";
import { specializationDocuments } from "../utils/especializacoes-2-0.mjs";

export function sealFeat(name = "Selos de Mão") {
  return { type: "feat", name, system: { identifier: name === "Selos de Mão" ? "selos-de-mao" : "" },
    flags: { "jujutsu-system": { especializacao: { caminho: "Selos e Encantamentos" } } },
    getFlag(scope, key) { return this.flags[scope]?.[key]; } };
}
const actor = (names = ["Selos de Mão"], bonus = 0) => ({ items: names.map(sealFeat), flags: { "jujutsu-system": { selosBonus: bonus } } });

test("Selos de Mão starts with eight uses and grows once per additional learned ability", () => {
  assert.equal(selosMax(actor()), 8);
  assert.equal(selosMax(actor(["Selos de Mão", "Selos Complexos"])), 9);
  assert.equal(selosMax(actor(["Selos de Mão", "Selos Complexos", "Encantamentos"])), 10);
  assert.equal(selosMax(actor(["Selos de Mão", "Selos Complexos", "Selos Complexos"])), 9);
});
test("hand seals require the base feature and retain configured positive and negative bonuses", () => {
  assert.equal(selosMax(actor([])), 0);
  assert.equal(selosMax(actor(["Encantamentos"])), 0);
  assert.equal(selosMax(actor(undefined, 6)), 14);
  assert.equal(selosMax(actor(undefined, -3)), 5);
  assert.equal(selosMax(actor(undefined, -30)), 0);
});
function apply(actor, updates) {
  for (const [path, value] of Object.entries(updates)) {
    const parts = path.split("."), key = parts.pop(); let target = actor;
    for (const part of parts) target = target[part] ??= {};
    target[key] = structuredClone(value);
  }
}
test("upgrading three to eight preserves spent uses and never grants the five extra uses twice", () => {
  const a = actor(); a.flags["jujutsu-system"].selos = 1;
  const updates = handSealProgressUpdates(a); assert.equal(updates["flags.jujutsu-system.selos"], 6);
  apply(a, updates); assert.deepEqual(handSealProgressUpdates(a), {});
  a.flags["jujutsu-system"].selos = 0; assert.deepEqual(handSealProgressUpdates(a), {});
});
test("learning grants eight initially and only one for a new distinct path ability", () => {
  const a = actor(); apply(a, handSealProgressUpdates(a, { learnedBase: true }));
  assert.equal(a.flags["jujutsu-system"].selos, 8); a.flags["jujutsu-system"].selos = 2;
  a.items.push(sealFeat("Selos Complexos")); apply(a, handSealProgressUpdates(a));
  assert.equal(a.flags["jujutsu-system"].selos, 3);
  a.items.push(sealFeat("Selos Complexos")); assert.deepEqual(handSealProgressUpdates(a), {});
});
test("both actor types recover the exact current capacity, including configured bonuses", () => {
  for (const type of ["character", "npc"]) {
    const a = actor(["Selos de Mão", "Selos Complexos", "Encantamentos"], -3); a.type = type;
    a.flags["jujutsu-system"].selos = 0; const updates = handSealsRestUpdates(a);
    assert.equal(updates["flags.jujutsu-system.selos"], 7); apply(a, updates);
    assert.deepEqual(handSealProgressUpdates(a), {});
  }
});
test("the shipped feat and generator contain the eight-use rule with the same stable identity", () => {
  const source = YAML.load(readFileSync(new URL("../packs/_source/geral-2-0/jj2a000000000002.yml", import.meta.url), "utf8"));
  const generated = specializationDocuments.find(item => item.name === "Selos de Mão");
  for (const item of [source, generated]) {
    assert.equal(item._id, "jj2a000000000002"); assert(item.system.description.value.includes(HAND_SEALS_DESCRIPTION));
    assert.equal(item.flags["jujutsu-system"].handSealsRulesVersion, 1);
  }
});
test("forgetting and relearning an ability cannot restore spent seals", () => {
  const a = actor(["Selos de Mão", "Selos Complexos"]); apply(a, handSealProgressUpdates(a, { learnedBase: true }));
  a.flags["jujutsu-system"].selos = 0; const extra = a.items.pop(); apply(a, handSealProgressUpdates(a));
  a.items.push(extra); apply(a, handSealProgressUpdates(a)); assert.equal(a.flags["jujutsu-system"].selos, 0);
  const base = a.items.shift(); apply(a, handSealProgressUpdates(a));
  a.items.unshift(base); apply(a, handSealProgressUpdates(a, { learnedBase: true })); assert.equal(a.flags["jujutsu-system"].selos, 0);
});
