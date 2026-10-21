// 画面から独立した試作ルール。clock/randomはテストで差し替え可能。
(function(root,factory){
  const rules=factory(typeof module==='object'&&module.exports?require('./mana.js'):root.ManaEngine);
  if(typeof module==='object'&&module.exports)module.exports=rules;else root.GameRules=rules;
})(globalThis,function(Mana){
'use strict';
const ZONES=[...Array.from({length:7},(_,i)=>({id:`signi-${i+1}`,name:`ユニット${i+1}`,class:'unit'})),
 {id:'lrig',name:'ルリグ',class:'lrig'},{id:'extra',name:'サイドボード',pile:true},{id:'main',name:'メインデッキ',pile:true},
 {id:'life',name:'シールド',pile:true},{id:'energy',name:'マナゾーン'},{id:'trash',name:'トラッシュ',pile:true},
 {id:'exile',name:'除外ゾーン',pile:true},{id:'check',name:'チェックゾーン'},{id:'hand',name:'手札',class:'hand'}];
const PLAYERS=['p1','p2'],SELF='p1';
const STEPS={untap:'アンタップ',draw:'ドロー',main1:'メイン1',attack:'アタック',main2:'メイン2',end:'エンド'};
const isUnit=z=>ZONES.some(zone=>zone.id===z&&zone.class==='unit');
const isField=z=>isUnit(z)||z==='lrig';
const label=p=>p==='p1'?'プレイヤー1':'プレイヤー2';
function create({clock=()=>Date.now(),random=()=>Math.random()}={}) {
 let state,status,turn,mulligan,operation,result,serial=0,log=[];
 const record=message=>{log.push(message);if(log.length>100)log.shift();};
 const ok=message=>{if(message)record(message);return {ok:true,message:message||''};};
 const fail=message=>({ok:false,message});
 function card(name,type,color='赤',cost=null,basic=false,origin=null) {
  const required=type==='土地'||cost===null?null:typeof cost==='number'?Mana.cost(cost):cost;
  return {id:`card-${++serial}`,name,type,color,cost:required,basic,origin,faceUp:true,rest:false,
   power:type==='通常'&&required!==null?Mana.total(required)*1000:null,abilities:[],sick:false,
   mana:type==='土地'?{color,amount:1}:null};
 }
 function buildDeck(p) {
  const a=[];
  for(let n=1;n<=12;n++)for(let copy=0;copy<3;copy++)a.push(card(`赤・${n}コスト`,'通常','赤',Mana.cost(n-1,{赤:1}),false,p));
  for(let n=0;n<24;n++)a.push(card('赤の基本土地','土地','赤',null,true,p));
  a.forEach(c=>c.faceUp=false);return a;
 }
 function validateDeck(a) {
  if(a.length!==60)throw Error('メインデッキは60枚です。');
  const counts=new Map();for(const c of a){if(c.basic&&c.type==='土地')continue;counts.set(c.name,(counts.get(c.name)||0)+1);if(counts.get(c.name)>3)throw Error('基本土地以外の同名カードは3枚までです。');}
 }
 function shuffleRaw(p,z) {const a=state[p][z];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}}
 function loseByDraw(p) {
  result={loser:p,reason:'ドローによる山札切れ'};operation=null;turn.key={};
  record(`${label(p)}が山札の最後の1枚をドロー。山札切れにより敗北しました。`);
 }
 function drawRaw(p,count) {
  let drawn=0;
  for(let i=0;i<count&&!result;i++) {
   const c=state[p].main.shift();if(!c){record(`${label(p)}：山札にカードがないためドローできません。`);break;}
   c.faceUp=true;c.rest=false;state[p].hand.push(c);drawn++;
   if(state[p].main.length===0){loseByDraw(p);break;}
  }
  return drawn;
 }
 function putShield(p,count) {const a=state[p].main.splice(0,count);a.forEach(c=>{c.faceUp=false;c.rest=false;});state[p].life.push(...a);}
 function reset() {
  serial=0;log=[];result=null;operation=null;status='mulligan';turn={number:0,step:'untap',landsPlaced:0,key:{},notBefore:0,lastDraw:0};mulligan={p1:'pending',p2:'pending'};
  state=Object.fromEntries(PLAYERS.map(p=>[p,Object.fromEntries(ZONES.map(z=>[z.id,[]]))]));
  for(const p of PLAYERS){state[p].main=buildDeck(p);validateDeck(state[p].main);shuffleRaw(p,'main');drawRaw(p,7);}
  record('60枚デッキをシャッフルし、初期手札7枚を配りました。');return ok('各プレイヤーのマリガンを選択してください。');
 }
 function completeMulligan(p,ids=[],skip=false) {
  if(status!=='mulligan'||mulligan[p]!=='pending'||result)return fail('このプレイヤーのマリガンは完了しています。');
  if(new Set(ids).size!==ids.length||ids.length>7||ids.some(id=>!state[p].hand.some(c=>c.id===id)))return fail('初期手札から0〜7枚を選んでください。');
  mulligan[p]='done';
  if(!skip){const selected=new Set(ids),a=state[p].hand.filter(c=>selected.has(c.id));state[p].hand=state[p].hand.filter(c=>!selected.has(c.id));a.forEach(c=>{c.faceUp=false;c.rest=false;});state[p].main.push(...a);drawRaw(p,a.length);if(!result)shuffleRaw(p,'main');}
  record(`${label(p)}：${skip?'交換せず確定':ids.length+'枚交換、ドロー後にシャッフル'}。`);
  if(!result&&PLAYERS.every(w=>mulligan[w]==='done')){for(const w of PLAYERS)putShield(w,7);status='ready';beginTurn();}
  return ok(result?'山札切れにより開始処理を終了しました。':status==='ready'?'シールドを7枚ずつ配置し、第1ターンを開始しました。':'もう一人のマリガンを選択してください。');
 }
 function locate(id) {for(const p of PLAYERS)for(const z of ZONES){const index=state[p][z.id].findIndex(c=>c.id===id);if(index>=0)return {p,z:z.id,index,card:state[p][z.id][index]};}return null;}
 function rawMove(source,p,z,bottom=true) {const [c]=state[source.p][source.z].splice(source.index,1);if(isUnit(z)&&!isUnit(source.z))c.sick=true;if(bottom)state[p][z].push(c);else state[p][z].unshift(c);return c;}
 function interactionError() {if(result)return '山札切れで終了しています。最初からやり直してください。';if(status!=='ready')return '開始準備中は通常操作を使えません。';if(operation)return '選択中の処理を完了してください。';return '';}
 function mainError(p,allowPayment=false) {if(result)return '山札切れで終了しています。';if(status!=='ready')return '開始準備中です。';if(p!==SELF)return '相手側は手動確認のみです。';if(!['main1','main2'].includes(turn.step))return '土地配置とユニットの使用はメイン1・メイン2で行ってください。';if(operation&&!(allowPayment&&operation.kind==='payment'))return '選択中の処理を完了してください。';return '';}
 function manualMove(id,p,z,bottom=false) {
  const source=locate(id),error=interactionError();if(error)return fail(error);if(!source||!state[p]?.[z])return fail('カードまたは領域が見つかりません。');
  if(z==='energy'&&source.card.type!=='土地')return fail('土地以外はマナゾーンに置けません。');
  if(isUnit(z)&&state[p][z].length&&!(source.p===p&&source.z===z))return fail('ユニット枠は1枚です。空き枠への手動移動か、通常の上書き配置を使用してください。');
  if(z==='extra'&&state[p].extra.length>=10&&!(source.p===p&&source.z===z))return fail('サイドボードは10枚枠です。');
  rawMove(source,p,z,bottom);return ok(z==='exile'?'明示的な手動操作で除外ゾーンへ移しました。':'手動移動（ルール外の補助）を実行しました。土地配置回数は変更しません。');
 }
 function addCard(p,z,c) {
  const error=interactionError();if(error)return fail(error);if(!state[p]?.[z])return fail('追加先が見つかりません。');
  if(z==='energy'&&c.type!=='土地')return fail('土地以外はマナゾーンに置けません。');
  if(isUnit(z)&&state[p][z].length)return fail('ユニット枠は1枚です。空き枠を選んでください。');
  if(z==='extra'&&state[p].extra.length>=10)return fail('サイドボードは10枚枠です。');
  if(isUnit(z))c.sick=true;state[p][z].push(c);return ok('ルール外の補助として仮カードを追加しました。');
 }
 function toggle(id,property='rest') {
  const error=interactionError(),s=locate(id);if(error)return fail(error);if(!s)return fail('カードが見つかりません。');
  if(!['rest','faceUp','sick'].includes(property))return fail('変更できない項目です。');
  if(property==='sick'&&(!isUnit(s.z)||s.card.type!=='通常'))return fail('場の仮ユニットを選んでください。');
  s.card[property]=!s.card[property];return ok(property==='sick'?'補助操作で召喚酔いを変更しました。':'補助操作でカードの状態を変更しました。');
 }
 function readyMana(p) {const e=interactionError();if(e)return fail(e);state[p].energy.forEach(c=>c.rest=false);return ok('補助操作で土地を未使用に戻しました。');}
 function remove(id) {const e=interactionError(),s=locate(id);if(e)return fail(e);if(!s)return fail('カードが見つかりません。');state[s.p][s.z].splice(s.index,1);return ok('補助操作でカードを削除しました。');}
 function draw(p,n=1) {const e=interactionError();if(e)return fail(e);if(!Number.isInteger(n)||n<1)return fail('ドロー枚数が不正です。');const count=drawRaw(p,n);return ok(result?`${label(p)}：ドローによる山札切れで敗北。`:`手動ドロー（補助）：${label(p)}が${count}枚引きました。`);}
 function shuffle(p,z) {const e=interactionError();if(e)return fail(e);shuffleRaw(p,z);return ok('山札をシャッフルしました。');}
 function availableMana(p) {return Mana.pool(state[p].energy);}
 function landError(id) {const s=locate(id);const e=mainError(s?.p);if(e)return e;if(!s||s.z!=='hand'||s.card.type!=='土地')return '手札の土地を選んでください。';if(turn.landsPlaced>=1)return 'このターンは土地を配置済み';return '';}
 function placeLand(id) {const e=landError(id);if(e)return fail(e);const s=locate(id),c=rawMove(s,SELF,'energy');c.faceUp=true;turn.landsPlaced++;return ok('土地を配置しました。このターンは土地を配置済みです。');}
 function unitSlots(p) {return ZONES.filter(z=>isUnit(z.id));}
 function placementOptions(p) {const slots=unitSlots(p),empty=slots.filter(z=>!state[p][z.id].length);return empty.length?empty:slots;}
 function playStatus(c,p) {
  if(c.type==='土地'){const e=landError(c.id);return {ok:!e,text:e||'マナに置く',reasons:e?[e]:[]};}
  if(c.type!=='通常'||!c.cost)return {ok:false,text:'通常使用の対象外',reasons:['通常使用の対象外です。']};
  const reasons=[],e=mainError(p);if(e)reasons.push(e);const assessed=Mana.assess(c.cost,availableMana(p));reasons.push(...assessed.reasons);
  return {ok:!reasons.length,text:reasons[0]||('マナ支払い可'+(unitSlots(p).every(z=>state[p][z.id].length)?'（上書き可）':'')),reasons};
 }
 function beginPayment(id) {const s=locate(id);if(!s||s.z!=='hand'||s.card.type!=='通常')return fail('手札の通常ユニットを選んでください。');const assessed=playStatus(s.card,s.p);if(!assessed.ok)return fail(assessed.reasons.join('／'));operation={kind:'payment',id,p:s.p,slot:null,replacedId:null,landIds:Mana.suggest(s.card.cost,state[s.p].energy)};return ok('配置先・上書き対象と支払い内容を確認してください。');}
 function chooseSlot(z) {const o=operation;if(o?.kind!=='payment')return fail('支払い操作がありません。');if(!placementOptions(o.p).some(s=>s.id===z))return fail('空き枠を選んでください。満杯時のみ上書きできます。');o.slot=z;o.replacedId=state[o.p][z][0]?.id||null;return ok('配置先を選びました。');}
 function togglePaymentLand(id) {const o=operation;if(o?.kind!=='payment')return fail('支払い操作がありません。');const c=state[o.p].energy.find(c=>c.id===id);if(!c||c.rest||c.type!=='土地')return fail('自分の未使用土地を選んでください。');o.landIds=o.landIds.includes(id)?o.landIds.filter(x=>x!==id):[...o.landIds,id];return ok('支払い案を変更しました。');}
 function paymentInfo(expected=operation) {
  const o=operation;if(!o||o!==expected||o.kind!=='payment')return fail('この支払い操作は終了しています。');const e=mainError(o.p,true);if(e)return fail(e);
  const s=locate(o.id);if(!s||s.p!==o.p||s.z!=='hand'||s.card.type!=='通常'||!s.card.cost)return fail('対象ユニットが手札にありません。');
  if(!isUnit(o.slot))return fail('配置先を選んでください。');const current=state[o.p][o.slot];
  if(current.length>1||(current[0]?.id||null)!==o.replacedId)return fail('配置先または上書き対象が変わりました。選び直してください。');
  if(o.replacedId&&unitSlots(o.p).some(z=>!state[o.p][z.id].length))return fail('空き枠があります。配置先を選び直してください。');
  if(new Set(o.landIds).size!==o.landIds.length)return fail('土地の重複選択はできません。');const lands=o.landIds.map(id=>state[o.p].energy.find(c=>c.id===id));
  if(lands.some(c=>!c||c.type!=='土地'||c.rest||!c.mana))return fail('自分のマナゾーンの未使用土地だけを選んでください。');const payment=Mana.payment(s.card.cost,lands);if(!payment.ok)return fail(payment.reasons.join('／'));
  return {ok:true,source:s,lands,replacement:current[0]||null};
 }
 function confirmPayment(expected=operation) {
  const checked=paymentInfo(expected);if(!checked.ok)return checked;const o=operation;operation=null;
  checked.lands.forEach(c=>c.rest=true);if(checked.replacement){const old=state[o.p][o.slot].shift();state[o.p].trash.push(old);record(`${old.name}を上書きでトラッシュへ送りました。`);}
  const c=rawMove(checked.source,o.p,o.slot);c.faceUp=true;c.rest=false;c.sick=true;
  return ok(`${c.name}を配置。土地${checked.lands.length}枚を使用済みにしました。召喚酔いでこのターンは攻撃できません。`);
 }
 function cancelPayment() {if(operation?.kind!=='payment')return fail('キャンセルできる支払い操作はありません。');operation=null;return ok('支払いをキャンセルしました。カードと土地は変更していません。');}
 function beginTurn() {
  operation=null;turn.number++;turn.key={};turn.step='untap';turn.lastDraw=0;
  for(const z of ZONES)if(isField(z.id)||z.id==='energy')state[SELF][z.id].forEach(c=>{c.rest=false;if(isField(z.id))c.sick=false;});
  turn.landsPlaced=0;record(`自分の第${turn.number}ターン：アンタップ、召喚酔い解除、土地配置回数リセット。`);
  turn.step='draw';if(turn.number===1)record('先攻第1ターン：ドローなし');else{turn.lastDraw=drawRaw(SELF,1);if(result)return;record(`ドロー：${turn.lastDraw}枚。`);}
  turn.step='main1';record('メイン1を開始しました。');
 }
 function advance(expectedKey=turn.key) {
  const e=interactionError();if(e)return fail(e);if(expectedKey!==turn.key||clock()<turn.notBefore)return fail('フェイズ処理中、または以前の操作です。');
  turn.key={};turn.notBefore=clock()+350;
  if(turn.step==='main1')turn.step='attack';else if(turn.step==='attack')turn.step='main2';else if(turn.step==='main2'){
   turn.step='end';const required=state[SELF].hand.length-7;if(required>0)operation={kind:'discard',p:SELF,required,ids:[]};
  }else if(turn.step==='end'){const required=state[SELF].hand.length-7;if(required>0)operation={kind:'discard',p:SELF,required,ids:[]};else beginTurn();}else return fail('進行できないフェイズです。');
  return ok(result?'山札切れにより敗北しました。':`${STEPS[turn.step]}${operation?.kind==='discard'?`：手札から${operation.required}枚を選び、トラッシュへ送ってください。`:'へ進みました。'}`);
 }
 function toggleDiscard(id) {const o=operation;if(o?.kind!=='discard'||!state[o.p].hand.some(c=>c.id===id))return fail('調整する手札を選んでください。');o.ids=o.ids.includes(id)?o.ids.filter(x=>x!==id):[...o.ids,id];return ok(`${o.ids.length}枚選択中です。`);}
 function confirmDiscard(expected=operation) {
  const o=operation;if(!o||o!==expected||o.kind!=='discard'||turn.step!=='end'||result)return fail('この手札調整は終了しています。');
  if(o.ids.length!==state[o.p].hand.length-7||new Set(o.ids).size!==o.ids.length||o.ids.some(id=>!state[o.p].hand.some(c=>c.id===id)))return fail(`手札が7枚になるように${state[o.p].hand.length-7}枚選んでください。`);
  const chosen=new Set(o.ids),cards=state[o.p].hand.filter(c=>chosen.has(c.id));state[o.p].hand=state[o.p].hand.filter(c=>!chosen.has(c.id));state[o.p].trash.push(...cards);operation=null;turn.key={};turn.notBefore=clock()+350;
  return ok(`エンド：${cards.length}枚をトラッシュへ送り、手札を7枚にしました。次の自分のターンへ進めます。`);
 }
 function attackError(id) {
  const s=locate(id);if(result)return '山札切れで終了しています。';if(status!=='ready'||turn.step!=='attack')return '攻撃はアタックフェイズで行ってください。';if(operation)return '選択中の処理を完了してください。';
  if(!s||s.p!==SELF||!isUnit(s.z)||s.card.type!=='通常'||!Number.isFinite(s.card.power))return '自分の場の仮ユニットを選んでください。';
  if(s.card.sick)return '召喚酔いのため、このターンは攻撃できません。';if(s.card.rest)return '使用済みのため攻撃できません。';return '';
 }
 function declareAttack(id) {const e=attackError(id);if(e)return fail(e);const s=locate(id);s.card.rest=true;operation={kind:'combat',id,p:SELF,defender:'p2',blockerId:null};return ok(`${s.card.name}でプレイヤー2本体へ攻撃宣言。攻撃側を使用済みにしました。`);}
 function blockers(p) {return unitSlots(p).flatMap(z=>state[p][z.id]).filter(c=>c.type==='通常'&&!c.rest&&c.abilities.includes('ブロッカー')&&Number.isFinite(c.power));}
 function chooseBlocker(id) {const o=operation;if(o?.kind!=='combat'||!blockers(o.defender).some(c=>c.id===id))return fail('未使用のブロッカーを1枚選んでください。');o.blockerId=id;return ok('ブロックする1枚を選びました。');}
 function resolveAttack(blockerId=null,expected=operation) {
  const o=operation;if(!o||o!==expected||o.kind!=='combat'||result||turn.step!=='attack')return fail('この攻撃は終了しています。');const a=locate(o.id);
  if(!a||a.p!==o.p||!isUnit(a.z)||!a.card.rest||!Number.isFinite(a.card.power))return fail('攻撃ユニットの状態が変わりました。');
  let defender=null;if(blockerId){if(!blockers(o.defender).some(c=>c.id===blockerId))return fail('選択したユニットはブロックできません。');defender=locate(blockerId);}
  operation=null;
  if(defender){defender.card.rest=true;const removed=a.card.power>=defender.card.power?defender:a;rawMove(removed,removed.p,'trash');return ok(`ブロック戦闘：${a.card.name}（${a.card.power}）対${defender.card.name}（${defender.card.power}）。${removed.card.name}をトラッシュへ送りました。${a.card.power===defender.card.power?'同パワーは攻撃側有利です。':''}シールドは変化しません。`);}
  const shield=state[o.defender].life.shift();if(shield){shield.faceUp=true;shield.rest=false;state[o.defender].hand.push(shield);return ok('ブロックなし：シールド1枚をブレイクし、持ち主の手札へ加えました。');}
  return ok('シールドなしで本体への攻撃が通った。勝敗は判定しません。');
 }
 reset();
 return {ZONES,PLAYERS,SELF,STEPS,isUnit,isField,label,card,buildDeck,validateDeck,reset,completeMulligan,locate,manualMove,addCard,toggle,readyMana,remove,draw,shuffle,availableMana,landError,placeLand,playStatus,unitSlots,placementOptions,beginPayment,chooseSlot,togglePaymentLand,paymentInfo,confirmPayment,cancelPayment,advance,toggleDiscard,confirmDiscard,attackError,declareAttack,blockers,chooseBlocker,resolveAttack,
  get state(){return state;},get status(){return status;},get turn(){return turn;},get mulligan(){return mulligan;},get operation(){return operation;},get result(){return result;},get log(){return [...log];},get canAdvance(){return status==='ready'&&!result&&!operation&&clock()>=turn.notBefore;}};
}
return {create,ZONES,STEPS};
});
