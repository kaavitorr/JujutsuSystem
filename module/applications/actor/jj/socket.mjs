/**
 * jj/socket.mjs
 * Handler do socket para geração de energia (personagem e NPC).
 */

import EnergyGenerationDialog from "../energy-generation-dialog.mjs";
import { EnergySystem } from "../../../systems/energy.mjs";

Hooks.on("ready", () => {
  game.socket.on("system.jujutsu-system", async (data) => {

    // Personagem: jogador recebe pedido do GM para abrir dialog
    if ( data.action === "energyGenerationDialog" && data.userId === game.user.id ) {
      const actor = game.actors.get(data.actorId);
      if ( !actor ) return;
      setTimeout(async () => {
        const choices = await EnergyGenerationDialog.configure(actor);
        if ( choices ) {
          game.socket.emit("system.jujutsu-system", {
            action: "energyChoicesResult",
            actorId: data.actorId,
            choices
          });
        }
      }, 100);
    }

    // Personagem: GM recebe escolhas e processa
    if ( data.action === "energyChoicesResult" && game.user.isGM ) {
      const actor = game.actors.get(data.actorId);
      if ( !actor ) return;
      await EnergySystem.processTurnStartWithChoices(actor, data.choices);
    }
  });
});
