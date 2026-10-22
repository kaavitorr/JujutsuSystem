import assert from "node:assert/strict";
import { test } from "node:test";
import * as itemProfiles from "../module/applications/actor/jj/npc-profile-selection.mjs";
const {assignNpcProfile}=itemProfiles;
import { npcAttributeDistribution, npcProfile } from "../module/systems/legacy2-npc-profiles.mjs";
import { prepareNpc2Abilities } from "../module/systems/legacy2-npc-attributes.mjs";
import Ruleset from "../module/systems/ruleset.mjs";

const taxonomy={str:4,dex:2,con:3,int:1,wis:1,cha:1}, archetype={str:0,dex:4,con:3,int:2,wis:1,cha:2};
globalThis.CONFIG={JUJUTSU:{taxonomias:{espirito:{label:"Espírito",vidaEnergia:true}},arquetipos:{veloz:{label:"Veloz",pesos:archetype}}}};
globalThis.game={settings:{get:()=>"2.0"},items:[],packs:[]};
function document(type,weights,name="Perfil") {
  return {id:name,uuid:`Item.${name}`,name,type,visible:true,system:{pesos:structuredClone(weights),vidaEnergia:false,energiaBase:7},
    toObject(){return {_id:this.id,name:this.name,img:"icons/svg/mystery-man.svg",type:this.type,system:structuredClone(this.system),flags:{},folder:"sourceFolder"};}};
}
function fixture() {
  const actor={type:"npc",uuid:"Actor.npc",isOwner:true,items:[],itemTypes:{class:[]},system:{legacy2:{nd:"13"},abilities:Object.fromEntries(Object.keys(taxonomy).map(key=>[key,{value:12,_source:{value:12}}]))}};
  actor.update=async data=>{for(const [key,value] of Object.entries(data))actor.system.legacy2[key.split('.').at(-1)]=value;return actor;};
  actor.createEmbeddedDocuments=async(type,data)=>data.map(raw=>{
    const item={...raw,id:`owned${actor.items.length}`,uuid:`${actor.uuid}.Item.owned${actor.items.length}`,parent:actor,
      async update(data){Object.assign(this,data);return this;},async delete(){actor.items.splice(actor.items.indexOf(this),1);}};
    actor.items.push(item);return item;
  });
  return actor;
}
test("world selection and compendium drops create real independent owned copies and reuse the existing profile",async()=>{
  const actor=fixture(),source=document("taxonomy",taxonomy);
  assert.equal(await assignNpcProfile(actor,"taxonomy",source),true);
  assert.equal(actor.items.length,1);assert.equal(actor.system.legacy2.taxonomia,"owned0");
  assert.equal(actor.items[0].folder,undefined);assert.equal(actor.items[0].flags["jujutsu-system"].npcProfileSource,source.uuid);
  const changed=document("taxonomy",{...taxonomy,str:3,dex:3},"Segunda");changed.pack="world.profiles";
  assert.equal(await assignNpcProfile(actor,"taxonomy",changed.uuid,{resolve:async uuid=>uuid===changed.uuid?changed:null}),true);
  assert.equal(actor.items.length,1);assert.equal(actor.items[0].name,"Segunda");
  assert.equal(actor.items[0].system.pesos.dex,3);assert.equal(source.system.pesos.dex,2);
});
test("owned references can be selected without duplicate documents; clearing and legacy selection do not leave dangling profiles",async()=>{
  const actor=fixture();await assignNpcProfile(actor,"taxonomy",document("taxonomy",taxonomy));
  await assignNpcProfile(actor,"taxonomy",actor.items[0]);assert.equal(actor.items.length,1);
  assert.equal(await assignNpcProfile(actor,"taxonomy","legacy:missing"),false);assert.equal(actor.items.length,1);
  await assignNpcProfile(actor,"taxonomy","legacy:espirito");assert.equal(actor.items.length,0);assert.equal(npcProfile(actor,"taxonomy").key,"espirito");
  await assignNpcProfile(actor,"taxonomy","");assert.equal(actor.system.legacy2.taxonomia,null);assert.equal(npcProfile(actor,"taxonomy"),null);
});
test("read-only actors, wrong types and invalid scales cannot change profiles",async()=>{
  const actor=fixture(),source=document("taxonomy",taxonomy);
  assert.equal(await assignNpcProfile({...actor,isOwner:false},"taxonomy",source),false);
  assert.equal(await assignNpcProfile({...actor,type:"character"},"taxonomy",source),false);
  assert.equal(await assignNpcProfile(actor,"archetype",source),false);
  source.system.pesos.str=8;assert.equal(await assignNpcProfile(actor,"taxonomy",source),false);
  source.system.pesos=taxonomy;source.visible=false;assert.equal(await assignNpcProfile(actor,"taxonomy",source),false);
  assert.equal(actor.items.length,0);
});
test("removing a profile tag detaches only the owned copy and requires an editable sheet",async()=>{
  const actor=fixture(),source=document("taxonomy",taxonomy);await assignNpcProfile(actor,"taxonomy",source);
  assert.equal(await itemProfiles.removeNpcProfile({actor,isEditable:false},"taxonomy"),false);
  assert.equal(actor.items.length,1);
  assert.equal(await itemProfiles.removeNpcProfile({actor,isEditable:true},"taxonomy"),true);
  assert.equal(actor.items.length,0);assert.equal(actor.system.legacy2.taxonomia,null);
  assert.equal(source.name,"Perfil");assert.deepEqual(source.system.pesos,taxonomy);
});
test("NPC preparation uses applied taxonomy and growth before attacks; changes to an owned copy recalculate without rewriting source",async()=>{
  const actor=fixture();await assignNpcProfile(actor,"taxonomy",document("taxonomy",taxonomy));await assignNpcProfile(actor,"archetype",document("archetype",archetype,"Crescimento"));
  prepareNpc2Abilities(actor);assert.equal(actor.system.abilities.str.value,7);assert.equal(actor.system.abilities.dex.value,7);
  assert.equal(actor.system.abilities.str._source.value,12);assert.equal(Ruleset.npcPrincipal(actor),"dex");
  assert.equal(Ruleset.npcAttributeBudget(actor),32);
  actor.system.legacy2.nd="1";prepareNpc2Abilities(actor);assert.deepEqual(npcAttributeDistribution(actor).growth,{str:0,dex:0,con:0,int:0,wis:0,cha:0});
  actor.items[0].system.pesos={...taxonomy,str:3,dex:3};prepareNpc2Abilities(actor);assert.equal(actor.system.abilities.str.value,5);
});
test("taxonomy energy traits are resolved from the owned item rather than an old key",async()=>{
  const actor=fixture();actor.system.legacy2.taxonomia="espirito";
  await assignNpcProfile(actor,"taxonomy",document("taxonomy",taxonomy));
  assert.equal(Ruleset.isEspirito(actor),false);assert.equal(Ruleset.maxEnergy(actor),390); // 30×ND (espírito só quando o item aplicado tem vidaEnergia)
  actor.items[0].system.vidaEnergia=true;assert.equal(Ruleset.isEspirito(actor),true);
  assert.equal(Ruleset.maxEnergy(actor),310); // 10×ND + 15×CON (espírito: energia = PV)
  actor.system.legacy2.nd=null;actor.system.details={level:9};
  assert.equal(Ruleset.nivel(actor),1);assert.equal(Ruleset.npcAttributeBudget(actor),20);
});
test("dropping a definition requires permission to read the item",async()=>{
  const actor=fixture(),source=document("taxonomy",taxonomy);
  source.testUserPermission=()=>false;
  assert.equal(await assignNpcProfile(actor,"taxonomy",source),false);assert.equal(actor.items.length,0);
  source.testUserPermission=(user,level)=>level==="OBSERVER";
  assert.equal(await assignNpcProfile(actor,"taxonomy",source),true);assert.equal(actor.items.length,1);
});
