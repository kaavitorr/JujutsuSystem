// Gera o bloco [gerado: jj2] do jj/conditions.mjs a partir de
// packs/_source/condicoes-estruturadas.json (43 condições da 2.0 em 7
// categorias, refs para as páginas do journal "Condições" do MUNDO
// jujutsu-sistema — o mesmo _id do journal do pack, que segue com a 1.0).
// A lista da 1.0 (bloco [gerado: jj1]) não é tocada.
const fs = require('fs');
const ARQ = 'module/applications/actor/jj/conditions.mjs';
const cats = JSON.parse(fs.readFileSync('packs/_source/condicoes-estruturadas.json', 'utf8'));
const JOURNAL = "JournalEntry.ZI4IYTRv7YQVnMpf";

const item = c => `    { id: "${c.id}", label: "${c.label}", icon: "${c.icone}",` +
  ` desc: "${c.desc.replace(/"/g, '\\"')}",` +
  ` reference: "${JOURNAL}.JournalEntryPage.${c.ref}" }`;

const bloco = cats.map(cat => `  { nome: "${cat.nome}", desc: "${String(cat.desc).replace(/"/g, '\\"')}", condicoes: [
${cat.conds.map(item).join(",\n")}
  ] }`).join(",\n");

const novo = `// [gerado: jj2] — fonte: packs/_source/condicoes-estruturadas.json (regen: node utils/gera-conditions.cjs)
export const JJ2_JOURNAL_UUID = "${JOURNAL}";

export const JJ2_CONDITION_GROUPS = [
${bloco}
];

/** Lista plana das condições 2.0 (para busca por id). */
export const JJ2_CONDITIONS = JJ2_CONDITION_GROUPS.flatMap(g => g.condicoes);
// [/gerado: jj2]`;

const atual = fs.readFileSync(ARQ, 'utf8');
const rx = /\/\/ \[gerado: jj2\][\s\S]*?\/\/ \[\/gerado: jj2\]/;
if ( !rx.test(atual) ) throw new Error('Marcadores [gerado: jj2] não encontrados em ' + ARQ);
fs.writeFileSync(ARQ, atual.replace(rx, () => novo), 'utf8');
console.log('Bloco jj2 regenerado:', cats.length, 'categorias,', cats.reduce((n, c) => n + c.conds.length, 0), 'condições');
