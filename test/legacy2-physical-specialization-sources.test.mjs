import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import * as YAML from "js-yaml";
import { specializationDocuments } from "../utils/especializacoes-2-0.mjs";
import { PHYSICAL_SPECIALIZATIONS } from "../module/systems/legacy2-physical-specialization-data.mjs";

const directory = new URL("../packs/_source/geral-2-0/", import.meta.url);

test("the generator inserts the new third option without changing any existing source feat ID", () => {
  const body = specializationDocuments.filter(doc => doc.flags?.["jujutsu-system"]?.especializacao?.caminho === "Corpo de Guerreiro");
  assert.deepEqual(body.slice(0, 4).map(doc => doc.name), ["Explosão de Velocidade", "Passo Esguio", "Reação Acelerada", "Punho Devastador"]);
  assert.equal(new Set(specializationDocuments.map(doc => doc._id)).size, specializationDocuments.length);
  const byId = new Map(specializationDocuments.map(doc => [doc._id, doc]));
  let verified = 0;
  for (const name of readdirSync(directory).filter(name => /^jj2a\d+\.yml$/.test(name))) {
    const before = YAML.load(readFileSync(new URL(name, directory), "utf8"));
    assert.equal(byId.get(before._id)?.name, before.name, `preserve reference ${before._id}`);
    verified++;
  }
  assert(verified > 100);
});

test("the shipped sources contain the new rules and the third choice with its six-specialization gate", () => {
  for (const [name, rule] of Object.entries(PHYSICAL_SPECIALIZATIONS)) {
    const source = YAML.load(readFileSync(new URL(`${rule.id}.yml`, directory), "utf8"));
    assert.equal(source.name, name); assert.equal(source.system.identifier, rule.identifier);
    assert(source.system.description.value.includes(rule.description));
    assert.deepEqual(source.flags["jujutsu-system"].especializacao.requisitos, rule.requirements);
  }
  const reaction = YAML.load(readFileSync(new URL(`${PHYSICAL_SPECIALIZATIONS["Reação Acelerada"].id}.yml`, directory), "utf8"));
  assert.equal(reaction.flags["jujutsu-system"].especializacao.ordem, 3);
  assert.equal(reaction.img.endsWith(".webp"), true);
});
