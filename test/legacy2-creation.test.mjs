import assert from "node:assert/strict";
import { test } from "node:test";
import Ruleset from "../module/systems/ruleset.mjs";
import { carregarGrafo } from "../module/systems/especializacoes-2.mjs";
globalThis.game = { settings: { get: () => "2.0" } };
globalThis.CONFIG = { JUJUTSU: { trainingPoints: { criacao: 4 } } };
const creation = await import("../module/applications/actor/creation/creation-model-2.mjs").catch(() => ({}));
const style = { uuid: "Compendium.test.Item.style", name: "Lutador", type: "class", flags: { "jujutsu-system": { legacy2: {
  vidaBase: 7, energiaBase: 10, atributoPrincipal: "str", espIniciais: 2, proficiencias: { armas: 2, salvaguardas: 2, pericias: 3 }
} } } };
const species = { uuid: "Compendium.test.Item.species", name: "Feitiço Inato", type: "race", system: {} };
const actor = { name: "Teste", img: "portrait.webp", prototypeToken: { texture: { src: "token.webp" } }, type: "character", isOwner: true, items: [], getFlag() {} };
test("new creation starts with a local draft and exactly three stages", () => {
  assert.equal(typeof creation.creationDraft,"function");
  const draft = creation.creationDraft(actor);
  assert.equal(creation.CREATION_STEPS.length,3);
  assert.equal(Object.values(draft.abilities).reduce((a,b)=>a+b,0),6);
  assert.equal(draft.img,"portrait.webp"); assert.equal(draft.tokenImg,"token.webp");
  assert.equal(actor.items.length,0);
});
test("creation budgets come from style metadata and attribute creation is 20 points with cap six", () => {
  assert.equal(typeof creation.creationBudgets,"function");
  assert.deepEqual(creation.creationBudgets(style),{ attributes:20, attributeMax:6, specializations:2, armas:2, saves:2, skills:3 });
  const edited=structuredClone(style); edited.flags["jujutsu-system"].legacy2.espIniciais=5;
  assert.equal(creation.creationBudgets(edited).specializations,5);
});
test("rank allocation rejects overspending and invalid keys while spending one point per rank", () => {
  assert.equal(typeof creation.allocateCreationRank,"function");
  const draft=creation.creationDraft(actor);
  assert(creation.allocateCreationRank(draft,style,"armas","simpleM",2));
  assert(!creation.allocateCreationRank(draft,style,"armas","martialM",1));
  assert(!creation.allocateCreationRank(draft,style,"saves","invalid",1));
  assert.equal(draft.proficiencies.armas.simpleM,2);
  assert(creation.allocateCreationRank(draft,style,"armas","simpleM",0));
});
test("style changes clear dependent choices and allocations without changing the actor", () => {
  assert.equal(typeof creation.chooseCreationStyle,"function");
  const draft=creation.creationDraft(actor); draft.specializations=["A"]; draft.proficiencies.skills.ath=3;
  creation.chooseCreationStyle(draft,style);
  assert.equal(draft.style,style.uuid); assert.deepEqual(draft.specializations,[]);
  assert.equal(draft.proficiencies.skills.ath,0);
});
test("automatic opening only handles local fresh 2.0 character creation", () => {
  assert.equal(typeof creation.shouldOpenCreation,"function");
  assert(creation.shouldOpenCreation(actor,{},"me","me",true));
  for(const options of [{fromCompendium:true},{keepId:true},{noHook:true}])assert(!creation.shouldOpenCreation(actor,options,"me","me",true));
  assert(!creation.shouldOpenCreation(actor,{},"other","me",true));
  assert(!creation.shouldOpenCreation({...actor,type:"npc"},{},"me","me",true));
  assert(!creation.shouldOpenCreation({...actor,items:[species]},{},"me","me",true));
  assert(!creation.shouldOpenCreation({...actor,_stats:{duplicateSource:"Actor.original"}},{},"me","me",true));
  assert(!creation.shouldOpenCreation(actor,{},"me","me",false));
});
test("normal sheet proficiency totals agree with the initial style pools and later level increases", () => {
  const a={system:{details:{level:1},legacy2:{pontos:{gastos:7}}},itemTypes:{class:[{getFlag:()=>style.flags["jujutsu-system"].legacy2}]}};
  assert.equal(Ruleset.trainingPointsTotal(a),7);
  assert.equal(Ruleset.trainingPointsAvailable(a),0);
  a.system.details.level=2;assert.equal(Ruleset.trainingPointsAvailable(a),1);
});
test("specializations respect native prerequisites and removing a prerequisite clears dependent choices", async () => {
  assert.equal(typeof creation.toggleCreationSpecialization,"function");
  const docs=[{name:"Base",uuid:"Compendium.test.Item.base",flags:{"jujutsu-system":{especializacao:{categoria:"Proezas Físicas",caminho:"Caminho",requisitos:[]}}},system:{}},
    {name:"Avançada",uuid:"Compendium.test.Item.advanced",flags:{"jujutsu-system":{especializacao:{categoria:"Proezas Físicas",caminho:"Caminho",requisitos:["Base"]}}},system:{}}];
  game.packs=new Map([["jujutsu-compendium.geral-2-0",{getDocuments:async()=>docs}]]);
  const graph=await carregarGrafo(),catalog={graph};
  const draft=creation.creationDraft(actor);creation.chooseCreationStyle(draft,style);
  assert(!creation.toggleCreationSpecialization(draft,style,graph.porNome.get("Avançada"),catalog));
  assert(creation.toggleCreationSpecialization(draft,style,graph.porNome.get("Base"),catalog));
  assert(creation.toggleCreationSpecialization(draft,style,graph.porNome.get("Avançada"),catalog));
  assert.deepEqual(draft.specializations,["Base","Avançada"]);
  creation.toggleCreationSpecialization(draft,style,graph.porNome.get("Base"),catalog);
  assert.deepEqual(draft.specializations,[]);
});
test("initial specialization choices honor the category or path stated in the style",()=>{
  const fighter=structuredClone(style);fighter.system={description:{value:'<p><strong>Habilidades de Especialização:</strong> Você recebe 2 habilidades de &quot;Proeza Física&quot;.</p>'}};
  assert.equal(creation.creationSpecializationScope(fighter),"Proeza Física");
  const draft=creation.creationDraft(actor);
  assert.equal(creation.evaluateCreationSpecialization(draft,fighter,{nome:"Inato",categoria:"Feitiço Inato",caminho:"Manipulação",requisitos:[]}).estado,"bloqueado");
  assert.equal(creation.evaluateCreationSpecialization(draft,fighter,{nome:"Física",categoria:"Proezas Físicas",caminho:"Força",requisitos:[]}).estado,"disponivel");
  fighter.system.description.value='Habilidades de Especialização: Você recebe 2 habilidade de "Novo Estilo das Sombras".';
  assert.equal(creation.evaluateCreationSpecialization(draft,fighter,{nome:"Barreira",categoria:"Técnicas de Barreira",caminho:"Barreiras",requisitos:[]}).estado,"bloqueado");
  assert.equal(creation.evaluateCreationSpecialization(draft,fighter,{nome:"Sombras",categoria:"Domínio e Anti-Domínio",caminho:"Novo Estilo das Sombras",requisitos:[]}).estado,"disponivel");
});
test("Restringido metadata keeps its selectable primary attribute consistent with the completed sheet",()=>{
  const restricted=structuredClone(style);Object.assign(restricted.flags["jujutsu-system"].legacy2,{atributoPrincipal:"str",principalEscolhivel:true});
  const draft=creation.creationDraft(actor);creation.chooseCreationStyle(draft,restricted);draft.primary="dex";
  assert.deepEqual(creation.creationPrimaryOptions(restricted),["str","dex"]);
  assert.equal(Ruleset.atributoPrincipal(creation.creationActor(draft,restricted)),"dex");
});
