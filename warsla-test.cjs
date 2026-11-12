'use strict';
const assert=require('node:assert/strict');
const Game=require('./game');
const Bot=require('./bot');
const Mana=require('./mana');
const Decks=require('./decks');
const Identity=require('./identity');
const {cards}=require('./cards');
const Images=require('./card-images');
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
 const g=fixture(cost),base=put(g,key,'signi-1'),w=put(g,'bs5');
 base.rest=rest;base.sick=true;
 assert(g.playStatus(w,'p1').ok);
 yes(g.beginPayment(w.id));yes(g.chooseSlot('signi-1'));
 assert.equal(Mana.total(g.paymentInfo().cost),cost);
 yes(g.confirmPayment());settle(g);
 assert.equal(w.rest,rest);assert(!w.sick);
}
for(let n=1;n<=6;n++){
 const base={type:'通常',color:'無色',cost:Mana.cost(n)};
 const printed=Mana.cost(0,{青:4});
 assert.equal(Mana.evolutionBaseCost(printed,base,true).青,Math.max(0,4-n));
 assert.equal(Mana.evolutionBaseCost(printed,base,false).青,Math.max(1,4-n));
}
{
 const g=fixture(2), w=put(g,'bs5'), no=put(g,'rn15','signi-1'), yesBase=put(g,'nn9','signi-2');
 yes(g.beginPayment(w.id));assert(!g.chooseSlot('signi-1').ok);
 assert.deepEqual(g.observe('p1').operation.slots.map(x=>x.card.id),[yesBase.id]);
 yes(g.chooseSlot('signi-2'));assert.equal(g.paymentInfo().sources.length,0);
 yes(g.cancelPayment());assert.equal(g.locate(no.id).z,'signi-1');
}
{
 const g=fixture(6), w=put(g,'bs5'), base=put(g,'nn2'), am=put(g,'bs2');
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
 settle(g);assert.equal(g.life.p2,14);
 g.turn.notBefore=0;yes(g.advance());
 yes(g.beginPayment(spell.id));yes(g.selectUseTarget(target.id));yes(g.confirmPayment());settle(g);
 assert.equal(g.locate(target.id).z,'hand');
}
{
 const g=fixture(6),w=put(g,'bs5'), am=put(g,'bs2');
 put(g,'nn2');const attacker=put(g,'rs4','signi-1','p2');
 put(g,'rn15','signi-2','p2');
 g.turn.counts.p1=5;yes(g.setLife('p1',4));
 assert.equal(Bot.decide(g.observe('p1')).id,am.id);
 assert.equal(g.locate(w.id).z,'hand');assert(attacker.attack>4);
}
{
 const g=fixture(), w=put(g,'bs5'), base=put(g,'nn2','signi-1');
 const blue=put(g,'bs2','signi-2');
 blue.rest=true;blue.symbols.青=2;
 put(g,'bs2','energy');
 assert.equal(g.effectiveCost(w,'p1').青,4);
 assert.equal(g.evolutionPaymentOptions(w,'p1')[0].cost.青,2);
 g.state.p1.lrig.length=0;const red=put(g,'redcaptain','lrig');red.level=4;
 assert.equal(g.evolutionPaymentOptions(w,'p1')[0].cost.青,2);
 assert.equal(g.effectiveCost(w,'p1').青,4);
 const side=put(g,'sbnr3','extra');side.cost=Mana.cost(3,{青:4});
 side.reduction={minimum:{青:1}};
 assert.deepEqual(g.effectiveCost(side,'p1'),Mana.cost(3,{青:4}));
 blue.symbols.青=0;
 assert.deepEqual(g.effectiveCost(side,'p1'),Mana.cost(3,{青:4}));
 assert.equal(g.costBreakdown(w,'p1').level4,0);
 base.symbols={青:1};w.symbols={青:1};
 cast(g,w,'signi-1');
 assert.equal(g.symbols('p1').青,1);
 assert.equal(g.effectiveCost(w,'p1').青,4);
 const shaper=put(g,'bn1');
 shaper.cost=Mana.cost(0,{青:3});shaper.reduction={minimum:{青:1}};
 assert.equal(g.effectiveCost(shaper,'p1').青,3);
}
{
 const g=fixture(0), w=put(g,'bs5'), golem=put(g,'nn9');
 fund(g,'p1',4,'緑');
 assert.equal(Bot.decide(g.observe('p1')).id,golem.id);
 cast(g,golem,'signi-1');
 assert.equal(Bot.decide(g.observe('p1')).id,w.id);
 cast(g,w,'signi-1');
 assert.equal(g.paymentSources('p1').length,0);
 assert(!w.sick);
}
{
 const g=fixture(0), w=put(g,'bs5');
 put(g,'nn2');fund(g,'p1',4,'緑');
 assert.deepEqual(Bot.blueWarslaPlan(g.observe('p1')).routes,[]);
 assert.equal(g.locate(w.id).z,'hand');
}
{
 assert.equal(cards.bs5.color,'青');
 assert.deepEqual(cards.bs5.cost,Mana.cost(0,{青:4}));
 assert.deepEqual(cards.bs5.symbols,{青:1});
 assert.equal(Identity.canonicalKey('ns2'),'bs5');
 assert.equal(Identity.canonicalKey('walsura'),'bs5');
 assert.deepEqual(Decks.migrateOwned({ns2:2}),{bs5:2});
 assert.deepEqual(Decks.migrateDeck({main:[{key:'ns2',count:3}]}).main,[{key:'bs5',count:3}]);
 const collection=require('./collection').create({storage:{getItem:()=>JSON.stringify({version:2,active:'old',processed:[],profiles:[{id:'old',name:'移行',granted:true,starterChoice:'blue',owned:{ns2:2},materials:10,characters:[],decks:[]}]}),setItem(){}}});
 assert.equal(collection.profile().owned.bs5,2);
 assert(require('./packs').pool().some(c=>c.key==='bs5'));
 assert.equal(Images.path(cards.bs5.faceId),'images/cards/bs5.png');
 assert(Identity.registry.retiredIds.includes('ns2'));
}
console.log('PASS Warsla costs, base selection, same-turn evolution and attack, draw, and defensive Amaterasu');
