import assert from "node:assert/strict";
import { test } from "node:test";
import { presentWorldRules } from "../module/applications/world-rules-dialog.mjs";

function world({ version = "1.0", saves = false, choice = null, gm = true, activeGM = "gm", storage = new Map() } = {}) {
  const settings = new Map([["rulesetVersion", version], ["regraSalvaguarda", saves], ["showWorldRulesOnEntry", true]]);
  const state = { prompts: 0, reloads: 0, broadcasts: [], settings, choice, writes: [] };
  globalThis.game = {
    world: { id: "test-world" }, user: { id: "gm", isGM: gm }, users: { activeGM: { id: activeGM } },
    settings: { get: (_scope, key) => settings.get(key), set: async (_scope, key, value) => {
      if (state.fail === key) throw new Error("Setting unavailable");
      state.writes.push(key); settings.set(key, value);
    } },
    socket: { emit: event => state.broadcasts.push(event) }
  };
  globalThis.sessionStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  globalThis.foundry = { utils: { debouncedReload: () => state.reloads++ }, applications: { api: { DialogV2: {
    wait: async config => { state.prompts++; state.dialog = config; return state.choice; }
  } } } };
  return state;
}

test("only the active GM chooses world rules", async () => {
  let state = world({ gm: false });
  await presentWorldRules(); assert.equal(state.prompts, 0);
  state = world({ activeGM: "other-gm" });
  await presentWorldRules(); assert.equal(state.prompts, 0);
});

test("choosing 2.0 and combined saves saves both world settings before reloading everyone", async () => {
  const state = world({ choice: { version: "2.0", alternativeSaves: true } });
  await presentWorldRules();
  assert.equal(state.settings.get("rulesetVersion"), "2.0");
  assert.equal(state.settings.get("regraSalvaguarda"), true);
  assert.deepEqual(state.writes, ["rulesetVersion", "regraSalvaguarda"]);
  assert.deepEqual(state.broadcasts, ["reload"]); assert.equal(state.reloads, 1);
});

test("the reload caused by applying rules skips one prompt without suppressing future entries", async () => {
  const state = world({ choice: { version: "2.0", alternativeSaves: true } });
  await presentWorldRules();
  await presentWorldRules(); assert.equal(state.prompts, 1);
  state.choice = null;
  await presentWorldRules(); assert.equal(state.prompts, 2);
});

test("confirming current rules or closing the prompt leaves settings and clients alone", async () => {
  const state = world({ version: "2.0", saves: true, choice: { version: "2.0", alternativeSaves: true } });
  await presentWorldRules(); assert.equal(state.reloads, 0); assert.deepEqual(state.writes, []);
  state.choice = null;
  await presentWorldRules(); assert.equal(state.prompts, 2); assert.deepEqual(state.broadcasts, []);
});

test("1.0 always uses original saves even if a stale checkbox was selected", async () => {
  const state = world({ version: "2.0", saves: true, choice: { version: "1.0", alternativeSaves: true } });
  await presentWorldRules();
  assert.equal(state.settings.get("rulesetVersion"), "1.0");
  assert.equal(state.settings.get("regraSalvaguarda"), false);
});

test("invalid versions cannot change world settings", async () => {
  const state = world({ choice: { version: "invalid", alternativeSaves: true } });
  await assert.rejects(presentWorldRules(), /versão/i);
  assert.deepEqual(state.writes, []); assert.equal(state.reloads, 0);
});

test("a failed setting write rolls back the version and does not reload or suppress the next prompt", async () => {
  const state = world({ choice: { version: "2.0", alternativeSaves: true } });
  state.fail = "regraSalvaguarda";
  await assert.rejects(presentWorldRules(), /Setting unavailable/);
  assert.equal(state.settings.get("rulesetVersion"), "1.0");
  assert.equal(state.reloads, 0); assert.deepEqual(state.broadcasts, []);
  state.choice = null;
  await presentWorldRules(); assert.equal(state.prompts, 2);
});

test("do not show again persists the preference without reloading unchanged rules and can be re-enabled", async () => {
  const state = world({ choice: { version: "1.0", alternativeSaves: false, dontShowAgain: true } });
  await presentWorldRules();
  assert.equal(state.settings.get("showWorldRulesOnEntry"), false);
  assert.equal(state.reloads, 0); assert.deepEqual(state.broadcasts, []);
  await presentWorldRules(); assert.equal(state.prompts, 1);
  state.settings.set("showWorldRulesOnEntry", true);
  state.choice = null;
  await presentWorldRules(); assert.equal(state.prompts, 2);
});

test("do not show again also applies selected rules before hiding the prompt", async () => {
  const state = world({ choice: { version: "2.0", alternativeSaves: true, dontShowAgain: true } });
  await presentWorldRules();
  assert.equal(state.settings.get("rulesetVersion"), "2.0");
  assert.equal(state.settings.get("regraSalvaguarda"), true);
  assert.equal(state.settings.get("showWorldRulesOnEntry"), false);
  assert.equal(state.reloads, 1);
  await presentWorldRules(); await presentWorldRules(); assert.equal(state.prompts, 1);
});
