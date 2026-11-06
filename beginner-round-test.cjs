'use strict';

const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {standings,lifeCurve}=require('./beginner-round-report.cjs');
const {turns}=require('./beginner-round-log.cjs');

const p1='blueBeginner',p2='greenBeginner';
const pair=p1+':'+p2;
const play=(mode,env={})=>execFileSync(process.execPath,['beginner-matchup-test.cjs','2',mode],{
 env:{...process.env,BOT_PAIR:pair,...env},encoding:'utf8'
}).trim().split('\n').map(JSON.parse);
const games=play('--beginner-round');
assert.deepEqual(games.map(g=>g.first),['p1','p2']);
for(const g of games){
 assert.equal(g.turns.length,g.turn);
 assert.deepEqual(g.turns.at(-1).life,[g.life.p1,g.life.p2]);
 assert.equal(g.turns.at(-1).decided,true);
}
const [replay]=play('--beginner-round',{BOT_REPLAY_SEED:games[0].seed,BOT_REPLAY_FIRST:games[0].first});
const comparable=({startedAt,...g})=>g;
assert.deepEqual(comparable(replay),comparable(games[0]));
const score=standings([{p1,p2,winner:null,life:{p1:1,p2:1},turn:1}],p1);
assert.equal(score.winRate,50);
assert.equal(score.draw,1);
const curve=lifeCurve([{p1,p2,turns:[{turn:1,life:[30,27]},{turn:2,life:[28,27]}]},
 {p1,p2,turns:[{turn:1,life:[20,27]}]}],p1);
assert.deepEqual(curve,[{turn:1,games:2,average:-2,median:-2},{turn:2,games:1,average:1,median:1}]);

const audit=(a,b)=>({p1:{life:a,mana:1,zones:{hand:2}},p2:{life:b,mana:2,zones:{hand:3}}});
const final={life:{p1:0,p2:12},state:{p1:{energy:[],hand:[]},p2:{energy:[],hand:[]}},result:{winner:'p2'}};
const log=turns(final,[{kind:'turnStart',turnSequence:1,actor:'p1',after:audit(30,30)},
 {kind:'turnStart',turnSequence:2,actor:'p2',after:audit(30,12)}]);
assert.deepEqual(log.map(t=>[t.difference,t.decided]),[[18,false],[12,true]]);
