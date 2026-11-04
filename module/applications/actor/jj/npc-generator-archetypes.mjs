// Exclusive profiles from the encyclopedia, using its stable identifiers rather than display names.
// See docs/regras-2.0/arquetipos-por-taxonomia.md and the published profile renames.
import { npcProfileKey as npcGeneratorProfileKey, isHumanTaxonomy } from "../../../systems/npc-profile-art.mjs";
export { npcGeneratorProfileKey };
const EXCLUSIVE_TAXONOMIES = {
  cuspidoranaja: ["serpentes"],
  espreitadornoturno: ["felinos"],
  montariadeguerra: ["equideos"],
  atropelador: ["equideos"],
  fugaz: ["leporideos"],
  multiplicador: ["leporideos"],
  agourento: ["corvideos"],
  estridente: ["quiropteros"],
  brutamontes: ["primatas"],
  operaria: ["insetoides"],
  espreitadorvertical: ["miriapodes"],
  esmagador: ["crustaceos"],
  fragmentador: ["equinodermos"],
  soterrador: ["fossorios"],
  oitobraco: ["cefalopodes"],
  lanceirodemare: ["homenspeixe"],
  ceifadorabissal: ["homenspeixe"],
  multimembro: ["aberracoes"],
  metamorfo: ["mutantes"],
  cabecadeleao: ["quimeras"],
  corpodecabra: ["quimeras"],
  caudadeserpente: ["quimeras"],
  hidra: ["policefalos"],
  discordia: ["policefalos"],
  usurpador: ["parasitas"],
  colonia: ["fungoides"],
  adormecedor: ["plantascarnivoras"],
  incubo: ["pesadelos"],
  perseguidor: ["pesadelos"],
  devoradordeluz: ["umbranos"],
  portavoz: ["ocos"],
  ladraodenomes: ["fadas"],
  pactuante: ["fadas"],
  rastreadorancestral: ["saurios"],
  saqueadorardiloso: ["homensfera"],
  mergulhador: ["gargulas"],
  ressonador: ["cristalinos"],
  brinquedotraicoeiro: ["objetosanimados"]
};
const HUMANOID_ARCHETYPES = new Set([
  "guerreiro", "espadachim", "samurai", "lutador", "assassino", "atirador", "bastiao",
  "defensor", "justiceiro", "berserker", "duelista", "comandante", "infiltrador"
]);
// Humanoid forms described by the taxonomy; conceptual beings may also assume these forms.
const HUMANOID_TAXONOMIES = [
  "humanos", "homensfera", "homenspeixe", "lobisomens", "gigantes", "mortosvivossuperiores", "ocos", "fadas", "entidadesconceituais",
  "humano", "hibrido"
];
/** Unknown/custom profiles remain general; a coincidentally matching display name does not restrict them. */
export function npcGeneratorArchetypeAllowed(taxonomy, archetype) {
  const key = npcGeneratorProfileKey(archetype);
  if (isHumanTaxonomy(taxonomy)) return HUMANOID_ARCHETYPES.has(key);
  const restrictions = Object.hasOwn(EXCLUSIVE_TAXONOMIES, key) ? EXCLUSIVE_TAXONOMIES[key]
    : HUMANOID_ARCHETYPES.has(key) ? HUMANOID_TAXONOMIES : null;
  return !restrictions || restrictions.includes(npcGeneratorProfileKey(taxonomy));
}
