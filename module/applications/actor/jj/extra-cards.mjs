/**
 * jj/extra-cards.mjs
 * Chat cards customizados para atividades não-ataque (damage, heal, save, check, utility).
 */

import { getMasteryTechniqueBonus, masteryBonusBadge } from "./mastery-milestones.mjs";
import { applyDamageToSelectedTokens } from "./damage-application.mjs";
import { promptJJScale } from "./jj-scale.mjs";
import { activateUpkeep } from "./constant-cost.mjs";
import { resetHealLimitsByTechnique } from "./heal-limit.mjs";

/* ============================================================
 * CARDS CUSTOMIZADOS — Dano, Cura, Salvaguarda, Teste, Usar
 * ============================================================ */
(function _registerJujutsuExtraCards() {

  const CARD_TYPES = new Set(["damage", "heal", "save", "check", "utility"]);

  // ── HOOK PRINCIPAL ───────────────────────────────────────────────────────────
  Hooks.on("dnd5e.preUseActivity", (activity, config, dialog) => {
    const item = activity.item;
    if ( !item ) return;
    if ( !CARD_TYPES.has(activity.type) ) return;
    // Limite de Cura: bloqueia heal esgotado antes de postar o card (não desperdiça ação).
    if ( activity.type === "heal" ) {
      const lim = activity.getHealLimit?.();
      if ( lim?.enabled && lim.remaining <= 0 ) {
        ui.notifications.warn(`${item.name}: limite de cura esgotado — resete para curar novamente.`);
        return false;
      }
    }
    activateUpkeep(activity); // ativa Custo Constante/Concentração/Duração (o return false abaixo barraria o listener global)
    resetHealLimitsByTechnique(activity); // reset-por-técnica (idem)
    _postExtraCard(activity, item);
    return false;
  });

  // ── CRIAR CARD ───────────────────────────────────────────────────────────────
  async function _postExtraCard(activity, item) {
    const actor = item.actor;
    const type  = activity.type;

    // Consumir PA configurado
    if ( actor ) {
      const targets = activity.consumption?.targets ?? [];

      // Redução de PA do Seis Olhos
      const seisOlhosItem = actor.items?.find(i => i.name === "Seis Olhos" && i.type === "feat");
      const seisOlhosMode = actor.getFlag("jujutsu-system", "seisOlhosMode");
      let paReduction = 0;
      if ( seisOlhosItem && seisOlhosMode ) {
        const prof    = actor.system.attributes?.prof ?? 2;
        const halfProf = Math.max(1, Math.floor(prof / 2));
        paReduction = seisOlhosMode === "full" ? prof : halfProf;
      }

      for ( const target of targets ) {
        const isGerada = target.target === "energy.generated";
        const isTotal  = target.target === "energy.total";
        if ( !isGerada && !isTotal ) continue;
        const custoBase = Number(target.value ?? 0);
        if ( custoBase <= 0 ) continue;
        const custo = Math.max(1, custoBase - paReduction);
        const campo = isGerada ? "system.energy.generated" : "system.energy.total";
        const atual = isGerada ? (actor.system?.energy?.generated ?? 0) : (actor.system?.energy?.total ?? 0);
        const label = isGerada ? "PA Gerada" : "PA Total";
        if ( atual < custo ) {
          ui.notifications.warn(`${actor.name} não tem ${label} suficiente! (${atual} disponível, ${custo} necessário)`);
          return;
        }
        await actor.update({ [campo]: atual - custo }, { isEnergySystem: true });
      }
    }

    const description = item.system.description?.value ?? "";
    const hasDescription = description && description !== "<p></p>";
    const typeConfig = _getTypeConfig(activity, item, actor);

    const cardData = {
      itemId:      item.id,
      actorId:     actor?.id ?? null,
      tokenId:     actor?.token?.id ?? null,
      activityId:  activity.id,
      itemName:    item.name,
      itemImg:     item.img,
      type,
      typeLabel:   typeConfig.typeLabel,
      hasDescription,
      description: hasDescription ? description : "",
      btnLabel:    typeConfig.btnLabel,
      btnIcon:     typeConfig.btnIcon,
      btnColor:    typeConfig.btnColor,
      hasApply:    type === "damage",
    };

    const content = _renderExtraCardHTML(cardData);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content,
      flags: { "jujutsu-system": { jujutsuExtraCard: true, cardData } }
    });
  }

  // ── CONFIG POR TIPO ──────────────────────────────────────────────────────────
  function _getTypeConfig(activity, item, actor) {
    const type = activity.type;
    if ( type === "damage" ) {
      return { typeLabel: "Dano", btnLabel: "Rolar Dano", btnIcon: "fa-burst", btnColor: "#c06040" };
    } else if ( type === "heal" ) {
      return { typeLabel: "Cura", btnLabel: "Rolar Cura", btnIcon: "fa-heart", btnColor: "#40a060" };
    } else if ( type === "save" ) {
      const dc = activity.save?.dc?.value ?? activity.save?.dc ?? "?";
      return { typeLabel: "Salvaguarda", btnLabel: `Salv. CD ${dc}`, btnIcon: "fa-shield-halved", btnColor: "#6040c0" };
    } else if ( type === "check" ) {
      return { typeLabel: "Teste", btnLabel: "Rolar Teste", btnIcon: "fa-dice-d20", btnColor: "#4080c0" };
    } else if ( type === "utility" ) {
      return { typeLabel: "Usar", btnLabel: "Usar", btnIcon: "fa-wand-sparkles", btnColor: "#8060a0" };
    }
    return { typeLabel: "Ação", btnLabel: "Rolar", btnIcon: "fa-dice-d20", btnColor: "#8080a0" };
  }

  // ── HTML DO CARD ─────────────────────────────────────────────────────────────
  function _renderExtraCardHTML(data) {
    const footerHTML = data.hasApply ? `
  <div class="jj-footer" id="jj-extra-footer">
    <div class="jj-mods">
      <label class="jj-mod-check" title="Metade"><input type="checkbox" data-mod="half"> ½</label>
      <label class="jj-mod-check" title="Um quarto"><input type="checkbox" data-mod="quarter"> ¼</label>
      <label class="jj-mod-check jj-crit-check" title="Crítico"><input type="checkbox" data-mod="crit"> Crit</label>
    </div>
    <span class="jj-footer-total">Total <strong id="jj-extra-total">0</strong></span>
    <button type="button" class="jj-apply-btn" data-action="jj-extra-apply">Aplicar</button>
  </div>` : "";

    return `<div class="jujutsu-card jj-extra-card"
     data-item-id="${data.itemId}"
     data-actor-id="${data.actorId ?? ""}"
     data-token-id="${data.tokenId ?? ""}"
     data-activity-id="${data.activityId}"
     data-card-type="${data.type}">
  <div class="jj-top-bar">
    <img class="jj-top-icon" src="${data.itemImg}" alt="${data.itemName}">
    <span class="jj-top-name">${data.itemName}</span>
    <span class="jj-top-sub">${data.typeLabel}</span>
  </div>
  ${data.hasDescription ? `<div class="jj-description">${data.description}</div>` : ""}
  <div class="jj-roll-btns" style="grid-template-columns: 1fr;">
    <button type="button" class="jj-btn jj-extra-btn" data-action="jj-extra-roll"
            style="background: color-mix(in srgb, ${data.btnColor} 20%, #0e0e18); color: ${data.btnColor};">
      <i class="fas ${data.btnIcon}"></i> ${data.btnLabel}
    </button>
  </div>
  <div class="jj-panels" style="grid-template-columns: 1fr;">
    <div class="jj-panel" id="jj-extra-panel">
      <div class="jj-panel-label" id="jj-extra-label">${data.typeLabel}</div>
      <div class="jj-panel-val ${data.type === "heal" ? "jj-heal-val" : data.type === "damage" ? "dmg" : ""}" id="jj-extra-val">—</div>
      <div class="jj-panel-breakdown" id="jj-extra-break"></div>
    </div>
  </div>
  ${footerHTML}
</div>`;
  }

  // ── LISTENERS ────────────────────────────────────────────────────────────────
  Hooks.on("renderChatMessageHTML", (message, html) => {
    const root = html instanceof HTMLElement ? html : html[0];
    if ( !root ) return;
    const card = root.querySelector(".jj-extra-card");
    if ( !card ) return;

    card.querySelector("[data-action='jj-extra-roll']")?.addEventListener("click", async (e) => {
      e.preventDefault();
      await _handleExtraRoll(card, message);
    });

    card.querySelector("[data-action='jj-extra-apply']")?.addEventListener("click", () => {
      const base = Number(card.dataset.totalDmg ?? 0);
      const mod  = card.querySelector(".jj-mod-check input:checked")?.dataset.mod ?? null;
      const final = _applyMod(base, mod);
      _applyDmg(final, card);
    });

    card.querySelectorAll(".jj-mod-check input").forEach(cb => {
      cb.addEventListener("change", () => {
        card.querySelectorAll(".jj-mod-check input").forEach(o => { if (o !== cb) o.checked = false; });
        const base = Number(card.dataset.totalDmg ?? 0);
        const mod  = cb.checked ? cb.dataset.mod : null;
        const el   = card.querySelector("#jj-extra-total");
        if ( el ) el.textContent = _applyMod(base, mod);
      });
    });
  });

  // Limite de Cura: capa a cura ao saldo restante e consome (o card customizado
  // não passa pelo rollDamage padrão, então aplicamos o limite aqui).
  async function _applyHealLimit(activity, type, total) {
    if ( type !== "heal" ) return total;
    const lim = activity?.getHealLimit?.();
    if ( !lim?.enabled ) return total;
    const aplicado = Math.max(0, Math.min(total, lim.remaining));
    if ( aplicado < total ) ui.notifications.info(`Cura limitada a ${aplicado} (saldo do Limite de Cura).`);
    if ( aplicado > 0 ) await activity.update({ "healLimit.spent": Math.min(lim.max, lim.spent + aplicado) });
    return aplicado;
  }

  // ── HANDLER PRINCIPAL ────────────────────────────────────────────────────────
  async function _handleExtraRoll(card, message) {
    const actorId    = card.dataset.actorId;
    const tokenId    = card.dataset.tokenId;
    const itemId     = card.dataset.itemId;
    const activityId = card.dataset.activityId;
    const type       = card.dataset.cardType;

    const actor    = tokenId ? canvas.tokens.get(tokenId)?.actor : game.actors.get(actorId);
    const item     = actor?.items.get(itemId);
    const activity = item?.system.activities?.get(activityId);
    if ( !actor || !item ) return;

    const rollData = actor.getRollData();
    const panel    = card.querySelector("#jj-extra-panel");
    const valEl    = card.querySelector("#jj-extra-val");
    const breakEl  = card.querySelector("#jj-extra-break");
    const labelEl  = card.querySelector("#jj-extra-label");

    if ( type === "damage" || type === "heal" ) {
      const damageParts  = activity?.damage?.parts ?? [];
      const damageLabels = item.labels?.damages ?? [];
      // Maestria 3: modificador principal somado ao dano/cura de técnicas
      const masteryBonus = getMasteryTechniqueBonus(actor, item);

      // Escala de Energia (JJ) — dropdown de PA; cancelar aborta a rolagem
      const escala = await promptJJScale({ actor, activity });
      if ( escala === null ) return;
      let bonusRoll = null;
      if ( escala.bonusFormula ) {
        bonusRoll = await new Roll(escala.bonusFormula, rollData).evaluate();
        game.dice3d?.showForRoll(bonusRoll, game.user, true);
      }
      const bonusTotal = bonusRoll?.total ?? 0;
      const bonusBreak = bonusRoll
        ? `<span class="jj-mod-pip"> + </span>${_buildBreakdown(bonusRoll)}<span class="jj-pa-badge">⚡${escala.paGasto}PA</span>`
        : "";
      // Maestria só vale em rolagens de DADO, não em valores fixos (regra do sistema).

      // Para heal sem damage.parts, tenta activity.healing
      if ( damageParts.length === 0 ) {
        const healFormula = activity?.healing?.formula ?? "1d6";
        const roll = await new Roll(healFormula, rollData).evaluate();
        game.dice3d?.showForRoll(roll, game.user, true);
        const mastery = (roll.dice?.length > 0) ? masteryBonus : 0;
        const masteryBreak = mastery ? `<span class="jj-mod-pip"> + </span>${masteryBonusBadge(mastery)}` : "";
        const total = await _applyHealLimit(activity, type, roll.total + mastery + bonusTotal);
        card.dataset.totalDmg = total;
        if ( panel ) panel.classList.add("visible");
        if ( labelEl ) labelEl.textContent = "Cura";
        if ( valEl ) { valEl.textContent = total; valEl.className = "jj-panel-val jj-heal-val"; }
        if ( breakEl ) breakEl.innerHTML = _buildBreakdown(roll) + masteryBreak + bonusBreak;
        _showHealFooter(card, total);
        return;
      }

      const rollPromises = damageParts.map(async (part, i) => {
        const lbl     = damageLabels[i];
        const formula = lbl?.formula ?? _buildDmgFormula(part, actor);
        const label   = lbl?.label ?? (type === "heal" ? "Cura" : "Dano");
        const roll    = await new Roll(formula, rollData).evaluate();
        return { roll, label };
      });

      const resolved = await Promise.all(rollPromises);
      if ( game.dice3d ) Promise.all(resolved.map(r => game.dice3d.showForRoll(r.roll, game.user, true)));

      // Maestria só em rolagens de dado: aplica se ALGUMA parte tiver dado.
      const mastery = resolved.some(r => r.roll.dice?.length > 0) ? masteryBonus : 0;
      const masteryBreak = mastery ? `<span class="jj-mod-pip"> + </span>${masteryBonusBadge(mastery)}` : "";
      const total = await _applyHealLimit(activity, type, resolved.reduce((s, r) => s + r.roll.total, 0) + mastery + bonusTotal);
      card.dataset.totalDmg = total;
      if ( panel ) panel.classList.add("visible");
      if ( labelEl ) labelEl.textContent = resolved.map(r => r.label).join(" + ") || (type === "heal" ? "Cura" : "Dano");
      if ( valEl ) { valEl.textContent = total; valEl.className = `jj-panel-val ${type === "heal" ? "jj-heal-val" : "dmg"}`; }
      if ( breakEl ) breakEl.innerHTML = resolved.map(r => _buildBreakdown(r.roll)).join('<span class="jj-mod-pip"> + </span>') + masteryBreak + bonusBreak;

      if ( type === "damage" ) {
        const footer = card.querySelector("#jj-extra-footer");
        if ( footer ) {
          footer.classList.add("visible");
          const totalEl = footer.querySelector("#jj-extra-total");
          if ( totalEl ) totalEl.textContent = total;
        }
      } else {
        _showHealFooter(card, total);
      }

    } else if ( type === "save" ) {
      // No V14, activity.save.ability é um Set — usar .first()
      const abilitySet   = activity?.save?.ability;
      const ability      = (abilitySet instanceof Set ? abilitySet.first() : null)
                        ?? (typeof abilitySet === "string" ? abilitySet : null)
                        ?? "con";
      const dc           = activity?.save?.dc?.value ?? activity?.save?.dc ?? "?";
      const abilityLabel = CONFIG.DND5E.abilities[ability]?.label ?? ability.toUpperCase();
      const targetToken  = [...(game.user.targets ?? [])][0] ?? canvas.tokens?.controlled?.[0];
      const targetActor  = targetToken?.actor;

      if ( targetActor ) {
        const saveMod = targetActor.system?.abilities?.[ability]?.save?.value
                     ?? targetActor.system?.abilities?.[ability]?.mod
                     ?? 0;
        const roll = await new Roll(`1d20 + ${Number(saveMod)}`, targetActor.getRollData()).evaluate();
        game.dice3d?.showForRoll(roll, game.user, true);
        const isNat20 = roll.dice[0]?.results[0]?.result === 20;
        const isNat1  = roll.dice[0]?.results[0]?.result === 1;
        const success  = roll.total >= Number(dc);
        if ( panel ) panel.classList.add("visible");
        if ( labelEl ) labelEl.textContent = `Salv. ${abilityLabel} (${targetActor.name})`;
        if ( valEl ) {
          valEl.textContent = roll.total;
          valEl.className   = "jj-panel-val" + (isNat20 ? " nat20" : isNat1 ? " nat1" : "");
          valEl.style.color = success ? "#60c080" : "#e05050";
        }
        if ( breakEl ) breakEl.innerHTML = _buildBreakdown(roll)
          + `<span class="jj-mod-pip"> vs CD ${dc} — ${success ? "✓ Sucesso" : "✗ Falha"}</span>`;

      } else {
        if ( panel ) panel.classList.add("visible");
        if ( labelEl ) labelEl.textContent = `Salv. ${abilityLabel}`;
        if ( valEl ) { valEl.textContent = `CD ${dc}`; valEl.className = "jj-panel-val"; valEl.style.fontSize = "28px"; }
        if ( breakEl ) breakEl.innerHTML = `<span class="jj-mod-pip">CD ${dc} — selecione um alvo para rolar</span>`;
      }

      // Botão de dano — sempre visível se houver damageParts, independente de alvo
      const damageParts = activity?.damage?.parts ?? [];
      if ( damageParts.length && !card.querySelector("[data-action='jj-save-damage']") ) {
        const dmgFooter = document.createElement("div");
        dmgFooter.className = "jj-footer visible";
        dmgFooter.innerHTML = `
          <span class="jj-footer-total" style="color:#c06040">Dano da Salvaguarda</span>
          <button type="button" class="jj-apply-btn" data-action="jj-save-damage"
                  style="background:#2a1010;border-color:#804020;color:#c06040">
            <i class="fas fa-burst"></i> Rolar Dano
          </button>`;
        dmgFooter.querySelector("[data-action='jj-save-damage']").addEventListener("click", async () => {
          const dmgLabels = item.labels?.damages ?? [];
          const rollData  = actor.getRollData();
          const dmgRolls  = dmgLabels.length > 0
            ? await Promise.all(dmgLabels.map(async (lbl) => {
                const r = await new Roll(lbl.formula, rollData).evaluate();
                return { r, label: lbl.label ?? "Dano" };
              }))
            : await Promise.all(damageParts.map(async (part, i) => {
                const formula = _buildDmgFormula(part, actor, i === 0);
                const r = await new Roll(formula, rollData).evaluate();
                return { r, label: "Dano" };
              }));
          if ( game.dice3d ) Promise.all(dmgRolls.map(({ r }) => game.dice3d.showForRoll(r, game.user, true)));

          // Escala de Energia (JJ) no dano da salvaguarda
          const escala = await promptJJScale({ actor, activity });
          if ( escala === null ) return;
          let bonusRoll = null;
          if ( escala.bonusFormula ) {
            bonusRoll = await new Roll(escala.bonusFormula, rollData).evaluate();
            if ( game.dice3d ) game.dice3d.showForRoll(bonusRoll, game.user, true);
          }
          const totalDmg = dmgRolls.reduce((s, { r }) => s + r.total, 0) + (bonusRoll?.total ?? 0);
          const bonusBreak = bonusRoll
            ? `<span class="jj-mod-pip"> + </span>${_buildBreakdown(bonusRoll)}<span class="jj-pa-badge">⚡${escala.paGasto}PA</span>`
            : "";

          const dmgPanel = document.createElement("div");
          dmgPanel.className = "jj-panels";
          dmgPanel.style.cssText = "margin-top:6px;grid-template-columns:1fr;";
          dmgPanel.innerHTML = `
            <div class="jj-panel visible">
              <div class="jj-panel-label">Dano</div>
              <div class="jj-panel-val dmg">${totalDmg}</div>
              <div class="jj-panel-breakdown">${dmgRolls.map(({ r }) => _buildBreakdown(r)).join('<span class="jj-mod-pip"> + </span>')}${bonusBreak}</div>
            </div>`;
          card.appendChild(dmgPanel);

          const applyFooter = document.createElement("div");
          applyFooter.className = "jj-footer visible";
          applyFooter.innerHTML = `
            <div class="jj-mods">
              <label class="jj-mod-check" title="Metade"><input type="checkbox" data-save-mod="half"> ½</label>
              <label class="jj-mod-check" title="Um quarto"><input type="checkbox" data-save-mod="quarter"> ¼</label>
            </div>
            <span class="jj-footer-total">Total <strong id="jj-save-total">${totalDmg}</strong></span>
            <button type="button" class="jj-apply-btn" data-action="jj-apply-save-dmg">Aplicar</button>`;
          applyFooter.querySelectorAll("[data-save-mod]").forEach(cb => {
            cb.addEventListener("change", () => {
              applyFooter.querySelectorAll("[data-save-mod]").forEach(o => { if (o !== cb) o.checked = false; });
              const el = applyFooter.querySelector("#jj-save-total");
              if ( el ) el.textContent = _applyMod(totalDmg, cb.checked ? cb.dataset.saveMod : null);
            });
          });
          applyFooter.querySelector("[data-action='jj-apply-save-dmg']").addEventListener("click", () => {
            const mod = applyFooter.querySelector("[data-save-mod]:checked")?.dataset.saveMod ?? null;
            _applyDmg(_applyMod(totalDmg, mod), card);
          });
          card.appendChild(applyFooter);
          dmgFooter.remove();
        });
        card.appendChild(dmgFooter);
      }

    } else if ( type === "check" ) {
      const ability      = activity?.check?.associated?.[0] ?? "int";
      const abilityLabel = CONFIG.DND5E.abilities[ability]?.label ?? ability.toUpperCase();
      const mod          = actor.system?.abilities?.[ability]?.mod ?? 0;
      const roll         = await new Roll(`1d20 + ${mod}`, rollData).evaluate();
      game.dice3d?.showForRoll(roll, game.user, true);
      const isNat20 = roll.dice[0]?.results[0]?.result === 20;
      const isNat1  = roll.dice[0]?.results[0]?.result === 1;
      if ( panel ) panel.classList.add("visible");
      if ( labelEl ) labelEl.textContent = `Teste de ${abilityLabel}`;
      if ( valEl ) { valEl.textContent = roll.total; valEl.className = "jj-panel-val" + (isNat20 ? " nat20" : isNat1 ? " nat1" : ""); }
      if ( breakEl ) breakEl.innerHTML = _buildBreakdown(roll);

    } else if ( type === "utility" ) {
      const formula = activity?.roll?.formula ?? activity?.rolls?.[0]?.formula ?? null;
      if ( formula ) {
        const roll = await new Roll(formula, rollData).evaluate();
        game.dice3d?.showForRoll(roll, game.user, true);
        if ( panel ) panel.classList.add("visible");
        if ( labelEl ) labelEl.textContent = item.name;
        if ( valEl ) { valEl.textContent = roll.total; valEl.className = "jj-panel-val"; }
        if ( breakEl ) breakEl.innerHTML = _buildBreakdown(roll);
      } else {
        if ( panel ) panel.classList.add("visible");
        if ( labelEl ) labelEl.textContent = "Usado!";
        if ( valEl ) { valEl.textContent = "✓"; valEl.className = "jj-panel-val"; valEl.style.color = "#60c080"; }
        if ( breakEl ) breakEl.innerHTML = `<span class="jj-mod-pip">${item.name} ativado</span>`;
      }
    }
  }

  // ── HELPER: botão de aplicar cura ────────────────────────────────────────────
  function _showHealFooter(card, total) {
    if ( card.querySelector("[data-action='jj-apply-heal']") ) return;
    const healFooter = document.createElement("div");
    healFooter.className = "jj-footer visible";
    healFooter.style.cssText = "border-top-color: #30a030;";
    healFooter.innerHTML = `
      <span class="jj-footer-total" style="color:#60c080">Cura <strong>${total}</strong></span>
      <button type="button" class="jj-apply-btn" data-action="jj-apply-heal"
              style="background:#1a3a1a;border-color:#30a030;color:#60c080">Aplicar Cura</button>`;
    healFooter.querySelector("[data-action='jj-apply-heal']").addEventListener("click", async () => {
      const targets = [...(game.user.targets ?? [])];
      const tokens  = targets.length ? targets : (canvas.tokens?.controlled ?? []);
      if ( !tokens.length ) { ui.notifications.warn("Selecione um token para aplicar a cura."); return; }
      for ( const token of tokens ) {
        const a  = token.actor ?? token;
        const hp = a?.system?.attributes?.hp;
        if ( !hp ) continue;
        const novoHP = Math.min(hp.effectiveMax ?? hp.max, (hp.value ?? 0) + total);
        await a.update({ "system.attributes.hp.value": novoHP });
      }
      ui.notifications.info(`${total} de cura aplicada!`);
      const btn = healFooter.querySelector("[data-action='jj-apply-heal']");
      if ( btn ) { btn.textContent = `✓ ${total} curado`; btn.disabled = true; btn.style.opacity = "0.6"; }
    });
    card.appendChild(healFooter);
  }

  // ── HELPERS ──────────────────────────────────────────────────────────────────
  function _buildDmgFormula(part, actor) {
    const num     = part.number ?? 1;
    const den     = part.denomination ?? 6;
    const bon     = part.bonus ?? "";
    const ability = actor.system?.attributes?.spellcasting ?? "str";
    const mod     = actor.system?.abilities?.[ability]?.mod ?? 0;
    let f = `${num}d${den}`;
    if ( bon ) f += ` + ${bon}`;
    if ( mod ) f += ` + ${mod}`;
    return f;
  }

  function _buildBreakdown(roll) {
    const diceParts = [];
    const modParts  = [];

    for ( const term of roll.terms ) {
      if ( term.results ) {
        const spans = term.results.map(r => {
          let cls;
          if ( r.discarded )                  cls = "jj-die discarded";
          else if ( r.result === term.faces )  cls = "jj-die max";
          else if ( r.result === 1 )           cls = "jj-die min";
          else                                 cls = "jj-die active";
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

  function _applyMod(base, mod) {
    if ( mod === "half" )    return Math.floor(base / 2);
    if ( mod === "quarter" ) return Math.floor(base / 4);
    if ( mod === "crit" )    return base * 2;
    return base;
  }

  async function _applyDmg(amount, card) {
    await applyDamageToSelectedTokens(amount, card, "[data-action='jj-extra-apply']");
  }

})();
