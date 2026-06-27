/**
 * jj/npc-generator-dialog.mjs
 * Gerador de NPC nativo (Fase 1) — escolhe o ND, gera e cria um ator NPC completo.
 *
 * Usa o gerador portado do livro/bot (systems/npc-generator) para produzir uma
 * "ficha plana" (patch) e mapeia para o ator NPC do sistema (atributos, PV, CA,
 * CR, PA/energia, salvaguardas) + características como itens (feats descritivos).
 */

import { gerarNpc, ARQ_LABELS } from "../../../systems/npc-generator/npcGenerator.mjs";
import { ND_TABLE } from "../../../systems/npc-generator/nd-table.mjs";
import { ESTILOS_HUMANO, GRAUS_CE, MANIPULACOES_LISTA } from "../../../systems/npc-generator/npcHumanoideCalibrado.mjs";
import { ORIGENS_NPC } from "../../../systems/npc-generator/npcData.mjs";

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

/** "3d6" / "2d8+5" / "10" → { number, denomination, bonus } (ou null). */
function _parseFormula(f) {
  const s = String(f || "").trim();
  const m = s.match(/^(\d*)d(\d+)\s*(?:\+\s*(\d+))?$/i);
  if ( m ) return { number: m[1] ? Number(m[1]) : 1, denomination: Number(m[2]), bonus: m[3] ? String(m[3]) : "" };
  if ( /^\d+$/.test(s) ) return { number: null, denomination: null, bonus: s };
  return null;
}
function _damagePart(formula, tipo) {
  const p = _parseFormula(formula);
  if ( !p ) return null;
  const key = _dmgKey(tipo);
  const part = { types: key ? [key] : [] };
  if ( p.number != null ) { part.number = p.number; part.denomination = p.denomination; }
  if ( p.bonus ) part.bonus = p.bonus;
  return part;
}
const _rangeM = (alcanceM) => ({ value: String(Number(alcanceM) || 1.5), units: "m" });
const _newId = () => foundry.utils.randomID();

/** Atividade (save / damage / heal) de uma habilidade, conforme os campos derivados. */
function _abilityActivities(h, cd) {
  const id = _newId();
  const range = _rangeM(h.alcanceM);
  if ( h.save ) {
    const part = _damagePart(h.dano, h.tipo);
    return { [id]: {
      _id: id, type: "save", name: h.nome, range,
      save: { ability: [ABILITY_MAP[h.save] || "con"], dc: { calculation: "", formula: String(cd || 10) } },
      damage: { onSave: "half", parts: part ? [part] : [] }
    } };
  }
  if ( h.dano ) {
    const part = _damagePart(h.dano, h.tipo);
    return { [id]: { _id: id, type: "damage", name: h.nome, range, damage: { parts: part ? [part] : [] } } };
  }
  if ( h.cura ) {
    const part = _damagePart(h.cura, null);
    // Só cria a atividade de cura se a fórmula realmente fizer parse (evita cura no-op).
    if ( part ) return { [id]: { _id: id, type: "heal", name: h.nome, range, healing: { ...part, types: ["healing"] } } };
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
  const part = _damagePart(a.dano, a.tipo);
  const ranged = a.alcanceTipo === "ranged";
  return { [id]: {
    _id: id, type: "attack", name: a.nome, range: _rangeM(a.alcanceM),
    attack: {
      ability: "", flat: true, bonus: String(a.acerto ?? 0),
      critical: { threshold: a.critRange || 20 },
      type: { value: ranged ? "ranged" : "melee", classification: "weapon" }
    },
    damage: { includeBase: false, parts: part ? [part] : [] }
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
    window: { title: "💀 Gerador de NPC" },
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
          <span><strong>💀 Boss</strong> — mais poderoso (mais atributos, CR/ataque maiores, dano por rodada <strong>dobrado</strong>).</span>
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
  if ( !game.user.isGM ) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  if ( !root || root.querySelector(".jj-npc-gen-btn") ) return;
  const header = root.querySelector(".header-actions") ?? root.querySelector(".directory-header");
  if ( !header ) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "jj-npc-gen-btn";
  btn.innerHTML = `<i class="fas fa-skull" inert></i> Gerar NPC`;
  btn.addEventListener("click", () => openNpcGenerator());
  header.appendChild(btn);
});
