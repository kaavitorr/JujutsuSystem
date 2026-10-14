import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../module/applications/components/effects.mjs", import.meta.url), "utf8");
const body = source.match(/async _onToggleExpand\(target, \{ effect \}=\{\}\) \{([\s\S]*?)\n  \}/)[1];
const classes = initial => {
  const values = new Set(initial);
  return { contains: name => values.has(name), toggle(name, on) { on ??= !values.has(name); on ? values.add(name) : values.delete(name); } };
};

test("native effect expansion accepts SVG controls and still expands and collapses the real effect once", async () => {
  for (const tag of ["svg", "i", null]) {
    let previews = 0, renders = 0, inserts = 0;
    const icon = tag ? { classList: classes([]) } : null;
    const summary = { parentElement: { addEventListener() {} }, querySelectorAll: () => [],
      insertAdjacentHTML() { inserts++; } };
    const row = { dataset: { uuid: "Actor.pc.ActiveEffect.effect" }, classList: classes(["collapsed"]),
      querySelector(selector) { return selector.includes(".wrapper") ? summary : tag === "i" || selector.includes("svg") ? icon : null; } };
    const target = { closest: () => row };
    const effect = { id: "effect", isOwner: true, async getPreviewContext({ secrets }) { assert.equal(secrets, true); previews++; return {}; } };
    const app = { expandedSections: new Map() };
    const handler = new Function("foundry", "requestAnimationFrame", `return async function(target, { effect }={}) {${body}}`)(
      { applications: { handlebars: { async renderTemplate() { renders++; return '<div class="item-summary">Descrição real</div>'; } } } }, callback => callback());
    await handler.call({ app }, target, { effect });
    assert.equal(app.expandedSections.get("effects.effect"), true);
    assert.equal(row.classList.contains("collapsed"), false);
    await handler.call({ app }, target, { effect });
    assert.equal(app.expandedSections.get("effects.effect"), false);
    assert.equal(row.classList.contains("collapsed"), true);
    assert.equal(previews, 1);
    assert.equal(renders, 1);
    assert.equal(inserts, 1);
  }
});

test("the 2.0 effect context changes presentation while retaining native columns, IDs and 1.0 behavior", async () => {
  const sheet = readFileSync(new URL("../module/applications/actor/character-sheet.mjs", import.meta.url), "utf8");
  const contextBody = sheet.match(/async _prepareEffectsContext\(context, options\) \{([\s\S]*?)\n  \}/)[1];
  const columns = [{ id: "detail", width: 150, template: "detail.hbs" }, { id: "controls", width: 70, template: "controls.hbs" }, { id: "extension", template: "module.hbs" }];
  const categories = () => ({ passive: { type: "passive", label: "Passive", columns, effects: [{ id: "real-owned" }] }, inactive: { type: "inactive", label: "Inactive", columns, effects: [] } });
  for (const v2 of [true, false]) {
    const Sheet = new Function("Ruleset", "JJ_CONDITIONS", `return class extends class { async _prepareEffectsContext(context) { return context; } } { async _prepareEffectsContext(context, options) {${contextBody}} }`)(
      { isV2: () => v2 }, [{ id: "jj-caido", label: "Caído" }]);
    const instance = new Sheet(); instance.actor = { statuses: new Set(["jj-caido"]) };
    const context = await instance._prepareEffectsContext({ effects: categories() }, {});
    assert.equal(context.jjConditions[0].active, true);
    assert.equal(context.effects.passive.effects[0].id, "real-owned");
    assert.equal(context.effects.passive.columns[2].template, "module.hbs");
    assert.equal(context.effects.passive.label, v2 ? "Efeitos Passivos" : "Passive");
    assert.equal(context.jj2EffectsCount, v2 ? 1 : undefined);
    assert.equal(context.effects.passive.columns[1].template, v2 ? "systems/jujutsu-system/templates/effects/columns/controls-2.hbs" : "controls.hbs");
  }
  assert.equal(columns[1].width, 70, "the native shared column definitions are not mutated");
});
