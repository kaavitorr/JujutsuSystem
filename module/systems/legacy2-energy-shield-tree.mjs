import Ruleset from "./ruleset.mjs";

const PACK = "jujutsu-compendium.geral-2-0";
const VERSION = 1;
const MARKER = "energyShieldTreeVersion";
const NAME = "Escudo de Energia";
const IDENTIFIER = "escudo-de-energia";
const SPECIALIZATION = {
  categoria: "Proezas Físicas",
  caminho: "Canalização de Energia",
  requisitos: ["Canalização Amplificadora", "Canalização de Combate"]
};
const DESCRIPTION = "<p><strong>Requisito:</strong> Canalização Amplificadora e Canalização de Combate.</p>"
  + "<p>Você aprendeu a liberar uma grande quantidade de Energia Amaldiçoada para se proteger de danos externos. "
  + "Ao ativar essa característica e no início de cada um de seus turnos, você consome 1 Ponto de Ação [⬢] e 2 PA "
  + "para aumentar sua Classe de Resistência em +2 de CR e +1 para cada Ponto de Ação e 1 PA adicional que você escolher consumir.</p>";

let pending;
const isShield = doc => doc.type === "feat" && (doc.system?.identifier === IDENTIFIER
  || doc.name?.trim().toLocaleLowerCase("pt-BR") === NAME.toLocaleLowerCase("pt-BR"));

/** Register only this requested feat through Foundry, preserving the author's live compendium. */
export function updateEnergyShieldTree() {
  if (!Ruleset.isV2() || !game.user?.isGM) return Promise.resolve(null);
  if (game.users?.activeGM && game.users.activeGM.id !== game.user.id) return Promise.resolve(null);
  return pending ??= updateItem().finally(() => { pending = undefined; });
}

async function updateItem() {
  const pack = game.packs.get(PACK);
  if (!pack) return null;
  const docs = await pack.getDocuments();
  const shield = docs.find(isShield);
  if (shield?.flags?.["jujutsu-system"]?.[MARKER] >= VERSION) return shield;
  const locked = pack.locked;
  if (locked) await pack.configure({locked: false});
  try {
    if (shield) return await shield.update({
      "system.identifier": IDENTIFIER,
      "system.description.value": DESCRIPTION,
      "flags.jujutsu-system.especializacao": structuredClone(SPECIALIZATION),
      [`flags.jujutsu-system.${MARKER}`]: VERSION
    });
    const folder = docs.find(doc => doc.flags?.["jujutsu-system"]?.especializacao?.caminho === SPECIALIZATION.caminho)?.folder;
    const worldItem = game.items?.find(isShield);
    const data = worldItem?.toObject() ?? {};
    Object.assign(data, {_id: "jj2escudoenergia1", name: NAME, type: "feat",
      img: worldItem?.img ?? "icons/magic/defensive/shield-barrier-flaming-pentagon-red.webp",
      folder: folder?.id ?? folder ?? null});
    (data.system ??= {}).identifier = IDENTIFIER;
    (data.system.description ??= {}).value = DESCRIPTION;
    Object.assign((data.flags ??= {})["jujutsu-system"] ??= {}, {
      especializacao: structuredClone(SPECIALIZATION), [MARKER]: VERSION
    });
    return await pack.documentClass.create(data, {pack: pack.collection, keepId: true, renderSheet: false});
  } finally {
    if (locked) await pack.configure({locked: true});
  }
}

export function registerEnergyShieldTreeUpdate(hooks = Hooks) {
  hooks.once("dnd5e.ready", () => updateEnergyShieldTree().catch(error => {
    console.error("Jujutsu: não foi possível cadastrar Escudo de Energia na árvore.", error);
    ui.notifications.warn("Não foi possível atualizar Escudo de Energia no compêndio. Abra a árvore novamente para tentar.");
  }));
}
