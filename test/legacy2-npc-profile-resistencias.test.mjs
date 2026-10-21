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

const tipos=Object.fromEntries(NUMERIC_DAMAGE_TYPES.map(({key})=>[key,{value:0,immune:false}]));
const perfilItem=(type,nome,resistencias={})=>({id:`${type}-1`,type,name:nome,
  system:{pesos:{str:2,dex:2,con:2,int:2,wis:2,cha:2},
    resistencias:Object.fromEntries(NUMERIC_DAMAGE_TYPES.map(({key})=>[key,resistencias[key]??{value:0,immune:false}]))}});

function npcFixture({nd="5",baseFire=0,items=[]}={}){
  const resistances=structuredClone(tipos);resistances.fire.value=baseFire;
  const system={legacy2:{nd,resistances},abilities:{str:{value:3},dex:{value:4},con:{value:6},int:{value:2},wis:{value:2},cha:{value:2}},
    energy:{max:100},attributes:{hp:{max:100,tempmax:0,value:50},hd:{},ac:{},init:{}},
    _source:{attributes:{hp:{value:50}},legacy2:{resistances:structuredClone(resistances)}}};
  system.parent={type:"npc",items,itemTypes:{class:[]},system};
  return system;
}
const valor=(system,key)=>system.legacy2.resistances[key].value;
const imune=(system,key)=>system.legacy2.resistances[key].immune;

test("profiles without resistance definitions leave the NPC's own values untouched",()=>{
  const system=npcFixture({baseFire:2,items:[perfilItem("taxonomy","Fera"),perfilItem("archetype","Bruto")]});
  prepare.call(system,Ruleset,npcProfile,prepareNpcClassificationActions,npcNd,NUMERIC_DAMAGE_TYPES);
  assert.equal(valor(system,"fire"),2);assert.equal(imune(system,"fire"),false);
});

test("taxonomy applies flat resistance and vulnerability from the signed value",()=>{
  const items=[perfilItem("taxonomy","Fera",{fire:{value:2},poison:{value:-3}})];
  const system=npcFixture({baseFire:1,items});
  prepare.call(system,Ruleset,npcProfile,prepareNpcClassificationActions,npcNd,NUMERIC_DAMAGE_TYPES);
  assert.equal(valor(system,"fire"),3); // base 1 + 2 fixos
  assert.equal(valor(system,"poison"),-3); // vulnerabilidade fixa
});

test("archetype scales positive values by ND and keeps negative ones flat",()=>{
  const items=[perfilItem("archetype","Bruto",{slashing:{value:2},fire:{value:-3}})];
  const system=npcFixture({nd:"5",baseFire:0,items});
  prepare.call(system,Ruleset,npcProfile,prepareNpcClassificationActions,npcNd,NUMERIC_DAMAGE_TYPES);
  assert.equal(valor(system,"slashing"),10); // 2 × ND 5 (resistência por ND)
  assert.equal(valor(system,"fire"),-3); // vulnerabilidade não escala
  system.legacy2.nd="8";
  prepare.call(system,Ruleset,npcProfile,prepareNpcClassificationActions,npcNd,NUMERIC_DAMAGE_TYPES);
  assert.equal(valor(system,"slashing"),16); // recalcula ao subir de ND
});

test("taxonomy and archetype contributions stack over the NPC's own values",()=>{
  const items=[perfilItem("taxonomy","Fera",{fire:{value:2}}),perfilItem("archetype","Bruto",{fire:{value:3},cold:{value:-1}})];
  const system=npcFixture({nd:"4",baseFire:5,items});
  prepare.call(system,Ruleset,npcProfile,prepareNpcClassificationActions,npcNd,NUMERIC_DAMAGE_TYPES);
  assert.equal(valor(system,"fire"),19); // 5 próprios + 2 fixos + 3×4 por ND
  assert.equal(valor(system,"cold"),-1);
});

test("immunity from either profile wins without erasing the source flag",()=>{
  const items=[perfilItem("taxonomy","Fera",{poison:{immune:true}})];
  const system=npcFixture({items});
  prepare.call(system,Ruleset,npcProfile,prepareNpcClassificationActions,npcNd,NUMERIC_DAMAGE_TYPES);
  assert.equal(imune(system,"poison"),true);
  system._source.legacy2.resistances.fire.immune=true;
  prepare.call(system,Ruleset,npcProfile,prepareNpcClassificationActions,npcNd,NUMERIC_DAMAGE_TYPES);
  assert.equal(imune(system,"fire"),true); // imunidade própria preservada
  assert.equal(imune(system,"slashing"),false);
});
