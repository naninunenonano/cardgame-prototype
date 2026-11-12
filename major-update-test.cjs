'use strict';
const assert=require('node:assert/strict');
const Game=require('./game');
const Decks=require('./decks');
const Cards=require('./cards');
const Mana=require('./mana');
const Packs=require('./packs');

function ok(r){assert(r.ok,r.message);}
function ready(p1='redBeginner',p2='blueBeginner',records=[]){
 let now=0;
 const g=Game.create({decks:{p1,p2},records,clock:()=>now,random:()=>0.42});
 ok(g.completeMulligan('p1',[],true));ok(g.completeMulligan('p2',[],true));
 return {g,advance:()=>{now+=400;ok(g.advance());}};
}
function stack(g,p,color,n){
 for(let i=0;i<n;i++)g.state[p].stacks.push(g.card(color+'スタック','スタック',color,null,false,p));
}
function advanceToMain(g,advance){
 assert.equal(g.turn.step,'charge');ok(g.skipCharge());
 assert.equal(g.turn.step,'stackCharge');advance();
 assert.equal(g.turn.step,'levelUp');advance();
 assert.equal(g.turn.step,'main1');
}
function add(g,key,p,z){
 const c=g.fromDefinition(key,p);ok(g.addCard(p,z,c));
 return c;
}
function pass(g){
 for(let i=0;i<100&&g.operation?.kind==='response';i++)ok(g.passResponse());
}
function play(g,id,slot){
 ok(g.beginPayment(id));if(slot)ok(g.chooseSlot(slot));ok(g.confirmPayment());pass(g);
}
function choose(g,id){ok(g.resolveExpansion(id));pass(g);}
function test(name,fn){fn();console.log('ok '+name);}

test('deck composition, migrated rarity and pack rates',()=>{
 const red=Decks.preset('redBeginner');
 assert.deepEqual(['main','sideboard','shields'].map(section=>red[section].reduce((n,e)=>n+e.count,0)),[40,10,5]);
 assert.deepEqual(red.stacks,Array(15).fill('赤'));
 assert.deepEqual(Decks.preset('blueBeginner').stacks,Array(15).fill('青'));
 assert.deepEqual(Decks.validate({...red,stacks:[...Array(10).fill('青'),...Array(5).fill('赤')]}),[]);
 assert(Decks.validate({...red,stacks:Array(15).fill('無色')}).length);
 assert.equal(Cards.cards.almar.rarity,'UR');
 assert.equal(Decks.limit(Cards.cards.gl1),4);
 for(const [slot,oldUR,newSR] of [['normal',5,9],['rare',10,24],['super',13,86]]){
  assert.equal(Packs.rates[slot].UR,oldUR);
  assert.equal(Packs.rates[slot].SR,newSR);
  assert.equal(Object.values(Packs.rates[slot]).reduce((a,b)=>a+b),100);
 }
});

test('life starts at 20 and healing can exceed 30',()=>{
 const {g}=ready();
 assert.deepEqual(g.life,{p1:20,p2:20});
 ok(g.healLife('p1',15));assert.equal(g.life.p1,35);
});

test('partial main-phase draw and actual normal-draw defeat',()=>{
 const {g,advance}=ready();
 advanceToMain(g,advance);
 g.state.p1.main.splice(1);const before=g.state.p1.hand.length;
 ok(g.draw('p1',3));assert.equal(g.state.p1.hand.length,before+1);assert.equal(g.result,null);
 ok(g.draw('p1',1));assert.equal(g.result,null);
 for(let i=0;i<4;i++)advance();
 assert.equal(g.result.winner,'p2');
 assert.match(g.result.reason,/ドローフェイズ.*山札切れ/);
 assert.equal(g.life.p1,20);
});

test('effect draw during draw phase also defeats the drawing player',()=>{
 const {g,advance}=ready();
 advanceToMain(g,advance);
 g.state.p2.main.length=0;
 // An effect requests a draw for the player other than the turn player.
 g.turn.step='draw';
 ok(g.draw('p2',2));
 assert.equal(g.result.winner,'p1');
 assert.equal(g.life.p2,20);
});

test('stack phase and one same-color growth per turn',()=>{
 const {g,advance}=ready();
 assert.equal(g.character('p1').level,0);
 assert.equal(g.state.p1.stackDeck.length,15);
 assert(!g.beginGrowth('p1').ok);
 g.state.p1.stackDeck[0].color='青';
 ok(g.skipCharge());advance();
 assert.equal(g.state.p1.stackDeck.length,14);
 assert(!g.beginGrowth('p1').ok);
 stack(g,'p1','赤',3);
 const hand=g.state.p1.hand.length;
 ok(g.beginGrowth('p1'));
 assert.equal(g.character('p1').level,1);
 assert.equal(g.state.p1.hand.length,hand+1);
 assert.equal(g.state.p1.stacks.filter(c=>c.color==='赤').length,2);
 assert(!g.beginGrowth('p1').ok);
 assert.equal(g.state.p1.stackDeck.length,14);
});

test('symbols and level 4 give no common discount; 5000VT keeps its own',()=>{
 const {g,advance}=ready();advanceToMain(g,advance);
 const c=add(g,'nn3','p1','signi-1');c.symbols={青:10,赤:10};
 g.character('p1').level=4;
 const rage=g.fromDefinition('rn16','p1');
 assert.deepEqual(g.effectiveCost(rage,'p1'),Mana.cost(1,{赤:2}));
 const vt=g.fromDefinition('bo1','p1');
 assert.deepEqual(g.effectiveCost(vt,'p1'),Mana.cost(6,{青:1}));
});

test('SA at entry makes stacks; Crimson Wyvern gains SA too late',()=>{
 const {g,advance}=ready();advanceToMain(g,advance);
 g.character('p1').level=2;
 const before=g.state.p1.stacks.length,hand=g.state.p1.hand.length;
 add(g,'rn15','p1','signi-1');
 assert.equal(g.state.p1.stacks.length,before+1);
 assert.equal(g.state.p1.hand.length,hand+1);
 assert.equal(g.life.p2,19);
 if(g.operation?.kind==='shieldWindow')ok(g.resolveShield());
 add(g,'rs1','p1','signi-2');
 assert.equal(g.state.p1.stacks.length,before+1);
 assert(g.state.p1.stacks.at(-1).token);
});

test('commander Lv3 grants temporary SA and Lv4 pays exactly four stacks',()=>{
 const {g,advance}=ready();advanceToMain(g,advance);
 const commander=g.character('p1'),unit=add(g,'nn3','p1','signi-1');
 commander.level=3;
 ok(g.beginCharacterAbility('p1'));choose(g,unit.id);
 assert(g.hasSpeed(unit,'p1'));assert.equal(g.state.p1.stacks.length,0);assert(!g.beginCharacterAbility('p1').ok);
 for(let i=0;i<3;i++)advance();
 assert(!g.hasSpeed(unit,'p1'));
 advance();advanceToMain(g,advance);
 commander.level=4;stack(g,'p1','青',3);
 const hand=add(g,'rs2','p1','hand');
 ok(g.beginCharacterAbility('p1'));
 assert.equal(g.state.p1.stacks.length,0);
 ok(g.resolveStarter(hand.id));ok(g.chooseSlot('signi-2'));ok(g.confirmSideFree());pass(g);
 assert.equal(g.locate(hand.id).z,'signi-2');
 assert.equal(g.state.p1.stacks.length,1);
});

test('Next Charger requires Lv2 and tracks each physical copy independently',()=>{
 const {g,advance}=ready();advanceToMain(g,advance);
 const copies=g.state.p1.extra.filter(c=>c.key==='sbrn1');
 assert(!g.beginPayment(copies[0].id).ok);
 g.character('p1').level=2;
 const before=g.state.p1.stacks.length;
 play(g,copies[0].id);assert.equal(g.operation.choice,'nextCharger');
 choose(g,'done');assert.equal(g.state.p1.stacks.length,before+1);
 assert(copies[0].used);assert(!copies[1].used);
 assert(!g.beginPayment(copies[1].id).ok);
 for(let i=0;i<4;i++)advance();
 advanceToMain(g,advance);
 assert(!g.beginPayment(copies[0].id).ok);
 play(g,copies[1].id);choose(g,'exchange');
 const hand=g.state.p1.hand.map(c=>c.id);
 ok(g.reorderCard(hand[0],1));ok(g.confirmOrder());pass(g);
 assert.equal(g.state.p1.hand.length,hand.length);
 assert.deepEqual(g.state.p1.main.slice(-hand.length).map(c=>c.id),[hand[1],hand[0],...hand.slice(2)]);
});

test('Twin Horn makes two attacks and Gaiburn destroys itself before burning',()=>{
 const {g,advance}=ready();advanceToMain(g,advance);
 g.state.p2.shields.length=0;
 g.character('p1').level=3;
 stack(g,'p1','赤',3);
 const unit=add(g,'nn5','p1','signi-1');unit.sick=false;
 const horn=g.state.p1.extra.find(c=>c.key==='sbrs2');
 play(g,horn.id);choose(g,unit.id);
 advance();
 ok(g.declareAttack(unit.id,'body'));ok(g.resolveAttack(null));pass(g);
 assert.equal(g.life.p2,17);assert.equal(unit.rest,false);
 ok(g.declareAttack(unit.id,'body'));ok(g.resolveAttack(null));pass(g);
 assert.equal(g.life.p2,11);
 assert.equal(g.locate(horn.id).z,'extra');assert(horn.used);
 assert.equal(g.state.p1.stacks.filter(c=>c.token).length,1);
 const log=g.battleLog();
 assert(log.find(e=>e.kind==='unitDestroyed'&&e.card.instanceId===horn.id).number<
  log.findLast(e=>e.kind==='life'&&e.targetPlayer==='p2').number);
});

test('unavailable cards stay out of construction and cannot be used',()=>{
 const {g,advance}=ready();advanceToMain(g,advance);
 const deck=Decks.preset('redBeginner');
 assert(Decks.validate({...deck,main:[{key:'sbru1',count:1},...deck.main]}).some(e=>e.includes('モルトNEXT')));
 assert.equal(Decks.canonicalKey('sbnl1'),'sbnl4');
 const legacy={sideboard:[{key:'sbnl4',count:1},{key:'sbnl1',count:1}]};
 const migrated=Decks.migrateDeck(legacy);
 assert.deepEqual(migrated.sideboard,[{key:'sbnl4',count:1}]);
 assert.deepEqual(Decks.migrateDeck(migrated),migrated);
 assert.equal(Decks.canonicalKey('sbru1-2'),'sbru4');
 const disabled=g.fromDefinition('sbru1','p1');
 assert(!g.addCard('p1','hand',disabled).ok);
 assert(Cards.awakened.sbnl1.trample);
 assert.equal(Cards.cards.sbnl4.revolutionMinimumAttack,6);
});

test('Batrai Blade and Tower reveal, transform, and retain the same physical side card',()=>{
 const {g,advance}=ready();advanceToMain(g,advance);
 g.state.p2.shields.length=0;
 g.character('p1').level=3;stack(g,'p1','赤',3);
 const attacker=add(g,'rs2','p1','signi-1');
 const blade=g.state.p1.extra.find(c=>c.key==='sbru2');
 play(g,blade.id);choose(g,attacker.id);
 const reveal=add(g,'rn15','p1','hand');
 ok(g.manualMove(reveal.id,'p1','main'));
 advance();ok(g.declareAttack(attacker.id,'body'));pass(g);
 assert.equal(g.operation.kind,'sideFreePlace');assert.equal(g.operation.id,reveal.id);
 ok(g.chooseSlot('signi-2'));ok(g.confirmSideFree());pass(g);
 ok(g.resolveAttack(null));pass(g);
 ok(g.declareAttack(reveal.id,'body'));ok(g.resolveAttack(null));pass(g);
 advance();advance();
 assert.equal(blade.awakened,'sbru2-2');
 advance();advanceToMain(g,advance);
 add(g,'rn15','p1','signi-1');add(g,'rn16','p1','signi-3');add(g,'rs2','p1','signi-4');
 assert.equal(blade.awakened,'sbru2-3');assert(blade.used);
 assert.equal(g.attack(blade,'p1'),8);assert.equal(blade.health,8);assert(!g.hasSpeed(blade,'p1'));
});

test('Gaiou Burn sets combat health to 1 and transforms after the second win',()=>{
 const {g,advance}=ready();advanceToMain(g,advance);
 g.state.p2.shields.length=0;
 g.character('p1').level=3;stack(g,'p1','赤',3);
 const host=add(g,'nn5','p1','signi-1');host.sick=false;
 const first=add(g,'nn3','p2','signi-1');first.rest=true;
 const second=add(g,'nn3','p2','signi-2');second.rest=true;
 const third=add(g,'nn3','p2','signi-3');third.rest=true;
 const ally=add(g,'nn5','p1','signi-2');ally.sick=false;
 const sword=g.state.p1.extra.find(c=>c.key==='sbru3');
 play(g,sword.id);choose(g,host.id);choose(g,first.id);
 assert.equal(host.health,1);assert.equal(g.attack(host),6);assert.equal(g.locate(first.id).z,'trash');
 advance();ok(g.declareAttack(ally.id,second.id));pass(g);
 assert.equal(sword.awakened,'sbru3-2');assert.equal(g.attack(host),3);
 ok(g.resolveStarter(third.id));pass(g);assert.equal(g.locate(third.id).z,'trash');
});

test('Greasy Horn gives Mach Fighter and changes at turn end when its host is tapped',()=>{
 const {g,advance}=ready();advanceToMain(g,advance);
 g.state.p2.shields.length=0;
 g.character('p1').level=3;
 const host=add(g,'nn5','p1','signi-1');
 const target=add(g,'nn3','p2','signi-1');
 const horn=g.state.p1.extra.find(c=>c.key==='sbrr2');
 play(g,horn.id);choose(g,host.id);
 advance();
 assert(g.attackTargets(host.id).some(c=>c.id===target.id));
 assert(!g.attackTargets(host.id).some(c=>c.id==='body'));
 ok(g.declareAttack(host.id,target.id));pass(g);
 advance();advance();
 assert.equal(horn.awakened,'sbrr2-2');
});

test('Proto Gigaheart prevents opponent spell bounce and awakens once',()=>{
 const {g,advance}=ready();advanceToMain(g,advance);
 g.character('p1').level=3;
 const host=add(g,'nn5','p1','signi-1');
 const giga=g.state.p1.extra.find(c=>c.key==='sbrr1');
 play(g,giga.id);choose(g,host.id);
 const gate=add(g,'bn1','p2','hand');
 const {fund}=require('./test-fixtures.cjs');
 fund(g,'p2',3,'青');
 advance();advance();advance();ok(g.soloNextPlayer('p2'));advanceToMain(g,advance);
 ok(g.beginPayment(gate.id));ok(g.confirmPayment());pass(g);
 ok(g.resolveStarter(host.id));pass(g);
 assert.equal(g.locate(host.id).z,'signi-1');assert.equal(giga.awakened,'sbrr1-2');
 assert(g.hasSpeed(giga,'p1'));
});

test('new damage shields generate stacks and search the normal deck',()=>{
 const {g,advance}=ready();advanceToMain(g,advance);
 const reserve=g.state.p1.shields.find(c=>c.key==='shnr7'),memory=g.state.p1.shields.find(c=>c.key==='shnr9');
 ok(g.loseLife('p1',1));
 ok(g.resolveShield(reserve.id));pass(g);
 assert.equal(g.state.p1.stacks.filter(c=>c.token&&c.color==='赤').length,2);
 ok(g.loseLife('p1',1));ok(g.resolveShield(memory.id));pass(g);
 const wanted=g.state.p1.main.at(-1);
 choose(g,wanted.id);assert.equal(g.locate(wanted.id).z,'hand');
});

test('Force Release consumes any five stacks and can destroy an additional creature',()=>{
 const {g,advance}=ready('blueBeginner','redBeginner');advanceToMain(g,advance);
 stack(g,'p2','青',2);stack(g,'p2','赤',3);
 const attack=add(g,'nn5','p1','signi-1'),additional=add(g,'nn3','p1','signi-2');
 attack.sick=false;advance();ok(g.declareAttack(attack.id,'body'));
 const shield=g.state.p2.shields.find(c=>c.key==='shnr8');
 ok(g.resolveShield(shield.id));pass(g);
 choose(g,additional.id);
 assert.equal(g.locate(attack.id).z,'trash');assert.equal(g.locate(additional.id).z,'trash');
 assert.equal(g.life.p2,20);assert.equal(g.state.p2.stacks.length,0);
});

test('combined parallel card uses one selected face and inherits the attack',()=>{
 const definition=Cards.cards.sbnl4;
 const unavailable=definition.unavailable;
 // Test payment fixtures only. Production has no confirmed payment for this card.
 delete definition.unavailable;definition.stackCost=Mana.cost(0,{赤:1});
 try{
  for(const face of ['revolution','invasion']){
   const preset=Decks.preset('redBeginner');
   const deck={...preset,id:'parallel-test',sideboard:[{key:'redcaptain',count:1},{key:'sbnl1',count:1}]};
   const {g,advance}=ready('parallel-test','blueBeginner',[deck]);
   advanceToMain(g,advance);g.character('p1').level=3;
   g.state.p1.hand.length=0;g.state.p2.shields.length=0;
   const unit=add(g,'nn9','p1','signi-1');unit.attack=6;unit.sick=false;
   const card=g.state.p1.extra.find(c=>c.key==='sbnl4');
   advance();ok(g.declareAttack(unit.id,'body'));pass(g);
   assert.deepEqual(g.expansionCandidates().map(c=>c.id),['invasion','revolution','done']);
   choose(g,face);assert(card.used);assert.equal(g.state.p1.stacks.length,0);
   assert.equal(g.operation.kind,'combat');assert.equal(g.operation.id,card.id);
   ok(g.resolveAttack(null));pass(g);
   assert.equal(g.life.p2,face==='revolution'?7:14);
   assert.equal(g.locate(unit.id)?.z,face==='revolution'?'exile':undefined);
  }
 }finally{definition.unavailable=unavailable;delete definition.stackCost;}
});

test('commander Lv4 reveal requires actual attack damage and fires once per turn',()=>{
 const {g,advance}=ready();advanceToMain(g,advance);
 g.state.p2.shields.length=0;g.character('p1').level=4;
 const first=add(g,'nn5','p1','signi-1'),second=add(g,'nn5','p1','signi-2');
 first.sick=second.sick=false;
 const card=add(g,'nn3','p1','hand');ok(g.manualMove(card.id,'p1','main'));
 ok(g.loseLife('p2',1,'カード効果'));assert.equal(g.operation,null);
 advance();ok(g.declareAttack(first.id,'body'));ok(g.resolveAttack(null));pass(g);
 assert.equal(g.operation.choice,'commanderReveal');choose(g,card.id);
 ok(g.chooseSlot('signi-3'));ok(g.confirmSideFree());pass(g);
 assert(g.hasSpeed(card,'p1'));
 ok(g.declareAttack(second.id,'body'));ok(g.resolveAttack(null));pass(g);
 assert.equal(g.operation,null);
 assert.equal(g.battleLog().filter(e=>e.kind==='reveal').length,1);
});
