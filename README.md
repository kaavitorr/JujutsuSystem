# Jujutsu Legacy

**Jujutsu Legacy RPG** é um sistema de RPG inspirado em *Jujutsu Kaisen* para o [Foundry Virtual Tabletop](https://foundryvtt.com), construído sobre a arquitetura do sistema dnd5e (MIT).

## Instalação

No Foundry VTT, vá em **Configuração → Sistemas → Instalar Sistema** e cole a URL do manifest:

```
https://raw.githubusercontent.com/kaavitorr/JujutsuSystem/main/system.json
```

Ou baixe o zip da [aba de releases](https://github.com/kaavitorr/JujutsuSystem/releases) e extraia na pasta `Data/systems/` do seu Foundry.

## Funcionalidades

- Fichas de personagem com energia amaldiçoada, técnicas e feitiços
- Árvore de habilidades
- Criação de personagem guiada
- Compendiums com regras, condições e conteúdo do mundo

## Compatibilidade

- Foundry VTT v14 ou superior (verificado em v14)
- Versão atual do sistema: 1.2.1

## Desenvolvimento

```bash
npm install
```

O código-fonte fica em `module/`, os templates em `templates/`, os estilos em `less/` e as fontes dos compendiums em `packs/_source/`.

### Vida e Energia de personagens na regra 2.0

| Recurso | Base | Bônus fixo | Máximo final |
|---|---|---|---|
| Vida | `system.attributes.hp.base` | `system.attributes.hp.bonus` | `system.attributes.hp.max` |
| Energia | `system.energy.base` | `system.energy.bonus` | `system.energy.max` |

Vida máxima = `(nível + Constituição) × Vida Base + bônus fixo`.
Energia máxima = `nível × Energia Base + bônus fixo`.
Os bônus fixos individuais das Origens entram depois dos multiplicadores. Treinamentos de energia acrescentam uma unidade da base por treinamento ao bônus fixo.

Com a base salva em `null`, o sistema usa a base do Estilo e os aumentos correspondentes. Efeitos de base ou bônus fixo são aplicados antes do cálculo dos máximos; efeitos sobre os máximos continuam na fase final. As chaves antigas `system.legacy2.pvEspecie` e `system.legacy2.energiaEspecie` continuam representando aumentos da base.

Exemplo: Especialista com Vida Base 5, Destino Entrelaçado (+2 na base), Constituição 1 e Origem com +4 PV fixos tem `(1 + 1) × 7 + 4 = 18 PV` no nível 1 e `25 PV` no nível 2.

## Licença

O código é baseado no sistema dnd5e para Foundry VTT, licenciado sob [MIT](https://opensource.org/licenses/MIT). O conteúdo de regras segue a [SRD 5.1 (CC BY 4.0)](https://www.dndbeyond.com/attachments/39j2li89/SRD5.1-CCBY4.0License.pdf).

## Autor

**Noroi** — [Discord](https://discord.gg/hld20)
