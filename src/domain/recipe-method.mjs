export const cookingMethods={none:'Sans cuisson',oven:'Four',hob:'Plaque / poêle',air_fryer:'Air fryer',microwave:'Micro-ondes',steam:'Vapeur',other:'Autre'};
export const difficultyLabels={easy:'Facile',intermediate:'Intermédiaire',hard:'Difficile'};
export const cookingKeys=['prepMinutes','restMinutes','cookMinutes','temperatureC','method','difficulty'];

export function instructionSteps(instructions='') {
 const lines=String(instructions??'').replace(/\r/g,'').split(/\n+/).map(line=>line.replace(/^\s*(?:(?:étape\s+)?\d+[.)°:]\s+|[-•]\s+)/i,'').trim()).filter(Boolean);
 // Keep all legacy text even when it contains unusually many short lines.
 return lines.length<=300?lines:[...lines.slice(0,299),lines.slice(299).join('\n')];
}
export function validateMethod(input) {
 if(input.steps!==undefined&&(!Array.isArray(input.steps)||input.steps.length>300||input.steps.some(s=>typeof s!=='string'||!s.trim())||input.steps.join('\n').length>20000))return {error:'invalid-recipe-steps'};
 const steps=input.steps?.map(s=>s.trim())??instructionSteps(input.instructions);
 const result={steps,instructions:input.steps===undefined?String(input.instructions??'').slice(0,20000):steps.join('\n')};
 if(input.cooking===undefined)return {data:result};
 if(!input.cooking||typeof input.cooking!=='object'||Array.isArray(input.cooking))return {error:'invalid-cooking-details'};
 const cooking={};
 for(const key of ['prepMinutes','restMinutes','cookMinutes','temperatureC']){
  const value=input.cooking[key]??null;
  if(value!==null&&(!Number.isInteger(value)||value<0||value>(key==='temperatureC'?500:43200)))return {error:'invalid-cooking-details'};
  cooking[key]=value;
 }
 for(const [key,choices] of [['method',cookingMethods],['difficulty',difficultyLabels]]){
  const value=input.cooking[key]??null;if(value!==null&&!Object.hasOwn(choices,value))return {error:'invalid-cooking-details'};cooking[key]=value;
 }
 return {data:{...result,cooking}};
}
export function preheatReminder(recipe) {
 const cooking=recipe.cooking??{},steps=recipe.steps??instructionSteps(recipe.instructions);
 const mentionsRest=steps.some(step=>/\b(?:repos(?:er)?|pause|lev[ée]e|laisser\s+lever|mariner|fermenter)\b/i.test(step.replace(/(?:sans|pas de)\s+(?:repos|pause)/ig,'')));
 return cooking.method==='oven'&&cooking.cookMinutes>0&&cooking.temperatureC>0&&!(cooking.restMinutes>0)&&!mentionsRest&&!steps.some(step=>/pr[ée]chauff/i.test(step))
  ?`Préchauffer le four à ${cooking.temperatureC} °C avant de commencer.`:null;
}
export function durationMinutes(value) {
 if(typeof value==='number')return Number.isInteger(value)&&value>=0&&value<=43200?value:null;
 if(typeof value!=='string')return null;
 const iso=value.trim().match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/i);
 if(iso&&iso.slice(1).some(Boolean))return durationMinutes(Number(iso[1]??0)*1440+Number(iso[2]??0)*60+Number(iso[3]??0));
 const time=value.trim().match(/^(?:(\d+)\s*h(?:eures?)?\s*)?(?:(\d+)\s*(?:min(?:utes?)?)?)?$/i);
 return time&&time.slice(1).some(Boolean)?durationMinutes(Number(time[1]??0)*60+Number(time[2]??0)):null;
}
export function cookingFromText(text) {
 const cooking={};
 for(const [key,label] of [['prepMinutes','pr[ée]paration'],['restMinutes','repos|pause|lev[ée]e'],['cookMinutes','cuisson']]){
  const duration='((?:\\d+[ \\t]*h(?:eures?)?)(?:[ \\t]*\\d+[ \\t]*(?:min(?:utes?)?)?)?|\\d+[ \\t]*min(?:utes?)?)';
  const found=text.match(new RegExp('(?:temps (?:de |d[’\u0027])?)?(?:'+label+')[ \\t]*[:：][ \\t]*'+duration,'i'));
  if(found){const value=durationMinutes(found[1]);if(value!==null)cooking[key]=value;}
 }
 const oven=text.match(/\bfour\b[^\n.!?]{0,80}?\b(\d{2,3})\s*°\s*(?:C\b|(?![A-Za-z]))/i);
 if(oven&&Number(oven[1])<=500){cooking.method='oven';cooking.temperatureC=Number(oven[1]);}
 const difficulty=text.match(/(?:difficult[ée]|niveau)\s*:\s*(facile|interm[ée]diaire|difficile)/i);
 if(difficulty)cooking.difficulty=/^facile/i.test(difficulty[1])?'easy':/^difficile/i.test(difficulty[1])?'hard':'intermediate';
 return cooking;
}
