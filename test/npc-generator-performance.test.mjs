import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { activateNpcGeneratorWeapons } from "../module/applications/actor/jj/npc-generator-weapons.mjs";

function weaponPicker(size) {
  const operations = { rowQueries: 0, nameReads: 0, hiddenWrites: 0, redundantWrites: 0 };
  const control = () => ({ value: "", handlers: {}, addEventListener(event, fn) { this.handlers[event] = fn; } });
  const search = control(), source = control();
  const count = {}, empty = { hidden: true }, heading = {};
  const rows = Array.from({ length: size }, (_, index) => {
    const input = { checked: false };
    return {
      input,
      dataset: { weaponFolder: "base", weaponGroup: "World",
        get weaponName() { operations.nameReads++; return `Weapon ${index}`; } },
      _hidden: false,
      get hidden() { return this._hidden; },
      set hidden(value) {
        operations.hiddenWrites++;
        if (this._hidden === value) operations.redundantWrites++;
        this._hidden = value;
      },
      querySelector() { operations.rowQueries++; return input; }
    };
  });
  const buttons = ["base", "fire", "all"].map(folder => ({ ...control(), dataset: { weaponFolder: folder }, setAttribute() {} }));
  const selectors = { "[data-weapon-search]": search, "[data-weapon-source]": source,
    "[data-weapon-count]": count, "[data-weapon-empty]": empty, "[data-weapon-heading]": heading };
  const picker = { ...control(), querySelector: selector => selectors[selector],
    querySelectorAll: selector => selector === ".jj-npcgen-weapon-row" ? rows : buttons };
  activateNpcGeneratorWeapons({ querySelector: () => picker });
  return { operations, search, source, rows, buttons, picker, count, empty };
}

test("weapon searches reuse input references and normalized names and only change necessary visibility", () => {
  const { operations, search, rows } = weaponPicker(1000);
  assert.equal(operations.rowQueries, 1000, "Each checkbox is resolved once when the picker opens");
  assert.equal(operations.nameReads, 1000, "Each weapon name is prepared once when the picker opens");
  assert.equal(operations.hiddenWrites, 0, "The authored initial visibility already matches the Base folder");
  Object.keys(operations).forEach(key => { operations[key] = 0; });

  for (let index = 0; index < 10; index++) {
    search.value = `Weapon ${index}`;
    search.handlers.input();
  }
  assert.deepEqual(operations, { rowQueries: 0, nameReads: 0, hiddenWrites: 2887, redundantWrites: 0 });
  assert.equal(rows.filter(row => !row.hidden).length, 111);
  search.handlers.input();
  assert.equal(operations.hiddenWrites, 2887, "Repeating the same query changes no row visibility");
});

test("cached weapon controls retain checked UUID choices across folder and source changes", () => {
  const { search, source, rows, buttons, picker, count, empty } = weaponPicker(3);
  rows[0].input.checked = true;
  picker.handlers.change();
  buttons[1].handlers.click();
  assert(rows.every(row => row.hidden));
  assert.equal(empty.hidden, false);
  source.value = "Other source";
  source.handlers.change();
  buttons[2].handlers.click();
  source.value = "World";
  source.handlers.change();
  search.value = "weapon 1";
  search.handlers.input();
  rows[1].input.checked = true;
  picker.handlers.change();
  assert.deepEqual(rows.map(row => row.input.checked), [true, true, false]);
  assert.deepEqual(rows.map(row => row.hidden), [true, false, true]);
  assert.match(count.textContent, /2 selecionadas$/);
});

test("the directory and 2.0 generator load no classic engine until 1.0 is opened, then both classic types still create actors", async () => {
  const loaded = [];
  const loader = registerHooks({ load(url, context, nextLoad) {
    if (url.includes("/systems/npc-generator/")) loaded.push(url);
    return nextLoad(url, context);
  } });
  const hooks = new Map();
  globalThis.Hooks = { on: (event, callback) => hooks.set(event, callback) };
  globalThis.game = { user: { isGM: true }, settings: { get: () => "2.0" }, items: [], packs: [] };
  globalThis.ui = { notifications: { warn() {}, error(message) { assert.fail(message); }, info() {} } };
  globalThis.CONFIG = { JUJUTSU: { taxonomias: {}, arquetipos: {} } };
  const dialogs = [];
  let result = null, sequence = 0;
  globalThis.foundry = { utils: { randomID: () => `activity${sequence++}` }, applications: { api: { DialogV2: { wait: async options => {
    dialogs.push(options);
    return result;
  } } } } };
  try {
    const generator = await import("../module/applications/actor/jj/npc-generator-dialog.mjs");
    assert.deepEqual(loaded, [], "Opening the actor directory must not initialize the classic generator data");
    assert.equal(typeof hooks.get("renderActorDirectory"), "function");
    await generator.openNpcGenerator();
    await generator.openNpcGenerator2();
    assert.deepEqual(loaded, [], "Cancelling the version selector and using 2.0 need no classic data");
    assert.match(dialogs[1].content, /name="taxonomia"/);

    await generator.openNpcGenerator1();
    for (const name of ["npcGenerator.mjs", "nd-table.mjs", "npcHumanoideCalibrado.mjs", "npcData.mjs", "npcCurses.mjs"]) {
      assert(loaded.some(url => url.endsWith(`/${name}`)), `${name} is available when 1.0 opens`);
    }
    assert.match(dialogs[2].content, /jj-npcgen-tipo/);
    assert.match(dialogs[2].content, /value="5" selected/);
    const initialLoads = loaded.length;

    const actors = [];
    globalThis.Actor = { implementation: { create: async data => {
      const actor = { ...data, items: [], createEmbeddedDocuments: async (_type, items) => actor.items.push(...items),
        sheet: { render: value => { actor.rendered = value; } } };
      actors.push(actor);
      return actor;
    } } };
    for (const tipo of ["maldicao", "humano"]) {
      result = { tipo, nd: 5, arquetipo: "robusto", estilo: "Lutador", lutFoco: "forca", grauCE: "",
        origem: "", manipulacoes: [], boss: false };
      await generator.openNpcGenerator1();
      const actor = actors.at(-1);
      assert.equal(actor.type, "npc");
      assert.equal(actor.system.details.cr, 5);
      assert(actor.system.attributes.hp.max > 0);
      assert(actor.items.some(item => Object.values(item.system.activities ?? {}).some(activity => activity.type === "attack")));
      assert.equal(actor.rendered, true);
    }
    assert.equal(actors.length, 2);
    assert.equal(loaded.length, initialLoads, "Reopening 1.0 reuses the native module cache");
  } finally {
    loader.deregister();
  }
});
