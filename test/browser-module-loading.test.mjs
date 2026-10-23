import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from '../src/server/app.mjs';

test('all browser entry points and their local module dependencies load as JavaScript before login',async()=>{
  const pool={query(){throw new Error('Static modules must not require database access');}};
  async function get(url){
    const response={headers:{},setHeader(name,value){this.headers[name]=value;},writeHead(code){this.code=code;},end(body){this.body=String(body);}};
    await handleRequest({method:'GET',url,headers:{}},response,pool,'synthetic-password');
    assert.equal(response.code,200,`${url} must load before the application can initialize`);
    return response;
  }
  const html=await get('/');
  const queue=[...html.body.matchAll(/<script\b[^>]*type="module"[^>]*src="([^"]+)"/g)].map(match=>new URL(match[1],'http://local.test/'));
  assert.ok(queue.length,'The HTML must expose the browser entry points');
  const visited=new Set();
  while(queue.length){
    const url=queue.shift();if(visited.has(url.pathname))continue;visited.add(url.pathname);
    const response=await get(url.pathname+url.search);
    assert.match(response.headers['Content-Type'],/^(?:text|application)\/javascript\b/,`${url.pathname} must have a module-compatible MIME type`);
    const imports=[...response.body.matchAll(/^\s*(?:import|export)\s+(?:[^'";\n]*?\s+from\s*)?['"](\.[^'"]+)['"]/gm),
      ...response.body.matchAll(/\bimport\(\s*['"](\.[^'"]+)['"]\s*\)/g)];
    for(const match of imports)queue.push(new URL(match[1],url));
  }
});
