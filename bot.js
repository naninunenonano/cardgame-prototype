// Policy consumes only the redacted observation. It never receives Game or hidden state.
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./mana.js'):root.ManaEngine);if(typeof module==='object'&&module.exports)module.exports=api;else root.BotPolicy=api;})(globalThis,function(M){
'use strict';
const other=p=>p==='p1'?'p2':'p1',total=c=>c.cost?M.total(c.cost):0;
const best=(a,score)=>a.slice().sort((x,y)=>score(y)-score(x)||String(x.id).localeCompare(String(y.id)))[0];
function unitValue(c,lands=0){return (c.attack||0)+(c.health??c.maxHealth??0)+Object.values(c.symbols||{}).reduce((a,b)=>a+b,0)*2+(c.lure?12:0)+(c.manaAbility?(lands<6?15:3):0)+(c.abilities?.includes('ブロッカー')?10:0)+(c.unblockable?15:0)-(c.cannotAttack?6:0);}
function context(v){const p=v.viewer,e=other(p),me=v.players[p],enemy=v.players[e];const supply=me.counts.main+me.counts.trash;const damage=enemy.units.filter(c=>!c.cannotAttack).reduce((n,c)=>n+(c.attack||0),0);const danger=enemy.units.length>0&&me.life<=damage&&!me.units.some(c=>c.lure&&c.health>Math.max(0,...enemy.units.map(x=>x.attack||0)));return {p,e,me,enemy,supply,danger};}
function replacement(v){const {me}=context(v);return best(me.units,c=>-unitValue(c,me.manaCount));}
function wipeGain(v){const {me,enemy}=context(v);return enemy.units.reduce((n,c)=>n+unitValue(c,enemy.manaCount),0)+enemy.structures.length*9-me.units.reduce((n,c)=>n+unitValue(c,me.manaCount),0)-me.structures.length*9;}
function freeValue(v,c){const {me}=context(v);if(c.key==='gl1'&&wipeGain(v)<=0&&(me.units.length||me.structures.length))return -100;return unitValue(c,me.manaCount)+(c.key==='gn2'?8:0)+(c.key==='gl1'?wipeGain(v):0);}
function motherTarget(v,targets){const {p,me,enemy,danger}=context(v);const possible=me.mana.filter(c=>c.type==='通常'&&total(c)<=me.manaCount+1);const upgrade=best(possible,c=>freeValue(v,c));
 return best(targets,c=>c.owner===p?(upgrade?freeValue(v,upgrade)-unitValue(c,me.manaCount)+2:-100):unitValue(c,enemy.manaCount)-(enemy.counts.hand?10:0)-(enemy.manaCount>=8?7:3)+(danger?8:0));}
function motherGain(v){const {p,me,enemy,danger}=context(v),c=motherTarget(v,[...me.units,...enemy.units]);if(!c)return -100;if(c.owner!==p)return unitValue(c,enemy.manaCount)-(enemy.counts.hand?10:0)-(enemy.manaCount>=8?7:3)+(danger?8:0);const choices=me.mana.filter(x=>x.type==='通常'&&total(x)<=me.manaCount+1);return Math.max(-100,...choices.map(x=>freeValue(v,x)-unitValue(c,me.manaCount)));}
function playScore(v,c){const {me,enemy,supply,danger}=context(v),canRefill=me.counts.main+me.counts.trash>0;let score=-100;
 if(c.type==='通常'){
  score=unitValue(c,me.manaCount)+8;
  if(c.manaAbility)score+=me.manaCount<6?45:0;
  if(c.key==='gn2')score+=supply?(me.manaCount<8?35:10):0;
  if(c.evolution)score+=c.unblockable&&enemy.life<=Math.max(0,...me.units.map(c=>c.attack||0))?100:15;
  if(c.abilities?.includes('ブロッカー')&&danger)score+=25;
  if(c.key==='gn4'&&danger)score+=65;
  if(c.key==='gs4'&&enemy.units.some(x=>x.health<=c.attack))score+=18;
  if(c.key==='gl1'){const gain=wipeGain(v);if(gain<=0&&(me.units.length||me.structures.length))return -100;score+=gain;}
  if(me.units.length>=7){const old=replacement(v);if(unitValue(c,me.manaCount)<=unitValue(old,me.manaCount)+3)return -100;score-=unitValue(old,me.manaCount);}
 }else if(c.key==='ks9'){const candidates=me.trash.filter(c=>c.type==='通常'&&!c.noReanimate);score=candidates.length?Math.max(...candidates.map(c=>unitValue(c)))+15:-100;}else if(c.key==='ks8'){const loss=units=>units.reduce((n,x)=>n+(x.health<=8?unitValue(x):2),0);score=loss(enemy.units)-loss(me.units);if(score>0)score+=danger?30:10;}else if(['nn8','rn14','sbnu1'].includes(c.key))score=enemy.life<=(c.key==='sbnu1'?7:3)?10000:40;
 else if(c.key==='sbnr3')score=me.life<=24?35:-100;
 else if(c.key==='sbns1')score=enemy.units.length||enemy.structures.length?45:-100;
 else if(c.key==='sbnr4')score=50;
 else if(c.key==='bs3')score=enemy.units.reduce((n,c)=>n+unitValue(c),0)-me.units.reduce((n,c)=>n+unitValue(c),0)>0?50:-100;
 else if(c.key==='rn13')score=30;
 else if(c.key==='almar_sbbs1')score=enemy.counts.hand*10+(me.character?.level===4?30:0);
 else if(c.key==='sbbr1')score=enemy.units.length?35:-100;
 else if(c.key==='sbbu2')score=me.counts.main>3?55:-100;
 else if(c.key==='ns1'){const gain=enemy.units.reduce((n,x)=>n+unitValue(x,enemy.manaCount),0)-me.units.reduce((n,x)=>n+unitValue(x,me.manaCount),0);score=gain>0?gain+(danger?35:0):-100;}
 else if(c.key==='nr1')score=me.life<=26?(danger?70:20):-100;
 else if(c.key==='gs3')score=(me.life<30?25:0)+(me.shields?.some(c=>c.faceUp)?35:0)-5;
 else if(c.key==='nr4')score=canRefill?(me.units.some(c=>c.key==='nl1')?55:30):-100;
 else if(c.key==='nr5')score=me.units.length?35+(me.units.some(c=>c.key==='nl1')&&canRefill?20:0):-100;
 else if(c.key==='nr6')score=me.units.some(c=>c.key==='nl1')?75:enemy.units.length<me.units.length?35:5;
 else if(c.key==='br2')score=me.structures.length<3?20:3;
 else if(c.key==='br1'||c.key==='bl1')score=canRefill?(me.hand.some(x=>x.key==='bs1')&&me.hand.length<10?45:me.hand.length<6?35:8):-100;
 else if(c.key==='bn5')score=me.units.length<5?40:5;
 else if(c.key==='bn1')score=enemy.units.length||enemy.structures.length?(danger?65:12):-100;
 else if(c.key==='br4'||c.key==='br5')score=enemy.counts.hand?18:-100;
 else if(c.key==='gr4'){
  const remaining=v.sources.length-M.total(c.effectiveCost||c.cost),follow=me.hand.some(x=>x.type==='通常'&&M.total(x.effectiveCost||x.cost)<=remaining);
  score=supply&&me.manaCount<16?(follow?60:me.hand.some(x=>x.type==='通常')?8:-10):-100;
 }else if(c.key==='gn1')score=supply?(me.manaCount<8?48:me.manaCount<13?12:-5):-100;
 else if(c.key==='gr1')score=(supply?(me.manaCount<8?45:10):0)+(me.manaCount+(supply?1:0)<=5&&canRefill?15:0);
 else if(c.key==='gr2')score=(supply?12:0)+(canRefill?18:0);
 else if(c.key==='gs2'){const threat=best(enemy.units,c=>unitValue(c,enemy.manaCount));score=threat?unitValue(threat,enemy.manaCount)+(danger?50:0)-8-(enemy.manaCount<6?5:0):-100;}
 else if(c.key==='gl2')score=motherGain(v)+(danger?20:0);
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
   const score=(kill?unitValue(b,enemy.manaCount)+22:0)-(survive?0:unitValue(a,me.manaCount))+ (a.key==='gs4'&&kill?20:0);
   if(score>0||a.mustAttack)choices.push({id:a.id,target:t.id,score});
  }}return best(choices,c=>c.score);}
function chooseBlock(v,o){const {me,enemy}=context(v),a=o.attacker;if(!a||!o.blockers.length)return null;
 const value=c=>unitValue(c,me.manaCount),cheap=best(o.blockers,c=>-value(c));
 const favorable=o.blockers.filter(c=>c.attack>=a.health&&c.health>a.attack);
 const incoming=enemy.units.filter(c=>c.id!==a.id&&!c.rest&&!c.sick&&!c.cannotAttack).reduce((n,c)=>n+c.attack,0);
 if(a.attack+incoming>=me.life)return (best(favorable,c=>-value(c))||cheap).id;
 return best(favorable,c=>-value(c))?.id||null;
}
function keepScore(v,c){const {me,danger,supply}=context(v);let n=c.type==='通常'?unitValue(c,me.manaCount)+10:12;
 if(c.manaAbility)n+=me.manaCount<6?35:-5;
 if(['gn1','gr1','gn2'].includes(c.key))n+=supply&&me.manaCount<8?35:-25;
 if(c.key==='gs3')n+=danger?65:me.life<10?20:0;
 if(c.key==='gs2')n+=danger?45:10;
 if(c.key==='gl2')n+=Math.max(0,motherGain(v));
 if(c.key==='gl1')n+=wipeGain(v)*.3;
 if(total(c)>v.sources.length+3)n-=15;
 n-=Math.max(0,me.hand.filter(x=>x.key===c.key).length-1)*5;return n;
}
function decide(v){
 if(v.result||v.actor!==v.viewer)return {type:'wait'};const {me,p,enemy,danger}=context(v),o=v.operation;
 if(v.status==='mulligan'){
  const counts={};const ids=me.hand.filter(c=>{counts[c.key]=(counts[c.key]||0)+1;return total(c)>4||counts[c.key]>2||(c.key==='gs3'&&counts[c.key]>1);}).map(c=>c.id);return {type:'mulligan',ids};
 }
 if(o){
  if(o.graveBases&&o.graveEvolution){const ids=o.graveBaseIds||[];if(ids.length<o.graveEvolution.min){const c=best(o.graveBases.filter(c=>!ids.includes(c.id)),c=>-unitValue(c));if(c)return {type:'graveBase',id:c.id};}}
  if(o.kind==='graveChoice'){if(o.choice==='ereshMode')return {type:'graveChoice',id:me.trash.some(c=>c.type==='通常'&&c.color==='黒'&&!c.evolution&&!c.noReanimate)?'revive':'recover'};const c=best(o.candidates,c=>o.choice==='iwashinDiscard'?-keepScore(v,c):o.choice==='fushigi'?-unitValue(c)+total(c):unitValue(c));return {type:'graveChoice',id:c?.id??null};}
  if(o.kind==='gravePlace'){if(!o.slot){const slot=best(o.slots,s=>s.card?-unitValue(s.card):10000);return {type:'slot',slot:slot.id};}return {type:'gravePlace'};}

  if(o.kind==='expansionChoice'){if(o.choice==='lifeSave')return {type:'expansion',id:me.life>5?'use':'decline'};const c=best(o.candidates,c=>o.choice==='burnShield'?0:o.choice==='lockMana'?total(c):o.choice==='destroyMana'?-(total(c))+(c.manaToken?10:0):o.choice==='gigaMana'?-(unitValue(c,me.manaCount))+(c.zone==='hand'?15:0):o.choice==='celestiaHeal'?(c.maxHealth-c.health)*5+unitValue(c,me.manaCount):unitValue(c,me.manaCount));return {type:'expansion',id:c?.id};}
  if(o.kind==='lootCost')return {type:'lootCost',id:best(o.candidates,c=>-keepScore(v,c))?.id};

  if(o.kind==='scryMany'){const c=o.candidates.find(c=>o.top.includes(c.id)&&keepScore(v,c)<8);return c?{type:'scryMove',id:c.id,destination:'bottom'}:{type:'scry'};}
  if(o.kind==='starterChoice'){const c=best(o.candidates,c=>['discardDamage','discardDestroy'].includes(o.choice)?-keepScore(v,c):o.choice==='invasion'?100:o.choice==='redFree'?unitValue(c,me.manaCount):c.type==='プレイヤー'?(enemy.life<=3?10000:10):(c.owner!==p?100:0)+unitValue(c,enemy.manaCount));return {type:'starter',id:c?.id||null};}
  if(o.kind==='manaCharge')return {type:'confirmCharge'};
  if(o.kind==='refreshPenalty'){const need=Math.min(2,me.mana.length);const c=best(o.candidates.filter(c=>!o.ids.includes(c.id)),c=>(c.manaToken?40:0)+(c.rest?10:0)-me.hand.filter(x=>x.color===c.color).length*3);return o.ids.length<need&&c?{type:'refreshSelect',id:c.id}:{type:'refresh'};}

  if(o.kind==='revolution')return {type:'revolution',use:true};
  if(o.kind==='sideChoice'){
   if(o.choice==='viceOffer')return {type:'sideChoice',id:o.candidates[0]?.id||null};
   if(['technologySearch','awakeSpells'].includes(o.choice)){const limit=o.choice==='awakeSpells'?6:Math.min(8,Math.max(0,o.ids.length-2)),remaining=o.candidates.filter(c=>!o.selected.includes(c.id));if(o.selected.length<limit&&remaining.length)return {type:'sideSelect',id:best(remaining,c=>o.choice==='awakeSpells'?-total(c):keepScore(v,c)).id};return {type:'sideChoice'};}
   const candidates=o.candidates||[],c=best(candidates,c=>o.choice==='opponentDiscard'?-keepScore(v,c):o.choice==='darkHand'?total(c)*3+unitValue(c,enemy.manaCount):o.choice==='destroySame'?unitValue(c,enemy.manaCount):c.type==='通常'?unitValue(c,me.manaCount):Math.max(0,playScore(v,c))+total(c));return {type:'sideChoice',id:c?.id||null};
  }
  if(o.kind==='sideFreePlace'){if(!o.slot){const slot=best(o.slots,s=>s.card?-unitValue(s.card,me.manaCount):10000);return {type:'slot',slot:slot.id};}return {type:'sideFree'};}

  if(o.kind==='shieldWindow'){const c=o.candidates.find(c=>c.shieldRule.effect==='revive')||o.candidates.find(c=>!['draw'].includes(c.shieldRule.effect))||o.candidates.find(c=>c.shieldRule.effect==='destroyAttacker')||o.candidates.find(c=>c.shieldRule.effect==='draw'&&me.counts.main>=2);return {type:'shield',id:c?.id||null};}
  if(o.kind==='resetShield')return {type:'shieldEffect',id:o.candidates[0]?.id||null};
  if(o.kind==='inspectShield')return {type:'shieldEffect',id:o.candidates[0]?.id||null};
  if(o.kind==='shieldReveal')return {type:'shieldEffect'};
  if(o.kind==='fateChoice'){return {type:'fate',key:v.sources.length>=8&&me.units.filter(c=>!c.cannotAttack).length>=2?'fateReversal':'fateWhim'};}
  if(o.kind==='optionalEffect')return {type:'optional',use:me.counts.main+me.counts.trash>0};
  if(o.kind==='untapMana'){const c=o.candidates.find(c=>c.rest&&!o.ids.includes(c.id));return c&&o.ids.length<o.max?{type:'untapSelect',id:c.id}:{type:'untap'};}
  if(o.kind==='handPick'){const c=best(o.candidates,c=>-keepScore(v,c));return {type:'private',id:c?.id||null};}
  if(o.kind==='recoverUnit'){const c=best(o.candidates,c=>unitValue(c,me.manaCount));return {type:'private',id:c?.id||null};}
  if(o.kind==='response'){const c=o.candidates.find(c=>c.responseOnly&&o.target?.type==='呪文'&&o.target.owner!==p)||o.candidates.find(c=>!c.responseOnly&&(enemy.units.length>0));return c?{type:'play',id:c.id,method:'instant'}:{type:'pass'};}
  if(o.kind==='optionalDraw')return {type:'optional',use:me.counts.main>0};
  if(o.kind==='tokens'){const slot=best(o.slots,s=>s.card?-unitValue(s.card,me.manaCount):10000);return {type:'token',slot:slot&&(!slot.card||unitValue(slot.card,me.manaCount)<10)?slot.id:null};}
  if(['reorder','stackOrder'].includes(o.kind)){if(o.scry)return {type:'order',bottom:keepScore(v,o.candidates[0])<8};const desired=o.candidates.slice().sort((a,b)=>keepScore(v,b)-keepScore(v,a)||a.id.localeCompare(b.id));const i=desired.findIndex((c,i)=>c.id!==o.order[i]);if(i>=0){const index=o.order.indexOf(desired[i].id);return {type:'orderMove',id:desired[i].id,delta:index>i?-1:1};}return {type:'order'};}
  if(o.kind==='searchSpell'){const c=best(o.candidates,c=>playScore(v,c));return {type:'private',id:c.id};}
  if(o.kind==='inspectHand'){const c=best(o.candidates.filter(c=>c.cost&&total(c)<=o.max),c=>total(c)+unitValue(c,enemy.manaCount));return {type:'private',id:c?.id||null};}
  if(o.kind==='freeCast'){if(!o.targetId){const c=best(o.targets,c=>(o.effect==='buffUnit'?(c.owner===p?100:0):(c.owner!==p?100:0))+unitValue(c,enemy.manaCount));return {type:'useTarget',id:c.id};}return {type:'freeCast'};}
  if(o.kind==='payment'){const c=[...me.hand,...me.mana,...(me.gravePlayable||[]),...(v.exile||[]),...(me.sideboard||[])].find(c=>c.id===o.id);if(o.targets?.length&&!o.targetId){const target=best(o.targets,c=>(o.effect==='buffUnit'?(c.owner===p?100:0):(c.owner!==p?100:0))+unitValue(c,enemy.manaCount));return {type:'useTarget',id:target.id};}if(c?.type==='通常'&&o.purpose!=='set'&&!o.slot){const slot=best(o.slots,s=>s.card?-unitValue(s.card,me.manaCount)+(c?.evolution&&!s.card.rest?100:0):10000);return {type:'slot',slot:slot.id};}return {type:'pay'};}
  if(['freePlace','returnPlace'].includes(o.kind)){const c=me.hand.find(x=>x.id===o.id);if(!o.slot){const slot=best(o.slots,s=>s.card?-unitValue(s.card,me.manaCount)+(c?.evolution&&!s.card.rest?100:0):10000);return {type:'slot',slot:slot.id};}return {type:o.kind==='returnPlace'?'returnPlace':'freePlace'};}
  if(o.kind==='freeUnit'){const c=best(o.candidates,c=>(c.owner===p?1:-1)*unitValue(c,c.owner===p?me.manaCount:enemy.manaCount));return {type:'freeUnit',id:c?.id||null};}
  if(o.kind==='effectTarget'){const c=o.effect==='mother'?motherTarget(v,o.candidates):best(o.candidates,c=>(c.owner===p?-100:0)+unitValue(c,enemy.manaCount));return {type:'target',id:c.id};}
  if(o.kind==='combat')return {type:'block',id:chooseBlock(v,o)};
  if(o.kind==='attackTarget'){const c=me.units.find(c=>c.id===o.id),a=attackChoice(v,[{card:c,targets:o.targets}]);return a?{type:'attackTarget',target:a.target}:{type:'cancelAttackTarget'};}
  if(o.kind==='discard')return {type:'discard',ids:me.hand.slice().sort((a,b)=>keepScore(v,a)-keepScore(v,b)||a.id.localeCompare(b.id)).slice(0,o.required).map(c=>c.id)};
  return {type:'wait'};
 }
 if(v.turn.step==='charge'){const cards=me.hand.filter(c=>!c.generated&&!c.token&&!c.sideboardOnly);if(!cards.length||me.manaCount>=Math.max(10,...me.hand.map(c=>total(c))))return {type:'skipCharge'};const c=best(cards,c=>{const colorCount=me.mana.filter(m=>m.color===c.color).length,need=me.hand.filter(x=>x.id!==c.id&&x.cost&&(x.cost[c.color]||0)>colorCount).length;return need*12+(colorCount===0?8:0)+(total(c)>me.manaCount+3?10:0)-keepScore(v,c)*.4-(me.hand.filter(x=>x.key===c.key).length===1&&['gn1','gr1','br1'].includes(c.key)?15:0);});return c?{type:'charge',id:c.id}:{type:'skipCharge'};}
 if(['main1','main2'].includes(v.turn.step)){
  // Preserve an immediate direct win rather than tapping its mana creature to deploy more cards.
  if(v.turn.step==='main1'&&enemy.life<=Math.max(0,...me.units.map(c=>c.attack||0))&&!enemy.units.some(c=>c.lure)&&me.units.some(c=>!c.rest&&!c.sick&&!c.cannotAttack))return {type:'advance'};
  if(me.character?.key==='ereshthianox'&&me.character.level===4&&me.character.activeTurn!==v.turn.counts[p])return {type:'characterAbility'};
  if(me.units.some(c=>c.cardcarAbility)&&me.hand.length<3&&me.counts.main>=4){const c=me.units.find(c=>c.cardcarAbility);return {type:'cardcar',id:c.id};}
  if(me.character?.key==='redcaptain'&&me.character.level===4&&me.character.activeTurn!==v.turn.counts[p]&&me.units.length<7&&me.hand.some(c=>c.type==='通常'&&(!me.summonLocks.length||c.attack>5)))return {type:'characterAbility'};
  if(me.growth?.ok)return {type:'grow'};
  const usable=[...me.hand,...me.mana,...(me.gravePlayable||[]),...(v.exile||[]),...(me.sideboard||[])].filter(c=>c.canPlay);
  const c=best(usable,c=>playScore(v,c));
  if(c&&playScore(v,c)>0)return {type:'play',id:c.id};
 }else if(v.turn.step==='attack'){const a=attackChoice(v);if(a)return {type:'attack',id:a.id,target:a.target};}
 return v.canAdvance?{type:'advance'}:{type:'wait'};
}
return {decide,unitValue,playScore,chooseBlock,keepScore};
});
