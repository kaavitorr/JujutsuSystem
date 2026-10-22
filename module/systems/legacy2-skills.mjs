/** Shared skill identifiers and labels for character sheets and NPC profile authoring. */
export const SKILL_GROUPS = [
  { label: "Exploração", icon: "movement", skills: [
    ["ath", "Atletismo", "str"], ["acr", "Coordenação", "dex"], ["prc", "Percepção", "wis"],
    ["ste", "Furtividade", "dex"], ["sur", "Sobrevivência", "wis"]
  ] },
  { label: "Conhecimento", icon: "int", skills: [
    ["arc", "Feitiçaria", "int"], ["rel", "Medicina", "wis"], ["inv", "Investigação", "int"],
    ["his", "História", "int"], ["ani", "Sobrenatural", "wis"]
  ] },
  { label: "Influência", icon: "cha", skills: [
    ["dec", "Enganação", "cha"], ["per", "Persuasão", "cha"], ["itm", "Intimidação", "cha"],
    ["prf", "Atuação", "cha"], ["luc", "Sorte", "cha"]
  ] }
];
