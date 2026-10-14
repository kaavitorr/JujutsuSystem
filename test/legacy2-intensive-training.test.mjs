import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildLegacy2Context } from "../module/applications/actor/jj/legacy2-sheet.mjs";
import { intensiveTrainingDialogContent, refinementTrainingLimit } from "../module/applications/actor/jj/intensive-training-dialog.mjs";

const source = readFileSync(new URL("../module/applications/actor/jj/manipulation-handlers.mjs", import.meta.url), "utf8");
const body = source.match(/export async function onIntensiveTraining\(actor\) \{([\s\S]*?)\n\}/)[1];

function fixture({ v2 = true, choice = "maxEnergy", generation = 0, beforeChoice } = {}) {
  const calls = [], dialogs = [];
  const actor = { name: "Feiticeiro", items: [], itemTypes: { class: [] }, system: {
    energy: { max: 70, intensiveTraining: { maxEnergy: 2, generatedEnergy: generation } }
  }, async update(data) { calls.push(data); } };
  const ruleset = { isV2: () => v2, estilo: () => ({ energiaBase: 14 }), atributoPrincipal: () => "str",
    rankLabel: () => "", rankBonus: () => 0, nivel: () => 5, trainingPointsTotal: () => 0, trainingPointsAvailable: () => 0, atributosAdicionais: () => 0 };
  const foundry = { utils: { escapeHTML: value => String(value) }, applications: { api: { DialogV2: { async wait(config) {
    assert.equal(config.content.tagName, "DIV");
    assert.equal(config.content.attributes.length, 0);
    dialogs.push({ ...config, content: config.content.innerHTML }); beforeChoice?.(actor); return choice;
  } } } } };
  const handler = new Function("Ruleset", "foundry", "ui", "ChatMessage", "intensiveTrainingDialogContent", "refinementTrainingLimit", "document", `return async function(actor) {${body}}`)(
    ruleset, foundry, { notifications: { warn() {}, info() {} } }, { create() {}, getSpeaker() {} }, intensiveTrainingDialogContent, refinementTrainingLimit,
    { createElement: tag => ({ tagName: tag.toUpperCase(), attributes: [], innerHTML: "" }) }
  );
  return { actor, calls, dialogs, handler, ruleset };
}

test("2.0 training uses style energy gain and updates the real training count", async () => {
  const f = fixture();
  await f.handler(f.actor);
  assert.deepEqual(f.calls, [{ "system.energy.intensiveTraining.maxEnergy": 3 }]);
  assert.ok(f.dialogs[0].content.includes("Treinar Energia Máxima"));
  assert.ok(f.dialogs[0].content.includes('class="jj2-training-gain">+14'));
  assert.ok(!f.dialogs[0].content.includes('value="cursePoints"'));
  f.actor.system.attributes = { hp: { max: 1 } };
  f.actor.system.abilities = {};
  const ctx = buildLegacy2Context(f.actor, { abilities: {} }, f.ruleset);
  assert.equal(ctx.intensiveTraining.energyBonus, 28);
});

test("refinement training stops at ten, including a count changed during the dialog", async () => {
  const f = fixture({ choice: "generatedEnergy", generation: 9,
    beforeChoice: actor => { actor.system.energy.intensiveTraining.generatedEnergy = 10; } });
  await f.handler(f.actor);
  assert.equal(f.calls.length, 0);
  const permitted = fixture({ choice: "generatedEnergy", generation: 9 });
  await permitted.handler(permitted.actor);
  assert.deepEqual(permitted.calls, [{ "system.energy.intensiveTraining.generatedEnergy": 10 }]);
  assert.ok(permitted.dialogs[0].content.includes("Treinar Refinamento"));
  assert.ok(permitted.dialogs[0].content.includes("9 / 10"));
  for ( const generation of [10, 11, 20] ) {
    const capped = fixture({ choice: "generatedEnergy", generation });
    await capped.handler(capped.actor);
    assert.equal(capped.calls.length, 0);
    assert.match(capped.dialogs[0].content, /value="generatedEnergy"[^>]*disabled/);
  }
});

test("the original 1.0 training cap remains twenty", async () => {
  const f = fixture({ v2: false, choice: "generatedEnergy", generation: 19 });
  await f.handler(f.actor);
  assert.deepEqual(f.calls, [{ "system.energy.intensiveTraining.generatedEnergy": 20 }]);
  const capped = fixture({ v2: false, choice: "generatedEnergy", generation: 20 });
  await capped.handler(capped.actor);
  assert.equal(capped.calls.length, 0);
});

test("cancelled or obsolete 2.0 training choices cannot write actor data; 1.0 remains available", async () => {
  for ( const choice of [null, "cursePoints", "unexpected"] ) {
    const f = fixture({ choice });
    await f.handler(f.actor);
    assert.equal(f.calls.length, 0);
  }
  const f = fixture({ v2: false, choice: "cursePoints" });
  await f.handler(f.actor);
  assert.deepEqual(f.calls[0], { "system.curseResources.cursePoints": 4, "system.energy.intensiveTraining.cursePoints": 4 });
  assert.ok(f.dialogs[0].content.includes('class="jj2-training-gain">+5'));
});
