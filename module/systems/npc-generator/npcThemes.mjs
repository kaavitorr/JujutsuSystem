// ─────────────────────────────────────────────────────────────────────────────
// MALDIÇÕES POR MEDO — vocabulário de tags + marcação das características.
//
// Maldições nascem do medo (e do ódio/rancor) das pessoas: medo de cair, de
// insetos, do fogo, da escuridão, de tudo. Cada característica do catálogo
// (npcCatalog.js) recebe TAGS temáticas+mecânicas. Cada MODELO de maldição
// (npcCurses.js) tem PESOS por tag. A chance (0–99%) de uma característica cair
// ao "Gerar" sai do casamento entre as tags da característica e os pesos da
// maldição — clampada em [0, 99].
//
// Dois andares de poder, separados de propósito:
//   • ASPECTOS ANIMAIS (catálogo: aspecto / acaoBonus / acaoPoder / reacao) —
//     traços de bicho, FRACOS. Base de queda alta, várias podem cair.
//   • HABILIDADES DE MALDIÇÃO (catálogo: espiritoPoder / espiritoBonus /
//     espiritoReacao / barreira) — FORTES e temáticas. Base baixa, poucas caem.
// ─────────────────────────────────────────────────────────────────────────────
import { NPC_CATALOG } from './npcCatalog.mjs';

// Tier de cada lista do catálogo → andar de poder + slot de habilidade.
export const GROUP_TIER = {
  aspecto:        { tier: 'animal', slot: 'aspecto',  base: 9,  forca: 0.7 },
  acaoBonus:      { tier: 'animal', slot: 'bonus',    base: 6,  forca: 0.8 },
  acaoPoder:      { tier: 'animal', slot: 'poder',    base: 6,  forca: 0.9 },
  reacao:         { tier: 'animal', slot: 'reacao',   base: 6,  forca: 0.8 },
  espiritoPoder:  { tier: 'maldicao', slot: 'poder',  base: 4,  forca: 1.0 },
  espiritoBonus:  { tier: 'maldicao', slot: 'bonus',  base: 4,  forca: 1.0 },
  espiritoReacao: { tier: 'maldicao', slot: 'reacao', base: 4,  forca: 1.0 },
  barreira:       { tier: 'maldicao', slot: 'aspecto', base: 1, forca: 1.2 },
};

// ── Marcação por nome → tags (temáticas + mecânicas) ─────────────────────────
// Mecânicas comuns: medo, atordoar, paralisar, cegar, envenenar, sangrar,
// queimar, empurrar, derrubar, agarrar, area, aura, dano-direto, dot, dreno,
// mobilidade, teleporte, voo, escalada, furtividade, defensivo, reducao,
// contra-ataque, regeneracao, intangivel, controle, debuff, ilusao, barreira,
// dominio, invocacao, emboscada, matilha, percepcao, predador.
export const CHAR_TAGS = {
  // ── Aspectos (animal, fracos) ──────────────────────────────────────────────
  'Absorção de Eletricidade': ['eletrico', 'defensivo', 'dreno', 'natureza'],
  'Agarrador': ['agarrar', 'predador', 'controle'],
  'Agressivo': ['mobilidade', 'predador', 'raiva'],
  'Andar em Teias': ['aracnideo', 'mobilidade'],
  'Andar no Gelo': ['gelo', 'frio', 'mobilidade'],
  'Anfíbio': ['agua', 'natureza'],
  'Aparência Falsa': ['furtividade', 'emboscada'],
  'Ataque Surpresa': ['emboscada', 'furtividade', 'predador'],
  'Ataques Múltiplos': ['predador', 'dano-direto'],
  'Audição Aguçada': ['percepcao', 'animal', 'som'],
  'Aura de Medo': ['medo', 'aura', 'area', 'psiquico'],
  'Cabeça Dura': ['defensivo', 'atordoar'],
  'Camuflagem': ['furtividade', 'natureza'],
  'Carapaça Reflexiva': ['defensivo', 'contra-ataque', 'metal'],
  'Carnívoro Voraz': ['predador', 'carne', 'morte'],
  'Corpo Indomável': ['defensivo', 'medo'],
  'Corpo Inerte': ['defensivo', 'empurrar'],
  'Corpo Minúsculo': ['inseto', 'defensivo', 'mobilidade'],
  'Corpo Resistente': ['defensivo', 'contra-ataque'],
  'Couro Farpado': ['defensivo', 'dano-direto', 'aracnideo'],
  'Eco Localização': ['percepcao', 'som', 'animal'],
  'Emboscador': ['emboscada', 'furtividade', 'predador'],
  'Enxame': ['enxame', 'inseto', 'mobilidade'],
  'Escalada Aracnídea': ['aracnideo', 'escalada', 'mobilidade'],
  'Escalada': ['escalada', 'mobilidade', 'fera'],
  'Escavador': ['terra', 'escavar', 'mobilidade'],
  'Estabilidade': ['defensivo', 'derrubar', 'gravidade'],
  'Evasão': ['defensivo', 'mobilidade'],
  'Faro Aguçado': ['percepcao', 'predador', 'animal'],
  'Fedor': ['veneno', 'podridao', 'aura', 'doenca'],
  'Ferimento Enfurecedor': ['raiva', 'predador', 'dano-direto'],
  'Frenesi de Sangue': ['raiva', 'sangue', 'predador', 'dano-direto'],
  'Fúria': ['raiva', 'predador'],
  'Implacável': ['defensivo', 'morte'],
  'Luz Própria': ['luz'],
  'Monstro de Cerco': ['terra', 'pedra', 'dano-direto'],
  'Movimentação Livre': ['mobilidade'],
  'Natureza Robótica': ['maquina', 'metal'],
  'Pele Escorregadia': ['agua', 'defensivo', 'agarrar'],
  'Percepção às Cegas': ['percepcao', 'cegueira', 'escuridao'],
  'Planar': ['voo', 'altura', 'queda'],
  'Prender a Respiração': ['agua', 'defensivo', 'afogamento'],
  'Presença Aterradora': ['medo', 'aura', 'area', 'psiquico'],
  'Presença de Líder': ['matilha', 'multidao'],
  'Reativo': ['contra-ataque', 'defensivo'],
  'Reflexo': ['defensivo', 'mobilidade'],
  'Regeneração': ['regeneracao', 'defensivo', 'natureza'],
  'Respirar na Água': ['agua', 'profundeza', 'afogamento'],
  'Salto Parado': ['mobilidade', 'altura'],
  'Sentidos Aguçados': ['percepcao', 'animal'],
  'Sobrevoo': ['voo', 'altura', 'mobilidade'],
  'Táticas de Bando': ['matilha', 'multidao', 'predador'],
  'Vantagem Marcial': ['matilha', 'dano-direto'],
  'Visão Aguçada': ['percepcao'],
  'Visão Noturna': ['escuridao', 'percepcao'],

  // ── Ações Bônus (animal) ───────────────────────────────────────────────────
  'Agarrar com a Cauda': ['agarrar', 'predador', 'controle'],
  'Chefe': ['matilha', 'multidao', 'defensivo'],
  'Furtividade Sombria': ['furtividade', 'escuridao'],
  'Múltiplos Membros': ['predador', 'dano-direto', 'deformidade'],

  // ── Ações de Poder (animal) ────────────────────────────────────────────────
  'Ataque com Asas': ['voo', 'area', 'derrubar', 'altura'],
  'Ataque de Mergulho': ['voo', 'altura', 'dano-direto', 'emboscada'],
  'Bote Sônico': ['som', 'velocidade', 'dano-direto', 'derrubar'],
  'Bote': ['predador', 'derrubar', 'dano-direto'],
  'Corte Sangrento': ['sangue', 'sangrar', 'dot'],
  'Cuspir Veneno': ['veneno', 'envenenar', 'dot'],
  'Descuidado': ['raiva', 'dano-direto'],
  'Impacto Atordoante': ['atordoar', 'controle'],
  'Inflar': ['defensivo', 'queda'],
  'Investida Derrubadora': ['derrubar', 'empurrar', 'dano-direto', 'terra'],
  'Investida': ['dano-direto', 'predador'],
  'Soltar Tinta': ['escuridao', 'cegar', 'agua'],
  'Teia': ['aracnideo', 'agarrar', 'controle', 'prisao'],

  // ── Reações (animal) ───────────────────────────────────────────────────────
  'Apanhar Pedra': ['defensivo', 'pedra', 'contra-ataque'],
  'Aparar': ['defensivo', 'contra-ataque'],
  'Ataque de Oportunidade Superior': ['contra-ataque', 'controle'],
  'Ataque de Oportunidade Traiçoeiro': ['contra-ataque'],
  'Ataque de Oportunidade Orgulhoso': ['contra-ataque', 'matilha'],
  'Ataque de Oportunidade': ['contra-ataque'],
  'Defletir Projéteis': ['defensivo', 'mobilidade'],
  'Redirecionar Ataque': ['defensivo', 'matilha'],
  'Casco Protetor': ['defensivo', 'metal'],

  // ── Maldição — Ação de Poder (forte) ───────────────────────────────────────
  'Abalo Sísmico': ['terra', 'area', 'derrubar', 'queda', 'pedra', 'gravidade'],
  'Aura de Terror': ['medo', 'aura', 'area', 'psiquico', 'pesadelo'],
  'Carne Amaldiçoada': ['carne', 'dot', 'podridao', 'profano', 'doenca'],
  'Dimensão Instável': ['espacial', 'dimensao', 'area', 'debuff'],
  'Lamento Desesperador': ['som', 'grito', 'area', 'atordoar', 'psiquico'],
  'Parasita Amaldiçoado': ['dot', 'doenca', 'profano', 'inseto'],
  'Distorção Espacial': ['espacial', 'teleporte', 'dimensao', 'defensivo'],
  'Barreira Negativa': ['barreira', 'prisao', 'confinamento', 'espacial'],
  'Dreno de Vitalidade': ['dreno', 'area', 'morte', 'profano'],
  'Revelar Forma': ['raiva', 'dano-direto', 'profano', 'deformidade'],
  'Invocação Fragmentada': ['invocacao', 'multidao', 'deformidade'],
  'Colapso Interno': ['dano-direto', 'atordoar', 'profano'],
  'Prisão do Medo': ['medo', 'prisao', 'ilusao', 'psiquico', 'pesadelo', 'confinamento'],
  'Chuva Amaldiçoada': ['acido', 'area', 'agua', 'dot'],
  'Olhar Aterrador': ['olho', 'paralisar', 'medo', 'observacao', 'psiquico'],
  'Sobrecarga de Energia': ['dano-direto', 'raiva'],
  'Letargia Constante': ['aura', 'area', 'debuff', 'dano-direto', 'doenca'],
  'Eco Doloroso': ['psiquico', 'contra-ataque'],
  'Explosão Elemental': ['area', 'fogo', 'dano-direto', 'contra-ataque'],
  'Fragmentação de Realidade': ['espacial', 'dimensao', 'dano-direto'],
  'Presença Opressora': ['aura', 'area', 'gravidade', 'controle', 'debuff', 'peso'],
  'Fome Voraz': ['carne', 'morte', 'dreno', 'predador'],

  // ── Maldição — Ação Bônus (forte) ──────────────────────────────────────────
  'Ataque de Garra': ['predador', 'dano-direto'],
  'Passo Distorcido': ['espacial', 'teleporte', 'mobilidade'],
  'Golpes Disformes': ['deformidade', 'dano-direto'],
  'Revestimento Maldito': ['defensivo', 'reducao'],
  'Marca Efêmera': ['debuff', 'dano-direto', 'espacial'],
  'Avanço Predatório': ['predador', 'velocidade', 'mobilidade', 'perseguicao'],
  'Sussurros da Loucura': ['loucura', 'psiquico', 'debuff', 'mente'],
  'Recuperação Rápida': ['regeneracao', 'defensivo'],
  'Expulsão Violenta': ['empurrar', 'area', 'derrubar', 'gravidade'],
  'Olhar Desconcertante': ['olho', 'observacao', 'debuff'],
  'Instinto do Assassinato': ['furtividade', 'predador', 'debuff'],
  'Forma Etérea': ['intangivel', 'espacial', 'defensivo', 'mobilidade'],
  'Rastro Amaldiçoado': ['area', 'dot', 'mobilidade', 'profano'],

  // ── Maldição — Reação (forte) ──────────────────────────────────────────────
  'Reflexo Amaldiçoado': ['defensivo', 'contra-ataque'],
  'Distorção Defensiva': ['defensivo', 'reducao', 'espacial'],
  'Rejeição Violenta': ['empurrar', 'derrubar', 'contra-ataque', 'gravidade'],
  'Movimento Maldito': ['teleporte', 'espacial', 'defensivo', 'mobilidade'],
  'Apetite Voraz': ['dreno', 'defensivo', 'reducao', 'carne'],
  'Visão da Desgraça': ['olho', 'debuff', 'psiquico', 'contra-ataque', 'observacao'],
  'Persistência Maldita': ['defensivo', 'morte', 'regeneracao', 'espacial'],
  'Marca Reativa': ['debuff', 'contra-ataque'],
  'Ruptura de Concentração': ['debuff', 'contra-ataque', 'mente'],
  'Corpo Intangível': ['intangivel', 'defensivo', 'reducao'],
  'Eco Violento': ['contra-ataque', 'psiquico', 'dano-direto'],
  'Aura de Lentidão': ['aura', 'debuff', 'controle'],
  'Deslocamento Caótico': ['espacial', 'teleporte', 'defensivo'],

  // ── Barreiras / Domínios (mais fortes) ─────────────────────────────────────
  'Santuário da Morte': ['barreira', 'dominio', 'morte', 'ossos', 'profano'],
  'Estreito Espaço-Temporal': ['barreira', 'dominio', 'espacial', 'tempo', 'prisao', 'confinamento'],
  'Inferno Sacrifical': ['barreira', 'dominio', 'fogo', 'morte', 'sangue'],
  'Loop Temporal Completo': ['barreira', 'dominio', 'tempo', 'mente'],
  'Espaço do Sono Eterno': ['barreira', 'dominio', 'mente', 'confinamento', 'morte'],
  // ── Novas habilidades de maldição (Poder / Bônus / Reação) ──────────────────
  'Vinhas Amaldiçoadas': ['natureza', 'planta', 'agarrar', 'area', 'controle'],
  'Sopro Corrosivo': ['acido', 'veneno', 'area'],
  'Maldição da Cegueira': ['cegar', 'cegueira', 'escuridao', 'debuff'],
  'Pulso de Podridão': ['profano', 'morte', 'area', 'dreno'],
  'Toque Petrificante': ['terra', 'pedra', 'controle'],
  'Enxame Devorador': ['inseto', 'enxame', 'area', 'dot'],
  'Veneno Persistente': ['veneno', 'envenenar', 'dot', 'aracnideo'],
  'Grito Dissonante': ['som', 'grito', 'area', 'atordoar', 'psiquico'],
  'Chamas Espectrais': ['fogo', 'queimar', 'area'],
  'Lâminas de Vácuo': ['espacial', 'vazio', 'sangrar', 'area'],
  'Domínio do Frio': ['gelo', 'frio', 'area', 'controle', 'dominio'],
  'Miragem Cruel': ['ilusao', 'mente', 'medo', 'loucura'],
  'Corrente de Almas': ['morte', 'agarrar', 'dreno', 'area'],
  'Maldição do Peso': ['gravidade', 'derrubar', 'controle'],
  'Explosão de Esporos': ['natureza', 'doenca', 'area', 'debuff'],
  'Olhar Hipnótico': ['mente', 'controle', 'ilusao', 'psiquico'],
  'Mãos da Sepultura': ['morte', 'cadaver', 'agarrar', 'area', 'terra'],
  'Pústulas Explosivas': ['doenca', 'area', 'dano-direto'],
  'Cântico Enlouquecedor': ['mente', 'loucura', 'psiquico', 'area', 'som'],
  'Maré de Ácido': ['acido', 'agua', 'area', 'debuff'],
  'Bote Sombrio': ['escuridao', 'mobilidade', 'teleporte', 'emboscada'],
  'Casulo Regenerativo': ['regeneracao', 'defensivo'],
  'Salto Aberrante': ['mobilidade', 'espacial'],
  'Garras Dilacerantes': ['predador', 'sangrar', 'sangue', 'dano-direto'],
  'Véu de Sombras': ['escuridao', 'defensivo', 'furtividade'],
  'Sopro Gélido': ['gelo', 'frio'],
  'Pele de Aço': ['metal', 'defensivo'],
  'Investida Espectral': ['mobilidade', 'derrubar', 'predador'],
  'Lamúria Aterradora': ['medo', 'som', 'psiquico'],
  'Drenagem Tátil': ['dreno', 'morte', 'dano-direto'],
  'Aceleração Maldita': ['mobilidade'],
  'Cuspe Aprisionante': ['agarrar', 'aracnideo', 'controle'],
  'Reconfigurar Membros': ['carne', 'mobilidade'],
  'Marca de Caça': ['predador', 'emboscada', 'dano-direto'],
  'Esporos Cegantes': ['natureza', 'cegar', 'cegueira'],
  'Sussurro Confuso': ['mente', 'loucura', 'debuff', 'psiquico'],
  'Tentáculo Súbito': ['agua', 'agarrar', 'carne'],
  'Camuflagem Cromática': ['furtividade', 'emboscada'],
  'Mordida Infecciosa': ['doenca', 'veneno', 'envenenar', 'predador'],
  'Fenda Instável': ['espacial', 'dimensao', 'teleporte', 'controle'],
  'Contra-Investida': ['contra-ataque', 'predador'],
  'Casca Refletora': ['defensivo', 'contra-ataque', 'metal'],
  'Espinhos Reativos': ['defensivo', 'dano-direto', 'aracnideo'],
  'Recuo Fantasma': ['mobilidade', 'intangivel', 'teleporte'],
  'Maldição de Espelho': ['defensivo', 'espacial', 'debuff'],
  'Substituição Sombria': ['escuridao', 'defensivo', 'teleporte'],
  'Lufada Repulsora': ['empurrar', 'derrubar', 'area'],
  'Grito de Dor': ['som', 'grito', 'atordoar', 'area'],
  'Absorção Parcial': ['defensivo', 'dreno', 'reducao'],
  'Fúria Vingativa': ['raiva', 'predador', 'dano-direto'],
  'Olhar Mortal': ['medo', 'psiquico', 'percepcao'],
  'Endurecimento Reflexo': ['defensivo'],
  'Substância Viscosa': ['agarrar', 'agua', 'controle'],
  'Resposta Tóxica': ['veneno', 'envenenar', 'contra-ataque'],
  'Distorção Evasiva': ['defensivo', 'mobilidade', 'espacial'],
  'Casulo Instantâneo': ['defensivo', 'regeneracao'],
  'Eco da Agonia': ['morte', 'dreno', 'regeneracao'],
  'Reflexo Espinhoso': ['defensivo', 'dano-direto', 'aracnideo'],
  'Pulso de Pânico': ['medo', 'aura', 'area', 'psiquico'],
  'Maldição de Troca': ['espacial', 'defensivo', 'debuff'],
  // ── Lote 2 de Ações Bônus ───────────────────────────────────────────────────
  'Toque Entorpecente': ['debuff', 'controle'],
  'Marca da Fraqueza': ['debuff'],
  'Olhar Vil': ['medo', 'psiquico'],
  'Jato Cegante': ['cegar', 'cegueira'],
  'Estalo Ensurdecedor': ['som', 'grito', 'atordoar'],
  'Toque Adormecedor': ['debuff', 'controle'],
  'Presas Peçonhentas': ['veneno', 'envenenar', 'predador'],
  'Passo de Névoa': ['mobilidade', 'teleporte', 'defensivo', 'furtividade'],
  'Resina Imobilizante': ['agarrar', 'controle', 'aracnideo'],
  'Vinha Súbita': ['natureza', 'planta', 'agarrar', 'controle'],
  'Pulso Estonteante': ['atordoar', 'controle'],
  'Maldição da Lentidão': ['gravidade', 'controle', 'debuff'],
  'Toque Debilitante': ['debuff', 'dreno'],
  'Lâmina Sangrenta': ['sangrar', 'sangue', 'predador'],
  'Toque Gélido': ['gelo', 'frio'],
  'Toque Flamejante': ['fogo', 'queimar'],
  'Grito de Pavor': ['medo', 'som', 'psiquico'],
  'Tropeço Espectral': ['derrubar', 'controle'],
  'Maldição Silenciadora': ['debuff', 'controle', 'silencio'],
  'Corromper a Mente': ['mente', 'loucura', 'ilusao', 'psiquico'],
  'Garra Trêmula': ['debuff'],
  'Toque Drenante': ['dreno', 'morte', 'dano-direto'],
  'Maldição da Exaustão': ['debuff', 'dot'],
  'Espinhos Súbitos': ['defensivo', 'contra-ataque', 'aracnideo'],
  'Manto de Escuridão': ['escuridao', 'cegueira', 'furtividade'],
  'Salto Esmagador': ['mobilidade', 'derrubar'],
  'Toque Embriagante': ['debuff', 'veneno'],
  'Marca da Morte': ['morte', 'dano-direto', 'emboscada'],
  'Bruma Tóxica': ['veneno', 'envenenar', 'area', 'doenca'],
  'Reflexo Acelerado': ['defensivo', 'mobilidade'],
  'Olhar Confuso': ['mente', 'loucura', 'debuff', 'psiquico'],
  'Sopro Paralisante': ['controle', 'veneno'],
  'Carga Trovejante': ['som', 'atordoar', 'mobilidade'],
  'Faísca Reativa': ['eletrico', 'debuff'],
  'Olhar Imobilizante': ['controle', 'debuff'],
  'Sussurro Desencorajador': ['mente', 'debuff', 'psiquico'],
  'Toque Ácido': ['acido', 'debuff'],
  'Convocar Frieza': ['gelo', 'frio', 'controle'],
  'Aperto Sufocante': ['agarrar', 'afogamento', 'controle'],
  'Investida Cega': ['raiva', 'predador', 'dano-direto'],
  // ── Lote 2 de Reações ───────────────────────────────────────────────────────
  'Contra-Veneno': ['veneno', 'envenenar', 'contra-ataque'],
  'Repelir Sombrio': ['escuridao', 'empurrar', 'derrubar'],
  'Grito Reativo': ['som', 'grito', 'atordoar', 'contra-ataque'],
  'Pele Gélida': ['gelo', 'frio', 'defensivo', 'contra-ataque'],
  'Cinzas Reativas': ['fogo', 'queimar', 'contra-ataque'],
  'Vínculo Doloroso': ['psiquico', 'contra-ataque', 'dano-direto'],
  'Reflexo Cegante': ['cegueira', 'contra-ataque', 'defensivo'],
  'Lamento Reflexo': ['som', 'contra-ataque'],
  'Teia Reativa': ['aracnideo', 'agarrar', 'controle', 'contra-ataque'],
  'Maldição Espinhenta': ['defensivo', 'dano-direto', 'aracnideo', 'sangrar'],
  'Bruma Defensiva': ['defensivo', 'furtividade'],
  'Recuo Tóxico': ['veneno', 'mobilidade', 'defensivo'],
  'Aura de Terror Reflexa': ['medo', 'aura', 'area', 'psiquico'],
  'Lentidão Punitiva': ['debuff', 'controle', 'contra-ataque'],
  'Resposta Atordoante': ['atordoar', 'defensivo', 'contra-ataque'],
  'Drenar ao Ferir': ['dreno', 'defensivo', 'regeneracao'],
  'Maldição da Queda': ['derrubar', 'contra-ataque'],
  'Eco Mental': ['psiquico', 'contra-ataque'],
  'Sopro Reativo': ['defensivo', 'dano-direto'],
  'Explosão Defensiva': ['fogo', 'queimar', 'area', 'contra-ataque'],
  'Permuta Ilusória': ['ilusao', 'defensivo', 'mobilidade', 'espacial'],
  'Olhar Endurecedor': ['controle', 'defensivo', 'contra-ataque'],
  'Resposta Sonora': ['som', 'contra-ataque', 'dano-direto'],
  'Reflexo Apavorante': ['medo', 'psiquico', 'defensivo', 'contra-ataque'],
  'Carapaça Reativa': ['defensivo', 'contra-ataque'],
  'Veneno Borbulhante': ['veneno', 'envenenar', 'aura', 'contra-ataque'],
  'Frieza Punitiva': ['gelo', 'frio', 'controle', 'contra-ataque'],
  'Esporos Reativos': ['natureza', 'controle', 'contra-ataque'],
  'Recuo Instantâneo': ['mobilidade', 'defensivo'],
  'Maldição do Eco': ['energia', 'contra-ataque', 'dreno'],
  'Punir Movimento': ['contra-ataque', 'controle', 'dano-direto'],
  'Casulo de Trevas': ['escuridao', 'defensivo', 'furtividade'],
  'Resposta Ácida': ['acido', 'defensivo', 'contra-ataque'],
  'Grito Final': ['som', 'grito', 'atordoar', 'morte'],
  'Maldição Reativa do Peso': ['gravidade', 'controle', 'contra-ataque'],
  'Reflexo Embriagante': ['debuff', 'veneno', 'contra-ataque'],
  'Espelho Doloroso': ['defensivo', 'espacial', 'debuff'],
  'Aura de Decadência': ['debuff', 'aura', 'morte'],
  'Contra-Olhar': ['cegueira', 'contra-ataque', 'defensivo'],
  'Rejeição Paralisante': ['controle', 'defensivo', 'contra-ataque'],
};

// ── Categorias de medo (origem da maldição) ──────────────────────────────────
// Cada categoria tem um perfil de PESOS-base por tag + arquétipo de atributos
// padrão. Os modelos individuais (npcCurses.js) herdam a base e ajustam.
// arquetipo: 'aleatorio' | 'dominio' | 'robusto' | 'desastre' | 'assassino' | 'suporte'
export const FEAR_CATEGORIES = {
  queda:        { label: 'Queda & Altura',        emoji: '🪂', arquetipo: 'aleatorio', tags: { queda: 60, altura: 60, gravidade: 45, voo: 30, mobilidade: 25, empurrar: 30, derrubar: 30 } },
  fogo:         { label: 'Fogo & Calor',          emoji: '🔥', arquetipo: 'desastre',  tags: { fogo: 70, calor: 55, area: 45, 'dano-direto': 40, dot: 35, queimar: 50, raiva: 25 } },
  gelo:         { label: 'Gelo & Frio',           emoji: '❄️', arquetipo: 'dominio',   tags: { gelo: 65, frio: 60, controle: 40, area: 35, debuff: 30, defensivo: 25 } },
  agua:         { label: 'Água & Afogamento',     emoji: '🌊', arquetipo: 'dominio',   tags: { agua: 65, afogamento: 55, profundeza: 40, agarrar: 35, controle: 35, area: 30 } },
  escuridao:    { label: 'Escuridão & Cegueira',  emoji: '🌑', arquetipo: 'assassino', tags: { escuridao: 70, cegueira: 50, cegar: 45, furtividade: 50, emboscada: 40, medo: 30 } },
  natureza:     { label: 'Natureza & Plantas',    emoji: '🌿', arquetipo: 'dominio',   tags: { natureza: 60, planta: 55, terra: 40, agarrar: 35, dot: 30, veneno: 30, regeneracao: 30 } },
  insetos:      { label: 'Insetos & Aracnídeos',  emoji: '🕷️', arquetipo: 'assassino', tags: { inseto: 65, aracnideo: 55, enxame: 55, veneno: 40, agarrar: 35, prisao: 30, dot: 35 } },
  feras:        { label: 'Feras & Predadores',    emoji: '🐺', arquetipo: 'robusto',   tags: { fera: 60, animal: 55, predador: 60, matilha: 45, 'dano-direto': 45, emboscada: 35 } },
  doenca:       { label: 'Doença & Peste',        emoji: '🦠', arquetipo: 'desastre',  tags: { doenca: 65, podridao: 50, dot: 50, veneno: 40, dreno: 30, aura: 35, debuff: 30 } },
  veneno:       { label: 'Veneno & Ácido',        emoji: '☠️', arquetipo: 'assassino', tags: { veneno: 65, acido: 55, envenenar: 50, dot: 50, 'dano-direto': 30 } },
  sangue:       { label: 'Sangue & Carne',        emoji: '🩸', arquetipo: 'robusto',   tags: { sangue: 60, carne: 55, sangrar: 50, dreno: 45, dot: 40, predador: 35, morte: 30 } },
  morte:        { label: 'Morte & Cadáver',       emoji: '💀', arquetipo: 'dominio',   tags: { morte: 65, cadaver: 50, ossos: 45, dreno: 40, medo: 40, profano: 40 } },
  espaco:       { label: 'Espaço & Vazio',        emoji: '🌀', arquetipo: 'desastre',  tags: { espacial: 70, dimensao: 60, vazio: 50, teleporte: 50, barreira: 35, confinamento: 35 } },
  tempo:        { label: 'Tempo',                 emoji: '⏳', arquetipo: 'suporte',   tags: { tempo: 70, espacial: 35, debuff: 40, controle: 40, barreira: 35, mente: 30 } },
  mente:        { label: 'Mente & Loucura',       emoji: '🧠', arquetipo: 'desastre',  tags: { mente: 60, loucura: 55, psiquico: 60, pesadelo: 50, medo: 50, ilusao: 45, debuff: 40 } },
  som:          { label: 'Som & Grito',           emoji: '🔊', arquetipo: 'desastre',  tags: { som: 65, grito: 55, silencio: 35, area: 40, atordoar: 40, psiquico: 35 } },
  odio:         { label: 'Ódio & Rancor',         emoji: '😡', arquetipo: 'robusto',   tags: { odio: 60, raiva: 55, rancor: 50, vinganca: 45, 'contra-ataque': 45, 'dano-direto': 45 } },
  multidao:     { label: 'Multidão & Solidão',    emoji: '👥', arquetipo: 'suporte',   tags: { multidao: 55, solidao: 45, abandono: 45, matilha: 45, invocacao: 40, medo: 35, debuff: 35 } },
  confinamento: { label: 'Confinamento & Prisão', emoji: '⛓️', arquetipo: 'dominio',   tags: { confinamento: 65, prisao: 60, agarrar: 40, controle: 45, barreira: 40, paralisar: 35 } },
  maquina:      { label: 'Máquina & Metal',       emoji: '⚙️', arquetipo: 'robusto',   tags: { maquina: 60, metal: 55, tecnologia: 45, defensivo: 40, 'dano-direto': 35 } },
  profano:      { label: 'Profano & Religião',    emoji: '🕯️', arquetipo: 'dominio',   tags: { profano: 65, religiao: 40, morte: 35, aura: 35, barreira: 35, medo: 35 } },
  deformidade:  { label: 'Deformidade & Mutação', emoji: '🫀', arquetipo: 'robusto',   tags: { deformidade: 60, mutacao: 50, carne: 40, 'dano-direto': 40, regeneracao: 35 } },
  olhos:        { label: 'Olhos & Vigia',         emoji: '👁️', arquetipo: 'suporte',   tags: { olho: 65, observacao: 60, vigia: 45, paralisar: 40, medo: 40, debuff: 40, psiquico: 35 } },
  velocidade:   { label: 'Velocidade & Perseguição', emoji: '🏃', arquetipo: 'assassino', tags: { velocidade: 60, perseguicao: 55, mobilidade: 55, predador: 40, emboscada: 35, teleporte: 30 } },
  gravidade:    { label: 'Gravidade & Peso',      emoji: '🪨', arquetipo: 'dominio',   tags: { gravidade: 65, peso: 55, terra: 40, empurrar: 40, derrubar: 40, controle: 40, area: 35 } },
  luz:          { label: 'Luz & Exposição',       emoji: '☀️', arquetipo: 'desastre',  tags: { luz: 60, cegar: 45, area: 40, 'dano-direto': 35, debuff: 25 } },
  uncanny:      { label: 'Bonecos & Máscaras',     emoji: '🎭', arquetipo: 'suporte',   tags: { medo: 55, psiquico: 50, ilusao: 50, mente: 45, observacao: 40, paralisar: 35, vigia: 35, debuff: 30 } },
};
export const FEAR_CATEGORY_KEYS = Object.keys(FEAR_CATEGORIES);

// ── Índice nome → grupo/tier (derivado do catálogo) ──────────────────────────
const _NAME_GROUP = (() => {
  const m = {};
  for (const [group, list] of Object.entries(NPC_CATALOG)) {
    for (const e of list) if (e && e.nome && !(e.nome in m)) m[e.nome] = group;
  }
  return m;
})();

/** Grupo do catálogo onde a característica vive (ex.: 'espiritoPoder'). */
export const charGroup = (nome) => _NAME_GROUP[nome] || null;
/** Metadados de tier (andar de poder + slot) da característica. */
export function charTierInfo(nome) {
  const g = charGroup(nome);
  return (g && GROUP_TIER[g]) || GROUP_TIER.aspecto;
}
/** Tags da característica (vazio se não marcada). */
export const charTags = (nome) => CHAR_TAGS[nome] || [];

/** Pesos efetivos de uma maldição = base da categoria + ajustes do modelo. */
export function resolveCurseTags(curse) {
  const cat = (curse && FEAR_CATEGORIES[curse.categoria]) || null;
  return { ...(cat ? cat.tags : {}), ...((curse && curse.tags) || {}) };
}

/**
 * Chance (0–99%) de uma característica cair para uma maldição.
 *   chance = base(tier) + Σ pesos das tags em comum, clampada [0, 99].
 * `pesos` deve ser o objeto já resolvido (resolveCurseTags).
 */
export function dropChance(nome, pesos) {
  const info = charTierInfo(nome);
  let v = info.base;
  for (const t of charTags(nome)) if (pesos[t]) v += pesos[t];
  return Math.max(0, Math.min(99, Math.round(v)));
}
