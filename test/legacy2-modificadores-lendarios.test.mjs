import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import Ruleset from "../module/systems/ruleset.mjs";
import { EnergySystem } from "../module/systems/energy.mjs";
import { avaliarNo } from "../module/systems/especializacoes-2.mjs";
import { PENALIDADE_VITAL_NOME } from "../module/applications/actor/creation/creation-model-2.mjs";
globalThis.Hooks = { on() {}, once() {}, call() {}, callAll() {} };


globalThis.game = { settings: { get: () => "2.0" } };
globalThis.CONFIG = { JUJUTSU: {}, DND5E: { skillPassive: { base: 10 } } };
Math.clamp = (value, min, max) => Math.min(max, Math.max(min, value));
globalThis.Hooks = { on() {}, once() {}, call() {}, callAll() {} };
const { margemExcedente, bonusExcedente } = await import("../module/systems/peculiaridades-automacao.mjs");

const fonte = JSON.parse(readFileSync(new URL("../packs/_source/personalizacao-2-0.json", import.meta.url), "utf8"));
const porNome = Object.fromEntries(fonte.modificadores.map(item => [item.name, item]));
const changesDe = item => (item.effects ?? []).flatMap(efeito => efeito.changes.map(c => `${efeito.name}:${c.key}:${c.mode}:${c.value}`));

test("efeitos dos modificadores lendários: alma, selos e as flags da Energia Colossal", () => {
  assert.deepEqual(changesDe(porNome["Conhecimento da Alma"]),
    ["Resistência 20 (Alma):system.legacy2.resistances.soul.value:2:20"]);
  assert.deepEqual(changesDe(porNome["Estrutura Corporal Anômala"]),
    ["Mais 6 Selos:flags.jujutsu-system.selosBonus:2:6"]);
  assert.deepEqual(changesDe(porNome["Energia Colossal"]), [
    "Energia Colossal:flags.jujutsu-system.energiaColossal:2:1",
    "Energia Colossal:flags.jujutsu-system.refinamentoBonus:2:5"]);
  // Os demais modificadores continuam sem automação.
  assert.equal((porNome["Receptáculo Destinado"].effects ?? []).length, 0);
  assert.equal((porNome["Seis Olhos"].effects ?? []).length, 0);
  // Todos os efeitos transferem para o ator.
  for (const item of fonte.modificadores)
    for (const efeito of item.effects ?? []) assert.equal(efeito.transfer, true);
});

test("a descrição da Energia Colossal descreve a nova regra (dobra base, refinamento +5)", () => {
  const texto = porNome["Energia Colossal"].system.description.value;
  assert.match(texto, /Energia Base dobra/);
  assert.match(texto, /apenas o valor descrito no Estilo de Combate/);
  assert.match(texto, /NÃO são dobrados/);
  assert.match(texto, /Refinamento aumenta em 5/);
  const macro = readFileSync(new URL("../packs/_source/importar-personalizacao-macro.txt", import.meta.url), "utf8");
  assert.ok(macro.includes("Energia Base dobra"), "macro sem a descrição nova");
  for (const chave of ["flags.jujutsu-system.energiaColossal", "flags.jujutsu-system.refinamentoBonus",
    "flags.jujutsu-system.selosBonus", "system.legacy2.resistances.soul.value"])
    assert.ok(macro.includes(`"key": "${chave}"`), `macro sem a chave ${chave}`);
});

const atorEnergia = (flags = {}, { energiaEspecie = 0 } = {}) => ({ type: "character",
  system: { details: { level: 3 }, legacy2: { energiaEspecie, energiaBonusOrigem: 0 },
    energy: { intensiveTraining: { maxEnergy: 0, generatedEnergy: 0 }, bonuses: {}, generation: {} } },
  itemTypes: { class: [{ getFlag: (e, k) => k === "legacy2" ? { energiaBase: 10 } : undefined }], race: [] },
  flags: { "jujutsu-system": flags } });

test("Energia Colossal dobra a Energia Base final no total de Energia", () => {
  assert.equal(Ruleset.maxEnergy(atorEnergia()), 30); // 10 × nível 3
  assert.equal(Ruleset.maxEnergy(atorEnergia({ energiaColossal: 1 })), 60); // base dobrada
});

test("Energia Colossal dobra só a raiz do Estilo: aumentos de origem não dobram", () => {
  // Estilo 10 + origem +2 = 12 de base; com Colossal vira (10×2) + 2 = 22, não 24.
  const ator = atorEnergia({ energiaColossal: 1 }, { energiaEspecie: 2 });
  const nivel = Number(ator.system.details.level);
  const esperado = (10 * 2 + 2) * nivel;
  assert.equal(Ruleset.maxEnergy(ator), esperado);
  assert.notEqual(Ruleset.maxEnergy(ator), 12 * 2 * nivel); // a origem NÃO dobra
});

test("o bônus de Refinamento entra no teto e na geração por turno", async () => {
  assert.equal(EnergySystem.refinamentoBonus(atorEnergia({ refinamentoBonus: 5 })), 5);
  assert.equal(EnergySystem.refinamentoBonus(atorEnergia()), 0);
  // Primeiro turno de um nível 2: base 4 + refinamento 5 = 9 gerados.
  const ator = { ...atorEnergia({ refinamentoBonus: 5 }), level: undefined };
  ator.system.details.level = 2;
  ator.system.energy.generated = 0;
  ator.system.energy.total = 50;
  ator.update = async (updates) => { ator.updates = updates; };
  const updates = await EnergySystem.processTurnStart(ator);
  assert.equal(updates["system.energy.generated"], 9);
});

const noFaiscas = { nome: "Abençoado pelas Faíscas Negras", requisitos: ["Requer um requisito impossível de cumprir"] };
const receptaculo = { type: "feat", name: "Receptáculo Destinado",
  flags: { "jujutsu-system": { featureSection: "jj-legendary-modifiers" } } };
const atorArvore = (extra = {}) => ({ items: [], getFlag: () => undefined, ...extra });

test("Receptáculo Destinado libera Faíscas Negras de qualquer requisito", () => {
  assert.equal(avaliarNo(atorArvore(), noFaiscas).estado, "bloqueado");
  assert.equal(avaliarNo(atorArvore({ items: [receptaculo] }), noFaiscas).estado, "disponivel");
  // Pseudo-ator da criação (nomes do draft em flags).
  assert.equal(avaliarNo(atorArvore({ flags: { "jujutsu-system": { modLendarioNomes: ["Receptáculo Destinado"] } } }),
    noFaiscas).estado, "disponivel");
  // Outras habilidades continuam presas aos requisitos.
  const outroNo = { nome: "Outra Habilidade", requisitos: ["Requer um requisito impossível de cumprir"] };
  assert.equal(avaliarNo(atorArvore({ items: [receptaculo] }), outroNo).estado, "bloqueado");
});

test("a penalidade de Vida/Energia segue referenciada pelo nome canônico", () => {
  assert.ok(fonte.penalidadesVariantes.some(item => item.name === PENALIDADE_VITAL_NOME));
});

test("attribute key da margem de Excedente: base 10, Rastro −2 e bônus de efeito",()=>{
  const ator = (itens = [], flags = {}) => ({ items: itens, flags: { "jujutsu-system": flags } });
  const rastro = { type: "feat", name: "Rastro Da Desgraça", flags: { "jujutsu-system": { featureSection: "jj-peculiarities" } } };
  assert.equal(margemExcedente(ator()), 10);
  assert.equal(margemExcedente(ator([rastro])), 8); // Rastro da Desgraça −2
  assert.equal(bonusExcedente(ator([], { excedenteBonus: -1 })), -1);
  assert.equal(margemExcedente(ator([rastro], { excedenteBonus: -1 })), 7); // acumulam
  assert.equal(margemExcedente(ator([], { excedenteBonus: 3 })), 13);
  assert.equal(margemExcedente(ator([], { excedenteBonus: -99 })), 0); // piso em 0
});
