import { test } from "node:test";
import assert from "node:assert/strict";
import { buildNpc2Context, configureNpc2Parts, NPC2_TABS, updateNpc2Actions } from "../module/applications/actor/jj/legacy2-npc-sheet.mjs";
const abilityKeys=["str","dex","con","int","wis","cha"];
const config={abilities:Object.fromEntries(abilityKeys.map(key=>[key,{label:key,abbreviation:key}])),movementTypes:{},movementUnits:{}};
const rules={estilo:()=>null,atributoPrincipal:()=>"str",npcPrincipal:()=>"dex",rankBonus:()=>0,rankLabel:()=>"Destreinado",nivel:()=>7,atributosAdicionais:()=>0,trainingPointsTotal:()=>4,trainingPointsAvailable:()=>4};
const actor=()=>({type:"npc",isOwner:true,system:{abilities:Object.fromEntries(abilityKeys.map(key=>[key,{value:5,_source:{value:1}}])),legacy2:{nd:"7",taxonomia:"espirito",arquetipo:"veloz",categoria:"elite",actions:{value:2,max:8}},attributes:{hp:{value:90,max:120},movement:{}},energy:{total:80,max:120,generated:12},armorPoints:{value:25,max:20}},items:[],getFlag(){}});
test("NPC presentation keeps derived attributes and threat level without a player creation budget",()=>{
 const a=actor(),before=structuredClone(a.system),data=buildNpc2Context(a,config,rules,{taxonomias:{espirito:{label:"Espírito"}},arquetipos:{veloz:{label:"Veloz"}}});
 assert.equal(data.npc.nd,7);assert.equal(data.npc.derivedAttributes,true);assert.equal(data.abilities[0].value,5);
 assert.equal(data.abilities[0].sourceValue,1);
 assert.equal(data.abilities.find(v=>v.key==="dex").principal,true);assert.equal(data.atributos,undefined);
 assert.equal(data.npc.category,"Elite");assert.equal(data.npc.armorPct,100);assert.deepEqual(a.system,before);
  assert.equal(data.wounds,undefined);
  assert.equal(data.actions.pips.length,8);
});
test("NPC render parts preserve native inventory/biography and attach shared partials to redesigned sections",()=>{
 const parts={header:{},sidebar:{},abilityScores:{},details:{},tabs:{},effects:{},inventory:{template:"native-inventory"},biography:{template:"native-biography"}};
 configureNpc2Parts(parts);assert(parts.header.template.endsWith("npc-header-2.hbs"));assert.equal(parts.inventory.template,"native-inventory");assert.equal(parts.biography.template,"native-biography");
 assert(parts.effects.templates.some(path=>path.endsWith("controls-2.hbs")));assert.equal(new Set(NPC2_TABS.map(t=>t[0])).size,NPC2_TABS.length);
});
test("NPC action controls permit owner changes including zero and reject invalid values",async()=>{
 const a=actor(),updates=[];a.update=async data=>updates.push(data);const sheet={actor:a,isEditable:true};
  await updateNpc2Actions(sheet,0);await updateNpc2Actions(sheet,8);
  for(const value of [-1,9,1.5,NaN])await updateNpc2Actions(sheet,value);
 await updateNpc2Actions({...sheet,isEditable:false},2);
  assert.deepEqual(updates,[{"system.legacy2.actions.value":0},{"system.legacy2.actions.value":8}]);
});
test("applied taxonomy and archetype items appear as separate header tags with stable document identities",()=>{
  const a=actor();a.items=[{id:"tax",uuid:"Actor.npc.Item.tax",type:"taxonomy",name:"Predador Subterrâneo",system:{pesos:{str:4,dex:2,con:3,int:1,wis:1,cha:1}}},
    {id:"arch",uuid:"Actor.npc.Item.arch",type:"archetype",name:"Veloz",system:{pesos:{str:0,dex:4,con:3,int:2,wis:1,cha:2}}}];
  const data=buildNpc2Context(a,config,rules,{});
  assert.deepEqual(data.npc.profileTags.map(tag=>({type:tag.type,label:tag.label,uuid:tag.uuid})),[
    {type:"taxonomy",label:"Predador Subterrâneo",uuid:"Actor.npc.Item.tax"},
    {type:"archetype",label:"Veloz",uuid:"Actor.npc.Item.arch"}]);
  a.items[0].name="Novo Nome";assert.equal(buildNpc2Context(a,config,rules,{}).npc.profileTags[0].label,"Novo Nome");
  assert.equal(data.npc.taxonomies,undefined);assert.equal(data.npc.archetypes,undefined);
});
