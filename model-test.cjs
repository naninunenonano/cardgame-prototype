const assert=require('node:assert/strict'),R=require('./game.js'),M=require('./mana.js');
let time=0;const make=()=>R.create({clock:()=>time});const yes=r=>assert.equal(r.ok,true,r.message),no=r=>assert.equal(r.ok,false,r.message);
const all=(g,p)=>Object.values(g.state[p]).flat(),ids=g=>['p1','p2'].flatMap(p=>all(g,p)).map(c=>c.id).sort().join();
const ready=g=>{yes(g.completeMulligan('p1',[],true));yes(g.completeMulligan('p2',[],true));};
const advance=g=>{time+=500;yes(g.advance());};
const toEnd=g=>{while(g.turn.step!=='end')advance(g);if(g.operation?.kind==='discard'){for(const c of g.state.p1.hand.slice(0,g.operation.required))yes(g.toggleDiscard(c.id));yes(g.confirmDiscard());}};
function fixture(){const g=make();ready(g);for(const p of ['p1','p2'])for(const z of g.ZONES)g.state[p][z.id]=[];for(const p of ['p1','p2'])for(let n=0;n<20;n++)g.state[p].main.push(g.card('山札確認','通常','赤',M.cost(0)));return g;}
function unit(g,p,z,power=1000,blocker=false){const c=g.card('確認用ユニット','通常','赤',M.cost(0));c.power=power;c.abilities=blocker?['ブロッカー']:[];yes(g.addCard(p,z,c));return c;}
// 共通60枚・パワー・能力なし・0〜7枚マリガンを複数回確認。
for(let repeat=0;repeat<8;repeat++)for(const n of [0,1,3,7]){
 const g=make();for(const p of ['p1','p2']){assert.equal(all(g,p).length,60);assert.equal(g.state[p].hand.length,7);assert.equal(all(g,p).filter(c=>c.basic).length,24);for(let cost=1;cost<=12;cost++){const a=all(g,p).filter(c=>c.type==='通常'&&M.total(c.cost)===cost);assert.equal(a.length,3);assert(a.every(c=>c.power===cost*1000&&c.abilities.length===0));}assert(all(g,p).filter(c=>c.type==='土地').every(c=>c.power===null));}
 const original=ids(g),returned=g.state.p1.hand.slice(0,n).map(c=>c.id),top=g.state.p1.main.slice(0,n).map(c=>c.id);yes(g.completeMulligan('p1',returned));assert(returned.every(id=>!g.state.p1.hand.some(c=>c.id===id)));assert(top.every(id=>g.state.p1.hand.some(c=>c.id===id)));assert.equal(g.state.p1.life.length,0);no(g.completeMulligan('p1'));yes(g.completeMulligan('p2',[],true));
 for(const p of ['p1','p2'])assert.deepEqual([g.state[p].hand.length,g.state[p].life.length,g.state[p].main.length],[7,7,46]);assert.equal(ids(g),original);assert.equal(g.turn.number,1);assert.equal(g.turn.step,'main1');
}
// 色指定と上書きの一括確定・キャンセル・直前変更・二重実行。
{
 const g=fixture();for(let n=1;n<=7;n++)unit(g,'p1','signi-'+n);const incoming=g.card('8枚目','通常','赤',M.cost(1,{赤:1}));yes(g.addCard('p1','hand',incoming));for(let i=0;i<2;i++)yes(g.addCard('p1','energy',g.card('赤土地','土地')));
 assert.equal(g.playStatus(incoming,'p1').ok,true);const before=JSON.stringify(g.state);yes(g.beginPayment(incoming.id));yes(g.chooseSlot('signi-3'));yes(g.cancelPayment());assert.equal(JSON.stringify(g.state),before);
 yes(g.beginPayment(incoming.id));yes(g.chooseSlot('signi-3'));const old=g.state.p1['signi-3'][0],o=g.operation;const allBefore=ids(g);yes(g.confirmPayment(o));no(g.confirmPayment(o));assert.equal(g.state.p1.trash[0],old);assert.equal(g.state.p1['signi-3'][0],incoming);assert.equal(ids(g),allBefore);assert.equal(g.state.p1.energy.filter(c=>c.rest).length,2);assert.equal(incoming.sick,true);
 g.state.p1.energy.forEach(c=>c.rest=false);const extra=g.card('9枚目','通常','赤',M.cost(0,{赤:1}));yes(g.addCard('p1','hand',extra));yes(g.beginPayment(extra.id));yes(g.chooseSlot('signi-4'));g.state.p1.energy[0].rest=true;const invalid=JSON.stringify(g.state);no(g.confirmPayment());assert.equal(JSON.stringify(g.state),invalid);yes(g.cancelPayment());
}
// 召喚酔いは縦横とは別。次の自分ターンだけで解除。
{
 const g=fixture(),c=unit(g,'p1','signi-1');yes(g.toggle(c.id));yes(g.toggle(c.id));assert.equal(c.sick,true);advance(g);no(g.declareAttack(c.id));advance(g);advance(g);advance(g);assert.equal(g.turn.number,2);assert.equal(c.sick,false);assert.equal(c.rest,false);advance(g);yes(g.declareAttack(c.id));yes(g.resolveAttack(null));assert(g.log.some(t=>t.includes('シールドなしで本体への攻撃が通った')));assert.equal(g.result,null);
}
// ブロッカー限定、召喚酔いでも防御、同値は攻撃側有利、シールド処理なし。
for(const [attack,defend,defenderRemoved]of [[3000,1000,true],[2000,2000,true],[1000,3000,false]]){
 const g=fixture(),a=unit(g,'p1','signi-1',attack),b=unit(g,'p2','signi-1',defend,true),non=unit(g,'p2','signi-2',9999,false);yes(g.toggle(a.id,'sick'));assert.equal(b.sick,true);const shield=g.card('盾','通常');shield.faceUp=false;g.state.p2.life.push(shield);const before=ids(g);advance(g);yes(g.declareAttack(a.id));assert(a.rest);no(g.resolveAttack(non.id));assert(!non.rest);yes(g.chooseBlocker(b.id));const o=g.operation;yes(g.resolveAttack(b.id,o));no(g.resolveAttack(b.id,o));assert.equal(g.state.p2.life.length,1);assert(b.rest);assert.equal(ids(g),before);assert.equal(g.locate((defenderRemoved?b:a).id).z,'trash');assert.equal(g.locate((defenderRemoved?a:b).id).z,'signi-1');assert((defenderRemoved?a:b).rest);
}
{
 const g=fixture(),a=unit(g,'p1','signi-1',12000),used=unit(g,'p2','signi-1',1000,true);yes(g.toggle(a.id,'sick'));yes(g.toggle(used.id));assert.equal(g.blockers('p2').length,0);const shield=g.card('盾','通常');shield.faceUp=false;g.state.p2.life.push(shield);const h=g.state.p2.hand.length;advance(g);yes(g.declareAttack(a.id));no(g.resolveAttack(used.id));yes(g.resolveAttack(null));assert.equal(g.state.p2.life.length,0);assert.equal(g.state.p2.hand.length,h+1);assert.equal(g.state.p2.hand.at(-1),shield);assert(shield.faceUp);no(g.declareAttack(a.id));
}
// 手札は途中では超過を許可し、エンドの選択完了まで進めない。
{
 const g=fixture();for(let i=0;i<9;i++)yes(g.addCard('p1','hand',g.card('手札','通常')));assert.equal(g.state.p1.trash.length,0);advance(g);advance(g);advance(g);assert.equal(g.operation.kind,'discard');assert.equal(g.operation.required,2);no(g.advance());no(g.confirmDiscard());const chosen=g.state.p1.hand.slice(0,2);chosen.forEach(c=>yes(g.toggleDiscard(c.id)));const old=g.operation;yes(g.confirmDiscard(old));no(g.confirmDiscard(old));assert.equal(g.state.p1.hand.length,7);assert.deepEqual(g.state.p1.trash,chosen);advance(g);assert.equal(g.state.p1.hand.length,8);assert.equal(g.turn.number,2);
}
// メイン1・2で土地回数を共有、相手は自動回復しない。
{
 const g=fixture(),l1=g.card('土地1','土地'),l2=g.card('土地2','土地');yes(g.addCard('p1','hand',l1));yes(g.addCard('p1','hand',l2));yes(g.placeLand(l1.id));yes(g.manualMove(l1.id,'p1','hand'));no(g.placeLand(l2.id));advance(g);no(g.placeLand(l2.id));advance(g);no(g.placeLand(l2.id));const enemy=unit(g,'p2','signi-1');yes(g.toggle(enemy.id));const opponent=JSON.stringify(g.state.p2);advance(g);advance(g);assert.equal(g.turn.number,2);assert.equal(JSON.stringify(g.state.p2),opponent);yes(g.placeLand(l2.id));
}
// 最後のドロー時点で敗北・複数ドロー停止・非ドロー移動では敗北しない。
{
 const g=fixture();g.state.p1.trash.push(...g.state.p1.main.splice(0,18));const last=g.state.p1.main.at(-1);const before=g.state.p1.hand.length;yes(g.draw('p1',5));assert.equal(g.state.p1.hand.length,before+2);assert.equal(g.state.p1.hand.at(-1),last);assert.equal(g.result.loser,'p1');assert.equal(g.state.p1.main.length,0);assert.equal(g.state.p1.trash.length,18);no(g.advance());g.reset();assert.equal(g.result,null);assert.equal(g.turn.number,0);ready(g);assert.equal(g.turn.number,1);
 const other=fixture();for(const c of [...other.state.p1.main])yes(other.manualMove(c.id,'p1','exile'));assert.equal(other.result,null);assert.equal(other.state.p1.main.length,0);assert.equal(other.state.p1.exile.length,20);yes(other.draw('p1'));assert.equal(other.result,null);
}
// 色マナの回帰。
const rr=M.cost(2,{赤:2}),lands=(red,blue)=>Array.from({length:red+blue},(_,i)=>({id:String(i),type:'土地',rest:false,mana:{color:i<red?'赤':'青',amount:1}}));assert(M.payment(rr,lands(2,2)).ok);assert(!M.payment(rr,lands(1,3)).ok);assert.deepEqual(M.suggest(rr,[...lands(1,2),{id:'r2',type:'土地',rest:false,mana:{color:'赤',amount:1}}]).slice(0,2),['0','r2']);
console.log('PASS model: 32 opening runs, exact 60 cards/power/no default abilities, mulligan, atomic overwrite/cancel/failure, sickness, blocker eligibility and 3 power comparisons, shield transfer/zero shield, end discard lock, shared land counter, solo recovery, draw-last loss/multidraw/non-draw exclusion, colored mana.');
