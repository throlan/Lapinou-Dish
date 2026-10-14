const frenchNumber = value => new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(value);
const normalizedName = name => String(name ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

// Purchase units are display hints only. Recipe quantities and nutrition stay in their original units.
export function purchaseDescription(item) {
  const name=normalizedName(item.name),quantity=Number(item.quantity),needed=Number(item.neededQuantity);
  const unit=item.unitId,defaultText=`${frenchNumber(quantity)} ${unit}`;
  if(item.packageQuantity) return {text:`${frenchNumber(item.packageCount)} × ${frenchNumber(item.packageQuantity)} ${unit}`,
    detail:`Besoin : ${frenchNumber(needed)} ${unit}`};
  if(/^ail(?:,|$)/.test(name) && unit==='piece') {
    const cloves=Math.ceil(quantity),bulbs=Math.ceil(cloves/9);
    return {text:`${bulbs} ${bulbs===1?'tête':'têtes'} d’ail`,
      detail:`${cloves} ${cloves===1?'gousse':'gousses'} nécessaires (≈ ${frenchNumber(cloves/9)} tête)`};
  }
  if(/^basilic(?:,|$)/.test(name)) {
    if(unit==='piece')return {text:`${Math.ceil(quantity)} ${quantity<=1?'bouquet':'bouquets'} de basilic`,detail:`Besoin : ${frenchNumber(needed)} bouquet(s)`};
    if(unit==='g')return {text:'Basilic en bouquet',detail:`Besoin : ${frenchNumber(needed)} g ; taille du bouquet à vérifier`};
  }
  if(/^gingembre(?:,|$)/.test(name) && unit==='g') {
    const roots=Math.ceil(quantity/65);
    return {text:`${roots} ${roots===1?'racine':'racines'} de gingembre`,
      detail:`Besoin : ${frenchNumber(needed)} g · racine indicative 50–80 g (calcul à 65 g)`};
  }
  return {text:defaultText,detail:`Besoin : ${frenchNumber(needed)} ${unit}`};
}

export function shoppingExportLine(item) {
  const purchase=purchaseDescription(item);
  return `${item.name} — ${purchase.text}${purchase.detail ? ` (${purchase.detail})` : ''}`;
}
