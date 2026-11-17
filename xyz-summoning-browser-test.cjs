'use strict';

const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const {saveBrowserTestDeck}=require('./test-fixtures.cjs');

(async()=>{
 const executablePath=process.env.CHROMIUM_PATH;
 const browser=await chromium.launch({headless:true,...(executablePath?{executablePath,args:['--no-sandbox']}:{})});
 try{
  for(const width of [390,1280]){
   const page=await browser.newPage({viewport:{width,height:844},isMobile:width===390,hasTouch:width===390});
   page.setDefaultTimeout(8000);
   const errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.addInitScript(()=>localStorage.setItem('cardgame.battle-motion','off'));
   await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href);
   await saveBrowserTestDeck(page);
   await page.evaluate(()=>{
    const deck=collection.store.get('normal-red');
    const xyz=['sbbr2','sbbs2','sbno2'];
    const gained=collection.gain(xyz.map(key=>({key})));
    if(!gained.ok)throw Error(gained.message);
    deck.sideboard=deck.sideboard.filter(entry=>CardCatalog.cards[entry.key].type==='キャラクター');
    deck.sideboard.push(...xyz.map(key=>({key,count:1})));
    const saved=collection.store.save(deck);
    if(!saved.ok||saved.errors.length)throw Error(saved.message||saved.errors.join('／'));
    refreshDeckChoices();
    render();
   });
   await page.locator('#start-solo').click();
   await page.locator('#keep').click();
   await page.locator('#keep').click();
   const ids=await page.evaluate(()=>{
    const p='p1',q='p2';
    Game.turn.player=p;
    Game.turn.step='main1';
    Game.turn.counts[p]=10;
    Game.character(p).level=2;
    Game.state[p].stacks.push(Game.card('青ストック','ストック','青',null,false,p));
    Game.state[p].shields=[];
    Game.state[p].hand=[];
    Game.state[q].hand=[];
    const add=(key,owner,zone)=>{
     const c=Game.fromDefinition(key,owner);
     Game.state[owner][zone].push(c);
     return c;
    };
    const side=key=>Game.state[p].extra.find(c=>c.key===key);
    const knight=side('sbbr2'),chaos=side('sbbs2'),nume=side('sbno2');
    const a=add('gn2',p,'signi-1'),b=add('gn2',p,'signi-2'),enemy=add('gn2',q,'signi-1');
    a.rest=true;
    render();
    return Object.fromEntries(Object.entries({knight,chaos,nume,a,b,enemy}).map(([key,c])=>[key,c.id]));
   });
   const openSide=async id=>{
    await page.locator('[data-list="p1/extra"]').click();
    await page.locator('#modal [data-card="'+id+'"]').click();
   };
   const pick=id=>page.locator('[data-xyz-select="'+id+'"]').click();
   const confirm=()=>page.locator('#xyz-confirm').click();
   const openField=id=>page.locator('#battle-arena [data-card="'+id+'"]').click();
   await openSide(ids.knight);
   assert.match(await page.locator('#card-action-preview').innerText(),/エクシーズ・クリーチャー.*?記載コストなし/s);
   assert.match(await page.locator('#card-action-preview').innerText(),/①.*素材を2枚取り除いて/);
   await page.locator('#xyz-normal').click();
   assert(await page.locator('#xyz-confirm').isDisabled());
   await pick(ids.a);await pick(ids.b);await confirm();
   assert.equal(await page.evaluate(id=>Game.locate(id).card.rest,ids.knight),true);
   await openField(ids.knight);
   await page.locator('#xyz-ability').click();
   await pick(ids.a);await pick(ids.b);await pick(ids.enemy);await confirm();
   await openSide(ids.chaos);
   await page.locator('#xyz-overlay').click();
   await pick(ids.knight);await confirm();
   await openField(ids.chaos);
   assert.match(await page.locator('#card-action-preview').innerText(),/②.*エクシーズ・クリーチャー1体/);
   await page.locator('#xyz-ability').click();
   await pick(ids.knight);await pick(ids.enemy);await pick(ids.nume);await confirm();
   assert.equal(await page.evaluate(id=>Game.locate(id).card.rest,ids.nume),true);
   const attacker=await page.evaluate(()=>{
    Game.turn.player='p2';Game.turn.step='attack';
    const c=Game.fromDefinition('gn2','p2');
    Game.state.p2['signi-2'].push(c);
    notify(Game.declareAttack(c.id,'body'));
    return c.id;
   });
   assert.match(await page.locator('#modal').innerText(),/攻撃を無効/);
   await pick(ids.chaos);await confirm();
   assert.equal(await page.evaluate(()=>Game.life.p1),20);
   assert.equal(await page.evaluate(id=>Game.locate(id).card.rest,attacker),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.deepEqual(errors,[]);
   await page.close();
   console.log('PASS '+width+'px XYZ summoning, overlay, numbered abilities and attack negation');
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
