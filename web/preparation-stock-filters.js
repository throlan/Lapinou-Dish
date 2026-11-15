const epsilon=1e-8;
export const preparationStockFilters=[['active','Stocks et besoins'],['remaining','Stocks restants'],['needed','À refaire'],['all','Tout afficher · historique inclus']];
export function filterPreparationStock(stock,filter='active'){
 return stock.filter(item=>{
  const physical=Number(item.physicalQuantity),reserved=Number(item.plannedQuantity);
  if(filter==='all')return true;
  if(filter==='remaining')return physical>epsilon;
  if(filter==='needed')return Number(item.availableQuantity)<-epsilon;
  return Math.abs(physical)>epsilon||Math.abs(reserved)>epsilon;
 });
}
