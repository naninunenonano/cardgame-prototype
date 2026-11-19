'use strict';
const assert=require('node:assert/strict');
const {create}=require('./game');
const {decide}=require('./bot');
const rows=[];
const games=Number(process.argv[2]||200);
for(let i=0;i<games;i++){
 const white=i%2?'p2':'p1',blue=white==='p1'?'p2':'p1',seed=860001+Math.floor(i/2);
 let r=seed,first=true,empty=false,recoveries=0,drawGames=false;
 const g=create({mode:'bot',strictTargets:true,clock:()=>1000,decks:{[white]:'whiteAdvanced',[blue]:'blueAdvanced'},random:()=>{if(first){first=false;return .25;}r=(Math.imul(r,1664525)+1013904223)>>>0;return r/2**32;}});
 for(let step=0;step<16000&&!g.result;step++){
  g.turn.notBefore=0;
  const p=g.decisionPlayer(),action=decide(g.observe(p));
  const before=new Set(g.state[white].hand.map(c=>c.id));
  const answer=g.dispatch(action,p);
  assert(answer.ok,JSON.stringify({i,step,action,message:answer.message,operation:g.operation}));
  if(g.state[white].hand.some(c=>c.key==='wu3'&&!before.has(c.id)))drawGames=true;
  if(g.status==='ready'&&!g.state[white].hand.length)empty=true;
  if(empty&&g.state[white].hand.length>=3){recoveries++;empty=false;}
 }
 assert(g.result,JSON.stringify({i,operation:g.operation,turn:g.turn}));
 const log=g.battleLog(white);
 const count=(kind,key,p)=>log.filter(e=>e.actor===p&&e.kind===kind&&e.card?.cardId===key).length;
 rows.push({seed,whiteFirst:white==='p1',whiteWin:g.result.winner===white,reason:g.result.reason,turns:g.turn.sequence,
  numeronia:count('unitEntry','sbno2',blue),special:g.result.winner===blue&&g.result.reason.includes('特殊勝利'),serpentHand:drawGames,
  serpentUses:count('cardUse','wu3',white),baronne:count('unitEntry','sbwo1',white),baronneStops:count('counterSuccess','sbwo1',white),
  usurpation:count('cardUse','almar_bs1',blue),recoveries});
 if(i%20===19)process.stderr.write((i+1)+' games completed\n');
}
const sum=k=>rows.reduce((n,r)=>n+Number(r[k]),0);
console.log(JSON.stringify({summary:{games,whiteWins:sum('whiteWin'),blueWins:games-sum('whiteWin'),whiteFirstWins:rows.filter(r=>r.whiteFirst&&r.whiteWin).length,whiteSecondWins:rows.filter(r=>!r.whiteFirst&&r.whiteWin).length,averageTurns:sum('turns')/games,numeronia:sum('numeronia'),special:sum('special'),serpentHandGames:sum('serpentHand'),serpentUses:sum('serpentUses'),baronne:sum('baronne'),baronneStops:sum('baronneStops'),usurpation:sum('usurpation'),recoveries:sum('recoveries')},rows},null,2));
