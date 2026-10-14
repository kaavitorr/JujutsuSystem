/**
 * ── GERADOR DO COMPENDIUM "Geral - 2.0" ─────────────────────────────────────
 * Gera os itens de Classe (Estilos de Combate) da 2.0 em packs/_source/.
 *
 *   node ./utils/geral-2-0.mjs          # escreve os YAML
 *   node ./utils/packs.mjs package pack geral-2-0   # compila o LevelDB
 *
 * Os textos das descrições são completos (sem resumo) — fontes:
 * docs/regras-2.0/capitulo-5-estilos-de-combate.md
 */
import fs from "node:fs";
import path from "node:path";
import * as YAML from "js-yaml";

const PACK = "geral-2-0";
const slugify = (s) => s.toString().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const SRC = path.join("packs", "_source", PACK);

/* ── HTML compartilhado (regras gerais de Estilo de Combate) ─────────────── */

const GERAL_HTML = `
<hr>
<h2>Regras Gerais do Estilo de Combate</h2>
<h3>Estilos de Combate</h3>
<table>
  <thead><tr><th>Categoria</th><th>Pontos de Vida</th><th>Atributo Principal</th></tr></thead>
  <tbody>
    <tr><td>Restringido</td><td>7</td><td>Força ou Agilidade</td></tr>
    <tr><td>Lutador</td><td>7</td><td>Força ou Agilidade</td></tr>
    <tr><td>Sentinela</td><td>6</td><td>Agilidade</td></tr>
    <tr><td>Especialista</td><td>5</td><td>Intelecto</td></tr>
    <tr><td>Estrategista</td><td>4</td><td>Sabedoria</td></tr>
  </tbody>
</table>
<h3>Salvaguardas</h3>
<p>Cada categoria concede proficiência em Salvaguardas, permitindo que o jogador receba duas opções. Ao escolher sua categoria, você ganha proficiência permanentemente nos atributos listados ao realizar uma rolagem de Salvaguarda dele.</p>
<h3>Pontos de Vida</h3>
<p>Pontos de vida representam a vitalidade do personagem, refletindo sua saúde física e a quantidade de ferimentos presentes. Um personagem com poucos pontos de vida está gravemente ferido, com órgãos perfurados ou até mesmo membros decepados. Por outro lado, um personagem com todos os pontos de vida está com boa saúde e totalmente recuperado.</p>
<p>Cada Estilo de Combate concede um valor base de Pontos de Vida, esse valor é recebido em adicional a cada vez que um personagem sobe de nível ou aumenta seu valor de Constituição.</p>
<h3>Pontos de Proficiência</h3>
<p>Você recebe <strong>1 Ponto de Proficiência</strong> toda vez que sobe de nível de personagem, permitindo que você aumente sua proficiência em um conjunto de armas ou em uma perícia específica.</p>
<h3>Lança e Escudo</h3>
<p>Você aprendeu a utilizar sua energia amaldiçoada para aumentar a quantidade de dano de seus ataques assim como reduzir dos golpes inimigos. Você recebe acesso as seguintes características:</p>
<ul>
  <li><strong>Explosão Ofensiva:</strong> Ao realizar uma jogada de ataque (Comum ou de Técnica), você pode gastar 1 PA para adicionar 1d4 de dano adicional, até um máximo igual a metade do seu nível de personagem, arredondado para baixo.</li>
  <li><strong>Explosão Defensiva:</strong> Você pode gastar 1 PA para reduzir 1d4 do próximo dano sofrido até um máximo igual a metade do seu nível de personagem, arredondado para baixo.</li>
</ul>
<h3>Habilidades de Especialização</h3>
<p>A cada nível par, você recebe 2 habilidades de especialização do Capítulo 6. Existem 4 categorias de especializações. Sendo elas Técnica Inata, Físico Treinado, Técnicas de Barreira e Técnica de Reversão.</p>
<p>Um personagem deve seguir a progressão de cada especialização para avançar como Feiticeiro.</p>
<h3>Calculando a Classe de Resistência e o Dano</h3>
<p>Primeiro, determine o atributo principal do seu personagem, definido pelo seu Estilo de Combate. Em seguida, utilize as regras abaixo.</p>
<p><strong>Classe de Resistência</strong> — Quando você não estiver vestindo qualquer armadura ou proteção, sua Classe de Resistência é igual a:</p>
<p><em>10 + (atributo principal + atributo de agilidade + atributo de constituição) / 3</em></p>
<p>Quando o resultado da Classe de Resistência terminar em uma fração, você deve arredonda-lo para baixo.</p>
<p><strong>Dano Padrão</strong> — Seu dano padrão é 1d4, a menos que uma habilidade altere esse dado base. O dano de um personagem aumenta em um passo a cada 4 níveis de personagem, até um máximo de d12.</p>
<p><em>Passos de Dano: 1d4 → 1d6 → 1d8 → 1d10 → 1d12.</em></p>
<p>O dado de dano principal não pode ultrapassar 1d12, salvo quando uma habilidade especificar o contrário.</p>
<h3>Tabela de Nível de Maestria</h3>
<table>
  <thead><tr><th>Nível</th><th>Feiticeiro</th><th>Evolução do Feitiço</th><th>Nível</th><th>Feiticeiro</th><th>Evolução do Feitiço</th></tr></thead>
  <tbody>
    <tr><td>1º</td><td>4º Grau</td><td>Feitiço Básico</td><td>11º</td><td>—</td><td>—</td></tr>
    <tr><td>2º</td><td>—</td><td>—</td><td>12º</td><td>Especial</td><td>—</td></tr>
    <tr><td>3º</td><td>—</td><td>—</td><td>13º</td><td>—</td><td>—</td></tr>
    <tr><td>4º</td><td>3º Grau</td><td>Feitiço Estendido</td><td>14º</td><td>—</td><td>—</td></tr>
    <tr><td>5º</td><td>—</td><td>—</td><td>15º</td><td>—</td><td>—</td></tr>
    <tr><td>6º</td><td>—</td><td>—</td><td>16º</td><td>—</td><td>Expansão sem Barreiras</td></tr>
    <tr><td>7º</td><td>2º Grau</td><td>—</td><td>17º</td><td>—</td><td>—</td></tr>
    <tr><td>8º</td><td>—</td><td>Feitiço Máximo</td><td>18º</td><td>—</td><td>—</td></tr>
    <tr><td>9º</td><td>—</td><td>—</td><td>19º</td><td>—</td><td>—</td></tr>
    <tr><td>10º</td><td>1º Grau</td><td>Expansão de Domínio</td><td>20º</td><td>—</td><td>—</td></tr>
  </tbody>
</table>
`;

/* ── Descrições específicas de cada Estilo ───────────────────────────────── */

const RESTRINGIDO = `
<h1>RESTRINGIDO</h1>
<h3>Pontos de Vida</h3>
<p><strong>Vida Base:</strong> 7 por nível de personagem.<br><strong>Vida por Ponto de Constituição:</strong> 7 por ponto.</p>
<h3>Proficiências</h3>
<ul>
  <li><strong>Equipamentos:</strong> Recebe 4 Pontos de Proficiência para distribuir como desejar entre as armas</li>
  <li><strong>Salvaguarda:</strong> Recebe 3 Pontos de Proficiência para distribuir entre as Salvaguardas.</li>
  <li><strong>Perícias:</strong> Escolha 4 Pontos de Proficiência para distribuir entre Perícias, sem ser Feitiço.</li>
</ul>
<h3>Informações Gerais</h3>
<ul>
  <li><strong>Atributo Principal:</strong> Força ou Agilidade (à sua escolha).</li>
  <li><strong>Habilidades de Especialização:</strong> Você recebe 1 habilidade de "Proeza Física" que você tenha os requisitos.</li>
  <li><strong>Equipamentos:</strong> Você recebe uma arma amaldiçoada de 4º grau, um par óculos ou lentes de contato que permite ver energia amaldiçoada e; ¥ 5.000.</li>
  <li><strong>Arsenal Vazio:</strong> Você recebe um Espírito com a habilidade "Inventário" que demora 9 níveis para amadurecer e ser usado. Ele pode armazenar 10 ferramentas e não sofre dano ou pode ser alvo enquanto estiver junto de seu corpo.</li>
</ul>
<h2>Características de Combate</h2>
<h3>Vazio de Energia</h3>
<p>Devido a sua restrição, você recebeu certos benefícios gerais que ajudam você a se sobressair em combate. Você recebe as seguintes características:</p>
<ul>
  <li>Você é imune ao efeito de acerto garantido das Expansões de Domínios e similares;</li>
  <li>Você é imune a habilidade de "Sentir Maldição" da habilidade de Manipulação de Energia;</li>
  <li>Você pode passar livremente em expansões de domínio ou barreiras, se movendo livremente;</li>
  <li>Você sempre possui uma progressão de proficiência "Mestre" em Testes de Atributo de Atletismo e Coordenação;</li>
  <li>Você recebe 4 + seu atributo de Constituição em Pontos de Estamina (PE) que são recuperados no início de cada um de seus turnos. A partir do 10º nível, sua base se torna 8 + atributo no lugar do original.</li>
</ul>
<p><strong>Você não pode se beneficiar de características de manipulação de Energia ou Habilidades de Especialização de Feitiço Inato, Técnicas de Barreira e Técnicas de Reversão.</strong></p>
<h3>Físico Perfeito</h3>
<p>Seu físico evoluiu, te dando um metabolismo extremamente acelerado e um vigor extremo. Você recebe acesso as seguintes características:</p>
<ul>
  <li><strong>Gênio Marcial:</strong> Você possui uma capacidade extraordinária para desenvolver técnicas e habilidades que auxiliam em combate. A qualquer momento, você pode consumir 5 PT para criar uma nova técnica de até 7º grau, seguindo as regras de criação de técnicas comuns apresentadas no Manual de Feitiços. Não existe um limite de quantas técnicas adicionais você pode criar, desde que você consuma os Pontos de Treinamento necessários.</li>
  <li><strong>Metabolismo Extremo:</strong> Seu descanso longo se torna de 2 horas e seu curto de 5 minutos.</li>
  <li><strong>Impulso Físico:</strong> Você pode gastar 1 PE para aumentar seu dano em 2d4 o diminuir o dano sofrido no mesmo valor, até um máximo igual metade do seu nível de personagem (arredondado para baixo).</li>
  <li><strong>Sentidos Extremos:</strong> Você recebe Sentido Verdadeiro em uma área de 36 metros ao seu redor.</li>
</ul>
`;

const LUTADOR = `
<h1>LUTADOR</h1>
<h3>Pontos de Vida</h3>
<p><strong>Vida Base:</strong> 7 por nível de personagem.<br><strong>Vida por Ponto de Constituição:</strong> 7 por ponto.</p>
<h3>Energia Amaldiçoada</h3>
<p><strong>Energia Base:</strong> 10 por nível de personagem.</p>
<h3>Proficiências</h3>
<ul>
  <li><strong>Equipamentos:</strong> Recebe 2 Pontos de Proficiência entre qualquer tipo de arma.</li>
  <li><strong>Salvaguarda:</strong> Recebe 2 Pontos de Proficiência para distribuir entre as Salvaguardas.</li>
  <li><strong>Perícias:</strong> Escolha 3 Pontos de Proficiência para distribuir entre as Perícias.</li>
</ul>
<h3>Informações Gerais</h3>
<ul>
  <li><strong>Atributo Principal:</strong> Força.</li>
  <li><strong>Habilidades de Especialização:</strong> Você recebe 2 habilidades de "Proeza Física".</li>
  <li><strong>Equipamentos:</strong> Uma arma marcial ou ¥ 3.000 e; ¥ 5.000.</li>
</ul>
<h2>Características de Combate</h2>
<h3>Guerrilheiro</h3>
<p>Como um lutador, você pode se especializar tanto em lutar com armas como desarmado, recebendo bônus diferentes dependendo do caminho escolhido.</p>
<h4>Mestre das Armas</h4>
<p>Você treinou incansavelmente na utilização de um tipo de Ferramenta Amaldiçoada específica, permitindo que você dominasse seu uso próximo a perfeição. Você recebe acesso as seguintes características:</p>
<ul>
  <li><strong>Maestria:</strong> Você recebe 2 Pontos de Proficiência em um único tipo de Ferramenta Amaldiçoada.</li>
  <li><strong>Imbuir Feitiço:</strong> A cada 5 níveis que você permanecer usando uma mesma arma para canalizar seu feitiço, você a faz evoluir em um grau de classificação das Ferramentas Amaldiçoadas.</li>
  <li><strong>Arma Favorita:</strong> Toda vez que você subir de nível, você pode escolher uma Ferramenta Amaldiçoada e receber a proficiência "Mestre" com ela, mesmo que você não possua proficiência no tipo. Mas ela só funciona para uma Ferramenta Específica e não o tipo da arma.</li>
  <li><strong>Posições de Combate:</strong> Como um Mestre das Armas, você dominou um conjunto de posições que te ajudam no meio de combate, você recebe acesso as seguintes posições:
    <ul>
      <li><strong>Posição Defensiva:</strong> Você aumenta sua Classe de Resistência em 2 e pode seu valor de engajamento aumenta em +2 até você ser considerado Totalmente Engajado.</li>
      <li><strong>Posição Ofensiva:</strong> Seu deslocamento aumento em 5 metros e você recebe +1 de dano igual seu grau de Proficiência (Treinado + 1; Proficiente +2; Especializado +3; Mestre +4).</li>
      <li><strong>Sentinela:</strong> Toda vez que uma criatura tiver você ou um aliado como alvo de um ataque ou técnica que faça rolagem de acerto, você pode, como Reação, realizar consumir um Ponto de Ação [⬢] para realizar um ataque contra a criatura (máximo de 3 por rodada). Você pode se mover até 3 metros do seu deslocamento disponível antes de fazer esse ataque.</li>
    </ul>
    <p>Você pode consumir um Ponto de Ação [⬢] para mudar entre as posições, podendo usar essa característica como Reação.</p>
  </li>
</ul>
<h4>Punho Ardente</h4>
<p>Seus golpes desarmados são brutais e você consegue transformar praticamente qualquer parte do seu corpo em uma arma contra seus oponentes. Você recebe acesso as seguintes características:</p>
<ul>
  <li><strong>Golpe Brutal:</strong> Sempre que você causar dano máximo ou um acerto crítico em uma criatura, você pode realizar um ataque adicional com custo de ação [⬢] reduzido em 1.</li>
  <li><strong>Interceptar:</strong> Quando uma criatura realizar uma jogada de ataque (Comum ou de Técnica) contra você e errar, você pode gastar duas ações [⬢⬢] como Reação para interceptar o golpe e atira-la por cima do seu ombro, arremessando-a contra o chão e impondo a condição "Caído" se ela falhar em uma Salvaguarda de Agilidade. Se ela receber a condição dessa forma, ele recebe a condição "Estremecido" se tentar levantar antes do fim do turno.</li>
  <li><strong>Mãos Letais:</strong> Suas jogadas de ataque (Comum) corpo-a-corpo passam a receber os mesmos benefícios de uma arma marcial. Dessa forma, você pode escolher qualquer propriedade de uma arma marcial para seus ataques, podendo mudar essa escolha toda vez que sobe de nível.</li>
  <li><strong>Corpo Forjado:</strong> Você recebe resistência +5 a danos do tipo Contundente, Cortante e Perfurante.</li>
</ul>
`;

const SENTINELA = `
<h1>SENTINELA</h1>
<h3>Pontos de Vida</h3>
<p><strong>Vida Base:</strong> 6 por nível de personagem.<br><strong>Vida por Ponto de Constituição:</strong> 6 por ponto.</p>
<h3>Energia Amaldiçoada</h3>
<p><strong>Energia Base:</strong> 10 por nível de personagem.</p>
<h3>Proficiências</h3>
<ul>
  <li><strong>Equipamentos:</strong> Recebe 3 Pontos de Proficiência entre qualquer tipo de arma.</li>
  <li><strong>Salvaguarda:</strong> Recebe 3 Pontos de Proficiência para distribuir entre as Salvaguardas.</li>
  <li><strong>Perícias:</strong> Escolha 5 Pontos de Proficiência para distribuir entre as Perícias.</li>
</ul>
<h3>Informações Gerais</h3>
<ul>
  <li><strong>Atributo Principal:</strong> Agilidade.</li>
  <li><strong>Habilidades de Especialização:</strong> Você recebe 2 habilidade de "Novo Estilo das Sombras".</li>
  <li><strong>Equipamentos:</strong> Você recebe uma ferramenta amaldiçoada de 4º grau e; ¥ 5.000.</li>
</ul>
<h2>Características de Combate</h2>
<h3>Peculiaridades do Sentinela</h3>
<p>Os Sentinelas são peritos na utilização do Novo Estilo das Sombras, sendo aqueles que refinaram sua manipulação de Energia Amaldiçoada ao limite para compensar a ausência de um feitiço inato.</p>
<p>Devido a essa peculiaridade, um Sentinela deve dedicar todo o seu tempo ao domínio de suas habilidades. Como resultado, mesmo que possua um feitiço inato, ele é incapaz de utilizá-lo em combate.</p>
<h3>Domínio do Sentinela</h3>
<p>Pela falta de um feitiço amaldiçoado, você focou totalmente na capacidade de utilizar energia amaldiçoada e em técnicas anti-domínio. Você recebe acesso as seguintes características:</p>
<ul>
  <li><strong>Aprendizado Focado:</strong> Você recebe uma habilidade de Especialização adicional a cada nível par do personagem.</li>
  <li><strong>Forma Dominada:</strong> Você pode aprender a habilidade "Domínio Simples" das técnicas de Domínio e Anti-Domínio.</li>
</ul>
<p>Além disso, você recebe as seguintes características dentro do "Domínio Simples":</p>
<ul>
  <li>Até duas vezes por rodada, você pode realizar uma jogada de ataque (Comum) como Reação, tendo seu custo de ação reduzido em 1 Ponto de Ação [⬢]. O gatilho pode ser um Ponto de Ação da criatura dentro do seu alcance;</li>
  <li>Ao realizar uma jogada de ataque (Comum ou de Técnica), você ignora até 10 Pontos de Resistência do inimigo.</li>
</ul>
`;

const ESPECIALISTA = `
<h1>ESPECIALISTA</h1>
<h3>Pontos de Vida</h3>
<p><strong>Vida Base:</strong> 5 por nível de personagem.<br><strong>Vida por Ponto de Constituição:</strong> 5 por ponto.</p>
<h3>Energia Amaldiçoada</h3>
<p><strong>Energia Base:</strong> 15 por nível de personagem.</p>
<h3>Proficiências</h3>
<ul>
  <li><strong>Equipamentos:</strong> Recebe 1 Ponto de Proficiência entre qualquer tipo de arma.</li>
  <li><strong>Salvaguarda:</strong> Recebe 2 Pontos de Proficiência para distribuir entre as Salvaguardas.</li>
  <li><strong>Perícias:</strong> Escolha 3 Pontos de Proficiência para distribuir entre as Perícias.</li>
</ul>
<h3>Informações Gerais</h3>
<ul>
  <li><strong>Atributo Principal:</strong> Intelecto.</li>
  <li><strong>Habilidades de Especialização:</strong> Você recebe 2 habilidade de "Feitiço Inato".</li>
  <li><strong>Equipamentos:</strong> Uma arma cortante, especial ou ¥ 3.000 e; ¥ 8.000.</li>
</ul>
<h3>Criando um Especialista</h3>
<p>Para criar rapidamente um Especialista primeiro distribua seus atributos, colocando o mais alto em Intelecto. O segundo atributo mais alto deve ser Constituição. Escolha uma origem de poder de Anomalia – Corpo Amaldiçoado, Feto Amaldiçoado, Receptáculo ou; Feitiço Inato ou Linhagem Herdada.</p>
<p>Após isso, foque em pegar talentos para aumentar suas perícias que serão importantes no início do jogo, principalmente em talentos que dão proficiência nas perícias: Acrobacia, Feitiço, Intuição, Percepção e Sobrenatural.</p>
<h2>Características de Combate</h2>
<h3>Manipulação de Feitiço</h3>
<p>Você adquire a habilidade de manipular seus próprios feitiços para adaptá-las às suas necessidades, usando a energia excedente delas para beneficiar suas habilidades. Toda vez que você executar um feitiço ou técnica de manipulação, seja por si mesmo ou por um Shikigami, você recebe 2 Dados de Técnica, definidos por um d6.</p>
<p>A qualquer momento durante seu turno, você pode utilizar os dados de técnica para ativar um dos seguintes efeitos:</p>
<ul>
  <li><strong>Aprimoramento:</strong> Você pode gastar quantos dados de técnica quiser para aumentar o dano da técnica pelo resultado da rolagem dos dados, mas deve usa-los antes de saber se ela acertou ou errou.</li>
  <li><strong>Regenerar Maldição:</strong> Você pode gastar quantos dados de técnica desejar e curar um Shikigami pelo mesmo valor do resultado dos dados.</li>
  <li><strong>Ativação Secundária:</strong> Você pode gastar quantos dados de técnica desejar para reduzir o custo da sua técnica pelo mesmo valor de dados consumidos.</li>
</ul>
<p>Você pode ter um máximo de dados de técnica igual a 1 + seu bônus de proficiência. Além disso, você também recebe 1 habilidade de Especialização de Feitiço Inato imediatamente ao adquirir esse Estilo de Combate.</p>
`;

const ESTRATEGISTA = `
<h1>ESTRATEGISTA</h1>
<h3>Pontos de Vida</h3>
<p><strong>Vida Base:</strong> 4 por nível de personagem.<br><strong>Vida por Ponto de Constituição:</strong> 4 por ponto.</p>
<h3>Energia Amaldiçoada</h3>
<p><strong>Energia Base:</strong> 15 por nível de personagem.</p>
<h3>Proficiências</h3>
<ul>
  <li><strong>Equipamentos:</strong> Recebe 2 Pontos de Proficiência entre qualquer tipo de arma.</li>
  <li><strong>Salvaguarda:</strong> Recebe 2 Pontos de Proficiência para distribuir entre as Salvaguardas.</li>
  <li><strong>Perícias:</strong> Escolha 5 Pontos de Proficiência para distribuir entre as Perícias.</li>
</ul>
<h3>Informações Gerais</h3>
<ul>
  <li><strong>Atributo Principal:</strong> Sabedoria.</li>
  <li><strong>Habilidades de Especialização:</strong> Você recebe 1 habilidade de "Feitiço Inato".</li>
  <li><strong>Equipamentos:</strong> Uma arma cortante, especial ou ¥ 3.000 e; ¥ 8.000.</li>
</ul>
<h2>Características de Combate</h2>
<h3>Amaldiçoado com Conhecimento</h3>
<p>Você tem uma facilidade maior para aprender qualquer coisa relacionada a energia amaldiçoada e seu controle sobre ela avança a passos largos. Você recebe as seguintes características:</p>
<ul>
  <li>Sempre que você rolar 1 no resultado do d20, você pode rolar novamente e usar o novo resultado;</li>
  <li>Você pode criar barreiras usando da sua reserva Total de Energia sem consumir do seu limite de Refinamento;</li>
</ul>
<p>Além disso, você também deve escolher uma entre as duas especializações:</p>
<h4>Mestre de Barreiras</h4>
<p>Você se especializou no uso de barreiras para lutar e ajudar seus companheiros, você recebe 3 habilidades de Especialização de Barreira e suas barreiras recebem 2 Pontos de Vida adicionais por PA gasto para cria-las.</p>
<h4>Médico de Campo</h4>
<p>Você desbloqueia instantaneamente a Energia Reversa e recebe 1 Habilidade de Especialização dela, mas todas as suas técnicas de dano de Feitiços passam a custar 1 Ponto de Ação [⬢] adicional.<br>Além disso, você dobra o limite de Pontos de Energia Reversa que pode ter de 30 para 60.</p>
`;

/* ── Documentos ──────────────────────────────────────────────────────────── */

const ESTILOS = [
  {
    _id: "jj2e000000000001",
    name: "Restringido",
    img: "systems/jujutsu-system/icons/svg/items/class.svg",
    html: RESTRINGIDO,
    legacy2: { vidaBase: 7, energiaBase: null, atributoPrincipal: ["str", "dex"], principalEscolhivel: true, espIniciais: 1, proficiencias: { armas: 4, salvaguardas: 3, pericias: 4 } }
  },
  {
    _id: "jj2e000000000002",
    name: "Lutador",
    img: "systems/jujutsu-system/icons/svg/items/weapon.svg",
    html: LUTADOR,
    legacy2: { vidaBase: 7, energiaBase: 10, atributoPrincipal: "str", espIniciais: 2, proficiencias: { armas: 2, salvaguardas: 2, pericias: 3 } }
  },
  {
    _id: "jj2e000000000003",
    name: "Sentinela",
    img: "systems/jujutsu-system/icons/svg/rosa-shield.svg",
    html: SENTINELA,
    legacy2: { vidaBase: 6, energiaBase: 10, atributoPrincipal: "dex", espIniciais: 2, proficiencias: { armas: 3, salvaguardas: 3, pericias: 5 } }
  },
  {
    _id: "jj2e000000000004",
    name: "Especialista",
    img: "systems/jujutsu-system/icons/svg/items/spell.svg",
    html: ESPECIALISTA,
    legacy2: { vidaBase: 5, energiaBase: 15, atributoPrincipal: "int", espIniciais: 2, proficiencias: { armas: 1, salvaguardas: 2, pericias: 3 } }
  },
  {
    _id: "jj2e000000000005",
    name: "Estrategista",
    img: "systems/jujutsu-system/icons/svg/items/class.svg",
    html: ESTRATEGISTA,
    legacy2: { vidaBase: 4, energiaBase: 15, atributoPrincipal: "wis", espIniciais: 1, proficiencias: { armas: 2, salvaguardas: 2, pericias: 5 } }
  }
];

/* ── Geração ─────────────────────────────────────────────────────────────── */

fs.mkdirSync(SRC, { recursive: true });

for ( const estilo of ESTILOS ) {
  const doc = {
    _id: estilo._id,
    _key: `!items!${estilo._id}`,
    name: estilo.name,
    type: "class",
    img: estilo.img,
    system: {
      identifier: slugify(estilo.name),
      levels: 1,
      description: {
        value: estilo.html + GERAL_HTML,
        chat: ""
      }
    },
    flags: {
      "jujutsu-system": { legacy2: estilo.legacy2 }
    },
    ownership: { default: 0 },
    effects: [],
    folder: null,
    sort: 0
  };
  const alvo = path.join(SRC, `${estilo._id}.yml`);
  fs.writeFileSync(alvo, YAML.dump(doc, { lineWidth: -1 }), { encoding: "utf8" });
  console.log(`OK: ${alvo}`);
}
console.log(`\nPronto. Compile com: node ./utils/packs.mjs package pack ${PACK}`);
