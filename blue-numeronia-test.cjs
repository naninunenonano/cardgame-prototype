'use strict';
const assert=require('node:assert/strict');
const {create}=require('./game');
const Mana=require('./mana');
const {skipCharge}=require('./test-fixtures.cjs');
const p='p1',q='p2';
const g=create({clock:()=>1000,random:()=>0.42});
assert(g.completeMulligan(p,[],true).ok);
assert(g.completeMulligan(q,[],true).ok);
skipCharge(g);
const u=g.fromDefinition('br6',q);
assert.deepEqual([u.color,u.rarity,u.cost,u.attack,u.maxHealth],['青','R',Mana.cost(1,{青:1}),1,3]);
assert(g.addCard(q,'signi-1',u).ok);
const attacker=g.fromDefinition('rn15',p);
assert(g.addCard(p,'signi-1',attacker).ok);
g.turn.step='attack';
assert.match(g.attackError(attacker.id),/封魔ウアラク/);
u.abilitiesDisabled=true;
assert.equal(g.attackError(attacker.id),'');
u.abilitiesDisabled=false;
g.turn.sequence++;
assert.equal(g.attackError(attacker.id),'');
g.turn.step='main1';
assert(g.addCard(p,'signi-2',g.fromDefinition('br6',p)).ok);
const ally=g.fromDefinition('rn15',p);
assert(g.addCard(p,'signi-3',ally).ok);
g.turn.step='attack';
assert.match(g.attackError(ally.id),/封魔ウアラク/);
g.turn.step='main1';
const otherUnit=g.fromDefinition('nn3',p);
assert(g.addCard(p,'signi-4',otherUnit).ok);
g.turn.step='attack';
assert.match(g.attackError(otherUnit.id),/召喚酔い/);
console.log('PASS 封魔ウアラクのカード仕様、両陣営のスピードアタッカー、能力無効化、次ターンと通常の召喚酔い');

const {test}=require('node:test');
const {decide}=require('./bot');
const {fund}=require('./test-fixtures.cjs');
function scenario(){
 const game=create({decks:{p1:'blueAdvanced',p2:'redBeginner'},clock:()=>1000,random:()=>.42,strictTargets:true});
 for(const owner of [p,q]){
  assert(game.completeMulligan(owner,[],true).ok);
  game.state[owner].hand=[];
  game.state[owner].shields=[];
 }
 skipCharge(game);
 return game;
}
function add(game,key,zone,owner=p){
 const card=game.fromDefinition(key,owner);
 game.state[owner][zone].push(card);
 return card;
}
function ok(result){assert(result.ok,result.message);}
function mana(game){fund(game,p,10,'青');}
function stock(game){game.state[p].stacks.push(game.card('青ストック','ストック','青',null,false,p));}
function cast(game,key){
 const c=add(game,key,'hand');
 ok(game.beginPayment(c.id));
 ok(game.confirmPayment());
 while(game.operation?.kind==='response')ok(game.passResponse());
 return c;
}

test('エナジー・ゲートは2ドロー後にコスト7以下の登場を選べる',()=>{
 const game=scenario();
 mana(game);
 const eligible=add(game,'br6','hand'),tooExpensive=add(game,'bs1','hand');
 const spell=cast(game,'bs9');
 assert.equal(game.operation.choice,'energyEntry');
 assert(game.sideChoiceCandidates().includes(eligible));
 assert(!game.sideChoiceCandidates().includes(tooExpensive));
 ok(game.resolveSideChoice(eligible.id));
 ok(game.chooseSlot('signi-1'));
 ok(game.confirmSideFree());
 assert.equal(game.locate(eligible.id).z,'signi-1');
 assert.equal(game.locate(spell.id).z,'trash');
});

test('ダメージトリガーはシールドの後に1枚を公開し青ストック1個で使用',()=>{
 const game=scenario();
 game.state[p].main=[];
 for(let i=0;i<6;i++)add(game,'bs6','main');
 const shield=add(game,'shnr2','shields');
 shield.faceUp=false;
 const gate=add(game,'bs9','hand'),second=add(game,'bs9','hand');
 game.state[p].stacks=[];
 stock(game);
 ok(game.setLife(p,11));
 ok(game.loseLife(p,1));
 assert.equal(game.operation.kind,'shieldWindow');
 ok(game.resolveShield(shield.id));
 assert.equal(game.operation.choice,'damageTrigger');
 assert(game.sideChoiceCandidates().includes(second));
 ok(game.resolveSideChoice(gate.id));
 assert.equal(game.operation.choice,'damageTriggerCast');
 assert.equal(game.operation.shownCard.cardId,'bs6');
 ok(game.resolveSideChoice(gate.id));
 assert.equal(game.state[p].stacks.length,0);
 assert.equal(game.locate(gate.id).z,'trash');
 assert.equal(game.locate(second.id).z,'hand');
 assert.equal(game.operation,null);
});

test('ダメージトリガーは敗北時と色が違うときに使用しない',()=>{
 const defeat=scenario();
 stock(defeat);
 const gate=add(defeat,'bs9','hand');
 ok(defeat.loseLife(p,20));
 assert.equal(defeat.result.winner,q);
 assert.equal(defeat.locate(gate.id).z,'hand');
 assert.equal(defeat.operation,null);
 const game=scenario();
 game.state[p].main=[game.fromDefinition('rn15',p)];
 stock(game);
 const miss=add(game,'bs9','hand');
 ok(game.setLife(p,10));
 ok(game.loseLife(p,1));
 const available=game.state[p].stacks.length;
 ok(game.resolveSideChoice(miss.id));
 assert.equal(game.operation,null);
 assert.equal(game.locate(miss.id).z,'hand');
 assert.equal(game.state[p].stacks.length,available);
});

test('ドラヴィタでパンツァーを無償召喚し相手終了時に覚醒・トラッシュを振り分ける',()=>{
 const game=scenario();
 mana(game);
 const panzer=game.state[p].extra.find(c=>c.key==='sbbs3');
 assert(game.state[p].extra.some(c=>c.key==='almar_sbbu1'&&!c.unavailable));
 assert(game.state[p].extra.some(c=>c.key==='sbbu1'&&!c.unavailable));
 assert.equal(game.beginPayment(panzer.id).ok,false);
 const before=game.state[p].stacks.length;
 cast(game,'bs8');
 assert.equal(game.operation.choice,'psychicSummon');
 assert(game.sideChoiceCandidates().includes(panzer));
 ok(game.resolveSideChoice(panzer.id));
 ok(game.chooseSlot('signi-1'));
 ok(game.confirmSideFree());
 assert.equal(game.state[p].stacks.length,before);
 assert.equal(panzer.cannotBeAttacked,true);
 assert.equal(panzer.cannotAttack,true);
 assert(panzer.abilities.includes('ブロッカー'));
 const main=add(game,'br6','trash'),side=add(game,'almar_sbnr1','trash');
 game.state[p].main=game.state[p].main.slice(0,10);
 game.turn.player=q;
 game.turn.step='main2';
 game.turn.notBefore=0;
 ok(game.advance());
 assert.equal(panzer.awakened,'sbbs3-2');
 assert.deepEqual([panzer.cost.generic,panzer.attack,panzer.maxHealth],[10,5,5]);
 assert.equal(game.locate(main.id).z,'main');
 assert.equal(game.locate(side.id).z,'extra');
 ok(game.soloNextPlayer(p));
 assert.equal(game.operation.choice,'panzerSearch');
 ok(game.resolveSideChoice(main.id));
 assert.equal(game.locate(main.id).z,'hand');
});

test('10ターン目にBotはカオスナイトからヌメロニアを優先',()=>{
 const game=scenario(),chaos=game.state[p].extra.find(c=>c.key==='sbbs2');
 game.state[p].extra=game.state[p].extra.filter(c=>c!==chaos);
 game.state[p]['signi-1'].push(chaos);
 chaos.xyzMaterials=[game.fromDefinition('br6',p),game.fromDefinition('br6',p)];
 game.character(p).level=2;
 game.turn.counts[p]=10;
 const action=decide(game.observe(p));
 assert.deepEqual(action,{type:'xyzBegin',id:chaos.id,method:'ability'});
 for(let i=0;i<5;i++)ok(game.dispatch(decide(game.observe(p)),p));
 assert(game.fieldCards(p).some(c=>c.key==='sbno2'));
});
