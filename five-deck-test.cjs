'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {report}=require('./five-deck-report.cjs');
function run(flag){
 return execFileSync(process.execPath,['beginner-matchup-test.cjs','2',flag],{
  cwd:__dirname,encoding:'utf8',env:{...process.env,BOT_PAIR:''}
 }).trim().split('\n').map(JSON.parse);
}
const measured=run('--five');
assert.deepEqual(measured.map(({cards,...g})=>g),run('--five-control'));
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'five-deck-study-'));
try{
 const data=report(measured,folder,2);
 assert.equal(data.decks.length,5);
 assert.equal(data.matchups.length,10);
 for(const {id,games,first,second} of data.decks){
  assert.equal(games,8);
  assert.equal(first.games,4);
  assert.equal(second.games,4);
  const rows=data.cardsByDeck[id].all;
  assert.equal(rows.filter(r=>r.section==='characterLevel').length,4);
  assert.equal(rows.reduce((n,r)=>n+(r.copies||0),0),54);
  assert(rows.every(r=>r.usedGames<=8&&r.skipped<=r.ready));
 }
 assert.throws(()=>report(measured.concat(measured[0]),folder,2));
}finally{fs.rmSync(folder,{force:true,recursive:true});}
console.log('PASS five-deck parity with unobserved matches, deck counts, aggregation and duplicate seed rejection');
