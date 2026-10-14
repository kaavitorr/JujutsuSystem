import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import Ruleset from "../module/systems/ruleset.mjs";
import { applyNumericResistances } from "../module/systems/legacy2-resistances.mjs";
let version="2.0";
globalThis.game={settings:{get:()=>version}};
globalThis.CONFIG={DND5E:{damageTypes:{slashing:{isPhysical:true},fire:{},cold:{},soul:{}},healingTypes:{healing:{},temphp:{},maximum:{}}}};
globalThis.foundry={utils:{deepClone:structuredClone}};
globalThis.Hooks={call:()=>true,on:()=>{}};
const {applyDamageToActor}=await import("../module/applications/actor/jj/damage-application.mjs");
globalThis.ChatMessage={create:async()=>{},getSpeaker:()=>({})};
const warnings=[];globalThis.ui={notifications:{warn:message=>warnings.push(message)}};
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const source=read("module/documents/actor/actor.mjs");
const methods=source.slice(source.indexOf('  calculateDamage(damages, options={})'),source.indexOf('  async applyTempHP('));
const NativeActor=new Function("Ruleset","applyNumericResistances","simplifyBonus",`return class {getRollData(){return {}} ${methods}}`)(Ruleset,applyNumericResistances,Number);
function actor(resistances={},traits={}) {
  const a=new NativeActor();a.name="Alvo";a.type="npc";a.system={legacy2:{resistances},attributes:{hp:{value:100,temp:0}},armorPoints:{value:0},traits};
  a.getFlag=()=>null;a.updates=[];a.update=async update=>a.updates.push(update);return a;
}
const damage=(type,value)=>({type,value});
test("native damage uses numeric defenses, groups same types and leaves healing intact in 2.0",()=>{
  version="2.0";const a=actor({slashing:{value:5},cold:{value:-20},fire:{immune:true}});
  const result=a.calculateDamage([damage("slashing",8),damage("slashing",5),damage("cold",7),damage("fire",99),damage("healing",10)]);
  assert.equal(result.amount,12);assert.equal(result[0].value+result[1].value,8);assert.equal(result[2].value,14);assert.equal(result[3].value,0);assert.equal(result[4].value,-10);
  assert.equal(a.calculateDamage([damage("slashing",13)],{ignore:true}).amount,13);
  assert.equal(a.calculateDamage([damage("cold",7)],{multiplier:0.5}).amount,6);
});
test("old half/double/immunity/modification remain in 1.0 and are dormant in 2.0",()=>{
  const a=actor({slashing:{value:5}}, {dr:{value:new Set(["slashing"])},di:{value:new Set(["fire"])},dv:{value:new Set(["cold"])},dm:{amount:{slashing:-1}}});
  version="1.0";assert.equal(a.calculateDamage([damage("slashing",13)]).amount,6);assert.equal(a.calculateDamage([damage("cold",7)]).amount,14);assert.equal(a.calculateDamage([damage("fire",99)]).amount,0);
  version="2.0";assert.equal(a.calculateDamage([damage("slashing",13)]).amount,8);assert.equal(a.calculateDamage([damage("cold",7)]).amount,7);assert.equal(a.calculateDamage([damage("fire",99)]).amount,99);
});
test("custom typed application uses resistance before armor and temporary life",async()=>{
  version="2.0";const a=actor({slashing:{value:5}});a.system.armorPoints.value=2;a.system.attributes.hp.temp=2;
  const log=await applyDamageToActor(a,13,{damages:[damage("slashing",13)],damageTypes:["slashing"]});
  assert.equal(log.hp,2);assert.deepEqual(a.updates[0],{"system.armorPoints.value":0,"system.attributes.hp.temp":0,"system.attributes.hp.value":98});
  const immune=actor({soul:{immune:true}});immune.getFlag=()=>({reducao:10});await applyDamageToActor(immune,99,{damageTypes:["soul"]});assert.equal(immune.updates.length,0);
});
test("custom mixed typed damage gets distinct defenses and 1.0 preserves its original path",async()=>{
  const a=actor({slashing:{value:5},cold:{value:-20}});
  version="2.0";await applyDamageToActor(a,20,{damages:[damage("slashing",13),damage("cold",7)],damageTypes:["slashing","cold"]});assert.equal(a.updates[0]["system.attributes.hp.value"],78);
  version="1.0";const old=actor({slashing:{value:5}});await applyDamageToActor(old,13,{damageTypes:["slashing"]});assert.equal(old.updates[0]["system.attributes.hp.value"],87);
});
test("old ambiguous mixed cards cannot silently guess damage proportions in 2.0",async()=>{
  version="2.0";const a=actor({fire:{immune:true}});const result=await applyDamageToActor(a,20,{damageTypes:["fire","cold"]});
  assert.equal(result,false);assert.equal(a.updates.length,0);assert(warnings.length);
});
test("2.0 immunity controls toggle active/ignore; 1.0 retains its third downgrade state",()=>{
  const src=read("module/applications/components/damage-application.mjs"),start=src.indexOf('  #cycleChangeSource('),end=src.indexOf('\n  /* -------------------------------------------- */',start);
  const Control=new Function("Ruleset",`return class {cycle(...args){return this.#cycleChangeSource(...args)} ${src.slice(start,end)}}`)(Ruleset);
  const c=new Control(),operation={type:"fire",change:"immunity"},options={};
  version="2.0";c.cycle(options,operation);assert(options.ignore.immunity.has("fire"));c.cycle(options,operation);assert(!options.ignore.immunity.has("fire"));assert.equal(options.downgrade,undefined);
  version="1.0";c.cycle(options,operation);c.cycle(options,operation);assert(options.downgrade.has("fire"));c.cycle(options,operation);assert(!options.downgrade.has("fire"));
  version="2.0";assert.equal(actor({fire:{value:5,immune:true}}).calculateDamage([damage("fire",13)],{downgrade:new Set(["fire"])}).amount,8);
});
test("extra PA damage inherits the modal's selected base type before rule bonuses and message creation",()=>{
  const src=read("module/documents/activity/mixin.mjs"),body=src.match(/_buildDamageConfig\(process, config, formData, index\) \{([\s\S]*?)\n    \}/)[1];
  const AppliedRules={collect:()=>({toArray:()=>[]}),createIterator:()=>({filterWith:()=>({toFormula:()=>""})})};
  const build=new Function("Ruleset","AppliedRules",`return function(process,config,formData,index){${body}}`)(Ruleset,AppliedRules);
  const ctx={actor:{},item:{},constructor:{damageRuleCategory:"damage"}},process={},base={data:{},options:{type:"fire"},parts:["1d6"]},extra={data:{},options:{jj2InheritDamageType:true,type:"cold"},parts:["2d4"]};
  version="2.0";build.call(ctx,process,base,new Map([["roll.0.damageType","fire"]]),0);build.call(ctx,process,extra,new Map([["roll.0.damageType","fire"]]),1);assert.equal(extra.options.type,"fire");assert.equal(extra.data.roll.damageType,"fire");
  const skipped={data:{},options:{jj2InheritDamageType:true},parts:["1d4"]};build.call(ctx,process,skipped,null,2);assert.equal(skipped.options.type,"fire");
  version="1.0";extra.options.type="cold";build.call(ctx,process,extra,null,1);assert.equal(extra.options.type,"cold");
});
test("old defense controls disappear in 2.0 while condition immunities remain separate",()=>{
  const body=read("module/applications/actor/api/base-actor-sheet.mjs").match(/_prepareTraits\(context\) \{([\s\S]*?)\n  \}/)[1];
  const prepare=new Function("Ruleset","Trait","splitSemicolons","simplifyBonus","formatNumber","_loc",`return function(context){${body}}`)(Ruleset,{keyLabel:key=>key},value=>value.split(';'),Number,String,value=>value);
  const traits={dr:{value:new Set(["fire"])},di:{value:new Set(["cold"])},dv:{value:new Set(["slashing"])},ci:{value:new Set(["poisoned"])},dm:{amount:{fire:-2},bypasses:new Set()}};
  const context={actor:{system:{traits},getRollData:()=>({})},document:{hasConditionEffect:()=>false},constructor:{MODES:{PLAY:1}},_mode:1};
  const saved=structuredClone(traits),config=globalThis.CONFIG;
  globalThis.CONFIG={DND5E:{traits:Object.fromEntries(Object.keys(traits).map(key=>[key,{}])),damageTypes:config.DND5E.damageTypes,communicationTypes:{}}};
  foundry.utils.getProperty=(obj,key)=>key.split('.').reduce((value,k)=>value?.[k],obj);
  version="2.0";const current=prepare.call(context,{});assert.deepEqual(Object.keys(current),["ci"]);assert.equal(current.ci[0].key,"poisoned");
  version="1.0";const old=prepare.call(context,{});assert(old.dr&&old.di&&old.dv&&old.dm);assert.equal(old.ci,undefined);assert(old.di.some(value=>value.key==="poisoned"));assert.deepEqual(traits,saved);
  globalThis.CONFIG=config;
});
