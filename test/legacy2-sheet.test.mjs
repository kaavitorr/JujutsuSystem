import assert from "node:assert/strict";
import { test } from "node:test";
import Ruleset from "../module/systems/ruleset.mjs";

globalThis.game = { settings: { get: () => "2.0" } };
globalThis.CONFIG = { JUJUTSU: { trainingPoints: { criacao: 4 } } };
const sheet = await import("../module/applications/actor/jj/legacy2-sheet.mjs").catch(() => ({}));
const config = {
  abilities: Object.fromEntries(["str", "dex", "con", "wis", "cha", "int"].map(key => [key, {
    label: key, abbreviation: key.toUpperCase()
  }]))
};
function actor(overrides = {}) {
  const style = { atributoPrincipal: "str", vidaBase: 7, energiaBase: 10 };
  return {
    system: {
      abilities: Object.fromEntries(["str", "dex", "con", "wis", "cha", "int"].map(key => [key, { value: 6 }])),
      attributes: { hp: { value: 48, max: 60 }, init: { total: 3 } },
      details: { level: 5 }, energy: { total: 72, max: 100, generated: 6 },
      legacy2: { skills: { ath: 4 }, saves: { str: 3 }, armas: {} },
      ...overrides
    },
    itemTypes: { class: [{ name: "Lutador", getFlag: () => style }] }
  };
}
test("old actors have persistent-resource defaults without losing their HP and energy", () => {
  assert.equal(typeof sheet.buildLegacy2Context, "function");
  const ctx = sheet.buildLegacy2Context(actor(), config, Ruleset);
  assert.equal(ctx.wounds.value, 0);
  assert.equal(ctx.wounds.max, 120);
  assert.equal(ctx.actions.value, 6);
  assert.equal(ctx.actions.max, 6);
  assert.equal(ctx.energyAvailable, 6);
  assert.equal(ctx.refinement, 10);
});
test("all fifteen skills appear in the three requested groups with their existing roll keys", () => {
  assert.equal(typeof sheet.buildLegacy2Context, "function");
  const groups = sheet.buildLegacy2Context(actor(), config, Ruleset).skillGroups;
  assert.deepEqual(groups.map(group => group.label), ["Exploração", "Conhecimento", "Influência"]);
  assert.deepEqual(groups.map(group => group.skills.map(skill => skill.label)), [
    ["Atletismo", "Coordenação", "Percepção", "Furtividade", "Sobrevivência"],
    ["Feitiçaria", "Medicina", "Investigação", "História", "Sobrenatural"],
    ["Enganação", "Persuasão", "Intimidação", "Atuação", "Sorte"]
  ]);
  assert.equal(groups[0].skills[0].key, "ath");
  assert.equal(groups[0].skills[0].total, 9);
  assert.equal(groups[1].skills[1].key, "rel");
  assert.equal(groups[1].skills[1].ability, "wis");
});
test("scalar style attributes render and zero proficiency remains selectable", () => {
  assert.equal(typeof sheet.buildLegacy2Context, "function");
  const ctx = sheet.buildLegacy2Context(actor(), config, Ruleset);
  assert.equal(ctx.principalKey, "str");
  assert.equal(ctx.escolhivel, false);
  assert.deepEqual(ctx.rankDots.map(dot => dot.rank), [0, 1, 2, 3, 4]);
  assert.equal(ctx.rankDots[0].label, "Destreinado");
  assert.equal(ctx.saves[0].total, 8);
});
test("weapon groups retain legacy keys so selecting proficiency affects existing weapon rolls", () => {
  assert.equal(typeof sheet.buildLegacy2Context, "function");
  const weapons = sheet.buildLegacy2Context(actor(), config, Ruleset).armas;
  assert.deepEqual(weapons.map(weapon => weapon.label), ["Pesada", "Leve", "Projétil", "Desarmado", "Natural"]);
  assert.deepEqual(weapons.map(weapon => weapon.key), ["martialM", "simpleM", "simpleR", "improv", "natural"]);
});
test("invalid or overfull resource data cannot draw bars beyond their bounds", () => {
  assert.equal(typeof sheet.buildLegacy2Context, "function");
  const ctx = sheet.buildLegacy2Context(actor({
    legacy2: { wounds: { value: 180 }, actions: { value: 19 } },
    energy: { total: 3, max: 0, generated: 20 }
  }), config, Ruleset);
  assert.equal(ctx.wounds.value, 120);
  assert.equal(ctx.wounds.pct, 100);
  assert.equal(ctx.actions.value, 6);
  assert.equal(ctx.energyPct, 0);
  assert.equal(ctx.refinementPct, 100);
});

test("projectile and heavy group choices affect all legacy weapon categories in those groups", () => {
  const a = actor({ legacy2: { armas: { simpleR: 3, martialM: 2 } } });
  assert.equal(Ruleset.armaRank(a, { type: "weapon", system: { type: { value: "martialR" } } }), 3);
  assert.equal(Ruleset.armaRank(a, { type: "weapon", system: { type: { value: "siege" } } }), 2);
});

test("legacy projectile ranks survive until the grouped proficiency is changed", () => {
  const a = actor({ legacy2: { armas: { martialR: 4 } } });
  const ctx = sheet.buildLegacy2Context(a, config, Ruleset);
  assert.equal(ctx.armas.find(w => w.label === "Projétil").rank, 4);
  assert.equal(Ruleset.armaRank(a, { type: "weapon", system: { type: { value: "martialR" } } }), 4);
});

test("old alias-only weapon ranks match the displayed proficiency for every weapon in their group", () => {
  const a = actor({ legacy2: { armas: { martialR: 4, siege: 2 } } });
  const ctx = sheet.buildLegacy2Context(a, config, Ruleset);
  for ( const [group, categories] of [["simpleR", ["simpleR", "martialR"]], ["martialM", ["martialM", "siege"]]] ) {
    const displayed = ctx.armas.find(w => w.key === group).rank;
    for ( const category of categories ) {
      assert.equal(Ruleset.armaRank(a, { type: "weapon", system: { type: { value: category } } }), displayed);
    }
  }
  const explicitZero = actor({ legacy2: { armas: { simpleR: 0, martialR: 4 } } });
  assert.equal(Ruleset.armaRank(explicitZero, { type: "weapon", system: { type: { value: "martialR" } } }), 0);
});

test("consolidating weapon aliases refunds points and is allowed even when the pool is exhausted", () => {
  assert.equal(typeof sheet.prepareRankUpdate, "function");
  const a = actor({ legacy2: { skills: { ath: 4 }, armas: { simpleR: 1, martialR: 4 }, pontos: { gastos: 9 } } });
  const result = sheet.prepareRankUpdate(a, "armas", "simpleR", 3, Ruleset, config.abilities);
  assert.equal(result.update["system.legacy2.armas"].simpleR, 3);
  assert.equal(result.update["system.legacy2.armas.-=martialR"], null);
  assert.equal(result.update["system.legacy2.pontos.gastos"], 7);
});

test("rank updates reject unavailable points and invalid categories without producing a document update", () => {
  assert.equal(typeof sheet.prepareRankUpdate, "function");
  const a = actor({ legacy2: { skills: { ath: 4 }, pontos: { gastos: 9 } } });
  assert.equal(sheet.prepareRankUpdate(a, "saves", "str", 4, Ruleset, config.abilities).insufficient, true);
  assert.equal(sheet.prepareRankUpdate(a, "bad", "str", 1, Ruleset, config.abilities), null);
  assert.equal(sheet.prepareRankUpdate(a, "saves", "str", 8, Ruleset, config.abilities), null);
});

test("selecting untrained removes the spent rank and makes its points available again", () => {
  assert.equal(typeof sheet.prepareRankUpdate, "function");
  const a = actor({ legacy2: { saves: { str: 3 }, pontos: { gastos: 3 } } });
  const result = sheet.prepareRankUpdate(a, "saves", "str", 0, Ruleset, config.abilities);
  assert.equal(result.update["system.legacy2.saves"].str, 0);
  assert.equal(result.update["system.legacy2.pontos.gastos"], 0);
});

test("sem Voando, o tile mostra o deslocamento padrão", () => {
  const a = actor({ attributes: {
    hp: { value: 48, max: 60 }, init: { total: 3 },
    movement: { units: "m", speeds: { walk: 10, fly: 0 } }
  } });
  const ctx = sheet.buildLegacy2Context(a, config, Ruleset);
  assert.equal(ctx.movement.value, 10);
  assert.equal(ctx.movement.voando, false);
});

test("com Voando, o tile mostra o deslocamento de voo no lugar do padrão", () => {
  const a = actor({ attributes: {
    hp: { value: 48, max: 60 }, init: { total: 3 },
    movement: { units: "m", speeds: { walk: 10, fly: 0 } }
  } });
  a.statuses = new Set(["jj-voando"]);
  const ctx = sheet.buildLegacy2Context(a, config, Ruleset);
  assert.equal(ctx.movement.voando, true);
  // "Movimento de voo igual ao padrão": campo de voo vazio cai no padrão.
  assert.equal(ctx.movement.value, 10);
});

test("com Voando e voo próprio preenchido, mostra o voo", () => {
  const a = actor({ attributes: {
    hp: { value: 48, max: 60 }, init: { total: 3 },
    movement: { units: "m", speeds: { walk: 10, fly: 14 } }
  } });
  a.statuses = new Set(["jj-voando"]);
  assert.equal(sheet.buildLegacy2Context(a, config, Ruleset).movement.value, 14);
});

test("sem Voando, o maior deslocamento não oculto continua valendo", () => {
  const a = actor({ attributes: {
    hp: { value: 48, max: 60 }, init: { total: 3 },
    movement: { units: "m", speeds: { walk: 10, fly: 14 } }
  } });
  assert.equal(sheet.buildLegacy2Context(a, config, Ruleset).movement.value, 14);
});

test("os dois templates de resumo trocam o rótulo para Voo quando voando", async () => {
  const { readFileSync } = await import("node:fs");
  const caminho = "C:/Users/kaa_v/Documents/FoundryVTT/Data/systems/jujutsu-system/templates/actors/tabs";
  for (const arquivo of ["character-summary-hunter-2.hbs", "npc-summary-2.hbs"]) {
    const fonte = readFileSync(`${caminho}/${arquivo}`, "utf8");
    assert.ok(fonte.includes('>{{#if jj2.movement.voando}}Voo{{else}}Movimento{{/if}}</span>'), arquivo);
  }
});
