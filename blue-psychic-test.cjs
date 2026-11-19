'use strict';

const assert=require('node:assert/strict');
const Game=require('./game');
const Cards=require('./cards');
const Mana=require('./mana');
const {fund,growthFixture,skipCharge}=require('./test-fixtures.cjs');

const p='p1',q='p2';
function ok(result){assert(result.ok,result.message);}
function ready(){
 const main=[['bo1',3],['bs1',3],['bu2',1],['bu4',1],['nu2',1],['br1',3],['bn1',3],['br3',3],
  ['br5',3],['ns1',3],['br4',3],['nn1',3],['bs5',3],['bs3',3],['nn7',4]].map(([key,count])=>({key,count}));
 const d={...require('./decks').preset('blueAdvanced'),id:'psychic-test',preset:false,main,sideboard:[{key:'almar',count:1},{key:'sbnu3',count:1}]};
 const g=Game.create({decks:{p1:d.id,p2:'green'},records:[d],clock:()=>1000,random:()=>0.42});
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
 fund(g,p,4,'青');
 const old=add(g,'bs8',p,'trash');
 const current=add(g,'bs8',p,'hand');
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
 assert.deepEqual(Cards.cards.bs7.cost,Mana.cost(4,{青:1}));
 assert.deepEqual(Cards.cards.bs8.cost,Mana.cost(3,{青:1}));
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
 for(const [key,color,cost,max] of [['bs7','青',5,10],['bs8','青',4,7]]){
  const g=ready();
  fund(g,p,cost,color);
  const spell=add(g,key,p,'hand');
  const atLimit=add(g,'sbbo1',p,'extra');
  atLimit.cost=Mana.cost(max);
  const aboveLimit=add(g,'sbbo1',p,'extra');
  aboveLimit.cost=Mana.cost(max+1);
  const enemySpell=key==='bs7'?add(g,'bs6',q,'hand'):null;
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

test('青化した超次元呪文は青マナが必要で、旧IDのデッキと所持データを引き継ぐ',()=>{
 const Decks=require('./decks');
 const old={owned:{ks16:2,ws12:3},decks:[{main:[{key:'ks16',count:2},{key:'ws12',count:3}]}]};
 const migrated=Decks.migrateProfile(old);
 assert.deepEqual(migrated.owned,{bs7:2,bs8:3});
 assert.deepEqual(migrated.decks[0].main,[{key:'bs7',count:2},{key:'bs8',count:3}]);
 assert.deepEqual(Decks.migrateProfile(migrated),migrated);
 for(const [key,oldKey,oldColor,total] of [['bs7','ks16','黒',5],['bs8','ws12','白',4]]){
  const g=ready();
  const spell=add(g,oldKey,p,'hand');
  assert.equal(spell.key,key);
  assert.equal(spell.color,'青');
  fund(g,p,total-1,oldColor);
  fund(g,p,1,oldColor);
  assert.equal(g.beginPayment(spell.id).ok,false);
  fund(g,p,1,'青');
  play(g,spell);
  if(g.operation?.choice==='viceSpell')ok(g.resolveSideChoice(g.sideChoiceCandidates()[0].id));
  assert.equal(g.locate(spell.id).z,'trash');
  assert.equal(g.state[p].energy.filter(c=>c.rest).length,total);
  assert(g.state[p].energy.some(c=>c.rest&&c.mana.color==='青'));
 }
 assert.equal(Cards.cards.bs6.color,'青');
 assert.equal(Cards.cards.ks16,undefined);
 assert.equal(Cards.cards.ws12,undefined);
});

test('メモリー・フラスコは0ストックで使用し、同じ個体を3ターンにわたり回収・再使用できる',()=>{
 const Decks=require('./decks'),d=Decks.preset('blueAdvanced');
 assert.equal(d.sideboard.find(c=>c.key==='almar_sbnr1').count,2);
 d.id='flask-test';
 d.preset=false;
 const g=Game.create({decks:{p1:d.id,p2:'green'},records:[d],clock:()=>1000,random:()=>0.42});
 ok(g.completeMulligan(p,[],true));ok(g.completeMulligan(q,[],true));
 const [flask,other]=g.state[p].extra.filter(c=>c.key==='almar_sbnr1');
 skipCharge(g);
 assert(Cards.cards.almar_sbnr1.charger);
 assert(!g.playStatus(flask,p).ok);
 for(let level=1;level<=4;level++){
  ok(growthFixture(g,p));
  g.turn.step='main1';
  if(level===1)assert(!g.playStatus(flask,p).ok);
  if(level===2){
   assert.equal(g.operation,null);
   assert(g.playStatus(flask,p).ok);
  }
 }
 for(let i=0;i<3;i++){
  g.state[p].stacks.length=0;
  const enemy=g.state[q].hand.length;
  play(g,flask);
  assert.equal(g.operation.kind,'tokens');
  ok(g.placeToken(g.unitSlots(p)[i].id));
  ok(g.resolveOptional(false));
  assert.equal(g.state[q].hand.length,enemy-1);
  assert.equal(g.state[p].stacks.length,2);
  assert.equal(g.locate(flask.id).z,'trash');
  assert(!flask.used);
  ok(g.beginBlueAbility(p,'almarFlask'));
  ok(g.resolveSideChoice(flask.id));
  assert.equal(g.locate(flask.id).z,'extra');
  assert(!g.beginBlueAbility(p,'almarFlask').ok);
  assert(!g.beginPayment(flask.id).ok);
  assert(!g.beginPayment(other.id).ok);
  for(let phase=0;phase<4;phase++){
   g.turn.notBefore=0;
   ok(g.advance());
  }
  assert.equal(g.turn.step,'charge');
  skipCharge(g);
 }
});

test('ピルルクの青2起動は捨て札に反応し、相手手札が空でも1枚引き、覚醒で失われる',()=>{
 const g=ready(),c=add(g,'sbbo1',p,'signi-1');
 g.state[p].stacks.length=0;
 stocks(g,p,'青',1);stocks(g,p,'黒',1);
 assert(!g.beginBlueAbility(p,'psychicBrainTouch',c.id).ok);
 stocks(g,p,'青',1);
 assert(!g.beginBlueAbility(p,'psychicReorder',c.id).ok);
 const enemy=g.state[q].hand.slice(),hand=g.state[p].hand.length;
 ok(g.beginBlueAbility(p,'psychicBrainTouch',c.id));
 assert.equal(g.locate(enemy[Math.floor(0.42*enemy.length)].id).z,'trash');
 assert.equal(g.state[q].hand.length,enemy.length-1);
 assert.equal(g.state[p].hand.length,hand+1);
 assert.deepEqual(g.state[p].stacks.map(c=>c.color).sort(),['青','黒'].sort());
 stocks(g,p,'青',3);
 assert(!g.beginBlueAbility(p,'psychicBrainTouch',c.id).ok);
 g.turn.player=q;
 assert(!g.beginBlueAbility(p,'psychicBrainTouch',c.id).ok);
 g.turn.player=p;g.turn.step='main2';g.turn.notBefore=0;
 ok(g.advance());
 g.turn.notBefore=0;
 ok(g.advance());
 skipCharge(g);
 g.state[q].hand.length=0;
 const before=g.state[p].hand.length;
 ok(g.beginBlueAbility(p,'psychicBrainTouch',c.id));
 assert.equal(g.state[p].hand.length,before+1);
 g.turn.step='main2';g.turn.notBefore=0;
 ok(g.advance());
 assert.equal(c.awakened,'sbbo1-2');
 assert.equal(c.psychicBrainTouch,false);
 g.turn.step='main1';
 stocks(g,p,'青',2);
 assert(!g.beginBlueAbility(p,'psychicBrainTouch',c.id).ok);
});

function castRecord(g,c){
 return g.battleLog(p,{detailed:true}).filter(e=>e.card?.instanceId===c.id&&['cardUse','spellResolution'].includes(e.kind));
}
function putOmega(g,controller){
 const c=add(g,'sbbo1',controller,'signi-1');
 Object.assign(c,Cards.awakened['sbbo1-2'],{awakened:'sbbo1-2'});
 return c;
}

test('Ωは応答先のない応答専用呪文を唱え、使用者の誘発を処理して持ち主のトラッシュへ送る',()=>{
 for(const [controller,owner] of [[p,q],[q,p]]){
  const g=ready(),omega=putOmega(g,controller);
  const casterWatch=add(g,'nn3',controller,'signi-2');
  const ownerWatch=add(g,'nn3',owner,'signi-2');
  casterWatch.drawOnUse=ownerWatch.drawOnUse=true;
  assert.equal(omega.drawOnUse,undefined);
  const response=add(g,'br3',owner,'main',true);
  const casterHand=g.state[controller].hand.length,ownerHand=g.state[owner].hand.length;
  ok(g.draw(owner,1));
  const [cast,resolution]=castRecord(g,response);
  assert.deepEqual([cast.kind,cast.actor,cast.caster,cast.owner,Mana.total(cast.cost)],['cardUse',controller,controller,owner,0]);
  assert.deepEqual([resolution.kind,resolution.actor,resolution.caster,resolution.owner,resolution.resolution,resolution.reason],['spellResolution',controller,controller,owner,'fizzled','noLegalResponseTarget']);
  assert.equal(g.state[controller].hand.length,casterHand+1);
  assert.equal(g.state[owner].hand.length,ownerHand);
  assert.equal(g.locate(response.id).p,owner);
  assert.equal(g.locate(response.id).z,'trash');
  assert.equal(response.origin,owner);
  assert(!g.state[owner].main.includes(response));
  assert(!g.state[owner].hand.includes(response));
  assert.deepEqual(g.state[controller].check,[]);
  const trigger=g.battleLog(p,{detailed:true}).find(e=>e.kind==='draw'&&e.source?.instanceId===casterWatch.id);
  assert(cast.number<resolution.number&&resolution.number<trigger.number);
  assert.equal(g.operation,null);
 }
});

test('通常呪文の発動履歴と解決は使用者を基準にし、自分で唱えた場合も同じ誘発を使う',()=>{
 for(const stolen of [false,true]){
  const g=ready();
  if(stolen)putOmega(g,p);
  const caster=stolen?p:q,owner=q;
  const pilot=add(g,'nn3',p,'signi-2'),opponent=add(g,'nn3',q,'signi-2');
  pilot.drawOnUse=opponent.drawOnUse=true;
  const spell=add(g,'bn7',owner,stolen?'main':'hand',stolen);
  const counts=Object.fromEntries([p,q].map(id=>[id,g.state[id].hand.length]));
  if(stolen)ok(g.draw(owner,1));
  else{
   g.turn.player=owner;
   fund(g,owner,4,'青');
   play(g,spell);
  }
  assert.equal(g.state[p].hand.length,counts[p]+(stolen?3:0));
  assert.equal(g.state[q].hand.length,counts[q]+(stolen?0:2));
  const [cast,resolution]=castRecord(g,spell);
  assert.equal(cast.caster,caster);
  assert.equal(cast.owner,owner);
  assert.equal(resolution.resolution,'resolved');
  assert.equal(g.locate(spell.id).p,owner);
  assert.equal(g.locate(spell.id).z,'trash');
 }
});

test('唱えた時のドローは呪文の完了を待ち、Ωが唱える2枚の対抗呪文は順番に不発になる',()=>{
 const g=ready();
 putOmega(g,p);
 const casterWatch=add(g,'nn3',p,'signi-2');
 const ownerWatch=add(g,'nn3',q,'signi-2');
 casterWatch.drawOnUse=ownerWatch.drawOnUse=true;
 add(g,'nn3',q,'signi-3').drawOnUse=true;
 g.turn.player=q;
 fund(g,q,4,'青');
 const initial=add(g,'bn7',q,'hand');
 const second=add(g,'br3',q,'main',true);
 const first=add(g,'br3',q,'main',true);
 const bodyDraws=[add(g,'nn3',q,'main',true),add(g,'nn5',q,'main',true)];
 const watchIds=new Set([ownerWatch.id,g.state[q]['signi-3'][0].id]);
 const before=g.state[p].hand.length,enemy=g.state[q].hand.length;
 assert(!g.beginPayment(add(g,'br3',q,'hand').id).ok);
 g.state[q].hand.pop();
 // The spell itself draws two cards before its cast-triggered draws.
 bodyDraws.forEach(c=>{c.type='設置物';});
 play(g,initial);
 assert.equal(g.state[q].hand.length,enemy-1);
 assert.equal(g.state[p].hand.length,before+2);
 const initialDone=castRecord(g,initial)[1];
 assert.equal(initialDone.resolution,'resolved');
 assert.equal(castRecord(g,first)[1].resolution,'fizzled');
 assert.equal(castRecord(g,second)[1].resolution,'fizzled');
 const log=g.battleLog(p,{detailed:true});
 const watchedDraws=log.filter(e=>e.kind==='draw'&&watchIds.has(e.source?.instanceId));
 assert.equal(watchedDraws.length,2);
 assert(watchedDraws.every(e=>e.number>initialDone.number));
 assert(watchedDraws.at(-1).number<castRecord(g,first)[0].number);
 assert(castRecord(g,first)[1].number<castRecord(g,second)[0].number);
 for(const card of [first,second,initial]){
  assert.equal(g.locate(card.id).p,q);
  assert.equal(g.locate(card.id).z,'trash');
  assert.equal(card.origin,q);
 }
 assert(!log.some(e=>e.kind==='counterSuccess'));
 assert.deepEqual(g.state[p].check,[]);
 assert.deepEqual(g.state[q].check,[]);
 assert.equal(g.operation,null);
});

test('Ωの無償使用で持ち主のトラッシュ移動時能力も処理される',()=>{
 const g=ready();
 putOmega(g,p);
 const counter=add(g,'br3',q,'main',true);
 counter.trashPriority=true;
 const unit=add(g,'nn3',q,'main',true);
 g.state[q].main.splice(0,2,counter,unit);
 ok(g.draw(q,1));
 assert.equal(g.operation.kind,'graveChoice');
 assert.equal(g.operation.p,q);
 const trigger=g.battleLog(p,{detailed:true}).find(e=>e.kind==='graveInterrupt');
 assert.equal(trigger.actor,q);
 assert.equal(trigger.source.instanceId,counter.id);
 ok(g.resolveGraveChoice(g.state[q].hand[0].id));
 assert.equal(g.locate(counter.id).z,'trash');
 assert.equal(g.locate(counter.id).p,q);
 assert.equal(g.operation,null);
});

test('Ωが唱えた通常呪文も合法な単独対象がなければ不発になる',()=>{
 const g=ready();
 putOmega(g,p);
 const spell=add(g,'gr5',q,'main',true);
 ok(g.draw(q,1));
 assert.equal(castRecord(g,spell)[1].resolution,'fizzled');
 assert.equal(g.locate(spell.id).p,q);
 assert.equal(g.locate(spell.id).z,'trash');
});

test('エナジー・ホールのドローとサイキック召喚が両方終わるまでΩを待機させる',()=>{
 const g=ready();
 putOmega(g,p);
 g.turn.player=q;
 fund(g,q,7,'青');
 // Reproduce the specified effect sequence without adding a production card.
 const hole=add(g,'bs6',q,'hand');
 hole.name='エナジー・ホール';
 hole.onUse=[{kind:'draw',count:1},{kind:'psychicSummon',color:'青'}];
 const counter=add(g,'br3',q,'main',true);
 const psychic=add(g,'sbbo1',q,'extra');
 psychic.onEnter=[{kind:'healLife',count:1}];
 play(g,hole);
 assert.equal(g.operation.choice,'psychicSummon');
 assert.equal(g.locate(counter.id).z,'hand');
 assert.equal(g.locate(hole.id).z,'check');
 assert.deepEqual(castRecord(g,counter),[]);
 ok(g.resolveSideChoice(psychic.id));
 ok(g.chooseSlot('signi-1'));
 ok(g.confirmSideFree());
 assert.equal(g.locate(psychic.id).z,'signi-1');
 assert.equal(g.locate(hole.id).z,'trash');
 assert.equal(g.locate(counter.id).p,q);
 assert.equal(g.locate(counter.id).z,'trash');
 const [cast,done]=castRecord(g,counter),[holeCast,holeDone]=castRecord(g,hole);
 const log=g.battleLog(p,{detailed:true});
 const [queued]=log.filter(e=>e.kind==='triggerQueued'&&e.effects.includes('psychicIntercept'));
 assert(queued.number<holeDone.number);
 assert.equal(log.filter(e=>e.kind==='triggerQueued'&&e.effects.includes('psychicIntercept')).length,1);
 const entry=log.find(e=>e.kind==='unitEntry'&&e.card.instanceId===psychic.id);
 const move=log.find(e=>e.kind==='move'&&e.card.instanceId===hole.id&&e.to.zone==='trash');
 const heal=log.find(e=>e.kind==='life'&&e.actor===q&&e.amount===1);
 assert(holeCast.number<entry.number&&entry.number<holeDone.number);
 assert(holeDone.number<move.number&&move.number<cast.number);
 assert(holeDone.number<heal.number);
 assert.equal(cast.caster,p);
 assert.equal(done.resolution,'fizzled');
 assert(!log.some(e=>e.kind==='counterSuccess'));
});

test('登場時能力のドローで誘発したΩは、残りの回復が完了してから解決する',()=>{
 const g=ready();
 putOmega(g,p);
 const ability=g.fromDefinition('nn3',q);
 ability.onEnter=[{kind:'draw',count:1},{kind:'healLife',count:2}];
 const counter=add(g,'br3',q,'main',true);
 ok(g.addCard(q,'signi-1',ability));
 const log=g.battleLog(p,{detailed:true});
 const draw=log.find(e=>e.kind==='draw'&&e.source?.instanceId===ability.id);
 const heal=log.find(e=>e.kind==='life'&&e.actor===q&&e.amount===2);
 const [cast,done]=castRecord(g,counter);
 assert(draw.number<heal.number&&heal.number<cast.number);
 assert.equal(done.resolution,'fizzled');
 assert.equal(log.filter(e=>e.kind==='cardUse'&&e.card.instanceId===counter.id).length,1);
});

test('手札を捨てたイベントによるアルマーのストック獲得は呪文の残りの効果を待つ',()=>{
 const g=ready();
 fund(g,q,7,'青');
 g.turn.player=q;
 const spell=add(g,'bs6',q,'hand');
 spell.onUse=[{kind:'handDiscard'},{kind:'psychicSummon',color:'青'}];
 const psychic=add(g,'sbbo1',q,'extra');
 const before=g.state[p].stacks.length;
 play(g,spell);
 assert.equal(g.operation.kind,'handPick');
 ok(g.resolvePrivate(g.state[q].hand[0].id));
 assert.equal(g.operation.choice,'psychicSummon');
 assert.equal(g.state[p].stacks.length,before);
 ok(g.resolveSideChoice(psychic.id));
 ok(g.chooseSlot('signi-1'));
 ok(g.confirmSideFree());
 assert.equal(g.locate(spell.id).z,'trash');
 assert.equal(g.state[p].stacks.length,before+1);
});
