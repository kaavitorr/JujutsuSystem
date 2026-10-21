import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import Ruleset from "../module/systems/ruleset.mjs";
import { ESCALA_DANO, linhaEscalaDano, formulaEscalaDano, extraEscalaDano } from "../module/systems/escala-dano.mjs";

globalThis.game = { settings: { get: () => "2.0" } };
globalThis.CONFIG = { JUJUTSU: {}, DND5E: { abilities: { str: { label: "Força" }, dex: { label: "Agilidade" } } } };
Math.clamp = (value, min, max) => Math.min(max, Math.max(min, value));

test("a tabela canônica tem as 16 linhas, dos pares 2–30 e a faixa 0–1", () => {
  assert.deepEqual(ESCALA_DANO.map(l => [l.nd, l.dados]), [
    [0, "1d4"], [2, "1d6"], [4, "1d8"], [6, "1d10"], [8, "1d12"], [10, "2d8"],
    [12, "3d6"], [14, "2d10"], [16, "3d8"], [18, "3d10"], [20, "4d8"],
    [22, "3d12"], [24, "3d12"], [26, "5d8"], [28, "4d12"], [30, "5d10"]
  ]);
});

test("ND ímpar cai na linha do par anterior; 0–1 e limites extremos", () => {
  assert.equal(linhaEscalaDano(0).dados, "1d4");
  assert.equal(linhaEscalaDano(1).dados, "1d4");
  assert.equal(linhaEscalaDano(2).dados, "1d6");
  assert.equal(linhaEscalaDano(3).dados, "1d6");
  assert.equal(linhaEscalaDano(5).dados, "1d8");
  assert.equal(linhaEscalaDano(7).dados, "1d10");
  assert.equal(linhaEscalaDano(11).dados, "2d8");
  assert.equal(linhaEscalaDano(21).dados, "4d8");
  assert.equal(linhaEscalaDano(25).dados, "3d12");
  assert.equal(linhaEscalaDano(29).dados, "4d12");
  assert.equal(linhaEscalaDano(30).dados, "5d10");
  // Acima do teto e valores absurdos ficam na última/primeira linha.
  assert.equal(linhaEscalaDano(35).dados, "5d10");
  assert.equal(linhaEscalaDano(-3).dados, "1d4");
  assert.equal(linhaEscalaDano(undefined).dados, "1d4");
  // A linha guarda o ND efetivo usado.
  assert.equal(linhaEscalaDano(11).nd, 10);
});

test("a fórmula soma o atributo: número, negativo, zero e placeholder", () => {
  assert.equal(formulaEscalaDano(4, { atributo: 3 }), "1d8 + 3");
  assert.equal(formulaEscalaDano(4, { atributo: -1 }), "1d8 - 1");
  assert.equal(formulaEscalaDano(4, { atributo: 0 }), "1d8");
  assert.equal(formulaEscalaDano(12, { atributo: "@mod" }), "3d6 + @mod");
  assert.equal(formulaEscalaDano(10), "2d8");
});

test("o Ruleset expõe a escala e o ND do NPC escolhe a linha certa", () => {
  assert.equal(Ruleset.ESCALA_DANO.length, 16);
  assert.deepEqual(Ruleset.escalaDano(9), { nd: 8, dados: "1d12" });
  assert.equal(Ruleset.formulaEscalaDano(11, { atributo: 3 }), "2d8 + 3");
  const npc = { type: "npc", system: { legacy2: { nd: "5" } } };
  assert.equal(Ruleset.nivel(npc), 5);
  assert.equal(Ruleset.escalaDano(Ruleset.nivel(npc)).dados, "1d8");
});

test("ataques de NPC resolvem @escala no rolldata pelo ND; personagens não recebem", () => {
  const fonte = readFileSync(new URL("../module/documents/activity/attack.mjs", import.meta.url), "utf8");
  const corpo = fonte.match(/getRollData\(options = \{\}\) \{([\s\S]*?)\r?\n  \}/)[1];
  const Base = class { getRollData() { return {}; } };
  const Classe = new Function("Ruleset", "extraEscalaDano", "Base",
    `return class extends Base { getRollData(options = {}) { ${corpo} } }`)(Ruleset, extraEscalaDano, Base);

  const npc = { type: "npc", system: { legacy2: { nd: "12" } } };
  const ataqueNpc = Object.assign(new Classe(), { actor: npc });
  assert.equal(ataqueNpc.getRollData().escala, "3d6");

  const personagem = { type: "character", system: {} };
  const ataquePc = Object.assign(new Classe(), { actor: personagem });
  assert.equal(ataquePc.getRollData().escala, undefined);

  // Sem ator não explode.
  assert.equal(Object.assign(new Classe(), {}).getRollData().escala, undefined);
});
