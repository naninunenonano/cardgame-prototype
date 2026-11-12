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
function miseryAttackValue(v,c){
 const {me,enemy}=context(v);
 const allies=me.units.filter(u=>u.id!==c.id);
 if(!allies.length)return -80;
 const extra=me.trash.filter(u=>u.key==='ks14').length;
 const bases=allies.filter(u=>!u.rest&&u.key!=='ks14').length;
 const fuel=me.trash.filter(u=>u.type==='通常'&&!u.evolution&&!u.noReanimate&&u.cost&&total(u)<=6);
 const chain=Math.min(extra,bases+Math.min(fuel.length,7-me.units.length));
 const apache=me.life<=15?Math.min(2,fuel.filter(u=>u.key==='kn10').length,7-me.units.length):0;
 const blockers=enemy.units.filter(u=>!u.rest&&u.abilities?.includes('ブロッカー')).length;
 return Math.max(0,6*(1+chain)+4*apache-6*blockers)>=enemy.life?80:12+chain*10+apache*4;
}
function miseryReviveScore(v,c,operation){
 const {me,enemy}=context(v);
 const source=me.units.find(u=>u.id===operation.sourceId);
 const ready=me.units.some(u=>u.id!==operation.sourceId&&!u.rest&&u.key!=='ks14');
 const copies=me.trash.filter(u=>u.key==='ks14').length;
 const apache=c.key==='kn10'&&me.life<=15;
 if(c.key==='ks14')return ready?(operation.miseryTrigger==='attack'?100:45):-100;
 if(c.evolution)return ready?unitValue(c):0;
 if(apache&&enemy.life<=4)return 130;
 if(operation.miseryTrigger==='entry'&&copies&&!ready&&source)return 80+unitValue(c)-(apache?25:0);
 return unitValue(c)+(apache?32:0);
}
function playScore(v,c){const {me,enemy,supply,danger}=context(v),canRefill=me.counts.main+me.counts.trash>0;let score=-100;
 if(c.key==='sbrn1')return 55;
 if(c.equipment)return c.equipment==='gaiou'&&enemy.units.length?42:25;
 if(me.blackBeginner){
  if(c.key==='ks13')return me.structures.filter(u=>u.key==='ks13').length<3?42:-100;
  if(c.key==='ks15'){
   const self=c.effectiveCost?.generic===0?6:0;
   if(self>=me.life)return -100;
   const net=self?self-me.structures.filter(u=>u.key==='ks13').length*2:0;
   return 30+(!enemy.units.some(u=>!u.rest&&u.abilities?.includes('ブロッカー'))&&enemy.life<=6?100:0)-net*2;
  }
  if(c.key==='kn11')return me.life<=1?-100:enemy.life<=1?1000:18+me.structures.filter(u=>u.key==='ks13').length*6;
  if(c.key==='ks14'){
   const options=(c.evolutionOptions??[]).filter(x=>x.plan);
   if(!options.length)return -100;
   const pay=Math.min(...options.map(x=>M.total(x.cost)));
   return 45-pay*4+me.trash.filter(u=>u.key==='ks14'&&u.id!==c.id).length*7+(me.units.length>=2?7:0);
  }
 }
 if(c.type==='通常'){
  if(me.blackBeginner&&me.character?.level!==4){
   const damage=(me.character?.level===2?2:0)+(c.key==='kn2'||me.life>15&&c.onEnter?.some(e=>e.unlessVengeance)?3:0);
   if(damage>=me.life)return -100;
  }
  score=unitValue(c,me.manaCount)+8;
  if(c.manaAbility)score+=me.manaCount<6?45:0;
  if(c.key==='gn2')score+=supply?(me.manaCount<8?35:10):0;
  if(c.evolution)score+=c.unblockable&&enemy.life<=Math.max(0,...me.units.map(c=>c.attack||0))?100:15;
  if(c.abilities?.includes('ブロッカー')&&danger)score+=25;
  if(c.key==='gn4'&&danger)score+=65;
  if(c.key==='gs6')score+=me.units.length*2+(me.units.length>=4?24:0);
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
 else if(c.key==='br1'||c.key==='bl1'||c.key==='bn7')score=canRefill?(me.hand.some(x=>x.key==='bs1')&&me.hand.length<10?45:me.hand.length<6?35:8):-100;
 else if(c.key==='bn5')score=me.units.length<5?40:5;
 else if(c.key==='bn1')score=enemy.units.length||enemy.structures.length?(danger?65:12):-100;
 else if(c.key==='br4'||c.key==='br5')score=enemy.counts.hand?18:-100;
 else if(c.key==='gr4'){
  const remaining=v.sources.length-M.total(c.effectiveCost||c.cost),follow=me.hand.some(x=>x.type==='通常'&&M.total(x.effectiveCost||x.cost)<=remaining);
  score=supply&&me.manaCount<16?(follow?60:me.hand.some(x=>x.type==='通常')?8:-10):-100;
 }else if(c.key==='gn1')score=supply?(me.manaCount<8?48:me.manaCount<13?12:-5):-100;
 else if(c.key==='gr1')score=(supply?(me.manaCount<8?45:10):0)+(me.manaCount+(supply?1:0)>=7&&canRefill?15:0);
 else if(c.key==='gr2')score=(supply?12:0)+(canRefill?18:0);
 else if(c.key==='gr5'){const threat=best(enemy.units,c=>unitValue(c,enemy.manaCount));score=threat?unitValue(threat,enemy.manaCount)+(danger?50:0)-8-(enemy.manaCount<6?5:0):-100;}
 else if(c.key==='gl2')score=motherGain(v)+(danger?20:0);
 if(me.character?.key==='eira'){
  if(c.key==='wr7'){const amount=2*Math.max(0,...me.structures.filter(x=>x.shieldLink).map(total));score=enemy.units.some(x=>x.health<=amount)?(danger?68:38):18;}
  if(c.key==='wr6'){const links=me.structures.filter(x=>x.shieldLink).length;score=links&&enemy.units.length?Math.min(70,enemy.units.reduce((n,x)=>n+(x.health<=links?20:links),0)):-100;}
  if(c.key==='wn1'||c.key==='wr1')score=me.structures.filter(x=>x.shieldLink).length<3?40:18;
  if(c.key==='wr4'||c.key==='ws9')score+=me.structures.filter(x=>x.shieldLink).length<3?24:8;
  if(c.key==='ws8'&&me.counts.main>3)score+=18;
  if(c.key==='ws7'&&enemy.units.length)score+=28;
  if(c.key==='wn2')score=me.structures.some(x=>x.key==='wn2')?12:48;
  if(c.key==='wn3')score=me.counts.main>3?(me.life<me.maxLife?43:22):-100;
  if(c.key==='wr2'||c.key==='wr3')score=enemy.units.length?(danger?72:47):-100;
  if(c.key==='nr1'&&me.life<me.maxLife&&me.character.level>=2)score=Math.max(score,48);
 }
 if(me.blueAdvanced){
  const bounceValue=units=>units.reduce((n,unit)=>n+unitValue(unit),0);
  const bounceGain=bounceValue(enemy.units)-bounceValue(me.units);
  const followUp=me.hand.some(x=>['br4','br5'].includes(x.key))||me.character?.level===4;
  if(c.key==='bo1'){
   const small=units=>units.filter(unit=>unit.attack<=5&&!unit.bounceImmune);
   score=25+bounceValue(small(enemy.units))-bounceValue(small(me.units))+2*small(enemy.units).length;
  }
  if(c.key==='bs1'&&me.hand.length>=10)score+=35;
  if(c.key==='bn1')score=enemy.units.length?(danger?55:16)+(followUp?10:0):-100;
  if(c.key==='bs3')score=bounceGain>0?bounceGain+(followUp?8:0):-100;
  if(c.key==='br5')score=enemy.counts.hand?18+Math.min(2,enemy.counts.hand)*13:-100;
  if(c.key==='br4')score=enemy.counts.hand?22:-100;
  if(c.key==='almar_sbbs1')score=enemy.counts.hand?score:-100;
 }
 if(me.blueBeginner){
  if(c.key==='bs1'&&c.canFreeSummon)score+=35;
  if((c.key==='br1'||c.key==='bn7')&&me.counts.main<=6)score=-100;
  if(c.key==='bn1'&&enemy.units.length){
   const threat=Math.max(...enemy.units.map(unit=>unit.attack||0));
   if(danger||threat>=5)score=Math.max(score,28+threat*6);
  }
 }
 // An untapped mana creature may be a winning attacker; otherwise reserve it when feasible.
 const usedUnits=(c.paymentPlan?.sourceIds||[]).filter(id=>v.sources.some(s=>s.id===id&&s.unit)).length;
 return score-usedUnits*(enemy.life<=Math.max(0,...me.units.map(c=>c.attack||0))?25:3);
}
function attackChoice(v,attacks=v.attacks){const {me,enemy}=context(v),choices=[];
 for(const entry of attacks)for(const t of entry.targets){const a=entry.card;
  if(me.blackBeginner&&me.character?.level!==4&&a.key==='kr3'&&me.life<=2)continue;
  if(a.key==='ks14'&&me.blackBeginner&&me.units.length===1&&!a.abilitiesDisabled)continue;
  if(t.id==='body'){
   const blockers=enemy.units.filter(c=>!c.rest&&c.abilities?.includes('ブロッカー'));
   const lethal=a.attack>=enemy.life&&(a.unblockable||!blockers.length);
   choices.push({id:a.id,target:'body',score:lethal?10000:a.attack*5+(me.blackBeginner&&a.key==='ks14'?miseryAttackValue(v,a):0)-(a.manaAbility?3:0)+(me.blueBeginner&&a.key==='bs5'&&a.evolution?.colorlessBaseDiscount&&me.counts.main>=3?12:0)});
  }else{const b=enemy.units.find(c=>c.id===t.id);if(!b)continue;
   const kill=a.attack>=b.health,survive=b.attack<a.health;
   const score=(kill?unitValue(b,enemy.manaCount)+22:0)-(survive?0:unitValue(a,me.manaCount))+ (a.key==='gs4'&&kill?20:0);
   const excess=a.trample&&!a.abilitiesDisabled?Math.max(0,a.attack-b.health):0;
   const trample=excess>=enemy.life?10000:excess*5;
   const loot=me.blueBeginner&&a.evolution?.colorlessBaseDiscount&&me.counts.main>=3?(survive?12:5):0;
   if(score+loot+trample>0||a.mustAttack)choices.push({id:a.id,target:t.id,score:score+loot+trample});
  }}return best(choices,c=>c.score);}
function chooseBlock(v,o){const {me,enemy}=context(v),a=o.attacker;if(!a||!o.blockers.length)return null;
 const value=c=>unitValue(c,me.manaCount),cheap=best(o.blockers,c=>-value(c));
 const favorable=o.blockers.filter(c=>c.attack>=a.health&&c.health>a.attack);
 const incoming=enemy.units.filter(c=>c.id!==a.id&&!c.rest&&!c.sick&&!c.cannotAttack).reduce((n,c)=>n+c.attack,0);
 if(a.attack+incoming>=me.life)return (best(favorable,c=>-value(c))||cheap).id;
 return best(favorable,c=>-value(c))?.id||null;
}
function keepScore(v,c){const {me,danger,supply}=context(v);let n=c.type==='通常'?unitValue(c,me.manaCount)+10:12;
 if(me.character?.key==='eira'&&c.key==='ws7'&&me.hand.filter(x=>x.key==='ws7').length===1)n+=18;
 if(me.blueBeginner&&c.responseOnly&&me.hand.filter(x=>x.key===c.key).length===1)n+=20;
 if(c.manaAbility)n+=me.manaCount<6?35:-5;
 if(['gn1','gr1','gn2'].includes(c.key))n+=supply&&me.manaCount<8?35:-25;
 if(c.key==='gs3')n+=danger?65:me.life<10?20:0;
 if(c.key==='gr5')n+=danger?45:10;
 if(c.key==='gl2')n+=Math.max(0,motherGain(v));
 if(c.key==='gl1')n+=wipeGain(v)*.3;
 if(total(c)>v.sources.length+3)n-=15;
 n-=Math.max(0,me.hand.filter(x=>x.key===c.key).length-1)*5;return n;
}
function gateProbability(size,copies,draws){
 let miss=1;
 for(let i=0;i<Math.min(size,draws);i++)miss*=Math.max(0,size-copies-i)/(size-i);
 return 1-miss;
}
function blueWarslaPlan(v){
 const {me,enemy}=context(v), own=v.turn.counts[v.viewer];
 const warsla=me.hand.find(c=>c.key==='bs5'&&c.evolution?.colorlessBaseDiscount);
 const routes=[];
 if(!warsla||!me.blueBeginner||v.operation||!['main1','main2'].includes(v.turn.step))return {routes};
 const main1=v.turn.step==='main1', am=me.hand.find(c=>c.key==='bs2'&&c.canPlay);
 const opposing=enemy.units.filter(u=>!u.cannotAttack);
 const incoming=opposing.reduce((sum,u)=>sum+u.attack,0);
 const forced=enemy.units.filter(u=>u.lure);
 const blockers=enemy.units.filter(u=>!u.rest&&u.abilities?.includes('ブロッカー'));
 const nextThreat=Math.max(0,...opposing.filter(u=>!u.bounceImmune).map(u=>u.attack));
 const size=me.counts.main, copies=Math.min(size,me.unknownGateCopies??0);
 const knownGate=me.hand.some(c=>c.key==='bn1');
 const shieldRisk=enemy.shields?.some(c=>!c.faceUp)||enemy.character?.key==='redmoonavenger'&&enemy.character.level===4;
 const add=(kind,base,cost,paid,slot)=>{
  const ready=main1&&!v.turn.attackForbidden&&(!base.rest||kind==='setup')&&!paid.includes(base.id);
  const target=forced.length?forced.reduce((a,b)=>a.health<=b.health?a:b):null;
  const damage=ready&&!target&&!blockers.length?6:0;
  const lethal=damage>=enemy.life&&!shieldRisk;
  const trade=ready&&target?(target.health<=6?target.attack*2:0)-(target.attack>=6?12:0):0;
  const left=v.sources.filter(s=>!paid.includes(s.id));
  const redirection=left.length>=(kind==='setup'?cost:0)+2&&left.some(s=>s.colors.includes('青'));
  const gateOdds=ready&&redirection?(knownGate?1:gateProbability(size,copies,3)):0;
  const draws=ready?Math.min(size,3):0;
  const score=15+damage*2+draws*3+trade+gateOdds*nextThreat-M.total(warsla.cost)*0.5-cost-unitValue(base)*.45+(ready?5:0);
  routes.push({kind,base:base.id,slot,cost,damage,lethal,ready,gateOdds,score});
 };
 for(const choice of warsla.evolutionOptions??[]){
  if(!choice.plan)continue;
  const base=me.units.find(u=>u.zone===choice.slot);
  if(base)add('evolve',base,M.total(choice.cost),choice.plan.sourceIds,choice.slot);
 }
 if(main1&&me.units.length<7&&!enemy.units.some(u=>u.replaceWeakEntry&&!u.abilitiesDisabled)){
  for(const base of me.hand.filter(c=>c.canPlay&&c.type==='通常'&&c.color==='無色'&&!c.evolution&&!c.abilities?.length&&!c.onEnter?.length&&!c.onAttack?.length&&!c.onDeath?.length&&!c.onDefeat?.length&&!c.manaAbility&&!c.speedAttacker&&!c.lure&&!c.cannotAttack&&!c.justDiver&&!Object.keys(c.symbols??{}).length)){
   const paid=base.paymentPlan?.sourceIds??[];
   const cost=M.evolutionBaseCost(warsla.evolutionCostBeforeBase,base,warsla.blueCharacter);
   const remaining=v.sources.filter(source=>!paid.includes(source.id));
   if(M.total(cost)<=remaining.length&&cost.青<=remaining.filter(source=>source.colors.includes('青')).length)add('setup',base,M.total(cost),paid);
  }
 }
 const route=best(routes,r=>r.lethal?10000:r.score+(own===4&&r.ready?100:0));
 if(!route)return {routes};
 const danger=incoming>=me.life;
 const canRemove=am&&enemy.units.length&&(knownGate||copies>0);
 const gateConfidence=knownGate||copies>0?1:0;
 const removesEnough=canRemove&&incoming-nextThreat<me.life;
 const defend=!!(danger&&removesEnough&&!route.lethal&&gateConfidence>route.gateOdds&&route.damage<enemy.life);
 const priority=own===4&&main1&&route.ready;
 if(am&&(defend||!priority&&!route.lethal&&route.score<playScore(v,am)+5+(canRemove?gateConfidence*nextThreat:0))){
  return {routes,route,action:{type:'play',id:am.id},reason:defend?'アマテラスのバウンスで次ターンを耐える見込み':'手札補充・ブロッカーを優先'};
 }
 if(route.lethal||priority||route.score>=(main1?20:13)){
  return {routes,route,action:{type:'play',id:route.kind==='setup'?route.base:warsla.id},reason:route.lethal?'即時6点で決着見込み':priority?'4ターン目の即時攻撃・ドローを優先':route.ready?'即時攻撃・ドローと残マナを評価':'軽減後の盤面価値'};
 }
 return {routes,route,reason:'横向きの進化元または攻撃・盤面の利益が小さい'};
}
function decide(v){
 if(v.result||v.actor!==v.viewer)return {type:'wait'};const {me,p,enemy,danger}=context(v),o=v.operation;
 if(v.status==='mulligan'){
  const counts={};const ids=me.hand.filter(c=>{counts[c.key]=(counts[c.key]||0)+1;return total(c)>4||counts[c.key]>2||(c.key==='gs3'&&counts[c.key]>1);}).map(c=>c.id);return {type:'mulligan',ids};
 }
 if(o){
  if(o.graveBases&&o.graveEvolution){const ids=o.graveBaseIds||[];if(ids.length<o.graveEvolution.min){const c=best(o.graveBases.filter(c=>!ids.includes(c.id)),c=>-unitValue(c));if(c)return {type:'graveBase',id:c.id};}}
  if(o.kind==='graveChoice'){if(me.blackBeginner&&o.miseryTrigger)return {type:'graveChoice',id:best(o.candidates,c=>miseryReviveScore(v,c,o))?.id};if(o.choice==='ereshMode')return {type:'graveChoice',id:me.trash.some(c=>c.type==='通常'&&c.color==='黒'&&!c.evolution&&!c.noReanimate)?'revive':'recover'};const c=best(o.candidates,c=>o.choice==='iwashinDiscard'?-keepScore(v,c):o.choice==='fushigi'?-unitValue(c)+total(c):unitValue(c));return {type:'graveChoice',id:c?.id??null};}
  if(o.kind==='gravePlace'){if(!o.slot){const slot=best(o.slots,s=>s.card?-unitValue(s.card)+(o.miseryTrigger&&me.blackBeginner&&!s.card.rest?50:0)-(o.miseryTrigger&&s.card.key==='ks14'?100:0):10000);return {type:'slot',slot:slot.id};}return {type:'gravePlace'};}

  if(o.kind==='rulePayment')return {type:'rulePay'};
  if(o.kind==='expansionChoice'&&o.choice==='parallelFaces')return {type:'expansion',id:['revolution','invasion','done'].find(id=>o.candidates.some(c=>c.id===id))};
  if(o.kind==='expansionChoice'&&o.choice==='nextCharger')return {type:'expansion',id:me.hand.length&&me.hand.every(c=>keepScore(v,c)<8)?'exchange':'done'};
  if(o.kind==='expansionChoice'&&['commanderReveal','batdragon','releaseSecond'].includes(o.choice))return {type:'expansion',id:best(o.candidates.filter(c=>!c.option),c=>unitValue(c,me.manaCount))?.id||'done'};
  if(o.kind==='expansionChoice'&&o.choice==='redSpeed')return {type:'expansion',id:best(o.candidates,c=>(c.sick&&!c.speedAttacker&&!c.rest?100:0)+unitValue(c,me.manaCount))?.id};
  if(o.kind==='expansionChoice'&&o.choice==='crystalMemory')return {type:'expansion',id:best(o.candidates,c=>keepScore(v,c))?.id};
  if(o.kind==='expansionChoice'&&o.choice.startsWith('guardian')){
   const choices=o.candidates.filter(c=>!c.option);
   const c=best(choices,c=>o.choice==='guardianPay'?-unitValue(c,me.manaCount):c.type==='通常'?unitValue(c,me.manaCount):playScore(v,c));
   return {type:'expansion',id:c?.id||'done'};
  }
  if(o.kind==='expansionChoice'&&o.choice==='judgmentLink')return {type:'expansion',id:best(o.candidates,total)?.id};
  if(o.kind==='expansionChoice'&&o.choice==='judgmentUnit')return {type:'expansion',id:best(o.candidates,c=>(c.health<=o.amount?50:0)+unitValue(c))?.id};
  if(o.kind==='expansionChoice'&&o.choice==='recoverMana')return {type:'expansion',id:best(o.candidates,c=>(c.rest?12:0)+(c.manaToken?-100:0)+(c.castFromMana?-8:0)+keepScore(v,c))?.id};
  if(o.kind==='expansionChoice'){if(o.choice==='lumiereMode'){const a=o.candidates.filter(c=>!c.disabled),order=['free',...(me.life<me.maxLife?['heal']:[]),'draw','seal','recover','heal','skip'];return {type:'expansion',id:order.find(id=>a.some(c=>c.id===id))};}if(o.choice==='zazeMode')return {type:'expansion',id:'draw'};if(o.choice==='lifeSave')return {type:'expansion',id:me.life>5?'use':'decline'};const c=best(o.candidates,c=>o.choice==='burnShield'?0:o.choice==='lockMana'?total(c):o.choice==='destroyMana'?-(total(c))+(c.manaToken?10:0):o.choice==='gigaMana'?-(unitValue(c,me.manaCount))+(c.zone==='hand'?15:0):o.choice==='celestiaHeal'?(c.maxHealth-c.health)*5+unitValue(c,me.manaCount):unitValue(c,me.manaCount));return {type:'expansion',id:c?.id||(o.choice==='executorSelect'?'done':undefined)};}
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
  if(o.kind==='sideFreePlace'){if(!o.slots?.length)return {type:'sideFree'};if(!o.slot){const slot=best(o.slots,s=>s.card?-unitValue(s.card,me.manaCount):10000);return {type:'slot',slot:slot.id};}return {type:'sideFree'};}

  if(o.kind==='shieldWindow'){const c=o.candidates.find(c=>c.shieldRule.effect==='revive')||o.candidates.find(c=>!['draw'].includes(c.shieldRule.effect))||o.candidates.find(c=>c.shieldRule.effect==='destroyAttacker')||o.candidates.find(c=>c.shieldRule.effect==='draw'&&me.counts.main>=2);return {type:'shield',id:c?.id||null};}
  if(o.kind==='resetShield')return {type:'shieldEffect',id:o.candidates[0]?.id||null};
  if(o.kind==='inspectShield')return {type:'shieldEffect',id:o.candidates[0]?.id||null};
  if(o.kind==='shieldReveal')return {type:'shieldEffect'};
  if(o.kind==='fateChoice'){const kind=v.sources.length>=8&&me.units.filter(c=>!c.cannotAttack).length>=2?'extraTurns':'fateWhim',c=o.candidates.find(c=>c.onUse?.some(e=>e.kind===kind))||o.candidates[0];return {type:'fate',key:c.key};}
  if(o.kind==='optionalEffect'&&o.effects?.some(e=>e.kind==='gaiaFree'))return {type:'optional',use:true};
  if(o.kind==='optionalEffect')return {type:'optional',use:o.effects?.some(e=>e.kind==='graveMill')?me.counts.main>=2:me.counts.main+me.counts.trash>0};
  if(o.kind==='untapMana'){const c=o.candidates.find(c=>c.rest&&!o.ids.includes(c.id));return c&&o.ids.length<o.max?{type:'untapSelect',id:c.id}:{type:'untap'};}
  if(o.kind==='handPick'){const c=best(o.candidates,c=>-keepScore(v,c));return {type:'private',id:c?.id||null};}
  if(o.kind==='recoverUnit'){const c=best(o.candidates,c=>unitValue(c,me.manaCount));return {type:'private',id:c?.id||null};}
  if(o.kind==='response'){const target=o.target;
   const trap=o.candidates.find(c=>c.key==='gr5');
   if(trap&&o.context?.type==='block'&&enemy.units.some(c=>c.id===o.context.combat?.id&&c.attack>=4))return {type:'play',id:trap.id,method:'instant'};
  const worthCountering=target?.owner!==p&&(target?.type==='呪文'||me.blueBeginner&&target?.type==='通常'&&(target.onEnter?.length||unitValue(target)>=9));
  const c=o.candidates.find(c=>c.responseOnly&&worthCountering)||o.candidates.find(c=>!c.responseOnly&&enemy.units.length);return c?{type:'play',id:c.id,method:'instant'}:{type:'pass'};}
  if(o.kind==='optionalDraw')return {type:'optional',use:me.counts.main>0};
  if(o.kind==='tokens'){const slot=best(o.slots,s=>s.card?-unitValue(s.card,me.manaCount):10000);return {type:'token',slot:slot&&(!slot.card||unitValue(slot.card,me.manaCount)<10)?slot.id:null};}
  if(['reorder','stackOrder'].includes(o.kind)){if(o.scry)return {type:'order',bottom:keepScore(v,o.candidates[0])<8};const desired=o.candidates.slice().sort((a,b)=>keepScore(v,b)-keepScore(v,a)||a.id.localeCompare(b.id));const i=desired.findIndex((c,i)=>c.id!==o.order[i]);if(i>=0){const index=o.order.indexOf(desired[i].id);return {type:'orderMove',id:desired[i].id,delta:index>i?-1:1};}return {type:'order'};}
  if(o.kind==='searchSpell'){
   const incoming=enemy.units.filter(x=>!x.cannotAttack).reduce((n,x)=>n+x.attack,0);
   const defensive=me.blueBeginner&&incoming>=me.life&&enemy.units.length;
   if(defensive){
    if(!o.zone){if(o.handSpells?.some(c=>c.key==='bn1'))return {type:'private',id:'hand'};if(me.unknownGateCopies&&o.zones.includes('main'))return {type:'private',id:'main'};}
    else{const gate=o.candidates.find(c=>c.key==='bn1');if(gate)return {type:'private',id:gate.id};}
   }
   if(!o.zone){
    const hand=best(o.handSpells||[],c=>playScore(v,c));
    return {type:'private',id:hand&&playScore(v,hand)>0?'hand':o.zones.includes('main')?'main':null};
   }
   const c=best(o.candidates,c=>playScore(v,c));
   return {type:'private',id:c&&playScore(v,c)>0?c.id:null};
  }
  if(o.kind==='inspectHand'){const c=best(o.candidates.filter(c=>c.cost&&total(c)<=o.max),c=>total(c)+unitValue(c,enemy.manaCount));return {type:'private',id:c?.id||null};}
  if(o.kind==='freeCast'){if(!o.targetId){const c=best(o.targets,c=>(o.effect==='buffUnit'?(c.owner===p?100:0):(c.owner!==p?100:0))+unitValue(c,enemy.manaCount));return {type:'useTarget',id:c.id};}return {type:'freeCast'};}
  if(o.kind==='payment'){const c=[...me.hand,...me.mana,...(me.gravePlayable||[]),...(v.exile||[]),...(me.sideboard||[])].find(c=>c.id===o.id);if(o.targets?.length&&!o.targetId){const target=best(o.targets,c=>(o.effect==='buffUnit'?(c.owner===p?100:0):(c.owner!==p?100:0))+unitValue(c,enemy.manaCount));return {type:'useTarget',id:target.id};}if((c?.type==='通常'||c?.equipment)&&o.purpose!=='set'&&!o.slot){if(c.key==='ks14'&&me.blackBeginner){const slot=best(o.slots,s=>-unitValue(s.card)+(s.card.rest?0:35)-(s.card.key==='ks14'?45:0)-M.total(c.evolutionOptions?.find(x=>x.slot===s.id)?.cost??c.cost)*4);if(slot)return {type:'slot',slot:slot.id};}if(c.evolution?.colorlessBaseDiscount&&me.blueBeginner){const planning={...v,operation:null},hand=me.hand.map(x=>x.id===c.id?{...x,canPlay:true}:x);planning.players={...v.players,[p]:{...me,hand}};const route=best(blueWarslaPlan(planning).routes.filter(r=>r.kind==='evolve'),r=>r.lethal?10000:r.score);if(route)return {type:'slot',slot:route.slot};}const slot=best(o.slots,s=>s.card?-unitValue(s.card,me.manaCount)+(c?.evolution&&!s.card.rest?100:0):10000);return {type:'slot',slot:slot.id};}return {type:'pay'};}
  if(['freePlace','returnPlace'].includes(o.kind)){const c=me.hand.find(x=>x.id===o.id);if(!o.slot){const slot=best(o.slots,s=>s.card?-unitValue(s.card,me.manaCount)+(c?.evolution&&!s.card.rest?100:0):10000);return {type:'slot',slot:slot.id};}return {type:o.kind==='returnPlace'?'returnPlace':'freePlace'};}
  if(o.kind==='freeUnit'){const c=best(o.candidates,c=>(c.owner===p?1:-1)*unitValue(c,c.owner===p?me.manaCount:enemy.manaCount));return {type:'freeUnit',id:c?.id||null};}
  if(o.kind==='effectTarget'){const c=o.effect==='mother'?motherTarget(v,o.candidates):best(o.candidates,c=>(c.owner===p?-100:0)+unitValue(c,enemy.manaCount));return {type:'target',id:c.id};}
  if(o.kind==='combat')return {type:'block',id:chooseBlock(v,o)};
  if(o.kind==='attackTarget'){const c=me.units.find(c=>c.id===o.id),a=attackChoice(v,[{card:c,targets:o.targets}]);return a?{type:'attackTarget',target:a.target}:{type:'cancelAttackTarget'};}
  if(o.kind==='discard')return {type:'discard',ids:me.hand.slice().sort((a,b)=>keepScore(v,a)-keepScore(v,b)||a.id.localeCompare(b.id)).slice(0,o.required).map(c=>c.id)};
  return {type:'wait'};
 }
 if(v.turn.step==='levelUp'&&me.growth?.ok)return {type:'grow'};
 if(v.turn.step==='charge'){
  const cards=me.hand.filter(c=>!c.generated&&!c.token&&!c.sideboardOnly);
  if(!cards.length||me.manaCount>=Math.max(10,...me.hand.map(c=>total(c))))return {type:'skipCharge'};
  const protectReflux=me.blackBeginner&&enemy.character?.key==='redcaptain'&&
   !me.structures.some(c=>c.key==='ks13')&&cards.filter(c=>c.key==='ks13').length===1&&
   me.mana.some(c=>c.color==='黒')&&cards.some(c=>c.color==='黒'&&c.key!=='ks13');
  const c=best(cards,c=>{
   const colorCount=me.mana.filter(m=>m.color===c.color).length;
   const need=me.hand.filter(x=>x.id!==c.id&&x.cost&&(x.cost[c.color]||0)>colorCount).length;
   const protectKey=me.hand.filter(x=>x.key===c.key).length===1&&['gn1','gr1','br1','bn7'].includes(c.key);
   return need*12+(colorCount===0?8:0)+(total(c)>me.manaCount+3?10:0)-keepScore(v,c)*.4
    -(protectKey?15:0)-(protectReflux&&c.key==='ks13'?18:0);
  });
  return c?{type:'charge',id:c.id}:{type:'skipCharge'};
 }
 if(['main1','main2'].includes(v.turn.step)){
  // Preserve an immediate direct win rather than tapping its mana creature to deploy more cards.
  if(v.turn.step==='main1'&&enemy.life<=Math.max(0,...me.units.map(c=>c.attack||0))&&!enemy.units.some(c=>c.lure)&&me.units.some(c=>!c.rest&&!c.sick&&!c.cannotAttack))return {type:'advance'};
  const warsla=me.blueBeginner?blueWarslaPlan(v):null;
  if(warsla?.action)return warsla.action;
  if(me.character?.key==='lumiere'&&me.shieldLinkCount<5){if(me.character.level===3&&me.character.activeTurn!==v.turn.counts[p]&&me.hand.some(c=>c.shieldLink))return {type:'characterAbility'};if(me.character.level===4&&v.sources.length&&me.lumiereUsed.length<5)return {type:'characterAbility'};}
  if(me.guardianReady)return {type:'characterAbility'};
  if(me.character?.key==='eira'&&me.character.level===4&&me.life<me.maxLife&&me.character.activeTurn!==v.turn.counts[p])return {type:'characterAbility'};
  if(me.character?.key==='ereshthianox'&&me.character.level===4&&me.character.activeTurn!==v.turn.counts[p])return {type:'characterAbility'};
  if(me.units.some(c=>c.cardcarAbility)&&me.hand.length<3&&me.counts.main>=4){const c=me.units.find(c=>c.cardcarAbility);return {type:'cardcar',id:c.id};}
  if(me.redAbilityReady&&(me.character.level===4||v.turn.step==='main1'&&me.units.some(c=>c.sick&&!c.speedAttacker&&!c.rest&&!c.cannotAttack)))return {type:'characterAbility'};
  if(me.rituelReady?.length&&v.turn.step==='main2'&&(me.counts.main>2||me.life<me.maxLife))return {type:'rituel',id:me.rituelReady[0]};
  const usable=[...me.hand,...me.mana,...(me.gravePlayable||[]),...(v.exile||[]),...(me.sideboard||[])].filter(c=>c.canPlay);
  const c=best(usable,c=>playScore(v,c));
  if(c&&playScore(v,c)>0)return {type:'play',id:c.id,...(c.canEnhance&&me.units.length<6?{method:'enhance'}:{})};
 }else if(v.turn.step==='attack'){const a=attackChoice(v);if(a)return {type:'attack',id:a.id,target:a.target};}
 return v.canAdvance?{type:'advance'}:{type:'wait'};
}
return {decide,unitValue,playScore,chooseBlock,keepScore,blueWarslaPlan};
});
