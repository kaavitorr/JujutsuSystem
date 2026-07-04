/**
 * jj/combat-sacrifice-hud.mjs
 * HUD flutuante de combate (por jogador) com 3 sacrifícios de ação por Energia.
 *
 * Aparece quando a batalha começa, mostrando o personagem do jogador. Três
 * botões sacrificam parte da economia de ações em troca de Energia Gerada:
 *   • Ação        → +Nível de Energia Gerada
 *   • Ação Bônus  → +2 de Energia Gerada
 *   • Reação      → +2 de Energia Gerada
 * Ao clicar, o botão fica cinza (desabilitado) até o INÍCIO do próximo turno do
 * personagem, quando todos os botões são reabilitados. O HUD pode ser arrastado
 * livremente; a posição é salva por usuário.
 */
import { EnergySystem } from "../../../systems/energy.mjs";
import { getActorUpkeeps, deactivateUpkeep } from "./constant-cost.mjs";

const SCOPE = "jujutsu-system";
const FLAG_SAC = "sacrificios";       // flag no ATOR: { action, bonus, reaction }
const FLAG_POS = "sacrificeHudPos";   // flag no USUÁRIO: { left, top }
const FLAG_RES = "customResources";   // flag no ATOR: [{ id, name, current, max }]

const SACS = [
  { key: "action",   label: "Ação",       icon: "fa-circle-dot" },
  { key: "bonus",    label: "Ação Bônus", icon: "fa-bolt" },
  { key: "reaction", label: "Reação",     icon: "fa-reply" },
];

let hudEl = null;
let hudActorId = null;

/* -------------------------------------------- */
/*  Estilos (injetados via JS — não dependem do system.json/restart) */
/* -------------------------------------------- */

const STYLE_ID = "jj-sacrifice-hud-styles";
const CSS_TEXT = `
#jj-sacrifice-hud {
  position: fixed; z-index: 60; width: 228px;
  display: flex; flex-direction: column; gap: 6px; padding: 8px;
  border: 1px solid #3a2a6a; border-radius: 10px;
  background: linear-gradient(135deg, #0e0e22 0%, #130d20 100%);
  box-shadow: 0 4px 18px rgba(0,0,0,.55), 0 0 14px rgba(100,60,200,.25), inset 0 1px 0 rgba(120,80,255,.12);
  font-family: var(--dnd5e-font-roboto, sans-serif); user-select: none;
}
#jj-sacrifice-hud .jj-sac-header {
  display: flex; align-items: center; gap: 6px; padding: 2px 4px 6px;
  border-bottom: 1px solid rgba(100,60,200,.25); cursor: grab; color: #c0a8ff;
}
#jj-sacrifice-hud .jj-sac-header:active { cursor: grabbing; }
#jj-sacrifice-hud .jj-sac-header i { font-size: 12px; opacity: .9; }
#jj-sacrifice-hud .jj-sac-title { font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
#jj-sacrifice-hud .jj-sac-body { display: flex; flex-direction: column; gap: 5px; }
#jj-sacrifice-hud .jj-sac-btn {
  display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 9px;
  border: 1px solid #4a3080; border-radius: 7px; background: rgba(80,50,160,.22);
  color: #d8ccff; font-size: 12px; font-weight: 600; line-height: 1; cursor: pointer;
  transition: background .12s ease, border-color .12s ease, transform .06s ease;
}
#jj-sacrifice-hud .jj-sac-btn i { font-size: 12px; width: 14px; text-align: center; color: #b79bff; }
#jj-sacrifice-hud .jj-sac-btn .jj-sac-lbl { flex: 1 1 auto; text-align: left; }
#jj-sacrifice-hud .jj-sac-btn .jj-sac-gain { flex: 0 0 auto; font-weight: 700; color: #9be29b; text-shadow: 0 0 6px rgba(120,220,120,.4); }
#jj-sacrifice-hud .jj-sac-btn:not(.spent):hover { background: rgba(110,70,200,.4); border-color: #7a52d0; }
#jj-sacrifice-hud .jj-sac-btn:not(.spent):active { transform: translateY(1px); }
#jj-sacrifice-hud .jj-sac-btn.spent, #jj-sacrifice-hud .jj-sac-btn:disabled {
  background: rgba(60,60,70,.35); border-color: #44444f; color: #6c6c78; cursor: not-allowed; filter: grayscale(1);
}
#jj-sacrifice-hud .jj-sac-btn.spent i, #jj-sacrifice-hud .jj-sac-btn.spent .jj-sac-gain { color: #6c6c78; text-shadow: none; }
#jj-sacrifice-hud .jj-sac-upkeeps { display: flex; flex-direction: column; gap: 5px; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(100,60,200,.22); }
#jj-sacrifice-hud .jj-sac-sub { font-size: 9px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: #8a78c8; padding-left: 2px; }
#jj-sacrifice-hud .jj-sac-upkeep {
  display: flex; align-items: center; gap: 7px; width: 100%; padding: 5px 8px;
  border: 1px solid #5a4a3a; border-radius: 7px; background: rgba(150,110,40,.18);
  color: #e7d6b0; font-size: 11px; font-weight: 600; line-height: 1; cursor: pointer;
  transition: background .12s ease, border-color .12s ease;
}
#jj-sacrifice-hud .jj-sac-upkeep i { font-size: 11px; color: #d8a850; }
#jj-sacrifice-hud .jj-sac-upkeep .jj-sac-lbl { flex: 1 1 auto; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#jj-sacrifice-hud .jj-sac-upkeep .jj-sac-cost { flex: 0 0 auto; font-weight: 700; color: #ff6b6b; }
#jj-sacrifice-hud .jj-sac-upkeep .jj-sac-x { color: #b06a6a; }
#jj-sacrifice-hud .jj-sac-upkeep:hover { background: rgba(200,80,80,.25); border-color: #a05050; }
#jj-sacrifice-hud .jj-sac-upkeep:hover .jj-sac-x { color: #ff7676; }
/* Concentração — visual distinto (azul/roxo) */
#jj-sacrifice-hud .jj-sac-upkeep.is-conc { border-color: #4a4080; background: rgba(90,80,180,.2); color: #cfc6ff; }
#jj-sacrifice-hud .jj-sac-upkeep.is-conc i { color: #9d8cff; }
#jj-sacrifice-hud .jj-sac-upkeep.is-conc .jj-sac-conc { flex: 0 0 auto; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: .03em; color: #b3a6ff; }
#jj-sacrifice-hud .jj-sac-upkeep.is-conc:hover { background: rgba(120,100,220,.3); border-color: #6a58c0; }
/* Duração (sem custo) — visual neutro/teal */
#jj-sacrifice-hud .jj-sac-upkeep.is-dur { border-color: #2f5a55; background: rgba(60,140,130,.16); color: #bfe6df; }
#jj-sacrifice-hud .jj-sac-upkeep.is-dur i { color: #7fd3c6; }
#jj-sacrifice-hud .jj-sac-upkeep.is-dur:hover { background: rgba(70,170,155,.26); border-color: #4a8a80; }

/* ── Recursos (custom) — cabeçalho no mesmo estilo de "Sacrifícios" ── */
#jj-sacrifice-hud .jj-sac-resources { display: flex; flex-direction: column; gap: 5px; margin-top: 10px; }
#jj-sacrifice-hud .jj-sac-section-header {
  display: flex; align-items: center; gap: 6px; padding: 1px 4px 5px; margin-bottom: 1px;
  border-bottom: 1px solid rgba(100,60,200,.25); color: #c0a8ff;
}
#jj-sacrifice-hud .jj-sac-section-header i { font-size: 12px; opacity: .9; }
#jj-sacrifice-hud .jj-sac-section-title { font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
#jj-sacrifice-hud .jj-sac-res-row {
  display: flex; align-items: center; gap: 6px; width: 100%; padding: 5px 7px;
  border: 1px solid rgba(100,60,200,.35); border-radius: 7px; background: rgba(100,60,200,.08);
  cursor: pointer; transition: background .12s ease, border-color .12s ease;
}
#jj-sacrifice-hud .jj-sac-res-row:hover { background: rgba(110,70,200,.22); border-color: #7a52d0; }
#jj-sacrifice-hud .jj-sac-res-name {
  flex: 1 1 auto; min-width: 0; font-size: 11px; font-weight: 600; color: #d8ccff;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
#jj-sacrifice-hud .jj-sac-res-values { flex: 0 0 auto; display: flex; align-items: center; gap: 3px; }
#jj-sacrifice-hud .jj-sac-res-values input {
  width: 30px; padding: 2px 0; text-align: center; font-size: 11px; font-weight: 700;
  background: rgba(0,0,0,.35); border: 1px solid rgba(100,60,200,.4); border-radius: 4px;
  color: #ede6ff;
}
#jj-sacrifice-hud .jj-sac-res-values input:focus { outline: none; border-color: #7a52d0; }
#jj-sacrifice-hud .jj-sac-res-sep { flex: 0 0 auto; font-size: 10px; color: #8a78c8; }
#jj-sacrifice-hud .jj-sac-res-remove {
  flex: 0 0 auto; display: flex; align-items: center; justify-content: center;
  width: 16px; height: 16px; background: none; border: none; color: #6c6c78;
  font-size: 10px; cursor: pointer; transition: color .12s ease;
}
#jj-sacrifice-hud .jj-sac-res-remove:hover { color: #ff7676; }
#jj-sacrifice-hud .jj-sac-res-add { display: flex; align-items: center; gap: 5px; margin-top: 2px; }
#jj-sacrifice-hud .jj-sac-res-new-name {
  flex: 1 1 auto; min-width: 0; padding: 5px 8px; font-size: 11px;
  background: rgba(0,0,0,.35); border: 1px dashed rgba(100,60,200,.4); border-radius: 7px;
  color: #d8ccff;
}
#jj-sacrifice-hud .jj-sac-res-new-name::placeholder { color: #6c6c78; }
#jj-sacrifice-hud .jj-sac-res-new-name:focus { outline: none; border-style: solid; border-color: #7a52d0; }
#jj-sacrifice-hud .jj-sac-res-add-btn {
  flex: 0 0 auto; display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 7px; border: 1px solid rgba(100,60,200,.45);
  background: rgba(100,60,200,.18); color: #b79bff; font-size: 11px; cursor: pointer;
  transition: background .12s ease, border-color .12s ease;
}
#jj-sacrifice-hud .jj-sac-res-add-btn:hover { background: rgba(110,70,200,.35); border-color: #7a52d0; }
`;

function injectStyles() {
  if ( document.getElementById(STYLE_ID) ) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS_TEXT;
  document.head.appendChild(style);
}

/* -------------------------------------------- */
/*  Alvo do HUD                                 */
/* -------------------------------------------- */

/** Personagem-alvo do HUD para o usuário atual no combate ativo (ou null). */
function getHudActor() {
  const combat = game.combat;
  if ( !combat?.started ) return null;
  const inCombat = (actor) => actor && combat.combatants.some(c => c.actorId === actor.id);

  // 1. Token controlado (intuitivo; cobre o GM controlando um personagem).
  for ( const t of (canvas?.tokens?.controlled ?? []) ) {
    if ( t.actor?.type === "character" && t.actor.isOwner && inCombat(t.actor) ) return t.actor;
  }

  // 2. Personagem atribuído ao usuário, se estiver no combate.
  const assigned = game.user.character;
  if ( assigned?.type === "character" && assigned.isOwner && inCombat(assigned) ) return assigned;

  // 3. Jogador (não-GM) com exatamente um personagem próprio no combate.
  if ( !game.user.isGM ) {
    const owned = [...new Map(combat.combatants
      .filter(c => c.actor?.type === "character" && c.actor.isOwner)
      .map(c => [c.actor.id, c.actor])).values()];
    if ( owned.length === 1 ) return owned[0];
  }
  return null;
}

const sacState = (actor) => actor?.getFlag(SCOPE, FLAG_SAC) ?? {};
const resourcesState = (actor) => actor?.getFlag(SCOPE, FLAG_RES) ?? [];

/* -------------------------------------------- */
/*  Render                                      */
/* -------------------------------------------- */

function buttonsHtml(actor) {
  const sac = sacState(actor);
  const level = actor.system.details?.level ?? 1;
  return SACS.map(s => {
    const usado = !!sac[s.key];
    const ganho = s.key === "action" ? level : 2;
    const dica = `Sacrificar ${s.label} → +${ganho} de Energia Gerada`;
    return `
      <button type="button" class="jj-sac-btn${usado ? " spent" : ""}" data-sac="${s.key}"
              ${usado ? "disabled" : ""} data-tooltip="${dica}" aria-label="${dica}">
        <i class="fas ${s.icon}" inert></i>
        <span class="jj-sac-lbl">${s.label}</span>
        <span class="jj-sac-gain">+${ganho}</span>
      </button>`;
  }).join("");
}

/** Seção "Ativas" (Custo Constante / Concentração) — some se nada ativo. */
function upkeepHtml(actor) {
  const ups = getActorUpkeeps(actor);
  if ( !ups.length ) return "";
  const rows = ups.map(u => {
    if ( u.type === "concentration" ) {
      return `
      <button type="button" class="jj-sac-upkeep is-conc" data-upkeep="${u.activityId}"
              data-tooltip="Concentração — clique para desativar">
        <i class="fas fa-brain" inert></i>
        <span class="jj-sac-lbl">${u.label}</span>
        <span class="jj-sac-conc">Concentração</span>
        <i class="fas fa-xmark jj-sac-x" inert></i>
      </button>`;
    }
    if ( u.type === "duration" ) {
      return `
      <button type="button" class="jj-sac-upkeep is-dur" data-upkeep="${u.activityId}"
              data-tooltip="Técnica ativa (duração) — clique para desativar">
        <i class="fas fa-hourglass-half" inert></i>
        <span class="jj-sac-lbl">${u.label}</span>
        <i class="fas fa-xmark jj-sac-x" inert></i>
      </button>`;
    }
    const poolLbl = u.pool === "total" ? "Total" : "Gerada";
    return `
      <button type="button" class="jj-sac-upkeep" data-upkeep="${u.activityId}"
              data-tooltip="Custo Constante — clique para desativar">
        <i class="fas fa-circle-notch" inert></i>
        <span class="jj-sac-lbl">${u.label}</span>
        <span class="jj-sac-cost">−${u.value} ${poolLbl}</span>
        <i class="fas fa-xmark jj-sac-x" inert></i>
      </button>`;
  }).join("");
  return `<div class="jj-sac-upkeeps"><div class="jj-sac-sub">Ativas</div>${rows}</div>`;
}

/** Seção "Recursos" — recursos custom nomeados pelo jogador, com valor atual/máximo. */
function resourcesHtml(actor) {
  const res = resourcesState(actor);
  const rows = res.map(r => `
      <div class="jj-sac-res-row" data-res-id="${r.id}">
        <span class="jj-sac-res-name" title="${foundry.utils.escapeHTML(r.name)}">${foundry.utils.escapeHTML(r.name)}</span>
        <div class="jj-sac-res-values">
          <input type="number" class="jj-sac-res-current" value="${r.current ?? 0}"
                 data-res-id="${r.id}" data-field="current" data-tooltip="Atual">
          <span class="jj-sac-res-sep">/</span>
          <input type="number" class="jj-sac-res-max" value="${r.max ?? 0}"
                 data-res-id="${r.id}" data-field="max" data-tooltip="Máximo">
        </div>
        <button type="button" class="jj-sac-res-remove" data-res-id="${r.id}"
                data-tooltip="Remover recurso" aria-label="Remover recurso">
          <i class="fas fa-trash" inert></i>
        </button>
      </div>`).join("");

  return `
    <div class="jj-sac-resources">
      <div class="jj-sac-section-header">
        <i class="fas fa-gem" inert></i>
        <span class="jj-sac-section-title">Recursos</span>
      </div>
      ${rows}
      <div class="jj-sac-res-add">
        <input type="text" class="jj-sac-res-new-name" placeholder="Novo recurso..." maxlength="40">
        <button type="button" class="jj-sac-res-add-btn" data-tooltip="Adicionar recurso" aria-label="Adicionar recurso">
          <i class="fas fa-plus" inert></i>
        </button>
      </div>
    </div>`;
}

function bodyHtml(actor) {
  return buttonsHtml(actor) + upkeepHtml(actor) + resourcesHtml(actor);
}

function innerHtml(actor) {
  return `
    <div class="jj-sac-header" data-drag-handle>
      <i class="fas fa-hand-fist" inert></i>
      <span class="jj-sac-title">Sacrifícios</span>
    </div>
    <div class="jj-sac-body">${bodyHtml(actor)}</div>`;
}

function removeHud() {
  hudEl?.remove();
  hudEl = null;
  hudActorId = null;
}

/** (Re)desenha o HUD conforme o combate/ator atual. */
export function renderSacrificeHud() {
  const actor = getHudActor();
  if ( !actor ) { removeHud(); return; }

  // Já existe para o mesmo ator → só atualiza os botões.
  if ( hudEl && hudActorId === actor.id ) { refreshButtons(); return; }
  removeHud();
  injectStyles();

  hudActorId = actor.id;
  hudEl = document.createElement("div");
  hudEl.id = "jj-sacrifice-hud";
  hudEl.className = "jj-sacrifice-hud";
  // Posição fixa inline (à prova de falha, não depende do CSS carregar).
  hudEl.style.position = "fixed";
  hudEl.style.zIndex = "60";
  hudEl.innerHTML = innerHtml(actor);

  // Posição salva (por usuário) ou padrão (canto inferior esquerdo).
  const pos = game.user.getFlag(SCOPE, FLAG_POS);
  if ( pos && Number.isFinite(pos.left) && Number.isFinite(pos.top) ) {
    hudEl.style.left = `${pos.left}px`;
    hudEl.style.top = `${pos.top}px`;
  } else {
    hudEl.style.left = "16px";
    hudEl.style.bottom = "90px";
  }

  document.body.appendChild(hudEl);
  attachButtonListeners(actor);
  makeDraggable();
}

function refreshButtons() {
  if ( !hudEl ) return;
  const actor = game.actors.get(hudActorId);
  if ( !actor ) { removeHud(); return; }
  const body = hudEl.querySelector(".jj-sac-body");
  if ( body ) {
    body.innerHTML = bodyHtml(actor);
    attachButtonListeners(actor);
  }
}

function attachButtonListeners(actor) {
  hudEl?.querySelectorAll(".jj-sac-btn").forEach(btn => {
    btn.addEventListener("click", () => onSacrifice(actor, btn.dataset.sac, btn));
  });
  hudEl?.querySelectorAll(".jj-sac-upkeep").forEach(btn => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      await deactivateUpkeep(actor, btn.dataset.upkeep);
      refreshButtons();
    });
  });

  hudEl?.querySelectorAll(".jj-sac-res-values input").forEach(input => {
    input.addEventListener("change", () => {
      onResourceFieldChange(actor, input.dataset.resId, input.dataset.field, input.value);
    });
  });
  hudEl?.querySelectorAll(".jj-sac-res-remove").forEach(btn => {
    btn.addEventListener("click", () => onResourceRemove(actor, btn.dataset.resId));
  });
  hudEl?.querySelectorAll(".jj-sac-res-row").forEach(row => {
    row.addEventListener("click", (e) => {
      // Não abre o diálogo se o clique foi nos campos numéricos ou no botão de remover —
      // esses já têm seus próprios listeners (edição direta / remoção).
      if ( e.target.closest("input, .jj-sac-res-remove") ) return;
      onResourceClick(actor, row.dataset.resId);
    });
  });
  const addBtn = hudEl?.querySelector(".jj-sac-res-add-btn");
  const nameInput = hudEl?.querySelector(".jj-sac-res-new-name");
  const doAdd = async () => {
    const name = nameInput?.value?.trim();
    if ( !name ) return;
    // Trava contra duplo-clique/Enter duplo — sem isso, duas chamadas concorrentes
    // partem do mesmo estado (getFlag) e uma sobrescreve o recurso que a outra criou.
    if ( addBtn ) addBtn.disabled = true;
    if ( nameInput ) nameInput.disabled = true;
    await onResourceAdd(actor, name); // refreshButtons() dentro já reconstrói o HUD
  };
  addBtn?.addEventListener("click", doAdd);
  nameInput?.addEventListener("keydown", e => {
    if ( e.key === "Enter" ) { e.preventDefault(); doAdd(); }
  });
}

/* -------------------------------------------- */
/*  Ação de sacrifício                          */
/* -------------------------------------------- */

async function onSacrifice(actor, tipo, btn) {
  if ( !actor || !tipo ) return;
  if ( sacState(actor)[tipo] ) return;       // já usado neste ciclo
  if ( btn ) btn.disabled = true;            // evita duplo clique durante o await

  // Gera a Energia (transfere da reserva). Só consome a ação se realmente gerou.
  const ganho = await EnergySystem.sacrificeAction(actor, tipo); // "action"→nível; senão→2
  if ( ganho > 0 ) await actor.setFlag(SCOPE, FLAG_SAC, { ...sacState(actor), [tipo]: true });
  refreshButtons();                          // re-renderiza com o estado real
}

/* -------------------------------------------- */
/*  Recursos (custom)                           */
/* -------------------------------------------- */

async function onResourceAdd(actor, name) {
  if ( !actor || !name ) return;
  const res = foundry.utils.deepClone(resourcesState(actor));
  res.push({ id: foundry.utils.randomID(), name, current: 0, max: 0 });
  await actor.setFlag(SCOPE, FLAG_RES, res);
  refreshButtons();
}

async function onResourceRemove(actor, resId) {
  if ( !actor || !resId ) return;
  const res = foundry.utils.deepClone(resourcesState(actor)).filter(r => r.id !== resId);
  await actor.setFlag(SCOPE, FLAG_RES, res);
  refreshButtons();
}

/**
 * Publica no chat o resultado de uma mudança no valor ATUAL de um recurso custom.
 * Formato: "[Nome] recebeu/usou X [recurso], ficando com Y de Z" — ou sem "de Z"
 * quando o recurso não tem máximo definido (max = 0). Nada é postado se delta for 0.
 */
function postResourceMessage(actor, name, delta, newCurrent, max) {
  if ( !delta ) return;
  const safeName = foundry.utils.escapeHTML(name);
  const verbo = delta > 0 ? "recebeu" : "usou";
  const amount = Math.abs(delta);
  const hasMax = (max ?? 0) > 0;
  const frase = hasMax
    ? `${verbo} <strong>${amount}</strong> ${safeName}, ficando com <strong>${newCurrent}</strong> de <strong>${max}</strong>`
    : `${verbo} <strong>${amount}</strong> ${safeName}, ficando com <strong>${newCurrent}</strong>`;
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<strong>${actor.name}</strong> ${frase}.`
  });
}

async function onResourceFieldChange(actor, resId, field, rawValue) {
  if ( !actor || !resId || !["current", "max"].includes(field) ) return;
  const res = foundry.utils.deepClone(resourcesState(actor));
  const entry = res.find(r => r.id === resId);
  if ( !entry ) return;
  const anterior = entry[field] ?? 0;
  const digitado = parseInt(rawValue) || 0;
  const novo = Math.max(0, digitado);
  entry[field] = novo;
  await actor.setFlag(SCOPE, FLAG_RES, res);

  // Só reconstrói o HUD inteiro se o valor precisou ser corrigido (ex.: negativo) —
  // senão o input já mostra exatamente o que foi digitado, nada visual pra atualizar.
  if ( novo !== digitado ) refreshButtons();

  // Só avisa no chat quando o valor ATUAL muda manualmente — editar o máximo é só
  // recalibrar o teto do recurso, não um ganho/uso.
  if ( field === "current" ) postResourceMessage(actor, entry.name, novo - anterior, novo, entry.max);
}

/**
 * Clique num recurso: pergunta uma quantidade e se é para usar (gastar) ou receber
 * (ganhar), aplica no valor atual e avisa no chat. Sem limite máximo definido (max = 0),
 * o aviso só menciona a quantidade, sem a fração "de Y".
 */
async function onResourceClick(actor, resId) {
  const entry = resourcesState(actor).find(r => r.id === resId);
  if ( !actor || !entry ) return;

  const safeName = foundry.utils.escapeHTML(entry.name);
  const content = `
    <div style="display:flex; flex-direction:column; gap:8px; padding:2px 0 4px;">
      <p style="margin:0; font-size:12px; color:#aaa;">
        Quanto de <strong style="color:#d8ccff;">${safeName}</strong> você quer usar ou receber?
      </p>
      <input type="number" id="jj-res-amount" min="1" step="1" value="1" autofocus
             style="width:100%; padding:7px 8px; font-size:15px; text-align:center;
                    background:rgba(0,0,0,.35); border:1px solid rgba(100,60,200,.45);
                    border-radius:7px; color:#ede6ff;">
    </div>`;
  const readAmount = (dialog) =>
    Math.max(1, parseInt(dialog.element.querySelector("#jj-res-amount")?.value) || 1);

  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: "Usar ou Receber Recurso" },
    content,
    buttons: [
      {
        action: "use", label: "Usar", icon: "fa-solid fa-minus", default: true,
        callback: (event, button, dialog) => ({ mode: "use", amount: readAmount(dialog) })
      },
      {
        action: "gain", label: "Receber", icon: "fa-solid fa-plus",
        callback: (event, button, dialog) => ({ mode: "gain", amount: readAmount(dialog) })
      },
      { action: "cancel", label: "Cancelar", icon: "fa-solid fa-xmark" }
    ],
    rejectClose: false,
    close: () => null
  });
  if ( !result?.mode ) return;

  const res = foundry.utils.deepClone(resourcesState(actor));
  const target = res.find(r => r.id === resId);
  if ( !target ) return;
  const max = target.max ?? 0;
  const anterior = target.current ?? 0;
  const delta = result.mode === "use" ? -result.amount : result.amount;
  target.current = Math.max(0, anterior + delta);
  await actor.setFlag(SCOPE, FLAG_RES, res);
  refreshButtons();

  // Usa o delta REALMENTE aplicado (pode ser menor que o pedido, se travou no 0)
  postResourceMessage(actor, entry.name, target.current - anterior, target.current, max);
}

/* -------------------------------------------- */
/*  Arrastar                                    */
/* -------------------------------------------- */

function makeDraggable() {
  const handle = hudEl?.querySelector("[data-drag-handle]");
  if ( !handle ) return;
  let startX, startY, origLeft, origTop;

  const onMove = (e) => {
    const left = Math.max(0, Math.min(window.innerWidth  - 40, origLeft + (e.clientX - startX)));
    const top  = Math.max(0, Math.min(window.innerHeight - 20, origTop  + (e.clientY - startY)));
    hudEl.style.left = `${left}px`;
    hudEl.style.top = `${top}px`;
    hudEl.style.bottom = "auto";
  };
  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    const rect = hudEl.getBoundingClientRect();
    game.user.setFlag(SCOPE, FLAG_POS, { left: Math.round(rect.left), top: Math.round(rect.top) });
  };
  handle.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const rect = hudEl.getBoundingClientRect();
    startX = e.clientX; startY = e.clientY;
    origLeft = rect.left; origTop = rect.top;
    hudEl.style.left = `${rect.left}px`;
    hudEl.style.top = `${rect.top}px`;
    hudEl.style.bottom = "auto";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });
}

/* -------------------------------------------- */
/*  Reset por turno / ciclo de vida             */
/* -------------------------------------------- */

/** Apenas um cliente age: GM ativo (se houver) ou o dono do ator. */
function _podeResetar(actor) {
  const gm = game.users?.activeGM;
  return gm ? (gm === game.user) : (actor?.isOwner === true);
}

async function _limparSacrificios(actor) {
  if ( !actor || !_podeResetar(actor) ) return;
  const sac = actor.getFlag(SCOPE, FLAG_SAC);
  if ( sac && (sac.action || sac.bonus || sac.reaction) ) {
    await actor.unsetFlag(SCOPE, FLAG_SAC);
  }
}

// Início do turno de um combatente → reabilita seus sacrifícios.
Hooks.on("combatTurnChange", async (combat, prior, current) => {
  const combatant = combat.combatants.get(current?.combatantId);
  await _limparSacrificios(combatant?.actor);
  renderSacrificeHud();
});

// Começo/atualização do combate.
Hooks.on("combatStart", () => renderSacrificeHud());
Hooks.on("updateCombat", () => renderSacrificeHud());
Hooks.on("createCombatant", () => renderSacrificeHud());
Hooks.on("deleteCombatant", () => renderSacrificeHud());

// Fim do combate → limpa flags dos combatentes e remove o HUD.
Hooks.on("deleteCombat", async (combat) => {
  for ( const c of (combat?.combatants ?? []) ) await _limparSacrificios(c.actor);
  removeHud();
});

// Estado dos botões muda quando o ator é atualizado (flag ou energia).
Hooks.on("updateActor", (actor) => {
  if ( hudEl && actor?.id === hudActorId ) refreshButtons();
});

// Selecionar/desselecionar token muda o alvo do HUD (útil para o GM).
Hooks.on("controlToken", () => renderSacrificeHud());

// Combate já em andamento ao (re)carregar a página.
Hooks.on("ready", () => { if ( game.combat?.started ) renderSacrificeHud(); });
