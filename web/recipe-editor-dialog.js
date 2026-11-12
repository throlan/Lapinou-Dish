export function createRecipeEditorDialog(doc=document){
 const dialog=doc.querySelector('#recipe-editor-dialog'),form=doc.querySelector('#recipe-form');
 const tabs=[...dialog.querySelectorAll('[data-recipe-editor-tab]')],panels=[...dialog.querySelectorAll('[data-recipe-editor-panel]')];
 const body=dialog.querySelector('.recipe-editor-body'),previous=doc.querySelector('#recipe-editor-previous'),next=doc.querySelector('#recipe-editor-next'),save=doc.querySelector('#save-recipe');
 const win=doc.defaultView;let index=0,busy=false,baseline='',opener=null,openerLabel=null,pageScroll=0;
 const snapshot=()=>JSON.stringify([...form.querySelectorAll('input,select,textarea')].map(field=>[field.type,field.value,field.checked??null]));
 function select(key,{focus=false}={}){
  const selected=tabs.findIndex(tab=>tab.dataset.recipeEditorTab===key);if(selected<0)return;
  index=selected;
  tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;});
  panels.forEach(panel=>{panel.hidden=panel.dataset.recipeEditorPanel!==key;});
  previous.disabled=busy||index===0;next.disabled=busy||index===tabs.length-1;body.scrollTop=0;
  if(focus)tabs[index].focus({preventScroll:true});
 }
 function setBusy(value){busy=value;body.inert=value;tabs.forEach(tab=>{tab.disabled=value;});previous.disabled=value||index===0;next.disabled=value||index===tabs.length-1;save.disabled=value;save.textContent=value?'Enregistrement…':'Enregistrer et calculer';form.setAttribute('aria-busy',String(value));}
 function open(){
  opener=doc.activeElement;openerLabel=opener?.getAttribute('aria-label');pageScroll=win.scrollY;
  form.classList.remove('hidden');select(tabs[0].dataset.recipeEditorTab);baseline=snapshot();setBusy(false);
  if(!dialog.open)dialog.showModal();form.elements.name.focus({preventScroll:true});
 }
 function close({discard=false}={}){
  if(!dialog.open)return true;
  if(busy&&!discard)return false;
  if(!discard&&snapshot()!==baseline&&!win.confirm('Quitter sans enregistrer les modifications de cette recette ?'))return false;
  dialog.close();form.classList.add('hidden');
  let target=opener?.isConnected?opener:null;
  if(!target&&openerLabel)target=[...doc.querySelectorAll('button[aria-label]')].find(button=>button.getAttribute('aria-label')===openerLabel);
  if(target?.closest('details')&&!target.closest('details').open)target=target.closest('details').querySelector('summary');
  (target??doc.querySelector('[data-view="recipes"]'))?.focus({preventScroll:true});const restore=()=>win.scrollTo({top:pageScroll,behavior:'instant'});restore();win.requestAnimationFrame?.(restore);return true;
 }
 function validate(){
  const invalid=[...form.elements].find(field=>field.willValidate&&!field.validity.valid);
  if(!invalid)return true;
  const panel=invalid.closest('[data-recipe-editor-panel]');if(panel)select(panel.dataset.recipeEditorPanel);
  for(let parent=invalid.parentElement;parent&&parent!==form;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
  invalid.focus();invalid.reportValidity();return false;
 }
 tabs.forEach(tab=>{
  tab.addEventListener('click',()=>select(tab.dataset.recipeEditorTab));
  tab.addEventListener('keydown',event=>{
   const positions={ArrowRight:(index+1)%tabs.length,ArrowLeft:(index+tabs.length-1)%tabs.length,Home:0,End:tabs.length-1};
   if(Object.hasOwn(positions,event.key)){event.preventDefault();select(tabs[positions[event.key]].dataset.recipeEditorTab,{focus:true});}
  });
 });
 previous.addEventListener('click',()=>select(tabs[Math.max(0,index-1)].dataset.recipeEditorTab,{focus:true}));
 next.addEventListener('click',()=>select(tabs[Math.min(tabs.length-1,index+1)].dataset.recipeEditorTab,{focus:true}));
 doc.querySelector('#recipe-editor-cancel').addEventListener('click',()=>close());
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 return {open,close,select,validate,setBusy,isBusy:()=>busy,isOpen:()=>dialog.open};
}
