// Gera o novo JJ_CONDITIONS (43 condições do livro, 7 categorias, referências
// para as páginas novas do journal) a partir de /tmp/condicoes-novas.txt
const fs = require('fs');
const linhas = fs.readFileSync('condicoes-novas.tmp.txt', 'utf8').split('\n').filter(l => l.trim());
const categorias = [];
let categoria = null;
for ( const linha of linhas ) {
  const [id, label, icone, desc, ref] = linha.split('|').map(s => s.trim());
  if ( !ref ) {
    categoria = { nome: id, desc: label, conds: [] };
    categorias.push(categoria);
    continue;
  }
  categoria.conds.push({ id, label, icone, desc, ref });
}
fs.writeFileSync('packs/_source/condicoes-estruturadas.json', JSON.stringify(categorias, null, 1), 'utf8');
console.log('categorias:', categorias.map(c => `${c.nome} (${c.conds.length})`).join(' | '));
console.log('total:', categorias.reduce((n, c) => n + c.conds.length, 0));
