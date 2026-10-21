import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { pontosDefeitos } from "../module/systems/legacy2-proficiencies.mjs";
import { PENALIDADE_VITAL_NOME, penalidadeVitalUuid } from "../module/applications/actor/creation/creation-model-2.mjs";

globalThis.game = { settings: { get: () => "2.0" } };
globalThis.CONFIG = { JUJUTSU: {}, DND5E: { skillPassive: { base: 10 } } };
globalThis.foundry = { utils: { getProperty: (obj, path) => String(path).split(".").reduce((no, chave) => no?.[chave], obj) } };
Math.clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const fonte = JSON.parse(readFileSync(new URL("../packs/_source/personalizacao-2-0.json", import.meta.url), "utf8"));
const porNome = Object.fromEntries(fonte.penalidadesVariantes.map(item => [item.name, item]));
const changesDe = item => (item.effects ?? []).flatMap(efeito => efeito.changes.map(c => `${efeito.name}:${c.key}:${c.mode}:${c.value}`));

test("as cinco penalidades automatáveis têm efeitos com as attribute keys esperadas", () => {
  assert.deepEqual(changesDe(porNome["Perde 1 Ponto de Ação permanente"]),
    ["Menos 1 Ponto de Ação:system.legacy2.actions.max:2:-1"]);
  assert.deepEqual(changesDe(porNome["Perde 2 Habilidades de Especialização"]),
    ["Menos 2 Especializações:system.legacy2.especiaisExtra:2:-2"]);
  assert.deepEqual(changesDe(porNome["Perde 3 dos seus Selos"]),
    ["Menos 3 Selos:flags.jujutsu-system.selosBonus:2:-3"]);
  assert.deepEqual(changesDe(porNome["Vulnerabilidade 10 a danos físicos"]), [
    "Vulnerabilidade 10 (físicos):system.legacy2.resistances.bludgeoning.value:2:-10",
    "Vulnerabilidade 10 (físicos):system.legacy2.resistances.slashing.value:2:-10",
    "Vulnerabilidade 10 (físicos):system.legacy2.resistances.piercing.value:2:-10"]);
  // Transferência para o ator e modo aditivo em todos os efeitos.
  for (const item of fonte.penalidadesVariantes) {
    for (const efeito of item.effects ?? []) {
      assert.equal(efeito.transfer, true, `${item.name}: efeito deve transferir`);
      assert.equal(efeito.disabled, false);
      for (const change of efeito.changes) assert.equal(change.mode, 2);
    }
  }
});

test("a penalidade de Vida/Energia traz os dois lados e a origem não é automatizada", () => {
  const vital = porNome[PENALIDADE_VITAL_NOME];
  assert.deepEqual((vital.effects ?? []).map(efeito => efeito.name), ["Penalidade: Vida", "Penalidade: Energia"]);
  assert.match(vital.system.description.value, /Na criação de personagem você escolhe qual perder/);
  const origem = porNome["Sacrifica os benefícios da origem"];
  assert.equal((origem.effects ?? []).length, 0);
});

test("o macro de importação repassa effects e img e carrega as penalidades", () => {
  const macro = readFileSync(new URL("../packs/_source/importar-personalizacao-macro.txt", import.meta.url), "utf8");
  assert.match(macro, /img: dado\.img/);
  assert.match(macro, /dado\.effects\?\.length \? \{ effects: dado\.effects \} : \{\}/);
  for (const chave of ["system.legacy2.actions.max", "system.legacy2.especiaisExtra", "flags.jujutsu-system.selosBonus",
    "system.legacy2.pvEspecie", "system.legacy2.energiaEspecie", "system.legacy2.resistances.piercing.value"])
    assert.ok(macro.includes(`"key": "${chave}"`), `macro sem a chave ${chave}`);
});

test("selosMax aplica o bônus da penalidade sem apagar os selos extras do caminho", async () => {
  const { selosMax } = await import("../module/applications/activity/legacy2-activation.mjs");
  const featSelos = () => ({ type: "feat", name: "Selos de Mão",
    getFlag: (escopo, chave) => chave === "especializacao" ? { caminho: "Selos e Encantamentos" } : undefined });
  const ator = (selosBonus, feats = 1) => ({ items: Array.from({ length: feats }, featSelos),
    flags: { "jujutsu-system": { selosBonus } } });
  assert.equal(selosMax(ator(undefined)), 3);
  assert.equal(selosMax(ator(-3)), 0); // penalidade: perde os 3 selos base
  assert.equal(selosMax(ator(-3, 3)), 2); // habilidades extras continuam valendo +1
  assert.equal(selosMax(ator(-30)), 0); // piso em 0
});

test("pontosDefeitos prefere a flag defeitoPontos e usa o nome como fallback", () => {
  const comFlag = { type: "feat", name: "Sem marcador", flags: { "jujutsu-system": { featureSection: "jj-flaws", defeitoPontos: 3 } } };
  const comNome = { type: "feat", name: "Amnésia (1 Ponto)", flags: { "jujutsu-system": { featureSection: "jj-flaws" } } };
  assert.equal(pontosDefeitos({ items: [comFlag, comNome] }), 4);
});

test("a uuid da penalidade de Vida/Energia sai do catálogo de personalização", () => {
  const catalogo = { customization: { "jj-variant-penalties": [
    { uuid: "outro", name: "Sacrifica os benefícios da origem" },
    { uuid: "vital-1", name: PENALIDADE_VITAL_NOME }] } };
  assert.equal(penalidadeVitalUuid(catalogo), "vital-1");
  assert.equal(penalidadeVitalUuid({ customization: {} }), null);
});
