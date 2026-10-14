import assert from "node:assert/strict";
import { test } from "node:test";
import { updateEnergyShieldTree, registerEnergyShieldTreeUpdate } from "../module/systems/legacy2-energy-shield-tree.mjs";
import { carregarGrafo, avaliarNo } from "../module/systems/especializacoes-2.mjs";
import { construirMapaCategoria } from "../module/applications/actor/jj/skill-tree-map-2.mjs";
const requirements=["Canalização Amplificadora","Canalização de Combate"];
function fixture({existing=true,version="2.0",gm=true}={}) {
  const calls=[],docs=requirements.map((name,i)=>({_id:String(i),name,type:"feat",uuid:`Compendium.jujutsu-compendium.geral-2-0.Item.${i}`,folder:"canalizacao",flags:{"jujutsu-system":{especializacao:{categoria:"Proezas Físicas",caminho:"Canalização de Energia",requisitos:[]}}}}));
  const shield={_id:"existing-shield",name:"Escudo de Energia",type:"feat",img:"user-icon.webp",folder:"user-folder",uuid:"Compendium.jujutsu-compendium.geral-2-0.Item.existing-shield",system:{identifier:"escudo-de-energia",description:{value:"Texto antigo"},activities:{owned:true}},effects:[{_id:"custom-effect"}],flags:{"custom-module":{keep:true}}};
  const apply=(doc,update)=>{for(const [key,value] of Object.entries(update)){const parts=key.split('.'),last=parts.pop();let obj=doc;for(const part of parts)obj=obj[part]??={};obj[last]=structuredClone(value);}};
  shield.update=async update=>{calls.push(['update',update]);apply(shield,update);return shield;};if(existing)docs.push(shield);
  const pack={collection:"jujutsu-compendium.geral-2-0",locked:true,getDocuments:async()=>docs,configure:async options=>{calls.push(['configure',options]);pack.locked=options.locked;},documentClass:{create:async(data,options)=>{calls.push(['create',data,options]);const doc={...structuredClone(data),uuid:`Compendium.jujutsu-compendium.geral-2-0.Item.${data._id}`};doc.update=async update=>apply(doc,update);docs.push(doc);return doc;}}};
  globalThis.game={user:{id:"gm",isGM:gm},users:{activeGM:{id:"gm"}},items:[],packs:{get:()=>pack},settings:{get:(scope,key)=>key==="rulesetVersion"?version:key==="especializacoesReq"?{}:false}};
  return {pack,docs,shield,calls};
}
test("existing Escudo is registered once with both prerequisites without replacing artwork, activities or effects",async()=>{
  const {pack,shield,calls}=fixture();await Promise.all([updateEnergyShieldTree(),updateEnergyShieldTree()]);
  assert.equal(calls.filter(call=>call[0]==='update').length,1);assert.equal(calls.filter(call=>call[0]==='create').length,0);assert.equal(pack.locked,true);
  assert.equal(shield.img,"user-icon.webp");assert.equal(shield.folder,"user-folder");assert.deepEqual(shield.effects,[{_id:"custom-effect"}]);assert.deepEqual(shield.system.activities,{owned:true});assert(shield.flags['custom-module'].keep);
  assert.deepEqual(shield.flags['jujutsu-system'].especializacao,{categoria:"Proezas Físicas",caminho:"Canalização de Energia",requisitos:requirements});
  assert.match(shield.system.description.value,/início de cada um de seus turnos/);assert.match(shield.system.description.value,/1 Ponto de Ação.*2 PA/);assert.match(shield.system.description.value,/\+2 de CR.*\+1/);
  shield.system.description.value="Edição posterior do autor";await updateEnergyShieldTree();assert.equal(shield.system.description.value,"Edição posterior do autor");
});
test("missing item is created in the existing channeling folder, while 1.0 and non-GMs never write",async()=>{
  const f=fixture({existing:false});await updateEnergyShieldTree();const item=f.docs.find(doc=>doc.name==='Escudo de Energia');assert(item);assert.equal(item.type,'feat');assert.equal(item.folder,'canalizacao');assert.equal(f.calls.filter(call=>call[0]==='create').length,1);assert.equal(f.pack.locked,true);
  for(const options of [{version:'1.0'},{gm:false}]){const skipped=fixture(options);await updateEnergyShieldTree();assert.equal(skipped.calls.length,0);}
});
test("failed updates restore the compendium lock and can retry",async()=>{
  const f=fixture();const update=f.shield.update;f.shield.update=async()=>{throw Error('write failed')};await assert.rejects(updateEnergyShieldTree(),/write failed/);assert.equal(f.pack.locked,true);
  f.shield.update=update;await updateEnergyShieldTree();assert(f.shield.flags['jujutsu-system'].especializacao);
});
test("an Escudo authored outside the compendium supplies its existing icon and content without changing the world item",async()=>{
  const f=fixture({existing:false}),source={_id:'world-shield',name:'Escudo de Energia',type:'feat',img:'custom-shield-icon.webp',folder:'world-folder',system:{identifier:'escudo-de-energia',activities:{custom:true}},effects:[{_id:'world-effect'}],flags:{'custom-module':{keep:true}}};
  const before=structuredClone(source);game.items=[{...source,toObject:()=>structuredClone(source)}];
  await updateEnergyShieldTree();const copy=f.docs.find(doc=>doc.name==='Escudo de Energia');assert.equal(copy.img,source.img);assert.deepEqual(copy.system.activities,source.system.activities);assert.deepEqual(copy.effects,source.effects);assert(copy.flags['custom-module'].keep);assert.equal(copy.folder,'canalizacao');assert.deepEqual(source,before);
});
test("real graph draws both prerequisites and requires learning both before unlocking Escudo",async()=>{
  fixture();await updateEnergyShieldTree();const graph=await carregarGrafo(),node=graph.porNome.get('Escudo de Energia');assert(node);
  const category=graph.categorias.find(category=>category.nome==='Proezas Físicas'),map=construirMapaCategoria(category,graph.porNome);
  assert.deepEqual(map.linhas.filter(line=>line.para==='Escudo de Energia').map(line=>line.de).sort(),[...requirements].sort());
  const actor=learned=>({getFlag:(scope,key)=>key==='especializacoes'?learned:undefined,items:[],system:{details:{level:1},legacy2:{}}});
  assert.equal(avaliarNo(actor([]),node).estado,'bloqueado');assert.equal(avaliarNo(actor([requirements[0]]),node).estado,'bloqueado');assert.equal(avaliarNo(actor(requirements),node).estado,'disponivel');
});
test("registration schedules the native document update after the system is ready",()=>{
  const hooks=[];registerEnergyShieldTreeUpdate({once:(event,callback)=>hooks.push({event,callback})});assert.equal(hooks.length,1);assert.equal(hooks[0].event,'dnd5e.ready');assert.equal(typeof hooks[0].callback,'function');
});
