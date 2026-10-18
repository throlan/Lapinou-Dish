import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const source=await readFile(new URL('../web/app.js',import.meta.url),'utf8');
const a=source.indexOf('function componentUnitOptions('),b=source.indexOf("$('#add-recipe-line')",a);
const all=node=>[node,...(node.children??[]).flatMap(all)];
function ui(){
  const element=tag=>({tag,children:[],options:[],handlers:{},attributes:{},value:'',
    append(...nodes){this.children.push(...nodes);},add(option){this.options.push(option);},
    replaceChildren(...nodes){this.children=nodes;this.options=[];},setAttribute(k,v){this.attributes[k]=v;},
    addEventListener(k,fn){this.handlers[k]=fn;},remove(){this.removed=true;}});
  const root=element('div'),opened=[];
  const context={document:{createElement:element,createTextNode:text=>({textContent:text})},
    Option:function(label,value){return {label,value};},formatQty:String,updateServingConfiguration(){},showRecipeCard:id=>opened.push(id),
    state:{editingRecipeId:'dish',recipes:[{id:'dish',name:'Current dish',yield:{amount:4,unitId:'portion'}},
      {id:'bread',name:'Synthetic bread',yield:{amount:1,unitId:'piece'},outputUnits:{slice:20}},
      {id:'sauce',name:'Synthetic sauce',yield:{amount:500,unitId:'g'},outputUnits:{}}]},
    $(selector,row){if(selector==='#recipe-lines')return root;const label=selector.match(/aria-label="([^"]+)"/);return all(row).find(n=>label&&n.attributes?.['aria-label']===label[1]);}};
  runInNewContext(source.slice(a,b)+'\nglobalThis.add=addRecipeIngredientLine;globalThis.input=recipeLineInput;globalThis.units=componentUnitOptions;',context);
  return {context,root,opened,find:label=>all(root).find(n=>n.attributes?.['aria-label']===label)};
}

test('recipe component editor restores slice amounts, excludes self and submits a live recipe reference',()=>{
  const f=ui();f.context.add({recipeId:'bread',quantity:2,unitId:'slice',servingPart:'starch'});
  const select=f.find('Recette liée');assert.equal(select.value,'bread');assert.ok(!select.options.some(o=>o.value==='dish'));
  assert.equal(f.find('Unité').value,'slice');assert.equal(f.find('Quantité').value,'2');
  assert.deepEqual(JSON.parse(JSON.stringify(f.context.input(f.root.children[0]))),{recipeId:'bread',quantity:2,unitId:'slice'});
  const link=all(f.root).find(n=>n.textContent==='Voir la préparation');link.handlers.click();assert.deepEqual(f.opened,['bread']);
  select.value='sauce';select.handlers.change();assert.equal(f.find('Unité').value,'g');assert.ok(!f.find('Unité').options.some(o=>o.value==='slice'));
  all(f.root).find(n=>n.attributes?.['aria-label']==='Supprimer cette préparation').handlers.click();assert.equal(f.root.children[0].removed,true);
});

test('a new component starts at one piece and asks for an existing preparation',()=>{
  const f=ui();f.context.add();assert.equal(f.find('Quantité').value,'1');assert.equal(f.find('Recette liée').required,true);
  assert.equal(f.find('Recette liée').value,'');assert.ok(all(f.root).some(n=>n.textContent?.includes('Ajoute d’abord')));
  f.find('Recette liée').value='bread';f.find('Recette liée').handlers.change();assert.equal(f.find('Unité').value,'piece');
});

test('piece, slice, weight and volume choices depend on declared recipe equivalents',()=>{
  const f=ui();
  assert.deepEqual(Array.from(f.context.units({yield:{amount:6,unitId:'piece'},outputUnits:{slice:12}}),p=>p[0]),['piece','slice','g','kg']);
  assert.deepEqual(Array.from(f.context.units({yield:{amount:500,unitId:'ml'},outputUnits:{portion:4}}),p=>p[0]),['ml','portion','g','kg','l']);
});
