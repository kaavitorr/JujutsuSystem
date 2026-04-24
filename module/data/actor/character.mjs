import HitDice from "../../documents/actor/hit-dice.mjs";
import Proficiency from "../../documents/actor/proficiency.mjs";
import { defaultUnits, simplifyBonus } from "../../utils.mjs";
import FormulaField from "../fields/formula-field.mjs";
import LocalDocumentField from "../fields/local-document-field.mjs";
import CreatureTypeField from "../shared/creature-type-field.mjs";
import RollConfigField from "../shared/roll-config-field.mjs";
import SensesField from "../shared/senses-field.mjs";
import SimpleTraitField from "./fields/simple-trait-field.mjs";
import AttributesFields from "./templates/attributes.mjs";
import CreatureTemplate from "./templates/creature.mjs";
import DetailsFields from "./templates/details.mjs";
import TraitsFields from "./templates/traits.mjs";

const {
  ArrayField, BooleanField, HTMLField, IntegerSortField, NumberField, SchemaField, SetField, StringField
} = foundry.data.fields;
import MappingField from "../fields/mapping-field.mjs";

/**
 * @import { ActorFavorites5e, CharacterActorSystemData, ResourceData } from "./_types.mjs";
 */

/**
 * System data definition for Characters.
 * @extends {CreatureTemplate<CharacterActorSystemData>}
 * @mixes CharacterActorSystemData
 */
export default class CharacterData extends CreatureTemplate {

  /* -------------------------------------------- */
  /*  Model Configuration                         */
  /* -------------------------------------------- */

  /** @override */
  static LOCALIZATION_PREFIXES = ["DND5E.BONUSES"];

  /* -------------------------------------------- */

  /** @inheritDoc */
  static metadata = Object.freeze(foundry.utils.mergeObject(super.metadata, {
    supportsAdvancement: true
  }, { inplace: false }));

  /* -------------------------------------------- */

  /** @inheritDoc */
  static _systemType = "character";

  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      attributes: new SchemaField({
        ...AttributesFields.common,
        ...AttributesFields.creature,
        hp: new SchemaField({
          ...AttributesFields.hitPoints,
          max: new NumberField({
            nullable: true, integer: true, min: 0, initial: null, label: "DND5E.HitPointsOverride",
            hint: "DND5E.HitPointsOverrideHint"
          }),
          bonuses: new SchemaField({
            level: new FormulaField({ deterministic: true, label: "DND5E.HitPointsBonusLevel" }),
            overall: new FormulaField({ deterministic: true, label: "DND5E.HitPointsBonusOverall" })
          })
        }, { label: "DND5E.HitPoints" }),
        death: new RollConfigField({
          ability: false,
          success: new NumberField({
            required: true, nullable: false, integer: true, min: 0, initial: 0, label: "DND5E.DeathSaveSuccesses"
          }),
          failure: new NumberField({
            required: true, nullable: false, integer: true, min: 0, initial: 0, label: "DND5E.DeathSaveFailures"
          }),
          bonuses: new SchemaField({
            save: new FormulaField({ required: true, label: "DND5E.DeathSaveBonus" })
          })
        }, { label: "DND5E.DeathSave" }),
        inspiration: new BooleanField({ required: true, label: "DND5E.Inspiration" })
      }, { label: "DND5E.Attributes" }),
      bastion: new SchemaField({
        name: new StringField({ required: true }),
        description: new HTMLField()
      }),
      details: new SchemaField({
        ...DetailsFields.common,
        ...DetailsFields.creature,
        background: new LocalDocumentField(foundry.documents.BaseItem, {
          required: true, fallback: true, label: "DND5E.Background"
        }),
        originalClass: new StringField({ required: true, label: "DND5E.ClassOriginal" }),
        xp: new SchemaField({
          value: new NumberField({
            required: true, nullable: false, integer: true, min: 0, initial: 0, label: "DND5E.ExperiencePoints.Current"
          })
        }, { label: "DND5E.ExperiencePoints.Label" }),
        appearance: new StringField({ required: true, label: "DND5E.Appearance" }),
        trait: new StringField({ required: true, label: "DND5E.PersonalityTraits" }),
        gender: new StringField({ label: "DND5E.Gender" }),
        eyes: new StringField({ label: "DND5E.Eyes" }),
        height: new StringField({ label: "DND5E.Height" }),
        faith: new StringField({ label: "DND5E.Faith" }),
        hair: new StringField({ label: "DND5E.Hair" }),
        skin: new StringField({ label: "DND5E.Skin" }),
        age: new StringField({ label: "DND5E.Age" }),
        weight: new StringField({ label: "DND5E.Weight" })
      }, { label: "DND5E.Details" }),
      traits: new SchemaField({
        ...TraitsFields.common,
        ...TraitsFields.creature,
        weaponProf: new SimpleTraitField({
          mastery: new SchemaField({
            value: new SetField(new StringField()),
            bonus: new SetField(new StringField())
          })
        }, { label: "DND5E.TraitWeaponProf" }),
        armorProf: new SimpleTraitField({}, { label: "DND5E.TraitArmorProf" })
      }, { label: "DND5E.Traits" }),
      resources: new SchemaField({
        primary: makeResourceField({ label: "DND5E.ResourcePrimary" }),
        secondary: makeResourceField({ label: "DND5E.ResourceSecondary" }),
        tertiary: makeResourceField({ label: "DND5E.ResourceTertiary" })
      }, { label: "DND5E.Resources" }),
      energy: new SchemaField({
        max: new NumberField({
          required: true, nullable: false, integer: true, min: 0, initial: 0,
          label: "JUJUTSU.Energy.Max"
        }),
        total: new NumberField({
          required: true, nullable: false, integer: true, min: 0, initial: 0,
          label: "JUJUTSU.Energy.Total"
        }),
        generated: new NumberField({
          required: true, nullable: false, integer: true, min: 0, initial: 0,
          label: "JUJUTSU.Energy.Generated"
        }),
        bonuses: new SchemaField({
          overall: new FormulaField({ deterministic: true, label: "JUJUTSU.Energy.BonusOverall" }),
          level: new FormulaField({ deterministic: true, label: "JUJUTSU.Energy.BonusLevel" }),
          temp: new NumberField({
            required: true, nullable: false, integer: true, initial: 0,
            label: "JUJUTSU.Energy.BonusTemp"
          }),
          generatedEnergy: new NumberField({
            required: true, nullable: false, integer: true, initial: 0,
            label: "JUJUTSU.Energy.BonusGenerated"
          })
        }, { label: "JUJUTSU.Energy.Bonuses" }),
        intensiveTraining: new SchemaField({
          maxEnergy: new NumberField({
            required: true, nullable: false, integer: true, min: 0, initial: 0,
            label: "JUJUTSU.IntensiveTraining.MaxEnergy"
          }),
          generatedEnergy: new NumberField({
            required: true, nullable: false, integer: true, min: 0, initial: 0,
            label: "JUJUTSU.IntensiveTraining.GeneratedEnergy"
          }),
          cursePoints: new NumberField({
            required: true, nullable: false, integer: true, min: 0, initial: 0,
            label: "JUJUTSU.IntensiveTraining.CursePoints"
          })
        }, { label: "JUJUTSU.IntensiveTraining.Label" }),
        generation: new SchemaField({
          baseMultiplier: new NumberField({
            required: true, nullable: false, integer: true, min: 1, initial: 2,
            label: "JUJUTSU.Energy.BaseMultiplier"
          }),
          turnMultiplier: new NumberField({
            required: true, nullable: false, integer: true, min: 1, initial: 1,
            label: "JUJUTSU.Energy.TurnMultiplier"
          }),
          bonusFlat: new NumberField({
            required: true, nullable: false, integer: true, initial: 0,
            label: "JUJUTSU.Energy.BonusFlat"
          })
        }, { label: "JUJUTSU.Energy.Generation" })
      }, { label: "JUJUTSU.Energy.Label" }),
      curseResources: new SchemaField({
        cursePoints: new NumberField({
          required: true, nullable: false, integer: true, min: 0, initial: 0,
          label: "JUJUTSU.CursePoints"
        }),
        trainingPoints: new NumberField({
          required: true, nullable: false, integer: true, min: 0, initial: 0,
          label: "JUJUTSU.TrainingPoints"
        }),
        lostTrainingPoints: new NumberField({
          required: true, nullable: false, integer: true, min: 0, initial: 0,
          label: "JUJUTSU.LostTrainingPoints"
        })
      }, { label: "JUJUTSU.CurseResources" }),
      energyAbilities: new SchemaField({
        accumulation: new SchemaField({
          uses: new NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 3 }),
          max: new NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 3 }),
          enabled: new BooleanField({ initial: false })
        }),
        liberation: new SchemaField({
          uses: new NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 1 }),
          max: new NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 1 }),
          enabled: new BooleanField({ initial: false })
        })
      }, { label: "JUJUTSU.EnergyAbilities" }),

      // Habilidades de Manipulação de Energia (Skill Tree — Cap. 6)
      manipulation: new SchemaField({
        // Pontos investidos em habilidades de manipulação (determina estágio)
        pointsInvested: new NumberField({
          required: true, nullable: false, integer: true, min: 0, initial: 0,
          label: "JUJUTSU.Manipulation.PointsInvested"
        }),
        // Habilidades desbloqueadas: { [id]: { unlocked, dcReduction } }
        abilities: new MappingField(new SchemaField({
          unlocked: new BooleanField({ initial: false }),
          dcReduction: new NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 0 })
        }), { label: "JUJUTSU.Manipulation.Abilities" })
      }, { label: "JUJUTSU.Manipulation.Label" }),

      // Treinamentos de Energia (Cap. 6.5)
      trainings: new MappingField(new SchemaField({
        // 0 = não aprendido, 1 = Base ★, 2 = Evolução ★★, 3 = Perfeição ★★★
        rank: new NumberField({ required: true, nullable: false, integer: true, min: 0, max: 3, initial: 0 }),
        // CD atual (reduzida por falhas)
        currentDC: new NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 0 })
      }), { label: "JUJUTSU.Trainings.Label" }),

      // Pontos de Treinamento investidos (para Nível de Maestria)
      masteryPoints: new NumberField({
        required: true, nullable: false, integer: true, min: 0, initial: 0,
        label: "JUJUTSU.MasteryPoints"
      }),
      energyDice: new SchemaField({
        value: new NumberField({
          required: true, nullable: false, integer: true, min: 0, initial: 0,
          label: "JUJUTSU.EnergyDice.Current"
        }),
        max: new NumberField({
          required: true, nullable: false, integer: true, min: 0, initial: 0,
          label: "JUJUTSU.EnergyDice.Max"
        }),
        bonus: new NumberField({
          required: true, nullable: false, integer: true, min: 0, initial: 0,
          label: "JUJUTSU.EnergyDice.Bonus"
        }),
        denomination: new StringField({
          required: true, initial: "d4", blank: false,
          label: "JUJUTSU.EnergyDice.Denomination"
        })
      }, { label: "JUJUTSU.EnergyDice.Label" }),
      favorites: new ArrayField(new SchemaField({
        type: new StringField({ required: true, blank: false }),
        id: new StringField({ required: true, blank: false }),
        sort: new IntegerSortField()
      }), { label: "DND5E.Favorites" })
    });
  }

  /* -------------------------------------------- */
  /*  Properties                                  */
  /* -------------------------------------------- */

  get isCharacter() {
    return true;
  }

  /* -------------------------------------------- */
  /*  Data Migration                              */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static _migrateData(source) {
    super._migrateData(source);
    AttributesFields._migrateInitiative(source.attributes);
  }

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /** @inheritDoc */
  prepareBaseData() {
    this.attributes.hd = new HitDice(this.parent);
    this.details.level = 0;
    this.attributes.attunement.value = 0;

    for ( const item of this.parent.items ) {
      if ( item.type === "class" ) this.details.level += item.system.levels;
    }

    this.attributes.prof = Proficiency.calculateMod(this.details.level);

    const { xp, level } = this.details;
    xp.max = level >= CONFIG.DND5E.maxLevel ? Infinity : this.parent.getLevelExp(level || 1);
    xp.min = level ? this.parent.getLevelExp(level - 1) : 0;
    if ( Number.isFinite(xp.max) ) {
      const required = xp.max - xp.min;
      const pct = Math.round((xp.value - xp.min) * 100 / required);
      xp.pct = Math.clamp(pct, 0, 100);
    } else if ( game.settings.get("jujutsu-system", "levelingMode") === "xpBoons" ) {
      const overflow = xp.value - this.parent.getLevelExp(CONFIG.DND5E.maxLevel);
      xp.boonsEarned = Math.max(0, Math.floor(overflow / CONFIG.DND5E.epicBoonInterval));
      const progress = overflow - (CONFIG.DND5E.epicBoonInterval * xp.boonsEarned);
      xp.pct = Math.clamp(Math.round((progress / CONFIG.DND5E.epicBoonInterval) * 100), 0, 100);
    } else {
      xp.pct = 100;
    }

    AttributesFields.prepareBaseArmorClass.call(this);
    AttributesFields.prepareBaseEncumbrance.call(this);
    SensesField._shim(this.attributes.senses);
  }

  /* -------------------------------------------- */

  prepareEmbeddedData() {
    super.prepareEmbeddedData();
    if ( this.details.race instanceof Item ) {
      AttributesFields.prepareRace.call(this, this.details.race);
      this.details.type = this.details.race.system.type;
    } else {
      this.details.type = new CreatureTypeField({ swarm: false }).initialize({ value: "humanoid" }, this);
    }
    for ( const key of Object.keys(CONFIG.DND5E.movementTypes) ) this.attributes.movement[key] ??= 0;
    for ( const key of Object.keys(CONFIG.DND5E.senses) ) this.attributes.senses.ranges[key] ??= 0;
    this.attributes.movement.units ??= defaultUnits("length");
    this.attributes.senses.units ??= defaultUnits("length");
  }

  /* -------------------------------------------- */

  prepareDerivedData() {
    const rollData = this.parent.getRollData({ deterministic: true });
    const { originalSaves, originalSkills } = this.parent.getOriginalStats();

    this.details.tier = Math.ceil((this.details.level - 4) / 6) + 1;

    AttributesFields.prepareExhaustionLevel.call(this);
    this.prepareAbilities({ rollData, originalSaves });
    this.prepareSkills({ rollData, originalSkills });
    this.prepareTools({ rollData });
    AttributesFields.prepareArmorClass.call(this, rollData);
    AttributesFields.prepareConcentration.call(this, rollData);
    AttributesFields.prepareEncumbrance.call(this, rollData);
    AttributesFields.prepareInitiative.call(this, rollData);
    AttributesFields.prepareMovement.call(this, rollData);
    AttributesFields.prepareSpellcastingAbility.call(this);
    TraitsFields.prepareLanguages.call(this);
    TraitsFields.prepareResistImmune.call(this);

    const hpOptions = {};
    if ( this.attributes.hp.max === null ) {
      hpOptions.advancement = Object.values(this.parent.classes)
        .map(c => c.advancement.byType.HitPoints?.[0]).filter(a => a);
      hpOptions.bonus = (simplifyBonus(this.attributes.hp.bonuses.level, rollData) * this.details.level)
        + simplifyBonus(this.attributes.hp.bonuses.overall, rollData);
      hpOptions.mod = this.abilities[CONFIG.DND5E.defaultAbilities.hitPoints ?? "con"]?.mod ?? 0;
    }
    AttributesFields.prepareHitPoints.call(this, this.attributes.hp, hpOptions);

    const level = this.details?.level ?? 1;
    this.energyDice.max = (level * 2) + (this.energyDice.bonus ?? 0);

    const bonusOverall = simplifyBonus(this.energy.bonuses?.overall, rollData);
    const bonusLevel = simplifyBonus(this.energy.bonuses?.level, rollData) * level;
    const bonusTemp = this.energy.bonuses?.temp ?? 0;
    const intensiveBonus = (this.energy.intensiveTraining?.maxEnergy ?? 0) * 5;
    this.energy.max = (level * 20) + bonusOverall + bonusLevel + bonusTemp + intensiveBonus;

    // Acúmulo de Energia disponível a partir do nível 5
    if ( level >= 5 ) this.energyAbilities.accumulation.enabled = true;

    // Estágio de Manipulação (baseado em PM investidos em habilidades de manipulação)
    const invested = this.manipulation?.pointsInvested ?? 0;
    if ( invested >= 46 ) this.manipulation.stage = "master";
    else if ( invested >= 15 ) this.manipulation.stage = "expert";
    else this.manipulation.stage = "beginner";

    // Nível de Maestria (baseado em Pontos de Treinamento investidos)
    const mp = this.masteryPoints ?? 0;
    const masteryTable = [
      { level: 10, pts: 150, sorcerer: "special", die: null, evolution: "expansionSemBarreiras" },
      { level: 9,  pts: 115, sorcerer: "special", die: null, evolution: null },
      { level: 7,  pts: 100, sorcerer: "1º",     die: "d12", evolution: "expansaoDominio" },
      { level: 6,  pts: 75,  sorcerer: "1º",     die: null, evolution: null },
      { level: 5,  pts: 60,  sorcerer: "2º",     die: "d10", evolution: "feiticoMaximo" },
      { level: 4,  pts: 35,  sorcerer: "2º",     die: null, evolution: null },
      { level: 3,  pts: 20,  sorcerer: "3º",     die: "d8",  evolution: "feiticoEstendido" },
      { level: 2,  pts: 10,  sorcerer: "3º",     die: null, evolution: null },
      { level: 1,  pts: 1,   sorcerer: "4º",     die: "d6",  evolution: "feiticoBasico" }
    ];
    const mastery = masteryTable.find(m => mp >= m.pts) ?? { level: 0, pts: 0, sorcerer: "4th", die: null };
    this.masteryLevel = mastery.level;
    this.masterySorcerer = mastery.sorcerer;
    this.masteryDie = mastery.die;
    this.masteryEvolution = mastery.evolution;
  }

  /* -------------------------------------------- */
  /*  Socket Event Handlers                       */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preCreate(data, options, user) {
    if ( (await super._preCreate(data, options, user)) === false ) return false;
    await TraitsFields.preCreateSize.call(this, data, options, user);

    if ( this.parent._stats?.compendiumSource?.startsWith("Compendium.") ) return;
    this.parent.updateSource({
      prototypeToken: {
        actorLink: true,
        disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
        sight: { enabled: true }
      }
    });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preUpdate(changes, options, user) {
    if ( (await super._preUpdate(changes, options, user)) === false ) return false;
    await AttributesFields.preUpdateHP.call(this, changes, options, user);
    await TraitsFields.preUpdateSize.call(this, changes, options, user);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onUpdate(changed, options, userId) {
    super._onUpdate(changed, options, userId);
    AttributesFields.onUpdateHP.call(this, changed, options, userId);
  }

  /* -------------------------------------------- */
  /*  Helpers                                     */
  /* -------------------------------------------- */

  cantripLevel(spell) {
    return this.details.level;
  }

  hasFavorite(favoriteId) {
    return !!this.favorites.find(f => f.id === favoriteId);
  }

  addFavorite(favorite) {
    if ( this.hasFavorite(favorite.id) ) return Promise.resolve(this.parent);

    if ( favorite.id.startsWith(".") && fromUuidSync(favorite.id, { relative: this.parent }) === null ) {
      throw new Error(`The item with id ${favorite.id} is not owned by actor ${this.parent.id}`);
    }

    let maxSort = 0;
    const favorites = this.favorites.map(f => {
      if ( f.sort > maxSort ) maxSort = f.sort;
      return { ...f };
    });
    favorites.push({ ...favorite, sort: maxSort + CONST.SORT_INTEGER_DENSITY });
    return this.parent.update({ "system.favorites": favorites });
  }

  removeFavorite(favoriteId) {
    if ( favoriteId.startsWith("resources.") ) return this.parent.update({ [`system.${favoriteId}.max`]: 0 });
    const favorites = this.favorites.filter(f => f.id !== favoriteId);
    return this.parent.update({ "system.favorites": favorites });
  }
}

/* -------------------------------------------- */

function makeResourceField(schemaOptions={}) {
  return new SchemaField({
    value: new NumberField({required: true, integer: true, initial: 0, labels: "DND5E.ResourceValue"}),
    max: new NumberField({required: true, integer: true, initial: 0, labels: "DND5E.ResourceMax"}),
    sr: new BooleanField({required: true, labels: "DND5E.REST.Short.Recovery"}),
    lr: new BooleanField({required: true, labels: "DND5E.REST.Long.Recovery"}),
    label: new StringField({required: true, labels: "DND5E.ResourceLabel"})
  }, schemaOptions);
}