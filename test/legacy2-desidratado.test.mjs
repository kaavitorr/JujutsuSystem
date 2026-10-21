import assert from "node:assert/strict";
import { test } from "node:test";

globalThis.Hooks = { on() {}, once() {}, call() {}, callAll() {} };
globalThis.game = { user: { id: "gm", isGM: true }, users: { activeGM: { id: "gm", isGM: true } },
  settings: { get: () => "2.0" } };
globalThis.ChatMessage = { create: async (mensagem) => { globalThis.__chat.push(mensagem); }, getSpeaker: () => ({}) };
globalThis.__chat = [];
Math.clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const { atualizarDesidratado } = await import("../module/systems/acoes-combate.mjs");

function ator({ desidratado = true, desde = 0, horas = 0, exaustao = 0 } = {}) {
  const flagsArmazenadas = { desidratadoDesde: desde, desidratadoHoras: horas };
  const atorReal = {
    name: "Ator", type: "character",
    statuses: new Set(desidratado ? ["jj-desidratado"] : []),
    system: { attributes: { exhaustion: exaustao } },
    getFlag(escopo, chave) { return flagsArmazenadas[chave]; },
    setFlag: async (escopo, chave, valor) => { flagsArmazenadas[chave] = valor; },
    unsetFlag: async (escopo, chave) => { delete flagsArmazenadas[chave]; },
    update: async (updates) => {
      if ( "system.attributes.exhaustion" in updates ) atorReal.system.attributes.exhaustion = updates["system.attributes.exhaustion"];
    },
    __exaustao: () => atorReal.system.attributes.exhaustion
  };
  return atorReal;
}

test("desidratado: 1 nível de exaustão por hora com a condição ativa", async () => {
  const a = ator({ desde: 0 });
  assert.equal(await atualizarDesidratado(a, 3599), 0);
  assert.equal((a.__exaustao() ?? 0), 0);
  assert.equal(await atualizarDesidratado(a, 3600), 1);
  assert.equal(a.__exaustao(), 1);
  assert.equal(await atualizarDesidratado(a, 3601), 0);
  assert.equal(a.__exaustao(), 1);
  assert.equal(await atualizarDesidratado(a, 10800), 2);
  assert.equal(a.__exaustao(), 3);
});

test("sem a condição ativa, o tempo não gera exaustão", async () => {
  const a = ator({ desidratado: false, desde: 0 });
  assert.equal(await atualizarDesidratado(a, 72000), 0);
  assert.equal((a.__exaustao() ?? 0), 0);
});

test("tempo voltando (sincronização) não gera exaustão", async () => {
  const a = ator({ desde: 7200 });
  assert.equal(await atualizarDesidratado(a, 3600), 0);
  assert.equal((a.__exaustao() ?? 0), 0);
});
