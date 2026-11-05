'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const server=http.createServer((req,res)=>{
 try{
  const name=new URL(req.url,'http://localhost').pathname;
  const f=path.join(__dirname,name==='/'?'index.html':name);
  res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html');
  res.end(fs.readFileSync(f));
 }catch{res.writeHead(404).end();}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [390,1280]){
   const page=await browser.newPage({viewport:{width,height:900}});
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{Math.random=()=>.4;});
   await page.goto('http://127.0.0.1:'+server.address().port);
   await page.locator('[data-starter-color="red"]').click();
   await page.locator('#edit-decks').click();
   assert.equal(await page.locator('[data-evolution-level]').count(),4);
   assert.match(await page.locator('#editor-evolution').innerText(),/基本進化系列（UR）/);
   await page.locator('#editor-close').click();
   await page.locator('#open-ranked').click();
   assert.match(await page.locator('#ranked-progress').innerText(),/未設定/);
   assert.equal(await page.locator('#ranked-record').innerText(),'0勝 0敗');
   assert(await page.locator('#ranked-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
   await page.locator('#start-ranked').click();
   await page.locator('#keep').click();
   await page.waitForFunction(()=>Game.status==='ready');
   assert.match(await page.locator('#current-mode').innerText(),/ランク戦/);
   assert.equal(await page.evaluate(()=>Game.character('p1').level),0);
   await page.locator('#surrender').click();
   await page.locator('#confirm-surrender').click();
   await page.waitForFunction(()=>collection.ranked().losses===1);
   await page.reload();
   await page.locator('#open-ranked').click();
   assert.equal(await page.locator('#ranked-record').innerText(),'0勝 1敗');
   assert.deepEqual(errors,[]);
   await page.close();
   console.log('PASS ranked start, surrender, reload, and four evolution selectors at '+width+'px');
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
