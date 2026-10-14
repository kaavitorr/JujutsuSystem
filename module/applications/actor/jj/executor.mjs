/**
 * jj/executor.mjs
 * Subclasse Executor — dobra energyDice.max e recupera tudo no descanso longo.
 */

/**
 * Verifica se o ator tem a subclasse "executor".
 * @param {Actor5e} actor
 * @returns {boolean}
 */
function _hasExecutorSubclass(actor) {
  return actor.itemTypes?.subclass?.some(s =>
    (s.identifier ?? s.system?.identifier) === "executor"
  ) ?? false;
}

// Monkeypatch do prepareData para dobrar energyDice.max quando executor
Hooks.once("ready", () => {
  const ActorClass = CONFIG.Actor.documentClass;
  const originalPrepareData = ActorClass.prototype.prepareData;

  ActorClass.prototype.prepareData = function() {
    originalPrepareData.call(this);
    if ( this.type !== "character" ) return;
    if ( !_hasExecutorSubclass(this) ) return;

    const ed = this.system.energyDice;
    if ( !ed ) return;

    // Dobrar o máximo — o cálculo base é (level * 2) + bonus, executor faz (level * 4) + bonus
    const level = this.system.details?.level ?? 1;
    const bonus = ed.bonus ?? 0;
    this.system.energyDice.max = (level * 4) + bonus;
  };
});

// No descanso longo, executor recupera todos os dados de energia
Hooks.on("dnd5e.preRestCompleted", (actor, result, config) => {
  if ( config.type !== "long" ) return;
  if ( !_hasExecutorSubclass(actor) ) return;

  const ed = actor.system.energyDice;
  if ( !ed ) return;

  const max = ed.max;
  const current = ed.value;
  if ( current >= max ) return;

  // Substituir a recuperação parcial pela recuperação total
  result.updateData ??= {};
  result.updateData["system.energyDice.value"] = max;
});
