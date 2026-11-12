import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecipeEditorDialog} from '../web/recipe-editor-dialog.js';

function fixture(){
 const keys=['information','ingredients','preparation','settings'],elements=new Map();let doc;
 function element(extra={}){return {attributes:{},handlers:{},dataset:{},disabled:false,hidden:false,isConnected:true,classList:{add(){},remove(){}},
  setAttribute(key,value){this.attributes[key]=value;},getAttribute(key){return this.attributes[key]??null;},addEventListener(name,fn){this.handlers[name]=fn;},focus(){doc.activeElement=this;},closest(){return null;},...extra};}
 const tabs=keys.map(key=>element({dataset:{recipeEditorTab:key}})),panels=keys.map(key=>element({dataset:{recipeEditorPanel:key}}));
 const fields=keys.slice(0,3).map((key,i)=>element({type:'text',value:'value '+i,willValidate:true,validity:{valid:true},closest:()=>panels[i],reportValidity(){this.reported=true;}}));
 const form=element({elements:Object.assign(fields,{name:fields[0]}),querySelectorAll:()=>fields});
 const body={scrollTop:0},dialog=element({open:false,showModal(){this.open=true;},close(){this.open=false;},querySelectorAll:selector=>selector.includes('-tab]')?tabs:panels,querySelector:()=>body});
 for(const [id,value] of [['recipe-editor-dialog',dialog],['recipe-form',form],['recipe-editor-previous',element()],['recipe-editor-next',element()],['save-recipe',element()],['recipe-editor-cancel',element()]])elements.set('#'+id,value);
 const opener=element();doc={activeElement:opener,querySelector:selector=>elements.get(selector),querySelectorAll:()=>[],defaultView:{scrollY:420,scrollTo(value){this.lastScroll=value;},confirm:()=>false}};
 return {ui:createRecipeEditorDialog(doc),doc,form,dialog,tabs,panels,fields,opener,elements};
}

test('modal tabs retain entered values and support arrow, Home and End navigation',()=>{
 const f=fixture();f.ui.open();assert.equal(f.dialog.open,true);assert.equal(f.doc.activeElement,f.fields[0]);
 f.fields[0].value='Unsaved recipe';f.ui.select('preparation');assert.equal(f.panels[0].hidden,true);assert.equal(f.panels[2].hidden,false);
 f.tabs[2].handlers.keydown({key:'ArrowRight',preventDefault(){}});assert.equal(f.tabs[3].attributes['aria-selected'],'true');assert.equal(f.doc.activeElement,f.tabs[3]);
 f.tabs[3].handlers.keydown({key:'Home',preventDefault(){}});assert.equal(f.tabs[0].tabIndex,0);
 f.tabs[0].handlers.keydown({key:'End',preventDefault(){}});assert.equal(f.tabs[3].tabIndex,0);assert.equal(f.fields[0].value,'Unsaved recipe');
});

test('validation reveals the first invalid field in another tab before reporting its error',()=>{
 const f=fixture();f.ui.open();f.fields[1].validity.valid=false;
 assert.equal(f.ui.validate(),false);assert.equal(f.panels[1].hidden,false);assert.equal(f.panels[0].hidden,true);assert.equal(f.fields[1].reported,true);assert.equal(f.doc.activeElement,f.fields[1]);
 f.fields[1].validity.valid=true;assert.equal(f.ui.validate(),true);
});

test('Escape and cancel protect unsaved changes and restore focus and list position on dismissal',()=>{
 const f=fixture();f.ui.open();f.fields[0].value='Changed';let prevented=false;
 f.dialog.handlers.cancel({preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(f.dialog.open,true);
 f.doc.defaultView.confirm=()=>true;assert.equal(f.ui.close(),true);assert.equal(f.dialog.open,false);assert.equal(f.doc.activeElement,f.opener);assert.equal(f.doc.defaultView.lastScroll.top,420);
});

test('an in-flight save blocks duplicate submission and dismissal, while a completed save can close',()=>{
 const f=fixture();f.ui.open();f.ui.setBusy(true);assert.equal(f.ui.isBusy(),true);assert.equal(f.elements.get('#save-recipe').disabled,true);assert.equal(f.ui.close(),false);
 f.ui.close({discard:true});assert.equal(f.dialog.open,false);f.ui.setBusy(false);assert.equal(f.elements.get('#save-recipe').disabled,false);
});
