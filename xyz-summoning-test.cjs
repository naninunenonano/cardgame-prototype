'use strict';

const assert=require('node:assert/strict');
const {test}=require('node:test');
const Game=require('./game');
const Mana=require('./mana');
const Cards=require('./cards');
const Decks=require('./decks');
const {skipCharge}=require('./test-fixtures.cjs');
const p='p1',q='p2';

function ok(result){assert(result.ok,result.message);}
function ready(mode='solo'){
 const g=Game.create({clock:()=>1000,random:()=>0.42,mode,decks:{p1:'blueAdvanced',p2:'green'}});
 ok(g.completeMulligan(p,[],true));
 ok(g.completeMulligan(q,[],true));
 skipCharge(g);
 g.character(p).level=2;
 for(const owner of [p,q]){
  g.state[owner].hand=[];
  g.state[owner].shields=[];
 }
 return g;
}
function add(g,key,owner,zone){
 const c=g.fromDefinition(key,owner);
 g.state[owner][zone].push(c);
 return c;
}
function unit(g,owner,slot,cost,rest=false){
 const c=g.card('テスト用コスト'+cost,'通常','青',Mana.cost(cost),false,owner);
 c.rest=rest;
 g.state[owner]['signi-'+slot].push(c);
 return c;
}
function stock(g,color,owner=p){
 g.state[owner].stacks.push(g.card(color+'ストック','ストック',color,null,false,owner));
}
function pay(g,c,materials,target=null,method='normal'){
 ok(g.beginXyz(c.id,method));
 for(const material of materials)ok(g.selectXyz(material.id));
 if(target)ok(g.selectXyz(target.id,true));
 ok(g.resolveXyz());
}
function numeronia(g){
 const n=add(g,'sbno2',p,'extra'),chaos=add(g,'sbbs2',p,'extra'),knight=add(g,'sbbr2',p,'extra');
 const a=unit(g,p,1,2),b=unit(g,p,2,2),captured=unit(g,q,1,4);
 stock(g,'青');
 pay(g,knight,[a,b]);
 pay(g,knight,[a,b],captured,'ability');
 pay(g,chaos,[],knight,'overlay');
 return {n,chaos,knight,a,b,captured};
}

test('カードのID・採用区分・コストなし・召喚時のストック',()=>{
 const deck=Decks.preset('blueAdvanced');
 for(const [key,color,rarity,count,attack,health] of [
  ['sbbr2','青','R',2,2,8],['sbbs2','青','SR',3,7,3],['sbno2','無色','OR',8,10,10]
 ]){
  const c=Cards.cards[key];
  assert.deepEqual([c.color,c.rarity,c.xyz.count,c.attack,c.maxHealth,c.cost,c.cardSection],[color,rarity,count,attack,health,null,'sideboard']);
  assert.equal(c.stackCost[color==='無色'?'generic':color],1);
  assert.equal(Decks.sectionOf(c),'sideboard');
  assert(c.abilityLines.length);
  deck.sideboard=[{key:deck.sideboard[0].key,count:1},{key,count:1}];
  assert.deepEqual(Decks.validate(deck),[]);
 }
});

test('通常召喚は同コスト・非エクシーズ・青ストック1個。満員でも素材の空き枠に登場',()=>{
 const g=ready(),knight=add(g,'sbbr2',p,'extra'),chaos=add(g,'sbbs2',p,'extra');
 g.state[p].stacks=[];
 const a=unit(g,p,1,2,true),b=unit(g,p,2,2),x=unit(g,p,3,3),y=unit(g,p,4,3),z=unit(g,p,5,3);
 unit(g,p,6,5);unit(g,p,7,5);
 stock(g,'赤');
 assert.match(g.beginXyz(knight.id).message,/ストック不足/);
 stock(g,'青');
 ok(g.beginPayment(knight.id));
 assert.equal(g.resolveXyz().ok,false);
 ok(g.selectXyz(a.id));
 assert.equal(g.selectXyz(x.id).ok,false);
 ok(g.selectXyz(b.id));
 ok(g.resolveXyz(false));
 assert.equal(g.state[p].stacks.length,2);
 pay(g,knight,[a,b]);
 assert.equal(g.locate(knight.id).z,'signi-1');
 assert.equal(knight.rest,true);
 assert.equal(g.locate(a.id),null);
 assert.deepEqual(knight.xyzMaterials,[a,b]);
 assert.deepEqual(g.state[p].stacks.map(c=>c.color),['赤']);
 stock(g,'青');
 ok(g.beginXyz(chaos.id));
 assert.equal(g.selectXyz(knight.id).ok,false);
 assert.deepEqual(g.xyzOptions().materials.map(c=>c.id),[x,y,z].map(c=>c.id));
 for(const c of [x,y,z])ok(g.selectXyz(c.id));
 ok(g.resolveXyz());
 assert.equal(chaos.rest,false);
 assert.deepEqual(chaos.xyzMaterials,[x,y,z]);
 assert.equal(g.fieldCards(p).length,4);
});

test('ネフィルは相手のメインにも発動し、相手素材の持ち主は変わらない',()=>{
 const g=ready(),knight=add(g,'sbbr2',p,'extra');
 const a=unit(g,p,1,2),b=unit(g,p,2,2),enemy=unit(g,q,1,3),own=unit(g,p,4,3);
 stock(g,'青');
 pay(g,knight,[a,b]);
 g.turn.player=q;
 g.turn.step='main2';
 pay(g,knight,[a,b],enemy,'ability');
 assert.deepEqual(g.state[p].trash.slice(-2),[a,b]);
 assert.deepEqual(knight.xyzMaterials,[enemy]);
 assert.equal(g.locate(enemy.id),null);
 knight.xyzMaterials.push(g.fromDefinition('nn3',p));
 assert.match(g.beginXyz(knight.id,'ability').message,/このターンは使用済み/);
 assert(g.destroyUnit(knight.id,'テスト'));
 assert.equal(g.locate(enemy.id).p,q);
 assert.equal(g.locate(enemy.id).z,'trash');
 assert(g.locate(own.id));
});

test('カオスナイトの重ね処理は無償で本体と素材を引き継ぎ、同一ターンに再発動可能',()=>{
 const g=ready(),chaos=add(g,'sbbs2',p,'extra'),another=add(g,'sbbs2',p,'extra'),knight=add(g,'sbbr2',p,'extra');
 const a=unit(g,p,1,3,true),b=unit(g,p,2,3),c=unit(g,p,3,3);
 stock(g,'青');pay(g,chaos,[a,b,c]);
 const before=g.state[p].stacks.length;
 pay(g,chaos,[a,b],another,'ability');
 assert.equal(another.rest,false);
 assert.deepEqual(another.xyzMaterials,[chaos,c]);
 assert.deepEqual(chaos.xyzMaterials,[]);
 pay(g,another,[chaos,c],knight,'ability');
 assert.deepEqual(knight.xyzMaterials,[another]);
 assert.deepEqual(g.state[p].trash.slice(-4),[a,b,chaos,c]);
 assert.equal(g.state[p].stacks.length,before);
});

test('ヌメロニアの登場制限、タップ登場、場・手札・トラッシュの一括移動と素材保全',()=>{
 const g=ready(),{n,chaos,knight,captured}=numeronia(g);
 g.turn.counts[p]=9;
 assert.match(g.beginXyz(n.id).message,/第10ターン/);
 assert.equal(g.beginXyz(chaos.id,'ability').ok,false);
 assert.deepEqual(chaos.xyzMaterials,[knight,captured]);
 g.turn.counts[p]=10;
 assert.match(g.beginXyz(n.id).message,/素材が不足/);
 const own=unit(g,p,2,4),enemy=unit(g,q,2,4),field=add(g,'bs2',p,'structures'),leader=g.character(p);
 const hand=add(g,'nn3',p,'hand'),trash=add(g,'nn3',p,'trash');
 const mana=add(g,'nn3',p,'energy'),before=g.state[p].stacks.length;
 pay(g,chaos,[knight,captured],n,'ability');
 assert.equal(n.rest,true);
 assert.equal(n.cost,null);
 assert.deepEqual(n.xyzMaterials,[chaos]);
 assert.equal(g.beginPayment(n.id).ok,false);
 assert.equal(g.locate(chaos.id),null);
 assert.equal(g.state[p].stacks.length,before);
 assert.deepEqual(g.state[p].hand,[]);
 assert.deepEqual(g.state[p].trash,[]);
 for(const c of [own,field,leader,hand,trash,knight])assert.equal(g.locate(c.id).z,'exile',c.name);
 assert.equal(g.locate(mana.id).z,'energy');
 assert.equal(g.locate(enemy.id).z,'signi-2');
 assert.equal(g.locate(captured.id).z,'trash');
 assert.equal(g.locate(captured.id).p,q);
 assert.equal(g.targetOptions({kind:'unitBounce'},q).some(c=>c.id===n.id),false);
 assert.equal(g.targetOptions({kind:'unitBounce'},p).some(c=>c.id===n.id),true);
 g.turn.step='attack';n.rest=false;
 assert.match(g.attackError(n.id),/攻撃できません/);
 ok(g.loseLife(p,30));
 assert.equal(g.result,null);
 assert(g.destroyUnit(n.id,'テスト'));
 assert.equal(g.result.winner,q);
 assert.equal(g.locate(chaos.id).z,'trash');
});

test('ヌメロニアは素材1枚で攻撃を無効にし、攻撃できる相手クリーチャーは1体。終了時に勝利',()=>{
 const g=ready(),{n,chaos,knight,captured}=numeronia(g);
 g.turn.counts[p]=10;
 pay(g,chaos,[knight,captured],n,'ability');
 const a=unit(g,q,1,2),b=unit(g,q,2,2);
 a.attacksPerTurn=2;
 g.turn.player=q;
 g.turn.step='attack';
 const before=g.life[p];
 ok(g.declareAttack(a.id,'body'));
 assert.equal(g.operation.kind,'xyzNegate');
 ok(g.selectXyz(chaos.id));
 ok(g.resolveXyz());
 assert.equal(g.life[p],before);
 assert.equal(g.locate(chaos.id).z,'trash');
 assert.match(g.attackError(b.id),/1ターンに1体/);
 a.rest=false;
 assert.equal(g.attackError(a.id),'');
 ok(g.declareAttack(a.id,'body'));
 assert.equal(g.operation.kind,'combat');
 ok(g.resolveAttack(null));
 assert.equal(g.life[p],before-2);
 g.turn.notBefore=0;ok(g.advance());
 g.turn.notBefore=0;ok(g.advance());
 assert.equal(g.result.winner,p);
 assert.match(g.result.reason,/特殊勝利/);
});

test('Botのメイン終了前にプレイヤーがネフィルの選択を行える',()=>{
 const g=ready('bot'),knight=add(g,'sbbr2',p,'extra');
 const a=unit(g,p,1,2),b=unit(g,p,2,2),target=unit(g,q,1,2);
 stock(g,'青');pay(g,knight,[a,b]);
 g.turn.player=q;
 g.turn.step='main1';
 g.turn.notBefore=0;
 ok(g.advance());
 assert.equal(g.decisionPlayer(),p);
 assert.equal(g.operation.kind,'xyzOffer');
 ok(g.chooseXyzOffer(knight.id));
 for(const c of [a,b])ok(g.selectXyz(c.id));
 ok(g.selectXyz(target.id,true));ok(g.resolveXyz());
 g.turn.notBefore=0;ok(g.advance());
 assert.equal(g.turn.step,'attack');
});
