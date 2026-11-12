import {instructionSteps,cookingFromText,preheatReminder,cookingMethods,difficultyLabels} from './recipe-method.js';

export function renderCookingMethod(recipe,{imageFactory,getRating,document:doc=document}={}){
 const element=(tag,text,className)=>{const node=doc.createElement(tag);if(text)node.textContent=text;if(className)node.className=className;return node;};
 const photo=doc.querySelector('#cook-photo');photo.replaceChildren(imageFactory(recipe));
 const meta=doc.querySelector('#cook-meta');meta.replaceChildren();const cooking={...cookingFromText(recipe.instructions??''),...(recipe.cooking??{})};
 const duration=value=>value>=60?`${Math.floor(value/60)} h${value%60?' '+String(value%60).padStart(2,'0'):''}`:`${value} min`;
 for(const [key,label] of [['prepMinutes','Préparation'],['restMinutes','Repos'],['cookMinutes','Cuisson']])if(cooking[key]!=null)meta.append(element('span',label+' · '+duration(cooking[key]),'cook-fact'));
 if(cooking.method)meta.append(element('span',(cookingMethods[cooking.method]??'Cuisson')+(cooking.temperatureC!=null?' · '+cooking.temperatureC+' °C':''),'cook-fact'));
 else if(cooking.temperatureC!=null)meta.append(element('span',cooking.temperatureC+' °C','cook-fact'));
 if(cooking.difficulty)meta.append(element('span',difficultyLabels[cooking.difficulty],'cook-fact cook-difficulty'));
 if(recipe.ratingEnabled!==false)meta.append(getRating()??element('span','☆ Pas encore notée','cook-fact'));
 const root=doc.querySelector('#cook-instructions');root.replaceChildren();
 const reminder=preheatReminder({...recipe,cooking});if(reminder)root.append(element('aside',reminder,'cook-preheat'));
 const steps=recipe.steps??instructionSteps(recipe.instructions);
 if(!steps.length){root.append(element('p','Aucune instruction renseignée dans la recette.'));return;}
 const list=element('ol',null,'cook-steps');
 for(const text of steps){const item=element('li');item.append(element('p',text));list.append(item);}root.append(list);
}
