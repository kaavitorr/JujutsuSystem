import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import Ruleset from "../module/systems/ruleset.mjs";
import { creationOriginResourceUpdates } from "../module/applications/actor/creation/creation-origin-resources-2.mjs";
import { prepareLegacy2ResourceBases, legacy2ResourceChange } from "../module/systems/legacy2-resources.mjs";

const snapshot = JSON.parse(readFileSync(new URL("./fixtures/creation-combat-styles.json", import.meta.url)));
const source = (name, type) => structuredClone(snapshot.docs.find(doc => doc.name === name && doc.type === type));
const offsets = items => {
  const updates = creationOriginResourceUpdates(items);
  return { pvEspecie: updates["system.legacy2.pvEspecie"], energiaEspecie: updates["system.legacy2.energiaEspecie"] };
};
const effect = (key, value, options = {}) => ({ transfer: true, disabled: false,
  system: { changes: [{ key: `system.legacy2.${key}`, type: "add", value, conditions: "{}" }], conditions: "{}" }, ...options });

test("real Imaculado origin and transferred grant produce 34 PV and 17 energy exactly once", () => {
  globalThis.game = { settings: { get: (_scope, key) => key === "rulesetVersion" ? "2.0" : {} } };
  const items = [source("Imaculado", "race"), source("Especialista", "class"), source("Imaculado", "feat")];
  const before = structuredClone(items);
  const legacy2 = offsets(items);
  assert.deepEqual(legacy2, { pvEspecie: 0, energiaEspecie: 0 });
  // Only this engine boundary is simulated: the compendium's enabled ADD
  // changes are applied to the stored values before the real 2.0 formulas.
  for (const item of items) for (const active of item.effects ?? []) {
    if (!active.transfer || active.disabled) continue;
    for (const change of active.system.changes) legacy2[change.key.split(".").at(-1)] += Number(change.value);
  }
  const actor = { type: "character", system: { legacy2, details: { level: 1 }, abilities: { con: { value: 4 } } },
    itemTypes: Object.fromEntries(["class", "race", "feat"].map(type => [type, items.filter(item => item.type === type)
      .map(item => ({ ...item, getFlag: (scope, key) => item.flags?.[scope]?.[key] }))])) };
  assert.equal(Ruleset.maxHitPoints(actor), 34);
  assert.equal(Ruleset.maxEnergy(actor), 17);
  assert.deepEqual(items, before, "normalization must preserve authored items and effects");
});

test("missing, disabled, non-transferred and conditional origin effects retain metadata fallback", () => {
  const origin = source("Imaculado", "race"); const feat = source("Imaculado", "feat");
  for (const mode of ["missing", "disabled", "transfer", "conditional", "suppressed"]) {
    const granted = structuredClone(feat);
    if (mode === "missing") granted.effects = [];
    if (mode === "disabled") granted.effects[0].disabled = true;
    if (mode === "transfer") granted.effects[0].transfer = false;
    if (mode === "conditional") granted.effects[0].system.conditions = '{"type":"test"}';
    if (mode === "suppressed") granted.effects[0].isSuppressed = true;
    assert.deepEqual(offsets([origin, granted]), { pvEspecie: 1, energiaEspecie: 2 }, mode);
  }
});

test("only matching origin benefit changes replace stored fields; customization bonuses survive", () => {
  const origin = source("Imaculado", "race"); const feat = source("Imaculado", "feat");
  feat.effects[0].system.changes = feat.effects[0].system.changes.filter(change => change.key.endsWith("pvEspecie"));
  const unrelated = { _id: "custom", name: "Energia Extra", type: "feat", effects: [effect("energiaEspecie", 2)] };
  assert.deepEqual(offsets([origin, feat, unrelated]), { pvEspecie: 0, energiaEspecie: 2 });
  feat.effects[0].system.changes.push({ key: "system.legacy2.energiaEspecie", type: "add", value: 5 });
  assert.deepEqual(offsets([origin, feat, unrelated]), { pvEspecie: 0, energiaEspecie: 2 },
    "a different contribution must not be mistaken for the origin's authored +2");
});

test("Gojo metadata is a fallback until the optional Poder da Linhagem grant is actually selected", () => {
  const origin = source("Linhagem - Gojo", "race"); const power = source("Poder da Linhagem", "feat");
  assert.deepEqual(offsets([origin]), { pvEspecie: 0, energiaEspecie: 2 });
  assert.deepEqual(offsets([origin, power]), { pvEspecie: 0, energiaEspecie: 0 });
  assert.deepEqual(offsets([origin, { ...power, effects: [] }]), { pvEspecie: 0, energiaEspecie: 2 });
  assert.deepEqual(offsets([origin]), { pvEspecie: 0, energiaEspecie: 2 }, "recomputing after deselection restores fallback");
});

test("Gojo with Seis Olhos suppresses fallback but preserves explicitly selected Poder da Linhagem", () => {
  const origin = source("Linhagem - Gojo", "race"); const eyes = source("Seis Olhos", "feat"); const power = source("Poder da Linhagem", "feat");
  assert.deepEqual(offsets([origin, eyes]), { pvEspecie: 0, energiaEspecie: 0 });
  // The legendary Seis Olhos feat explicitly permits selecting Poder da
  // Linhagem as its Benefício Inerente. Its active +2 remains on the item.
  assert.deepEqual(offsets([origin, eyes, power]), { pvEspecie: 0, energiaEspecie: 0 });
  assert.deepEqual(offsets([origin, eyes, { ...power, effects: [] }]), { pvEspecie: 0, energiaEspecie: 2 });
  const ordinary = source("Imaculado", "race");
  assert.deepEqual(offsets([ordinary, eyes]), { pvEspecie: 1, energiaEspecie: 2 });
});

test("modern nullable metadata stays zero while explicit zero and negative values remain authoritative", () => {
  const origin = { type: "race", flags: { "jujutsu-system": { legacy2: { pvEspecie: null, energiaEspecie: null } } },
    system: { description: { value: "<p>Vida Base: <strong>3</strong></p><p>Energia Base:&nbsp;+4</p>" } } };
  assert.deepEqual(offsets([origin]), { pvEspecie: 0, energiaEspecie: 0 });
  origin.flags["jujutsu-system"].legacy2 = { pvEspecie: 0, energiaEspecie: -1 };
  assert.deepEqual(offsets([origin]), { pvEspecie: 0, energiaEspecie: -1 });
});

test("native source IDs and origin ownership resolve selected grants without relying on names", () => {
  const origin = source("Imaculado", "race"); const feat = source("Imaculado", "feat");
  const originalUuid = feat.uuid;
  delete feat.uuid;
  feat._id = "native-grant";
  feat.name = "Edited label";
  feat.flags = { JujutsuLegacy: { sourceId: originalUuid, advancementOrigin: `${origin._id}.grant` } };
  assert.deepEqual(offsets([origin, feat]), { pvEspecie: 0, energiaEspecie: 0 });
  delete feat.flags.JujutsuLegacy.sourceId;
  assert.deepEqual(offsets([origin, feat]), { pvEspecie: 0, energiaEspecie: 0 });
});

test("legacy ADD mode normalizes overlap while OVERRIDE already replaces its field", () => {
  const origin = source("Imaculado", "race"); const feat = source("Imaculado", "feat");
  feat.effects = [{ transfer: true, changes: [{ key: "system.legacy2.energiaEspecie", mode: 2, value: "+2" },
    { key: "system.legacy2.pvEspecie", mode: 5, value: "+1" }] }];
  assert.deepEqual(offsets([origin, feat]), { pvEspecie: 1, energiaEspecie: 0 });
});

test("an origin without an owned ID cannot claim unrelated customization effects", () => {
  const origin = { type: "race", flags: { "jujutsu-system": { legacy2: { energiaEspecie: 2 } } } };
  const bonus = { _id: "custom", type: "feat", effects: [effect("energiaEspecie", 2)] };
  assert.deepEqual(offsets([origin, bonus]), { pvEspecie: 0, energiaEspecie: 2 });
});

test("conditional changes stay excluded while resource effects use their canonical initial phase", () => {
  const origin = source("Imaculado", "race");
  const feat = source("Imaculado", "feat");
  feat.effects[0].system.changes[0].conditions = '{"type":"test"}';
  feat.effects[0].system.changes[1].phase = "final";
  assert.deepEqual(offsets([origin, feat]), { pvEspecie: 0, energiaEspecie: 2 });
});

test("a copied feature with the same item ID in a different compendium keeps its independent bonus", () => {
  const origin = source("Linhagem - Gojo", "race"), custom = source("Poder da Linhagem", "feat");
  custom.uuid = `Compendium.homebrew.features.Item.${custom._id}`;
  custom.name = "Energia adicional personalizada";
  assert.deepEqual(offsets([origin, custom]), { pvEspecie: 0, energiaEspecie: 2 });
  const copiedEyes = source("Seis Olhos", "feat");
  copiedEyes.uuid = `Compendium.homebrew.features.Item.${copiedEyes._id}`;
  copiedEyes.name = "Percepção personalizada";
  assert.deepEqual(offsets([origin, copiedEyes]), { pvEspecie: 0, energiaEspecie: 2 });
});

test("Feitiço Inato fixed HP metadata cannot import its stale Vida Base 10 as a manual base offset", () => {
  const origin = source("Feitiço Inato", "race"), before = structuredClone(origin);
  assert.match(origin.system.description.value, /Vida Base/);
  assert.equal(origin.flags["jujutsu-system"].pvAdicional, 4);
  assert.deepEqual(offsets([origin]), { pvEspecie: 0, energiaEspecie: 1 });
  assert.deepEqual(origin, before);
});

test("modern nullable or absent base metadata is authoritative over legacy description fields", () => {
  const description = { value: "<p>Vida Base: 10</p><p>Energia Base: 20</p>" };
  for (const flags of [
    { legacy2: { pvEspecie: null, energiaEspecie: null } },
    { legacy2: {} },
    { pvAdicional: 4 },
    { energiaAdicional: 3 }
  ]) {
    assert.deepEqual(offsets([{ type: "race", flags: { "jujutsu-system": flags }, system: { description } }]),
      { pvEspecie: 0, energiaEspecie: 0 });
  }
});

test("description-only custom origins retain their explicit legacy fallback", () => {
  assert.deepEqual(offsets([{ type: "race", system: { description: { value: "Vida Base: 3; Energia Base: +4" } } }]),
    { pvEspecie: 3, energiaEspecie: 4 });
});

test("completion preview and stored origin offsets share the same modern resource resolver", async () => {
  const { creationDraft } = await import("../module/applications/actor/creation/creation-model-2.mjs");
  const { prepareCreationCompletion } = await import("../module/applications/actor/creation/creation-completion-2.mjs");
  const origin = source("Feitiço Inato", "race"); origin.system.advancement = {};
  const style = { uuid: "Item.style", name: "Estilo parser", type: "class", system: { advancement: {} },
    flags: { "jujutsu-system": { legacy2: { vidaBase: 5, energiaBase: 15, atributoPrincipal: "str", espIniciais: 0,
      proficiencias: { armas: 0, salvaguardas: 0, pericias: 0 } } } } };
  const actor = { type: "character", isOwner: true, items: [], system: {}, getFlag() {} };
  const draft = creationDraft(actor);
  Object.assign(draft, { name: "Teste", species: origin.uuid, style: style.uuid, primary: "str",
    abilities: { str: 6, dex: 4, con: 1, int: 3, wis: 3, cha: 3 } });
  const catalog = { species: [origin], styles: [style], graph: { porNome: new Map() },
    customization: Object.fromEntries(Object.keys(draft.customization).map(key => [key, []])) };
  const originalHP = Ruleset.maxHitPoints, previews = [];
  Ruleset.maxHitPoints = preview => { previews.push(structuredClone(preview.system.legacy2)); return 14; };
  let plan, id = 0;
  try {
    plan = await prepareCreationCompletion(actor, draft, catalog, {
      resolve: async uuid => [origin, style].find(item => item.uuid === uuid), idFactory: () => `test${++id}`
    });
  } finally { Ruleset.maxHitPoints = originalHP; }
  assert.equal(previews[0].pvEspecie, 0);
  assert.equal(previews[0].pvBonusOrigem, 4);
  assert.equal(previews[0].energiaEspecie, 1);
  assert.equal(plan.actor["system.legacy2.pvEspecie"], 0);
  assert.equal(plan.actor["system.legacy2.energiaEspecie"], 1);
});

const originResources = [
  ["Anomalia - Feto Amaldiçoado", 10, 0, 0, 0],
  ["Linhagem - Zenin", 4, 0, 0, 0],
  ["Linhagem - Kamo", 4, 0, 0, 0],
  ["Anomalia - Restrição Celestial", 10, 0, 0, 0],
  ["Maldição", 14, 0, 0, 0],
  ["Anomalia - Corpo Amaldiçoado", 10, 0, 0, 0],
  ["Anomalia - Receptáculo", 10, 0, 0, 0],
  ["Anomalia - Energia Descomunal", 10, 0, 0, 10],
  ["Linhagem - Gojo", 4, 0, 0, 2],
  ["Linhagem - Inumaki", 4, 0, 0, -1],
  ["Imaculado", 4, 0, 1, 2],
  ["Feitiço Inato", 4, 0, 0, 1]
];
function originAndGrants(name) {
  const origin = source(name, "race"), selected = [origin], seen = new Set([origin._id]);
  for (const owner of selected) for (const advancement of Object.values(owner.system?.advancement ?? {})) {
    if (advancement.type !== "ItemGrant" || Number(advancement.level ?? 0) > 1) continue;
    for (const grant of advancement.configuration?.items ?? []) {
      const item = snapshot.docs.find(doc => doc.uuid === grant.uuid || doc._id === grant.uuid?.split(".").at(-1));
      // Gojo's optional Seis Olhos is a separate variant tested below. Include
      // Poder da Linhagem here to verify its metadata/AE overlap instead.
      if (!item || seen.has(item._id) || item.name === "Seis Olhos") continue;
      selected.push(structuredClone(item)); seen.add(item._id);
    }
  }
  return selected;
}
function originResourceActor(items, level) {
  const normalized = offsets(items);
  const systemSource = { attributes: { hp: { base: null, bonus: 0, bonuses: { overall: 99 } } },
    energy: { base: null, bonus: 0, intensiveTraining: { maxEnergy: 0 } }, legacy2: normalized };
  const style = { name: "Especialista", type: "class", flags: { "jujutsu-system": { legacy2: { vidaBase: 5, energiaBase: 15 } } } };
  const withFlag = item => ({ ...item, getFlag: (scope, key) => item.flags?.[scope]?.[key] });
  const owned = [...items, style].map(withFlag);
  return { type: "character", flags: {}, effects: [], items: owned, _source: { system: systemSource, flags: {} },
    system: { ...structuredClone(systemSource), _source: systemSource, details: { level }, abilities: { con: { value: 1 } } },
    itemTypes: Object.fromEntries(["race", "feat", "class"].map(type => [type, owned.filter(item => item.type === type)])) };
}
function prepareOriginResourceActor(actor) {
  prepareLegacy2ResourceBases(actor.system, actor, Ruleset);
  for (const item of actor.items) for (const active of item.effects ?? []) {
    if (!active.transfer || active.disabled || active.isSuppressed) continue;
    for (const authored of active.system?.changes ?? active.changes ?? []) {
      const change = legacy2ResourceChange(actor, authored, true);
      if (!["system.attributes.hp.base", "system.energy.base", "system.attributes.hp.bonus", "system.energy.bonus"].includes(change.key)) continue;
      assert.ok(change.type === "add" || Number(change.mode) === 2, "the actual origin resource grants are additive");
      const path = change.key.split("."); let target = actor;
      for (const part of path.slice(0, -1)) target = target[part];
      target[path.at(-1)] += Number(change.value);
    }
  }
}

test("the checked-in creation catalog contains exactly the twelve individually specified origins", () => {
  assert.deepEqual(snapshot.docs.filter(item => item.type === "race").map(item => item.name).sort(),
    originResources.map(([name]) => name).sort());
});
for (const [name, hpFixed, energyFixed, hpOffset, energyOffset] of originResources) {
  test(`${name}: levels 1, 2 and 20 preserve its own fixed bonus and exactly one origin base contribution`, () => {
    const items = originAndGrants(name), before = structuredClone(items);
    assert.equal(Number(items[0].flags["jujutsu-system"].pvAdicional), hpFixed);
    assert.equal(Number(items[0].flags["jujutsu-system"].energiaAdicional), energyFixed);
    for (const level of [1, 2, 20]) {
      const actor = originResourceActor(items, level);
      for (let pass = 0; pass < 3; pass++) {
        prepareOriginResourceActor(actor);
        assert.equal(actor.system.attributes.hp.base, 5 + hpOffset);
        assert.equal(actor.system.attributes.hp.bonus, hpFixed);
        assert.equal(actor.system.energy.base, 15 + energyOffset);
        assert.equal(actor.system.energy.bonus, energyFixed);
        assert.equal(Ruleset.maxHitPoints(actor), (level + 1) * (5 + hpOffset) + hpFixed);
        assert.equal(Ruleset.maxEnergy(actor), level * (15 + energyOffset) + energyFixed);
        assert.equal(actor.system._source.attributes.hp.bonuses.overall, 99, "old bonus fields are neither converted nor modified");
      }
    }
    assert.deepEqual(items, before);
  });
}

test("canonical resource keys on origin grants do not duplicate the same explicit metadata offset", () => {
  const items = originAndGrants("Imaculado");
  for (const item of items) for (const active of item.effects ?? []) for (const change of active.system?.changes ?? []) {
    change.key = change.key === "system.legacy2.pvEspecie" ? "system.attributes.hp.base"
      : change.key === "system.legacy2.energiaEspecie" ? "system.energy.base" : change.key;
  }
  assert.deepEqual(offsets(items), { pvEspecie: 0, energiaEspecie: 0 });
  const actor = originResourceActor(items, 2); prepareOriginResourceActor(actor);
  assert.equal(Ruleset.maxHitPoints(actor), 22); assert.equal(Ruleset.maxEnergy(actor), 34);
});
