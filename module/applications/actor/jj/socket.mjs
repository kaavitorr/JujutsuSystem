/**
 * jj/socket.mjs
 * Handler do socket para geração de energia (personagem e NPC).
 */

import EnergyGenerationDialog from "../energy-generation-dialog.mjs";
import { EnergySystem } from "../../../systems/energy.mjs";
import Ruleset from "../../../systems/ruleset.mjs";

Hooks.on("ready", () => {
  game.socket.on("system.jujutsu-system", async (data) => {

    // The selected owner handles its own confirmation once, including unlinked NPC tokens.
    if ( data.action === "energyGenerationDialog" && data.userId === game.user.id ) {
      const actor = data.actorUuid ? await fromUuid(data.actorUuid) : game.actors.get(data.actorId);
      if ( !actor || actor.testUserPermission?.(game.user, "OWNER") === false ) return;
      const context = data.context ?? {};
      const choices = await EnergyGenerationDialog.configure(actor, context);
      if (!choices) return;
      if (Ruleset.isV2()) await EnergySystem.processTurnStartWithChoices(actor, choices, context);
      else game.socket.emit("system.jujutsu-system", { action: "energyChoicesResult", actorId: data.actorId, choices });
    }

    // Personagem: GM recebe escolhas e processa
    if ( data.action === "energyChoicesResult" && !Ruleset.isV2() && game.user.isGM
      && (!game.users.activeGM || game.users.activeGM.id === game.user.id) ) {
      const actor = game.actors.get(data.actorId);
      if ( !actor ) return;
      await EnergySystem.processTurnStartWithChoices(actor, data.choices);
    }
  });
});
