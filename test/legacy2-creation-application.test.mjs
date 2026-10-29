import assert from "node:assert/strict";
import { test } from "node:test";
globalThis.document={querySelector:()=>true,createElement:()=>({}),head:{append(){}}};
class ApplicationBoundary {
  static _maxZ=100;
  constructor(options={}) { this.options=options;this.id=options.id??"creation";this.element={querySelectorAll:()=>[]}; }
  async _prepareContext(){return {};}
  async render(){this.renders=(this.renders??0)+1;return this;}
  async close(){this.closed=true;return this;}
}
globalThis.foundry={applications:{api:{ApplicationV2:ApplicationBoundary,HandlebarsApplicationMixin:C=>C},ux:{TextEditor:{implementation:{enrichHTML:async html=>html}}}}};
globalThis.game={settings:{get:()=>"2.0"},packs:new Map(),items:[],user:{id:"me"}};
globalThis.CONFIG={};
const {default:Creation}=await import("../module/applications/actor/creation/character-creation-2.mjs");
const actor=id=>({id,name:"Inicial",type:"character",isOwner:true,items:[],getFlag(){},sheet:{render(){}}});
test("every creator action is registered and the Life/Energy penalty buttons update the draft",()=>{
  for(const [name,action] of Object.entries(Creation.DEFAULT_OPTIONS.actions))assert.equal(typeof action,"function",name);
  const app=new Creation(actor("vital-penalty"));
  Creation.DEFAULT_OPTIONS.actions.penalidadeVital.call(app,{}, {dataset:{valor:"vida"}});
  assert.equal(app.draft.penalidadeVital,"vida");
  Creation.DEFAULT_OPTIONS.actions.penalidadeVital.call(app,{}, {dataset:{valor:"energia"}});
  assert.equal(app.draft.penalidadeVital,"energia");
  app.busy=true;Creation.DEFAULT_OPTIONS.actions.penalidadeVital.call(app,{}, {dataset:{valor:"vida"}});
  assert.equal(app.draft.penalidadeVital,"energia");
});
test("forward navigation validates the previous stage instead of skipping required choices",()=>{
  const app=new Creation(actor("navigation"));app.catalog={species:[],styles:[],graph:{porNome:new Map()},customization:{}};
  app.changeStep(1);assert.equal(app.draft.step,0);assert(app.errors.length>0);
});
test("the Restringido proficiency panel disables every positive Feitiçaria rank",async()=>{
  const app=new Creation(actor("restricted-skills"));
  const style={uuid:"Item.restricted",name:"Restringido",system:{identifier:"restringido"},flags:{"jujutsu-system":{legacy2:{espIniciais:1}}}};
  app.catalog={styles:[style],species:[],graph:{porNome:new Map(),categorias:[]},customization:Object.fromEntries(Object.keys(app.draft.customization).map(key=>[key,[]]))};
  app.draft.style=style.uuid;
  const context=await app._prepareContext({});
  const row=context.proficiencyPanels.find(panel=>panel.category==="skills").rows.find(row=>row.key==="arc");
  assert(row.dots.filter(dot=>dot.value>0).every(dot=>dot.disabled));assert.equal(row.dots[0].disabled,false);
});
test("Imaculado disables the Restringido card and its action refuses the incompatible choice",async()=>{
  const app=new Creation(actor("blocked-combination"));
  const restricted={uuid:"Item.restricted",name:"Restringido",system:{identifier:"restringido"},flags:{"jujutsu-system":{legacy2:{espIniciais:1}}}};
  const origin={uuid:"Item.imaculado",name:"Imaculado",type:"race",system:{identifier:"imaculado"}};
  app.catalog={styles:[restricted],species:[origin],graph:{porNome:new Map(),categorias:[]},customization:Object.fromEntries(Object.keys(app.draft.customization).map(key=>[key,[]]))};
  app.draft.species=origin.uuid;
  await Creation.DEFAULT_OPTIONS.actions.style.call(app,{}, {dataset:{uuid:restricted.uuid}});
  assert.equal(app.draft.style,null);assert(app.errors[0].message.includes("Imaculado não pode"));
  const context=await app._prepareContext({});
  assert.equal(context.styleCards[0].unavailable,true);assert(context.styleCards[0].unavailableReason.includes("Canalização"));
});
test("closing directly captures unblurred inputs and resumes the same local draft without actor writes",async()=>{
  const a=actor("resume"),app=new Creation(a);
  app.element={querySelectorAll:()=>[{dataset:{creationField:"name"},value:"Nome editado"}]};
  await app.close();
  assert.equal(a.name,"Inicial");
  const resumed=new Creation(a);assert.equal(resumed.draft.name,"Nome editado");
});
test("a pending finish cannot be closed halfway through its native transaction",async()=>{
  const app=new Creation(actor("busy"));app.busy=true;
  await app.close();assert.equal(app.closed,undefined);
  app.busy=false;await app.close();assert.equal(app.closed,true);
});
test("creator instances have unique IDs when multiple actors are created",()=>{
  assert.notEqual(new Creation(actor("first")).id,new Creation(actor("second")).id);
});
test("native image picker and portrait copying edit the draft while actor images remain untouched",()=>{
  let picker;
  foundry.applications.apps={FilePicker:{implementation:class{constructor(options){picker=options;}browse(){}}}};
  const a={...actor("images"),img:"old.webp",prototypeToken:{texture:{src:"old-token.webp"}}},app=new Creation(a);
  app.pickImage("img");assert.equal(picker.type,"image");assert.equal(picker.current,"old.webp");picker.callback("new.webp");
  Creation.onCopyPortrait.call(app);assert.equal(app.draft.tokenImg,"new.webp");assert.equal(a.img,"old.webp");assert.equal(a.prototypeToken.texture.src,"old-token.webp");
});
test("customization drop moves a source between groups without assigning it twice",async()=>{
  const app=new Creation(actor("customization"));app.catalog={customization:Object.fromEntries(Object.keys(app.draft.customization).map(k=>[k,[]]))};
  const doc={uuid:"Item.custom",name:"Característica",type:"feat"};
  await app.addCustomization(doc,"jj-flaws");await app.addCustomization(doc,"jj-peculiarities");
  assert.deepEqual(app.draft.customization["jj-flaws"],[]);assert.deepEqual(app.draft.customization["jj-peculiarities"],[doc.uuid]);
});

// Exercise the actual Finish handler, with the completion service as its boundary.
const finishWith = commit => new Function("validateCreation","commitCreation","resolveCreationDocument",
  `return ({${Creation.onFinish.toString()}}).onFinish;`)(()=>[],commit,async()=>null);
test("Finish restores the fullscreen creator when advancement choices are cancelled",async()=>{
  const app=new Creation(actor("cancel-advancement"));app.catalog={};app.element.style={};
  const original=structuredClone(app.draft);
  await finishWith(async(a,draft)=>{
    assert.equal(a,app.actor);assert.notEqual(draft,app.draft);
    assert.equal(app.element.style.visibility,"hidden");assert.equal(app.busy,true);return null;
  }).call(app);
  assert.equal(app.busy,false);assert.equal(app.closed,undefined);assert.equal(app.element.style.visibility,"");
  assert.deepEqual(app.draft,original);
});
test("Finish closes and notifies only after completion succeeds",async()=>{
  const app=new Creation(actor("finish-advancement"));app.catalog={};app.element.style={};let notices=0;
  globalThis.ui={notifications:{info(){notices++;}}};
  await finishWith(async()=>({actor:{},create:[]})).call(app);
  assert.equal(app.busy,false);assert.equal(app.closed,true);assert.equal(notices,1);
});
test("Finish restores visibility and allows retry after a completion error",async()=>{
  const app=new Creation(actor("fail-advancement"));app.catalog={};app.element.style={};
  await finishWith(async()=>{throw new Error("Benefício indisponível");}).call(app);
  assert.equal(app.busy,false);assert.equal(app.closed,undefined);assert.equal(app.element.style.visibility,"");
  assert.equal(app.errors[0].message,"Benefício indisponível");
});

test("the embedded tree uses the creator's local choices and inspects future and cross-category requirements",async()=>{
  const {carregarGrafo}=await import("../module/systems/especializacoes-2.mjs");
  const docs=[["Base","Proezas Físicas",[]],["Futura","Proezas Físicas",["Base","10º nível de personagem"]],["Cura","Energia Reversa",["Base"]]]
    .map(([name,categoria,requisitos],i)=>({name,uuid:`Item.graph${i}`,system:{},flags:{"jujutsu-system":{especializacao:{categoria,requisitos,caminho:"Caminho"}}}}));
  game.packs=new Map([["jujutsu-compendium.geral-2-0",{getDocuments:async()=>docs}]]);
  const graph=await carregarGrafo(),app=new Creation(actor("tree"));
  const style={uuid:"Item.style",name:"Estilo",flags:{"jujutsu-system":{legacy2:{espIniciais:2,atributoPrincipal:"str"}}}};
  app.catalog={graph,species:[],styles:[style],customization:Object.fromEntries(Object.keys(app.draft.customization).map(key=>[key,[]]))};
  app.draft.style=style.uuid;app.draft.primary="str";app.draft.step=1;app.category="Proezas Físicas";
  await Creation.DEFAULT_OPTIONS.actions.selecionar.call(app,{}, {dataset:{nome:"Futura"}});
  let context=await app._prepareContext({});assert.equal(context.tree.selecionado.nome,"Futura");assert.equal(context.tree.selecionado.canChoose,false);
  await Creation.DEFAULT_OPTIONS.actions.aprender.call(app,{}, {dataset:{nome:"Futura"}});assert.deepEqual(app.draft.specializations,[]);
  await Creation.DEFAULT_OPTIONS.actions.aprender.call(app,{}, {dataset:{nome:"Base"}});assert.deepEqual(app.draft.specializations,["Base"]);
  await Creation.DEFAULT_OPTIONS.actions.categoria.call(app,{}, {dataset:{categoria:"Energia Reversa"}});
  await Creation.DEFAULT_OPTIONS.actions.selecionar.call(app,{}, {dataset:{nome:"Cura"}});
  context=await app._prepareContext({});assert.equal(context.tree.requisitos[0].links[0].categoria,"Proezas Físicas");
  await Creation.DEFAULT_OPTIONS.actions.requisito.call(app,{}, {dataset:{nome:"Base"}});
  assert.equal(app.category,"Proezas Físicas");assert.equal(app.focus,"Base");assert.equal(app._focusMap,"Base");
  await Creation.DEFAULT_OPTIONS.actions.esquecer.call(app,{}, {dataset:{nome:"Base"}});assert.deepEqual(app.draft.specializations,[]);
  assert.equal(app.actor.items.length,0);
});
