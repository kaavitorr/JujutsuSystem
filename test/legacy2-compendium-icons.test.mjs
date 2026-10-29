import assert from "node:assert/strict";
import { test } from "node:test";
const helpers = await import("../module/systems/legacy2-compendium-icons.mjs").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND") return {}; throw error;
});
const prefix = "Compendium.jujutsu-compendium.arquetipos-e-taxonomias.Item.";
const art = "icons/creatures/abilities/fangs-teeth-bite.webp";
function fixture() {
  const source = { id: "source", uuid: prefix+"source", type: "feat", img: art,
    flags: { "jujutsu-system": { encyclopedia: { edition: "2.0", key: "feature:bite" } } } };
  const copy = { id: "copy", type: "feat", img: "systems/jujutsu-system/icons/svg/items/feature.svg",
    flags: structuredClone(source.flags), system: { prerequisites: { level: 4 }, activities: { attack: { activation: { value: 2 } } } } };
  const writes = [];
  const items = [copy];
  const apply = updates => { for (const update of updates) {
    assert.deepEqual(Object.keys(update).sort(), ["_id", "img"]);
    items.find(item => item.id === update._id).img = update.img;
  } };
  globalThis.CONFIG = { Item: { documentClass: { async updateDocuments(updates) { writes.push(updates); apply(updates); } } } };
  const actor = { items, async updateEmbeddedDocuments(type, updates) { assert.equal(type, "Item"); writes.push(updates); apply(updates); } };
  const pack = { async getDocuments() { return [source]; } };
  const game = { user: { id: "gm", isGM: true }, users: { activeGM: { id: "gm" } }, items: [], actors: [actor], scenes: [],
    packs: new Map([["jujutsu-compendium.arquetipos-e-taxonomias", pack]]) };
  return { game, source, copy, actor, items, writes };
}
test("existing profile grants adopt the selected icon by provenance and retain all mechanics", async () => {
  assert.equal(typeof helpers.refreshEncyclopediaIcons, "function");
  const { game, copy, writes } = fixture(), before = structuredClone(copy);
  await helpers.refreshEncyclopediaIcons(game);
  assert.deepEqual(copy, { ...before, img: art }); assert.equal(writes.length, 1);
});
test("taxonomy and archetype copies match their original compendium IDs even without encyclopedia flags", async () => {
  for (const type of ["taxonomy", "archetype"]) {
    const { game, source, copy } = fixture(); source.type = copy.type = type;
    copy.img = `systems/jujutsu-system/icons/svg/items/${type}.svg`;
    copy.flags = {}; copy._stats = { compendiumSource: source.uuid };
    await helpers.refreshEncyclopediaIcons(game); assert.equal(copy.img, art);
  }
});
test("manual artwork and unrelated same-name items remain intact", async () => {
  const { game, copy, items, writes } = fixture();
  copy.img = "worlds/campaign/custom-portrait.webp";
  items.push({ ...structuredClone(copy), id: "manual", img: "systems/jujutsu-system/icons/svg/items/feature.svg", flags: {} });
  await helpers.refreshEncyclopediaIcons(game);
  assert.equal(copy.img, "worlds/campaign/custom-portrait.webp"); assert.deepEqual(writes, []);
});
test("world items and unlinked token actors are updated once; a second pass writes nothing", async () => {
  const { game, actor, copy, writes } = fixture();
  game.actors = []; game.scenes = [{ tokens: [{ actorLink: false, actor }] }];
  game.items = [{ ...structuredClone(copy), id: "world" }]; actor.items.push(game.items[0]);
  await helpers.refreshEncyclopediaIcons(game);
  assert.equal(copy.img, art); assert.equal(game.items[0].img, art); assert.equal(writes.length, 2);
  await helpers.refreshEncyclopediaIcons(game); assert.equal(writes.length, 2);
});
test("only the active GM applies the icon refresh, and an unavailable module is harmless", async () => {
  const { game, writes } = fixture(); game.user = { id: "other", isGM: true };
  await helpers.refreshEncyclopediaIcons(game); assert.deepEqual(writes, []);
  game.user = { id: "player", isGM: false };
  await helpers.refreshEncyclopediaIcons(game); assert.deepEqual(writes, []);
  game.user = { id: "gm", isGM: true }; game.packs.clear();
  await helpers.refreshEncyclopediaIcons(game); assert.deepEqual(writes, []);
});
