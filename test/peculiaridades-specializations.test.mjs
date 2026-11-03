import assert from "node:assert/strict";
import { test } from "node:test";
import { carregarGrafo, escolhasTotais, escolhasDisponiveis, escolhasRestritas, possuidas, tem } from "../module/systems/especializacoes-2.mjs";

const nodes=[
  ["Físico","Proezas Físicas","Corpo de Guerreiro"],["Canal","Proezas Físicas","Canalização de Energia"],
  ["Reversa","Energia Reversa","Energia Reversa"],["Energia Reversa","Energia Reversa","Energia Reversa"],
  ["Barreira","Técnicas de Barreira","Barreiras"]
].map(([name,categoria,caminho])=>({name,uuid:name,flags:{"jujutsu-system":{especializacao:{categoria,caminho,requisitos:[]}}},system:{}}));
globalThis.CONFIG={JUJUTSU:{}};
globalThis.game={settings:{get:(_,key)=>key==="rulesetVersion"?"2.0":{}},user:{isGM:false},packs:new Map([["jujutsu-compendium.geral-2-0",{getDocuments:async()=>nodes}]])};
const peculiar=(name,amount,disabled=false)=>({name,type:"feat",flags:{"jujutsu-system":{featureSection:"jj-peculiarities"}},
  effects:[{name:`Peculiaridade: ${name}`,disabled,transfer:true,system:{changes:[{key:"system.legacy2.especiaisExtra",type:"add",value:amount}]}}]});
const actor=(name,amount,learned=[],disabled=false)=>({type:"character",items:[peculiar(name,amount,disabled)],
  itemTypes:{class:[{getFlag:(_,key)=>key==="legacy2"?{espIniciais:0}:undefined}]},
  system:{details:{level:1},legacy2:{especiaisExtra:disabled?0:amount}},
  getFlag:(_,key)=>key==="especializacoes"?learned:[]});

test("Apetite, Caçador and Voto reserve their choices for the described category",async()=>{
  await carregarGrafo();
  for(const [name,amount,matching] of [["Apetite Canibal",1,"Físico"],["Caçador Sombrio",2,"Canal"],["Voto Vinculativo",3,"Reversa"]]){
    const a=actor(name,amount),groups=escolhasRestritas(a);
    assert.equal(escolhasTotais(a),amount);assert.equal(escolhasDisponiveis(a),0,name);
    assert.equal(groups.reduce((n,g)=>n+g.disponiveis,0),amount,name);
    const node=nodes.find(n=>n.name===matching),flat={nome:node.name,...node.flags["jujutsu-system"].especializacao};
    assert.ok(groups.some(g=>g.casa(flat)));assert.ok(groups.every(g=>!g.casa({nome:"Barreira",categoria:"Técnicas de Barreira"})));
    const spent=actor(name,amount,[matching]);assert.equal(escolhasDisponiveis(spent),0);
    assert.equal(escolhasRestritas(spent).reduce((n,g)=>n+g.disponiveis,0),amount-1);
  }
});

test("Voto unlocks the Energia Reversa node without consuming one of its three choices",async()=>{
  await carregarGrafo();const a=actor("Voto Vinculativo",3);
  assert.ok(tem(a,"Energia Reversa"));assert.ok(possuidas(a).includes("Energia Reversa"));
  assert.equal(escolhasRestritas(a)[0].disponiveis,3);
  assert.equal(tem(actor("Voto Vinculativo",3,[],true),"Energia Reversa"),false);
});

test("overlapping restricted groups never spend the same learned node twice",async()=>{
  await carregarGrafo();const a=actor("Caçador Sombrio",2,["Canal"]);
  a.items.push(peculiar("Apetite Canibal",1));a.system.legacy2.especiaisExtra=3;
  assert.equal(escolhasRestritas(a).reduce((n,g)=>n+g.usados,0),1);
  assert.equal(escolhasDisponiveis(a),0);
});

test("old unrestricted purchases are preserved without granting choices beyond the total budget",async()=>{
  await carregarGrafo();const a=actor("Caçador Sombrio",2,["Barreira","Outra barreira"]);
  assert.equal(escolhasRestritas(a).reduce((n,g)=>n+g.disponiveis,0),0);
  assert.equal(escolhasDisponiveis(a),0);assert.deepEqual(a.getFlag("jujutsu-system","especializacoes"),["Barreira","Outra barreira"]);
});
