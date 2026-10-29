import { readFileSync } from "node:fs";
import Ruleset from "../../module/systems/ruleset.mjs";

const copy = value => structuredClone(value);
const get = (obj, path) => path.split(".").reduce((value, key) => value?.[key], obj);
function merge(target, updates) {
  for (const [key, value] of Object.entries(updates)) {
    const parts = key.split("."), last = parts.pop();let parent = target;
    for (const part of parts) parent = parent[part] ??= {};
    if (value instanceof Set) parent[last] = [...value];
    else if (value && typeof value === "object" && !Array.isArray(value)) merge(parent[last] ??= {}, value);
    else parent[last] = typeof value === "function" ? value : copy(value);
  }
}
function compile(file, name, bindings) {
  const source = readFileSync(new URL(`../../module/${file}`, import.meta.url), "utf8")
    .replace(/^import .*;\r?\n/gm, "").replace(`export default class ${name}`, `class ${name}`);
  return new Function(...Object.keys(bindings), `${source}\nreturn ${name};`)(...Object.values(bindings));
}

// Only Foundry's window/DOM and database boundaries are replaced. Advancement
// rendering contexts, form handlers, applications and manager transitions below
// are the production implementations, driven by real compendium configurations.
class WindowBoundary {
  constructor(options = {}) { this.options = { automaticApplication: false, ...options };this.rendered = false; }
  static PARTS = {};
  static DEFAULT_OPTIONS = {};
  async render() {
    this.rendered = true;
    this.element = { id: "flow", dataset: {}, querySelector: () => null, ownerDocument: { getElementById: () => null } };
    if (this._prepareContentContext) this.context = await this._prepareContentContext({}, {});
    await this._onRender({}, {});
    return this;
  }
  async close(options = {}) {
    if (!this.element) return this; // Foundry 14 skips _onClose for an unrendered app.
    this.element = null;this.rendered = false;this._onClose(options);return this;
  }
  async submit() { await this._handleForm({ type: "submit", target: null }, this.element, { object: this.formValues ?? {} }); }
  async _onRender() {}
  _onClose() {}
  _insertElement() {}
  setPosition() {}
}
globalThis.Application = class {};
globalThis._loc = key => key;
globalThis.Hooks = { call: () => true, callAll() {} };
globalThis.ui = { notifications: { error(message) { throw new Error(message); } } };
Array.fromRange ??= (count, start = 0) => Array.from({ length: count }, (_, index) => start + index);
Set.prototype.first ??= function() { return this.values().next().value; };
let id = 0;
globalThis.foundry = {
  utils: { getProperty: get, isEmpty: obj => !obj || !Object.keys(obj).length, getType: obj => obj?.constructor?.name,
    randomID: () => `native${String(++id).padStart(10, "0")}`,
    mergeObject: (target, source) => { const result = { ...target };merge(result, source);return result; } },
  data: { fields: { StringField: class {} } },
  applications: { ux: { DragDrop: { implementation: class { bind() {} } } } }
};
const Flow = compile("applications/advancement/advancement-flow-v2.mjs", "AdvancementFlow", { Application5e: WindowBoundary });
globalThis.dnd5e = { applications: { advancement: { AdvancementFlowV2: Flow } } };
const GrantFlow = compile("applications/advancement/item-grant-flow-v2.mjs", "ItemGrantFlow", { AdvancementFlow: Flow });
const ChoiceFlow = compile("applications/advancement/item-choice-flow.mjs", "ItemChoiceFlow", {
  Actor5e: {}, CompendiumBrowser: {}, ItemGrantFlow: GrantFlow
});
const SizeFlow = compile("applications/advancement/size-flow.mjs", "SizeFlow", { AdvancementFlow: Flow });

class AdvancementBoundary {
  static metadata = {};
  constructor(item, source) { this.item = item;this.source = source; }
  get id() { return this.source._id; }
  get type() { return this.source.type; }
  get actor() { return this.item.actor; }
  get value() { return this.source.value ??= {}; }
  get appliesToClass() { return this.source.classRestriction !== "secondary"; }
  get configuration() {
    const config = { ...this.source.configuration };
    if (config.sizes) config.sizes = new Set(config.sizes);
    if (config.grants) config.grants = new Set(config.grants);
    if (config.spell) config.spell = { ...config.spell, ability: new Set(config.spell.ability), applySpellChanges() {} };
    return config;
  }
  updateSource(updates) { merge(this.source, updates); }
  toObject() { return copy(this.source); }
  async createItemData(uuid) {
    const original = await fromUuid(uuid);if (!original) return null;
    const data = copy(original.toObject?.() ?? original), origin = `${this.item.id}.${this.id}`;
    data._id = foundry.utils.randomID();data.flags ??= {};
    data.flags.JujutsuLegacy = { sourceId: uuid, advancementOrigin: origin,
      advancementRoot: this.item.flags?.["jujutsu-system"]?.advancementRoot ?? origin };
    return data;
  }
}
const Grant = compile("documents/advancement/item-grant.mjs", "ItemGrantAdvancement", {
  Advancement: AdvancementBoundary, ItemGrantConfig: null, ItemGrantFlow: GrantFlow, ItemGrantConfigurationData: null
});
const Choice = compile("documents/advancement/item-choice.mjs", "ItemChoiceAdvancement", {
  ItemGrantAdvancement: Grant, ItemChoiceConfig: null, ItemChoiceFlow: ChoiceFlow,
  ItemChoiceConfigurationData: null, ItemChoiceValueData: null
});
const Size = compile("documents/advancement/size.mjs", "SizeAdvancement", {
  Advancement: AdvancementBoundary, SizeConfig: null, SizeFlow, SizeConfigurationData: null, SizeValueData: null
});
// These source origins only grant Common. Keep the real Trait.apply method,
// replacing its unrelated full D&D language catalog with that one available key.
const traitSource = readFileSync(new URL("../../module/documents/advancement/trait.mjs", import.meta.url), "utf8");
const traitApply = new Function("Trait", `return class {${traitSource.match(/\n  async apply\([\s\S]*?\n  \}/)[0]}}`)(
  { changeKeyPath: () => "system.traits.languages.value" }
).prototype.apply;
class Trait extends AdvancementBoundary {
  static metadata = { apps: { flow: Flow } };
  async automaticApplicationValue() { return { chosen: [...this.configuration.grants] }; }
  apply(...args) { return traitApply.call(this, ...args); }
}
const types = { ItemGrant: Grant, ItemChoice: Choice, Size, Trait };

export const NativeManager = compile("applications/advancement/advancement-manager.mjs", "AdvancementManager", {
  Advancement: { ERROR: class extends Error {} }, Application5e: WindowBoundary, log() {}
});
export class CharacterBoundary {
  constructor(data = { _id: "test", name: "Teste", type: "character", system: {
    details: { level: 1 }, attributes: { hp: { value: 0 } }, energy: { total: 0, generated: 0 },
    traits: { languages: { value: [] } }, spells: {} }, items: [] }) {
    this.data = copy(data);this.documents = new Map();this.isOwner = true;this.type = "character";this.id = data._id;
    this.reset();
  }
  clone() { return new CharacterBoundary(this.data); }
  getFlag(scope, key) { return this.data.flags?.[scope]?.[key]; }
  updateSource(updates) {
    const { items, ...actor } = updates;merge(this.data, actor);
    for (const item of items ?? []) {
      const existing = this.data.items.find(data => data._id === item._id);
      if (existing) merge(existing, item);else this.data.items.push(copy(item));
    }
    this.reset();
  }
  reset() {
    this.system = copy(this.data.system);this.flags = this.data.flags;
    const items = this.data.items.map(source => {
      let item = this.documents.get(source._id);
      if (!item) {
        item = { id: source._id, type: source.type, name: source.name, actor: this,
          toObject: () => copy(source), getFlag: (scope, key) => source.flags?.[scope]?.[key] };
        this.documents.set(source._id, item);
      }
      item.system = source.system ?? {};item.flags = source.flags;
      item.advancement = { byLevel: {}, byId: {} };item.hasAdvancement = false;
      for (const raw of Object.values(item.system.advancement ?? {})) {
        const Type = types[raw.type];if (!Type) throw new Error(`Untested advancement type: ${raw.type}`);
        const advancement = new Type(item, raw);item.hasAdvancement = true;
        item.advancement.byId[raw._id] = advancement;
        const levels = raw.type === "ItemChoice" ? Object.keys(raw.configuration.choices) : [raw.level ?? 0];
        for (const level of levels) (item.advancement.byLevel[level] ??= []).push(advancement);
      }
      return item;
    });
    items.get = id => items.find(item => item.id === id);
    items.delete = id => { this.data.items = this.data.items.filter(item => item._id !== id);this.reset(); };
    this.items = items;
    this.itemTypes = Object.fromEntries(["class", "race", "feat", "spell"].map(type => [type, items.filter(item => item.type === type)]));
    this.system.attributes.hp.effectiveMax = Ruleset.maxHitPoints(this);
    this.system.energy.max = Ruleset.maxEnergy(this);
  }
  toObject() { return copy(this.data); }
  async performBulkUpdate(plan) { this.writes = (this.writes ?? 0) + 1;this.updateSource({ ...plan.actor, items: plan.create }); }
}
