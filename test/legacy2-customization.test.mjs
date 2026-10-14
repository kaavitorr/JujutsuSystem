import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import * as customization from "../module/applications/actor/jj/legacy2-customization.mjs";

function feature(id, category = "jj-flaws") {
  return { id, type: "feat", name: id, flags: { "jujutsu-system": { featureSection: category, other: true } },
    system: { activities: { heal: { id: "heal", consumption: { targets: [{ type: "attribute", target: "energy.total", value: "2" }] } } } },
    effects: [{ name: "Penalidade", changes: [{ key: "system.abilities.str.value", value: "-1", mode: 2 }] }],
    getFlag(scope, key) { return this.flags?.[scope]?.[key]; } };
}
function actor(items = []) { return { items, system: { details: { height: "180 cm", age: "20" } },
  _source: { system: { details: { height: "180 cm", age: "20" } } } }; }

test("Personalização exposes only requested physical fields, backed by existing actor paths", () => {
  const fields = customization.customizationCharacteristics(actor());
  assert.deepEqual(fields.map(f => f.key), ["height", "hair", "weight", "gender", "skin", "age"]);
  assert.equal(fields[0].name, "system.details.height");
  assert.equal(fields[0].source, "180 cm");
  assert.equal(fields[5].value, "20");
});

test("the four sections group owned features and retain real activities/effects", () => {
  const items = customization.CUSTOMIZATION_SECTIONS.map(section => feature(section.id, section.id));
  items.push(feature("unrelated", "jj-basic"));
  const sections = customization.customizationSections(actor(items));
  assert.deepEqual(sections.map(s => s.label), ["Defeitos", "Peculiaridades", "Penalidades Variantes", "Modificadores Lendários"]);
  assert.equal(sections[0].max, 3);
  assert.equal(sections.flatMap(s => s.items).length, 4);
  assert.equal(sections[0].items[0], items[0], "use the owned document, not a descriptive copy");
  assert.equal(sections[0].items[0].effects.length, 1);
});

test("all-or-nothing bulk imports enforce the defect limit", () => {
  const a = actor(Array.from({ length: 2 }, (_, i) => feature(String(i))));
  assert.equal(customization.prepareCustomizationImport(a, "jj-flaws", [feature("new")]).ok, true);
  const result = customization.prepareCustomizationImport(a, "jj-flaws", [feature("new"), feature("second")]);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "limit");
  assert.equal(a.items.length, 2);
  a.items.push(feature("fifth"));
  assert.equal(customization.customizationSections(a)[0].canAdd, false);
  assert.equal(customization.prepareCustomizationImport(a, "jj-flaws", [feature("new")]).ok, false);
});

test("import categorization preserves compendium mechanics and does not mutate source flags", () => {
  const source = feature("new", "jj-basic");
  const result = customization.prepareCustomizationImport(actor(), "jj-peculiarities", [source]);
  assert.equal(result.ok, true);
  assert.equal(result.items[0].flags["jujutsu-system"].featureSection, "jj-peculiarities");
  assert.equal(result.items[0].flags["jujutsu-system"].other, true);
  assert.deepEqual(result.items[0].system, source.system);
  assert.deepEqual(result.items[0].effects, source.effects);
  assert.equal(source.flags["jujutsu-system"].featureSection, "jj-basic");
  assert.equal(customization.prepareCustomizationImport(actor(), "invalid", [source]).ok, false);
  assert.equal(customization.prepareCustomizationImport(actor(), "jj-flaws", [{ type: "class" }]).ok, false);
});

test("owned-item assignment respects the limit without duplicating existing defects or deleting old overflow", () => {
  const items = Array.from({ length: 6 }, (_, i) => feature(String(i)));
  const a = actor(items);
  const overflow = customization.customizationSections(a)[0];
  assert.equal(overflow.items.length, 6);
  assert.equal(overflow.canAdd, false);
  assert.equal(customization.canAssignCustomization(a, items[0], "jj-flaws"), true);
  const newItem = feature("new", "jj-basic");
  a.items.push(newItem);
  assert.equal(customization.canAssignCustomization(a, newItem, "jj-flaws"), false);
  assert.equal(customization.canAssignCustomization(a, items[0], "jj-variant-penalties"), true);
});

const sheetSource = readFileSync(new URL("../module/applications/actor/character-sheet.mjs", import.meta.url), "utf8");
function productionSheet(a, v2 = true) {
  const bodies = ["_onDropCreateItems", "_onDropSingleItem", "_onDropItem"].map(name => {
    const pattern = new RegExp(`  async ${name}\\(([^)]*)\\) \\{([\\s\\S]*?)\\n  \\}`);
    const match = sheetSource.match(pattern);
    assert.ok(match, name);
    return `async ${name}(${match[1]}) {${match[2]}}`;
  });
  const nativeCalls = [];
  class NativeBase {
    constructor() { this.actor = a; this.isEditable = true; this.nativeCalls = nativeCalls; }
    _detachOptions() { return {}; }
    async _onDropSingleItem(event, data, options) { nativeCalls.push({ options, data }); return data; }
    async _onDropCreateItems(event, items, behavior) {
      nativeCalls.push({ items, behavior });
      const created = [];
      for ( const item of items ) {
        const data = await this._onDropSingleItem(event, item.toObject?.() ?? item, { compendiumUuid: item.uuid });
        if ( data !== false ) { a.items.push(data); created.push(data); }
      }
      return created;
    }
    async _onDropItem(event, item) { return this._onDropCreateItems(event, [item]); }
  }
  const dependencies = { NativeBase, Ruleset: { isV2: () => v2 }, ...customization,
    ui: { notifications: { warn() {} } } };
  const Sheet = new Function(...Object.keys(dependencies), `return class extends NativeBase {${bodies.join("\n")}}`)(
    ...Object.values(dependencies)
  );
  return new Sheet();
}
const dropEvent = category => ({ target: { closest: () => category ? { dataset: { jj2Customization: category } } : null } });

test("actual sheet drop pipeline serializes simultaneous imports and validates the latest defect count", async () => {
  const a = actor(Array.from({ length: 2 }, (_, i) => feature(String(i))));
  const sheet = productionSheet(a);
  const source = feature("third", "jj-basic");
  const [first, second] = await Promise.all([
    sheet._onDropCreateItems(dropEvent("jj-flaws"), [source]),
    sheet._onDropCreateItems(dropEvent("jj-flaws"), [feature("fourth", "jj-basic")])
  ]);
  assert.equal(first.length, 1);
  assert.equal(second.length, 0);
  assert.equal(a.items.filter(customization.isCustomizationItem).length, 3);
  assert.equal(source.flags["jujutsu-system"].featureSection, "jj-basic");
  assert.deepEqual(first[0].effects, source.effects);
  assert.deepEqual(first[0].system.activities, source.system.activities);
});

test("actual sheet drops preserve 1.0 behavior and reject custom changes without permission", async () => {
  const a = actor(Array.from({ length: 5 }, (_, i) => feature(String(i))));
  const readonly = productionSheet(a);
  readonly.isEditable = false;
  assert.deepEqual(await readonly._onDropCreateItems(dropEvent("jj-flaws"), [feature("extra")]), []);
  assert.equal(a.items.length, 5);
  const old = productionSheet(a, false);
  assert.equal((await old._onDropCreateItems(dropEvent("jj-flaws"), [feature("extra")])).length, 1);
  assert.equal(a.items.length, 6);
});

test("moving an owned item into a personalization section changes its category without recreating it", async () => {
  const item = feature("owned", "jj-basic");
  const a = actor([item]);
  item.parent = a;
  item.setFlag = async (scope, key, value) => { item.flags[scope][key] = value; };
  const sheet = productionSheet(a);
  assert.equal(await sheet._onDropItem(dropEvent("jj-peculiarities"), item), item);
  assert.equal(a.items.length, 1);
  assert.equal(customization.customizationCategory(item), "jj-peculiarities");
  assert.equal(item.effects.length, 1);
  assert.equal(sheet.nativeCalls.length, 0);
});

test("compendium addition uses native item creation and keeps cancellation and permissions", async () => {
  const body = sheetSource.match(/static async #onCustomizationAdd\(event, target\) \{([\s\S]*?)\n  \}/)[1];
  let result = "Compendium.features.Item.custom";
  const selectCalls = [];
  const source = feature("compendium", "jj-basic");
  const dependencies = { Ruleset: { isV2: () => true }, ...customization,
    ui: { notifications: { warn() {} } }, CompendiumBrowser: { async selectOne(config) { selectCalls.push(config); return result; } },
    fromUuid: async () => source, game: { items: { fromCompendium: item => item } } };
  const add = new Function(...Object.keys(dependencies), `return async function(event,target){${body}}`)(...Object.values(dependencies));
  const a = actor();
  const sheet = productionSheet(a);
  await add.call(sheet, dropEvent("jj-variant-penalties"), { dataset: { category: "jj-variant-penalties" } });
  assert.equal(a.items.length, 1);
  assert.equal(customization.customizationCategory(a.items[0]), "jj-variant-penalties");
  assert.deepEqual(selectCalls[0].filters.locked.types, new Set(["feat"]));
  result = null;
  await add.call(sheet, dropEvent("jj-flaws"), { dataset: { category: "jj-flaws" } });
  assert.equal(a.items.length, 1);
  sheet.isEditable = false;
  await add.call(sheet, dropEvent("jj-flaws"), { dataset: { category: "jj-flaws" } });
  assert.equal(selectCalls.length, 2);
});

test("document creation also guards native duplication, deferred advancement and simultaneous batches", async () => {
  const source = readFileSync(new URL("../module/documents/item.mjs", import.meta.url), "utf8");
  const match = source.match(/static async createDocuments\(data, context=\{\}\) \{([\s\S]*?)\n  \}/);
  assert.ok(match, "all owned defect creation routes need the limit guard");
  class NativeDocuments {
    static async createDocuments(data, context) {
      await Promise.resolve();
      if ( !context?.dryRun ) context.parent?.items.push(...data);
      return data;
    }
  }
  let v2 = true;
  const dependencies = { NativeDocuments, Ruleset: { isV2: () => v2 }, ...customization,
    ui: { notifications: { warn() {} } } };
  const Documents = new Function(...Object.keys(dependencies),
    `return class extends NativeDocuments {static async createDocuments(data, context={}){${match[1]}}}`)(...Object.values(dependencies));
  const a = actor(Array.from({ length: 2 }, (_, i) => feature(String(i))));
  a.type = "character";
  const [first, second] = await Promise.all([
    Documents.createDocuments([feature("native-duplicate")], { parent: a }),
    Documents.createDocuments([feature("deferred-advancement")], { parent: a })
  ]);
  assert.equal(first.length, 1);
  assert.equal(second.length, 0);
  assert.equal(a.items.length, 3);
  assert.equal((await Documents.createDocuments([feature("fourth")], { parent: a })).length, 0);
  await assert.rejects(() => Documents.createDocuments([feature("dry-run-overflow")], { parent: a, dryRun: true }), /3 Defeitos/);
  assert.equal((await Documents.createDocuments([feature("world")])).length, 1, "world/compendium items are unlimited");
  const concurrentActor = actor(Array.from({ length: 1 }, (_, i) => feature(String(i))));
  concurrentActor.type = "character";
  const owned = feature("existing-basic", "jj-basic");
  owned.parent = concurrentActor;
  owned.setFlag = async (scope, key, value) => { owned.flags[scope][key] = value; };
  concurrentActor.items.push(owned);
  const sheet = productionSheet(concurrentActor);
  await Promise.all([
    Documents.createDocuments([feature("duplicate")], { parent: concurrentActor }),
    sheet._onDropItem(dropEvent("jj-flaws"), owned)
  ]);
  assert.equal(concurrentActor.items.filter(item => customization.customizationCategory(item) === "jj-flaws").length, 3);
  v2 = false;
  assert.equal((await Documents.createDocuments([feature("old-version")], { parent: a })).length, 1);
});

test("native advancement batches reject overflow atomically and serialize until the real write completes", async () => {
  const itemSource = readFileSync(new URL("../module/documents/item.mjs", import.meta.url), "utf8");
  const documentBody = itemSource.match(/static async createDocuments\(data, context=\{\}\) \{([\s\S]*?)\n  \}/)[1];
  const actorSource = readFileSync(new URL("../module/documents/actor/actor.mjs", import.meta.url), "utf8");
  const bulkBody = actorSource.match(/^  performBulkUpdate\([\s\S]*?\n  \) \{([\s\S]*?)\n  \}/m)[1];
  class NativeDocuments { static async createDocuments(data) { return data; } }
  const deps = { NativeDocuments, Ruleset: { isV2: () => true }, ...customization,
    ui: { notifications: { warn() {} } } };
  const Documents = new Function(...Object.keys(deps), `return class extends NativeDocuments {static async createDocuments(data,context={}){${documentBody}}}`)(...Object.values(deps));
  let writes = 0;
  const foundry = { utils: { isEmpty: value => !value || Object.keys(value).length === 0 }, documents: {
    async modifyBatch(operations) {
      for ( const operation of operations.filter(op => op.action === "create") ) {
        // Match installed Foundry: validate via dry run, ignore returned documents, send original data.
        await Documents.createDocuments(operation.data, { ...operation, dryRun: true });
      }
      await Promise.resolve();
      writes++;
      for ( const operation of operations ) {
        if ( operation.action === "create" ) operation.parent.items.push(...operation.data);
        if ( operation.action === "delete" ) operation.parent.items = operation.parent.items.filter(item => !operation.ids.includes(item.id));
      }
      return operations;
    }
  } };
  const bulkDeps = { ...deps, foundry };
  const bulk = new Function(...Object.keys(bulkDeps), `return function({operations=[],...updates},{createOptions={},deleteOptions={},updateOptions={},...options}={}){${bulkBody}}`)(...Object.values(bulkDeps));
  const a = actor(Array.from({ length: 3 }, (_, i) => feature(String(i))));
  a.type = "character";
  await assert.rejects(() => bulk.call(a, { create: [feature("fourth")] }), /3 Defeitos/);
  assert.equal(writes, 0, "rejection must prevent the whole server batch");
  assert.equal(a.items.length, 3);
  await bulk.call(a, { create: [feature("replacement")], delete: ["0"] });
  assert.equal(a.items.length, 3, "replacement within a batch remains valid");
  a.items = a.items.slice(0, 2);
  const results = await Promise.allSettled([
    bulk.call(a, { create: [feature("first")] }),
    bulk.call(a, { create: [feature("second")] })
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(a.items.length, 3);
});

test("the actual biography context supplies six physical fields in 2.0 and preserves the original 1.0 context", async () => {
  const body = sheetSource.match(/async _prepareBiographyContext\(context, options\) \{([\s\S]*?)\n  \}/)[1];
  let v2 = true, enrichments = 0;
  const getProperty = (object, path) => path.split(".").reduce((value, key) => value?.[key], object);
  const dependencies = { Ruleset: { isV2: () => v2 }, ...customization,
    foundry: { utils: { getProperty } }, TextEditor: { async enrichHTML(value) { enrichments++; return value; } } };
  const prepare = new Function(...Object.keys(dependencies), `return async function(context,options){${body}}`)(...Object.values(dependencies));
  const a = actor([feature("saved-defect")]);
  a.isOwner = true;
  a.system.details.biography = { value: "História já salva" };
  a.system.details.ideal = "Ideal já salvo";
  a.system.schema = { fields: { details: { fields: Object.fromEntries(
    ["alignment", "eyes", "height", "faith", "hair", "weight", "gender", "skin", "age"].map(key => [key, { label: key }])
  ) } } };
  const context = { items: a.items, itemContext: { "saved-defect": {} } };
  await prepare.call({ actor: a }, context, {});
  assert.equal(context.characteristics.length, 6);
  assert.equal(context.customizationSections[0].items.length, 1);
  assert.equal(enrichments, 0);
  assert.equal(a.system.details.ideal, "Ideal já salvo");
  assert.equal(a.system.details.biography.value, "História já salva");
  v2 = false;
  const original = {};
  await prepare.call({ actor: a }, original, {});
  assert.equal(original.characteristics.length, 9);
  assert.equal(original.enriched.value, "História já salva");
  assert.equal(enrichments, 1);
});
