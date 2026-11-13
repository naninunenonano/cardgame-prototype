'use strict';
const assert=require('node:assert/strict');
const Game=require('./game');
const Decks=require('./decks');
const Bot=require('./bot');
const Cards=require('./cards');

const characters={blueBeginner:'bluesage',redBeginner:'redcaptain',blackBeginner:'redmoonavenger',whiteBeginner:'eira'};
for(const id of Decks.beginnerBotIds){
 const deck=Decks.preset(id);
 assert.deepEqual(Decks.validate({...deck}),[]);
 const sizes=['main','sideboard','shields'].map(section=>deck[section].reduce((n,row)=>n+row.count,0));
 assert.equal(sizes[0],40);
 assert.equal(deck.stacks.length,15);
 assert(sizes[1]>=1&&sizes[1]<=10);
 assert.equal(sizes[2],id==='redBeginner'?5:4);
 if(id==='redBeginner')assert.equal(sizes[1],10);
 assert.equal(deck.sideboard.find(row=>Cards.cards[row.key].type==='キャラクター').key,characters[id]);
 assert(deck.main.every(row=>!Cards.cards[row.key].token));
}
assert.equal(Cards.cards.nr1.cost.generic,3);
const iterations=Number(process.argv[2]||2);
assert(Number.isSafeInteger(iterations)&&iterations>0&&iterations%2===0);
const baseline=process.argv.includes('--baseline');
const impact=process.argv.includes('--impact')?require('./beginner-card-impact.cjs'):null;
const usage=process.argv.includes('--usage')?require('./beginner-card-usage.cjs'):null;
const round=process.argv.includes('--beginner-round');
const five=round||process.argv.includes('--five')||process.argv.includes('--five-control');
const study=round||process.argv.includes('--five')?require('./five-deck-observation.cjs'):null;
assert(!five||(!baseline&&!impact&&!usage),'--five/--five-control cannot be combined with historical analysis options');
const entrants=round?Decks.selectableBeginnerBotIds:five?['whiteBeginner','blueBeginner','blackBeginner','redBeginner','blueAdvanced']:Decks.beginnerBotIds;
let pair=-1;
const rows=[];
const roundLog=round?require('./beginner-round-log.cjs'):null;
const replay=round&&process.env.BOT_REPLAY_SEED;
const seedBase=Number(process.env.BOT_SEED_BASE??8000001);
if(round){
 assert(Number.isSafeInteger(seedBase)&&seedBase>0&&seedBase<4293967296);
 if(replay){
  assert(Number.isSafeInteger(Number(replay))&&Number(replay)>0&&Number(replay)<=0xffffffff);
  assert(['p1','p2'].includes(process.env.BOT_REPLAY_FIRST));
  assert(entrants.some((id,i)=>entrants.slice(i+1).some(other=>process.env.BOT_PAIR===id+':'+other)));
 }
}
for(const [i,p1] of entrants.entries()){
 for(const p2 of entrants.slice(i+1)){
  pair++;
  if(process.env.BOT_PAIR&&process.env.BOT_PAIR!==p1+':'+p2)continue;
  let attempts=0;
  for(let index=1;index<=(replay?1:iterations);index++){
   const seed=replay?Number(replay):five?(round?seedBase:1000001)+pair*100000+attempts++:index;
   const startedAt=round?new Date().toISOString():null;
   let g;
   const expected=replay?process.env.BOT_REPLAY_FIRST:(five?index:seed)%2?'p1':'p2';
   try{
    let state=seed,initial=true;
    const random=()=>{if(initial){initial=false;return expected==='p1'?.25:.75;}state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
    g=Game.create({mode:'bot',decks:{p1,p2},random,strictTargets:true});
    const original=usage?.roster(g);
    const corile={inHand:false,playable:false};
    const observation=study?.setup(g,{p1,p2});
    assert.equal(g.firstPlayer,expected);
    for(let step=0;step<12000&&!g.result;step++){
     g.turn.notBefore=0;
     const player=g.decisionPlayer(),view=g.observe(player);
     if(baseline){view.players[player].blackBeginner=false;view.players[player].blueBeginner=false;}
     const action=Bot.decide(view);
     if(usage&&view.players[player].blueBeginner){
      const copies=view.players[player].hand.filter(c=>c.key==='bn4');
      corile.inHand ||= copies.length>0;
      corile.playable ||= ['main1','main2'].includes(view.turn.step)&&!view.operation&&copies.some(c=>c.canPlay);
     }
     observation?.decision(view,action);
     const r=g.dispatch(action,player);
     assert(r.ok,JSON.stringify({p1,p2,seed,step,player,action,error:r.message,operation:g.operation?.kind}));
    }
    assert(g.result,JSON.stringify({p1,p2,seed,error:'対戦未完了'}));
    const fullJournal=roundLog?.journal(g);
    const journal=g.battleLog('p1',{detailed:true});
    const loser=g.result.winner==='p1'?'p2':'p1';
    const lastLoss=journal.findLast(e=>e.targetPlayer===loser&&['life','ruleDamage'].includes(e.kind));
    const row={p1,p2,seed,first:expected,winner:g.result.winner??null,turn:g.turn.sequence,life:g.life,
     levels:Object.fromEntries(g.PLAYERS.map(p=>[p,g.character(p)?.level??0])),
     ...(impact?{impact:impact.assess(journal,{p1,p2},g.result.winner)}:{}),
     ...(usage?{usage:usage.collect(journal,original),corile}:{}),
     ruleDamage:journal.some(e=>e.kind==='ruleDamage'),
     finish:g.result.reason.includes('山札切れ')?g.result.reason:lastLoss?.reason||g.result.reason,
     ...(observation?{cards:observation.finish(fullJournal)}:{} )};
    if(round)Object.assign(row,{startedAt,turns:roundLog.turns(g,fullJournal)});
    if(five)console.log(JSON.stringify(row));else rows.push(row);
   }catch(error){
    if(replay||!five||attempts>=iterations+50)throw error;
    console.log(JSON.stringify({p1,p2,seed,first:expected,error:error.message,...(round?{startedAt,turn:g?.turn.sequence??0}:{})}));
    index--;
   }
  }
 }
}
if(!five)console.log(JSON.stringify(rows));
