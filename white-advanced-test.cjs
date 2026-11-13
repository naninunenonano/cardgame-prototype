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
 const next=put(g,'sbws3','extra');assert(!g.playStatus(next,'p1').ok);
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
 assert.equal(g.locate(baronne.id).z,'extra');
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
 assert(Decks.validate(design).some(error=>error.includes('ギャラクシー・シールド')));
 assert(!Decks.advancedBotIds.includes('whiteAdvanced'));
}
console.log('PASS white advanced draft deck, payment colors, lethal shields, link effects and synchro/fusion chain');
