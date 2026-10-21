import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import Ruleset from "../module/systems/ruleset.mjs";
import { npcProfile, npcNd } from "../module/systems/legacy2-npc-profiles.mjs";
import { NUMERIC_DAMAGE_TYPES } from "../module/systems/legacy2-resistances.mjs";
import { prepareNpcClassificationActions } from "../module/systems/legacy2-npc-classification.mjs";
globalThis.game={settings:{get:()=>"2.0"}};
globalThis.CONFIG={JUJUTSU:{},DND5E:{skillPassive:{base:10}}};
Math.clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const source=readFileSync(new URL("../module/data/actor/npc.mjs",import.meta.url),"utf8");
const native=source.match(/const actor2 = this\.parent;([\s\S]*?)\r?\n    \}\r?\n\r?\n    \/\/ Legendary Actions/)[1];
const prepare=new Function("Ruleset","npcProfile","prepareNpcClassificationActions","npcNd","NUMERIC_DAMAGE_TYPES",`const actor2=this.parent;${native}`);
test("NPC maximum life ignores legacy wounds while preserving temporary adjustments and saved HP",()=>{
  const system={legacy2:{nd:"5",wounds:{value:30}},abilities:{str:{value:3},dex:{value:4},con:{value:6},int:{value:2}},energy:{max:100},attributes:{hp:{max:10,tempmax:3,value:10},hd:{},ac:{},init:{}},_source:{attributes:{hp:{value:40}},legacy2:{actions:{max:6}}}};
  system.parent={type:"npc",items:[],itemTypes:{class:[]},system};
  prepare.call(system,Ruleset,npcProfile,prepareNpcClassificationActions,npcNd,NUMERIC_DAMAGE_TYPES);
  assert.equal(system.attributes.hp.max,140);assert.equal(system.attributes.hp.effectiveMax,143);assert.equal(system.attributes.hp.value,40);
  assert.equal(system.legacy2.wounds.value,30);
  system.legacy2.categoria="elite";
  // A troca de categoria persiste o novo teto na fonte e a preparação reconstrói o máximo.
  system.legacy2.actions.max=8;system._source.legacy2.actions.max=8;
  prepare.call(system,Ruleset,npcProfile,prepareNpcClassificationActions,npcNd,NUMERIC_DAMAGE_TYPES);
  assert.equal(system.attributes.hp.max,210);assert.equal(system.attributes.hp.effectiveMax,213);
  assert.equal(system.legacy2.actions.max,8);
});
test("long rests ignore wounds on NPCs while player rest healing still reduces wounds",()=>{
  const source=readFileSync(new URL("../module/documents/actor/actor.mjs",import.meta.url),"utf8");
  const body=source.slice(source.indexOf('const hp = this.system.attributes.hp;',source.indexOf('// ── Jujutsu Legacy 2.0: descansos próprios')),source.indexOf('// Selos de Mão (2.0): recupera todos os usos'));
  const rest=new Function("config","result",body);
  globalThis.foundry={utils:{getProperty:actor=>actor.system.attributes.hp.value}};
  const actor={type:"npc",system:{legacy2:{wounds:{value:30}},energy:{max:100,total:10},attributes:{hp:{max:140,effectiveMax:143,tempmax:3,value:10}}}};
  const npc={updateData:{},deltas:{}};rest.call(actor,{type:"long"},npc);
  assert.equal(npc.updateData["system.attributes.hp.value"],143);assert.equal(npc.updateData["system.legacy2.wounds.value"],undefined);
  const player={updateData:{},deltas:{}};rest.call({...actor,type:"character"},{type:"long"},player);
  assert.equal(player.updateData["system.legacy2.wounds.value"],24);assert.equal(player.updateData["system.attributes.hp.value"],131);
});
