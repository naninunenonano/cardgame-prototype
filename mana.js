// DOM・配置処理に依存しないコスト／マナ判定。将来のマナプールでもpoolを再利用できる。
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.ManaEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const colors=['白','青','黒','赤','緑'];
  function cost(generic=0,colored={}) {
    const result={generic,...Object.fromEntries(colors.map(color=>[color,colored[color]||0]))};
    if(Object.values(result).some(n=>!Number.isInteger(n)||n<0))throw Error('コストは0以上の整数です。');
    return result;
  }
  function total(required){return required.generic+colors.reduce((n,color)=>n+required[color],0);}
  function pool(lands) {
    const result={total:0,...Object.fromEntries(colors.map(color=>[color,0]))};
    for(const land of lands) {
      const mana=land.mana;
      if(land.type!=='土地'||land.rest||!mana||!colors.includes(mana.color)||!Number.isInteger(mana.amount)||mana.amount<=0)continue;
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
    // 今回は1枚1点。必要以上の土地を選んで誤消費しない。
    if(lands.every(c=>c.mana?.amount===1)&&lands.length>total(required))result.reasons.push(`土地の選択過多：${total(required)}枚を選んでください`);
    result.ok=result.reasons.length===0;
    return result;
  }
  function suggest(required,lands) {
    const usable=lands.filter(c=>c.type==='土地'&&!c.rest&&c.mana&&colors.includes(c.mana.color)&&c.mana.amount>0);
    if(!assess(required,pool(usable)).ok)return [];
    const picked=[],chosen=new Set();
    // 必須色をすべて確保してから、残りの土地を不特定部分に割り当てる。
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
  return {colors,cost,total,pool,assess,payment,suggest,describe};
});
