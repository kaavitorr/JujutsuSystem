// Restaurador resolve o elemento ATUAL via app (re-renders recriam containers).
const fs = require('fs');
const arq = 'module/applications/actor/jj/conditions.mjs';
let s = fs.readFileSync(arq, 'utf8');
const subs = [
  ['export function restaurarScrollCondicoes(actor, raiz) {', 'export function restaurarScrollCondicoes(actor, app) {'],
  ['  if ( !lista?.length || !raiz ) return false;', '  if ( !lista?.length || !app ) return false;'],
  ['      const alvo = raiz.querySelector(seletor) ?? document.querySelector(seletor);',
   '      const alvo = app.element?.querySelector(seletor) ?? document.querySelector(seletor);'],
  ['    if ( aplicar() ) return;\n    if ( ++tentativas > 120 ) return;\n    requestAnimationFrame(tick);',
   '    if ( aplicar() ) { globalThis.__jjScrollCondicoes.set(actor.id, lista); return; }\n    if ( ++tentativas > 150 ) return;\n    requestAnimationFrame(tick);']
];
for ( const [de, para] of subs ) {
  if ( !s.includes(de) ) throw new Error('nao achado: ' + de.slice(0, 50));
  s = s.replace(de, para);
}
fs.writeFileSync(arq, s, 'utf8');
console.log('restaurador atualizado');
