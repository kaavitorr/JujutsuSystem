import MappingField from "../fields/mapping-field.mjs";
import { NUMERIC_DAMAGE_TYPES } from "../../systems/legacy2-resistances.mjs";

const { BooleanField, NumberField, SchemaField, StringField } = foundry.data.fields;

/**
 * Sub-schema aditivo `system.legacy2` — campos exclusivos das regras
 * "Jujutsu Legacy 2.0". Dormentes na 1.0 (nunca lidos fora de guards
 * `Ruleset.isV2()`), portanto trocar a versão não perde dados de lado algum.
 *
 *  • estilo     id do Estilo de Combate (CONFIG.JUJUTSU.estilos).
 *  • pontos     { extra, gastos } — pool de treino: criação + 1/nível + extra
 *               (concessão do Mestre); gastos é recalculado pela soma dos
 *               degraus (mantido denormalizado para exibição rápida).
 *  • skills     rank 0-4 por perícia (chaves de CONFIG.DND5E.skills).
 *  • saves      rank 0-4 por atributo de salvaguarda.
 *  • armas      rank 0-4 por categoria de arma (chaves de CONFIG.DND5E.weaponAndArmorProficiency... categorias de weaponProf).
 *  • pvEspecie  PV fixos concedidos pela espécie (item race) na 2.0.
 *  • energiaEspecie  Energia fixa concedida pela espécie (item race) na 2.0.
 *  • taxonomia / arquetipo / nd — NPCs estilo Crucible (Fase F).
 *  • naturais   { armaduras: [], armas: [] } — características naturais de NPC.
 */
const rankField = () => new NumberField({
  required: false, nullable: true, integer: true, min: 0, max: 4, initial: 0
});

export default function legacy2Schema({ engagementInitial = 2 } = {}) {
  return new SchemaField({
    estilo: new StringField({ nullable: true, initial: null }),
    // Escolha de atributo principal para Estilos com opção (Restringido: FOR/AGI)
    principalEscolhido: new StringField({ nullable: true, initial: null }),
    pontos: new SchemaField({
      extra: new NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 0 }),
      gastos: new NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 0 })
    }),
    skills: new MappingField(rankField(), { initial: {} }),
    saves: new MappingField(rankField(), { initial: {} }),
    armas: new MappingField(rankField(), { initial: {} }),
    resistances: new SchemaField(Object.fromEntries(NUMERIC_DAMAGE_TYPES.map(({ key, label }) => [key,
      new SchemaField({
        value: new NumberField({ required: true, nullable: false, integer: true, initial: 0, label: `Resistência: ${label}` }),
        immune: new BooleanField({ initial: false, label: `Imunidade: ${label}` })
      })]))),
    pvEspecie: new NumberField({ required: true, nullable: false, integer: true, initial: 0 }),
    energiaEspecie: new NumberField({ required: true, nullable: false, integer: true, initial: 0,
      label: "Energia Base da Origem" }),
    engagement: new NumberField({ required: true, nullable: engagementInitial === null, integer: true,
      min: 0, initial: engagementInitial, label: "Engajamento" }),
    wounds: new SchemaField({
      value: new NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 0 })
    }),
    actions: new SchemaField({
      value: new NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 6 }),
      max: new NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 6,
        label: "Máximo de Pontos de Ação" })
    }),
    reservas: new SchemaField({
      value: new NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 0 })
    }),
    reverseEnergy: new SchemaField({
      value: new NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 0 }),
      max: new NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 30,
        label: "Máximo de Pontos de Energia Reversa (PER)" }),
      maxPerRound: new NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 3,
        label: "Máximo de PER por rodada" }),
      activity: new StringField({ required: true, nullable: false, initial: "" })
    }),
    extraResources: new MappingField(new SchemaField({
      label: new StringField({ required: true, nullable: false, initial: "Recurso" }),
      value: new NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 0 }),
      max: new NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 0 }),
      activity: new StringField({ required: true, nullable: false, initial: "" })
    }), { initial: {} }),
    // Concessão do Mestre de escolhas de especialização (Skill Tree 2.0)
    especiaisExtra: new NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 0 }),
    // NPCs estilo Crucible (2.0)
    taxonomia: new StringField({ nullable: true, initial: null }),
    arquetipo: new StringField({ nullable: true, initial: null }),
    nd: new StringField({ nullable: true, initial: null }),
    // Categoria de ameaça do NPC 2.0 (Lacaio x0,5 · Normal x1 · Elite x1,5 · Chefe x2)
    categoria: new StringField({ nullable: true, initial: null }),
    naturais: new SchemaField({
      armaduras: new MappingField(rankField(), { initial: {} }),
      armas: new MappingField(rankField(), { initial: {} })
    })
  }, { label: "JUJUTSU.2.Legacy2" });
}
