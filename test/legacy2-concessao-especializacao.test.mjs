import assert from "node:assert/strict";
import { test } from "node:test";
import Ruleset from "../module/systems/ruleset.mjs";
import { adquiridas, concedidas, possuidas, tem, conceder, revogarConcessao,
  escolhasDisponiveis, escolhasTotais, avaliarNo, sincronizarEspecializacoes } from "../module/systems/especializacoes-2.mjs";

globalThis.game = { settings: { get: () => "2.0" } };
globalThis.CONFIG = { JUJUTSU: {}, DND5E: { skillPassive: { base: 10 } } };
Math.clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function ator({ especiais = [], concedidas: conced = [], itens = [] } = {}) {
  const estado = { especiais: [...especiais], concedidas: [...conced] };
  return {
    name: "Jogador", type: "character", items: itens,
    itemTypes: { class: [{ getFlag: (e, k) => k === "legacy2" ? { espIniciais: 2 } : undefined }] },
    system: { details: { level: 1 }, legacy2: {} },
    getFlag: (escopo, chave) => chave === "especializacoes" ? estado.especiais
      : chave === "especializacoesConcedidas" ? estado.concedidas : undefined,
    setFlag: async (escopo, chave, valor) => {
      if ( chave === "especializacoes" ) estado.especiais = valor;
      if ( chave === "especializacoesConcedidas" ) estado.concedidas = valor;
    },
    __estado: estado
  };
}

const estilo = { itemTypes: { class: [{ getFlag: (e, k) => k === "legacy2" ? { espIniciais: 2 } : undefined }] } };

test("conceder registra na lista própria sem gastar escolha e tem() enxerga", async () => {
  const a = ator({ especiais: ["Punho Ardente"] });
  const antes = escolhasDisponiveis(a);
  assert.equal(antes, escolhasTotais(a) - 1);
  await conceder(a, "Energia Reversa");
  assert.deepEqual(concedidas(a), ["Energia Reversa"]);
  assert.deepEqual(adquiridas(a), ["Punho Ardente"]); // lista regular intacta
  assert.equal(escolhasDisponiveis(a), antes); // não consome escolha
  assert.equal(tem(a, "Energia Reversa"), true); // pré-requisitos enxergam
  assert.deepEqual(possuidas(a), ["Energia Reversa", "Punho Ardente"]);
});

test("conceder é idempotente e não duplica quem já aprendeu regularmente", async () => {
  const a = ator({ especiais: ["Punho Ardente"] });
  await conceder(a, "Punho Ardente");
  assert.deepEqual(concedidas(a), []); // já possui — nada a conceder
  await conceder(a, "Energia Reversa");
  await conceder(a, "Energia Reversa");
  assert.deepEqual(concedidas(a), ["Energia Reversa"]);
});

test("revogar retira só a concessão e preserva as escolhas regulares", async () => {
  const a = ator({ especiais: ["Punho Ardente"], concedidas: ["Energia Reversa"] });
  await revogarConcessao(a, "Energia Reversa");
  assert.deepEqual(concedidas(a), []);
  assert.deepEqual(adquiridas(a), ["Punho Ardente"]);
  await revogarConcessao(a, "Energia Reversa"); // ausente: não faz nada
  assert.deepEqual(adquiridas(a), ["Punho Ardente"]);
});

test("concessões contam para requisitos de contagem", () => {
  // "2 Habilidades de Especialização": 1 regular + 1 concedida satisfazem.
  const no = { nome: "Dependente", requisitos: ["2 Habilidades de Especialização"] };
  const soRegular = ator({ especiais: ["A", "B"] });
  const comConcessao = ator({ especiais: ["A"], concedidas: ["B"] });
  assert.equal(avaliarNo(soRegular, no).estado, "disponivel");
  assert.equal(avaliarNo(comConcessao, no).estado, "disponivel");
  const insuficiente = ator({ especiais: ["A"] });
  const av = avaliarNo(insuficiente, no);
  assert.equal(av.estado, "bloqueado");
  assert.equal(escolhasDisponiveis(insuficiente), escolhasTotais(insuficiente) - 1);
});

test("a sincronização preserva o feat das concessões e só limpa escolhas desfeitas", async () => {
  const itemConcedido = { name: "Concedida X", id: "i1", getFlag: (e, k) => k === "especializacaoAdquirida" ? true : undefined };
  const itemRegular = { name: "Regular Y", id: "i2", getFlag: (e, k) => k === "especializacaoAdquirida" ? true : undefined };
  const itemOrfao = { name: "Órfão Z", id: "i3", getFlag: (e, k) => k === "especializacaoAdquirida" ? true : undefined };
  const a = ator({ especiais: ["Regular Y"], concedidas: ["Concedida X"], itens: [itemConcedido, itemRegular, itemOrfao] });
  let removidos = null;
  a.deleteEmbeddedDocuments = async (tipo, ids) => { removidos = ids; };
  await sincronizarEspecializacoes(a, { porNome: new Map() });
  assert.deepEqual(removidos, ["i3"]); // órfão sai; concedida e regular ficam
});
