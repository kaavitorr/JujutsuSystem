import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { alternativeSavesEnabled, alternativeSaveDefinition } from "../module/systems/legacy2-alternative-saves.mjs";

let enabled=true,version="2.0";
globalThis.game={settings:{get:(scope,key)=>key==="rulesetVersion"?version:key==="regraSalvaguarda"?enabled:undefined},user:{isGM:false}};
globalThis.CONFIG={DND5E:{abilities:{str:{label:"Força"},wis:{label:"Sabedoria"},con:{label:"Constituição"},cha:{label:"Presença"},dex:{label:"Agilidade"},int:{label:"Intelecto"}}}};
globalThis.foundry={utils:{isEmpty:obj=>!Object.keys(obj).length}};
const loc=(key,{ability,dc})=>key==="DND5E.SavingThrowDC"?`CD ${dc} Salvaguarda de ${ability}`:`Salvaguarda de ${ability}`;
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const body=(path,name)=>read(path).match(new RegExp(`  ${name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")} \\{([\\s\\S]*?)\\r?\\n  }`))[1];
const Activity=new Function("alternativeSavesEnabled","alternativeSaveDefinition","_loc",`return class extends class {_usageChatButtons(){return [{action:"other",label:{value:"Outra ação"},dataset:{},visibility:"all"}]}} {_usageChatButtons(message){${body("module/documents/activity/save.mjs","_usageChatButtons(message)")}}}`)(alternativeSavesEnabled,alternativeSaveDefinition,loc);
const prepare=new Function("alternativeSavesEnabled","alternativeSaveDefinition","_loc",`return function(){${body("module/data/chat-message/usage-message-data.mjs","_prepareButtons()")}}`)(alternativeSavesEnabled,alternativeSaveDefinition,loc);
const groupButtons=new Function("context",body("module/data/chat-message/usage-message-data.mjs","_prepareButtonGroups(context)"));
function activity(abilities){return Object.assign(new Activity(),{save:{ability:new Set(abilities),dc:{value:18},visible:true},damage:{parts:[]}});}
function message(buttons,challenge=true){return {buttons,actor:{isOwner:false},parent:{isAuthor:false,shouldDisplayChallenge:challenge,getAssociatedActivity:()=>null}};}

test("new cards request each matching alternative save once, keeping DC and original roll attributes",()=>{
  enabled=true;version="2.0";
  const a=activity(["str","wis","con","cha","dex","int"]),before=[...a.save.ability];
  const stored=a._usageChatButtons({});
  const buttons=prepare.call(message(stored)).filter(b=>b.action==="rollSave"&&!b.hidden);
  assert.deepEqual(buttons.map(b=>b.label),["CD 18 Salvaguarda de Fortitude","CD 18 Salvaguarda de Vontade","CD 18 Salvaguarda de Reflexo"]);
  assert.deepEqual(buttons.map(b=>b.dataset.ability),["str","con","dex"]);
  assert(buttons.every(b=>b.dataset.dc===18));
  const context={buttons:prepare.call(message(stored)),rows:{}};groupButtons(context);
  assert.deepEqual(context.rows.rollSave.entries.map(e=>e.label),["CD 18 Salvaguarda de Fortitude","CD 18 Salvaguarda de Vontade","CD 18 Salvaguarda de Reflexo"]);
  assert.deepEqual([...a.save.ability],before);
});
test("old published cards adopt current names without changing stored labels, target DC or indexes",()=>{
  enabled=false;version="2.0";
  const stored=activity(["str","wis","con","dex"])._usageChatButtons({});
  const backup=structuredClone(stored);enabled=true;
  const result=prepare.call(message(stored));
  assert.equal(result[0].label,"CD 18 Salvaguarda de Fortitude");
  assert.equal(result[1].hidden,true);
  assert.equal(result[2].label,"CD 18 Salvaguarda de Vontade");assert.equal(result[2].index,2);
  assert.equal(result[3].label,"CD 18 Salvaguarda de Reflexo");assert.equal(result[3].index,3);
  assert.equal(result[4].action,"other");assert.deepEqual(stored,backup);
  enabled=false;
  const restored=prepare.call(message(stored));
  assert.equal(restored[0].label,"CD 18 Salvaguarda de Força");assert.equal(restored[1].hidden,false);
});
test("hidden challenges do not reveal the DC and different DCs remain distinct choices",()=>{
  enabled=false;version="2.0";
  const stored=activity(["str","wis"])._usageChatButtons({});stored[1].dataset.dc=22;
  enabled=true;
  const result=prepare.call(message(stored,false));
  assert.equal(result[0].label,"Salvaguarda de Fortitude");assert.equal(result[1].label,"Salvaguarda de Fortitude");
  assert.equal(result[1].hidden,false);assert.equal(result[1].dataset.dc,22);
  assert(!result.some(b=>/18|22/.test(b.label)));
});
test("turning the option off restores individual labels even on cards created with the rule on; 1.0 stays unchanged",()=>{
  enabled=true;version="2.0";
  const stored=activity(["wis"])._usageChatButtons({});
  assert.equal(stored[0].label.value,"CD 18 Salvaguarda de Fortitude");
  enabled=false;
  assert.equal(prepare.call(message(stored))[0].label,"CD 18 Salvaguarda de Sabedoria");
  enabled=true;version="1.0";
  assert.equal(activity(["con"])._usageChatButtons({})[0].label.value,"CD 18 Salvaguarda de Constituição");
  version="2.0";
});

test("the native choice menu forwards the correct stored button after duplicate requests are hidden",()=>{
  enabled=false;version="2.0";
  const stored=activity(["str","wis","con","dex"])._usageChatButtons({}),m=message(stored);enabled=true;
  let forwarded;
  m._prepareButtons=()=>prepare.call(m);
  m.parent.getAssociatedActivity=()=>({onChatAction:(event,target)=>{forwarded=stored[target.dataset.index];}});
  const menu=new Function("ui",`return function(){${body("module/data/chat-message/usage-message-data.mjs","_getButtonGroupContextOptions()")}}`)({context:{target:{dataset:{forwardAction:"rollSave"}}}});
  const options=menu.call(m);assert.equal(options.length,3);
  assert.equal(options[1].label,"CD 18 Salvaguarda de Vontade");
  options[1].onClick({}, {dataset:{}});
  assert.equal(forwarded.dataset.ability,"con");assert.equal(forwarded.dataset.dc,18);
});
