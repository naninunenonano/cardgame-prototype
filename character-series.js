(function(root){
'use strict';
function install(catalog,branches=[]){
 const series={};
 for(const card of Object.values(catalog.cards)){
  if(card.type!=='キャラクター')continue;
  const levels=Object.fromEntries([1,2,3,4].map(level=>{
   const common=catalog.characterLevels[level];
   return [level,{cost:card.growthCosts?.[level]??common.cost,growth:card.characterEffects?.[level]??common.effects,text:card.levelTexts?.[level]??common.text}];
  }));
  series[card.key]={...card,characterId:card.key,seriesName:'基本進化系列',baseSeries:true,levels};
 }
 for(const {id,characterId,rarity,name,levels} of branches){
  const base=series[characterId];
  if(!base?.baseSeries||typeof id!=='string'||!/^[a-z0-9_]+$/.test(id)||Object.hasOwn(series,id)||Object.hasOwn(catalog.cards,id)||
     rarity!=='UR'||![1,2,3,4].every(level=>levels?.[level]))throw Error('進化系列の定義が不正です。');
  series[id]={...base,key:id,rarity,seriesName:name,baseSeries:false,levels};
 }
 catalog.evolutionSeries=series;
 catalog.seriesFor=characterId=>Object.values(series).filter(s=>s.characterId===characterId);
 catalog.collectibleCard=key=>Object.hasOwn(series,key)?series[key]:Object.hasOwn(catalog.cards,key)?catalog.cards[key]:undefined;
 catalog.collectibleCards=()=>Object.values(catalog.cards).map(c=>series[c.key]||c).concat(Object.values(series).filter(s=>!s.baseSeries));
 return catalog;
}
root.CharacterSeries={install};
if(typeof module==='object'&&module.exports)module.exports=root.CharacterSeries;
})(globalThis);
