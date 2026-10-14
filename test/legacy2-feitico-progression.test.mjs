import assert from "node:assert/strict";
import { test } from "node:test";
globalThis.game = { settings: { get: () => "2.0" } };
const helper = await import("../module/applications/actor/jj/legacy2-feitico.mjs").catch(() => ({}));
function actor(level, learned = [], items = []) {
  return { system: { details: { level }, masteryLevel: 99 }, items,
    getFlag: (scope, key) => key === "especializacoes" ? learned : undefined };
}
test("Feitiço progression follows character levels 1, 4 and 8 independently of mastery", () => {
  assert.equal(typeof helper.feiticoProgression2, "function");
  for (const [level, expected] of [[1,"basico"],[3,"basico"],[4,"estendido"],[7,"estendido"],[8,"maximo"],[9,"maximo"]]) {
    const result = helper.feiticoProgression2(actor(level));
    assert.equal(result.proficiencia.id, expected);
    assert.equal(result.nivel, level);
  }
});
test("level alone never unlocks domain milestones", () => {
  assert.equal(typeof helper.feiticoProgression2, "function");
  const result = helper.feiticoProgression2(actor(20));
  assert.equal(result.proficiencia.id, "maximo");
  assert.deepEqual(result.tiers.map(t => t.mainReq), [1,4,8,10,16]);
  assert.equal(result.tiers.find(t => t.id === "expansao").reqMet, false);
  assert.match(result.tiers.find(t => t.id === "expansao").requirementText, /Expansão de Domínio/);
});
test("learned domain specializations require the corresponding character level", () => {
  assert.equal(typeof helper.feiticoProgression2, "function");
  assert.equal(helper.feiticoProgression2(actor(9,["Expansão de Domínio"])).proficiencia.id,"maximo");
  assert.equal(helper.feiticoProgression2(actor(10,["Expansão de Domínio"])).proficiencia.id,"expansao");
  assert.equal(helper.feiticoProgression2(actor(16,["Expansão de Domínio"])).proficiencia.id,"expansao");
  assert.equal(helper.feiticoProgression2(actor(15,["Expansão de Domínio","Expansão sem Barreiras"])).proficiencia.id,"expansao");
  assert.equal(helper.feiticoProgression2(actor(16,["Expansão de Domínio","Expansão sem Barreiras"])).proficiencia.id,"semBarreiras");
});
test("owned compendium feats grant domain capability, but a spell with the same name does not", () => {
  assert.equal(typeof helper.feiticoProgression2, "function");
  const feat = { type: "feat", name: "Expansão de Domínio", system: { identifier: "expansao-de-dominio" } };
  assert.equal(helper.feiticoProgression2(actor(10,[],[feat])).proficiencia.id,"expansao");
  assert.equal(helper.feiticoProgression2(actor(10,[],[{...feat,type:"spell"}])).proficiencia.id,"maximo");
});
