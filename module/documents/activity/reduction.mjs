import ReductionSheet from "../../applications/activity/reduction-sheet.mjs";
import ReductionActivityData from "../../data/activity/reduction-data.mjs";
import ActivityMixin from "./mixin.mjs";
import { activateDamageReduction } from "../../applications/actor/jj/reducao-dano.mjs";

/**
 * Atividade de Redução de Dano.
 *
 * Ao ser usada, o resultado de uma rolagem (fórmula digitada no diálogo) vira um
 * escudo de redução de dano, semelhante à Explosão Defensiva. Um checkbox define
 * se a redução vale para um único ataque ou dura até o início do próximo turno
 * (reduzindo cada ataque). A lógica de uso é tratada pelo fluxo aguardado
 * em applications/actor/jj/reducao-dano.mjs.
 */
export default class ReductionActivity extends ActivityMixin(ReductionActivityData) {
  async _useCustom(usage) {
    return activateDamageReduction(this, usage);
  }

  /** @inheritDoc */
  static metadata = Object.freeze(
    foundry.utils.mergeObject(super.metadata, {
      type: "reduction",
      img: "icons/svg/shield.svg",
      title: "Redução de Dano",
      hint: "Rola uma fórmula que vira um escudo de redução de dano (ataque único ou até o início do próximo turno).",
      sheetClass: ReductionSheet
    }, { inplace: false })
  );
}
