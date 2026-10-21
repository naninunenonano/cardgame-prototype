const {chromium}=require('playwright');const assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-gpu']}: {})});
 try {
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file://'+path.join(__dirname,'index.html'));
 assert.equal(await page.locator('#next-turn').isDisabled(),true);await page.locator('#keep').tap();await page.locator('#keep').tap();
 assert.match(await page.locator('#turn-panel').innerText(),/先攻第1ターン：ドローなし/);assert.equal(await page.evaluate(()=>state.p1.hand.length),7);
 const fixture=await page.evaluate(()=>{
  const own=Object.values(state.p1).flat();const lands=own.filter(c=>c.type==='土地').slice(0,2);const unit=own.find(c=>c.type==='通常'&&ManaEngine.total(c.cost)===1);const blocker=own.find(c=>c.type==='通常'&&ManaEngine.total(c.cost)===2);
  for(const c of [...lands,unit]){move(c.id,'p1','hand');c.faceUp=true;}
  move(blocker.id,'p1','signi-2');blocker.faceUp=true;
  const opponent=createCard('相手場の回復対象外','通常','赤');opponent.rest=true;state.p2['signi-1'].push(opponent);
  const otherLand=createCard('相手土地','土地','赤');otherLand.rest=true;state.p2.energy.push(otherLand);
  state.p1.life[0].rest=true;state.p1.hand.find(c=>c.id!==unit.id&&c.type==='通常').rest=true;
  render();return {lands:lands.map(c=>c.id),unit:unit.id,blocker:blocker.id,opponent:JSON.stringify(state.p2),shield:state.p1.life[0].id};
 });
 const tapCard=async(id,p='p1',z='hand')=>page.locator(`[data-player="${p}"][data-zone="${z}"] [data-card="${id}"]`).tap();
 await tapCard(fixture.lands[0]);await page.locator('#to-mana').tap();assert.match(await page.locator('.turn-land').innerText(),/配置済み/);
 await page.selectOption('#destination','p1/hand');await page.locator('#move').tap();assert.equal(await page.locator('#to-mana').isDisabled(),true);assert.match(await page.locator('.selected-status').innerText(),/このターンは土地を配置済み/);
 await tapCard(fixture.lands[1]);assert.equal(await page.locator('#to-mana').isDisabled(),true);
 // 補助移動は回数を戻さず、任意の検討ができる。
 assert.match(await page.locator('#move').innerText(),/ルール外の補助/);await page.selectOption('#destination','p1/energy');await page.locator('#move').tap();assert.equal(await page.evaluate(()=>turn.landsPlaced),1);
 await tapCard(fixture.unit);await page.locator('#play').tap();await page.locator('[data-pay-slot="signi-1"]').tap();await page.locator('#confirm-payment').tap();
 await page.locator('#attack').tap();assert.equal(await page.locator('#attack').isDisabled(),true);assert.equal(await page.locator('#block').isDisabled(),true);assert.equal(await page.locator('[data-player="p1"][data-zone="signi-1"] .mana-state.spent').count(),1);
 await tapCard(fixture.blocker,'p1','signi-2');await page.locator('#block').tap();assert.equal(await page.locator('#attack').isDisabled(),true);
 await page.selectOption('#active','p2');
 const handBefore=await page.evaluate(()=>state.p1.hand.length);
 // 同じボタンのイベントを連続送信。次の自分ターンは1回だけ開始する。
 await page.evaluate(()=>{const button=document.querySelector('#next-turn');button.click();button.click();document.querySelector('#next-turn').click();});
 assert.equal(await page.evaluate(()=>turn.number),2);assert.equal(await page.evaluate(()=>state.p1.hand.length),handBefore+1);assert.equal(await page.locator('#active').inputValue(),'p2');assert.match(await page.locator('#turn-panel').innerText(),/自分（プレイヤー1）の第2ターン/);
 assert.equal(await page.evaluate(()=>turn.landsPlaced),0);assert.equal(await page.evaluate(()=>state.p1['signi-1'][0].rest||state.p1['signi-2'][0].rest||state.p1.energy.some(c=>c.rest)),false);assert.equal(await page.evaluate(()=>JSON.stringify(state.p2)),fixture.opponent);assert.equal(await page.evaluate(id=>state.p1.life.find(c=>c.id===id).rest,fixture.shield),true);
 assert.match(await page.locator('#turn-panel').innerText(),/未使用土地から出せるマナ：合計1点/);
 await page.selectOption('#active','p1');await tapCard(fixture.lands[0]);assert.equal(await page.locator('#to-mana').isEnabled(),true);await page.locator('#to-mana').tap();assert.equal(await page.evaluate(()=>turn.landsPlaced),1);
 await page.waitForFunction(()=>!turn.busy);const nextHand=await page.evaluate(()=>state.p1.hand.length);await page.locator('#next-turn').tap();assert.equal(await page.evaluate(()=>turn.number),3);assert.equal(await page.evaluate(()=>state.p1.hand.length),nextHand+1);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 page.once('dialog',d=>d.accept());await page.locator('#reset').tap();assert.equal(await page.evaluate(()=>turn.number),0);assert.equal(await page.evaluate(()=>turn.busy),false);assert.equal(await page.locator('#next-turn').isDisabled(),true);await page.locator('#keep').tap();await page.locator('#keep').tap();assert.equal(await page.evaluate(()=>turn.number),1);assert.equal(await page.evaluate(()=>state.p1.hand.length),7);assert.equal(await page.evaluate(()=>turn.landsPlaced),0);
 assert.deepEqual(errors,[]);await page.screenshot({path:'/tmp/cardgame-turn-mobile.png',fullPage:true});
 console.log('PASS turn Chromium 390px touch: first/no draw, land once/return/manual distinction, paid unit attack/block and used labels, next own turn without switching, double-click lock, exact recovery/opponent unchanged, mana update, turn3 draw, land availability, reset and page width.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
