# Ficha 2.0 — referência Hunter

Direção solicitada: aproximar a ficha do Hunter autenticada do usuário, preservando sidebar, campos, abas e regras atuais da 2.0. Copiar a chama roxa original de Transmutador para energia gerada/Refinamento.

Tokens: base #111117, painéis #1a1b23, bordas #353540, texto #e9e6de, energia #9c78d5, destaque #e4c15a. Nome em serif display (Modesto Condensed/Palatino); interface Roboto Condensed local. Títulos pequenos, painéis alinhados e traços diagonais discretos conforme a referência. Atributos mantêm SVGs e acentos próprios.

Composição: cabeçalho com nome grande e nível; coluna esquerda com retrato, recursos persistentes e CR/Iniciativa/Movimento; conteúdo à direita com abas, seis atributos compactos, salvaguardas em duas colunas e Estilo/Fulgor. Perícias mantêm os três grupos e as cinco armas. Sem dados de Vida/Energia da 1.0.

- [x] Copiar asset original e conferir bytes.
- [x] Conectar chama ao controle real de Refinamento; ajustar cabeçalho e resumo.
- [x] Substituir CSS carregado por uma folha exclusiva da 2.0 inspirada no Hunter.
- [x] Conferir Resumo, Perícias e Características com templates reais, incluindo injeção real de Condições.
- [x] Verificar testes, sintaxe, permissões e manifesto; entregar prévia do resultado.

Correção anterior preservada: injetores de Condições/Características selecionam `.tab[data-tab]`, evitando injetar conteúdo nos botões de navegação. A reprodução real em DOM confirmou 0 condições na navegação e 1 seção no conteúdo de Efeitos.

Verificação: Resumo 900px e Perícias 800px conferidos visualmente com fonte, asset e estilos reais. Sidebar completa coube em 786px sem overflow interno. Janela 640px exibiu grupos em uma coluna sem overflow horizontal; 100 bolinhas e 5 recursos sem edição para quem não possui o ator. Características conferida com itens individuais nativos. Revisão independente sem bloqueios novos. Testes existentes verificam os dados; não houve mudança nova nas fórmulas. Ainda falta validar o ciclo completo em mundo Foundry autenticado após reiniciar a aplicação, pois o manifesto e os módulos são carregados ao abrir o sistema.
