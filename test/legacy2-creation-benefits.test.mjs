import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { creationBudgets, creationSpecializationSlots, creationDraft, chooseCreationStyle, allocateCreationRank,
  creationPodeEscolher, validateCreation, creationCombinationError } from "../module/applications/actor/creation/creation-model-2.mjs";
import { prepareCreationCompletion } from "../module/applications/actor/creation/creation-completion-2.mjs";
import { carregarGrafo, escolhasTotais } from "../module/systems/especializacoes-2.mjs";
import Ruleset from "../module/systems/ruleset.mjs";
import { CharacterBoundary, NativeManager } from "./helpers/creation-native-boundary.mjs";
import { commitCreation } from "../module/applications/actor/creation/creation-completion-2.mjs";

globalThis.game={settings:{get:(_scope,key)=>key==="rulesetVersion"?"2.0":{}}};
globalThis.CONFIG={JUJUTSU:{trainingPoints:{criacao:4}}};
const snapshot=JSON.parse(readFileSync(new URL("./fixtures/creation-combat-styles.json",import.meta.url)));
const docs=snapshot.docs,style=name=>docs.find(doc=>doc.type==="class"&&doc.name===name),origin=name=>docs.find(doc=>doc.type==="race"&&doc.name===name);
game.packs=new Map([["jujutsu-compendium.geral-2-0",{getDocuments:async()=>snapshot.graph.map(node=>({name:node.nome,uuid:node.uuid,
  flags:{"jujutsu-system":{especializacao:node}}}))}]]);
const graph=await carregarGrafo();
const resolve=async uuid=>docs.find(doc=>doc.uuid===uuid||doc._id===uuid?.split(".").at(-1))
  ?? (()=>{const node=snapshot.graph.find(node=>node.uuid===uuid);return node&&{_id:uuid.split(".").at(-1),uuid,name:node.nome,type:"feat",system:{},flags:{}};})();

function fixture(combat,species,path=null){
  const actor={name:"Teste",type:"character",isOwner:true,items:[],system:{},getFlag(){}};
  const draft=creationDraft(actor);chooseCreationStyle(draft,combat);
  Object.assign(draft,{species:species.uuid,caminho:path,abilities:{str:6,dex:3,con:4,int:3,wis:2,cha:2}});
  const catalog={styles:[combat],species:[species],graph,customization:Object.fromEntries(Object.keys(draft.customization).map(key=>[key,[]]))};
  const budget=creationBudgets(combat,path,species);
  for(const group of ["armas","saves","skills"])draft.proficiencies[group][Object.keys(draft.proficiencies[group])[0]]=budget[group];
  function choose(){
    if(draft.specializations.length===budget.specializations)return true;
    for(const node of graph.porNome.values()){
      if(draft.specializations.includes(node.nome)||!creationPodeEscolher(draft,combat,node,catalog))continue;
      draft.specializations.push(node.nome);if(choose())return true;draft.specializations.pop();
    }return false;
  }
  assert(choose());return {actor,draft,catalog};
}

test("Especialista receives its two base choices plus the immediate Feitiço Inato choice",()=>{
  assert.equal(creationSpecializationSlots(style("Especialista"),null,origin("Feitiço Inato")).total,3);
});
test("Imaculado adds two restricted Channeling choices on top of either style",()=>{
  const fighter=creationSpecializationSlots(style("Lutador"),"punho-ardente",origin("Imaculado"));
  assert.equal(fighter.total,4);assert.equal(fighter.grupos.find(group=>group.id==="origem-canalizacao").quantidade,2);
  assert.equal(creationSpecializationSlots(style("Especialista"),null,origin("Imaculado")).total,5);
});
test("the final character keeps every granted specialization slot, including later-level budgets",async()=>{
  const f=fixture(style("Especialista"),origin("Imaculado"));
  assert.equal(f.draft.specializations.length,5);
  assert.equal(f.draft.specializations.filter(name=>graph.porNome.get(name).caminho==="Canalização de Energia").length,2);
  assert.deepEqual(validateCreation(f.draft,f.catalog),[]);
  let id=0;const plan=await prepareCreationCompletion(f.actor,f.draft,f.catalog,{resolve,idFactory:()=>`creation${++id}`});
  assert.equal(plan.actor["flags.jujutsu-system.especializacoes"].length,5);
  const actor={system:{details:{level:1}},itemTypes:{class:[{getFlag:()=>style("Especialista").flags["jujutsu-system"].legacy2}]},
    getFlag:(_scope,key)=>key==="caminhoEstilo"?plan.actor["flags.jujutsu-system.caminhoEstilo"]:undefined};
  assert.equal(escolhasTotais(actor),5);actor.system.details.level=2;assert.equal(escolhasTotais(actor),7);
});
test("Mestre das Armas adds two weapon points and requires both in the same type",async()=>{
  const fighter=style("Lutador");assert.equal(creationBudgets(fighter,"mestre-armas").armas,3);
  const f=fixture(fighter,origin("Feitiço Inato"),"mestre-armas");
  Object.assign(f.draft.proficiencies.armas,{martialM:1,simpleM:1,simpleR:1});
  assert(validateCreation(f.draft,f.catalog).some(error=>error.message.includes("Maestria")));
  Object.assign(f.draft.proficiencies.armas,{martialM:2,simpleM:1,simpleR:0});
  assert.deepEqual(validateCreation(f.draft,f.catalog),[]);
  let id=0;const plan=await prepareCreationCompletion(f.actor,f.draft,f.catalog,{resolve,idFactory:()=>`creation${++id}`});
  const actor={system:{details:{level:1},legacy2:{pontos:{gastos:plan.actor["system.legacy2.pontos.gastos"]}}},
    itemTypes:{class:[{getFlag:()=>fighter.flags["jujutsu-system"].legacy2}]},
    getFlag:(_scope,key)=>key==="caminhoEstilo"?plan.actor["flags.jujutsu-system.caminhoEstilo"]:undefined};
  assert.equal(Ruleset.trainingPointsTotal(actor),6);assert.equal(Ruleset.trainingPointsAvailable(actor),0);
  actor.system.details.level=2;assert.equal(Ruleset.trainingPointsAvailable(actor),1);
});
test("Restringido cannot allocate or finish with initial Feitiçaria proficiency",()=>{
  const restricted=style("Restringido"),f=fixture(restricted,origin("Feitiço Inato"));
  f.draft.proficiencies.skills.ath=2;
  assert.equal(allocateCreationRank(f.draft,restricted,"skills","arc",1),false);
  Object.assign(f.draft.proficiencies.skills,{ath:0,arc:3});
  assert(validateCreation(f.draft,f.catalog).some(error=>error.message.includes("Feitiçaria")));
});
test("Imaculado and Restringido are blocked together at validation and before any commit",async()=>{
  const f=fixture(style("Restringido"),origin("Feitiço Inato")),imaculado=origin("Imaculado");
  assert(creationCombinationError(style("Restringido"),imaculado));
  assert.equal(creationCombinationError(style("Lutador"),imaculado),null);
  f.draft.species=imaculado.uuid;f.catalog.species.push(imaculado);
  assert(validateCreation(f.draft,f.catalog).some(error=>error.message.includes("Imaculado não pode")));
  await assert.rejects(prepareCreationCompletion(f.actor,f.draft,f.catalog,{resolve}),/Imaculado não pode/);
  assert.equal(f.actor.items.length,0);
});

// Model the numeric initial transfers performed by Foundry, then use the real
// resource formulas. This catches storing a bonus and transferring it again.
class OriginEffectsBoundary extends CharacterBoundary {
  clone(){return new OriginEffectsBoundary(this.data);}
  reset(){
    super.reset();
    for(const item of this.data.items)for(const effect of item.effects??[]){
      if(!effect.transfer||effect.disabled)continue;
      for(const change of effect.system?.changes??effect.changes??[]){
        if(!["system.legacy2.pvEspecie","system.legacy2.energiaEspecie"].includes(change.key))continue;
        if(change.type!=="add"&&Number(change.mode)!==2)continue;
        const key=change.key.split(".").at(-1);
        this.system.legacy2??={};this.system.legacy2[key]=(Number(this.system.legacy2[key])||0)+Number(change.value);
      }
    }
    this.system.attributes.hp.effectiveMax=Ruleset.maxHitPoints(this);this.system.energy.max=Ruleset.maxEnergy(this);
  }
}
test("native preview and persisted Imaculado resources count the transferred origin bonus once",async()=>{
  const f=fixture(style("Especialista"),origin("Imaculado"));
  const actor=new OriginEffectsBoundary();
  const result=await commitCreation(actor,f.draft,f.catalog,{resolve,Manager:NativeManager,idFactory:foundry.utils.randomID});
  assert(result);assert.equal(actor.writes,1);
  assert.equal(actor.data.system.legacy2.pvEspecie,0);assert.equal(actor.data.system.legacy2.energiaEspecie,0);
  assert.equal(actor.system.attributes.hp.effectiveMax,34);assert.equal(actor.system.attributes.hp.value,34);
  assert.equal(actor.system.energy.max,17);assert.equal(actor.system.energy.total+actor.system.energy.generated,17);
});
