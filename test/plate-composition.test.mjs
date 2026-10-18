import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {coordinateCountedPlate,plateComposition} from '../web/plate-composition.js';
import {suggestPlatePortions} from '../web/portion-planner.js';
import {handleRequest} from '../src/server/app.mjs';
import * as planner from '../web/portion-planner.js';

const shares={main:0.25,starch:0.25,vegetables:0.5};
const parent={id:'parent',name:'Synthetic soup, eggs and bread',servingParts:[{servingPart:'main'},{servingPart:'starch'},{servingPart:'vegetables'}]};
const recipes=['main','starch','vegetables'].map(part=>({id:part,parentRecipeId:parent.id,servingPart:part,yield:{unitId:'g'}}));
const members=()=>['main','starch','vegetables'].map((part,i)=>({servingPart:part,countStep:[50,44.75,null][i],
  recipeKcal:[1.4,2.11,0.285][i],proteinG:[0.12,0.08,0.01][i],maxQuantity:[100,Infinity,462][i]}));
function mealItems(quantities=[100,89.5,200]){return recipes.map((recipe,i)=>({recipe,amounts:[{personId:'a',quantity:quantities[i]},{personId:'b',quantity:quantities[i]/2}]}));}

test('nearby whole eggs and slices are coordinated with soup grams to improve weight proportions',()=>{
  const result=coordinateCountedPlate(members(),shares,400,455);
  assert.deepEqual(result.quantities,[100,89.5,189.5]);assert.ok(result.kcal<=455);
  const old=[100,89.5,200],total=old.reduce((a,b)=>a+b,0);
  const oldError=members().reduce((sum,row,i)=>sum+Math.abs(old[i]/total-shares[row.servingPart]),0);
  assert.ok(result.deviation<oldError);assert.equal(result.quantities[2]/result.quantities.reduce((a,b)=>a+b,0),0.5);
  assert.equal(result.quantities[0]/50,2);assert.equal(result.quantities[1]/44.75,2);
  assert.deepEqual(coordinateCountedPlate(members(),shares,400,250).quantities,[50,44.75,94.75]);
});

test('custom weight shares, service ceilings and small budgets stay binding during coordinated rounding',()=>{
  for(const [ratios,budget] of [[shares,455],[{main:0.3,starch:0.2,vegetables:0.5},455],[shares,200]]){
    const rows=members(),result=coordinateCountedPlate(rows,ratios,400,budget);assert.ok(result);
    assert.ok(result.kcal<=budget+1e-8);
    rows.forEach((row,i)=>{assert.ok(result.quantities[i]<=row.maxQuantity);if(row.countStep)assert.ok(Math.abs(result.quantities[i]/row.countStep-Math.round(result.quantities[i]/row.countStep))<1e-8);});
  }
  assert.equal(coordinateCountedPlate(members(),shares,400,10),null);
  assert.equal(coordinateCountedPlate(members(),shares,0,455),null);
});

test('fixed drinks keep their quantity and calories when the linked plate rounds to whole counts',()=>{
  const rows=members().map(row=>({...row,parentRecipeId:'parent',plateParts:['main','starch','vegetables'],recipeUnit:'g',
    role:row.servingPart==='main'?'main':'accompaniment',step:row.countStep??10,quantity:100,budgetFraction:row.servingPart==='main'?0.7:0.15}));
  rows.push({role:'beverage',quantity:1,step:1,recipeKcal:200,proteinG:5});
  const result=suggestPlatePortions(rows,455);
  assert.equal(result.proposals[3].quantity,1);assert.equal(result.withinBudget,true);
  assert.equal(result.estimatedKcal,result.proposals.reduce((sum,row)=>sum+(row.quantity??0)*row.recipeKcal,0));
  assert.equal(result.approximateProportions,true);assert.ok(result.proposals.slice(0,3).every(row=>row.quantity>0));
  assert.ok(result.warnings.some(message=>message.includes('écarts réels')));
});

test('composition uses canonical gram weights and reports real percentages, targets and percentage-point deviations per person',()=>{
  const [report]=plateComposition(mealItems(),'a',[parent]);
  assert.equal(report.complete,true);assert.equal(report.total,389.5);assert.equal(report.exact,false);
  assert.ok(Math.abs(report.parts[0].percent-100/389.5*100)<1e-9);
  assert.equal(report.parts[0].targetPercent,25);assert.equal(report.parts[2].targetPercent,50);
  assert.ok(Math.abs(report.parts[1].deltaPoints-(89.5/389.5*100-25))<1e-9);
  assert.equal(plateComposition(mealItems(),'b',[parent])[0].total,194.75);
  const ratios={whole:{main:1},separate:{main:0.66,starch:0.34},three:{main:0.3,starch:0.2,vegetables:0.5}};
  assert.equal(plateComposition(mealItems(),'a',[parent],ratios)[0].parts[0].targetPercent,30);
});

test('missing, repeated or empty services are explicit, and ordinary gram plates still report exact ratios',()=>{
  for(const items of [mealItems().slice(0,2),[...mealItems(),mealItems()[0]],mealItems([100,null,200])])assert.equal(plateComposition(items,'a',[parent])[0].complete,false);
  assert.equal(plateComposition(mealItems([100,100,200]),'a',[parent])[0].exact,true);
  assert.deepEqual(plateComposition([{recipe:{id:'standalone',yield:{unitId:'g'}},amounts:[]}],'a',[parent]),[]);
});

test('the actual meal editor renders the composition and deviations visibly, outside collapsed calculation details',async()=>{
  const source=await readFile(new URL('../web/app.js',import.meta.url),'utf8'),a=source.indexOf('function appendPlateComposition('),b=source.indexOf('function allPlanningRecipes(',a);
  const element=tag=>({tag,children:[],append(...nodes){this.children.push(...nodes);}});
  const context={plateComposition,state:{recipes:[parent]},document:{createElement:element},formatQty:value=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(value)};
  runInNewContext(source.slice(a,b)+'\nglobalThis.render=appendPlateComposition;',context);
  const root=element('div');context.render(root,{items:mealItems()},'a');
  const all=node=>[node,...node.children.flatMap(all)],nodes=all(root),texts=nodes.map(node=>node.textContent??'').join(' ');
  assert.ok(nodes.every(node=>node.tag!=='details'));assert.match(texts,/Répartition réelle en poids/);
  assert.match(texts,/Protéines : 25,67 % \(100 g\) · repère 25 % · écart \+0,67/);
  assert.match(texts,/Féculents : 22,98 %.*repère 25 %.*écart -2,02/);
});

test('the shared composition module is served as JavaScript to the browser',async()=>{
  const response={status:200,headers:{},setHeader(k,v){this.headers[k]=v;},writeHead(status){this.status=status;},end(body){this.body=String(body);}};
  await handleRequest({method:'GET',url:'/plate-composition.js',headers:{}},response,{});
  assert.equal(response.status,200);assert.match(response.headers['Content-Type'],/^text\/javascript/);assert.match(response.body,/export function plateComposition/);
});

test('the actual recalculation uses each profile budget, natural counts, weight ratios and existing serving caps together',async()=>{
  const source=await readFile(new URL('../web/app.js',import.meta.url),'utf8'),a=source.indexOf('function applyAutomaticPortions('),b=source.indexOf('function mealProteinSummary(',a);
  const sourceRecipe={...parent,yield:{amount:4,unitId:'portion'}};
  const parts=members().map((row,i)=>({...recipes[i],yield:{amount:[400,358,1800][i],unitId:'g'},
    ...(row.countStep?{servingDisplay:{unitId:i===0?'piece':'slice',gramsPerUnit:row.countStep}}:{}),
    nutrition:{complete:true,perYieldUnit:{energyKcal:row.recipeKcal,proteinG:row.proteinG}}}));
  sourceRecipe.servingParts=parts;
  const people=[1000,1600,2200,3000].map((energy,i)=>({id:String(i),displayName:'Synthetic '+i,energy}));
  const items=Object.fromEntries(parts.map((part,i)=>[i,{recipeId:part.id,role:i?'accompaniment':'main'}]));
  const root={replaceChildren(){}};
  const context={...planner,state:{recipes:[sourceRecipe],people,calendarMeals:[]},
    $:selector=>selector==='#meal-form'?{elements:{mealDate:{value:'2026-10-20'},slot:{value:'dinner'}}}:root,
    allPlanningRecipes:()=>[sourceRecipe,...parts],isIndividualRole:()=>false,latestProfile:person=>({dailyEnergyKcal:person.energy}),
    plannedCaloriesForPerson:()=>0,document:{createElement:()=>({append(){}})}};
  runInNewContext(source.slice(a,b)+'\nglobalThis.calculate=applyAutomaticPortions;',context);context.calculate(items,people.map(p=>p.id));
  for(const person of people){
    const amounts=parts.map((part,i)=>Number(items[i].amounts[person.id]));
    assert.equal(amounts[0]%50,0);assert.equal(amounts[1]%44.75,0);
    assert.ok(amounts[0]<=100);assert.ok(amounts[2]<=450);
    assert.ok(amounts.reduce((sum,q,i)=>sum+q*parts[i].nutrition.perYieldUnit.energyKcal,0)<=person.energy*0.25+100+1e-8);
    assert.ok(Math.abs(amounts[2]/amounts.reduce((sum,q)=>sum+q,0)-0.5)<1e-6);
  }
  assert.notEqual(items[0].amounts['0'],items[0].amounts['3']);
});
