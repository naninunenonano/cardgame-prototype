'use strict';

const players=['p1','p2'];

function journal(game){
 const events=players.flatMap(p=>game.battleLog(p,{detailed:true}));
 return [...new Map(events.map(e=>[e.number,e])).values()].sort((a,b)=>a.number-b.number);
}

function turns(game,events){
 const rows=[];
 for(const e of events){
  if(e.kind==='turnStart'){
   // The next turn's start audit is taken before its effects and draw.
   if(rows.length)rows.at(-1).end=e.after;
   rows.push({turn:e.turnSequence,actor:e.actor,events:[]});
  }
  if(!rows.length)continue;
  const row=rows.at(-1),key=e.card?.key;
  if(['cardUse','unitEntry','unitDestroyed','shieldDecision','growth','manaPlaced'].includes(e.kind)){
   row.events.push([e.kind,e.actor,key??null,e.level??e.fromZone??e.used??null]);
  }
  if(e.kind==='draw')row.events.push(['draw',e.actor,e.count]);
  if(e.kind==='attackDeclared'||(e.kind==='block'&&e.blocked))row.events.push([e.kind,e.actor]);
  if(e.kind==='life'||e.kind==='ruleDamage')row.events.push([e.kind,e.targetPlayer,e.beforeLife,e.afterLife]);
 }
 if(rows.length)rows.at(-1).end=Object.fromEntries(players.map(p=>[p,{life:game.life[p],mana:game.state[p].energy.length,zones:{hand:game.state[p].hand.length}}]));
 return rows.map(({turn,actor,events,end},i)=>({
  turn,actor,events,life:players.map(p=>end[p].life),mana:players.map(p=>end[p].mana),
  hand:players.map(p=>end[p].zones.hand),alive:players.map(p=>end[p].life>0),
  difference:end[actor].life-end[actor==='p1'?'p2':'p1'].life,decided:i===rows.length-1&&!!game.result
 }));
}

module.exports={journal,turns};
