/**
 * jj/conditions.mjs
 * Condições customizadas do sistema Jujutsu Legacy.
 */
import { applyJJTextTooltips } from "./tooltips.mjs";

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
  { id: "jj-exausto",         label: "Exausto",          icon: "fas fa-tired",             desc: "−2 em rolagens d20. −1,5m de deslocamento. Acumulável até 3× por técnicas.",                                      reference: "Compendium.jujutsu-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.jUQ0Ojn7NsJcygkg" },
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


export function injectJJConditions(element, actor) {
  // Só age na aba effects
  const effectsTab = element.querySelector('[data-tab="effects"]');
  if ( !effectsTab ) return;

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
    });
    return;
  }

  const activeStatuses = new Set(actor.statuses ?? []);

  const section = document.createElement("div");
  section.className = "jj-conditions-section";
  section.innerHTML = `
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

  // Listeners de toggle
  section.querySelectorAll(".jj-cond-item").forEach(el => {
    el.addEventListener("click", async () => {
      const condId = el.dataset.condId;
      const isActive = el.classList.contains("active");
      const cond = JJ_CONDITIONS.find(c => c.id === condId);
      if ( !isActive ) {
        await actor.createEmbeddedDocuments("ActiveEffect", [{
          name:     cond.label,
          icon:     "icons/svg/aura.svg",
          statuses: [condId],
          flags:    { "jujutsu-system": { isJujutsuCondition: true } }
        }]);
      } else {
        const existing = actor.effects.find(e => e.statuses?.has(condId));
        if ( existing ) await existing.delete();
      }
      // Estado visual atualizado automaticamente pelo re-render
    });
  });

  // Botão condição customizada
  section.querySelector(".jj-cond-custom-btn").addEventListener("click", async () => {
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


