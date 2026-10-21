import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

globalThis.Hooks = { on() {}, once() {}, call() {}, callAll() {} };
globalThis.game = { settings: { get: () => "2.0" } };
globalThis.CONFIG = { JUJUTSU: {}, statusEffects: {} };
Math.clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const fonte = JSON.parse(readFileSync(new URL("../packs/_source/armas-pdn.json", import.meta.url), "utf8"));
const armas = fonte.armas;
const porNome = Object.fromEntries(armas.map(a => [a.name, a]));
const atividadeDe = nome => Object.values(porNome[nome].system.activities)[0];

test("as 28 armas da tabela existem, nas 4 categorias de proficiência", () => {
  assert.equal(armas.length, 28);
  const porCategoria = {};
  for (const arma of armas) porCategoria[arma._pasta] = (porCategoria[arma._pasta] ?? 0) + 1;
  assert.deepEqual(porCategoria, {
    "Armas Pesadas": 8, "Armas de Projétil": 3, "Armas Leves": 13, "Armas Desarmadas": 4
  });
  // Categoria → grupo de proficiência do sistema (system.type.value).
  const tipoDe = nome => porNome[nome].system.type.value;
  for (const nome of ["Machado Grande", "Nodachi", "Espada Montante", "Mangual"]) assert.equal(tipoDe(nome), "martialM", nome);
  for (const nome of ["Arco", "Zarabatana", "Shuriken"]) assert.equal(tipoDe(nome), "simpleR", nome);
  for (const nome of ["Katana", "Adaga/Kunai", "Kusarigama"]) assert.equal(tipoDe(nome), "simpleM", nome);
  for (const nome of ["Bastão", "Kanabo/Tacape", "Nunchaku"]) assert.equal(tipoDe(nome), "improv", nome);
  const ids = new Set(armas.map(a => a._id));
  assert.equal(ids.size, 28);
  for (const id of ids) assert.match(id, /^jjarm[0-9a-z]{11}$/, id);
});

test("dado e tipo de dano conforme a tabela (incluindo os de dois tipos)", () => {
  const dano = nome => {
    const base = porNome[nome].system.damage.base;
    return `${base.number}d${base.denomination} ${[...base.types].sort().join("/")}`;
  };
  assert.equal(dano("Machado Grande"), "1d12 slashing");
  assert.equal(dano("Espada Montante"), "2d6 slashing");
  assert.equal(dano("Mangual"), "1d10 piercing");
  assert.equal(dano("Lança"), "1d6 bludgeoning/piercing");
  assert.equal(dano("Zarabatana"), "1d4 piercing");
  assert.equal(dano("Adaga/Kunai"), "1d4 piercing/slashing");
  assert.equal(dano("Kusarigama"), "1d4 bludgeoning/slashing");
  assert.equal(dano("Katar"), "1d6 piercing/slashing");
});

test("todas consomem 2 Pontos de Ação por ataque", () => {
  for (const arma of armas) {
    const activity = Object.values(arma.system.activities)[0];
    assert.equal(activity.type, "attack", arma.name);
    const pa = activity.consumption.targets.find(t => t.target === "energy.generated");
    assert.equal(pa.value, "2", arma.name);
    assert.equal(arma.flags["jujutsu-system"].custoPA, 2, arma.name);
  }
});

test("propriedades mapeadas para as chaves do dnd5e", () => {
  const props = nome => [...porNome[nome].system.properties];
  assert.deepEqual(props("Machado Grande").sort(), ["hvy", "rch", "two"].sort());
  assert.deepEqual(props("Tridente").sort(), ["fin", "two"].sort());
  assert.deepEqual(props("Arco").sort(), ["amm", "two"].sort());
  assert.deepEqual(props("Adaga/Kunai").sort(), ["emb", "fin", "int", "thr"].sort());
  assert.deepEqual(props("Katar").sort(), ["emb", "fin", "two"].sort());
  // Versátil da Daito Katana: 1d8
  const versatil = porNome["Daito Katana"].system.damage.versatile;
  assert.equal(versatil.number, 1);
  assert.equal(versatil.denomination, 8);
  // Alcances
  assert.equal(porNome["Arco"].system.range.value, 25);
  assert.equal(porNome["Shuriken"].system.range.value, 6);
  assert.equal(porNome["Shuriken"].system.range.long, 12);
});

test("preço em yen, peso e descrição em todas", () => {
  assert.equal(porNome["Espada Montante"].system.price.value, 1000);
  assert.equal(porNome["Espada Montante"].system.price.denomination, "yen");
  assert.equal(porNome["Machado Grande"].system.weight, 3);
  assert.equal(porNome["Zarabatana"].system.weight, 0.1);
  for (const arma of armas) assert.ok(arma.system.description.value.trim(), arma.name);
});

test("as 4 desarmadas marcam o dano presumido (a tabela não trouxe o dado)", () => {
  const desarmadas = armas.filter(a => a._pasta === "Armas Desarmadas");
  assert.equal(desarmadas.length, 4);
  for (const arma of desarmadas) {
    assert.equal(arma.flags["jujutsu-system"].danoAssumido, true, arma.name);
    const base = arma.system.damage.base;
    assert.ok(base.number >= 1 && base.denomination >= 4, arma.name);
  }
});

test("o macro de armas aponta para o Equipamentos PdN com as 4 pastas e keepId", () => {
  const macro = readFileSync(new URL("../packs/_source/importar-armas-macro.txt", import.meta.url), "utf8");
  assert.ok(macro.includes("jujutsu-compendium.equipamento-pdn"));
  for (const pasta of ["Armas Pesadas", "Armas de Projétil", "Armas Leves", "Armas Desarmadas"])
    assert.ok(macro.includes(`"${pasta}"`), pasta);
  assert.ok(macro.includes("keepId: true"));
  assert.ok(macro.includes("locked: false"));
});
