/** Author-supplied catalog rules. Existing feat identifiers remain stable. */
import { SPEED_BURST_DESCRIPTION, SPEED_BURST_VERSION, potentialRecovery } from "./legacy2-potential-points.mjs";
export const CORPO_GUERREIRO_ORDER = Object.freeze([
  "Explosão de Velocidade", "Passo Esguio", "Reação Acelerada", "Punho Devastador",
  "Entrada Impactante", "Punho de Aço", "Ataque Potencializado", "Ira do Berserker",
  "Potencialização Extrema", "Corpo Indestrutível", "Ataque Cruel"
]);

export const PHYSICAL_SPECIALIZATIONS = Object.freeze({
  "Explosão de Velocidade": {
    id: "jj2a000000000041", identifier: "explosao-de-velocidade", path: "Corpo de Guerreiro", requirements: [],
    version: SPEED_BURST_VERSION, description: SPEED_BURST_DESCRIPTION,
    uses: { max: "5", recovery: potentialRecovery() }
  },
  "Reação Acelerada": {
    id: "jj2reacaoacel001", identifier: "reacao-acelerada", path: "Corpo de Guerreiro",
    requirements: ["6 Habilidades de Especialização Totais"], version: 2,
    img: "icons/skills/movement/figure-running-gray.webp",
    description: "<p>Uma vez por rodada, você pode ativar uma habilidade que tenha a Palavra-Chave “Reação”, consumindo um Ponto de Ação [⬢] a menos, até o mínimo de 1.</p>"
  },
  "Energia Atrasada": {
    id: "jj2a000000000051", identifier: "energia-atrasada", path: "Punho Divergente", requirements: [],
    description: "<p>Você pode escolher sofrer até 6 Desvantagens em sua Rolagem de Ataque Comum para atrasar propositalmente sua Energia Amaldiçoada, fazendo com que ela atinja o alvo uma segunda vez logo após o impacto inicial e produza dois golpes distintos. Caso obtenha um resultado natural de 15 ou mais na Rolagem de Ataque e acerte o alvo, você causa novamente o dano do primeiro ataque, até um limite igual à metade do seu Atributo Principal para cada Desvantagem escolhida.</p>"
      + "<p>Por exemplo, ao se impor 3 Desvantagens, o limite de dano adicional passa a ser igual a 3 vezes a metade do seu Atributo Principal.</p>"
      + "<p>Esse segundo impacto conta como uma Rolagem de Ataque Comum separada, mas utiliza o mesmo resultado de acerto do ataque original.</p>"
  },
  "Impacto Concussivo": {
    id: "jj2a000000000057", identifier: "impacto-concussivo", path: "Punho Divergente", requirements: ["Ativação Aprimorada"],
    description: "<p>Você faz com que seus golpes com “Energia Atrasada” se tornem ainda mais potentes. O cálculo passa a usar seu Atributo Principal inteiro em vez de metade. Além disso, você pode ativar Energia Atrasada com um limite de dano de até 3 vezes seu Atributo Principal sem receber desvantagens.</p>"
  }
});

export const PHYSICAL_CATALOG_VERSION = 1;
export const PHYSICAL_CATALOG_MARKER = "physicalSpecializationsVersion";
export const specializationDescription = rule => (rule.requirements.length
  ? `<p><em><strong>Requisito:</strong> ${rule.requirements.join(" e ")}</em></p>` : "") + rule.description;
