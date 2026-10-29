import assert from "node:assert/strict";
import {test} from "node:test";
import {equipmentCopyPatch,profileCopyPatch,refreshNpcEquipment} from "../module/systems/npc-equipment-migration.mjs";
import {NPC_EQUIPMENT_PACK,NPC_PROFILE_PACK,npcEquipmentFingerprint,npcEquipmentUuid} from "../module/systems/npc-equipment-catalog.mjs";
const ns="jujutsu-system", old="Compendium.jujutsu-compendium.arquetipos-e-taxonomias.Item.acd48c1a5dc3dfae";
const set=(o,path,value)=>{const keys=path.split("."),last=keys.pop();for(const k of keys)o=o[k]??={};o[last]=value;};
const doc=data=>({...structuredClone(data),toObject(){const {toObject,update,...value}=this;return structuredClone(value);},async update(patch){for(const [k,v]of Object.entries(patch))if(k!=="_id")set(this,k,structuredClone(v));}});
function sourceGear(){return doc({_id:"jjnar00000000012",uuid:npcEquipmentUuid("jjnar00000000012"),type:"equipment",name:"Pele Grossa",img:"icons/skin.webp",
 system:{armor:{value:10,ability:"dex",dex:null},description:{value:"Descrição corrigida."}},effects:[],flags:{[ns]:{armaduraNatural:true,cr:{base:10,atributo:"dex"},equipmentPdn:{version:1,previousImg:"generic.svg",descriptionHashesBefore:[]}}}});}
function profile(){return doc({_id:"profile",uuid:`Compendium.${NPC_PROFILE_PACK}.Item.profile`,type:"taxonomy",name:"Felinos",system:{equipamentos:{armadura:sourceGear().uuid,armas:[npcEquipmentUuid("bite")]},habilidades:[{uuid:"Item.feat",nd:5}]},flags:{[ns]:{encyclopedia:{edition:"2.0",key:"profile:taxonomy:felinos"},equipmentPdn:{version:1}}}});}

test("old managed armor keeps its native Item ID and links to canonical gear without changing equipment state or user art",()=>{
 const item={_id:"owned",type:"equipment",img:"worlds/custom.webp",system:{equipped:false,armor:{value:10,ability:"dex",dex:null},description:{value:"<p>CR: 10 + dex.</p>"}},effects:[],
  _stats:{compendiumSource:old},flags:{[ns]:{npcArchetypeEquipment:{source:old,profile:"profile"}}}};
 const patch=equipmentCopyPatch(item,sourceGear());assert.equal(patch._id,"owned");assert.equal(patch.img,undefined);assert.equal(patch["system.equipped"],undefined);
 assert.equal(patch[`flags.${ns}.npcArchetypeEquipment`].source,sourceGear().uuid);assert.equal(patch["_stats.compendiumSource"],sourceGear().uuid);
 assert.equal(patch["system.description.value"],"Descrição corrigida.");
});
test("stock action/energy mistakes are repaired while custom damage, extra activities and manual edits remain",()=>{
 const description="Antiga descrição automática.",source=doc({_id:"bite",type:"weapon",img:"icons/fangs.webp",system:{description:{value:"Nova descrição"}},effects:[],flags:{[ns]:{modificador:"Perfurante",equipmentPdn:{version:1,previousImg:"generic.svg",descriptionHashesBefore:[npcEquipmentFingerprint(description)]}}}});
 const attack={type:"attack",activation:{type:"action"},consumption:{targets:[{target:"energy.generated",value:"3"}]},damage:{parts:[{custom:{formula:"10d10 + @mod"}}]}};
 const item={_id:"owned",type:"weapon",img:"generic.svg",system:{description:{value:description},activities:{attack},equipped:true},flags:{[ns]:{ataqueNatural:true,custoPA:3,modificador:"undefined"}}};
 const patch=equipmentCopyPatch(item,source);assert.equal(patch["system.activities"].attack.activation.value,3);assert.deepEqual(patch["system.activities"].attack.consumption.targets,[]);
 assert.equal(patch["system.activities"].attack.damage.parts[0].custom.formula,"10d10 + @mod");assert.equal(patch.img,"icons/fangs.webp");
 item.system.activities.attack.activation.value=5;item.system.description.value="Texto personalizado";
 const custom=equipmentCopyPatch(item,source);assert.equal(custom["system.activities"],undefined);assert.equal(custom["system.description.value"],undefined);
});
test("profile defaults migrate once and never restore choices deliberately cleared after migration",()=>{
 const canonical=profile(),item=canonical.toObject();item._id="copy";item.system.equipamentos={armadura:old,armas:[]};delete item.flags[ns].equipmentPdn;
 const before=structuredClone(item.system.habilidades),patch=profileCopyPatch(item,canonical);
 assert.deepEqual(patch["system.equipamentos"],canonical.system.equipamentos);assert.deepEqual(item.system.habilidades,before);
 item.flags[ns].equipmentPdn={version:1};item.system.equipamentos={armadura:canonical.system.equipamentos.armadura,armas:[]};
 assert.equal(profileCopyPatch(item,canonical),null);
 item.flags[ns].equipmentPdn=undefined;item.system.equipamentos={armadura:"Item.manualArmor",armas:["Item.manualWeapon"]};
 assert.deepEqual(profileCopyPatch(item,canonical)["system.equipamentos"],item.system.equipamentos);
});
test("ready migration refreshes only proven copies in world/player/NPC/token documents and is idempotent",async()=>{
 const canonical=profile(),copy=doc(canonical.toObject());copy._id="copy";delete copy.flags[ns].equipmentPdn;copy.system.equipamentos={armadura:old,armas:[]};
 const writes=[],syncs=[],npc={type:"npc",items:[copy],async updateEmbeddedDocuments(type,patches){assert.equal(type,"Item");writes.push(patches);for(const p of patches)await copy.update(p);}};
 const manual=doc({...copy.toObject(),_id:"manual",flags:{}});
 const world={user:{id:"gm",isGM:true},users:{activeGM:{id:"gm"}},packs:new Map([[NPC_EQUIPMENT_PACK,{getDocuments:async()=>[sourceGear()]}],[NPC_PROFILE_PACK,{getDocuments:async()=>[canonical]}]]),
  items:[manual],actors:[npc],scenes:[{tokens:[{actorLink:false,actor:npc}]}]};
 await refreshNpcEquipment(world,{sync:async actor=>syncs.push(actor)});assert.equal(writes.length,1);assert.deepEqual(copy.system.equipamentos,canonical.system.equipamentos);
 assert.equal(manual.system.equipamentos.armadura,old);await refreshNpcEquipment(world,{sync:async()=>{}});assert.equal(writes.length,1);
 assert.equal(syncs.length,1);
});
test("unpublished canonical profiles cannot mark an incomplete migration as complete",()=>{
 const canonical=profile(),item=canonical.toObject();delete item.flags[ns].equipmentPdn;
 item.system.equipamentos={armadura:old,armas:[]};
 delete canonical.flags[ns].equipmentPdn;canonical.system.equipamentos.armas=[];
 assert.equal(profileCopyPatch(item,canonical),null);
 canonical.flags[ns].equipmentPdn={version:1};canonical.system.equipamentos.armas=[npcEquipmentUuid("bite")];
 assert.deepEqual(profileCopyPatch(item,canonical)["system.equipamentos"].armas,[npcEquipmentUuid("bite")]);
});
