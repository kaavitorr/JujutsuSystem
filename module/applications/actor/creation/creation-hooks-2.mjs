import Ruleset from "../../../systems/ruleset.mjs";
import { shouldOpenCreation } from "./creation-model-2.mjs";
import { openCharacterCreation } from "./character-creation-2.mjs";

/** Route local new characters to the creator while preserving imports and legacy sheets. */
export function registerCreationHooks(hooks = Hooks, open = openCharacterCreation) {
  const enabled = () => Ruleset.isV2() && game.settings.get("jujutsu-system", "characterCreation2Enabled");
  hooks.on("preCreateActor", (actor, data, options, userId) => {
    if (!data._stats?.compendiumSource && !data._stats?.duplicateSource && shouldOpenCreation(actor, options, userId, game.user.id, enabled()))
      options.renderSheet = false;
  });
  hooks.on("createActor", (actor, options, userId) => {
    if (shouldOpenCreation(actor, options, userId, game.user.id, enabled())) open(actor);
  });
}
