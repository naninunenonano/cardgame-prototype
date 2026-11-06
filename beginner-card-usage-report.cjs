'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Decks = require('./decks');
const {cards} = require('./cards');
const {catalog,summarize,colors} = require('./beginner-card-usage.cjs');

const ids=Decks.beginnerBotIds;
const base=['Bot色','カードID','カード名','採用枚数','前回600戦決定打'];
const header=['試合','勝利','敗北','使用試合','未使用試合','勝利時使用試合','敗北時使用試合',
 '勝利時使用実体','敗北時使用実体','勝利時イベント','敗北時イベント',
 '勝利時使用率%','敗北時使用率%','使用時勝率%','未使用時勝率%','使用時勝率差pp',
 '勝敗使用率差pp','勝利時平均使用実体','敗北時平均使用実体','使用時平均決着ターン','未使用時平均決着ターン'];
const integers=['total','wins','losses','used','unused','winUsed','lossUsed','winCopies','lossCopies','winEvents','lossEvents'];
const percentages=['winRate','lossRate','usedRate','unusedRate','winDiff','useDiff'];
const averages=['winAvg','lossAvg','usedTurns','unusedTurns'];
const format=(n,multiplier=1)=>n===null?'算出不可':(n*multiplier).toFixed(2);
const fields=s=>[...integers.map(k=>s[k]),...percentages.map(k=>format(s[k],100)),...averages.map(k=>format(s[k]))];
const csvValue=value=>'"'+String(value??'').replaceAll('"','""')+'"';

function writeReports(games,out,previous) {
 const priorPicks=new Map(), priorGames=new Map();
 const read=name=>fs.readFileSync(path.join(previous,name),'utf8').trim().split(/\r?\n/).slice(1)
  .map(line=>Array.from(line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g),m=>m[1].replaceAll('""','"')));
 for (const [color,, ,id,,, ,picks] of read('beginner-bot-card-impact.csv')) priorPicks.set(color+':'+id,Number(picks));
 for (const [a,b,seed,first,winner,turn,life1,life2] of read('beginner-bot-card-matches.csv'))
  priorGames.set([a,b,seed].join(':'),[first,winner,turn,life1,life2]);
 games.sort((a,b)=>ids.indexOf(a.p1)-ids.indexOf(b.p1)||ids.indexOf(a.p2)-ids.indexOf(b.p2)||a.seed-b.seed);
 assert.equal(games.length,1200);
 const seen=new Set();
 for (const m of games) {
  assert(ids.indexOf(m.p1)<ids.indexOf(m.p2));
  assert(Number.isInteger(m.seed)&&m.seed>=1&&m.seed<=200);
  const key=[m.p1,m.p2,m.seed].join(':');
  assert(!seen.has(key)); seen.add(key);
  assert.equal(m.first,m.seed%2?'p1':'p2');
  assert(['p1','p2'].includes(m.winner));
  for (const p of ['p1','p2']) for (const [id,use] of Object.entries(m.usage[p])) {
   assert(Number.isInteger(use.copies)&&use.copies>0&&use.copies<=catalog(m[p]).get(id));
   assert(Number.isInteger(use.events)&&use.events>=use.copies);
  }
  if (m.seed<=100) assert.deepEqual([
   colors[m[m.first]],colors[m[m.winner]],String(m.turn),String(m.life.p1),String(m.life.p2)
  ],priorGames.get([colors[m.p1],colors[m.p2],m.seed].join(':')));
 }
 fs.mkdirSync(out,{recursive:true});
 function csv(name,columns,rows) {
  fs.writeFileSync(path.join(out,'beginner-bot-card-usage-'+name+'.csv'),
   '\uFEFF'+[columns,...rows].map(row=>row.map(csvValue).join(',')).join('\n')+'\n');
 }
 const summary=[],matchups=[],orders=[],ranking=[];
 const desc=(a,b,k)=>(b[k]??-Infinity)-(a[k]??-Infinity);
 const datasets=[
  ['勝利時使用率',(a,b)=>desc(a,b,'winRate')],
  ['敗北時使用率',(a,b)=>desc(a,b,'lossRate')],
  ['勝利貢献候補',(a,b)=>desc(a,b,'winDiff')||desc(a,b,'useDiff')||desc(a,b,'usedRate')||b.winUsed-a.winUsed||b.picks-a.picks],
  ['入れ替え候補',(a,b)=>a.winDiff-b.winDiff||a.useDiff-b.useDiff||b.used-a.used],
  ['使用機会不足',(a,b)=>a.used-b.used]
 ];
 for (const deck of ids) {
  const own=games.filter(g=>g.p1===deck||g.p2===deck);
  assert.equal(own.length,600);
  const groups=[
   ['全体',own,summary,600],
   ...['先攻','後攻'].map((label,i)=>[label,own.filter(g=>(g[g.first]===deck)===(i===0)),orders,300]),
   ...ids.filter(d=>d!==deck).map(d=>['対'+colors[d],own.filter(g=>g.p1===d||g.p2===d),matchups,200])
  ];
  for (const [label,subset,output,total] of groups) {
   assert.equal(subset.length,total);
   const stats=[...catalog(deck)].map(([key,count])=>{
    const prior=priorPicks.get(colors[deck]+':'+key);
    return {key,picks:prior??0,base:[colors[deck],key,cards[key].name,count,prior??'前回対象外'],
     ...summarize(subset,deck,key)};
   });
   for (const s of stats) output.push([...(label==='全体'?[]:[label]),...s.base,...fields(s)]);
   for (const [metric,sorter] of datasets) {
    const pool=stats.filter(s=>metric==='使用機会不足'?s.used<total*.05:
     metric==='入れ替え候補'?s.used>=total*.05&&s.winDiff<0:true);
    pool.sort((a,b)=>sorter(a,b)||a.key.localeCompare(b.key)).forEach((s,i)=>
     ranking.push([label,metric,i+1,...s.base,...fields(s)]));
   }
  }
 }
 csv('summary',[...base,...header],summary);
 csv('by-matchup',['対面',...base,...header],matchups);
 csv('by-turn-order',['先後',...base,...header],orders);
 csv('ranking',['範囲','指標','掲載順',...base,...header],ranking);
 const compact=use=>Object.keys(use).sort().map(id=>id+':'+use[id].copies+':'+use[id].events).join(' ');
 csv('games',['試合ID','シード','P1色','P2色','先攻','勝利','決着ターン','P1最終ライフ','P2最終ライフ',
  'P1使用 ID:実体:イベント','P2使用 ID:実体:イベント','コーライル手札確認','コーライル通常使用可能確認'],
  games.map(m=>[[m.p1,m.p2,m.seed].join(':'),m.seed,colors[m.p1],colors[m.p2],m.first,m.winner,m.turn,
   m.life.p1,m.life.p2,compact(m.usage.p1),compact(m.usage.p2),
   m.p1==='blueBeginner'?Number(m.corile.inHand):'',m.p1==='blueBeginner'?Number(m.corile.playable):'']));
}

if (require.main===module) {
 const [out,...files]=process.argv.slice(2);
 assert(out&&files.length,'Usage: node beginner-card-usage-report.cjs OUT_DIR MATCH_JSON ...');
 writeReports(files.flatMap(file=>JSON.parse(fs.readFileSync(file,'utf8'))),out,path.join(__dirname,'reports/beginner-card-impact'));
}
