import { avaliarNo } from "../../../systems/especializacoes-2.mjs";
import { ICONES_CATEGORIA, construirMapaCategoria, origensRequisito, contagensRequisito } from "../jj/skill-tree-map-2.mjs";
import { creationActor, creationPodeEscolher, evaluateCreationSpecialization } from "./creation-model-2.mjs";

const normalize = text => String(text ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** The same positioned graph as the sheet, evaluated only against the local creation draft. */
export function buildCreationTree(draft, style, catalog, { category, focus, search = "", ocultas = {}, busy = false } = {}) {
  const graph = catalog.graph, categories = graph.categorias ?? [];
  const selectedCategory = categories.find(cat => cat.nome === category) ?? categories[0] ?? { nome: "Especializações", caminhos: [] };
  const layout = construirMapaCategoria(selectedCategory, graph.porNome, { ocultas });
  const selected = layout.nos.find(node => node.nome === focus);
  const required = new Set((selected?.requisitos ?? []).flatMap(text => origensRequisito(text, graph.porNome)));
  const query = normalize(search);
  const nodes = layout.nos.map(node => {
    const picked = draft.specializations.includes(node.nome);
    const evaluation = evaluateCreationSpecialization(draft, style, node);
    const canChoose = !!style && creationPodeEscolher(draft, style, node, catalog);
    const estado = picked ? "adquirido" : canChoose ? "disponivel" : "bloqueado";
    const reason = evaluation.pendencias.map(pending => pending.texto).join("; ")
      || (!style ? "Escolha um Estilo de Combate." : !canChoose ? "Nenhuma escolha inicial disponível para esta habilidade." : "");
    return { ...node, estado, picked, canChoose: !busy && canChoose, selecionado: node.nome === focus,
      exigido: required.has(node.nome), livre: !node.requisitos?.length,
      estadoLabel: picked ? "Selecionada" : canChoose ? "Disponível" : "Indisponível na criação",
      contagem: (node.requisitos ?? []).flatMap(text => contagensRequisito(text, draft.specializations, graph.porNome))[0],
      searchMatch: !!query && normalize(node.nome).includes(query), searchDim: !!query && !normalize(node.nome).includes(query),
      dica: picked ? "Selecionada na criação" : reason || "Disponível", reason };
  });
  const byName = new Map(nodes.map(node => [node.nome, node]));
  const preview = creationActor(draft, style);
  return { creationMode: true, busy, search,
    mapa: { ...layout, nos: nodes, linhas: layout.linhas.map(line => ({ ...line, estado: byName.get(line.para)?.estado,
      destaque: line.de === focus || line.para === focus })) },
    categorias: categories.map(cat => {
      const names = [...new Set(cat.caminhos.flatMap(path => path.nos.map(node => node.nome)))];
      return { nome: cat.nome, cor: cat.cor, icone: ICONES_CATEGORIA[cat.nome], ativa: cat.nome === selectedCategory.nome,
        total: names.length, aprendidas: names.filter(name => draft.specializations.includes(name)).length };
    }),
    categoria: { nome: selectedCategory.nome, icone: ICONES_CATEGORIA[selectedCategory.nome],
      total: nodes.length, aprendidas: nodes.filter(node => node.picked).length },
    quantidadeCaminhos: selectedCategory.caminhos.length, selecionado: byName.get(focus) ?? null,
    searchMatches: nodes.filter(node => node.searchMatch).length,
    requisitos: (selected?.requisitos ?? []).map(texto => {
      const evaluation = avaliarNo(preview, { nome: "", requisitos: [texto] });
      return { texto, ok: evaluation.estado === "disponivel", informativo: !!evaluation.informativos.length,
        contagens: contagensRequisito(texto, draft.specializations, graph.porNome),
        links: origensRequisito(texto, graph.porNome).map(nome => ({ nome, categoria: graph.porNome.get(nome)?.categoria })) };
    }) };
}
