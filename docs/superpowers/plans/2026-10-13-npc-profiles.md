# Taxonomias e Arquétipos de NPCs 2.0

Implementar diretamente o pedido aprovado pelo usuário, preservando a ficha atual e as regras 1.0.

1. Registrar os tipos de Item `taxonomy` e `archetype`, com nome, imagem, descrição e seis pesos inteiros cuja soma deve ser 12. Ficha própria no visual mangá já usado pelo sistema; salvar a escala inteira de uma vez.
2. A taxonomia distribui 20 pontos iniciais, respeitando o mínimo 1 e máximo 12 por atributo. O arquétipo distribui apenas ND − 1 pontos adicionais. Distribuição inteira proporcional determinística; incrementos nunca retiram pontos de outro atributo. Peso zero não recebe crescimento. Pontos que não cabem nos atributos elegíveis ficam indicados como não aplicados.
3. Selecionar itens do mundo/compêndios ou arrastá-los à ficha do NPC, criando uma cópia embutida editável. Reutilizar a cópia ao trocar o perfil. Manter os identificadores antigos como compatibilidade para NPCs existentes, atualizados ao novo orçamento.
4. Resolver os perfis antes dos cálculos derivados de ataques e defesas; apresentar taxonomia, arquétipo, orçamento e divisão por atributo no Resumo. Não escrever valores derivados na fonte do ator.
5. Verificar distribuição e integração com testes, registro completo dos tipos, templates, carregamento do sistema e uma prévia visual. Revisão independente ao concluir.
