// Test-only resources: real ordinary card instances, never a production deck or UI option.
const M=require('./mana.js');
function fund(g,p,n,color=null){const k=color||(g.deckInfo(p).name.includes('緑')?'緑':'青');for(let i=0;i<n;i++){const c=g.card('テスト用マナ','呪文',k,M.cost(1),false,p);c.mana={color:k,amount:1};g.state[p].energy.push(c);}g.state;return n;}
function finishRefresh(g){while(g.operation?.kind==='refreshPenalty'){for(const c of g.state[g.operation.p].energy.slice(0,g.operation.required))g.selectRefreshMana(c.id);g.confirmRefresh();}}
function skipCharge(g){
 if(g.turn.step==='charge'&&!g.operation){
  const result=g.skipCharge();
  if(!result.ok)throw Error(result.message);
 }
 for(const step of ['stackCharge','levelUp'])if(g.turn.step===step&&!g.operation){
  g.turn.notBefore=0;
  const result=g.advance();
  if(!result.ok)throw Error(result.message);
  g.turn.notBefore=0;
 }
}
module.exports={fund,finishRefresh,skipCharge};

// Supply an owned, saved deck for tests of features other than onboarding.
module.exports.saveOwnedTestDeck=function saveOwnedTestDeck(profile,color='red'){
 const Decks=require('./decks');
 const deck=Decks.preset(color==='red'?'redStarter':'blueStarter');
 const gain=profile.gain([...deck.main,...deck.sideboard,...deck.shields].flatMap(e=>Array.from({length:e.count},()=>({key:e.key}))));
 if(!gain.ok)return gain;
 return profile.store.save({...deck,id:'normal-'+color,preset:false});
};

// Explicitly report a deferred card-specific test without executing or counting it as passed.
module.exports.holdUnavailable=function holdUnavailable(keys,name,verify){
 const {cards}=require('./cards');
 const cardsUnderTest=keys.map(key=>{
  const card=cards[key];
  if(!card?.unavailable)throw Error('Re-enable the deferred test for '+key+': '+name);
  return card.name+' ('+key+') — '+card.unavailable;
 });
 console.log('HOLD '+name+' | '+cardsUnderTest.join(' / '));
};

module.exports.growthFixture=function growthFixture(game,player='p1'){
 const character=game.character(player);
 game.turn.player=player;
 game.turn.step='levelUp';
 game.turn.grown=false;
 const cost=game.growStatus(player).nextCost;
 for(let i=0;i<cost;i++)game.state[player].stacks.push(game.card(character.color+'ストック','ストック',character.color,null,false,player));
 return game.beginGrowth(player);
};

module.exports.checkCardPool=function checkCardPool(){
 const assert=require('node:assert/strict'),{cards,evolutionSeries}=require('./cards'),{pool}=require('./packs'),registry=require('./id-registry');
 const added=['sbru2','sbrs2','sbru3','sbrr1','sbrr2','sbrn1','shnr7','shnr8','shnr9','sbru4'];
 const base=registry.entries.filter(e=>!e.retired&&e.baseId!=='sbnl1').map(e=>e.baseId).concat(added);
 assert.deepEqual(Object.keys(cards).sort(),base.sort());
 const excluded=['nl1','nr1','nr4','nr5','nr6','almar_sbbu1','sbbu1','almar_sbnr1','nn2','nn3','nn4','nn5','nn6','nn7','nn8','sbnl3','sbnr4','sbgu1','celestia_sbnr1','lumiere_sbwr1','sbwl1'];
 const expected=base.filter(key=>!key.match(/^t\d+$/)&&!excluded.includes(key));
 for(const series of Object.values(evolutionSeries))if(series.key!==series.characterId)expected.push(series.key);
 assert.deepEqual(pool().map(c=>c.key).sort(),expected.sort());
};

module.exports.saveBrowserTestDeck=async function saveBrowserTestDeck(page,color='red'){
 await page.evaluate(color=>{
  const preset=DeckLibrary.preset(color==='red'?'redStarter':'blueStarter');
  const cards=[...preset.main,...preset.sideboard,...preset.shields].flatMap(e=>Array.from({length:e.count},()=>({key:e.key})));
  const gained=collection.gain(cards);
  if(!gained.ok)throw Error(gained.message);
  const saved=collection.store.save({...preset,id:'normal-'+color,preset:false});
  if(!saved.ok||saved.errors.length)throw Error(saved.message||saved.errors.join('／'));
  refreshDeckChoices();
  render();
 },color);
};

module.exports.growInBrowser=async function growInBrowser(page){
 await page.evaluate(()=>{
  Game.turn.step='levelUp';
  Game.turn.grown=false;
  const player=Game.turn.player,character=Game.character(player);
  for(let i=0;i<Game.growStatus(player).nextCost;i++)Game.state[player].stacks.push(Game.card(character.color+'ストック','ストック',character.color,null,false,player));
  render();
 });
 await page.locator('[data-grow="p1"]').click();
 await page.evaluate(()=>{Game.turn.step='main1';render();});
};
