'use strict';
const assert=require('node:assert/strict');
const {create}=require('./game');
const {decide}=require('./bot');
const {preset}=require('./decks');

const games=Number(process.argv[2]||200);
assert(games>0&&games%2===0);
const usage={};
for(const section of ['main','sideboard','shields'])for(const {key} of preset('blueAdvanced')[section])usage[key]={uses:0,games:0};
const rows=[];
for(let index=0;index<games;index++){
 const blue=index%2?'p2':'p1',red=blue==='p1'?'p2':'p1',seed=810001+Math.floor(index/2);
 let state=seed,first=true;
 const g=create({mode:'bot',decks:{[blue]:'blueAdvanced',[red]:'redBeginner'},strictTargets:true,clock:()=>1000,random:()=>{
  if(first){first=false;return .25;}
  state=(Math.imul(state,1664525)+1013904223)>>>0;
  return state/2**32;
 }});
 const choices={};
 for(let step=0;step<12000&&!g.result;step++){
  g.turn.notBefore=0;
  const p=g.decisionPlayer(),view=g.observe(p),action=decide(view);
  if(p===blue&&action.type.startsWith('xyz'))choices[action.type]=(choices[action.type]||0)+1;
  const outcome=g.dispatch(action,p);
  assert(outcome.ok,JSON.stringify({seed,blue,step,action,operation:g.operation?.kind,message:outcome.message}));
 }
 assert(g.result,JSON.stringify({seed,blue,choices}));
 const log=g.battleLog(blue);
 const used=new Set();
 for(const entry of log){
  if(entry.actor!==blue)continue;
  const key=entry.card?.cardId;
  if(!usage[key])continue;
  const c=entry.card;
  const counted=c.type==='シールドカード'?entry.kind==='shieldDecision'&&entry.used
   :c.type==='キャラクター'?entry.kind==='growth'
   :['sbbr2','sbbs2','sbno2'].includes(key)?entry.kind==='xyzSummon':entry.kind==='cardUse';
  if(counted){usage[key].uses++;used.add(key);}
 }
 for(const key of used)usage[key].games++;
 rows.push({seed,blue,winner:g.result.winner,reason:g.result.reason,turns:g.turn.sequence,blueTurns:g.turn.counts[blue],
  numeronia:log.some(e=>e.actor===blue&&e.kind==='unitEntry'&&e.card?.cardId==='sbno2'),choices});
}
const wins=rows.filter(r=>r.winner===r.blue),losses=rows.filter(r=>r.winner&&r.winner!==r.blue);
const special=wins.filter(r=>r.reason.includes('特殊勝利')).length;
const byReason={};
for(const row of losses)byReason[row.reason]=(byReason[row.reason]||0)+1;
const summary={games,wins:wins.length,losses:losses.length,draws:games-wins.length-losses.length,winRate:wins.length/games,
 averageTurns:rows.reduce((sum,r)=>sum+r.turns,0)/games,
 reachedTurn10:rows.filter(r=>r.blueTurns>=10).length,numeroniaGames:rows.filter(r=>r.numeronia).length,special,normalWins:wins.length-special,byReason};
console.log(JSON.stringify({summary,usage,rows},null,2));
