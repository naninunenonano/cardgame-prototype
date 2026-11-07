'use strict';
const assert=require('node:assert/strict');
const Game=require('./game');
const Decks=require('./decks');
const Bot=require('./bot');
const {cards}=require('./cards');
const {fund,skipCharge}=require('./test-fixtures.cjs');
const yes=r=>assert(r.ok,r.message);
assert.equal(cards.bs2.attack,4);
assert.equal(cards.bs2.maxHealth,4);
assert.deepEqual(cards.bs2.abilities,['ブロッカー']);
assert.equal(cards.bs2.rarity,'SR');
assert.equal(cards.bs2.cost.青,2);
assert.equal(cards.bs2.cost.generic,4);
assert.deepEqual(cards.bs2.symbols,{青:1});
assert.deepEqual(Decks.validate(Decks.preset('blueBeginner')),[]);
function fixture(){
 let calls=0;
 const g=Game.create({random:()=>{calls++;return .4;},decks:{p1:'blueBeginner',p2:'blueBeginner'},strictTargets:true});
 yes(g.completeMulligan('p1'));yes(g.completeMulligan('p2'));skipCharge(g);
 g.state.p1.hand=[];g.state.p2.hand=[];g.state.p1.main=[];
 fund(g,'p1',10,'青');
 return {g,calls:()=>calls};
}
function put(g,key,z='hand',p='p1'){const c=g.fromDefinition(key,p);g.state[p][z].push(c);return c;}
function cast(g){
 const c=put(g,'bs2');
 yes(g.beginPayment(c.id));yes(g.chooseSlot('signi-1'));yes(g.confirmPayment());while(g.operation?.kind==='response')yes(g.passResponse());return c;
}
for(const z of ['hand','main']){
 const {g,calls}=fixture();
 const chosen=put(g,'br1',z),other=put(g,'br1',z==='hand'?'main':'hand');
 const invalid=put(g,'br3',z),expensive=put(g,'bs3',z),noTarget=put(g,'bn1',z);
 for(let i=0;i<7;i++)put(g,'nn2','main');
 // Use a friendly unit to fill the first slot only after the summon if a target is needed.
 const c=cast(g),n=calls(),mana=g.paymentSources('p1').length;
 assert.equal(g.locate(c.id).z,'signi-1',JSON.stringify(g.operation));
 assert.equal(g.operation.kind,'searchSpell');
 assert.deepEqual(g.privateCandidates(),[]);
 assert.equal(g.observe('p2').operation.candidates,undefined);
 yes(g.resolvePrivate(z));
 assert(g.privateCandidates().includes(chosen));
 assert(!g.privateCandidates().some(x=>[invalid,expensive,other].includes(x)));
 assert(g.privateCandidates().includes(noTarget)); // The newly entered Amaterasu is a legal Gate target.
 assert.equal(g.resolvePrivate(invalid.id).ok,false);
 const before=g.state.p1.hand.length;
 yes(g.resolvePrivate(chosen.id));
 while(g.operation?.kind==='response')yes(g.passResponse());
 assert.equal(g.operation,null);
 assert.equal(g.locate(chosen.id).z,'trash');
 assert.equal(g.state.p1.hand.length,before+3-(z==='hand'?1:0));
 assert.equal(g.paymentSources('p1').length,mana);
 assert.equal(calls()>n,z==='main');
}
{
 const {g,calls}=fixture();
 put(g,'br1','main');put(g,'nn2','main');cast(g);
 const n=calls();yes(g.resolvePrivate('main'));yes(g.resolvePrivate(null));
 assert(calls()>n);assert.equal(g.operation,null);
}
{
 const {g}=fixture();
 put(g,'br3','hand');put(g,'bs3','main');
 cast(g);assert.equal(g.operation,null);
}
{
 const {g}=fixture();
 const brain=put(g,'br1','hand');put(g,'br1','main');put(g,'nn2','main');
 for(let i=0;i<10;i++)put(g,'nn2','main');
 cast(g);
 const source=Bot.decide(g.observe('p1'));assert.equal(source.id,'hand');yes(g.dispatch(source,'p1'));
 const spell=Bot.decide(g.observe('p1'));assert.equal(spell.id,brain.id);yes(g.dispatch(spell,'p1'));
}
{
 const {g}=fixture(),blocker=cast(g);
 assert.equal(g.operation,null);
 const attacker=put(g,'bs1','signi-1','p2');
 attacker.sick=false;g.turn.player='p2';g.turn.step='attack';g.turn.notBefore=0;
 const life=g.life.p1;
 yes(g.declareAttack(attacker.id,'body'));
 while(g.operation?.kind==='shieldWindow')yes(g.resolveShield(null));
 assert(g.blockers('p1').some(c=>c.id===blocker.id));
 yes(g.resolveAttack(blocker.id));
 assert.equal(g.life.p1,life);
 assert.equal(g.locate(blocker.id).z,'trash');
 assert.equal(attacker.health,2);
 assert(g.battleLog('p1',{detailed:true}).some(e=>e.kind==='block'&&e.blocker?.cardId==='bs2'));
}
console.log('PASS Amaterasu stats, both spell sources, one cast, shuffle, eligibility, Bot and blocking');
