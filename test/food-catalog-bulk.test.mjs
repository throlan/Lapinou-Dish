import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {deleteFoods} from '../src/server/foods.mjs';
import {handleRequest} from '../src/server/app.mjs';

const h='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
async function request(pool,body){
  const response={headers:{},setHeader(k,v){this.headers[k]=v;},writeHead(status){this.status=status;},end(body){this.body=JSON.parse(body);}};
  await handleRequest({method:'POST',url:'/api/foods/bulk-delete',headers:{},async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(body));}},response,pool);
  return response;
}

test('bulk food deletion previews usage, skips protected foods, and deletes only confirmed unused rows',async()=>{
  const db=new PGlite();
  try{
    const dir=new URL('../db/migrations/',import.meta.url);
    for(const file of (await readdir(dir)).filter(file=>file.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
    const pool={async query(sql,args=[]){const result=await db.query(sql,args);return{...result,rowCount:result.rows.length||result.affectedRows||0};},async connect(){return{...this,release(){}};}};
    await pool.query('INSERT INTO households(id,name) VALUES($1,\'Test\')',[h]);
    const ids={unused:randomUUID(),recipe:randomUUID(),stock:randomUUID(),source:randomUUID(),target:randomUUID(),yieldSource:randomUUID(),yieldTarget:randomUUID()};
    for(const [kind,id] of Object.entries(ids))await pool.query('INSERT INTO foods(id,canonical_name,source) VALUES($1,$2,\'manual\')',[id,kind]);
    const recipeId=randomUUID();await pool.query('INSERT INTO recipes(id,household_id,name,yield_amount,yield_unit_id) VALUES($1,$2,\'Test recipe\',1,\'portion\')',[recipeId,h]);
    await pool.query('INSERT INTO recipe_lines(id,recipe_id,food_id,quantity,unit_id) VALUES($1,$2,$3,100,\'g\')',[randomUUID(),recipeId,ids.recipe]);
    await pool.query('INSERT INTO household_ingredient_stock(household_id,food_id,quantity_g,minimum_g,target_g,lead_days) VALUES($1,$2,0,0,0,0)',[h,ids.stock]);
    await pool.query('INSERT INTO household_purchase_products(household_id,food_id,purchase_food_id,source_unit_id,target_unit_id,factor) VALUES($1,$2,$3,\'g\',\'g\',1)',[h,ids.source,ids.target]);
    await pool.query('INSERT INTO household_food_yield_conversions(id,household_id,source_food_id,target_food_id,factor) VALUES($1,$2,$3,$4,1.25)',[randomUUID(),h,ids.yieldSource,ids.yieldTarget]);
    const selected=[...Object.values(ids),randomUUID()];
    const preview=await request(pool,{foodIds:selected,dryRun:true});
    assert.equal(preview.status,200);assert.equal(preview.body.deletable.length,1);assert.equal(preview.body.deletable[0].id,ids.unused);
    assert.equal(preview.body.dueToUsage.length,6);assert.equal(preview.body.missingCount,1);
    assert.equal((await pool.query('SELECT count(*)::integer AS count FROM foods WHERE id=ANY($1::uuid[])',[Object.values(ids)])).rows[0].count,7,'preview never deletes');
    const deleted=await request(pool,{foodIds:selected});
    assert.equal(deleted.status,200);assert.deepEqual(deleted.body.deleted,[ids.unused]);assert.equal(deleted.body.dueToUsage.length,6);
    const remaining=(await pool.query('SELECT id FROM foods')).rows.map(row=>row.id);
    assert.equal(remaining.includes(ids.unused),false);for(const id of Object.values(ids).slice(1))assert.equal(remaining.includes(id),true);
    assert.equal((await request(pool,{foodIds:['invalid']})).status,400);
    assert.equal((await request(pool,{foodIds:Array.from({length:5001},()=>randomUUID())})).status,400);
  }finally{await db.close();}
});
