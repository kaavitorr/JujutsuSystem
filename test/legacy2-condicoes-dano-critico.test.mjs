import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

// ── Stubs (antes das importações dinâmicas) ─────────────────────────────────
const handlersRegistrados = {};
globalThis.Hooks = {
  on(nome, fn) { (handlersRegistrados[nome] ??= []).push(fn); },
  once() {}, call() {}, callAll() {}
};
globalThis.game = { settings: { get: () => "2.0" }, combat: null, user: { targets: new Set() } };
globalThis.CONFIG = { JUJUTSU: {}, DND5E: { skillPassive: { base: 10 } },
  statusEffects: { poisoned: { id: "poisoned" }, frightened: { id: "frightened" } } };
globalThis.ChatMessage = { create: async (m) => { globalThis.__chat.push(m); }, getSpeaker: () => ({}) };
globalThis.__chat = [];
globalThis.ui = { notifications: { warn() {}, info() {} } };
Math.clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const {
  registrarGatilhoDano, aplicarCondicaoPorDano, aplicarCondicaoDano, removerCondicaoDano
} = await import("../module/systems/condicoes-dano.mjs");
const { PECULIARIDADES } = await import("../module/systems/peculiaridades-automacao.mjs");
const Ruleset = (await import("../module/systems/ruleset.mjs")).default;

/** Fábrica de alvo com captura de salvaguardas, efeitos criados e chats. */
function alvoFalso({ saveTotal = 0, items = [], efeitos = [] } = {}) {
  const criados = [], atualizacoes = [], salvaguardas = [];
  const alvo = {
    id: "alvo" + Math.random().toString(36).slice(2, 8),
    name: "Alvo",
    items, effects: efeitos,
    system: { attributes: { hp: { value: 10, max: 10 } }, abilities: { con: { value: 1 }, wis: { value: 1 } } },
    rollAbilitySave: async (ability, opts) => { salvaguardas.push({ ability, opts, total: saveTotal }); return { total: saveTotal }; },
    createEmbeddedDocuments: async (tipo, dados) => { criados.push({ tipo, dados }); return dados; }
  };
  return { alvo, criados, atualizacoes, salvaguardas };
}

const atacanteFalso = { name: "Atacante", system: { abilities: { str: { value: 3 } } } };

// ── Cabeamento (fixtures de fonte) ──────────────────────────────────────────
const fonteCards = readFileSync(new URL("../module/applications/actor/jj/native-cards.mjs", import.meta.url), "utf8");
const fonteAtaque = readFileSync(new URL("../module/documents/activity/attack.mjs", import.meta.url), "utf8");
const fonteDano = readFileSync(new URL("../module/applications/actor/jj/damage-application.mjs", import.meta.url), "utf8");
const fonteCondicoes = readFileSync(new URL("../module/systems/condicoes-dano.mjs", import.meta.url), "utf8");

test("o fluxo de ataque registra o gatilho no 20 natural ou Fulgor Negro", () => {
  assert.match(fonteAtaque, /if \( rolls\?\.length \) await postJJAttackRoll\(this, rolls\)/);
  assert.match(fonteCards, /d20Ativo === 20 \|\| isFulgor[\s\S]{0,600}?registrarGatilhoDano\(alvo\.actor/);
  // Os tipos do gatilho vêm das partes de dano da activity.
  assert.ok(fonteCards.includes("activity.damage?.parts ?? []"));
  // E os cards consomem o gatilho no momento do dano.
  assert.ok(fonteDano.includes("aplicarCondicaoPorDano(actor, { tiposAplicados: damageTypes })"));
});

test("efeitos criados mapeiam os referentes core das condições", () => {
  assert.match(fonteCondicoes, /statuses: \[cond\.status, \.\.\.cond\.extra\]\.flatMap\(/);
});

// ── Fluxo funcional ─────────────────────────────────────────────────────────
test("crítico com fogo: falha na salvaguarda aplica Em Chamas por 3 rodadas", async () => {
  globalThis.__chat.length = 0;
  globalThis.game.combat = { round: 2, turn: 1 };
  const { alvo, criados, salvaguardas } = alvoFalso({ saveTotal: 5 });
  registrarGatilhoDano(alvo, { tipos: ["fire"], atacante: atacanteFalso });
  assert.equal(await aplicarCondicaoPorDano(alvo, { tiposAplicados: ["fire"] }), true);

  // Salvaguarda de Constituição contra CD 10 + atributo principal (str 3 → 13)
  const chave = Ruleset.atributoPrincipal?.(atacanteFalso) ?? "str";
  assert.equal(salvaguardas.length, 1);
  assert.equal(salvaguardas[0].ability, "con");
  assert.match(salvaguardas[0].opts.flavor, new RegExp(`CD ${10 + atacanteFalso.system.abilities[chave].value}`));

  const criado = criados[0];
  assert.equal(criado.tipo, "ActiveEffect");
  const dados = criado.dados[0];
  assert.equal(dados.name, "Em Chamas");
  assert.deepEqual(dados.statuses, ["jj-em-chamas"]);
  assert.equal(dados.duration.rounds, 3);
  assert.equal(dados.duration.startRound, 2);
  assert.equal(dados.duration.startTurn, 1);
  assert.deepEqual(dados.flags["jujutsu-system"].condicaoDano, { chave: "fire", cd: 13, save: "con" });
  assert.ok(globalThis.__chat.some(m => m.content.includes("falha")));

  // Gatilho consumido: aplicar dano de novo não reaplica
  assert.equal(await aplicarCondicaoPorDano(alvo, { tiposAplicados: ["fire"] }), false);
  assert.equal(criados.length, 1);
  globalThis.game.combat = null;
});

test("salvaguarda bem-sucedida evita a condição", async () => {
  const { alvo, criados, salvaguardas } = alvoFalso({ saveTotal: 13 });
  registrarGatilhoDano(alvo, { tipos: ["fire"], atacante: atacanteFalso });
  assert.equal(await aplicarCondicaoPorDano(alvo, { tiposAplicados: ["fire"] }), false);
  assert.equal(salvaguardas[0].total, 13);
  assert.equal(criados.length, 0);
});

test("tipo de dano sem condição mapeada não dispara nem consome o gatilho", async () => {
  const { alvo, criados, salvaguardas } = alvoFalso({ saveTotal: 0 });
  registrarGatilhoDano(alvo, { tipos: ["fire"], atacante: atacanteFalso });
  assert.equal(await aplicarCondicaoPorDano(alvo, { tiposAplicados: ["bludgeoning"] }), false);
  assert.equal(salvaguardas.length, 0);
  assert.equal(criados.length, 0);
  // O gatilho segue pendente para o dano que tem condição associada.
  assert.equal(await aplicarCondicaoPorDano(alvo, { tiposAplicados: ["fire"] }), true);
  assert.equal(criados.length, 1);
});

test("Fulgor Negro dispara independentemente dos tipos registrados no gatilho", async () => {
  const { alvo, criados } = alvoFalso({ saveTotal: 1 });
  registrarGatilhoDano(alvo, { tipos: ["slashing"], atacante: atacanteFalso, fulgor: true });
  assert.equal(await aplicarCondicaoPorDano(alvo, { tiposAplicados: ["fire"] }), true);
  assert.equal(criados[0].dados[0].name, "Em Chamas");
});

test("reaplicar reseta a duração em vez de duplicar o efeito", async () => {
  globalThis.__chat.length = 0;
  const atualizacoes = [];
  const existente = {
    name: "Em Chamas", statuses: new Set(["jj-em-chamas"]),
    getFlag: (e, k) => (k === "condicaoDano" ? { chave: "fire", cd: 13 } : undefined),
    update: async (u) => atualizacoes.push(u)
  };
  const { alvo, criados } = alvoFalso({ saveTotal: 1, efeitos: [existente] });
  registrarGatilhoDano(alvo, { tipos: ["fire"], atacante: atacanteFalso });
  assert.equal(await aplicarCondicaoPorDano(alvo, { tiposAplicados: ["fire"] }), true);
  assert.equal(criados.length, 0);
  assert.equal(atualizacoes.length, 1);
  // Sem combate: duração em segundos (3 rodadas × 6).
  assert.equal(atualizacoes[0].duration.seconds, 18);
  assert.ok(globalThis.__chat.some(m => m.content.includes("sofre novamente")));
});

test("veneno aplica Envenenado com o referente core 'poisoned'", async () => {
  const { alvo, criados, salvaguardas } = alvoFalso({ saveTotal: 1 });
  registrarGatilhoDano(alvo, { tipos: ["poison"], atacante: atacanteFalso });
  assert.equal(await aplicarCondicaoPorDano(alvo, { tiposAplicados: ["poison"] }), true);
  assert.deepEqual(criados[0].dados[0].statuses, ["jj-envenenado", "poisoned"]);
  assert.equal(salvaguardas[0].ability, "con");
});

test("entropia (necrótico) usa Sabedoria e traz Amedrontado com core 'frightened'", async () => {
  globalThis.game.combat = { round: 3, turn: 0 };
  const { alvo, criados, salvaguardas } = alvoFalso({ saveTotal: 1 });
  registrarGatilhoDano(alvo, { tipos: ["necrotic"], atacante: atacanteFalso });
  assert.equal(await aplicarCondicaoPorDano(alvo, { tiposAplicados: ["necrotic"] }), true);
  assert.equal(salvaguardas[0].ability, "wis");
  const dados = criados[0].dados[0];
  assert.equal(dados.name, "Entropia");
  assert.deepEqual(dados.statuses, ["jj-entropia", "jj-amedrontado", "frightened"]);
  assert.equal(dados.duration.rounds, 2);
  assert.equal(dados.duration.startRound, 3);
  globalThis.game.combat = null;
});

test("Doença Sobrenatural é imune às condições de dano", async () => {
  globalThis.__chat.length = 0;
  const item = { type: "feat", name: PECULIARIDADES["doenca-sobrenatural"],
    flags: { "jujutsu-system": { featureSection: "jj-peculiarities" } } };
  const { alvo, criados, salvaguardas } = alvoFalso({ saveTotal: 0, items: [item] });
  assert.equal(await aplicarCondicaoDano(alvo, "fire", { cd: 10 }), false);
  assert.equal(salvaguardas.length, 0);
  assert.equal(criados.length, 0);
  assert.ok(globalThis.__chat.some(m => m.content.includes("imune")));
});

test("hook dnd5e.applyDamage também consome o gatilho", async () => {
  // O Corpo Frágil (peculiaridades) registra outro handler antes — pega o das condições de dano.
  const handler = (handlersRegistrados["dnd5e.applyDamage"] ?? [])
    .find(fn => String(fn).includes("aplicarCondicaoPorDano"));
  assert.equal(typeof handler, "function");
  const { alvo, criados } = alvoFalso({ saveTotal: 1 });
  registrarGatilhoDano(alvo, { tipos: ["cold"], atacante: atacanteFalso });
  assert.equal(await handler(alvo, 8, { damages: [{ types: ["cold"] }] }), true);
  const dados = criados[0].dados[0];
  assert.equal(dados.name, "Congelando");
  assert.deepEqual(dados.statuses, ["jj-congelando", "jj-lento"]);
});

test("Estremecido (thunder) dura até o fim do turno da criatura em combate", async () => {
  globalThis.game.combat = { round: 2, turn: 0 };
  const { alvo, criados } = alvoFalso({ saveTotal: 1 });
  registrarGatilhoDano(alvo, { tipos: ["thunder"], atacante: atacanteFalso });
  assert.equal(await aplicarCondicaoPorDano(alvo, { tiposAplicados: ["thunder"] }), true);
  const dados = criados[0].dados[0];
  assert.equal(dados.name, "Estremecido");
  // v14: 1 turno com expiração no turnEnd — o fim do turno do próprio afetado.
  assert.equal(dados.duration.turns, 1);
  assert.equal(dados.duration.expiry, "turnEnd");
  // Fora de combate não há turnos: sem duração automática.
  globalThis.game.combat = null;
  const fora = alvoFalso({ saveTotal: 1 });
  registrarGatilhoDano(fora.alvo, { tipos: ["thunder"], atacante: atacanteFalso });
  await aplicarCondicaoPorDano(fora.alvo, { tiposAplicados: ["thunder"] });
  assert.equal(fora.criados[0].dados[0].duration, undefined);
});

test("Remover consome 2 Pontos de Ação e apaga a condição no sucesso", async () => {
  globalThis.__chat.length = 0;
  const apagado = [];
  const efeito = { delete: async () => apagado.push(true) };
  const alvo = {
    name: "Alvo",
    system: { legacy2: { actions: { value: 5 } } },
    rollSkill: async () => [{ total: 15 }],
    update: async (u) => {
      if ("system.legacy2.actions.value" in u) alvo.system.legacy2.actions.value = u["system.legacy2.actions.value"];
    }
  };
  assert.equal(await removerCondicaoDano(alvo, { cd: 13, label: "Em Chamas", effect: efeito }), true);
  assert.deepEqual(apagado, [true]);
  assert.equal(alvo.system.legacy2.actions.value, 3);
  // Sem PA: nem rola.
  alvo.system.legacy2.actions.value = 1;
  assert.equal(await removerCondicaoDano(alvo, { cd: 13, label: "Em Chamas", effect: efeito }), false);
  assert.equal(alvo.system.legacy2.actions.value, 1);
});
