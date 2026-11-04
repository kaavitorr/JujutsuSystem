/**
 * jj/npc-generator-dialog.mjs
 * Gerador de NPC nativo (Fase 1) — escolhe o ND, gera e cria um ator NPC completo.
 *
 * Usa o gerador portado do livro/bot (systems/npc-generator) para produzir uma
 * "ficha plana" (patch) e mapeia para o ator NPC do sistema (atributos, PV, CA,
 * CR, PA/energia, salvaguardas) + características como itens (feats descritivos).
 */

import Ruleset from "../../../systems/ruleset.mjs";
import { npcClassification, npcClassificationKey } from "../../../systems/legacy2-npc-classification.mjs";
import { npcGeneratorProfiles, npcGeneratorProfile } from "./npc-generator-profiles.mjs";
import { syncNpcProfileFeatures } from "../../../systems/legacy2-npc-features.mjs";
import { syncNpcProfileEquipment } from "../../../systems/legacy2-npc-equipment.mjs";
import { npcAttributeDistribution } from "../../../systems/legacy2-npc-profiles.mjs";
import { npcGeneratorWeaponPicker, activateNpcGeneratorWeapons, prepareNpcGeneratorWeapons } from "./npc-generator-weapons.mjs";
import { activateNpcGeneratorPreviews, npcGeneratorExistencePicker } from "./npc-generator-previews.mjs";
import { npcGeneratorArchetypeAllowed } from "./npc-generator-archetypes.mjs";

// Atributo do bot → atributo do dnd5e/sistema.
const ABILITY_MAP = { forca: "str", agi: "dex", con: "con", int: "int", sab: "wis", pres: "cha" };

const _rint = (n) => Math.floor(Math.random() * n);

// ── Mapeamento patch → dados do ator ────────────────────────────────────────

function _buildActorData(patch) {
  const abilities = {};
  for ( const [bot, dnd] of Object.entries(ABILITY_MAP) ) {
    abilities[dnd] = {
      value: Number(patch[`${bot}_val`]) || 10,
      proficient: patch.saves?.[bot]?.prof ? 1 : 0
    };
  }

  // PV: valor aleatório dentro da faixa do ND (min..max).
  // Boss: cai no terço superior da faixa (≈65%..100%), sempre perto do máximo.
  const hpMin = Number(patch.hp_min) || 1;
  const hpMax = Math.max(hpMin, Number(patch.hp_max) || hpMin);
  const isBoss = Number(patch.boss) === 1 || patch.boss === true;
  const hpFloor = isBoss ? hpMin + Math.round(0.65 * (hpMax - hpMin)) : hpMin;
  const hpVal = hpFloor + _rint(hpMax - hpFloor + 1);

  // Resistências/Imunidades: mapeia tipos de dano (PT) → chaves do sistema; o que
  // não casa vai pra "custom". Imunidade de condição vai em custom (texto livre).
  const _split = (list) => {
    const value = [], custom = [];
    for ( const t of (list || []) ) { const k = _dmgKey(t); if ( k ) value.push(k); else if ( t ) custom.push(t); }
    return { value, custom: custom.join("; ") };
  };
  const dr = _split(patch.resistencias);
  const di = _split(patch.imunidade_dano);
  const ciCustom = (patch.imunidade_cond || []).filter(Boolean).join("; ");

  const traits = {};
  if ( dr.value.length || dr.custom ) traits.dr = { value: dr.value, custom: dr.custom };
  if ( di.value.length || di.custom ) traits.di = { value: di.value, custom: di.custom };
  if ( ciCustom ) traits.ci = { custom: ciCustom };

  const desloc = Number(patch.deslocamento) || 0;

  // Pontos de Armadura (humanoide cujo grau de Energia concede PA): o aspecto
  // "Pontos de Armadura" traz o valor no texto — vira campo real da ficha com a
  // mesma absorção do personagem (damage-application.mjs).
  const aspPA = (patch.aspectos || []).find(a => a.nome === "Pontos de Armadura");
  const paMax = aspPA ? (Number(/(\d+)/.exec(aspPA.descricao || "")?.[1]) || 0) : 0;

  return {
    name: `${patch.emoji ? patch.emoji + " " : ""}${patch.nome}`,
    type: "npc",
    system: {
      abilities,
      attributes: {
        hp: { value: hpVal, max: hpVal },
        ac: { calc: "flat", flat: Number(patch.cr) || 13 },
        ...(desloc ? { movement: { walk: desloc, units: "m" } } : {})
      },
      details: {
        cr: Number(patch.nd) || 1,
        biography: { value: patch.descricao || "" }
      },
      ...(Object.keys(traits).length ? { traits } : {}),
      ...(paMax > 0 ? { armorPoints: { value: paMax, max: paMax } } : {}),
      energy: {
        max:        Number(patch.pa_max) || 0,
        total:      Number(patch.pa_max) || 0,
        generated:  Number(patch.pa_gerada) || 0,
        genPerTurn: Number(patch.pa_gerada) || 3
      }
    }
  };
}

// ── Tipos de dano: PT (gerador) → chave do sistema ──────────────────────────
// O sistema relabela force→"Verdadeiro" e radiant→"Energia". Não há necrótico
// no jogo, então "Necrótico"/"Trevas" são remapeados para tipos existentes.
const DMG_TYPE_MAP = {
  "cortante": "slashing", "perfurante": "piercing", "contundente": "bludgeoning",
  "fogo": "fire", "gelo": "cold", "frio": "cold",
  "elétrico": "lightning", "eletrico": "lightning",
  "ácido": "acid", "acido": "acid", "veneno": "poison",
  "psíquico": "psychic", "psiquico": "psychic",
  "trovejante": "thunder", "som": "thunder",
  "radiante": "radiant", "energia": "radiant",
  "verdadeiro": "force",
  // sem equivalente próprio → remapeados (sem necrótico)
  "necrótico": "poison", "necrotico": "poison", "trevas": "psychic"
};
function _dmgKey(tipo) {
  const k = DMG_TYPE_MAP[String(tipo || "").toLowerCase().trim()];
  // valida contra os tipos realmente presentes no sistema; senão, sem tipo
  if ( k && (!globalThis.CONFIG?.DND5E?.damageTypes || CONFIG.DND5E.damageTypes[k]) ) return k;
  return "";
}

/** "3d6" / "2d8+5" / "2d10 +5 +1d4 +3d4" / "10" → { dice: [{number, denomination}…],
 *  bonus } (ou null). Aceita VÁRIOS grupos de dados: ataques de humanoide somam
 *  o +1d4 do estilo e o +Nd4 do grau de Energia Amaldiçoada na mesma fórmula. */
function _parseFormula(f) {
  const s = String(f || "").replace(/\s+/g, "");
  if ( !s ) return null;
  const tokens = s.match(/[+-]?(?:\d*d\d+|\d+)/gi);
  if ( !tokens || tokens.join("") !== s ) return null; // tem algo além de dados/bônus
  const dice = [];
  let bonus = 0;
  for ( const t of tokens ) {
    const sign = t[0] === "-" ? -1 : 1;
    const body = t.replace(/^[+-]/, "");
    const m = body.match(/^(\d*)d(\d+)$/i);
    if ( m ) {
      const n = (m[1] ? Number(m[1]) : 1) * sign;
      if ( n <= 0 ) return null; // dado negativo não rola
      dice.push({ number: n, denomination: Number(m[2]) });
    } else bonus += sign * Number(body);
  }
  return { dice, bonus: bonus ? String(bonus) : "" };
}
/** Partes de dano (schema DamageField aceita 1 dado por parte): 1 parte por grupo
 *  de dados, bônus fixo anexado à primeira; fórmula só de bônus vira parte sem dados. */
function _damageParts(formula, tipo) {
  const p = _parseFormula(formula);
  if ( !p ) return null;
  const key = _dmgKey(tipo);
  const types = key ? [key] : [];
  if ( !p.dice.length ) return p.bonus ? [{ types, bonus: p.bonus }] : null;
  return p.dice.map((d, i) => {
    const part = { types, number: d.number, denomination: d.denomination };
    if ( i === 0 && p.bonus ) part.bonus = p.bonus;
    return part;
  });
}
const _rangeM = (alcanceM) => ({ value: String(Number(alcanceM) || 1.5), units: "m" });
const _newId = () => foundry.utils.randomID();

/** Atividade (save / damage / heal) de uma habilidade, conforme os campos derivados. */
function _abilityActivities(h, cd) {
  const id = _newId();
  const range = _rangeM(h.alcanceM);
  if ( h.save ) {
    const parts = _damageParts(h.dano, h.tipo);
    return { [id]: {
      _id: id, type: "save", name: h.nome, range,
      save: { ability: [ABILITY_MAP[h.save] || "con"], dc: { calculation: "", formula: String(cd || 10) } },
      damage: { onSave: "half", parts: parts || [] }
    } };
  }
  if ( h.dano ) {
    const parts = _damageParts(h.dano, h.tipo);
    return { [id]: { _id: id, type: "damage", name: h.nome, range, damage: { parts: parts || [] } } };
  }
  if ( h.cura ) {
    const parts = _damageParts(h.cura, null);
    // Só cria a atividade de cura se a fórmula realmente fizer parse (evita cura no-op).
    if ( parts?.length ) return { [id]: { _id: id, type: "heal", name: h.nome, range, healing: { ...parts[0], types: ["healing"] } } };
  }
  return null;
}

// ── Derivação de mecânica a partir da descrição ("regras" no texto) ──────────
// Fallback para habilidades/ações que vêm só com texto (ex.: traços de forma
// animal): extrai Salvaguarda, dano e alcance da descrição para configurar a atividade.
const _SAVE_NAME = {
  "força": "forca", "forca": "forca", "agilidade": "agi",
  "constituição": "con", "constituicao": "con",
  "inteligência": "int", "inteligencia": "int", "espírito": "int", "espirito": "int",
  "sabedoria": "sab", "presença": "pres", "presenca": "pres"
};
function _deriveFromDesc(desc) {
  const s = String(desc || "");
  const out = {};
  const mSave = s.match(/Salvaguarda de ([A-Za-zÀ-ÿ]+)/i);
  if ( mSave ) { const k = _SAVE_NAME[mSave[1].toLowerCase()]; if ( k ) out.save = k; }
  const mDano = s.match(/(\d+d\d+(?:\s*\+\s*\d+)?)\s*(?:de\s+)?dano(?:\s+([A-Za-zÀ-ÿ]+))?/i);
  if ( mDano ) { out.dano = mDano[1].replace(/\s+/g, ""); if ( mDano[2] && _dmgKey(mDano[2]) ) out.tipo = mDano[2]; }
  const mAlc = s.match(/(\d+(?:[.,]\d+)?)\s*(?:\/\s*\d+)?\s*m\b/);
  if ( mAlc ) out.alcanceM = Number(mAlc[1].replace(",", "."));
  return out;
}
/** Preenche campos mecânicos ausentes (save/dano/tipo/alcance) a partir da descrição. */
function _withDerived(h) {
  const der = _deriveFromDesc(h.desc);
  const out = { ...h };
  for ( const k of ["save", "dano", "tipo", "alcanceM", "cura"] ) {
    if ( (out[k] == null || out[k] === "") && der[k] != null ) out[k] = der[k];
  }
  return out;
}

/** Atividade de ataque (acerto fixo + dano). */
function _attackActivities(a) {
  const id = _newId();
  const parts = _damageParts(a.dano, a.tipo);
  const ranged = a.alcanceTipo === "ranged";
  return { [id]: {
    _id: id, type: "attack", name: a.nome, range: _rangeM(a.alcanceM),
    attack: {
      ability: "", flat: true, bonus: String(a.acerto ?? 0),
      critical: { threshold: a.critRange || 20 },
      type: { value: ranged ? "ranged" : "melee", classification: "weapon" }
    },
    damage: { includeBase: false, parts: parts || [] }
  } };
}

// ── Itens (feats com atividade configurada) ──────────────────────────────────

function _featItem(name, descHtml, activationType, img, activities) {
  const system = {
    description: { value: descHtml || "" },
    type: { value: "monster" },
    activation: activationType ? { type: activationType, value: null } : { type: "" }
  };
  if ( activities && Object.keys(activities).length ) system.activities = activities;
  return { name: name || "Característica", type: "feat", img: img || "icons/svg/aura.svg", system };
}

function _abilityDescHtml(h) {
  let s = h.desc ? `<p>${h.desc}</p>` : "";
  const parts = [];
  const custo = h.custoTxt || (Number(h.custoPA) > 0 ? `${h.custoPA} PA` : "");
  if ( custo ) parts.push(`<strong>Custo:</strong> ${custo}`);
  if ( h.dano ) parts.push(`<strong>Dano:</strong> ${h.dano}${h.tipo ? " " + h.tipo : ""}`);
  if ( h.cura ) parts.push(`<strong>Cura:</strong> ${h.cura}`);
  if ( h.save ) parts.push(`<strong>Salvaguarda:</strong> ${String(h.save).toUpperCase()}`);
  if ( h.condicao ) parts.push(`<strong>Condição:</strong> ${h.condicao}`);
  if ( h.alcanceM ) parts.push(`<strong>Alcance/Raio:</strong> ${h.alcanceM}m`);
  if ( h.recarga ) parts.push(`<strong>Recarga:</strong> ${h.recarga}`);
  if ( parts.length ) s += `<p>${parts.join(" &bull; ")}</p>`;
  return s;
}

function _attackDescHtml(a) {
  return `<p><strong>Ataque:</strong> ${a.acerto >= 0 ? "+" : ""}${a.acerto} para acertar &bull; alcance ${a.alcanceM}m &bull; crítico ${a.critRange}-20.</p>`
    + `<p><strong>Dano:</strong> ${a.dano}${a.tipo ? " " + a.tipo : ""}.</p>`
    + (a.desc ? `<p><em>${a.desc}</em></p>` : "");
}

function _buildItems(patch) {
  const items = [];
  const cd = patch.cd;
  // Classe (humanoide): grants qualitativos do grau de Energia Amaldiçoada.
  if ( patch.classe?.nome ) {
    const lis = (patch.classe.itens || []).map(t => `<li>${t}</li>`).join("");
    const html = lis ? `<ul>${lis}</ul>` : "";
    items.push(_featItem(`🎓 ${patch.classe.nome}`, html, "", "icons/svg/upgrade.svg"));
  }
  // Origem de Poder (humanoide).
  if ( patch.origem_poder ) {
    items.push(_featItem(`🩸 Origem de Poder: ${patch.origem_poder}`, "", "", "icons/svg/blood.svg"));
  }
  // Ataques (ação) — com atividade de ataque configurada
  for ( const a of (patch.ataques || []) ) {
    items.push(_featItem(`⚔️ ${a.nome}`, _attackDescHtml(a), "action", "icons/svg/sword.svg", _attackActivities(a)));
  }
  // Ações Comuns (traços de forma animal / da maldição) — deriva mecânica do texto.
  for ( const h of (patch.acoes_comuns || []) ) {
    const hh = _withDerived(h);
    items.push(_featItem(`✦ ${hh.nome}`, _abilityDescHtml(hh), "action", "icons/svg/pawprint.svg", _abilityActivities(hh, cd)));
  }
  // Aspectos (passivos — sem atividade)
  for ( const asp of (patch.aspectos || []) ) {
    items.push(_featItem(asp.nome, asp.descricao || "", "", "icons/svg/aura.svg"));
  }
  // Habilidades — com atividade (save/damage/heal); campos ausentes derivados da descrição.
  for ( const h of (patch.hab_poder || []) )  { const hh = _withDerived(h); items.push(_featItem(`✦ ${hh.nome}`, _abilityDescHtml(hh), "action",   "icons/svg/explosion.svg", _abilityActivities(hh, cd))); }
  for ( const h of (patch.hab_bonus || []) )  { const hh = _withDerived(h); items.push(_featItem(`✦ ${hh.nome}`, _abilityDescHtml(hh), "bonus",    "icons/svg/up.svg",        _abilityActivities(hh, cd))); }
  for ( const h of (patch.hab_reacao || []) ) { const hh = _withDerived(h); items.push(_featItem(`✦ ${hh.nome}`, _abilityDescHtml(hh), "reaction", "icons/svg/shield.svg",    _abilityActivities(hh, cd))); }
  return items;
}

/**
 * Cria o ator NPC a partir do patch gerado e abre a ficha.
 * @param {object} patch
 * @returns {Promise<Actor|null>}
 */
export async function createNpcFromPatch(patch) {
  if ( !patch ) return null;
  let actor;
  try {
    actor = await Actor.implementation.create(_buildActorData(patch));
  } catch(err) {
    console.error("JujutsuLegacy | Erro ao criar NPC gerado:", err);
    ui.notifications.error("Falha ao criar o NPC gerado (veja o console).");
    return null;
  }
  const items = _buildItems(patch);
  if ( items.length ) {
    try {
      // Caminho rápido: cria tudo de uma vez
      await actor.createEmbeddedDocuments("Item", items);
    } catch(err) {
      // Fallback robusto: cria item a item para que um item ruim não derrube os demais
      console.warn("JujutsuLegacy | Lote de itens do NPC falhou; criando individualmente.", err);
      for ( const it of items ) {
        try { await actor.createEmbeddedDocuments("Item", [it]); }
        catch(e) { console.error(`JujutsuLegacy | Característica "${it.name}" falhou e foi ignorada:`, e); }
      }
    }
  }
  ui.notifications.info(`NPC gerado: ${actor.name}`);
  actor.sheet?.render(true);
  return actor;
}

// ── Diálogo (Fase 1: escolher ND → Gerar) ────────────────────────────────────

/**
 * Abre o diálogo do gerador de NPC.
 */
export async function openNpcGenerator() {
  if ( !game.user.isGM ) {
    ui.notifications.warn("Apenas o GM pode gerar NPCs.");
    return;
  }
  const version = await foundry.applications.api.DialogV2.wait({
    window: { title: "Gerar NPC" },
    content: `<div class="form-group stacked">
      <label for="jj-npcgen-version">Versão do gerador</label>
      <select id="jj-npcgen-version" name="version">
        <option value="1.0"${!Ruleset.isV2() ? " selected" : ""}>1.0 — Modelo antigo</option>
        <option value="2.0"${Ruleset.isV2() ? " selected" : ""}>2.0 — Taxonomias e Arquétipos</option>
      </select>
      <p class="hint">Escolha o modelo de criação do NPC.</p>
    </div>`,
    buttons: [
      { action: "continue", label: "Continuar", default: true,
        callback: (_event, button) => button.form.elements.version.value },
      { action: "cancel", label: "Cancelar", callback: () => null }
    ],
    rejectClose: false
  });
  if (version === "1.0") return openNpcGenerator1();
  if (version === "2.0") return openNpcGenerator2();
}

/** The classic generator remains available independently of the world's rules setting. */
export async function openNpcGenerator1() {
  if (!game.user.isGM) return;

  const [{ gerarNpc, ARQ_LABELS }, { ND_TABLE }, { ESTILOS_HUMANO, GRAUS_CE, MANIPULACOES_LISTA }, { ORIGENS_NPC }] = await Promise.all([
    import("../../../systems/npc-generator/npcGenerator.mjs"),
    import("../../../systems/npc-generator/nd-table.mjs"),
    import("../../../systems/npc-generator/npcHumanoideCalibrado.mjs"),
    import("../../../systems/npc-generator/npcData.mjs")
  ]);

  const opts = (pairs, sel) => pairs.map(([v, l]) => `<option value="${v}" ${v === sel ? "selected" : ""}>${l}</option>`).join("");
  const ndOptions  = ND_TABLE.map(r => `<option value="${r.ndNum}" ${r.ndNum === 5 ? "selected" : ""}>ND ${r.nd}</option>`).join("");
  const arqOptions = opts(Object.entries(ARQ_LABELS), "aleatorio");
  const estOptions = opts(ESTILOS_HUMANO, "aleatorio");
  const grauOptions = opts(GRAUS_CE, "");
  const origemOptions = `<option value="">— nenhuma —</option>` + opts(ORIGENS_NPC.map(o => [o, o]), "");
  const manipChecks = MANIPULACOES_LISTA
    .map(m => `<label class="jj-npcgen-manip-row" title="${(m.desc || "").replace(/"/g, "&quot;")}" style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" class="jj-npcgen-manip" value="${m.nome}" style="flex:0 0 auto; width:auto; margin:0;"><span>${m.nome}${m.ndMin ? ` (ND ${m.ndMin}+)` : ""}</span></label>`).join("");
  const rowCss = "display:flex; align-items:center; gap:8px; margin-bottom:8px;";
  const lblCss = "flex:0 0 150px;";

  const cfg = await foundry.applications.api.DialogV2.wait({
    window: { title: "Gerador de NPC 1.0" },
    content: `
      <div style="padding:8px 0; font-size:13px; color:#ccc; line-height:1.6;">
        <div style="${rowCss}">
          <label style="${lblCss}">Tipo de NPC:</label>
          <select id="jj-npcgen-tipo" style="flex:1 1 auto;">
            <option value="maldicao" selected>Maldição (Espírito)</option>
            <option value="humano">Humano (Feiticeiro)</option>
          </select>
        </div>
        <div style="${rowCss}">
          <label style="${lblCss}">Nível de Desafio (ND):</label>
          <select id="jj-npcgen-nd" style="flex:1 1 auto;">${ndOptions}</select>
        </div>

        <div class="jj-npcgen-mald">
          <div style="${rowCss}">
            <label style="${lblCss}">Arquétipo:</label>
            <select id="jj-npcgen-arq" style="flex:1 1 auto;">${arqOptions}</select>
          </div>
        </div>

        <div class="jj-npcgen-hum" style="display:none;">
          <div style="${rowCss}">
            <label style="${lblCss}">Estilo de combate:</label>
            <select id="jj-npcgen-estilo" style="flex:1 1 auto;">${estOptions}</select>
          </div>
          <div class="jj-npcgen-lutfoco" style="${rowCss} display:none;">
            <label style="${lblCss}">Foco do Lutador:</label>
            <select id="jj-npcgen-lutfoco" style="flex:1 1 auto;">
              <option value="forca">Força</option><option value="agi">Agilidade</option>
            </select>
          </div>
          <div style="${rowCss}">
            <label style="${lblCss}">Grau de Energia:</label>
            <select id="jj-npcgen-grau" style="flex:1 1 auto;">${grauOptions}</select>
          </div>
          <div style="${rowCss}">
            <label style="${lblCss}">Origem de Poder:</label>
            <select id="jj-npcgen-origem" style="flex:1 1 auto;">${origemOptions}</select>
          </div>
          <div style="${rowCss} align-items:flex-start;">
            <label style="${lblCss}">Manipulações:</label>
            <div id="jj-npcgen-manip-box" style="flex:1 1 auto; max-height:150px; overflow-y:auto; border:1px solid #3a3a4a; border-radius:4px; padding:6px 8px; display:flex; flex-direction:column; gap:5px;">${manipChecks}</div>
          </div>
          <p style="margin:-2px 0 8px; font-size:11px; color:#999;">Marque quantas quiser (opcional).</p>
        </div>

        <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
          <input type="checkbox" id="jj-npcgen-boss" style="flex:0 0 auto; width:auto;">
          <span><strong>Boss</strong> — mais poderoso (mais atributos, CR/ataque maiores, dano por rodada <strong>dobrado</strong>).</span>
        </label>
      </div>`,
    render: (event, dialog) => {
      const root = dialog.element;
      const tipo = root.querySelector("#jj-npcgen-tipo");
      const mald = root.querySelector(".jj-npcgen-mald");
      const hum  = root.querySelector(".jj-npcgen-hum");
      const estilo = root.querySelector("#jj-npcgen-estilo");
      const lutRow = root.querySelector(".jj-npcgen-lutfoco");
      const sync = () => {
        const isHum = tipo.value === "humano";
        mald.style.display = isHum ? "none" : "";
        hum.style.display  = isHum ? "" : "none";
        lutRow.style.display = (isHum && estilo.value === "Lutador") ? "flex" : "none";
      };
      tipo.addEventListener("change", sync);
      estilo.addEventListener("change", sync);
      sync();
    },
    buttons: [
      {
        label: "Gerar NPC",
        action: "ok",
        default: true,
        callback: (event, button, dialog) => {
          const root = dialog.element ?? document;
          const manip = [...root.querySelectorAll("input.jj-npcgen-manip:checked")].map(c => c.value);
          return {
            tipo: root.querySelector("#jj-npcgen-tipo")?.value || "maldicao",
            nd: Number(root.querySelector("#jj-npcgen-nd")?.value ?? 5),
            arquetipo: root.querySelector("#jj-npcgen-arq")?.value || "aleatorio",
            estilo: root.querySelector("#jj-npcgen-estilo")?.value || "aleatorio",
            lutFoco: root.querySelector("#jj-npcgen-lutfoco")?.value || "forca",
            grauCE: root.querySelector("#jj-npcgen-grau")?.value || "",
            origem: root.querySelector("#jj-npcgen-origem")?.value || "",
            manipulacoes: manip,
            boss: !!root.querySelector("#jj-npcgen-boss")?.checked
          };
        }
      },
      { label: "Cancelar", action: "cancel", callback: () => null }
    ],
    rejectClose: false,
    close: () => null
  });

  if ( !cfg ) return;

  const patch = gerarNpc({
    nd: Number(cfg.nd), tipo: cfg.tipo, ndTable: ND_TABLE, boss: cfg.boss,
    arquetipo: cfg.arquetipo,
    estilo: cfg.estilo, lutFoco: cfg.lutFoco, grauCE: cfg.grauCE,
    origem: cfg.origem, manipulacoes: cfg.manipulacoes
  });
  if ( !patch ) {
    ui.notifications.error("Não foi possível gerar o NPC (ND inválido?).");
    return;
  }
  await createNpcFromPatch(patch);
}

// ── Botão na barra de Atores ─────────────────────────────────────────────────
Hooks.on("renderActorDirectory", (app, html) => {
  installNpcGeneratorButton(html);
});

/** Insert a separate, non-growing row before search without rebuilding native directory nodes. */
export function installNpcGeneratorButton(html) {
  if ( !game.user.isGM ) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  if ( !root || root.querySelector(".jj-npc-gen-btn") ) return;
  const header = root.querySelector(".directory-header");
  if ( !header ) return;
  const actions = header.querySelector(".header-actions");
  const row = document.createElement("div");
  row.className = "jj-npc-generator-actions";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "jj-npc-gen-btn";
  btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 20v-4a8 8 0 1 1 8 0v4zM10 20v-3m4 3v-3"/><circle cx="9" cy="10" r="1.5"/><circle cx="15" cy="10" r="1.5"/><path d="m11 14 1-2 1 2"/></svg><span>Gerar NPC</span>`;
  btn.addEventListener("click", () => openNpcGenerator());
  row.appendChild(btn);
  if (actions) actions.insertAdjacentElement("afterend", row);
  else header.prepend(row);
}


// ═══════════════════════ GERADOR 2.0 (estilo Crucible) ═══════════════════════

const ND_OPTIONS_2 = Array.from({ length: 30 }, (_, i) => i + 1);

/**
 * Cria um NPC 2.0 com cópias dos perfis, suas características por ND e seus equipamentos.
 * Armas selecionadas são cópias independentes dos itens reais do catálogo.
 */
export async function createNpc2({ nome, taxonomia, arquetipo, nd, categoria = "normal", armas = [], talentos = "" } = {}) {
  if (!game.user.isGM) return null;
  const [tax, arq] = await Promise.all([
    npcGeneratorProfile("taxonomy", taxonomia), npcGeneratorProfile("archetype", arquetipo)
  ]);
  nd = Number(nd);
  if (!tax || !arq || !Number.isInteger(nd) || nd < 1 || nd > 30) {
    ui.notifications.warn("Selecione uma Taxonomia, um Arquétipo e um ND válido (1 a 30).");
    return null;
  }
  if (!npcGeneratorArchetypeAllowed(tax.data ?? tax, arq.data ?? arq)) {
    ui.notifications.warn("Esse Arquétipo não está disponível para a Taxonomia escolhida. Selecione um Arquétipo específico dela ou um geral.");
    return null;
  }
  categoria = npcClassificationKey(categoria);
  const classification = npcClassification({ system: { legacy2: { categoria } } });
  let weapons;
  try { weapons = await prepareNpcGeneratorWeapons(armas); }
  catch (error) {
    ui.notifications.warn(error.message);
    return null;
  }

  const items = [tax.data, arq.data, ...weapons].filter(Boolean).concat(talentos.split(",").map(s => s.trim()).filter(Boolean).map(nomeT => ({
    type: "feat",
    name: nomeT,
    img: "icons/svg/item-bag.svg"
  })));
  const legacy2 = {
    taxonomia: tax.key ?? null,
    arquetipo: arq.key ?? null,
    nd: String(nd),
    categoria,
    actions: { max: classification.actions, value: classification.actions },
    armas: { natural: 1 }
  };
  // Author a usable snapshot too: the 1.0 world's preparation does not derive 2.0 profiles.
  const values = npcAttributeDistribution({ type: "npc", items, system: { legacy2 } }).values;
  const hp = Math.max(1, Math.round((10 * nd + 15 * values.con) * classification.hpMultiplier));
  const energyMax = (tax.data?.system?.vidaEnergia ?? CONFIG.JUJUTSU.taxonomias?.[tax.key]?.vidaEnergia) ? hp : 30 * nd;

  let actor;
  try {
    actor = await Actor.implementation.create({
      name: nome?.trim() || `${arq.label} ${tax.label}`,
      type: "npc",
      system: {
        abilities: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { value }])),
        attributes: { hp: { value: hp, max: hp } },
        details: { cr: nd },
        legacy2,
        energy: { max: energyMax, total: energyMax, generated: 0 }
      },
      items
    });
    if (!actor) return null;
    await syncNpcProfileFeatures(actor, { rulesetVersion: "2.0" });
    await syncNpcProfileEquipment(actor, { rulesetVersion: "2.0" });
    await actor.update({
      "system.attributes.hp.value": actor.system.attributes.hp.max,
      "system.energy.total": actor.system.energy.max
    });
  } catch ( err ) {
    console.error("JujutsuLegacy 2.0 | Erro ao criar NPC:", err);
    ui.notifications.error("Falha ao criar o NPC 2.0 (veja o console).");
    return null;
  }
  ui.notifications.info(`NPC 2.0 gerado: ${actor.name}`);
  actor.sheet?.render(true);
  return actor;
}

/**
 * Diálogo do gerador 2.0: Taxonomia, Arquétipo, ND, classificação e catálogo de armas.
 */
export async function openNpcGenerator2() {
  if (!game.user.isGM) return;
  const profiles = await npcGeneratorProfiles();
  const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const options = type => [...new Set(profiles[type].map(entry => entry.group))].map(group =>
    `<optgroup label="${escape(group)}">${profiles[type].filter(entry => entry.group === group)
      .map(entry => `<option value="${escape(entry.value)}">${escape(entry.label)}</option>`).join("")}</optgroup>`).join("");
  const taxOptions = options("taxonomy"), arqOptions = options("archetype");
  const ndOptions = ND_OPTIONS_2.map(n => `<option value="${n}"${n === 1 ? " selected" : ""}>${n}</option>`).join("");

  const cfg = await foundry.applications.api.DialogV2.wait({
    window: { title: "Gerador de PdN 2.0" },
    classes: ["jj-npc-generator-dialog"],
    position: { width: 1032 },
    content: `
      <div class="jj-npcgen-layout">
        <header class="jj-npcgen-banner">
          <span class="jj-npcgen-sigil" data-generator-icon aria-hidden="true"></span>
          <div><h2>Criar PdN</h2><p>Defina a criatura. Escolha como ela luta.</p></div>
          <span class="jj-npcgen-edition">Regras <strong>2.0</strong></span>
        </header>
        <div class="jj-npcgen-workspace">
          <section class="jj-npcgen-profile" aria-label="Perfil da criatura">
            <div class="jj-npcgen-profile-fields">
              <div class="jj-npcgen-identity">
                <label class="jj-npcgen-field"><span>Nome <small>opcional</small></span><input type="text" name="nome" placeholder="Definido pelo perfil"></label>
                <label class="jj-npcgen-nd" title="Nível de Desafio"><span>ND</span><select name="nd" aria-label="Nível de Desafio">${ndOptions}</select></label>
              </div>
              <label class="jj-npcgen-field jj-npcgen-profile-field"><span>Taxonomia</span><span class="jj-npcgen-profile-choice"><img data-profile-preview="taxonomy" src="icons/svg/pawprint.svg" alt="" width="76" height="76"><select name="taxonomia">${taxOptions}</select></span></label>
              <label class="jj-npcgen-field jj-npcgen-profile-field"><span>Arquétipo</span><span class="jj-npcgen-profile-choice"><img data-profile-preview="archetype" src="icons/svg/sword.svg" alt="" width="76" height="76"><select name="arquetipo">${arqOptions}</select></span></label>
              ${npcGeneratorExistencePicker()}
            </div>
          </section>
          ${npcGeneratorWeaponPicker(profiles.weapon)}
        </div>
      </div>`,
    render: (_event, dialog) => {
      activateNpcGeneratorWeapons(dialog.element);
      activateNpcGeneratorPreviews(dialog.element, profiles);
    },
    buttons: [
      {
        label: "Criar PdN", action: "ok", default: true,
        callback: (event, button, dialog) => {
          const f = button.form.elements;
          return {
            nome: f.nome?.value,
            taxonomia: f.taxonomia?.value,
            arquetipo: f.arquetipo?.value,
            nd: Number(f.nd?.value ?? 1),
            categoria: f.categoria?.value ?? "normal",
            armas: Array.from(button.form.querySelectorAll('input[name="npcWeapons"]:checked'), input => input.value)
          };
        }
      },
      { label: "Cancelar", action: "cancel", callback: () => null }
    ],
    rejectClose: false,
    close: () => null
  });
  if ( cfg ) await createNpc2(cfg);
}
