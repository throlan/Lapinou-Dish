import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {handleRequest} from '../src/server/app.mjs';

test('the stylesheet referenced by the page is served as CSS before login, including cache query strings',async()=>{
  const html=await readFile(new URL('../web/index.html',import.meta.url),'utf8');
  const href=html.match(/href="(\/editorial\.css\?[^"\s]+)"/)?.[1];
  assert.ok(href,'The editorial stylesheet must be included in the document');
  const response={headers:{},setHeader(name,value){this.headers[name]=value;},writeHead(code){this.code=code;},end(body){this.body=String(body);}};
  await handleRequest({method:'GET',url:href,headers:{}},response,{},'synthetic-login-password');
  assert.equal(response.code,200);
  assert.match(response.headers['Content-Type'],/^text\/css/);
  assert.equal(response.body,await readFile(new URL('../web/editorial.css',import.meta.url),'utf8'));
});
