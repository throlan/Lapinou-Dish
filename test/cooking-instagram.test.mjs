import test from 'node:test';
import assert from 'node:assert/strict';
import {cookingInstagramSource,mountCookingInstagram} from '../web/cooking-instagram.js';
import {handleRequest} from '../src/server/app.mjs';

test('only exact HTTPS Instagram publication URLs produce a canonical embed without tracking parameters',()=>{
  for(const kind of ['p','reel','tv']){
    assert.deepEqual(cookingInstagramSource(`https://instagram.com/${kind}/Example_12-/?igsh=tracking#fragment`),{
      postUrl:`https://www.instagram.com/${kind}/Example_12-/`,embedUrl:`https://www.instagram.com/${kind}/Example_12-/embed/`});
  }
  for(const value of [null,'','broken','http://instagram.com/reel/Example/','javascript:alert(1)','https://instagram.com.evil.test/p/Example/',
    'https://instagram.com@evil.test/p/Example/','https://user:password@instagram.com/p/Example/','https://www.instagram.com:444/p/Example/',
    'https://example.com/reel/Example/','https://www.instagram.com/profile/','https://www.instagram.com/stories/person/123/',
    'https://www.instagram.com/reel/Example/embed/','https://www.instagram.com/p/%3Cscript%3E/'])assert.equal(cookingInstagramSource(value),null,value);
});

function ui(){
  const doc={createElement(tag){return new Element(tag);}};
  class Element extends EventTarget {
    constructor(tag){super();this.tagName=tag;this.children=[];this.attributes={};this.textContent='';}
    append(...children){this.children.push(...children);}
    replaceChildren(...children){this.children=children;}
    setAttribute(name,value){this.attributes[name]=value;}
    click(){this.dispatchEvent(new Event('click'));}
  }
  return {doc,container:new Element('section')};
}

test('the cooking publication stays unloaded until clicked, keeps its fallback link and stops on hide/cleanup',()=>{
  const {doc,container}=ui(),stop=mountCookingInstagram(container,'https://www.instagram.com/reel/Synthetic123/?igsh=tracking',doc);
  const button=container.children.find(e=>e.tagName==='button'),host=container.children.find(e=>e.tagName==='div'),link=container.children.find(e=>e.tagName==='a');
  assert.equal(container.hidden,false);assert.equal(button.type,'button','Must not submit production');assert.equal(host.children.length,0);
  assert.equal(link.href,'https://www.instagram.com/reel/Synthetic123/');assert.equal(link.rel,'noopener noreferrer');
  button.click();const first=host.children[0];assert.equal(first.tagName,'iframe');assert.equal(first.src,'https://www.instagram.com/reel/Synthetic123/embed/');
  assert.equal(first.referrerPolicy,'no-referrer');assert.equal(first.allowFullscreen,true);assert.match(first.title,/recette/);
  assert.doesNotMatch(first.attributes.sandbox,/allow-top-navigation/);assert.doesNotMatch(first.allow,/autoplay/);
  assert.equal(button.attributes['aria-expanded'],'true');button.click();assert.equal(first.src,'about:blank');assert.equal(host.children.length,0);
  button.click();const second=host.children[0];stop();assert.equal(second.src,'about:blank');assert.equal(host.children.length,0);
  assert.equal(button.attributes['aria-expanded'],'false');assert.equal(link.href,'https://www.instagram.com/reel/Synthetic123/','Fallback is never dependent on a successful embed');
});

test('recipes without a supported source show no player and clear the previous publication',()=>{
  const {doc,container}=ui();mountCookingInstagram(container,'https://www.instagram.com/p/Synthetic/',doc);
  const stop=mountCookingInstagram(container,'https://example.com/recipe',doc);assert.equal(container.hidden,true);assert.equal(container.children.length,0);stop();
});

test('the cooking Instagram browser module is served independently of login',async()=>{
  const response={headers:{},setHeader(k,v){this.headers[k]=v;},writeHead(code){this.code=code;},end(body){this.body=String(body);}};
  await handleRequest({method:'GET',url:'/cooking-instagram.js',headers:{}},response,{},'synthetic-password');
  assert.equal(response.code,200);assert.match(response.headers['Content-Type'],/^text\/javascript/);assert.match(response.body,/export function mountCookingInstagram/);
});
