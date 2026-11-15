'use strict';

const assert=require('node:assert/strict');
const Game=require('./game');
const Cards=require('./cards');
const Mana=require('./mana');
const {fund,growthFixture,skipCharge}=require('./test-fixtures.cjs');

const p='p1',q='p2';
function ok(result){assert(result.ok,result.message);}
function ready(){
 const g=Game.create({decks:{p1:'blueAdvanced',p2:'green'},clock:()=>1000,random:()=>0.42});
 ok(g.completeMulligan(p,[],true));
 ok(g.completeMulligan(q,[],true));
 skipCharge(g);
 g.state[p].shields=[];g.state[q].shields=[];
 return g;
}
function add(g,key,owner,zone,top=false){
 const c=g.fromDefinition(key,owner);
 g.state[owner][zone][top?'unshift':'push'](c);
 return c;
}
function stocks(g,owner,color,count){
 for(let i=0;i<count;i++)g.state[owner].stacks.push(g.card(color+'ストック','ストック',color,null,false,owner));
}
function play(g,c){
 ok(g.beginPayment(c.id));
 ok(g.confirmPayment());
 while(g.operation?.kind==='response')ok(g.passResponse());
}
function test(name,run){run();console.log('ok '+name);}

test('アルマーの成長と、全レベルにおける相手手札の廃棄',()=>{
 const g=ready();
 const c=g.character(p);
 for(let level=0;level<=4;level++){
  if(level){
   const hand=g.state[p].hand.length;
   ok(growthFixture(g,p));
   assert.equal(g.state[p].hand.length,hand+(level===1?1:0));
  }
  const before=g.state[p].stacks.length;
  ok(g.manualMove(g.state[q].hand[0].id,q,'trash'));
  assert.equal(g.state[p].stacks.length,before+1);
  if(level===4){
   assert.equal(g.operation.kind,'tokens');
   ok(g.placeToken('signi-1'));
   assert.equal(g.state[p]['signi-1'][0].key,'t2');
   ok(g.resolveOptional(false));
  }
 }
 assert.equal(c.level,4);
 const before=g.state[p].hand.length,opponent=g.state[q].hand.length;
 g.turn.step='main1';
 ok(g.beginBlueAbility(p,'almarDrawPick'));
 ok(g.resolveSideChoice('1'));
 assert.equal(g.operation.p,q);
 ok(g.resolveSideChoice('2'));
 assert.equal(g.state[p].hand.length,before+1);
 assert.equal(g.state[q].hand.length,opponent+2);
 assert.equal(g.beginBlueAbility(p,'almarDrawPick').ok,false);
 assert.equal(g.beginBlueAbility(p,'almarBottom').ok,false);
 const flask=add(g,'almar_sbnr1',p,'trash');
 ok(g.beginBlueAbility(p,'almarFlask'));
 ok(g.resolveSideChoice(flask.id));
 assert.equal(g.locate(flask.id).z,'extra');
 stocks(g,p,'青',3);
 const top=g.state[q].main[0];
 ok(g.beginBlueAbility(p,'almarDamage'));
 ok(g.resolveSideChoice('bottom'));
 assert.equal(g.state[q].main.at(-1),top);
 assert.equal(g.life[q],20-Math.max(0,before+1-opponent-2));
 for(const slot of g.unitSlots(p).slice(1))add(g,'nn3',p,slot.id);
 ok(g.manualMove(g.state[q].hand[0].id,q,'trash'));
 assert.equal(g.operation,null);
});

test('アルマーLv2のメイン開始とLv3の山札下送り',()=>{
 const g=ready();
 ok(growthFixture(g,p));
 ok(growthFixture(g,p));
 const before=g.state[p].hand.length;
 ok(g.advance());
 assert.equal(g.operation.kind,'handPick');
 assert.equal(g.state[p].hand.length,before+2);
 ok(g.resolvePrivate(g.state[p].hand[0].id));
 assert.equal(g.state[p].hand.length,before+1);
 ok(growthFixture(g,p));
 g.turn.step='main1';
 stocks(g,p,'青',1);
 const chosen=g.state[q].hand[0];
 const beforeStocks=g.state[p].stacks.length;
 ok(g.beginBlueAbility(p,'almarBottom'));
 ok(g.resolveSideChoice(chosen.id));
 assert.equal(g.state[q].main.at(-1),chosen);
 assert.equal(g.state[p].stacks.length,beforeStocks-1);
});

test('ドラヴィタ・ホールは解決中の自身を回収できず、別の同名カードを回収できる',()=>{
 const g=ready();
 fund(g,p,4,'白');
 const old=add(g,'ws12',p,'trash');
 const current=add(g,'ws12',p,'hand');
 add(g,'sbbo1',p,'extra');
 play(g,current);
 assert.equal(g.locate(current.id).z,'check');
 assert.deepEqual(g.sideChoiceCandidates().map(c=>c.id),[old.id]);
 ok(g.resolveSideChoice(old.id));
 assert.equal(g.locate(old.id).z,'hand');
 assert.equal(g.locate(current.id).z,'trash');
 assert.equal(g.operation,null);
});

test('超次元呪文のコスト、色、上限と1体召喚',()=>{
 assert.deepEqual(Cards.cards.bs6.cost,Mana.cost(6,{青:1}));
 assert.deepEqual(Cards.cards.ks16.cost,Mana.cost(4,{黒:1}));
 assert.deepEqual(Cards.cards.ws12.cost,Mana.cost(3,{白:1}));
 const g=ready();
 fund(g,p,7,'青');
 const card=add(g,'bs6',p,'hand');
 const psychic=add(g,'sbbo1',p,'extra');
 const offColor=add(g,'sbbo1',p,'extra');
 offColor.color='黒';
 const awakened=add(g,'sbbo1',p,'extra');
 awakened.awakened='sbbo1-2';
 const second=add(g,'sbbo1',p,'extra');
 play(g,card);
 assert.equal(g.operation.choice,'opponentDiscard');
 ok(g.resolveSideChoice(g.state[q].hand[0].id));
 assert.deepEqual(g.sideChoiceCandidates().map(x=>x.id),[psychic.id,second.id]);
 ok(g.resolveSideChoice(psychic.id));
 ok(g.chooseSlot('signi-1'));
 ok(g.confirmSideFree());
 assert.equal(g.locate(psychic.id).z,'signi-1');
 assert.equal(g.locate(second.id).z,'extra');
 assert.equal(g.locate(card.id).z,'trash');
});

test('ピルルクの手札追加禁止と自分のターン終了時の覚醒',()=>{
 const g=ready(),c=add(g,'sbbo1',p,'signi-1');
 let top=g.state[q].main[0];
 ok(g.draw(q,1));
 assert.equal(g.state[q].main[0],top);
 const recovered=add(g,'bs6',q,'trash');
 ok(g.manualMove(recovered.id,q,'hand'));
 assert.equal(g.locate(recovered.id).z,'trash');
 g.turn.player=q;g.turn.step='draw';
 ok(g.draw(q,1));
 assert(g.state[q].hand.includes(top));
 g.turn.player=p;g.turn.step='main2';
 while(g.state[p].hand.length<g.state[q].hand.length+4)g.state[p].hand.push(g.state[p].main.shift());
 ok(g.advance());
 assert.equal(c.awakened,undefined);
 g.turn.step='main2';g.turn.notBefore=0;
 g.state[p].hand.push(g.state[p].main.shift());
 ok(g.advance());
 assert.equal(c.name,'コード・ピルルクΩ');
 assert.equal(c.faceId,'sbbo1-2');
 assert.equal(Mana.total(c.cost),16);
 assert.equal(c.maxHealth,25);
 assert.equal(c.psychicLock,false);
});

test('Ωが3種類の手札追加を処理し、相手の元の呪文カードをトラッシュへ送る',()=>{
 const g=ready(),c=add(g,'sbbo1',p,'signi-1');
 Object.assign(c,Cards.awakened['sbbo1-2'],{awakened:'sbbo1-2'});
 const unit=add(g,'nn3',q,'main',true);
 ok(g.draw(q,1));
 assert.equal(g.locate(unit.id).z,'trash');
 assert.equal(g.life[q],20-unit.attack);
 const spell=add(g,'bs6',q,'main',true);
 ok(g.draw(q,1));
 assert.equal(g.operation.choice,'opponentDiscard');
 ok(g.resolveSideChoice(g.state[q].hand[0].id));
 assert.deepEqual([g.locate(spell.id).p,g.locate(spell.id).z],[q,'trash']);
 const otherCard=g.card('テスト用設置物','設置物','白',Mana.cost(1),false,q);
 g.state[q].main.unshift(otherCard);
 ok(g.draw(q,1));
 assert.equal(g.state[q].main.at(-1),otherCard);
 stocks(g,p,'青',2);
 const chosen=add(g,'nn3',q,'main',true);
 const hand=g.state[p].hand.length,life=g.life[q];
 ok(g.beginBlueAbility(p,'psychicReorder',c.id));
 assert.equal(g.operation.deckOwner,q);
 ok(g.confirmOrder());
 assert.equal(g.state[p].hand.length,hand+1);
 assert.equal(g.locate(chosen.id).z,'trash');
 assert.equal(g.life[q],life-chosen.attack);
 assert.equal(g.beginBlueAbility(p,'psychicReorder',c.id).ok,false);
});

test('パーフェクト・シールドは混色10支払いで攻撃を中断し、終了時処理を経て交代する',()=>{
 const g=ready();
 const attacker=add(g,'nn3',p,'signi-1');
 attacker.sick=false;
 attacker.onEnd=[{kind:'draw',count:1}];
 const perfect=add(g,'shno1',q,'shields');
 perfect.faceUp=false;
 stocks(g,q,'白',4);stocks(g,q,'黒',6);
 g.turn.step='attack';
 const life=g.life[q],hand=g.state[p].hand.length;
 ok(g.declareAttack(attacker.id,'body'));
 assert.equal(g.operation.kind,'shieldWindow');
 ok(g.resolveShield(perfect.id));
 assert.equal(g.life[q],life);
 assert.equal(g.state[q].stacks.length,0);
 assert.equal(g.state[p].hand.length,hand+1);
 assert.equal(g.turn.player,q);
 assert.equal(g.turn.step,'charge');
});

test('バイスとドラヴィタの上限は覚醒前の記載コストに適用される',()=>{
 for(const [key,color,cost,max] of [['ks16','黒',5,10],['ws12','白',4,7]]){
  const g=ready();
  fund(g,p,cost,color);
  const spell=add(g,key,p,'hand');
  const atLimit=add(g,'sbbo1',p,'extra');
  atLimit.cost=Mana.cost(max);
  const aboveLimit=add(g,'sbbo1',p,'extra');
  aboveLimit.cost=Mana.cost(max+1);
  const enemySpell=key==='ks16'?add(g,'bs6',q,'hand'):null;
  play(g,spell);
  if(enemySpell){
   assert.equal(g.operation.choice,'viceSpell');
   assert(g.sideChoiceCandidates().every(c=>c.type==='呪文'));
   ok(g.resolveSideChoice(enemySpell.id));
   assert.equal(g.locate(enemySpell.id).z,'trash');
  }
  assert.deepEqual(g.sideChoiceCandidates().map(c=>c.id),[atLimit.id]);
  ok(g.resolveSideChoice(atLimit.id));
  ok(g.chooseSlot('signi-1'));
  ok(g.confirmSideFree());
  assert.equal(g.locate(atLimit.id).z,'signi-1');
  assert.equal(g.locate(aboveLimit.id).z,'extra');
 }
});

test('Ωの処理は相手ドローフェイズだけを除外する',()=>{
 const g=ready(),c=add(g,'sbbo1',p,'signi-1');
 Object.assign(c,Cards.awakened['sbbo1-2'],{awakened:'sbbo1-2'});
 g.turn.player=q;
 for(const phase of ['untap','draw','charge','stackCharge','levelUp','main1']){
  g.turn.step=phase;
  const unit=add(g,'nn3',q,'main',true);
  ok(g.draw(q,1));
  assert.equal(g.locate(unit.id).z,phase==='draw'?'hand':'trash',phase);
 }
});
