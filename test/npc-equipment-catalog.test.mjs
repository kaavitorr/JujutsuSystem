import assert from "node:assert/strict";
import {test} from "node:test";
const api=await import("../module/systems/npc-equipment-catalog.mjs").catch(e=>{if(e.code==="ERR_MODULE_NOT_FOUND")return{};throw e;});
function weapon(extra=false){return{_id:"jjnat00000000003",name:"Mordida",type:"weapon",img:"old.webp",flags:{"jujutsu-system":{ataqueNatural:true,danoExtraPorNd:extra,custoPA:extra?3:2,modificador:"undefined"}},
 system:{type:{value:"natural"},description:{value:"undefined"},activities:{attack:{_id:"attack",type:"attack",activation:{type:"action"},consumption:{spellSlot:true,targets:[{type:"attribute",target:"energy.generated",value:String(extra?3:2)}]},
 damage:{includeBase:true,parts:[{custom:{enabled:true,formula:extra?"@escala + @mod@escalaExtra":"@escala + @mod"},types:["piercing"]}]}}}},effects:[]};}
test("natural weapon costs use actions exactly once while optional energy expenditures remain possible",()=>{
 assert.equal(typeof api.normalizeNpcEquipment,"function");
 for(const extra of [false,true]){const before=weapon(extra),after=api.normalizeNpcEquipment(before);const a=after.system.activities.attack;
  assert.deepEqual(a.activation,{type:"action",value:extra?3:2,override:true});assert.deepEqual(a.consumption.targets,[]);assert.equal(a.consumption.spellSlot,false);
  assert.equal(a.damage.parts[0].custom.formula,before.system.activities.attack.damage.parts[0].custom.formula);
  assert.ok(!after.system.description.value.includes("undefined"));assert.ok(!after.flags["jujutsu-system"].modificador.includes("undefined"));
  assert.deepEqual(api.normalizeNpcEquipment(after),after);assert.equal(before.system.activities.attack.activation.value,undefined);
 }
});
test("equipped natural armor uses its selected whole attribute; only real resistance effects transfer",()=>{
 const item={_id:"jjnar00000000020",name:"Ossada",type:"equipment",flags:{"jujutsu-system":{armaduraNatural:true,cr:{base:10,atributo:"con"}}},
  system:{type:{value:"natural"},armor:{value:10,ability:"con",dex:null},description:{value:"somada ao cálculo"},activities:{}},effects:[
   {_id:"ac",transfer:false,disabled:false,flags:{"jujutsu-system":{armaduraNaturalCR:{base:10,atributo:"con"}}},system:{changes:[{key:"system.attributes.ac.bonus",value:"10 + @abilities.con.mod"}]}},
   {_id:"immune",transfer:false,disabled:false,system:{changes:[{key:"system.legacy2.resistances.piercing.immune",type:"override",value:true}]}},
   {_id:"vulnerable",transfer:false,disabled:false,system:{changes:[{key:"system.legacy2.resistances.bludgeoning.value",type:"add",value:-10}]}}]};
 const after=api.normalizeNpcEquipment(item);assert.equal(after.effects[0].disabled,true);assert.equal(after.effects[1].transfer,true);assert.equal(after.effects[2].transfer,true);
 assert.deepEqual(after.system.armor,item.system.armor);assert.match(after.system.description.value,/substitui/);assert.ok(!after.system.description.value.includes(".mod"));
});
test("profile equipment redirects preserve archetype priority and produce real natural weapons",()=>{
 assert.equal(typeof api.profileEquipmentPlan,"function");
 const gear=[{_id:"jjnar00000000012",name:"Pele Grossa",type:"equipment",system:{type:{value:"natural"}}},
  ...["Mordida","Garras"].map((name,i)=>({_id:"weapon"+i,name,type:"weapon",system:{type:{value:"natural"}}}))];
 const profile={name:"Felinos",type:"taxonomy",system:{equipamentos:{armadura:"Compendium.jujutsu-compendium.arquetipos-e-taxonomias.Item.acd48c1a5dc3dfae",armas:[]}}};
 const result=api.profileEquipmentPlan(profile,gear);assert.equal(result.armadura,"Compendium.jujutsu-compendium.equipamento-pdn.Item.jjnar00000000012");
 assert.deepEqual(result.armas,["Compendium.jujutsu-compendium.equipamento-pdn.Item.weapon0","Compendium.jujutsu-compendium.equipamento-pdn.Item.weapon1"]);
 const manual={...profile,system:{equipamentos:{armadura:"Item.customArmor",armas:["Item.customWeapon"]}}};
 assert.deepEqual(api.profileEquipmentPlan(manual,gear,{preserveCustom:true}),manual.system.equipamentos);
});
test("profiles without declared armor stay unarmored and repeated anatomy choices are deduplicated",()=>{
 const gear=["Mordida","Garras"].map((name,i)=>({_id:"part"+i,name,type:"weapon",system:{type:{value:"natural"}}}));
 const profile={name:"Felinos",type:"taxonomy",system:{equipamentos:{armadura:null,armas:[]}}};
 const result=api.profileEquipmentPlan(profile,gear);assert.equal(result.armadura,null);assert.equal(new Set(result.armas).size,result.armas.length);
});
