'use strict';

const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {gzipSync}=require('node:zlib');
const Decks=require('./decks');
const {cards}=require('./cards');
const {evaluate,read}=require('./five-deck-report.cjs');

const ids=Decks.selectableBeginnerBotIds;
const sections=['main','sideboard','shields'];
const sides=['p1','p2'];
const average=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
const other=p=>p==='p1'?'p2':'p1';
const side=(g,id)=>g.p1===id?'p1':'p2';
const has=(g,id)=>g.p1===id||g.p2===id;
const rate=(wins,draws,total)=>total?100*(wins+.5*draws)/total:null;

function standings(games,id){
 const win=games.filter(g=>g[g.winner]===id).length;
 const draw=games.filter(g=>!g.winner).length;
 const total=games.length;
 return {games:total,win,loss:total-win-draw,draw,winRate:rate(win,draw,total),
  averageTurns:average(games.map(g=>g.turn)),
  averageLife:average(games.map(g=>g.life[side(g,id)])),
  averageLifeDifference:average(games.map(g=>g.life[side(g,id)]-g.life[other(side(g,id))]))};
}

function lifeCurve(games,id){
 const buckets=new Map();
 for(const g of games)for(const t of g.turns){
  if(!buckets.has(t.turn))buckets.set(t.turn,[]);
  const i=sides.indexOf(side(g,id));
  buckets.get(t.turn).push(t.life[i]-t.life[1-i]);
 }
 return [...buckets].sort((a,b)=>a[0]-b[0]).map(([turn,values])=>{
  values.sort((a,b)=>a-b);
  return {turn,games:values.length,average:average(values),
   median:average([values[Math.floor((values.length-1)/2)],values[Math.floor(values.length/2)]])};
 });
}

function evaluateDeck(games,id,deck){
 const rows=[];
 for(const section of sections)for(const {key,count} of deck[section]){
  const r=evaluate(games,id,key,section);
  const byOpponent=Object.fromEntries(ids.filter(opponent=>opponent!==id).map(opponent=>{
   const pair=games.filter(g=>has(g,opponent));
   const used=pair.filter(g=>g.cards[side(g,id)][key].uses>0);
   const wins=used.filter(g=>g[g.winner]===id).length;
   const draws=used.filter(g=>!g.winner).length;
   return [opponent,{used:used.length,winRate:rate(wins,draws,used.length)}];
  }));
  let recommendation='判断保留';
  let reason=`${r.usedGames}試合で使用、平均使用手番 ${r.averageUseTurn?.toFixed(1)??'対象外'}。観測点 ${r.scorePer100.toFixed(1)}／100戦`;
  if(r.evaluation==='主力'){
   recommendation='維持推奨';
   reason+='。使用と効果の双方を観測';
  }else if(r.evaluation==='判断不良の疑い'){
   reason+=`。使用せずに終えた試合のうち、使用可能を観測した試合が${r.unused.skipped}戦`;
  }
  rows.push({copies:count,...r,byOpponent,recommendation,reason});
  if(cards[key].type==='キャラクター')for(let level=1;level<=4;level++){
   rows.push({copies:null,...evaluate(games,id,key+':'+level,'characterLevel'),
    recommendation:'判断保留',reason:'採用枠はキャラクター単位。成長と効果をレベル別に観測'});
  }
 }
 return rows;
}

function summarize(input,{codeVersion,studyId,perPair=200}){
 assert.match(codeVersion,/^[0-9a-f]{40}$/);
 assert(studyId&&Number.isInteger(perPair)&&perPair>0&&perPair%2===0);
 assert.equal(new Set(input.map(g=>g.seed)).size,input.length,'Duplicate seeds');
 const games=input.filter(g=>!g.error), anomalies=input.filter(g=>g.error);
 const matchups=[];
 for(const [i,a] of ids.entries())for(const b of ids.slice(i+1)){
  const pair=games.filter(g=>g.p1===a&&g.p2===b);
  assert.equal(pair.length,perPair);
  assert.equal(pair.filter(g=>g.first==='p1').length,perPair/2);
  const results=Object.fromEntries([a,b].map(id=>[id,standings(pair,id)]));
  const curves=Object.fromEntries([a,b].map(id=>[id,Object.fromEntries(['first','second'].map((order,i)=>
   [order,lifeCurve(pair.filter(g=>(g[g.first]===id)===(i===0)),id)]))]));
  matchups.push({a,b,results,curves});
 }
 assert.equal(games.length,matchups.length*perPair);
 for(const g of games){
  assert([null,'p1','p2'].includes(g.winner));
  assert.equal(g.turns.length,g.turn);
  assert.deepEqual(g.turns.at(-1).life,sides.map(p=>g.life[p]));
  assert(g.turns.at(-1).decided);
 }
 const decks=Object.fromEntries(ids.map(id=>{
  const deck=Decks.preset(id);
  assert.deepEqual(Decks.validate(deck),[]);
  const roster=Object.fromEntries(sections.map(z=>[z,deck[z]]));
  assert.deepEqual(sections.map(z=>roster[z].reduce((n,c)=>n+c.count,0)),[40,10,4]);
  const deckVersion=createHash('sha256').update(JSON.stringify(roster)).digest('hex').slice(0,12);
  const own=games.filter(g=>has(g,id));
  return [id,{name:deck.name,character:roster.sideboard.find(c=>cards[c.key].type==='キャラクター').key,
   deckVersion,roster,...standings(own,id),first:standings(own.filter(g=>g[g.first]===id),id),
   second:standings(own.filter(g=>g[g.first]!==id),id),anomalies:anomalies.filter(g=>has(g,id)).length,
   cards:evaluateDeck(own,id,deck)}];
 }));
 const enrich=({cards,...g})=>({id:studyId+':'+g.seed,studyId,codeVersion,...g,
  deckVersions:Object.fromEntries(sides.map(p=>[p,decks[g[p]].deckVersion])),
  loser:g.winner?other(g.winner):null,draw:!g.error&&!g.winner,status:g.error?'abnormal':'normal'});
 return {studyId,codeVersion,perPair,normal:games.length,decks,matchups,anomalies:anomalies.map(enrich),games:games.map(enrich)};
}

module.exports={summarize,standings,lifeCurve};

if(require.main===module){
 const [out,codeVersion,studyId,...files]=process.argv.slice(2);
 assert(out&&files.length);
 const {games,...summary}=summarize(read(files),{codeVersion,studyId});
 fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(summary,null,2)+'\n');
 for(const {a,b} of summary.matchups){
  const rows=games.filter(g=>g.p1===a&&g.p2===b);
  fs.writeFileSync(path.join(out,`games-${a}-${b}.jsonl.gz`),gzipSync(rows.map(g=>JSON.stringify(g)).join('\n')+'\n'));
 }
}
