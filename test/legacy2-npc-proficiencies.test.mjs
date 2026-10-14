import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import Ruleset from "../module/systems/ruleset.mjs";
import { buildNpc2Context, configureNpc2Parts, NPC2_TABS, updateNpc2Rank } from "../module/applications/actor/jj/legacy2-npc-sheet.mjs";

globalThis.game = { settings: { get: () => "2.0" } };
globalThis.CONFIG = { JUJUTSU: { trainingPoints: { criacao: 4 } } };
const config = { abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"]
  .map(key => [key, { label: key, abbreviation: key.toUpperCase() }])) };
function fixture() {
  const actor = { type: "npc", items: [], itemTypes: {}, getFlag() {},
    system: { attributes: { hp: { value: 10, max: 10 }, movement: {} },
      abilities: Object.fromEntries(Object.keys(config.abilities).map(key => [key, { value: 6 }])),
      legacy2: { nd: 1, skills: {}, saves: {}, armas: {}, pontos: { gastos: 999 } }, energy: {} },
    async update(updates) {
      for (const [path, value] of Object.entries(updates)) {
        const keys = path.split("."), last = keys.pop(); let parent = this;
        for (const key of keys) parent = parent[key] ??= {};
        if (last.startsWith("-=")) delete parent[last.slice(2)];
        else parent[last] = structuredClone(value);
      }
    } };
  return { actor, isEditable: true, isEditMode: true };
}
function target(sheet, ctx, key, rank) {
  return { dataset: { rank: String(rank) }, closest: () => ({ dataset: {
    ctx, key, currentRank: String(sheet.actor.system.legacy2[ctx]?.[key] ?? 0)
  } }) };
}

test("NPC skills tab is registered and preloads the same proficiency partial as player sheets", () => {
  assert(NPC2_TABS.some(([id, label]) => id === "skills" && label === "Perícias"));
  const parts = configureNpc2Parts({ skills: {}, details: {}, tabs: {} });
  assert(parts.skills.template.endsWith("tabs/character-skills-2.hbs"));
  for (const part of Object.values(parts)) assert(part.templates.some(path => path.endsWith("jj2-ranks.hbs")));
  const source = readFileSync(new URL("../module/applications/actor/npc-sheet.mjs", import.meta.url), "utf8");
  assert(source.includes("delete parts.skills"));
  assert(source.includes("jj2Rank: function(event, target)"));
});

test("NPC save and skill ranks persist freely and change the bonuses used by rolls and the shared sheet", async () => {
  const sheet = fixture();
  await updateNpc2Rank(sheet, target(sheet, "saves", "str", 4), Ruleset, config.abilities);
  await updateNpc2Rank(sheet, target(sheet, "skills", "ath", 3), Ruleset, config.abilities);
  const data = buildNpc2Context(sheet.actor, config, Ruleset);
  assert.equal(Ruleset.saveRank(sheet.actor, "str"), 4);
  assert.equal(Ruleset.skillRank(sheet.actor, "ath"), 3);
  assert.equal(data.saves.find(save => save.key === "str").total, 6 + Ruleset.rankBonus(4));
  assert.equal(data.skills.find(skill => skill.key === "ath").total, 6 + Ruleset.rankBonus(3));
  assert.equal(data.skillGroups.flatMap(group => group.skills).length, 15);
  await updateNpc2Rank(sheet, target(sheet, "saves", "str", 4), Ruleset, config.abilities);
  assert.equal(sheet.actor.system.legacy2.saves.str, 0);
});

test("NPC weapon ranks consolidate legacy aliases without charging a player training budget", async () => {
  const sheet = fixture();sheet.actor.system.legacy2.armas = { martialR: 4 };
  await updateNpc2Rank(sheet, target(sheet, "armas", "simpleR", 2), Ruleset, config.abilities);
  assert.deepEqual(sheet.actor.system.legacy2.armas, { simpleR: 2 });
  assert.equal(Ruleset.armaRank(sheet.actor, { type: "weapon", system: { type: { value: "martialR" } } }), 2);
});

test("NPC ranks reject invalid keys, values, read-only sheets and play-mode changes", async () => {
  const sheet = fixture(), before = structuredClone(sheet.actor.system);
  for (const [ctx, key, rank] of [["skills", "missing", 2], ["saves", "missing", 1], ["bad", "str", 1],
    ["skills", "ath", ""], ["skills", "ath", 5], ["skills", "ath", -1], ["skills", "ath", 1.5]])
    await updateNpc2Rank(sheet, target(sheet, ctx, key, rank), Ruleset, config.abilities);
  for (const denied of [{ ...sheet, isEditable: false }, { ...sheet, isEditMode: false }])
    await updateNpc2Rank(denied, target(sheet, "skills", "ath", 4), Ruleset, config.abilities);
  await updateNpc2Rank(sheet, target(sheet, "skills", "ath", 4), { isV2: () => false }, config.abilities);
  assert.deepEqual(sheet.actor.system, before);
});
