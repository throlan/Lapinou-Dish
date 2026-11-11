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
 'official-food-readonly':'Aliment officiel partagé. Duplique-le pour créer une variante privée.',
 'data-access-denied':'Cette donnée est protégée. Duplique un aliment officiel pour créer une variante privée.',
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
export function createAccountUI({api,onSession}){
 let session;
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
  const personal=section(root,'Mon compte');
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
 }
 async function members(){
  const block=section(root,'Comptes et profils du foyer');
  const [{members},{people}]=await Promise.all([api('/api/accounts/members'),api('/api/people?householdId='+session.account.householdId)]);
  const profiles=[['','Sans profil personnel'],...people.map(p=>[p.id,p.displayName])];
  const roles=[['member','Membre'],['manager','Gestionnaire et membre']];
  for(const member of members){
   const row=details(block,member.displayName+' · '+member.login);
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
  const block=section(root,'Administration de l’application');
  const accounts=details(block,'Gestion des comptes');
  const create=form(accounts,'Créer un compte',async value=>{
   await api('/api/accounts/application',{method:'POST',body:JSON.stringify(value)});await load();
  });
  field(create,'Identifiant','login');field(create,'Nom','displayName');field(create,'Mot de passe initial','password','password');
  for(const item of data.accounts){
   const row=details(accounts,item.displayName+' · '+item.login);
   const edit=form(row,'Enregistrer le compte',async value=>{
    await api('/api/accounts/application/'+item.id,{method:'PUT',body:JSON.stringify({...value,active:value.active==='yes',applicationAdmin:value.applicationAdmin==='yes'})});
    if(item.id===session.account.id)location.reload();else await load();
   });
   field(edit,'Identifiant','login','text',item.login);field(edit,'Nom du compte','displayName','text',item.displayName);
   select(edit,'Accès à l’application','active',[['yes','Actif'],['no','Désactivé']],item.active?'yes':'no');
   select(edit,'Administration de l’application','applicationAdmin',[['no','Non'],['yes','Oui']],item.applicationAdmin?'yes':'no');
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
   const row=details(houses,house.name);
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
  const packages=section(community,'Packages de démarrage');
  if(!data.packages.length)packages.append(element('p','L’administrateur de l’application peut composer un premier package à partir des recettes publiées.'));
  for(const pack of data.packages){
   const card=details(packages,pack.name);card.append(element('p',pack.description));
   if(session.account.applicationAdmin)button(card,'Retirer ce package',async()=>{await api('/api/community/packages/'+pack.id,{method:'DELETE'});await loadCommunity();});
   const choices=[];
   for(const id of pack.publicationIds){
    const publication=data.publications.find(p=>p.id===id);
    if(!publication)continue;
    const label=element('label',publication.name),check=document.createElement('input');check.type='checkbox';check.value=id;check.checked=true;
    label.prepend(check);card.append(label);choices.push(check);
   }
   if(manager)button(card,'Ajouter les recettes cochées à mon foyer',async()=>{
    try{
     const result=await api('/api/community/packages/import',{method:'POST',body:JSON.stringify({packageId:pack.id,publicationIds:choices.filter(c=>c.checked).map(c=>c.value)})});
     card.append(element('p',result.results.length+' recette(s) ajoutée(s) ou déjà présente(s).'));
    }catch(error){card.append(element('p',accountMessage(error)));}
   });
  }
  if(manager){
   const publish=section(community,'Partager un aliment ou une recette');
   publish.append(element('p','La publication rend le contenu et les ingrédients nécessaires accessibles aux autres foyers. Les destinataires en récupèrent une copie privée.'));
   const create=form(publish,'Publier dans le catalogue partagé',async value=>{
    await api('/api/community/publish',{method:'POST',body:JSON.stringify(value)});await loadCommunity();
   });
   const kind=select(create,'Type','kind',[['recipe','Recette'],['food','Aliment']],'recipe');
   const search=field(create,'Rechercher dans mon catalogue','search','search','',false);
   const source=select(create,'À partager','id',[],'');
   const populate=async()=>{
    const items=kind.value==='recipe'
     ?(await api('/api/recipes?householdId='+session.account.householdId)).recipes.filter(r=>!r.recipeArchived&&r.name.toLowerCase().includes(search.value.toLowerCase()))
     :(await api('/api/foods?limit=250&q='+encodeURIComponent(search.value))).foods;
    source.replaceChildren(...items.map(item=>new Option(item.name,item.id)));
   };
   let timer;search.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>populate().catch(()=>{}),250);});
   kind.addEventListener('change',()=>populate().catch(()=>{}));await populate();
  }
  const shared=section(community,'Catalogue partagé');
  for(const publication of data.publications){
   const row=details(shared,publication.name+' · '+(publication.kind==='recipe'?'Recette':'Aliment'));
   row.addEventListener('toggle',async()=>{
    if(!row.open||row.dataset.loaded)return;row.dataset.loaded='true';
    try{
     const {payload}=await api('/api/community/publications/'+publication.id);
     row.append(element('p','Ingrédients · '+payload.foods.map(food=>food.name).join(', ')));
     const rootRecipe=payload.recipes.find(recipe=>recipe.id===payload.rootId);if(rootRecipe?.instructions)row.append(element('p',rootRecipe.instructions));
    }catch(error){row.dataset.loaded='';row.append(element('p',accountMessage(error)));}
   });
   if(manager)button(row,'Ajouter une copie à mon foyer',async()=>{
    try{const result=await api('/api/community/import',{method:'POST',body:JSON.stringify({publicationId:publication.id})});row.append(element('p',result.replayed?'Cette publication a déjà été ajoutée.':'Copie ajoutée à ton foyer.'));}
    catch(error){row.append(element('p',accountMessage(error)));}
   });
   if((manager&&publication.mine)||session.account.applicationAdmin)button(row,'Retirer du partage',async()=>{
    if(!confirm('Retirer cette publication du catalogue partagé ? Les copies déjà récupérées resteront chez leurs destinataires.'))return;
    await api('/api/community/publications/'+publication.id,{method:'DELETE'});await loadCommunity();
   });
  }
  if(session.account.applicationAdmin){
   const admin=section(community,'Composer un package officiel');
   const selected=[];
   const create=form(admin,'Créer le package de démarrage',async value=>{
    await api('/api/community/packages',{method:'POST',body:JSON.stringify({...value,publicationIds:selected.filter(x=>x.checked).map(x=>x.value)})});await loadCommunity();
   });
   field(create,'Nom du package','name');field(create,'Description','description','text','',false);
   for(const publication of data.publications.filter(p=>p.kind==='recipe')){
    const label=element('label',publication.name),check=document.createElement('input');check.type='checkbox';check.value=publication.id;label.prepend(check);create.append(label);selected.push(check);
   }
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
