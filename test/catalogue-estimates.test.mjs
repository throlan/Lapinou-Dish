import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {estimatesForFood} from '../src/server/catalogue-estimates.mjs';
import {handleRequest} from '../src/server/app.mjs';
import {validateBulkFoodEdit} from '../src/server/foods.mjs';

async function request(pool,url,body=null,method='GET'){
  const response={status:200,headers:{},setHeader(key,value){this.headers[key]=value;},writeHead(status){this.status=status;},end(value){this.body=JSON.parse(value);}};
  await handleRequest({method,url,headers:{},async *[Symbol.asyncIterator](){if(body)yield Buffer.from(JSON.stringify(body));}},response,pool);
  return response;
}

test('catalogue estimates include all foods, the accepted chicken mean and editable existing values',async()=>{
  const db=new PGlite();
  try{
    const directory=new URL('../db/migrations/',import.meta.url);
    for(const file of (await readdir(directory)).filter(name=>name.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,directory),'utf8'));
    const pool={async query(sql,args=[]){const result=await db.query(sql,args);return {...result,rowCount:result.rows.length||result.affectedRows||0};},async connect(){return {...this,release(){}};}};
    const chicken='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',cheese='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',manual='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    await pool.query("INSERT INTO foods(id,canonical_name,source,source_reference,cooking_factor) VALUES($1,'Poulet, filet sans peau cru','ciqual','36017',1),($2,'Abondance','ciqual','12112',NULL),($3,'Whey isolate native, goût vanille','manual',NULL,NULL)",[chicken,cheese,manual]);
    const result=await request(pool,'/api/foods/catalogue-estimates');
    assert.equal(result.status,200);assert.ok(result.body.foods.length>=3);
    const proposed=result.body.foods.find(food=>food.id===chicken);
    assert.equal(Number(proposed.cookingFactor),1);assert.equal(proposed.estimates.cookingFactor.value,.75);
    assert.match(proposed.estimates.cookingFactor.method,/0,72.*0,77/);
    assert.equal(result.body.foods.find(food=>food.id===cheese).estimates.cookingFactor,undefined);
    assert.equal(result.body.foods.find(food=>food.id===manual).estimates.foodCategory.value,'Whey');
    const selected={field:'cookingFactor',sourceNote:'',overwrite:true,dryRun:true,changes:[{foodId:chicken,version:1,value:.75,sourceNote:'USDA, moyenne 0,72 et 0,77'}]};
    const preview=await request(pool,'/api/foods/bulk-edit',selected,'POST');
    assert.equal(preview.status,200);assert.equal(preview.body.preview[0].current,1);
    assert.equal(Number((await pool.query('SELECT cooking_factor FROM foods WHERE id=$1',[chicken])).rows[0].cooking_factor),1);
    const saved=await request(pool,'/api/foods/bulk-edit',{...selected,dryRun:false},'POST');
    assert.equal(saved.status,200);assert.equal(saved.body.applied,1);
    assert.equal(Number((await pool.query('SELECT cooking_factor FROM foods WHERE id=$1',[chicken])).rows[0].cooking_factor),.75);
  }finally{await db.close();}
});

test('family estimates are scoped to audited codes and keep unsuitable measures empty',()=>{
  const vegetables=estimatesForFood({name:'Courgette, crue',source:'ciqual',code:'20061',foodCategory:'Légumes'});
  const cheese=estimatesForFood({name:'Abondance',source:'ciqual',code:'12112',foodCategory:'Fromages'});
  assert.equal(cheese.cookingFactor,undefined);
  assert.equal(cheese.pinchGrams,undefined);
  assert.equal(vegetables.pinchGrams,undefined);
  assert.equal(estimatesForFood({name:'Aliment privé',source:'manual',code:null,foodCategory:null}).cookingFactor,undefined);
});

test('one reviewed batch can contain the full set of cooking estimates without an unbounded request',()=>{
  const changes=Array.from({length:500},(_,index)=>({foodId:`${index.toString(16).padStart(8,'0')}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,version:1,value:.75,sourceNote:'USDA, estimation vérifiée'}));
  const input={field:'cookingFactor',sourceNote:'',overwrite:true,dryRun:true,changes};
  assert.equal(validateBulkFoodEdit(input).data.changes.length,500);
  assert.equal(validateBulkFoodEdit({...input,changes:[...changes,{...changes[0],foodId:'ffffffff-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}]}).error,'invalid-bulk-edit');
});
