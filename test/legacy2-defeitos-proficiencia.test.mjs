import assert from "node:assert/strict";
import { test } from "node:test";
import Ruleset from "../module/systems/ruleset.mjs";
import { pontosDefeitos, pontosDoItem, proficienciaPorDefeitos, CONVERSAO_DEFEITO } from "../module/systems/legacy2-proficiencies.mjs";

globalThis.game = { settings: { get: () => "2.0" } };
globalThis.CONFIG = { JUJUTSU: { trainingPoints: { criacao: 4 } } };

const defeito = nome => ({ type: "feat", name: nome, flags: { "jujutsu-system": { featureSection: "jj-flaws" } } });
const outro = (nome, secao) => ({ type: "feat", name: nome, flags: { "jujutsu-system": { featureSection: secao } } });
const actor = (itens = []) => ({ type: "character", items: itens, itemTypes: {},
  system: { details: { level: 1 }, legacy2: { pontos: { gastos: 0 } } } });

test("conversão canônica: cada 2 Pontos de Defeito = 1 Ponto de Proficiência",()=>{
  assert.equal(CONVERSAO_DEFEITO,2);
});

test("Pontos de Defeito vêm do sufixo (N pontos) do nome, só na seção de Defeitos",()=>{
  assert.equal(pontosDefeitos(actor()),0);
  assert.equal(pontosDefeitos(actor([defeito("Frágil (1 pontos)"),defeito("Lento (3 pontos)"),defeito("Marcado (5 pontos)")])),9);
  // Fora da seção de Defeitos não pontua, mesmo com marcador no nome.
  assert.equal(pontosDefeitos(actor([outro("Sortuda (3 pontos)","jj-peculiarities")])),0);
  // Defeito sem marcador não pontua.
  assert.equal(pontosDefeitos(actor([defeito("Azarado")])),0);
});

test("proficiência é o piso da metade dos Pontos de Defeito",()=>{
  assert.equal(proficienciaPorDefeitos(actor([defeito("Frágil (1 pontos)")])),0);
  assert.equal(proficienciaPorDefeitos(actor([defeito("Frágil (1 pontos)"),defeito("Lento (3 pontos)")])),2);
  assert.equal(proficienciaPorDefeitos(actor([defeito("Lento (3 pontos)"),defeito("Marcado (5 pontos)")])),4);
});

test("o pool de treino da ficha inclui a conversão dos Defeitos",()=>{
  const limpo=actor();
  assert.equal(Ruleset.trainingPointsTotal(limpo),5); // 4 da criação + 1 do nível
  const comDefeitos=actor([defeito("Lento (3 pontos)"),defeito("Marcado (5 pontos)")]);
  assert.equal(Ruleset.trainingPointsTotal(comDefeitos),9); // 5 + 8÷2
  // Gasto nos degraus consome o pool convertido normalmente.
  comDefeitos.system.legacy2.pontos.gastos=9;
  assert.equal(Ruleset.trainingPointsAvailable(comDefeitos),0);
  assert.equal(Ruleset.trainingPointsAvailable(limpo),5);
});

test("a flag defeitoPontos do importador vence e dispensa o sufixo no nome",()=>{
  const comFlag={type:"feat",name:"Paranoico",flags:{"jujutsu-system":{featureSection:"jj-flaws",defeitoPontos:3}}};
  assert.equal(pontosDoItem(comFlag),3);
  assert.equal(pontosDefeitos(actor([comFlag,defeito("Compulsivo (1 pontos)")])),4);
  assert.equal(Ruleset.trainingPointsTotal(actor([comFlag])),6); // 4+1 do nível + 3÷2
  // flag inválida (0/NaN) cai no sufixo; sem nenhum dos dois, zero.
  const flagZero={type:"feat",name:"Curioso (3 pontos)",flags:{"jujutsu-system":{featureSection:"jj-flaws",defeitoPontos:0}}};
  const flagNula={type:"feat",name:"Mentiroso",flags:{"jujutsu-system":{featureSection:"jj-flaws"}}};
  assert.equal(pontosDoItem(flagZero),3);
  assert.equal(pontosDoItem(flagNula),0);
});

test("a criação agrupa e soma pelos mesmos pontos (flag ou sufixo)", async () => {
  const { readFileSync } = await import("node:fs");
  const fonte = readFileSync(new URL("../module/applications/actor/creation/character-creation-2.mjs", import.meta.url), "utf8");
  // O rodapé e o agrupamento 1/3/5 passam a usar o mesmo pontosDoItem da ficha.
  assert.ok(fonte.includes("pontosDoItem(porNome.get(item.uuid))"), "agrupamento usa a flag");
  assert.ok(fonte.includes("pontosDoItem(porNome.get(uuid))"), "rodapé usa a flag");
});
