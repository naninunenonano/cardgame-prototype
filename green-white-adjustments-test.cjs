'use strict';
const A=require('node:assert/strict'), R=require('./game'), C=require('./cards'), D=require('./decks'), B=require('./bot'), M=require('./mana');
const {fund}=require('./test-fixtures.cjs');
const yes=r=>A(r.ok,r.message);
function game(){
 const g=R.create({random:()=>0.4,strictTargets:true,clock:()=>1000});
 for(const p of g.PLAYERS){
  yes(g.completeMulligan(p));g.state[p].hand=[];g.state[p].shields=[];g.state[p].energy=[];
 }
 g.turn.step='main1';return g;
}
function put(g,key,p='p1',z='hand'){
 const c=g.fromDefinition(key,p);g.state[p][z].push(c);return c;
}
function settle(g){
 for(let i=0;g.operation&&i<100;i++){
  const p=g.decisionPlayer(),action=B.decide(g.observe(p));
  yes(g.dispatch(action,p));
 }
 A.equal(g.operation,null);
}
function play(g,c,slot,method){
 yes(g.beginPayment(c.id,method));if(slot)yes(g.chooseSlot(slot));settle(g);
}
function advance(g){g.turn.notBefore=0;yes(g.advance());settle(g);}
const zone=(g,c)=>g.locate(c.id)?.z;

{
 const g=game(),dragon=put(g,'gs1','p1','signi-1'),foe=put(g,'nn4','p2','signi-1');
 A.equal(dragon.attack,10);A.equal(dragon.maxHealth,10);A.deepEqual(dragon.cost,M.cost(4,{緑:6}));
 A.deepEqual(g.effectiveCost(put(g,'gs1'),'p1'),M.cost(4,{緑:6}));
 g.turn.step='attack';dragon.sick=true;dragon.enteredTurn=g.turn.counts.p1;
 A(!g.attackTargets(dragon.id).some(x=>x.id==='body'));
 yes(g.declareAttack(dragon.id,foe.id));settle(g);A.equal(g.life.p2,20-(10-foe.maxHealth));
}
{
 const g=game(),defender=put(g,'gs1','p2','signi-1'),attacker=put(g,'nn4','p1','signi-1');
 defender.rest=true;g.turn.step='attack';yes(g.declareAttack(attacker.id,defender.id));settle(g);
 A.equal(g.life.p1,20);A.equal(zone(g,attacker),'trash');
}
for(const allies of [3,4]){
 const g=game();fund(g,'p1',7,'緑');
 for(let i=1;i<=allies;i++)put(g,'nn2','p1','signi-'+i);
 const c=put(g,'gs6');A.equal(g.playStatus(c,'p1').gzero,allies===4);
 if(allies===3)A(!g.beginPayment(c.id,'gzero').ok);
 yes(g.beginPayment(c.id,allies===4?'gzero':'paid'));
 A.equal(M.total(g.operation.cost),allies===4?0:7);
 yes(g.chooseSlot('signi-'+(allies+1)));yes(g.confirmPayment());settle(g);
 A.equal(c.attack,2+allies);A.equal(c.maxHealth,2+allies);
 g.destroyUnit(g.state.p1['signi-1'][0].id);
 A.equal(c.attack,2+allies);
}
{
 const g=game();fund(g,'p1',3,'緑');
 const c=put(g,'gr5'),victim=put(g,'kn1','p2','signi-1');
 const start=g.state.p2.main.length;
 play(g,c);
 A.equal(zone(g,victim),'energy');A.equal(g.state.p2.main.length,start);
 A(!g.battleLog('p1',{detailed:true}).some(e=>e.kind==='unitDestroyed'&&e.card?.instanceId===victim.id));
 A.equal(D.canonicalKey('gs2'),'gr5');
}
{
 const g=game();fund(g,'p1',4,'青');const gaia=put(g,'gs5','p2'),top=g.state.p2.main.slice(0,2);
 const spell=put(g,'br5');yes(g.beginPayment(spell.id));yes(g.confirmPayment());
 A.equal(g.operation.kind,'optionalEffect');yes(g.resolveOptional(true));
 A.equal(zone(g,gaia),'signi-1');A(top.every(c=>zone(g,c)==='energy'));
 for(const c of top)yes(g.resolveExpansion(c.id));
 A(top.every(c=>zone(g,c)==='hand'));
 g.destroyUnit(gaia.id);A.equal(zone(g,gaia),'trash');A.equal(g.operation,null);
}
{
 const g=game();const eira=put(g,'eira','p1','lrig');eira.level=3;
 for(const k of ['wn1','wn2','wr1'])put(g,k,'p1','structures');
 const first=put(g,'ws7','p1','main'),second=put(g,'ws7','p1','main'),foe=put(g,'nn9','p2','signi-1');
 g.turn.step='main2';advance(g);
 A(g.isUnit(zone(g,first)));A.equal(zone(g,second),'main');A.equal(zone(g,foe),'exile');
 yes(g.setLife('p1',10));g.turn.step='end';yes(g.soloNextPlayer('p2'));g.turn.step='main1';fund(g,'p2',6,'緑');
 play(g,put(g,'nn2','p2'),'signi-1');A.equal(g.life.p1,12);
 play(g,put(g,'nn2','p2'),'signi-2');A.equal(g.life.p1,12);
}
{
 const g=game();fund(g,'p1',12,'白');yes(g.setLife('p1',10));
 const a=put(g,'ws8');play(g,a,'signi-1');A.equal(g.life.p1,11);A.equal(g.state.p1.hand.length,1);
 const b=put(g,'ws8','p1','signi-2');
 a.health=b.health=1;
 const h=g.state.p1.hand.length;yes(g.beginRituel(a.id));A.equal(M.total(g.operation.cost),1);yes(g.confirmRulePayment());settle(g);
 A.equal(g.life.p1,12);A.equal(a.health,2);A.equal(b.health,2);A.equal(g.state.p1.hand.length,h+2);
 A(!g.beginRituel(a.id).ok);
 b.sick=false;g.turn.step='attack';yes(g.declareAttack(b.id,'body'));settle(g);
 g.turn.step='main2';yes(g.beginRituel(b.id));A.equal(M.total(g.operation.cost),0);yes(g.confirmRulePayment());settle(g);
 A.equal(g.life.p1,13);A(!g.beginRituel(b.id).ok);
}
{
 const g=game();fund(g,'p1',15,'白');yes(g.setLife('p1',10));
 const a=put(g,'ws9');play(g,a,'signi-1');
 const link=g.state.p1.structures[0];A.equal(link.key,'t14');A.equal(g.life.p1,11);
 put(g,'ws8','p1','signi-3');const b=put(g,'ws9'),h=g.state.p1.hand.length;
 play(g,b,'signi-2');A.equal(g.life.p1,11);A.equal(g.state.p1.hand.length,h);A.equal(g.state.p1.structures[0],link);
 A(g.vanishedIds.length>0);
 g.destroyUnit(a.id);advance(g);A.equal(g.life.p1,12);
 A(!g.targetOptions({kind:'enemyBounce'},'p2').some(c=>c.id===link.id));
 A(!g.dispatch({type:'linkDestroy',id:link.id},'p1').ok);
 g.turn.step='main2';const victim=put(g,'gs1','p2','signi-1');
 play(g,put(g,'wr7'));A.equal(victim.health,2);A.equal(zone(g,link),'structures');
 play(g,put(g,'wr6'));A.equal(victim.health,1);
 play(g,put(g,'ws6'));A.equal(zone(g,link),'structures');
}
{
 const g=game();const eira=put(g,'eira','p1','lrig');eira.level=2;
 const firstAid=put(g,'shnr3','p1','shields');firstAid.faceUp=false;
 yes(g.loseLife('p1',4));settle(g);
 A(firstAid.faceUp);A.equal(g.life.p1,20);A.equal(g.life.p2,18);
 const castle=put(g,'wn1','p1','structures');
 yes(g.loseLife('p1',4));settle(g);A.equal(zone(g,castle),'trash');A.equal(g.life.p1,20);
}
{
 const g=game();fund(g,'p1',8,'白');
 const falcon=put(g,'wr1');play(g,falcon);
 A.equal(zone(g,falcon),'structures');g.turn.step='end';yes(g.soloNextPlayer('p1'));settle(g);
 A.equal(zone(g,falcon),'trash');
}
for(const k of ['greenBeginner','whiteBeginner']){
 const d=D.preset(k);A.deepEqual(D.validate(d),[]);
 A.deepEqual(['main','sideboard','shields'].map(z=>d[z].reduce((n,c)=>n+c.count,0)),[40,1,4]);
}
A.equal(D.preset('whiteBeginner').shields.find(c=>c.key==='shnr3').count,2);
A.equal(C.cards.wr6.cost.generic,1);
console.log('PASS green/white card adjustment, targeting, effects and decks');
