'use strict';
const assert=require('node:assert/strict');
const {create}=require('./game');
const {cards,awakened}=require('./cards');
const Decks=require('./decks');
const Packs=require('./packs');
const Bot=require('./bot');
const {fund}=require('./test-fixtures.cjs');
const yes=r=>assert(r.ok,r.message);
function put(g,key,p='p1',zone='hand'){
 const c=g.fromDefinition(key,p);
 g.state[p][zone].push(c);
 return c;
}
function setup(decks){
 const g=create({random:()=>.4,mode:decks?'bot':'solo',decks});
 for(const p of g.PLAYERS){
  yes(g.completeMulligan(p));
  g.state[p].hand=[];
  g.state[p].shields=[];
  fund(g,p,20,'白');
  fund(g,p,4,'緑');
  fund(g,p,4,'赤');
 }
 g.turn.player='p1';
 g.turn.step='main1';
 return g;
}
function pass(g){
 while(g.operation?.kind==='response')yes(g.passResponse());
}
function use(g,c,slot,target){
 yes(g.beginPayment(c.id));
 if(slot)yes(g.chooseSlot(slot));
 if(target)yes(g.selectUseTarget(target));
 yes(g.confirmPayment());
 pass(g);
}
assert.equal(cards.sbwl1.cost.白,4);
assert.equal(awakened['sbwl1-2'].attack,9);
assert.deepEqual(awakened['sbwl1-2'].symbols,{白:1});
assert(!Packs.pool().some(c=>c.key==='t10'||c.key==='sbwl1-2'));
assert(!Decks.available().some(c=>c.key==='t10'||c.key==='sbwl1-2'));
{
 const g=setup();
 const leader=put(g,'eira','p1','lrig');leader.level=3;
 for(let i=0;i<4;i++)g.state.p1.stacks.push(g.card('白ストック','ストック','白',null,false,'p1'));
 const crest=put(g,'sbwl1','p1','extra');
 use(g,crest);
 assert.equal(g.locate(crest.id).z,'structures');
 assert.equal(g.operation.kind,'tokens');
 yes(g.placeToken('signi-1'));
 yes(g.placeToken('signi-2'));
 const tokens=g.fieldCards('p1').filter(c=>c.key==='t10');
 assert.equal(tokens.length,2);
 for(const t of tokens)assert(t.cannotAttack&&t.abilities.includes('ブロッカー'));
 for(const key of ['wn1','wn2','ws5','wl2','wn6'])use(g,put(g,key));
 assert.equal(g.locate(crest.id).card.faceId,'sbwl1-2');
 assert.equal(g.shieldLinkCount('p1'),0);
 assert.equal(g.symbols('p1').白,1);
 assert.equal(crest.health,9);
 const link=put(g,'wn2','p1','structures');
 crest.health=1;
 g.destroyUnit(crest.id);
 assert.equal(g.operation.choice,'neverendEscape');
 yes(g.resolveExpansion(link.id));
 assert.equal(crest.health,9);
 assert.equal(g.locate(link.id).z,'trash');
 put(g,'wn2','p1','structures');
 g.destroyUnit(crest.id);
 yes(g.resolveExpansion('done'));
 assert.equal(g.locate(crest.id).z,'extra');
 assert.equal(crest.name,'始まりの紋章');
 g.destroyUnit(tokens[0].id);
 assert(!g.locate(tokens[0].id));
}
{
 const g=setup();
 const target=put(g,'nn3','p2','signi-1');
 const evo=put(g,'bl2','p2','energy');
 const golem=put(g,'nn9','p2','energy');
 use(g,put(g,'gl2'),null,target.id);
 assert.equal(g.locate(target.id).z,'energy');
 assert.equal(g.decisionPlayer(),'p1');
 assert(!g.freeUnitCandidates().includes(evo));
 assert(!g.chooseFreeUnit(null).ok);
 yes(g.chooseFreeUnit(golem.id));
 assert.equal(g.decisionPlayer(),'p1');
 yes(g.chooseSlot('signi-1'));
 yes(g.confirmFreePlacement());
 pass(g);
 assert.equal(g.locate(golem.id).z,'signi-1');
 assert.equal(golem.health,4);
}
{
 const g=setup();
 fund(g,'p1',2,'黒');
 for(const [i,key] of ['kn10','kn9'].entries())use(g,put(g,key),'signi-'+(i+1));
 assert.equal(g.life.p1,14);
}
{
 const deck=Decks.preset('redBeginner');
 assert.deepEqual(Decks.validate(deck),[]);
 assert.deepEqual(['main','sideboard','shields'].map(s=>deck[s].reduce((n,c)=>n+c.count,0)),[40,10,5]);
 const g=setup({p1:'blueStarter',p2:'redBeginner'});
 g.turn.player='p2';
 assert.equal(g.character('p2').key,'redcaptain');
 assert.equal(g.state.p2.stackDeck.length,15);
}
{
 const g=setup({p1:'redBeginner',p2:'blueBeginner'});
 const red=g.character('p1')||put(g,'redcaptain','p1','lrig');
 red.level=3;
 const decision=()=>Bot.decide(g.observe('p1')).type;
 g.turn.step='levelUp';
 assert(!g.growStatus('p1').ok);
 assert.notEqual(decision(),'grow');
 for(let i=0;i<3;i++)g.state.p1.stacks.push(g.card('赤ストック','ストック','赤',null,false,'p1'));
 assert(g.growStatus('p1').ok);
 assert.equal(decision(),'grow');
 yes(g.dispatch({type:'grow'},'p1'));
 assert.equal(red.level,4);
 assert.equal(g.state.p1.stacks.length,0);
}
{
 const g=setup({p1:'whiteBeginner',p2:'blueBeginner'});
 const eira=g.character('p1');
 for(const [index,cost] of [1,2,3,4].entries()){
  g.turn.sequence++;
  g.turn.step='levelUp';
  assert.equal(g.growStatus('p1').nextCost,cost);
  yes(require('./test-fixtures.cjs').growthFixture(g));pass(g);
  assert.equal(eira.level,index+1);
 }
 console.log('PASS リゼリアの成長コストとLv0〜Lv4');
}
console.log('PASS Mother, Apache, character abilities and beginner decks');
for(const id of Decks.selectableBeginnerBotIds){
 const deck=Decks.preset(id);
 assert.deepEqual(Decks.validate(deck),[]);
 assert.equal(deck.main.reduce((n,c)=>n+c.count,0),40);
 assert.equal(deck.stacks.length,15);
 for(let seed=1;seed<=3;seed++){
  let random=seed;
  const g=create({mode:'bot',strictTargets:true,decks:{p1:'blueStarter',p2:id},
   random:()=>((random=Math.imul(random,1664525)+1013904223>>>0)/4294967296)});
  for(let i=0;i<12000&&!g.result;i++){
   g.turn.notBefore=0;
   const player=g.decisionPlayer();
   const action=Bot.decide(g.observe(player));
   assert.notEqual(action.type,'wait',id+' '+g.operation?.kind);
   yes(g.dispatch(action,player));
  }
  assert(g.result,id+' '+seed+' did not finish');
 }
}
console.log('PASS both beginner decks complete six seeded games');
