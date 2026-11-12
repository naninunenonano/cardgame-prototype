'use strict';
const assert=require('node:assert/strict');
const Decks=require('./decks');
const {cards}=require('./cards');
const Game=require('./game');
const Bot=require('./bot');
const {fund}=require('./test-fixtures.cjs');
const yes=r=>assert(r.ok,r.message);
const size=(deck,section)=>deck[section].reduce((n,e)=>n+e.count,0);

const advanced=Decks.preset('blueAdvanced');
assert.equal(advanced.name,'青上級Bot／アルマー');
assert.equal(advanced.difficulty,'advanced');
assert.deepEqual(advanced.main.map(({key,count})=>[key,count]),[
 ['bo1',3],['bs1',3],['bl2',1],['bl3',1],['nl2',1],['br1',3],['bn1',3],['br3',3],
 ['br5',3],['ns1',3],['br4',3],['nn1',3],['bs5',3],['bs3',3],['nn7',4]
]);
assert.deepEqual(advanced.sideboard.map(e=>e.key),['almar']);
assert.deepEqual(advanced.shields.map(e=>e.key),['shnl1','shnl2','shnr2','shnr5']);
assert.deepEqual(['main','sideboard','shields'].map(s=>size(advanced,s)),[40,1,4]);
assert.deepEqual(Decks.validate(advanced),[]);
assert.equal(advanced.lands,undefined);
const red=Decks.preset('redBeginner'),black=Decks.preset('blackBeginner');
for(const deck of [red,black]){
 assert.equal(size(deck,'main'),40);
 assert.deepEqual(Decks.validate(deck),[]);
}
for(const key of ['kn9','kn10']){
 assert(!red.main.some(e=>e.key===key));
 assert.equal(black.main.find(e=>e.key===key)?.count,3);
 assert.equal(cards[key].color,'黒');
}
assert.deepEqual(Decks.migrateOwned({no1:2,rn17:3,rn21:2}),{bo1:2,kn9:3,kn10:2});

function setup(){
 const g=Game.create({random:()=>.4});
 for(const p of g.PLAYERS){yes(g.completeMulligan(p));g.state[p].hand=[];g.state[p].shields=[];}
 g.turn.step='main1';
 fund(g,'p1',12,'黒');
 return g;
}
function play(g,key,slot){
 const c=g.fromDefinition(key,'p1');
 g.state.p1.hand.push(c);
 yes(g.beginPayment(c.id));yes(g.chooseSlot(slot));yes(g.confirmPayment());
 while(g.operation?.kind==='response')yes(g.passResponse());
 return c;
}
{
 const g=setup();
 const frenzy=play(g,'kn9','signi-1');
 assert.equal(g.life.p1,17);
 assert.equal(frenzy.maxHealth,4);
 assert(frenzy.machFighter);
 yes(g.setLife('p1',16));
 const vanguard=play(g,'kn10','signi-2');
 assert.equal(g.life.p1,13);
 assert.equal(g.attack(vanguard,'p1'),4);
 assert.equal(g.observe('p1').players.p1.units.find(c=>c.id===vanguard.id).speedAttacker,true);
 assert.equal(g.state.p1['signi-1'][0].maxHealth,6);
 yes(g.setLife('p1',16));
 assert.equal(g.attack(vanguard,'p1'),3);
 assert.equal(g.observe('p1').players.p1.units.find(c=>c.id===vanguard.id).speedAttacker,false);
 assert.equal(g.state.p1['signi-1'][0].maxHealth,4);
 yes(g.setLife('p1',15));
 play(g,'kn9','signi-3');
 play(g,'kn10','signi-4');
 assert.equal(g.life.p1,15);
}

for(const [i,opponent] of Decks.beginnerBotIds.entries()){
 for(const first of ['p1','p2']){
  let seed=123+i,opening=true;
  const random=()=>{
   if(opening){opening=false;return i%2===0?.25:.75;}
   seed=(Math.imul(seed,1664525)+1013904223)>>>0;
   return seed/4294967296;
  };
  const g=Game.create({mode:'bot',decks:{p1:first==='p1'?'blueAdvanced':opponent,p2:first==='p1'?opponent:'blueAdvanced'},random,strictTargets:true});
  for(let step=0;step<12000&&!g.result;step++){
   g.turn.notBefore=0;
   const p=g.decisionPlayer(),action=Bot.decide(g.observe(p)),r=g.dispatch(action,p);
   assert(r.ok,JSON.stringify({opponent,first,step,action,operation:g.operation?.kind,error:r.message}));
  }
  assert(g.result,opponent);
  console.log('PASS 青上級Bot vs '+opponent+' (席 '+first+') '+g.turn.sequence+'ターン');
 }
}
console.log('PASS 青上級Bot構成・復讐の境界と再計算・旧ID移行');
