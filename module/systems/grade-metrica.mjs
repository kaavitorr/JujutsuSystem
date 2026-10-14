import Ruleset from "./ruleset.mjs";

/**
 * ── GRADE MÉTRICA 2.0 ───────────────────────────────────────────────────────
 * Cenas criadas na 2.0 usam grade de 1 metro por quadrado (em vez dos 1,5 m
 * herdados do dnd5e). Roda no cliente que cria a cena; cenas existentes
 * mantêm a escala que têm (alterável em Configuração da Cena > Grade).
 */
Hooks.on("preCreateScene", (scene, data, options, userId) => {
  if ( !Ruleset.isV2() || (game.user.id !== userId) ) return;
  if ( (scene.grid.distance === 1) && (scene.grid.units === "m") ) return;
  // grava no createData também: o preCreateScene do dnd5e só aplica o padrão
  // dele (1,5 m) quando a cena nasce sem grade declarada
  foundry.utils.setProperty(data, "grid.distance", 1);
  foundry.utils.setProperty(data, "grid.units", "m");
  scene.updateSource({ "grid.distance": 1, "grid.units": "m" });
});
