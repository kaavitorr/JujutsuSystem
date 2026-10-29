import Ruleset from "./ruleset.mjs";
import {techniqueDifficulty} from "./legacy2-technique-dc.mjs";
const NS="jujutsu-system";
const queues=new WeakMap();
const positive=value=>Math.max(0,Math.trunc(Number(value)||0));
const escape=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);

/** Use the armor selected by the CR calculation, rather than stacking every equipped item's retaliation. */
export function armorRetaliation(actor){
  const armor=actor.system?.attributes?.ac?.equippedArmor ?? Array.from(actor.itemTypes?.equipment??actor.items??[])
    .find(item=>item.type==="equipment"&&item.system?.equipped&&item.system.type?.value!=="shield");
  const thorns=armor?.system?.equipped && armor.flags?.[NS]?.thorns;
  if(!thorns)return null;
  const ability=thorns.atributo==="for"?"str":thorns.atributo;
  const value=thorns.tipo==="thorns-resistencia"?positive(actor.system?.legacy2?.resistances?.[thorns.tipoDano]?.value)
    :positive(actor.system?.abilities?.[ability]?.value);
  return{armor,value,type:thorns.tipoDano??null};
}

/** The bite's authored condition is automatic on a hit, and carries the same real modifiers as the Effects tab. */
export async function applyNaturalHitCondition(actor,sourceEffect,{origin,attacker}={}){
  const {applyGameCondition,gameConditionChanges}=await import("../applications/actor/jj/conditions.mjs");
  const {temPeculiaridade}=await import("./peculiaridades-automacao.mjs");
  if(temPeculiaridade(actor,"doenca-sobrenatural"))return false;
  const statuses=Array.from(sourceEffect.statuses??[]),primary=statuses.find(id=>id.startsWith("jj-"));
  if(statuses.some(id=>actor.system?.traits?.ci?.value?.has?.(id)))return false;
  if(!primary || !await applyGameCondition(actor,primary,{origin}))return false;
  const effect=actor.effects.find(effect=>effect.statuses?.has(primary));
  if(!effect)return false;
  const changes=Array.from(effect.system?.changes??effect.changes??[],change=>({...change}));
  const signature=change=>`${change.key}:${change.type??change.mode}:${change.value}`;
  const seen=new Set(changes.map(signature));
  for(const id of statuses.filter(id=>id.startsWith("jj-")&&id!==primary))for(const change of gameConditionChanges(actor,id)){
    if(!seen.has(signature(change))){changes.push(change);seen.add(signature(change));}
  }
  const definition=sourceEffect.toObject?.()??sourceEffect;
  const duration=structuredClone(definition.duration??{});
  if(!game.combat?.started && duration.units==="rounds"){duration.value=positive(duration.value)*6;duration.units="seconds";}
  const config=definition.flags?.[NS]?.condicaoDano??{};
  const dc=Number(attacker?.system?.attributes?.spell?.dc)||(attacker?.system?.abilities?techniqueDifficulty(attacker,Ruleset).value:10);
  await effect.update({statuses:[...new Set([...effect.statuses,...statuses])],changes,duration,start:effect.constructor.getEffectStart(),
    [`flags.${NS}.condicaoDano`]:{...config,cd:dc},
    ...(attacker?.uuid?{[`flags.${NS}.conditionSourceActor`]:attacker.uuid}:{})});
  return true;
}

const applyRetaliation=async(actor,value,options)=>(await import("../applications/actor/jj/damage-application.mjs")).applyDamageToActor(actor,value,options);
const announceRetaliation=async(attacker,defender,result)=>ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:defender}),
  content:`<p><strong>${escape(result.armor.name)}</strong>: ${result.value} de dano de retorno contra <strong>${escape(attacker.name)}</strong>.</p>`});

/** Resolve native evaluated hits, including synthetic tokens. One GM handles each message and keeps receipts. */
export async function resolveNpcEquipmentAttack(message,{world=game,resolve=globalThis.fromUuid,applyCondition=applyNaturalHitCondition,
  damage=applyRetaliation,announce=announceRetaliation}={}){
  if(world.settings.get(NS,"rulesetVersion")!=="2.0" || message.type!=="attack")return[];
  const gm=world.users?.activeGM;
  if(gm?gm.id!==world.user.id:message.author?.id!==world.user.id)return[];
  if(queues.has(message))return queues.get(message);
  const run=(async()=>{
    const attacker=message.getAssociatedActor?.();
    if(!attacker)return[];
    const item=message.getAssociatedItem?.(),flags=item?.flags?.[NS];
    const bite=flags?.ataqueNatural && flags.condicaoAoAtingir;
    const activity=message.getAssociatedActivity?.();
    const effectIds=new Set(Array.from(activity?.effects??[],reference=>reference._id));
    const conditionEffects=bite?Array.from(item.effects??[]).filter(effect=>!effect.disabled && effectIds.has(effect.id??effect._id)
      && effect.flags?.[NS]?.condicaoDano):[];
    const receipts=[...(message.getFlag?.(NS,"npcEquipmentResults")??[])],results=[];
    const targets=new Set();
    for(const target of message.system?.evaluatedTargets??[]){
      if(target.isMiss!==false)continue;
      const reference=target.token??target.actor;
      if(!reference || targets.has(reference))continue;targets.add(reference);
      const resolved=await resolve?.(reference),actor=resolved?.actor??resolved;
      if(!actor?.isOwner || !actor.uuid)continue;
      const done=kind=>receipts.some(receipt=>receipt.target===reference&&receipt.kind===kind);
      const remember=async(kind,result)=>{
        const receipt={target:reference,kind,result};receipts.push(receipt);results.push(receipt);
        await message.setFlag(NS,"npcEquipmentResults",receipts);
      };
      for(const effect of conditionEffects){
        const kind=`condition:${effect.id??effect._id}`;
        if(done(kind))continue;
        const applied=await applyCondition(actor,effect,{origin:message.uuid,attacker});
        await remember(kind,applied?"applied":"unaffected");
      }
      const retaliation=armorRetaliation(actor);
      if(retaliation?.value && attacker.isOwner && !done("retaliation")){
        const options=retaliation.type?{damageTypes:[retaliation.type],damages:[{type:retaliation.type,value:retaliation.value}]}:{};
        if(await damage(attacker,retaliation.value,options)!==false){
          await remember("retaliation","applied");await announce(attacker,actor,retaliation);
        }
      }
    }
    return results;
  })();
  queues.set(message,run);
  try{return await run;}finally{if(queues.get(message)===run)queues.delete(message);}
}

export function registerNpcEquipmentCombat(hooks=Hooks){
  hooks.on("createChatMessage",message=>resolveNpcEquipmentAttack(message).catch(error=>{
    console.error("Jujutsu: falha ao aplicar efeito de equipamento natural.",error);
    ui.notifications.error("Não foi possível aplicar um efeito de equipamento natural.");
  }));
}
