import assert from "node:assert/strict";
import { test } from "node:test";
globalThis.document={querySelector:()=>true,createElement:()=>({}),head:{append(){}}};
class ApplicationBoundary {
  static _maxZ=100;
  constructor(options={}) { this.options=options;this.id=options.id??"creation";this.element={querySelectorAll:()=>[]}; }
  async _prepareContext(){return {};}
  async render(){this.renders=(this.renders??0)+1;return this;}
  async close(){this.closed=true;return this;}
}
globalThis.foundry={applications:{api:{ApplicationV2:ApplicationBoundary,HandlebarsApplicationMixin:C=>C},ux:{TextEditor:{implementation:{enrichHTML:async html=>html}}}}};
globalThis.game={settings:{get:()=>"2.0"},packs:new Map(),items:[],user:{id:"me"}};
globalThis.CONFIG={};
const {default:Creation}=await import("../module/applications/actor/creation/character-creation-2.mjs");
const actor=id=>({id,name:"Inicial",type:"character",isOwner:true,items:[],getFlag(){},sheet:{render(){}}});
test("forward navigation validates the previous stage instead of skipping required choices",()=>{
  const app=new Creation(actor("navigation"));app.catalog={species:[],styles:[],graph:{porNome:new Map()},customization:{}};
  app.changeStep(1);assert.equal(app.draft.step,0);assert(app.errors.length>0);
});
test("closing directly captures unblurred inputs and resumes the same local draft without actor writes",async()=>{
  const a=actor("resume"),app=new Creation(a);
  app.element={querySelectorAll:()=>[{dataset:{creationField:"name"},value:"Nome editado"}]};
  await app.close();
  assert.equal(a.name,"Inicial");
  const resumed=new Creation(a);assert.equal(resumed.draft.name,"Nome editado");
});
test("a pending finish cannot be closed halfway through its native transaction",async()=>{
  const app=new Creation(actor("busy"));app.busy=true;
  await app.close();assert.equal(app.closed,undefined);
  app.busy=false;await app.close();assert.equal(app.closed,true);
});
test("creator instances have unique IDs when multiple actors are created",()=>{
  assert.notEqual(new Creation(actor("first")).id,new Creation(actor("second")).id);
});
test("native image picker and portrait copying edit the draft while actor images remain untouched",()=>{
  let picker;
  foundry.applications.apps={FilePicker:{implementation:class{constructor(options){picker=options;}browse(){}}}};
  const a={...actor("images"),img:"old.webp",prototypeToken:{texture:{src:"old-token.webp"}}},app=new Creation(a);
  app.pickImage("img");assert.equal(picker.type,"image");assert.equal(picker.current,"old.webp");picker.callback("new.webp");
  Creation.onCopyPortrait.call(app);assert.equal(app.draft.tokenImg,"new.webp");assert.equal(a.img,"old.webp");assert.equal(a.prototypeToken.texture.src,"old-token.webp");
});
test("customization drop moves a source between groups without assigning it twice",async()=>{
  const app=new Creation(actor("customization"));app.catalog={customization:Object.fromEntries(Object.keys(app.draft.customization).map(k=>[k,[]]))};
  const doc={uuid:"Item.custom",name:"Característica",type:"feat"};
  await app.addCustomization(doc,"jj-flaws");await app.addCustomization(doc,"jj-peculiarities");
  assert.deepEqual(app.draft.customization["jj-flaws"],[]);assert.deepEqual(app.draft.customization["jj-peculiarities"],[doc.uuid]);
});
