import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {handleRequest} from '../src/server/app.mjs';

async function request(pool,url,body=null,method='GET'){
  const response={status:200,setHeader(){},writeHead(status){this.status=status;},end(value){this.body=JSON.parse(value);}};
  await handleRequest({method,url,headers:{},async *[Symbol.asyncIterator](){if(body)yield Buffer.from(JSON.stringify(body));}},response,pool);
  return response;
}

test('cooking review exclusions persist per household without changing foods',async()=>{
  const db=new PGlite();
  try{
    const directory=new URL('../db/migrations/',import.meta.url);
    for(const file of (await readdir(directory)).filter(name=>name.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,directory),'utf8'));
    const pool={async query(sql,args=[]){const result=await db.query(sql,args);return {...result,rowCount:result.rows.length||result.affectedRows||0};},async connect(){return {...this,release(){}};}};
    const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',food='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    await pool.query("INSERT INTO households(id,name) VALUES($1,'A'),($2,'B')",[a,b]);
    await pool.query("INSERT INTO foods(id,canonical_name,source,cooking_factor) VALUES($1,'Herbes','manual',1)",[food]);
    const exclusions={categories:['Épices'],foodIds:[food]};
    const saved=await request(pool,'/api/foods/catalogue-review-exclusions',{householdId:a,exclusions},'PUT');
    assert.equal(saved.status,200);assert.deepEqual(saved.body.exclusions,exclusions);
    const readA=await request(pool,`/api/foods/catalogue-review-exclusions?householdId=${a}`);
    const readB=await request(pool,`/api/foods/catalogue-review-exclusions?householdId=${b}`);
    assert.deepEqual(readA.body.exclusions,exclusions);assert.deepEqual(readB.body.exclusions,{categories:[],foodIds:[]});
    assert.equal(Number((await pool.query('SELECT cooking_factor FROM foods WHERE id=$1',[food])).rows[0].cooking_factor),1);
    const invalid=await request(pool,'/api/foods/catalogue-review-exclusions',{householdId:a,exclusions:{categories:['Épices','Épices'],foodIds:[]}},'PUT');
    assert.equal(invalid.status,400);assert.deepEqual((await request(pool,`/api/foods/catalogue-review-exclusions?householdId=${a}`)).body.exclusions,exclusions);
  }finally{await db.close();}
});
