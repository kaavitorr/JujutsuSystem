import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

globalThis.Hooks = { on() {}, once() {}, call() {}, callAll() {} };
globalThis.game = { settings: { get: () => "2.0" } };
globalThis.CONFIG = { JUJUTSU: {}, statusEffects: { poisoned: { id: "poisoned" }, frightened: { id: "frightened" } } };
Math.clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const { CONDICOES_DANO } = await import("../module/systems/condicoes-dano.mjs");
const { statusesParaCondicao } = await import("../module/applications/actor/jj/conditions.mjs");

const fonte = JSON.parse(readFileSync(new URL("../packs/_source/ataques-naturais.json", import.meta.url), "utf8"));
const itens = fonte.ataquesNaturais;
const porNome = Object.fromEntries(itens.map(i => [i.name, i]));

// Tabela do usuário: nome → tipo de dano e condição aplicada ao atingir.
const TABELA = [
  ["Mordida Flamejante", "fire", "fire"],
  ["Mordida Caustica", "acid", "acid"],
  ["Mordida Carregada", "lightning", "lightning"],
  ["Mordida Frigida", "cold", "cold"],
  ["Mordida Estrondosa", "thunder", "thunder"],
  ["Mordida Psíquica", "psychic", "psychic"],
  ["Mordida Radiante", "radiant", "radiant"],
  ["Mordida Venenosa", "poison", "poison"],
  ["Mordida Sombria", "soul", "necrotic"]
];

test("as nove mordidas elementais existem com os tipos de dano da tabela", () => {
  for (const [nome, tipo] of TABELA) {
    const item = porNome[nome];
    assert.ok(item, nome);
    assert.equal(item.system.type.value, "natural", nome);
    const activity = Object.values(item.system.activities)[0];
    assert.deepEqual([...activity.damage.parts[0].types], [tipo], nome);
    assert.equal(item.flags["jujutsu-system"].elemento, tipo, nome);
  }
});

test("todas herdam a força da Mordida: +1 dado/4 ND e 3 Pontos de Ação", () => {
  for (const [nome] of TABELA) {
    const item = porNome[nome];
    const activity = Object.values(item.system.activities)[0];
    assert.equal(activity.damage.parts[0].custom.formula, "@escala + @mod@escalaExtra", nome);
    assert.equal(activity.activation.value, 3, nome);
    assert.equal(activity.consumption.targets.some(t => t.target === "energy.generated"), false, nome);
    assert.equal(item.flags["jujutsu-system"].danoExtraPorNd, true, nome);
    assert.equal(item.flags["jujutsu-system"].custoPA, 3, nome);
  }
});

test("cada uma configura a condição ao atingir via effects da activity", () => {
  for (const [nome, tipo, chaveCond] of TABELA) {
    const item = porNome[nome];
    const activity = Object.values(item.system.activities)[0];
    const efeitoItem = item.effects[0];
    assert.ok(efeitoItem, nome);
    // A activity referencia o efeito embutido no item.
    assert.equal(activity.effects[0]._id, efeitoItem._id, nome);
    // Os statuses espelham a condição de dano 8.3 (status + extras + referentes core).
    const cond = CONDICOES_DANO[chaveCond];
    const esperados = [cond.status, ...cond.extra].flatMap(s => statusesParaCondicao(s));
    assert.deepEqual([...efeitoItem.statuses].sort(), esperados.sort(), nome);
    assert.equal(efeitoItem.transfer, false, nome);
    // Duração igual à da condição (Estremecido dura até o fim do turno da criatura).
    if (cond.rodadas) assert.equal(efeitoItem.duration?.rounds, cond.rodadas, nome);
    else if (cond.turnos) {
      assert.equal(efeitoItem.duration?.turns, cond.turnos, nome);
      assert.equal(efeitoItem.duration?.expiry, "turnEnd", nome);
    }
    else assert.ok(!efeitoItem.duration?.rounds, nome);
    // A flag condicaoDano permite usar a ação "Remover" da 8.3 — a chave é o
    // tipo de dano da mordida (Alma usa "soul", não a chave "necrotic" da 8.3).
    assert.equal(efeitoItem.flags["jujutsu-system"].condicaoDano.chave, tipo, nome);
    assert.equal(efeitoItem.flags["jujutsu-system"].isJujutsuCondition, true, nome);
    // A descrição cita a condição e a penalidade de 1 PA adicional.
    assert.ok(item.system.description.value.includes(cond.label), nome);
    assert.ok(item.system.description.value.includes("1 Ponto de Ação adicional"), nome);
  }
});

test("os ids das 9 novas continuam determinísticos e únicos no compendium", () => {
  const elementais = TABELA.map(([nome]) => porNome[nome]);
  for (const item of elementais) assert.match(item._id, /^jjnat[0-9a-z]{11}$/, item._id);
  const ids = new Set(itens.map(i => i._id));
  assert.equal(ids.size, 183);
  for (const item of elementais) {
    const efeito = item.effects[0];
    assert.match(efeito._id, /^jjnatfx[0-9a-z]{9}$/, efeito._id);
  }
});
