import {instructionSteps,cookingFromText,cookingMethods,difficultyLabels} from './recipe-method.js';

export function createRecipeMethodEditor(root,form){
 const element=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
 const timings=element('fieldset');timings.className='recipe-method-fields';timings.append(element('legend','Temps et difficulté'));
 const grid=element('div');grid.className='recipe-time-grid';const fields={};
 for(const [key,label,max] of [['prepMinutes','Préparation (min)',43200],['restMinutes','Repos / pause (min)',43200],['cookMinutes','Cuisson (min)',43200],['temperatureC','Température (°C)',500]]){
  const wrapper=element('label',label),input=element('input');input.type='number';input.name=key;input.min='0';input.max=max;input.step='1';input.placeholder='Non renseigné';wrapper.append(input);grid.append(wrapper);fields[key]=input;
 }
 for(const [key,label,choices] of [['method','Mode de cuisson',cookingMethods],['difficulty','Difficulté',difficultyLabels]]){
  const wrapper=element('label',label),input=element('select');input.name='recipe_'+key;input.add(new Option(key==='difficulty'?'Non renseignée':'Non renseigné',''));for(const [value,name] of Object.entries(choices))input.add(new Option(name,value));wrapper.append(input);grid.append(wrapper);fields[key]=input;
 }
 timings.append(grid,element('p','Le rappel de préchauffage concerne le four, avec durée et température indiquées, sans repos renseigné et sans préchauffage déjà présent dans les étapes.'));
 const method=element('fieldset');method.className='recipe-steps-editor';method.append(element('legend','Étapes de préparation'));
 method.append(element('p','Une étape par champ. Ajoute, déplace ou retire les étapes pour préciser l’ordre de préparation.'));
 const list=element('div');list.id='recipe-step-fields';method.append(list);
 const add=element('button','+ Ajouter une étape');add.type='button';add.className='secondary';method.append(add);root.append(timings,method);
 const raw=()=>[...list.querySelectorAll('textarea')].map(input=>input.value);
 const steps=()=>raw().map(text=>text.trim()).filter(Boolean);
 const sync=()=>{form.elements.instructions.value=steps().join('\n');};
 function render(values){
  list.replaceChildren();
  const current=values.length?values:[''];
  for(const [index,value] of current.entries()){
   const row=element('div');row.className='recipe-step-field';const label=element('label','Étape '+(index+1)),input=element('textarea');
   input.rows=2;input.maxLength=20000;input.value=value;input.placeholder='Décrire cette étape…';input.setAttribute('aria-label','Étape '+(index+1));input.addEventListener('input',sync);label.append(input);row.append(label);
   const actions=element('div');actions.className='recipe-step-actions';
   for(const [name,text,delta] of [['Monter','↑',-1],['Descendre','↓',1],['Supprimer','×',0]]){
    const button=element('button',text);button.type='button';button.className='secondary';button.setAttribute('aria-label',name+' l’étape '+(index+1));
    button.disabled=delta===-1&&index===0||delta===1&&index===current.length-1;
    button.addEventListener('click',()=>{const next=raw();if(delta)[next[index],next[index+delta]]=[next[index+delta],next[index]];else next.splice(index,1);render(next);});actions.append(button);
   }row.append(actions);list.append(row);
  }sync();
 }
 add.addEventListener('click',()=>{render([...raw(),'']);list.querySelector('div:last-child textarea')?.focus();});
 function load(recipe={}){
  const cooking={...cookingFromText(recipe.instructions??''),...(recipe.cooking??{})};
  for(const [key,input] of Object.entries(fields))input.value=cooking[key]??'';
  render(recipe.steps??instructionSteps(recipe.instructions));
 }
 const cooking=()=>Object.fromEntries(Object.entries(fields).map(([key,input])=>[key,input.value===''?null:['method','difficulty'].includes(key)?input.value:Number(input.value)]));
 load();return {load,steps,cooking};
}
