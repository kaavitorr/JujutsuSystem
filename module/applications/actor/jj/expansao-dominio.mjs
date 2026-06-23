/**
 * jj/expansao-dominio.mjs
 * Expansão de Domínio (Maestria 7).
 *
 * Regras:
 *  - Ao atingir a Maestria 7, o personagem fica TRAVADO nesse nível (não progride
 *    acima de 7) até expandir o domínio com sucesso. A trava é aplicada em
 *    character.mjs (prepareDerivedData), checando a flag `dominioExpandido`.
 *  - O botão "Expansão de Domínio" aparece na sidebar quando:
 *      masteryLevel >= 7  E  treino "Domínio Incompleto" (rank > 0)
 *      E  habilidade "Barreira Vazia" desbloqueada.
 *  - Uma vez por combate, o personagem pode apertar o botão:
 *      • Se ainda NÃO expandiu: rola 1d20. 20 natural → desbloqueia (flag),
 *        ganha 21 PM, abre o modal de +2 atributo, e (opcionalmente) toca o GIF
 *        e usa a técnica vinculada. Falha → tenta no próximo combate.
 *      • Se JÁ expandiu: ativa a expansão (GIF + técnica vinculada), sem rolagem.
 *  - Botão direito no botão: vincular técnica (spell) e definir o GIF.
 */

import { promptAttributeIncrease } from "./mastery-milestones.mjs";
import { showBlackFlashPopup } from "./popup.mjs";

const FLAG_EXPANDIDO   = "dominioExpandido";
const FLAG_TECNICA     = "dominioTecnica";
const FLAG_GIF         = "dominioGif";
const FLAG_AUDIO       = "dominioAudio";
const FLAG_ULTIMO_COMB = "dominioUltimoCombate";
const FLAG_TEMPLATE    = "dominioTemplate";   // marca os MeasuredTemplate do domínio
const FLAG_WALL        = "dominioWall";       // marca os Wall (paredes) do domínio
const REWARD_PM        = 21;
const DOMINIO_RAIO     = 18;                  // raio de emanação do domínio, em metros
const DOMINIO_SEGMENTOS = 32;                 // nº de segmentos do polígono que aproxima o círculo

// ── Visibilidade ──────────────────────────────────────────────────────────────

/**
 * O botão de Expansão de Domínio deve aparecer para este ator?
 * @param {Actor5e} actor
 * @returns {boolean}
 */
export function canShowExpansaoDominio(actor) {
  if ( actor?.type !== "character" ) return false;
  if ( (actor.system?.masteryLevel ?? 0) < 7 ) return false;
  const temDominioIncompleto = (actor.system?.trainings?.dominioIncompleto?.rank ?? 0) > 0;
  const temBarreiraVazia = actor.system?.manipulation?.abilities?.barreiraVazia?.unlocked === true;
  return temDominioIncompleto && temBarreiraVazia;
}

// ── Handler do botão ────────────────────────────────────────────────────────────

// Guard em memória contra duplo-clique enquanto a rolagem/animação está em curso.
const _pending = new Set();

/**
 * Handler do clique no botão "Expansão de Domínio".
 * @param {Actor5e} actor
 */
export async function onExpansaoDominio(actor) {
  if ( !actor ) return;

  // Precisa estar em combate
  const combat = game.combat;
  if ( !combat ) {
    ui.notifications.warn("A Expansão de Domínio só pode ser usada durante um combate.");
    return;
  }

  // Uma vez por combate (compara o id do combate atual com o último usado)
  const ultimoCombate = actor.getFlag("jujutsu-system", FLAG_ULTIMO_COMB) ?? null;
  if ( ultimoCombate === combat.id ) {
    ui.notifications.warn("A Expansão de Domínio já foi usada neste combate.");
    return;
  }

  // Guard de duplo-clique em memória (não toca o banco até decidir o resultado)
  if ( _pending.has(actor.id) ) return;
  _pending.add(actor.id);
  try {
    await _resolverExpansao(actor, combat);
  } finally {
    _pending.delete(actor.id);
  }
}

/**
 * Resolve a tentativa/ativação de Expansão de Domínio, consolidando cada caminho
 * num único `actor.update` (atômico).
 * @param {Actor5e} actor
 * @param {Combat} combat
 */
async function _resolverExpansao(actor, combat) {
  const jaExpandiu = actor.getFlag("jujutsu-system", FLAG_EXPANDIDO) === true;

  if ( jaExpandiu ) {
    // Já desbloqueado — marca uso e apenas ativa a expansão
    await actor.setFlag("jujutsu-system", FLAG_ULTIMO_COMB, combat.id);
    await _ativarExpansao(actor);
    return;
  }

  // Ainda não desbloqueou — rola 1d20, precisa de 20 natural
  const roll = await new Roll("1d20").evaluate();
  if ( game.dice3d ) await game.dice3d.showForRoll(roll, game.user, true);
  const d20 = roll.dice[0]?.results?.[0]?.result ?? roll.total;
  const sucesso = d20 === 20;

  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `🌀 <strong>${actor.name}</strong> tenta <strong>Expandir o Domínio</strong> — precisa de 20 natural!`,
    rollMode: game.settings.get("core", "rollMode")
  });

  if ( !sucesso ) {
    // Marca o uso do combate (tentativa gasta)
    await actor.setFlag("jujutsu-system", FLAG_ULTIMO_COMB, combat.id);
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `❌ <strong>${actor.name}</strong> falhou em expandir o domínio (tirou ${d20}). Tente no próximo combate.`
    });
    return;
  }

  // ── SUCESSO — desbloqueia, recompensas e marca uso, tudo num update atômico ──
  const pmAtual = actor.system?.curseResources?.cursePoints ?? 0;
  await actor.update({
    [`flags.jujutsu-system.${FLAG_EXPANDIDO}`]: true,
    [`flags.jujutsu-system.${FLAG_ULTIMO_COMB}`]: combat.id,
    "system.curseResources.cursePoints": pmAtual + REWARD_PM
  });

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `🌀✨ <strong>${actor.name}</strong> EXPANDIU O DOMÍNIO com sucesso (20 natural)! Recebe <strong>+${REWARD_PM} PM</strong> e supera a trava da Maestria 7.`
  });

  // Ativa visualmente (GIF + técnica)
  await _ativarExpansao(actor);

  // Modal de +2 atributo (recompensa)
  await promptAttributeIncrease(actor, {
    amount: 2,
    title: "🌀 Expansão de Domínio — Evolução de Atributo",
    intro: `Você dominou a <strong>Expansão de Domínio</strong>! Escolha um atributo para receber <strong style="color:#c0a0ff;">+2</strong> (limite de 30).`,
    flavor: `🌀 <strong>${actor.name}</strong>`
  });
}

/**
 * Ativa a expansão: toca o GIF vinculado e usa a técnica vinculada (se houver).
 * @param {Actor5e} actor
 */
async function _ativarExpansao(actor) {
  // Sem token na cena ativa não há onde desenhar a área/paredes — avisa, mas
  // segue com GIF/técnica (o desbloqueio em si já ocorreu).
  if ( !actor.getActiveTokens?.()?.length ) {
    ui.notifications.warn("Coloque o token do personagem na cena ativa para visualizar a área e as paredes do domínio.");
  }
  // Área de emanação de 18 m de raio mostrando os limites do domínio
  await _criarTemplateDominio(actor);
  // Paredes nos limites: bloqueiam movimento e visão (não dá pra sair nem ver fora)
  await _aplicarParedesDominio(actor);

  const gif = actor.getFlag("jujutsu-system", FLAG_GIF);
  if ( gif ) showBlackFlashPopup(gif, 4000);

  // Áudio de expansão — tocado para todos os clientes
  const audio = actor.getFlag("jujutsu-system", FLAG_AUDIO);
  if ( audio ) {
    try {
      const AH = foundry.audio?.AudioHelper ?? globalThis.AudioHelper;
      AH?.play({ src: audio, volume: 0.8, autoplay: true, loop: false }, true);
    } catch(err) {
      console.error("JujutsuLegacy | Erro ao tocar áudio da Expansão de Domínio:", err);
    }
  }

  const tecnicaUuid = actor.getFlag("jujutsu-system", FLAG_TECNICA);
  if ( tecnicaUuid ) {
    try {
      const item = await fromUuid(tecnicaUuid);
      if ( item?.use ) await item.use();
      else if ( item ) {
        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: `🌀 <strong>${actor.name}</strong> expande o domínio: <strong>${item.name}</strong>!`
        });
      }
    } catch(err) {
      console.error("JujutsuLegacy | Erro ao usar técnica de Expansão de Domínio:", err);
    }
  }
}

// ── Template de área (limites do domínio) ───────────────────────────────────────

/**
 * Cria um MeasuredTemplate circular de 18 m de raio centrado no token do ator,
 * mostrando os limites do domínio. Remove qualquer template de domínio anterior
 * do mesmo ator antes de criar o novo.
 * @param {Actor5e} actor
 */
async function _criarTemplateDominio(actor) {
  const token = actor.getActiveTokens?.()?.[0];
  if ( !token || !canvas?.scene ) return;

  await _removerTemplatesDominio(actor);

  const center = token.center;
  const templateData = {
    t: CONST.MEASURED_TEMPLATE_TYPES?.CIRCLE ?? "circle",
    user: game.user.id,
    x: center.x,
    y: center.y,
    distance: DOMINIO_RAIO,
    direction: 0,
    angle: 0,
    fillColor: "#7a30d0",
    borderColor: "#b070e0",
    flags: { "jujutsu-system": { [FLAG_TEMPLATE]: true, actorId: actor.id } }
  };

  try {
    await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [templateData]);
  } catch(err) {
    console.error("JujutsuLegacy | Erro ao criar área de Expansão de Domínio:", err);
  }
}

/**
 * Remove os MeasuredTemplate de domínio da cena atual. Se `actor` for informado,
 * remove apenas os daquele ator; caso contrário, remove todos.
 * @param {Actor5e} [actor]
 * @param {Scene}   [scene=canvas.scene]
 */
async function _removerTemplatesDominio(actor, scene = canvas?.scene) {
  if ( !scene?.templates ) return;
  const ids = scene.templates
    .filter(t => t.getFlag?.("jujutsu-system", FLAG_TEMPLATE)
              && (!actor || t.getFlag("jujutsu-system", "actorId") === actor.id))
    .map(t => t.id);
  if ( !ids.length ) return;
  try {
    await scene.deleteEmbeddedDocuments("MeasuredTemplate", ids);
  } catch(err) {
    console.error("JujutsuLegacy | Erro ao remover área de Expansão de Domínio:", err);
  }
}

// ── Paredes do domínio (bloqueiam movimento e visão) ────────────────────────────

/**
 * Calcula os dados dos Wall que formam o anel circular do domínio, a partir do
 * token (precisa do canvas do dono — coordenadas em pixels).
 * @param {Token}  token
 * @param {string} actorId
 * @returns {object[]} array de dados de Wall prontos para createEmbeddedDocuments
 */
function _computeDominioWalls(token, actorId) {
  const dims = canvas?.dimensions;
  if ( !dims ) return [];
  const center = token.center;
  // metros → pixels; protege contra distance 0/ausente (cena mal configurada)
  const scale = dims.distance ? (dims.size / dims.distance) : dims.size;
  const r = DOMINIO_RAIO * scale;
  if ( !Number.isFinite(r) || r <= 0 ) return [];
  const NORMAL = CONST.WALL_SENSE_TYPES?.NORMAL ?? 20;
  const NONE   = CONST.WALL_SENSE_TYPES?.NONE ?? 0;
  const MOVE   = CONST.WALL_MOVEMENT_TYPES?.NORMAL ?? 20;
  const BOTH   = CONST.WALL_DIRECTIONS?.BOTH ?? 0;

  const pts = [];
  for ( let i = 0; i <= DOMINIO_SEGMENTOS; i++ ) {
    const a = (Math.PI * 2 * i) / DOMINIO_SEGMENTOS;
    pts.push([Math.round(center.x + r * Math.cos(a)), Math.round(center.y + r * Math.sin(a))]);
  }
  const walls = [];
  for ( let i = 0; i < DOMINIO_SEGMENTOS; i++ ) {
    walls.push({
      // bloqueia movimento e visão (não sai nem vê o outro lado);
      // luz e som passam (não escurece o interior sem necessidade)
      c: [pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]],
      move: MOVE, sight: NORMAL, light: NONE, sound: NONE, dir: BOTH,
      flags: { "jujutsu-system": { [FLAG_WALL]: true, actorId } }
    });
  }
  return walls;
}

/**
 * Verdadeiro só no GM "primário" (activeGM) — evita que múltiplos GMs conectados
 * executem a mesma criação/remoção em duplicata.
 * @returns {boolean}
 */
function _isPrimaryGM() {
  const gm = game.users?.activeGM;
  return gm ? (gm === game.user) : game.user.isGM;
}

/**
 * Aplica as paredes do domínio. Walls só podem ser criados pelo GM — se o usuário
 * não for GM, computa a geometria localmente e pede ao GM via socket.
 * @param {Actor5e} actor
 */
async function _aplicarParedesDominio(actor) {
  const token = actor.getActiveTokens?.()?.[0];
  if ( !token || !canvas?.scene ) return;
  const walls = _computeDominioWalls(token, actor.id);
  if ( !walls.length ) return;

  if ( game.user.isGM ) {
    await _removerParedesDominio(actor, canvas.scene);
    try { await canvas.scene.createEmbeddedDocuments("Wall", walls); }
    catch(err) { console.error("JujutsuLegacy | Erro ao criar paredes do domínio:", err); }
  } else {
    game.socket.emit("system.jujutsu-system", {
      action: "dominioParedes", op: "create",
      sceneId: canvas.scene.id, actorId: actor.id, walls
    });
  }
}

/**
 * Remove os Wall de domínio da cena. Se `actor` for informado, remove só os dele.
 * @param {Actor5e|{id:string}} [actor]
 * @param {Scene} [scene=canvas.scene]
 */
async function _removerParedesDominio(actor, scene = canvas?.scene) {
  if ( !scene?.walls ) return;
  const ids = scene.walls
    .filter(w => w.getFlag?.("jujutsu-system", FLAG_WALL)
              && (!actor || w.getFlag("jujutsu-system", "actorId") === actor.id))
    .map(w => w.id);
  if ( !ids.length ) return;
  try {
    await scene.deleteEmbeddedDocuments("Wall", ids);
  } catch(err) {
    console.error("JujutsuLegacy | Erro ao remover paredes do domínio:", err);
  }
}

// O GM primário executa pedidos de criação/remoção de paredes feitos por jogadores
Hooks.once("ready", () => {
  game.socket.on("system.jujutsu-system", async (data) => {
    if ( data?.action !== "dominioParedes" ) return;
    if ( !_isPrimaryGM() ) return; // só um GM age, evita duplicação
    const scene = game.scenes?.get(data.sceneId);
    if ( !scene ) return;
    await _removerParedesDominio({ id: data.actorId }, scene);
    if ( data.op === "create" && data.walls?.length ) {
      try { await scene.createEmbeddedDocuments("Wall", data.walls); }
      catch(err) { console.error("JujutsuLegacy | Erro ao criar paredes do domínio (socket):", err); }
    }
  });
});

// Ao encerrar um combate, o GM primário limpa as áreas e paredes de domínio (são de combate)
Hooks.on("deleteCombat", async (combat) => {
  if ( !_isPrimaryGM() ) return;
  const scene = combat?.scene ?? canvas?.scene;
  await _removerTemplatesDominio(null, scene);
  await _removerParedesDominio(null, scene);
});

// ── Menu de contexto (botão direito) ────────────────────────────────────────────

/**
 * Abre o menu de configuração da Expansão de Domínio (vincular técnica / definir GIF).
 * @param {Actor5e} actor
 */
export async function configureExpansaoDominio(actor) {
  const tecnicaAtual = actor.getFlag("jujutsu-system", FLAG_TECNICA);
  const gifAtual     = actor.getFlag("jujutsu-system", FLAG_GIF);
  const audioAtual   = actor.getFlag("jujutsu-system", FLAG_AUDIO);

  // Técnicas (spells) do ator para vincular
  const spells = actor.items.filter(i => i.type === "spell");
  const spellOptions = [`<option value="">— Nenhuma —</option>`]
    .concat(spells.map(s => `<option value="${s.uuid}" ${s.uuid === tecnicaAtual ? "selected" : ""}>${s.name}</option>`))
    .join("");

  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: "🌀 Configurar Expansão de Domínio" },
    content: `
      <div style="padding:8px 0; font-size:13px; color:#ccc; line-height:1.6;">
        <div style="display:flex; flex-direction:column; gap:4px; margin-bottom:12px;">
          <label>Técnica vinculada (usada ao expandir):</label>
          <select id="jj-dominio-tecnica" style="width:100%;">${spellOptions}</select>
        </div>
        <div style="display:flex; flex-direction:column; gap:4px; margin-bottom:12px;">
          <label>GIF de Expansão (exibido ao expandir):</label>
          <div style="display:flex; gap:6px; align-items:center;">
            <input type="text" id="jj-dominio-gif" value="${gifAtual ?? ""}" placeholder="caminho/para/gif.gif" style="flex:1 1 auto;">
            <button type="button" id="jj-dominio-gif-pick" title="Procurar arquivo"><i class="fas fa-folder-open"></i></button>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          <label>Áudio de Expansão (tocado ao expandir):</label>
          <div style="display:flex; gap:6px; align-items:center;">
            <input type="text" id="jj-dominio-audio" value="${audioAtual ?? ""}" placeholder="caminho/para/audio.ogg" style="flex:1 1 auto;">
            <button type="button" id="jj-dominio-audio-pick" title="Procurar arquivo"><i class="fas fa-folder-open"></i></button>
          </div>
        </div>
      </div>`,
    buttons: [
      {
        label: "Salvar",
        action: "ok",
        default: true,
        callback: (event, button, dialog) => {
          const root = dialog.element ?? document;
          return {
            tecnica: root.querySelector("#jj-dominio-tecnica")?.value ?? "",
            gif:     root.querySelector("#jj-dominio-gif")?.value ?? "",
            audio:   root.querySelector("#jj-dominio-audio")?.value ?? ""
          };
        }
      },
      { label: "Cancelar", action: "cancel", callback: () => null }
    ],
    render: (event, dialog) => {
      const root = dialog.element ?? document;
      const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
      root.querySelector("#jj-dominio-gif-pick")?.addEventListener("click", () => {
        new FP({
          type: "image",
          current: root.querySelector("#jj-dominio-gif")?.value ?? "",
          callback: path => { const inp = root.querySelector("#jj-dominio-gif"); if ( inp ) inp.value = path; }
        }).render(true);
      });
      root.querySelector("#jj-dominio-audio-pick")?.addEventListener("click", () => {
        new FP({
          type: "audio",
          current: root.querySelector("#jj-dominio-audio")?.value ?? "",
          callback: path => { const inp = root.querySelector("#jj-dominio-audio"); if ( inp ) inp.value = path; }
        }).render(true);
      });
    },
    rejectClose: false,
    close: () => null
  });

  if ( !result ) return;
  await actor.update({
    [`flags.jujutsu-system.${FLAG_TECNICA}`]: result.tecnica || null,
    [`flags.jujutsu-system.${FLAG_GIF}`]: result.gif || null,
    [`flags.jujutsu-system.${FLAG_AUDIO}`]: result.audio || null
  });
  ui.notifications.info("Expansão de Domínio configurada.");
}
