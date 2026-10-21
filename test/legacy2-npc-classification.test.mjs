import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import Ruleset from "../module/systems/ruleset.mjs";
import { legacy2ActionMax } from "../module/applications/actor/jj/legacy2-sheet.mjs";
import * as classification from "../module/systems/legacy2-npc-classification.mjs";
globalThis.game={settings:{get:()=>"2.0"},user:{isGM:true}};
globalThis.CONFIG={JUJUTSU:{taxonomias:{espirito:{vidaEnergia:true}}}};
const actor=(categoria,type="npc",taxonomia=null)=>({type,items:[],itemTypes:{class:[]},system:{details:{level:5},legacy2:{nd:"5",categoria,taxonomia,actions:{value:6,max:6}},_source:{legacy2:{actions:{max:6}}},abilities:{con:{value:5}}}});
const cases=[["lacaio",.5,4,63],["normal",1,6,125],["elite",1.5,8,188],["chefe",2,10,250]];
test("all NPC classifications set life multipliers and action budgets",()=>{
  for(const [key,mult,actions,pv] of cases){
    const a=actor(key);classification.prepareNpcClassificationActions(a.system);assert.equal(Ruleset.categoriaMult(a),mult);
    assert.equal(Ruleset.maxHitPoints(a),pv);assert.equal(legacy2ActionMax(a),actions);
    assert.equal(classification.npcClassification(a).actions,actions);
    assert.equal(Ruleset.maxHitPoints(actor(key,"npc","espirito")),pv);
  }
  const lacain=actor("lacain");classification.prepareNpcClassificationActions(lacain.system);assert.equal(legacy2ActionMax(lacain),4);assert.equal(Ruleset.categoriaMult(lacain),.5);
  assert.equal(legacy2ActionMax(actor("unknown")),6);
});
test("player life and edited action limits retain their current behavior",()=>{
  const a=actor("chefe","character");a.system.legacy2.actions.max=9;
  assert.equal(Ruleset.maxHitPoints(a),40);assert.equal(legacy2ActionMax(a),9);
  const get=game.settings.get;game.settings.get=()=>"1.0";
  try{assert.equal(Ruleset.maxHitPoints(actor("chefe")),40);}finally{game.settings.get=get;}
});
test("native NPC creation and category-update lifecycles persist the correct action budget and honor the 1.0 guard",async()=>{
  const native=readFileSync(new URL("../module/data/actor/npc.mjs",import.meta.url),"utf8");
  const create=native.match(/async _preCreate\(data, options, user\) \{([\s\S]*?)\n  \}/)[1];
  const update=native.match(/async _preUpdate\(changes, options, user\) \{([\s\S]*?)\n  \}/)[1];
  class Boundary {async _preCreate(){}async _preUpdate(){}}
  globalThis.foundry={utils:{hasProperty:()=>false,setProperty:(data,path,value)=>{
    const parts=path.split('.'),last=parts.pop();let current=data;
    for(const part of parts)current=current[part]??={};current[last]=value;
  }}};
  const Data=new Function("Boundary","Ruleset","npcClassification","npcClassificationActionUpdate","TraitsFields","AttributesFields",`return class extends Boundary {async _preCreate(data,options,user){${create}}async _preUpdate(changes,options,user){${update}}}`)(Boundary,Ruleset,classification.npcClassification,classification.npcClassificationActionUpdate,{preCreateSize:async()=>{},preUpdateSize:async()=>{}},{preUpdateHP:async()=>{}});
  for(const [key,,max] of cases){
    const updates=[],a=actor(key);a.updateSource=data=>updates.push(data);const data=new Data();data.parent=a;
    await data._preCreate({system:{legacy2:{categoria:key}}},{},{});
    assert.deepEqual(updates[0]["system.legacy2.actions"],{max,value:max});
  }
  const data=new Data();data.parent=actor("normal");data.parent.system.legacy2.actions.value=4;
  const changes={system:{legacy2:{categoria:"elite"}}};await data._preUpdate(changes,{},{});
  assert.deepEqual(changes.system.legacy2.actions,{max:8,value:6});
  const get=game.settings.get;game.settings.get=()=>"1.0";
  try{const legacy={system:{legacy2:{categoria:"chefe"}}};await data._preUpdate(legacy,{},{});assert.equal(legacy.system.legacy2.actions,undefined);}finally{game.settings.get=get;}
});
test("prepared NPC action limits clamp overspent pools without refilling spent actions on a render",()=>{
  const a=actor("lacaio");classification.prepareNpcClassificationActions(a.system);
  assert.equal(a.system.legacy2.actions.max,4);assert.equal(a.system.legacy2.actions.value,4);
  a.system.legacy2.categoria="elite";a.system.legacy2.actions.value=2;
  // Mudança de categoria persiste o novo teto na fonte (via _preUpdate) e a
  // preparação reconstrói o máximo a partir dela — modelar as duas partes.
  a.system.legacy2.actions.max=8;a.system._source.legacy2.actions.max=8;
  classification.prepareNpcClassificationActions(a.system);assert.equal(a.system.legacy2.actions.max,8);assert.equal(a.system.legacy2.actions.value,2);
  classification.prepareNpcClassificationActions(a.system);assert.equal(a.system.legacy2.actions.value,2);
});
test("changing classification preserves spent actions and respects explicit current-pool changes",()=>{
  const a=actor("normal");a.system.legacy2.actions.value=4;
  assert.deepEqual(classification.npcClassificationActionUpdate(a,{categoria:"elite"}),{max:8,value:6});
  assert.deepEqual(classification.npcClassificationActionUpdate(a,{categoria:"lacaio"}),{max:4,value:2});
  assert.deepEqual(classification.npcClassificationActionUpdate(a,{categoria:"chefe",actions:{value:1}}),{max:10,value:1});
  assert.equal(classification.npcClassificationActionUpdate(a,{actions:{value:2}}),null);
});
test("combat turn recovery restores each NPC to its classification budget",async()=>{
  const hooks=new Map();globalThis.Hooks={on:(name,handler)=>hooks.set(name,handler)};
  globalThis.foundry={utils:{isEmpty:data=>!Object.keys(data).length}};
  await import("../module/systems/acoes-combate.mjs");
  for(const [key,,max] of cases){
    const a=actor(key);classification.prepareNpcClassificationActions(a.system);a.system.legacy2.actions.value=0;
    const updates=[];a.update=async data=>updates.push(data);
    const combat={id:key,started:true,current:{round:1,turn:0,combatantId:"one"},
      previous:{round:0,turn:null,combatantId:null},round:1,combatants:new Map([["one",{actor:a}]])};
    await hooks.get("updateCombat")(combat,{turn:0,round:1});
    assert.equal(updates[0]["system.legacy2.actions.value"],max);
  }
});
