import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import Ruleset from "../module/systems/ruleset.mjs";
import { EnergySystem } from "../module/systems/energy.mjs";
let version = "2.0";
globalThis.game = { settings: { get: () => version } };
globalThis.Hooks = { on() {} };
const { resetarUsoReversaNoTurno } = await import("../module/applications/actor/jj/energia-reversa.mjs");
function fixture(level = 1, con = 3) {
  const writes = [];
  const actor = { name: "Renomeado", type: "character", itemTypes: { class: [{ identifier: "restringido", name: "Outro nome" }], race: [] },
    system: { details: { level }, abilities: { con: { value: con } }, energy: { generated: 1, total: 0,
      bonuses: { generatedEnergy: 20 }, intensiveTraining: { generatedEnergy: 20 }, generation: {} } },
    async update(data) { writes.push(data); for (const [key,value] of Object.entries(data)) {
      const parts=key.split('.'),last=parts.pop();parts.reduce((o,k)=>o[k],this)[last]=value;
    } } };
  return { actor, writes };
}
test("Restringido is detected by its class identifier, only in 2.0", () => {
  const { actor }=fixture();assert(Ruleset.isRestringido(actor));
  actor.itemTypes.class[0]={ name:"Restringido", identifier:"lutador" };assert(!Ruleset.isRestringido(actor));
  actor.itemTypes.class[0]={ system:{identifier:"restringido"} };assert(Ruleset.isRestringido(actor));
  version="1.0";assert(!Ruleset.isRestringido(actor));version="2.0";
});
test("stamina is 4 plus prepared Constitution, becoming 8 plus Constitution at level 10", () => {
  for(const [level,con,expected]of [[1,3,7],[9,6,10],[10,6,14],[20,12,20]]){
    const {actor}=fixture(level,con);assert.equal(Ruleset.staminaMax(actor),expected);assert.equal(Ruleset.maxEnergy(actor),0);
  }
});
test("turn recovery resets PE once to its maximum without a reserve or training bonuses", async () => {
  const {actor,writes}=fixture(10,5);await EnergySystem.processTurnStart(actor);
  assert.equal(actor.system.energy.generated,13);assert.equal(actor.system.energy.total,0);assert.equal(writes.length,1);
  actor.system.energy.generated=50;await EnergySystem.processTurnStartWithChoices(actor,{flatBonus:99});
  assert.equal(actor.system.energy.generated,13);
  actor.system.energy.generated=2;await EnergySystem.consumePA(actor,2);assert.equal(actor.system.energy.generated,0);
  actor.system.energy.generated=40;await EnergySystem.processTurnEnd(actor);assert.equal(actor.system.energy.generated,13);
});
test("native turn-start recovers stamina automatically without opening an energy dialog", async () => {
  const source=readFileSync(new URL('../module/documents/combat.mjs',import.meta.url),'utf8');
  const body=source.match(/async _onStartTurn\(combatant\) \{([\s\S]*?)\n  \}/)[1];
  const Combat=new Function('Ruleset','EnergySystem','EnergyGenerationDialog','resetarUsoReversaNoTurno',`return class extends class {async _onStartTurn(){}} {_recoverUses(){} async _onStartTurn(combatant){${body}}}`)(Ruleset,EnergySystem,{configure(){throw new Error('Energy dialog must not open for Restringido');}},resetarUsoReversaNoTurno);
  const {actor}=fixture(9,4);await new Combat()._onStartTurn({actor});assert.equal(actor.system.energy.generated,8);
});
