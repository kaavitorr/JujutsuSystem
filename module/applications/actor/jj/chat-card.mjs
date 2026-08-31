/**
 * jj/chat-card.mjs
 * Chat card customizado para atividades de ataque (attack).
 */

import { checkFulgorNegro } from "./fulgor-negro.mjs";
import { getMasteryTechniqueBonus, masteryBonusBadge } from "./mastery-milestones.mjs";
import { applyDamageToSelectedTokens } from "./damage-application.mjs";
import { chooseJJScale, applyScaleChoice } from "./jj-scale.mjs";
import { activateUpkeep } from "./constant-cost.mjs";
import { resetHealLimitsByTechnique } from "./heal-limit.mjs";

/**
 * jujutsu-chat-card.mjs
 * JujutsuLegacy — Chat Card Customizado
 *
 * Substitui completamente o card nativo do dnd5e para ataques.
 * Fluxo:
 *   1. Jogador clica na técnica/arma na ficha
 *   2. Card aparece no chat com: nome, descrição, botões de Rolar Ataque e Rolar Dano
 *   3. Ao clicar em Rolar Ataque: dialog pergunta quantos dados de PA quer gastar
 *      (0 até o bônus de proficiência, +2/rank do treino Impacto Ecoante,
 *      limitado pela PA gerada disponível)
 *   4. Rolagem de acerto aparece no card com breakdown clicável
 *   5. Ao clicar em Rolar Dano: mesma pergunta de PA
 *   6. Dano aparece no card — se múltiplos tipos, divide em colunas
 *
 * INTEGRAÇÃO: adicionar ao final do character-sheet.mjs (como o consumo de PA)
 */

(function _registerJujutsuChatCard() {

  // ── INVOCAÇÕES: quem paga a PA ───────────────────────────────────────────────
  // Se o ator é uma invocação com "Gasta a PA do invocador" marcado, devolve o
  // invocador (dono do item que a invocou). Senão, devolve o próprio ator.
  function _paPayer(actor) {
    const flags = actor?.flags ?? {};
    const summon = flags.JujutsuLegacy?.summon ?? flags["jujutsu-system"]?.summon;
    if ( !summon?.origin || summon.consumeSummoner !== true ) return actor;
    let doc = null;
    try { doc = fromUuidSync(summon.origin); } catch { doc = null; }
    return doc?.actor ?? doc?.parent ?? actor;
  }

  // Retorna quanto o Seis Olhos reduz do custo de PA do ator.
  // Selado = floor(prof/2); Poder Completo = prof. Sem o item ou modo = 0.
  function _seisOlhosReduction(actor) {
    const hasSeisOlhos = actor?.items?.some(i => i.name === "Seis Olhos" && i.type === "feat");
    const mode = actor?.getFlag?.("jujutsu-system", "seisOlhosMode");
    if ( !hasSeisOlhos || !mode ) return 0;
    const prof = actor.system?.attributes?.prof ?? 2;
    return mode === "full" ? prof : Math.max(1, Math.floor(prof / 2));
  }

  // ── RECURSO CUSTOMIZADO: checagem+reserva (síncrona) e confirmação (async) ──
  // A checagem usa um "reservado localmente" por ator+recurso pra evitar corrida:
  // actor.getFlag() só reflete o saldo depois que o setFlag anterior é confirmado
  // pelo servidor (assíncrono), então duas ativações quase simultâneas podem ler o
  // MESMO saldo antes de qualquer uma escrever, permitindo gastar o recurso 2x mas
  // descontar só 1x. Descontando o valor já reservado (mas ainda não confirmado)
  // da conta, a segunda ativação vê o saldo correto mesmo antes da primeira
  // terminar de persistir.
  const _pendingResourceDeductions = new Map(); // `${payerId}:${resId}` -> nº reservado

  /**
   * Verifica saldo (síncrono) e RESERVA o valor se suficiente — ainda não escreve.
   * Recurso órfão (removido do ator depois de configurado na activity) é
   * auto-limpo da flag e tratado como "sem custo" (não bloqueia o uso).
   * @returns {{ok:true, key?:string, resId?:string, name?:string, need?:number}
   *          |{ok:false, name:string, have:number, need:number}}
   */
  function _reserveCustomResource(payer, activity) {
    const rc = activity.flags?.["jujutsu-system"]?.resourceCost;
    if ( !rc?.id || !(Number(rc.amount) > 0) ) return { ok: true };
    const need = Number(rc.amount);
    const list = payer.getFlag("jujutsu-system", "customResources") ?? [];
    const idx  = list.findIndex(r => r.id === rc.id);
    if ( idx < 0 ) {
      activity.update({ "flags.jujutsu-system.-=resourceCost": null });
      ui.notifications.warn(`O recurso configurado em "${activity.name}" não existe mais em ${payer.name} — custo removido.`);
      return { ok: true };
    }
    const key = `${payer.id}:${rc.id}`;
    const pendente = _pendingResourceDeductions.get(key) ?? 0;
    const have = Number(list[idx].current ?? 0) - pendente;
    if ( have < need ) return { ok: false, name: list[idx].name, have, need };
    _pendingResourceDeductions.set(key, pendente + need);
    return { ok: true, key, resId: rc.id, name: list[idx].name, need };
  }

  /** Confirma (persiste) uma reserva feita por _reserveCustomResource. */
  async function _commitCustomResource(payer, reserva) {
    if ( !reserva?.key ) return; // nada foi reservado (sem custo configurado, ou órfão já tratado)
    try {
      const list = payer.getFlag("jujutsu-system", "customResources") ?? [];
      const idx  = list.findIndex(r => r.id === reserva.resId);
      if ( idx < 0 ) return;
      const have = Number(list[idx].current ?? 0);
      const updated = list.map((r, i) => i === idx ? { ...r, current: Math.max(0, have - reserva.need) } : r);
      await payer.setFlag("jujutsu-system", "customResources", updated);
    } finally {
      const restante = (_pendingResourceDeductions.get(reserva.key) ?? 0) - reserva.need;
      if ( restante > 0 ) _pendingResourceDeductions.set(reserva.key, restante);
      else _pendingResourceDeductions.delete(reserva.key);
    }
  }

  // ── HOOK PRINCIPAL: intercepta o uso de qualquer atividade ──────────────────
  Hooks.on("dnd5e.preUseActivity", (activity, config, dialog) => {
    const item = activity.item;
    if ( !item ) return;

    // Interceptamos atividades de ataque e salvaguarda
    if ( activity.type !== "attack" && activity.type !== "save" ) return;

    activateUpkeep(activity); // ativa Custo Constante/Concentração/Duração antes do veto
    resetHealLimitsByTechnique(activity); // reset-por-técnica (o veto abaixo barraria o listener global)
    // Cancelar o comportamento nativo
    _postJujutsuCard(activity, item);
    return false;
  });

  // ── RECURSO CUSTOMIZADO: consumo em atividades fora do card customizado ──────
  // (ataque e salvaguarda consomem o recurso dentro de _postJujutsuCard, junto com a PA)
  //
  // IMPORTANTE — ordem de registro: este hook precisa continuar registrado ANTES
  // do hook de extra-cards.mjs (importado logo depois deste arquivo em
  // character-sheet.mjs). Hooks.call para no primeiro listener que retorna false —
  // é o veto AQUI que impede o card customizado de dano/cura/perícia/utilidade de
  // ser postado quando o recurso configurado está insuficiente. Se este hook for
  // movido para depois daquele, o card passaria a ser postado mesmo sem saldo.
  Hooks.on("dnd5e.preUseActivity", (activity) => {
    if ( activity.type === "attack" || activity.type === "save" ) return; // já tratado no card
    const actor = activity.item?.actor;
    if ( !actor ) return;
    if ( !activity.flags?.["jujutsu-system"]?.resourceCost?.id ) return; // nada configurado
    const payer = _paPayer(actor); // invocação → invocador; senão, o próprio
    const reserva = _reserveCustomResource(payer, activity);
    if ( reserva.ok === false ) {
      ui.notifications.warn(`${payer.name} não tem ${reserva.name} suficiente! (${reserva.have} disponível, ${reserva.need} necessário)`);
      return false; // bloqueia o uso
    }
    _commitCustomResource(payer, reserva).then(() => {
      if ( payer !== actor && reserva.key ) ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `🔗 <strong>${actor.name}</strong> (invocação) gastou <strong>${reserva.need} ${reserva.name}</strong> de <strong>${payer.name}</strong>.`
      });
    });
  });

  // ── CRIAR O CARD CUSTOMIZADO ─────────────────────────────────────────────────
  async function _postJujutsuCard(activity, item) {
    const actor = item.actor;
    const isSpell = item.type === "spell";

    // Processar consumo de PA configurado na activity (Attribute type)
    // antes de criar o card, já que bloqueamos o processamento nativo
    if ( actor ) {
      const payer = _paPayer(actor); // invocação → invocador; senão, o próprio
      const targets = activity.consumption?.targets ?? [];
      for ( const target of targets ) {
        const isGerada = target.target === "energy.generated";
        const isTotal  = target.target === "energy.total";
        if ( !isGerada && !isTotal ) continue;
        const custoBase = Number(target.value ?? 0);
        if ( custoBase <= 0 ) continue;
        const custo = Math.max(0, custoBase - _seisOlhosReduction(actor));
        const campo = isGerada ? "system.energy.generated" : "system.energy.total";
        const atual = isGerada
          ? (payer.system?.energy?.generated ?? 0)
          : (payer.system?.energy?.total ?? 0);
        const label = isGerada ? "PA Gerada" : "PA Total";
        if ( atual < custo ) {
          ui.notifications.warn(`${payer.name} não tem ${label} suficiente! (${atual} disponível, ${custo} necessário)`);
          return; // aborta criação do card
        }
        await payer.update({ [campo]: atual - custo }, { isEnergySystem: true });
        if ( payer !== actor ) ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: `🔗 <strong>${actor.name}</strong> (invocação) gastou <strong>${custo} ${label}</strong> de <strong>${payer.name}</strong>.`
        });
      }

      // Consumo de Recurso customizado configurado na activity (mesma reserva
      // síncrona usada pelo hook de atividades fora do card, acima — evita a
      // corrida de duplo-gasto e já redireciona pro invocador, como a PA)
      const reservaRecurso = _reserveCustomResource(payer, activity);
      if ( reservaRecurso.ok === false ) {
        ui.notifications.warn(`${payer.name} não tem ${reservaRecurso.name} suficiente! (${reservaRecurso.have} disponível, ${reservaRecurso.need} necessário)`);
        return; // aborta criação do card
      }
      await _commitCustomResource(payer, reservaRecurso);
      if ( payer !== actor && reservaRecurso.key ) ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `🔗 <strong>${actor.name}</strong> (invocação) gastou <strong>${reservaRecurso.need} ${reservaRecurso.name}</strong> de <strong>${payer.name}</strong>.`
      });
    }

    // Dados de dano da activity
    const damageParts = activity.damage?.parts ?? [];
    const isSave = activity.type === "save";

    // Montar o HTML do card
    const description = item.system.description?.value ?? "";
    const hasDescription = description && description !== "<p></p>";

    // Tipo de dado bônus de PA
    const baseDenomination = isSpell
      ? (damageParts[0]?.denomination ?? 6)
      : 4;

    // Info de Salvaguarda (ability pode ser Set no dnd5e v4)
    const saveDC        = isSave ? (activity.save?.dc?.value ?? null) : null;
    const saveAbilityRaw = isSave ? (activity.save?.ability ?? null) : null;
    const saveAbility   = saveAbilityRaw instanceof Set
      ? ([...saveAbilityRaw][0] ?? null)
      : Array.isArray(saveAbilityRaw) ? (saveAbilityRaw[0] ?? null) : saveAbilityRaw;
    const saveLabel     = saveAbility
      ? (CONFIG.DND5E.abilities?.[saveAbility]?.label ?? String(saveAbility).toUpperCase())
      : null;

    const cardData = {
      itemId:       item.id,
      actorId:      actor?.id ?? null,
      tokenId:      actor?.token?.id ?? null,
      activityId:   activity.id,
      itemName:     item.name,
      itemImg:      item.img,
      isSpell,
      isSave,
      saveDC,
      saveLabel,
      hasDescription,
      description:  hasDescription ? description : "",
      damageParts:  damageParts.map((p, i) => ({
        formula: _buildDamageFormula(p, actor, i === 0),
        types:   p.types ?? [],
        label:   _damageTypeLabel(p.types)
      })),
      hasAttack:    !isSave,
      hasDamage:    damageParts.length > 0,
      saveAbility,
      paBonus:      baseDenomination,
      excedenteDados: _excedenteDiceCount(damageParts),
      profBonus:    actor?.system?.attributes?.prof ?? 2,
      userId:       game.user.id
    };

    const content = _renderCardHTML(cardData);

    const rollMode = game.settings.get("core", "rollMode");
    const chatData = {
      speaker:  ChatMessage.getSpeaker({ actor }),
      content,
      rollMode,
      flags: {
        "jujutsu-system": {
          jujutsuCard: true,
          cardData
        }
      }
    };
    ChatMessage.applyRollMode(chatData, rollMode);
    await ChatMessage.create(chatData);
  }

  // ── RENDERIZAR HTML DO CARD ──────────────────────────────────────────────────
  function _renderCardHTML(data) {
    return `
<div class="jujutsu-card"
     data-item-id="${data.itemId}"
     data-actor-id="${data.actorId ?? ""}"
     data-token-id="${data.tokenId ?? ""}"
     data-activity-id="${data.activityId}"
     data-user-id="${data.userId ?? ""}"
     data-pa-bonus="${data.paBonus}"
     data-prof-bonus="${data.profBonus}"
     data-is-spell="${data.isSpell}"
     data-save-dc="${data.saveDC ?? ""}"
     data-save-ability="${data.saveAbility ?? ""}">

  <div class="jj-top-bar">
    <img class="jj-top-icon" src="${data.itemImg}" alt="${data.itemName}">
    <span class="jj-top-name">${data.itemName}</span>
    <span class="jj-top-sub">${data.isSave ? "Salvaguarda" : data.isSpell ? "Técnica" : "Ataque"}</span>
  </div>

  ${data.hasDescription ? `<div class="jj-description">${data.description}</div>` : ""}

  ${data.hasAttack ? `
  <div class="jj-adv-row">
    <button class="jj-adv-btn" data-adv="advantage" title="Vantagem">
      <i class="fas fa-angles-up"></i> Vantagem
    </button>
    <button class="jj-adv-btn" data-adv="disadvantage" title="Desvantagem">
      <i class="fas fa-angles-down"></i> Desvantagem
    </button>
  </div>` : ""}

  <div class="jj-roll-btns"${data.isSave ? ' style="grid-template-columns:1fr"' : ""}>
    ${data.hasAttack ? `
    <button class="jj-btn jj-attack-btn" data-action="jj-attack">
      <i class="fas fa-dice-d20"></i> Acerto
    </button>` : ""}
    ${data.isSave && data.saveDC ? `
    <button class="jj-btn jj-save-btn" data-action="jj-roll-save"
            style="background:color-mix(in srgb,#6040c0 20%,#0e0e18);color:#9070e0;">
      <i class="fas fa-shield-halved"></i> Salv. CD ${data.saveDC}${data.saveLabel ? ` — ${data.saveLabel}` : ""}
    </button>` : ""}
    ${data.hasDamage ? `
    <button class="jj-btn jj-damage-btn" data-action="jj-damage">
      <i class="fas fa-burst"></i> Dano
    </button>` : ""}
  </div>

  <div class="jj-panels">
    <div class="jj-panel" id="jj-atk-panel">
      <div class="jj-panel-label">${data.isSave ? "Salv." : "Acerto"}</div>
      <div class="jj-panel-val" id="jj-atk-val">—</div>
      <div class="jj-panel-breakdown" id="jj-atk-break"></div>
    </div>
    <div class="jj-panel" id="jj-dmg-panel">
      <div class="jj-panel-label">Dano</div>
      <div class="jj-panel-val dmg" id="jj-dmg-val">—</div>
      <div class="jj-panel-breakdown" id="jj-dmg-break"></div>
    </div>
  </div>

  <div class="jj-footer" id="jj-footer">
    <div class="jj-mods">
      <label class="jj-mod-check" title="Metade"><input type="checkbox" data-mod="half"> ½</label>
      <label class="jj-mod-check" title="Um quarto"><input type="checkbox" data-mod="quarter"> ¼</label>
      <label class="jj-mod-check jj-crit-check" title="Crítico Perfeito (20 natural) — dobra os dados de dano"><input type="checkbox" data-mod="crit"> Crit</label>
      <label class="jj-mod-check jj-excedente" title="Crítico Excedente (acerto supera a CA em 10+) — +${data.excedenteDados} dados do dado base"><input type="checkbox" data-mod="excedente"> Exc</label>
      <label class="jj-mod-check jj-kokusen" title="Fulgor Negro ×2,5"><input type="checkbox" data-mod="kokusen"> K <i class="fas fa-bolt"></i></label>
    </div>
    <span class="jj-footer-total">Total <strong id="jj-total-display">0</strong></span>
    <button class="jj-apply-btn" data-action="jj-apply-damage">Aplicar</button>
  </div>

</div>`;
  }

  // ── LISTENERS DO CHAT ────────────────────────────────────────────────────────
  Hooks.on("renderChatMessageHTML", (message, html) => {
    const root = html instanceof HTMLElement ? html : html[0];
    if ( !root ) return;
    const card = root.querySelector(".jujutsu-card:not(.jj-extra-card)");
    if ( !card ) return;

    const cardUserId = card.dataset.userId ?? "";
    const isAuthor = cardUserId === game.user.id;

    const atkBtn = card.querySelector("[data-action='jj-attack']");
    const dmgBtn = card.querySelector("[data-action='jj-damage']");

    if ( !isAuthor ) {
      if ( atkBtn ) { atkBtn.style.display = "none"; atkBtn.disabled = true; }
      if ( dmgBtn ) { dmgBtn.style.display = "none"; dmgBtn.disabled = true; }
    }

    // Salv. — visível a todos os jogadores (cada um rola pela sua ficha)
    card.querySelector("[data-action='jj-roll-save']")?.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await _handleSaveRoll(card);
    });

    atkBtn?.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if ( card.dataset.userId !== game.user.id ) return;
      await _handleAttackRoll(card, message);
    });

    dmgBtn?.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if ( card.dataset.userId !== game.user.id ) return;
      await _handleDamageRoll(card, message);
    });

    card.querySelector("[data-action='jj-apply-damage']")?.addEventListener("click", () => {
      const base = Number(card.dataset.totalDmg ?? 0);
      const activeMod = card.querySelector(".jj-mod-check input:checked")?.dataset.mod ?? null;
      const bonus = activeMod === "crit"      ? Number(card.dataset.critBonus ?? 0)
                  : activeMod === "excedente" ? Number(card.dataset.excedenteBonus ?? 0)
                  : 0;
      const final = _applyModifier(base, activeMod, bonus);
      let tipos = [];
      try { tipos = JSON.parse(card.dataset.damageTypes || "[]"); } catch { tipos = []; }
      _applyDamageToSelected(final, card, tipos);
    });

    card.querySelectorAll(".jj-mod-check input").forEach(cb => {
      cb.addEventListener("change", async () => {
        card.querySelectorAll(".jj-mod-check input").forEach(o => { if (o !== cb) o.checked = false; });
        const base = Number(card.dataset.totalDmg ?? 0);
        const mod  = cb.checked ? cb.dataset.mod : null;
        const el   = card.querySelector("#jj-total-display");
        if ( !el ) return;

        if ( mod === "crit" ) {
          // Crítico Perfeito: rola TODOS os dados de novo (dobra os dados)
          card.dataset.excedenteBonus = "";
          if ( !card.dataset.critBonus ) {
            const critBonus = await _rollDiceFormula(card.dataset.critFormula);
            card.dataset.critBonus = critBonus;
            const dmgBreak = card.querySelector("#jj-dmg-break");
            if ( dmgBreak && critBonus > 0 ) {
              dmgBreak.innerHTML += `<span class="jj-pa-badge" style="color:#e07040;border-color:#804020">+${critBonus} crit</span>`;
            }
          }
          el.textContent = _applyModifier(base, "crit", Number(card.dataset.critBonus ?? 0));
        } else if ( mod === "excedente" ) {
          // Crítico Excedente: soma 2 dados do dado base (só na base)
          card.dataset.critBonus = "";
          if ( !card.dataset.excedenteBonus ) {
            const exc = await _rollDiceFormula(card.dataset.excedenteFormula);
            card.dataset.excedenteBonus = exc;
            const dmgBreak = card.querySelector("#jj-dmg-break");
            if ( dmgBreak && exc > 0 ) {
              dmgBreak.innerHTML += `<span class="jj-pa-badge" style="color:#40a0e0;border-color:#205080">+${exc} exc</span>`;
            }
          }
          el.textContent = _applyModifier(base, "excedente", Number(card.dataset.excedenteBonus ?? 0));
        } else if ( mod === "kokusen" ) {
          // Black Flash: NÃO rola dados, apenas multiplica o base por 2,5
          card.dataset.critBonus = "";
          card.dataset.excedenteBonus = "";
          el.textContent = _applyModifier(base, "kokusen", 0);
        } else {
          card.dataset.critBonus = "";
          card.dataset.excedenteBonus = "";
          el.textContent = _applyModifier(base, mod);
        }
      });
    });

    // Toggles de vantagem/desvantagem — mutuamente exclusivos
    card.querySelectorAll(".jj-adv-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const adv = btn.dataset.adv;
        const active = btn.classList.contains("active");
        card.querySelectorAll(".jj-adv-btn").forEach(b => b.classList.remove("active"));
        if ( !active ) {
          btn.classList.add("active");
          card.dataset.rollMode = adv;
        } else {
          card.dataset.rollMode = "normal";
        }
      });
    });
  });

  // ── ROLAR SALVAGUARDA (qualquer jogador pode clicar pelo token dele) ─────────
  async function _handleSaveRoll(card) {
    const { actor: ownerActor, activity } = _resolveCardData(card);

    // Ability e DC do card (já armazenados como data-*)
    const abilitySet = activity?.save?.ability;
    const ability    = (abilitySet instanceof Set ? abilitySet.first() : null)
                    ?? (typeof abilitySet === "string" ? abilitySet : null)
                    ?? card.dataset.saveAbility
                    ?? "con";
    const dc         = Number(card.dataset.saveDc) || activity?.save?.dc?.value || "?";
    const abilLabel  = CONFIG.DND5E.abilities?.[ability]?.label ?? ability.toUpperCase();

    // Token alvo: primeiro alvo marcado ou token controlado
    const targetToken = [...(game.user.targets ?? [])][0] ?? canvas.tokens?.controlled?.[0];
    const targetActor = targetToken?.actor;

    if ( !targetActor ) {
      ui.notifications.warn("Selecione um token ou marque um alvo para rolar a salvaguarda.");
      return;
    }

    const saveMod = targetActor.system?.abilities?.[ability]?.save?.value
                 ?? targetActor.system?.abilities?.[ability]?.mod
                 ?? 0;
    const roll    = await new Roll(`1d20 + ${Number(saveMod)}`, targetActor.getRollData()).evaluate();
    game.dice3d?.showForRoll(roll, game.user, true);

    const isNat20  = roll.dice[0]?.results[0]?.result === 20;
    const isNat1   = roll.dice[0]?.results[0]?.result === 1;
    const success  = isNat20 || (!isNat1 && roll.total >= Number(dc));

    // Mostrar resultado no painel de "Acerto" (renomeado "Salv." no card)
    const atkPanel = card.querySelector("#jj-atk-panel");
    const atkVal   = card.querySelector("#jj-atk-val");
    const atkBreak = card.querySelector("#jj-atk-break");

    if ( atkPanel ) atkPanel.classList.add("visible");
    if ( atkVal ) {
      atkVal.textContent = roll.total;
      atkVal.className   = "jj-panel-val" + (isNat20 ? " nat20" : isNat1 ? " nat1" : "");
      atkVal.style.color = success ? "#60c080" : "#e05050";
    }
    if ( atkBreak ) {
      atkBreak.innerHTML = _buildBreakdown(roll)
        + `<span class="jj-mod-pip"> vs CD ${dc} — <strong style="color:${success ? "#60c080" : "#e05050"}">${success ? "✓ Sucesso" : "✗ Falha"}</strong></span>`;
    }

    // Label dinâmica com nome do alvo
    const lblEl = card.querySelector("#jj-atk-panel .jj-panel-label");
    if ( lblEl ) lblEl.textContent = `Salv. ${abilLabel} (${targetActor.name})`;
  }

  // ── ROLAR ATAQUE ─────────────────────────────────────────────────────────────
  async function _handleAttackRoll(card, message) {
    const { actor, activity, item, profBonus, paBonus } = _resolveCardData(card);
    if ( !actor || !activity ) return;

    // Guard contra duplo-clique / re-rolagem
    const atkBtn0 = card.querySelector(".jj-attack-btn");
    if ( atkBtn0?.disabled ) return;
    if ( atkBtn0 ) atkBtn0.disabled = true;
    const reabilitar = () => { if ( atkBtn0 ) atkBtn0.disabled = false; };

    // 1º — Escala de Energia (JJ): dropdown ANTES da Explosão Ofensiva. Apenas
    // ESCOLHE (não deduz ainda) — a dedução só ocorre quando tudo for confirmado.
    const escolhaEscala = await chooseJJScale({ actor, activity });
    if ( escolhaEscala === null ) { reabilitar(); return; } // cancelado

    // 2º — Dialog de PA (Explosão Ofensiva): dados adicionados ao DANO depois
    const paGastos = await _paDialog(actor, profBonus, paBonus);
    if ( paGastos === null ) { reabilitar(); return; } // cancelado

    // Ambos confirmados — agora sim deduz PA (Explosão Ofensiva + Escala)
    if ( paGastos > 0 ) {
      // Se a técnica já teve custo de PA (activity targets), a redução do Seis Olhos
      // já foi aplicada lá — não aplica de novo na Explosão Ofensiva.
      const tecnicaTemCustoPA = (activity.consumption?.targets ?? []).some(
        t => t.target === "energy.generated" || t.target === "energy.total"
      );
      const ok = await _consumePA(actor, paGastos, tecnicaTemCustoPA);
      if ( !ok ) { reabilitar(); return; }
    }
    const escala = await applyScaleChoice({ actor, activity, incrementos: escolhaEscala.incrementos });
    card.dataset.jjScaleBonus = escala.bonusFormula ?? "";

    // Guardar PA gastos no card para usar automaticamente no dano
    card.dataset.paGastos = paGastos;

    // Montar fórmula de acerto usando labels.toHit (já inclui FOR + Prof + bônus)
    const toHitStr  = item.labels?.toHit ?? "+0";
    const rollMode  = card.dataset.rollMode ?? "normal";
    let formula;
    if ( rollMode === "advantage" )    formula = `2d20kh1 ${toHitStr}`;
    else if ( rollMode === "disadvantage" ) formula = `2d20kl1 ${toHitStr}`;
    else                               formula = `1d20 ${toHitStr}`;

    const roll = await new Roll(formula, actor.getRollData()).evaluate();
    // Mostrar resultado IMEDIATAMENTE, animar dados em paralelo
    if ( game.dice3d ) game.dice3d.showForRoll(roll, game.user, true); // sem await

    // Pegar o resultado do dado ativo — com vantagem/desvantagem pode haver 2 dados,
    // o ativo é o que NÃO está descartado. Com rolagem normal há só 1 dado.
    const d20Results = roll.dice[0]?.results ?? [];
    const d20Ativo = (d20Results.find(r => !r.discarded) ?? d20Results[0])?.result;

    // Crítico pelo dado NATURAL vs limiar da atividade — o getter criticalThreshold
    // considera o limiar da atividade E do item (padrão 20). Nat 20 segue "Perfeito".
    const limiarCrit = activity.criticalThreshold ?? 20;
    const isCrit  = typeof d20Ativo === "number" && d20Ativo >= limiarCrit;
    const isNat20 = d20Ativo === 20;
    const isNat1  = d20Ativo === 1;

    // ── FULGOR NEGRO ─────────────────────────────────────────────────────────────
    const isFulgor = await checkFulgorNegro(actor, d20Ativo);

    // ── CRÍTICO EXCEDENTE (auto) ─────────────────────────────────────────────────
    // Com um alvo selecionado, se o acerto superar a CA dele em 10+, o Excedente é
    // marcado automaticamente no dano. Sem alvo, o checkbox continua manual.
    const alvoExc = Array.from(game.user.targets ?? [])[0];
    const caAlvo  = Number(alvoExc?.actor?.system?.attributes?.ac?.value);
    const excedenteAuto = Number.isFinite(caAlvo) && roll.total >= (caAlvo + 10);
    // Prioridade: crítico (dado ≥ limiar — dobra os dados) vence o Excedente quando ambos ocorrem.
    card.dataset.autoCrit      = isCrit ? "1" : "";
    card.dataset.autoExcedente = (excedenteAuto && !isCrit) ? "1" : "";

    // Renderizar no painel de acerto (Layout B)
    const atkPanel = card.querySelector("#jj-atk-panel");
    const atkVal   = card.querySelector("#jj-atk-val");
    const atkBreak = card.querySelector("#jj-atk-break");

    if ( atkPanel ) {
      atkPanel.classList.add("visible");
      atkVal.textContent = roll.total;
      // Fulgor e crítico por limiar ativam o visual nat20 (vermelho) mesmo sem ser 20 natural
      atkVal.className = "jj-panel-val" + (isCrit || isFulgor ? " nat20" : isNat1 ? " nat1" : "");
      const modeLabel = rollMode === "advantage" ? '<span class="jj-pa-badge" style="color:#50a050;border-color:#306030">Vantagem</span>' 
                      : rollMode === "disadvantage" ? '<span class="jj-pa-badge" style="color:#a05050;border-color:#603030">Desvantagem</span>'
                      : "";
      atkBreak.innerHTML = _buildBreakdown(roll) + modeLabel;
      if ( paGastos > 0 ) {
        atkBreak.innerHTML += `<span class="jj-pa-badge">⚡ +${paGastos}d${paBonus} no dano</span>`;
      }
      if ( card.dataset.jjScaleBonus ) {
        atkBreak.innerHTML += `<span class="jj-pa-badge" style="color:#c0a0ff;border-color:#6040a0;">⚡ +${card.dataset.jjScaleBonus} (escala)</span>`;
      }
      if ( isNat20 ) {
        atkBreak.innerHTML += `<span class="jj-pa-badge" style="color:#ffb030;border-color:#806010;">★ Perfeito! (20 natural — dobra os dados)</span>`;
      } else if ( isCrit ) {
        atkBreak.innerHTML += `<span class="jj-pa-badge" style="color:#e07040;border-color:#804020;">💥 Crítico! (${d20Ativo} ≥ ${limiarCrit} — dobra os dados)</span>`;
      } else if ( excedenteAuto ) {
        atkBreak.innerHTML += `<span class="jj-pa-badge" style="color:#50b0ff;border-color:#205080;">★ Excedente! (${roll.total} ≥ CA ${caAlvo}+10)</span>`;
      }
    }

    // Ativar o painel de dano (para mostrar o botão)
    const dmgPanel = card.querySelector("#jj-dmg-panel");
    if ( dmgPanel ) dmgPanel.classList.add("visible");

    // Desabilitar botão de acerto após rolar
    const atkBtn = card.querySelector(".jj-attack-btn");
    if ( atkBtn ) { atkBtn.disabled = true; atkBtn.style.opacity = "0.4"; atkBtn.style.cursor = "default"; }

    await _updateCardMessage(message, card.outerHTML);
  }

  // ── ROLAR DANO ───────────────────────────────────────────────────────────────
  async function _handleDamageRoll(card, message) {
    const { actor, activity, item, profBonus, paBonus } = _resolveCardData(card);
    if ( !actor || !activity || !item ) return;

    // Guard contra duplo-clique / re-rolagem do dano
    const dmgBtn0 = card.querySelector(".jj-damage-btn");
    if ( dmgBtn0?.disabled ) return;
    if ( dmgBtn0 ) dmgBtn0.disabled = true;

    // Salvaguarda: não houve etapa de "Acerto", então a Escala de Energia (JJ) é
    // escolhida AQUI — antes da Explosão Ofensiva, como no ataque. Só ESCOLHE; a
    // dedução de PA acontece depois que o diálogo de PA não for cancelado.
    let escolhaEscalaSave = null;
    if ( activity.type === "save" ) {
      escolhaEscalaSave = await chooseJJScale({ actor, activity });
      if ( escolhaEscalaSave === null ) { if ( dmgBtn0 ) dmgBtn0.disabled = false; return; } // cancelado
    }

    // PA já gastos no ataque (se houver) ou perguntar agora (salvaguarda)
    let paGastos = Number(card.dataset.paGastos ?? 0);
    if ( paGastos === 0 && activity.type === "save" ) {
      const escolhido = await _paDialog(actor, profBonus, paBonus);
      if ( escolhido === null ) { if ( dmgBtn0 ) dmgBtn0.disabled = false; return; }
      paGastos = escolhido;
      if ( paGastos > 0 ) {
        const tecnicaTemCustoPA = (activity.consumption?.targets ?? []).some(
          t => t.target === "energy.generated" || t.target === "energy.total"
        );
        const ok = await _consumePA(actor, paGastos, tecnicaTemCustoPA);
        if ( !ok ) { if ( dmgBtn0 ) dmgBtn0.disabled = false; return; }
      }
    }

    // Nada foi cancelado — deduz a PA da escala e guarda o bônus p/ rolar abaixo
    // (nos ataques isso foi feito no "Acerto"; aqui é o único ponto da salvaguarda).
    if ( escolhaEscalaSave ) {
      const escala = await applyScaleChoice({ actor, activity, incrementos: escolhaEscalaSave.incrementos });
      card.dataset.jjScaleBonus = escala.bonusFormula ?? "";
    }

    // Usar labels.damages que já tem fórmula e tipo de dano calculados
    const damageParts  = activity.damage?.parts ?? [];
    const damageLabels = item.labels?.damages ?? [];
    const rollData     = actor.getRollData();
    const isSpell      = card.dataset.isSpell === "true";
    const resultsEl    = card.querySelector(".jj-damage-results");

    const rolls = [];

    // Preferir damageLabels (já agregados e com mod correto pelo dnd5e).
    // Fallback para damageParts somente se damageLabels estiver vazio.
    const rollPromises = damageLabels.length > 0
      ? damageLabels.map(async (lbl) => {
          const roll = await new Roll(lbl.formula, rollData).evaluate();
          return { roll, label: lbl.label ?? lbl.formula };
        })
      : damageParts.map(async (part, i) => {
          // Sem labels do dnd5e: só a primeira parte leva o mod de atributo
          const formula = _buildDamageFormula(part, actor, i === 0);
          const label   = _damageTypeLabel(part.types);
          const roll    = await new Roll(formula, rollData).evaluate();
          return { roll, label };
        });

    // PA bônus em paralelo com os demais
    let paRollPromise = null;
    if ( paGastos > 0 ) {
      const paDenomination = isSpell ? (damageParts[0]?.denomination ?? 6) : 4;
      paRollPromise = new Roll(`${paGastos}d${paDenomination}`, rollData).evaluate();
    }

    // Escala de Energia (JJ) — bônus reservado no "Acerto", rolado aqui
    const jjScaleBonus = card.dataset.jjScaleBonus || "";
    const escalaRollPromise = jjScaleBonus ? new Roll(jjScaleBonus, rollData).evaluate() : null;

    const resolvedRolls = await Promise.all(rollPromises);
    rolls.push(...resolvedRolls);
    let paRoll = paRollPromise ? await paRollPromise : null;
    let escalaRoll = escalaRollPromise ? await escalaRollPromise : null;

    // Animar todos os dados simultaneamente (sem await — resultado já está calculado)
    if ( game.dice3d ) {
      const allRolls = [...resolvedRolls.map(r => r.roll), ...(paRoll ? [paRoll] : []), ...(escalaRoll ? [escalaRoll] : [])];
      Promise.all(allRolls.map(r => game.dice3d.showForRoll(r, game.user, true)));
    }

    // Total geral de dano
    const totalBase = rolls.reduce((sum, { roll }) => sum + roll.total, 0);
    const totalPA   = paRoll?.total ?? 0;
    const totalEscala = escalaRoll?.total ?? 0;
    // Maestria 3: modificador principal somado ao dano de técnicas — APENAS quando
    // o dano base é rolagem de dado (não em valores fixos).
    const masteryBonus = rolls.some(r => r.roll.dice?.length > 0) ? getMasteryTechniqueBonus(actor, item) : 0;
    const totalDmg  = totalBase + totalPA + masteryBonus + totalEscala;
    card.dataset.totalDmg = totalDmg;

    // Tipos de dano (chaves do sistema) — usados pela resistência de Pontos de
    // Armadura ao aplicar: resiste a tudo, exceto Verdadeiro (force).
    const dmgTypeKeys = [...new Set(damageParts.flatMap(p => Array.from(p.types ?? [])))];
    card.dataset.damageTypes = JSON.stringify(dmgTypeKeys);

    // Guardar fórmula de dados puros para o crítico (apenas dados, sem modificadores fixos)
    // Ex: "1d10" para rolar novamente sem o +4 do modificador
    const critParts = damageParts.map(p => {
      const n = p.number ?? 1;
      const d = p.denomination ?? 6;
      return `${n}d${d}`;
    });
    if ( paGastos > 0 ) {
      const paDen = isSpell ? (damageParts[0]?.denomination ?? 6) : 4;
      critParts.push(`${paGastos}d${paDen}`);
    }
    if ( jjScaleBonus ) {
      // Só os DADOS da escala entram no crítico (sem a parte fixa), como base/PA
      const diceOnly = jjScaleBonus.split("+").map(t => t.trim()).filter(t => /^\d*d\d+$/i.test(t)).join(" + ");
      if ( diceOnly ) critParts.push(diceOnly);
    }
    // Dano Crítico Adicional da atividade (damage.critical.bonus) — entra junto
    // dos dados re-rolados; resolvido com o rollData p/ aceitar @mod etc.
    const bonusCritico = activity?.damage?.critical?.bonus;
    if ( bonusCritico ) {
      try { critParts.push(Roll.replaceFormulaData(String(bonusCritico), rollData)); }
      catch(e) { console.warn("JujutsuLegacy | Bônus de crítico inválido:", bonusCritico, e); }
    }
    card.dataset.critFormula = critParts.join(" + ");

    // Crítico Excedente (acerto supera a CA em 10+): em vez de dobrar os dados,
    // soma dados do DADO BASE da arma (primeira parte) — só na base. 2 dados se o
    // base for um único dado (1dX); 4 dados se o base já tiver mais de 1 dado (ex.
    // 2d6), pra manter a mesma proporção — ver _excedenteDiceCount.
    const baseDen = damageParts[0]?.denomination ?? 6;
    card.dataset.excedenteFormula = `${_excedenteDiceCount(damageParts)}d${baseDen}`;

    // Label do tipo de dano (todos juntos ou primeiro)
    const dmgLabel = rolls.map(r => r.label).join(" + ");

    // Renderizar no painel de dano (Layout B)
    const dmgPanel = card.querySelector("#jj-dmg-panel");
    const dmgVal   = card.querySelector("#jj-dmg-val");
    const dmgBreak = card.querySelector("#jj-dmg-break");

    if ( dmgPanel ) {
      dmgPanel.classList.add("visible");
      dmgPanel.querySelector(".jj-panel-label").textContent = dmgLabel || "Dano";
      dmgVal.textContent = totalDmg;
      dmgBreak.innerHTML = rolls.map(({ roll }) => _buildBreakdown(roll)).join('<span class="jj-mod-pip"> + </span>');
      if ( paRoll ) {
        dmgBreak.innerHTML += `<span class="jj-mod-pip"> + </span>${_buildBreakdown(paRoll)}<span class="jj-pa-badge">PA</span>`;
      }
      if ( escalaRoll ) {
        dmgBreak.innerHTML += `<span class="jj-mod-pip"> + </span>${_buildBreakdown(escalaRoll)}<span class="jj-pa-badge" style="color:#c0a0ff;border-color:#6040a0;">escala</span>`;
      }
      if ( masteryBonus ) {
        dmgBreak.innerHTML += `<span class="jj-mod-pip"> + </span>${masteryBonusBadge(masteryBonus)}`;
      }
    }

    // Mostrar footer com modificadores
    const footer = card.querySelector("#jj-footer");
    if ( footer ) {
      footer.classList.add("visible");
      const totalEl = footer.querySelector("#jj-total-display");
      if ( totalEl ) totalEl.textContent = totalDmg;
    }

    // Desabilitar botão de dano após rolar
    const dmgBtn = card.querySelector(".jj-damage-btn");
    if ( dmgBtn ) { dmgBtn.disabled = true; dmgBtn.style.opacity = "0.4"; dmgBtn.style.cursor = "default"; }

    // Crítico automático — o jogador ainda pode desmarcar/trocar.
    // Prioridade: 20 natural (Perfeito, dobra os dados) vence o Excedente.
    if ( card.dataset.autoCrit === "1" ) {
      const critBonus = await _rollDiceFormula(card.dataset.critFormula);
      card.dataset.critBonus = critBonus;
      const critCb = card.querySelector("input[data-mod='crit']");
      if ( critCb ) critCb.setAttribute("checked", "checked");
      const totalEl = card.querySelector("#jj-total-display");
      if ( totalEl ) totalEl.textContent = _applyModifier(totalDmg, "crit", critBonus);
      if ( dmgBreak && critBonus > 0 ) {
        dmgBreak.innerHTML += `<span class="jj-pa-badge" style="color:#e07040;border-color:#804020;">+${critBonus} crit (auto)</span>`;
      }
    } else if ( card.dataset.autoExcedente === "1" ) {
      const exc = await _rollDiceFormula(card.dataset.excedenteFormula);
      card.dataset.excedenteBonus = exc;
      const excCb = card.querySelector("input[data-mod='excedente']");
      if ( excCb ) excCb.setAttribute("checked", "checked");
      const totalEl = card.querySelector("#jj-total-display");
      if ( totalEl ) totalEl.textContent = _applyModifier(totalDmg, "excedente", exc);
      if ( dmgBreak && exc > 0 ) {
        dmgBreak.innerHTML += `<span class="jj-pa-badge" style="color:#40a0e0;border-color:#205080;">+${exc} exc (auto)</span>`;
      }
    }

    await _updateCardMessage(message, card.outerHTML);
  }

  // ── DIALOG DE PA ─────────────────────────────────────────────────────────────
  async function _paDialog(actor, profBonus, denomination) {
    const paDisp = actor.system?.energy?.generated ?? 0;
    // Impacto Ecoante (treinamento geral): amplia o limite de dados da Explosão
    // Ofensiva em +2 por rank (Base +2, Evolução +4, Perfeição +6). NPCs não têm
    // treinamentos — a leitura opcional cobre isso (limite normal).
    const ecoanteRank = actor.system?.trainings?.impactoEcoante?.rank ?? 0;
    const ecoanteBonus = ecoanteRank * 2;
    const maxPA  = Math.min(profBonus + ecoanteBonus, paDisp);

    if ( maxPA === 0 ) return 0; // sem PA disponível, não pergunta

    return foundry.applications.api.DialogV2.wait({
      window: { title: "⚡ Explosão Ofensiva" },
      content: `
        <div style="padding: 8px 0;">
          <p style="margin:0 0 8px">Gastar PA para adicionar dados de dano?</p>
          <p style="margin:0 0 4px; font-size:12px; color:#aaa;">
            PA Gerada disponível: <strong>${paDisp}</strong> &nbsp;|&nbsp;
            Máximo: <strong>${maxPA}</strong> d${denomination}${ecoanteBonus
              ? ` <span style="color:#c0a0ff">(limite ${profBonus} + ${ecoanteBonus} Impacto Ecoante)</span>`
              : ""}
          </p>
          <div style="display:flex; align-items:center; gap:8px; margin-top:8px;">
            <label style="flex:0 0 auto">Dados de PA:</label>
            <input type="number" id="jj-pa-input"
                   value="0" min="0" max="${maxPA}"
                   style="width:60px; text-align:center;">
            <span style="font-size:12px; color:#aaa;">d${denomination} por dado</span>
          </div>
        </div>`,
      buttons: [
        {
          label:    "Confirmar",
          action:   "ok",
          default:  true,
          callback: (event, button, dialog) => {
            const input = dialog.element?.querySelector("#jj-pa-input") ?? document.querySelector("#jj-pa-input");
            return Math.max(0, Math.min(Number(input?.value ?? 0), maxPA));
          }
        },
        {
          label:  "Sem PA",
          action: "skip",
          callback: () => 0
        },
        {
          label:  "Cancelar",
          action: "cancel",
          callback: () => null
        }
      ],
      rejectClose: false,
      close: () => null
    });
  }

  // ── CONSUMIR PA GERADA ───────────────────────────────────────────────────────
  async function _consumePA(actor, quantidade, reducaoJaAplicada = false) {
    const custo = reducaoJaAplicada ? quantidade : Math.max(0, quantidade - _seisOlhosReduction(actor));
    const payer = _paPayer(actor); // invocação → invocador; senão, o próprio
    const atual = payer.system?.energy?.generated ?? 0;
    if ( atual < custo ) {
      ui.notifications.warn(`${payer.name} não tem PA Gerada suficiente! (${atual} disponível, ${custo} necessário)`);
      return false;
    }
    await payer.update({ "system.energy.generated": atual - custo }, { isEnergySystem: true });
    if ( payer !== actor ) ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `🔗 <strong>${actor.name}</strong> (invocação) gastou <strong>${custo} PA Gerada</strong> de <strong>${payer.name}</strong>.`
    });
    return true;
  }

  // ── HELPERS ──────────────────────────────────────────────────────────────────

  function _resolveCardData(card) {
    const actorId    = card.dataset.actorId;
    const tokenId    = card.dataset.tokenId;
    const itemId     = card.dataset.itemId;
    const activityId = card.dataset.activityId;
    const profBonus  = Number(card.dataset.profBonus ?? 2);
    const paBonus    = Number(card.dataset.paBonus ?? 4);

    let actor = tokenId
      ? canvas.tokens.get(tokenId)?.actor
      : game.actors.get(actorId);

    const item     = actor?.items.get(itemId);
    const activity = item?.system.activities?.get(activityId);

    return { actor, item, activity, profBonus, paBonus };
  }

  function _buildDamageFormula(part, actor, withMod = true) {
    const num  = part.number ?? 1;
    const den  = part.denomination ?? 6;
    const bon  = part.bonus ?? "";
    const mod  = (withMod && actor) ? _resolveAbilityMod(part, actor) : 0;
    let formula = `${num}d${den}`;
    if ( bon ) formula += ` + ${bon}`;
    if ( mod ) formula += ` + ${mod}`;
    return formula;
  }

  // Conta quantos dados de UMA denominação específica aparecem numa fórmula (ex.:
  // bonus="1d6" com denomination=6 → 1). Ignora termos de denominação diferente e
  // modificadores fixos — serve pra somar dados "escondidos" no bonus da mesma
  // denominação do dado principal, tratando "1d6" (number) + "1d6" (bonus) como os
  // mesmos 2 dados de uma "2d6" declarada direto (number:2) — NÃO como algo diferente.
  function _countMatchingDice(bonusFormula, denomination) {
    if ( !bonusFormula ) return 0;
    let total = 0;
    for ( const m of String(bonusFormula).matchAll(/(\d*)d(\d+)/gi) ) {
      if ( Number(m[2]) === denomination ) total += (m[1] ? Number(m[1]) : 1);
    }
    return total;
  }

  // Crítico Excedente (acerto supera a CA em 10+): soma dados do DADO BASE (primeira
  // parte de dano). Quando o dado base já tem MAIS DE 1 dado (contando também dados
  // de mesma denominação escondidos no `bonus` — ex. number:1 + bonus:"1d6" conta
  // como 2, igual a number:2 direto), dobra pra 4 dados em vez de 2 — senão o "passo"
  // de dano fica distorcido ao subir de 1d12 pra 2d6 (o teto do dado único):
  //   1d12 + Excedente(2d12) = 3d12 → máx 36
  //   2d6  + Excedente(2d6)  = 4d6  → máx 24  (proporcionalmente pior que o 1d12!)
  //   2d6  + Excedente(4d6)  = 6d6  → máx 36  (mesma proporção: ×3 o nº de dados)
  function _excedenteDiceCount(damageParts) {
    const base = damageParts?.[0];
    if ( !base ) return 2;
    const baseTotalDados = (base.number ?? 1) + _countMatchingDice(base.bonus, base.denomination ?? 6);
    return baseTotalDados > 1 ? 4 : 2;
  }

  function _resolveAbilityMod(part, actor) {
    // Por padrão usa o mod da habilidade de ataque do ator
    const ability = actor.system?.attributes?.spellcasting
      ?? Object.keys(actor.system?.abilities ?? {})[0]
      ?? "str";
    return actor.system?.abilities?.[ability]?.mod ?? 0;
  }

  function _damageTypeLabel(types) {
    if ( !types?.length ) return "Dano";
    const labels = {
      bludgeoning: "Contundente", piercing: "Perfurante", slashing: "Cortante",
      fire: "Fogo", cold: "Frio", lightning: "Raio", acid: "Ácido",
      poison: "Veneno", necrotic: "Necrótico", radiant: "Radiante",
      thunder: "Trovão", force: "Força", psychic: "Psíquico"
    };
    return types.map(t => labels[t] ?? t).join(" + ");
  }

function _buildBreakdown(roll) {
    const diceParts = [];
    const modParts  = [];

    for ( const term of roll.terms ) {
      if ( term.results ) {
        const spans = term.results.map(r => {
          const active = !r.discarded;
          let cls;
          if ( !active )            cls = "jj-die discarded";
          else if ( r.result === term.faces ) cls = "jj-die max";
          else if ( r.result === 1 )          cls = "jj-die min";
          else                                cls = "jj-die active";
          return `<span class="${cls}">${r.result}</span>`;
        });
        diceParts.push(spans.join('<span class="jj-mod-pip">, </span>'));
      } else if ( typeof term.number === "number" && term.number !== 0 ) {
        modParts.push(`<span class="jj-mod-pip">${term.number > 0 ? "+" : ""}${term.number}</span>`);
      }
    }

    const diceHtml = diceParts.length
      ? `<span class="jj-break-bracket">[</span>${diceParts.join('<span class="jj-mod-pip">, </span>')}<span class="jj-break-bracket">]</span>`
      : "";
    return diceHtml + modParts.join("");
  }

  async function _updateCardMessage(message, cardHTML) {
    await message.update({ content: cardHTML });
  }

  // ── MODIFICADOR DE DANO ──────────────────────────────────────────────────────
  // Nota: "crit" é tratado separadamente em _handleCritRoll (rola dados extras)
  // Os demais modificam o total base diretamente
  function _applyModifier(base, mod, critBonus = 0) {
    switch ( mod ) {
      case "half":      return Math.floor(base / 2);
      case "quarter":   return Math.floor(base / 4);
      case "crit":      return base + critBonus; // Perfeito: dobra os dados (rola tudo de novo)
      case "excedente": return base + critBonus; // Excedente: +2 ou +4 dados do dado base (ver _excedenteDiceCount)
      case "kokusen":   return Math.ceil((base + critBonus) * 2.5); // Fulgor Negro ×2,5 no total
      default:          return base;
    }
  }

  // ── ROLAR DADOS EXTRAS DE CRÍTICO ────────────────────────────────────────────
  // Usado tanto pelo Crítico Perfeito (critFormula = todos os dados) quanto pelo
  // Crítico Excedente (excedenteFormula = 2 dados do dado base).
  async function _rollDiceFormula(formula) {
    if ( !formula ) return 0;
    try {
      const roll = await new Roll(formula).evaluate();
      if ( game.dice3d ) game.dice3d.showForRoll(roll, game.user, true); // sem await
      return roll.total;
    } catch(e) {
      console.error("JujutsuLegacy | Erro ao rolar dados de crítico:", e);
      return 0;
    }
  }

  // ── APLICAR DANO NOS TOKENS SELECIONADOS ────────────────────────────────────
  async function _applyDamageToSelected(amount, card, damageTypes = []) {
    await applyDamageToSelectedTokens(amount, card, "[data-action='jj-apply-damage']", damageTypes);
  }

})();

