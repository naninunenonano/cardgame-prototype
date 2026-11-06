'use strict';
const assert=require('node:assert/strict');
const C=require('./cards'),D=require('./decks'),P=require('./collection'),K=require('./packs');
const G=require('./game'),B=require('./bot'),Ranked=require('./ranked'),Series=require('./character-series');
const {fund}=require('./test-fixtures.cjs');
const yes=r=>assert(r.ok,r.message);
function add(g,key,owner='p1',zone='hand'){
 const card=g.fromDefinition(key,owner);
 g.state[owner][zone].push(card);
 return card;
}
function settle(g){
 for(let i=0;i<100&&g.operation&&!g.result;i++){
  const p=g.decisionPlayer();
  yes(g.dispatch(g.operation.kind==='response'?{type:'pass'}:B.decide(g.observe(p)),p));
 }
 assert(!g.operation||g.result,'選択が解決しない');
}
function setup(){
 const g=G.create({random:()=>.4});
 for(const p of g.PLAYERS){
  yes(g.completeMulligan(p));
  g.state[p].shields=[];
  g.state[p].hand=[];
  fund(g,p,24,'白');
 }
 g.turn.player='p1';g.turn.step='main1';
 return g;
}
function play(g,key,slot){
 const card=add(g,key);
 yes(g.beginPayment(card.id));
 if(slot)yes(g.chooseSlot(slot));
 yes(g.confirmPayment());
 return card;
}
{
 const keys=['wn3','wr2','wr3','ws5','wn4','wn5','wr4','wo1','wr5','ws6','wr6','wu2','lumiere_sbwl1','sbwu1','lumiere_sbwr1'];
 for(const key of keys)assert(K.pool().some(c=>c.key===key),key);
 for(const key of ['ko1','bo1','wo1'])assert.equal(D.limit(C.cards[key]),3);
 assert(D.available('main').some(c=>c.key==='wo1'));
 assert(!D.available('sideboard').some(c=>c.key==='wo1'));
 const g=setup();
 const own=add(g,'nn4','p1','signi-1'),foe=add(g,'nn4','p2','signi-1');
 add(g,'wn2','p1','structures');add(g,'ws5','p1','structures');
 assert.equal(g.effectiveCost(C.cards.wo1,'p1').generic,6);
 play(g,'wr6');settle(g);
 assert.equal(own.health,own.maxHealth);
 assert.equal(g.locate(foe.id).z,'trash');
 const durable=add(g,'gn2','p2','signi-2');durable.health=durable.maxHealth=9;
 const sw=play(g,'wo1','signi-2');settle(g);
 assert.equal(g.locate(sw.id).z,'signi-2');
 assert.equal(durable.health,4);
 const weak=play(g,'wn4','signi-3');settle(g);
 assert.equal(g.locate(weak.id).z,'trash');
 assert.equal(g.shieldLinkCount('p1'),2);
 assert(!g.events.some(e=>e.kind==='unitDestroyed'&&e.cardId===weak.id));
 play(g,'wr1');
 assert.equal(g.operation.kind,'tokens');
 yes(g.placeToken('signi-3'));settle(g);
 assert(!g.fieldCards('p1').some(c=>c.key==='t7'));
 assert(!g.state.p1.trash.some(c=>c.token));
}
{
 const g=setup();yes(g.setLife('p1',20));
 const echo=play(g,'ws5');settle(g);
 const link=add(g,'wn2','p1','trash');
 play(g,'wr5');
 assert.equal(g.operation.choice,'linkRebuild');
 yes(g.resolveExpansion(link.id));settle(g);
 const newLink=add(g,'wn1');
 play(g,'ws6');
 yes(g.resolveExpansion(echo.id));
 assert.equal(g.life.p1,22);
 yes(g.resolveExpansion(newLink.id));settle(g);
 assert.equal(g.locate(newLink.id).z,'structures');
 play(g,'wu2');settle(g);
 assert.equal(g.shieldLinkCount('p1'),3);
}
{
 const g=setup();add(g,'sbwu1','p2','signi-1');
 assert(g.spellsLocked('p1',C.cards.gn1));
 assert(g.spellsLocked('p2',C.cards.gn1));
 assert(!g.spellsLocked('p1',C.cards.wn3));
 assert(!g.beginPayment(add(g,'gn1').id).ok);
}
{
 const saved=new Map(),storage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)};
 const p=P.create({storage});yes(p.choose('red'));
 const levels=Object.fromEntries([1,2,3,4].map(l=>[l,{growth:[{kind:'draw',count:2}],text:'テスト用分岐'}]));
 Series.install(C,[{id:'redcaptain_test',characterId:'redcaptain',rarity:'LEGEND',name:'テスト用分岐',levels}]);
 try{
  assert.equal(K.pool().find(c=>c.key==='redcaptain').rarity,'UR');
  assert.equal(K.pool().find(c=>c.key==='redcaptain_test').rarity,'LEGEND');
  const deck=p.store.list()[0];
  deck.evolution={redcaptain:['redcaptain_test','redcaptain','redcaptain_test','redcaptain']};
  assert(p.store.validate(deck).some(e=>e.includes('未所持')));
  const result=p.gain([{key:'redcaptain_test'},{key:'redcaptain_test'}]);yes(result);
  assert.equal(result.materialGain,5);
  assert.equal(p.profile().owned.redcaptain,1);
  assert.equal(p.profile().owned.redcaptain_test,1);
  assert.deepEqual(p.profile().characters,['redcaptain']);
  yes(p.store.save(deck));
  const restored=P.create({storage}),chosen=restored.store.get(deck.id);
  assert.deepEqual(chosen.evolution,deck.evolution);
  const g=G.create({records:[chosen],decks:{p1:deck.id,p2:'blueStarter'},collection:restored.profile().owned,random:()=>.4});
  assert.equal(g.character('p1').level,0);
  for(const owner of g.PLAYERS)yes(g.completeMulligan(owner));
  fund(g,'p1',16,'赤');
  g.turn.step='main1';
  const hand=g.state.p1.hand.length;
  yes(g.beginGrowth('p1'));yes(g.confirmPayment());settle(g);
  assert.equal(g.character('p1').currentSeries,'redcaptain_test');
  assert.equal(g.state.p1.hand.length,hand+2);
  g.turn.counts.p1++;
  for(const c of g.state.p1.extra)if(c.viceOnly)c.expired=true;
  yes(g.beginGrowth('p1'));yes(g.confirmPayment());settle(g);
  assert.equal(g.character('p1').currentSeries,'redcaptain');
  assert.equal(g.state.p1.hand.length,hand+2);
  const match={gameId:'rank-one',profileId:restored.profile().id,deckId:deck.id,botDeckId:'blueStarter',result:{winner:'p1',reason:'ライフ0'}};
  yes(restored.recordRanked(match));
  assert(!restored.recordRanked(match).ok);
  yes(restored.recordMatch({...match,gameId:'normal-one',mode:'bot',normal:true}));
  const ranked=P.create({storage}).ranked();
  assert.equal(ranked.wins,1);
  assert.equal(ranked.losses,0);
  assert.equal(ranked.rankId,null);
  assert.equal(ranked.points,null);
  assert.equal(ranked.matches.length,1);
  assert.equal(Ranked.chooseDeck(ranked,'blueStarter',id=>!!D.preset(id)),'blueStarter');
 }finally{Series.install(C);}
}
console.log('PASS white cards, entry replacement, mixed evolution save/dispatch and isolated ranked history');
