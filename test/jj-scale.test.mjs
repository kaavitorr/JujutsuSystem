/**
 * Testes da escala de energia (função pura scaleFormula).
 * Rodar com: npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { scaleFormula, getScaleOptions, getActivationCost } from "../module/applications/actor/jj/jj-scale.mjs";

/** Ator/atividade simulados para a escala. */
function makeScaleActor(paGerada) {
  return { system: { energy: { generated: paGerada, total: paGerada } } };
}
function makeScaleActivity({ formula = "2d8", cost = 1, maxPA = 0, activation = 0 } = {}) {
  return {
    jjScale: { formula, cost, maxPA },
    consumption: { targets: activation > 0 ? [{ target: "energy.generated", value: activation }] : [] }
  };
}

test("scaleFormula: dado simples multiplica a contagem", () => {
  assert.equal(scaleFormula("2d8", 8), "16d8");
  assert.equal(scaleFormula("1d6", 3), "3d6");
  assert.equal(scaleFormula("d10", 4), "4d10"); // N omitido = 1
});

test("scaleFormula: dado + fixo escala ambos", () => {
  assert.equal(scaleFormula("2d8+5", 3), "6d8 + 15");
});

test("scaleFormula: valor fixo (flat) multiplica", () => {
  assert.equal(scaleFormula("10", 2), "20");
  assert.equal(scaleFormula("5", 11), "55");
});

test("scaleFormula: k=0 ou vazio retorna string vazia", () => {
  assert.equal(scaleFormula("2d8", 0), "");
  assert.equal(scaleFormula("", 5), "");
  assert.equal(scaleFormula("2d8", -1), "");
});

test("scaleFormula: termo não-numérico vira k*(termo)", () => {
  assert.equal(scaleFormula("@mod", 3), "3 * (@mod)");
  assert.equal(scaleFormula("1d6+@abilities.con.mod", 2), "2d6 + 2 * (@abilities.con.mod)");
});

test("scaleFormula: exemplo do design (1 PA, 2d8, 11 incrementos = 22d8)", () => {
  assert.equal(scaleFormula("2d8", 11), "22d8");
});

test("getActivationCost: lê o consumo configurado no pool", () => {
  assert.equal(getActivationCost(makeScaleActivity({ activation: 3 })), 3);
  assert.equal(getActivationCost(makeScaleActivity({ activation: 0 })), 0);
});

test("getScaleOptions: maxPA limita o TOTAL (ativação + incrementos)", () => {
  // ativação 3, custo 1, maxPA 13, PA disponível 16, ativação NÃO paga (redução)
  const opts = getScaleOptions({
    actor: makeScaleActor(16),
    activity: makeScaleActivity({ formula: "2d8", cost: 1, maxPA: 13, activation: 3 }),
    activationPaid: false
  });
  // total máximo = 13 PA → 3 (ativação) + 10 incrementos → maxIncrementos = 10
  assert.equal(opts.maxIncrementos, 10);
  assert.equal(opts.activationCost, 3);
});

test("getScaleOptions: sem maxPA, limita pelo PA disponível (reserva ativação)", () => {
  const opts = getScaleOptions({
    actor: makeScaleActor(16),
    activity: makeScaleActivity({ formula: "1d10", cost: 1, maxPA: 0, activation: 3 }),
    activationPaid: false
  });
  // 16 - 3 (ativação reservada) = 13 incrementos de 1 PA
  assert.equal(opts.maxIncrementos, 13);
});

test("getScaleOptions: ativação já paga (dano) não reserva, mas maxPA conta o total", () => {
  const opts = getScaleOptions({
    actor: makeScaleActor(16),
    activity: makeScaleActivity({ formula: "1d6", cost: 1, maxPA: 13, activation: 3 }),
    activationPaid: true
  });
  // maxPA total 13 - ativação 3 = 10 incrementos (limite do teto)
  assert.equal(opts.maxIncrementos, 10);
});
