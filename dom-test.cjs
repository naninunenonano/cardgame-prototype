// npm install --no-save jsdom でテスト用DOMを用意（アプリ本体には不要）。
const {JSDOM}=require('jsdom');
const fs=require('node:fs'),assert=require('node:assert/strict');
const dom=new JSDOM(fs.readFileSync(__dirname+'/index.html','utf8'),{runScripts:'outside-only'});
const w=dom.window;w.assert=assert;w.confirm=()=>false;
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
w.HTMLDialogElement.prototype.close=function(){this.open=false;};
w.eval(fs.readFileSync(__dirname+'/app.js','utf8')+`
const click=s=>$(s).click();
assert.equal($('#modal').open,true);click('[data-mode="A"]');assert.equal($('#modal').open,false);
assert.equal(document.querySelectorAll('.zone').length,22);assert.match($('#current-mode').textContent,/A：/);
function selectHand(index=1){document.querySelectorAll('[data-player="p1"][data-zone="hand"] .card')[index].click();}
selectHand();const id=selected;click('#to-mana');assert.equal(locate(id).z,'energy');assert.equal(state.p1.energy.length,1);
click('#rotate');assert.match($('[data-player="p1"][data-zone="energy"] .count').textContent,/1枚縦 0 \\/ 横 1/);assert.ok($('[data-player="p1"][data-zone="energy"] .card.rest'));
click('[data-ready="p1"]');assert.match($('[data-player="p1"][data-zone="energy"] .count').textContent,/縦 1 \\/ 横 0/);
const beforeCancel=JSON.stringify(state);click('#mode-change');click('[data-mode="B"]');assert.equal(mode,'A');assert.equal(JSON.stringify(state),beforeCancel);click('#close');
window.confirm=()=>true;click('#mode-change');click('[data-mode="B"]');assert.equal(mode,'B');assert.match($('#current-mode').textContent,/B：/);
selectHand();const beforeReject=JSON.stringify(state);click('#to-mana');assert.equal(JSON.stringify(state),beforeReject);assert.match($('#notice').textContent,/土地/);
$('#destination').value='p2/energy';click('#move');assert.equal(JSON.stringify(state),beforeReject);assert.match($('#notice').textContent,/土地/);
selectHand(0);assert.ok($('[data-player="p1"][data-zone="hand"] .card.land'));click('#to-mana');assert.equal(state.p1.energy.length,1);click('#rotate');assert.match($('[data-player="p1"][data-zone="energy"] .count').textContent,/縦 0 \\/ 横 1/);
click('#add');$('#add-form [name="destination"]').value='p2/energy';$('#add-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));assert.equal(state.p2.energy.length,0);assert.match($('#add-error').textContent,/土地/);$('#add-form [name="type"]').value='土地';$('#add-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));assert.equal(state.p2.energy.length,1);
click('#reset');assert.equal(mode,'B');assert.equal(state.p1.energy.length,0);assert.equal(state.p2.energy.length,0);
`);
console.log('PASS DOM: startup choice, dedicated/generic restrictions, rejection messages, land appearance class, mana counts/rotation/ready-all, add validation, mode cancel/confirm, reset. CSS layout and real touch remain unverified.');dom.window.close();
