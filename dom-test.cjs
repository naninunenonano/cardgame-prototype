const {JSDOM}=require('jsdom');const fs=require('node:fs'),assert=require('node:assert/strict');
const dom=new JSDOM(fs.readFileSync(__dirname+'/index.html','utf8'),{runScripts:'outside-only'}),w=dom.window;
w.assert=assert;w.confirm=()=>false;
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
w.eval(fs.readFileSync(__dirname+'/app.js','utf8')+`
const click=s=>$(s).click();
assert.equal($('#board').hidden,true);assert.equal($('#normal-controls').disabled,true);assert.equal($('#add').closest('fieldset').disabled,true);assert.equal(document.querySelectorAll('[data-mulligan]').length,7);
click('[data-mulligan]');assert.equal(exchangeSelection.size,1);assert.equal($('[data-mulligan]').getAttribute('aria-pressed'),'true');click('[data-mulligan]');assert.equal(exchangeSelection.size,0);
for(const id of state.p1.hand.map(c=>c.id))click('[data-mulligan="'+id+'"]');assert.equal(exchangeSelection.size,7);assert.equal($('#exchange').textContent,'7枚交換する');const stale=$('#exchange');stale.click();assert.equal(mulligan.p1,'done');stale.click();assert.equal(mulligan.p2,'pending');assert.equal(state.p1.hand.length,7);assert.equal(state.p1.life.length,0);
click('#keep');assert.equal(phase,'ready');assert.equal($('#board').hidden,false);assert.equal($('#setup').hidden,true);assert.equal($('#normal-controls').disabled,false);assert.equal(document.querySelectorAll('.zone').length,22);
assert.match($('[data-player="p1"][data-zone="extra"] .zone-title').textContent,/サイドボード0\\/10枚/);assert.match($('[data-player="p1"][data-zone="life"] .zone-title').textContent,/シールド7枚/);assert.equal($('#mode-change'),null);
$('#visibility').value='both';$('#visibility').dispatchEvent(new Event('change'));assert.equal(document.querySelectorAll('[data-zone="hand"] .card:not(.back)').length,14);
let nonland=Object.values(state.p1).flat().find(c=>c.type==='通常');move(nonland.id,'p1','hand');render();click('[data-card="'+nonland.id+'"]');click('#to-mana');assert.equal(state.p1.energy.length,0);assert.match($('#notice').textContent,/土地/);
$('#destination').value='p2/energy';click('#move');assert.equal(state.p2.energy.length,0);
const land=Object.values(state.p1).flat().find(c=>c.type==='土地');move(land.id,'p1','hand');land.faceUp=true;render();click('[data-card="'+land.id+'"]');click('#to-mana');click('#rotate');assert.match($('[data-player="p1"][data-zone="energy"] .count').textContent,/縦 0 \\/ 横 1/);click('[data-ready="p1"]');assert.equal(land.rest,false);
click('#add');$('#add-form [name="destination"]').value='p1/extra';$('#add-form [name="type"]').value='土地';$('#add-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));assert.equal(state.p1.extra.length,1);
const snapshot=JSON.stringify(state);click('#reset');assert.equal(JSON.stringify(state),snapshot);window.confirm=()=>true;click('#reset');assert.equal(phase,'mulligan');assert.equal(selected,null);assert.equal(state.p1.extra.length,0);assert.equal(mulligan.p1,'pending');assert.equal(mulligan.p2,'pending');click('#exchange');assert.equal(mulligan.p1,'done');assert.equal(state.p1.hand.length,7);click('#keep');assert.equal(phase,'ready');
`);
console.log('PASS DOM: multi-select/reselect/count, stale double-click prevention, setup UI locks, labels, hand visibility, land-only dedicated/generic move, mana counts, sideboard add, reset cancel/accept and 0-card exchange.');w.close();
