import assert from "node:assert/strict";
import { test } from "node:test";
import { carregarGrafo } from "../module/systems/especializacoes-2.mjs";
import { creationDraft, chooseCreationStyle, toggleCreationSpecialization } from "../module/applications/actor/creation/creation-model-2.mjs";
import { buildCreationTree } from "../module/applications/actor/creation/creation-tree-2.mjs";
import { construirMapaCategoria } from "../module/applications/actor/jj/skill-tree-map-2.mjs";
import { SkillTreeViewport } from "../module/applications/actor/jj/skill-tree-viewport-2.mjs";

const style={uuid:"Item.style",name:"Estilo de teste",flags:{"jujutsu-system":{legacy2:{espIniciais:2,atributoPrincipal:"str"}}}};
const actor={name:"Teste",system:{},getFlag(){}};
const docs=[
  ["Base","Corpo",[],"Proezas Físicas"],
  ["Avançada","Corpo",["Base"],"Proezas Físicas"],
  ["Futura","Corpo",["Avançada","10º nível de personagem"],"Proezas Físicas"],
  ["Outra entrada","Energia",[],"Proezas Físicas"],
  ["Reversa","Cura",["Base"],"Energia Reversa"]
].map(([name,caminho,requisitos,categoria],index)=>({name,uuid:`Item.node${index}`,img:`${index}.webp`,system:{},flags:{"jujutsu-system":{especializacao:{caminho,requisitos,categoria}}}}));
globalThis.game={settings:{get:(_scope,key)=>key==="rulesetVersion"?"2.0":{}},packs:new Map([["jujutsu-compendium.geral-2-0",{getDocuments:async()=>docs}]])};
const graph=await carregarGrafo(),catalog={graph};
const draft=()=>{const data=creationDraft(actor);chooseCreationStyle(data,style);return data;};

test("creation shows the whole sheet map, including future abilities and its exact dependency layout",()=>{
  const d=draft(),tree=buildCreationTree(d,style,catalog,{category:"Proezas Físicas",focus:"Futura"});
  const native=construirMapaCategoria(graph.categorias[0],graph.porNome);
  assert.deepEqual(tree.mapa.nos.map(({nome,x,y})=>({nome,x,y})),native.nos.map(({nome,x,y})=>({nome,x,y})));
  assert.deepEqual(tree.mapa.linhas.map(({de,para,d})=>({de,para,d})),native.linhas);
  assert.equal(tree.selecionado.nome,"Futura");assert.equal(tree.selecionado.canChoose,false);
  assert(tree.requisitos.some(requirement=>requirement.texto.includes("10º")&&!requirement.ok));
  assert.equal(tree.categorias.length,2);assert.equal(d.specializations.length,0);
});

test("search highlights results without removing their predecessors or future path",()=>{
  const tree=buildCreationTree(draft(),style,catalog,{category:"Proezas Físicas",search:"avancada"});
  assert.equal(tree.mapa.nos.length,4);assert.equal(tree.searchMatches,1);
  assert.equal(tree.mapa.nos.find(node=>node.nome==="Avançada").searchMatch,true);
  assert.equal(tree.mapa.nos.find(node=>node.nome==="Base").searchDim,true);
  assert.equal(tree.mapa.linhas.length,2);
});

test("choosing and undoing abilities updates draft states and dependency progress only",()=>{
  const d=draft();assert(toggleCreationSpecialization(d,style,graph.porNome.get("Base"),catalog));
  let tree=buildCreationTree(d,style,catalog,{category:"Proezas Físicas",focus:"Avançada"});
  assert.equal(tree.selecionado.canChoose,true);assert.equal(tree.requisitos[0].ok,true);
  assert.equal(tree.mapa.nos[0].estado,"adquirido");assert.equal(tree.categoria.aprendidas,1);
  assert(toggleCreationSpecialization(d,style,graph.porNome.get("Avançada"),catalog));
  tree=buildCreationTree(d,style,catalog,{category:"Proezas Físicas",focus:"Outra entrada"});
  assert.equal(tree.selecionado.canChoose,false);assert.equal(tree.categoria.aprendidas,2);
  toggleCreationSpecialization(d,style,graph.porNome.get("Base"),catalog);
  assert.deepEqual(d.specializations,[]);assert.deepEqual(actor.system,{});
});

test("style restrictions keep other trees inspectable and cross-category requirements navigable",()=>{
  const restricted={...style,flags:{"jujutsu-system":{legacy2:{espIniciais:2,espCategoria:"Proezas Físicas"}}}};
  const tree=buildCreationTree(draft(),restricted,catalog,{category:"Energia Reversa",focus:"Reversa"});
  assert.equal(tree.mapa.nos.length,1);assert.equal(tree.selecionado.canChoose,false);
  assert.deepEqual(tree.requisitos[0].links,[{nome:"Base",categoria:"Proezas Físicas"}]);
  assert.equal(tree.mapa.linhas.length,0);
});

function viewportFixture() {
  const handlers=new Map(),stage={style:{}},label={};
  const viewport={clientWidth:600,clientHeight:400,ownerDocument:{defaultView:{AbortController}},
    classList:{add(){},remove(){}},getBoundingClientRect:()=>({left:0,top:0}),
    addEventListener(name,fn,{signal}){handlers.set(name,fn);signal.addEventListener("abort",()=>handlers.delete(name));}};
  const root={querySelector:selector=>selector===".jj2m-viewport"?viewport:selector===".jj2m-stage"?stage:label};
  const map={largura:1200,altura:800,noLargura:184,noAltura:120,nos:[{nome:"Futura",x:900,y:600}]};
  return {root,map,handlers,stage,label,viewport};
}
test("map zoom preserves its anchor, pan survives selection renders, and category changes reset it",()=>{
  const f=viewportFixture(),view=new SkillTreeViewport();view.mount(f.root,f.map,"Física");
  view.zoomAt(1.5,300,200);assert.equal(view.x,-150);assert.equal(view.y,-100);
  view.mount(f.root,f.map,"Física");assert.equal(view.zoom,1.5);assert.equal(view.x,-150);
  view.fit();assert.equal(view.zoom,.5);assert.equal(view.x,0);assert.equal(view.y,0);
  view.focus("Futura");assert.equal(view.x,300-(900+92)*.5);
  view.mount(f.root,f.map,"Reversa");assert.equal(view.zoom,1);assert.equal(view.x,0);assert.equal(view.y,0);
  view.destroy();assert.equal(f.handlers.size,0);
});
test("background dragging moves the map while node clicks remain available for inspecting blocked skills",()=>{
  const f=viewportFixture(),view=new SkillTreeViewport();view.mount(f.root,f.map,"Física");
  const down=f.handlers.get("pointerdown"),move=f.handlers.get("pointermove"),up=f.handlers.get("pointerup");
  down({button:0,pointerId:1,clientX:100,clientY:80,target:{closest:()=>({})}});assert.equal(view.drag,null);
  down({button:0,pointerId:1,clientX:100,clientY:80,target:{closest:()=>null},preventDefault(){}});
  move({pointerId:1,clientX:170,clientY:120});assert.equal(view.x,70);assert.equal(view.y,40);
  up({pointerId:1});assert.equal(view.drag,null);view.destroy();
});
