// DOM・配置処理に依存しないコスト／マナ判定。将来のマナプールでもpoolを再利用できる。
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.ManaEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const colors=['白','青','黒','赤','緑'],manaColors=[...colors,'無色'];
  function cardColors(c){return c.civilizations||[c.color||'無色'];}
  function hasColor(c,color){return cardColors(c).includes(color);}
  function producedColors(c){const a=c.civilizations||c.manaColors||[c.color];return [...new Set(a)].filter(k=>manaColors.includes(k));}
  function cost(generic=0,colored={}) {
    const result={generic,...Object.fromEntries(colors.map(color=>[color,colored[color]||0]))};
    if(Object.values(result).some(n=>!Number.isInteger(n)||n<0))throw Error('コストは0以上の整数です。');
    return result;
  }
  function total(required){return required.generic+colors.reduce((n,color)=>n+required[color],0);}
  // A paid card requires one mana of each civilization. Generic mana can use any color.
  function cardCost(required, card) {
    const amount=total(required);
    if(!amount)return cost(0);
    const requiredColors=colors.filter(color=>hasColor(card,color));
    if(amount<requiredColors.length)throw Error('カードの合計コストが必須色数より少なくなっています。');
    return cost(amount-requiredColors.length,Object.fromEntries(requiredColors.map(color=>[color,1])));
  }
  function evolutionBaseCost(required, base, matchesCharacter, color='青', extra=0) {
    const discount=base?.type==='通常'&&cardColors(base).length===1&&hasColor(base,'無色')&&base.cost?total(base.cost):0;
    if(!required[color]||!(discount||extra))return {...required};
    // These cards originally discount their entire single-color cost, including
    // the last mana when their matching-character condition is met.
    const generic=Math.max(0,required.generic-discount-extra);
    const remainingDiscount=Math.max(0,discount+extra-required.generic);
    return {...required,generic,[color]:Math.max(matchesCharacter?0:1,required[color]-remainingDiscount)};
  }
  function pool(lands) {
    const result={total:0,...Object.fromEntries(manaColors.map(color=>[color,0]))};
    for(const land of lands) {
      const mana=land.mana||{color:producedColors(land)[0],amount:1};
      if(land.rest||!mana||!manaColors.includes(mana.color)||!Number.isInteger(mana.amount)||mana.amount<=0)continue;
      result[mana.color]+=mana.amount;result.total+=mana.amount;
    }
    return result;
  }
  function assess(required,available) {
    const reasons=[];
    if(available.total<total(required))reasons.push(`合計マナ不足：あと${total(required)-available.total}必要`);
    for(const color of colors)if(available[color]<required[color])reasons.push(`${color}マナがあと${required[color]-available[color]}必要`);
    return {ok:reasons.length===0,reasons};
  }
  function payment(required,lands) {
    const result=assess(required,pool(lands));
    // 今回は1枚1点。必要以上のマナを選んで誤消費しない。
    if(lands.every(c=>c.mana?.amount===1)&&lands.length>total(required))result.reasons.push(`マナの選択過多：${total(required)}枚を選んでください`);
    result.ok=result.reasons.length===0;
    return result;
  }
  function suggest(required,lands) {
    const usable=lands.filter(c=>!c.rest&&c.mana&&manaColors.includes(c.mana.color)&&c.mana.amount>0);
    if(!assess(required,pool(usable)).ok)return [];
    const picked=[],chosen=new Set();
    // 必須色をすべて確保してから、残りのマナを不特定部分に割り当てる。
    for(const color of colors) {
      let remaining=required[color];
      for(const land of usable)if(remaining>0&&land.mana.color===color&&!chosen.has(land.id)){
        chosen.add(land.id);picked.push(land);remaining-=land.mana.amount;
      }
    }
    for(const land of usable)if(pool(picked).total<total(required)&&!chosen.has(land.id)){
      chosen.add(land.id);picked.push(land);
    }
    return picked.map(c=>c.id);
  }
  function describe(required) {
    const parts=[];
    if(required.generic)parts.push(`不特定${required.generic}`);
    for(const color of colors)if(required[color])parts.push(`${color}${required[color]}`);
    return parts.join('＋')||'0';
  }
  return {colors,manaColors,cardColors,hasColor,producedColors,cost,total,cardCost,evolutionBaseCost,pool,assess,payment,suggest,describe};
});
