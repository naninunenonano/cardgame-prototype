// 画面から独立した試作ルール。clock/randomはテストで差し替え可能。
(function(root,factory){
  const rules=factory(typeof module==='object'&&module.exports?require('./mana.js'):root.ManaEngine,typeof module==='object'&&module.exports?require('./cards.js'):root.CardCatalog);
  if(typeof module==='object'&&module.exports)module.exports=rules;else root.GameRules=rules;
})(globalThis,function(Mana,Catalog){
'use strict';
const ZONES=[...Array.from({length:7},(_,i)=>({id:`signi-${i+1}`,name:`ユニット${i+1}`,class:'unit'})),
 {id:'lrig',name:'プレイヤーキャラ',class:'lrig'},{id:'extra',name:'サイドボード',pile:true},{id:'main',name:'メインデッキ',pile:true},
 {id:'landDeck',name:'土地デッキ',pile:true},{id:'landTrash',name:'土地トラッシュ',pile:true},
 {id:'life',name:'シールド',pile:true},{id:'energy',name:'マナゾーン'},{id:'trash',name:'トラッシュ',pile:true},
 {id:'structures',name:'設置物'},{id:'exile',name:'除外ゾーン',pile:true},{id:'check',name:'チェックゾーン'},{id:'hand',name:'手札',class:'hand'}];
const PLAYERS=['p1','p2'],SELF='p1';
const STEPS={untap:'アンタップ',draw:'ドロー',land:'土地配置',main1:'メイン1',attack:'アタック',main2:'メイン2',end:'エンド'};
const isUnit=z=>ZONES.some(zone=>zone.id===z&&zone.class==='unit');
const isField=z=>isUnit(z)||z==='lrig'||z==='structures';
const label=p=>p==='p1'?'プレイヤー1':'プレイヤー2';
function create({clock=()=>Date.now(),random=()=>Math.random(),mode:initialMode='solo',boundaries={}}={}) {
 let state,status,turn,mulligan,operation,result,serial=0,log=[],queue=[],supplyStatus,mode=initialMode,firstPlayer=SELF,epoch=0;
 const refreshRule={shieldIndex:0,emptyShield:'skip',...boundaries};
 const other=p=>p==='p1'?'p2':'p1';
 const record=message=>{log.push(message);if(log.length>100)log.shift();};
 const ok=message=>{if(message)record(message);return {ok:true,message:message||''};};
 const fail=message=>({ok:false,message});
 function card(name,type,color='赤',cost=null,basic=false,origin=null) {
  const required=type==='土地'||cost===null?null:typeof cost==='number'?Mana.cost(cost):cost;
  return {id:`card-${++serial}`,name,type,color,cost:required,basic,origin,faceUp:true,rest:false,
   power:type==='通常'&&required!==null?Mana.total(required)*1000:null,abilities:[],sick:false,
   mana:type==='土地'?{color,amount:1}:null,symbols:type==='通常'?{[color]:1}:{},breaks:type==='通常'?1:0,onUse:[],onEnter:[],onDefeat:[],enteredTurn:null};
 }
 function fromDefinition(key,p=null) {
  const def=Catalog.cards[key];if(!def)throw Error('カード定義がありません：'+key);
  const c=Object.assign(card(def.name,def.type,def.color,def.cost,!!def.basic,p),JSON.parse(JSON.stringify(def)));
  return c;
 }
 function buildDeck(p,deck=Catalog.startDeck) {
  const a=[];for(const entry of Catalog.decks[deck])for(let n=0;n<entry.count;n++)a.push(fromDefinition(entry.key,p));
  a.forEach(c=>c.faceUp=false);return a;
 }
 function landCount(p){return state[p].energy.filter(c=>c.type==='土地').length;}
 function fieldCards(p){return [...unitSlots(p).flatMap(z=>state[p][z.id]),...state[p].structures];}
 function power(c,p=null){const owner=p||locate(c.id)?.p||c.origin||SELF;if(c.powerMode==='lands')c.power=landCount(owner)*1000;return c.power;}
 function refreshDerived(){for(const p of PLAYERS)for(const a of Object.values(state[p]))for(const c of a)if(c.powerMode==='lands')c.power=landCount(p)*1000;}
 function symbols(p){const sum=Object.fromEntries(Mana.colors.map(c=>[c,0]));for(const c of fieldCards(p))if(c.type==='通常'||c.type==='設置物')for(const color of Mana.colors)sum[color]+=c.symbols?.[color]||0;return sum;}
 function effectiveCost(c,p){const cost={...c.cost},provided=symbols(p);if(c.reduction)for(const color of Mana.colors)if(cost[color]>0)cost[color]=Math.max(c.reduction.minimum?.[color]||0,cost[color]-provided[color]);return cost;}
 function paymentSources(p){
  const sources=[];for(const c of state[p].energy)if(c.type==='土地'&&!c.rest&&c.mana&&Mana.colors.includes(c.mana.color))sources.push({id:c.id,card:c,colors:[c.mana.color],amount:c.mana.amount});
  for(const c of fieldCards(p))if(c.type==='通常'&&!c.rest&&!c.sick&&c.manaAbility)sources.push({id:c.id,card:c,colors:[...c.manaAbility.colors],amount:c.manaAbility.amount});
  return sources;
 }
 function planPayment(cost,p){
  const sources=paymentSources(p);if(sources.length<Mana.total(cost))return null;
  const needs=Mana.colors.flatMap(color=>Array.from({length:cost[color]},()=>color)).sort((a,b)=>sources.filter(s=>s.colors.includes(a)).length-sources.filter(s=>s.colors.includes(b)).length);
  const chosen=new Map();
  function assign(i){if(i===needs.length)return true;const color=needs[i];for(const s of [...sources].sort((a,b)=>a.colors.length-b.colors.length))if(!chosen.has(s.id)&&s.colors.includes(color)){chosen.set(s.id,color);if(assign(i+1))return true;chosen.delete(s.id);}return false;}
  if(!assign(0))return null;for(const s of sources)if(chosen.size<Mana.total(cost)&&!chosen.has(s.id))chosen.set(s.id,s.colors[0]);
  return {sourceIds:[...chosen.keys()],sourceColors:Object.fromEntries(chosen)};
 }
 function selectedMana(o){return o.sourceIds.map(id=>{const source=paymentSources(o.p).find(s=>s.id===id);return source?{id,type:'土地',rest:false,mana:{color:o.sourceColors[id]||source.colors[0],amount:source.amount},source}:null;});}
 function validateDeck(a) {
  if(a.length!==40)throw Error('メインデッキは40枚です。');
  const counts=new Map(),limits=new Map();
  for(const c of a){if(c.type==='土地')throw Error('メインデッキに土地は入れません。');const definition=Object.values(Catalog.cards).find(d=>d.name===c.name);counts.set(c.name,(counts.get(c.name)||0)+1);limits.set(c.name,Math.min(limits.get(c.name)||3,c.deckLimit||3,definition?.deckLimit||3));}
  for(const [name,n] of counts)if(n>limits.get(name))throw Error(`${name}の同名採用上限は${limits.get(name)}枚です。`);
  return true;
 }
 function buildLandDeck(p,deck=Catalog.startLandDeck){const a=[];for(const entry of Catalog.landDecks[deck])for(let n=0;n<entry.count;n++)a.push(fromDefinition(entry.key,p));a.forEach(c=>c.faceUp=false);return a;}
 function validateLandDeck(a){if(a.length!==20||a.some(c=>c.type!=='土地'||!c.basic))throw Error('土地デッキは基本土地20枚です。');return true;}
 function shuffleRaw(p,z) {const a=state[p][z];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}}
 function refreshDeck(p,land=false){
  const deck=land?'landDeck':'main',trash=land?'landTrash':'trash';if(state[p][deck].length)return true;
  const eligible=state[p][trash].filter(c=>land?c.type==='土地':c.type!=='土地'&&!c.resolving);
  if(!eligible.length)return false;const ids=new Set(eligible.map(c=>c.id));state[p][trash]=state[p][trash].filter(c=>!ids.has(c.id));
  eligible.forEach(c=>{c.faceUp=false;c.rest=false;c.sick=false;});state[p][deck].push(...eligible);shuffleRaw(p,deck);
  record(`${label(p)}：${land?'土地':'メイン'}デッキを${trash==='trash'?'通常のトラッシュ':'土地トラッシュ'}${eligible.length}枚でリフレッシュ。${land?'土地リフレッシュは盾ペナルティなし。':'メインリフレッシュ。'}`);
  if(!land){const shield=state[p].life.splice(refreshRule.shieldIndex,1)[0];if(shield){shield.faceUp=true;shield.rest=false;state[p].trash.push(shield);record(`${label(p)}：リフレッシュペナルティで固定位置の盾1枚をトラッシュへ。手札・トリガー処理なし。`);}else record(`${label(p)}：盾0枚のためペナルティの盾送りだけを省略（追加敗北なし）。`);}
  return true;
 }
 function mainCard(p){if(!refreshDeck(p)){supplyStatus[p].main='直近の処理で補充不足：メインデッキ・通常トラッシュから必要枚数を用意できず、可能な枚数で終了（敗北判定保留）。';record(`${label(p)}：${supplyStatus[p].main}`);return null;}supplyStatus[p].main='';const c=state[p].main.shift();refreshDeck(p);return c;}
 function drawRaw(p,count){let drawn=0;for(let i=0;i<count;i++){const c=mainCard(p);if(!c)break;c.faceUp=true;c.rest=false;state[p].hand.push(c);drawn++;}return drawn;}
 function putShield(p,count){let placed=0;for(let i=0;i<count;i++){const c=mainCard(p);if(!c)break;c.faceUp=false;c.rest=false;state[p].life.push(c);placed++;}return placed;}
 function addLands(p,count=1,reason='効果'){
  let placed=0;for(let i=0;i<count;i++){if(!refreshDeck(p,true)){supplyStatus[p].land='土地デッキ・土地トラッシュともに空。この土地配置だけを省略。';record(`${label(p)}：${supplyStatus[p].land}`);break;}
   const c=state[p].landDeck.shift();c.faceUp=true;c.rest=false;state[p].energy.push(c);placed++;supplyStatus[p].land='';
  }if(placed)record(`${label(p)}：${reason}で土地${placed}枚を未使用で追加。`);refreshDerived();return placed;
 }
 function reset(nextMode=mode) {
  if(!['solo','bot'].includes(nextMode))return fail('モードを選んでください。');mode=nextMode;epoch++;firstPlayer=mode==='bot'?(random()<.5?'p1':'p2'):SELF;
  serial=0;log=[];queue=[];supplyStatus={p1:{main:'',land:''},p2:{main:'',land:''}};result=null;operation=null;status='mulligan';turn={player:firstPlayer,counts:{p1:0,p2:0},sequence:0,number:0,step:'untap',landsPlaced:0,key:{},notBefore:0,lastDraw:0};mulligan={p1:'pending',p2:'pending'};
  state=Object.fromEntries(PLAYERS.map(p=>[p,Object.fromEntries(ZONES.map(z=>[z.id,[]]))]));
  for(const p of PLAYERS){state[p].main=buildDeck(p);validateDeck(state[p].main);state[p].landDeck=buildLandDeck(p);validateLandDeck(state[p].landDeck);shuffleRaw(p,'main');shuffleRaw(p,'landDeck');drawRaw(p,7);}
  record(`${mode==='bot'?'Bot戦':'壁打ち'}：先攻は${label(firstPlayer)}。メイン40枚・土地20枚から初期手札7枚を配りました。`);return ok('各プレイヤーのマリガンを選択してください。');
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
 function rawMove(source,p,z,bottom=true) {if(z==='trash'&&source.card.type==='土地')z='landTrash';const [c]=state[source.p][source.z].splice(source.index,1);if(isUnit(z)&&!isUnit(source.z)){c.sick=true;c.enteredTurn=turn.counts[p];}if(z==='landDeck')c.faceUp=false;if(bottom)state[p][z].push(c);else state[p][z].unshift(c);if(source.z==='main')refreshDeck(source.p);if(z==='trash')refreshDeck(p);return c;}
 function interactionError() {if(result)return '対戦は終了しています。最初からやり直してください。';if(status!=='ready')return '開始準備中は通常操作を使えません。';if(operation)return '選択中の処理を完了してください。';return '';}
 function mainError(p,allowPayment=false) {if(result)return '対戦は終了しています。';if(status!=='ready')return '開始準備中です。';if(p!==turn.player)return '現在のターンのプレイヤーだけが使用できます。';if(!['main1','main2'].includes(turn.step))return 'カードの使用はメイン1・メイン2で行ってください。';if(operation&&!(allowPayment&&operation.kind==='payment'))return '選択中の処理を完了してください。';return '';}
 function manualMove(id,p,z,bottom=false) {
  if(mode==='bot')return fail('Bot戦ではルール外の手動移動を使えません。');
  const source=locate(id),error=interactionError();if(error)return fail(error);if(!source||!state[p]?.[z])return fail('カードまたは領域が見つかりません。');
  if(['main','trash'].includes(z)&&source.card.type==='土地'&&z!=='trash')return fail('土地はメインデッキへ入れられません。');
  if(['landDeck','landTrash'].includes(z)&&source.card.type!=='土地')return fail('土地専用の領域です。');
  if(z==='energy'&&source.card.type!=='土地')return fail('土地以外はマナゾーンに置けません。');
  if(isUnit(z)&&state[p][z].length&&!(source.p===p&&source.z===z))return fail('ユニット枠は1枚です。空き枠への手動移動か、通常の上書き配置を使用してください。');
  if(z==='extra'&&state[p].extra.length>=10&&!(source.p===p&&source.z===z))return fail('サイドボードは10枚枠です。');
  if(isUnit(z)&&(!isUnit(source.z)||source.p!==p)){enterCard(source,p,z);pump();}else rawMove(source,p,z,bottom);return ok(z==='exile'?'明示的な手動操作で除外ゾーンへ移しました。':'手動移動（ルール外の補助）を実行しました。土地配置回数は変更しません。');
 }
 function addCard(p,z,c) {
  if(mode==='bot')return fail('Bot戦では仮カード追加を使えません。');
  const error=interactionError();if(error)return fail(error);if(!state[p]?.[z])return fail('追加先が見つかりません。');
  if(z==='main'&&c.type==='土地')return fail('土地はメインデッキへ入れられません。');
  if(['landDeck','landTrash'].includes(z)&&c.type!=='土地')return fail('土地専用の領域です。');if(z==='trash'&&c.type==='土地')z='landTrash';
  if(z==='energy'&&c.type!=='土地')return fail('土地以外はマナゾーンに置けません。');
  if(isUnit(z)&&state[p][z].length)return fail('ユニット枠は1枚です。空き枠を選んでください。');
  if(z==='extra'&&state[p].extra.length>=10)return fail('サイドボードは10枚枠です。');
  state[p][z].push(c);if(z==='landDeck')c.faceUp=false;if(isUnit(z)&&c.type==='通常'){unitEntered(c,p);pump();}refreshDerived();return ok('ルール外の補助として仮カードを追加しました。');
 }
 function toggle(id,property='rest') {
  if(mode==='bot')return fail('Bot戦では状態切替の補助操作を使えません。');
  const error=interactionError(),s=locate(id);if(error)return fail(error);if(!s)return fail('カードが見つかりません。');
  if(!['rest','faceUp','sick'].includes(property))return fail('変更できない項目です。');
  if(property==='sick'&&(!isUnit(s.z)||s.card.type!=='通常'))return fail('場の仮ユニットを選んでください。');
  s.card[property]=!s.card[property];return ok(property==='sick'?'補助操作で召喚酔いを変更しました。':'補助操作でカードの状態を変更しました。');
 }
 function readyMana(p) {if(mode==='bot')return fail('Bot戦では補助操作を使えません。');const e=interactionError();if(e)return fail(e);state[p].energy.forEach(c=>c.rest=false);return ok('補助操作で土地を未使用に戻しました。');}
 function remove(id) {if(mode==='bot')return fail('Bot戦では補助操作を使えません。');const e=interactionError(),s=locate(id);if(e)return fail(e);if(!s)return fail('カードが見つかりません。');state[s.p][s.z].splice(s.index,1);return ok('補助操作でカードを削除しました。');}
 function draw(p,n=1) {if(mode==='bot')return fail('Bot戦では補助操作を使えません。');const e=interactionError();if(e)return fail(e);if(!Number.isInteger(n)||n<1)return fail('ドロー枚数が不正です。');const count=drawRaw(p,n);return ok(result?`${label(p)}：ドローによる山札切れで敗北。`:`手動ドロー（補助）：${label(p)}が${count}枚引きました。`);}
 function shuffle(p,z) {if(mode==='bot')return fail('Bot戦では補助操作を使えません。');const e=interactionError();if(e)return fail(e);shuffleRaw(p,z);return ok('山札をシャッフルしました。');}
 function availableMana(p) {const sources=paymentSources(p);return {total:sources.length,...Object.fromEntries(Mana.colors.map(color=>[color,sources.filter(s=>s.colors.includes(color)).length])),flexible:sources.filter(s=>s.colors.length>1).length};}
 function landError(){return '手札からの通常土地配置は廃止。ターン開始時に土地デッキから自動配置します。';}
 function placeLand(){return fail(landError());}
 function unitSlots(p) {return ZONES.filter(z=>isUnit(z.id));}
 function placementOptions(p) {const slots=unitSlots(p),empty=slots.filter(z=>!state[p][z.id].length);return empty.length?empty:slots;}
 function playStatus(c,p) {
  if(c.type==='土地'){const e=landError(c.id);return {ok:!e,text:e||'マナに置く',reasons:e?[e]:[]};}
  if(!['通常','呪文','設置物'].includes(c.type)||!c.cost)return {ok:false,text:'通常使用の対象外',reasons:['通常使用の対象外です。']};
  const reasons=[],e=mainError(p);if(e)reasons.push(e);const cost=effectiveCost(c,p),plan=planPayment(cost,p),assessed=Mana.assess(cost,availableMana(p));reasons.push(...assessed.reasons);if(!plan&&assessed.ok)reasons.push('必要な色マナの組み合わせを満たせません。');
  return {ok:!reasons.length,text:reasons[0]||('マナ支払い可'+(c.type==='通常'&&unitSlots(p).every(z=>state[p][z.id].length)?'（上書き可）':'')),reasons};
 }
 function beginPayment(id) {
  const s=locate(id);if(!s||s.z!=='hand'||!['通常','呪文','設置物'].includes(s.card.type))return fail('手札のユニット・呪文・設置物を選んでください。');
  const assessed=playStatus(s.card,s.p);if(!assessed.ok)return fail(assessed.reasons.join('／'));
  operation={kind:'payment',id,p:s.p,slot:null,replacedId:null,...planPayment(effectiveCost(s.card,s.p),s.p)};
  return ok('軽減後のコスト・支払い元・配置先を確認してください。');
 }
 function chooseSlot(z) {const o=operation;if(!['payment','triggerPlace','freePlace'].includes(o?.kind))return fail('配置操作がありません。');if(!placementOptions(o.p).some(s=>s.id===z))return fail('空き枠を選んでください。満杯時のみ上書きできます。');o.slot=z;o.replacedId=state[o.p][z][0]?.id||null;return ok('配置先を選びました。');}
 function togglePaymentLand(id) {
  const o=operation;if(o?.kind!=='payment')return fail('支払い操作がありません。');const source=paymentSources(o.p).find(c=>c.id===id);if(!source)return fail('未使用で起動可能な自分の支払い元を選んでください。');
  o.sourceIds=o.sourceIds.includes(id)?o.sourceIds.filter(x=>x!==id):[...o.sourceIds,id];if(!o.sourceColors[id])o.sourceColors[id]=source.colors[0];return ok('支払い案を変更しました。');
 }
 function chooseManaColor(id,color){const o=operation,s=paymentSources(o?.p||SELF).find(s=>s.id===id);if(o?.kind!=='payment'||!s||!s.colors.includes(color))return fail('この支払い元で出せる色を選んでください。');o.sourceColors[id]=color;return ok('マナ能力の色を選びました。');}
 function placementInfo(o,c){
  if(c.type!=='通常')return {ok:true,replacement:null};if(!isUnit(o.slot))return fail('配置先を選んでください。');const current=state[o.p][o.slot];
  if(current.length>1||(current[0]?.id||null)!==o.replacedId)return fail('配置先または上書き対象が変わりました。');
  if(o.replacedId&&unitSlots(o.p).some(z=>!state[o.p][z.id].length))return fail('空き枠へ配置先を選び直してください。');return {ok:true,replacement:current[0]||null};
 }
 function paymentInfo(expected=operation) {
  const o=operation;if(!o||o!==expected||o.kind!=='payment')return fail('この支払い操作は終了しています。');const e=mainError(o.p,true);if(e)return fail(e);
  const s=locate(o.id);if(!s||s.p!==o.p||s.z!=='hand'||!s.card.cost)return fail('対象カードが手札にありません。');const place=placementInfo(o,s.card);if(!place.ok)return place;
  if(new Set(o.sourceIds).size!==o.sourceIds.length)return fail('支払い元を重複して選べません。');const sources=selectedMana(o);if(sources.some(s=>!s||!s.source.colors.includes(s.mana.color)))return fail('支払い元の状態・召喚酔い・色が変わりました。');
  const cost=effectiveCost(s.card,o.p),payment=Mana.payment(cost,sources);if(!payment.ok)return fail(payment.reasons.join('／'));
  return {ok:true,source:s,sources,replacement:place.replacement,cost};
 }
 function enterCard(s,p,slot,replacement=null){
  if(replacement){rawMove(locate(replacement.id),p,'trash');record(`${replacement.name}を上書きでトラッシュへ送りました。`);}
  const c=rawMove(s,p,s.card.type==='設置物'?'structures':slot);c.faceUp=true;c.rest=!!c.enterRest;c.sick=c.type==='通常';c.enteredTurn=turn.counts[p];
  if(c.type==='通常')unitEntered(c,p);else enqueue(c.onEnter||[],p,c.id);refreshDerived();return c;
 }
 function unitEntered(c,p){
  c.sick=true;c.rest=!!c.enterRest;c.enteredTurn=turn.counts[p];
  // 同時に誘発した登場時能力は、本人の効果→場にあった設置物の順で解決。
  const triggers=state[p].structures.flatMap(s=>(s.onUnitEnter||[]).map(e=>({...e,triggerName:s.name})));
  enqueue([...(c.onEnter||[]),...triggers],p,c.id);
 }
 function useSpell(s,p){const c=rawMove(s,p,'check');c.faceUp=true;c.resolving=true;enqueue([...(c.onUse||[]),{kind:'cleanup'}],p,c.id);return c;}
 function confirmPayment(expected=operation) {
  const checked=paymentInfo(expected);if(!checked.ok)return checked;const o=operation;operation=null;checked.sources.forEach(s=>s.source.card.rest=true);
  const c=checked.source.card;if(c.type==='呪文')useSpell(checked.source,o.p);else enterCard(checked.source,o.p,o.slot,checked.replacement);
  record(`${c.name}を使用。軽減後${Mana.describe(checked.cost)}を支払いました。`);pump();return ok(result?'効果中のドローで山札切れになりました。':'支払いを確定しました。効果の選択を続けてください。');
 }
 function cancelPayment(){if(operation?.kind!=='payment')return fail('キャンセルできる支払い操作がありません。');operation=null;return ok('支払いをキャンセルしました。土地・マナ能力ユニットは変更していません。');}
 function beginTurn() {
  const p=turn.sequence===0?firstPlayer:mode==='bot'?other(turn.player):SELF;
  operation=null;turn.player=p;turn.sequence++;turn.counts[p]++;turn.number=turn.counts[p];turn.key={};turn.step='untap';turn.lastDraw=0;
  for(const z of ZONES)if(isField(z.id)||z.id==='energy')state[p][z.id].forEach(c=>{c.rest=false;if(isField(z.id))c.sick=false;});
  turn.landsPlaced=0;record(`${label(p)}の第${turn.number}ターン：アンタップ、召喚酔い解除。`);
  turn.step='draw';turn.skippedDraw=turn.sequence===1;if(turn.skippedDraw)record('先攻第1ターン：ドローなし');else{turn.lastDraw=drawRaw(p,1);record(`通常ドロー：${label(p)}が${turn.lastDraw}枚。`);}
  turn.step='land';turn.landsPlaced=addLands(p,1,'ターン開始時の自動配置');
  turn.step='main1';record(`${label(p)}のメイン1を開始しました。`);
 }
 function advance(expectedKey=turn.key) {
  const e=interactionError();if(e)return fail(e);if(expectedKey!==turn.key||clock()<turn.notBefore)return fail('フェイズ処理中、または以前の操作です。');
  turn.key={};turn.notBefore=clock()+350;
  if(turn.step==='main1')turn.step='attack';else if(turn.step==='attack')turn.step='main2';else if(turn.step==='main2'){
   turn.step='end';const required=state[turn.player].hand.length-7;if(required>0)operation={kind:'discard',p:turn.player,required,ids:[]};
  }else if(turn.step==='end'){const required=state[turn.player].hand.length-7;if(required>0)operation={kind:'discard',p:turn.player,required,ids:[]};else beginTurn();}else return fail('進行できないフェイズです。');
  return ok(result?'山札切れにより敗北しました。':`${STEPS[turn.step]}${operation?.kind==='discard'?`：手札から${operation.required}枚を選び、トラッシュへ送ってください。`:'へ進みました。'}`);
 }
 function toggleDiscard(id) {const o=operation;if(o?.kind!=='discard'||!state[o.p].hand.some(c=>c.id===id))return fail('調整する手札を選んでください。');o.ids=o.ids.includes(id)?o.ids.filter(x=>x!==id):[...o.ids,id];return ok(`${o.ids.length}枚選択中です。`);}
 function confirmDiscard(expected=operation) {
  const o=operation;if(!o||o!==expected||o.kind!=='discard'||turn.step!=='end'||result)return fail('この手札調整は終了しています。');
  if(o.ids.length!==state[o.p].hand.length-7||new Set(o.ids).size!==o.ids.length||o.ids.some(id=>!state[o.p].hand.some(c=>c.id===id)))return fail(`手札が7枚になるように${state[o.p].hand.length-7}枚選んでください。`);
  const cards=o.ids.map(id=>locate(id).card);for(const id of o.ids)rawMove(locate(id),o.p,'trash');operation=null;turn.key={};turn.notBefore=clock()+350;
  return ok(`エンド：${cards.length}枚をトラッシュへ送り、手札を7枚にしました。次の自分のターンへ進めます。`);
 }
 function enqueue(effects,p,sourceId){queue.unshift(...effects.map(effect=>({...JSON.parse(JSON.stringify(effect)),p,sourceId})));}
 function triggerEligible(c,p){return !!c.trigger&&(!c.trigger.minLands||landCount(p)>=c.trigger.minLands);}
 function pump(){
  while(queue.length&&!operation&&!result){
   const effect=queue.shift(),p=effect.p,sourceId=effect.sourceId;
   if(effect.kind==='land'){if(effect.triggerName)record(`${effect.triggerName}のユニット登場誘発。`);addLands(p,effect.count||1);}
   else if(effect.kind==='draw')drawRaw(p,effect.count);
   else if(effect.kind==='drawIfLandMax'){if(landCount(p)<=effect.max)drawRaw(p,effect.count);record(`土地追加後の土地${landCount(p)}枚でドロー条件を判定。`);}
   else if(effect.kind==='shield'){const n=effect.count+(effect.landThreshold&&landCount(p)>=effect.landThreshold?(effect.extra||0):0),placed=putShield(p,n);record(`${label(p)}：メインデッキから盾を${placed}枚追加。`);}
   else if(effect.kind==='trap'||effect.kind==='mother'){
    const targetPlayer=p==='p1'?'p2':'p1',targetPlayers=effect.kind==='mother'?PLAYERS:[targetPlayer],candidates=targetPlayers.flatMap(owner=>unitSlots(owner).flatMap(z=>state[owner][z.id])).filter(c=>c.type==='通常');
    if(candidates.length){operation={kind:'effectTarget',p,targetPlayer,targetPlayers,effect:effect.kind,sourceId,selectedId:null};break;}
    record('対象ユニットがないため、後半を含め効果を省略。');
   }else if(effect.kind==='freeUnit'){
    operation={kind:'freeUnit',p,sourceId};if(!freeUnitCandidates().length){operation=null;record(`${label(p)}：土地枚数以下の手札ユニットなし。無料登場を省略。`);}
    else break;
   }else if(effect.kind==='wipe'){
    for(const owner of PLAYERS)for(const c of [...fieldCards(owner)])if(c.id!==sourceId&&(c.type==='通常'||c.type==='設置物'))rawMove(locate(c.id),owner,'trash');
    refreshDerived();record('本人以外の両者のユニット・設置物をトラッシュへ送りました。');
   }else if(effect.kind==='cleanup'){
    const s=locate(sourceId);if(s&&s.z==='check'){s.card.resolving=false;rawMove(s,s.p,'trash');record(`${s.card.name}の解決が完了し、トラッシュへ送りました。`);}
   }else if(effect.kind==='triggers'){
    const ids=effect.ids.filter(id=>state[p].hand.some(c=>c.id===id));if(ids.length){operation={kind:'triggers',p,ids};break;}
   }
  }
  refreshDerived();
 }
 function effectTargets(){const o=operation;return o?.kind==='effectTarget'?o.targetPlayers.flatMap(p=>unitSlots(p).flatMap(z=>state[p][z.id])).filter(c=>c.type==='通常'):[];}
 function resolveEffectTarget(id,expected=operation){
  const o=operation;if(o!==expected||o?.kind!=='effectTarget'||!effectTargets().some(c=>c.id===id))return fail('対象ユニットを1枚選んでください。');
  const s=locate(id),owner=s.p;rawMove(s,owner,'trash');record(`${s.card.name}を持ち主のトラッシュへ。`);operation=null;
  enqueue([{kind:o.effect==='mother'?'freeUnit':'land',count:1}],owner,o.sourceId);pump();return ok(o.effect==='mother'?'その持ち主が無料で出すカードを選びます。':'持ち主の土地デッキから土地を追加しました。');
 }
 function freeUnitCandidates(){const o=operation;if(o?.kind!=='freeUnit')return [];return state[o.p].hand.filter(c=>c.type==='通常'&&c.cost&&Mana.total(c.cost)<=landCount(o.p));}
 function chooseFreeUnit(id=null,expected=operation){const o=operation;if(o!==expected||o?.kind!=='freeUnit')return fail('この無料登場選択は終了しています。');if(id!==null&&!freeUnitCandidates().some(c=>c.id===id))return fail('その持ち主の手札から、土地枚数以下の軽減前合計コストのユニットを選んでください。');
  operation=null;if(id)operation={kind:'freePlace',p:o.p,id,slot:null,replacedId:null};else{record('無料では出さずに続行。');pump();}return ok('無料登場の選択を更新しました。');
 }
 function chooseTrigger(id,use=true,expected=operation){
  const o=operation;if(o!==expected||o?.kind!=='triggers'||!o.ids.includes(id)||!state[o.p].hand.some(c=>c.id===id))return fail('このブレイクで手札へ移ったトリガーを選んでください。');
  const remaining=o.ids.filter(x=>x!==id);operation=null;if(remaining.length)queue.unshift({kind:'triggers',p:o.p,ids:remaining});
  if(use){const s=locate(id);if(s.card.type==='呪文'){record(`${s.card.name}をシールドトリガーで無料使用。`);useSpell(s,o.p);}else{operation={kind:'triggerPlace',p:o.p,id,slot:null,replacedId:null};return ok('トリガーユニットの配置先・上書き対象を選んでください。');}}
  else record(`${locate(id).card.name}のトリガーを使用せず、手札に残しました。`);
  pump();return ok('トリガーを処理しました。');
 }
 function skipTriggers(){const o=operation;if(o?.kind!=='triggers')return fail('トリガー選択ではありません。');operation=null;record('残りのトリガーを使用せず手札に残しました。');pump();return ok('トリガーの選択を完了しました。');}
 function confirmTriggerPlacement(expected=operation){
  const o=operation;if(o!==expected||!['triggerPlace','freePlace'].includes(o?.kind)||result)return fail('この配置操作は終了しています。');const s=locate(o.id);if(!s||s.p!==o.p||s.z!=='hand')return fail('対象カードが手札にありません。');if(o.kind==='freePlace'&&(s.card.type!=='通常'||Mana.total(s.card.cost)>landCount(o.p)))return fail('土地枚数以下の軽減前合計コストを満たしません。');const checked=placementInfo(o,s.card);if(!checked.ok)return checked;
  operation=null;enterCard(s,o.p,o.slot,checked.replacement);record(`${s.card.name}を${o.kind==='freePlace'?'母なる大地':'シールドトリガー'}で無料配置。`);pump();return ok('無料配置を確定しました。');
 }
 function skipTriggerPlacement(){if(!['triggerPlace','freePlace'].includes(operation?.kind))return fail('無料配置ではありません。');operation=null;pump();return ok('配置を取りやめ、カードを手札に残しました。');}
 function breakShields(p,count){
  if(!state[p].life.length)return;
  const broken=state[p].life.splice(0,count);broken.forEach(c=>{c.faceUp=true;c.rest=false;});state[p].hand.push(...broken);
  record(`先に確定したシールド${broken.length}枚を${label(p)}の手札へ移しました。`);
  const triggerIds=broken.filter(c=>triggerEligible(c,p)).map(c=>c.id);if(triggerIds.length)queue.unshift({kind:'triggers',p,ids:triggerIds});pump();
 }
 function attackTargets(id){
  const s=locate(id);if(!s)return [];const c=s.card,enemy=s.p==='p1'?'p2':'p1',units=unitSlots(enemy).flatMap(z=>state[enemy][z.id]).filter(c=>c.type==='通常');
  const lures=units.filter(c=>c.lure);
  const canUnit=c.machFighter?.duration==='entryTurn'&&c.enteredTurn===turn.counts[s.p]&&s.p===turn.player;
  if(c.sick&&!canUnit)return [];
  if(lures.length)return lures.map(c=>({id:c.id,name:c.name,forced:true}));
  return [...(!c.sick?[{id:'body',name:label(enemy)+'本体'}]:[]),...(canUnit?units.map(c=>({id:c.id,name:c.name})):[])];
 }
 function attackError(id){
  const s=locate(id);if(result)return '対戦は終了しています。';if(status!=='ready'||turn.step!=='attack')return '攻撃はアタックフェイズで行ってください。';if(operation)return '選択中の処理を完了してください。';
  if(!s||s.p!==turn.player||!isUnit(s.z)||s.card.type!=='通常'||!Number.isFinite(power(s.card,s.p)))return '自分の場のユニットを選んでください。';
  if(s.card.rest)return '使用済みのため攻撃できません。';if(!attackTargets(id).length)return '召喚酔い中、または攻撃できる対象がありません。';return '';
 }
 function declareAttack(id,targetId=undefined){
  const e=attackError(id);if(e)return fail(e);const targets=attackTargets(id);
  if(targetId===undefined&&targets.length>1){operation={kind:'attackTarget',id,p:turn.player};return ok('攻撃側が対象を選んでください。引き付けが複数ならその中から選びます。');}
  const target=targetId===undefined?targets[0]?.id:targetId;if(!targets.some(t=>t.id===target))return fail('このユニットではその対象を攻撃できません。');
  return startAttack(id,target);
 }
 function chooseAttackTarget(target){const o=operation;if(o?.kind!=='attackTarget'||!attackTargets(o.id).some(t=>t.id===target))return fail('有効な攻撃対象を選んでください。');operation=null;return declareAttack(o.id,target);}
 function cancelAttackTarget(){if(operation?.kind!=='attackTarget')return fail('対象選択ではありません。');operation=null;return ok('攻撃前の対象選択を取りやめました。');}
 function startAttack(id,target){
  const s=locate(id);s.card.rest=true;record(`${s.card.name}が${target==='body'?'相手本体':locate(target)?.card.name}へ攻撃宣言。使用済みにしました。`);
  if(target!=='body'){const b=locate(target);if(!b||!isUnit(b.z)||b.p===s.p)return fail('対象ユニットが場にありません。');battle(s,b,false);pump();return ok('ユニットへの直接攻撃を解決しました。');}
  operation={kind:'combat',id,p:s.p,defender:other(s.p),blockerId:null};return ok('防御側がブロックするか選択してください。');
 }
 function blockers(p){return unitSlots(p).flatMap(z=>state[p][z.id]).filter(c=>c.type==='通常'&&!c.rest&&c.abilities.includes('ブロッカー')&&Number.isFinite(power(c,p)));}
 function chooseBlocker(id){const o=operation;if(o?.kind!=='combat'||!blockers(o.defender).some(c=>c.id===id))return fail('未使用のブロッカーを1枚選んでください。');o.blockerId=id;return ok('ブロックする1枚を選びました。');}
 function battle(a,b,blocked){
  const ap=power(a.card,a.p),bp=power(b.card,b.p);if(blocked)b.card.rest=true;
  const removed=ap>=bp?b:a,winner=ap>=bp?a:b;rawMove(removed,removed.p,'trash');
  record(`戦闘：${a.card.name}（${ap}）対${b.card.name}（${bp}）。${removed.card.name}をトラッシュへ。${ap===bp?'同パワーは攻撃側有利。':''}`);
  enqueue(winner.card.onDefeat||[],winner.p,winner.card.id);refreshDerived();
 }
 function resolveAttack(blockerId=null,expected=operation){
  const o=operation;if(!o||o!==expected||o.kind!=='combat'||result||turn.step!=='attack')return fail('この攻撃は終了しています。');const a=locate(o.id);
  if(!a||a.p!==o.p||!isUnit(a.z)||!a.card.rest)return fail('攻撃ユニットの状態が変わりました。');
  let b=null;if(blockerId){if(!blockers(o.defender).some(c=>c.id===blockerId))return fail('選んだユニットはブロックできません。');b=locate(blockerId);}
  operation=null;
  if(b){battle(a,b,true);pump();return ok('ブロック戦闘を解決。シールドへの処理はありません。');}
  if(!state[o.defender].life.length){finish(o.p,'盾0枚の本体への攻撃成功');return ok(`${label(o.p)}の勝利です。`);}
  if((a.card.breaks||0)===0){record('ノーシンボルのユニットのため、シールドをブレイクしません。');return ok('本体への攻撃を解決しました。ブレイク0枚です。');}
  breakShields(o.defender,a.card.breaks);return ok('本体への攻撃を解決しました。必要ならトリガーを選択してください。');
 }
 function finish(winner,reason){result={winner,loser:other(winner),reason};operation=null;queue=[];turn.key={};epoch++;record(`${label(winner)}の勝利：${reason}。`);}
 function decisionPlayer(){if(result)return null;if(status==='mulligan')return mulligan.p2==='pending'&&mode==='bot'?'p2':PLAYERS.find(p=>mulligan[p]==='pending')||null;return operation?(operation.kind==='combat'?operation.defender:operation.p):turn.player;}
 // Bot gets this projection only: no opponent hand, shield identities, or deck ordering.
 function observe(p){
  const copy=c=>JSON.parse(JSON.stringify(c)),publicCard=(c,owner,z)=>({...copy(c),owner,zone:z,power:power(c,owner)});
  const players={};
  for(const owner of PLAYERS){const zones=state[owner];players[owner]={hand:owner===p?zones.hand.map(c=>({...publicCard(c,owner,'hand'),canPlay:playStatus(c,owner).ok,effectiveCost:effectiveCost(c,owner),paymentPlan:c.cost?planPayment(effectiveCost(c,owner),owner):null})):null,counts:Object.fromEntries(ZONES.map(z=>[z.id,zones[z.id].length])),units:unitSlots(owner).flatMap(z=>zones[z.id].filter(c=>c.faceUp).map(c=>publicCard(c,owner,z.id))),structures:zones.structures.filter(c=>c.faceUp).map(c=>publicCard(c,owner,'structures')),lands:zones.energy.filter(c=>c.faceUp).map(c=>publicCard(c,owner,'energy')),trash:zones.trash.map(c=>publicCard(c,owner,'trash')),landCount:landCount(owner),symbols:symbols(owner)};}
  const actor=decisionPlayer(),o=operation;let projected=o?{kind:o.kind,p:actor}:null;
  if(o&&actor===p){projected=copy(o);if(['payment','freePlace','triggerPlace'].includes(o.kind)){projected.slots=placementOptions(p).map(z=>({id:z.id,card:state[p][z.id][0]?publicCard(state[p][z.id][0],p,z.id):null}));}
   if(o.kind==='effectTarget')projected.candidates=effectTargets().map(c=>{const s=locate(c.id);return publicCard(c,s.p,s.z);});
   if(o.kind==='freeUnit')projected.candidates=freeUnitCandidates().map(c=>publicCard(c,p,'hand'));
   if(o.kind==='combat'){const a=locate(o.id);projected.attacker=a?publicCard(a.card,a.p,a.z):null;projected.blockers=blockers(p).map(c=>publicCard(c,p,locate(c.id).z));}
   if(o.kind==='attackTarget')projected.targets=attackTargets(o.id);
  }
  const sources=paymentSources(p).map(s=>({id:s.id,colors:[...s.colors],unit:s.card.type==='通常'}));
  const attacks=actor===p&&!operation&&turn.step==='attack'?players[p].units.filter(c=>!attackError(c.id)).map(c=>({card:c,targets:attackTargets(c.id)})):[];
  return {viewer:p,actor,mode,status,firstPlayer,epoch,turn:copy({...turn,key:undefined}),canAdvance:status==='ready'&&!result&&!operation&&clock()>=turn.notBefore,mulligan:copy(mulligan),result:result?copy(result):null,players,sources,operation:projected,attacks};
 }
 function dispatch(action,p,expectedEpoch=epoch){
  if(expectedEpoch!==epoch||result)return fail('以前の対戦の操作です。');if(decisionPlayer()!==p)return fail('このプレイヤーの選択待ちではありません。');
  const handlers={mulligan:()=>completeMulligan(p,action.ids||[],false),play:()=>beginPayment(action.id),slot:()=>chooseSlot(action.slot),pay:()=>confirmPayment(),cancelPayment,attack:()=>declareAttack(action.id,action.target),attackTarget:()=>chooseAttackTarget(action.target),block:()=>resolveAttack(action.id||null),target:()=>resolveEffectTarget(action.id),freeUnit:()=>chooseFreeUnit(action.id||null),freePlace:()=>confirmTriggerPlacement(),skipFree:skipTriggerPlacement,trigger:()=>chooseTrigger(action.id,action.use!==false),skipTriggers,discard:()=>{const o=operation;if(o?.kind!=='discard')return fail('手札調整ではありません。');if(!Array.isArray(action.ids)||new Set(action.ids).size!==action.ids.length||action.ids.some(id=>!state[p].hand.some(c=>c.id===id)))return fail('手札から選択してください。');o.ids=[...action.ids];return confirmDiscard(o);},advance:()=>advance()};
  if(action.type==='play'&&locate(action.id)?.p!==p)return fail('自分の手札を選んでください。');
  return handlers[action.type]?handlers[action.type]():fail('操作が見つかりません。');
 }
 reset();
 return {ZONES,PLAYERS,SELF,STEPS,observe,dispatch,decisionPlayer,isUnit,isField,label,card,buildDeck,validateDeck,reset,completeMulligan,locate,fromDefinition,buildLandDeck,validateLandDeck,addLands,refreshDeck,freeUnitCandidates,chooseFreeUnit,landCount,fieldCards,power,symbols,effectiveCost,paymentSources,planPayment,selectedMana,chooseManaColor,effectTargets,resolveEffectTarget,triggerEligible,chooseTrigger,skipTriggers,confirmTriggerPlacement,skipTriggerPlacement,attackTargets,chooseAttackTarget,cancelAttackTarget,manualMove,addCard,toggle,readyMana,remove,draw,shuffle,availableMana,landError,placeLand,playStatus,unitSlots,placementOptions,beginPayment,chooseSlot,togglePaymentLand,paymentInfo,confirmPayment,cancelPayment,advance,toggleDiscard,confirmDiscard,attackError,declareAttack,blockers,chooseBlocker,resolveAttack,
  get mode(){return mode;},get firstPlayer(){return firstPlayer;},get epoch(){return epoch;},get state(){refreshDerived();return state;},get status(){return status;},get turn(){return turn;},get mulligan(){return mulligan;},get operation(){return operation;},get result(){return result;},get supplyStatus(){return supplyStatus;},get log(){return [...log];},get canAdvance(){return status==='ready'&&!result&&!operation&&clock()>=turn.notBefore;}};
}
return {create,ZONES,STEPS};
});
