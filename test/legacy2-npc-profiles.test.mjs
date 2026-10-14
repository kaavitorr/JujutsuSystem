import assert from "node:assert/strict";
import { test } from "node:test";
import * as profiles from "../module/systems/legacy2-npc-profiles.mjs";

const taxonomy = {str:4,dex:2,con:3,int:1,wis:1,cha:1};
const archetype = {str:0,dex:4,con:3,int:2,wis:1,cha:2};
const total = values => Object.values(values).reduce((sum, value) => sum + value, 0);
test("scales contain six integer weights totaling twelve", () => {
  assert.equal(profiles.validNpcScale(taxonomy),true);
  for (const weights of [{...taxonomy,str:5},{...taxonomy,str:-1},{...taxonomy,dex:2.5},{str:12}])
    assert.equal(profiles.validNpcScale(weights),false);
});
test("taxonomy alone distributes twenty at ND one; archetype never changes the initial attributes", () => {
  const a=profiles.distributeNpcAttributes(taxonomy,archetype,1);
  assert.deepEqual(a.initial,{str:7,dex:3,con:5,int:2,wis:2,cha:1});
  assert.equal(total(a.values),20);assert.deepEqual(a.values,a.initial);
  assert.deepEqual(profiles.distributeNpcAttributes(taxonomy,{str:12,dex:0,con:0,int:0,wis:0,cha:0},1).values,a.values);
});
test("each ND after the first adds exactly one point, follows the archetype and never grows zero weights", () => {
  let previous=profiles.distributeNpcAttributes(taxonomy,archetype,1);
  for(let nd=2;nd<=20;nd++){
    const next=profiles.distributeNpcAttributes(taxonomy,archetype,nd);
    assert.equal(total(next.values),20+nd-1);assert.equal(next.growth.str,0);
    for(const key of profiles.NPC_ABILITIES) assert(next.values[key]>=previous.values[key]);
    previous=next;
  }
  assert.deepEqual(profiles.distributeNpcAttributes(taxonomy,archetype,13).growth,archetype);
});
test("caps redistribute growth among eligible attributes and expose the unapplied remainder", () => {
  const result=profiles.distributeNpcAttributes(taxonomy,archetype,1000000);
  assert.equal(result.values.str,7);
  for(const key of profiles.NPC_ABILITIES.filter(key=>key!=="str"))assert.equal(result.values[key],12);
  assert.equal(total(result.values)+result.unspent,20+999999);
  const extreme=profiles.distributeNpcAttributes({str:12,dex:0,con:0,int:0,wis:0,cha:0},archetype,1);
  assert.equal(total(extreme.values),20);
  assert(Object.values(extreme.values).every(value=>value>=1&&value<=12));
});
test("missing archetype leaves growth unapplied and fractional/invalid ND cannot add fractional points", () => {
  assert.equal(profiles.distributeNpcAttributes(taxonomy,null,5).unspent,4);
  for(const nd of [null,0,-2,Infinity,"no"]) assert.equal(total(profiles.distributeNpcAttributes(taxonomy,archetype,nd).values),20);
  assert.equal(total(profiles.distributeNpcAttributes(taxonomy,archetype,3.8).values),22);
});
test("owned profile copies take priority over old configuration keys and remain stable after renaming", () => {
  const configs={taxonomias:{espirito:{label:"Antigo",pesos:taxonomy}}};
  const item={id:"owned",type:"taxonomy",name:"Nova taxonomia",system:{pesos:archetype}};
  const actor={system:{legacy2:{taxonomia:"espirito"}},items:[item]};
  assert.equal(profiles.npcProfile(actor,"taxonomy",configs).item,item);
  item.name="Renomeada";assert.equal(profiles.npcProfile(actor,"taxonomy",configs).label,"Renomeada");
  actor.items=[];assert.equal(profiles.npcProfile(actor,"taxonomy",configs).label,"Antigo");
  actor.system.legacy2.taxonomia="missing";assert.equal(profiles.npcProfile(actor,"taxonomy",configs),null);
});
test("native item batches cannot create duplicate NPC profiles", () => {
  const actor={items:[]};
  assert.equal(profiles.canCreateNpcProfiles(actor,[{type:"taxonomy"},{type:"archetype"}]),true);
  assert.equal(profiles.canCreateNpcProfiles(actor,[{type:"taxonomy"},{type:"taxonomy"}]),false);
  actor.items=[{type:"archetype"}];
  assert.equal(profiles.canCreateNpcProfiles(actor,[{type:"archetype"}]),false);
  assert.equal(profiles.canCreateNpcProfiles(actor,[{type:"taxonomy"},{type:"weapon"}]),true);
});
