const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const elements=new Map();
const element=key=>{if(!elements.has(key))elements.set(key,{innerHTML:'',textContent:'',value:'',querySelector:()=>({scrollLeft:0}),classList:{toggle(){}},close(){this.open=false;},showModal(){this.open=true;}});return elements.get(key);};
const context=vm.createContext({console,document:{querySelector:element,querySelectorAll:()=>[],addEventListener(){}},confirm:()=>false});
vm.runInContext(fs.readFileSync(__dirname+'/app.js','utf8'),context);
const run=s=>vm.runInContext(s,context);
run(`render=()=>{};renderSetup=()=>{};function all(p){return Object.values(state[p]).flat();}function signature(p){return all(p).map(c=>c.id).sort().join();}`);
// 毎回の生成構成と、0〜7枚交換を複数のシャッフル結果で検証。
for(let repeat=0;repeat<24;repeat++)for(const count of [0,1,3,7]) {
  run('initial();');
  for(const p of ['p1','p2']) {
    assert.equal(run(`all('${p}').length`),60);
    assert.equal(run(`all('${p}').filter(c=>c.basic&&c.type==='土地').length`),24);
    assert.equal(run(`all('${p}').filter(c=>c.type==='通常').length`),36);
    assert.equal(run(`state.${p}.hand.length`),7);
    assert.equal(run(`state.${p}.main.length`),53);
    assert.equal(run(`state.${p}.life.length`),0);
    assert.equal(run(`state.${p}.extra.length`),0);
    for(let cost=1;cost<=12;cost++) assert.equal(run(`all('${p}').filter(c=>c.cost===${cost}&&c.color==='赤').length`),3);
  }
  run('var before=signature("p1");var ids=state.p1.hand.slice(0,'+count+').map(c=>c.id);var expected=state.p1.main.slice(0,'+count+').map(c=>c.id);var existing=state.p1.hand.filter(c=>!ids.includes(c.id)).map(c=>c.id);');
  assert.equal(run('move(state.p1.hand[0].id,"p1","trash")'),false);
  assert.equal(run('addCard("p1","hand",createCard("追加","通常","赤"))'),false);
  // シャッフル実行時点ではドロー済みで、戻した個体は手札にない。
  run(`var originalShuffle=shuffle;var called=0;shuffle=(p,z)=>{called++;if(state[p].hand.length!==7)throw Error('shuffle before draw');if(p==='p1'&&ids.some(id=>state.p1.hand.some(c=>c.id===id)))throw Error('redrawn returned card');originalShuffle(p,z);};`);
  assert.equal(run('completeMulligan("p1",ids)'),true);
  assert.equal(run('called'),1);
  assert.equal(run('state.p1.hand.map(c=>c.id).sort().join()'),run('[...existing,...expected].sort().join()'));
  assert.equal(run('signature("p1")'),run('before'));
  assert.equal(run('state.p1.life.length'),0);
  assert.equal(run('completeMulligan("p1",[])'),false);
  run('shuffle=originalShuffle;');
  assert.equal(run('completeMulligan("p2",[],true)'),true);
  assert.equal(run('phase'),'ready');
  for(const p of ['p1','p2']) {
    assert.equal(run(`state.${p}.hand.length`),7);
    assert.equal(run(`state.${p}.life.length`),7);
    assert.equal(run(`state.${p}.main.length`),46);
    assert.equal(run(`state.${p}.life.every(c=>!c.faceUp&&!c.rest)`),true);
    assert.equal(run(`new Set(all('${p}').map(c=>c.id)).size`),60);
    assert.equal(run(`all('${p}').every(c=>c.origin==='${p}')`),true);
  }
  assert.equal(run('signature("p1")'),run('before'));
}
run(`initial();var handBefore=JSON.stringify(state);var duplicate=state.p1.hand[0].id;`);
assert.equal(run('completeMulligan("p1",[duplicate,duplicate])'),false);
assert.equal(run('completeMulligan("p1",["missing"])'),false);
assert.equal(run('JSON.stringify(state)'),run('handBefore'));
assert.equal(run('completeMulligan("p2",[],true)'),true);
assert.equal(run('state.p2.life.length'),0);
run('completeMulligan("p1",[],true);');
run(`var card=Object.values(state.p1).flat().find(c=>c.type==='通常');var beforeMove=signature('p1');`);
assert.equal(run(`move(card.id,'p1','energy')`),false);
run(`var land=Object.values(state.p1).flat().find(c=>c.type==='土地');land.rest=true;`);
assert.equal(run(`move(land.id,'p1','energy')`),true);
assert.equal(run('manaCounts("p1").sideways'),1);run('readyMana("p1")');assert.equal(run('manaCounts("p1").upright'),1);
assert.equal(run('signature("p1")'),run('beforeMove'));
for(let i=0;i<10;i++)assert.equal(run(`addCard('p1','extra',createCard('同名のサイド用仮カード','仮カード','赤'))`),true);
assert.equal(run(`addCard('p1','extra',createCard('11枚目','仮カード','赤'))`),false);
run('var resetBefore=JSON.stringify(state);selected=card.id;document.querySelector("#reset").onclick();');assert.equal(run('JSON.stringify(state)'),run('resetBefore'));
context.confirm=()=>true;run('document.querySelector("#reset").onclick();');assert.equal(run('selected'),null);assert.equal(run('mulligan.p1'), 'pending');assert.equal(run('mulligan.p2'),'pending');assert.equal(run('state.p1.hand.length'),7);assert.equal(run('state.p1.life.length'),0);assert.equal(run('all("p1").length'),60);
run(`var deck=buildDeck('p1');validateDeck(deck);deck[3]={...deck[3],name:deck[0].name};`);assert.throws(()=>run('validateDeck(deck)'),/3枚/);
console.log('PASS model: 96 opening runs; exact 60-card composition, 0/1/3/7 exchange order and identities, one-time choices, no early shields, final 7/7/46 and 60 unique IDs, setup lock, land-only, sideboard slots without name limit, reset.');
