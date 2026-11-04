import assert from "node:assert/strict";
import { test } from "node:test";
import { registerCursedBenefitHooks1, syncCursedBenefits1 } from "../module/systems/seres-amaldicoados-1-hooks.mjs";

const NS = "jujutsu-system";
function apply(object, updates) { for (const [path, value] of Object.entries(updates)) {
  const keys = path.split("."), key = keys.pop(); let target = object;
  for (const part of keys) target = target[part] ??= {};
  if (key.startsWith("-=")) delete target[key.slice(2)]; else target[key] = structuredClone(value);
} }
function fixture(edition = "1.0") {
  let visits = 0, reads = 0;
  const gm = { id: "gm", isGM: true }, events = new Map();
  const world = { user: gm, users: { activeGM: gm }, settings: { get: () => edition }, time: { worldTime: 0 },
    scenes: Array.from({ length: 20 }, () => ({ tokens: Array.from({ length: 50 }, () => ({ get actorLink() { visits++; return true; } })) })), actors: [] };
  const resources = { cursePoints: 0, trainingPoints: 0 };
  const actor = { id: "base", type: "character", isOwner: true, items: [],
    flags: { [NS]: { cursedBenefits1: { cursePoints: 1 } } }, system: { details: { level: 1 },
      get curseResources() { reads++; return resources; } }, async update(updates) { apply(this, updates); } };
  globalThis.game = world;
  globalThis.ui = { notifications: { error: error => assert.fail(error) } };
  const callbacks = new Map();
  registerCursedBenefitHooks1({ on(event, fn) {
    if (!callbacks.has(event)) callbacks.set(event, []); callbacks.get(event).push(fn);
    events.set(event, (...args) => Promise.all(callbacks.get(event).map(callback => callback(...args))));
  }, once() {} });
  return { world, actor, events, visits: () => visits, reads: () => reads };
}
test("ten cosmetic actor updates in edition 2.0 never inspect scenes or tokens", async () => {
  const f = fixture("2.0"); f.actor.flags = {};
  await Promise.all(Array.from({ length: 10 }, () => f.events.get("updateActor")(f.actor, { "flags.visual": "x" }, {})));
  assert.equal(f.visits(), 0); assert.equal(f.reads(), 0);
});
test("simultaneous requests coalesce and a second synchronization reuses the token index", async () => {
  const f = fixture();
  await Promise.all(Array.from({ length: 10 }, () => syncCursedBenefits1(f.actor, f.world)));
  assert.equal(f.actor.system.curseResources.cursePoints, 1);
  assert.equal(f.reads(), 3); // calculation, applying its one write, and this assertion
  const before = f.visits(); await syncCursedBenefits1(f.actor, f.world);
  assert.equal(f.visits(), before);
});
test("a relevant update arriving during synchronization is applied before all callers finish", async () => {
  const f = fixture(); let release, started;
  const entered = new Promise(resolve => { started = resolve; }), wait = new Promise(resolve => { release = resolve; });
  let writes = 0;
  f.actor.update = async updates => { if (++writes === 1) { started(); await wait; } apply(f.actor, updates); };
  const first = syncCursedBenefits1(f.actor, f.world); await entered;
  f.actor.system.details.level = 2;
  const second = syncCursedBenefits1(f.actor, f.world); release(); await Promise.all([first, second]);
  assert.equal(f.actor.system.curseResources.cursePoints, 2); assert.equal(writes, 2);
});

test("adding an unlinked token invalidates the index and later delta actors are read live", async () => {
  const f = fixture(); await syncCursedBenefits1(f.actor, f.world);
  const child = () => ({ type: "character", isToken: true, isOwner: true, items: [],
    flags: { [NS]: { cursedBenefits1: { cursePoints: 1 } } }, system: { details: { level: 1 }, curseResources: { cursePoints: 0, trainingPoints: 0 } },
    async update(updates) { apply(this, updates); } });
  const token = { actorId: f.actor.id, actorLink: false, baseActor: f.actor, actor: child() };
  f.world.scenes[0].tokens.push(token); await f.events.get("createToken")(token, {}, "gm");
  await syncCursedBenefits1(f.actor, f.world); assert.equal(token.actor.system.curseResources.cursePoints, 1);
  const before = f.visits(); token.actor = child();
  await syncCursedBenefits1(f.actor, f.world); assert.equal(token.actor.system.curseResources.cursePoints, 1);
  assert.equal(f.visits(), before);
});

test("replaying a world pass revisits synthetic children whose base level changed during a write", async () => {
  const f = fixture(); let entered, release;
  const started = new Promise(resolve => { entered = resolve; }), wait = new Promise(resolve => { release = resolve; });
  const child = { type: "character", isToken: true, items: [], flags: { [NS]: { cursedBenefits1: { cursePoints: 1 } } },
    system: { details: f.actor.system.details, curseResources: { cursePoints: 0, trainingPoints: 0 } },
    async update(updates) { apply(this, updates); } };
  f.world.scenes = [{ tokens: [{ actorId: f.actor.id, actorLink: false, baseActor: f.actor, actor: child }] }];
  let writes = 0; f.actor.update = async updates => { if (++writes === 1) { entered(); await wait; } apply(f.actor, updates); };
  const first = syncCursedBenefits1(f.actor, f.world, { visited: new Set() }); await started;
  f.actor.system.details.level = 2; const second = syncCursedBenefits1(f.actor, f.world); release();
  await Promise.all([first, second]);
  assert.equal(child.system.curseResources.cursePoints, 2); assert.equal(f.actor.system.curseResources.cursePoints, 2);
});
test("a request at the queue's completion boundary starts fresh work instead of disappearing", async () => {
  const f = fixture(); let once = false, replay;
  Object.defineProperty(f.actor.flags[NS], "cursedEyesLast1", { configurable: true, get() {
    if (!once) { once = true; queueMicrotask(() => queueMicrotask(() => {
      f.actor.system.details.level = 2; replay = syncCursedBenefits1(f.actor, f.world);
    })); }
    return undefined;
  } });
  await syncCursedBenefits1(f.actor, f.world); await replay;
  assert.equal(f.actor.system.curseResources.cursePoints, 2);
});

test("a spent synthetic grant is anchored before its base ledger advances during synchronization", async () => {
  const f = fixture(); f.actor.system.curseResources.cursePoints = 1;
  f.actor.flags[NS].cursedBenefitGrants1 = { cursePoints: { granted: 1, deficit: 0 }, trainingPoints: { granted: 0, deficit: 0 } };
  let own, changed = false, replay;
  const child = { type: "character", isToken: true, items: [], flags: { [NS]: { cursedBenefits1: { cursePoints: 1 } } },
    system: { details: f.actor.system.details, curseResources: { cursePoints: 0, trainingPoints: 0 } },
    async update(updates) { apply(this, updates); } };
  Object.defineProperty(child.flags[NS], "cursedBenefitGrants1", { get: () => own ?? f.actor.flags[NS].cursedBenefitGrants1,
    set: value => { own = value; }, configurable: true });
  Object.defineProperty(child.flags[NS], "cursedEyesLast1", { get() {
    if (!changed) { changed = true; queueMicrotask(() => { f.actor.system.details.level = 2; replay = syncCursedBenefits1(f.actor, f.world); }); }
    return undefined;
  } });
  const token = { actorId: f.actor.id, actorLink: false, baseActor: f.actor, actor: child,
    delta: { getFlag: () => own, async update(updates) { own = structuredClone(updates[`flags.${NS}.cursedBenefitGrants1`]); } } };
  child.token = token; f.world.scenes = [{ tokens: [token] }];
  await syncCursedBenefits1(f.actor, f.world, { visited: new Set() }); await replay;
  assert.equal(f.actor.system.curseResources.cursePoints, 2);
  assert.equal(child.system.curseResources.cursePoints, 1);
});
