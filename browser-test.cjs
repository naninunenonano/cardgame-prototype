const {chromium}=require('playwright');
const assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-gpu']}: {})});
 try {
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file://'+path.join(__dirname,'index.html'));
 const run=fn=>page.evaluate(fn);
 assert.equal(await page.locator('#setup').isVisible(),true);assert.equal(await page.locator('#add').isDisabled(),true);
 assert.equal(await page.locator('[data-mulligan]').count(),7);
 assert(await run(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.locator('[data-mulligan]').first().tap();assert.match(await page.locator('#exchange-count').innerText(),/1枚/);await page.locator('[data-mulligan]').first().tap();assert.match(await page.locator('#exchange-count').innerText(),/0枚/);
 const returned=await run(()=>state.p1.hand.slice(0,3).map(c=>c.id));const expected=await run(()=>state.p1.main.slice(0,3).map(c=>c.id));
 for(const id of returned)await page.locator(`[data-mulligan="${id}"]`).tap();await page.locator('#exchange').tap();
 assert.equal(await run(()=>mulligan.p1),'done');assert.equal(await run(()=>state.p1.life.length),0);
 const newHand=await run(()=>state.p1.hand.map(c=>c.id));assert(returned.every(id=>!newHand.includes(id)));assert(expected.every(id=>newHand.includes(id)));
 const p2=await run(()=>state.p2.hand.map(c=>c.id));for(const id of p2)await page.locator(`[data-mulligan="${id}"]`).tap();await page.locator('#exchange').tap();
 assert.equal(await run(()=>phase),'ready');assert.equal(await page.locator('#setup').isVisible(),false);
 for(const p of ['p1','p2'])assert.deepEqual(await page.evaluate(p=>[state[p].hand.length,state[p].life.length,state[p].main.length,new Set(Object.values(state[p]).flat().map(c=>c.id)).size,state[p].life.every(c=>!c.faceUp)],p),[7,7,46,60,true]);
 assert.match(await page.locator('[data-player="p1"][data-zone="main"] .count').innerText(),/46枚/);
 await page.selectOption('#visibility','both');assert.equal(await page.locator('[data-zone="hand"] .card:not(.back)').count(),14);
 await run(()=>{const land=Object.values(state.p1).flat().find(c=>c.type==='土地');const normal=Object.values(state.p1).flat().find(c=>c.type==='通常');move(land.id,'p1','hand');move(normal.id,'p1','hand');land.faceUp=true;normal.faceUp=true;render();});
 const nonland=await run(()=>state.p1.hand.find(c=>c.type==='通常').id);await page.locator(`[data-player="p1"][data-zone="hand"] [data-card="${nonland}"]`).tap();await page.locator('#to-mana').tap();assert.equal(await run(()=>state.p1.energy.length),0);assert.match(await page.locator('#notice').innerText(),/土地/);
 await page.selectOption('#destination','p2/energy');await page.locator('#move').tap();assert.equal(await run(()=>state.p2.energy.length),0);
 const land=await run(()=>state.p1.hand.find(c=>c.type==='土地').id);await page.locator(`[data-player="p1"][data-zone="hand"] [data-card="${land}"]`).tap();await page.locator('#to-mana').tap();await page.locator('#rotate').tap();assert.match(await page.locator('[data-player="p1"][data-zone="energy"] .count').innerText(),/縦 0 \/ 横 1/);await page.locator('[data-ready="p1"]').tap();assert.equal(await run(()=>state.p1.energy[0].rest),false);
 assert(await run(()=>document.documentElement.scrollWidth<=innerWidth));
 const before=await run(()=>JSON.stringify(state));page.once('dialog',d=>d.dismiss());await page.locator('#reset').tap();assert.equal(await run(()=>JSON.stringify(state)),before);
 page.once('dialog',d=>d.accept());await page.locator('#reset').tap();assert.equal(await run(()=>phase),'mulligan');assert.deepEqual(await run(()=>[mulligan.p1,mulligan.p2,selected]),['pending','pending',null]);
 await page.locator('#exchange').tap();await page.locator('#keep').tap();assert.equal(await run(()=>phase),'ready');
 await page.screenshot({path:process.env.SCREENSHOT_DIR?path.join(process.env.SCREENSHOT_DIR,'cardgame-mobile.png'):'/tmp/cardgame-mobile.png',fullPage:true});
 await page.setViewportSize({width:1280,height:1000});assert(await run(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:process.env.SCREENSHOT_DIR?path.join(process.env.SCREENSHOT_DIR,'cardgame-desktop.png'):'/tmp/cardgame-desktop.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS Chromium: 390px touch multi-select, partial/all/zero exchange, keep, 7/7/46 counts and 60 unique IDs, setup lock, visibility, land-only moves, mana counts, reset, PC/mobile width, no page errors.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
