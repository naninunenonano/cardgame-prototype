'use strict';
const A=require('node:assert/strict'),G=require('./game'),D=require('./decks'),{cards}=require('./cards'),{fund,skipCharge}=require('./test-fixtures.cjs');
const yes=r=>A(r.ok,r.message);
function fixture(){
 const g=G.create({decks:{p1:'redBeginner',p2:'blueBeginner'},random:()=>.4,strictTargets:true});
 yes(g.completeMulligan('p1'));yes(g.completeMulligan('p2'));skipCharge(g);
 g.state.p1.hand=[];g.state.p2.hand=[];g.state.p2.shields=[];fund(g,'p1',8,'赤');return g;
}
function add(g,key,z='hand',p='p1'){const c=g.fromDefinition(key,p);g.state[p][z].push(c);return c;}
function settle(g){while(g.operation?.kind==='response'||g.operation?.kind==='tokens'){if(g.operation.kind==='response')yes(g.passResponse());else yes(g.placeToken(g.observe('p1').operation.slots[0].id));}}
function cast(g,key,method){const c=add(g,key);yes(g.beginPayment(c.id,method));yes(g.chooseSlot('signi-1'));yes(g.confirmPayment());settle(g);return c;}
const deck=D.preset('redBeginner');
A.deepEqual(D.validate(deck),[]);
A.deepEqual(deck.main.filter(x=>cards[x.key].rarity==='SR').map(x=>[x.key,x.count]),[['rs1',3],['rs5',3],['rs4',3]]);
A.deepEqual(cards.rs5.enhanceCost,require('./mana').cost(6,{赤:2}));
A.deepEqual(cards.rs4.cost,require('./mana').cost(4,{赤:2}));
{
 const g=fixture(), c=cast(g,'rs5');
 A.equal(c.name,'カインドクイーン・ヴァンピィ');
 A.equal(g.fieldCards('p1').filter(c=>c.key==='t12').length,2);
 A.equal(g.life.p2,26);
}
{
 const g=fixture(),enemy=add(g,'nn4','signi-1','p2'),c=cast(g,'rs5','enhance');
 A.equal(c.name,'ブラッドクイーン・ヴァンピィ');
 A.equal(g.locate(enemy.id).z,'trash');
 A.equal(c.health,12);
 const token=g.fieldCards('p1').find(c=>c.key==='t13');
 yes(g.manualMove(token.id,'p1','trash'));A(!g.locate(token.id));A.equal(c.health,10);
 yes(g.manualMove(c.id,'p1','hand'));A.equal(c.name,'カインドクイーン・ヴァンピィ');A(!g.fieldCards('p1').some(c=>c.key==='t13'));
}
{
 const g=fixture(),c=cast(g,'rs4');
 A.equal(g.operation.choice,'galmieux');yes(g.resolveStarter(c.id));
 A.equal(c.health,5);A(c.galmieuxMach);A.equal(g.life.p2,27);
}
{
 const g=fixture(),c=cast(g,'rs1');
 A(g.hasSpeed(c));
}
console.log('PASS red SR deck, normal and enhanced Vampy, token cleanup, Galmieux, Crimson speed');
