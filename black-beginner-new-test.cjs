'use strict';
const A=require('node:assert/strict'), G=require('./game'), B=require('./bot'), D=require('./decks'), M=require('./mana');
const {fund,skipCharge}=require('./test-fixtures.cjs');
const yes=r=>A(r.ok,r.message);
const add=(g,k,z='hand',p='p1')=>{const c=g.fromDefinition(k,p);g.state[p][z].push(c);return c;};
function fixture(){
 const g=G.create({decks:{p1:'blackBeginner',p2:'blueBeginner'},random:()=>.4,strictTargets:true});
 yes(g.completeMulligan('p1'));yes(g.completeMulligan('p2'));skipCharge(g);
 for(const p of ['p1','p2']){g.state[p].hand=[];g.state[p].shields=[];}
 fund(g,'p1',8,'黒');return g;
}
function settle(g,choose){
 for(let i=0;g.operation&&i<150;i++){
  const p=g.decisionPlayer(),v=g.observe(p),o=g.operation;
  const a=choose?.(o,v)||(o.kind==='optionalEffect'?{type:'optional',use:false}:B.decide(v));
  yes(g.dispatch(a,p));
 }
 A.equal(g.operation,null);
}
function cast(g,c,slot='signi-1'){
 yes(g.beginPayment(c.id));if(c.type==='通常')yes(g.chooseSlot(slot));
 yes(g.confirmPayment());settle(g);
}
for(let n=1;n<=3;n++){
 const g=fixture();for(let i=0;i<n;i++)add(g,'ks13','structures');
 yes(g.setLife('p1',20));yes(g.loseLife('p1',1,'相手の効果'));A.equal(g.life.p1,19+2*n);
 yes(g.setLife('p1',30));yes(g.loseLife('p1',1));A.equal(g.life.p1,30);
 yes(g.setLife('p1',2));yes(g.loseLife('p1',1));A.equal(g.result.winner,'p2');
}
{
 const g=fixture();add(g,'ks13','structures');g.state.p1.main=[];g.state.p1.trash=[];yes(g.draw('p1',1));A.equal(g.life.p1,29);
}
for(const [key,n] of [['nn2',4],['nn4',3],['nn9',2],['rn15',6]]){
 const g=fixture();add(g,key,'signi-1');const hand=add(g,'ks14'),trash=add(g,'ks14','trash');
 A.equal(g.evolutionPaymentOptions(hand,'p1')[0].cost.黒,n);
 A.equal(g.evolutionPaymentOptions(trash,'p1')[0].cost.黒,n-2);
 add(g,'bluesage','lrig');A.equal(g.evolutionPaymentOptions(trash,'p1')[0].cost.黒,Math.max(1,n-2));
}
{
 const g=fixture();const a=add(g,'ks14'),b=add(g,'ks14','trash'),c=add(g,'ks14','trash');
 add(g,'nn9','signi-1');add(g,'nn2','trash');add(g,'nn3','trash');
 b.faceUp=false;c.faceUp=false;
 add(g,'kn10','trash');add(g,'kn10','trash');yes(g.setLife('p1',15));
 cast(g,a);
 g.turn.step='attack';
 for(const m of [a,b,c]){
  A(g.observe('p1').players.p1.units.some(u=>u.id===m.id),'蘇生後はBotから見える');
  A(!g.attackError(m.id));
  const action=B.decide(g.observe('p1'));
  A.deepEqual(action,{type:'attack',id:m.id,target:'body'});
  yes(g.dispatch(action,'p1'));settle(g);
 }
 A.equal(g.life.p2,12);
 const apaches=g.fieldCards('p1').filter(u=>u.key==='kn10');A.equal(apaches.length,2);
 for(const apache of apaches){A(!g.attackError(apache.id));yes(g.declareAttack(apache.id,'body'));settle(g);}
 A.equal(g.life.p2,4);
}
{
 const g=fixture(), m=add(g,'ks14','signi-1'), w=add(g,'bs5','trash');
 g.turn.step='attack';yes(g.declareAttack(m.id,'body'));settle(g);
 A.equal(g.locate(w.id).z,'trash');A.equal(g.locate(m.id).z,'trash');A.equal(g.life.p2,30);
}
{
 const g=fixture();const m=add(g,'ks14','signi-1'), ally=add(g,'nn2','trash');
 g.turn.step='attack';yes(g.declareAttack(m.id,'body'));settle(g);
 A.equal(g.locate(m.id).z,'trash');A(g.isUnit(g.locate(ally.id).z));
}
{
 const g=fixture();add(g,'ks13','structures');yes(g.setLife('p1',20));cast(g,add(g,'kn11'));
 A.equal(g.life.p1,21);A.equal(g.life.p2,29);
}
{
 const g=fixture(), c=add(g,'ks15');
 A.equal(g.effectiveCost(c,'p1').generic,6);
 const y=add(g,'redmoonavenger_shkl1','shields');y.faceUp=true;
 A.equal(g.effectiveCost(c,'p1').generic,0);yes(g.setLife('p1',7));
 cast(g,c);A.equal(g.life.p1,1);g.turn.step='attack';A(!g.attackError(c.id));
}
{
 const g=fixture(), c=add(g,'ks15');add(g,'redmoonavenger','lrig').level=4;
 add(g,'redmoonavenger_shkl1','shields').faceUp=true;yes(g.setLife('p1',6));cast(g,c);A.equal(g.result.winner,'p2');
}
{
 const g=fixture();const m=add(g,'ks14'), ally=add(g,'nn2','trash');
 const gate=add(g,'bn1','hand','p2');fund(g,'p2',2,'青');
 add(g,'nn9','signi-1');let used=false;
 yes(g.beginPayment(m.id));yes(g.chooseSlot('signi-1'));yes(g.confirmPayment());
 settle(g,(o,v)=>{
  if(o.kind==='response'){
   if(o.p==='p2'&&!used&&g.isUnit(g.locate(m.id)?.z)){used=true;return {type:'play',id:gate.id,method:'instant'};}
   return {type:'pass'};
  }
  if(o.kind==='starterChoice'&&o.choice==='unitBounce')return {type:'starter',id:m.id};
  if(o.kind==='graveChoice'&&o.miseryTrigger)return {type:'graveChoice',id:ally.id};
 });
 A(used);A.equal(g.locate(m.id).z,'hand');A(g.isUnit(g.locate(ally.id).z));
}
{
 const g=fixture(), m=add(g,'ks14','signi-1'), ally=add(g,'nn2','signi-2'), next=add(g,'ks14','trash');
 const gate=add(g,'bn1','hand','p2');fund(g,'p2',2,'青');let used=false;
 g.turn.step='attack';yes(g.declareAttack(m.id,'body'));
 settle(g,(o)=>{
  if(o.kind==='response'){
   if(o.p==='p2'&&!used){used=true;return {type:'play',id:gate.id,method:'instant'};}
   return {type:'pass'};
  }
  if(o.kind==='starterChoice'&&o.choice==='unitBounce')return {type:'starter',id:ally.id};
  if(['payment','freeCast'].includes(o.kind)&&o.id===gate.id&&!o.targetId)return {type:'useTarget',id:ally.id};
 });
 A(used);A.equal(g.locate(ally.id).z,'hand');
 A(g.isUnit(g.locate(next.id).z));A.equal(next.rest,true);
 A.equal(g.life.p2,30);
}
const deck=D.preset('blackBeginner');
A.equal(deck.main.reduce((n,c)=>n+c.count,0),40);A.equal(deck.sideboard.reduce((n,c)=>n+c.count,0),10);A.equal(deck.shields.reduce((n,c)=>n+c.count,0),4);
console.log('PASS black beginner cards, cost floors, damage, forced revival, self-destruction, 18/26-point chain');
