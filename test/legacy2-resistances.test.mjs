import assert from "node:assert/strict";
import { test } from "node:test";
import * as resistance from "../module/systems/legacy2-resistances.mjs";
test("Fulgor preserves each actual damage type and rounds only its combined total",()=>{
  const parts=resistance.scaleTypedDamage([{type:"fire",value:3},{type:"cold",value:4},{value:2}],2.5);
  assert.deepEqual(parts.map(d=>d.type),["fire","cold",undefined]);
  assert.equal(parts.reduce((sum,d)=>sum+d.value,0),23);
  assert(parts.every(d=>Number.isInteger(d.value)));
});
const actor=(values={})=>({system:{legacy2:{resistances:values}},_source:{system:{legacy2:{resistances:values}}}});
test("all eleven requested damage types have zero defaults and stable automation paths",()=>{
  const cards=resistance.resistanceCards(actor());
  assert.deepEqual(cards.map(card=>card.label),["Contundente","Perfurante","Cortante","Veneno","Ácido","Fogo","Frio","Eletricidade","Energia","Psíquico","Alma"]);
  assert(cards.every(card=>card.value===0&&!card.immune));
  assert.equal(cards.find(card=>card.key==="slashing").valuePath,"system.legacy2.resistances.slashing.value");
  assert.equal(cards.find(card=>card.key==="soul").immunePath,"system.legacy2.resistances.soul.immune");
});
test("the user's resistance, capped vulnerability and immunity examples apply exactly",()=>{
  assert.equal(resistance.resistedDamage(13,5,false),8);
  assert.equal(resistance.resistedDamage(7,-20,false),14);
  assert.equal(resistance.resistedDamage(13,20,false),0);
  assert.equal(resistance.resistedDamage(999,-20,true),0);
  assert.equal(resistance.resistedDamage(7,-3,false),10);
  assert.equal(resistance.resistedDamage(0,-20,false),0);
});
test("prepared effects drive applied resistance while editor inputs keep their source values",()=>{
  const a=actor({fire:{value:5,immune:true}});a._source={system:{legacy2:{resistances:{fire:{value:1,immune:false}}}}};
  const card=resistance.resistanceCards(a).find(card=>card.key==="fire");
  assert.equal(card.value,5);assert.equal(card.baseValue,1);assert.equal(card.immune,true);assert.equal(card.baseImmune,false);assert.equal(card.modified,true);
});
test("signed resistance meters share a visual scale without capping saved or effective values",()=>{
  const a=actor({slashing:{value:5},cold:{value:-10},fire:{value:0}});
  const cards=resistance.resistanceCards(a),get=key=>cards.find(card=>card.key===key);
  assert.equal(get('slashing').barPercent,50);assert.equal(get('cold').barPercent,100);assert.equal(get('fire').barPercent,0);
  a.system.legacy2.resistances.slashing.value=250;
  const large=resistance.resistanceCards(a).find(card=>card.key==='slashing');assert.equal(large.value,250);assert.equal(large.barPercent,100);
  const effect=actor({fire:{value:7,immune:true}});effect._source={system:{legacy2:{resistances:{fire:{value:-2,immune:false}}}}};
  const fire=resistance.resistanceCards(effect).find(card=>card.key==='fire');assert.equal(fire.barPercent,70);assert.equal(fire.baseBarPercent,20);assert.equal(fire.baseState,'negative');assert.equal(fire.state,'immune');
});
test("repeated parts of the same type share one reduction and mixed types keep distinct defenses",()=>{
  const a=actor({slashing:{value:5},cold:{value:-20}}),damages=[{type:"slashing",value:8},{type:"slashing",value:5},{type:"cold",value:7}];
  resistance.applyNumericResistances(a,damages);
  assert.equal(damages.filter(d=>d.type==="slashing").reduce((sum,d)=>sum+d.value,0),8);
  assert.equal(damages[2].value,14);
  assert(damages.filter(d=>d.type==="slashing").every(d=>Number.isInteger(d.value)&&d.value>=0));
});
test("immunity wins; ignored categories, healing, untyped and negative damage stay intact",()=>{
  const a=actor({fire:{value:-20,immune:true},slashing:{value:5}});
  const damages=[{type:"fire",value:13},{type:"healing",value:10},{value:7},{type:"slashing",value:-3}];
  resistance.applyNumericResistances(a,damages);assert.deepEqual(damages.map(d=>d.value),[0,10,7,-3]);
  const ignored=[{type:"fire",value:13},{type:"slashing",value:13}];resistance.applyNumericResistances(a,ignored,{ignore:true});assert.deepEqual(ignored.map(d=>d.value),[13,13]);
  const partlyIgnored=[{type:"slashing",value:13}];resistance.applyNumericResistances(a,partlyIgnored,{ignore:{resistance:new Set(["slashing"])}});assert.equal(partlyIgnored[0].value,13);
});
