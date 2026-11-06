'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const Decks=require('./decks');
const {cards}=require('./cards');
const {row}=require('./five-deck-observation.cjs');
const entrants=['whiteBeginner','blueBeginner','blackBeginner','redBeginner','blueAdvanced'];
const players=['p1','p2'];
const rate=(n,d)=>d?100*n/d:null;
const mean=(n,d)=>d?n/d:null;
const matchId=g=>[g.p1,g.p2,g.seed].join(':');
function read(files){return files.flatMap(file=>fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line)));}
function results(games,id){
 const won=g=>g[g.winner]===id;
 const win=games.filter(won).length,draw=games.filter(g=>!g.winner).length;
 return {games:games.length,win,loss:games.length-win-draw,draw,winRate:rate(win,games.length),
  averageTurns:mean(games.reduce((n,g)=>n+g.turn,0),games.length)};
}
function describe(s,all){
 const effect=s.damage+.25*s.unitDamage+2*s.removal+1.25*s.bounce+1.5*s.discard+s.draw+.5*s.heal+s.blocks+.25*s.reduction;
 return {effect,per100:100*effect/all};
}
function evaluate(games,deck,key,section){
 const stats=row(), use={win:0,loss:0,draw:0},useEvents={win:0,loss:0,draw:0};
 const impactByResult={win:0,loss:0,draw:0};
 const unused={noOpportunity:0,cost:0,condition:0,skipped:0,unattributed:0};
 const initial=key.split(':')[0],character=cards[initial].type==='キャラクター';
 let used=0,outputGames=0;
 for(const g of games){
  const p=g.p1===deck?'p1':'p2',s=g.cards[p][key];
  assert(s,key);
  const tally=g.winner===p?'win':g.winner?'loss':'draw';
  const effective=character&&key===initial?{...s}:s;
  if(character&&key===initial)for(let lv=1;lv<=4;lv++){
   const values=g.cards[p][key+':'+lv];
   for(const name of ['activations','damage','unitDamage','removal','bounce','discard','draw','heal','selfDamage','blocks'])
    effective[name]+=values[name];
  }
  for(const k of Object.keys(stats)){
   assert(Number.isFinite(effective[k]),key+' '+k);
   stats[k]+=effective[k];
  }
  impactByResult[tally]+=describe(effective,1).effect;
  if(s.uses){
   used++;use[tally]++;useEvents[tally]+=s.uses;
   if(describe(effective,1).effect>0)outputGames++;
  }else if(s.ready)unused.skipped++;
  else if(s.cost)unused.cost++;
  else if(s.condition)unused.condition++;
  else if(!s.seen)unused.noOpportunity++;
  else unused.unattributed++;
 }
 assert.equal(used+Object.values(unused).reduce((a,b)=>a+b,0),games.length);
 const {effect,per100}=describe(stats,games.length);
 let evaluation='有効';
 if(unused.skipped>=30&&used/(unused.skipped+used)<.10)evaluation='判断不良の疑い';
 else if(used<10)evaluation='評価保留';
 else if(used>=games.length*.20&&per100>=200)evaluation='主力';
 else if(used<games.length*.10)evaluation='状況依存';
 else if(effect/used<.5&&stats.activations===0)evaluation='低貢献';
 return {name:cards[initial].name+(key===initial?'':' Lv'+key.split(':')[1]),key,section,
  usedGames:used,useRate:rate(used,games.length),useGamesByResult:use,useEventsByResult:useEvents,
  usedWinRate:rate(use.win,used),unusedWinRate:rate(results(games,deck).win-use.win,games.length-used),
  averageUseTurn:mean(stats.turns,stats.uses),unused,usedWithoutQuantifiedOutput:used-outputGames,
  impactByResult,...stats,charge:section==='main'?stats.charge:null,scorePer100:per100,evaluation};
}
function report(input,out,perPair=200){
 const seeds=new Set(),matchups=[],decks=[],cardsByDeck={},issues=[];
 for(const g of input){assert(!seeds.has(g.seed));seeds.add(g.seed);assert(g.seed>=1000001);}
 const anomalies=input.filter(g=>g.error),games=input.filter(g=>!g.error);
 assert.equal(games.length,10*perPair);
 for(const [i,a] of entrants.entries())for(const b of entrants.slice(i+1)){
  const pair=games.filter(g=>g.p1===a&&g.p2===b);
  assert.equal(pair.length,perPair);
  assert.equal(pair.filter(g=>g.first==='p1').length,perPair/2);
  for(const g of pair)assert([null,'p1','p2'].includes(g.winner));
  matchups.push({a,b,aResults:results(pair,a),bResults:results(pair,b)});
 }
 for(const id of entrants){
  const own=games.filter(g=>g.p1===id||g.p2===id);
  assert.equal(own.length,4*perPair);
  const deck=Decks.preset(id);
  decks.push({id,name:deck.name,...results(own,id),
   first:results(own.filter(g=>g[g.first]===id),id),second:results(own.filter(g=>g[g.first]!==id),id),
   ...(id!=='blueAdvanced'?{beginnerOnly:results(own.filter(g=>g.p2!=='blueAdvanced'),id)}:{})});
  const cardRows=[];
  for(const section of ['main','sideboard','shields']){
   assert.equal(deck[section].reduce((n,c)=>n+c.count,0),{main:40,sideboard:10,shields:4}[section]);
   for(const {key,count} of deck[section]){
    cardRows.push({copies:count,...evaluate(own,id,key,section)});
    if(cards[key].type==='キャラクター')for(let lv=1;lv<=4;lv++)
     cardRows.push({copies:null,...evaluate(own,id,key+':'+lv,'characterLevel')});
   }
  }
  const ranked=cardRows.filter(r=>r.section!=='characterLevel').sort((a,b)=>b.scorePer100-a.scorePer100||b.usedGames-a.usedGames||a.key.localeCompare(b.key));
  cardsByDeck[id]={all:cardRows,top:ranked.slice(0,5).map(r=>r.key),bottom:ranked.slice(-5).reverse().map(r=>r.key)};
  issues.push(...cardRows.filter(r=>r.evaluation==='判断不良の疑い').map(r=>({deck:id,key:r.key,name:r.name,ready:r.ready,skipped:r.skipped,usedGames:r.usedGames,unused:r.unused})));
 }
 fs.mkdirSync(out,{recursive:true});
 function json(file,data){fs.writeFileSync(path.join(out,file),JSON.stringify(data,null,2)+'\n');}
 function lines(file,items){fs.writeFileSync(path.join(out,file),items.map(g=>JSON.stringify(g)).join('\n')+'\n');}
 lines('games.jsonl',games.map(({cards,...g})=>({id:matchId(g),...g})));
 json('matchups.json',matchups);
 json('decks.json',decks);
 json('cards.json',cardsByDeck);
 json('decision-issues.json',issues);
 json('anomalies.json',anomalies.map(g=>({id:matchId(g),...g})));
 const pct=n=>n===null?'算出不可':n.toFixed(2)+'%';
 const value=n=>n===null?'対象外':n.toFixed(2);
 const summary=['# 全採用カードの評価','',
  '使用は登場・設置・呪文使用宣言・シールド発動・成長の観測数。点数は100参加試合当たり。',''];
 for(const deck of decks){
  const {all,top,bottom}=cardsByDeck[deck.id];
  const names=keys=>keys.map(key=>all.find(c=>c.key===key).name).join('、');
  summary.push('## '+deck.name,'','- 上位5種 '+names(top),'- 下位5種 '+names(bottom),'',
   '| カード | ID | 区分 | 枚数 | 使用試合／回数 | 使用率 | 使用時勝率 | 未使用時勝率 | 機会／見送り | 発動処理 | マナチャージ | 観測点 | 評価 |',
   '|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for(const c of all)summary.push('| '+[c.name,c.key,({main:'メイン',sideboard:'サイド',shields:'シールド',characterLevel:'キャラ能力'})[c.section],
   c.copies??'対象外',c.usedGames+'／'+c.uses,pct(c.useRate),pct(c.usedWinRate),pct(c.unusedWinRate),
   c.ready+'／'+c.skipped,c.activations,c.charge??'対象外',value(c.scorePer100),c.evaluation].join(' | ')+' |');
  summary.push('');
 }
 fs.writeFileSync(path.join(out,'card-evaluation.md'),summary.slice(0,-1).join('\n')+'\n');
 return {decks,matchups,cardsByDeck,issues};
}
module.exports={report,read};
if(require.main===module){
 const [out,...files]=process.argv.slice(2);
 assert(out&&files.length);
 report(read(files),out);
}
