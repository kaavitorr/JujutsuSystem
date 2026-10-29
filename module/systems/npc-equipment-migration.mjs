import { NPC_ARMOR_REDIRECTS, NPC_EQUIPMENT_PACK, NPC_PROFILE_PACK, npcEquipmentFingerprint, npcEquipmentUuid } from "./npc-equipment-catalog.mjs";
import {syncNpcProfileEquipment} from "./legacy2-npc-equipment.mjs";

const NS="jujutsu-system";
let cachedCatalog;
const raw = item => item.toObject?.() ?? structuredClone(item);
const sourceOf = item => item.flags?.[NS]?.npcArchetypeEquipment?.source ?? item.flags?.[NS]?.equipmentPdn?.source
  ?? item._stats?.compendiumSource ?? item.flags?.core?.sourceId;
const same = (a,b) => a===b || (!!a&&!!b&&typeof a==="object"&&typeof b==="object"&&Array.isArray(a)===Array.isArray(b)
  && Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&same(a[k],b[k])));

/** Update only the broken stock fields; keep sheet values, custom art, formulas and manually added effects. */
export function equipmentCopyPatch(original, source) {
  const item=raw(original), desired=raw(source), patch={_id:item._id ?? original.id};
  const origin=sourceOf(item), canonical=npcEquipmentUuid(desired._id ?? source.id);
  const metadata=desired.flags?.[NS]?.equipmentPdn;
  if(!(metadata?.version>=1) || item.type!==desired.type) return null;
  const legacyPlaceholder=NPC_ARMOR_REDIRECTS[origin] && ["icons/svg/shield.svg","systems/jujutsu-system/icons/svg/items/equipment.svg"].includes(item.img);
  if((item.img===metadata.previousImg||legacyPlaceholder) && item.img!==desired.img)patch.img=desired.img;
  const flags=item.flags?.[NS] ?? {}, converted=flags.equipmentPdn?.version>=1;
  if(!converted){
    const hashes=metadata.descriptionHashesBefore ?? [];
    const description=item.system.description?.value;
    if(hashes.includes(npcEquipmentFingerprint(description)) || (NPC_ARMOR_REDIRECTS[origin]
      && /^<p>CR: [\d.]+ \+ \w+\.<\/p>(?:<p>[^<]*<\/p>)*$/.test(description??"")))
      patch["system.description.value"]=desired.system.description.value;
    if(item.type==="weapon"){
      const activities=structuredClone(item.system.activities ?? {});let changed=false;
      for(const activity of Object.values(activities)){
        if(activity.type!=="attack")continue;
        const cost=Number(flags.custoPA), value=Number(activity.activation?.value)||0;
        const legacy=(activity.consumption?.targets??[]).some(t=>t.target==="energy.generated"&&Number(t.value)===cost);
        if(legacy && (!value || value===cost)){
          activity.activation={...activity.activation,type:"action",value:cost,override:true};
          activity.consumption.targets=activity.consumption.targets.filter(t=>!["energy.generated","energy.total"].includes(t.target));
          activity.consumption.spellSlot=false;
          if(activity.damage)activity.damage.includeBase=false;
          changed=true;
        }
      }
      if(changed)patch["system.activities"]=activities;
      if(flags.modificador?.includes("undefined"))patch[`flags.${NS}.modificador`]=desired.flags[NS].modificador;
    } else if(item.type==="equipment"){
      const armor=item.system.armor??{}, expected=desired.system.armor;
      const oldAbility=origin?.endsWith(".8a1b4d0d10527a46")?"con":expected.ability;
      if(NPC_ARMOR_REDIRECTS[origin] && Number(armor.value)===Number(expected.value) && armor.ability===oldAbility)
        patch["system.armor"]={...armor,...expected};
      const effects=structuredClone(item.effects??[]);let changed=false;
      for(const effect of effects){
        const changes=effect.system?.changes??effect.changes??[];
        if(effect.flags?.[NS]?.armaduraNaturalCR && !effect.disabled){effect.disabled=true;changed=true;}
        if(changes.some(c=>c.key.startsWith("system.legacy2.resistances.")) && !effect.transfer){effect.transfer=true;changed=true;}
      }
      for(const effect of desired.effects??[]){
        if(effect.disabled || !effect.transfer)continue;
        const keys=(effect.system?.changes??effect.changes??[]).map(c=>c.key);
        if(!keys.length || effects.some(e=>(e.system?.changes??e.changes??[]).some(c=>keys.includes(c.key))))continue;
        effects.push(structuredClone(effect));changed=true;
      }
      if(changed)patch.effects=effects;
      if(flags.thorns?.atributo==="for")patch[`flags.${NS}.thorns.atributo`]="str";
      if(NPC_ARMOR_REDIRECTS[origin])for(const key of ["armaduraNatural","cr","thorns","efeito"]){
        if(Object.hasOwn(desired.flags[NS],key))patch[`flags.${NS}.${key}`]=structuredClone(desired.flags[NS][key]);
      }
    }
    patch[`flags.${NS}.equipmentPdn`]={...metadata,source:canonical};
  }
  if(NPC_ARMOR_REDIRECTS[origin]){
    patch["_stats.compendiumSource"]=canonical;
    if(flags.npcArchetypeEquipment)patch[`flags.${NS}.npcArchetypeEquipment`]={...flags.npcArchetypeEquipment,source:canonical};
  }
  return Object.keys(patch).length>1?patch:null;
}

/** Canonical profile defaults are copied once; subsequent user equipment choices remain theirs. */
export function profileCopyPatch(original, canonical) {
  const item=raw(original), source=raw(canonical),current=item.system?.equipamentos;
  if(!(source.flags?.[NS]?.equipmentPdn?.version>=1))return null;
  if(!current || !source.system?.equipamentos)return null;
  const version=item.flags?.[NS]?.equipmentPdn?.version??0,defaults=source.system.equipamentos;
  const equipment={armadura:NPC_ARMOR_REDIRECTS[current.armadura]??current.armadura??null,
    armas:current.armas?.length?[...new Set(current.armas)]:version>=1?[]:[...defaults.armas]};
  const metadata={version:1};
  if(same(equipment,current)&&same(item.flags?.[NS]?.equipmentPdn,metadata))return null;
  return {_id:item._id??original.id,"system.equipamentos":equipment,[`flags.${NS}.equipmentPdn`]:metadata};
}

function profileSource(item,catalog){
  const origin=sourceOf(item);
  const key=item.flags?.[NS]?.encyclopedia?.key;
  return catalog.profiles.find(source=>source.type===item.type && (source.uuid===origin || (key && source.flags?.[NS]?.encyclopedia?.key===key)));
}
function gearSource(item,catalog){
  const origin=sourceOf(item),canonical=NPC_ARMOR_REDIRECTS[origin]??origin;
  return catalog.gear.find(source=>(source.uuid??npcEquipmentUuid(source.id??source._id))===canonical);
}

export async function refreshNpcEquipment(world=game,{sync=syncNpcProfileEquipment}={}){
  if(!world.user.isGM || world.users.activeGM?.id!==world.user.id)return;
  const gearPack=world.packs.get(NPC_EQUIPMENT_PACK),profilePack=world.packs.get(NPC_PROFILE_PACK);
  if(!gearPack||!profilePack)return;
  const catalog={gear:await gearPack.getDocuments(),profiles:(await profilePack.getDocuments()).filter(i=>["taxonomy","archetype"].includes(i.type))};
  cachedCatalog=catalog;
  const itemPatch=item=>{
    if(["taxonomy","archetype"].includes(item.type)){const source=profileSource(item,catalog);return source?profileCopyPatch(item,source):null;}
    const source=gearSource(item,catalog);return source?equipmentCopyPatch(item,source):null;
  };
  for(const item of world.items??[]){const patch=itemPatch(item);if(patch){delete patch._id;await item.update(patch);}}
  const actors=new Set(world.actors??[]);
  for(const scene of world.scenes??[])for(const token of scene.tokens??[])if(!token.actorLink&&token.actor)actors.add(token.actor);
  for(const actor of actors){
    // Repoint managed armor first so updating its profile does not recreate the Item and break shortcuts.
    for(const profilePass of [false,true]){
      const patches=Array.from(actor.items??[]).filter(i=>["taxonomy","archetype"].includes(i.type)===profilePass).map(itemPatch).filter(Boolean);
      if(patches.length)await actor.updateEmbeddedDocuments("Item",patches);
    }
    if(actor.type==="npc")await sync(actor);
  }
}

export function registerNpcEquipmentMigration(hooks=Hooks){
  hooks.once("dnd5e.ready",()=>refreshNpcEquipment().catch(error=>{
    console.error("Jujutsu: falha ao atualizar os equipamentos de NPC.",error);
    ui.notifications.error("Não foi possível atualizar os equipamentos de criaturas e NPCs.");
  }));
  hooks.on("preCreateActor",(actor)=>{
    if(actor.type!=="npc"||!cachedCatalog)return;
    const items=actor.toObject().items??[];let changed=false;
    for(const item of items){
      const source=["taxonomy","archetype"].includes(item.type)?profileSource(item,cachedCatalog):gearSource(item,cachedCatalog);
      if(!source)continue;
      const patch=["taxonomy","archetype"].includes(item.type)?profileCopyPatch(item,source):equipmentCopyPatch(item,source);
      if(!patch)continue;
      delete patch._id;foundry.utils.mergeObject(item,foundry.utils.expandObject(patch));changed=true;
    }
    if(changed)actor.updateSource({items});
  });
}
