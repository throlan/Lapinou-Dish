import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeInstallation} from '../web/install-app.js';
import {handleRequest} from '../src/server/app.mjs';

function fixture({standalone=false,ios=false,secure=true}={}) {
  class Control extends EventTarget {
    classes=new Set(); textContent=''; open=false; disabled=false;
    classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)};
    closest(){return this.menu??null;}
    showModal(){this.open=true;}
    close(){this.open=false;}
    click(){this.dispatchEvent(new Event('click'));}
  }
  const triggers=[new Control(),new Control()],elements=new Map();
  for(const id of ['install-app-dialog','install-app-native','install-app-message','close-install-app','install-app-secure-hint'])elements.set('#'+id,new Control());
  const mode=new EventTarget();mode.matches=standalone;
  const win=new EventTarget();win.matchMedia=()=>mode;win.navigator={standalone:ios};win.isSecureContext=secure;
  const doc={querySelector:s=>elements.get(s),querySelectorAll:()=>triggers};
  initializeInstallation(win,doc);
  return {win,mode,triggers,get:id=>elements.get('#'+id)};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('installation help remains usable without native browser support, and closes the mobile menu',()=>{
  const f=fixture();f.triggers[1].menu={open:true};f.triggers[1].click();
  assert.equal(f.triggers[1].menu.open,false);assert.equal(f.get('install-app-dialog').open,true);
  assert.ok(f.get('install-app-native').classes.has('hidden'));
  f.get('close-install-app').click();assert.equal(f.get('install-app-dialog').open,false);
});

test('a native prompt is consumed once, cancellation is honest and a later prompt can be used',async()=>{
  const f=fixture();let calls=0,prevented=false;
  const prompt=new Event('beforeinstallprompt',{cancelable:true});prompt.prompt=async()=>{calls++;};prompt.userChoice=Promise.resolve({outcome:'dismissed'});
  f.win.dispatchEvent(prompt);prevented=prompt.defaultPrevented;assert.equal(prevented,true);
  assert.equal(f.get('install-app-native').classes.has('hidden'),false);
  f.get('install-app-native').click();f.get('install-app-native').click();await tick();assert.equal(calls,1);
  assert.match(f.get('install-app-message').textContent,/annulée/);assert.equal(f.triggers[0].classes.has('hidden'),false);
  const second=new Event('beforeinstallprompt',{cancelable:true});second.prompt=async()=>{calls++;};second.userChoice=Promise.resolve({outcome:'accepted'});
  f.win.dispatchEvent(second);f.get('install-app-native').click();await tick();assert.equal(calls,2);
  assert.match(f.get('install-app-message').textContent,/Demande transmise/);
  assert.equal(f.triggers[0].classes.has('hidden'),false,'Acceptance alone is not proof of completed installation');
  f.win.dispatchEvent(new Event('appinstalled'));assert.ok(f.triggers.every(t=>t.classes.has('hidden')));
});

test('prompt failures restore the guide without claiming installation or blocking the site',async()=>{
  const f=fixture(),prompt=new Event('beforeinstallprompt',{cancelable:true});
  prompt.prompt=async()=>{throw new Error('Synthetic browser failure');};
  f.win.dispatchEvent(prompt);f.get('install-app-native').click();await tick();
  assert.match(f.get('install-app-message').textContent,/instructions/);assert.equal(f.get('install-app-native').disabled,false);
  assert.equal(f.triggers[0].classes.has('hidden'),false);
});

test('standalone, iOS standalone and display-mode changes hide installation controls',()=>{
  for(const config of [{standalone:true},{ios:true}])assert.ok(fixture(config).triggers.every(t=>t.classes.has('hidden')));
  const f=fixture();f.triggers[0].click();f.mode.matches=true;f.mode.dispatchEvent(new Event('change'));
  assert.ok(f.triggers.every(t=>t.classes.has('hidden')));assert.equal(f.get('install-app-dialog').open,false);
});

test('an insecure origin provides HTTPS guidance instead of a native install action',()=>{
  const f=fixture({secure:false});assert.equal(f.get('install-app-secure-hint').classes.has('hidden'),false);
  const prompt=new Event('beforeinstallprompt',{cancelable:true});f.win.dispatchEvent(prompt);
  assert.equal(f.get('install-app-native').classes.has('hidden'),true);
});

test('the public manifest and every linked icon load before login with correct MIME, dimensions and stable scope',async()=>{
  async function get(url){const res={headers:{},setHeader(k,v){this.headers[k]=v;},writeHead(code){this.code=code;},end(body){this.body=body;}};
    await handleRequest({method:'GET',url,headers:{}},res,{},'synthetic-password');return res;}
  const html=(await get('/')).body.toString(),href=html.match(/rel="manifest" href="([^"]+)"/)?.[1];assert.ok(href);
  const response=await get(href);assert.equal(response.code,200);assert.match(response.headers['Content-Type'],/^application\/manifest\+json/);
  const manifest=JSON.parse(response.body);assert.equal(manifest.id,'/');assert.equal(manifest.start_url,'/');assert.equal(manifest.scope,'/');assert.equal(manifest.display,'standalone');assert.equal(manifest.prefer_related_applications,false);
  for(const icon of [...manifest.icons,{src:'/icons/apple-touch-icon.png',sizes:'180x180'},{src:'/icons/favicon-32.png',sizes:'32x32'}]){
    const r=await get(icon.src);assert.equal(r.code,200);assert.equal(r.headers['Content-Type'],'image/png');
    assert.equal(r.body.subarray(1,4).toString(),'PNG');assert.equal(r.body.readUInt32BE(16),Number(icon.sizes.split('x')[0]));assert.equal(r.body.readUInt32BE(20),Number(icon.sizes.split('x')[1]));
  }
  const module=await get('/install-app.js?v=synthetic');assert.equal(module.code,200);assert.match(module.headers['Content-Type'],/^text\/javascript/);
  assert.match(module.headers['Cache-Control'],/no-store/);
});
