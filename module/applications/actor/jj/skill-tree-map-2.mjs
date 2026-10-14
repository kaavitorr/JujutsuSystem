/** Presentation only: dependencies and choice validation remain in especializacoes-2. */
export const ICONES_CATEGORIA = Object.freeze({
  "Feitiço Inato": "/systems/jujutsu-system/assets/skill%20tree/Feiti%C3%A7o%20Inato.webp",
  "Técnicas de Barreira": "/systems/jujutsu-system/assets/skill%20tree/Barreiras.webp",
  "Proezas Físicas": "/systems/jujutsu-system/assets/skill%20tree/proezas%20f%C3%ADsicas.webp",
  "Habilidades Especiais": "/systems/jujutsu-system/assets/skill%20tree/hab%20especiais.webp",
  "Energia Reversa": "/systems/jujutsu-system/assets/skill%20tree/Energia%20Reversa.webp",
  "Domínio e Anti-Domínio": "/systems/jujutsu-system/assets/skill%20tree/Dom%C3%ADnio.webp"
});

/**
 * Resolve whole names first, so "Cone e Leque" does not become two nodes.
 * @param {string} texto           Requirement text.
 * @param {Map<string, object>} porNome Complete compendium graph.
 * @returns {string[]} Named dependency nodes.
 */
export function origensRequisito(texto, porNome) {
  return analisarRequisito(texto, porNome).nomes;
}

/**
 * Recognize composite clauses without changing the rules engine's evaluation.
 * @param {string} texto           Requirement text.
 * @param {Map<string, object>} porNome Complete compendium graph.
 * @returns {object} Recognized clause, names and optional subclauses.
 */
function analisarRequisito(texto, porNome) {
  const limpo = String(texto).replaceAll(">", "").replaceAll("<", "").trim();
  if ( porNome.has(limpo) ) return { conhecido: true, nomes: [limpo] };
  // Match the rules engine's OU-first precedence, including whole names inside a branch.
  for ( const separador of [/\s+ou\s+/i, /\s+e\s+/] ) {
    const partes = limpo.split(separador);
    if ( partes.length < 2 ) continue;
    const resultados = partes.map(p => analisarRequisito(p, porNome));
    if ( resultados.every(r => r.conhecido) ) return {
      conhecido: true, nomes: [...new Set(resultados.flatMap(r => r.nomes))], partes
    };
  }
  const conhecido = RX_CONTAGEM.test(limpo)
    || /^(?:\d+)º?\s*n[íi]vel(?:\s+(?:de\s+personagem))?(?:\s*ou\s*superior)?$/i.test(limpo)
    || /^\d+\s*pontos?\s*de\s+(?:força|forca|agilidade|constituição|constituicao|intelecto|sabedoria|presença|presenca)$/i.test(limpo)
    || ["restringido", "lutador", "sentinela", "especialista", "estrategista"].includes(limpo.toLowerCase());
  return { conhecido, nomes: [] };
}

const RX_CONTAGEM = /^(?:todas as outras\s+)?(\d+)\s*habilidades?\s*(?:de\s+especializa[çc][ãa]o\s+)?(?:do|da|de)\s+(.+)$/i;

/**
 * Mirrors the existing count scopes without deciding whether a skill can be learned.
 * @param {string} texto           Requirement text.
 * @param {string[]} aprendidas    Actor's learned specializations.
 * @param {Map<string, object>} porNome Complete compendium graph.
 * @returns {object|null} Counter display or null for non-count requirements.
 */
export function contagemRequisito(texto, aprendidas, porNome) {
  const match = String(texto).trim().match(RX_CONTAGEM);
  if ( !match ) return null;
  const max = Number(match[1]);
  const alvo = match[2].trim().replace(/\s+totais?$/i, "").trim();
  const norm = s => (s ?? "").toLowerCase();
  const categoria = [...porNome.values()].some(no => norm(no.categoria) === norm(alvo));
  const atual = /^especializa/i.test(alvo) ? aprendidas.length : aprendidas.filter(nome => {
    const no = porNome.get(nome);
    return no && norm(categoria ? no.categoria : no.caminho) === norm(alvo);
  }).length;
  return { atual, max, alvo, pct: max > 0 ? Math.min(100, atual / max * 100) : 100 };
}

/**
 * Show counts within a recognized AND/OR expression without changing its evaluation.
 * @param {string} texto           Requirement text.
 * @param {string[]} aprendidas    Actor's learned specializations.
 * @param {Map<string, object>} porNome Complete compendium graph.
 * @returns {object[]} Count displays within this clause.
 */
export function contagensRequisito(texto, aprendidas, porNome) {
  const analise = analisarRequisito(texto, porNome);
  if ( analise.partes ) return analise.partes.flatMap(p => contagensRequisito(p, aprendidas, porNome));
  if ( porNome.has(String(texto).replaceAll(">", "").replaceAll("<", "").trim()) ) return [];
  const contagem = contagemRequisito(texto, aprendidas, porNome);
  return contagem ? [contagem] : [];
}

/**
 * Stable lanes by path, columns by dependency depth. Free skills never get invented links.
 * @param {object} categoria       Category and paths from the compendium.
 * @param {Map<string, object>} porNome Complete compendium graph.
 * @param {object} [options={}]    Presentation preferences.
 * @param {object} [options.ocultas={}] GM-hidden edges by source|destination.
 * @returns {object} Positioned nodes, connections and stage bounds.
 */
export function construirMapaCategoria(categoria, porNome, { ocultas = {} } = {}) {
  const noLargura = 184; const noAltura = 120; const passoX = 238; const passoY = 156; const margem = 36;
  const fontes = [...new Map((categoria?.caminhos ?? []).flatMap(c => c.nos).map(n => [n.nome, n])).values()];
  const locais = new Map(fontes.map(n => [n.nome, n]));
  const dependencias = new Map(fontes.map(no => [no.nome, [...new Set((no.requisitos ?? [])
    .flatMap(r => origensRequisito(r, porNome)).filter(nome => locais.has(nome) && nome !== no.nome))]]));
  const colunas = new Map();
  const horizontais = new Set((categoria?.caminhos ?? [])
    .filter(c => c.nos.every(no => !dependencias.get(no.nome)?.length)).map(c => c.nome));
  // Anchor horizontal roots before resolving depth, including dependencies from another lane.
  for ( const caminho of categoria?.caminhos ?? [] ) {
    if ( horizontais.has(caminho.nome) ) caminho.nos.forEach((no, indice) => colunas.set(no.nome, indice));
  }
  const visitando = new Set();
  /**
   * Resolve dependency depth while allowing cycles to remain inspectable.
   * @param {string} nome Node name.
   * @returns {number} Column index.
   */
  function profundidade(nome) {
    if ( colunas.has(nome) ) return colunas.get(nome);
    if ( visitando.has(nome) ) return 0; // Bad imported cycles remain inspectable in the GM editor.
    visitando.add(nome);
    const pais = dependencias.get(nome);
    const coluna = pais.length ? Math.max(...pais.map(profundidade)) + 1 : 0;
    visitando.delete(nome);
    colunas.set(nome, coluna);
    return coluna;
  }
  fontes.forEach(no => profundidade(no.nome));
  const nos = []; const caminhos = [];
  let y = margem;
  for ( const caminho of categoria?.caminhos ?? [] ) {
    const linhasColuna = new Map();
    // Level/count/informative gates do not form dependency branches. Lay those lanes out horizontally.
    caminhos.push({ nome: caminho.nome, y, quantidade: caminho.nos.length });
    y += 88;
    for ( const no of caminho.nos ) {
      if ( nos.some(n => n.nome === no.nome) ) continue;
      const coluna = colunas.get(no.nome) ?? 0;
      const linha = linhasColuna.get(coluna) ?? 0;
      linhasColuna.set(coluna, linha + 1);
      nos.push({ ...no, x: margem + (coluna * passoX), y: y + (linha * passoY) });
    }
    y += (Math.max(1, ...linhasColuna.values()) * passoY) + 20;
  }
  const posicoes = new Map(nos.map(n => [n.nome, n]));
  const linhas = [];
  for ( const destino of nos ) {
    for ( const nome of dependencias.get(destino.nome) ) {
      if ( ocultas[`${nome}|${destino.nome}`] ) continue;
      const origem = posicoes.get(nome);
      const x1 = origem.x + noLargura; const y1 = origem.y + (noAltura / 2);
      const x2 = destino.x; const y2 = destino.y + (noAltura / 2);
      const adjacente = y1 === y2 && x2 > x1 && x2 - x1 < passoX;
      // Vertical segments live in column gutters; horizontal segments use the row gutter.
      const d = adjacente ? `M ${x1} ${y1} H ${x2}`
        : `M ${x1} ${y1} H ${x1 + 18} V ${origem.y + noAltura + 18} H ${x2 - 18} V ${y2} H ${x2}`;
      linhas.push({ de: nome, para: destino.nome,
        d });
    }
  }
  return { nos, linhas, caminhos, noLargura, noAltura,
    largura: Math.max(540, ...nos.map(n => n.x + noLargura + margem)),
    altura: Math.max(360, y) };
}
