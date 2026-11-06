'use strict';

const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const Game = require('./game');
const Decks = require('./decks');
const {roster,collect,catalog,summarize} = require('./beginner-card-usage.cjs');

for (const deck of Decks.beginnerBotIds) {
 const g=Game.create({mode:'bot',decks:{p1:deck,p2:deck},random:()=>.25});
 const original=roster(g);
 for (const p of ['p1','p2']) {
  assert.equal(original[p].size,40);
  for (const [key,count] of catalog(deck))
   assert.equal([...original[p].values()].filter(k=>k===key).length,count);
 }
}

const original={p1:new Map([['a','nn2'],['b','nn2'],['c','spell'],['d','field'],['e','nn2']]),p2:new Map()};
const card=(instanceId,type='通常',owner='p1')=>({instanceId,type,owner});
const move=(c,from,to,player='p1')=>({kind:'move',card:c,from:{zone:from,player},to:{zone:to,player}});
const use=c=>({kind:'cardUse',card:c});
const entry=c=>({kind:'unitEntry',card:c});
const a=card('a'), b=card('b'), c=card('c','呪文'), d=card('d','設置物'), e=card('e');
const journal=[
 move(a,'main','hand'),move(a,'hand','energy'),move(b,'main','trash'),
 use(a),move(a,'check','signi-1'),entry(a),move(a,'signi-1','trash'),
 move(a,'trash','signi-1'),entry(a),move(b,'trash','signi-2'),entry(b),
 move(a,'signi-1','signi-3'),entry(a),
 use(c),use(c),use(d),move(d,'check','structures'),
 use(e),move(e,'check','signi-4'),move(e,'signi-4','trash'),
 ...['side','shield','character','token'].flatMap(id=>{
  const unrelated={...card(id),cardId:'nn2'};
  return [use(unrelated),move(unrelated,'extra','signi-7'),entry(unrelated)];
 })
];
const uses=collect(journal,original);
assert.deepEqual(uses,{p1:{nn2:{copies:2,events:3},spell:{copies:1,events:2},field:{copies:1,events:1}},p2:{}});
const games=[
 {p1:'blueBeginner',winner:'p1',turn:8,usage:uses},
 {p1:'blueBeginner',winner:'p2',turn:10,usage:{p1:{nn2:{copies:1,events:2}}}},
 {p1:'blueBeginner',winner:'p2',turn:11,usage:{p1:{}}}
];
const s=summarize(games,'blueBeginner','nn2');
assert.deepEqual(s,{total:3,wins:1,losses:2,used:2,unused:1,winUsed:1,lossUsed:1,winCopies:2,lossCopies:1,
 winEvents:3,lossEvents:2,winRate:1,lossRate:.5,usedRate:.5,unusedRate:0,winDiff:.5,useDiff:.5,
 winAvg:2,lossAvg:.5,usedTurns:9,unusedTurns:11});
assert.equal(summarize(games,'blueBeginner','missing').usedRate,null);

const run=(...args)=>JSON.parse(execFileSync(process.execPath,['beginner-matchup-test.cjs','2',...args],{cwd:__dirname,encoding:'utf8'}));
const observed=run('--usage');
assert.deepEqual(observed.map(({usage,corile,...match})=>match),run());
assert.deepEqual(observed,run('--usage'));
assert(observed.some(game=>game.usage.p1.nn2||game.usage.p2.nn2));
console.log('通常カード使用集計・対戦への非干渉・再現性 OK');
