const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const elements=new Map();const element=key=>{if(!elements.has(key))elements.set(key,{innerHTML:'',textContent:'',value:'',querySelector:()=>({scrollLeft:0}),classList:{toggle(){}},addEventListener(){},showModal(){this.open=true},close(){this.open=false}});return elements.get(key);};
const context=vm.createContext({console,document:{querySelector:element,querySelectorAll:()=>[],addEventListener(){}},confirm:()=>false});
vm.runInContext(fs.readFileSync(__dirname+'/app.js','utf8'),context);const run=s=>vm.runInContext(s,context);
run(`render=()=>{};renderControl=()=>{};changeMode('A');`);
assert.equal(run('ZONES.length'),11);assert.equal(run('state.p1.hand.length'),5);assert.equal(run('state.p2.life.length'),7);
run(`function ids(){return Object.values(state).flatMap(p=>Object.values(p).flat()).map(c=>c.id).sort().join();} var original=ids();var c=state.p1.hand[0];c.faceUp=false;c.rest=true;`);
for(let i=0;i<100;i++){run(`move(c.id,'${i%2?'p1':'p2'}','${['main','signi-1','trash','life'][i%4]}',${!!(i%2)});`);assert.equal(run('ids()'),run('original'));assert.equal(run('locate(c.id).card.faceUp'),false);assert.equal(run('locate(c.id).card.rest'),true);}
run(`move(c.id,'p1','main');`);assert.equal(run('state.p1.main[0].id'),run('c.id'));run(`move(c.id,'p1','main',true);`);assert.equal(run('state.p1.main.at(-1).id'),run('c.id'));
run(`for(let i=0;i<50;i++)shuffle('p1','main');`);assert.equal(run('ids()'),run('original'));
run(`var n=state.p1.main.length;var h=state.p1.hand.length;move(state.p1.main[0].id,'p1','hand');`);assert.equal(run('state.p1.main.length'),run('n-1'));assert.equal(run('state.p1.hand.length'),run('h+1'));
run(`var s=JSON.stringify(state);document.querySelector('#reset').onclick();`);assert.equal(run('JSON.stringify(state)'),run('s'));
run(`active='p1';visibility='active';var face=createCard('確認','仮','青');`);assert.equal(run(`hidden('p2','hand',face)`),true);run(`visibility='both'`);assert.equal(run(`hidden('p2','hand',face)`),false);run(`face.faceUp=false`);assert.equal(run(`hidden('p2','hand',face)`),true);
run(`var added=createCard('追加','仮','赤');state.p1.check.push(added);`);assert.equal(run('new Set(ids().split(",")).size'),run('ids().split(",").length'));run(`var at=locate(added.id);state[at.p][at.z].splice(at.index,1);`);assert.equal(run('locate(added.id)'),null);
context.confirm=()=>true;run(`document.querySelector('#reset').onclick();`);assert.equal(run('state.p1.hand.length'),5);assert.equal(run('state.p1.main.length'),12);
console.log('PASS: initial zones/counts; 100 cross-player moves preserve IDs and orientation; top/bottom; shuffle; draw; visibility; add/delete; reset cancel/accept. DOM layout and real browser interaction are not covered.');

// 両方式を同じカード構成で比較し、マナの入口を検証。
run(`mode='A';initial();var sample=JSON.stringify(state);var nonland=state.p1.hand.find(c=>c.type!=='土地');var land=state.p1.hand.find(c=>c.type==='土地');var allBefore=ids();`);
assert.equal(run(`move(nonland.id,'p1','energy')`),true);
assert.equal(run(`move(land.id,'p1','energy')`),true);
assert.equal(run('ids()'),run('allBefore'));
run(`state.p1.energy[0].rest=true;`);
assert.equal(run('manaCounts("p1").total'),2);assert.equal(run('manaCounts("p1").upright'),1);assert.equal(run('manaCounts("p1").sideways'),1);
run(`readyMana('p1')`);assert.equal(run('manaCounts("p1").upright'),2);
run(`mode='B';initial();`);assert.equal(run('JSON.stringify(state)'),run('sample'));
assert.equal(run(`JSON.stringify(state.p1.main.map(({id,...c})=>c))`),run(`JSON.stringify(state.p2.main.map(({id,...c})=>c))`));
run(`nonland=state.p1.hand.find(c=>c.type!=='土地');land=state.p1.hand.find(c=>c.type==='土地');allBefore=ids();var blockedState=JSON.stringify(state);`);
assert.equal(run(`move(nonland.id,'p1','energy')`),false);assert.equal(run('JSON.stringify(state)'),run('blockedState'));
assert.match(elements.get('#notice').textContent,/土地/);
assert.equal(run(`move(land.id,'p1','energy')`),true);assert.equal(run('ids()'),run('allBefore'));
assert.equal(run(`move(nonland.id,'p2','energy',true)`),false);
run(`move(nonland.id,'p1','trash')`);assert.equal(run(`move(nonland.id,'p1','energy')`),false);
assert.equal(run(`addCard('p1','energy',createCard('不可','シグニ','赤'))`),false);
assert.equal(run(`addCard('p2','energy',createCard('土地追加','土地','緑'))`),true);
context.confirm=()=>false;run(`var unchanged=JSON.stringify(state)`);assert.equal(run(`changeMode('A')`),false);assert.equal(run('mode'),'B');assert.equal(run('JSON.stringify(state)'),run('unchanged'));
context.confirm=()=>true;assert.equal(run(`changeMode('A')`),true);assert.equal(run('JSON.stringify(state)'),run('sample'));
console.log('PASS: A/B entry restrictions, generic/cross-player/add routes, stable IDs, mana orientation counts and ready-all, identical samples, confirmed mode change and cancellation.');
