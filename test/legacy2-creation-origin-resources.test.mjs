import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import Ruleset from "../module/systems/ruleset.mjs";
import { creationOriginResourceUpdates } from "../module/applications/actor/creation/creation-origin-resources-2.mjs";

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

test("nullable metadata falls back to description while explicit zero and negative values remain authoritative", () => {
  const origin = { type: "race", flags: { "jujutsu-system": { legacy2: { pvEspecie: null, energiaEspecie: null } } },
    system: { description: { value: "<p>Vida Base: <strong>3</strong></p><p>Energia Base:&nbsp;+4</p>" } } };
  assert.deepEqual(offsets([origin]), { pvEspecie: 3, energiaEspecie: 4 });
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

test("conditional changes and later preparation phases cannot replace initial origin offsets", () => {
  const origin = source("Imaculado", "race");
  const feat = source("Imaculado", "feat");
  feat.effects[0].system.changes[0].conditions = '{"type":"test"}';
  feat.effects[0].system.changes[1].phase = "final";
  assert.deepEqual(offsets([origin, feat]), { pvEspecie: 1, energiaEspecie: 2 });
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
