// Policy consumes only the redacted observation. It never receives Game or hidden state.
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./mana.js'):root.ManaEngine);if(typeof module==='object'&&module.exports)module.exports=api;else root.BotPolicy=api;})(globalThis,function(M){
'use strict';
const other=p=>p==='p1'?'p2':'p1',total=c=>c.cost?M.total(c.cost):0;
const best=(a,score)=>a.slice().sort((x,y)=>score(y)-score(x)||String(x.id).localeCompare(String(y.id)))[0];
function unitValue(c,lands=0){return (c.power||0)/1000+(c.breaks||0)*5+Object.values(c.symbols||{}).reduce((a,b)=>a+b,0)*2+(c.lure?12:0)+(c.manaAbility?(lands<6?15:3):0)+(c.abilities?.includes('ブロッカー')?10:0);}
function context(v){const p=v.viewer,e=other(p),me=v.players[p],enemy=v.players[e];const supply=me.counts.landDeck+me.counts.landTrash;const damage=enemy.units.reduce((n,c)=>n+(c.breaks||0),0);const danger=enemy.units.length>0&&me.counts.life<=damage&&!me.units.some(c=>c.lure&&(c.power||0)>Math.max(0,...enemy.units.map(x=>x.power||0)));return {p,e,me,enemy,supply,danger};}
function replacement(v){const {me}=context(v);return best(me.units,c=>-unitValue(c,me.landCount));}
function wipeGain(v){const {me,enemy}=context(v);return enemy.units.reduce((n,c)=>n+unitValue(c,enemy.landCount),0)+enemy.structures.length*9-me.units.reduce((n,c)=>n+unitValue(c,me.landCount),0)-me.structures.length*9;}
function motherTarget(v,targets){const {p,me,enemy,danger}=context(v);const possible=me.hand.filter(c=>c.type==='通常'&&total(c)<=me.landCount);const upgrade=best(possible,c=>unitValue(c,me.landCount)+(c.key==='bronze'?8:0)+(c.key==='bahamut'?wipeGain(v):0));
 return best(targets,c=>c.owner===p?(upgrade?unitValue(upgrade,me.landCount)-unitValue(c,me.landCount)+2:-100):unitValue(c,enemy.landCount)-(enemy.counts.hand?10:0)-(enemy.landCount>=8?7:3)+(danger?8:0));}
function motherGain(v){const {p,me,enemy,danger}=context(v),c=motherTarget(v,[...me.units,...enemy.units]);if(!c)return -100;if(c.owner!==p)return unitValue(c,enemy.landCount)-(enemy.counts.hand?10:0)-(enemy.landCount>=8?7:3)+(danger?8:0);const choices=me.hand.filter(x=>x.type==='通常'&&total(x)<=me.landCount);return Math.max(-100,...choices.map(x=>unitValue(x,me.landCount)+(x.key==='bronze'?8:0)-unitValue(c,me.landCount)));}
function playScore(v,c){const {me,enemy,supply,danger}=context(v),canRefill=me.counts.main+me.counts.trash>0;let score=-100;
 if(c.type==='通常'){
  score=unitValue(c,me.landCount)+8;
  if(c.manaAbility)score+=me.landCount<6?45:0;
  if(c.key==='bronze')score+=supply?(me.landCount<8?35:10):0;
  if(c.key==='panzer'&&danger)score+=65;
  if(c.key==='dolt'&&enemy.units.some(x=>(x.power||0)<=c.power))score+=18;
  if(c.key==='bahamut'){const gain=wipeGain(v);if(gain<=0&&(me.units.length||me.structures.length))return -100;score+=gain;}
  if(me.units.length>=7){const old=replacement(v);if(unitValue(c,me.landCount)<=unitValue(old,me.landCount)+3)return -100;score-=unitValue(old,me.landCount);}
 }else if(c.key==='zundoko'){
  const remaining=v.sources.length-M.total(c.effectiveCost||c.cost),follow=me.hand.some(x=>x.type==='通常'&&M.total(x.effectiveCost||x.cost)<=remaining);
  score=supply&&me.landCount<16?(follow?60:me.hand.some(x=>x.type==='通常')?8:-10):-100;
 }else if(c.key==='life')score=supply?(me.landCount<8?48:me.landCount<13?12:-5):-100;
 else if(c.key==='fortune')score=(supply?(me.landCount<8?45:10):0)+(me.landCount+(supply?1:0)<=5&&canRefill?15:0); 
 else if(c.key==='touki')score=(supply?12:0)+(canRefill?18:0)+(danger&&canRefill?35:0);
 else if(c.key==='repair')score=canRefill?(danger?85:me.counts.life<4?18:-5):-100;
 else if(c.key==='trap'){const threat=best(enemy.units,c=>unitValue(c,enemy.landCount));score=threat?unitValue(threat,enemy.landCount)+(danger?50:0)-8-(enemy.landCount<6?5:0):-100;}
 else if(c.key==='mother')score=motherGain(v)+(danger?20:0);
 // An untapped mana creature may be a winning attacker; otherwise reserve it when feasible.
 const usedUnits=(c.paymentPlan?.sourceIds||[]).filter(id=>v.sources.some(s=>s.id===id&&s.unit)).length;
 return score-usedUnits*(enemy.counts.life===0?25:3);
}
function attackChoice(v,attacks=v.attacks){const {me,enemy,p}=context(v);const choices=[];
 for(const entry of attacks)for(const t of entry.targets){const a=entry.card;if(t.id==='body'){
   if(enemy.counts.life===0){choices.push({id:a.id,target:'body',score:10000-unitValue(a,me.landCount)});continue;}
   if(!(a.breaks>0))continue;
   const strongest=best(enemy.units.filter(c=>!c.rest&&c.abilities?.includes('ブロッカー')),c=>c.power||0);
   if(strongest&&strongest.power>a.power&&me.units.filter(c=>!c.rest&&!c.sick).length<=1)continue;
   if(a.abilities?.includes('ブロッカー')&&me.counts.life===0&&enemy.units.length)continue;
   choices.push({id:a.id,target:'body',score:(a.breaks||0)*20+(a.power||0)/10000-(a.manaAbility?10:0)});
  }else{const b=enemy.units.find(c=>c.id===t.id);if(!b||(a.power||0)<(b.power||0))continue;
   choices.push({id:a.id,target:t.id,score:unitValue(b,enemy.landCount)+15+(b.lure?80:0)+(a.key==='dolt'?20:0)});
  }}return best(choices,c=>c.score);}
function chooseBlock(v,o){const {me,enemy}=context(v),a=o.attacker;if(!a||!o.blockers.length)return null;
 const value=c=>unitValue(c,me.landCount),cheap=best(o.blockers,c=>-value(c)),winning=o.blockers.filter(c=>(c.power||0)>(a.power||0));
 if(me.counts.life===0)return (best(winning,c=>-value(c))||cheap).id;
 if(!(a.breaks>0))return null;
 const remaining=enemy.units.filter(c=>c.id!==a.id&&!c.rest&&!c.sick),after=Math.max(0,me.counts.life-a.breaks);let shields=after,lethal=false;
 for(const c of remaining.slice().sort((a,b)=>(b.breaks||0)-(a.breaks||0))){if(shields===0){lethal=true;break;}shields=Math.max(0,shields-(c.breaks||0));}
 if(lethal||winning.length)return (best(winning,c=>-value(c))||cheap).id;
 return null;
}
function keepScore(v,c){const {me,danger,supply}=context(v);let n=c.type==='通常'?unitValue(c,me.landCount)+10:12;
 if(c.manaAbility)n+=me.landCount<6?35:-5;
 if(['life','fortune','bronze'].includes(c.key))n+=supply&&me.landCount<8?35:-25;
 if(c.key==='repair')n+=danger?65:me.counts.life<4?20:0;
 if(c.key==='trap')n+=danger?45:10;
 if(c.key==='mother')n+=Math.max(0,motherGain(v));
 if(c.key==='bahamut')n+=wipeGain(v)*.3;
 if(total(c)>v.sources.length+3)n-=15;
 n-=Math.max(0,me.hand.filter(x=>x.key===c.key).length-1)*5;return n;
}
function triggerScore(v,c){const {enemy,me}=context(v);if(c.key==='repair')return me.counts.main+me.counts.trash>0?100:-100;if(c.key==='panzer')return me.units.length<7||unitValue(c,me.landCount)>unitValue(replacement(v),me.landCount)+3?80:-100;if(c.key==='trap')return enemy.units.length?60:-100;return playScore(v,c);}
function decide(v){
 if(v.result||v.actor!==v.viewer)return {type:'wait'};const {me,p,enemy}=context(v),o=v.operation;
 if(v.status==='mulligan'){
  const counts={};const ids=me.hand.filter(c=>{counts[c.key]=(counts[c.key]||0)+1;return total(c)>4||counts[c.key]>2||(c.key==='repair'&&counts[c.key]>1);}).map(c=>c.id);return {type:'mulligan',ids};
 }
 if(o){
  if(o.kind==='payment'){const c=me.hand.find(c=>c.id===o.id);if(c?.type==='通常'&&!o.slot){const slot=best(o.slots,s=>s.card?-unitValue(s.card,me.landCount):10000);return {type:'slot',slot:slot.id};}return {type:'pay'};}
  if(['freePlace','triggerPlace'].includes(o.kind)){if(!o.slot){const slot=best(o.slots,s=>s.card?-unitValue(s.card,me.landCount):10000);return {type:'slot',slot:slot.id};}return {type:'freePlace'};}
  if(o.kind==='freeUnit'){const c=best(o.candidates,c=>playScore(v,c));return {type:'freeUnit',id:c&&playScore(v,c)>0?c.id:null};}
  if(o.kind==='effectTarget'){const c=o.effect==='mother'?motherTarget(v,o.candidates):best(o.candidates,c=>unitValue(c,enemy.landCount));return {type:'target',id:c.id};}
  if(o.kind==='triggers'){const cards=o.ids.map(id=>me.hand.find(c=>c.id===id)).filter(Boolean),c=best(cards,c=>triggerScore(v,c));return {type:'trigger',id:c.id,use:triggerScore(v,c)>0};}
  if(o.kind==='combat')return {type:'block',id:chooseBlock(v,o)};
  if(o.kind==='attackTarget'){const c=me.units.find(c=>c.id===o.id),a=attackChoice(v,[{card:c,targets:o.targets}]);return a?{type:'attackTarget',target:a.target}:{type:'cancelAttackTarget'};}
  if(o.kind==='discard')return {type:'discard',ids:me.hand.slice().sort((a,b)=>keepScore(v,a)-keepScore(v,b)||a.id.localeCompare(b.id)).slice(0,o.required).map(c=>c.id)};
  return {type:'wait'};
 }
 if(['main1','main2'].includes(v.turn.step)){
  // Preserve an immediate direct win rather than tapping its mana creature to deploy more cards.
  if(v.turn.step==='main1'&&enemy.counts.life===0&&!enemy.units.some(c=>c.lure)&&me.units.some(c=>!c.rest&&!c.sick))return {type:'advance'};
  const c=best(me.hand.filter(c=>c.canPlay),c=>playScore(v,c));if(c&&playScore(v,c)>0)return {type:'play',id:c.id};
 }else if(v.turn.step==='attack'){const a=attackChoice(v);if(a)return {type:'attack',id:a.id,target:a.target};}
 return v.canAdvance?{type:'advance'}:{type:'wait'};
}
return {decide,unitValue,playScore,chooseBlock,keepScore};
});
