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
  await page.locator('[data-starter-color="red"]').tap();
  await page.locator('#start-solo').tap();
  await page.locator('#keep').tap();
  await page.locator('#keep').tap();
  assert.deepEqual(await page.evaluate(()=>Game.life),{p1:20,p2:20});
  assert.equal(await page.evaluate(()=>Game.state.p1.stackDeck.length),15);
  assert.match(await page.locator('#turn-panel').innerText(),/マナチャージ/);
  const advance=async()=>{await page.locator('#next-phase').tap();};
  await advance();
  assert.match(await page.locator('#turn-panel').innerText(),/スタックチャージ/);
  await advance();
  assert.match(await page.locator('#turn-panel').innerText(),/レベルアップ/);
  assert.match(await page.locator('.self .field-extras').innerText(),/スタック 赤1/);
  await page.locator('[data-grow="p1"]').tap();
  assert.equal(await page.evaluate(()=>Game.character('p1').level),1);
  assert.equal(await page.evaluate(()=>Game.state.p1.stacks.length),0);
  assert(await page.locator('[data-grow="p1"]').isDisabled());
  await advance();
  assert.equal(await page.evaluate(()=>Game.turn.step),'main1');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.setViewportSize({width:1280,height:1000});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);
  console.log('ok mobile and desktop opening, phase controls, stack display and growth');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
