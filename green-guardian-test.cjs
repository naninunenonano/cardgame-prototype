'use strict';
const A=require('node:assert/strict');
const {create}=require('./game');
const D=require('./decks');
const C=require('./cards');
const Bot=require('./bot');
const M=require('./mana');
const {fund}=require('./test-fixtures.cjs');
const id='verdantguardian',p='p1',q='p2',yes=r=>A(r.ok,r.message);
const deck=D.preset('greenBeginner');
A.deepEqual(D.validate(deck),[]);
A.deepEqual(deck.main.map(x=>[x.key,x.count]),['nn9','nn2','nn3','nn4','nn5','gs6','gn2','gn4','gs5','gs1','gn1','gr1','gr2','gr5'].map(k=>[k,k==='gr2'?1:3]));
A.deepEqual(deck.sideboard.map(x=>[x.key,x.count]),[[id,1],['sbnn1',3],['sbnr2',2],['sbnr3',2],['sbnr1',1],['sbns1',1]]);
A.deepEqual(deck.shields.map(x=>[x.key,x.count]),['shnr1','shnr5','shnr3','shnr2'].map(k=>[k,1]));
A.equal(C.cards[id].rarity,'UR');
A(D.selectableBeginnerBotIds.includes(deck.id));
function init(){
 const g=create({decks:{p1:deck.id,p2:'redBeginner'},strictTargets:true,random:()=>.4});
 for(const x of [p,q]){yes(g.completeMulligan(x));g.state[x].hand=[];g.state[x].shields=[];}
 g.turn.step='main1';fund(g,p,14,'緑');
 return g;
}
function put(g,key,zone='hand',owner=p){
 const c=g.fromDefinition(key,owner);g.state[owner][zone].push(c);return c;
}
function grow(g,level){
 A.equal(g.growStatus(p).nextCost,[0,1,3,5,7][level]);
 yes(g.beginGrowth(p));yes(g.confirmPayment());
 A.equal(g.character(p).level,level);
 g.turn.counts[p]++;
 for(const c of g.state[p].energy)c.rest=false;
}
function choose(g,id){yes(g.resolveExpansion(id));}
function place(g,slot='signi-1'){yes(g.chooseSlot(slot));yes(g.confirmSideFree());}
{
 const g=init();
 A.equal(g.state[p].extra.find(c=>c.key===id).cost.generic,1);
 A.equal(g.state[p].hand.length,0);grow(g,1);A.equal(g.state[p].hand.length,1);
 const spell=put(g,'gn1'),high=put(g,'gs1');grow(g,2);
 A(!g.expansionCandidates().some(c=>c.id===high.id));
 A.equal(g.observe(q).operation.candidates,undefined);
 A(!g.resolveExpansion(high.id).ok);
 const before=g.manaCount(p);choose(g,spell.id);
 A.equal(g.manaCount(p),before+1);
 A.equal(g.locate(spell.id).z,'trash');
}
for(const [key,zone] of [['wn2','structures'],['nn9','signi-1']]){
 const g=init();grow(g,1);const c=put(g,key);grow(g,2);choose(g,c.id);
 if(zone==='signi-1')place(g);
 A.equal(g.locate(c.id).z,zone);
}
for(const use of [true,false]){
 const g=init();grow(g,1);grow(g,2);choose(g,'done');
 const old=g.state[p].main.splice(0);
 const top=['nn9','nn2','nn3','gs1','nn5'].map(k=>put(g,k,'main'));
 g.state[p].main.push(...old);
 const hand=g.state[p].hand.length;grow(g,3);
 g.state[p].energy.splice(4);
 A(!g.expansionCandidates().some(c=>c.id===top[3].id));
 A.equal(g.operation.ids.length,5);A.equal(g.observe(q).operation.ids,undefined);
 choose(g,use?top[0].id:'done');
 if(use)place(g);
 const remaining=top.slice(use?1:0).map(c=>c.id);
 const bottom=g.state[p].main.slice(-remaining.length).map(c=>c.id);
 A.notDeepEqual(bottom,remaining);A.deepEqual([...bottom].sort(),[...remaining].sort());
 A.equal(g.state[p].hand.length,hand);
 if(use)A.equal(g.locate(top[0].id).z,'signi-1');
 fund(g,p,7,'緑');grow(g,4);A.equal(g.operation,null);A.equal(g.state[p].hand.length,hand);
}
for(const revealUnit of [true,false]){
 const g=init();grow(g,1);grow(g,2);choose(g,'done');grow(g,3);choose(g,'done');grow(g,4);
 A.equal(g.costBreakdown(g.state[p].extra.find(c=>c.key==='sbnn1'),p).level4,3);
 const pay=put(g,'nn2','signi-1'),small=put(g,'nn3','signi-1',q),large=put(g,'gs1','signi-2',q);
 const top=put(g,revealUnit?'nn9':'gn1','main');
 g.state[p].main.unshift(g.state[p].main.pop());
 yes(g.beginCharacterAbility(p));choose(g,pay.id);A.equal(g.locate(pay.id).z,'energy');
 if(revealUnit){
  place(g);A(g.locate(top.id).card.sick);
  A(!g.expansionCandidates().some(c=>c.id===large.id));
  choose(g,small.id);A.equal(g.locate(small.id).z,'energy');
 }else{
  A.equal(g.locate(top.id).z,'energy');choose(g,pay.id);
  A.equal(g.locate(pay.id).z,'hand');
 }
 A(!g.beginCharacterAbility(p).ok);
 g.turn.counts[p]++;
 put(g,'nn2','signi-2');yes(g.beginCharacterAbility(p));
}
let largeEntry=false;
for(const [i,opponent] of ['redBeginner','blueBeginner'].entries()){
 let seed=701+i;
 const g=create({mode:'bot',decks:{p1:opponent,p2:deck.id},strictTargets:true,random:()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296)});
 for(let step=0;step<12000&&!g.result;step++){
  g.turn.notBefore=0;
  const who=g.decisionPlayer(),action=Bot.decide(g.observe(who)),r=g.dispatch(action,who);
  A(r.ok,JSON.stringify({opponent,step,action,operation:g.operation?.kind,message:r.message}));
 }
 A(g.result,opponent);
 const log=g.battleLog(q);
 A(log.some(e=>e.kind==='growth'&&e.actor===q&&e.level>=3));
 largeEntry||=log.some(e=>e.kind==='unitEntry'&&e.actor===q&&['gs5','gs1'].includes(e.card?.cardId));
}
A(largeEntry,'大型クリーチャーの登場を確認');
console.log('PASS 緑初級構成、成長、無料使用、非公開の山札確認、Lv4両分岐、Bot対戦2戦');
