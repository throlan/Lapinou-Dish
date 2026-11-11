export function recipePermissions(recipe,account){
 const curate=Boolean(account&&(account.applicationAdmin||account.role==='manager'));
 const edit=curate||Boolean(account?.id&&recipe?.createdByAccountId===account.id);
 return {curate,edit,remove:edit,rename:edit,photo:curate,duplicate:curate};
}
