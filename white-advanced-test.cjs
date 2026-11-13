'use strict';
const assert=require('node:assert/strict');
const Game=require('./game');
const Decks=require('./decks');
const Mana=require('./mana');
const {cards}=require('./cards');
const {fund,skipCharge}=require('./test-fixtures.cjs');

const yes=r=>assert(r.ok,r.message);
function fixture(){
 const g=Game.create({decks:{p1:'whiteBeginner',p2:'redBeginner'},random:()=>.4,strictTargets:true});
 yes(g.completeMulligan('p1'));yes(g.completeMulligan('p2'));skipCharge(g);
 g.state.p1.hand=[];g.state.p2.hand=[];g.state.p1.shields=[];g.state.p2.shields=[];
 g.character('p1').level=2;
 fund(g,'p1',12,'白');
 return g;
}
function put(g,key,zone='hand',p='p1'){
 const card=g.fromDefinition(key,p);
 g.state[p][zone].push(card);
 return card;
}
function use(g,card,slot){
 yes(g.beginPayment(card.id));
 if(slot)yes(g.chooseSlot(slot));
 yes(g.confirmPayment());
 while(g.operation?.kind==='response')yes(g.passResponse());
}
function choose(g,id){
 assert.equal(g.operation?.kind,'expansionChoice');
 yes(g.resolveExpansion(id));
}
function summon(g,key,mode,materials,slot){
 const card=put(g,key,'extra');
 yes(g.beginPayment(card.id));choose(g,mode);
 for(const c of materials)choose(g,c.id);
 choose(g,slot);
 while(g.operation?.kind==='response')yes(g.passResponse());
 assert.equal(g.locate(card.id)?.z,slot);
 return card;
}
{
 for(const c of Object.values(cards)){
  if(!c.cost||!Mana.total(c.cost)||c.sideboardOnly||c.type==='キャラクター')continue;
  for(const color of Mana.colors)assert.equal(c.cost[color],Mana.hasColor(c,color)?1:0,c.key);
 }
 const g=fixture();
 const single=g.fromDefinition('rn16','p1');
 assert.deepEqual(single.cost,Mana.cost(2,{赤:1}));
 const multi={civilizations:['白','青']};
 multi.cost=Mana.cardCost(Mana.cost(1,{白:2,青:1}),multi);
 const [a,b]=multi.civilizations;
 const resources=Array.from({length:Mana.total(multi.cost)},(_,i)=>({id:i,mana:{amount:1,color:i===0?a:'無色'}}));
 assert(!Mana.payment(multi.cost,resources).ok);
 resources[1].mana.color=b;
 assert(Mana.payment(multi.cost,resources).ok);
}
{
 const g=fixture();
 assert.equal(g.character('p1').name,'蛇眼姫 リゼリア');
 const shield=put(g,'shnu1','shields');shield.faceUp=false;
 const stocks=g.state.p1.stacks.length;
 yes(g.loseLife('p1',23));yes(g.resolveShield(shield.id));
 assert.equal(g.life.p1,1);
 assert.equal(g.state.p1.stacks.length,stocks+5);
 assert(g.state.p1.stacks.slice(-5).every(c=>c.color==='白'&&c.token));
 yes(g.loseLife('p1',5));yes(g.healLife('p1',3));yes(g.setLife('p1',2));
 assert.equal(g.life.p1,4);
 g.turn.sequence++;yes(g.loseLife('p1',4));
 assert.equal(g.result.winner,'p2');
}
for(const [damage,life] of [[29,1],[30,0]]){
 const g=fixture(),shield=put(g,'shnl1','shields');shield.faceUp=false;
 yes(g.loseLife('p1',damage));yes(g.resolveShield(shield.id));
 assert.equal(g.life.p1,life);
 assert.equal(!!g.result,!life);
}
{
 const g=fixture(),shield=put(g,'shnu1','shields');shield.faceUp=false;
 yes(g.loseLife('p1',20,'テスト',{type:'lifeLoss'}));
 assert(g.result);assert(!shield.faceUp);
}
{
 const g=fixture();
 const a=put(g,'wn4','signi-1'),b=put(g,'wn5','signi-2');
 a.sick=true;b.rest=true;
 const side=put(g,'sbws4','extra');
 assert(!g.playStatus(side,'p1').ok);
 b.rest=false;
 const phantom=summon(g,'sbws4','synchro',[a,b],'signi-1');
 choose(g,a.id);choose(g,b.id);
 assert.deepEqual(g.state.p1.structures.map(c=>c.type),['設置物','設置物']);
 assert(g.state.p1.structures.every(c=>c.shieldLink&&!c.onEnter));
 const next=put(g,'sbws3','extra');assert(g.playStatus(next,'p1').ok);
 g.turn.sequence++;
 const stocks=g.state.p1.stacks.length;
 const original=summon(g,'sbws3','links',[a,b],'signi-2');
 choose(g,'done');
 assert.equal(g.state.p1.stacks.length,stocks);
 assert.equal(g.locate(a.id).card.type,'通常');
 assert(g.locate(a.id).card.onEnter.length);
 g.turn.sequence++;original.rest=false;phantom.rest=false;
 const judgment=summon(g,'sbwu2','synchro',[phantom,original],'signi-1');
 assert.equal(g.locate(phantom.id).z,'trash');
 assert.equal(g.locate(original.id).z,'trash');
 yes(g.beginWhiteAbility(judgment.id,'judgmentConvert'));
 choose(g,a.id);
 assert(g.locate(a.id).card.shieldLink);
 assert(!g.beginWhiteAbility(judgment.id,'judgmentConvert').ok);
 const attacker=put(g,'nn3','signi-1','p2');
 g.turn.player='p2';g.turn.sequence++;g.turn.step='attack';
 yes(g.declareAttack(attacker.id,'body'));choose(g,a.id);
 assert.equal(g.locate(attacker.id).z,'trash');
 assert.equal(g.life.p1,20);
 g.destroyUnit(judgment.id,'テスト');
 assert.equal(g.locate(original.id).z,'extra');
}
{
 const g=fixture(),reactive=put(g,'wn6','trash'),temple=put(g,'ws11','structures');
 const enemy=put(g,'nn9','signi-1','p2');
 const dog=put(g,'wr8');
 use(g,dog,'signi-1');choose(g,temple.id);choose(g,reactive.id);
 assert.equal(g.life.p2,18);
 assert.equal(g.locate(reactive.id).z,'structures');
 const cat=put(g,'ws10');use(g,cat,'signi-2');choose(g,reactive.id);
 if(g.operation?.kind==='starterChoice')yes(g.resolveStarter(enemy.id));
 assert.equal(g.locate(enemy.id).z,'trash');
}
{
 const g=fixture(),serpent=put(g,'wu3');
 const rabbit=put(g,'wn5','trash'),fox=put(g,'wn4','trash'),temple=put(g,'ws11','trash'),link=put(g,'wn6','trash');
 use(g,serpent,'signi-1');choose(g,rabbit.id);choose(g,fox.id);choose(g,'done');
 assert(!g.expansionCandidates().includes(temple));choose(g,link.id);choose(g,'done');
 assert.equal(g.locate(link.id).z,'structures');
 yes(g.beginSerpent(serpent.id));choose(g,rabbit.id);yes(g.chooseSlot('signi-1'));yes(g.confirmSideFree());
 choose(g,link.id);
 choose(g,'done');
 choose(g,fox.id);yes(g.chooseSlot('signi-2'));yes(g.confirmSideFree());
 assert.equal(g.locate(serpent.id).z,'exile');
 assert.equal(g.locate(fox.id).z,'signi-2');
}
{
 const g=fixture(),baronne=put(g,'sbwo1','signi-1');
 const enemy=put(g,'nn9','signi-1','p2');
 yes(g.beginWhiteAbility(baronne.id,'baronneDestroy'));choose(g,enemy.id);
 assert.equal(g.locate(enemy.id).z,'trash');
 assert(!g.beginWhiteAbility(baronne.id,'baronneDestroy').ok);
 const used=put(g,'wn2','trash');
 yes(g.beginWhiteAbility(baronne.id,'baronneRecover'));choose(g,used.id);
 assert.equal(g.locate(baronne.id).z,'trash');
 assert.equal(g.locate(used.id).z,'structures');
}
{
 const g=fixture(),baronne=put(g,'sbwo1','signi-1');
 g.turn.player='p2';fund(g,'p2',8,'青');
 const spell=put(g,'br1','hand','p2');
 yes(g.beginPayment(spell.id));yes(g.confirmPayment());
 assert.equal(g.operation?.kind,'response');
 yes(g.beginPayment(baronne.id,'instant'));
 assert.equal(g.locate(spell.id).z,'trash');
 assert(baronne.baronneCounter);
 const next=put(g,'br1','hand','p2');
 yes(g.beginPayment(next.id));yes(g.confirmPayment());
 assert.equal(g.operation,null);
}
{
 const g=fixture(),charger=put(g,'sbws1','extra');
 g.state.p1.main=[];
 const other=put(g,'nn3','main'),fox=put(g,'wn4','main'),link=put(g,'ws11','main');
 const last=put(g,'nn5','main');
 const count=g.state.p1.stacks.length;
 use(g,charger);
 assert(g.state.p1.hand.includes(fox)&&g.state.p1.hand.includes(link));
 assert.deepEqual(g.state.p1.main,[last,other]);
 assert.equal(g.state.p1.stacks.length,count+1);
 assert.equal(g.state.p1.stacks.at(-1).color,'白');
 assert(!g.playStatus(charger,'p1').ok);
}
{
 const design=Decks.whiteAdvancedDesign();
 const n=(section)=>design[section].reduce((sum,e)=>sum+e.count,0);
 assert.equal(n('main'),40);assert.equal(n('sideboard'),11);assert.equal(n('shields'),5);
 assert(design.stacks.every(c=>c==='白'));assert.equal(design.stacks.length,15);
 assert.deepEqual(Decks.validate(design),[]);
 assert(Decks.advancedBotIds.includes('whiteAdvanced'));
}
console.log('PASS white advanced draft deck, payment colors, lethal shields, link effects and synchro/fusion chain');

for(const [top,install,full] of [
 [['nn3','nn5'],false,false],
 [['wn2','nn5'],true,false],
 [['wn2','wn6'],true,false],
 [['wn2','nn5'],false,true],
 [['wn2'],true,false],
 [[],false,false]
]){
 const g=fixture();g.state.p1.main=[];
 if(full)for(let i=0;i<4;i++)put(g,'wn2','structures');
 const [a,b]=top.map(key=>put(g,key,'main'));
 const galaxy=put(g,'wr9');use(g,galaxy);
 if(install){
  assert.equal(g.operation.choice,'galaxyInstall');choose(g,a.id);
  assert.equal(g.locate(a.id).z,'structures');
  if(b){choose(g,b.id);assert.equal(g.locate(b.id).z,'hand');}
 }else if(a){
  assert.equal(g.operation.choice,'galaxyHand');choose(g,a.id);
  assert.equal(g.locate(a.id).z,'hand');assert.equal(g.locate(b.id).z,'trash');
 }
 assert.equal(g.operation,null);
}
{
 const g=fixture(),baronne=put(g,'sbwo1','signi-1');
 const fortress=put(g,'sbru4','trash'),charger=put(g,'sbws1','extra');
 g.state.p1.main=[];
 use(g,charger);assert(g.sideSpent('p1'));
 const stocks=g.state.p1.stacks.length, mana=g.paymentSources('p1').length;
 yes(g.beginWhiteAbility(baronne.id,'baronneRecover'));choose(g,fortress.id);
 assert(g.expansionCandidates().some(c=>c.id==='front'));
 choose(g,'sbru1-2');choose(g,'signi-1');
 assert.equal(fortress.name,'超戦覇龍 ガイNEXT');assert.equal(fortress.attack,12);
 assert.equal(g.state.p1.stacks.length,stocks);assert.equal(g.paymentSources('p1').length,mana);
 g.destroyUnit(fortress.id,'テスト');
 assert.equal(g.locate(fortress.id).z,'extra');assert.equal(fortress.key,'sbru4');assert(!fortress.awakened);
}
{
 const g=fixture();put(g,'wo1','signi-7','p2');
 const hand=put(g,'wn4');use(g,hand,'signi-1');assert.equal(g.locate(hand.id).z,'trash');
 const strong=put(g,'nn5');strong.attack=4;use(g,strong,'signi-1');assert.equal(g.locate(strong.id).z,'signi-1');
 const baronne=put(g,'sbwo1','signi-2');
 yes(g.beginWhiteAbility(baronne.id,'baronneRecover'));choose(g,hand.id);choose(g,'signi-2');
 assert.equal(g.locate(hand.id).z,'signi-2');
 const a=put(g,'wn4','signi-3'),b=put(g,'wn5','signi-4');
 summon(g,'sbws4','synchro',[a,b],'signi-3');choose(g,'done');
}
{
 const g=fixture();g.state.p1.main=[];
 const fox=put(g,'wn4','trash'),rabbit=put(g,'wn5','trash');
 const links=[put(g,'wn6','trash'),put(g,'wn6','trash')];
 const phantom=put(g,'sbws4','trash'),original=put(g,'sbws3','extra'),judgment=put(g,'sbwu2','trash');
 function reSummon(card,mode,materials,slot){
  yes(g.beginPayment(card.id));choose(g,mode);
  for(const m of materials)choose(g,m.id);
  choose(g,slot);assert.equal(g.locate(card.id).z,slot);
 }
 for(let round=0;round<2;round++){
  g.turn.sequence++;g.state.p1.energy.forEach(c=>c.rest=false);
  const serpent=put(g,'wu3');use(g,serpent,'signi-1');
  for(const card of [fox,rabbit,phantom,judgment])choose(g,card.id);
  assert.equal(g.locate(phantom.id).z,'extra');assert.equal(g.locate(judgment.id).z,'extra');
  assert.deepEqual(new Set(g.state.p1.main),new Set([fox,rabbit]));
  choose(g,'done');for(const link of links)choose(g,link.id);choose(g,'done');
  yes(g.beginSerpent(serpent.id));
  for(const [i,card] of [rabbit,fox].entries()){
   choose(g,card.id);yes(g.chooseSlot('signi-'+(i+1)));yes(g.confirmSideFree());choose(g,links[i].id);
   if(g.operation?.choice==='rizeriaLv2')choose(g,'done');
  }
  assert.equal(g.life.p1,22+round*2);
  reSummon(phantom,'synchro',[fox,rabbit],'signi-1');
  choose(g,fox.id);choose(g,rabbit.id);
  assert(g.state.p1.structures.every(c=>c.shieldLink&&!c.onEnter));
  const stocks=g.state.p1.stacks.length;
  reSummon(original,'links',[fox,rabbit],'signi-2');choose(g,'done');
  assert.equal(g.state.p1.stacks.length,stocks);
  reSummon(judgment,'synchro',[phantom,original],'signi-1');
  assert(!g.sideSpent('p1'));
  g.destroyUnit(judgment.id,'テスト');
  assert.equal(g.locate(judgment.id).z,'trash');assert.equal(g.locate(original.id).z,'extra');
  for(const card of [fox,rabbit,...links,phantom,original,judgment,serpent]){
   assert.equal(Object.values(g.state.p1).flat().filter(c=>c.id===card.id).length,1);
  }
 }
}
console.log('PASS Galaxy Shield, Baronne back face, hand-only 5000SW, and two same-instance Judgment Dragon chains');
{
 const g=fixture(),leader=g.character('p1'),before=g.state.p1.stacks.length;
 leader.level=0;
 yes(g.healLife('p1',1));yes(g.healLife('p1',1));
 assert.equal(g.state.p1.stacks.length,before+1);
 g.turn.sequence++;leader.level=4;
 yes(g.healLife('p1',1));
 assert.equal(g.state.p1.stacks.length,before+2);
 const enemy=put(g,'nn5','signi-1','p2'),life=g.life;
 g.destroyUnit(enemy.id,'テスト');
 assert.deepEqual(g.life,life);
 assert.equal(g.costBreakdown(cards.ws10,'p1').level4,0);
}
{
 const g=fixture(),fusion=put(g,'sbws3','extra');
 for(let i=1;i<=7;i++)put(g,'nn3','signi-'+i);
 put(g,'wn2','structures');put(g,'wn2','structures');
 assert(!g.playStatus(fusion,'p1').ok,'リンクだけでは満杯の盤面に空き枠を作れない');
}

function whiteStock(g,count){
 for(let i=0;i<count;i++)g.state.p1.stacks.push(g.card('白ストック','ストック','白',null,false,'p1'));
}
{
 const g=fixture(),leader=g.character('p1');
 leader.level=2;
 g.state.p1.stacks=[];
 const victim=put(g,'wn4','signi-1','p2');
 use(g,put(g,'nr1'));assert.equal(g.operation.choice,'rizeriaLv2');
 choose(g,victim.id);
 assert.equal(g.locate(victim.id).z,'trash');
 assert.equal(g.life.p1,26);
 assert.equal(g.state.p1.stacks.length,1);
 assert.equal(g.operation,null);
 use(g,put(g,'nr1'));choose(g,'done');
 assert.equal(g.life.p2,20);assert.equal(g.state.p1.stacks.length,1);
 use(g,put(g,'nr1'));choose(g,'opponent');
 assert.equal(g.life.p1,36);assert.equal(g.life.p2,18);
 assert.equal(g.state.p1.stacks.length,0);
}
{
 const g=fixture();g.character('p1').level=3;g.state.p1.stacks=[];whiteStock(g,6);
 use(g,put(g,'nr1'));assert.equal(g.operation,null);
 for(let n=0;n<2;n++){
  const victim=put(g,'nn5','signi-1','p2');victim.attack=5;
  use(g,put(g,'wn2'));assert.equal(g.operation.choice,'rizeriaLv3');choose(g,victim.id);
  assert.equal(g.locate(victim.id).z,'trash');
 }
 assert.equal(g.life.p2,16);assert.equal(g.state.p1.stacks.length,1);
}
{
 const g=fixture();g.character('p1').level=4;g.state.p1.stacks=[];whiteStock(g,6);
 const link=put(g,'wr9','structures'),otherLink=put(g,'wn2','structures');
 otherLink.stackCost=Mana.cost(0,{白:4});
 for(const card of [link,otherLink]){
  const victim=put(g,'nn5','signi-1','p2');
  yes(g.beginCharacterAbility('p1'));choose(g,card.id);choose(g,victim.id);
  assert.equal(g.locate(card.id).z,'trash');assert.equal(g.locate(victim.id).z,'trash');
 }
 assert.equal(g.life.p2,12);assert.equal(g.life.p1,24);
 assert.equal(g.state.p1.stacks.length,1);
 assert(!g.rizeriaReady('p1'));assert(!g.fieldCards('p1').some(c=>c.key==='t11'));
}
console.log('PASS リゼリアの新Lv2〜Lv4、任意発動・ストック・再誘発防止');
