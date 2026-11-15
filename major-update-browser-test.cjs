'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

(async()=>{
 const executablePath=process.env.CHROMIUM_PATH;
 const browser=await chromium.launch({headless:true,...(executablePath?{executablePath,args:['--no-sandbox','--disable-gpu']}:{})});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href);
  assert.equal(await page.locator('[data-starter-color]').count(),0);
  assert.deepEqual(await page.evaluate(()=>collection.store.list()),[]);
  assert(await page.locator('#pack-panel').isVisible());
  assert(await page.locator('#deck-setup-hint').isVisible());
  await page.locator('#start-solo').tap();
  assert(await page.locator('#deck-editor').isVisible());
  await page.locator('#deck-save').tap();
  assert.equal(await page.evaluate(()=>collection.store.list().length),1);
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#deck-delete').tap();
  assert.equal(await page.evaluate(()=>collection.store.list().length),0);
  assert(await page.locator('#deck-save').isEnabled());
  await page.locator('#editor-close').tap();
  await require('./test-fixtures.cjs').saveBrowserTestDeck(page,'red');
  await page.locator('#start-solo').tap();
  await page.locator('#keep').tap();
  await page.locator('#keep').tap();
  assert.deepEqual(await page.evaluate(()=>Game.life),{p1:20,p2:20});
  assert.equal(await page.evaluate(()=>Game.state.p1.stackDeck.length),15);
  assert.match(await page.locator('#turn-panel').innerText(),/マナチャージ/);
  const advance=async()=>{await page.locator('#next-phase').tap();};
  await advance();
  assert.match(await page.locator('#turn-panel').innerText(),/ストックチャージ/);
  await advance();
  assert.match(await page.locator('#turn-panel').innerText(),/レベルアップ/);
  assert.match(await page.locator('.self .field-extras').innerText(),/ストック 赤1/);
  await page.locator('[data-grow="p1"]').tap();
  assert.equal(await page.evaluate(()=>Game.character('p1').level),1);
  assert.equal(await page.evaluate(()=>Game.state.p1.stacks.length),0);
  await page.waitForFunction(()=>document.querySelector('[data-grow="p1"]')?.disabled);
  await advance();
  assert.equal(await page.evaluate(()=>Game.turn.step),'main1');
  const cards=await page.evaluate(()=>{
   const psychic=Game.fromDefinition('sbbo1','p1');
   Game.state.p1['signi-1'].push(psychic);
   for(let i=0;i<2;i++)Game.state.p1.stacks.push(Game.card('青ストック','ストック','青'));
   const previews=['bs6','bs7','bs8','almar_sbnr1'].map(key=>cardHTML(CardCatalog.cards[key],{full:true}));
   const sandbox=document.createElement('div');
   sandbox.innerHTML=previews.join('');
   return [...sandbox.children].map(card=>card.textContent);
  });
  for(const [i,name] of ['超次元ストラテジー・ホール','超次元バイス・ホール','超次元ドラヴィタ・ホール'].entries()){
   assert(cards[i].includes(name));
   assert.match(cards[i],/通常呪文・青/);
  }
  assert.match(cards[3],/チャージャー/);
  const before=await page.evaluate(()=>[Game.state.p1.hand.length,Game.state.p2.hand.length]);
  await page.locator('[data-character="p1"]').first().tap();
  const brain=page.locator('[data-blue-action="psychicBrainTouch"]');
  assert(await brain.isEnabled());
  await brain.tap();
  assert.deepEqual(await page.evaluate(()=>[Game.state.p1.hand.length,Game.state.p2.hand.length]),[before[0]+1,before[1]-1]);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.setViewportSize({width:1280,height:1000});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);
  console.log('ok mobile and desktop opening, phase controls, stack display and growth');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
