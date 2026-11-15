// A group replaces one existing ingredient line. Options always reference the catalogue.
export function checkChoiceGroups(input,validateRecipeInput){
 const groups=input.choiceGroups;
 if(!Array.isArray(groups)||groups.length>12||!Array.isArray(input.lines))return {error:'invalid-recipe-choices'};
 const used=new Set(),ids=new Set(),normalized=[];let count=0;
 for(const group of groups){
  if(!group||typeof group.id!=='string'||!/^[a-zA-Z0-9_-]{1,60}$/.test(group.id)||ids.has(group.id)||!Number.isInteger(group.lineIndex)||group.lineIndex<0||group.lineIndex>=input.lines?.length||used.has(group.lineIndex)||!input.lines[group.lineIndex]||input.lines[group.lineIndex].recipeId||typeof group.label!=='string'||!group.label.trim()||group.label.length>100||!Array.isArray(group.options)||!group.options.length||group.options.length>50)return {error:'invalid-recipe-choices'};
  if(group.listId!=null&&(typeof group.listId!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(group.listId)))return {error:'invalid-choice-list'};
  used.add(group.lineIndex);ids.add(group.id);const foodIds=new Set(),options=[];
  for(const option of group.options){
   if(++count>200||!option?.foodId||foodIds.has(option.foodId)||option.recipeId)return {error:'invalid-choice-option'};
   foodIds.add(option.foodId);
   const line={...option,...(option.foodId===input.lines[group.lineIndex].foodId?input.lines[group.lineIndex]:{}),recipeId:null,servingPart:input.lines[group.lineIndex].servingPart??'main'};
   const checked=validateRecipeInput({...input,choiceGroups:undefined,lines:input.lines.map((original,index)=>index===group.lineIndex?line:original)});
   if(checked.error)return checked;
   const safe=checked.data.lines[group.lineIndex];options.push({...safe,foodName:typeof option.foodName==='string'?option.foodName.slice(0,200):''});
  }
  if(!foodIds.has(input.lines[group.lineIndex].foodId))return {error:'choice-default-missing'};
  normalized.push({id:group.id,label:group.label.trim(),listId:group.listId??null,lineIndex:group.lineIndex,allowNone:group.allowNone===true,options});
 }
 const checked=validateRecipeInput({...input,choiceGroups:undefined});
 if(checked.error)return checked;
 checked.data.choiceGroups=normalized;return checked;
}

export function selectedRecipeLines(recipe,selection){
 if(!selection||typeof selection!=='object'||Array.isArray(selection))return {error:'invalid-choice-selection'};
 const groups=recipe.choiceGroups??[];
 if(Object.keys(selection).length!==groups.length||Object.keys(selection).some(id=>!groups.some(g=>g.id===id)))return {error:'choice-selection-required'};
 const lines=recipe.lines.map(line=>({...line})),labels=[];
 for(const group of groups){
  const foodId=selection[group.id];
  if(foodId===null&&group.allowNone){lines[group.lineIndex]=null;labels.push(`${group.label} : sans`);continue;}
  const option=group.options.find(o=>o.foodId===foodId);
  if(!option)return {error:'invalid-choice-selection'};
  lines[group.lineIndex]={...option,servingPart:lines[group.lineIndex].servingPart};labels.push(`${group.label} : ${option.foodName||'ingrédient choisi'}`);
 }
 return {lines:lines.filter(Boolean),labels};
}
