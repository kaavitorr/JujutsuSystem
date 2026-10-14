import assert from "node:assert/strict";
import { test } from "node:test";
globalThis.document={querySelector:()=>true};
globalThis.foundry={applications:{api:{ApplicationV2:class{},HandlebarsApplicationMixin:C=>C}}};
globalThis.game={user:{id:"me"},settings:{get:(scope,key)=>key==="rulesetVersion"?"2.0":true}};
const {registerCreationHooks}=await import("../module/applications/actor/creation/creation-hooks-2.mjs");
test("creation hooks suppress the ordinary sheet only for fresh local characters and open the fullscreen creator",()=>{
  const handlers=new Map(),opened=[];
  registerCreationHooks({on:(name,fn)=>handlers.set(name,fn),once:(name,fn)=>handlers.set(name,fn)},actor=>opened.push(actor));
  const actor={type:"character",isOwner:true,items:[],getFlag(){}};
  const options={renderSheet:true};handlers.get("preCreateActor")(actor,{},options,"me");
  assert.equal(options.renderSheet,false);handlers.get("createActor")(actor,options,"me");assert.equal(opened.length,1);
  for(const [a,o,id] of [[{...actor,type:"npc"},{},"me"],[actor,{keepId:true},"me"],[{...actor,items:[{}]},{},"me"],[{...actor,_stats:{duplicateSource:"Actor.original"}},{},"me"],[actor,{},"other"]]){
    handlers.get("preCreateActor")(a,{},o,id);assert.equal(o.renderSheet,undefined);handlers.get("createActor")(a,o,id);
  }
  assert.equal(opened.length,1);
  game.settings.get=(scope,key)=>key==="rulesetVersion"?"1.0":true;
  const legacy={};handlers.get("preCreateActor")(actor,{},legacy,"me");assert.equal(legacy.renderSheet,undefined);
  handlers.get("createActor")(actor,legacy,"me");assert.equal(opened.length,1);
});
