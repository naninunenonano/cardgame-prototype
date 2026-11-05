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
   await page.goto('http://127.0.0.1:'+server.address().port);
   await page.evaluate(()=>{
    Game=GameRules.create({mode:'solo'});
    Game.completeMulligan('p1');
    Game.completeMulligan('p2');
    modeChosen=true;
    runner=makeRunner();
    render();
    motion.collect(Game,'p1',false);
    notify(Game.draw('p1',3));
   });
   await page.locator('[data-motion="draw"]').first().waitFor();
   assert.equal(await page.locator('[data-motion="draw"] strong').count(),0);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight));
   await page.keyboard.press('Escape');
   await page.locator('#battle-motion').waitFor({state:'hidden'});
   await page.evaluate(()=>{
    const unit=Game.fromDefinition('nn9','p1');
    Game.state.p1['signi-1'].push(unit);
    render();
    Game.destroyUnit(unit.id);
    notify({ok:true});
   });
   await page.locator('[data-motion="destroy"]').waitFor();
   assert.match(await page.locator('[data-motion="destroy"]').innerText(),/初級ゴーレム/);
   await page.locator('#battle-motion').waitFor({state:'hidden'});
   const mapped=await page.evaluate(()=>{
    const card={name:'初級ゴーレム',cardId:'nn9',type:'通常',attack:3,health:4};
    const ref={name:'呪文',type:'呪文',color:'青'};
    const events=[
     {kind:'manaPlaced',fromZone:'hand',card},
     {kind:'move',card,from:{player:'p1',zone:'trash'},to:{player:'p1',zone:'energy'}},
     {kind:'unitEntry',card,zone:'signi-1'},
     {kind:'bodyStrike',attacker:card,targetPlayer:'p2'},
     {kind:'combatDamage',blocked:true,after:{attacker:card,defender:card},damageToAttacker:3,damageToDefender:2},
     {kind:'unitHeal',card,beforeHealth:2,afterHealth:4},
     {kind:'cardUse',card:ref},
     {kind:'effect',source:card,effectKind:'tokens'},
     ...[1,2,3,4].map(level=>({kind:'growth',level,card:{...card,level},ability:'成長能力'})),
     {kind:'shieldDecision',used:false,card},
     {kind:'shieldDecision',used:true,card}
    ].map((event,i)=>({actor:'p1',number:i+1,...event}));
    const layer=document.createElement('div');
    const controller=BattleMotion.create(layer);
    return controller.collect({gameId:'fixture',journalCount:events.length,battleLog:()=>events},'p1',true)
     .map(e=>[e.kind,e.label||'',!!e.heal]);
   });
   assert.deepEqual(mapped.map(e=>e[0]),['mana','mana','summon','attack','attack','damage','damage','damage','spell','ability','growth','growth','growth','growth','shield']);
   assert.equal(mapped[4][1],'ブロック！');
   assert.equal(mapped[7][2],true);
   await page.locator('#battle-menu').click();
   await page.locator('#battle-motion-speed').selectOption('fast');
   await page.reload();
   assert.equal(await page.locator('#battle-motion-speed').inputValue(),'fast');
   await page.evaluate(()=>{
    motion.setSpeed('off');
    Game=GameRules.create({mode:'solo'});
    Game.completeMulligan('p1');
    Game.completeMulligan('p2');
    modeChosen=true;
    render();
    notify(Game.draw('p1',1));
   });
   assert(await page.locator('#battle-motion').isHidden());
   assert.deepEqual(errors,[]);
   await page.close();
   console.log('PASS battle motion draw, destroy, escape and settings at '+width+'px');
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
