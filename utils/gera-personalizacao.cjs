// Gera os feats de Defeitos e Peculiaridades da 2.0 a partir do texto colado
// (packs/_source/defeitos-paste.json — a lista do autor tem prioridade).
const fs = require('fs'), path = require('path');
const yaml = require(path.resolve('node_modules/js-yaml'));

const paste = JSON.parse(fs.readFileSync('packs/_source/defeitos-paste.json', 'utf8'));
paste.peculiaridades = paste.peculiaridades.filter(pp => !/LISTA DE PECULIARIDADES/i.test(pp.nome));

// 1.0: nome → { pontos, texto } para capitalização e diff
const dir1 = 'packs/_source/_geral-1-0';
const d1 = new Map();
for ( const f of fs.readdirSync(dir1).filter(f => f.endsWith('.yml')) ) {
  const d = yaml.load(fs.readFileSync(path.join(dir1, f), 'utf8'));
  const m = String(d.name ?? '').match(/^(.*?)\s*\((\d+)\s*Pontos?\)/i);
  if ( m && d.system?.description?.value ) {
    d1.set(m[1].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(),
      { pontos: Number(m[2]), nome: m[1] });
  }
}

// Título seguro: primeira letra de cada palavra em maiúscula, conectivos minúsculos.
// Sem trocas de "D" (que geravam "d'epressivo").
const nomeFinal = (nome, pontos, peculiar) => {
  if ( peculiar ) return nome.toLowerCase().replace(/(^|[\s("])([a-zà-ú])/g, (_, p, c) => p + c.toUpperCase());
  const chave = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const da1 = d1.get(chave);
  if ( da1 ) return `${da1.nome} (${pontos} Ponto${pontos > 1 ? "s" : ""})`;
  return nome.toLowerCase().replace(/(^|[\s("])([a-zà-ú])/g, (_, p, c) => p + c.toUpperCase())
    .replace(/\bDe\b/g, "de").replace(/\bDa\b/g, "da").replace(/\bDo\b/g, "do").replace(/\bE\b/g, "e")
    + ` (${pontos} Ponto${pontos > 1 ? "s" : ""})`;
};

const html = (texto) => texto.split("\n").map(l => l.trim() ? `<p>${l.trim()}</p>` : "").filter(Boolean).join("");

const ICONE_POR_SECAO = {
  "jj-flaws": "icons/magic/death/undead-ghosts-trio-blue.webp",
  "jj-peculiarities": "icons/magic/death/projectile-skull-fire-orange.webp",
  "jj-legendary-modifiers": "icons/magic/symbols/circled-gem-pink.webp"
};

const defeitosFeats = paste.defeitos.map(d => {
  const desc = `<p><em><strong>Defeito (${d.pontos} ${d.pontos > 1 ? "Pontos" : "Ponto"} de Defeito)</strong></em></p>${html(d.texto)}`;
  return { name: nomeFinal(d.nome, d.pontos, false), type: "feat",
    img: ICONE_POR_SECAO["jj-flaws"],
    system: { description: { value: desc } },
    flags: { "jujutsu-system": { featureSection: "jj-flaws", defeitoPontos: d.pontos } } };
});
const peculiaridadesFeats = paste.peculiaridades.map(pp => {
  const desc = `<p><em><strong>Peculiaridade</strong></em> — desvantagem vinculada a um benefício. Escolha permanente, máximo de uma.</p>${html(pp.texto)}`;
  return { name: nomeFinal(pp.nome, 0, true), type: "feat",
    img: ICONE_POR_SECAO["jj-peculiarities"],
    system: { description: { value: desc } },
    flags: { "jujutsu-system": { featureSection: "jj-peculiarities" } } };
});

const arquivo = 'packs/_source/personalizacao-2-0.json';
const anterior = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
anterior.defeitos = defeitosFeats;
anterior.peculiaridades = peculiaridadesFeats;
fs.writeFileSync(arquivo, JSON.stringify(anterior, null, 2), 'utf8');

// regenera a macro com os nomes corrigidos
const tudo = [
  ...defeitosFeats.map(d => ({ ...d, _pasta: "Defeitos" })),
  ...peculiaridadesFeats.map(d => ({ ...d, _pasta: "Peculiaridades" })),
  ...anterior.modificadores.map(d => ({ ...d, _pasta: "Modificadores Lendários" })),
  ...anterior.penalidadesVariantes.map(d => ({ ...d, _pasta: "Penalidades Variantes" }))
];
const macro = `// ⬇⬇ EXECUTAR COMO GM — importa TODA a personalização 2.0 (defeitos, peculiaridades, modificadores lendários e penalidades variantes)
const pack = game.packs.get("jujutsu-compendium.geral-2-0");
if ( !pack ) return ui.notifications.error("Pack geral-2-0 não encontrado.");
const dados = ${JSON.stringify(tudo, null, 1)};
const criarPasta = async (nome) => {
  const existente = pack.folders.find(f => f.name === nome);
  return existente ?? (await Folder.createDocuments([{ name: nome, type: "Item", folder: null }], { pack: pack.collection }))[0];
};
const pastas = {};
for ( const nome of ["Defeitos", "Peculiaridades", "Modificadores Lendários", "Penalidades Variantes"] ) {
  pastas[nome] = await criarPasta(nome);
}
let criados = 0, pulados = 0;
const nomesExistentes = new Set((await pack.getDocuments()).map(d => d.name));
for ( const dado of dados ) {
  if ( nomesExistentes.has(dado.name) ) { pulados++; continue; }
  const pasta = pastas[dado._pasta];
  await Item.createDocuments([{ name: dado.name, type: dado.type, folder: pasta?.id ?? null,
    system: dado.system, flags: dado.flags }], { pack: pack.collection });
  criados++;
}
ui.notifications.info(\`Personalização 2.0: \${criados} criados, \${pulados} já existiam.\`);`;
fs.writeFileSync('packs/_source/importar-personalizacao-macro.txt', macro, 'utf8');

// relatório de nomes para conferência
console.log('defeitos:', defeitosFeats.length, '| peculiaridades:', peculiaridadesFeats.length);
console.log('--- nomes gerados (amostra) ---');
[...defeitosFeats, ...peculiaridadesFeats].slice(0, 12).forEach(f => console.log(' ', f.name));
