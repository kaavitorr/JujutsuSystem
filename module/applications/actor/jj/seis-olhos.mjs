/**
 * jj/seis-olhos.mjs
 * Seis Olhos — Active Effects e hook de turno.
 */


export async function applySeiOlhosEffects(actor, mode) {
  const prof = actor.system.attributes.prof ?? 2;

  const EFFECT_IDS = {
    sealed:  "jj-seis-olhos-sealed",
    full:    "jj-seis-olhos-full",
    psychic: "jj-seis-olhos-psychic"
  };

  for ( const id of Object.values(EFFECT_IDS) ) {
    const existing = actor.effects.find(e => e.getFlag("jujutsu-system", "seisOlhosId") === id);
    if ( existing ) await existing.delete();
  }

  const sealedSkillBonus = String(prof);
  const fullSkillBonus   = String(prof * 2);

  const sealedChanges = [
    { key: "system.attributes.ac.bonus",       mode: 2, value: "1",              priority: 20 },
    { key: "system.bonuses.mwak.attack",       mode: 2, value: "2",              priority: 20 },
    { key: "system.bonuses.rwak.attack",       mode: 2, value: "2",              priority: 20 },
    { key: "system.bonuses.msak.attack",       mode: 2, value: "2",              priority: 20 },
    { key: "system.bonuses.rsak.attack",       mode: 2, value: "2",              priority: 20 },
    { key: "system.skills.prc.bonuses.check",  mode: 2, value: sealedSkillBonus, priority: 20 },
    { key: "system.skills.arc.bonuses.check",  mode: 2, value: sealedSkillBonus, priority: 20 },
    { key: "system.skills.Cont.bonuses.check", mode: 2, value: sealedSkillBonus, priority: 20 }
  ];

  const fullChanges = [
    { key: "system.attributes.ac.bonus",       mode: 2, value: "3",              priority: 20 },
    { key: "system.bonuses.mwak.attack",       mode: 2, value: "4",              priority: 20 },
    { key: "system.bonuses.rwak.attack",       mode: 2, value: "4",              priority: 20 },
    { key: "system.bonuses.msak.attack",       mode: 2, value: "4",              priority: 20 },
    { key: "system.bonuses.rsak.attack",       mode: 2, value: "4",              priority: 20 },
    { key: "system.skills.prc.bonuses.check",  mode: 2, value: fullSkillBonus,   priority: 20 },
    { key: "system.skills.arc.bonuses.check",  mode: 2, value: fullSkillBonus,   priority: 20 },
    { key: "system.skills.Cont.bonuses.check", mode: 2, value: fullSkillBonus,   priority: 20 }
  ];

  if ( mode === "sealed" ) {
    await actor.createEmbeddedDocuments("ActiveEffect", [{
      name: "Seis Olhos (Selado)",
      icon: "icons/magic/perception/eye-ringed-glow-angry-small-teal.webp",
      origin: actor.uuid,
      disabled: false,
      changes: sealedChanges,
      flags: { "jujutsu-system": { seisOlhosId: EFFECT_IDS.sealed } }
    }]);
  } else if ( mode === "full" ) {
    await actor.createEmbeddedDocuments("ActiveEffect", [{
      name: "Seis Olhos (Poder Completo)",
      icon: "icons/magic/perception/eye-ringed-glow-angry-small-teal.webp",
      origin: actor.uuid,
      disabled: false,
      changes: fullChanges,
      flags: { "jujutsu-system": { seisOlhosId: EFFECT_IDS.full } }
    }]);

    await actor.createEmbeddedDocuments("ActiveEffect", [{
      name: "Seis Olhos — Dano Psíquico",
      icon: "icons/magic/death/skull-glowing-teal.webp",
      origin: actor.uuid,
      disabled: false,
      changes: [],
      duration: { rounds: 9999 },
      flags: { "jujutsu-system": { seisOlhosId: EFFECT_IDS.psychic, psychicDamage: true } }
    }]);

    registerSeiOlhosTurnHook(actor);
  }
}

function registerSeiOlhosTurnHook(actor) {
  if ( actor._seisOlhosHookId ) Hooks.off("combatTurnChange", actor._seisOlhosHookId);

  actor._seisOlhosHookId = Hooks.on("combatTurnChange", async (combat, prior, current) => {
    const combatant = combat.combatants.get(current.combatantId);
    if ( combatant?.actor?.id !== actor.id ) return;

    const hasEffect = actor.effects.some(e =>
      e.getFlag("jujutsu-system", "seisOlhosId") === "jj-seis-olhos-psychic"
    );
    if ( !hasEffect ) {
      Hooks.off("combatTurnChange", actor._seisOlhosHookId);
      actor._seisOlhosHookId = null;
      return;
    }

    const roll = await new Roll("2d8").evaluate();
    const dmg = roll.total;
    const newHp = Math.max(0, (actor.system.attributes.hp.value ?? 0) - dmg);
    await actor.update({ "system.attributes.hp.value": newHp });

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div style="font-family:var(--dnd5e-font-roboto,sans-serif);padding:6px 10px;background:#0a0a18;border:1px solid #2a1a4a;border-radius:4px;">
        <strong style="color:#9060d0">⬡ Seis Olhos — Poder Completo</strong><br>
        <span style="color:#c0a0ff">${actor.name} sofre <strong>${dmg}</strong> de dano psíquico no início do turno.</span>
      </div>`
    });
  });
}
