const {chromium}=require('playwright');const assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-gpu']}: {})});
try {
const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('file://'+path.join(__dirname,'index.html'));await page.locator('#keep').tap();await page.locator('#keep').tap();
await page.evaluate(()=>{
 for(const p of PLAYERS)for(const z of ZONES)state[p][z.id]=[];
 for(const p of PLAYERS){state[p].hand.push(createCard('試験1','通常','赤',true,ManaEngine.cost(0,{赤:1})),createCard('試験2','通常','赤',true,ManaEngine.cost(1,{赤:1})));for(let i=0;i<3;i++)state[p].energy.push(createCard('試験赤土地','土地','赤'));}
 visibility='both';$('#visibility').value='both';render();
});
const run=fn=>page.evaluate(fn);
const selectHand=async(p,index)=>{const id=await page.evaluate(({p,index})=>state[p].hand[index].id,{p,index});await page.locator(`[data-player="${p}"][data-zone="hand"] [data-card="${id}"]`).tap();};
assert.equal(await page.locator('[data-player="p1"][data-zone="hand"] .playable').count(),2);
assert.match(await page.locator('[data-player="p1"][data-zone="energy"] .mana-summary').innerText(),/合計3点/);
await selectHand('p1',1);assert.match(await page.locator('#move').innerText(),/手動移動/);await page.locator('#play').tap();assert.equal(await page.locator('[data-pay-land][aria-pressed="true"]').count(),2);assert.equal(await page.locator('#confirm-payment').isDisabled(),true);
const before=await run(()=>JSON.stringify(state));await page.locator('#cancel-payment').tap();assert.equal(await run(()=>JSON.stringify(state)),before);
await page.locator('#play').tap();await page.locator('[data-pay-slot="signi-2"]').tap();assert.equal(await page.locator('#confirm-payment').isEnabled(),true);
const first=await page.locator('[data-pay-land][aria-pressed="true"]').first().getAttribute('data-pay-land');await page.locator(`[data-pay-land="${first}"]`).tap();assert.equal(await page.locator('#confirm-payment').isDisabled(),true);assert.match(await page.locator('#payment-error').innerText(),/合計マナ不足/);
const replacement=await page.locator('[data-pay-land][aria-pressed="false"]').last().getAttribute('data-pay-land');await page.locator(`[data-pay-land="${replacement}"]`).tap();assert.equal(await page.locator('#confirm-payment').isEnabled(),true);
await page.locator('#confirm-payment').tap();assert.equal(await page.locator('#modal').isVisible(),false);assert.equal(await run(()=>state.p1['signi-2'].length),1);assert.equal(await run(()=>state.p1.energy.filter(c=>c.rest).length),2);assert.equal(await run(()=>state.p2.energy.filter(c=>c.rest).length),0);
assert.equal(await page.locator('[data-player="p1"][data-zone="energy"] .mana-state.spent').count(),2);assert.match(await page.locator('[data-player="p1"][data-zone="energy"] .mana-summary').innerText(),/合計1点/);
await selectHand('p1',0);await page.locator('#play').tap();await page.locator('[data-pay-slot="signi-1"]').tap();await page.locator('#confirm-payment').tap();assert.equal(await run(()=>state.p1.energy.every(c=>c.rest)),true);
await page.evaluate(()=>{state.p1.hand.push(createCard('残りの試験1','通常','赤',true,ManaEngine.cost(0,{赤:1})));render();});
assert.equal(await page.locator('[data-player="p1"][data-zone="hand"] .unplayable').count(),1);await selectHand('p1',0);assert.equal(await page.locator('#play').isDisabled(),true);assert.match(await page.locator('.selected-status').innerText(),/合計マナ不足/);
// 個別の手動縦横変更でも即座に可否と内訳を再描画。
const spent=await run(()=>state.p1.energy[0].id);await page.locator(`[data-player="p1"][data-zone="energy"] [data-card="${spent}"]`).tap();await page.locator('#rotate').tap();assert.equal(await page.locator('[data-player="p1"][data-zone="hand"] .playable').count(),1);assert.match(await page.locator('[data-player="p1"][data-zone="energy"] .mana-summary').innerText(),/合計1点/);
await page.locator('[data-ready="p1"]').tap();assert.equal(await run(()=>state.p1.energy.every(c=>!c.rest)),true);
// 同じ操作をP2でも実行しP1に影響しない。
await selectHand('p2',0);await page.locator('#play').tap();await page.locator('[data-pay-slot="signi-3"]').tap();await page.locator('#confirm-payment').tap();assert.equal(await run(()=>state.p2.energy.filter(c=>c.rest).length),1);assert.equal(await run(()=>state.p1.energy.filter(c=>c.rest).length),0);
// 空きなしでは表示もボタンも停止し、マナを消費しない。
await page.evaluate(()=>{for(const z of emptySlots('p1'))state.p1[z.id].push(createCard('満杯','通常','赤'));render();});await selectHand('p1',0);assert.match(await page.locator('.selected-status').innerText(),/配置先なし/);assert.match(await page.locator('[data-player="p1"][data-zone="hand"] .play-status').innerText(),/配置先なし/);assert.equal(await page.locator('#play').isDisabled(),true);assert.equal(await run(()=>state.p1.energy.filter(c=>c.rest).length),0);
assert(await run(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
await page.screenshot({path:'/tmp/cardgame-payment-mobile.png',fullPage:true});
console.log('PASS payment Chromium 390px touch: availability, manual/normal labels, land proposal/edit, missing-mana feedback, cancel, slot choice/confirm, used text/summary, remaining-hand updates, individual/all recovery, independent players, full-slot block and horizontal width.');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
