'use strict';
const Decks=require('./decks');
const Mana=require('./mana');
const sides=['p1','p2'];
const board=z=>z==='structures'||/^signi-[1-7]$/.test(z);
const row=()=>({uses:0,turns:0,ready:0,skipped:0,cost:0,condition:0,seen:0,activations:0,damage:0,unitDamage:0,removal:0,bounce:0,discard:0,draw:0,heal:0,charge:0,manaPaid:0,reduction:0,selfDamage:0,blocks:0});
function setup(game,ids){
 const state=game.state;
 const stats={}, refs=new Map();
 for(const p of sides){
  const deck=Decks.preset(ids[p]);
  stats[p]=Object.fromEntries(['main','sideboard','shields'].flatMap(z=>deck[z].map(e=>[e.key,row()])));
  for(const c of [...state[p].main,...state[p].hand,...state[p].extra,...state[p].shields]){
   refs.set(c.id,{p,key:c.key,main:state[p].main.includes(c)||state[p].hand.includes(c)});
   if(c.type==='キャラクター')for(let i=1;i<=4;i++)stats[p][c.key+':'+i]=row();
  }
 }
 function decision(v,a){
  const p=v.viewer,m=v.players[p],o=v.operation;
  const byKey=new Map();
  function option(c,ready,chosen=false,cost=false){
   if(!refs.has(c.id)||refs.get(c.id).p!==p)return;
   const key=c.studyKey||refs.get(c.id).key,cur=byKey.get(key)||[false,false,false];
   byKey.set(key,[cur[0]||ready,cur[1]||chosen,cur[2]||cost]);
  }
  if(!o&&['main1','main2'].includes(v.turn.step)&&v.actor===p){
   for(const c of [...m.hand,...m.sideboard,...m.gravePlayable,...m.mana.filter(c=>c.castFromMana)]){
    const character=c.type==='キャラクター';
    if(character)continue;
    option(c,c.canPlay,a.id===c.id&&a.type==='play',Object.hasOwn(c,'paymentPlan')&&c.paymentPlan===null&&!!c.cost);
   }
   const character=m.character||m.sideboard.find(x=>x.type==='キャラクター');
   if(character&&(character.level||0)<4){
    option(character,m.growth.ok,a.type==='grow');
    option({...character,studyKey:character.key+':'+((character.level||0)+1)},m.growth.ok,a.type==='grow');
   }
  }else if(['shieldWindow','response','sideChoice','starterChoice','revolution'].includes(o?.kind)){
   if(o.kind==='revolution')option({id:o.swapId},true,a.use===true);
   else if(o.kind!=='sideChoice'||o.choice==='viceOffer')for(const c of o.candidates||[])
    option(c,true,a.id===c.id);
  }
  for(const c of m.hand){const id=refs.get(c.id);if(id?.p===p)stats[p][id.key].seen=1;}
  for(const [key,[ready,chosen,cost]] of byKey){
   const s=stats[p][key];s.seen=1;
   if(ready){s.ready++;if(!chosen)s.skipped++;}
   else if(cost)s.cost++;
   else s.condition++;
  }
 }
 function finish(journal=require('./beginner-round-log.cjs').journal(game)){
  const pending=new Set(),level={};
  let source=null,body=null;
  const uses=(s,e)=>{if(s){s.uses++;s.turns+=e.turnSequence;}};
  function lookup(ref,withLevel=false){
   const id=refs.get(ref?.instanceId);
   if(!id)return null;
   return {id,s:stats[id.p][withLevel&&level[ref.instanceId]?id.key+':'+level[ref.instanceId]:id.key]};
  }
  function gain(ref,metric,n=1,p=null,opponent=false){
   const x=lookup(ref,true);if(x&&(!p||(opponent?x.id.p!==p:x.id.p===p)))x.s[metric]+=n;
  }
  // A choice can resume an effect in a later dispatch. Its audit record is
  // written after resolution, so associate it with the preceding events.
  const resumed=new Map();
  let end=null;
  for(let i=journal.length-1;i>=0;i--){
   const e=journal[i];
   if(e.kind==='dispatch')end=e;
   else if(['trap','mother','bounce','topUnit','enemyBounce','enemyUnitBounce','destroyTapped','buffUnit','inspectHand','sideChoice','shieldWindow','expansionChoice'].includes(end?.choice))resumed.set(e.number,end.source);
  }
  for(const e of journal){
   const c=e.card,id=c?.instanceId,x=lookup(c);
   if(e.kind==='dispatch'){source=body=null;continue;}
   const origin=()=>source||resumed.get(e.number);
   if(e.kind==='growth'&&x){level[id]=e.level;uses(x.s,e);uses(lookup(c,true).s,e);source=c;}
   if(e.kind==='effect'){source=e.source;gain(source,'activations');}
   if(e.kind==='cardUse'){source=c;if(c?.type==='呪文')uses(x?.s,e);}
   if(e.kind==='move'){
    pending.delete(id);
    if(board(e.to?.zone)&&!board(e.from?.zone)){
     if(e.to.zone==='structures')uses(x?.s,e);else pending.add(id);
    }
    if(board(e.from?.zone)&&['hand','main'].includes(e.to?.zone))gain(origin(),'bounce',1,e.from.player,true);
    if(e.from?.zone==='hand'&&e.to?.zone==='trash')gain(origin(),'discard',1,e.from.player,true);
   }
   if(e.kind==='unitEntry'&&pending.delete(id))uses(x?.s,e);
   if(e.kind==='shieldDecision'&&e.used){uses(x?.s,e);source=c;if(e.automatic&&x){x.s.ready++;x.s.seen=1;}}
   if(e.kind==='payment'){
    for(const ref of e.sources||[])gain(ref,'manaPaid');
    if(x&&e.baseCost&&e.paidCost)x.s.reduction+=Math.max(0,Mana.total(e.baseCost)-Mana.total(e.paidCost));
   }
   if(e.kind==='combatDamage'){
    gain(e.after.attacker,'unitDamage',e.damageToDefender);
    gain(e.after.defender,'unitDamage',e.damageToAttacker);
   }
   if(e.kind==='bodyStrike')body=e.attacker;
   if(e.kind==='block'&&e.blocked)gain(e.blocker,'blocks');
   if(e.kind==='draw')gain(e.source||origin(),'draw',e.count,e.actor);
   if(e.kind==='unitDestroyed'&&e.reason!=='戦闘')gain(origin(),'removal',1,e.actor,true);
   if(e.kind==='unitDamage')gain(origin(),'unitDamage',Math.max(0,e.beforeHealth-e.afterHealth),c?.owner,true);
   if(e.kind==='life'&&!e.direct){
    const n=e.afterLife-e.beforeLife;
    if(n>0)gain(origin(),'heal',n,e.targetPlayer);
    if(n<0)gain(origin(),'selfDamage',-n,e.targetPlayer);
    if(n<0)gain(e.reason==='戦闘ダメージ'?body:origin(),'damage',Math.min(-n,Math.max(0,e.beforeLife)),e.targetPlayer,true);
   }
   if(e.kind==='manaPlaced'&&e.fromZone==='hand'&&x&&x.id.main)x.s.charge++;
  }
  return stats;
 }
 return {decision,finish};
}
module.exports={setup,row};
