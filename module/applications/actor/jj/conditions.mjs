/**
 * jj/conditions.mjs
 * Condições customizadas do sistema Jujutsu Legacy — as duas versões convivem:
 * - JJ_CONDITIONS: condições da 1.0; o hover lê as páginas do pack
 *   jujutsu-system.conteudo (journal "Condições" do sistema).
 * - JJ2_CONDITION_GROUPS: as 43 condições da 2.0 nas 7 categorias do livro
 *   (Mentais, Defesas, Percepção, Ações, Físicas, Movimento e Dano); o hover
 *   lê as páginas do journal "Condições" do mundo (mesmo _id do pack).
 * A ficha 2.0 mostra só a versão 2.0 (cards agrupados por categoria);
 * a ficha 1.0 continua com a lista antiga.
 */
import { applyJJTextTooltips } from "./tooltips.mjs";
import { legacy2ConditionIcon } from "./legacy2-condition-icons.mjs";
import { acoesTetoEfetivo } from "./legacy2-sheet.mjs";
import { MODIFICADORES_MOVIMENTO } from "../../../systems/condicoes-dano.mjs";
import { temPeculiaridade, imunidadeCondicao } from "../../../systems/peculiaridades-automacao.mjs";

// ── Modificadores de condição (usados pelo toggle da aba de Efeitos e pela
// automação do Inconsciente automático) ──────────────────────────────────────

/* ── Condições de Ações: modificadores de Pontos de Ação ─────────────────────
 * Aplicados como changes do efeito, reduzindo (ou zerando) o pool de PA
 * enquanto a condição estiver ativa:
 *   Acelerado +2 · Atordoado −4 · Concussão −2 · Incapacitado −2 · Sonolento −1 ·
 *   Paralisado zera (OVERRIDE 0) · Desidratado −1. O Desorientado cobra +1 ⬢ por
 *   ação que use PA (tratado no custo do uso, acoes-combate.mjs). */
export const MODIFICADORES_CONDICOES = {
  "jj-acelerado":    [{ key: "system.legacy2.actions.max", mode: 2, value: 2 }],
  "jj-atordoado":    [{ key: "system.legacy2.actions.max", mode: 2, value: -4 }],
  "jj-concussao":    [{ key: "system.legacy2.actions.max", mode: 2, value: -2 }],
  "jj-incapacitado": [{ key: "system.legacy2.actions.max", mode: 2, value: -2 }],
  "jj-sonolento":    [{ key: "system.legacy2.actions.max", mode: 2, value: -1 }],
  "jj-paralisado":   [{ key: "system.legacy2.actions.max", mode: 5, value: 0 }],
  // Desidratado (2.0): −1 Ponto de Ação por turno + 1 exaustão por hora
  // (a exaustão horária é por código — hook updateWorldTime em acoes-combate.mjs).
  "jj-desidratado":  [{ key: "system.legacy2.actions.max", mode: 2, value: -1 }],
  // Inconsciente (2.0): sem ações.
  "jj-inconsciente": [{ key: "system.legacy2.actions.value", mode: 5, value: 0 }]
};

/* ── Condições de Defesas: Classe de Resistência ─────────────────────────────
 * Aplicados como changes do efeito, derrubando o CR enquanto a condição
 * estiver ativa: Enfurecido −2 · Exposto −2 · Inconsciente zera (OVERRIDE 0
 * em ac.override, que vence o cálculo no prepareArmorClass; o piso do CR
 * continua em 0 pelo cálculo normal e pelo min do ator). */
export const MODIFICADORES_DEFESA = {
  "jj-enfurecido":   [{ key: "system.attributes.ac.bonus", mode: 2, value: -2 }],
  "jj-exposto":      [{ key: "system.attributes.ac.bonus", mode: 2, value: -2 }],
  "jj-inconsciente": [{ key: "system.attributes.ac.override", mode: 5, value: 0 }]
};

// [gerado: jj1]
export const JJ_CONDITIONS = [
  { id: "jj-agarrado",        label: "Agarrado",         icon: "fas fa-hand-grab",         desc: "Deslocamento 0. Encerra se quem agarrou ficar incapacitado ou soltar.",                                              reference: "Compendium.jujutsu-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.mlfBihj1WTMnp8tt" },
  { id: "jj-alucinado",       label: "Alucinado",        icon: "fas fa-brain",             desc: "Ataca qualquer criatura próxima indiscriminadamente. ND −2.",                                                        reference: "Compendium.jujutsu-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.g0jKKMfi2ShUJ3lm" },
  { id: "jj-amedrontado",     label: "Amedrontado",      icon: "fas fa-person-running",    desc: "Desvantagem em testes e ataques enquanto fonte do medo estiver visível.",                                           reference: "Compendium.jujutsu-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.8AbcrNaNNfIbQs4G" },
  { id: "jj-apaixonado",      label: "Apaixonado",       icon: "fas fa-heart",             desc: "Não pode atacar quem a apaixonou. Quem apaixonou tem vantagem em testes sociais.",                                  reference: "Compendium.jujutsu-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.vImaFZEzGlr0WdJm" },
  { id: "jj-atordoado",       label: "Atordoado",        icon: "fas fa-stars",             desc: "Incapacitado, imóvel, fala hesitante. Falha em For/Agi. Ataques contra têm vantagem.",                             reference: "Compendium.jujutsu-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.bR1Lz7cbCZST2Auk" },
  { id: "jj-bebado",          label: "Bêbado",           icon: "fas fa-beer-mug-empty",    desc: "Desvantagem em Salv. e testes de Agilidade. Encerra com Salv. CON ou situação adequada.",                         reference: "Compendium.jujutsu-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.wceHJV6dZP4KzaAW" },
  { id: "jj-caido",           label: "Caído",            icon: "fas fa-person-falling",    desc: "Só pode rastejar. Desvantagem em ataques. Ataques a 1,5m têm vantagem.",                                          reference: "Compendium.jujutsu-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.SjtAEH0zyJb5VRfv" },
  { id: "jj-cego",            label: "Cego",             icon: "fas fa-eye-slash",         desc: "Falha em testes que requeiram visão. Ataques contra têm vantagem; seus ataques têm desvantagem.",                  reference: "Compendium.jujutsu-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.P1ziScgbUVuhsVPz" },
  { id: "jj-congelado",       label: "Congelado",        icon: "fas fa-snowflake",         desc: "Incapacitado, imóvel. Resistência a todos os danos. Imune a veneno e doenças.",                                    reference: "Compendium.jujutsu-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.a6IWy4W4n2D8Z8Ze" },
  { id: "jj-desidratado",     label: "Desidratado",      icon: "fas fa-droplet-slash",     desc: "Deslocamento ÷2. 1 nível de exaustão por hora. Só ação OU ação bônus por turno.",                                 reference: "Compendium.jujutsu-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.TJU7w36NnMHjnxfD" },
  { id: "jj-empoderado",      label: "Empoderado",       icon: "fas fa-fist-raised",       desc: "Dano corpo-a-corpo → 1d12. PA de técnicas mal-sucedidas não descontados.",                                         reference: "Compendium.jujutsu-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.AFNLlT5TrbqmkfbV" },
  { id: "jj-enfeiticado",     label: "Enfeitiçado",      icon: "fas fa-wand-sparkles",     desc: "Não pode atacar quem a enfeitiçou. Quem enfeitiçou tem vantagem em testes sociais.",                               reference: "Compendium.jujutsu-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.24HWsBJxkRfUj0It" },
  { id: "jj-enfurecido",      label: "Enfurecido",       icon: "fas fa-fire-flame-curved", desc: "Ataca fonte da fúria com desvantagem. Dano corpo-a-corpo +1d4. Dura 1 minuto.",                                   reference: "Compendium.jujutsu-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.IUGCnR8QkoGA6ctr" },
  { id: "jj-energia-esgotada",label: "Energia Esgotada", icon: "fas fa-battery-empty",     desc: "Não pode usar nenhuma habilidade ou técnica. Também está Letárgica.",                                              reference: "Compendium.jujutsu-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.S9EiUtSjRVrJqAK8" },
  { id: "jj-estremecido",     label: "Estremecido",      icon: "fas fa-person-trembling",  desc: "Desvantagem em ataques. Não pode usar técnicas com concentração. Deslocamento custa 2×.",                          reference: "Compendium.jujutsu-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.sSPiyuksW97O34QI" },
  { id: "jj-exausto",         label: "Exausto",          icon: "fas fa-tired",             desc: "−2 em rolagens d20. −1,5m de deslocamento. Acumulável até 6 níveis — clique: +1 nível; clique-direito: −1.",                                      reference: "Compendium.jujutsu-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.jUQ0Ojn7NsJcygkg" },
  { id: "jj-envenenado",      label: "Envenenado",       icon: "fas fa-skull-crossbones",  desc: "Desvantagem em ataques e testes. Após 1 dia, Salv. CON CD 15 para encerrar.",                                     reference: "Compendium.jujutsu-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.64NP2kxSF8mfti6U" },
  { id: "jj-hipotermico",     label: "Hipotérmico",      icon: "fas fa-temperature-low",   desc: "Desvantagem em Salv. Agi, testes e ataques. Encerra com Medicina CD 10 ou Sobrev. CD 17.",                        reference: "Compendium.jujutsu-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.m27RYswlWudR9DFt" },
  { id: "jj-impedido",        label: "Impedido",         icon: "fas fa-ban",               desc: "Deslocamento 0. Ataques contra têm vantagem; seus ataques têm desvantagem.",                                       reference: "Compendium.jujutsu-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.TY0bMiK70ov78CLz" },
  { id: "jj-incapacitado",    label: "Incapacitado",     icon: "fas fa-circle-xmark",      desc: "Não pode realizar ações ou reações.",                                                                               reference: "Compendium.jujutsu-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.fiVKmMfElwun0dCb" },
  { id: "jj-inconsciente",    label: "Inconsciente",     icon: "fas fa-moon",              desc: "Incapacitado, imóvel, sem ciência. Falha For/Agi. Ataques têm vantagem. Crit a 1,5m.",                            reference: "Compendium.jujutsu-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.k2u92af7x9UErMYA" },
  { id: "jj-invisivel",       label: "Invisível",        icon: "fas fa-ghost",             desc: "Impossível de ver sem técnicas especiais. Seus ataques têm vantagem; ataques contra têm desvantagem.",             reference: "Compendium.jujutsu-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.X9PdPvCaP6CZH6ez" },
  { id: "jj-letargico",       label: "Letárgico",        icon: "fas fa-person-walking",    desc: "Deslocamento ÷2. Dano de ataques ÷2 (exceto armas de fogo).",                                                     reference: "Compendium.jujutsu-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.j0tOdlX3KHl6WS8S" },
  { id: "jj-mudo",            label: "Mudo",             icon: "fas fa-volume-xmark",      desc: "Falha em testes que requeiram fala. Não emite sons pela boca.",                                                    reference: "Compendium.jujutsu-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.vVo8o6aHW1JzkFz3" },
  { id: "jj-paralisado",      label: "Paralisado",       icon: "fas fa-person-rays",       desc: "Incapacitado, imóvel. Sem ações bônus. Falha For/Agi. Ataques têm vantagem. Crit a 1,5m.",                        reference: "Compendium.jujutsu-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.4fMgcIkU1a0dZ2lt" },
  { id: "jj-pesado",          label: "Pesado",           icon: "fas fa-weight-hanging",    desc: "Deslocamento ÷2. Desvantagem em ataques corpo-a-corpo.",                                                           reference: "Compendium.jujutsu-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.CJYCKRZPwzMmZbK1" },
  { id: "jj-petrificado",     label: "Petrificado",      icon: "fas fa-monument",          desc: "Incapacitado, imóvel, peso ×10. Resistência a todos os danos. Imune a veneno/doenças.",                           reference: "Compendium.jujutsu-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.IvoYeweAcCAK4FOp" },
  { id: "jj-queimado",        label: "Queimado",         icon: "fas fa-fire",              desc: "1d6 Fogo irredutível na primeira ação/movimento por turno. Sem técnicas com concentração.",                        reference: "Compendium.jujutsu-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.zsCYJFxtE28qaQim" },
  { id: "jj-queimadura",      label: "Queimadura",       icon: "fas fa-fire-flame-simple", desc: "Desvantagem em Testes de Concentração. Encerra com Medicina CD 13 ou Sobrev. CD 17.",                             reference: "Compendium.jujutsu-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.yPXw8c6JzyUX6Fik" },
  { id: "jj-sangramento",     label: "Sangramento",      icon: "fas fa-droplet",           desc: "1d6 Cortante irredutível na primeira ação/movimento. Acumulável 3×. Encerra com Medicina CD 12.",                 reference: "Compendium.jujutsu-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.imw5GzpBqNMPuBIN" },
  { id: "jj-sonolento",       label: "Sonolento",        icon: "fas fa-bed",               desc: "Sem ações bônus ou reações. Desv. Salv. Agi e Sab. Máx. 1 ataque corpo-a-corpo por turno.",                      reference: "Compendium.jujutsu-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.rpsUvEOS6Veec4GO" },
  { id: "jj-sufocado",        label: "Sufocado",         icon: "fas fa-lungs-virus",       desc: "Desv. Salv. Agi. Após turnos (1+mod.CON), Teste CON CD 10 ou desmaia. CD +2 por turno.",                         reference: "Compendium.jujutsu-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.7xTHnHgiQvrBUde7" },
  { id: "jj-surdo",           label: "Surdo",            icon: "fas fa-ear-deaf",          desc: "Falha em testes que requeiram audição.",                                                                            reference: "Compendium.jujutsu-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.V1qYSFa9hf5Max5Z" }
];
// [/gerado: jj1]

// [gerado: jj2] — fonte: packs/_source/condicoes-estruturadas.json (regen: node utils/gera-conditions.cjs)
export const JJ2_JOURNAL_UUID = "JournalEntry.ZI4IYTRv7YQVnMpf";

export const JJ2_CONDITION_GROUPS = [
  { nome: "MENTAIS", desc: "Condições relacionadas à mente da criatura.", condicoes: [
    { id: "jj-alucinado", label: "Alucinado", icon: "fas fa-brain", desc: "ND −2 para características ligadas ao ND. Ataca qualquer criatura próxima, inimiga ou não.", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.TpWxYhdphv2t6ju2" },
    { id: "jj-amedrontado", label: "Amedrontado", icon: "fas fa-person-running", desc: "Usa todas as ações para se afastar da fonte do medo até 30 m; desvantagem para atacá-la.", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.7uoeQCgUQqYB3BHc" },
    { id: "jj-apaixonado", label: "Apaixonado", icon: "fas fa-heart", desc: "3 desvantagens para atacar o alvo da paixão e em interações sociais com ele; receio de atacá-lo.", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.qzPfOlEQkkPGLVtU" },
    { id: "jj-enfeiticado", label: "Enfeitiçado", icon: "fas fa-wand-sparkles", desc: "Não ataca quem o enfeitiçou nem o alveja. Quem enfeitiçou tem vantagem social.", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.TRCsuSIH7akPftYE" }
  ] },
  { nome: "DEFESAS", desc: "Condições relacionadas à defesa do personagem.", condicoes: [
    { id: "jj-enfurecido", label: "Enfurecido", icon: "fas fa-fire-flame-curved", desc: "CR −2 e só pode gastar PA com ataques.", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.zHe7ghSbtRlEXsjb" },
    { id: "jj-exposto", label: "Exposto", icon: "fas fa-shield-halved", desc: "Classe de Resistência −2.", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.FNhBRcO2D1UkPQkq" },
    { id: "jj-inconsciente", label: "Inconsciente", icon: "fas fa-moon", desc: "Incapacitado; CR 0. Não contribui nem ajuda aliados.", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.9bkl5hVlhmL5dqj1" }
  ] },
  { nome: "PERCEPÇÃO", desc: "Condições relacionadas à percepção do personagem.", condicoes: [
    { id: "jj-cego", label: "Cego", icon: "fas fa-eye-slash", desc: "Sem percepção visual. Falha em testes que exijam ver. Ataques com desvantagem; sofre vantagem.", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.ynw3U5rbGI7OEIYu" },
    { id: "jj-desatento", label: "Desatento", icon: "fas fa-circle-question", desc: "Iniciativa 1 e sem Reações. Remove-se no início do próprio turno.", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.jLNT8yCazygi6ArT" },
    { id: "jj-invisivel", label: "Invisível", icon: "fas fa-ghost", desc: "Invisível sem técnicas especiais; área de escuridão densa para se esconder. Ataques com vantagem; sofre desvantagem.", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.lvxeCwhwEDZHAtii" },
    { id: "jj-surdo", label: "Surdo", icon: "fas fa-ear-deaf", desc: "Sem percepção auditiva e imune a ações auditivas.", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.4ltRSh6qh1J8L740" },
    { id: "jj-silenciado", label: "Silenciado", icon: "fas fa-volume-xmark", desc: "Não fala nem lança encantamentos.", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.Ye8ha3SyDWUKWLVB" }
  ] },
  { nome: "AÇÕES", desc: "Condições relacionadas aos Pontos de Ação do personagem.", condicoes: [
    { id: "jj-atordoado", label: "Atordoado", icon: "fas fa-stars", desc: "−4 Pontos de Ação. Deslocamento 3 m. Falha em For e Agi. Ataques têm vantagem.", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.oqZQ2ajKLMQLIUE9" },
    { id: "jj-bebado", label: "Bêbado", icon: "fas fa-beer-mug-empty", desc: "Desvantagem em Testes e Salvaguardas de Agilidade. Sem ações com Reação. Encerra com Salv. CON.", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.ucEuHySKUtbpHHVE" },
    { id: "jj-concussao", label: "Concussão", icon: "fas fa-circle-exclamation", desc: "−2 Pontos de Ação. Desvantagem em testes e Salvaguardas de Agilidade.", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.rXIVqoktPZpDzkeu" },
    { id: "jj-desorientado", label: "Desorientado", icon: "fas fa-arrows-spin", desc: "Consome 1 PA adicional em ações que usam PA.", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.v3an1hjrqSTIVYRF" },
    { id: "jj-incapacitado", label: "Incapacitado", icon: "fas fa-circle-xmark", desc: "−2 Pontos de Ação. Consome 1 PA adicional em ações e técnicas com Reação.", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.t2FWlx8UCukoyPAY" },
    { id: "jj-sonolento", label: "Sonolento", icon: "fas fa-bed", desc: "−1 Ponto de Ação. Desvantagem em Salv. Agi e Sab. Máx. 1 ataque ou técnica de dano.", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.DPzjW24I9zyTVGDm" },
    { id: "jj-paralisado", label: "Paralisado", icon: "fas fa-person-rays", desc: "Sem ações; fala pausadamente. Considerado Incapacitado; CR reduzido à metade.", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.MKTqTCse3i4q65UW" }
  ] },
  { nome: "FÍSICAS", desc: "Condições relacionadas a estados físicos.", condicoes: [
    { id: "jj-agarrado", label: "Agarrado", icon: "fas fa-hand-grab", desc: "Deslocamento 0. Escapa com Teste Resistido de Atletismo. Movimentar custa o dobro.", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.jKsdLPwcUG1UCPPV" },
    { id: "jj-desidratado", label: "Desidratado", icon: "fas fa-droplet-slash", desc: "Deslocamento ÷2. 1 nível de exaustão por hora e −1 Ponto de Ação no turno. Encerra com 500 ml de água.", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.ta87A3Hi6qKbcfby" },
    { id: "jj-empoderado", label: "Empoderado", icon: "fas fa-fist-raised", desc: "Ataques corpo-a-corpo +1 passo. Não perde PA ao errar técnica. Imune a terreno difícil.", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.j7PBrhnyA6S16YdE" },
    { id: "jj-energia-esgotada", label: "Energia Esgotada", icon: "fas fa-battery-empty", desc: "Não pode usar habilidades ou técnicas. Também está Letárgico.", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.dzLhwYGLXaSph2NZ" },
    { id: "jj-exausto", label: "Exausto", icon: "fas fa-tired", desc: "−2 em rolagens d20 e −1,5 m de deslocamento. Efeito Colateral reduz só 2 PA/nível. Acumulável até 6 níveis — clique: +1; clique-direito: −1.", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.1NYdKYXZYPT3fXCH" },
    { id: "jj-hipotermico", label: "Hipotérmico", icon: "fas fa-temperature-low", desc: "1 desvantagem em Salvaguardas e Testes de Agilidade e em jogadas de ataque. Trata com Medicina CD 10 ou Sobrevivência CD 17.", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.Upq7sAxjKe0iRf4o" },
    { id: "jj-sufocado", label: "Sufocado", icon: "fas fa-lungs-virus", desc: "Sem palavras e desvantagem em Salv. Agi. Após 1 + mod. CON turnos, Teste CON CD 10 (+2/turno) ou desmaia.", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.nhSU998IvHDrIhpZ" }
  ] },
  { nome: "MOVIMENTO", desc: "Condições relacionadas ao deslocamento do personagem.", condicoes: [
    { id: "jj-acelerado", label: "Acelerado", icon: "fas fa-forward-fast", desc: "+2 Pontos de Ação (máx. 8) e +10 m de deslocamento. Custo dobra com duração prolongada.", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.wsnVHxfuvmLPXb9q" },
    { id: "jj-caido", label: "Caído", icon: "fas fa-person-falling", desc: "Só rasteja (1 m extra por metro). Desvantagem em ataques e ataques a distância contra ele têm... Encerra levantando com 1 Ação.", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.oY0bnrEa1qpajUGM" },
    { id: "jj-estremecido", label: "Estremecido", icon: "fas fa-person-trembling", desc: "Desvantagem em ataques, sem concentração e deslocamento custa 1,5 m extra.", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.aVZzLjrVJCW8jOOK" },
    { id: "jj-impedido", label: "Impedido", icon: "fas fa-ban", desc: "Sem ações com movimento; 1 desvantagem em ataques. Escapa com Atletismo na CD de remoção (12 + For ou 17 fixo).", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.KsXjzgsk9ue34GfF" },
    { id: "jj-lento", label: "Lento", icon: "fas fa-person-walking-with-cane", desc: "−10 m de deslocamento no turno e 1 m extra de custo por metro.", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.3EJ9bs9STptwXPb9" },
    { id: "jj-voando", label: "Voando", icon: "fas fa-dove", desc: "Movimento de voo igual ao padrão. Só pode ser alvejado a distância ou por voadores.", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.BtU6X5YifQ1uVGPl" },
    { id: "jj-letargico", label: "Letárgico", icon: "fas fa-person-walking", desc: "Deslocamento ÷2 e dano de ataques ÷2 (exceto armas de fogo).", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.5BLuQfwPZzgkG3l9" },
    { id: "jj-pesado", label: "Pesado", icon: "fas fa-weight-hanging", desc: "Deslocamento ÷2 e desvantagem em ataques corpo-a-corpo.", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.0VeVeEoqu054mdYO" }
  ] },
  { nome: "DANO", desc: "Condições de dano por rodadas; remove-se com a ação Remover (Medicina na CD da criatura).", condicoes: [
    { id: "jj-envenenado", label: "Envenenado", icon: "fas fa-skull-crossbones", desc: "Dano de Veneno por turno igual ao atributo principal do atacante; 3 rodadas (reaplicar reseta).", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.Jo4UFzxrCkhqYl6z" },
    { id: "jj-chocado", label: "Chocado", icon: "fas fa-bolt", desc: "Dano Elétrico por turno igual a metade do atributo do atacante; 3 rodadas (reaplicar reseta).", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.O9bIMRDLcbXMoISd" },
    { id: "jj-congelando", label: "Congelando", icon: "fas fa-snowflake", desc: "Fica Lento e sofre dano de Frio por turno igual ao atributo do atacante; 1 rodada (reaplicar reseta).", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.LC4qkxossoQ8t251" },
    { id: "jj-confuso", label: "Confuso", icon: "fas fa-shuffle", desc: "Fica Desorientado e sofre dano Psíquico por turno igual a metade do atributo do atacante; 2 rodadas (reaplicar reseta).", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.lw5SnygMLJslduBm" },
    { id: "jj-corroendo", label: "Corroendo", icon: "fas fa-flask", desc: "Dano Ácido por turno igual ao atributo do atacante; 3 rodadas (reaplicar reseta).", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.UzBrqJokBl2KW2ad" },
    { id: "jj-em-chamas", label: "Em Chamas", icon: "fas fa-fire", desc: "Dano de Fogo por turno igual ao atributo do atacante; 3 rodadas (reaplicar reseta).", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.JMQbj2yVH6MTmg2Y" },
    { id: "jj-entropia", label: "Entropia", icon: "fas fa-hurricane", desc: "Fica Amedrontado e sofre dano de Alma por turno igual a metade do atributo do atacante; 2 rodadas (reaplicar reseta).", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.wf5oTX2apWqYSqFE" },
    { id: "jj-irradiado", label: "Irradiado", icon: "fas fa-radiation", desc: "Dano de Energia por turno igual ao atributo do atacante; 3 rodadas (reaplicar reseta).", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.3rylfx81bY4xBoWS" },
    { id: "jj-sangramento", label: "Sangramento", icon: "fas fa-droplet", desc: "Dano Perfurante ou Cortante por turno igual ao atributo do atacante; 3 rodadas (reaplicar reseta).", reference: "JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.0zArqMLjD3Zq1MTa" }
  ] }
];

/** Lista plana das condições 2.0 (para busca por id). */
export const JJ2_CONDITIONS = JJ2_CONDITION_GROUPS.flatMap(g => g.condicoes);

/* ── Status Effects no token (Assign Status Effect) ──────────────────────────
 * Todas as condições jj ficam registradas em CONFIG.statusEffects — aparecem
 * no HUD do token e podem ser aplicadas/removidas por qualquer caminho. As
 * que têm referente no dnd5e também incluem o status core no efeito
 * (Invisível desaparece no canvas, Cego usa a arte do sistema etc.). */
const REFERENTES_CORE = Object.freeze({
  "jj-cego": "blind",
  "jj-surdo": "deafened",
  "jj-amedrontado": "frightened",
  "jj-agarrado": "grappled",
  "jj-invisivel": "invisible",
  "jj-paralisado": "paralyzed",
  "jj-petrificado": "petrified",
  "jj-envenenado": "poisoned",
  "jj-caido": "prone",
  "jj-impedido": "restrained",
  "jj-atordoado": "stunned",
  "jj-inconsciente": "unconscious"
});

/** Registra as condições jj em CONFIG.statusEffects (chamado na carga do módulo). */
export function registrarStatusEffectsCondicoes() {
  const alvo = (CONFIG.statusEffects ??= {});
  for ( const cond of JJ2_CONDITIONS ) {
    if ( alvo[cond.id] ) continue;
    const svg = legacy2ConditionIcon(cond.id).replaceAll("currentColor", "#f6f1e5");
    alvo[cond.id] = {
      id: cond.id,
      name: cond.label,
      img: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
    };
  }
}
globalThis.Hooks?.once?.("init", () => registrarStatusEffectsCondicoes());

/** Ids de status para o efeito de uma condição: o id jj + o status core referente. */
export function statusesParaCondicao(condId) {
  const core = REFERENTES_CORE[condId];
  return (core && CONFIG.statusEffects[core]) ? [condId, core] : [condId];
}
// [/gerado: jj2]

/**
 * Remove um efeito à prova de corrida: cliques rápidos podem capturar o mesmo
 * efeito antes de o servidor processar o primeiro delete — a segunda remoção
 * lancaria "ActiveEffect does not exist".
 */
const remocoesEmCurso = new WeakSet();
async function apagarEfeitoSemCorrida(actor, efeito) {
  if ( !efeito ) return;
  if ( remocoesEmCurso.has(efeito) ) return; // outro clique já está removendo
  remocoesEmCurso.add(efeito);
  try {
    if ( actor.effects.get(efeito.id) ) await efeito.delete();
  } catch { /* já removido em outro clique */ }
  finally { remocoesEmCurso.delete(efeito); }
}

export function injectJJConditions(element, actor) {
  // Só age na aba effects
  const effectsTab = element.querySelector('.tab[data-tab="effects"]');
  if ( !effectsTab ) return;
  const modern = effectsTab.classList.contains("jj2-effects-page");

  // Esconder seção nativa de condições
  const nativeSections = effectsTab.querySelectorAll(".conditions, .conditions-list");
  nativeSections.forEach(el => {
    // Subir até o header + lista
    const section = el.closest("fieldset, section, .flexcol") ?? el;
    section.style.display = "none";
  });

  // Evitar injeção duplicada
  if ( effectsTab.querySelector(".jj-conditions-section") ) {
    // Atualizar estado ativo das condições existentes
    const activeStatuses = new Set(actor.statuses ?? []);
    effectsTab.querySelectorAll(".jj-cond-item").forEach(item => {
      item.classList.toggle("active", activeStatuses.has(item.dataset.condId));
      if ( modern ) {
        item.setAttribute("aria-pressed", String(activeStatuses.has(item.dataset.condId)));
        item.disabled = actor.isOwner === false;
        item.classList.toggle("always-interactive", actor.isOwner !== false);
      }
      // Exausto: badge de níveis (cargas) no chip
      if ( item.dataset.condId === "jj-exausto" ) {
        const efeito = actor.effects.find(e => e.statuses?.has("jj-exausto"));
        const nivel = Number(efeito?.getFlag?.("jujutsu-system", "exaustoNivel") ?? 0);
        const badge = item.querySelector(".jj-cond-nivel");
        if ( badge ) { badge.textContent = nivel > 0 ? `${nivel}×` : ""; badge.hidden = nivel <= 0; }
      }
    });
    if ( modern ) {
      const custom = effectsTab.querySelector(".jj-cond-custom-btn");
      custom.disabled = actor.isOwner === false;
      custom.classList.toggle("always-interactive", actor.isOwner !== false);
    }
    return;
  }

  const activeStatuses = new Set(actor.statuses ?? []);

  /* ── Condições de Ações: modificadores de Pontos de Ação ────────────────────
   * Aplicados como changes do efeito, reduzindo (ou zerando) o pool de PA
   * enquanto a condição estiver ativa:
   *   Atordoado −4 · Concussão −2 · Incapacitado −2 · Sonolento −1 ·
   *   Paralisado zera (OVERRIDE 0). O Desorientado cobra +1 ⬢ por ação que
   *   use PA (tratado no custo do uso, acoes-combate.mjs). */

  /* ── Condições de Movimento: deslocamento ───────────────────────────────────
   * ÷2: Desidratado, Estremecido (custo dobrado), Letárgico e Pesado ·
   * ÷4: Caído (só rastejar com custo dobrado) · 0: Agarrado e Impedido ·
   * fixo 3 m: Atordoado · −10 m: Lento · −1,5 m: Exausto. */


  /* ── Preservar a posição de scroll ao ligar/desligar uma condição ─────────
   * O toggle re-renderiza a ficha e os containers roláveis são recriados,
   * jogando a janela para o topo. A posição é guardada num registro POR ATOR e
   * restaurada pela própria ficha no _onRender (após o mount completo) —
   * restaurar por tentativa temporária perde a posição quando o conteúdo
   * ainda está montando (o navegador clampa o scrollTop). */
  const scrollsPendentes = (globalThis.__jjScrollCondicoes ??= new Map());
  const seletorCaminho = el => {
    const partes = [];
    let atual = el;
    while (atual && atual !== document.body) {
      const classes = [...atual.classList].join(".");
      if ( atual.id ) { partes.unshift("#" + CSS.escape(atual.id)); break; }
      if ( classes ) partes.unshift(atual.tagName.toLowerCase() + "." + classes);
      atual = atual.parentElement;
    }
    return partes.join(" > ");
  };
  const guardarScroll = () => {
    const mapa = (globalThis.__jjScrollCondicoes ??= new Map());
    const lista = [];
    let no = effectsTab;
    while (no && no !== document.body) {
      if ( no.scrollHeight > no.clientHeight + 4 && /(auto|scroll|overlay)/.test(getComputedStyle(no).overflowY) )
        lista.push({ seletor: seletorCaminho(no), scrollTop: no.scrollTop });
      no = no.parentElement;
    }
    mapa.set(actor.id, lista);
    return lista;
  };
  const itemHTML = cond => `
      <button type="button" class="jj-cond-item ${actor.isOwner !== false ? "always-interactive" : ""} ${activeStatuses.has(cond.id) ? "active" : ""}"
        data-cond-id="${cond.id}" aria-pressed="${activeStatuses.has(cond.id)}" ${actor.isOwner === false ? "disabled" : ""}
        data-tooltip="${cond.desc}" data-tooltip-direction="UP"
        ${cond.reference ? `data-jj-ref="${cond.reference}"` : ""}>
        ${legacy2ConditionIcon(cond.id)}<span>${cond.label}</span>${cond.id === "jj-exausto" ? (() => {
          const efeito = actor.effects.find(e => e.statuses?.has("jj-exausto"));
          const nivel = Number(efeito?.getFlag?.("jujutsu-system", "exaustoNivel") ?? (efeito ? 1 : 0));
          return `<span class="jj-cond-nivel"${nivel <= 0 ? " hidden" : ""}>${nivel > 0 ? `${nivel}×` : ""}</span>`;
        })() : ""}<span class="jj2-condition-state">${legacy2ConditionIcon("selected")}</span>
      </button>`;

  const section = document.createElement("div");
  section.className = "jj-conditions-section";
  // Kokusen (Fulgor Negro): margens editáveis na aba de efeitos — a primária
  // é o 20 natural que permite o teste e a secundária o mínimo do dado extra.
  const kokusenMargens = actor.system.manipulation?.abilities?.fulgorNegro?.unlocked
    && !effectsTab.querySelector(".jj2-fulgor-box") ? {
    primaria: Number(actor.getFlag("jujutsu-system", "fulgorPrimaria") ?? 20) || 20,
    secundaria: Number(actor.getFlag("jujutsu-system", "fulgorSecundaria") ?? 15) || 15
  } : null;
  const donoEditor = actor.isOwner !== false;
  // Corpo Frágil (peculiaridade): imune à REDUÇÃO de Pontos de Ação das
  // condições — os changes de actions.max negativos/override são filtrados.
  const imuneReducaoPA = temPeculiaridade(actor, "corpo-fragil");
  const cambiosCondicao = condId => [
    ...(MODIFICADORES_CONDICOES[condId] ?? []),
    ...(MODIFICADORES_MOVIMENTO[condId] ?? []),
    ...(MODIFICADORES_DEFESA[condId] ?? [])
  ].filter(change => !(imuneReducaoPA
    && (change.key === "system.legacy2.actions.max")
    && ((change.mode === CONST.ACTIVE_EFFECT_MODES.ADD && Number(change.value) < 0)
      || (change.mode === CONST.ACTIVE_EFFECT_MODES.OVERRIDE))));
  section.innerHTML = modern ? `
    <div class="jj-cond-header"><span>${legacy2ConditionIcon("conditions")}<strong>Condições</strong></span>
      <button type="button" class="jj-cond-custom-btn ${donoEditor ? "always-interactive" : ""}" aria-label="Adicionar condição customizada" ${actor.isOwner === false ? "disabled" : ""}>${legacy2ConditionIcon("add")}Adicionar</button>
    </div>
    ${kokusenMargens ? `
    <div class="jj-kokusen-margens" data-tooltip="Kokusen (Fulgor Negro): em um ataque com resultado natural ≥ Principal, role o dado secundário — igual ou acima da Secundária ativa o Kokusen (dano base ×2,5). Depois da primeira ativação no encontro, todo natural ≥ Principal ativa direto. Com Fulgor Certeiro, a Secundária efetiva nunca passa de 11.">
      <span>⚡ Kokusen</span>
      <label>Principal <input type="number" min="1" max="20" step="1" value="${kokusenMargens.primaria}" data-kokusen="fulgorPrimaria" ${donoEditor ? "" : "disabled"} aria-label="Margem principal do Kokusen"></label>
      <label>Secundária <input type="number" min="1" max="20" step="1" value="${kokusenMargens.secundaria}" data-kokusen="fulgorSecundaria" ${donoEditor ? "" : "disabled"} aria-label="Margem secundária do Kokusen"></label>
    </div>` : ""}
    ${JJ2_CONDITION_GROUPS.map(grupo => `
    <div class="jj-cond-grupo" data-grupo="${grupo.nome}">
      <div class="jj-cond-grupo-titulo" data-tooltip="${grupo.desc}" data-tooltip-direction="UP">${grupo.nome}</div>
      <div class="jj-cond-grid">${grupo.condicoes.map(itemHTML).join("")}</div>
    </div>`).join("")}` : `
    <div class="jj-cond-header">
      <span>Condições</span>
      <button class="jj-cond-custom-btn" title="Condição customizada">
        <i class="fas fa-plus"></i>
      </button>
    </div>
    <div class="jj-cond-grid">
      ${JJ_CONDITIONS.map(cond => `
        <div class="jj-cond-item ${activeStatuses.has(cond.id) ? "active" : ""}"
             data-cond-id="${cond.id}"
             ${cond.reference ? `data-jj-ref="${cond.reference}"` : `data-tooltip="${cond.label}" data-tooltip-direction="UP"`}>
          <i class="${cond.icon}"></i>
          <span>${cond.label}</span>
        </div>`).join("")}
    </div>`;

  // Margens do Kokusen: gravação imediata nas flags (clamp 1–20).
  section.querySelectorAll("[data-kokusen]").forEach(input => input.addEventListener("change", async () => {
    if ( modern && actor.isOwner === false ) return;
    const valor = Math.min(20, Math.max(1, Math.trunc(Number(input.value)) || 20));
    input.value = valor;
    await actor.setFlag("jujutsu-system", input.dataset.kokusen, valor);
    ui.notifications.info(`Kokusen: margem ${input.dataset.kokusen === "fulgorPrimaria" ? "principal" : "secundária"} ajustada para ${valor}.`);
  }));

  // Listeners de toggle
  section.querySelectorAll(".jj-cond-item").forEach(el => {
    el.addEventListener("click", async () => {
      if ( modern && actor.isOwner === false ) return;
      const condId = el.dataset.condId;
      const isActive = el.classList.contains("active");
      const cond = JJ2_CONDITIONS.find(c => c.id === condId) ?? JJ_CONDITIONS.find(c => c.id === condId);
      if ( !cond ) return;
      // Imunidades por peculiaridade (Pesadelos→Amedrontado · Olhar do Abismo→Atordoado).
      if ( !isActive && imunidadeCondicao(actor, condId) ) {
        ui.notifications.warn(`${cond.label}: ${actor.name} é imune a esta condição (peculiaridade).`);
        return;
      }
      const scroll = guardarScroll();
      // Exausto: ACUMULÁVEL — cada clique adiciona +1 nível (máx. 6),
      // −1,5 m de deslocamento por nível.
      if ( condId === "jj-exausto" && isActive ) {
        const existente = actor.effects.find(e => e.statuses?.has(condId));
        const nivel = Number(existente?.getFlag?.("jujutsu-system", "exaustoNivel") ?? 1);
        if ( nivel >= 6 ) { ui.notifications.info("Exausto já está no máximo de 6 níveis."); return; }
        const novoNivel = nivel + 1;
        await existente.update({
          changes: [{ key: "system.attributes.movement.walk", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: -(1.5 * novoNivel) }],
          "flags.jujutsu-system.exaustoNivel": novoNivel
        });
        return;
      }
      if ( !isActive ) {
        await actor.createEmbeddedDocuments("ActiveEffect", [{
          name:     cond.label,
          icon:     "icons/svg/aura.svg",
          statuses: statusesParaCondicao(condId),
          changes:  cambiosCondicao(condId),
          flags:    { "jujutsu-system": { isJujutsuCondition: true, ...(condId === "jj-exausto" ? { exaustoNivel: 1 } : {}) } }
        }]);
        // Desidratado: inicia a contagem de horas para a exaustão (1/hora).
        if ( condId === "jj-desidratado" ) {
          await actor.setFlag("jujutsu-system", "desidratadoDesde", Math.floor(game.time?.worldTime ?? 0));
          await actor.setFlag("jujutsu-system", "desidratadoHoras", 0);
        }
        // Condição de Ação: as ações atuais caem pro teto imediatamente
        // (Paralisado zera; Atordoado −4; Concussão/Incapacitado −2; Sonolento −1).
        if ( MODIFICADORES_CONDICOES[condId] ) {
          await actor.update({ "system.legacy2.actions.value": acoesTetoEfetivo(actor) });
        }
      } else {
        const existing = actor.effects.find(e => e.statuses?.has(condId));
        await apagarEfeitoSemCorrida(actor, existing);
        // Desidratado removida (500 ml de água): encerra a contagem de horas —
        // a exaustão acumulada permanece (removida por descanso/cura).
        if ( condId === "jj-desidratado" ) {
          await actor.unsetFlag("jujutsu-system", "desidratadoDesde");
          await actor.unsetFlag("jujutsu-system", "desidratadoHoras");
        }
      }
      // Estado visual atualizado automaticamente pelo re-render
    });

    // Clique-direito: Exausto perde 1 nível; outras condições são removidas.
    section.querySelectorAll(".jj-cond-item").forEach(el => {
      el.addEventListener("contextmenu", async (ev) => {
        ev.preventDefault();
        if ( modern && actor.isOwner === false ) return;
        const condId = el.dataset.condId;
        const existente = actor.effects.find(e => e.statuses?.has(condId));
        if ( !existente ) return;
        if ( condId !== "jj-exausto" ) { await apagarEfeitoSemCorrida(actor, existente); return; }
        const nivel = Number(existente.getFlag?.("jujutsu-system", "exaustoNivel") ?? 1);
        const novoNivel = nivel - 1;
        if ( novoNivel <= 0 ) await apagarEfeitoSemCorrida(actor, existente);
        else await existente.update({
          changes: [{ key: "system.attributes.movement.walk", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: -(1.5 * novoNivel) }],
          "flags.jujutsu-system.exaustoNivel": novoNivel
        });
      });
    });
  });

  // Botão condição customizada
  section.querySelector(".jj-cond-custom-btn").addEventListener("click", async () => {
    if ( modern && actor.isOwner === false ) return;
    const name = await foundry.applications.api.DialogV2.wait({
      window: { title: "Condição Customizada" },
      content: `<div style="padding:8px 0">
        <label style="display:block;margin-bottom:6px;font-size:12px;color:#aaa">Nome:</label>
        <input type="text" id="jj-custom-cond" placeholder="Ex: Marcado, Maldito..." style="width:100%">
      </div>`,
      buttons: [
        {
          label:   "Adicionar",
          action:  "ok",
          default: true,
          callback: (event, button, dialog) => (dialog.element?.querySelector("#jj-custom-cond") ?? document.querySelector("#jj-custom-cond"))?.value?.trim() ?? null
        },
        {
          label:    "Cancelar",
          action:   "cancel",
          callback: () => null
        }
      ],
      rejectClose: false,
      close: () => null
    });
    if ( !name ) return;
    guardarScroll();
    await actor.createEmbeddedDocuments("ActiveEffect", [{
      name,
      icon:     "icons/svg/aura.svg",
      statuses: [`jj-custom-${name.toLowerCase().replace(/\s+/g, "-")}`],
      flags:    { "jujutsu-system": { isCustomCondition: true } }
    }]);
    ui.notifications.info(`Condição "${name}" adicionada a ${actor.name}.`);
  });

  effectsTab.appendChild(section);

  // Tooltips via fromUuid para JournalEntryPage tipo Text
  applyJJTextTooltips(section);
}

/** Restauração da posição de scroll pendente — chamada pelo _onRender da ficha. */
export function restaurarScrollCondicoes(actor) {
  const lista = (globalThis.__jjScrollCondicoes ?? new Map()).get(actor?.id);
  if ( !lista?.length ) return false;
  globalThis.__jjScrollCondicoes.delete(actor.id);
  // Reaplica por alguns frames: o conteúdo da aba pode terminar de montar
  // DEPOIS do render (o navegador clampa o scrollTop ao máximo do momento).
  let tentativas = 0;
  const aplicar = () => {
    let completo = true;
    for ( const { seletor, scrollTop } of lista ) {
      const alvo = document.querySelector(seletor);
      if ( !alvo ) { completo = false; continue; }
      if ( alvo.scrollTop < scrollTop ) {
        alvo.scrollTop = scrollTop;
        if ( alvo.scrollTop < scrollTop ) completo = false; // clampado: conteúdo ainda curto
      }
    }
    return completo;
  };
  const tick = () => {
    if ( aplicar() ) { globalThis.__jjScrollCondicoes.set(actor.id, lista); return; }
    if ( ++tentativas > 150 ) return;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return true;
}
