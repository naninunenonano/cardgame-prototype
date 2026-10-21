const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),M=require('./mana.js');
const land=(id,color,rest=false)=>({id,type:'土地',rest,mana:{color,amount:1}});
const rr=M.cost(2,{赤:2});
assert.equal(M.assess(rr,M.pool([land('r1','赤'),land('r2','赤'),land('b1','青'),land('b2','青')])).ok,true);
assert.equal(M.assess(rr,M.pool([land('r1','赤'),land('b1','青'),land('b2','青'),land('b3','青')])).ok,false);
assert.deepEqual(M.assess(rr,M.pool([land('r1','赤'),land('b1','青'),land('b2','青'),land('b3','青')])).reasons,['赤マナがあと1必要']);
const ordered=[land('b1','青'),land('r1','赤'),land('b2','青'),land('r2','赤'),land('r3','赤')];
const suggested=M.suggest(rr,ordered);assert.deepEqual(suggested,['r1','r2','b1','b2']);assert.equal(M.payment(rr,ordered.filter(c=>suggested.includes(c.id))).ok,true);
assert.equal(M.pool([land('used','赤',true)]).total,0);assert.match(M.assess(M.cost(1,{赤:1}),M.pool([land('r','赤')])).reasons[0],/合計マナ不足/);
assert.equal(M.assess(M.cost(0,{白:1,青:1,黒:1,赤:1,緑:1}),M.pool(M.colors.map(c=>land(c,c)))).ok,true);
assert.equal(M.payment(M.cost(0,{赤:1}),[land('r1','赤'),land('r2','赤')]).ok,false);
const el={textContent:'',innerHTML:'',value:'',querySelector:()=>({scrollLeft:0}),classList:{toggle(){}},addEventListener(){},close(){},showModal(){}};
const context=vm.createContext({console,ManaEngine:M,document:{querySelector:()=>el,querySelectorAll:()=>[],addEventListener(){}},confirm:()=>false});
vm.runInContext(fs.readFileSync(__dirname+'/app.js','utf8'),context);const run=s=>vm.runInContext(s,context);
run(`render=()=>{};renderPayment=()=>{};function all(){return Object.values(state).flatMap(p=>Object.values(p).flat()).map(c=>c.id).sort().join();}
function fixture(p='p1',generic=0,red=1){initial();completeMulligan('p1',[],true);completeMulligan('p2',[],true);for(const who of PLAYERS)for(const z of ZONES)state[who][z.id]=[];const unit=createCard('テスト通常','通常','赤',true,ManaEngine.cost(generic,{赤:red}));state[p].hand.push(unit);for(let i=0;i<generic+red;i++)state[p].energy.push(createCard('赤土地','土地','赤'));return unit;}`);
for(const n of [1,2]) {
 run(`var unit=fixture('p1',${n-1},1);var original=all();beginPlay(unit.id);pendingPlay.destination='signi-1';var session=pendingPlay;`);
 assert.equal(run('commitPlay(session)'),true);assert.equal(run('commitPlay(session)'),false);
 assert.equal(run('state.p1["signi-1"].length'),1);assert.equal(run('state.p1.energy.filter(c=>c.rest).length'),n);assert.equal(run('all()'),run('original'));
}
// 確定直前の不正状態では一切変更せずに拒否する。
for(const mutation of [
 `state.p1.trash.push(state.p1.hand.pop());`,
 `state.p1['signi-1'].push(createCard('占有','通常','赤'));`,
 `state.p1.energy[0].rest=true;`,
 `state.p2.energy.push(state.p1.energy.pop());`,
 `state.p1.energy[0].mana.color='青';`,
 `pendingPlay.landIds.push(pendingPlay.landIds[0]);`,
 `pendingPlay.landIds=[];`
]) {
 run(`unit=fixture();beginPlay(unit.id);pendingPlay.destination='signi-1';${mutation}var before=JSON.stringify(state);`);
 assert.equal(run('commitPlay(pendingPlay)'),false);assert.equal(run('JSON.stringify(state)'),run('before'));
}
run(`unit=fixture();var before=JSON.stringify(state);beginPlay(unit.id);var cancelled=pendingPlay;closeModal();`);assert.equal(run('JSON.stringify(state)'),run('before'));assert.equal(run('commitPlay(cancelled)'),false);
run(`unit=fixture();for(const z of emptySlots('p1'))state.p1[z.id].push(createCard('満杯','通常','赤'));var before=JSON.stringify(state);`);assert.equal(run('beginPlay(unit.id)'),false);assert.equal(run('playStatus(unit,"p1").text'),'配置先なし');assert.equal(run('JSON.stringify(state)'),run('before'));
run(`unit=fixture();state.p1.energy[0].rest=true;`);assert.equal(run('playStatus(unit,"p1").ok'),false);run(`readyMana('p1');`);assert.equal(run('playStatus(unit,"p1").ok'),true);
run(`unit=fixture('p2');var other=JSON.stringify(state);`);assert.equal(run('beginPlay(unit.id)'),false);assert.equal(run('JSON.stringify(state)'),run('other'));
console.log('PASS payment: colored/generic costs, mandatory colors first, red1 and 1+red1, used exclusion, shortages, 2+red2 with red2/blue2 vs red1/blue3, cancellation, stale hand/slot/land/cost/owner and duplicate IDs, atomic failure, double confirm, full slots, recovery, opponent normal-play block.');
