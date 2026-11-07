'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {assess,eligible,writeReports}=require('./beginner-card-impact.cjs');

const players={p1:'blackBeginner',p2:'blueBeginner'};
const ref=(cardId,owner,instanceId)=>({cardId,owner,instanceId,type:'通常'});
const a=ref('kn10','p1','a'),b=ref('kn10','p1','b'),vanilla=ref('nn3','p1','c');
assert(!eligible(players.p1).has('nn3'));
assert(!eligible(players.p2).has('sbnn1'));
assert(eligible(players.p2).has('ns2')); // Evolution with an attack-triggered ability.
const hit=(attacker,beforeLife,afterLife)=>[
 {kind:'bodyStrike',attacker},
 {kind:'life',reason:'戦闘ダメージ',targetPlayer:'p2',beforeLife,afterLife},
 {kind:'dispatch'}
];
const journal=[...hit(a,30,25),...hit(b,25,21),...hit(vanilla,1,0)];
const impact=assess(journal,players,'p1');
assert.equal(impact.pick.key,'kn10');
assert.equal(impact.pick.body,9);
assert.deepEqual(impact.used.p1,['kn10']);
assert.deepEqual(impact,assess(journal,players,'p1'));
const unknown=assess(hit(vanilla,4,0),players,'p1');
assert.equal(unknown.pick,null);
assert(unknown.reason);
const close=assess([...hit(a,30,25),...hit(ref('kn9','p1','d'),25,20)],players,'p1');
assert.equal(close.pick,null);
assert.match(close.reason,/差/);
const out=fs.mkdtempSync(path.join(os.tmpdir(),'beginner-impact-'));
try{
 const match={...players,seed:1,first:'p1',winner:'p1',turn:20,life:{p1:5,p2:0},impact};
 writeReports([match,{...match,seed:2,first:'p2'},{...match,seed:3,impact:unknown}],out);
 const rows=fs.readFileSync(path.join(out,'beginner-bot-card-impact.csv'),'utf8');
 assert.match(rows,/"先陣のアパッチ","kn10","黒","3","2","2","100\.00","1","1"/);
 assert(!rows.includes('"nn3"'));
 assert.throws(()=>writeReports([match,match],out),/試合ID重複/);
 const saved=fs.readFileSync(path.join(out,'beginner-bot-card-matches.csv'),'utf8');
 assert(saved.includes(unknown.reason));
}finally{fs.rmSync(out,{recursive:true,force:true});}
console.log('PASS vanilla exclusion, ID grouping, tie and low-evidence handling, and first/second totals');
