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
   await page.addInitScript(()=>localStorage.setItem('cardgame.battle-motion','off'));await page.goto('http://127.0.0.1:'+server.address().port);
   await page.locator('[data-starter-color="red"]').click();
   await page.locator('#opponent-deck').selectOption('blueBeginner');
   await page.locator('#opponent-recipe').click();
   assert.match(await page.locator('#recipe-body').innerText(),/通常 40枚/);
   assert.match(await page.locator('#recipe-body').innerText(),/サイド 10枚/);
   assert.match(await page.locator('#recipe-body').innerText(),/シールド 4枚/);
   assert.equal(await page.locator('#recipe-body section').first().locator('button').count(),5);
   assert(await page.locator('#deck-recipe').evaluate(el=>el.scrollWidth<=el.clientWidth+1&&el.scrollHeight<=el.clientHeight+1));
   await page.locator('[data-recipe-card]').filter({hasText:'初級ゴーレム'}).click();
   assert.match(await page.locator('#recipe-detail-body').innerText(),/初級ゴーレム/);
   await page.locator('#recipe-detail-close').click();
   await page.locator('#recipe-close').click();
   await page.locator('#edit-decks').click();
   await page.locator('#editor-recipe').click();
   assert.match(await page.locator('#recipe-body').innerText(),/Lv4/);
   await page.locator('#recipe-close').click();
   await page.locator('#editor-close').click();
   assert.deepEqual(errors,[]);
   await page.close();
   console.log('PASS beginner and editor recipes, details and viewport fit at '+width+'px');
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
