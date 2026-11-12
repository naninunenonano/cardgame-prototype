'use strict';
const assert=require('node:assert/strict');
const Game=require('./game');
const Decks=require('./decks');
const {cards}=require('./cards');
const {fund,skipCharge}=require('./test-fixtures.cjs');
const yes=r=>assert(r.ok,r.message);

function fixture(){
 const g=Game.create({random:()=>.4,decks:{p1:'blueBeginner',p2:'blueBeginner'}});
 yes(g.completeMulligan('p1'));yes(g.completeMulligan('p2'));skipCharge(g);
 g.state.p1.hand=[];g.state.p2.hand=[];
 fund(g,'p1',12,'青');fund(g,'p1',2,'黒');fund(g,'p2',3,'青');
 return g;
}
function give(g,key,p='p1',zone='hand'){
 const c=g.fromDefinition(key,p);g.state[p][zone].push(c);return c;
}
function play(g,c,slot){
 yes(g.beginPayment(c.id));if(slot)yes(g.chooseSlot(slot));yes(g.confirmPayment());
}
function counter(g,c){
 assert.equal(g.operation.kind,'response');
 assert.equal(g.decisionPlayer(),'p2');
 play(g,c);
 while(g.operation?.kind==='response')yes(g.passResponse());
}
function success(g,category){
 assert.equal(g.battleLog('p1',{detailed:true}).filter(e=>e.kind==='counterSuccess').at(-1).category,category);
}

{
 const deck=Decks.preset('blueBeginner');
 assert.deepEqual(Decks.validate(deck),[]);
 assert.equal(deck.main.reduce((n,e)=>n+e.count,0),40);
 assert.deepEqual(deck.main.reduce((counts,e)=>{
  const rarity=cards[e.key].rarity;counts[rarity]=(counts[rarity]||0)+e.count;return counts;
 },{}),{N:28,R:3,SR:9});
 assert(!deck.main.some(e=>['bl2','bn2','bn6'].includes(e.key)));
 assert.deepEqual(deck.sideboard.map(e=>e.key),['bluesage']);
 assert.deepEqual(deck.shields.map(e=>e.key),['shnr4','shnr5','shns1','shnr6']);
}
{
 const g=fixture(),c=give(g,'br3','p2'),luna=give(g,'bs1');
 for(let i=0;i<9;i++)give(g,'nn2');
 assert.equal(g.beginPayment(c.id).ok,false);
 play(g,luna,'signi-1');
 assert.equal(g.paymentSources('p1').length,14);
 counter(g,c);
 assert.equal(g.locate(luna.id).z,'trash');
 assert.equal(g.state.p1.hand.length,9);
 success(g,'specialSummon');
}
{
 const g=fixture(),c=give(g,'br3','p2'),luna=give(g,'bs1','p1','trash');
 play(g,give(g,'ks9'));
 yes(g.passResponse());
 assert.equal(g.operation.kind,'graveChoice');
 yes(g.resolveGraveChoice(luna.id));yes(g.chooseSlot('signi-1'));yes(g.confirmGravePlacement());
 counter(g,c);
 assert.equal(g.locate(luna.id).z,'trash');
 assert.equal(g.state.p1.hand.length,0);
 success(g,'effectEntry');
}
{
 const g=fixture(),c=give(g,'br3','p2');
 play(g,give(g,'bn5'));yes(g.passResponse());
 yes(g.placeToken('signi-1'));counter(g,c);
 assert.equal(g.state.p1['signi-1'].length,0);
 success(g,'effectEntry');
 assert.equal(g.operation.kind,'tokens');
 yes(g.placeToken('signi-2'));yes(g.placeToken('signi-3'));
 assert.equal(g.fieldCards('p1').filter(c=>c.token).length,2);
}
{
 const g=fixture(),c=give(g,'br3','p2'),amaterasu=give(g,'bs2');
 play(g,amaterasu,'signi-1');counter(g,c);
 assert.equal(g.locate(amaterasu.id).z,'trash');
 assert.equal(g.operation,null);
 success(g,'normalSummon');
}
console.log('PASS counterspell and blue beginner deck regressions');
