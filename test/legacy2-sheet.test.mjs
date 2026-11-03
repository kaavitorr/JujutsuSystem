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

test("Corpo Frágil keeps its prepared action ceiling and initiative actions while Paralisado", () => {
  const a = actor({ legacy2: { actions: { value: 4, max: 6 } } });
  a.items = [{ type: "feat", name: "Corpo Frágil", flags: { "jujutsu-system": { featureSection: "jj-peculiarities" } } }];
  a.statuses = new Set(["jj-paralisado"]);
  assert.equal(sheet.acoesTetoEfetivo(a), 6);
  assert.equal(Ruleset.iniciativaAcoes(a), 4);
  a.items = [];
  assert.equal(sheet.acoesTetoEfetivo(a), 0);
  assert.equal(Ruleset.iniciativaAcoes(a), 0);
});

test("the refinement counter includes Tremores and intensive training exactly once", () => {
  const a = actor();
  a.flags = { "jujutsu-system": { refinamentoBonus: 2 } };
  a.system.energy.intensiveTraining = { generatedEnergy: 5 };
  assert.equal(sheet.buildLegacy2Context(a, config, Ruleset).refinement, 17);
});

test("saving current HP repeatedly with Destino Entrelaçado never turns its +2 species bonus into a permanent base", () => {
  const a = actor();
  a.type = "character";
  a._source = { system: { legacy2: { pvEspecie: 0 }, attributes: { hp: { max: null, value: 48 } } } };
  a.system._source = a._source.system;
  const saved = a._source.system;
  for (let i = 0; i < 6; i++) {
    // Native Active Effects derive their +2 from the saved, unmodified species base.
    a.system.legacy2.pvEspecie = saved.legacy2.pvEspecie + 2;
    const maximum = Ruleset.maxHitPoints(a);
    const context = sheet.buildLegacy2Context(a, config, Ruleset);
    assert.equal(maximum, 99); // (nível 5 + CON 6) × (Estilo 7 + espécie 0 + efeito 2)
    assert.equal(context.pvEspecie, 0, "the editable species field must contain the saved base, not the effective bonus");
    // Foundry submits the whole sheet when the player edits current HP.
    saved.attributes.hp.value = 48 - i;
    saved.legacy2.pvEspecie = context.pvEspecie;
  }
  a.system.legacy2.pvEspecie = saved.legacy2.pvEspecie; // Remove the peculiaridade.
  assert.equal(Ruleset.maxHitPoints(a), 77, "removing the effect restores the original automatic maximum");
});

test("manual species HP remains editable separately from effects, including source-only synthetic models", () => {
  for (const sourceLocation of ["actor", "system"]) {
    const a = actor({ legacy2: { pvEspecie: 5 } });
    const source = { legacy2: { pvEspecie: 3 } };
    if (sourceLocation === "actor") a._source = { system: source };
    else a.system._source = source;
    assert.equal(sheet.buildLegacy2Context(a, config, Ruleset).pvEspecie, 3);
    source.legacy2.pvEspecie = 0;
    assert.equal(sheet.buildLegacy2Context(a, config, Ruleset).pvEspecie, 0, "an explicit zero cannot fall back to the effect value");
  }
});

test("saving sheet fields preserves free proficiency points without accumulating them into the manual pool", () => {
  for (const bonus of [2, 3]) {
    const a = actor();
    a.system._source = { legacy2: { pontos: { extra: 0 } } };
    for (let save = 0; save < 6; save++) {
      a.system.legacy2.pontos = { extra: a.system._source.legacy2.pontos.extra + bonus, gastos: 0 };
      const ctx = sheet.buildLegacy2Context(a, config, Ruleset);
      assert.equal(ctx.pontos.extra, 0);
      assert.equal(ctx.pontos.total, 9 + bonus);
      a.system._source.legacy2.pontos.extra = ctx.pontos.extra;
    }
  }
});

test("attribute display includes effects while editable bases and the allocation budget exclude them", () => {
  const a = actor();
  a.system._source = { abilities: Object.fromEntries(Object.entries(a.system.abilities)
    .map(([key, data]) => [key, { value: data.value }])) };
  a.system.abilities.wis.value += 1;
  const ctx = sheet.buildLegacy2Context(a, config, Ruleset);
  const wisdom = ctx.abilities.find(ability => ability.key === "wis");
  assert.equal(wisdom.value, 7);
  assert.equal(wisdom.sourceValue, 6);
  assert.equal(ctx.atributos.soma, 36);
});

test("free rank steps stay out of the point budget and are not saved into another skill", () => {
  const a = actor();
  a.system._source = { legacy2: { skills: { ath: 1 }, saves: {}, armas: {}, pontos: { gastos: 1 } } };
  a.system.legacy2 = { ...a.system._source.legacy2, skills: { ath: 1, itm: 4 }, pontos: { gastos: 1 } };
  const ctx = sheet.buildLegacy2Context(a, config, Ruleset);
  assert.equal(ctx.skills.find(skill => skill.key === "itm").grantedRank, 4);
  assert.equal(Ruleset.trainingPointsSpent(a), 1);
  const result = sheet.prepareRankUpdate(a, "skills", "ath", 2, Ruleset, config.abilities);
  assert.deepEqual(result.update["system.legacy2.skills"], { ath: 2 });
  assert.equal(result.update["system.legacy2.pontos.gastos"], 2);
  assert.equal(sheet.prepareRankUpdate(a, "skills", "itm", 0, Ruleset, config.abilities), null);
});

test("raising a partly granted proficiency spends only manual steps and respects the rank cap", () => {
  const a = actor({ legacy2: { skills: { arc: 2 }, saves: {}, armas: {}, pontos: { gastos: 0 } } });
  a._source = { system: { legacy2: { skills: {}, saves: {}, armas: {} } } };
  const first = sheet.prepareRankUpdate(a, "skills", "arc", 3, Ruleset, config.abilities);
  assert.equal(first.update["system.legacy2.skills"].arc, 1);
  assert.equal(first.update["system.legacy2.pontos.gastos"], 1);
  a._source.system.legacy2.skills.arc = 3;
  a.system.legacy2.skills.arc = 5; // Base 3 + two free steps, effective cap Mestre (4).
  const lower = sheet.prepareRankUpdate(a, "skills", "arc", 3, Ruleset, config.abilities);
  assert.equal(lower.update["system.legacy2.skills"].arc, 1);
});

test("Seis Olhos minimum proficiency is not mistaken for additive rank steps", () => {
  const a = actor({ legacy2: { skills: { arc: 2 }, saves: {}, armas: {}, pontos: { gastos: 1 } } });
  a.system._source = { legacy2: { skills: { arc: 1 }, saves: {}, armas: {} } };
  a.overrides = {}; // No Active Effect changed arc: its prepared rank is a minimum from Seis Olhos.
  const update = sheet.prepareRankUpdate(a, "skills", "arc", 3, Ruleset, config.abilities).update;
  assert.equal(update["system.legacy2.skills"].arc, 3);
  assert.equal(Math.max(update["system.legacy2.skills"].arc, 2), 3);
});

test("native effect overrides distinguish additive ranks from derived floors", () => {
  const a = actor({ legacy2: { skills: { arc: 4 }, saves: {}, armas: {}, pontos: { gastos: 0 } } });
  a.system._source = { legacy2: { skills: {}, saves: {}, armas: {} } };
  a.overrides = { system: { legacy2: { skills: { arc: 2 } } } }; // +2 effect, then minimum Mestre (4).
  const update = sheet.prepareRankUpdate(a, "skills", "arc", 4, Ruleset, config.abilities).update;
  assert.equal(update["system.legacy2.skills"].arc, 2);
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
