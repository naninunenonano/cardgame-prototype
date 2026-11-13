'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const {saveBrowserTestDeck,growInBrowser}=require('./test-fixtures.cjs');

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [390,1280]){
   const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.addInitScript(()=>localStorage.setItem('cardgame.battle-motion','off'));
   await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href);
   await saveBrowserTestDeck(page);
   await page.evaluate(()=>{
    const gain=collection.gain([{key:'sbnr4'}]);
    if(!gain.ok)throw Error(gain.message);
    const deck=collection.store.list()[0];
    deck.sideboard.push({key:'sbnr4',count:1});
    const draft=collection.store.save({...deck,id:'blocked-charger'});
    if(!draft.ok)throw Error(draft.message);
    refreshDeckChoices();render();
   });
   await page.locator('#self-deck').selectOption('blocked-charger');
   await page.locator('#start-solo').click();
   assert.equal(await page.evaluate(()=>modeChosen),false);
   await page.locator('#edit-decks').click();
   await page.locator('#editor-source').selectOption('blocked-charger');
   await page.locator('[data-deck-tab="sideboard"]').click();
   assert.match(await page.locator('#editor-list').innerText(),/ドローチャージャー[\s\S]*使用不可/);
   assert.equal(await page.locator('[data-deck-plus="sbnr4"]').count(),0);
   await page.locator('#editor-close').click();
   await page.locator('#self-deck').selectOption('normal-red');
   await page.locator('#start-solo').click();
   await page.locator('#keep').click();
   await page.locator('#keep').click();
   await growInBrowser(page);
   await growInBrowser(page);
   assert.equal(await page.evaluate(()=>Game.character('p1').level),2);
   assert.equal(await page.evaluate(()=>Game.operation),null);
   assert.deepEqual(errors,[]);
   await page.close();
  }
  console.log('PASS unavailable Draw Charger cannot be added, loaded into battle or offered at Lv2');
  console.log('HOLD Draw Charger Lv2 offer and resolution | ドローチャージャー (sbnr4) — 色付きストック支払い条件が未確定。');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
