/**
 * jj/tooltips.mjs
 * Hover cards via fromUuid para perícias, treinamentos, habilidades e condições.
 */

export function injectSkillRefs(root) {
  const JJ_SKILL_REFERENCES = {
    ath:  "Compendium.jujutsu-system.conteudo.JournalEntry.uKKV909xsw17EMmE.JournalEntryPage.E0HyftT4a8L8izrn",
    acr:  "Compendium.jujutsu-system.conteudo.JournalEntry.uKKV909xsw17EMmE.JournalEntryPage.TBVH56FoQArmMSBs",
    ste:  "Compendium.jujutsu-system.conteudo.JournalEntry.uKKV909xsw17EMmE.JournalEntryPage.rOZ9n5PYFuEbF08g",
    arc:  "Compendium.jujutsu-system.conteudo.JournalEntry.uKKV909xsw17EMmE.JournalEntryPage.JdqcNM9InigMmbKK",
    slt:  "Compendium.jujutsu-system.conteudo.JournalEntry.uKKV909xsw17EMmE.JournalEntryPage.Fe5nQhWyR8vmTdLC",
    Cont: "Compendium.jujutsu-system.conteudo.JournalEntry.uKKV909xsw17EMmE.JournalEntryPage.tWMttxGVytG2EL1R",
    his:  "Compendium.jujutsu-system.conteudo.JournalEntry.uKKV909xsw17EMmE.JournalEntryPage.MjR2QOJE5LPKiN0F",
    inv:  "Compendium.jujutsu-system.conteudo.JournalEntry.uKKV909xsw17EMmE.JournalEntryPage.wLE08CcH5Zj8l1eS",
    med:  "Compendium.jujutsu-system.conteudo.JournalEntry.uKKV909xsw17EMmE.JournalEntryPage.xLVLvUH9S8hfD1rY", 
    rel:  "Compendium.jujutsu-system.conteudo.JournalEntry.uKKV909xsw17EMmE.JournalEntryPage.x9lTMRKUfHR7g9qN",
    luc:  "Compendium.jujutsu-system.conteudo.JournalEntry.uKKV909xsw17EMmE.JournalEntryPage.mcIlW9Xizd3l3rtD",
    ani:  "Compendium.jujutsu-system.conteudo.JournalEntry.uKKV909xsw17EMmE.JournalEntryPage.04XZdF0Ntc60wj12",
    nat:  "Compendium.jujutsu-system.conteudo.JournalEntry.uKKV909xsw17EMmE.JournalEntryPage.h9MaeejQSTgBF3BM",
    sur:  "Compendium.jujutsu-system.conteudo.JournalEntry.uKKV909xsw17EMmE.JournalEntryPage.ZKJhD4I3Pc75BNzF",
    ins:  "Compendium.jujutsu-system.conteudo.JournalEntry.uKKV909xsw17EMmE.JournalEntryPage.dJF7x8aruBfT84cz",
    prc:  "Compendium.jujutsu-system.conteudo.JournalEntry.uKKV909xsw17EMmE.JournalEntryPage.elJZJXFWk7t0nf31",
    Sobr: "TODO:UUID_Sobreviencia",  // TODO: substituir pelo UUID correto da página do compêndio
    Sort: "TODO:UUID_Sortilegio",   // TODO: substituir pelo UUID correto da página do compêndio
    prf:  "Compendium.jujutsu-system.conteudo.JournalEntry.uKKV909xsw17EMmE.JournalEntryPage.cHdibPaupb34dyk4",
    dec:  "Compendium.jujutsu-system.conteudo.JournalEntry.uKKV909xsw17EMmE.JournalEntryPage.6eg3JWjY8xs6DMC6",
    itm:  "Compendium.jujutsu-system.conteudo.JournalEntry.uKKV909xsw17EMmE.JournalEntryPage.70xBRlUnlGDapKy6",
    per:  "Compendium.jujutsu-system.conteudo.JournalEntry.uKKV909xsw17EMmE.JournalEntryPage.vmdCFLdaRG729Yg9",
    Prov: "TODO:UUID_Provocacao"   // TODO: substituir pelo UUID correto da página do compêndio
  };
  root.querySelectorAll("li[data-key]").forEach(el => {
    const key = el.dataset.key;
    if ( !key || !(key in JJ_SKILL_REFERENCES) ) return;
    el.dataset.jjRef = JJ_SKILL_REFERENCES[key];
    delete el.dataset.tooltip;
  });
}

export function injectTrainingRefs(root) {
  const JJ_TRAINING_REFERENCES = {
    "protecaoEnergia":         "Compendium.jujutsu-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.D784UnTjqTaJZOEh",
    "impactoEcoante":          "Compendium.jujutsu-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.a6Ou5E3jxIMYsZPt",
    "robusto":                 "Compendium.jujutsu-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.s0Rq2BmzMI1Pbw2L",
    "agilidadeAvancada":       "Compendium.jujutsu-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.AqvfUbRRQzpVlHz1",
    "energiaAdaptavel":        "Compendium.jujutsu-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.GMsFUhiFKbSnPsGJ",
    "energiaBruta":            "Compendium.jujutsu-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.Z5mDHhz0sVRHsA3B",
    "golpePenetrante":         "Compendium.jujutsu-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.3vPFbFcuDdpSvwKT",
    "periciaNodavel":          "Compendium.jujutsu-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.miXywfeqLSk6hzI6",
    "resistenciaAprimorada":   "Compendium.jujutsu-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.11yZVOrfieCSv8YC",
    "ritmoCombate":            "Compendium.jujutsu-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.TYMYMOCH2iZhs9NL",
    "reversaoDominada":        "Compendium.jujutsu-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.VLP7DaQoUH5Gfpu3",
    "fulgorCerteiro":          "Compendium.jujutsu-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.gA882swrqxLwqj1N",
    "reversaoDupla":           "Compendium.jujutsu-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.IT0QweKyExQmAJGc",
    "reversaoOfensiva":        "Compendium.jujutsu-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.H7CY8R4LSHeE9D3a",
    "falhaCritica":            "Compendium.jujutsu-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.LzT1Zya0el1kuKRp",
    "dominioIncompleto":       "Compendium.jujutsu-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.9GZp3e1EQqsKA3ah",
    "dominioSimples":          "Compendium.jujutsu-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.lcaWf7WK3I9lCm8q",
    "cestaOcaDeVime":          "Compendium.jujutsu-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.oXF8McpPaneyvSxT",
    "emocaoDaFlorCaida":       "Compendium.jujutsu-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.2IhjDc0fKUOtdubM",
    "amplificacaoDominio":     "Compendium.jujutsu-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.EhzWEVQsCbJWY9wB",
    "dominioSimplesEstendido": "Compendium.jujutsu-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.9KQ2h5wAyBFZ1KrE",
    "expansaoModificada":      "Compendium.jujutsu-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.fqj9BD86pCg8p3BF",
    "expansaoFortalecida":     "Compendium.jujutsu-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.lfnLaby2SreAjXH1"
  };
  const JJ_TRAINING_KANJI = {
    "protecaoEnergia": "護", "impactoEcoante": "響", "robusto": "剛",
    "agilidadeAvancada": "速", "energiaAdaptavel": "変", "energiaBruta": "力",
    "golpePenetrante": "貫", "periciaNodavel": "技", "resistenciaAprimorada": "耐",
    "ritmoCombate": "律", "reversaoDominada": "逆", "fulgorCerteiro": "閃",
    "reversaoDupla": "双", "reversaoOfensiva": "攻", "falhaCritica": "術",
    "dominioIncompleto": "域", "dominioSimples": "簡", "cestaOcaDeVime": "籠",
    "emocaoDaFlorCaida": "花", "amplificacaoDominio": "拡", "dominioSimplesEstendido": "延",
    "expansaoModificada": "改", "expansaoFortalecida": "強"
  };
  root.querySelectorAll(".training-card[data-training-id]").forEach(el => {
    const id = el.dataset.trainingId;
    if ( !id ) return;
    if ( !el.dataset.jjRef ) {
      const uuid = JJ_TRAINING_REFERENCES[id];
      if ( uuid ) el.dataset.jjRef = uuid;
    }
    const kanjiEl = el.querySelector(".tc-kanji");
    if ( kanjiEl && !kanjiEl.textContent ) {
      kanjiEl.textContent = JJ_TRAINING_KANJI[id] ?? "術";
    }
  });
}

export function injectAbilityRefs(root) {
  const JJ_ABILITY_REFERENCES = {
    "defesaEnergia":       "Compendium.jujutsu-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.XBIoo4Xvi3i15IRh",
    "fulgorNegro":         "Compendium.jujutsu-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.VQsD5uqmj05cF69D",
    "explosaoOfensiva":    "Compendium.jujutsu-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.lsZAEHuvcDNXDNW1",
    "explosaoDefensiva":   "Compendium.jujutsu-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.qnmlbd0KIkiHcjXA",
    "despertarHabilidade": "Compendium.jujutsu-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.jJyINc1pObzIzdIx",
    "ultimoRecurso":       "Compendium.jujutsu-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.uOJ9E6DqsTkRPbYL",
    "sentirMaldicao":      "Compendium.jujutsu-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.ygkT8BcKxrb6W1iB",
    "envolver":            "Compendium.jujutsu-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.KFRBt9Qs9pux4FJR",
    "focoAgressivo":       "Compendium.jujutsu-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.7NlxD1VceHNVLqu0",
    "focoDefensivo":       "Compendium.jujutsu-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.5q2sTRGdGk3w8erf",
    "analiceSuperior":     "Compendium.jujutsu-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.YFrNnBf3wn7Xtu9F",
    "fluxoPerfeito":       "Compendium.jujutsu-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.k0E29NXdCk7SgDgl",
    "fluxoConstante":      "Compendium.jujutsu-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.QDjwDQaCvoIX8DQM",
    "energiaReversa":      "Compendium.jujutsu-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.6XSRr50Ar7Ma3xsi",
    "reversaoFeitico":     "Compendium.jujutsu-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.NzUjuPxfWz3j5r8m",
    "energiaFlexivel":     "Compendium.jujutsu-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.yC0xdO30Ly91jZHV",
    "negacaoEnergia":      "Compendium.jujutsu-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.GAMRCaZxKgGDK5Zq",
    "muralhaEnergia":      "Compendium.jujutsu-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.jX9LwCNSVMGWUYWH",
    "focoExtremo":         "Compendium.jujutsu-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.YJPOuVrZW9hp2pF5",
    "ofensivaExtrema":     "Compendium.jujutsu-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.9SbAGwJaZMc4UTab",
    "reversaoSubita":      "Compendium.jujutsu-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.gRJeXaWBvPWczeIH",
    "cortina":             "Compendium.jujutsu-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.ncnvUldh62tP1YbV",
    "barreiraVazia":       "Compendium.jujutsu-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.fCF7kqCBCyRfexEt",
    "barreiraPura":        "Compendium.jujutsu-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.XpybOwu136RN4jEe",
    "barreiraBon":         "Compendium.jujutsu-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.wGkR1gGcPwKE6D5W"
  };
  root.querySelectorAll(".ability-card[data-ability-id]").forEach(el => {
    const id = el.dataset.abilityId;
    if ( !id || el.dataset.jjRef ) return;
    const uuid = JJ_ABILITY_REFERENCES[id];
    if ( uuid ) el.dataset.jjRef = uuid;
  });
}

export function injectAbilityKanjis(root) {
  const JJ_ABILITY_KANJI = {
    // básicas
    "defesaEnergia":       "護",
    "fulgorNegro":         "黒",
    "explosaoOfensiva":    "爆",
    "explosaoDefensiva":   "盾",
    "despertarHabilidade": "覚",
    "ultimoRecurso":       "禁",
    // avançadas
    "sentirMaldicao":      "感",
    "envolver":            "包",
    "focoAgressivo":       "攻",
    "focoDefensivo":       "守",
    "analiceSuperior":     "析",
    "fluxoPerfeito":       "完",
    "fluxoConstante":      "続",
    "energiaReversa":      "逆",
    "reversaoFeitico":     "術",
    "energiaFlexivel":     "柔",
    // extremas
    "focoExtremo":         "極",
    "negacaoEnergia":      "消",
    "muralhaEnergia":      "壁",
    "ofensivaExtrema":     "最",
    "reversaoSubita":      "突",
    // barreiras
    "cortina":             "幕",
    "barreiraVazia":       "空",
    "barreiraPura":        "純",
    "barreiraBon":         "盆"
  };
  root.querySelectorAll(".ability-card[data-ability-id]").forEach(el => {
    const id = el.dataset.abilityId;
    if ( !id ) return;
    const kanjiEl = el.querySelector(".ability-kanji");
    if ( kanjiEl && !kanjiEl.textContent.trim() ) {
      kanjiEl.textContent = JJ_ABILITY_KANJI[id] ?? "術";
    }
  });
}

export function applyJJTextTooltips(root) {
  root.querySelectorAll("[data-jj-ref]").forEach(el => {
    if ( el.dataset.jjTooltipBound ) return;
    el.dataset.jjTooltipBound = "1";
    const uuid = el.dataset.jjRef;
    fromUuid(uuid).then(page => {
      if ( !page ) return;
      const rawHtml = page.text?.content ?? page.system?.text?.content ?? "";
      if ( !rawHtml ) return;
      el.dataset.tooltip = rawHtml;
      el.dataset.tooltipDirection = "UP";
    }).catch(() => {});
  });
}
