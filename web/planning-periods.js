const datePattern=/^\d{4}-\d{2}-\d{2}$/;
export function validPlanningDate(value){if(typeof value!=='string'||!datePattern.test(value))return false;const d=new Date(value+'T12:00:00Z');return !Number.isNaN(+d)&&d.toISOString().slice(0,10)===value;}
export function shiftPlanningDate(value,days){const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function cookingPeriod(value,scope){
 if(!validPlanningDate(value))throw new Error('invalid-planning-date');
 const date=new Date(value+'T12:00:00Z'),monday=shiftPlanningDate(value,-((date.getUTCDay()+6)%7));
 if(scope==='meal')return {start:value,end:value};
 if(scope==='week')return {start:monday,end:shiftPlanningDate(monday,6)};
 if(scope==='fortnight')return {start:monday,end:shiftPlanningDate(monday,13)};
 if(scope==='month'){const first=value.slice(0,7)+'-01',last=new Date(date);last.setUTCMonth(date.getUTCMonth()+1,0);return {start:first,end:last.toISOString().slice(0,10)};}
 throw new Error('invalid-cooking-scope');
}
export function freePlanningSlots(start,end,occupied,moments=[]){
 if(!validPlanningDate(start)||!validPlanningDate(end)||end<start||(+new Date(end)-+new Date(start))/86400000>62)throw new Error('invalid-planning-period');
 const used=new Set(occupied.map(m=>m.date+':'+m.slot));const slots=['breakfast','lunch','snack','dinner'].filter(s=>!moments.length||moments.includes(s));const result=[];
 for(let date=start;date<=end;date=shiftPlanningDate(date,1)){for(const slot of slots)if(!used.has(date+':'+slot))result.push({date,slot});if(date===end)break;}
 return result;
}
