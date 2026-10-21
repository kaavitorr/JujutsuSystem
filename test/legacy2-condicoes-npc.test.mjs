import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { prepareNpcClassificationActions } from "../module/systems/legacy2-npc-classification.mjs";

/** Sistema de NPC como chega ao prepareDerivedData: `maxPreparado` já contém
 *  o efeito (aplicado entre prepareBaseData e prepareDerivedData). */
function sistema({ categoria = "normal", maxPreparado, maxFonte, valor } = {}) {
  const system = {
    legacy2: { categoria, actions: { value: valor } },
    _source: { legacy2: { categoria, actions: { max: maxFonte } } }
  };
  if (maxPreparado !== undefined) system.legacy2.actions.max = maxPreparado;
  return system;
}

test("npc sem condições mantém o teto da classificação", () => {
  const s = sistema({ maxPreparado: 6, maxFonte: 6, valor: 6 });
  prepareNpcClassificationActions(s);
  assert.equal(s.legacy2.actions.max, 6);
  assert.equal(s.legacy2.actions.value, 6);
});

test("atordoado (−4 PA): teto e valor do NPC caem para 2", () => {
  const s = sistema({ maxPreparado: 2, maxFonte: 6, valor: 6 });
  prepareNpcClassificationActions(s);
  assert.equal(s.legacy2.actions.max, 2);
  assert.equal(s.legacy2.actions.value, 2);
});

test("acelerado (+2 PA): NPC sobe para 8", () => {
  const s = sistema({ maxPreparado: 8, maxFonte: 6, valor: 6 });
  prepareNpcClassificationActions(s);
  assert.equal(s.legacy2.actions.max, 8);
  assert.equal(s.legacy2.actions.value, 6);
});

test("paralisado (override 0): NPC fica sem Pontos de Ação", () => {
  const s = sistema({ maxPreparado: 0, maxFonte: 6, valor: 6 });
  prepareNpcClassificationActions(s);
  assert.equal(s.legacy2.actions.max, 0);
  assert.equal(s.legacy2.actions.value, 0);
});

test("desidratado (−1 PA): NPC fica com 5", () => {
  const s = sistema({ maxPreparado: 5, maxFonte: 6, valor: 4 });
  prepareNpcClassificationActions(s);
  assert.equal(s.legacy2.actions.max, 5);
  assert.equal(s.legacy2.actions.value, 4);
});

test("ator antigo sem máximo na fonte: delta zero, teto da classificação", () => {
  const s = sistema({ maxFonte: undefined, valor: 6 });
  prepareNpcClassificationActions(s);
  assert.equal(s.legacy2.actions.max, 6);
  assert.equal(s.legacy2.actions.value, 6);
});

test("categoria Elite muda a base, e o delta da condição continua sobre ela", () => {
  const s = sistema({ categoria: "elite", maxPreparado: 6, maxFonte: 8, valor: 6 });
  prepareNpcClassificationActions(s);
  assert.equal(s.legacy2.actions.max, 6); // 8 (Elite) − 2 (Concussão) = 6
  assert.equal(s.legacy2.actions.value, 6);
});

test("o modelo de NPC chama a preparação dentro do bloco 2.0", () => {
  const fonte = readFileSync(new URL("../module/data/actor/npc.mjs", import.meta.url), "utf8");
  assert.match(fonte, /if \( Ruleset\.isV2\(\) \) \{\s*\r?\n\s*const actor2 = this\.parent;\s*\r?\n\s*prepareNpcClassificationActions\(this\);/);
});
