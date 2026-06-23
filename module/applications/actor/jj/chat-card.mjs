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
 *      (0 até dobro do bônus de proficiência, limitado pela PA gerada disponível)
 *   4. Rolagem de acerto aparece no card com breakdown clicável
 *   5. Ao clicar em Rolar Dano: mesma pergunta de PA
 *   6. Dano aparece no card — se múltiplos tipos, divide em colunas
 *
 * INTEGRAÇÃO: adicionar ao final do character-sheet.mjs (como o consumo de PA)
 */

(function _registerJujutsuChatCard() {

  // ── HOOK PRINCIPAL: intercepta o uso de qualquer atividade ──────────────────
  Hooks.on("dnd5e.preUseActivity", (activity, config, dialog) => {
    const item = activity.item;
    if ( !item ) return;

    // Só interceptamos atividades de ataque
    if ( activity.type !== "attack" ) return;

    activateUpkeep(activity); // ativa Custo Constante/Concentração/Duração antes do veto
    resetHealLimitsByTechnique(activity); // reset-por-técnica (o veto abaixo barraria o listener global)
    // Cancelar o comportamento nativo
    _postJujutsuCard(activity, item);
    return false;
  });

  // ── CRIAR O CARD CUSTOMIZADO ─────────────────────────────────────────────────
  async function _postJujutsuCard(activity, item) {
    const actor = item.actor;
    const isSpell = item.type === "spell";

    // Processar consumo de PA configurado na activity (Attribute type)
    // antes de criar o card, já que bloqueamos o processamento nativo
    if ( actor ) {
      const targets = activity.consumption?.targets ?? [];
      for ( const target of targets ) {
        const isGerada = target.target === "energy.generated";
        const isTotal  = target.target === "energy.total";
        if ( !isGerada && !isTotal ) continue;
        const custo = Number(target.value ?? 0);
        if ( custo <= 0 ) continue;
        const campo = isGerada ? "system.energy.generated" : "system.energy.total";
        const atual = isGerada
          ? (actor.system?.energy?.generated ?? 0)
          : (actor.system?.energy?.total ?? 0);
        const label = isGerada ? "PA Gerada" : "PA Total";
        if ( atual < custo ) {
          ui.notifications.warn(`${actor.name} não tem ${label} suficiente! (${atual} disponível, ${custo} necessário)`);
          return; // aborta criação do card
        }
        await actor.update({ [campo]: atual - custo }, { isEnergySystem: true });
      }
    }

    // Dados de dano da activity
    const damageParts = activity.damage?.parts ?? [];

    // Montar o HTML do card
    const description = item.system.description?.value ?? "";
    const hasDescription = description && description !== "<p></p>";

    // Tipo de dado bônus de PA
    const baseDenomination = isSpell
      ? (damageParts[0]?.denomination ?? 6)
      : 4;

    const cardData = {
      itemId:       item.id,
      actorId:      actor?.id ?? null,
      tokenId:      actor?.token?.id ?? null,
      activityId:   activity.id,
      itemName:     item.name,
      itemImg:      item.img,
      isSpell,
      hasDescription,
      description:  hasDescription ? description : "",
      damageParts:  damageParts.map((p, i) => ({
        formula: _buildDamageFormula(p, actor, i === 0),
        types:   p.types ?? [],
        label:   _damageTypeLabel(p.types)
      })),
      hasAttack:    true,
      hasDamage:    damageParts.length > 0,
      paBonus:      baseDenomination,
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
     data-is-spell="${data.isSpell}">

  <div class="jj-top-bar">
    <img class="jj-top-icon" src="${data.itemImg}" alt="${data.itemName}">
    <span class="jj-top-name">${data.itemName}</span>
    <span class="jj-top-sub">${data.isSpell ? "Técnica" : "Ataque"}</span>
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

  <div class="jj-roll-btns">
    ${data.hasAttack ? `
    <button class="jj-btn jj-attack-btn" data-action="jj-attack">
      <i class="fas fa-dice-d20"></i> Acerto
    </button>` : `<div></div>`}
    ${data.hasDamage ? `
    <button class="jj-btn jj-damage-btn" data-action="jj-damage">
      <i class="fas fa-burst"></i> Dano
    </button>` : `<div></div>`}
  </div>

  <div class="jj-panels">
    <div class="jj-panel" id="jj-atk-panel">
      <div class="jj-panel-label">Acerto</div>
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
      <label class="jj-mod-check jj-crit-check" title="Crítico — rola dados novamente"><input type="checkbox" data-mod="crit"> Crit</label>
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
      const final = _applyModifier(base, activeMod);
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
          // Crítico: rola dados extras se ainda não foram rolados
          if ( !card.dataset.critBonus ) {
            const critBonus = await _rollCritDice(card);
            card.dataset.critBonus = critBonus;
            const dmgBreak = card.querySelector("#jj-dmg-break");
            if ( dmgBreak && critBonus > 0 ) {
              dmgBreak.innerHTML += `<span class="jj-pa-badge" style="color:#e07040;border-color:#804020">+${critBonus} crit</span>`;
            }
          }
          const critBonus = Number(card.dataset.critBonus ?? 0);
          el.textContent = _applyModifier(base, "crit", critBonus);
        } else if ( mod === "kokusen" ) {
          // Black Flash: NÃO rola dados, apenas multiplica o base por 2,5
          card.dataset.critBonus = "";
          el.textContent = _applyModifier(base, "kokusen", 0);
        } else {
          card.dataset.critBonus = "";
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
      const ok = await _consumePA(actor, paGastos);
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
    const isCrit = roll.total >= (activity.attack?.critical?.threshold ?? 20);

    // Pegar o resultado do dado ativo — com vantagem/desvantagem pode haver 2 dados,
    // o ativo é o que NÃO está descartado. Com rolagem normal há só 1 dado.
    const d20Results = roll.dice[0]?.results ?? [];
    const d20Ativo = (d20Results.find(r => !r.discarded) ?? d20Results[0])?.result;

    const isNat20 = d20Ativo === 20;
    const isNat1  = d20Ativo === 1;

    // ── FULGOR NEGRO ─────────────────────────────────────────────────────────────
    const isFulgor = await checkFulgorNegro(actor, d20Ativo);

    // Renderizar no painel de acerto (Layout B)
    const atkPanel = card.querySelector("#jj-atk-panel");
    const atkVal   = card.querySelector("#jj-atk-val");
    const atkBreak = card.querySelector("#jj-atk-break");

    if ( atkPanel ) {
      atkPanel.classList.add("visible");
      atkVal.textContent = roll.total;
      // Fulgor ativa o visual nat20 (vermelho) mesmo sem ser 20 natural
      atkVal.className = "jj-panel-val" + (isNat20 || isFulgor ? " nat20" : isNat1 ? " nat1" : "");
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

    // PA já gastos no ataque (se houver)
    // PA já foi escolhido e consumido no Rolar Ataque — usa direto
    const paGastos = Number(card.dataset.paGastos ?? 0);

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
    card.dataset.critFormula = critParts.join(" + ");

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

    await _updateCardMessage(message, card.outerHTML);
  }

  // ── DIALOG DE PA ─────────────────────────────────────────────────────────────
  async function _paDialog(actor, profBonus, denomination) {
    const paDisp = actor.system?.energy?.generated ?? 0;
    const maxPA  = Math.min(profBonus * 2, paDisp);

    if ( maxPA === 0 ) return 0; // sem PA disponível, não pergunta

    return foundry.applications.api.DialogV2.wait({
      window: { title: "⚡ Explosão Ofensiva" },
      content: `
        <div style="padding: 8px 0;">
          <p style="margin:0 0 8px">Gastar PA para adicionar dados de dano?</p>
          <p style="margin:0 0 4px; font-size:12px; color:#aaa;">
            PA Gerada disponível: <strong>${paDisp}</strong> &nbsp;|&nbsp;
            Máximo: <strong>${maxPA}</strong> d${denomination}
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
  async function _consumePA(actor, quantidade) {
    const atual = actor.system?.energy?.generated ?? 0;
    if ( atual < quantidade ) {
      ui.notifications.warn(`${actor.name} não tem PA Gerada suficiente! (${atual} disponível, ${quantidade} necessário)`);
      return false;
    }
    await actor.update({ "system.energy.generated": atual - quantidade }, { isEnergySystem: true });
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
      case "half":    return Math.floor(base / 2);
      case "quarter": return Math.floor(base / 4);
      case "crit":    return base + critBonus; // base + dados extras rolados
      case "kokusen": return Math.ceil((base + critBonus) * 2.5); // ×2,5 no total
      default:        return base;
    }
  }

  // ── ROLAR DADOS EXTRAS DE CRÍTICO ────────────────────────────────────────────
  async function _rollCritDice(card) {
    // Pegar a fórmula dos dados usados no dano (sem modificadores fixos)
    // Guardamos a fórmula de dados pura quando rolamos o dano
    const critFormula = card.dataset.critFormula;
    if ( !critFormula ) return 0;
    try {
      const roll = await new Roll(critFormula).evaluate();
      if ( game.dice3d ) game.dice3d.showForRoll(roll, game.user, true); // sem await
      return roll.total;
    } catch(e) {
      console.error("JujutsuLegacy | Erro ao rolar crítico:", e);
      return 0;
    }
  }

  // ── APLICAR DANO NOS TOKENS SELECIONADOS ────────────────────────────────────
  async function _applyDamageToSelected(amount, card, damageTypes = []) {
    await applyDamageToSelectedTokens(amount, card, "[data-action='jj-apply-damage']", damageTypes);
  }

})();

