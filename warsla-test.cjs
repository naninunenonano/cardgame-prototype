'use strict';
const assert=require('node:assert/strict');
const Game=require('./game');
const Bot=require('./bot');
const Mana=require('./mana');
const {fund,skipCharge}=require('./test-fixtures.cjs');
const yes=r=>assert(r.ok,r.message);
function put(g,key,zone='hand',p='p1'){
 const card=g.fromDefinition(key,p);
 g.state[p][zone].push(card);
 return card;
}
function fixture(mana=4){
 const g=Game.create({decks:{p1:'blueBeginner',p2:'redBeginner'},random:()=>.4,strictTargets:true});
 yes(g.completeMulligan('p1'));yes(g.completeMulligan('p2'));skipCharge(g);
 g.state.p1.hand=[];g.state.p2.hand=[];g.state.p2.shields=[];
 g.turn.counts.p1=4;
 fund(g,'p1',mana,'青');
 return g;
}
function settle(g){
 while(g.operation?.kind==='response')yes(g.passResponse());
}
function cast(g,card,slot){
 yes(g.beginPayment(card.id));yes(g.chooseSlot(slot));yes(g.confirmPayment());settle(g);
}
for(const [key,cost,rest] of [['nn2',2,false],['nn4',1,false],['nn9',0,true],['rn15',4,false]]){
 const g=fixture(cost),base=put(g,key,'signi-1'),w=put(g,'ns2');
 base.rest=rest;base.sick=true;
 assert(g.playStatus(w,'p1').ok);
 yes(g.beginPayment(w.id));yes(g.chooseSlot('signi-1'));
 assert.equal(Mana.total(g.paymentInfo().cost),cost);
 yes(g.confirmPayment());settle(g);
 assert.equal(w.rest,rest);assert(!w.sick);
}
for(let n=1;n<=6;n++){
 const base={type:'通常',color:'無色',cost:Mana.cost(n)};
 assert.equal(Mana.total(Mana.evolutionBaseCost(Mana.cost(4),base)),Math.max(0,4-n));
}
{
 const g=fixture(2), w=put(g,'ns2'), no=put(g,'rn15','signi-1'), yesBase=put(g,'nn9','signi-2');
 yes(g.beginPayment(w.id));assert(!g.chooseSlot('signi-1').ok);
 assert.deepEqual(g.observe('p1').operation.slots.map(x=>x.card.id),[yesBase.id]);
 yes(g.chooseSlot('signi-2'));assert.equal(g.paymentInfo().sources.length,0);
 yes(g.cancelPayment());assert.equal(g.locate(no.id).z,'signi-1');
}
{
 const g=fixture(6), w=put(g,'ns2'), base=put(g,'nn2'), am=put(g,'bs2');
 const target=put(g,'nn4','signi-1','p2');
 assert.equal(Bot.decide(g.observe('p1')).id,base.id);
 cast(g,base,'signi-1');
 assert.equal(Bot.decide(g.observe('p1')).id,w.id);
 cast(g,w,'signi-1');assert(!w.sick);
 assert.equal(g.paymentSources('p1').length,2);
 g.state.p1.main=[];const spell=put(g,'bn1','main');
 put(g,'nn2','main');put(g,'nn3','main');
 g.turn.step='attack';yes(g.declareAttack(w.id,'body'));settle(g);
 if(g.operation?.kind==='combat')yes(g.resolveAttack(null));
 settle(g);
 assert.equal(g.operation?.kind,'optionalEffect');
 yes(g.resolveOptional(true));settle(g);
 assert(g.state.p1.hand.includes(spell));assert.equal(g.operation?.kind,'handPick');
 yes(g.resolvePrivate(am.id));settle(g);
 if(g.operation?.kind==='combat')yes(g.resolveAttack(null));
 settle(g);assert.equal(g.life.p2,24);
 g.turn.notBefore=0;yes(g.advance());
 yes(g.beginPayment(spell.id));yes(g.selectUseTarget(target.id));yes(g.confirmPayment());settle(g);
 assert.equal(g.locate(target.id).z,'hand');
}
{
 const g=fixture(6),w=put(g,'ns2'), am=put(g,'bs2');
 put(g,'nn2');const attacker=put(g,'rs4','signi-1','p2');
 put(g,'rn15','signi-2','p2');
 g.turn.counts.p1=5;yes(g.setLife('p1',4));
 assert.equal(Bot.decide(g.observe('p1')).id,am.id);
 assert.equal(g.locate(w.id).z,'hand');assert(attacker.attack>4);
}
console.log('PASS Warsla costs, base selection, same-turn evolution and attack, draw, and defensive Amaterasu');
