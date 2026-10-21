import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

globalThis.Hooks = { on() {}, once() {}, call() {}, callAll() {} };
globalThis.game = { settings: { get: () => "2.0" } };
globalThis.CONFIG = { JUJUTSU: {}, statusEffects: {} };
Math.clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const fonte = JSON.parse(readFileSync(new URL("../packs/_source/ataques-naturais.json", import.meta.url), "utf8"));
const itens = fonte.ataquesNaturais;
const armaduras = itens.filter(i => i.flags["jujutsu-system"].armaduraNatural);
const porNome = Object.fromEntries(armaduras.map(i => [i.name, i]));

test("as 23 armaduras naturais da tabela existem, no tipo equipment", () => {
  const esperados = ["Armadura Elemental", "Carapaça Leve", "Carapaça Pesada", "Couro Leve", "Couro Pesado",
    "Escamas Leves", "Escamas Pesadas", "Exoesqueleto", "Exoesqueleto Fundido", "Pele de Pedra", "Pele Fina",
    "Pele Grossa", "Placas Leves", "Placas Pesadas", "Armadura Psíquica", "Membrana Fina",
    "Placas Cristalizadas", "Casca", "Quitina", "Ossada", "Musculatura Densa", "Pele Calcinada", "Manto de Fios"];
  assert.equal(armaduras.length, 23);
  for (const nome of esperados) assert.ok(porNome[nome], nome);
  for (const armadura of armaduras) {
    assert.equal(armadura.type, "equipment", armadura.name);
    assert.equal(armadura.system.type.value, "natural", armadura.name);
    assert.equal(armadura._pasta, "Armaduras Naturais", armadura.name);
    for (const efeito of armadura.effects) assert.match(efeito._id, /^[a-zA-Z0-9]{16}$/, efeito._id);
  }
});

test("cada armadura contribui com CR = base + modificador do atributo listado", () => {
  const casos = [
    ["Armadura Elemental", 10, "int"], ["Carapaça Pesada", 13, "str"], ["Couro Leve", 6, "dex"],
    ["Escamas Pesadas", 14, "con"], ["Exoesqueleto", 12, "con"], ["Armadura Psíquica", 8, "wis"],
    ["Pele Fina", 6, "dex"], ["Placas Cristalizadas", 12, "str"], ["Manto de Fios", 8, "dex"]
  ];
  for (const [nome, base, atributo] of casos) {
    const armadura = porNome[nome];
    assert.deepEqual(armadura.flags["jujutsu-system"].cr, { base, atributo }, nome);
    const efeitoCR = armadura.effects.find(e => e.changes.some(c => c.key === "system.attributes.ac.bonus"));
    assert.ok(efeitoCR, nome);
    const change = efeitoCR.changes.find(c => c.key === "system.attributes.ac.bonus");
    // ADD na ac.bonus — o caminho que o cálculo de CR de NPC já respeita (bonusCR).
    assert.equal(change.mode, 2, nome);
    assert.equal(change.value, `${base} + @abilities.${atributo}.mod`, nome);
  }
  // As 23 têm o efeito de CR.
  assert.equal(armaduras.filter(a => a.effects.some(e => e.changes.some(c => c.key === "system.attributes.ac.bonus"))).length, 23);
});

test("Casca e Ossada automatizam resistência, imunidade e vulnerabilidade", () => {
  const casca = porNome["Casca"].effects.find(e => e.changes.some(c => c.key.startsWith("system.legacy2.resistances")));
  assert.deepEqual(casca.changes,
    [{ key: "system.legacy2.resistances.bludgeoning.value", mode: 2, value: 3 }]);

  const ossada = porNome["Ossada"];
  const imune = ossada.effects.find(e => e.name.includes("Imunidade"));
  assert.deepEqual(imune.changes,
    [{ key: "system.legacy2.resistances.piercing.immune", mode: 5, value: "true" }]);
  const vulneravel = ossada.effects.find(e => e.name.includes("Vulnerabilidade"));
  assert.deepEqual(vulneravel.changes,
    [{ key: "system.legacy2.resistances.bludgeoning.value", mode: 2, value: -10 }]);
});

test("as armaduras de espinhos registram o retorno de dano para automação futura", () => {
  const elemental = porNome["Armadura Elemental"].flags["jujutsu-system"].thorns;
  assert.deepEqual(elemental, { tipo: "thorns-atributo", atributo: "int",
    texto: "Causa dano igual ao atributo de Int à criatura atacante." });
  const placas = porNome["Placas Cristalizadas"].flags["jujutsu-system"].thorns;
  assert.equal(placas.tipo, "thorns-atributo");
  assert.equal(placas.atributo, "for");
  const membrana = porNome["Membrana Fina"].flags["jujutsu-system"].thorns;
  assert.equal(membrana.tipo, "thorns-resistencia");
  assert.equal(membrana.tipoDano, "acid");
  // As demais não têm espinhos.
  assert.equal(porNome["Casca"].flags["jujutsu-system"].thorns ?? null, null);
});

test("ids determinísticos e únicos em todo o compendium (183 itens)", () => {
  const ids = new Set(itens.map(i => i._id));
  assert.equal(ids.size, 183);
  for (const armadura of armaduras) assert.match(armadura._id, /^jjnar[0-9a-z]{11}$/, armadura._id);
  // O macro cria a pasta de armaduras e usa keepId.
  const macro = readFileSync(new URL("../packs/_source/importar-ataques-naturais-macro.txt", import.meta.url), "utf8");
  assert.ok(macro.includes('"Armaduras Naturais"'));
  assert.ok(macro.includes("keepId: true"));
});
