import {randomUUID,randomBytes,createHash,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {Readable} from 'node:stream';

const derive=promisify(scrypt);
const lifetime=7*86400;
const attempts=new Map();
export const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const sha=value=>createHash('sha256').update(value).digest('hex');
export function accountError(code,status=400){return Object.assign(new Error(code),{status});}
export function normalizeLogin(value){
 const login=String(value??'').trim().toLowerCase();
 if(!/^[a-z0-9][a-z0-9@._+-]{2,99}$/.test(login))throw accountError('invalid-login');
 return login;
}
export async function hashPassword(password){
 if(typeof password!=='string'||password.length<12||password.length>256)throw accountError('password-too-short');
 const salt=randomBytes(16).toString('hex');
 const hash=await derive(password,salt,64);
 return salt+':'+hash.toString('hex');
}
async function passwordMatches(password,stored){
 const [salt,encoded]=stored.split(':');
 const candidate=await derive(String(password??'').slice(0,256),salt,64);
 const expected=Buffer.from(encoded,'hex');
 return candidate.length===expected.length&&timingSafeEqual(candidate,expected);
}
function cookie(request,token){
 const secure=request.headers?.['x-forwarded-proto']==='https'||request.socket?.encrypted?'; Secure':'';
 return 'lapinou_account='+token+'; Path=/; Max-Age='+lifetime+'; HttpOnly; SameSite=Strict'+secure;
}
export function sendAccount(response,status,body){
 response.setHeader('Content-Type','application/json; charset=utf-8');
 response.setHeader('Cache-Control','no-store');
 response.setHeader('X-Content-Type-Options','nosniff');
 response.setHeader('X-Frame-Options','DENY');
 response.writeHead(status);response.end(JSON.stringify(body));
}
export async function jsonBody(request){
 let size=0;const chunks=[];
 for await(const chunk of request){const b=Buffer.from(chunk);size+=b.length;if(size>9_500_000)throw accountError('body-too-large',413);chunks.push(b);}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}catch{throw accountError('invalid-json');}
}
export async function transaction(pool,operation){
 const client=await pool.connect();
 try{await client.query('BEGIN');const result=await operation(client);await client.query('COMMIT');return result;}
 catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
// Repository transactions become savepoints inside the request's tenant transaction.
export function nestedPool(client){
 return {query:(...args)=>client.query(...args),async connect(){
  const savepoint='nested_'+randomBytes(8).toString('hex');
  return {async query(sql,args){
   if(sql==='BEGIN')return client.query('SAVEPOINT '+savepoint);
   if(sql==='COMMIT')return client.query('RELEASE SAVEPOINT '+savepoint);
   if(sql==='ROLLBACK')return client.query('ROLLBACK TO SAVEPOINT '+savepoint);
   return client.query(sql,args);
  },release(){}};
 }};
}
export async function scopedOperation(pool,actor,operation){
 return transaction(pool,async client=>{
  await client.query("SELECT set_config('app.household_id',$1,true),set_config('app.is_admin',$2,true),set_config('app.person_id',$3,true),set_config('app.is_manager',$4,true)",[actor.householdId??'',String(actor.applicationAdmin),actor.personId??'',String(actor.role==='manager')]);
  await client.query('SET LOCAL ROLE lapinou_request');
  return operation(nestedPool(client));
 });
}
async function sessionActor(pool,request){
 const token=String(request.headers?.cookie??'').match(/(?:^|;\s*)lapinou_account=([a-f0-9]{64})(?:;|$)/)?.[1];
 if(!token)return null;
 const result=await pool.query(`SELECT a.id,a.login,a.display_name,a.application_admin,s.active_household_id,m.role,m.person_id
  FROM account_sessions s JOIN app_accounts a ON a.id=s.account_id AND a.active
  LEFT JOIN household_memberships m ON m.account_id=a.id AND m.household_id=s.active_household_id
  WHERE s.token_hash=$1 AND s.expires_at>now()`,[sha(token)]);
 const a=result.rows[0];
 return a?{id:a.id,login:a.login,displayName:a.display_name,applicationAdmin:a.application_admin,
  householdId:a.role?a.active_household_id:null,role:a.role??null,personId:a.person_id??null,tokenHash:sha(token)}:null;
}
export async function publicSession(pool,actor){
 const memberships=await pool.query(`SELECT h.id,h.name,m.role,m.person_id AS "personId" FROM household_memberships m
  JOIN households h ON h.id=m.household_id WHERE m.account_id=$1 ORDER BY h.created_at,h.id`,[actor.id]);
 const {tokenHash,...account}=actor;
 return {authenticated:true,account,households:memberships.rows};
}
async function issueSession(pool,request,response,accountId){
 const membership=await pool.query('SELECT household_id FROM household_memberships WHERE account_id=$1 ORDER BY household_id LIMIT 1',[accountId]);
 const token=randomBytes(32).toString('hex');
 await pool.query('INSERT INTO account_sessions(token_hash,account_id,active_household_id,expires_at) VALUES($1,$2,$3,now()+interval \'7 days\')',[sha(token),accountId,membership.rows[0]?.household_id??null]);
 response.setHeader('Set-Cookie',cookie(request,token));
 return publicSession(pool,await sessionActor(pool,{headers:{cookie:'lapinou_account='+token}}));
}
async function lockAdministration(client){
 await client.query("SELECT pg_advisory_xact_lock(hashtext('lapinou-accounts'))");
}
function manager(actor){if(actor.role!=='manager')throw accountError('household-manager-required',403);}
function applicationAdmin(actor){if(!actor.applicationAdmin)throw accountError('application-admin-required',403);}
async function checkProfile(client,personId,householdId){
 if(personId==null||personId==='')return null;
 if(!uuid(personId))throw accountError('invalid-person-id');
 const found=await client.query('SELECT id FROM people WHERE id=$1 AND household_id=$2',[personId,householdId]);
 if(!found.rows.length)throw accountError('profile-outside-household',403);
 return personId;
}
async function createAccount(client,data,admin=false){
 const id=randomUUID(),login=normalizeLogin(data.login),name=String(data.displayName??'').trim();
 if(!name||name.length>80)throw accountError('invalid-display-name');
 const passwordHash=await hashPassword(data.password);
 await client.query('INSERT INTO app_accounts(id,login,display_name,password_hash,application_admin) VALUES($1,$2,$3,$4,$5)',[id,login,name,passwordHash,admin]);
 return id;
}
export async function bootstrap(pool,data,appPassword){
 const expected=sha(String(appPassword??'')),supplied=sha(String(data.applicationPassword??''));
 if(!appPassword||!timingSafeEqual(Buffer.from(expected),Buffer.from(supplied)))throw accountError('invalid-application-password',401);
 return transaction(pool,async client=>{
  await lockAdministration(client);
  if((await client.query('SELECT 1 FROM app_accounts LIMIT 1')).rows.length)throw accountError('already-configured',409);
  let household;
  if(data.householdId!=null&&!uuid(data.householdId))throw accountError('invalid-household-id');
  household=(await client.query('SELECT id,name FROM households '+(data.householdId?'WHERE id=$1 ':'')+'ORDER BY created_at,id LIMIT 1',data.householdId?[data.householdId]:[])).rows[0];
  if(data.householdId&&!household)throw accountError('household-not-found',404);
  if(!household){household={id:randomUUID(),name:String(data.householdName??'Mon foyer').trim().slice(0,120)||'Mon foyer'};await client.query('INSERT INTO households(id,name) VALUES($1,$2)',[household.id,household.name]);}
  const id=await createAccount(client,data,true);
  let personId=await checkProfile(client,data.personId,household.id);
  if(!personId){
   const existing=await client.query('SELECT id FROM people WHERE household_id=$1 AND lower(display_name)=lower($2)',[household.id,data.displayName.trim()]);
   personId=existing.rows[0]?.id??randomUUID();
   if(!existing.rows.length)await client.query('INSERT INTO people(id,household_id,display_name) VALUES($1,$2,$3)',[personId,household.id,data.displayName.trim()]);
  }
  await client.query("INSERT INTO household_memberships(account_id,household_id,person_id,role) VALUES($1,$2,$3,'manager')",[id,household.id,personId]);
  await client.query('UPDATE foods SET owner_household_id=$1 WHERE NOT official AND owner_household_id IS NULL',[household.id]);
  await client.query('UPDATE custom_food_categories SET owner_household_id=$1 WHERE owner_household_id IS NULL',[household.id]);
  return id;
 });
}
async function accountRoutes(pool,request,response,url,actor,appPassword){
 const route=url.pathname,method=request.method;
 if(route==='/api/session'&&method==='GET'){
  const configured=(await pool.query('SELECT 1 FROM app_accounts LIMIT 1')).rows.length>0;
  return sendAccount(response,200,actor?await publicSession(pool,actor):{authenticated:false,needsAccountSetup:!configured});
 }
 if(route==='/api/accounts/bootstrap'&&method==='POST'){
  const id=await bootstrap(pool,await jsonBody(request),appPassword);
  return sendAccount(response,201,await issueSession(pool,request,response,id));
 }
 if(route==='/api/accounts/bootstrap-info'&&method==='POST'){
  if((await pool.query('SELECT 1 FROM app_accounts LIMIT 1')).rows.length)throw accountError('already-configured',409);
  const body=await jsonBody(request);
  if(!appPassword||sha(body.applicationPassword??'')!==sha(appPassword))throw accountError('invalid-application-password',401);
  const households=(await pool.query('SELECT id,name FROM households ORDER BY created_at')).rows;
  const people=(await pool.query('SELECT id,household_id AS "householdId",display_name AS "displayName" FROM people ORDER BY display_name')).rows;
  return sendAccount(response,200,{households,people});
 }
 if(route==='/api/login'&&method==='POST'){
  const body=await jsonBody(request);
  const login=normalizeLogin(body.login);
  const result=await pool.query('SELECT id,password_hash FROM app_accounts WHERE lower(login)=$1 AND active',[login]);
  // Derive a password even for unknown accounts.
  const stored=result.rows[0]?.password_hash??'00000000000000000000000000000000:'+ '00'.repeat(64);
  if(!await passwordMatches(body.password,stored)||!result.rows.length)throw accountError('invalid-credentials',401);
  attempts.delete(request.socket?.remoteAddress??'unknown');
  return sendAccount(response,200,await issueSession(pool,request,response,result.rows[0].id));
 }
 if(route==='/api/logout'&&method==='POST'){
  if(actor)await pool.query('DELETE FROM account_sessions WHERE token_hash=$1',[actor.tokenHash]);
  response.setHeader('Set-Cookie','lapinou_account=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict');
  return sendAccount(response,200,{authenticated:false});
 }
 if(!actor)throw accountError('authentication-required',401);
 if(route==='/api/accounts/me'&&method==='GET')return sendAccount(response,200,await publicSession(pool,actor));
 if(route==='/api/accounts/password'&&method==='PUT'){
  const body=await jsonBody(request);
  const current=(await pool.query('SELECT password_hash FROM app_accounts WHERE id=$1',[actor.id])).rows[0];
  if(!await passwordMatches(body.currentPassword,current.password_hash))throw accountError('invalid-credentials',401);
  const hash=await hashPassword(body.password);
  await transaction(pool,async client=>{
   await client.query('UPDATE app_accounts SET password_hash=$2 WHERE id=$1',[actor.id,hash]);
   await client.query('DELETE FROM account_sessions WHERE account_id=$1',[actor.id]);
  });
  return sendAccount(response,200,await issueSession(pool,request,response,actor.id));
 }
 if(route==='/api/accounts/household'&&method==='PUT'){
  const body=await jsonBody(request);
  if(!uuid(body.householdId))throw accountError('invalid-household-id');
  const allowed=await pool.query('SELECT 1 FROM household_memberships WHERE account_id=$1 AND household_id=$2',[actor.id,body.householdId]);
  if(!allowed.rows.length)throw accountError('household-access-denied',403);
  await pool.query('UPDATE account_sessions SET active_household_id=$2 WHERE token_hash=$1',[actor.tokenHash,body.householdId]);
  return sendAccount(response,200,await publicSession(pool,await sessionActor(pool,request)));
 }
 if(route==='/api/accounts/members'&&method==='GET'){
  manager(actor);
  const members=(await pool.query(`SELECT a.id,a.login,a.display_name AS "displayName",a.active,m.role,m.person_id AS "personId"
   FROM household_memberships m JOIN app_accounts a ON a.id=m.account_id WHERE m.household_id=$1 ORDER BY a.display_name`,[actor.householdId])).rows;
  return sendAccount(response,200,{members});
 }
 if(route==='/api/accounts/members'&&method==='POST'){
  manager(actor);const body=await jsonBody(request);
  const result=await transaction(pool,async client=>{
   await lockAdministration(client);
   const personId=await checkProfile(client,body.personId,actor.householdId);
   const login=normalizeLogin(body.login);
   let id=(await client.query('SELECT id FROM app_accounts WHERE lower(login)=$1 AND active',[login])).rows[0]?.id;
   if(!id)id=await createAccount(client,body);
   if(!['manager','member'].includes(body.role))throw accountError('invalid-membership-role');
   await client.query('INSERT INTO household_memberships(account_id,household_id,person_id,role) VALUES($1,$2,$3,$4)',[id,actor.householdId,personId,body.role]);
   return {id};
  });
  return sendAccount(response,201,result);
 }
 const membership=route.match(/^\/api\/accounts\/members\/([a-f0-9-]{36})$/i);
 if(membership&&['PUT','DELETE'].includes(method)){
  manager(actor);const body=method==='PUT'?await jsonBody(request):{};
  await transaction(pool,async client=>{
   await lockAdministration(client);
   const current=(await client.query('SELECT role FROM household_memberships WHERE account_id=$1 AND household_id=$2',[membership[1],actor.householdId])).rows[0];
   if(!current)throw accountError('membership-not-found',404);
   const role=method==='DELETE'?null:body.role;
   if(method==='PUT'&&!['manager','member'].includes(role))throw accountError('invalid-membership-role');
   if(current.role==='manager'&&role!=='manager'){
    const others=await client.query(`SELECT 1 FROM household_memberships m JOIN app_accounts a ON a.id=m.account_id AND a.active
     WHERE m.household_id=$1 AND m.role='manager' AND m.account_id<>$2`,[actor.householdId,membership[1]]);
    if(!others.rows.length)throw accountError('last-household-manager',409);
   }
   if(method==='DELETE')await client.query('DELETE FROM household_memberships WHERE account_id=$1 AND household_id=$2',[membership[1],actor.householdId]);
   else{
    const personId=await checkProfile(client,body.personId,actor.householdId);
    await client.query('UPDATE household_memberships SET role=$3,person_id=$4 WHERE account_id=$1 AND household_id=$2',[membership[1],actor.householdId,role,personId]);
   }
  });
  return sendAccount(response,200,{saved:true});
 }
 if(route==='/api/accounts/profile'&&method==='PUT'){
  if(!actor.personId)throw accountError('profile-not-linked',409);
  const body=await jsonBody(request);
  const name=String(body.displayName??'').trim(),birthDate=body.birthDate||null;
  if(!name||name.length>80||birthDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)||!Number.isFinite(Date.parse(birthDate+'T00:00:00Z'))||new Date(birthDate+'T00:00:00Z').toISOString().slice(0,10)!==birthDate))throw accountError('invalid-profile');
  await pool.query('UPDATE people SET display_name=$3,birth_date=$4 WHERE id=$1 AND household_id=$2',[actor.personId,actor.householdId,name,birthDate]);
  return sendAccount(response,200,{saved:true});
 }
 if(route==='/api/accounts/application'&&method==='POST'){
  applicationAdmin(actor);const body=await jsonBody(request);
  const id=await transaction(pool,client=>createAccount(client,body,body.applicationAdmin===true));
  return sendAccount(response,201,{id});
 }
 const assignment=url.pathname.match(/^\/api\/accounts\/households\/([a-f0-9-]{36})\/members$/i);
 if(assignment&&method==='PUT'){
  applicationAdmin(actor);const body=await jsonBody(request);
  if(!uuid(body.accountId)||!['manager','member'].includes(body.role))throw accountError('invalid-account');
  await transaction(pool,async client=>{
   await lockAdministration(client);
   const personId=await checkProfile(client,body.personId,assignment[1]);
   const account=await client.query('SELECT 1 FROM app_accounts WHERE id=$1 AND active',[body.accountId]);
   if(!account.rows.length)throw accountError('account-not-found',404);
   const current=(await client.query('SELECT role FROM household_memberships WHERE household_id=$1 AND account_id=$2',[assignment[1],body.accountId])).rows[0];
   if(current?.role==='manager'&&body.role!=='manager'){
    const others=await client.query("SELECT 1 FROM household_memberships m JOIN app_accounts a ON a.id=m.account_id AND a.active WHERE m.household_id=$1 AND m.role='manager' AND m.account_id<>$2",[assignment[1],body.accountId]);
    if(!others.rows.length)throw accountError('last-household-manager',409);
   }
   await client.query('INSERT INTO household_memberships(account_id,household_id,person_id,role) VALUES($1,$2,$3,$4) ON CONFLICT(account_id,household_id) DO UPDATE SET person_id=EXCLUDED.person_id,role=EXCLUDED.role',[body.accountId,assignment[1],personId,body.role]);
  });
  return sendAccount(response,200,{saved:true});
 }
 const house=url.pathname.match(/^\/api\/accounts\/households\/([a-f0-9-]{36})(?:\/(join))?$/i);
 if(house&&method==='PUT'&&!house[2]){
  applicationAdmin(actor);const body=await jsonBody(request);
  const name=String(body.name??'').trim();if(!name||name.length>120)throw accountError('invalid-household-name');
  const result=await pool.query('UPDATE households SET name=$2 WHERE id=$1 RETURNING id',[house[1],name]);
  if(!result.rows.length)throw accountError('household-not-found',404);
  return sendAccount(response,200,{saved:true});
 }
 if(house&&method==='POST'&&house[2]==='join'){
  applicationAdmin(actor);
  const result=await pool.query('INSERT INTO household_memberships(account_id,household_id,role) SELECT $1,id,\'manager\' FROM households WHERE id=$2 ON CONFLICT(account_id,household_id) DO UPDATE SET role=\'manager\' RETURNING household_id',[actor.id,house[1]]);
  if(!result.rows.length)throw accountError('household-not-found',404);
  return sendAccount(response,200,{saved:true});
 }
 if(route==='/api/accounts/application'&&method==='GET'){
  applicationAdmin(actor);
  const accounts=(await pool.query('SELECT id,login,display_name AS "displayName",application_admin AS "applicationAdmin",active FROM app_accounts ORDER BY display_name')).rows;
  const households=(await pool.query('SELECT id,name FROM households ORDER BY created_at,id')).rows;
  const memberships=(await pool.query('SELECT account_id AS "accountId",household_id AS "householdId",person_id AS "personId",role FROM household_memberships')).rows;
  const profiles=(await pool.query('SELECT id,household_id AS "householdId",display_name AS "displayName" FROM people ORDER BY display_name')).rows;
  return sendAccount(response,200,{accounts,households,memberships,profiles});
 }
 const personRoute=route.match(/^\/api\/accounts\/profiles\/([a-f0-9-]{36})$/i);
 if(personRoute&&method==='PUT'){
  manager(actor);const body=await jsonBody(request);
  const name=String(body.displayName??'').trim(),birthDate=body.birthDate||null;
  if(!name||name.length>80||typeof body.active!=='boolean'||birthDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)||!Number.isFinite(Date.parse(birthDate+'T00:00:00Z'))||new Date(birthDate+'T00:00:00Z').toISOString().slice(0,10)!==birthDate))throw accountError('invalid-profile');
  const result=await pool.query('UPDATE people SET display_name=$3,birth_date=$4,active=$5 WHERE id=$1 AND household_id=$2 RETURNING id',[personRoute[1],actor.householdId,name,birthDate,body.active]);
  if(!result.rows.length)throw accountError('profile-not-found',404);
  return sendAccount(response,200,{saved:true});
 }
 const account=route.match(/^\/api\/accounts\/application\/([a-f0-9-]{36})$/i);
 if(account&&method==='PUT'){
  applicationAdmin(actor);const body=await jsonBody(request);
  const passwordHash=body.password?await hashPassword(body.password):null;
  await transaction(pool,async client=>{
   await lockAdministration(client);
   const current=(await client.query('SELECT application_admin,active FROM app_accounts WHERE id=$1 FOR UPDATE',[account[1]])).rows[0];
   if(!current)throw accountError('account-not-found',404);
   if(typeof body.active!=='boolean'||typeof body.applicationAdmin!=='boolean')throw accountError('invalid-account');
   if(current.application_admin&&current.active&&(!body.active||!body.applicationAdmin)){
    const others=await client.query('SELECT 1 FROM app_accounts WHERE application_admin AND active AND id<>$1',[account[1]]);
    if(!others.rows.length)throw accountError('last-application-admin',409);
   }
   if(!body.active){
    const orphan=await client.query(`SELECT 1 FROM household_memberships m WHERE m.account_id=$1 AND m.role='manager'
     AND NOT EXISTS(SELECT 1 FROM household_memberships o JOIN app_accounts a ON a.id=o.account_id AND a.active
       WHERE o.household_id=m.household_id AND o.role='manager' AND o.account_id<>$1)`,[account[1]]);
    if(orphan.rows.length)throw accountError('last-household-manager',409);
   }
   if(body.login!==undefined)await client.query('UPDATE app_accounts SET login=$2 WHERE id=$1',[account[1],normalizeLogin(body.login)]);
   if(body.displayName!==undefined){const name=String(body.displayName).trim();if(!name||name.length>80)throw accountError('invalid-display-name');await client.query('UPDATE app_accounts SET display_name=$2 WHERE id=$1',[account[1],name]);}
   await client.query('UPDATE app_accounts SET active=$2,application_admin=$3,password_hash=COALESCE($4,password_hash) WHERE id=$1',[account[1],body.active,body.applicationAdmin,passwordHash]);
   await client.query('DELETE FROM account_sessions WHERE account_id=$1',[account[1]]);
  });
  return sendAccount(response,200,{saved:true});
 }
 if(route==='/api/accounts/households'&&method==='POST'){
  applicationAdmin(actor);const body=await jsonBody(request);
  const name=String(body.name??'').trim();if(!name||name.length>120)throw accountError('invalid-household-name');
  const managerId=body.managerId??actor.id;if(!uuid(managerId))throw accountError('invalid-account');
  const result=await transaction(pool,async client=>{
   const active=await client.query('SELECT 1 FROM app_accounts WHERE id=$1 AND active',[managerId]);
   if(!active.rows.length)throw accountError('account-not-found',404);
   const id=randomUUID();await client.query('INSERT INTO households(id,name) VALUES($1,$2)',[id,name]);
   await client.query("INSERT INTO household_memberships(account_id,household_id,role) VALUES($1,$2,'manager')",[managerId,id]);
   return {household:{id,name}};
  });
  return sendAccount(response,201,result);
 }
 return false;
}
function responseBuffer(){
 const headers=new Map();let status=200,body;
 return {get status(){return status;},setHeader:(key,value)=>headers.set(key,value),writeHead:value=>{status=value;},end:value=>{body=value;},
  transform(fn){if(body){try{body=JSON.stringify(fn(JSON.parse(String(body))));}catch{}}},
  flush(response){for(const [key,value] of headers)response.setHeader(key,value);response.writeHead(status);response.end(body);}};
}
function assertMemberWrite(actor,request,url){
 if(['GET','HEAD'].includes(request.method))return;
 if(actor.role==='manager')return;
 const person=url.pathname.match(/^\/api\/people\/([a-f0-9-]{36})\/(weights|profile-history)$/i);
 if(person&&person[1]===actor.personId)return;
 throw accountError('household-manager-required',403);
}
export async function accountGateway(request,response,pool,appPassword,legacyHandler,sharingHandler){
 const url=new URL(request.url,'http://localhost');
 if(!url.pathname.startsWith('/api/')||url.pathname==='/api/health')return legacyHandler(request,response,pool);
 try{
  if(!['GET','HEAD'].includes(request.method)){
   if(request.headers?.['sec-fetch-site']==='cross-site')throw accountError('cross-origin-request',403);
   const origin=request.headers?.origin;
   if(origin){const originHost=new URL(origin).host;if(originHost!==request.headers.host&&originHost!==String(request.headers['x-forwarded-host']??'').split(',')[0].trim())throw accountError('cross-origin-request',403);}
  }
  if(request.method==='POST'&&['/api/login','/api/accounts/bootstrap','/api/accounts/bootstrap-info'].includes(url.pathname)){
   const ip=request.socket?.remoteAddress??'unknown',now=Date.now();
   let limit=attempts.get(ip);
   if(!limit||now-limit.started>900000){limit={started:now,count:0};attempts.set(ip,limit);}
   if(limit.count>=8){response.setHeader('Retry-After','900');throw accountError('too-many-login-attempts',429);}
   limit.count++;
   if(attempts.size>10000)for(const [key,value] of attempts)if(now-value.started>900000)attempts.delete(key);
  }
  const actor=await sessionActor(pool,request);
  const handled=await accountRoutes(pool,request,response,url,actor,appPassword);
  if(handled!==false)return;
  if(!actor)throw accountError('authentication-required',401);
  if(sharingHandler&&url.pathname.startsWith('/api/community'))return await sharingHandler(request,response,pool,actor);
  if(url.pathname==='/api/households'&&request.method==='GET')return sendAccount(response,200,{households:(await publicSession(pool,actor)).households});
  if(url.pathname==='/api/households')throw accountError('use-account-household-management',403);
  if(!actor.householdId)throw accountError('household-membership-required',403);
  assertMemberWrite(actor,request,url);
  const body=['POST','PUT','PATCH','DELETE'].includes(request.method)?await jsonBody(request):null;
  const requestedHousehold=body?.householdId??url.searchParams.get('householdId');
  if(requestedHousehold&&requestedHousehold!==actor.householdId)throw accountError('household-access-denied',403);
  const clone=body?Readable.from([JSON.stringify(body)]):request;
  clone.url=request.url;clone.method=request.method;clone.headers=request.headers;clone.socket=request.socket;clone.account=actor;
  const buffer=responseBuffer();
  try{
   await scopedOperation(pool,actor,async scoped=>{
    if(!actor.applicationAdmin&&url.pathname.startsWith('/api/foods')&&!['GET','HEAD'].includes(request.method)){
     const pathId=url.pathname.match(/^\/api\/foods\/([a-f0-9-]{36})/i)?.[1];
     const ids=[pathId,...(body?.foodIds??[]),...(body?.changes??[]).map(row=>row.foodId)].filter(uuid);
     if(ids.length&&(await scoped.query('SELECT 1 FROM foods WHERE id=ANY($1::uuid[]) AND official LIMIT 1',[ids])).rows.length)
       throw accountError('official-food-readonly',403);
    }
    await legacyHandler(clone,buffer,scoped);
    if(buffer.status>=400)throw {responseBuffer:buffer};
   });
  }catch(error){if(!error.responseBuffer)throw error;}
  if(actor.role!=='manager'&&url.pathname==='/api/people'&&request.method==='GET')buffer.transform(data=>({...data,people:data.people?.map(person=>person.id===actor.personId?person:{...person,birthDate:null,weightHistory:[],profileHistory:[]})}));
  buffer.flush(response);
 }catch(error){
  const known=error.status?error.message:error.code==='23505'?'already-exists':error.code==='42501'?'data-access-denied':null;
  sendAccount(response,error.status??(known?409:500),{error:known??'account-request-failed'});
 }
}
