// Exporta o mapa de movimento a partir do condicoes-dano.mjs.
const fs = require('fs');
const arq = 'module/systems/condicoes-dano.mjs';
let s = fs.readFileSync(arq, 'utf8');

const ancora = [
  '  // Trovejante: a página do Estremecido não define duração — permanece até removida.',
  '  thunder:   { status: "jj-estremecido", label: "Estremecido", save: "con", rodadas: null, extra: [] }',
  '});'
].join('\n');
if (!s.includes(ancora)) throw new Error('ancora nao achada');

const mapa = [
  ancora,
  '',
  '/** Changes de movimento por condição — usados no efeito criado pelo toggle',
  ' *  da ficha e pela aplicação por dano crítico. */',
  'export const MODIFICADORES_MOVIMENTO = Object.freeze({',
  '  "jj-atordoado":   [{ key: "system.attributes.movement.walk", mode: CONST.ACTIVE_EFFECT_MODES.DOWNGRADE, value: 3 }],',
  '  "jj-agarrado":    [{ key: "system.attributes.movement.walk", mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value: 0 }],',
  '  "jj-caido":       [{ key: "system.attributes.movement.walk", mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY, value: 0.25 }],',
  '  "jj-desidratado": [{ key: "system.attributes.movement.walk", mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY, value: 0.5 }],',
  '  "jj-estremecido": [{ key: "system.attributes.movement.walk", mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY, value: 0.5 }],',
  '  "jj-exausto":     [{ key: "system.attributes.movement.walk", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: -1.5 }],',
  '  "jj-impedido":    [{ key: "system.attributes.movement.walk", mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value: 0 }],',
  '  "jj-letargico":   [{ key: "system.attributes.movement.walk", mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY, value: 0.5 }],',
  '  "jj-lento":       [{ key: "system.attributes.movement.walk", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: -10 }],',
  '  "jj-pesado":      [{ key: "system.attributes.movement.walk", mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY, value: 0.5 }]',
  '});'
].join('\n');
s = s.replace(ancora, mapa);
fs.writeFileSync(arq, s, 'utf8');
console.log('mapa movido');
