export const NPC_EQUIPMENT_PACK = "jujutsu-compendium.equipamento-pdn";
export const NPC_PROFILE_PACK = "jujutsu-compendium.arquetipos-e-taxonomias";
export const npcEquipmentUuid = id => `Compendium.${NPC_EQUIPMENT_PACK}.Item.${id}`;
const norm = text => String(text ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const oldArmor = id => `Compendium.${NPC_PROFILE_PACK}.Item.${id}`;
export const NPC_ARMOR_REDIRECTS = Object.freeze(Object.fromEntries([
  ["acd48c1a5dc3dfae",12], ["1c11eb513eda34f7",1], ["872121e66e8ee323",15], ["f3e5a08db9a2be06",11],
  ["325df2ca920fe224",21], ["932c450e7649ad75",8], ["0dc00a88856d0a44",4], ["8ba6ae94c9ace1d2",14],
  ["894affc8594e40b7",2], ["8a1b4d0d10527a46",12], ["0b02c0d56d0dfa19",5], ["a879e9f00bd2925e",13],
  ["9c18fc9edcf826a4",17], ["142c56a0fc182825",7], ["3eb2ac388f65d4dc",23], ["f224797fb16a61ae",16],
  ["c450bb1af65a0645",10], ["d8429803118a272a",6], ["f238d37a71d2ff4f",19], ["7ff0297f6d2eaa8c",9],
  ["e8f58cda41958fae",22], ["a23cb7a0dca06ab0",20], ["4d77eb27fb12df71",18], ["da12005064cc074f",3]
].map(([id,number]) => [oldArmor(id), npcEquipmentUuid(`jjnar${String(number).padStart(11,"0")}`)])));

/** Editable starting loadouts. They grant existing Items, never invent new weapon definitions. */
const TAXONOMY_PARTS = {
  "Fossórios": ["Garras","Mordida"], "Espectros": ["Punhos Sombrios"], "Entidades Conceituais": ["Pseudópode"],
  "Corvídeos": ["Bico","Garras"], "Quirópteros": ["Mordida","Garras"], "Fadas": ["Punhos"],
  "Aracnídeos": ["Mordida","Ferrão"], "Primatas": ["Punhos","Mordida"], "Suínos": ["Presas","Cascos"],
  "Anfíbios": ["Mordida","Pseudópode"], "Felinos": ["Mordida","Garras"],
  "Elementais do Ar e da Tempestade": ["Punhos Carregados","Pseudópode Estrondoso"], "Autômatos": ["Punhos"],
  "Mutantes": ["Garras","Mordida"], "Equídeos": ["Cascos","Mordida"], "Mortos-vivos Superiores": ["Mordida","Garras"],
  "Elementais do Gelo": ["Punhos Frigidos","Espinhos Frigidos"], "Equinodermos": ["Espinhos","Tentáculos"],
  "Quimeras": ["Mordida","Garras","Chifres"], "Cristalinos": ["Farpas","Punhos"], "Policéfalos": ["Mordida"],
  "Parasitas": ["Mordida","Ferrão"], "Aves de Rapina": ["Bico","Garras"], "Gelatinosas": ["Pseudópode"],
  "Insetoides": ["Pinças","Mordida"], "Gárgulas": ["Garras","Mordida"], "Pesadelos": ["Garras Sombrias"],
  "Predadores": ["Mordida","Garras"], "Miriápodes": ["Mordida","Ferrão"], "Gigantes": ["Punhos"],
  "Hienas": ["Mordida","Garras"], "Aberrações": ["Tentáculos","Mordida"], "Objetos Animados": ["Punhos"],
  "Fungoides": ["Pseudópode","Espinhos"], "Elementais da Terra e das Plantas": ["Punhos","Farpas"],
  "Crustáceos": ["Pinças","Mordida"], "Ocos": ["Punhos","Garras"], "Cefalópodes": ["Tentáculos","Bico"],
  "Mortos-vivos": ["Mordida","Punhos"], "Serpentes": ["Mordida","Cauda"], "Sáurios": ["Mordida","Garras","Cauda"],
  "Plantas Carnívoras": ["Mordida","Tentáculos"], "Dragões": ["Mordida","Garras","Cauda"], "Umbranos": ["Garras Sombrias"],
  "Leporídeos": ["Mordida","Unhas"], "Roedores": ["Mordida","Unhas"], "Lobisomens": ["Mordida","Garras"],
  "Homens-fera": ["Garras","Mordida"], "Elementais do Fogo": ["Punhos Flamejantes","Garras Flamejantes"],
  "Homens-peixe": ["Mordida","Garras"], "Dracos": ["Mordida","Garras","Cauda"], "Humanos": ["Punhos"]
};
const ARCHETYPE_PARTS = {
  "Atropelador": ["Chifres","Cascos"], "Multimembro": ["Punhos"], "Constritor": ["Cauda"], "Escavador": ["Garras"],
  "Cauda-de-serpente": ["Cauda","Mordida"], "Peçonhento (artrópode)": ["Ferrão Venenoso","Pinças"],
  "Drenador (vampírico)": ["Mordida"], "Montaria de Guerra": ["Cascos"], "Ceifador Abissal": ["Tentáculos"],
  "Oitobraço": ["Tentáculos"], "Behemoth das Profundezas": ["Mordida","Tentáculos"], "Peçonhento (serpente)": ["Mordida Venenosa"],
  "Ceifador": ["Garras"], "Besta de Investida": ["Chifres"], "Devorador": ["Mordida"], "Colosso": ["Punhos"],
  "Cabeça-de-leão": ["Mordida"], "Lutador": ["Punhos"], "Necrófago": ["Mordida"], "Hidra": ["Mordida"],
  "Cuspidora (naja)": ["Mordida Venenosa"], "Corpo-de-cabra": ["Cascos","Chifres"], "Esmagador": ["Punhos"],
  "Agarrador": ["Punhos"], "Operária": ["Pinças"], "Besta de Rebanho": ["Cascos"], "Besta Guardiã": ["Garras","Mordida"],
  "Espreitador Vertical": ["Garras"], "Enxame": ["Mordida"]
};
export const NPC_WEAPON_DEFAULTS = Object.freeze({
  taxonomy: Object.fromEntries(Object.entries(TAXONOMY_PARTS).map(([name,parts]) => [norm(name),parts])),
  archetype: Object.fromEntries(Object.entries(ARCHETYPE_PARTS).map(([name,parts]) => [norm(name),parts]))
});

/** Use existing canonical armor. Profile-specific, deliberately edited equipment remains editable. */
export function profileEquipmentPlan(profile, gear, {preserveCustom=false}={}) {
  const current = profile.system?.equipamentos ?? { armadura: null, armas: [] };
  const byName = new Map(Array.from(gear).map(item => [norm(item.name),item]));
  const desired = NPC_WEAPON_DEFAULTS[profile.type]?.[norm(profile.name)] ?? [];
  const weapons = preserveCustom && current.armas?.length ? current.armas : desired.map(name => {
    const item = byName.get(norm(name));
    if (item?.type !== "weapon") throw new Error(`Arma natural indisponível: ${name}.`);
    return npcEquipmentUuid(item.id ?? item._id);
  });
  return { armadura: NPC_ARMOR_REDIRECTS[current.armadura] ?? current.armadura ?? null,
    armas: [...new Set(weapons)] };
}

const LABELS = {str:"Força",dex:"Agilidade",con:"Constituição",int:"Intelecto",wis:"Sabedoria",cha:"Presença",
  bludgeoning:"Contundente",piercing:"Perfurante",slashing:"Cortante",fire:"Fogo",acid:"Ácido",cold:"Frio",lightning:"Elétrico",
  thunder:"Trovejante",psychic:"Psíquico",radiant:"Energia",poison:"Veneno",soul:"Alma"};

/** Repair the known authored natural equipment data without changing its damage balance or native IDs. */
export function normalizeNpcEquipment(original) {
  const item = structuredClone(original), flags = item.flags?.["jujutsu-system"];
  if (!flags?.ataqueNatural && !flags?.armaduraNatural) return item;
  const system = item.system;
  if (item.type === "weapon") {
    const cost = flags.danoExtraPorNd ? 3 : 2;
    const activity = Object.values(system.activities ?? {}).find(a => a.type === "attack");
    if (!activity) throw new Error(`Ataque natural sem atividade: ${item.name}.`);
    activity.activation = { ...activity.activation, type:"action", value:cost, override:true };
    activity.consumption ??= {};
    activity.consumption.spellSlot = false;
    activity.consumption.targets = (activity.consumption.targets ?? []).filter(t => !["energy.generated","energy.total"].includes(t.target));
    activity.damage.includeBase = false;
    const element = flags.elemento, type = element ?? activity.damage.parts[0]?.types?.[0];
    flags.modificador = `${LABELS[type] ?? type}${flags.danoExtraPorNd ? " + 1 dado de dano a cada 4 ND" : ""}${flags.condicaoAoAtingir ? ` · Condição ao atingir: ${flags.condicaoAoAtingir}` : ""}`;
    flags.custoPA = cost;
    const condition = flags.condicaoAoAtingir ? `<p><strong>Ao atingir:</strong> aplica ${flags.condicaoAoAtingir}, com a duração indicada no efeito.</p>` : "";
    system.description.value = `<p>Ataque natural corpo a corpo. Dano ${LABELS[type] ?? type} conforme a Escala de Dano do ND, somado ao valor inteiro do atributo usado no ataque.</p>`
      + (flags.danoExtraPorNd ? "<p>Adiciona 1 dado do mesmo tipo da escala a cada 4 NDs completos.</p>" : "") + condition
      + (flags.danoExtraPorNd ? "<p>Este ataque custa 1 Ponto de Ação adicional em relação ao ataque natural comum.</p>" : "")
      + `<p><strong>Custo:</strong> ${cost} Pontos de Ação. Não consome Energia Gerada; gastos opcionais de energia são configurados no uso.</p>`;
  } else if (item.type === "equipment") {
    const armor = system.armor ??= {}, ability = armor.ability ?? flags.cr?.atributo, base = armor.value ?? flags.cr?.base;
    armor.value = base; armor.ability = ability; armor.dex ??= null;
    system.description.value = `<p>Armadura natural. <strong>Classe de Resistência:</strong> ${base} + ${LABELS[ability] ?? ability}, usando o valor inteiro do atributo.</p>`
      + "<p>Ao equipar, substitui o cálculo padrão de CR; não é somada a ele.</p>"
      + (flags.efeito ? `<p><strong>Efeito:</strong> ${flags.efeito}</p>` : "");
    for (const effect of item.effects ?? []) {
      if (effect.flags?.["jujutsu-system"]?.armaduraNaturalCR) { effect.disabled = true; continue; }
      if ((effect.system?.changes ?? effect.changes ?? []).some(c => c.key.startsWith("system.legacy2.resistances."))) effect.transfer = true;
    }
    if (flags.thorns?.atributo === "for") flags.thorns.atributo = "str";
  }
  flags.equipmentPdn = { version:1 };
  return item;
}

export function npcEquipmentFingerprint(value) {
  let hash=2166136261;
  for(const char of String(value ?? "")) hash=Math.imul(hash^char.charCodeAt(0),16777619);
  return (hash>>>0).toString(16);
}
