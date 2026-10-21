const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const elements=new Map(),timers=new Map();let timerId=0;
const element=key=>{if(!elements.has(key))elements.set(key,{innerHTML:'',textContent:'',value:'',open:false,querySelector:()=>({scrollLeft:0}),classList:{toggle(){}},addEventListener(){},close(){this.open=false;},showModal(){this.open=true;}});return elements.get(key);};
const context=vm.createContext({console,ManaEngine:require('./mana.js'),document:{querySelector:element,querySelectorAll:()=>[],addEventListener(){}},confirm:()=>false,setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id)});
vm.runInContext(fs.readFileSync(__dirname+'/app.js','utf8'),context);const run=s=>vm.runInContext(s,context);
const flush=()=>{for(const [id,fn]of [...timers]){timers.delete(id);fn();}};
run(`render=()=>{};renderPayment=()=>{};function allIds(){return Object.values(state).flatMap(p=>Object.values(p).flat()).map(c=>c.id).sort().join();}`);
assert.equal(run('turn.number'),0);assert.equal(run('nextTurn()'),false);
run(`completeMulligan('p1',[],true);`);assert.equal(run('turn.number'),0);
run(`completeMulligan('p2',[],true);`);assert.equal(run('turn.number'),1);assert.equal(run('state.p1.hand.length'),7);assert.equal(run('state.p2.hand.length'),7);assert.equal(run('state.p1.main.length'),46);
run(`var lands=Object.values(state.p1).flat().filter(c=>c.type==='土地').slice(0,2);lands.forEach(c=>move(c.id,'p1','hand'));`);
assert.equal(run('placeLand(lands[0].id)'),true);assert.equal(run('turn.landsPlaced'),1);
run(`move(lands[0].id,'p1','hand');`);assert.equal(run('turn.landsPlaced'),1);
run(`var unchanged=JSON.stringify(state);`);assert.equal(run('placeLand(lands[0].id)'),false);assert.equal(run('placeLand(lands[1].id)'),false);assert.equal(run('JSON.stringify(state)'),run('unchanged'));assert.match(elements.get('#notice').textContent,/配置済み/);
run(`var normal=Object.values(state.p1).flat().find(c=>c.type==='通常');move(normal.id,'p1','hand');`);assert.equal(run('placeLand(normal.id)'),false);
run(`var foreign=Object.values(state.p2).flat().find(c=>c.type==='土地');move(foreign.id,'p2','hand');`);assert.equal(run('placeLand(foreign.id)'),false);
// 手動移動はルール外補助。回数を戻さず両側を検査できる。
assert.equal(run(`move(lands[0].id,'p1','energy')`),true);assert.equal(run('turn.landsPlaced'),1);
run(`move(normal.id,'p1','signi-1');var unit2=createCard('ブロック確認','通常','赤',true,ManaEngine.cost(0));state.p1['signi-2'].push(unit2);`);
assert.equal(run(`useUnit(normal.id,'攻撃')`),true);assert.equal(run('normal.rest'),true);assert.equal(run(`useUnit(normal.id,'ブロック')`),false);assert.equal(run(`useUnit(normal.id,'攻撃')`),false);
assert.equal(run(`useUnit(unit2.id,'ブロック')`),true);assert.equal(run(`useUnit(unit2.id,'ブロック')`),false);
run(`var otherUnit=createCard('相手確認','通常','赤');state.p2['signi-1'].push(otherUnit);`);assert.equal(run(`useUnit(otherUnit.id,'攻撃')`),false);
run(`
lands[0].rest=true;
var lrigCard=createCard('場の確認','通常','赤');lrigCard.rest=true;state.p1.lrig.push(lrigCard);
for(const z of ['hand','main','life','extra','trash','check']){if(!state.p1[z].length)state.p1[z].push(createCard('領域確認','仮カード','赤'));state.p1[z].at(-1).rest=true;}
var excluded=['hand','main','life','extra','trash','check'].map(z=>[z,state.p1[z].at(-1).id]);
for(const cards of Object.values(state.p2))cards.forEach(c=>c.rest=true);
var opponentBefore=JSON.stringify(state.p2),idsBefore=allIds(),handBefore=state.p1.hand.length,deckBefore=state.p1.main.length;
active='p2';var oldKey=turn.key;var originalDeal=deal;var orderObserved=false;
deal=(p,z,n,up)=>{if(z==='hand'){if(turn.landsPlaced!==0||state.p1.energy.some(c=>c.rest)||state.p1['signi-1'].some(c=>c.rest)||state.p1.lrig.some(c=>c.rest))throw Error('wrong start order');orderObserved=true;}return originalDeal(p,z,n,up);};
`);
assert.equal(run('nextTurn(oldKey)'),true);assert.equal(run('orderObserved'),true);assert.equal(run('nextTurn(oldKey)'),false);assert.equal(run('nextTurn()'),false);
assert.equal(run('turn.number'),2);assert.equal(run('turn.landsPlaced'),0);assert.equal(run('state.p1.hand.length'),run('handBefore+1'));assert.equal(run('state.p1.main.length'),run('deckBefore-1'));assert.equal(run('active'),'p2');assert.equal(run('JSON.stringify(state.p2)'),run('opponentBefore'));
assert.equal(run('allIds()'),run('idsBefore'));assert.equal(run('normal.rest||unit2.rest||lands[0].rest||lrigCard.rest'),false);assert.equal(run('excluded.every(([z,id])=>state.p1[z].find(c=>c.id===id)?.rest)'),true);
assert.equal(run('availableMana("p1").total'),1);
flush();assert.equal(run('turn.busy'),false);assert.equal(run('nextTurn(oldKey)'),false);
assert.equal(run('placeLand(lands[1].id)'),true);assert.equal(run('turn.landsPlaced'),1);
run(`deal=originalDeal;var freshKey=turn.key;`);assert.equal(run('nextTurn(freshKey)'),true);assert.equal(run('turn.number'),3);assert.equal(run('state.p1.hand.length'),run('handBefore+1'));assert.equal(run('active'),'p2');flush();
// ターン更新・リセットで以前の支払いを失効させる。
run(`var pendingUnit=createCard('支払い中','通常','赤',true,ManaEngine.cost(0));state.p1.hand.push(pendingUnit);state.p1['signi-3']=[];beginPlay(pendingUnit.id);var stalePayment=pendingPlay;var fresh=turn.key;nextTurn(fresh);`);assert.equal(run('pendingPlay'),null);assert.equal(run('commitPlay(stalePayment)'),false);
context.confirm=()=>true;run('document.querySelector("#reset").onclick();');assert.equal(run('turn.number'),0);assert.equal(run('turn.landsPlaced'),0);assert.equal(run('turn.busy'),false);assert.equal(run('selected'),null);assert.equal(run('pendingPlay'),null);assert.equal(timers.size,0);assert.equal(run('mulligan.p1'), 'pending');assert.equal(run('mulligan.p2'),'pending');
run(`completeMulligan('p1',[],true);completeMulligan('p2',[],true);`);assert.equal(run('turn.number'),1);assert.equal(run('state.p1.hand.length'),7);assert.equal(run('state.p1.main.length'),46);assert.equal(run('turn.landsPlaced'),0);assert.equal(run('Object.values(state).flatMap(p=>Object.values(p).flat()).every(c=>!c.rest)'),true);
// 山札なしでも未確定の敗北を作らず、回復・回数リセットだけ行う。
run(`state.p1.trash.push(...state.p1.main.splice(0));var currentHand=state.p1.hand.length;`);assert.equal(run('nextTurn()'),true);assert.equal(run('state.p1.hand.length'),run('currentHand'));assert.equal(run('turn.lastDraw'),0);flush();
console.log('PASS turns: opening no draw, solo turn2/3 draw, operation token/cooldown, no auto switch/opponent change, land once/return/no refund, manual bypass label model, attack/block exhaustion, exact recovery scope/order, availability, pending-operation reset and empty-deck handling.');
