import ReductionSheet from "../../applications/activity/reduction-sheet.mjs";
import ReductionActivityData from "../../data/activity/reduction-data.mjs";
import ActivityMixin from "./mixin.mjs";

/**
 * Atividade de Redução de Dano.
 *
 * Ao ser usada, o resultado de uma rolagem (fórmula digitada no diálogo) vira um
 * escudo de redução de dano, semelhante à Explosão Defensiva. Um checkbox define
 * se a redução vale para um único ataque ou dura até o início do próximo turno
 * (reduzindo cada ataque). A lógica de uso é tratada via o hook
 * `dnd5e.preUseActivity` em applications/actor/jj/reducao-dano.mjs.
 */
export default class ReductionActivity extends ActivityMixin(ReductionActivityData) {

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
