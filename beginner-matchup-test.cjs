'use strict';
const assert=require('node:assert/strict');
const Game=require('./game');
const Decks=require('./decks');
const Bot=require('./bot');
const Cards=require('./cards');

const characters={blueBeginner:'bluesage',redBeginner:'redcaptain',blackBeginner:'redmoonavenger'};
for(const id of Decks.beginnerBotIds){
 const deck=Decks.preset(id);
 assert.deepEqual(Decks.validate({...deck}),[]);
 assert.deepEqual(['main','sideboard','shields'].map(section=>deck[section].reduce((n,row)=>n+row.count,0)),[40,10,4]);
 assert.equal(deck.sideboard.find(row=>Cards.cards[row.key].type==='キャラクター').key,characters[id]);
 assert(deck.main.every(row=>!Cards.cards[row.key].token));
}
assert.equal(Cards.cards.nr1.cost.generic,3);
const iterations=Number(process.argv[2]||2);
assert(Number.isSafeInteger(iterations)&&iterations>0&&iterations%2===0);
const baseline=process.argv.includes('--baseline');
const rows=[];
for(const [i,p1] of Decks.beginnerBotIds.entries()){
 for(const p2 of Decks.beginnerBotIds.slice(i+1)){
  for(let seed=1;seed<=iterations;seed++){
   let state=seed,initial=true;
   const random=()=>{if(initial){initial=false;return seed%2?.25:.75;}state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
   const g=Game.create({mode:'bot',decks:{p1,p2},random,strictTargets:true});
   const expected=seed%2?'p1':'p2';
   assert.equal(g.firstPlayer,expected);
   for(let step=0;step<12000&&!g.result;step++){
    g.turn.notBefore=0;
    const player=g.decisionPlayer(),view=g.observe(player);
    if(baseline)view.players[player].blackBeginner=false;
    const action=Bot.decide(view),r=g.dispatch(action,player);
    assert(r.ok,JSON.stringify({p1,p2,seed,step,player,action,error:r.message,operation:g.operation?.kind}));
   }
   assert(g.result,JSON.stringify({p1,p2,seed,error:'対戦未完了'}));
   const journal=g.battleLog('p1',{detailed:true});
   const loser=g.result.winner==='p1'?'p2':'p1';
   const lastLoss=journal.findLast(e=>e.targetPlayer===loser&&['life','ruleDamage'].includes(e.kind));
   rows.push({p1,p2,seed,first:expected,winner:g.result.winner,turn:g.turn.sequence,life:g.life,
    levels:Object.fromEntries(g.PLAYERS.map(p=>[p,g.character(p)?.level??0])),
    ruleDamage:journal.some(e=>e.kind==='ruleDamage'),
    finish:lastLoss?.reason||(lastLoss?.kind==='ruleDamage'?'山札切れ':g.result.reason)});
  }
 }
}
console.log(JSON.stringify(rows));
