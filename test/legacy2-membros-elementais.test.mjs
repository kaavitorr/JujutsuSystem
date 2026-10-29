import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

globalThis.Hooks = { on() {}, once() {}, call() {}, callAll() {} };
globalThis.game = { settings: { get: () => "2.0" } };
globalThis.CONFIG = { JUJUTSU: {}, statusEffects: {} };
Math.clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const { CONDICOES_DANO } = await import("../module/systems/condicoes-dano.mjs");

const fonte = JSON.parse(readFileSync(new URL("../packs/_source/ataques-naturais.json", import.meta.url), "utf8"));
const itens = fonte.ataquesNaturais;
const membros = itens.filter(i => i.flags["jujutsu-system"].membroElemental);
const porNome = Object.fromEntries(itens.map(i => [i.name, i]));

test("as 135 variantes existem: 15 partes (menos a Boca) × 9 elementos", () => {
  assert.equal(membros.length, 135);
  const elementos = new Set(membros.map(i => i.flags["jujutsu-system"].elemento));
  assert.deepEqual([...elementos].sort(),
    ["acid", "cold", "fire", "lightning", "poison", "psychic", "radiant", "soul", "thunder"]);
  // Nenhuma variante da Boca — a boca elemental é a Mordida, que aplica ao atingir.
  assert.ok(!membros.some(i => i.name.startsWith("Mordida")));
  const ids = new Set(itens.map(i => i._id));
  assert.equal(ids.size, 183);
});

test("a concordância de gênero e número dos nomes está certa", () => {
  for (const nome of ["Galhada Flamejante", "Bico Caustico", "Garras Carregadas", "Presas Frigidas",
    "Punhos Estrondosos", "Cascos Psíquicos", "Chifres Radiantes", "Pseudópode Venenoso",
    "Pinças Sombrias", "Cauda Sombria", "Ferrão Venenoso", "Unhas Causticas",
    "Tentáculos Flamejantes", "Espinhos Frigidos", "Farpas Radiantes"])
    assert.ok(porNome[nome], nome);
});

test("o dano é do elemento; a condição fica para o crítico 20 natural (pipeline 8.3)", () => {
  for (const membro of membros) {
    const flags = membro.flags["jujutsu-system"];
    const activity = Object.values(membro.system.activities)[0];
    // O dano parte é do elemento.
    assert.deepEqual([...activity.damage.parts[0].types], [flags.elemento], membro.name);
    // SEM efeito aplicado ao atingir — a condição vem do crítico via 8.3.
    assert.equal(activity.effects, undefined, membro.name);
    assert.equal(membro.effects.length, 0, membro.name);
    // O elemento tem entrada no mapa de condições 8.3 (Alma compartilha a Entropia).
    assert.ok(CONDICOES_DANO[flags.elemento], `condição 8.3 para ${flags.elemento}`);
    assert.ok(!membro.system.description.value.includes("Diferente das Mordidas"), membro.name);
    assert.equal(membro._pasta != null, true, membro.name);
  }
  // Alma → Entropia, com Salvaguarda de Sabedoria, igual ao necrótico.
  assert.equal(CONDICOES_DANO.soul.label, "Entropia");
  assert.equal(CONDICOES_DANO.soul.save, "wis");
  assert.equal(CONDICOES_DANO.soul.rodadas, 2);
});

test("as variantes herdam o custo e o dado extra da parte original (2 PA; 3 nas especiais)", () => {
  // Chifres e Ferrão são especiais: 2 PA e +1 dado/4 ND; as demais, 1 PA.
  const especiais = membros.filter(m => ["Chifres", "Ferrão"].some(p => m.name.startsWith(p)));
  assert.equal(especiais.length, 18); // 2 partes × 9 elementos
  for (const membro of especiais) {
    const activity = Object.values(membro.system.activities)[0];
    assert.equal(activity.damage.parts[0].custom.formula, "@escala + @mod@escalaExtra", membro.name);
    assert.equal(activity.activation.value, 3, membro.name);
    assert.equal(activity.consumption.targets.some(t => t.target === "energy.generated"), false, membro.name);
    assert.equal(membro.flags["jujutsu-system"].custoPA, 3, membro.name);
  }
  const simples = membros.filter(m => !["Chifres", "Ferrão"].some(p => m.name.startsWith(p)));
  assert.equal(simples.length, 117); // 13 partes × 9 elementos
  for (const membro of simples) {
    const activity = Object.values(membro.system.activities)[0];
    assert.equal(activity.damage.parts[0].custom.formula, "@escala + @mod", membro.name);
    assert.equal(activity.activation.value, 2, membro.name);
    assert.equal(activity.consumption.targets.some(t => t.target === "energy.generated"), false, membro.name);
  }
});

test("os ícones dos membros elementais distinguem a anatomia, sem placeholders genéricos", () => {
  for (const membro of membros) {
    assert.match(membro.img, /^icons\/.+\.webp$/, membro.name);
  }
  for (const elemento of new Set(membros.map(m=>m.flags["jujutsu-system"].elemento)))
    assert.ok(new Set(membros.filter(m=>m.flags["jujutsu-system"].elemento===elemento).map(m=>m.img)).size>=10,elemento);
});

test("as pastas do compendium agrupam por elemento via macro", () => {
  const macro = readFileSync(new URL("../packs/_source/importar-ataques-naturais-macro.txt", import.meta.url), "utf8");
  assert.ok(macro.includes("Membros Elementais"), "pasta raiz dos membros");
  for (const elemento of ["Fogo", "Ácido", "Elétrico", "Frio", "Trovejante", "Psíquico", "Energia", "Veneno", "Alma"])
    assert.ok(macro.includes(`"${elemento}"`), elemento);
  assert.ok(macro.includes("keepId: true"));
  // Os itens marcam a pasta no _pasta, resolvida pelo macro.
  assert.equal(membros.every(m => m._pasta), true);
});
