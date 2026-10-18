import {toGrams} from '../domain/foods.ts';
const frenchNumber = value => new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(value);
const normalizedName = name => String(name ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

// Purchase units are display hints only. Recipe quantities and nutrition stay in their original units.
export function purchaseDescription(item) {
  const name=normalizedName(item.name),quantity=Number(item.quantity),needed=Number(item.neededQuantity);
  const unit=item.unitId,defaultText=`${frenchNumber(quantity)} ${unit}`;
  if(item.packageQuantity) return {text:`${frenchNumber(item.packageCount)} × ${frenchNumber(item.packageQuantity)} ${unit}`,
    detail:`Besoin : ${frenchNumber(needed)} ${unit}`};
  if(item.purchaseRuleApplied && item.purchaseRule) {
    const rule=item.purchaseRule,count=Math.ceil((needed-1e-9)/rule.coveredQuantity);
    const sources=item.sourceNeeds?.length?item.sourceNeeds:[{quantity:needed,unitId:unit}];
    const needs=sources.map(source=>`${frenchNumber(source.quantity)} ${source.unitId}`).join(' + ');
    return {text:`${count} ${count===1?rule.singularLabel:rule.pluralLabel}`,
      detail:`Besoin : ${needs} · 1 ${rule.singularLabel} ≈ ${frenchNumber(rule.coveredQuantity)} ${rule.coveredUnitId}${rule.estimateNote?` · ${rule.estimateNote}`:''}`};
  }
  if(/^ail(?:,|$)/.test(name) && unit==='piece') {
    const cloves=Math.ceil(quantity),bulbs=Math.ceil(cloves/9);
    return {text:`${bulbs} ${bulbs===1?'tête':'têtes'} d’ail`,
      detail:`${cloves} ${cloves===1?'gousse':'gousses'} nécessaires (≈ ${frenchNumber(cloves/9)} tête)`};
  }
  if(/^basilic(?:,|$)/.test(name)) {
    if(unit==='piece')return {text:`${Math.ceil(quantity)} ${quantity<=1?'bouquet':'bouquets'} de basilic`,detail:`Besoin : ${frenchNumber(needed)} bouquet(s)`};
    if(unit==='g')return {text:'1 bouquet de basilic (minimum)',detail:`Besoin : ${frenchNumber(needed)} g ; vérifier que le bouquet suffit`};
  }
  if(/^gingembre(?:,|$)/.test(name) && unit==='g') {
    const roots=Math.ceil(quantity/65);
    return {text:`${roots} ${roots===1?'racine':'racines'} de gingembre`,
      detail:`Besoin : ${frenchNumber(needed)} g · racine indicative 50–80 g (calcul à 65 g)`};
  }
  return {text:defaultText,detail:`Besoin : ${frenchNumber(needed)} ${unit}`};
}

export function suggestedPurchaseUnit(item) {
  const name=normalizedName(item.name);
  if(/^ail(?:,|$)/.test(name) && item.unitId==='piece')return {singularLabel:'tête d’ail',pluralLabel:'têtes d’ail',coveredQuantity:9,coveredUnitId:'piece',estimateNote:'Environ 9 gousses par tête'};
  if(/^basilic(?:,|$)/.test(name) && item.unitId==='piece')return {singularLabel:'bouquet de basilic',pluralLabel:'bouquets de basilic',coveredQuantity:1,coveredUnitId:'piece',estimateNote:''};
  if(/^gingembre(?:,|$)/.test(name) && item.unitId==='g')return {singularLabel:'racine de gingembre',pluralLabel:'racines de gingembre',coveredQuantity:65,coveredUnitId:'g',estimateNote:'Une racine pèse environ 50–80 g'};
  return null;
}

// Entry follows an explicit purchase rule/pack, while the stock APIs continue
// receiving the underlying documented food unit. No parsing of display labels.
export function purchaseEntry(item) {
  let multiplier=1,label=item.unitId==='piece'?'pièces':item.unitId,quantity=Number(item.quantity),kind='native',detail='';
  if(item.packageQuantity>0){
    multiplier=Number(item.packageQuantity);label='paquets';quantity=Number(item.packageCount);kind='package';
    detail=`1 paquet = ${frenchNumber(multiplier)} ${item.unitId}`;
  }else if(item.purchaseRuleApplied&&item.purchaseRule?.coveredQuantity>0&&item.purchaseRule.coveredUnitId===item.unitId){
    multiplier=Number(item.purchaseRule.coveredQuantity);label=item.purchaseRule.pluralLabel;
    quantity=Math.ceil((Number(item.neededQuantity)-1e-9)/multiplier);kind='purchase';
    detail=`1 ${item.purchaseRule.singularLabel} = ${frenchNumber(multiplier)} ${item.unitId}`;
  }
  return {kind,label,quantity,multiplier,unitId:item.unitId,step:kind!=='native'||item.unitId==='piece'?'1':'any',
    gramsPerEntry:toGrams(multiplier,item.unitId,{gramsPerUnit:item.gramsPerUnit??{},gramsPerMillilitre:item.gramsPerMillilitre??null}),detail};
}

export function shoppingExportLine(item) {
  const purchase=purchaseDescription(item);
  return `${item.name} — ${purchase.text}`;
}

export function shoppingExportDescription(item) {
  return purchaseDescription(item).detail;
}
