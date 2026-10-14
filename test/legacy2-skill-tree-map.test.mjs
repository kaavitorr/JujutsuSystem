import assert from "node:assert/strict";
import { test } from "node:test";

const map = await import("../module/applications/actor/jj/skill-tree-map-2.mjs").catch(() => ({}));
const node = (nome, caminho, requisitos = []) => ({ nome, caminho, requisitos, categoria: "Feitiço Inato", img: `${nome}.webp` });
function fixture(nodes) {
  const porNome = new Map(nodes.map(n => [n.nome, n]));
  const cat = { nome: "Feitiço Inato", caminhos: [...new Set(nodes.map(n => n.caminho))].map(nome => ({
    nome, nos: nodes.filter(n => n.caminho === nome)
  })) };
  return { cat, porNome };
}
test("branches and converging dependencies advance from left to right without overlapping cards", () => {
  assert.equal(typeof map.construirMapaCategoria, "function");
  const { cat, porNome } = fixture([node("A", "Um"), node("B", "Um", ["A"]), node("C", "Um", ["A"]), node("D", "Um", ["B e C"])]);
  const result = map.construirMapaCategoria(cat, porNome);
  const get = name => result.nos.find(n => n.nome === name);
  assert(get("B").x > get("A").x);
  assert(get("D").x > get("B").x);
  assert.equal(get("B").x, get("C").x);
  assert(Math.abs(get("B").y - get("C").y) >= result.noAltura);
  assert.deepEqual(result.linhas.map(l => [l.de, l.para]), [["A", "B"], ["A", "C"], ["B", "D"], ["C", "D"]]);
  assert.equal(get("A").img, "A.webp");
});
test("free abilities and count gates do not invent linear prerequisite connections", () => {
  assert.equal(typeof map.construirMapaCategoria, "function");
  const { cat, porNome } = fixture([node("Livre", "Um"), node("Outra", "Um"), node("Portão", "Um", ["3 Habilidades de Feitiço Inato"])]);
  const before = JSON.stringify(cat);
  const result = map.construirMapaCategoria(cat, porNome);
  assert.equal(result.linhas.length, 0);
  assert.equal(JSON.stringify(cat), before, "Layout must not modify compendium data");
  assert.equal(result.nos.length, 3);
});
test("domain expansion with level and external requirements reads horizontally without invented links", () => {
  const caminho = "Técnicas de Expansão de Domínio";
  const { cat, porNome } = fixture([
    node("Expansão Especial", caminho, ["Feitiço com Expansão de Domínio Especial"]),
    node("Domínio Incompleto", caminho, ["6º nível de personagem"]),
    node("Configurando Expansão", caminho, ["Domínio Incompleto ou Superior"]),
    node("Expansão de Domínio", caminho, ["10º nível de personagem", "Barreira Vazia"]),
    node("Modificação de Domínio", caminho, ["Domínio Completo"])
  ]);
  cat.nome = "Domínio e Anti-Domínio";
  porNome.set("Barreira Vazia", { ...node("Barreira Vazia", "Barreiras"), categoria: "Técnicas de Barreira" });
  const result = map.construirMapaCategoria(cat, porNome);
  assert.equal(new Set(result.nos.map(n => n.y)).size, 1);
  assert(result.nos.every((n,i) => i === 0 || n.x > result.nos[i-1].x));
  assert.equal(result.linhas.length, 0);
  assert.deepEqual(result.nos[3].requisitos, ["10º nível de personagem", "Barreira Vazia"]);
});
test("dependencies on a horizontal lane still progress to the right of their prerequisite", () => {
  const {cat,porNome}=fixture([node("Livre A","Entrada"),node("Livre B","Entrada"),node("Livre C","Entrada"),node("Avançada","Outro caminho",["Livre C"])]);
  const result=map.construirMapaCategoria(cat,porNome);
  assert(result.nos.find(n=>n.nome==="Avançada").x > result.nos.find(n=>n.nome==="Livre C").x);
  assert.equal(result.linhas.length,1);
});
test("named alternatives and names containing conjunctions remain distinct dependencies", () => {
  assert.equal(typeof map.origensRequisito, "function");
  const { porNome } = fixture([node("Cone e Leque", "Um"), node("A", "Um"), node("B", "Dois")]);
  assert.deepEqual(map.origensRequisito(">Cone e Leque<", porNome), ["Cone e Leque"]);
  assert.deepEqual(map.origensRequisito("A ou B", porNome), ["A", "B"]);
  assert.deepEqual(map.origensRequisito("A ou decisão do Mestre", porNome), []);
  assert.deepEqual(map.origensRequisito("A ou Cone e Leque", porNome), ["A", "Cone e Leque"]);
  assert.deepEqual(map.origensRequisito("20 Habilidades de Especialização Totais e B", porNome), ["B"]);
});
test("long dependency connectors stay in gutters rather than passing through intervening cards", () => {
  const {cat,porNome}=fixture([node('A','Barreira'),node('B','Barreira',['A']),node('C','Barreira',['B']),node('D','Barreira',['C','A'])]);
  const result=map.construirMapaCategoria(cat,porNome);
  for(const edge of result.linhas){
    const commands=[...edge.d.matchAll(/([MLHV])\s*(-?\d+(?:\.\d+)?)(?:\s+(-?\d+(?:\.\d+)?))?/g)];
    assert(commands.length>1,'Connectors must expose their orthogonal routing');
    let previous;
    for(const match of commands){
      const current=match[1]==='H'?[Number(match[2]),previous[1]]:match[1]==='V'?[previous[0],Number(match[2])]:[Number(match[2]),Number(match[3])];
      if(previous)for(let t=0;t<=1;t+=.02){
        const x=previous[0]+(current[0]-previous[0])*t,y=previous[1]+(current[1]-previous[1])*t;
        for(const no of result.nos.filter(n=>![edge.de,edge.para].includes(n.nome)))assert(!(x>no.x&&x<no.x+result.noLargura&&y>no.y&&y<no.y+result.noAltura),`${edge.de}->${edge.para} crosses ${no.nome}`);
      }
      previous=current;
    }
  }
});
test("hidden lines preserve dependency layout and cross-category prerequisites are not invented as local nodes", () => {
  assert.equal(typeof map.construirMapaCategoria, "function");
  const { cat, porNome } = fixture([node("A", "Um"), node("B", "Dois", ["A", "Externa"])]);
  porNome.set("Externa", { ...node("Externa", "Outro"), categoria: "Energia Reversa" });
  const result = map.construirMapaCategoria(cat, porNome, { ocultas: { "A|B": true } });
  assert.equal(result.linhas.length, 0);
  assert.equal(result.nos.length, 2);
  assert(result.nos[1].x > result.nos[0].x);
});
test("large trees and cycles have deterministic non-overlapping positions inside their stage", () => {
  assert.equal(typeof map.construirMapaCategoria, "function");
  const nodes = Array.from({length:120}, (_, i) => node(`N${i}`, `C${i%6}`, i > 5 ? [`N${i-6}`] : []));
  nodes.push(node("Ciclo A", "Ciclo", ["Ciclo B"]), node("Ciclo B", "Ciclo", ["Ciclo A"]));
  const { cat, porNome } = fixture(nodes);
  const result = map.construirMapaCategoria(cat, porNome);
  const occupied = new Set();
  for (const n of result.nos) {
    assert(n.x >= 0 && n.y >= 0 && n.x + result.noLargura <= result.largura && n.y + result.noAltura <= result.altura);
    assert(!occupied.has(`${n.x}|${n.y}`));
    occupied.add(`${n.x}|${n.y}`);
  }
  assert.deepEqual(map.construirMapaCategoria(cat, porNome), result);
});
test("count progress follows category, path, and total scopes and keeps maxima bounded", () => {
  assert.equal(typeof map.contagemRequisito, "function");
  const { porNome } = fixture([node("A", "Ofensivo"), node("B", "Defensivo")]);
  porNome.set("C", { ...node("C", "Ofensivo"), categoria:"Proezas Físicas" });
  const learned = ["A", "B", "C"];
  assert.equal(map.contagemRequisito("5 Habilidades de Feitiço Inato", learned, porNome).atual, 2);
  assert.equal(map.contagemRequisito("3 Habilidades do Ofensivo", learned, porNome).atual, 2);
  assert.equal(map.contagemRequisito("2 Habilidades de Especialização Totais", learned, porNome).pct, 100);
  assert.equal(map.contagemRequisito("A ou B", learned, porNome), null);
  assert.equal(map.contagensRequisito("3 Habilidades de Feitiço Inato e A", learned, porNome)[0].atual, 2);
  porNome.set("D", { ...node("D", "Outro"), categoria: "Domínio e Anti-Domínio" });
  assert.equal(map.contagensRequisito("2 Habilidades de Domínio e Anti-Domínio", ["D"], porNome)[0].atual, 1);
});
