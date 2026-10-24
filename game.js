// 画面から独立した試作ルール。clock/randomはテストで差し替え可能。
(function(root,factory){
  const rules=factory(typeof module==='object'&&module.exports?require('./mana.js'):root.ManaEngine,typeof module==='object'&&module.exports?require('./cards.js'):root.CardCatalog,typeof module==='object'&&module.exports?require('./decks.js'):root.DeckLibrary);
  if(typeof module==='object'&&module.exports)module.exports=rules;else root.GameRules=rules;
})(globalThis,function(Mana,Catalog,Decks){
'use strict';
const ZONES=[...Array.from({length:7},(_,i)=>({id:`signi-${i+1}`,name:`ユニット${i+1}`,class:'unit'})),
 {id:'lrig',name:'プレイヤーキャラ',class:'lrig'},{id:'extra',name:'サイドボード',pile:true},{id:'main',name:'メインデッキ',pile:true},
 {id:'landDeck',name:'土地デッキ',pile:true},{id:'landTrash',name:'土地トラッシュ',pile:true},
 {id:'energy',name:'マナゾーン'},{id:'trash',name:'トラッシュ',pile:true},
 {id:'structures',name:'設置物'},{id:'exile',name:'除外ゾーン',pile:true},{id:'holding',name:'一時確認',internal:true},{id:'check',name:'チェックゾーン'},{id:'hand',name:'手札',class:'hand'}];
const PLAYERS=['p1','p2'],SELF='p1';
const STEPS={untap:'アンタップ',draw:'ドロー',land:'土地配置',main1:'メイン1',attack:'アタック',main2:'メイン2',end:'エンド'};
const isUnit=z=>ZONES.some(zone=>zone.id===z&&zone.class==='unit');
const isField=z=>isUnit(z)||z==='lrig'||z==='structures';
const label=p=>p==='p1'?'プレイヤー1':'プレイヤー2';
function create({clock=()=>Date.now(),random=()=>Math.random(),mode:initialMode='solo',boundaries={},decks:initialDecks={p1:'green',p2:'green'},presentationMs=0,strictTargets=false}={}) {
 let life={p1:30,p2:30},state,status,turn,mulligan,operation,result,serial=0,log=[],queue=[],supplyStatus,mode=initialMode,firstPlayer=SELF,epoch=0,deckChoices={...initialDecks},stack=[],events=[],eventSerial=0,frameSerial=0,deckRecords=[],chosenSpecs={},vanishedIds=new Set(),extraTurns=[],normalNext=null;
 const clone=x=>JSON.parse(JSON.stringify(x));
 const INITIAL_HAND=5;
 const other=p=>p==='p1'?'p2':'p1';
 const record=message=>{log.push(message);if(log.length>100)log.shift();};
 const ok=message=>{if(message)record(message);return {ok:true,message:message||''};};
 const fail=message=>({ok:false,message});
 function card(name,type,color='赤',cost=null,basic=false,origin=null) {
  const required=type==='土地'||cost===null?null:typeof cost==='number'?Mana.cost(cost):cost;
  return {id:`card-${++serial}`,name,type,color,cost:required,basic,origin,faceUp:true,rest:false,
   ...(type==='通常'?{attack:required?Mana.total(required):0,maxHealth:required?Mana.total(required):0,health:required?Mana.total(required):0}:{}),abilities:[],sick:false,
   mana:type==='土地'?{color,amount:1}:null,symbols:type==='通常'&&Mana.colors.includes(color)?{[color]:1}:{},onUse:[],onEnter:[],onDefeat:[],enteredTurn:null};
 }
 function fromDefinition(key,p=null) {
  const def=Catalog.cards[key];if(!def)throw Error('カード定義がありません：'+key);
  const c=Object.assign(card(def.name,def.type,def.color,def.cost,!!def.basic,p),JSON.parse(JSON.stringify(def)));
  if(c.type==='通常')c.health=c.maxHealth;return c;
 }
 function buildDeck(p,deck=Catalog.startDeck) {
  const spec=typeof deck==='string'?Decks.resolve(deck,deckRecords):deck;const a=[];for(const entry of spec.main)for(let n=0;n<entry.count;n++)a.push(fromDefinition(entry.key,p));
  a.forEach(c=>c.faceUp=false);return a;
 }
 function landCount(p){return state[p].energy.filter(c=>c.type==='土地').length;}
 function fieldCards(p){return [...unitSlots(p).flatMap(z=>state[p][z.id]),...state[p].structures];}
 function attack(c,p=null){const owner=p||locate(c.id)?.p||c.origin||SELF;return c.statMode==='lands'?landCount(owner):c.attack;}
 function refreshDerived(){
  for(const p of PLAYERS)for(const [z,a] of Object.entries(state[p]))for(const c of [...a])if(c.type==='通常'){
   if(c.statMode==='lands'){const damage=isUnit(z)?Math.max(0,(c.maxHealth||0)-(c.health??c.maxHealth??0)):0;c.attack=landCount(p);c.maxHealth=c.attack;c.health=c.maxHealth-damage;}
   if(isUnit(z)&&c.health<=0){rawMove(locate(c.id),p,'trash');enqueue(c.onDeath||[],p,c.id);record(`${c.name}は現在体力0以下のため破壊。`);}
  }
 }
 function resetHealth(c,p){if(c.type==='通常'){c.attack=attack(c,p);if(c.statMode==='lands')c.maxHealth=c.attack;c.health=c.maxHealth;}}
 function healUnit(id,amount){const s=locate(id);if(result||!s||s.card.type!=='通常'||!isUnit(s.z)||!Number.isFinite(amount)||amount<0)return fail('回復対象が不正です。');s.card.health=Math.min(s.card.maxHealth,s.card.health+amount);return ok('体力を回復しました。');}
 function healLife(p,amount){if(!PLAYERS.includes(p)||!Number.isFinite(amount)||amount<0||result)return fail('回復対象が不正です。');life[p]=Math.min(30,life[p]+amount);return ok('ライフを回復しました。');}
 function symbols(p){const sum=Object.fromEntries(Mana.colors.map(c=>[c,0]));for(const c of fieldCards(p))if(c.type==='通常'||c.type==='設置物')for(const color of Mana.colors)sum[color]+=c.symbols?.[color]||0;return sum;}
 function effectiveCost(c,p,base=c.cost){if(c.usageCostOverride)return clone(c.usageCostOverride);const cost={...base},provided=symbols(p);if(fieldCards(p).some(x=>x.id===c.id))for(const color of Mana.colors)provided[color]=Math.max(0,provided[color]-(c.symbols?.[color]||0));if(c.genericReduction){const n=Mana.colors.reduce((n,k)=>n+provided[k],0);cost.generic=Math.max(c.genericReduction.minimum??0,cost.generic-Math.min(c.genericReduction.maximum??Infinity,n));}if(c.reduction)for(const color of Mana.colors)if(cost[color]>0)cost[color]=Math.max(c.reduction.minimum?.[color]??1,cost[color]-Math.min(c.reduction.maximum??Infinity,provided[color]));return cost;}
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
 function validateDeck(a,expected=40,presetSpec=null) {
  if(a.length!==Decks.MAIN_SIZE)throw Error('通常デッキは40枚です。');
  const exempt=Decks.isOfficialPreset(presetSpec)&&JSON.stringify(a.map(c=>c.key).sort())===JSON.stringify(presetSpec.main.flatMap(e=>Array(e.count).fill(e.key)).sort());
  const counts=new Map(),limits=new Map();for(const c of a){const d=Catalog.cards[c.key];if(!d||d.deckEligible===false||d.generated||d.token||Decks.sectionOf(d)!=='main')throw Error('土地・生成専用・採用不可カードは通常デッキに入れられません。');counts.set(d.name,(counts.get(d.name)||0)+1);limits.set(d.name,Math.min(limits.get(d.name)??Infinity,Decks.limit(d)));}
  if(!exempt)for(const [name,n]of counts)if(n>limits.get(name))throw Error(`${name}の同名採用上限は${limits.get(name)}枚です。`);return true;
 }
 function buildLandDeck(p,deck=Catalog.startLandDeck){const spec=typeof deck==='string'?Decks.resolve(deck,deckRecords):deck;const a=[];for(const entry of spec.lands)for(let n=0;n<entry.count;n++)a.push(fromDefinition(entry.key,p));a.forEach(c=>c.faceUp=false);return a;}
 function validateLandDeck(a){if(a.length!==20||a.some(c=>Decks.sectionOf(c)!=='lands'))throw Error('土地デッキは20枚です。');return true;}
 function shuffleRaw(p,z) {const a=state[p][z];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}}
 function refreshDeck(p,land=false){
  const deck=land?'landDeck':'main',trash=land?'landTrash':'trash';if(state[p][deck].length)return true;
  const eligible=state[p][trash].filter(c=>land?c.type==='土地':c.type!=='土地'&&!c.resolving);
  if(!eligible.length)return false;const ids=new Set(eligible.map(c=>c.id));state[p][trash]=state[p][trash].filter(c=>!ids.has(c.id));
  eligible.forEach(c=>{c.faceUp=false;c.rest=false;c.sick=false;});state[p][deck].push(...eligible);shuffleRaw(p,deck);
  record(`${label(p)}：${land?'土地':'メイン'}デッキを${trash==='trash'?'通常のトラッシュ':'土地トラッシュ'}${eligible.length}枚でリフレッシュ。${land?'土地リフレッシュ。':'メインリフレッシュ。'}`);

  return true;
 }
 function mainCard(p){if(!refreshDeck(p)){supplyStatus[p].main='メインデッキと通常トラッシュから補充不能。';record(`${label(p)}：${supplyStatus[p].main}`);finish(other(p),'山札をリフレッシュできず必要なカードを補充できない');return null;}supplyStatus[p].main='';const c=state[p].main.shift();refreshDeck(p);return c;}
 function drawRaw(p,count){let drawn=0;for(let i=0;i<count;i++){const c=mainCard(p);if(!c)break;c.faceUp=true;c.rest=false;state[p].hand.push(c);drawn++;}return drawn;}
 function addLands(p,count=1,reason='効果'){
  let placed=0;for(let i=0;i<count;i++){if(!refreshDeck(p,true)){supplyStatus[p].land='土地デッキ・土地トラッシュともに空。この土地配置だけを省略。';record(`${label(p)}：${supplyStatus[p].land}`);break;}
   const c=state[p].landDeck.shift();c.faceUp=true;c.rest=false;state[p].energy.push(c);placed++;supplyStatus[p].land='';
  }if(placed)record(`${label(p)}：${reason}で土地${placed}枚を未使用で追加。`);refreshDerived();return placed;
 }
 function reset(nextMode=mode,nextDecks=deckChoices) {
  let specs;try{specs=Object.fromEntries(PLAYERS.map(p=>{const d=Decks.resolve(nextDecks[p],deckRecords),errors=Decks.validate(d);if(errors.length)throw Error(errors.join('／'));return [p,d];}));}catch(e){return fail(e.message);}chosenSpecs=specs;deckChoices={...nextDecks};vanishedIds=new Set();extraTurns=[];normalNext=null;stack=[];events=[];eventSerial=0;frameSerial=0;
  if(!['solo','bot'].includes(nextMode))return fail('モードを選んでください。');mode=nextMode;epoch++;firstPlayer=mode==='bot'?(random()<.5?'p1':'p2'):SELF;
  life={p1:30,p2:30};serial=0;log=[];queue=[];supplyStatus={p1:{main:'',land:''},p2:{main:'',land:''}};result=null;operation=null;status='mulligan';turn={player:firstPlayer,counts:{p1:0,p2:0},sequence:0,number:0,step:'untap',landsPlaced:0,key:{},notBefore:0,lastDraw:0};mulligan={p1:'pending',p2:'pending'};
  state=Object.fromEntries(PLAYERS.map(p=>[p,Object.fromEntries(ZONES.map(z=>[z.id,[]]))]));
  for(const p of PLAYERS){state[p].main=buildDeck(p,chosenSpecs[p]);validateDeck(state[p].main,40,chosenSpecs[p]);state[p].landDeck=buildLandDeck(p,chosenSpecs[p]);state[p].extra=(chosenSpecs[p].sideboard||[]).flatMap(e=>Array.from({length:e.count},()=>fromDefinition(e.key,p)));validateLandDeck(state[p].landDeck);shuffleRaw(p,'main');shuffleRaw(p,'landDeck');drawRaw(p,INITIAL_HAND);}
  record(`${mode==='bot'?'Bot戦':'壁打ち'}：先攻は${label(firstPlayer)}。選択したメインデッキ・土地20枚から初期手札5枚を配りました。`);return ok('各プレイヤーのマリガンを選択してください。');
 }
 function completeMulligan(p,ids=[],skip=false) {
  if(status!=='mulligan'||mulligan[p]!=='pending'||result)return fail('このプレイヤーのマリガンは完了しています。');
  if(new Set(ids).size!==ids.length||ids.length>INITIAL_HAND||ids.some(id=>!state[p].hand.some(c=>c.id===id)))return fail('初期手札から0〜5枚を選んでください。');
  mulligan[p]='done';
  if(!skip){const selected=new Set(ids),a=state[p].hand.filter(c=>selected.has(c.id));state[p].hand=state[p].hand.filter(c=>!selected.has(c.id));a.forEach(c=>{c.faceUp=false;c.rest=false;});state[p].main.push(...a);drawRaw(p,a.length);if(!result)shuffleRaw(p,'main');}
  record(`${label(p)}：${skip?'交換せず確定':ids.length+'枚交換、ドロー後にシャッフル'}。`);
  if(!result&&PLAYERS.every(w=>mulligan[w]==='done')){status='ready';beginTurn();}
  return ok(status==='ready'?'ライフ30で第1ターンを開始しました。':'もう一人のマリガンを選択してください。');
 }
 function locate(id) {for(const p of PLAYERS)for(const z of ZONES){const index=state[p][z.id].findIndex(c=>c.id===id);if(index>=0)return {p,z:z.id,index,card:state[p][z.id][index]};}return null;}
 function rawMove(source,p,z,bottom=true) {
  if(z==='trash'&&source.card.type==='土地')z='landTrash';
  const [c]=state[source.p][source.z].splice(source.index,1),leaving=isUnit(source.z)&&!isUnit(z);
  if(source.z==='exile'&&z!=='exile')delete c.returnReservation;
  if(leaving){const group=[...(c.under||[]),c];c.under=[];const real=group.filter(x=>!x.token);if(!real.length)return c;
   if(z==='main'&&real.length>1){state[p].holding.push(...real);operation={kind:'stackOrder',p,ids:real.map(c=>c.id),order:real.map(c=>c.id),destination:z};return c;}
   for(const item of real){if(z==='hand')item.faceUp=true;if(bottom)state[p][z].push(item);else state[p][z].unshift(item);}if(z==='trash')refreshDeck(p);return c;
  }
  if(isUnit(z)&&!isUnit(source.z)){c.sick=true;c.enteredTurn=turn.counts[p];}if(z==='landDeck')c.faceUp=false;
  if(bottom)state[p][z].push(c);else state[p][z].unshift(c);if(source.z==='main')refreshDeck(source.p);if(z==='trash')refreshDeck(p);return c;
 }
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
  if(!c?.id||vanishedIds.has(c.id)||locate(c.id))return fail('消滅した個体や、既に存在する個体は追加できません。');
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
 function draw(p,n=1) {if(mode==='bot')return fail('Bot戦では補助操作を使えません。');const e=interactionError();if(e)return fail(e);if(!Number.isInteger(n)||n<1)return fail('ドロー枚数が不正です。');const count=drawRaw(p,n);return ok(`手動ドロー（補助）：${label(p)}が${count}枚引きました。`);}
 function shuffle(p,z) {if(mode==='bot')return fail('Bot戦では補助操作を使えません。');const e=interactionError();if(e)return fail(e);shuffleRaw(p,z);return ok('山札をシャッフルしました。');}
 function availableMana(p) {const sources=paymentSources(p);return {total:sources.length,...Object.fromEntries(Mana.colors.map(color=>[color,sources.filter(s=>s.colors.includes(color)).length])),flexible:sources.filter(s=>s.colors.length>1).length};}
 function landError(){return '手札からの通常土地配置は廃止。ターン開始時に土地デッキから自動配置します。';}
 function placeLand(){return fail(landError());}
 function unitSlots(p) {return ZONES.filter(z=>isUnit(z.id));}
 function evolutionBases(p,c){return unitSlots(p).filter(z=>state[p][z.id][0]?.type==='通常'&&(c.evolution?.any||state[p][z.id][0].color===c.evolution?.color));}
 function placementOptions(p,c=null){if(c?.evolution)return evolutionBases(p,c);const slots=unitSlots(p),empty=slots.filter(z=>!state[p][z.id].length);return empty.length?empty:slots;}
 function foretoldReady(c,p){return !!c.foretold&&c.foretold.owner===p&&turn.sequence>c.foretold.sequence;}
 function counterCards(p){return [...state[p].hand,...state[p].exile.filter(c=>foretoldReady(c,p))].filter(c=>c.responseOnly&&planPayment(effectiveCost(c,p,c.foretold?c.foretell.useCost:c.cost),p));}
 function useCost(c,p,purpose='normal'){if(purpose==='set')return clone(c.foretell.cost);if(purpose==='gzero')return Mana.cost(0);return effectiveCost(c,p,c.foretold?c.foretell.useCost:c.cost);}
 function useError(c,p,purpose='normal'){
  if(purpose==='counter'){if(operation?.kind!=='response'||operation.p!==p||!counterCards(p).some(x=>x.id===c.id))return '使用できる対抗呪文を応答で選んでください。';return '';}
  const e=mainError(p);if(e)return e;if(purpose==='set'){if(!c.foretell||locate(c.id)?.z!=='hand')return '手札の予顕カードを選んでください。';return '';}
  if(c.responseOnly)return '対抗呪文は相手のカード使用への応答でのみ使用できます。';
  const z=locate(c.id)?.z;if(z==='exile'&&!foretoldReady(c,p))return 'この予顕カードはまだ使用できません。';if(!['hand','exile'].includes(z)||z==='exile'&&!c.foretold)return '使用できる手札または予顕個体を選んでください。';
  if(purpose==='gzero'&&(!c.gZero||z!=='hand'||state[p].hand.length<c.gZero.hand))return '使用前の手札10枚以上が必要です。';
  if(c.evolution&&!evolutionBases(p,c).length)return '条件を満たす自分のユニットの進化元が必要です。';return '';
 }
 function playStatus(c,p){
  if(c.type==='土地'){const e=landError();return {ok:false,text:e,reasons:[e]};}
  if(!['通常','呪文','設置物'].includes(c.type)||!c.cost)return {ok:false,text:'通常使用の対象外',reasons:['通常使用の対象外です。']};
  const gzero=!!c.gZero&&locate(c.id)?.z==='hand'&&state[p].hand.length>=c.gZero.hand,purpose=gzero?'gzero':'normal',e=useError(c,p,purpose),cost=useCost(c,p,purpose),plan=planPayment(cost,p),reasons=e?[e]:[];
  if(!plan)reasons.push(...Mana.assess(cost,availableMana(p)).reasons);if(!plan&&!reasons.length)reasons.push('必要な色マナの組み合わせを満たせません。');
  return {ok:!reasons.length,text:reasons[0]||(gzero?'G・ゼロ使用可':'マナ支払い可'),reasons,gzero};
 }
 function beginPayment(id,purpose='normal'){
  const source=locate(id);if(!source)return fail('カードが見つかりません。');const c=source.card,p=source.p;
  if(purpose==='normal'&&c.gZero&&source.z==='hand'&&state[p].hand.length>=c.gZero.hand)purpose='gzero';
  const e=useError(c,p,purpose);if(e)return fail(e);const cost=useCost(c,p,purpose),plan=planPayment(cost,p);if(!plan)return fail(Mana.assess(cost,availableMana(p)).reasons.join('／')||'色マナ不足');
  const response=purpose==='counter'?operation:null;operation={kind:'payment',id,p,purpose,sourceZone:source.z,cost,slot:null,replacedId:null,targetId:null,response,...plan};return ok('使用方法・軽減後コスト・支払い元・配置先を確認してください。');
 }
 function beginForetell(id){return beginPayment(id,'set');}
 function chooseSlot(z) {const o=operation;if(!['payment','freePlace','returnPlace'].includes(o?.kind))return fail('配置操作がありません。');if(!placementOptions(o.p,locate(o.id)?.card).some(s=>s.id===z))return fail('空き枠を選んでください。満杯時のみ上書きできます。');o.slot=z;o.replacedId=state[o.p][z][0]?.id||null;return ok('配置先を選びました。');}
 function togglePaymentLand(id) {
  const o=operation;if(o?.kind!=='payment')return fail('支払い操作がありません。');const source=paymentSources(o.p).find(c=>c.id===id);if(!source)return fail('未使用で起動可能な自分の支払い元を選んでください。');
  o.sourceIds=o.sourceIds.includes(id)?o.sourceIds.filter(x=>x!==id):[...o.sourceIds,id];if(!o.sourceColors[id])o.sourceColors[id]=source.colors[0];return ok('支払い案を変更しました。');
 }
 function chooseManaColor(id,color){const o=operation,s=paymentSources(o?.p||SELF).find(s=>s.id===id);if(o?.kind!=='payment'||!s||!s.colors.includes(color))return fail('この支払い元で出せる色を選んでください。');o.sourceColors[id]=color;return ok('マナ能力の色を選びました。');}
 function placementInfo(o,c){
  if(c.type!=='通常'||o.purpose==='set')return {ok:true,replacement:null};
  if(c.evolution){const base=state[o.p][o.slot]?.[0];return base&&base.id===o.replacedId&&(c.evolution.any||base.color===c.evolution.color)?{ok:true,replacement:null,base}:fail('条件を満たす進化元を選んでください。');}if(!isUnit(o.slot))return fail('配置先を選んでください。');const current=state[o.p][o.slot];
  if(current.length>1||(current[0]?.id||null)!==o.replacedId)return fail('配置先または上書き対象が変わりました。');
  if(o.replacedId&&unitSlots(o.p).some(z=>!state[o.p][z.id].length))return fail('空き枠へ配置先を選び直してください。');return {ok:true,replacement:current[0]||null};
 }
 function paymentInfo(expected=operation) {
  const o=operation;if(!o||o!==expected||o.kind!=='payment')return fail('この支払い操作は終了しています。');const e=o.purpose==='counter'?'':mainError(o.p,true);if(e)return fail(e);
  const s=locate(o.id);if(!s||s.p!==o.p||s.z!==o.sourceZone||!s.card.cost)return fail('対象カードが手札にありません。');if(o.purpose==='set'&&!s.card.foretell)return fail('予顕できません。');if(s.z==='exile'&&!foretoldReady(s.card,o.p))return fail('予顕したターンには使えません。');if(o.purpose==='gzero'&&state[o.p].hand.length<s.card.gZero.hand)return fail('G・ゼロ条件が変わりました。');const place=placementInfo(o,s.card);if(!place.ok)return place;
  if(new Set(o.sourceIds).size!==o.sourceIds.length)return fail('支払い元を重複して選べません。');const sources=selectedMana(o);if(sources.some(s=>!s||!s.source.colors.includes(s.mana.color)))return fail('支払い元の状態・召喚酔い・色が変わりました。');
  const cost=useCost(s.card,o.p,o.purpose),payment=Mana.payment(cost,sources);if(!payment.ok)return fail(payment.reasons.join('／'));
  return {ok:true,source:s,sources,replacement:place.replacement,base:place.base,cost};
 }
 function enterCard(s,p,slot,replacement=null){
  if(replacement){rawMove(locate(replacement.id),p,'trash');record(`${replacement.name}を上書きでトラッシュへ送りました。`);}
  const c=rawMove(s,p,s.card.type==='設置物'?'structures':slot);c.faceUp=true;c.rest=!!c.enterRest;c.sick=c.type==='通常';c.enteredTurn=turn.counts[p];
  if(c.type==='通常')unitEntered(c,p);else enqueue(c.onEnter||[],p,c.id);refreshDerived();return c;
 }
 function unitEntered(c,p,returning=false){
  resetHealth(c,p);c.sick=true;c.rest=!!c.enterRest;c.enteredTurn=turn.counts[p];
  // 同時に誘発した登場時能力は、本人の効果→場にあった設置物の順で解決。
  const triggers=state[p].structures.flatMap(s=>(s.onUnitEnter||[]).map(e=>({...e,triggerName:s.name})));
  enqueue([...(returning?[]:c.onEnter||[]),...triggers],p,c.id);
 }
 function useSpell(s,p,foretold=false,targetId=null){const c=s.z==='check'?s.card:rawMove(s,p,'check');c.faceUp=true;c.resolving=true;enqueue([...(foretold&&c.foretell?.onUse?c.foretell.onUse:c.onUse||[]),{kind:'cleanup'}],p,c.id,targetId);return c;}
 function confirmPayment(expected=operation){
  const checked=paymentInfo(expected);if(!checked.ok)return checked;const o=operation,c=checked.source.card;
  const targetEffect=(o.purpose==='set'?c.foretell?.onSet:(c.foretold?(c.foretell?.onUse||c.onUse):c.onUse))?.find(e=>['bounce','trap','mother'].includes(e.kind));
  if(strictTargets&&targetEffect&&targetOptions(targetEffect,o.p).length&&!targetOptions(targetEffect,o.p).some(x=>x.id===o.targetId))return fail('使用前に対象を1枚選んでください。');
  operation=null;checked.sources.forEach(s=>s.source.card.rest=true);
  if(o.purpose==='set'){rawMove(checked.source,o.p,'exile');c.faceUp=false;c.foretold={owner:o.p,sequence:turn.sequence};enqueue(c.foretell.onSet||[],o.p,c.id,o.targetId);announce({kind:'foretell',p:o.p,cardId:c.id,method:'予顕として伏せる',text:'予顕カードを裏向きに伏せました。'},'effects');}
  else declareUse(checked.source,{p:o.p,paidCost:checked.cost,method:o.purpose==='counter'?(c.foretold?'予顕から応答':'応答'):o.purpose==='gzero'?'G・ゼロ':c.foretold?'予顕使用':'通常使用',slot:o.slot,replacedId:o.replacedId,baseId:checked.base?.id,targetId:o.targetId,counterTarget:o.response?.frameId,foretold:!!c.foretold});
  return ok('支払いを確定しました。');
 }
 function cancelPayment(){if(operation?.kind!=='payment')return fail('キャンセルできる支払い操作がありません。');operation=operation.response||null;return ok('支払いをキャンセルしました。支払い元は変更していません。');}
 function selectUseTarget(id){const o=operation;if(!o||!['payment','freePlace','freeCast','returnPlace'].includes(o.kind))return fail('使用確認中ではありません。');const c=locate(o.id)?.card,e=(o.purpose==='set'?c?.foretell?.onSet:c?.foretold?(c.foretell.onUse||c.onUse):c?.onUse)?.find(e=>['bounce','trap','mother'].includes(e.kind));if(!e||!targetOptions(e,o.p).some(x=>x.id===id))return fail('有効なユニット・設置物を選んでください。土地は対象外です。');o.targetId=id;return ok('使用前の対象を確定しました。');}
 function announce(event,after){const publicEvent={id:++eventSerial,...event};if(event.kind!=='foretell'){const c=locate(event.cardId)?.card;if(c)publicEvent.card=clone(c);}events.push(publicEvent);if(events.length>80)events.shift();if(presentationMs>0){operation={kind:'presentation',event:publicEvent,until:clock()+presentationMs,after};}else continueAnnouncement(after);}
 function continueAnnouncement(after){if(after==='window')responseWindow();else if(after==='stack')resolveStack();else pump();}
 function finishPresentation(expected=operation){const o=operation;if(o!==expected||o?.kind!=='presentation'||result)return fail('以前の演出です。');if(clock()<o.until)return fail('カード表示中です。');operation=null;continueAnnouncement(o.after);return ok('公開行動を表示しました。');}
 function prepareFreeUse(source,options){const c=source.card,e=c.onUse?.find(e=>['bounce','trap','mother'].includes(e.kind));if(strictTargets&&e&&targetOptions(e,options.p).length)operation={kind:'freeCast',id:c.id,p:options.p,options,targetId:null};else declareUse(source,options);}
 function confirmFreeCast(expected=operation){const o=operation;if(o!==expected||o?.kind!=='freeCast')return fail('以前の無料使用です。');const s=locate(o.id),e=s?.card.onUse?.find(e=>['bounce','trap','mother'].includes(e.kind));if(!s||!targetOptions(e,o.p).some(c=>c.id===o.targetId))return fail('対象を確定してください。');operation=null;declareUse(s,{...o.options,targetId:o.targetId});return ok('無料使用を宣言しました。');}
 function declareUse(source,options){const c=source.card,p=options.p;rawMove(source,p,'check');c.faceUp=true;c.resolving=true;const frame={id:++frameSerial,cardId:c.id,...options,responded:false,canceled:false};delete c.foretold;stack.push(frame);record(`${label(p)}が${c.name}を${frame.method}で使用宣言。`);announce({kind:'use',p,cardId:c.id,method:frame.method,cost:frame.paidCost||Mana.cost(0),text:'使用宣言・解決待ち'},'window');}
 function responseWindow(){const f=stack.at(-1);if(!f)return pump();const c=locate(f.cardId)?.card;f.responded=true;const responder=other(f.p);if(c&&!c.uncounterable&&counterCards(responder).length){operation={kind:'response',p:responder,frameId:f.id,cardId:f.cardId};return;}resolveStack();}
 function passResponse(expected=operation){const o=operation;if(o!==expected||o?.kind!=='response')return fail('応答待ちではありません。');operation=null;resolveStack();return ok('対抗呪文を使わず解決へ進みます。');}
 function resolveStack(){if(operation||result)return;const f=stack.pop();if(!f)return pump();const source=locate(f.cardId);if(!source)return resolveStack();const c=source.card;
  if(f.canceled){const snapshot=clone(c);c.resolving=false;if(c.vanishAfterUse)vanish(source);else rawMove(source,f.p,'trash');record(`${c.name}を無効化。${c.vanishAfterUse?'使用後消滅':'トラッシュへ'}。支払いは戻りません。`);announce({kind:'countered',p:f.p,cardId:c.id,card:snapshot,method:f.method,text:'無効化'},'stack');return;}
  if(c.responseOnly){const target=stack.find(x=>x.id===f.counterTarget);if(target)target.canceled=true;c.resolving=false;rawMove(source,f.p,'trash');resolveStack();return;}
  c.resolving=false;
  if(c.type==='呪文'){useSpell(source,f.p,f.foretold,f.targetId);}else if(c.evolution){const base=state[f.p][f.slot]?.[0];if(!base||base.id!==f.baseId){rawMove(source,f.p,'trash');record('進化元がなく、配置を終了。');}else{state[f.p][f.slot].shift();c.under=[...(base.under||[]),base];base.under=[];rawMove(source,f.p,f.slot);unitEntered(c,f.p);c.rest=base.rest;c.sick=false;record(`${c.name}が進化。使用済みを継承。`);}}
  else {const replacement=f.replacedId?locate(f.replacedId)?.card:null;enterCard(source,f.p,f.slot,replacement);}
  if(stack.length)resolveStack();else pump();
 }
 function beginTurn() {
  let p,extra=false;if(turn.sequence===0){p=firstPlayer;normalNext=other(p);}else if(extraTurns.length){p=extraTurns.shift();extra=true;}else if(mode==='bot'){p=normalNext;normalNext=other(p);}else p=SELF;
  operation=null;turn.player=p;turn.extra=extra;turn.sequence++;turn.counts[p]++;turn.number=turn.counts[p];turn.key={};turn.step='untap';turn.lastDraw=0;turn.attacks=0;
  for(const z of ZONES)if(isField(z.id)||z.id==='energy')state[p][z.id].forEach(c=>{c.rest=false;if(isField(z.id))c.sick=false;});
  turn.landsPlaced=0;record(`${label(p)}の第${turn.number}ターン${extra?'（追加ターン）':''}：アンタップ、召喚酔い解除。`);
  const returning=state[p].exile.filter(c=>c.returnReservation?.owner===p&&c.returnReservation.at<=turn.counts[p]);
  enqueue([...returning.map(c=>({kind:'return',id:c.id})),{kind:'startDrawLand'}],p,null);pump();
 }
 function startDrawLand(p){turn.step='draw';turn.skippedDraw=turn.sequence===1;if(turn.skippedDraw)record('先攻第1ターン：ドローなし');else{turn.lastDraw=drawRaw(p,1);record(`通常ドロー：${label(p)}が${turn.lastDraw}枚。`);}turn.step='land';turn.landsPlaced=addLands(p,1,'ターン開始時の自動配置');turn.step='main1';record(`${label(p)}のメイン1を開始しました。`);}
 function vanish(source){if(!source)return;const c=source.card;state[source.p][source.z].splice(source.index,1);vanishedIds.add(c.id);record(`${c.name}は使用後に消滅しました（トラッシュ・除外には置きません）。`);}
 function hasJil(p){return fieldCards(p).some(c=>c.key==='jil');}
 function grantExtraTurns(p){const owners=hasJil(p)?[p]:[p,other(p)];extraTurns.push(...owners.filter(x=>mode==='bot'||x===SELF));record(`追加ターンを解決順の末尾へ予約：${owners.map(label).join('→')}。${mode==='solo'?'壁打ちの相手分は記録のみ。':''}`);}
 function blinkSelf(id){const s=locate(id);if(!s||!isUnit(s.z))return;const c=s.card,p=s.p;rawMove(s,p,'exile');c.returnReservation={owner:p,at:turn.counts[p]+1};record(`${c.name}を除外し、次の自分のターン開始時の帰還を予約。`);}
 function confirmReturn(expected=operation){const o=operation,s=locate(o?.id);if(o!==expected||o?.kind!=='returnPlace'||!s||s.z!=='exile'||s.card.returnReservation?.owner!==o.p)return fail('帰還予約がありません。');const checked=placementInfo(o,s.card);if(!checked.ok)return checked;operation=null;if(checked.replacement)rawMove(locate(checked.replacement.id),o.p,'trash');const c=rawMove(s,o.p,o.slot);delete c.returnReservation;c.faceUp=true;c.speedAttacker=true;unitEntered(c,o.p,true);record(`${c.name}がスピードアタッカーを持って帰還。`);pump();return ok('帰還を確定しました。');}
 function advance(expectedKey=turn.key) {
  const e=interactionError();if(e)return fail(e);if(expectedKey!==turn.key||clock()<turn.notBefore)return fail('フェイズ処理中、または以前の操作です。');
  turn.key={};turn.notBefore=clock()+350;
  if(turn.step==='main1')turn.step='attack';else if(turn.step==='attack')turn.step='main2';else if(turn.step==='main2'){
   turn.step='end';enqueue(fieldCards(turn.player).flatMap(c=>c.onEnd||[]),turn.player,null);pump();
  }else if(turn.step==='end'){beginTurn();}else return fail('進行できないフェイズです。');
  return ok(`${STEPS[turn.step]}へ進みました。`);
 }
 function toggleDiscard(){return fail('手札上限はありません。');}
 function confirmDiscard(){return fail('手札上限はありません。');}
 function enqueue(effects,p,sourceId,targetId=null){queue.unshift(...effects.map(effect=>({...JSON.parse(JSON.stringify(effect)),p,sourceId,targetId})));}
 function pump(){
  while(queue.length&&!operation&&!result&&!stack.length){
   const effect=queue.shift(),p=effect.p,sourceId=effect.sourceId;
   if(effect.kind==='startDrawLand'){startDrawLand(p);}
   else if(effect.kind==='return'){const s=locate(effect.id);if(s?.z==='exile'&&s.card.returnReservation?.owner===p){operation={kind:'returnPlace',p,id:effect.id,slot:null,replacedId:null};break;}}
   else if(effect.kind==='chooseFate'){operation={kind:'fateChoice',p,sourceId};break;}
   else if(effect.kind==='fateWhim'){const before=new Set(state[p].hand.map(c=>c.id)),drawn=drawRaw(p,1);const c=state[p].hand.find(c=>!before.has(c.id));if(c&&hasJil(p))c.usageCostOverride=Mana.cost(1);record(`${label(p)}：運命で${drawn}枚ドロー${c?.usageCostOverride?'し、その個体の使用コストを1に変更':''}。`);}
   else if(effect.kind==='drawIfJil'){if(hasJil(p))drawRaw(p,effect.count);}
   else if(effect.kind==='extraTurns'){grantExtraTurns(p);}
   else if(effect.kind==='blinkSelf'){blinkSelf(sourceId);}
   else if(effect.kind==='wipeUnits'){for(const owner of PLAYERS)for(const c of fieldCards(owner).filter(c=>c.type==='通常'))rawMove(locate(c.id),owner,'trash');record('両者のユニットをすべてトラッシュへ。設置物・土地は残ります。');}
   else if(effect.kind==='handDiscard'){if(state[p].hand.length){operation={kind:'handPick',p,effect:effect.kind};break;}record('手札に選べるカードがないため省略。');}
   else if(effect.kind==='optionalEffect'){operation={kind:'optionalEffect',p,label:effect.label,effects:effect.effects,sourceId};break;}
   else if(effect.kind==='millRecover'){const a=[];for(let i=0;i<effect.count;i++){const c=mainCard(p);if(!c)break;a.push(c);state[p].holding.push(c);}for(const c of a){state[p].holding.splice(state[p].holding.indexOf(c),1);c.faceUp=true;state[p].trash.push(c);}record(`${label(p)}が上から${a.length}枚をトラッシュへ。`);if(state[p].trash.some(c=>c.type==='通常')){operation={kind:'recoverUnit',p};break;}refreshDeck(p);record('回収できるユニットなし。');}
   else if(effect.kind==='untapLands'){if(state[p].energy.some(c=>c.type==='土地')){operation={kind:'untapLands',p,max:effect.count,ids:[]};break;}}
   else if(effect.kind==='attackContinue'){continueAttack(effect.id,effect.target);}
   else if(effect.kind==='land'){if(effect.triggerName)record(`${effect.triggerName}のユニット登場誘発。`);addLands(p,effect.count||1);}
   else if(effect.kind==='draw'){const n=drawRaw(p,effect.count);record(`${label(p)}が${n}枚ドロー。`);}
   else if(effect.kind==='drawIfLandMax'){if(landCount(p)<=effect.max)drawRaw(p,effect.count);record(`土地追加後の土地${landCount(p)}枚でドロー条件を判定。`);}
   else if(['trap','mother','bounce','topUnit'].includes(effect.kind)){
    const targetPlayer=other(p),targetPlayers=['mother','bounce'].includes(effect.kind)?PLAYERS:[targetPlayer],candidates=targetOptions(effect,p);
    if(candidates.length){operation={kind:'effectTarget',p,targetPlayer,targetPlayers,effect:effect.kind,sourceId,selectedId:null};if(effect.targetId&&candidates.some(c=>c.id===effect.targetId))resolveEffectTarget(effect.targetId);else break;}
    else record('対象がないため、後半を含め効果を省略。');
   }else if(effect.kind==='freeUnit'){
    operation={kind:'freeUnit',p,sourceId};if(!freeUnitCandidates().length){operation=null;record(`${label(p)}：土地枚数以下の手札ユニットなし。無料登場を省略。`);}
    else break;
   }else if(effect.kind==='wipe'){
    for(const owner of PLAYERS)for(const c of [...fieldCards(owner)])if(c.id!==sourceId&&(c.type==='通常'||c.type==='設置物'))rawMove(locate(c.id),owner,'trash');
    refreshDerived();record('本人以外の両者のユニット・設置物をトラッシュへ送りました。');
   }else if(effect.kind==='revealBlue'){
    const a=[];for(let i=0;i<effect.count;i++){const c=mainCard(p);if(!c)break;a.push(c);state[p].holding.push(c);}record(`公開：${a.map(c=>c.name).join('／')||'カードなし'}。青を手札へ（ドローではない）。`);
    for(const c of a){state[p].holding.splice(state[p].holding.indexOf(c),1);c.faceUp=true;state[p][c.color==='青'?'hand':'trash'].push(c);}refreshDeck(p);
   }else if(effect.kind==='reorder'||effect.kind==='scry'){
    if(!state[p].main.length)refreshDeck(p);const a=state[p].main.slice(0,effect.count);if(a.length){operation={kind:'reorder',p,sourceId,ids:a.map(c=>c.id),order:a.map(c=>c.id),scry:effect.kind==='scry'};break;}
   }else if(effect.kind==='searchSpell'){
    const candidates=state[p].main.filter(c=>c.type==='呪文'&&c.cost&&Mana.total(c.cost)<=effect.max&&!c.responseOnly);if(candidates.length){operation={kind:'searchSpell',p,sourceId,max:effect.max};break;}record('使用可能な4コスト以下の呪文なし。');
   }else if(effect.kind==='tokens'){
    if(effect.count>0){operation={kind:'tokens',p,remaining:effect.count,sourceId};break;}
   }else if(effect.kind==='inspectDiscard'){
    operation={kind:'inspectHand',p,targetPlayer:other(p),max:effect.max};break;
   }else if(effect.kind==='randomDiscard'){
    const candidates=[...state[other(p)].hand];let n=0;for(let i=0;i<effect.count&&candidates.length;i++){const c=candidates.splice(Math.floor(random()*candidates.length),1)[0];rawMove(locate(c.id),other(p),'trash');n++;}record(`${label(other(p))}がランダムに${n}枚捨てました。`);
   }else if(effect.kind==='optionalDraw'){operation={kind:'optionalDraw',p,count:effect.count};break;
   }else if(effect.kind==='endCheck'){/* No hand size limit. */
   }else if(effect.kind==='cleanup'){
    const s=locate(sourceId);if(s&&s.z==='check'){s.card.resolving=false;if(s.card.vanishAfterUse)vanish(s);else rawMove(s,s.p,'trash');record(`${s.card.name}の解決が完了${s.card.vanishAfterUse?'（使用後消滅）':'し、トラッシュへ送りました'}。`);}
   }
  }
  refreshDerived();
 }
 function targetOptions(effect,p){if(!['mother','bounce','trap','topUnit'].includes(effect.kind))return [];const owners=['mother','bounce'].includes(effect.kind)?PLAYERS:[other(p)];return owners.flatMap(owner=>unitSlots(owner).flatMap(z=>state[owner][z.id]).filter(c=>c.type==='通常').concat(effect.kind==='bounce'?state[owner].structures.filter(c=>c.type==='設置物'):[]));}
 function effectTargets(){const o=operation;return o?.kind==='effectTarget'?targetOptions({kind:o.effect},o.p):[];}
 function resolveEffectTarget(id,expected=operation){
  const o=operation;if(o!==expected||o?.kind!=='effectTarget'||!effectTargets().some(c=>c.id===id))return fail('有効な対象を1枚選んでください。土地は対象外です。');
  const source=locate(id),owner=source.p,c=source.card;operation=null;rawMove(source,owner,o.effect==='bounce'?'hand':o.effect==='topUnit'?'main':'trash',o.effect!=='topUnit');
  record(`${c.name}を${o.effect==='bounce'?'手札へ戻した':o.effect==='topUnit'?'メインデッキの上へ戻した':'トラッシュへ送った'}。`);
  if(['trap','mother'].includes(o.effect))enqueue([{kind:o.effect==='mother'?'freeUnit':'land',count:1}],owner,o.sourceId);pump();return ok('対象の処理を完了しました。');
 }
 function privateCandidates(){const o=operation;if(!o)return [];if(['reorder','stackOrder'].includes(o.kind))return o.order.map(id=>locate(id)?.card).filter(Boolean);if(o.kind==='searchSpell')return state[o.p].main.filter(c=>c.type==='呪文'&&c.cost&&Mana.total(c.cost)<=o.max&&!c.responseOnly);if(o.kind==='handPick')return state[o.p].hand;if(o.kind==='recoverUnit')return state[o.p].trash.filter(c=>c.type==='通常');if(o.kind==='inspectHand')return state[o.targetPlayer].hand;return [];}
 function reorderCard(id,delta){const o=operation;if(!['reorder','stackOrder'].includes(o?.kind))return fail('並べ替え中ではありません。');const i=o.order.indexOf(id),j=i+delta;if(i<0||j<0||j>=o.order.length)return fail('順番の端です。');[o.order[i],o.order[j]]=[o.order[j],o.order[i]];return ok('上からの順を変更しました。');}
 function confirmOrder(bottom=false,expected=operation){const o=operation;if(o!==expected||!['reorder','stackOrder'].includes(o?.kind))return fail('以前の並べ替えです。');if(o.kind==='stackOrder'){const a=o.order.map(id=>locate(id)?.card);if(a.some(c=>!c))return fail('個体が変わりました。');for(const id of o.order){const src=locate(id);state[src.p][src.z].splice(src.index,1);}state[o.p].main.unshift(...a);}else{if(o.ids.some((id,i)=>state[o.p].main[i]?.id!==id))return fail('確認中の山札が変わりました。');const a=state[o.p].main.splice(0,o.ids.length),ordered=o.order.map(id=>a.find(c=>c.id===id));if(o.scry&&bottom)state[o.p].main.push(...ordered);else state[o.p].main.unshift(...ordered);}operation=null;pump();return ok('順番を確定しました（内容は使用者のみ確認）。');}
 function resolvePrivate(id=null,expected=operation){const o=operation;if(o!==expected||!o)return fail('以前の選択です。');const candidates=privateCandidates();
  if(o.kind==='inspectHand'){const eligible=candidates.filter(c=>c.cost&&Mana.total(c.cost)<=o.max);if(id===null&&eligible.length)return fail('対象があるため1枚選んでください。');if(id!==null&&!eligible.some(c=>c.id===id))return fail('軽減前3コスト以下を選んでください。');operation=null;if(id){const c=locate(id).card;rawMove(locate(id),o.targetPlayer,'trash');record(`${label(o.targetPlayer)}が公開された${c.name}を捨てました。`);}pump();return ok('手札の一時確認を終了しました。');}
  if(!candidates.some(c=>c.id===id))return fail('候補から1枚選んでください。');const source=locate(id),c=source.card;operation=null;
  if(o.kind==='handPick'){rawMove(source,o.p,'trash');record(`${label(o.p)}が手札1枚を選んでトラッシュへ。`);pump();}
  else if(o.kind==='recoverUnit'){rawMove(source,o.p,'hand');c.faceUp=true;refreshDeck(o.p);record(`${c.name}をトラッシュから手札へ回収。`);pump();}
  else if(o.kind==='searchSpell'){state[o.p].main.splice(source.index,1);state[o.p].check.push(c);shuffleRaw(o.p,'main');refreshDeck(o.p);prepareFreeUse(locate(id),{p:o.p,method:'アマテラスから無料使用'});}
  return ok('選択を処理しました。');
 }
 function placeToken(slot=null,expected=operation){const o=operation;if(o!==expected||o?.kind!=='tokens')return fail('トークン配置中ではありません。');if(slot===null){operation=null;pump();return ok('残りのトークンを出さずに続行。');}if(!placementOptions(o.p).some(z=>z.id===slot))return fail('配置先を選んでください。');const replacement=state[o.p][slot][0];if(replacement)rawMove(locate(replacement.id),o.p,'trash');const c=fromDefinition('snowToken',o.p);state[o.p][slot].push(c);operation=null;if(o.remaining>1)queue.unshift({kind:'tokens',p:o.p,count:o.remaining-1,sourceId:o.sourceId});unitEntered(c,o.p);record('スノーマントークン1体が登場。');pump();return ok('トークンを配置しました。');}
 function resolveOptional(use=true,expected=operation){const o=operation;if(o!==expected||!['optionalDraw','optionalEffect'].includes(o?.kind))return fail('終了時ドロー待ちではありません。');operation=null;if(use){if(o.kind==='optionalEffect')enqueue(o.effects,o.p,o.sourceId);else drawRaw(o.p,o.count);}record(`${label(o.p)}が終了時ドローを${use?'使用':'省略'}。`);pump();return ok('終了時効果を処理しました。');}
 function freeUnitCandidates(){const o=operation;if(o?.kind!=='freeUnit')return [];return state[o.p].hand.filter(c=>c.type==='通常'&&c.cost&&Mana.total(c.cost)<=landCount(o.p)&&(!c.evolution||evolutionBases(o.p,c).length));}
 function chooseFreeUnit(id=null,expected=operation){const o=operation;if(o!==expected||o?.kind!=='freeUnit')return fail('この無料登場選択は終了しています。');if(id!==null&&!freeUnitCandidates().some(c=>c.id===id))return fail('その持ち主の手札から、土地枚数以下の軽減前合計コストのユニットを選んでください。');
  operation=null;if(id)operation={kind:'freePlace',p:o.p,id,slot:null,replacedId:null};else{record('無料では出さずに続行。');pump();}return ok('無料登場の選択を更新しました。');
 }
 function confirmFreePlacement(expected=operation){
  const o=operation;if(o!==expected||!['freePlace'].includes(o?.kind)||result)return fail('この配置操作は終了しています。');const s=locate(o.id);if(!s||s.p!==o.p||s.z!=='hand')return fail('対象カードが手札にありません。');if(o.kind==='freePlace'&&(s.card.type!=='通常'||Mana.total(s.card.cost)>landCount(o.p)))return fail('土地枚数以下の軽減前合計コストを満たしません。');const checked=placementInfo(o,s.card);if(!checked.ok)return checked;
  operation=null;declareUse(s,{p:o.p,slot:o.slot,replacedId:o.replacedId,baseId:checked.base?.id,method:'母なる大地'});return ok('無料配置を確定しました。');
 }
 function skipFreePlacement(){if(!['freePlace'].includes(operation?.kind))return fail('無料配置ではありません。');operation=null;pump();return ok('配置を取りやめ、カードを手札に残しました。');}
 function attackTargets(id){
  const s=locate(id);if(!s)return [];const c=s.card,enemy=s.p==='p1'?'p2':'p1',units=unitSlots(enemy).flatMap(z=>state[enemy][z.id]).filter(c=>c.type==='通常');
  const lures=units.filter(c=>c.lure);
  const canUnit=c.machFighter?.duration==='entryTurn'&&c.enteredTurn===turn.counts[s.p]&&s.p===turn.player;
  if(c.sick&&!c.speedAttacker&&!canUnit)return [];
  if(lures.length)return lures.map(c=>({id:c.id,name:c.name,forced:true}));
  return [...(!c.sick||c.speedAttacker?[{id:'body',name:label(enemy)+'本体'}]:[]),...units.filter(c=>canUnit||c.rest).map(c=>({id:c.id,name:c.name}))];
 }
 function attackError(id){
  const s=locate(id);if(result)return '対戦は終了しています。';if(status!=='ready'||turn.step!=='attack')return '攻撃はアタックフェイズで行ってください。';if(operation)return '選択中の処理を完了してください。';
  if(!s||s.p!==turn.player||!isUnit(s.z)||s.card.type!=='通常'||!Number.isFinite(attack(s.card,s.p)))return '自分の場のユニットを選んでください。';
  if(s.card.cannotAttack)return 'このユニットは攻撃できません。';if(s.card.rest)return '使用済みのため攻撃できません。';if(!attackTargets(id).length)return '召喚酔い中、または攻撃できる対象がありません。';return '';
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
  const s=locate(id);s.card.rest=true;events.push({id:++eventSerial,kind:'attack',p:s.p,attackerId:id,targetId:target,text:s.card.name+'が'+(target==='body'?'相手本体':locate(target)?.card.name)+'へ攻撃'});record(`${s.card.name}が${target==='body'?'相手本体':locate(target)?.card.name}へ攻撃宣言。使用済みにしました。`);
  turn.attacks=(turn.attacks||0)+1;enqueue([...(s.card.onAttack||[]),{kind:'attackContinue',id,target}],s.p,id);pump();return ok('攻撃を宣言しました。');
 }
 function continueAttack(id,target){const s=locate(id);if(!s||!isUnit(s.z)||s.p!==turn.player)return;
  if(target!=='body'){const b=locate(target);if(!b||!isUnit(b.z)||b.p===s.p)return fail('対象ユニットが場にありません。');battle(s,b,false);pump();return ok('ユニットへの直接攻撃を解決しました。');}
  operation={kind:'combat',id,p:s.p,defender:other(s.p),blockerId:null};if(mode==='bot'&&operation.defender==='p1'&&!blockers('p1').length)return resolveAttack(null,operation);return ok('防御側がブロックするか選択してください。');
 }
 function blockers(p){if(operation?.kind==='combat'&&locate(operation.id)?.card.unblockable)return [];return unitSlots(p).flatMap(z=>state[p][z.id]).filter(c=>c.type==='通常'&&!c.rest&&c.abilities.includes('ブロッカー')&&Number.isFinite(attack(c,p)));}
 function chooseBlocker(id){const o=operation;if(o?.kind!=='combat'||!blockers(o.defender).some(c=>c.id===id))return fail('未使用のブロッカーを1枚選んでください。');o.blockerId=id;return ok('ブロックする1枚を選びました。');}
 function battle(a,b,blocked){
  const ap=attack(a.card,a.p),bp=attack(b.card,b.p);if(blocked)b.card.rest=true;
  a.card.health-=bp;b.card.health-=ap;
  const dead=[a,b].filter(s=>s.card.health<=0);
  record(`戦闘：${a.card.name} ${ap}/${a.card.health} 対 ${b.card.name} ${bp}/${b.card.health}。同時ダメージ。`);
  for(const s of dead){const current=locate(s.card.id);if(current){rawMove(current,s.p,'trash');enqueue(s.card.onDeath||[],s.p,s.card.id);}}
  if(dead.includes(b))enqueue(a.card.onDefeat||[],a.p,a.card.id);
  if(dead.includes(a))enqueue(b.card.onDefeat||[],b.p,b.card.id);
  refreshDerived();
 }
 function resolveAttack(blockerId=null,expected=operation){
  const o=operation;if(!o||o!==expected||o.kind!=='combat'||result||turn.step!=='attack')return fail('この攻撃は終了しています。');const a=locate(o.id);
  if(!a||a.p!==o.p||!isUnit(a.z)||!a.card.rest)return fail('攻撃ユニットの状態が変わりました。');
  let b=null;if(blockerId){if(!blockers(o.defender).some(c=>c.id===blockerId))return fail('選んだユニットはブロックできません。');b=locate(blockerId);}
  operation=null;
  if(b){battle(a,b,true);pump();return ok('ブロック戦闘を解決。');}
  const damage=attack(a.card,a.p);life[o.defender]-=damage;
  record(`${label(o.defender)}に${damage}ダメージ。ライフ ${life[o.defender]}/30。`);
  if(life[o.defender]<=0){finish(o.p,'相手ライフが0以下');return ok(`${label(o.p)}の勝利です。`);}
  if(a.card.onBodySuccess)enqueue(a.card.onBodySuccess,a.p,a.card.id);
  pump();return ok('プレイヤーへの攻撃を解決しました。');
 }
 function finish(winner,reason){result={winner,loser:other(winner),reason};operation=null;queue=[];stack=[];turn.key={};epoch++;record(`${label(winner)}の勝利：${reason}。`);}
 function chooseFate(key,expected=operation){const o=operation;if(o!==expected||o?.kind!=='fateChoice'||!Catalog.fateKeys.includes(key))return fail('3種類の運命から1枚を選んでください。');const c=fromDefinition(key,o.p);state[o.p].hand.push(c);operation=null;record(`${label(o.p)}が${c.name}を手札に生成しました。`);pump();return ok('運命を選びました。');}
 function toggleUntapLand(id){const o=operation;if(o?.kind!=='untapLands'||!state[o.p].energy.some(c=>c.id===id&&c.type==='土地'))return fail('自分の土地を選んでください。');if(!o.ids.includes(id)&&o.ids.length>=o.max)return fail(`最大${o.max}枚です。`);o.ids=o.ids.includes(id)?o.ids.filter(x=>x!==id):[...o.ids,id];return ok('未使用に戻す土地を選択しました。');}
 function confirmUntap(expected=operation){const o=operation;if(o!==expected||o?.kind!=='untapLands'||o.ids.length>o.max||new Set(o.ids).size!==o.ids.length||o.ids.some(id=>!state[o.p].energy.some(c=>c.id===id&&c.type==='土地')))return fail('土地の選択が不正です。');o.ids.forEach(id=>locate(id).card.rest=false);operation=null;record(`${label(o.p)}が土地${o.ids.length}枚を未使用へ。`);pump();return ok('土地の回復を確定しました。');}
 function setDeckLibrary(records){if(!Array.isArray(records))return fail('デッキ一覧が不正です。');deckRecords=clone(records);return {ok:true};}
 function deckInfo(p){return clone(chosenSpecs[p]);}
 function decisionPlayer(){if(result)return null;if(status==='mulligan')return mulligan.p2==='pending'&&mode==='bot'?'p2':PLAYERS.find(p=>mulligan[p]==='pending')||null;return operation?(operation.kind==='presentation'?null:operation.kind==='combat'?operation.defender:operation.p):turn.player;}
 // Bot gets this projection only: no opponent hand or deck ordering.
 function observe(p){
  const copy=c=>JSON.parse(JSON.stringify(c)),publicCard=(c,owner,z)=>({...copy(c),owner,zone:z,...(c.type==='通常'?{attack:attack(c,owner)}:{})});
  const players={};
  for(const owner of PLAYERS){const zones=state[owner];players[owner]={hand:owner===p?zones.hand.map(c=>({...publicCard(c,owner,'hand'),canPlay:playStatus(c,owner).ok,canForetell:!!c.foretell&&!useError(c,owner,'set')&&!!planPayment(c.foretell.cost,owner),effectiveCost:effectiveCost(c,owner),paymentPlan:c.cost?planPayment(effectiveCost(c,owner),owner):null})):null,counts:Object.fromEntries(ZONES.map(z=>[z.id,zones[z.id].length])),units:unitSlots(owner).flatMap(z=>zones[z.id].filter(c=>c.faceUp).map(c=>publicCard(c,owner,z.id))),structures:zones.structures.filter(c=>c.faceUp).map(c=>publicCard(c,owner,'structures')),lands:zones.energy.filter(c=>c.faceUp).map(c=>publicCard(c,owner,'energy')),trash:zones.trash.map(c=>publicCard(c,owner,'trash')),life:life[owner],maxLife:30,landCount:landCount(owner),symbols:symbols(owner)};}
  const actor=decisionPlayer(),o=operation;let projected=o?{kind:o.kind,p:actor}:null;
  if(o&&actor===p){projected=copy(o);if(['payment','freePlace','freeCast','returnPlace'].includes(o.kind)){projected.slots=placementOptions(p,locate(o.id)?.card).map(z=>({id:z.id,card:state[p][z.id][0]?publicCard(state[p][z.id][0],p,z.id):null}));}
   if(o.kind==='effectTarget')projected.candidates=effectTargets().map(c=>{const s=locate(c.id);return publicCard(c,s.p,s.z);});
   if(o.kind==='freeUnit')projected.candidates=freeUnitCandidates().map(c=>publicCard(c,p,'hand'));
   if(o.kind==='combat'){const a=locate(o.id);projected.attacker=a?publicCard(a.card,a.p,a.z):null;projected.blockers=blockers(p).map(c=>publicCard(c,p,locate(c.id).z));}
   if(o.kind==='attackTarget')projected.targets=attackTargets(o.id);
   if(['reorder','stackOrder','searchSpell','inspectHand','handPick','recoverUnit'].includes(o.kind))projected.candidates=privateCandidates().map(c=>publicCard(c,locate(c.id).p,locate(c.id).z));
   if(o.kind==='response'){projected.candidates=counterCards(p).map(c=>publicCard(c,p,locate(c.id).z));projected.target=locate(o.cardId)?publicCard(locate(o.cardId).card,other(p),'check'):null;}
   if(o.kind==='fateChoice')projected.candidates=Catalog.fateKeys.map(k=>({...clone(Catalog.cards[k]),id:k}));
   if(o.kind==='untapLands')projected.candidates=state[p].energy.filter(c=>c.type==='土地').map(c=>publicCard(c,p,'energy'));
   if(o.kind==='tokens')projected.slots=placementOptions(p).map(z=>({id:z.id,card:state[p][z.id][0]?publicCard(state[p][z.id][0],p,z.id):null}));
   if(['payment','freeCast'].includes(o.kind)){const c=locate(o.id)?.card;projected.targets=targetOptions((o.purpose==='set'?c?.foretell?.onSet:c?.foretold?(c.foretell.onUse||c.onUse):c?.onUse)?.find(e=>['bounce','trap','mother'].includes(e.kind))||{kind:'none'},p).map(c=>publicCard(c,locate(c.id).p,locate(c.id).z));}

  }
  const sources=paymentSources(p).map(s=>({id:s.id,colors:[...s.colors],unit:s.card.type==='通常'}));
  const attacks=actor===p&&!operation&&turn.step==='attack'?players[p].units.filter(c=>!attackError(c.id)).map(c=>({card:c,targets:attackTargets(c.id)})):[];
  const exile=state[p].exile.filter(c=>c.foretold).map(c=>({...publicCard(c,p,'exile'),ready:foretoldReady(c,p),canPlay:playStatus(c,p).ok}));
  return {viewer:p,actor,mode,status,exile,firstPlayer,epoch,turn:copy({...turn,key:undefined}),canAdvance:status==='ready'&&!result&&!operation&&clock()>=turn.notBefore,mulligan:copy(mulligan),result:result?copy(result):null,players,sources,operation:projected,attacks};
 }
 function dispatch(action,p,expectedEpoch=epoch){
  if(expectedEpoch!==epoch||result)return fail('以前の対戦の操作です。');if(decisionPlayer()!==p)return fail('このプレイヤーの選択待ちではありません。');
  const handlers={fate:()=>chooseFate(action.key),returnPlace:()=>confirmReturn(),untapSelect:()=>toggleUntapLand(action.id),untap:()=>confirmUntap(),mulligan:()=>completeMulligan(p,action.ids||[],false),play:()=>beginPayment(action.id,action.method||'normal'),freeCast:()=>confirmFreeCast(),foretell:()=>beginForetell(action.id),useTarget:()=>selectUseTarget(action.id),pass:()=>passResponse(),private:()=>resolvePrivate(action.id||null),orderMove:()=>reorderCard(action.id,action.delta),order:()=>confirmOrder(!!action.bottom),token:()=>placeToken(action.slot||null),optional:()=>resolveOptional(action.use!==false),slot:()=>chooseSlot(action.slot),pay:()=>confirmPayment(),cancelPayment,cancelAttackTarget,attack:()=>declareAttack(action.id,action.target),attackTarget:()=>chooseAttackTarget(action.target),block:()=>resolveAttack(action.id||null),target:()=>resolveEffectTarget(action.id),freeUnit:()=>chooseFreeUnit(action.id||null),freePlace:()=>confirmFreePlacement(),skipFree:skipFreePlacement,discard:()=>{const o=operation;if(o?.kind!=='discard')return fail('手札調整ではありません。');if(!Array.isArray(action.ids)||new Set(action.ids).size!==action.ids.length||action.ids.some(id=>!state[p].hand.some(c=>c.id===id)))return fail('手札から選択してください。');o.ids=[...action.ids];return confirmDiscard(o);},advance:()=>advance()};
  if(action.type==='play'&&locate(action.id)?.p!==p)return fail('自分の手札を選んでください。');
  return handlers[action.type]?handlers[action.type]():fail('操作が見つかりません。');
 }
 reset();
 return {INITIAL_HAND,setDeckLibrary,deckInfo,chooseFate,confirmReturn,toggleUntapLand,confirmUntap,get vanishedIds(){return [...vanishedIds];},get extraTurns(){return [...extraTurns];},ZONES,PLAYERS,SELF,STEPS,confirmFreeCast,foretoldReady,beginForetell,selectUseTarget,targetOptions,counterCards,passResponse,finishPresentation,privateCandidates,reorderCard,confirmOrder,resolvePrivate,placeToken,resolveOptional,observe,dispatch,decisionPlayer,isUnit,isField,label,card,buildDeck,validateDeck,reset,completeMulligan,locate,fromDefinition,buildLandDeck,validateLandDeck,addLands,refreshDeck,freeUnitCandidates,chooseFreeUnit,landCount,fieldCards,attack,healUnit,healLife,symbols,effectiveCost,paymentSources,planPayment,selectedMana,chooseManaColor,effectTargets,resolveEffectTarget,confirmFreePlacement,skipFreePlacement,attackTargets,chooseAttackTarget,cancelAttackTarget,manualMove,addCard,toggle,readyMana,remove,draw,shuffle,availableMana,landError,placeLand,playStatus,unitSlots,placementOptions,beginPayment,chooseSlot,togglePaymentLand,paymentInfo,confirmPayment,cancelPayment,advance,toggleDiscard,confirmDiscard,attackError,declareAttack,blockers,chooseBlocker,resolveAttack,
  get deckChoices(){return {...deckChoices};},get events(){return clone(events);},get mode(){return mode;},get firstPlayer(){return firstPlayer;},get epoch(){return epoch;},get life(){return {...life};},get state(){refreshDerived();return state;},get status(){return status;},get turn(){return turn;},get mulligan(){return mulligan;},get operation(){return operation;},get result(){return result;},get supplyStatus(){return supplyStatus;},get log(){return [...log];},get canAdvance(){return status==='ready'&&!result&&!operation&&clock()>=turn.notBefore;}};
}
return {create,ZONES,STEPS};
});
