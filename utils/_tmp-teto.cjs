// Pips de PA e restore respeitam o teto efetivo (condições de Ações).
const fs = require('fs');
const arq = 'module/applications/actor/character-sheet.mjs';
let s = fs.readFileSync(arq, 'utf8');
const subs = [
  ['    const value = Number(raw);\n    if ( !Number.isInteger(value) || value < 0 || value > legacy2ActionMax(this.actor) ) return;\n    return this.actor.update({ "system.legacy2.actions.value": value });',
   '    const value = Number(raw);\n    if ( !Number.isInteger(value) || value < 0 || value > legacy2ActionMax(this.actor) ) return;\n    // Condições de Ações reduzem o TETO de Pontos de Ação: o clique nunca\n    // passa do limite reduzido (ex.: 8 ações com −4 permitem no máximo 4).\n    const teto = Ruleset.acoesTetoEfetivo(this.actor);\n    return this.actor.update({ "system.legacy2.actions.value": Math.min(value, teto) });'],
  ['    return this.actor.update({ "system.legacy2.actions.value": legacy2ActionMax(this.actor) });',
   '    return this.actor.update({ "system.legacy2.actions.value": Ruleset.acoesTetoEfetivo(this.actor) });']
];
for ( const [de, para] of subs ) {
  if ( !s.includes(de) ) throw new Error('nao achado: ' + de.slice(0, 60));
  s = s.replace(de, para);
}
fs.writeFileSync(arq, s, 'utf8');
console.log('pips + restore com teto efetivo');
