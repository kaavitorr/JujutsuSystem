import Ruleset from "./ruleset.mjs";
import { updateEnergyShieldTree } from "./legacy2-energy-shield-tree.mjs";

/**
 * ── ESPECIALIZAÇÕES 2.0 (Skill Tree) ────────────────────────────────────────
 * Motor de dados da árvore: carrega os feats do compendium
 * "Geral - 2.0" (flags.jujutsu-system.especializacao = { categoria, caminho,
 * requisitos[] }), monta o grafo categoria → caminho → habilidades e avalia
 * requisitos contra o ator.
 *
 * Estado adquirido: flags.jujutsu-system.especializacoes = [nome, ...]
 * Orçamento de escolhas: estilo.espIniciais + 2×⌊nível/2⌋ + Surto de Potencial
 * (3 no 10º nível, +5 no 15º, +5 no 20º) + concessão do Mestre
 * (system.legacy2.especiaisExtra).
 */

const PACK = "jujutsu-compendium.geral-2-0";

/** Cores por categoria (mesmas das pastas do compendium). */
export const CORES_CATEGORIA = Object.freeze({
  "Feitiço Inato": "#8a4fd0",
  "Técnicas de Barreira": "#4f8ad0",
  "Proezas Físicas": "#c05040",
  "Habilidades Especiais": "#d0a040",
  "Energia Reversa": "#40b070",
  "Domínio e Anti-Domínio": "#d04080"
});

/** Ordem fixa das categorias no hexágono (sentido horário, topo primeiro). */
export const ORDEM_CATEGORIAS = Object.freeze([
  "Feitiço Inato",
  "Técnicas de Barreira",
  "Proezas Físicas",
  "Habilidades Especiais",
  "Energia Reversa",
  "Domínio e Anti-Domínio"
]);

/* ── Cache do grafo (recarregado quando o índice muda) ────────────────────── */

let _grafo = null;
let _porNome = null;

/**
 * Carrega o grafo de especializações do compendium.
 * @returns {Promise<{categorias: object[], porNome: Map}>}
 *   categorias: [{ nome, cor, caminhos: [{ nome, cor, nos: [no] }] }]
 *   no: { nome, categoria, caminho, requisitos[], uuid, img, descricao }
 */
export async function carregarGrafo() {
  await updateEnergyShieldTree();
  const pack = game.packs.get(PACK);
  if ( !pack ) return { categorias: [], porNome: new Map() };
  // O índice do pack não inclui flags — carrega os documentos completos (em cache)
  const docs = await pack.getDocuments();

  const nos = [];
  for ( const doc of docs ) {
    const esp = doc.flags?.["jujutsu-system"]?.especializacao;
    if ( !esp ) continue;
    nos.push({
      nome: doc.name,
      categoria: esp.categoria,
      caminho: esp.caminho ?? null,
      requisitos: esp.requisitos ?? [],
      uuid: doc.uuid,
      img: doc.img ?? "systems/jujutsu-system/icons/svg/items/feature.svg",
      descricao: doc.system?.description?.value ?? ""
    });
  }
  // Camada de ADM: requisitos efetivos editados pelo GM (world setting)
  const overrides = game.settings?.get("jujutsu-system", "especializacoesReq") ?? {};
  for ( const no of nos ) {
    if ( Array.isArray(overrides[no.nome]) ) no.requisitos = overrides[no.nome];
  }

  _porNome = new Map(nos.map(n => [n.nome, n]));

  // Categorias na ordem do hexágono; "Visão Geral" é nó de categoria, não de caminho
  const categorias = ORDEM_CATEGORIAS
    .filter(nome => nos.some(n => n.categoria === nome))
    .map(nome => ({
      nome,
      cor: CORES_CATEGORIA[nome] ?? "#888888",
      caminhos: []
    }));

  for ( const n of nos ) {
    const cat = categorias.find(c => c.nome === n.categoria);
    if ( !cat ) continue;
    if ( !n.caminho ) continue; // visão geral da categoria — não é nó de caminho
    let caminho = cat.caminhos.find(c => c.nome === n.caminho);
    if ( !caminho ) {
      caminho = { nome: n.caminho, cor: cat.cor, nos: [] };
      cat.caminhos.push(caminho);
    }
    caminho.nos.push(n);
  }

  _grafo = { categorias, porNome: _porNome };
  return _grafo;
}

/** Grafo em cache (carrega na primeira chamada). */
export function obterGrafo() {
  return _grafo ?? carregarGrafo();
}

/* ── Estado adquirido ─────────────────────────────────────────────────────── */

/** Nomes das especializações adquiridas pelo ator. */
export function adquiridas(actor) {
  return actor?.getFlag("jujutsu-system", "especializacoes") ?? [];
}

/** O ator possui a especialização? */
export function tem(actor, nome) {
  return adquiridas(actor).includes(nome);
}

/** Registra/esquece uma especialização (persistência atômica). */
export async function aprender(actor, nome) {
  const lista = adquiridas(actor);
  if ( lista.includes(nome) ) return;
  await actor.setFlag("jujutsu-system", "especializacoes", [...lista, nome]);
  await criarItemEspecializacao(actor, nome);
}

export async function esquecer(actor, nome) {
  const lista = adquiridas(actor);
  if ( !lista.includes(nome) ) return;
  await actor.setFlag("jujutsu-system", "especializacoes", lista.filter(n => n !== nome));
  await removerItemEspecializacao(actor, nome);
}

/**
 * Cria na ficha o feat do compendium referente à especialização aprendida.
 * O item recebe a flag especializacaoAdquirida (identifica o que a árvore
 * concedeu) e featureSection para agrupar na aba Características.
 */
async function criarItemEspecializacao(actor, nome) {
  const no = _porNome?.get(nome);
  if ( !no?.uuid ) return;
  const existente = actor.items.find(i =>
    i.name === nome && i.getFlag("jujutsu-system", "especializacaoAdquirida"));
  if ( existente ) return;
  const doc = await fromUuid(no.uuid);
  if ( !doc ) return;
  const dados = doc.toObject();
  delete dados._id;
  foundry.utils.mergeObject(dados, {
    flags: { "jujutsu-system": {
      especializacaoAdquirida: true,
      especializacao: no,
      featureSection: "jj-combat"
    }}
  }, { overwrite: false });
  // garante as flags mesmo se o doc já as tinha
  dados.flags["jujutsu-system"] = foundry.utils.mergeObject(
    dados.flags["jujutsu-system"] ?? {},
    { especializacaoAdquirida: true, featureSection: "jj-combat" }
  );
  await Item.implementation.create(dados, { parent: actor });
}

/** Remove da ficha o feat concedido pela árvore para a especialização. */
async function removerItemEspecializacao(actor, nome) {
  const itens = actor.items.filter(i =>
    i.name === nome && i.getFlag("jujutsu-system", "especializacaoAdquirida"));
  if ( itens.length ) await actor.deleteEmbeddedDocuments("Item", itens.map(i => i.id));
}

/**
 * Concilia itens ↔ estado da árvore: cria o feat de especializações
 * adquiridas sem item (ex.: aprendidas antes desta sincronização) e
 * remove itens concedidos cuja escolha foi desfeita. Idempotente.
 */
export async function sincronizarEspecializacoes(actor, grafo) {
  if ( !actor || !grafo?.porNome ) return;
  const lista = adquiridas(actor);
  const concedidos = actor.items.filter(i =>
    i.getFlag("jujutsu-system", "especializacaoAdquirida"));
  const faltando = lista.filter(nome =>
    !actor.items.some(i => i.name === nome));
  for ( const nome of faltando ) await criarItemEspecializacao(actor, nome);
  const remover = concedidos.filter(i => !lista.includes(i.name));
  if ( remover.length ) {
    await actor.deleteEmbeddedDocuments("Item", remover.map(i => i.id));
  }
}

/* ── Orçamento de escolhas ───────────────────────────────────────────────── */

/**
 * Total de escolhas de especialização do ator:
 * Estilo (grátis iniciais) + 2 por nível par + Surto de Potencial
 * (3 no 10º, +5 no 15º, +5 no 20º) + concessão do Mestre + slots do
 * caminho do Estilo na criação (Médico de Campo +1, Mestre de Barreiras +3).
 */
export function escolhasTotais(actor) {
  const estilo = Ruleset.estilo(actor) ?? {};
  const nivel = Ruleset.nivel(actor);
  const iniciais = Number(estilo.espIniciais ?? 0);
  const porNivel = 2 * Math.floor(nivel / 2);
  const surto = (nivel >= 20 ? 5 : 0) + (nivel >= 15 ? 5 : 0) + (nivel >= 10 ? 3 : 0);
  const extra = Number(actor?.system?.legacy2?.especiaisExtra ?? 0);
  const caminho = Number(actor?.getFlag?.("jujutsu-system", "caminhoEstilo")?.slotsExtras ?? 0);
  return iniciais + porNivel + surto + extra + caminho;
}

/** Escolhas ainda disponíveis. */
export function escolhasDisponiveis(actor) {
  return Math.max(0, escolhasTotais(actor) - adquiridas(actor).length);
}

/* ── Motor de requisitos ─────────────────────────────────────────────────── */

const RX_CONTAGEM = /^(?:todas as outras\s+)?(\d+)\s*[Hh]abilidades?\s*(?:de\s+especializa[çc][ãa]o\s+)?(?:do|da|de)\s+(.+)$/i;
const RX_NIVEL = /^(?:\d+)º?\s*n[íi]vel(?:\s+(?:de\s+personagem))?(?:\s*ou\s*superior)?$/i;
const RX_ATRIBUTO = /^(\d+)\s*[Pp]ontos?\s*de\s+([A-ZÀ-Ú][a-zà-ú]+)$/;

const NIVEL_PAR_TEXTO = { "4": 4, "3": 3, "2": 2, "1": 1 };

/** Nome do atributo em pt → chave (Força→str, Presença→cha…). */
const MAPA_ATRIBUTOS = {
  "forca": "str", "força": "str", "agilidade": "dex", "constituicao": "con",
  "constituição": "con", "intelecto": "int", "sabedoria": "wis", "presenca": "cha", "presença": "cha"
};

const ESTILOS_CONHECIDOS = ["Restringido", "Lutador", "Sentinela", "Especialista", "Estrategista"];

/* ── Restrições de Estilo sobre a árvore ─────────────────────────────────────
 * Restringido: sem Feitiço Inato, Técnicas de Barreira, Domínio e
 * Anti-Domínio nem Energia Reversa; em Proezas Físicas só Corpo de Guerreiro
 * (sem Punho Divergente nem Canalização de Energia); em Habilidades
 * Especiais só Existência Aprimorada (Ofensivo/Defensivo) — sem Novo Estilo
 * das Sombras nem Ressonância da Alma. Vale na skill tree E no creation. */
export const RESTRICOES_ESTILO = Object.freeze({
  restringido: Object.freeze({
    categoriasBloqueadas: ["Feitiço Inato", "Técnicas de Barreira", "Domínio e Anti-Domínio", "Energia Reversa"],
    caminhosBloqueados: Object.freeze({
      "Proezas Físicas": ["Punho Divergente", "Canalização de Energia"],
      "Habilidades Especiais": ["Novo Estilo das Sombras", "Ressonância da Alma"]
    })
  })
});

/** O documento de classe do estilo do ator (não só as flags legacy2). */
export function documentoEstilo(actor) {
  return actor?.itemTypes?.class?.find(c => !!c.getFlag?.("jujutsu-system", "legacy2")) ?? null;
}

/** Restrições que o estilo do documento impõe à árvore (null se nenhuma). */
export function restricaoDoEstilo(estilo) {
  const chave = String(estilo?.system?.identifier ?? estilo?.name ?? "").toLowerCase().trim();
  return RESTRICOES_ESTILO[chave] ?? null;
}

/** Motivo pelo qual o estilo não permite o nó — ou null se permitido. */
export function bloqueioDeEstilo(estilo, no) {
  const restricao = restricaoDoEstilo(estilo);
  if ( !restricao || !no?.caminho ) return null;
  if ( restricao.categoriasBloqueadas.includes(no.categoria) )
    return `O Restringido não pode aprender habilidades de ${no.categoria}.`;
  const caminhos = restricao.caminhosBloqueados[no.categoria];
  if ( caminhos?.includes(no.caminho) )
    return `O Restringido não pode aprender o caminho ${no.caminho}.`;
  return null;
}

/**
 * Avalia UM requisito textual contra o ator.
 * @returns {{ok: boolean, texto: string, tipo: string}} tipo: nó|contagem|nivel|atributo|estilo|info
 */
function avaliarRequisito(actor, requisito, nomeNo) {
  const req = String(requisito).trim();

  // (a) nome de outro nó do grafo (com ou sem >< na fonte original)
  const limpo = req.replaceAll(">", "").replaceAll("<", "").trim();
  if ( _porNome?.has(limpo) ) {
    return { ok: adquiridas(actor).includes(limpo), texto: limpo, tipo: "no" };
  }

  // "A ou B (ou C…)" — requisitos alternativos: basta UMA das partes. Só vale
  // como alternativa se TODAS as partes forem requisitos reconhecíveis; com
  // qualquer parte desconhecida o texto inteiro cai no teste a seguir.
  if ( req.includes(" ou ") ) {
    const partes = req.split(/\s+ou\s+/i).map(p => p.trim());
    if ( partes.length > 1 ) {
      const res = partes.map(p => avaliarRequisito(actor, p, nomeNo));
      if ( res.every(r => r.tipo !== "info") ) {
        return { ok: res.some(r => r.ok), texto: req, tipo: "alternativo" };
      }
    }
  }

  // "A e B" — cumulativos: TODAS as partes obrigatórias, mesma guarda do OU.
  // (Nós com " e " no nome — "Cone e Leque", "Domínio e Anti-Domínio" — já
  // foram resolvidos no (a); parte desconhecida rejeita o split inteiro.)
  if ( req.includes(" e ") ) {
    const partes = req.split(/\s+e\s+/).map(p => p.trim());
    if ( partes.length > 1 ) {
      const res = partes.map(p => avaliarRequisito(actor, p, nomeNo));
      if ( res.every(r => r.tipo !== "info") ) {
        return { ok: res.every(r => r.ok), texto: req, tipo: "cumulativo" };
      }
    }
  }

  // (b) "N Habilidades do/de <alvo>" — alvo pode ser caminho ("Existência
  //     Aprimorada - Ofensivo"), categoria ("Energia Reversa") ou o total
  //     geral ("Especialização [Totais]"). Aceita prefixo "Todas as outras".
  const mCont = req.match(RX_CONTAGEM);
  if ( mCont ) {
    const qtd = Number(mCont[1]);
    const alvo = mCont[2].trim().replace(/\s+totais?$/i, "").trim();
    if ( /^especializa/i.test(alvo) ) {
      return { ok: adquiridas(actor).length >= qtd, texto: req, tipo: "contagem" };
    }
    const norm = (s) => (s ?? "").toLowerCase();
    const ehCategoria = [...new Set([...(_porNome?.values() ?? [])].map(n => n.categoria))]
      .some(c => norm(c) === norm(alvo));
    const tem = adquiridas(actor).filter(nome => {
      const no = _porNome?.get(nome);
      if ( !no ) return false;
      return ehCategoria ? norm(no.categoria) === norm(alvo)
                         : norm(no.caminho) === norm(alvo);
    }).length;
    return { ok: tem >= qtd, texto: req, tipo: "contagem" };
  }

  // (c) nível
  if ( RX_NIVEL.test(req) ) {
    const num = parseInt(req, 10);
    return { ok: Ruleset.nivel(actor) >= num, texto: req, tipo: "nivel" };
  }

  // (d) atributo
  const mAtr = req.match(RX_ATRIBUTO);
  if ( mAtr ) {
    const chave = MAPA_ATRIBUTOS[mAtr[2].toLowerCase()];
    if ( chave ) {
      const valor = Number(actor?.system?.abilities?.[chave]?.value ?? 0);
      return { ok: valor >= Number(mAtr[1]), texto: req, tipo: "atributo" };
    }
  }

  // (e) estilo de combate
  if ( ESTILOS_CONHECIDOS.some(e => req.toLowerCase() === e.toLowerCase()) ) {
    const classe = actor?.itemTypes?.class?.find(c => !!c.getFlag("jujutsu-system", "legacy2"));
    return { ok: classe?.name?.toLowerCase() === req.toLowerCase(), texto: req, tipo: "estilo" };
  }

  // (f) requisito-informativo (validação fica com o Mestre)
  return { ok: false, texto: req, tipo: "info" };
}

/**
 * Estado de um nó para o ator: adquirido | disponível | bloqueado.
 * @returns {{estado: string, pendencias: {texto,tipo}[], informativos: string[]}}
 */
export function avaliarNo(actor, no) {
  if ( tem(actor, no.nome) ) return { estado: "adquirido", pendencias: [], informativos: [] };

  const pendencias = [];
  const informativos = [];
  const bloqueio = bloqueioDeEstilo(documentoEstilo(actor), no);
  if ( bloqueio ) pendencias.push({ texto: bloqueio });
  for ( const req of no.requisitos ?? [] ) {
    const res = avaliarRequisito(actor, req, no.nome);
    if ( res.tipo === "info" ) informativos.push(res.texto);
    else if ( !res.ok ) pendencias.push(res);
  }
  const estado = (pendencias.length === 0) && (informativos.length === 0)
    ? "disponivel"
    : "bloqueado";
  return { estado, pendencias, informativos };
}
