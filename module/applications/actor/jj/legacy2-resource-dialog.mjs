import { extraResourceById, ownedResourceActivities, resourceActivity, saveExtraResource } from "./legacy2-extra-resources.mjs";

/** Configuration edits the real actor resource and optionally its native activity cost. */
export async function configureExtraResource(sheet, id) {
  if ( !sheet.isEditable ) return;
  const create = !id;
  if ( create ) id = foundry.utils.randomID();
  const card = create ? { label: "", value: 0, max: 0, activity: "", custom: true,
    path: `system.legacy2.extraResources.${id}.value` } : extraResourceById(sheet.actor, id);
  if ( !card ) return;
  const escape = text => foundry.utils.escapeHTML(String(text ?? ""));
  const selected = resourceActivity(sheet.actor, card.activity);
  const cost = selected?.consumption?.targets?.find(t => t.type === "attribute" && t.target === card.path.slice(7))?.value;
  const options = ownedResourceActivities(sheet.actor).map(activity =>
    `<option value="${escape(activity.uuid)}" ${activity.uuid === card.activity ? "selected" : ""}>${escape(activity.item.name)} · ${escape(activity.name)}</option>`
  ).join("");
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: create ? "Adicionar recurso" : `Configurar ${card.label}` },
    content: `<div class="jj2-extra-resource-config">
      ${card.custom ? `<div class="form-group"><label>Nome</label><input name="resource-label" value="${escape(card.label)}" maxlength="80" required></div>` : ""}
      <div class="form-group"><label>Atual</label><input type="number" name="resource-value" value="${card.value}" min="0" step="1" required></div>
      <div class="form-group"><label>Máximo</label><input type="number" name="resource-max" value="${card.max}" min="0" step="1" required></div>
      ${id === "reverseEnergy" ? `<div class="form-group"><label>PER por rodada</label><input type="number" name="resource-round-max" value="${card.maxPerRound}" min="0" step="1" required></div>
        <p class="hint">Limite de gasto em combate, renovado no início do seu turno. Traits podem alterá-lo pela chave <code>system.legacy2.reverseEnergy.maxPerRound</code>.</p>` : ""}
      <div class="form-group"><label>Atividade ao ativar</label><select name="resource-activity"><option value="">Nenhuma</option>${options}</select></div>
      <div class="form-group"><label>Custo por uso</label><input type="number" name="resource-cost" value="" min="0" step="1" placeholder="Manter configuração da atividade"></div>
      ${selected ? `<p class="hint">${escape(selected.name)}: consumo atual deste recurso — ${escape(cost ?? "nenhum")}.</p>` : ""}
      <p class="hint">O custo é salvo no consumo da atividade. Deixe vazio para manter seus custos e fórmulas; use 0 para remover o consumo deste recurso.</p>
      <p class="hint">Atributo: <code>${escape(card.path)}</code></p>
    </div>`,
    buttons: [{ action: "save", label: "Salvar", default: true, callback: (event, button, dialog) => {
      const root = dialog.element;
      return { label: root.querySelector('[name="resource-label"]')?.value ?? card.label,
        value: root.querySelector('[name="resource-value"]').value,
        max: root.querySelector('[name="resource-max"]').value,
        ...(id === "reverseEnergy" ? { maxPerRound: root.querySelector('[name="resource-round-max"]')?.value ?? card.maxPerRound } : {}),
        activity: root.querySelector('[name="resource-activity"]').value,
        cost: root.querySelector('[name="resource-cost"]').value };
    } }, { action: "cancel", label: "Cancelar", callback: () => null }],
    rejectClose: false, close: () => null
  });
  if ( !result ) return;
  if ( !await saveExtraResource(sheet, id, result, { create }) ) {
    ui.notifications.warn("Confira os valores: use inteiros não negativos, e o atual deve caber no máximo.");
  }
}

export async function deleteExtraResource(sheet, id) {
  if ( !sheet.isEditable ) return;
  const card = extraResourceById(sheet.actor, id);
  if ( !card?.custom ) return;
  if ( !await foundry.applications.api.DialogV2.confirm({ window: { title: "Remover recurso" },
    content: `<p>Remover ${foundry.utils.escapeHTML(card.label)} da ficha? As atividades vinculadas serão mantidas.</p>`,
    rejectClose: false }) ) return;
  // Remove this target from owned activities so they never point at a deleted resource.
  for ( const activity of ownedResourceActivities(sheet.actor) ) {
    const targets = Array.from(activity.consumption?.targets ?? []);
    const retained = targets.filter(t => !(t.type === "attribute" && t.target === card.path.slice(7)));
    if ( retained.length !== targets.length ) await activity.item.updateActivity(activity.id, {
      "consumption.targets": retained.map(t => t.toObject?.() ?? { ...t })
    });
  }
  await sheet.actor.update({ [`system.legacy2.extraResources.-=${id}`]: null });
}
