const errorLabels={
 'authentication-required':'Reconnecte-toi pour continuer.',
 'invalid-credentials':'Identifiant ou mot de passe incorrect.',
 'invalid-application-password':'Le mot de passe actuel de l’application est incorrect.',
 'password-too-short':'Le mot de passe doit contenir entre 12 et 256 caractères.',
 'invalid-login':'Identifiant de 3 à 100 caractères, avec lettres, chiffres, point, tiret ou @.',
 'already-exists':'Ce compte ou cette association existe déjà.',
 'last-application-admin':'Il faut conserver au moins un administrateur actif.',
 'last-household-manager':'Il faut conserver au moins un gestionnaire actif dans ce foyer.',
 'profile-outside-household':'Le profil sélectionné appartient à un autre foyer.',
 'household-manager-required':'Cette action nécessite le rôle de gestionnaire du foyer.',
 'application-admin-required':'Cette action nécessite le rôle d’administrateur de l’application.',
 'official-food-readonly':'Cet aliment est commun : propose une correction depuis sa fiche.',
 'empty-selection':'Sélectionne au moins une recette.',
 'package-too-large':'Un package peut contenir jusqu’à 500 recettes. Réduis la sélection ou crée plusieurs packages.',
 'invalid-starter-package':'Renseigne un nom et sélectionne de 1 à 500 recettes pour ce package.',
 'food-proposal-stale':'La fiche a changé depuis cette proposition. Réexamine ses valeurs et soumets une nouvelle proposition.',
 'meal-not-rateable':'Tu peux noter uniquement un repas passé auquel ton profil a participé.',
 'invalid-rating':'Choisis une note entière entre 1 et 5.',
 'data-access-denied':'Cette donnée est protégée. Pour un aliment commun, propose une correction depuis sa fiche.',
 'publication-unavailable':'Une recette du package a été retirée du partage. Actualise la liste.',
 'too-many-login-attempts':'Trop de tentatives. Réessaie dans quinze minutes.',
};
export const accountMessage=error=>errorLabels[error?.body?.error]??error?.body?.error??'Connexion au service impossible.';
const element=(tag,text,cls)=>{const node=document.createElement(tag);if(text)node.textContent=text;if(cls)node.className=cls;return node;};
function field(form,label,name,type='text',value='',required=true){
 const wrapper=element('label',label),input=document.createElement('input');
 input.name=name;input.type=type;input.value=value??'';input.required=required;
 if(type==='password'){input.minLength=12;input.maxLength=256;input.autocomplete='new-password';}
 else input.maxLength=120;
 wrapper.append(input);form.append(wrapper);return input;
}
function select(form,label,name,choices,value){
 const wrapper=element('label',label),input=document.createElement('select');input.name=name;
 for(const [id,name] of choices)input.add(new Option(name,id));
 if(value!=null)input.value=value;
 wrapper.append(input);form.append(wrapper);return input;
}
function button(parent,label,action){
 const node=element('button',label,'secondary');node.type='button';
 node.addEventListener('click',async()=>{node.disabled=true;try{await action();}finally{node.disabled=false;}});
 parent.append(node);return node;
}
function section(parent,title){
 const block=element('section',null,'account-section');block.append(element('h3',title));parent.append(block);return block;
}
function form(parent,label,action){
 const node=element('form',null,'account-form'),status=element('p',null,'form-message');
 status.setAttribute('role','status');
 const submit=element('button',label,'primary');submit.type='submit';node.append(submit,status);
 node.addEventListener('submit',async event=>{
  event.preventDefault();if(submit.disabled||!node.reportValidity())return;
  submit.disabled=true;status.textContent='';
  const notice=document.querySelector(node.closest('#community-management')?'#community-message':'#accounts-message');
  if(notice)notice.textContent='';
  try{await action(Object.fromEntries(new FormData(node)),node);status.textContent='Enregistré.';if(notice)notice.textContent='Enregistré.';}
  catch(error){status.textContent=accountMessage(error);if(notice)notice.textContent=accountMessage(error);}
  finally{submit.disabled=false;}
 });
 parent.append(node);return node;
}
function details(parent,title){
 const root=document.createElement('details');root.append(element('summary',title));parent.append(root);return root;
}

function selectionList(parent,items,label,initial=false){
 const wrapper=element('div',null,'bulk-selection'),search=document.createElement('input');search.type='search';search.placeholder='Rechercher…';search.setAttribute('aria-label','Rechercher dans '+label);
 const count=element('p',null,'selection-count'),list=element('div',null,'selection-results'),selected=new Set(initial?items.map(i=>i.id):[]);
 list.setAttribute('aria-label',label);wrapper.append(search,count);parent.append(wrapper);
 const visible=()=>items.filter(i=>i.name.toLocaleLowerCase('fr').includes(search.value.toLocaleLowerCase('fr')));
 const update=()=>{count.textContent=selected.size+' sélectionnée(s) · '+visible().length+' résultat(s) sur '+items.length;};
 function render(){list.replaceChildren();for(const item of visible()){
  const row=element('label',null,'selection-row'),check=document.createElement('input');check.type='checkbox';check.checked=selected.has(item.id);check.value=item.id;
  check.addEventListener('change',()=>{if(check.checked)selected.add(item.id);else selected.delete(item.id);update();});
  const name=element('span',item.name);if(item.detail)name.append(element('small',item.detail));row.append(check,name);list.append(row);
 }update();}
 button(wrapper,'Tout sélectionner (résultats filtrés)',async()=>{for(const item of visible())selected.add(item.id);render();});
 button(wrapper,'Tout désélectionner',async()=>{selected.clear();render();});wrapper.append(list);
 search.addEventListener('input',render);render();return {values:()=>[...selected]};
}

export function createAccountUI({api,onSession}){
 let session,accountSection='personal';
 const root=document.querySelector('#account-management');
 const community=document.querySelector('#community-management');
 async function refreshSession(){session=await api('/api/session');onSession(session);renderSession(session);return session;}
 async function changeHousehold(id){
  await api('/api/accounts/household',{method:'PUT',body:JSON.stringify({householdId:id})});
  location.reload();
 }
 function renderSession(value){
  session=value;
  const account=session.account;
  document.body.classList.toggle('catalogue-contributor',Boolean(account&&!account.applicationAdmin));
  document.body.classList.toggle('member-mode',Boolean(account&&account.role!=='manager'));
  const banner=document.querySelector('#account-banner');banner.replaceChildren();
  if(!account)return;
  banner.append(element('span',account.displayName+(account.applicationAdmin?' · Admin application':'')));
  button(banner,'Se déconnecter',async()=>{await api('/api/logout',{method:'POST'});location.reload();});
 }
 async function load(){
  root.replaceChildren();
  if(!session?.account)return;
  const account=session.account;
  const intro=section(root,'Mes accès');intro.classList.add('account-access-summary');
  const house=session.households.find(h=>h.id===account.householdId);
  intro.append(element('p',account.displayName+' · '+account.login));
  intro.append(element('p','Application : '+(account.applicationAdmin?'Administrateur':'Utilisateur')+' · Foyer actif : '+(house?.name??'Aucun')+' · '+(account.role==='manager'?'Gestionnaire et membre':account.role==='member'?'Membre':'Sans appartenance')));
  const help=details(intro,'Comprendre les rôles');
  for(const label of ['Membre du foyer : consulte les données communes, gère son profil et note ses repas.','Gestionnaire du foyer : possède les droits d’un membre et gère les menus, stocks, recettes et membres de ce foyer.','Administrateur de l’application : gère les comptes, les foyers, le catalogue alimentaire commun et les packages. Ce rôle se cumule avec celui du foyer.'])help.append(element('p',label));
  const navigation=element('nav',null,'account-navigation');navigation.setAttribute('aria-label','Gestion de mon compte et de mes droits');root.append(navigation);
  const personal=section(root,'Mon compte personnel');personal.dataset.scope='personal';
  personal.append(element('p','Identifiant · '+account.login));
  const password=form(personal,'Changer mon mot de passe',async data=>{
   await api('/api/accounts/password',{method:'PUT',body:JSON.stringify(data)});
   await refreshSession();await load();
  });
  field(password,'Mot de passe actuel','currentPassword','password');
  field(password,'Nouveau mot de passe','password','password');
  if(account.householdId&&account.personId){
   const people=(await api('/api/people?householdId='+account.householdId)).people;
   const person=people.find(p=>p.id===account.personId);
   const profile=form(personal,'Enregistrer mon profil personnel',async data=>{
    await api('/api/accounts/profile',{method:'PUT',body:JSON.stringify(data)});
    await load();
   });
   field(profile,'Nom affiché','displayName','text',person?.displayName);
   field(profile,'Date de naissance','birthDate','date',person?.birthDate?.slice(0,10),false);
  }else personal.append(element('p','Le gestionnaire du foyer peut associer ton compte à un profil existant.'));
  if(account.role==='manager')await members();
  if(account.applicationAdmin)await application();
  const scopes=[['personal','Mon compte'],...(account.role==='manager'?[['household','Mon foyer']]:[]),...(account.applicationAdmin?[['application','Administration de l’application']]:[])];
  if(!scopes.some(([key])=>key===accountSection))accountSection='personal';
  const activate=key=>{accountSection=key;for(const block of root.querySelectorAll('[data-scope]'))block.hidden=block.dataset.scope!==key;for(const control of navigation.children)control.setAttribute('aria-pressed',String(control.dataset.scopeKey===key));};
  for(const [key,label] of scopes){const control=button(navigation,label,async()=>activate(key));control.dataset.scopeKey=key;}activate(accountSection);
 }
 async function members(){
  const block=section(root,'Membres de mon foyer');block.dataset.scope='household';
  block.append(element('p','Les droits ci-dessous concernent uniquement le foyer actif. Un profil représente une personne dans les menus ; le compte lui permet de se connecter.'));
  const [{members},{people}]=await Promise.all([api('/api/accounts/members'),api('/api/people?householdId='+session.account.householdId)]);
  const profiles=[['','Sans profil personnel'],...people.map(p=>[p.id,p.displayName])];
  const roles=[['member','Membre — consulter et gérer son profil'],['manager','Gestionnaire — gérer ce foyer (inclut membre)']];
  for(const member of members){
   const row=details(block,member.displayName+' · '+(member.role==='manager'?'Gestionnaire':'Membre')+' · Profil : '+(people.find(p=>p.id===member.personId)?.displayName??'Non associé'));
   const edit=form(row,'Enregistrer les droits et le profil',async data=>{
    await api('/api/accounts/members/'+member.id,{method:'PUT',body:JSON.stringify(data)});
    await refreshSession();await load();
   });
   select(edit,'Rôle dans ce foyer','role',roles,member.role);
   select(edit,'Profil personnel','personId',profiles,member.personId??'');
   button(row,'Retirer du foyer',async()=>{
    if(!confirm('Retirer l’accès de '+member.displayName+' à ce foyer ?'))return;
    try{await api('/api/accounts/members/'+member.id,{method:'DELETE'});await refreshSession();await load();}
    catch(error){row.append(element('p',accountMessage(error),'form-message'));}
   });
  }
  const profilesSection=details(block,'Modifier les profils du foyer');
  for(const person of people){
    const edit=form(profilesSection,'Enregistrer « '+person.displayName+' »',async data=>{
      await api('/api/accounts/profiles/'+person.id,{method:'PUT',body:JSON.stringify({...data,active:data.active==='yes'})});await load();
    });
    field(edit,'Nom du profil','displayName','text',person.displayName);
    field(edit,'Date de naissance','birthDate','date',person.birthDate?.slice(0,10),false);
    select(edit,'Profil utilisé dans les nouveaux menus','active',[['yes','Actif'],['no','Inactif']],person.active?'yes':'no');
  }
  const add=details(block,'Ajouter un compte au foyer');
  add.append(element('p','Pour un compte existant, renseigne son identifiant. Pour un nouveau compte, ajoute son nom et un mot de passe initial d’au moins 12 caractères.'));
  const create=form(add,'Ajouter le compte',async data=>{
   await api('/api/accounts/members',{method:'POST',body:JSON.stringify(data)});await load();
  });
  field(create,'Identifiant','login');
  field(create,'Nom du nouveau compte','displayName','text','',false);
  field(create,'Mot de passe du nouveau compte','password','password','',false);
  select(create,'Rôle','role',roles,'member');select(create,'Profil personnel','personId',profiles,'');
 }
 async function application(){
  const data=await api('/api/accounts/application');
  const block=section(root,'Administration de l’application');block.dataset.scope='application';
  block.append(element('p','Gère ici les comptes de connexion et les rattachements aux foyers. Les droits du foyer et le rôle d’administrateur de l’application sont indépendants.'));
  const accounts=details(block,'Gestion des comptes');
  const create=form(accounts,'Créer un compte',async value=>{
   await api('/api/accounts/application',{method:'POST',body:JSON.stringify(value)});await load();
  });
  field(create,'Identifiant','login');field(create,'Nom','displayName');field(create,'Mot de passe initial','password','password');
  for(const item of data.accounts){
   const row=details(accounts,item.displayName+' · '+(item.applicationAdmin?'Administrateur application':'Utilisateur')+' · '+(item.active?'Actif':'Désactivé'));
   row.append(element('p','Foyers : '+data.memberships.filter(m=>m.accountId===item.id).map(m=>(data.households.find(h=>h.id===m.householdId)?.name??'Foyer')+' — '+(m.role==='manager'?'Gestionnaire':'Membre')).join(' · ')));
   const edit=form(row,'Enregistrer le compte',async value=>{
    await api('/api/accounts/application/'+item.id,{method:'PUT',body:JSON.stringify({...value,active:value.active==='yes',applicationAdmin:value.applicationAdmin==='yes'})});
    if(item.id===session.account.id)location.reload();else await load();
   });
   field(edit,'Identifiant','login','text',item.login);field(edit,'Nom du compte','displayName','text',item.displayName);
   select(edit,'Accès à l’application','active',[['yes','Actif'],['no','Désactivé']],item.active?'yes':'no');
   select(edit,'Rôle dans l’application entière','applicationAdmin',[['no','Utilisateur'],['yes','Administrateur de l’application']],item.applicationAdmin?'yes':'no');
   field(edit,'Nouveau mot de passe, si nécessaire','password','password','',false);
  }
  const houses=details(block,'Gestion des foyers');
  const createHouse=form(houses,'Créer le foyer',async value=>{
   const result=await api('/api/accounts/households',{method:'POST',body:JSON.stringify(value)});
   if(value.managerId===session.account.id)await changeHousehold(result.household.id);else await load();
  });
  field(createHouse,'Nom du foyer','name');
  select(createHouse,'Premier gestionnaire','managerId',data.accounts.filter(a=>a.active).map(a=>[a.id,a.displayName]),session.account.id);
  for(const house of data.households){
   const roster=data.memberships.filter(m=>m.householdId===house.id);
   const row=details(houses,house.name+' · '+roster.length+' compte(s)');
   for(const member of roster)row.append(element('p',(data.accounts.find(a=>a.id===member.accountId)?.displayName??'Compte')+' · '+(member.role==='manager'?'Gestionnaire et membre':'Membre')+' · Profil : '+(data.profiles.find(p=>p.id===member.personId)?.displayName??'Non associé')));
   const assign=form(row,'Enregistrer le rattachement et les droits',async value=>{
    await api('/api/accounts/households/'+house.id+'/members',{method:'PUT',body:JSON.stringify(value)});await refreshSession();await load();
   });
   const who=select(assign,'Compte à rattacher ou à modifier','accountId',data.accounts.filter(a=>a.active).map(a=>[a.id,a.displayName+' ('+a.login+')']),roster[0]?.accountId);
   const role=select(assign,'Rôle dans ce foyer','role',[['member','Membre'],['manager','Gestionnaire (inclut membre)']],'member');
   const profile=select(assign,'Profil personnel dans ce foyer','personId',[['','Sans profil'],...data.profiles.filter(p=>p.householdId===house.id).map(p=>[p.id,p.displayName])],'');
   const populate=()=>{const current=roster.find(m=>m.accountId===who.value);role.value=current?.role??'member';profile.value=current?.personId??'';};who.addEventListener('change',populate);populate();
   const edit=form(row,'Renommer le foyer',async value=>{await api('/api/accounts/households/'+house.id,{method:'PUT',body:JSON.stringify(value)});await load();});
   field(edit,'Nom','name','text',house.name);
   button(row,'Rejoindre et gérer ce foyer',async()=>{
    if(!confirm('Associer ton compte comme gestionnaire de « '+house.name+' » ?'))return;
    await api('/api/accounts/households/'+house.id+'/join',{method:'POST'});
    await changeHousehold(house.id);
   });
  }
 }
 async function loadCommunity(){
  community.replaceChildren();
  if(!session?.account)return;
  const data=await api('/api/community');
  const manager=session.account.role==='manager';
  const intro=section(community,'Recettes à partager et à découvrir');
  intro.append(element('p','Les aliments sont déjà communs à tous les foyers. Ici, partage et importe les recettes par sélection multiple. Les menus, profils et stocks restent privés.'));
  if(manager){
   const publish=section(community,'Partager mes recettes en lot');
   publish.append(element('p','Recherche, sélectionne tous les résultats ou coche quelques recettes. Une recette déjà publiée est mise à jour sans doublon ; les copies déjà importées restent indépendantes.'));
   const recipes=(await api('/api/recipes?householdId='+session.account.householdId,{timeoutMs:60000})).recipes.filter(r=>!r.recipeArchived&&!r.parentRecipeId);
   const published=new Set(data.publications.filter(p=>p.mine).map(p=>p.sourceRecipeId));
   const selection=selectionList(publish,recipes.map(r=>({id:r.id,name:r.name,detail:published.has(r.id)?'Déjà partagée':'Privée'})),'Mes recettes');
   const progress=element('p',null,'form-message');progress.setAttribute('role','status');publish.append(progress);
   async function publishSelected(){
    const selected=selection.values();if(!selected.length)throw {body:{error:'empty-selection'}};
    const results=[];
    for(let offset=0;offset<selected.length;offset+=10){
     progress.textContent='Publication : '+offset+' / '+selected.length+' recettes…';
     const result=await api('/api/community/publish-batch',{method:'POST',timeoutMs:120000,body:JSON.stringify({recipeIds:selected.slice(offset,offset+10)})});results.push(...result.results);
    }
    progress.textContent=results.length+' recette(s) partagée(s).';return results.map(r=>r.id);
   }
   form(publish,'Partager la sélection',async()=>{await publishSelected();await loadCommunity();});
   if(session.account.applicationAdmin){
    const packageForm=form(publish,'Créer un package avec la sélection',async value=>{
     if(selection.values().length>500)throw {body:{error:'package-too-large'}};
     const publicationIds=await publishSelected();
     await api('/api/community/packages',{method:'POST',body:JSON.stringify({...value,publicationIds})});await loadCommunity();
    });
    field(packageForm,'Nom du nouveau package','name');field(packageForm,'Description','description','text','',false);
   }
  }
  const packages=section(community,'Packages de recettes');
  packages.append(element('p','Un package rassemble des recettes. Les aliments nécessaires sont déjà disponibles dans le catalogue commun. Les rôles des comptes se règlent dans Comptes et foyers.'));
  if(!data.packages.length)packages.append(element('p','Aucun package pour le moment. L’administrateur peut en créer un directement depuis une sélection de recettes ci-dessus.'));
  for(const pack of data.packages){
   const card=details(packages,pack.name+' · '+pack.publicationIds.length+' recettes');card.append(element('p',pack.description));
   const choices=selectionList(card,pack.publicationIds.map(id=>data.publications.find(p=>p.id===id)).filter(Boolean),'Recettes du package',true);
   if(manager)form(card,'Importer la sélection dans mon foyer',async()=>{
    const publicationIds=choices.values();if(!publicationIds.length)throw {body:{error:'empty-selection'}};
    await api('/api/community/packages/import',{method:'POST',timeoutMs:180000,body:JSON.stringify({packageId:pack.id,publicationIds})});
   });
   if(session.account.applicationAdmin)button(card,'Retirer ce package',async()=>{
    if(!confirm('Retirer ce package ? Les recettes déjà importées restent disponibles.'))return;
    await api('/api/community/packages/'+pack.id,{method:'DELETE'});await loadCommunity();
   });
  }
  const shared=section(community,'Bibliothèque partagée');
  const recipes=data.publications.filter(p=>p.kind==='recipe');
  const choices=selectionList(shared,recipes.map(p=>({...p,detail:p.ratingCount?'★ '+Number(p.ratingAverage).toFixed(1)+' / 5 · '+p.ratingCount+' avis':p.mine?'Mon foyer':'Recette partagée'})),'Recettes partagées');
  if(manager)form(shared,'Importer les recettes sélectionnées',async()=>{
   const selected=choices.values();if(!selected.length)throw {body:{error:'empty-selection'}};
   for(let offset=0;offset<selected.length;offset+=10)await api('/api/community/import-batch',{method:'POST',timeoutMs:120000,body:JSON.stringify({publicationIds:selected.slice(offset,offset+10)})});
  });
  const preview=details(shared,'Consulter une recette ou retirer une publication');
  const source=select(preview,'Recette','publication',recipes.map(p=>[p.id,p.name]),'');
  const content=element('div');preview.append(content);
  button(preview,'Afficher la recette',async()=>{
   content.replaceChildren();try{
    const {payload}=await api('/api/community/publications/'+source.value);
    content.append(element('p','Ingrédients · '+payload.foods.map(food=>food.name).join(', ')));
    const root=payload.recipes.find(recipe=>recipe.id===payload.rootId);if(root?.instructions)content.append(element('p',root.instructions));
   }catch(error){content.append(element('p',accountMessage(error)));}
  });
  if(manager||session.account.applicationAdmin)button(preview,'Retirer cette publication du partage',async()=>{
   if(!confirm('Retirer la publication sélectionnée ? Les copies déjà importées restent disponibles.'))return;
   try{await api('/api/community/publications/'+source.value,{method:'DELETE'});await loadCommunity();}catch(error){content.textContent=accountMessage(error);}
  });
  if(session.account.applicationAdmin){
   const compose=details(shared,'Créer un package depuis les publications sélectionnées');
   const create=form(compose,'Créer ce package',async value=>{
    const publicationIds=choices.values();if(!publicationIds.length)throw {body:{error:'empty-selection'}};
    await api('/api/community/packages',{method:'POST',body:JSON.stringify({...value,publicationIds})});await loadCommunity();
   });field(create,'Nom du package','name');field(create,'Description','description','text','',false);
  }
  const corrections=section(community,session.account.applicationAdmin?'Corrections des aliments à examiner':'Mes propositions de correction');
  corrections.append(element('p','Depuis une fiche aliment, propose des valeurs corrigées. Seul l’administrateur de l’application peut les appliquer au catalogue commun.'));
  const proposals=(await api('/api/community/food-proposals')).proposals;
  if(!proposals.length)corrections.append(element('p','Aucune proposition.'));
  for(const item of proposals){
   const statuses={pending:'À examiner',approved:'Appliquée',rejected:'Refusée'};
   const row=details(corrections,item.name+' · '+statuses[item.status]);
   row.append(element('p',(item.author??'Ancien compte')+(item.reason?' · '+item.reason:'')));
   const table=element('table');table.className='proposal-diff';
   const header=element('tr');for(const label of ['Champ','Valeur actuelle à la proposition','Valeur proposée'])header.append(element('th',label));table.append(header);
   const labels={name:'Nom',brand:'Marque',foodCategory:'Catégorie',nutrientsPer100g:'Nutrition / 100 g',gramsPerUnit:'Mesures (g)',gramsPerMillilitre:'Densité',cookingFactor:'Coefficient de cuisson',aliases:'Autres noms'};
   const display=value=>value==null?'—':typeof value==='object'?Object.entries(value).map(([key,item])=>key+' : '+(item??'—')).join(' · '):String(value);
   for(const [key,label] of Object.entries(labels)){
    if(JSON.stringify(item.before[key]??null)===JSON.stringify(item.proposed[key]??null))continue;
    const tr=element('tr');for(const value of [label,display(item.before[key]),display(item.proposed[key])])tr.append(element('td',value));table.append(tr);
   }row.append(table);
   if(session.account.applicationAdmin&&item.status==='pending')for(const [status,label] of [['approved','Appliquer au catalogue'],['rejected','Refuser']])form(row,label,async()=>{
    await api('/api/community/food-proposals/'+item.id,{method:'PUT',body:JSON.stringify({status})});await loadCommunity();
   });
  }
 }
 document.querySelector('#bootstrap-load').addEventListener('click',async()=>{
  const form=document.querySelector('#bootstrap-form'),message=document.querySelector('#bootstrap-message');
  try{
   const info=await api('/api/accounts/bootstrap-info',{method:'POST',body:JSON.stringify({applicationPassword:form.elements.applicationPassword.value})});
   const house=form.elements.householdId,profile=form.elements.personId;
   house.replaceChildren(new Option('Créer mon premier foyer',''),...info.households.map(h=>new Option(h.name,h.id)));
   if(info.households.length)house.value=info.households[0].id;
   const populate=()=>profile.replaceChildren(new Option('Créer un profil à mon nom',''),...info.people.filter(p=>p.householdId===house.value).map(p=>new Option(p.displayName,p.id)));
   house.onchange=populate;populate();
   profile.onchange=()=>{const person=info.people.find(p=>p.id===profile.value);if(person)form.elements.displayName.value=person.displayName;};
   message.textContent='Sélectionne ton foyer et ton profil existants pour les reprendre.';
  }catch(error){message.textContent=accountMessage(error);}
 });
 document.querySelector('#bootstrap-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type=submit]');if(button.disabled)return;button.disabled=true;
  try{
   const data=Object.fromEntries(new FormData(form));if(!data.householdId)delete data.householdId;
   session=await api('/api/accounts/bootstrap',{method:'POST',body:JSON.stringify(data)});
   document.querySelector('#bootstrap-dialog').close();onSession(session);location.reload();
  }catch(error){document.querySelector('#bootstrap-message').textContent=accountMessage(error);}
  finally{button.disabled=false;}
 });
 return {renderSession,load,loadCommunity,changeHousehold,showSetup(){const dialog=document.querySelector('#bootstrap-dialog');if(!dialog.open)dialog.showModal();}};
}
