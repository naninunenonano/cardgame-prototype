// Policy consumes only the redacted observation. It never receives Game or hidden state.
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./mana.js'):root.ManaEngine);if(typeof module==='object'&&module.exports)module.exports=api;else root.BotPolicy=api;})(globalThis,function(M){
'use strict';
const other=p=>p==='p1'?'p2':'p1',total=c=>c.cost?M.total(c.cost):0;
const best=(a,score)=>a.slice().sort((x,y)=>score(y)-score(x)||String(x.id).localeCompare(String(y.id)))[0];
function unitValue(c,lands=0){return (c.attack||0)+(c.health??c.maxHealth??0)+Object.values(c.symbols||{}).reduce((a,b)=>a+b,0)*2+(c.lure?12:0)+(c.manaAbility?(lands<6?15:3):0)+(c.abilities?.includes('ブロッカー')?10:0)+(c.unblockable?15:0)-(c.cannotAttack?6:0);}
function context(v){const p=v.viewer,e=other(p),me=v.players[p],enemy=v.players[e];const supply=me.counts.landDeck+me.counts.landTrash;const damage=enemy.units.filter(c=>!c.cannotAttack).reduce((n,c)=>n+(c.attack||0),0);const danger=enemy.units.length>0&&me.life<=damage&&!me.units.some(c=>c.lure&&c.health>Math.max(0,...enemy.units.map(x=>x.attack||0)));return {p,e,me,enemy,supply,danger};}
function replacement(v){const {me}=context(v);return best(me.units,c=>-unitValue(c,me.landCount));}
function wipeGain(v){const {me,enemy}=context(v);return enemy.units.reduce((n,c)=>n+unitValue(c,enemy.landCount),0)+enemy.structures.length*9-me.units.reduce((n,c)=>n+unitValue(c,me.landCount),0)-me.structures.length*9;}
function freeValue(v,c){const {me}=context(v);if(c.key==='bahamut'&&wipeGain(v)<=0&&(me.units.length||me.structures.length))return -100;return unitValue(c,me.landCount)+(c.key==='bronze'?8:0)+(c.key==='bahamut'?wipeGain(v):0);}
function motherTarget(v,targets){const {p,me,enemy,danger}=context(v);const possible=me.hand.filter(c=>c.type==='通常'&&total(c)<=me.landCount);const upgrade=best(possible,c=>freeValue(v,c));
 return best(targets,c=>c.owner===p?(upgrade?freeValue(v,upgrade)-unitValue(c,me.landCount)+2:-100):unitValue(c,enemy.landCount)-(enemy.counts.hand?10:0)-(enemy.landCount>=8?7:3)+(danger?8:0));}
function motherGain(v){const {p,me,enemy,danger}=context(v),c=motherTarget(v,[...me.units,...enemy.units]);if(!c)return -100;if(c.owner!==p)return unitValue(c,enemy.landCount)-(enemy.counts.hand?10:0)-(enemy.landCount>=8?7:3)+(danger?8:0);const choices=me.hand.filter(x=>x.type==='通常'&&total(x)<=me.landCount);return Math.max(-100,...choices.map(x=>freeValue(v,x)-unitValue(c,me.landCount)));}
function playScore(v,c){const {me,enemy,supply,danger}=context(v),canRefill=me.counts.main+me.counts.trash>0;let score=-100;
 if(c.type==='通常'){
  score=unitValue(c,me.landCount)+8;
  if(c.manaAbility)score+=me.landCount<6?45:0;
  if(c.key==='bronze')score+=supply?(me.landCount<8?35:10):0;
  if(c.evolution)score+=c.unblockable&&enemy.life<=Math.max(0,...me.units.map(c=>c.attack||0))?100:15;
  if(c.abilities?.includes('ブロッカー')&&danger)score+=25;
  if(c.key==='panzer'&&danger)score+=65;
  if(c.key==='dolt'&&enemy.units.some(x=>x.health<=c.attack))score+=18;
  if(c.key==='bahamut'){const gain=wipeGain(v);if(gain<=0&&(me.units.length||me.structures.length))return -100;score+=gain;}
  if(me.units.length>=7){const old=replacement(v);if(unitValue(c,me.landCount)<=unitValue(old,me.landCount)+3)return -100;score-=unitValue(old,me.landCount);}
 }else if(c.key==='themis'){const gain=enemy.units.reduce((n,x)=>n+unitValue(x,enemy.landCount),0)-me.units.reduce((n,x)=>n+unitValue(x,me.landCount),0);score=gain>0?gain+(danger?35:0):-100;}
 else if(c.key==='holyMail')score=me.life<=26?(danger?70:20):-100;
 else if(c.key==='repair')score=(me.life<30?25:0)+(me.shields?.some(c=>c.faceUp)?35:0)-5;
 else if(c.key==='fateWhim')score=canRefill?(me.units.some(c=>c.key==='jil')?55:30):-100;
 else if(c.key==='fateWings')score=me.units.length?35+(me.units.some(c=>c.key==='jil')&&canRefill?20:0):-100;
 else if(c.key==='fateReversal')score=me.units.some(c=>c.key==='jil')?75:enemy.units.length<me.units.length?35:5;
 else if(c.key==='vegas')score=me.structures.length<3?20:3;
 else if(c.key==='brain'||c.key==='shaper')score=canRefill?(me.hand.some(x=>x.key==='cosmo')&&me.hand.length<10?45:me.hand.length<6?35:8):-100;
 else if(c.key==='snow')score=me.units.length<5?40:5;
 else if(c.key==='gate')score=enemy.units.length||enemy.structures.length?(danger?65:12):-100;
 else if(c.key==='inquiry'||c.key==='vice')score=enemy.counts.hand?18:-100;
 else if(c.key==='zundoko'){
  const remaining=v.sources.length-M.total(c.effectiveCost||c.cost),follow=me.hand.some(x=>x.type==='通常'&&M.total(x.effectiveCost||x.cost)<=remaining);
  score=supply&&me.landCount<16?(follow?60:me.hand.some(x=>x.type==='通常')?8:-10):-100;
 }else if(c.key==='life')score=supply?(me.landCount<8?48:me.landCount<13?12:-5):-100;
 else if(c.key==='fortune')score=(supply?(me.landCount<8?45:10):0)+(me.landCount+(supply?1:0)<=5&&canRefill?15:0); 
 else if(c.key==='touki')score=(supply?12:0)+(canRefill?18:0);
 else if(c.key==='trap'){const threat=best(enemy.units,c=>unitValue(c,enemy.landCount));score=threat?unitValue(threat,enemy.landCount)+(danger?50:0)-8-(enemy.landCount<6?5:0):-100;}
 else if(c.key==='mother')score=motherGain(v)+(danger?20:0);
 // An untapped mana creature may be a winning attacker; otherwise reserve it when feasible.
 const usedUnits=(c.paymentPlan?.sourceIds||[]).filter(id=>v.sources.some(s=>s.id===id&&s.unit)).length;
 return score-usedUnits*(enemy.life<=Math.max(0,...me.units.map(c=>c.attack||0))?25:3);
}
function attackChoice(v,attacks=v.attacks){const {me,enemy}=context(v),choices=[];
 for(const entry of attacks)for(const t of entry.targets){const a=entry.card;
  if(t.id==='body'){
   const blockers=enemy.units.filter(c=>!c.rest&&c.abilities?.includes('ブロッカー'));
   const lethal=a.attack>=enemy.life&&(a.unblockable||!blockers.length);
   choices.push({id:a.id,target:'body',score:lethal?10000:a.attack*5-(a.manaAbility?3:0)});
  }else{const b=enemy.units.find(c=>c.id===t.id);if(!b)continue;
   const kill=a.attack>=b.health,survive=b.attack<a.health;
   const score=(kill?unitValue(b,enemy.landCount)+22:0)-(survive?0:unitValue(a,me.landCount))+ (a.key==='dolt'&&kill?20:0);
   if(score>0)choices.push({id:a.id,target:t.id,score});
  }}return best(choices,c=>c.score);}
function chooseBlock(v,o){const {me,enemy}=context(v),a=o.attacker;if(!a||!o.blockers.length)return null;
 const value=c=>unitValue(c,me.landCount),cheap=best(o.blockers,c=>-value(c));
 const favorable=o.blockers.filter(c=>c.attack>=a.health&&c.health>a.attack);
 const incoming=enemy.units.filter(c=>c.id!==a.id&&!c.rest&&!c.sick&&!c.cannotAttack).reduce((n,c)=>n+c.attack,0);
 if(a.attack+incoming>=me.life)return (best(favorable,c=>-value(c))||cheap).id;
 return best(favorable,c=>-value(c))?.id||null;
}
function keepScore(v,c){const {me,danger,supply}=context(v);let n=c.type==='通常'?unitValue(c,me.landCount)+10:12;
 if(c.manaAbility)n+=me.landCount<6?35:-5;
 if(['life','fortune','bronze'].includes(c.key))n+=supply&&me.landCount<8?35:-25;
 if(c.key==='repair')n+=danger?65:me.life<10?20:0;
 if(c.key==='trap')n+=danger?45:10;
 if(c.key==='mother')n+=Math.max(0,motherGain(v));
 if(c.key==='bahamut')n+=wipeGain(v)*.3;
 if(total(c)>v.sources.length+3)n-=15;
 n-=Math.max(0,me.hand.filter(x=>x.key===c.key).length-1)*5;return n;
}
function decide(v){
 if(v.result||v.actor!==v.viewer)return {type:'wait'};const {me,p,enemy,danger}=context(v),o=v.operation;
 if(v.status==='mulligan'){
  const counts={};const ids=me.hand.filter(c=>{counts[c.key]=(counts[c.key]||0)+1;return total(c)>4||counts[c.key]>2||(c.key==='repair'&&counts[c.key]>1);}).map(c=>c.id);return {type:'mulligan',ids};
 }
 if(o){
  if(o.kind==='shieldWindow'){const c=o.candidates.find(c=>c.shieldRule.effect==='destroyAttacker')||o.candidates.find(c=>c.shieldRule.effect==='draw'&&me.counts.main+me.counts.trash>=2);return {type:'shield',id:c?.id||null};}
  if(o.kind==='resetShield')return {type:'shieldEffect',id:o.candidates[0]?.id||null};
  if(o.kind==='inspectShield')return {type:'shieldEffect',id:o.candidates[0]?.id||null};
  if(o.kind==='shieldReveal')return {type:'shieldEffect'};
  if(o.kind==='fateChoice'){return {type:'fate',key:v.sources.length>=8&&me.units.filter(c=>!c.cannotAttack).length>=2?'fateReversal':'fateWhim'};}
  if(o.kind==='optionalEffect')return {type:'optional',use:me.counts.main+me.counts.trash>0};
  if(o.kind==='untapLands'){const c=o.candidates.find(c=>c.rest&&!o.ids.includes(c.id));return c&&o.ids.length<o.max?{type:'untapSelect',id:c.id}:{type:'untap'};}
  if(o.kind==='handPick'){const c=best(o.candidates,c=>-keepScore(v,c));return {type:'private',id:c?.id||null};}
  if(o.kind==='recoverUnit'){const c=best(o.candidates,c=>unitValue(c,me.landCount));return {type:'private',id:c?.id||null};}
  if(o.kind==='response'){const threat=o.target,important=threat&&(threat.responseOnly||threat.unblockable||threat.key==='bahamut'||(threat.attack||0)>=5||danger||['trap','mother','gate','corile','snow'].includes(threat.key));return important&&o.candidates.length?{type:'play',id:o.candidates[0].id,method:'counter'}:{type:'pass'};}
  if(o.kind==='optionalDraw')return {type:'optional',use:me.counts.main+me.counts.trash>0};
  if(o.kind==='tokens'){const slot=best(o.slots,s=>s.card?-unitValue(s.card,me.landCount):10000);return {type:'token',slot:slot&&(!slot.card||unitValue(slot.card,me.landCount)<10)?slot.id:null};}
  if(['reorder','stackOrder'].includes(o.kind)){if(o.scry)return {type:'order',bottom:keepScore(v,o.candidates[0])<8};const desired=o.candidates.slice().sort((a,b)=>keepScore(v,b)-keepScore(v,a)||a.id.localeCompare(b.id));const i=desired.findIndex((c,i)=>c.id!==o.order[i]);if(i>=0){const index=o.order.indexOf(desired[i].id);return {type:'orderMove',id:desired[i].id,delta:index>i?-1:1};}return {type:'order'};}
  if(o.kind==='searchSpell'){const c=best(o.candidates,c=>playScore(v,c));return {type:'private',id:c.id};}
  if(o.kind==='inspectHand'){const c=best(o.candidates.filter(c=>c.cost&&total(c)<=o.max),c=>total(c)+unitValue(c,enemy.landCount));return {type:'private',id:c?.id||null};}
  if(o.kind==='freeCast'){if(!o.targetId){const c=best(o.targets,c=>(o.effect==='buffUnit'?(c.owner===p?100:0):(c.owner!==p?100:0))+unitValue(c,enemy.landCount));return {type:'useTarget',id:c.id};}return {type:'freeCast'};}
  if(o.kind==='payment'){const c=[...me.hand,...(v.exile||[])].find(c=>c.id===o.id);if(o.targets?.length&&!o.targetId){const target=best(o.targets,c=>(o.effect==='buffUnit'?(c.owner===p?100:0):(c.owner!==p?100:0))+unitValue(c,enemy.landCount));return {type:'useTarget',id:target.id};}if(c?.type==='通常'&&o.purpose!=='set'&&!o.slot){const slot=best(o.slots,s=>s.card?-unitValue(s.card,me.landCount)+(c?.evolution&&!s.card.rest?100:0):10000);return {type:'slot',slot:slot.id};}return {type:'pay'};}
  if(['freePlace','returnPlace'].includes(o.kind)){const c=me.hand.find(x=>x.id===o.id);if(!o.slot){const slot=best(o.slots,s=>s.card?-unitValue(s.card,me.landCount)+(c?.evolution&&!s.card.rest?100:0):10000);return {type:'slot',slot:slot.id};}return {type:o.kind==='returnPlace'?'returnPlace':'freePlace'};}
  if(o.kind==='freeUnit'){const c=best(o.candidates,c=>playScore(v,c));return {type:'freeUnit',id:c&&playScore(v,c)>0?c.id:null};}
  if(o.kind==='effectTarget'){const c=o.effect==='mother'?motherTarget(v,o.candidates):best(o.candidates,c=>(c.owner===p?-100:0)+unitValue(c,enemy.landCount));return {type:'target',id:c.id};}
  if(o.kind==='combat')return {type:'block',id:chooseBlock(v,o)};
  if(o.kind==='attackTarget'){const c=me.units.find(c=>c.id===o.id),a=attackChoice(v,[{card:c,targets:o.targets}]);return a?{type:'attackTarget',target:a.target}:{type:'cancelAttackTarget'};}
  if(o.kind==='discard')return {type:'discard',ids:me.hand.slice().sort((a,b)=>keepScore(v,a)-keepScore(v,b)||a.id.localeCompare(b.id)).slice(0,o.required).map(c=>c.id)};
  return {type:'wait'};
 }
 if(['main1','main2'].includes(v.turn.step)){
  // Preserve an immediate direct win rather than tapping its mana creature to deploy more cards.
  if(v.turn.step==='main1'&&enemy.life<=Math.max(0,...me.units.map(c=>c.attack||0))&&!enemy.units.some(c=>c.lure)&&me.units.some(c=>!c.rest&&!c.sick&&!c.cannotAttack))return {type:'advance'};
  const usable=[...me.hand,...(v.exile||[])].filter(c=>c.canPlay);
  const set=best(me.hand.filter(c=>c.canForetell),c=>c.key==='counter'?35:c.key==='goby'?12:c.key==='snow'&&enemy.units.length?25:-5);
  const c=best(usable,c=>playScore(v,c));
  if(set&&((set.key==='counter'&&(!c||playScore(v,c)<40))||(!c&&set.key!=='gate')))return {type:'foretell',id:set.id};if(c&&playScore(v,c)>0)return {type:'play',id:c.id};
 }else if(v.turn.step==='attack'){const a=attackChoice(v);if(a)return {type:'attack',id:a.id,target:a.target};}
 return v.canAdvance?{type:'advance'}:{type:'wait'};
}
return {decide,unitValue,playScore,chooseBlock,keepScore};
});
