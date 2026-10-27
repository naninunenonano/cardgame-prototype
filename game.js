// 画面から独立した試作ルール。clock/randomはテストで差し替え可能。
(function(root,factory){
  const rules=factory(typeof module==='object'&&module.exports?require('./mana.js'):root.ManaEngine,typeof module==='object'&&module.exports?require('./cards.js'):root.CardCatalog,typeof module==='object'&&module.exports?require('./decks.js'):root.DeckLibrary);
  if(typeof module==='object'&&module.exports)module.exports=rules;else root.GameRules=rules;
})(globalThis,function(Mana,Catalog,Decks){
'use strict';
const ZONES=[{id:'markers',name:'専用マーカー',internal:true},...Array.from({length:7},(_,i)=>({id:`signi-${i+1}`,name:`ユニット${i+1}`,class:'unit'})),
 {id:'lrig',name:'プレイヤーキャラ',class:'lrig'},{id:'extra',name:'サイドボード',pile:true},{id:'main',name:'メインデッキ',pile:true},
 {id:'energy',name:'マナゾーン'},{id:'trash',name:'トラッシュ',pile:true},
 {id:'shields',name:'シールドデッキ',internal:true},{id:'structures',name:'設置物'},{id:'exile',name:'除外ゾーン',pile:true},{id:'holding',name:'一時確認',internal:true},{id:'check',name:'チェックゾーン'},{id:'hand',name:'手札',class:'hand'}];
const PLAYERS=['p1','p2'],SELF='p1';
const STEPS={untap:'アンタップ',draw:'ドロー',charge:'マナチャージ',main1:'メイン1',attack:'アタック',main2:'メイン2',end:'エンド'};
const isUnit=z=>ZONES.some(zone=>zone.id===z&&zone.class==='unit');
const isField=z=>isUnit(z)||z==='lrig'||z==='structures';
const label=p=>p==='p1'?'プレイヤー1':'プレイヤー2';
let gameSerial=0;
function create({clock=()=>Date.now(),random=()=>Math.random(),mode:initialMode='solo',boundaries={},decks:initialDecks={p1:'green',p2:'green'},presentationMs=0,strictTargets=false,collection=null,records:initialRecords=[],sideboards:initialSides={p1:'deck',p2:'deck'}}={}) {
 let life={p1:30,p2:30},state,status,turn,mulligan,operation,result,serial=0,log=[],queue=[],supplyStatus,mode=initialMode,firstPlayer=SELF,epoch=0,deckChoices={...initialDecks},stack=[],events=[],eventSerial=0,frameSerial=0,deckRecords=JSON.parse(JSON.stringify(initialRecords)),chosenSpecs={},vanishedIds=new Set(),extraTurns=[],normalNext=null,shieldTiming=0,closedShieldTimings=new Set(),sideChoices={...initialSides},sideUse={p1:-1,p2:-1},summonLocks=[],lockSerial=0,sideRoster={p1:[],p2:[]};
 const clone=x=>JSON.parse(JSON.stringify(x));
 const INITIAL_HAND=5;
 const normalMode=!!collection;const collectionErrors=d=>{if(!normalMode)return [];const need={};for(const e of [...d.main,...(d.sideboard||[]),...(d.shields||[])])need[e.key]=(need[e.key]||0)+e.count;const errors=[];if((d.sideboard||[]).reduce((n,e)=>n+e.count,0)!==10||(d.sideboard||[]).reduce((n,e)=>n+(Catalog.cards[e.key]?.type==='キャラクター'?e.count:0),0)!==1||(d.sideboard||[]).some(e=>!Catalog.cards[e.key]?.sideboardOnly))errors.push('通常モードのサイドは専用カード10枚・キャラ1枚です。');return errors.concat(Object.entries(need).filter(([k,n])=>n>(collection[k]||0)).map(([k])=>'未所持・所持枚数不足：'+(Catalog.cards[k]?.name||k)));};
 const other=p=>p==='p1'?'p2':'p1';
 let activeCombat=null,battleDeaths=new Set();
 let journal=[],journalId=0,gameId='',attackSerial=0,auditDepth=0,diagnosticFailures=0;
 function trace(kind,message,data={},actor=turn?.player){try{const payload=clone(data),number=journalId+1;journal.push({number,eventId:gameId+':'+number,gameId,turn:turn?.number||0,turnSequence:turn?.sequence||0,actor:actor||null,phase:turn?.step||'setup',phaseName:STEPS[turn?.step]||'開始準備',kind,message,result:'確定',order:number,...payload});journalId=number;}catch{diagnosticFailures++; /* Logging must never stop game resolution. */ }}
 const notice=message=>{log.push(message);if(log.length>100)log.shift();};
 const record=message=>{notice(message);trace('message',message);};
 const ok=message=>{if(message)notice(message);return {ok:true,message:message||''};};
 // The journal stores only public card identities. Private choices are deliberately anonymous,
 // even in detailed exports. Never derive logs from the rendering or Bot observation layer.
 function publicRef(c,z){if(!c)return null;if(!isUnit(z)&&!['energy','structures','lrig','trash','check'].includes(z)&&!(z==='shields'&&c.faceUp))return {hidden:true,owner:c.origin||null};return {name:c.name,cardId:c.key||null,instanceId:c.id,owner:c.origin||null,type:c.type,color:c.color,sick:!!c.sick,attack:c.type==='通常'?attack(c):undefined,health:c.health,maxHealth:c.maxHealth,rest:!!c.rest,faceUp:!!c.faceUp,level:c.level,awakened:c.awakened||null,used:!!c.used};}
 function refId(id){if(id==='body')return {target:'player'};const a=locate(id);return a?publicRef(a.card,a.z):{unavailable:true};}
 function auditState(){const players={},cards={};for(const p of PLAYERS){players[p]={life:life[p],mana:state[p].energy.length,availableMana:state[p].energy.filter(c=>!c.rest).length,zones:Object.fromEntries(ZONES.map(z=>[z.id,state[p][z.id].length]))};for(const z of ZONES)for(const c of state[p][z.id]){const r=publicRef(c,z.id);if(!r.hidden)cards[c.id]={...r,player:p,zone:z.id};}}return {players,cards,phase:turn.step,turn:turn.number};}
 function safeAuditState(){try{return auditState();}catch{diagnosticFailures++;return {players:{},cards:{},phase:turn?.step,turn:turn?.number};}}
 function safeRefId(id){try{return refId(id);}catch{return {unavailable:true};}}
 function stateDiff(a,b){return [...new Set([...Object.keys(a.cards),...Object.keys(b.cards)])].flatMap(id=>JSON.stringify(a.cards[id])===JSON.stringify(b.cards[id])?[]:[{instanceId:id,before:a.cards[id]||{hiddenOrAbsent:true},after:b.cards[id]||{hiddenOrAbsent:true}}]);}
 function battleLog(viewer='p1',options={}){const selected=[];for(let i=journal.length-1;i>=0;i--){const e=journal[i];if((!e.visibility||e.visibility===viewer)&&(options.detailed!==false||!e.detailOnly)){selected.push(e);if(options.tail&&selected.length>=options.tail)break;}}return clone(selected.reverse());}
 function exportLog(detailed=false,viewer='p1'){const entries=battleLog(viewer),header=['【対戦ログ】','バージョン：Ver.0.27.2','ゲーム識別子：'+gameId,'ゲームモード：'+(mode==='bot'?'Bot戦':'壁打ち'),'ターン：'+turn.number,...PLAYERS.map(p=>label(p)+'：'+deckInfo(p).name),'先攻：'+label(firstPlayer),'記録：'+entries.length+'件（通常表示は最新200件、コピーは全件）',...(diagnosticFailures?['注意：診断記録の一部に失敗（'+diagnosticFailures+'回）。ゲーム処理は継続。']:[]),''];return header.concat(entries.filter(e=>detailed||!e.detailOnly).map(e=>'#'+e.number+' [T'+e.turn+' / '+(e.actor||'共通')+' / '+e.phaseName+'] '+e.message+(detailed?'\n'+JSON.stringify(e):''))).join('\n');}
 function reportException(error,where='ゲーム処理'){trace('exception',where+'で例外が発生しました。',{detailOnly:true,result:'例外',error:{name:String(error?.name||'Error').slice(0,80),reason:'非公開情報保護のため例外本文・スタック・引数は出力しません。'}});}
 const actionNames={resolveExpansion:'カード効果の選択',beginLoot:'手札交換能力の起動',resolveLoot:'タップと手札破棄のコスト支払い',reset:'ゲーム開始',completeMulligan:'マリガン確定',beginCharge:'マナチャージ確認',confirmCharge:'マナチャージ',skipCharge:'マナチャージ見送り',beginPayment:'カード使用確認',confirmPayment:'使用コスト確定',beginGrowth:'成長確認',selectUseTarget:'効果の対象選択',resolveEffectTarget:'対象への効果解決',declareAttack:'攻撃宣言',chooseAttackTarget:'攻撃対象選択',chooseBlocker:'ブロッカー選択',resolveAttack:'攻撃解決',resolveShield:'シールド使用・見送り',resolveShieldEffect:'シールドへの効果',advance:'フェイズ進行',manualMove:'壁打ち補助：手動移動',addCard:'壁打ち補助：カード追加',toggle:'壁打ち補助：状態変更',readyMana:'壁打ち補助：マナ回復',remove:'壁打ち補助：カード削除',draw:'壁打ち補助：ドロー',shuffle:'壁打ち補助：シャッフル',soloNextPlayer:'壁打ち補助：操作側変更',destroyMana:'マナ破壊',createManaToken:'マナトークン生成',addMana:'マナ加速',confirmRefresh:'リフレッシュのマナ除外',resolvePrivate:'確認・手札選択の解決',resolveSideChoice:'サイド能力の選択・解決',selectSideChoice:'サイド能力の対象選択',placeToken:'トークン配置',confirmReturn:'帰還',resolveRevolution:'革命チェンジ',healUnit:'体力回復',healLife:'ライフ回復',loseLife:'ライフ減少',destroyUnit:'クリーチャー破壊'};
 function audited(name,fn){return function(...args){if(auditDepth)return fn(...args);const before=safeAuditState(),priorGame=gameId,actor=(operation?.kind==='combat'?operation.defender:(operation?.selector||operation?.p))||turn.player,selection=typeof args[0]==='string'?safeRefId(args[0]):name==='dispatch'&&args[0]?.id?safeRefId(args[0].id):null,source=(operation?.sourceId||operation?.id)?safeRefId(operation.sourceId||operation.id):null,choice=operation?.choice||(typeof operation?.effect==='string'?operation.effect:null)||operation?.kind||null;let value;auditDepth++;try{value=fn(...args);}catch(error){reportException(error,actionNames[name]||'ゲーム処理');throw error;}finally{auditDepth--;}try{const after=safeAuditState(),changed=stateDiff(before,after),failed=value?.ok===false;trace(failed?'rejected':name,(actionNames[name]||'選択・処理')+'：'+(value?.message||(value===false?'処理なし':'処理を確定しました。')),{result:failed?'中止':'確定',detailOnly:failed,before:priorGame===gameId?before.players:null,after:after.players,changes:priorGame===gameId?changed:[],source:priorGame===gameId?source:null,selection:priorGame===gameId?selection:null,choice:priorGame===gameId?choice:null,action:name},actor);if(priorGame===gameId&&(before.phase!==after.phase||before.turn!==after.turn))trace('phase','現在のフェイズ：'+STEPS[turn.step]+'。',{},turn.player);}catch{diagnosticFailures++; /* A failed diagnostic snapshot cannot reject a legal action. */ }return value;};}

 const fail=message=>({ok:false,message});
 function card(name,type,color='赤',cost=null,basic=false,origin=null) {
  const required=type==='土地'||cost===null?null:typeof cost==='number'?Mana.cost(cost):cost;
  return {id:`card-${++serial}`,name,type,color,rarity:'N',rarityProvisional:true,cost:required,basic,origin,faceUp:true,rest:false,
   ...(type==='通常'?{attack:required?Mana.total(required):0,maxHealth:required?Mana.total(required):0,health:required?Mana.total(required):0}:{}),abilities:[],sick:false,
   symbols:type==='通常'&&Mana.colors.includes(color)?{[color]:1}:{},onUse:[],onEnter:[],onDefeat:[],enteredTurn:null};
 }
 function fromDefinition(key,p=null) {
  const def=Catalog.cards[key];if(!def)throw Error('カード定義がありません：'+key);
  const c=Object.assign(card(def.name,def.type,def.color,def.cost,!!def.basic,p),JSON.parse(JSON.stringify(def)));
  c.rarityProvisional=!!def.rarityProvisional;if(c.type==='通常')c.health=c.maxHealth;return c;
 }
 function buildDeck(p,deck=Catalog.startDeck) {
  const spec=typeof deck==='string'?Decks.resolve(deck,deckRecords):deck;const a=[];for(const entry of spec.main)for(let n=0;n<entry.count;n++)a.push(fromDefinition(entry.key,p));
  a.forEach(c=>c.faceUp=false);return a;
 }
 function fieldCards(p){return [...unitSlots(p).flatMap(z=>state[p][z.id]),...state[p].structures];}
 function attack(c,p=null){if(c.attackZero)return 0;if(c.statMode==='lifeDifference'){const owner=p||locate(c.id)?.p||c.origin;return Math.max(0,life[owner]-life[other(owner)])+(c.statBonus?.attack||0)+(c.turnAttackBonus||0);}if(c.attackZero)return 0;const owner=p||locate(c.id)?.p||c.origin||SELF;if(c.aurelia)return 3+fieldCards(other(owner)).filter(c=>c.type==='通常').length+(c.statBonus?.attack||0);return c.statMode==='manaCount'?manaCount(owner)+(c.statBonus?.attack||0):c.attack+(c.turnAttackBonus||0);}
 function refreshDerived(){
  for(const p of PLAYERS)for(const [z,a] of Object.entries(state[p]))for(const c of [...a])if(c.type==='通常'){
   if(c.aurelia&&isUnit(z)){const damage=Math.max(0,(c.maxHealth||5)-(c.health??c.maxHealth??5));c.attack=attack(c,p);c.maxHealth=5+fieldCards(p).filter(x=>x.type==='通常'&&x.id!==c.id).length+(c.statBonus?.health||0);c.health=c.maxHealth-damage;}if(c.statMode==='manaCount'){const damage=isUnit(z)?Math.max(0,(c.maxHealth||0)-(c.health??c.maxHealth??0)):0;c.attack=manaCount(p)+(c.statBonus?.attack||0);c.maxHealth=manaCount(p)+(c.statBonus?.health||0);c.health=c.maxHealth-damage;}
   if(isUnit(z)&&c.health<=0&&!c.pendingDestruction){destroyUnit(c.id,'現在体力0以下');if(locate(c.id)&&isUnit(locate(c.id).z)&&c.health<=0&&!c.indestructible&&!c.pendingDestruction)destroyUnit(c.id,'致死ダメージ再判定');}
  }
 }
 function resetHealth(c,p){if(c.type==='通常'){if(c.aurelia)c.maxHealth=5+fieldCards(p).filter(x=>x.type==='通常'&&x.id!==c.id).length+(c.statBonus?.health||0);c.attack=attack(c,p);if(c.statMode==='manaCount')c.maxHealth=manaCount(p)+(c.statBonus?.health||0);c.health=c.maxHealth;}}
 function healUnit(id,amount){const s=locate(id);if(result||!s||s.card.type!=='通常'||!isUnit(s.z)||!Number.isFinite(amount)||amount<0)return fail('回復対象が不正です。');s.card.health=Math.min(s.card.maxHealth,s.card.health+amount);return ok('体力を回復しました。');}
 function healLife(p,amount){if(!PLAYERS.includes(p)||!Number.isFinite(amount)||amount<0||result)return fail('回復対象が不正です。');const before=life[p];life[p]=Math.min(30,life[p]+amount);trace('life',label(p)+'のライフを'+(life[p]-before)+'回復：'+before+'→'+life[p]+'。',{targetPlayer:p,beforeLife:before,amount:life[p]-before,afterLife:life[p]},p);events.push({id:++eventSerial,kind:'lifeRecovered',p,amount:life[p]-before,text:`ライフ${life[p]-before}回復`});return ok('ライフを回復しました。');}
 function shieldCandidates(p,event){if(activeCombat?.silence&&activeCombat.defender===p)return [];return state[p].shields.filter(c=>!c.faceUp&&(c.shieldRule?.event===event.kind||event.kind==='damaged'&&c.shieldRule?.event==='lifeLost')&&(c.key!=='reactiveArmor'||event.kind!=='attackDeclared'||event.target==='body')&&(c.shieldRule.maxLife===undefined||event.life<=c.shieldRule.maxLife));}
 function queueShield(p,event){const timing=++shieldTiming,ids=shieldCandidates(p,event).map(c=>c.id);trace('shieldCondition','シールドの誘発条件・使用条件を判定。',{visibility:p,detailOnly:true,timing,eventKind:event.kind,life:event.life,candidates:ids,checks:state[p].shields.map(c=>({instanceId:c.id,unused:!c.faceUp,triggerMatches:c.shieldRule?.event===event.kind,useConditionMet:c.shieldRule?.maxLife===undefined||event.life<=c.shieldRule.maxLife})),eligible:ids.length>0},p);if(ids.length)enqueue([{kind:'shieldWindow',timing,event,ids}],p,null);}
 function loseLife(p,amount,reason='カード効果'){
  if(result||!PLAYERS.includes(p)||!Number.isFinite(amount)||amount<0)return fail('ライフ減少が不正です。');
  const before=life[p];life[p]-=amount;trace('life',label(p)+'のライフが'+amount+'減少：'+before+'→'+life[p]+'。',{targetPlayer:p,beforeLife:before,amount:-amount,afterLife:life[p],reason},p);events.push({id:++eventSerial,kind:'lifeLost',p,amount,text:`${reason}：ライフ${amount}減少`});
  if(life[p]<=0){if(shieldCandidates(p,{kind:'lethal',life:life[p]}).length){enqueue([{kind:'lethalCheck'}],p,null);queueShield(p,{kind:'lethal',life:life[p]});if(!operation)pump();return ok('起死回生の使用確認。');}finish(other(p),'相手ライフが0以下');return ok('ライフ0以下で敗北。');}
  if(life[p]<before)queueShield(p,{kind:reason==='ライフを失う'?'lifeLost':'damaged',life:life[p],amount:before-life[p]});if(!operation)pump();return ok(`ライフ ${life[p]}/30。`);
 }
 function destroyUnit(id,reason='効果',skipSave=false){
  const s=locate(id);if(!s||!isUnit(s.z)||s.card.type!=='通常')return false;
  if(s.card.lifeSave&&!skipSave&&!s.card.abilitiesDisabled&&life[s.p]>5){if(!s.card.pendingDestruction){s.card.pendingDestruction=true;enqueue([{kind:'lifeSaveOffer',id,reason}],s.p,id);}return false;}
  if(s.card.indestructible){record(`${s.card.name}は破壊耐性により場に残ります。`);return false;}
  const c=s.card;trace('destroy','《'+c.name+'》を'+reason+'で破壊。',{card:publicRef(c,s.z),reason},s.p);rawMove(s,s.p,'trash');if(locate(id)&&isUnit(locate(id).z))return false;if(reason==='戦闘')battleDeaths.add((activeCombat?.combatId||0)+':'+id);events.push({id:++eventSerial,kind:'unitDestroyed',p:s.p,cardId:id,text:`${reason}で${c.name}を破壊`});enqueue(c.abilitiesDisabled?[]:c.onDeath||[],s.p,id);return true;
 }
 function resolveShield(id=null,expected=operation){
  const o=operation;if(result||o!==expected||o?.kind!=='shieldWindow'||closedShieldTimings.has(o.timing))return fail('この誘発タイミングの受付は終了しています。');
  const c=id?state[o.p].shields.find(c=>c.id===id&&!c.faceUp&&o.ids.includes(id)):null;if(id&&!c)return fail('今回の候補から未使用シールドを1枚選んでください。');
  closedShieldTimings.add(o.timing);operation=null;
  trace('shieldDecision',label(o.p)+(c?'が《'+c.name+'》を使用。':'は今回のシールドを見送り。'),{timing:o.timing,used:!!c,card:c?publicRef(c,'check'):null},o.p);if(c){c.faceUp=true;events.push({id:++eventSerial,kind:'shieldUsed',p:o.p,card:clone(c),timing:o.timing,method:'シールド使用',text:c.name+'を使用'});record(`${label(o.p)}が${c.name}を使用（同時誘発はこの1枚で終了）。`);
   if(c.shieldRule.effect==='revive'){healLife(o.p,15);if(life[o.p]<=0){finish(other(o.p),'起死回生後もライフ0以下');return ok('回復後もライフ0以下で敗北。');}}else if(!['destroyAttacker','draw'].includes(c.shieldRule.effect))enqueue([{kind:'newShield',effect:c.shieldRule.effect,event:o.event}],o.p,c.id);
   if(c.shieldRule.effect==='destroyAttacker')enqueue([{kind:'destroyAttacker',attackerId:o.event.attackerId}],o.p,c.id);
   else if(c.shieldRule.effect==='draw')enqueue([{kind:'draw',count:c.shieldRule.count}],o.p,c.id);
  if(state[o.p].energy.filter(x=>!x.manaToken&&Mana.producedColors(x).includes('緑')).length>=5)enqueue([{kind:'panzerOffer'}],o.p,c.id);
  }else record(`${label(o.p)}は今回のシールド使用を見送りました。`);
  pump();return ok('シールドの使用受付を終了しました。');
 }
 function shieldEffectCandidates(){const o=operation;if(o?.kind==='resetShield')return state[o.p].shields.filter(c=>c.faceUp);if(o?.kind==='inspectShield')return state[other(o.p)].shields.filter(c=>!c.faceUp);return [];}
 function resolveShieldEffect(id=null,expected=operation){
  const o=operation;if(result||o!==expected||!['resetShield','inspectShield','shieldReveal'].includes(o?.kind))return fail('このシールド選択は終了しています。');
  if(o.kind==='shieldReveal'){operation=null;pump();return ok('確認を終了しました。');}
  const c=id?shieldEffectCandidates().find(c=>c.id===id):null;if(id&&!c)return fail('対象のシールドを選んでください。');if(!id&&o.kind==='inspectShield'&&shieldEffectCandidates().length)return fail('相手の裏向きシールド1枚を選んでください。');operation=null;
  if(c&&o.kind==='resetShield'){c.faceUp=false;events.push({id:++eventSerial,kind:'shieldReset',p:o.p,cardId:c.id,text:'使用済みシールド1枚を裏向きへ'});record(`${label(o.p)}が使用済みシールド1枚を裏向きへ戻しました。`);}
  if(c&&o.kind==='inspectShield'){operation={kind:'shieldReveal',p:o.p,id:c.id};return ok('内容は使用者だけに表示します。');}
  pump();return ok('シールドへの効果を解決しました。');
 }
 // Character and sideboard state is independent of the seven creature slots.
 function character(p){return state[p].lrig.find(c=>c.type==='キャラクター')||null;}
 function sideSpent(p){return sideUse[p]===turn.counts[p];}
 function canSide(p,c){if(c.type==='キャラクター')return 'キャラクターは成長操作を使ってください。';if(c.minCharacterLevel&&(character(p)?.level||0)<c.minCharacterLevel)return 'キャラクターLv'+c.minCharacterLevel+'以上が必要です。';if(c.used)return 'このサイドカードは使用済みです。';if(sideSpent(p))return 'このターンのサイドボードは使用済みです。';if(c.requiredCharacterColor&&(!character(p)||character(p).level<1||!Mana.hasColor(character(p),c.requiredCharacterColor)))return '指定色のキャラクターLv1以上が必要です。';if(c.requiredCharacter&&!(character(p)?.key===c.requiredCharacter&&character(p).level>=1))return '指定キャラクターLv1以上が必要です。';if(c.viceOnly)return 'Lv2への成長直後の追加処理だけで使用できます。';if(c.revolution)return '革命チェンジでのみ登場できます。';return '';}
 function activeLocks(p){return summonLocks.filter(l=>l.p===p&&turn.player===p&&turn.counts[p]===l.turn);}
 function summonError(c,p){return c.type==='通常'&&attack(c,p)<=5&&activeLocks(p).length?'5000VT：このターンは攻撃力5以下を場に出せません。':'';}
 function costBreakdown(c,p){const side=locate(c.id)?.z==='extra',base=c.cost||Mana.cost(0);return {creatures:side&&c.creatureReduction?PLAYERS.reduce((n,q)=>n+fieldCards(q).filter(c=>c.type==='通常').length,0):0,level4:side&&character(p)?.level===4?3:0,allBlue:side&&c.allBlueReduction&&manaCount(p)>0&&state[p].energy.every(c=>Mana.producedColors(c).length===1&&Mana.producedColors(c)[0]==='青')?c.allBlueReduction:0,base:clone(base),final:effectiveCost(c,p)};}
 function growStatus(p){const c=character(p)||state[p].extra.find(c=>c.type==='キャラクター'),level=c?.level||0;const cost=Catalog.characterLevels[level+1]?.cost;const error=!c?'成長型キャラクターなし':level>=4?'Lv4到達済み':mainError(p)|| (sideSpent(p)?'このターンのサイドボードは使用済みです。':'');return {id:c?.id,level,nextCost:cost,ok:!error&&!!planPayment(Mana.cost(cost),p),text:error||(!planPayment(Mana.cost(cost),p)?'成長コスト不足':'成長可能')};}
 function beginGrowth(p){const s=growStatus(p);if(!s.ok)return fail(s.text);return beginPayment(s.id,'growth');}
 function triggerDiscard(by,owner,count){if(by===owner||character(by)?.key!=='piruluk'||character(by).level!==4)return;const effects=[];for(let i=0;i<count;i++)effects.push({kind:'draw',count:1},{kind:'tokens',count:1,tokenKey:'aquaGuard'});enqueue(effects,by,character(by).id);}
 function discardBy(id,by){const s=locate(id);if(!s||s.z!=='hand')return false;const owner=s.p;rawMove(s,owner,'trash');record(`${label(owner)}が${s.card.name}を捨てました。`);triggerDiscard(by,owner,1);return true;}
 function applyForm(c,p,form=null){const damage=Math.max(0,c.maxHealth-c.health),bonus=clone(c.statBonus||{attack:0,health:0}),keep={};const definitionKeys=new Set([...Object.keys(Catalog.cards[c.key]),...Object.keys(Catalog.awakened[c.awakened]||{}),'attack','maxHealth','health','awakened']);for(const k of Object.keys(c))if(!definitionKeys.has(k))keep[k]=c[k];for(const k of ['id','origin','rest','sick','enteredTurn','used','under','statBonus','turnAttackBonus','turnSymbols','turnSA','temporarySA','attackZero','justDiverUntil','justDiverGeneration','abilitiesDisabled','usageCostOverride'])if(c[k]!==undefined)keep[k]=c[k];const base=Catalog.cards[c.key],key=c.key;for(const k of Object.keys(c))delete c[k];Object.assign(c,clone(base),form?clone(Catalog.awakened[form]):{},keep,{key,faceUp:true,awakened:form});if(keep.temporarySA)c.speedAttacker=true;c.attack+=(bonus.attack||0);c.maxHealth+=(bonus.health||0);c.health=c.maxHealth-damage;record(c.name+'：'+(form?'覚醒':'覚醒解除')+'（ダメージ・タップ・継続効果維持）。');}
 function checkReversions(){if(operation||stack.length||queue.length)return;for(const p of PLAYERS)for(const c of fieldCards(p))if(c.revertAtFive&&state[p].hand.length<=5)applyForm(c,p,null);refreshDerived();}
 function sideChoiceCandidates(o=operation){if(!o)return [];const p=o.p,q=other(p);switch(o.choice){
  case 'opponentDiscard':return state[p].hand;
  case 'darkHand':return state[q].hand;
  case 'destroySame':return fieldCards(q).filter(c=>c.type==='通常'&&c.cost&&Mana.total(c.cost)===o.cost&&!targetProtected(c,p));
  case 'technologySearch':return state[p].main.filter(c=>o.ids.includes(c.id));
  case 'technologyCast':return state[p].hand.filter(c=>Mana.hasColor(c,'青')&&c.cost&&Mana.total(c.cost)<=state[p].hand.length&&!c.responseOnly&&(!c.evolution||evolutionBases(p,c).length)&&!summonError(c,p));
  case 'interstellarEnter':return [...state[p].hand.filter(c=>c.type==='呪文'&&!c.responseOnly),...state[p].trash.filter(c=>c.type==='呪文'&&c.cost&&Mana.total(c.cost)<=5&&!c.responseOnly)];
  case 'interstellarAttack':return state[p].exile.filter(c=>c.type==='呪文'&&c.cost&&Mana.total(c.cost)<=5&&!c.responseOnly);
  case 'awakeSpells':return state[p].trash.filter(c=>c.type==='呪文');
  default:return [];
 }}
 function selectSideChoice(id,expected=operation){const o=operation;if(result||o!==expected||o?.kind!=='sideChoice'||!sideChoiceCandidates(o).some(c=>c.id===id))return fail('有効な候補を選んでください。');if(!['technologySearch','awakeSpells'].includes(o.choice))return resolveSideChoice(id,o);o.selected=o.selected.includes(id)?o.selected.filter(x=>x!==id):[...o.selected,id];return ok('選択を変更しました。');}
 function resolveSideChoice(id=null,expected=operation){const o=operation;if(result||o!==expected||o?.kind!=='sideChoice')return fail('以前の選択です。');const candidates=sideChoiceCandidates(o);if(['technologySearch','awakeSpells'].includes(o.choice)){
   const ids=o.selected||[];if(ids.some(id=>!candidates.some(c=>c.id===id))||new Set(ids).size!==ids.length)return fail('候補が変わりました。');if(o.choice==='awakeSpells'&&id!=='skip'&&ids.length!==6)return fail('呪文を6枚選んでください。');operation=null;
   if(o.choice==='technologySearch'){for(const id of ids){const s=locate(id),[c]=state[o.p].main.splice(s.index,1);c.faceUp=true;state[o.p].hand.push(c);}shuffleRaw(o.p,'main');record(`${label(o.p)}が山札から${ids.length}枚を手札へ加え、残りをシャッフル。`);}
   else if(id!=='skip'){for(const id of ids)rawMove(locate(id),o.p,'main');shuffleRaw(o.p,'main');const s=locate(o.sourceId);if(s&&isUnit(s.z))applyForm(s.card,o.p,'alegria');}pump();return ok('複数選択を解決しました。');
  }
  if(o.choice==='viceOffer'){const c=state[o.p].extra.find(c=>c.key===(o.chargerKey||'viceCharger')&&!c.used&&!c.expired);if(id&&(!c||c.id!==id))return fail('追加使用の候補がありません。');operation=null;if(c){if(id){c.used=true;declareUse(locate(c.id),{p:o.p,method:'Lv2成長の追加使用',sideAdditional:true});return ok('バイス・チャージャーを使用。');}c.expired=true;}pump();return ok((c?.name||'チャージャー')+'の今回の使用機会を終了しました。');}
  const c=id?candidates.find(c=>c.id===id):null;if(id&&!c)return fail('候補から選んでください。');if(!id&&['opponentDiscard','darkHand','destroySame','interstellarEnter','interstellarAttack'].includes(o.choice)&&candidates.length)return fail('1枚を選んでください。');operation=null;
  if(c&&o.choice==='opponentDiscard')discardBy(c.id,o.controller);
  else if(c&&o.choice==='darkHand'){const cost=c.cost?Mana.total(c.cost):null;discardBy(c.id,o.p);if(cost!==null)enqueue([{kind:'sideOp',choice:'destroySame',cost}],o.p,o.sourceId);}
  else if(c&&o.choice==='destroySame')destroyUnit(c.id,'ダークネス・ガンヴィート');
  else if(c&&['technologyCast','interstellarEnter','interstellarAttack'].includes(o.choice)){const cleanupDestination=o.choice==='interstellarEnter'?'exile':o.choice==='interstellarAttack'?'bottom':null;beginEffectCast(c,o.p,cleanupDestination);return ok('無料使用へ進みます。');}
  pump();return ok('選択を解決しました。');
 }
 function beginEffectCast(c,p,cleanupDestination=null){if(c.type==='通常'){if(summonError(c,p)){record(summonError(c,p));pump();return;}operation={kind:'sideFreePlace',p,id:c.id,slot:null,replacedId:null,cleanupDestination};}
  else prepareFreeUse(locate(c.id),{p,method:'サイド能力から無料使用',cleanupDestination});}
 function confirmSideFree(expected=operation){const o=operation;if(o!==expected||o?.kind!=='sideFreePlace')return fail('無料配置中ではありません。');const s=locate(o.id);if(!s||s.p!==o.p||!['hand','extra'].includes(s.z)||summonError(s.card,o.p))return fail('そのカードを配置できません。');const info=placementInfo(o,s.card);if(!info.ok)return info;operation=null;declareUse(s,{p:o.p,method:'能力から無料召喚',slot:o.slot,replacedId:o.replacedId,baseId:info.base?.id,cleanupDestination:o.cleanupDestination,redFree:o.redFree});return ok('無料召喚を宣言。');}
 function cleanupUsed(source,resolved=true){const c=source.card;c.resolving=false;if(c.vanishAfterUse){vanish(source);return;}const dest=c.cleanupDestination;delete c.cleanupDestination;if(isSideCard(c)){c.used=true;rawMove(source,source.p,'extra');}else if(resolved&&c.charger&&!dest){state[source.p][source.z].splice(source.index,1);putMana(c,source.p);}else rawMove(source,source.p,dest==='exile'?'exile':dest==='bottom'?'main':'trash',true);}
 function sideEffect(effect){const p=effect.p,sourceId=effect.sourceId;
  if(effect.kind==='characterStart'){const c=character(p);if(c&&c.level>0&&(c.level<4||c.level4Start?.length))enqueue(c.level===4?c.level4Start:characterLevelData(c).effects,p,c.id);}
  else if(effect.kind==='cardStart'){const s=locate(effect.id);if(!s||!isUnit(s.z))return true;const c=s.card;if(c.key==='alegre'&&!c.awakened&&state[p].trash.filter(c=>c.type==='呪文').length>=6)operation={kind:'sideChoice',choice:'awakeSpells',p,sourceId:c.id,selected:[]};else enqueue(c.onStart||[],p,c.id);}
  else if(effect.kind==='sideEnd'){for(const owner of PLAYERS)for(const c of fieldCards(owner))if(c.key==='gunveet'&&!c.awakened&&owner!==p&&state[p].hand.length===0)applyForm(c,owner,'darkGunveet');}
  else if(effect.kind==='vtBounceLock'){const q=other(p);summonLocks.push({id:++lockSerial,p:q,turn:turn.counts[q]+1,sourceId});for(const owner of PLAYERS)for(const c of [...fieldCards(owner)])if(c.type==='通常'&&attack(c,owner)<=5&&!c.bounceImmune&&!c.untargetable)rawMove(locate(c.id),owner,'hand');record(`${label(q)}の次の第${turn.counts[q]+1}ターン中、攻撃力5以下の登場を禁止。`);}
  else if(['enemyBounce','enemyUnitBounce','destroyTapped'].includes(effect.kind)){const candidates=targetOptions(effect,p);if(candidates.length)operation={kind:'effectTarget',p,effect:effect.kind,sourceId};}
  else if(effect.kind==='opponentDiscard'){if(state[other(p)].hand.length)operation={kind:'sideChoice',choice:'opponentDiscard',p:other(p),controller:p,sourceId};}
  else if(effect.kind==='darkHand'){if(state[other(p)].hand.length)operation={kind:'sideChoice',choice:'darkHand',p,sourceId};}
  else if(effect.kind==='technologySearch'){operation={kind:'sideChoice',choice:'technologySearch',p,sourceId,ids:state[p].main.map(c=>c.id),selected:[]};}
  else if(['technologyCast','interstellarEnter','interstellarAttack'].includes(effect.kind)){const o={kind:'sideChoice',choice:effect.kind,p,sourceId};if(sideChoiceCandidates(o).length)operation=o;}
  else if(effect.kind==='sideOp'){const o={...effect,kind:'sideChoice'};if(sideChoiceCandidates(o).length)operation=o;}
  else if(effect.kind==='viceOffer'){const c=state[p].extra.find(c=>c.key===(effect.chargerKey||'viceCharger')&&!c.used&&!c.expired);if(c)operation={kind:'sideChoice',choice:'viceOffer',p,sourceId,chargerKey:effect.chargerKey||'viceCharger'};}
  else if(effect.kind==='revolution'){const s=locate(effect.id),c=state[p].extra.find(c=>c.revolution&&!c.used);if(s&&isUnit(s.z)&&c&&!sideSpent(p)&&!summonError(c,p)&&s.card.cost&&Mana.total(s.card.cost)>=5)operation={kind:'revolution',p,id:s.card.id,swapId:c.id,target:effect.target};}
  else return false;return true;
 }
 function resolveRevolution(use=true,expected=operation){const o=operation;if(o!==expected||o?.kind!=='revolution')return fail('革命チェンジ待ちではありません。');const s=locate(o.id),swap=locate(o.swapId);if(!s||!isUnit(s.z)||!swap||swap.z!=='extra'||sideSpent(o.p)||summonError(swap.card,o.p))return fail('交換条件が変わりました。');operation=null;if(use){const slot=s.z;rawMove(s,o.p,'exile',true,true);if(locate(o.id)&&isUnit(locate(o.id).z)){record('交換元が解除等で離場しなかったため革命チェンジを中止し、元の攻撃を継続。');pump();return ok('離場が置換されたためチェンジ不成立。');}sideUse[o.p]=turn.counts[o.p];swap.card.used=true;const c=rawMove(locate(o.swapId),o.p,slot);unitEntered(c,o.p);c.rest=true;c.sick=false;queue=queue.map(e=>e.kind==='attackContinue'&&e.id===o.id?{...e,id:c.id}:e);record('革命チェンジ：交換元を除外し、同じ枠で攻撃を引き継ぎました。');}pump();return ok('革命チェンジを処理。');}
 function symbols(p){const sum=Object.fromEntries(Mana.colors.map(c=>[c,0]));for(const c of fieldCards(p))if(c.type==='通常'||c.type==='設置物')for(const color of Mana.colors)sum[color]+=(c.symbols?.[color]||0)+(c.turnSymbols?.[color]||0);return sum;}
 function effectiveCost(c,p,base=c.cost){if(c.usageCostOverride)return clone(c.usageCostOverride);const cost={...base},provided=symbols(p);if(locate(c.id)?.z==='extra'){const level4=character(p)?.level===4?3:0,creatures=c.creatureReduction?PLAYERS.reduce((n,q)=>n+fieldCards(q).filter(c=>c.type==='通常').length,0):0,blue=c.allBlueReduction&&manaCount(p)>0&&state[p].energy.every(c=>Mana.producedColors(c).length===1&&Mana.producedColors(c)[0]==='青')?c.allBlueReduction:0;cost.generic=Math.max(0,cost.generic-level4-creatures-blue);}if(fieldCards(p).some(x=>x.id===c.id))for(const color of Mana.colors)provided[color]=Math.max(0,provided[color]-(c.symbols?.[color]||0));if(c.genericReduction){const n=Mana.colors.reduce((n,k)=>n+provided[k],0);cost.generic=Math.max(c.genericReduction.minimum??0,cost.generic-Math.min(c.genericReduction.maximum??Infinity,n));}if(c.reduction)for(const color of Mana.colors)if(cost[color]>0)cost[color]=Math.max(c.reduction.minimum?.[color]??1,cost[color]-Math.min(c.reduction.maximum??Infinity,provided[color]));if(turn.scramble?.p===p&&turn.scramble.sequence===turn.sequence&&c.type==='通常'&&Mana.hasColor(c,'赤')){let n=5;for(const k of ['赤',...Mana.colors.filter(k=>k!=='赤')]){const d=Math.min(n,Math.max(0,(cost[k]||0)-1));cost[k]-=d;n-=d;}cost.generic=Math.max(0,cost.generic-n);}return cost;}
 function paymentSources(p){
  const sources=[];for(const c of state[p].energy)if(!c.rest&&Mana.producedColors(c).length)sources.push({id:c.id,card:c,colors:Mana.producedColors(c),amount:1});
  for(const c of fieldCards(p))if(c.type==='通常'&&!c.rest&&!c.sick&&c.manaAbility)sources.push({id:c.id,card:c,colors:[...c.manaAbility.colors],amount:c.manaAbility.amount});
  return sources;
 }
 function planPayment(cost,p,excludeId=null){
  const sources=paymentSources(p).filter(s=>s.id!==excludeId);if(sources.length<Mana.total(cost))return null;
  const needs=Mana.colors.flatMap(color=>Array.from({length:cost[color]},()=>color)).sort((a,b)=>sources.filter(s=>s.colors.includes(a)).length-sources.filter(s=>s.colors.includes(b)).length);
  const chosen=new Map();
  function assign(i){if(i===needs.length)return true;const color=needs[i];for(const s of [...sources].sort((a,b)=>a.colors.length-b.colors.length))if(!chosen.has(s.id)&&s.colors.includes(color)){chosen.set(s.id,color);if(assign(i+1))return true;chosen.delete(s.id);}return false;}
  if(!assign(0))return null;for(const s of sources)if(chosen.size<Mana.total(cost)&&!chosen.has(s.id))chosen.set(s.id,s.colors[0]);
  return {sourceIds:[...chosen.keys()],sourceColors:Object.fromEntries(chosen)};
 }
 function selectedMana(o){return o.sourceIds.map(id=>{const source=paymentSources(o.p).find(s=>s.id===id);return source?{id,type:'マナ',rest:false,mana:{color:o.sourceColors[id]||source.colors[0],amount:source.amount},source}:null;});}
 function validateDeck(a,expected=40,presetSpec=null) {
  if(a.length!==Decks.MAIN_SIZE)throw Error('通常デッキは40枚です。');
  const exempt=Decks.isOfficialPreset(presetSpec)&&JSON.stringify(a.map(c=>c.key).sort())===JSON.stringify(presetSpec.main.flatMap(e=>Array(e.count).fill(e.key)).sort());
  const counts=new Map(),limits=new Map();for(const c of a){const d=Catalog.cards[c.key];if(!d||d.deckEligible===false||d.generated||d.token||Decks.sectionOf(d)!=='main')throw Error('マナ・生成専用・採用不可カードは通常デッキに入れられません。');counts.set(d.name,(counts.get(d.name)||0)+1);limits.set(d.name,Math.min(limits.get(d.name)??Infinity,Decks.limit(d)));}
  if(!exempt)for(const [name,n]of counts)if(n>limits.get(name))throw Error(`${name}の同名採用上限は${limits.get(name)}枚です。`);return true;
 }
 function shuffleRaw(p,z) {const a=state[p][z];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}}
 function manaCount(p){return state[p].energy.length;}
 function isSideCard(c){return c?.sideboardOnly||PLAYERS.some(p=>sideRoster[p].includes(c));}
 function isChargeCard(c){return c&&!c.sideboardOnly&&!c.token&&!c.generated&&c.type!=='シールドカード'&&c.type!=='キャラクター'&&c.type!=='土地'&&!sideRoster[c.origin||SELF]?.includes(c);}
 function putMana(c,p,rest=false){trace('manaPlaced',label(p)+'のマナに《'+c.name+'》を配置（'+Mana.producedColors(c).join('／')+'1マナ）。',{card:publicRef(c,'energy'),beforeMana:state[p].energy.length,afterMana:state[p].energy.length+1},p);c.faceUp=true;c.rest=rest;delete c.returnReservation;state[p].energy.push(c);}
 function createManaToken(p,color='青'){if(!PLAYERS.includes(p)||!Mana.manaColors.includes(color))return fail('マナトークンの文明が不正です。');const c=card(color+'マナトークン','マナトークン',color,null,false,p);c.token=true;c.manaToken=true;putMana(c,p);refreshDerived();return ok('マナトークンを生成しました。');}
 function chargeError(id=null){if(result||status!=='ready'||turn.step!=='charge'||turn.charged||operation)return '今は通常のマナチャージができません。';if(id){const s=locate(id);if(!s||s.p!==turn.player||s.z!=='hand'||!isChargeCard(s.card))return '自分の手札の通常カードを選んでください。';}return '';}
 function beginCharge(id){const e=chargeError(id);if(e)return fail(e);operation={kind:'manaCharge',p:turn.player,id};return ok('文明と発生マナを確認して確定してください。');}
 function confirmCharge(expected=operation){const o=operation;if(result||o!==expected||o?.kind!=='manaCharge'||turn.player!==o.p||turn.step!=='charge'||turn.charged)return fail('以前のチャージ操作です。');const s=locate(o.id);if(!s||s.p!==o.p||s.z!=='hand'||!isChargeCard(s.card))return fail('チャージ対象が変わりました。');operation=null;state[o.p].hand.splice(s.index,1);putMana(s.card,o.p);turn.charged=true;turn.step='main1';refreshDerived();return ok('手札1枚をマナへ置き、メイン1へ進みました。');}
 function cancelCharge(){if(operation?.kind!=='manaCharge')return fail('チャージ確認中ではありません。');operation=null;return ok('手札の選択を取り消しました。');}
 function skipCharge(){const e=chargeError();if(e)return fail(e);turn.step='main1';checkReversions();return ok('チャージせずメイン1へ進みました。');}
 function destroyMana(ids){if(result||!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(id=>locate(id)?.z!=='energy'))return fail('マナの対象が不正です。');for(const id of ids){const s=locate(id);rawMove(s,s.p,'trash');}refreshDerived();return ok(`マナ${ids.length}枚を破壊しました。`);}
 // Explicit legacy deck-recovery utility only; no rule/effect calls this automatically.
 function refreshDeck(p){if(state[p].main.length)return true;const eligible=state[p].trash.filter(c=>!c.resolving&&!isSideCard(c)&&!c.token&&c.type!=='土地');if(!eligible.length)return false;const ids=new Set(eligible.map(c=>c.id));state[p].trash=state[p].trash.filter(c=>!ids.has(c.id));for(const c of eligible){c.faceUp=false;c.rest=false;c.sick=false;}state[p].main.push(...eligible);shuffleRaw(p,'main');record(`${label(p)}が通常トラッシュ${eligible.length}枚でリフレッシュ。`);if(state[p].energy.length){operation={kind:'refreshPenalty',p,required:Math.min(2,state[p].energy.length),ids:[]};}return true;}
 function requireMain(p){return state[p].main.length>0;}
 // Failed draws bypass card-damage/life-loss triggers and every shield window.
 function failedDraw(p){if(result)return;const before=life[p];life[p]--;trace('ruleDamage',label(p)+'がドローできずルールダメージ1：'+before+'→'+life[p]+'。',{targetPlayer:p,beforeLife:before,afterLife:life[p],amount:1,damageType:'rule',reason:'ドロー失敗'},p);events.push({id:++eventSerial,kind:'ruleDamage',p,amount:1,text:'ドロー失敗：ルールダメージ1'});if(life[p]<=0)finish(other(p),'ドロー失敗のルールダメージでライフが0以下');}
 function selectRefreshMana(id){const o=operation;if(o?.kind!=='refreshPenalty'||!state[o.p].energy.some(c=>c.id===id))return fail('自分のマナから選んでください。');if(o.ids.includes(id))o.ids=o.ids.filter(x=>x!==id);else if(o.ids.length<o.required)o.ids.push(id);else return fail(`必ず${o.required}枚を選んでください。`);return ok('リフレッシュの除外対象を変更しました。');}
 function confirmRefresh(expected=operation){const o=operation;if(result||o!==expected||o?.kind!=='refreshPenalty'||o.ids.length!==Math.min(2,state[o.p].energy.length)||new Set(o.ids).size!==o.ids.length||o.ids.some(id=>!state[o.p].energy.some(c=>c.id===id)))return fail('必要な枚数のマナを選んでください。');operation=null;for(const id of o.ids)rawMove(locate(id),o.p,'exile');refreshDerived();pump();return ok('リフレッシュのペナルティを解決し、処理を再開しました。');}
 function drawRaw(p,count){let drawn=0;for(let i=0;i<count&&!result;i++){if(!requireMain(p)){failedDraw(p);continue;}const c=state[p].main.shift();c.faceUp=true;c.rest=false;state[p].hand.push(c);drawn++;}if(drawn)trace('draw',label(p)+'が'+drawn+'枚ドロー。',{count:drawn},p);return drawn;}
 function addMana(p,count=1){if(!PLAYERS.includes(p)||!Number.isInteger(count)||count<0||result)return fail('マナ追加が不正です。');enqueue([{kind:'manaAdd',count}],p,null);if(!operation)pump();return ok('通常デッキからのマナ追加を処理しました。');}
 function takeEffect(effect){const {p,sourceId}=effect;
  if(['draw','manaAdd','fateWhim'].includes(effect.kind)){
   const count=effect.kind==='fateWhim'?1:effect.count;if(count<=0)return true;if(!requireMain(p)){if(effect.kind!=='manaAdd')failedDraw(p);if(!result&&count>1)queue.unshift({...effect,count:count-1});return true;}
   const c=state[p].main.shift();if(effect.kind==='manaAdd')putMana(c,p,!!effect.rest);else{c.faceUp=true;c.rest=false;state[p].hand.push(c);if(effect.kind==='fateWhim'&&hasJil(p))c.usageCostOverride=Mana.cost(1);if(effect.normalDraw)turn.lastDraw++;}
   if(effect.kind!=='manaAdd')trace('draw',label(p)+'が1枚ドロー。',{source:sourceId?refId(sourceId):null,count:1,handAfter:state[p].hand.length,mainAfter:state[p].main.length},p);if(count>1)queue.unshift({...effect,count:count-1});refreshDerived();return true;
  }
  if(['millRecover','revealBlue'].includes(effect.kind)){
   const ids=effect.ids||[],remaining=effect.remaining??effect.count;
   if(remaining>0&&requireMain(p)){const c=state[p].main.shift();state[p].holding.push(c);queue.unshift({...effect,ids:[...ids,c.id],remaining:remaining-1});return true;}
   const cards=ids.map(id=>locate(id)?.card).filter(Boolean);for(const c of cards){const s=locate(c.id);state[p].holding.splice(s.index,1);c.faceUp=true;state[p][effect.kind==='revealBlue'&&Mana.hasColor(c,'青')?'hand':'trash'].push(c);}if(effect.kind==='revealBlue')record(`公開：${cards.map(c=>c.name).join('／')}。`);else if(state[p].trash.some(c=>c.type==='通常'))operation={kind:'recoverUnit',p};return true;
  }
  return false;
 }
 function reset(nextMode=mode,nextDecks=deckChoices,nextSides=sideChoices) {
  if(normalMode&&nextSides.p1!=='deck')return fail('通常モードでは所持デッキのサイド構成を使用してください。');let specs;try{specs=Object.fromEntries(PLAYERS.map(p=>{const d=Decks.resolve(nextDecks[p],deckRecords),errors=[...Decks.validate(d),...(p==='p1'?collectionErrors(d):[])];if(errors.length)throw Error(errors.join('／'));return [p,d];}));}catch(e){return fail(e.message);}sideChoices={...nextSides};sideUse={p1:-1,p2:-1};activeCombat=null;battleDeaths=new Set();summonLocks=[];lockSerial=0;sideRoster={p1:[],p2:[]};chosenSpecs=specs;deckChoices={...nextDecks};vanishedIds=new Set();extraTurns=[];normalNext=null;shieldTiming=0;closedShieldTimings=new Set();stack=[];events=[];eventSerial=0;frameSerial=0;
  if(!['solo','bot'].includes(nextMode))return fail('モードを選んでください。');mode=nextMode;epoch++;firstPlayer=mode==='bot'?(random()<.5?'p1':'p2'):SELF;
  journal=[];journalId=0;attackSerial=0;diagnosticFailures=0;gameId=Date.now().toString(36)+'-'+(++gameSerial)+'-'+epoch;life={p1:30,p2:30};serial=0;log=[];queue=[];supplyStatus={p1:{main:''},p2:{main:''}};result=null;operation=null;status='mulligan';turn={player:firstPlayer,counts:{p1:0,p2:0},sequence:0,number:0,step:'untap',charged:false,key:{},notBefore:0,lastDraw:0};mulligan={p1:'pending',p2:'pending'};
  state=Object.fromEntries(PLAYERS.map(p=>[p,Object.fromEntries(ZONES.map(z=>[z.id,[]]))]));
  for(const p of PLAYERS){state[p].shields=(chosenSpecs[p].shields??Decks.defaultShields()).flatMap(e=>Array.from({length:e.count},()=>{const c=fromDefinition(e.key,p);c.faceUp=false;return c;}));state[p].main=buildDeck(p,chosenSpecs[p]);validateDeck(state[p].main,40,chosenSpecs[p]);state[p].extra=(sideChoices[p]==='piruluk'?Catalog.sideboardPreset:chosenSpecs[p].sideboard||[]).flatMap(e=>Array.from({length:e.count},()=>fromDefinition(e.key,p)));sideRoster[p]=[...state[p].extra];shuffleRaw(p,'main');drawRaw(p,INITIAL_HAND);}
  trace('gameStart','対戦開始。初期ライフ30・初期手札5枚。',{mode,decks:Object.fromEntries(PLAYERS.map(p=>[p,{name:chosenSpecs[p].name,main:40,hand:state[p].hand.length,side:state[p].extra.length,shields:state[p].shields.length,life:life[p]}])),firstPlayer});record(`${mode==='bot'?'Bot戦':'壁打ち'}：先攻は${label(firstPlayer)}。選択したメインデッキから初期手札5枚を配りました。`);return ok('各プレイヤーのマリガンを選択してください。');
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
 function rawMove(source,p,z,bottom=true,preserveDestination=false){if(!source)return null;const from={player:source.p,zone:source.z},before=publicRef(source.card,source.z),c=moveRaw(source,p,z,bottom,preserveDestination),dest=locate(c.id),after=dest?publicRef(c,dest.z):null,ref=!before.hidden?before:after&&!after.hidden?after:{hidden:true};trace('move',(ref.name?'《'+ref.name+'》':'非公開カード')+'：'+(ZONES.find(x=>x.id===from.zone)?.name||from.zone)+'→'+(dest?ZONES.find(x=>x.id===dest.z)?.name:'消滅')+'。',{card:ref,from,to:dest?{player:dest.p,zone:dest.z}:{zone:'vanished'},before,after},from.player);return c;}
 function moveRaw(source,p,z,bottom=true,preserveDestination=false) {
  if(isUnit(source.z)&&!isUnit(z)&&source.card.markerGuard&&!source.card.abilitiesDisabled){const marker=state[source.p].markers.find(x=>x.hostId===source.card.id);if(marker){rawMove(locate(marker.id),source.p,'trash');record('マーカーを破棄し離場を1回防止。');return source.card;}}
  if(isUnit(source.z)&&!isUnit(z)&&source.card.awakened&&source.card.release&&!source.card.abilitiesDisabled){applyForm(source.card,source.p,null);return source.card;}
  if(source.z==='energy'&&z!=='energy')delete source.card.manaLock;
  if(source.z==='markers'){const host=locate(source.card.hostId);delete source.card.hostId;if(host&&isUnit(host.z)&&!host.card.rest&&!host.card.abilitiesDisabled)enqueue([{kind:'damagePlayer',amount:attack(host.card,host.p)}],host.p,host.card.id);}
  if(isUnit(source.z)&&!isUnit(z)){for(const marker of [...state[source.p].markers].filter(x=>x.hostId===source.card.id)){delete marker.hostId;rawMove(locate(marker.id),source.p,'trash');}}

  if(!preserveDestination&&isSideCard(source.card)&&source.card.type==='通常'&&isUnit(source.z)&&!isUnit(z)){z='extra';p=source.card.origin||source.p;}
  if(source.card.manaToken&&source.z==='energy'&&z!=='energy'){const [c]=state[source.p].energy.splice(source.index,1);vanishedIds.add(c.id);return c;}
  const [c]=state[source.p][source.z].splice(source.index,1),leaving=isUnit(source.z)&&!isUnit(z);
  if(source.z==='exile'&&z!=='exile')delete c.returnReservation;
  if(leaving){delete c.turnSymbols;delete c.turnSA;delete c.turnAttackBonus;delete c.pendingDestruction;delete c.justDiverUntil;delete c.attackZero;if(c.temporarySA){delete c.speedAttacker;delete c.temporarySA;}if(c.statBonus){c.attack-=c.statBonus.attack;c.maxHealth-=c.statBonus.health;delete c.statBonus;}const bases=[...(c.under||[])];c.under=[];for(const base of bases){if(!base.token){base.faceUp=true;state[base.origin||source.p].trash.push(base);}else vanishedIds.add(base.id);}const real=c.token?[]:[c];if(c.token)vanishedIds.add(c.id);if(!real.length)return c;
   if(z==='main'&&real.length>1){state[p].holding.push(...real);operation={kind:'stackOrder',p,ids:real.map(c=>c.id),order:real.map(c=>c.id),destination:z};return c;}
   for(const item of real){if(isSideCard(item)&&!preserveDestination){if(item.awakened)applyForm(item,p,null);item.used=true;state[item.origin||p].extra.push(item);continue;}if(z==='hand')item.faceUp=true;if(bottom)state[p][z].push(item);else state[p][z].unshift(item);}return c;
  }
  if(isUnit(z)&&!isUnit(source.z)){c.sick=true;c.enteredTurn=turn.counts[p];}
  if(z==='energy'||z==='hand')c.rest=false;if(bottom)state[p][z].push(c);else state[p][z].unshift(c);return c;
 }
 function interactionError() {if(result)return '対戦は終了しています。最初からやり直してください。';if(status!=='ready')return '開始準備中は通常操作を使えません。';if(operation)return '選択中の処理を完了してください。';return '';}
 function mainError(p,allowPayment=false) {if(result)return '対戦は終了しています。';if(status!=='ready')return '開始準備中です。';if(p!==turn.player)return '現在のターンのプレイヤーだけが使用できます。';if(!['main1','main2'].includes(turn.step))return 'カードの使用はメイン1・メイン2で行ってください。';if(operation&&!(allowPayment&&operation.kind==='payment'))return '選択中の処理を完了してください。';return '';}
 function manualMove(id,p,z,bottom=false) {
  if(normalMode||mode==='bot')return fail('通常モード・Bot戦ではルール外の手動移動を使えません。');if(z==='shields'||locate(id)?.z==='shields'||locate(id)?.card.sideboardOnly||z==='lrig')return fail('シールドは専用処理で管理します。');
  const source=locate(id),error=interactionError();if(error)return fail(error);if(!source||!state[p]?.[z])return fail('カードまたは領域が見つかりません。');
  if(['main','trash'].includes(z)&&source.card.type==='土地'&&z!=='trash')return fail('旧基本土地カードは使用できません。');
  if(z==='energy'&&!isChargeCard(source.card))return fail('通常カードだけをマナへ置けます。');
  if(isUnit(z)&&summonError(source.card,p))return fail(summonError(source.card,p));if(isUnit(z)&&state[p][z].length&&!(source.p===p&&source.z===z))return fail('ユニット枠は1枚です。空き枠への手動移動か、通常の上書き配置を使用してください。');
  if(z==='extra'&&state[p].extra.length>=10&&!(source.p===p&&source.z===z))return fail('サイドボードは10枚枠です。');
  if(isUnit(z)&&(!isUnit(source.z)||source.p!==p)){enterCard(source,p,z);pump();}else rawMove(source,p,z,bottom);refreshDerived();pump();return ok(z==='exile'?'明示的な手動操作で除外ゾーンへ移しました。':'手動移動（ルール外の補助）を実行しました。通常チャージ回数は変更しません。');
 }
 function addCard(p,z,c) {
  if(z==='shields'||c?.type==='シールドカード'||c?.sideboardOnly||z==='lrig')return fail('シールドは専用デッキで管理します。');
  if(!c?.id||vanishedIds.has(c.id)||locate(c.id))return fail('消滅した個体や、既に存在する個体は追加できません。');
  if(normalMode||mode==='bot')return fail('通常モード・Bot戦では仮カード追加を使えません。');
  const error=interactionError();if(error)return fail(error);if(!state[p]?.[z])return fail('追加先が見つかりません。');
  if(z==='main'&&c.type==='土地')return fail('旧基本土地カードは使用できません。');
  if(z==='energy'&&!isChargeCard(c))return fail('通常カードだけをマナへ置けます。');
  if(isUnit(z)&&summonError(c,p))return fail(summonError(c,p));if(isUnit(z)&&state[p][z].length)return fail('ユニット枠は1枚です。空き枠を選んでください。');
  if(z==='extra'&&state[p].extra.length>=10)return fail('サイドボードは10枚枠です。');
  state[p][z].push(c);if(z==='energy'){c.faceUp=true;c.rest=false;}if(isUnit(z)&&c.type==='通常'){unitEntered(c,p);pump();}refreshDerived();return ok('ルール外の補助として仮カードを追加しました。');
 }
 function toggle(id,property='rest') {
  if(normalMode||mode==='bot')return fail('通常モード・Bot戦では状態切替の補助操作を使えません。');
  const error=interactionError(),s=locate(id);if(error)return fail(error);if(!s)return fail('カードが見つかりません。');
  if(s.z==='shields')return fail('シールドは専用処理で管理します。');if(!['rest','faceUp','sick'].includes(property))return fail('変更できない項目です。');
  if(property==='sick'&&(!isUnit(s.z)||s.card.type!=='通常'))return fail('場の仮ユニットを選んでください。');
  s.card[property]=!s.card[property];return ok(property==='sick'?'補助操作で召喚酔いを変更しました。':'補助操作でカードの状態を変更しました。');
 }
 function readyMana(p) {if(normalMode||mode==='bot')return fail('通常モード・Bot戦では補助操作を使えません。');const e=interactionError();if(e)return fail(e);state[p].energy.forEach(c=>c.rest=false);return ok('補助操作でマナを未使用に戻しました。');}
 function remove(id) {if(locate(id)?.z==='shields'||locate(id)?.card.sideboardOnly)return fail('専用カードは通常の補助で削除できません。');if(normalMode||mode==='bot')return fail('通常モード・Bot戦では補助操作を使えません。');const e=interactionError(),s=locate(id);if(e)return fail(e);if(!s)return fail('カードが見つかりません。');state[s.p][s.z].splice(s.index,1);refreshDerived();pump();return ok('補助操作でカードを削除しました。');}
 function draw(p,n=1) {if(normalMode||mode==='bot')return fail('通常モード・Bot戦では補助操作を使えません。');const e=interactionError();if(e)return fail(e);if(!Number.isInteger(n)||n<1)return fail('ドロー枚数が不正です。');enqueue([{kind:'draw',count:n}],p,null);pump();return ok('手動ドローを処理しました。');}
 function shuffle(p,z) {if(normalMode||mode==='bot')return fail('通常モード・Bot戦では補助操作を使えません。');const e=interactionError();if(e)return fail(e);shuffleRaw(p,z);return ok('山札をシャッフルしました。');}
 function availableMana(p) {const sources=paymentSources(p);return {total:sources.length,...Object.fromEntries(Mana.manaColors.map(color=>[color,sources.filter(s=>s.colors.includes(color)).length])),flexible:sources.filter(s=>s.colors.length>1).length};}
 function unitSlots(p) {return ZONES.filter(z=>isUnit(z.id));}
 function evolutionBases(p,c){return unitSlots(p).filter(z=>state[p][z.id][0]?.type==='通常'&&(c.evolution?.any||Mana.hasColor(state[p][z.id][0],c.evolution?.color)));}
 function placementOptions(p,c=null){if(c?.evolution)return evolutionBases(p,c);const slots=unitSlots(p),empty=slots.filter(z=>!state[p][z.id].length);return empty.length?empty:slots;}
 function counterCards(p){return instantCards(p);}
 function useCost(c,p,purpose='normal'){if(purpose==='growth')return Mana.cost(Catalog.characterLevels[(c.level||0)+1]?.cost??999);if(purpose==='gzero')return Mana.cost(0);return effectiveCost(c,p);}
 function useError(c,p,purpose='normal'){if(!['normal','gzero','growth','instant','counter'].includes(purpose))return 'この使用方法は廃止されました。';
  if(purpose==='instant'||purpose==='counter'){if(operation?.kind!=='response'||operation.p!==p||!instantCards(p).some(x=>x.id===c.id))return '応答可能なインスタントを選んでください。';return '';}
  if(c.instant&&locate(c.id)?.z==='hand'&&!operation&&status==='ready'&&!result){if(c.responseOnly)return '打ち消す呪文がスタックにありません。';return '';}
  const e=mainError(p);if(e)return e;if(purpose==='growth'){if(c.type!=='キャラクター'||c.level>=4||sideSpent(p))return '成長できません。';return '';}
  if(c.responseOnly)return '呪文への応答でのみ使用できます。';const z=locate(c.id)?.z;if(z==='extra')return canSide(p,c)||summonError(c,p);if(z!=='hand'&&!(z==='energy'&&c.castFromMana))return '手札または召喚可能なマナのカードを選んでください。';if(summonError(c,p))return summonError(c,p);
  if(purpose==='gzero'&&(!c.gZero||z!=='hand'||state[p].hand.length<c.gZero.hand))return '使用前の手札10枚以上が必要です。';
  if(c.evolution&&!evolutionBases(p,c).length)return '条件を満たす自分のユニットの進化元が必要です。';return '';
 }
 function playStatus(c,p){
  if(c.type==='土地')return {ok:false,text:'旧基本土地は使用できません。',reasons:['旧基本土地は使用できません。']};
  if(!['通常','呪文','設置物'].includes(c.type)||!c.cost)return {ok:false,text:'通常使用の対象外',reasons:['通常使用の対象外です。']};
  const gzero=!!c.gZero&&locate(c.id)?.z==='hand'&&state[p].hand.length>=c.gZero.hand,purpose=gzero?'gzero':'normal',e=useError(c,p,purpose),cost=useCost(c,p,purpose),plan=planPayment(cost,p,c.id),reasons=e?[e]:[];
  if(!plan)reasons.push(...Mana.assess(cost,availableMana(p)).reasons);if(!plan&&!reasons.length)reasons.push('必要な色マナの組み合わせを満たせません。');
  return {ok:!reasons.length,text:reasons[0]||(gzero?'G・ゼロ使用可':'マナ支払い可'),reasons,gzero};
 }
 function beginPayment(id,purpose='normal'){
  const source=locate(id);if(!source)return fail('カードが見つかりません。');const c=source.card,p=source.p;if(operation?.kind==='response'&&c.instant)purpose='instant';
  if(purpose==='normal'&&c.gZero&&source.z==='hand'&&state[p].hand.length>=c.gZero.hand)purpose='gzero';
  const e=useError(c,p,purpose);if(e)return fail(e);const cost=useCost(c,p,purpose),plan=planPayment(cost,p,id);if(!plan)return fail(Mana.assess(cost,availableMana(p)).reasons.join('／')||'色マナ不足');
  const response=['counter','instant'].includes(purpose)?operation:null;operation={kind:'payment',id,p,purpose,sourceZone:source.z,cost,slot:null,replacedId:null,targetId:null,response,...plan};return ok('使用方法・軽減後コスト・支払い元・配置先を確認してください。');
 }
 function chooseSlot(z) {const o=operation;if(!['payment','freePlace','returnPlace','sideFreePlace'].includes(o?.kind))return fail('配置操作がありません。');if(!placementOptions(o.p,locate(o.id)?.card).some(s=>s.id===z))return fail('空き枠を選んでください。満杯時のみ上書きできます。');o.slot=z;o.replacedId=state[o.p][z][0]?.id||null;return ok('配置先を選びました。');}
 function togglePaymentLand(id) {
  const o=operation;if(o?.kind!=='payment')return fail('支払い操作がありません。');const source=paymentSources(o.p).find(c=>c.id===id);if(!source)return fail('未使用で起動可能な自分の支払い元を選んでください。');
  o.sourceIds=o.sourceIds.includes(id)?o.sourceIds.filter(x=>x!==id):[...o.sourceIds,id];if(!o.sourceColors[id])o.sourceColors[id]=source.colors[0];return ok('支払い案を変更しました。');
 }
 function chooseManaColor(id,color){const o=operation,s=paymentSources(o?.p||SELF).find(s=>s.id===id);if(o?.kind!=='payment'||!s||!s.colors.includes(color))return fail('この支払い元で出せる色を選んでください。');o.sourceColors[id]=color;return ok('マナ能力の色を選びました。');}
 function placementInfo(o,c){
  if(c.type!=='通常'||o.purpose==='set'||o.purpose==='growth')return {ok:true,replacement:null};
  if(c.evolution){const base=state[o.p][o.slot]?.[0];return base&&base.id===o.replacedId&&(c.evolution.any||Mana.hasColor(base,c.evolution.color))?{ok:true,replacement:null,base}:fail('条件を満たす進化元を選んでください。');}if(!isUnit(o.slot))return fail('配置先を選んでください。');const current=state[o.p][o.slot];
  if(current.length>1||(current[0]?.id||null)!==o.replacedId)return fail('配置先または上書き対象が変わりました。');
  if(o.replacedId&&unitSlots(o.p).some(z=>!state[o.p][z.id].length))return fail('空き枠へ配置先を選び直してください。');return {ok:true,replacement:current[0]||null};
 }
 function paymentInfo(expected=operation) {
  const o=operation;if(!o||o!==expected||o.kind!=='payment')return fail('この支払い操作は終了しています。');const e=['counter','instant'].includes(o.purpose)||safelogInstant(o.id)?'':mainError(o.p,true);if(e)return fail(e);
  const s=locate(o.id);if(!s||s.p!==o.p||s.z!==o.sourceZone||!s.card.cost)return fail('対象カードが手札にありません。');if(o.purpose==='gzero'&&state[o.p].hand.length<s.card.gZero.hand)return fail('G・ゼロ条件が変わりました。');if(o.purpose==='growth'&&sideSpent(o.p))return fail('このターンのサイドは使用済みです。');if(o.sourceZone==='extra'&&o.purpose!=='growth'&&canSide(o.p,s.card))return fail(canSide(o.p,s.card));if(!['growth','set'].includes(o.purpose)&&summonError(s.card,o.p))return fail(summonError(s.card,o.p));const place=placementInfo(o,s.card);if(!place.ok)return place;
  if(new Set(o.sourceIds).size!==o.sourceIds.length)return fail('支払い元を重複して選べません。');const sources=selectedMana(o);if(o.sourceZone==='energy'&&o.sourceIds.includes(o.id))return fail('召喚するマナ自身は支払いに使えません。');if(sources.some(s=>!s||!s.source.colors.includes(s.mana.color)))return fail('支払い元の状態・召喚酔い・色が変わりました。');
  const cost=useCost(s.card,o.p,o.purpose),payment=Mana.payment(cost,sources);if(!payment.ok)return fail(payment.reasons.join('／'));
  return {ok:true,source:s,sources,replacement:place.replacement,base:place.base,cost};
 }
 function enterCard(s,p,slot,replacement=null){
  if(replacement){rawMove(locate(replacement.id),p,'trash');if(locate(replacement.id)&&isUnit(locate(replacement.id).z)){rawMove(s,p,s.card.sideboardOnly?'extra':'hand');record('上書き対象が離場を防いだため新規登場は中止。');return s.card;}record(`${replacement.name}を上書きでトラッシュへ送りました。`);}
  if(summonError(s.card,p)){record(summonError(s.card,p));rawMove(s,p,s.card.sideboardOnly?'extra':'hand');return s.card;}const c=rawMove(s,p,s.card.type==='設置物'?'structures':slot);c.faceUp=true;c.rest=!!c.enterRest;c.sick=c.type==='通常';c.enteredTurn=turn.counts[p];
  if(c.type==='通常')unitEntered(c,p);else enqueue(c.onEnter||[],p,c.id);refreshDerived();return c;
 }
 function unitEntered(c,p,returning=false){
  for(const owner of PLAYERS)for(const otherCard of fieldCards(owner))if(otherCard.id!==c.id&&otherCard.rageArm)otherCard.turnAttackBonus=(otherCard.turnAttackBonus||0)+1;
  const diver=c.justDiver&&!c.abilitiesDisabled;if(diver)c.justDiverGeneration=(c.justDiverGeneration||0)+1;
  resetHealth(c,p);c.sick=true;c.rest=!!c.enterRest;c.enteredTurn=turn.counts[p];
  // 同時に誘発した登場時能力は、本人の効果→場にあった設置物の順で解決。
  const triggers=state[p].structures.flatMap(s=>(s.onUnitEnter||[]).map(e=>({...e,triggerName:s.name})));
  const watches=fieldCards(p).filter(x=>x.id!==c.id&&x.drawOnUse).map(()=>({kind:'draw',count:1}));const banners=Mana.hasColor(c,'赤')?state[p].structures.filter(x=>x.redBanner).length:0;enqueue([...(diver?[{kind:'justDiver',generation:c.justDiverGeneration}]:[]),...(banners?[{kind:'bannerOne',id:c.id,amount:banners}]:[]),...(returning?[]:c.onEnter||[]),...triggers,...watches],p,c.id);
 }
 function useSpell(s,p,ignored=false,targetId=null){const c=s.z==='check'?s.card:rawMove(s,p,'check');c.faceUp=true;c.resolving=true;enqueue([...(c.onUse||[]),{kind:'cleanup'}],p,c.id,targetId);return c;}
 function confirmPayment(expected=operation){
  const checked=paymentInfo(expected);if(!checked.ok)return checked;const o=operation,c=checked.source.card;
  const targetEffect=(c.onUse)?.find(e=>['bounce','unitBounce','trap','mother','buffUnit'].includes(e.kind));
  if(strictTargets&&targetEffect&&targetOptions(targetEffect,o.p).length&&!targetOptions(targetEffect,o.p).some(x=>x.id===o.targetId))return fail('使用前に対象を1枚選んでください。');
  operation=null;trace('payment',label(o.p)+'が'+checked.sources.length+'マナを支払い。コスト：'+Mana.describe(checked.cost)+'。',{card:o.purpose==='set'?{hidden:true}:publicRef(c,'check'),purpose:o.purpose,baseCost:o.purpose==='set'?null:o.purpose==='growth'?Mana.cost(Catalog.characterLevels[(c.level||0)+1].cost):c.cost,paidCost:checked.cost,sources:checked.sources.map(s=>publicRef(s.source.card,locate(s.id)?.z||'energy')),target:o.targetId?refId(o.targetId):null},o.p);checked.sources.forEach(s=>s.source.card.rest=true);
  if(o.purpose==='growth'){sideUse[o.p]=turn.counts[o.p];if(checked.source.z==='extra')rawMove(checked.source,o.p,'lrig');c.level=(c.level||0)+1;c.cost=Mana.cost(Catalog.characterLevels[c.level].cost);trace('growth',c.name+'Lv'+c.level+'へ成長。',{card:publicRef(c,'lrig'),level:c.level},o.p);enqueue([...characterLevelData(c).effects,...(c.level===2&&['piruluk','celestia'].includes(c.key)?[{kind:'viceOffer',chargerKey:c.key==='celestia'?'rampCharger':'viceCharger'}]:[])],o.p,c.id);pump();return ok(`${c.name}Lv${c.level}へ成長。`);}
  declareUse(checked.source,{p:o.p,paidCost:checked.cost,method:o.response?'インスタント応答':o.purpose==='gzero'?'G・ゼロ':'通常使用',slot:o.slot,replacedId:o.replacedId,baseId:checked.base?.id,targetId:o.targetId,counterTarget:o.response?.frameId,resumePriority:o.response?.context});
  return ok('支払いを確定しました。');
 }
 function cancelPayment(){if(operation?.kind!=='payment')return fail('キャンセルできる支払い操作がありません。');operation=operation.response||null;return ok('支払いをキャンセルしました。支払い元は変更していません。');}
 function selectUseTarget(id){const o=operation;if(!o||!['payment','freePlace','freeCast','returnPlace','sideFreePlace'].includes(o.kind))return fail('使用確認中ではありません。');const c=locate(o.id)?.card,e=(c?.onUse)?.find(e=>['bounce','unitBounce','trap','mother','buffUnit'].includes(e.kind));if(!e||!targetOptions(e,o.p).some(x=>x.id===id))return fail('有効なユニット・設置物を選んでください。マナは対象外です。');o.targetId=id;return ok('使用前の対象を確定しました。');}
 function announce(event,after){const publicEvent={id:++eventSerial,...event};{const c=locate(event.cardId)?.card;if(c)publicEvent.card=clone(c);}events.push(publicEvent);if(events.length>80)events.shift();if(presentationMs>0){operation={kind:'presentation',event:publicEvent,until:clock()+presentationMs,after};}else continueAnnouncement(after);}
 function continueAnnouncement(after){if(after==='window')responseWindow();else if(after==='stack')resolveStack();else pump();}
 function finishPresentation(expected=operation){const o=operation;if(o!==expected||o?.kind!=='presentation'||result)return fail('以前の演出です。');if(clock()<o.until)return fail('カード表示中です。');operation=null;continueAnnouncement(o.after);return ok('公開行動を表示しました。');}
 function prepareFreeUse(source,options){const c=source.card,e=c.onUse?.find(e=>['bounce','unitBounce','trap','mother','buffUnit'].includes(e.kind));if(strictTargets&&e&&targetOptions(e,options.p).length)operation={kind:'freeCast',id:c.id,p:options.p,options,targetId:null};else declareUse(source,options);}
 function confirmFreeCast(expected=operation){const o=operation;if(o!==expected||o?.kind!=='freeCast')return fail('以前の無料使用です。');const s=locate(o.id),e=s?.card.onUse?.find(e=>['bounce','unitBounce','trap','mother','buffUnit'].includes(e.kind));if(!s||!targetOptions(e,o.p).some(c=>c.id===o.targetId))return fail('対象を確定してください。');operation=null;declareUse(s,{...o.options,targetId:o.targetId});return ok('無料使用を宣言しました。');}
 function declareUse(source,options){const c=source.card,p=options.p;if(c.type==='通常'&&Mana.hasColor(c,'赤')&&turn.scramble?.p===p&&turn.scramble.sequence===turn.sequence){options.scramble=true;delete turn.scramble;}trace('cardUse',label(p)+'が《'+c.name+'》を使用。',{card:publicRef(c,'check'),from:source.z,sourcePlayer:p,target:options.targetId?refId(options.targetId):null,cost:options.paidCost||Mana.cost(0),method:options.method},p);if(source.z==='extra'&&!options.sideAdditional){sideUse[p]=turn.counts[p];c.used=true;}if(options.cleanupDestination)c.cleanupDestination=options.cleanupDestination;if(c.type==='呪文')enqueue(fieldCards(p).filter(x=>x.drawOnUse).map(()=>({kind:'draw',count:1})),p,c.id);rawMove(source,p,'check');c.faceUp=true;c.resolving=true;const frame={id:++frameSerial,cardId:c.id,...options,responded:false,canceled:false};stack.push(frame);record(`${label(p)}が${c.name}を${frame.method}で使用宣言。`);announce({kind:'use',p,cardId:c.id,method:frame.method,cost:frame.paidCost||Mana.cost(0),text:'使用宣言・解決待ち'},'window');}
 function responseWindow(){const f=stack.at(-1);if(!f)return pump();openPriority({type:'spell',frameId:f.id,cardId:f.cardId},other(f.p));}
 function passResponse(expected=operation){const o=operation;if(o!==expected||o?.kind!=='response')return fail('応答待ちではありません。');const next=other(o.p);if(o.passes>=1||!instantCards(next).length){operation=null;continuePriority(o.context);}else operation={...o,p:next,passes:1};return ok('優先権を渡しました。');}
 function resolveStack(){if(operation||result)return;const f=stack.pop();if(!f)return pump();const source=locate(f.cardId);if(!source)return resolveStack();const c=source.card,pending=queue;queue=[];c.resolving=false;if(c.type==='呪文'&&fieldCards(other(f.p)).some(x=>x.spellSilence&&!x.abilitiesDisabled)){cleanupUsed(source,false);record(c.name+'の呪文効果をヴァーミリオン・ドラヴィタで無効。');}else if(f.canceled){cleanupUsed(source,false);record(c.name+'を打ち消しました。');}else if(c.responseOnly){const target=stack.find(x=>x.id===f.counterTarget);if(target&&locate(target.cardId)?.card.type==='呪文'&&!locate(target.cardId)?.card.uncounterable)target.canceled=true;cleanupUsed(source);}else if(c.type==='呪文')useSpell(source,f.p,false,f.targetId);else if(c.evolution){const base=state[f.p][f.slot]?.[0];if(!base||base.id!==f.baseId)rawMove(source,f.p,'trash');else{state[f.p][f.slot].shift();c.under=[...(base.under||[]),base];base.under=[];rawMove(source,f.p,f.slot);unitEntered(c,f.p);c.rest=base.rest;c.sick=false;}}else{enterCard(source,f.p,f.slot,f.replacedId?locate(f.replacedId)?.card:null);if(f.scramble&&locate(c.id)&&isUnit(locate(c.id).z))c.turnSA=true;if(f.redFree){c.speedAttacker=true;c.temporarySA=true;queue.push({kind:'draw',count:1,p:f.p,sourceId:character(f.p)?.id});}}queue.push({kind:'resumeStack',p:f.p,controller:f.p,pending,resume:f.resumePriority});pump();}
 function safelogInstant(id){return !!locate(id)?.card.instant;}
 function beginTurn(forcedPlayer=null) {
  let p,extra=false;if(forcedPlayer&&mode==='solo'){p=forcedPlayer;normalNext=other(p);}else if(turn.sequence===0){p=firstPlayer;normalNext=other(p);}else if(extraTurns.length){p=extraTurns.shift();extra=true;}else if(mode==='bot'){p=normalNext;normalNext=other(p);}else p=SELF;
  for(const q of PLAYERS)for(const c of fieldCards(q))if(c.attackZero?.until===p)delete c.attackZero;operation=null;turn.player=p;turn.extra=extra;turn.sequence++;turn.counts[p]++;turn.number=turn.counts[p];turn.key={};turn.step='untap';turn.lastDraw=0;turn.attacks=0;turn.battleWins={p1:0,p2:0};delete turn.scramble;
  for(const c of fieldCards(p))if(c.justDiverUntil&&c.justDiverUntil.owner===p&&c.justDiverUntil.turn<=turn.counts[p]){delete c.justDiverUntil;record(c.name+'のジャストダイバーの期限終了。');}
  for(const z of ZONES)if(isField(z.id)||z.id==='energy')state[p][z.id].forEach(c=>{if(z.id==='energy'){if(c.manaLock&&c.manaLock.skipAt<=turn.counts[p]){c.rest=true;delete c.manaLock;}else c.rest=false;}else untapUnit(c,p);if(isField(z.id))c.sick=false;});
  turn.charged=false;trace('turnStart',label(p)+'のターン開始。マナ・場をアンタップ。',{after:auditState().players},p);record(`${label(p)}の第${turn.number}ターン${extra?'（追加ターン）':''}：アンタップ、召喚酔い解除。`);
  const returning=state[p].exile.filter(c=>c.returnReservation?.owner===p&&c.returnReservation.at<=turn.counts[p]);
  enqueue([{kind:'characterStart'},...fieldCards(p).map(c=>({kind:'cardStart',id:c.id})),...returning.map(c=>({kind:'return',id:c.id})),{kind:'startDraw'}],p,null);pump();
 }
 function soloNextPlayer(p){if(mode!=='solo'||!PLAYERS.includes(p)||turn.step!=='end'||interactionError())return fail('壁打ちの終了フェイズでのみ切替可能です。');summonLocks=summonLocks.filter(l=>!(l.p===turn.player&&l.turn<=turn.counts[turn.player]));beginTurn(p);return ok('壁打ち補助：次の側のターンを開始しました。');}
 function startDraw(p){turn.step='draw';trace('phase','ドローフェイズ。',{skipped:turn.sequence===1},p);turn.skippedDraw=turn.sequence===1;enqueue([...(turn.skippedDraw?[]:[{kind:'draw',count:1,normalDraw:true}]),{kind:'chargePhase'}],p,null);}
 function vanish(source){if(!source)return;const c=source.card;state[source.p][source.z].splice(source.index,1);vanishedIds.add(c.id);record(`${c.name}は使用後に消滅しました（トラッシュ・除外には置きません）。`);}
 function hasJil(p){return fieldCards(p).some(c=>c.key==='jil');}
 function grantExtraTurns(p){const owners=hasJil(p)?[p]:[p,other(p)];extraTurns.push(...owners.filter(x=>mode==='bot'||x===SELF));record(`追加ターンを解決順の末尾へ予約：${owners.map(label).join('→')}。${mode==='solo'?'壁打ちの相手分は記録のみ。':''}`);}
 function blinkSelf(id){const s=locate(id);if(!s||!isUnit(s.z))return;const c=s.card,p=s.p;rawMove(s,p,'exile');if(locate(id)?.z!=='exile')return;c.returnReservation={owner:p,at:turn.counts[p]+1};record(`${c.name}を除外し、次の自分のターン開始時の帰還を予約。`);}
 function confirmReturn(expected=operation){const o=operation,s=locate(o?.id);if(o!==expected||o?.kind!=='returnPlace'||!s||s.z!=='exile'||s.card.returnReservation?.owner!==o.p)return fail('帰還予約がありません。');if(summonError(s.card,o.p)){operation=null;record('召喚制限のため今回の帰還は見送り。');pump();return ok('帰還を見送りました。');}const checked=placementInfo(o,s.card);if(!checked.ok)return checked;operation=null;if(checked.replacement)rawMove(locate(checked.replacement.id),o.p,'trash');const c=rawMove(s,o.p,o.slot);delete c.returnReservation;c.faceUp=true;c.speedAttacker=true;unitEntered(c,o.p,true);record(`${c.name}がスピードアタッカーを持って帰還。`);pump();return ok('帰還を確定しました。');}
 function advance(expectedKey=turn.key) {
  const e=interactionError();if(e)return fail(e);if(mustAttackPending())return fail('ブレイズクローが攻撃可能なため攻撃してください。');if(expectedKey!==turn.key||clock()<turn.notBefore)return fail('フェイズ処理中、または以前の操作です。');
  turn.key={};turn.notBefore=clock()+350;
  if(turn.step==='charge')return skipCharge();if(turn.step==='main1')turn.step='attack';else if(turn.step==='attack')turn.step='main2';else if(turn.step==='main2'){
   turn.step='end';enqueue([...PLAYERS.filter(owner=>character(owner)?.key==='celestia'&&character(owner)?.level===4).map(owner=>({kind:'celestiaEnd',p:owner,sourceId:character(owner).id})),...PLAYERS.flatMap(q=>fieldCards(q).filter(c=>c.markerGuard&&!state[q].markers.some(x=>x.hostId===c.id)).map(c=>({kind:'markerEnd',id:c.id}))),...fieldCards(turn.player).flatMap(c=>(c.onEnd||[]).map(e=>({...e,sourceId:c.id}))),{kind:'sideEnd'},{kind:'turnTemporaryCleanup'}],turn.player,null);pump();
  }else if(turn.step==='end'){summonLocks=summonLocks.filter(l=>!(l.p===turn.player&&l.turn<=turn.counts[turn.player]));beginTurn();}else return fail('進行できないフェイズです。');
  checkReversions();return ok(`${STEPS[turn.step]}へ進みました。`);
 }
 function toggleDiscard(){return fail('手札上限はありません。');}
 function confirmDiscard(){return fail('手札上限はありません。');}
 const effectNames={manaLock:'色ごとのマナロック',scrapper:'1ダメージを個別に解決',recoverMana:'マナ回収',opponentToMana:'相手本人が手札と場からマナへ',scramble:'次の赤召喚を軽減しSA付与',fusion:'開始時マナ枚数を参照して使用済みマナ追加',celestiaEnd:'セレスティアLv4の回復と最大体力強化',battleResult:'戦闘勝利と覚醒の判定',lifeSaveOffer:'ライフ支払いによる破壊防止の確認',attackWrap:'攻撃終了時能力',draw:'ドロー',manaAdd:'マナ加速',randomDiscard:'ランダム手札破壊',enemyBounce:'相手カードをバウンス',enemyUnitBounce:'相手クリーチャーをバウンス',destroyTapped:'横向きクリーチャー破壊',healLife:'ライフ回復',resetShield:'シールド再使用可能化',inspectShield:'相手シールドの確認',buffUnit:'クリーチャー強化',vtBounceLock:'5000VTのバウンスと召喚制限',tokens:'トークン生成',manaToken:'マナトークン生成',drawIfManaMax:'マナ枚数による追加ドロー判定',revealBlue:'上4枚公開と青カード獲得',millRecover:'墓地送りと回収',characterStart:'現在レベルのターン開始時能力',cardStart:'カードのターン開始時能力',sideEnd:'終了時の覚醒判定',reorder:'山札の並び替え',scry:'占術',optionalDraw:'任意ドロー',optionalEffect:'任意効果',inspectDiscard:'手札確認と手札破壊',searchSpell:'山札の呪文検索',extraTurns:'追加ターン',wipe:'全体除去',wipeUnits:'クリーチャー全体除去',untapMana:'マナのアンタップ',bounce:'バウンス',trap:'破壊とマナ加速',mother:'母なる大地',viceOffer:'バイス・チャージャーの使用機会',handDiscard:'手札の選択破棄',opponentDiscard:'相手が手札を選んで破棄'};
 function enqueue(effects,p,sourceId,targetId=null){queue.unshift(...effects.map(effect=>({...JSON.parse(JSON.stringify(effect)),p:effect.p||p,sourceId:effect.sourceId??sourceId,targetId})));}
 function characterLevelData(c,level=c?.level){const common=Catalog.characterLevels[level];return c?.characterEffects?{...common,effects:c.characterEffects[level]||[],text:c.levelTexts?.[level]||c.text}:common;}
 function justDiverActive(c){const s=locate(c.id),until=c.justDiverUntil;return !!(s&&isUnit(s.z)&&until&&s.p===until.owner&&turn.counts[until.owner]<until.turn);}
 function targetProtected(c,p){const s=locate(c.id);return s&&s.p!==p&&(justDiverActive(c)||c.untargetable||c.aurelia&&attack(c,s.p)+c.maxHealth>=10);}
 function buff(c,a,h){c.statBonus={attack:(c.statBonus?.attack||0)+a,health:(c.statBonus?.health||0)+h};c.attack+=a;c.maxHealth+=h;c.health+=h;trace('buff','《'+c.name+'》を+'+a+'/+'+h+'。',{card:publicRef(c,locate(c.id)?.z)},locate(c.id)?.p);}
 function damageUnit(c,amount,p){const s=locate(c.id);if(!s)return;if(!isUnit(s.z)){record(c.name+'へ'+amount+'ダメージ処理（体力を持たないため破壊判定なし）。');return;}const before=c.health;c.health-=amount;trace('unitDamage','《'+c.name+'》へ'+amount+'ダメージ。',{sourcePlayer:p,card:publicRef(c,s.z),beforeHealth:before,afterHealth:c.health});if(c.health<=0)destroyUnit(c.id,'ダメージ');refreshDerived();}
 function starterCandidates(o=operation){if(!o)return [];const p=o.p,q=other(p),enemy=[...fieldCards(q),...state[q].markers.map(c=>({id:c.id,origin:q,name:'裏向きマーカー',type:'マーカー',faceUp:false}))].filter(c=>!targetProtected(c,p));if(o.choice==='shieldTap')return enemy.filter(c=>c.type==='通常'&&!(o.excluded||[]).includes(c.id));if(o.choice==='shieldWeaken')return enemy.filter(c=>c.type==='通常');if(o.choice==='shieldBounce')return PLAYERS.flatMap(owner=>fieldCards(owner).filter(c=>c.type==='通常'&&!targetProtected(c,p)&&!c.bounceImmune));if(o.choice==='panzer')return state[p].hand.filter(c=>c.shieldEntry&&!summonError(c,p));if(o.choice==='scrapper')return enemy.filter(c=>['通常','設置物'].includes(c.type));if(o.choice==='redFree')return state[p].hand.filter(c=>c.type==='通常'&&!summonError(c,p));if(['discardDamage','discardDestroy'].includes(o.choice))return state[p].hand;if(o.choice==='invasion'){const a=locate(o.attackerId);return !a||!isUnit(a.z)||sideSpent(p)?[]:state[p].extra.filter(c=>!c.used&&c.parallelInvasion&&a.card.cost&&Mana.total(a.card.cost)>=c.parallelInvasion.minimumCost);}if(o.choice==='damageChoice')return [...enemy.filter(c=>c.type==='通常'),{id:'player:'+q,name:label(q),type:'プレイヤー',owner:q}];if(['enemyDamage','destroyUnitTarget','enemyUnitBounce'].includes(o.choice))return enemy.filter(c=>c.type==='通常');if(o.choice==='unitBounce')return PLAYERS.flatMap(owner=>fieldCards(owner).filter(c=>c.type==='通常'&&!targetProtected(c,p)&&!c.bounceImmune));if(o.choice==='destroyEnemyField')return enemy.filter(c=>['通常','設置物','マーカー'].includes(c.type));return [];}
 function starterChoice(choice,p,sourceId,extra={}){const o={kind:'starterChoice',choice,p,sourceId,...extra};if(starterCandidates(o).length)operation=o;else record('合法な対象がないため、この処理を省略。');}
 function resolveStarter(id=null,expected=operation){const o=operation;if(o!==expected||o?.kind!=='starterChoice')return fail('以前の選択です。');const c=starterCandidates(o).find(c=>c.id===id);if(!c&&!(id===null&&['invasion','panzer','shieldTap'].includes(o.choice)))return fail('合法な候補を選んでください。');operation=null;if(!c){pump();return ok('侵略を見送り。');}if(o.choice==='scrapper'){if(o.remaining>1)enqueue([{kind:'scrapper',remaining:o.remaining-1}],o.p,o.sourceId);damageUnit(c,1,o.p);}else if(o.choice==='shieldTap'){c.rest=true;if(o.remaining>1)enqueue([{kind:'shieldTap',remaining:o.remaining-1,excluded:[...(o.excluded||[]),c.id]}],o.p,o.sourceId);}else if(o.choice==='shieldWeaken')c.attackZero={until:o.p};else if(o.choice==='shieldBounce')rawMove(locate(c.id),locate(c.id).p,'hand');else if(o.choice==='panzer'){operation={kind:'sideFreePlace',p:o.p,id:c.id,slot:null,replacedId:null};return ok('タップ登場の配置先を選択。');}else if(o.choice==='damageChoice'&&c.type==='プレイヤー')loseLife(c.owner,o.amount,'魔力弾');else if(['damageChoice','enemyDamage'].includes(o.choice))damageUnit(c,o.amount,o.p);else if(['destroyUnitTarget','destroyEnemyField'].includes(o.choice)){if(c.type==='通常')destroyUnit(c.id,'カード効果');else rawMove(locate(c.id),other(o.p),'trash');}else if(['unitBounce','enemyUnitBounce'].includes(o.choice))rawMove(locate(c.id),locate(c.id).p,'hand');else if(['discardDamage','discardDestroy'].includes(o.choice)){discardBy(c.id,o.p);enqueue([{kind:o.choice==='discardDamage'?'damagePlayer':'destroyUnitTarget',amount:o.amount}],o.p,o.sourceId);}else if(o.choice==='redFree'){operation={kind:'sideFreePlace',p:o.p,id:c.id,slot:null,replacedId:null,redFree:true};return ok('無料登場の配置先を選択。');}else if(o.choice==='invasion'){const base=locate(o.attackerId);if(!base||!isUnit(base.z)||base.card.cost&&Mana.total(base.card.cost)<c.parallelInvasion.minimumCost||sideSpent(o.p))return fail('侵略条件が変わりました。');const z=base.z;state[o.p][z].splice(base.index,1);const top=rawMove(locate(c.id),o.p,z);top.under=[...(base.card.under||[]),base.card];base.card.under=[];sideUse[o.p]=turn.counts[o.p];top.used=true;unitEntered(top,o.p);top.rest=true;top.sick=false;queue=queue.map(e=>e.kind==='attackContinue'&&e.id===o.attackerId?{...e,id:top.id}:e);record('パラレル侵略で進化し、元の攻撃を継続。');}refreshDerived();pump();return ok('選択した効果を解決しました。');}
 function beginCharacterAbility(p){const c=character(p);if(c?.key!=='redCaptain'||c.level!==4||status!=='ready'||p!==turn.player||operation||result||c.activeTurn===turn.counts[p]||fieldCards(p).filter(c=>c.type==='通常').length>=7||!state[p].hand.some(c=>c.type==='通常'&&!summonError(c,p)))return fail('現在Lv4能力を使用できません。');c.activeTurn=turn.counts[p];enqueue([{kind:'redFree'}],p,c.id);pump();return ok('Lv4能力を使用しました。');}
 function scryMove(id,destination,delta=0){const o=operation;if(o?.kind!=='scryMany'||!o.ids.includes(id)||!['top','bottom'].includes(destination))return fail('確認中のカードを選んでください。');const old=o.top.includes(id)?'top':'bottom';let i=o[old].indexOf(id);if(old!==destination){o[old].splice(i,1);o[destination].push(id);}else{const j=i+delta;if(j>=0&&j<o[old].length)[o[old][i],o[old][j]]=[o[old][j],o[old][i]];}return ok('占術の配置を変更しました。');}
 function confirmScry(expected=operation){const o=operation;if(o!==expected||o?.kind!=='scryMany'||o.ids.some((id,i)=>state[o.p].main[i]?.id!==id)||new Set([...o.top,...o.bottom]).size!==o.ids.length)return fail('確認中の山札が変わりました。');const a=state[o.p].main.splice(0,o.ids.length),map=new Map(a.map(c=>[c.id,c]));state[o.p].main.unshift(...o.top.map(id=>map.get(id)));state[o.p].main.push(...o.bottom.map(id=>map.get(id)));operation=null;record('占術を確定：上'+o.top.length+'枚・下'+o.bottom.length+'枚（内容非公開）。');pump();return ok('占術を解決しました。');}
  function expansionCandidates(o=operation){if(!o)return [];const p=o.p,q=other(p);if(o.choice==='lockMana')return state[q].energy.filter(c=>!c.rest&&!c.manaLock&&Mana.hasColor(c,o.color));if(['destroyMana','recoverMana'].includes(o.choice))return state[p].energy;if(o.choice==='gigaMana')return [...state[p].hand,...fieldCards(p).filter(c=>c.type==='通常')];if(o.choice==='burnShield')return state[q].shields.filter(c=>!c.faceUp).map(c=>({id:c.id,name:'裏向きシールド',type:'シールドカード',faceUp:false}));if(['celestiaBuff','celestiaHeal'].includes(o.choice))return fieldCards(p).filter(c=>c.type==='通常');if(o.choice==='lifeSave')return locate(o.id)&&isUnit(locate(o.id).z)?[locate(o.id).card]:[];return [];}
 function expansionChoice(choice,p,sourceId,extra={}){const o={kind:'expansionChoice',choice,p,sourceId,...extra};if(expansionCandidates(o).length)operation=o;}
 function resolveExpansion(id=null,expected=operation){const o=operation;if(o!==expected||o?.kind!=='expansionChoice')return fail('以前の選択です。');if(o.choice==='lifeSave'){const s=locate(o.id);if(id==='use'&&life[o.p]<=5)return fail('ライフを0以下にする支払いはできません。');operation=null;if(!s||!isUnit(s.z)){pump();return ok('対象は場を離れました。');}delete s.card.pendingDestruction;if(id==='use'){if(life[o.p]<=5)return fail('ライフを0以下にする支払いはできません。');s.card.health=s.card.maxHealth;loseLife(o.p,5,'ライフを失う');}else destroyUnit(o.id,o.reason,true);pump();return ok('破壊置換を解決。');}
  const c=expansionCandidates(o).find(c=>c.id===id);if(!c)return fail('合法な候補を選んでください。');operation=null;
  if(o.choice==='lockMana'){c.rest=true;c.manaLock={owner:other(o.p),skipAt:turn.counts[other(o.p)]+1};record(c.name+'を次の開始時までマナロック。');}
  if(o.choice==='destroyMana')rawMove(locate(id),o.p,'trash');
  if(o.choice==='recoverMana')rawMove(locate(id),o.p,'hand');
  if(o.choice==='gigaMana'){const s=locate(id);rawMove(s,o.p,'energy');const moved=locate(id);if(moved?.z==='energy'){moved.card.faceUp=true;moved.card.rest=false;}}
  if(o.choice==='burnShield'){const shield=state[other(o.p)].shields.find(x=>x.id===id);shield.faceUp=true;record('ボルメテウスによりシールド1枚を使用せず表向きへ。');if(state[other(o.p)].energy.filter(c=>!c.manaToken&&Mana.hasColor(c,'緑')).length>=5)enqueue([{kind:'panzerOffer'}],other(o.p),o.sourceId);}
  if(o.choice==='celestiaBuff')buff(c,2,0);
  if(o.choice==='celestiaHeal'){healUnit(c.id,Math.max(0,c.maxHealth-c.health));buff(c,0,1);}
  if(o.remaining>1)enqueue([{kind:'expansionNext',choice:o.choice,remaining:o.remaining-1}],o.p,o.sourceId);
  refreshDerived();pump();return ok('選択した処理を解決しました。');
 }
 function hasSpeed(c,p=null){p=p||locate(c.id)?.p||c.origin;return !!(c.speedAttacker||c.turnSA||p&&fieldCards(p).some(x=>x.speedAura&&!x.abilitiesDisabled));}
 function untapUnit(c,p){const was=c.rest;c.rest=false;if(was&&c.awakenOnUntap&&!c.abilitiesDisabled)applyForm(c,p,c.awakenOnUntap);}
 function mustAttackPending(){return status==='ready'&&turn.step==='attack'&&!operation&&fieldCards(turn.player).some(c=>c.mustAttack&&!attackError(c.id));}
 function beginLoot(id){const s=locate(id);if(!s||!isUnit(s.z)||!s.card.lootAbility||s.card.rest||s.card.sick||mainError(s.p)||!state[s.p].hand.length)return fail('召喚酔い・タップ状態・手札の有無を確認してください。');operation={kind:'lootCost',p:s.p,id};return ok('コストとして捨てる手札1枚を選択。');}
 function resolveLoot(id){const o=operation;if(o?.kind!=='lootCost')return fail('起動能力の支払い中ではありません。');const s=locate(o.id),c=state[o.p].hand.find(c=>c.id===id);if(!s||!isUnit(s.z)||s.card.rest||s.card.sick||!c)return fail('起動コストを支払えません。');operation=null;s.card.rest=true;discardBy(id,o.p);enqueue([{kind:'draw',count:1}],o.p,o.id);pump();return ok('タップと手札破棄を支払い1ドロー。');}
 function attackWrap(id,p,defender,hit=false){enqueue([{kind:'attackWrap',id,defender,hit}],p,id);}
 function expansionEffect(e){const {kind,p,sourceId}=e;
  if(kind==='manaLock'){const colors=Mana.colors.filter(k=>state[other(p)].energy.some(c=>Mana.hasColor(c,k)));enqueue(colors.map(color=>({kind:'lockOne',color})),p,sourceId);}
  else if(kind==='lockOne')expansionChoice('lockMana',p,sourceId,{color:e.color});
  else if(kind==='temporarySymbols'){const c=locate(sourceId)?.card;if(c)c.turnSymbols={...(c.turnSymbols||{}),[e.color]:e.count};}
  else if(kind==='eachDestroyMana')enqueue(PLAYERS.map(owner=>({kind:'ownDestroyMana',p:owner})),p,sourceId);
  else if(kind==='ownDestroyMana')expansionChoice('destroyMana',p,sourceId);
  else if(kind==='recoverMana')expansionChoice('recoverMana',p,sourceId,{remaining:Math.min(e.count,state[p].energy.length)});
  else if(kind==='opponentToMana')expansionChoice('gigaMana',other(p),sourceId,{remaining:Math.min(e.count,state[other(p)].hand.length+fieldCards(other(p)).filter(c=>c.type==='通常').length)});
  else if(kind==='expansionNext')expansionChoice(e.choice,p,sourceId,{remaining:e.remaining});
  else if(kind==='selfDamage')loseLife(p,e.amount,'アパッチの登場時ダメージ');
  else if(kind==='scrapper'){if(e.remaining>0)starterChoice('scrapper',p,sourceId,{remaining:e.remaining});}
  else if(kind==='scramble'){turn.scramble={p,sequence:turn.sequence};record('次の赤クリーチャー召喚に5軽減とこのターンSA。');}
  else if(kind==='fusion'){enqueue([{kind:'manaAdd',count:manaCount(p),rest:true}],p,sourceId);}
  else if(kind==='healHand')healLife(p,state[p].hand.length);
  else if(kind==='celestiaBuff')expansionChoice('celestiaBuff',p,sourceId);
  else if(kind==='celestiaEnd')expansionChoice('celestiaHeal',p,sourceId);
  else if(kind==='lifeSaveOffer'){const s=locate(e.id);if(s&&isUnit(s.z)){if(life[p]>5)expansionChoice('lifeSave',p,sourceId,{id:e.id,reason:e.reason});else {delete s.card.pendingDestruction;destroyUnit(e.id,e.reason,true);}}}
  else if(kind==='battleResult'){for(const [id,owner,won,survived] of [[e.a,e.ap,battleDeaths.has(e.combatId+':'+e.b),e.aSurvived],[e.b,e.bp,battleDeaths.has(e.combatId+':'+e.a),e.bSurvived]]){const loc=locate(id),c=loc?.card,alive=loc&&isUnit(loc.z);if(won){if(c)enqueue(c.onDefeat||[],owner,id);if(survived&&owner===turn.player){turn.battleWins=turn.battleWins||{};turn.battleWins[owner]=(turn.battleWins[owner]||0)+1;}if(alive&&c){if(c.untapOnWin)untapUnit(c,owner);if(c.awakenOnKill&&!c.awakened){applyForm(c,owner,c.awakenOnKill);enqueue([{kind:'destroyEnemyField'}],owner,id);}}if(owner===turn.player&&(turn.battleWins?.[owner]||0)>=3)for(const d of fieldCards(owner))if(d.teamWinsAwaken&&!d.awakened)applyForm(d,owner,d.teamWinsAwaken);}}}

  else if(kind==='attackWrap'){const s=locate(e.id);activeCombat=null;if(e.hit&&s?.card.shieldSilence)expansionChoice('burnShield',p,sourceId);if(s&&isUnit(s.z)&&s.card.redUntap&&state[p].energy.length>0&&state[p].energy.every(c=>Mana.hasColor(c,'赤')))untapUnit(s.card,p);}
  else if(kind==='turnTemporaryCleanup'){for(const owner of PLAYERS)for(const c of fieldCards(owner)){delete c.turnAttackBonus;delete c.turnSymbols;delete c.turnSA;}delete turn.scramble;}
  else return false;return true;
 }

 function starterEffect(e){const {kind,p,sourceId}=e;
 if(kind==='justDiver'){const s=locate(sourceId);if(s&&isUnit(s.z)&&s.card.justDiverGeneration===e.generation){s.card.justDiverUntil={owner:p,turn:turn.counts[p]+1};trace('justDiver','《'+s.card.name+'》のジャストダイバーが解決。次の自分のターン開始まで相手に選ばれず、攻撃されない。',{card:publicRef(s.card,s.z),until:s.card.justDiverUntil},p);}return true;}
 if(kind==='fillGuards'){for(const z of unitSlots(p).filter(z=>!state[p][z.id].length)){if(summonError(Catalog.cards.imperialGuard,p))break;const c=fromDefinition('imperialGuard',p);state[p][z.id].push(c);unitEntered(c,p);}return true;}
 if(kind==='guardDeath'){const targets=[...fieldCards(other(p)).filter(c=>c.type==='通常'),null],c=targets[Math.min(targets.length-1,Math.floor(random()*targets.length))];if(c)damageUnit(c,1,p);else loseLife(other(p),1,'近衛兵の死亡時ダメージ');return true;}
 if(kind==='attachMarker'){const host=locate(sourceId);if(host&&isUnit(host.z)&&requireMain(p,e)){const c=state[p].main.shift();c.hostId=sourceId;c.faceUp=false;state[p].markers.push(c);record('山札上1枚を裏向きマーカーとして付与。');}return true;}
 if(kind==='markerEnd'){const c=locate(e.id);if(c&&isUnit(c.z)&&!c.card.abilitiesDisabled&&!state[c.p].markers.some(x=>x.hostId===e.id))destroyUnit(e.id,'マーカーなしの終了時');return true;}
 if(kind==='panzerOffer'){if(state[p].energy.filter(x=>!x.manaToken&&Mana.producedColors(x).includes('緑')).length>=5)starterChoice('panzer',p,sourceId);return true;}
 if(kind==='shieldTap'){starterChoice('shieldTap',p,sourceId,{remaining:e.remaining,excluded:e.excluded||[]});return true;}
 if(kind==='lethalCheck'){if(life[p]<=0)finish(other(p),'起死回生後もライフ0以下');return true;}
 if(kind==='newShield'){const q=other(p),event=e.event;if(e.effect==='negate'){for(const c of fieldCards(q).filter(c=>c.type==='通常'))c.rest=true;const a=locate(event.attackerId);if(a)a.card.canceledAttack=true;}else if(e.effect==='firstAid')healLife(p,event.amount);else if(e.effect==='counterArrow')loseLife(q,3,'反撃の一矢');else if(e.effect==='desperate'){enqueue([{kind:'loseLifeCost'},{kind:'destroyAttacker',attackerId:event.attackerId}],p,sourceId);}else if(e.effect==='tapTwo')starterChoice('shieldTap',p,sourceId,{remaining:2});else if(e.effect==='weaken')starterChoice('shieldWeaken',p,sourceId);else if(e.effect==='evacuate')starterChoice('shieldBounce',p,sourceId);return true;}
 if(kind==='loseLifeCost'){loseLife(p,2,'ライフを失う');return true;}
if(kind==='scryMany'){const ids=state[p].main.slice(0,e.count).map(c=>c.id);if(ids.length)operation={kind:'scryMany',p,sourceId,ids,top:[...ids],bottom:[]};}
 else if(kind==='unitBounce'&&e.targetId){const c=targetOptions(e,p).find(c=>c.id===e.targetId);if(c)rawMove(locate(c.id),locate(c.id).p,'hand');else record('バウンス対象が不正になったため不発。');}
 else if(['unitBounce','enemyDamage','damageChoice','destroyUnitTarget','destroyEnemyField','redFree'].includes(kind))starterChoice(kind,p,sourceId,{amount:e.amount,targetId:e.targetId});
 else if(kind==='damagePlayer')loseLife(other(p),e.amount,'カード・キャラクター効果');
 else if(kind==='discardThenDamage'||kind==='discardThenDestroy')starterChoice(kind==='discardThenDamage'?'discardDamage':'discardDestroy',p,sourceId,{amount:e.amount});
 else if(kind==='destroyBlockers'){const ids=PLAYERS.flatMap(q=>fieldCards(q).filter(c=>c.abilities?.includes('ブロッカー')).map(c=>c.id));for(const id of ids)destroyUnit(id,'クリムゾン・ワイバーン');}
 else if(kind==='bounceAll'){const ids=PLAYERS.flatMap(q=>fieldCards(q).filter(c=>c.type==='通常').map(c=>c.id));for(const id of ids){const s=locate(id);if(s)rawMove(s,s.p,'hand');}}
 else if(kind==='returnSelf'){const s=locate(sourceId);if(s&&isUnit(s.z))rawMove(s,s.p,'hand');}
 else if(kind==='sageBuff'){for(const c of fieldCards(p).filter(c=>c.type==='通常'&&c.id!==sourceId))buff(c,2,2);}
 else if(kind==='bannerAll'){for(const c of fieldCards(p).filter(c=>c.type==='通常'&&Mana.hasColor(c,'赤')))buff(c,1,0);}
 else if(kind==='bannerOne'){const c=locate(e.id)?.card;if(c&&isUnit(locate(c.id).z)&&Mana.hasColor(c,'赤'))buff(c,e.amount,0);}
 else if(kind==='invasionOffer'){const s=locate(e.id);if(s&&isUnit(s.z)&&s.card.cost&&!sideSpent(p)&&state[p].extra.some(c=>!c.used&&c.parallelInvasion&&Mana.total(s.card.cost)>=c.parallelInvasion.minimumCost))starterChoice('invasion',p,sourceId,{attackerId:e.id});}
 else if(kind==='destroyAttacker')destroyUnit(e.attackerId,'リアクティブアーマー');
 else if(kind==='priorityAttack'){openPriority({type:'queue'},other(p));}
 else if(kind==='resumeStack'){queue=e.pending;if(e.resume)openPriority(e.resume,other(e.controller));else if(stack.length)responseWindow();}
 else return false;return true;}
 function legalCounterFrames(){return stack.filter(f=>!f.canceled&&locate(f.cardId)?.card.type==='呪文'&&!locate(f.cardId)?.card.uncounterable);}
 function instantCards(p){return state[p].hand.filter(c=>c.instant&&planPayment(effectiveCost(c,p),p)&&(!c.responseOnly||legalCounterFrames().length)&&(!c.onUse?.some(e=>e.kind==='unitBounce')||starterCandidates({p,choice:'unitBounce'}).length));}
 function openPriority(context,p){if(result)return;const a=instantCards(p),b=instantCards(other(p));if(!a.length&&!b.length){continuePriority(context);return;}const f=legalCounterFrames().at(-1);operation={kind:'response',p:a.length?p:other(p),passes:a.length?0:1,context,frameId:f?.id,cardId:context.cardId||f?.cardId,reason:context.type};trace('priority','インスタントの応答受付。',{context:context.type},operation.p);}
 function continuePriority(context){operation=null;if(context.type==='spell')resolveStack();else if(context.type==='block'){operation=context.combat;const a=locate(context.combat.id),b=locate(context.blockerId);if(!a||!isUnit(a.z)||!b||!isUnit(b.z)){operation=null;attackWrap(context.combat.id,context.combat.p,context.combat.defender);trace('attackEnd','ブロック宣言後に戦闘相手が場を離れたため攻撃終了。本体0。',{playerDamage:0});pump();}else resolveAttack(context.blockerId,context.combat,true);}else pump();}
 function selectCounterTarget(id){if(operation?.kind!=='response'||!legalCounterFrames().some(f=>f.id===id))return fail('スタック上の呪文を選んでください。');operation.frameId=id;operation.cardId=stack.find(f=>f.id===id).cardId;return ok('打ち消す呪文を選択しました。');}

 function pump(){
  while(queue.length&&!operation&&!result){
   const effect=queue.shift(),p=effect.p,sourceId=effect.sourceId;trace('effect',(sourceId&&refId(sourceId).name?'《'+refId(sourceId).name+'》の能力：':'能力・ターン処理：')+(effectNames[effect.kind]||'処理を続行')+'。',{detailOnly:!effectNames[effect.kind],effectKind:effect.kind,source:sourceId?refId(sourceId):null,triggerName:effect.triggerName,count:effect.count,condition:'実行キューに到達'},p);
   if(!effect.priorityDone&&sourceId&&!locate(sourceId)?.card.resolving&&!['cleanup','resumeStack','priorityAttack','attackContinue','revolution','invasionOffer'].includes(effect.kind)&&(instantCards(other(p)).length||instantCards(p).length)){queue.unshift({...effect,priorityDone:true});openPriority({type:'queue'},other(p));if(operation)break;continue;}
   if(expansionEffect(effect)){}
   else if(starterEffect(effect)){}
   else if(takeEffect(effect)){}
   else if(sideEffect(effect)){}
   else if(effect.kind==='startDraw'){startDraw(p);}
   else if(effect.kind==='return'){const s=locate(effect.id);if(s?.z==='exile'&&s.card.returnReservation?.owner===p&&!summonError(s.card,p)){operation={kind:'returnPlace',p,id:effect.id,slot:null,replacedId:null};break;}}
   else if(effect.kind==='shieldWindow'){if(!closedShieldTimings.has(effect.timing)){const ids=effect.ids.filter(id=>state[p].shields.some(c=>c.id===id&&!c.faceUp));if(ids.length){operation={kind:'shieldWindow',p,timing:effect.timing,event:effect.event,ids};break;}}}
   else if(effect.kind==='healLife'){healLife(p,effect.count);}
   else if(effect.kind==='loseLife'){loseLife(p,effect.count);}
   else if(effect.kind==='manaToken'){createManaToken(p,effect.color);}
   else if(effect.kind==='chargePhase'){turn.step='charge';trace('phase','マナチャージフェイズ。');record('手札を1枚チャージするか、見送ってメイン1へ。');}
   else if(effect.kind==='resetShield'||effect.kind==='inspectShield'){const owner=effect.kind==='resetShield'?p:other(p),candidates=state[owner].shields.filter(c=>effect.kind==='resetShield'?c.faceUp:!c.faceUp);if(candidates.length){operation={kind:effect.kind,p};break;}}
   else if(effect.kind==='chooseFate'){operation={kind:'fateChoice',p,sourceId};break;}
   else if(effect.kind==='drawIfJil'){if(hasJil(p))enqueue([{kind:'draw',count:effect.count}],p,sourceId);}
   else if(effect.kind==='extraTurns'){grantExtraTurns(p);}
   else if(effect.kind==='blinkSelf'){blinkSelf(sourceId);}
   else if(effect.kind==='wipeUnits'){for(const owner of PLAYERS)for(const c of fieldCards(owner).filter(c=>c.type==='通常'))destroyUnit(c.id,'全体除去');record('両者のユニットをすべてトラッシュへ。設置物・マナは残ります。');}
   else if(effect.kind==='handDiscard'){if(state[p].hand.length){operation={kind:'handPick',p,effect:effect.kind};break;}record('手札に選べるカードがないため省略。');}
   else if(effect.kind==='optionalEffect'){operation={kind:'optionalEffect',p,label:effect.label,effects:effect.effects,sourceId};break;}
   else if(effect.kind==='untapMana'){if(state[p].energy.length>0){operation={kind:'untapMana',p,max:effect.count,ids:[]};break;}}
   else if(effect.kind==='attackContinue'){continueAttack(effect.id,effect.target,effect.combatId);}
   else if(effect.kind==='drawIfManaMax'){if(manaCount(p)<=effect.max)enqueue([{kind:'draw',count:effect.count}],p,sourceId);}
   else if(['trap','mother','bounce','topUnit','buffUnit'].includes(effect.kind)){
    const targetPlayer=other(p),targetPlayers=effect.kind==='buffUnit'?[p]:['mother','bounce'].includes(effect.kind)?PLAYERS:[targetPlayer],candidates=targetOptions(effect,p);
    if(effect.kind==='mother'&&effect.targetId&&!candidates.some(c=>c.id===effect.targetId)){record('母なる大地：対象が不正になったため不発。');continue;}if(candidates.length){operation={kind:'effectTarget',p,targetPlayer,targetPlayers,effect:effect.kind,sourceId,selectedId:null};if(effect.targetId&&candidates.some(c=>c.id===effect.targetId))resolveEffectTarget(effect.targetId);else break;}
    else record('対象がないため、後半を含め効果を省略。');
   }else if(effect.kind==='freeUnit'){
    operation={kind:'freeUnit',p,owner:effect.owner||p,sourceId};if(!freeUnitCandidates().length){operation=null;record(`${label(p)}：マナ枚数以下の手札ユニットなし。無料登場を省略。`);}
    else break;
   }else if(effect.kind==='wipe'){
    for(const owner of PLAYERS)for(const c of [...fieldCards(owner)])if(c.id!==sourceId&&(c.type==='通常'||c.type==='設置物')){if(c.type==='通常')destroyUnit(c.id,'全体除去');else rawMove(locate(c.id),owner,'trash');}
    refreshDerived();record('本人以外の両者のユニット・設置物をトラッシュへ送りました。');
   }else if(effect.kind==='reorder'||effect.kind==='scry'){
    if(!requireMain(p,effect))continue;const a=state[p].main.slice(0,effect.count);if(a.length){operation={kind:'reorder',p,sourceId,ids:a.map(c=>c.id),order:a.map(c=>c.id),scry:effect.kind==='scry'};break;}
   }else if(effect.kind==='searchSpell'){
    if(!requireMain(p,effect))continue;const candidates=state[p].main.filter(c=>c.type==='呪文'&&c.cost&&Mana.total(c.cost)<=effect.max&&!c.responseOnly);if(candidates.length){operation={kind:'searchSpell',p,sourceId,max:effect.max};break;}record('使用可能な4コスト以下の呪文なし。');
   }else if(effect.kind==='tokens'){
    if(effect.count>0){if(summonError(Catalog.cards[effect.tokenKey||'snowToken'],p)){record('召喚制限によりトークン生成だけを省略。');continue;}operation={kind:'tokens',p,remaining:effect.count,sourceId,tokenKey:effect.tokenKey||'snowToken'};break;}
   }else if(effect.kind==='inspectDiscard'){
    operation={kind:'inspectHand',p,targetPlayer:other(p),max:effect.max};break;
   }else if(effect.kind==='randomDiscard'){
    const candidates=[...state[other(p)].hand];let n=0;for(let i=0;i<effect.count&&candidates.length;i++){const c=candidates.splice(Math.floor(random()*candidates.length),1)[0];discardBy(c.id,p);n++;}record(`${label(other(p))}がランダムに${n}枚捨てました。`);
   }else if(effect.kind==='optionalDraw'){operation={kind:'optionalDraw',p,count:effect.count};break;
   }else if(effect.kind==='endCheck'){/* No hand size limit. */
   }else if(effect.kind==='cleanup'){
    const s=locate(sourceId);if(s&&s.z==='check'){s.card.resolving=false;cleanupUsed(s);record(`${s.card.name}の解決完了：${locate(s.card.id)?ZONES.find(z=>z.id===locate(s.card.id).z).name:'使用後消滅'}。`);}
   }
  }
  refreshDerived();checkReversions();if(queue.length&&!operation&&!result)pump();
 }
 function legacyTargetOptions(effect,p){if(['enemyBounce','enemyUnitBounce','destroyTapped'].includes(effect.kind))return fieldCards(other(p)).filter(c=>(effect.kind==='enemyBounce'?['通常','設置物'].includes(c.type):c.type==='通常')&&(effect.kind!=='destroyTapped'||c.rest)&&!c.untargetable&&!(effect.kind.includes('Bounce')&&c.bounceImmune));if(!['mother','bounce','trap','topUnit','buffUnit'].includes(effect.kind))return [];const owners=effect.kind==='buffUnit'?[p]:['mother','bounce'].includes(effect.kind)?PLAYERS:[other(p)];return owners.flatMap(owner=>unitSlots(owner).flatMap(z=>state[owner][z.id]).filter(c=>c.type==='通常').concat(effect.kind==='bounce'?state[owner].structures.filter(c=>c.type==='設置物'):[]));}
 function targetOptions(effect,p){if(['enemyBounce','bounce'].includes(effect.kind)){const owners=effect.kind==='bounce'?PLAYERS:[other(p)];return [...legacyTargetOptions(effect,p),...owners.flatMap(q=>state[q].markers.map(c=>({id:c.id,name:'裏向きマーカー',type:'マーカー',origin:q})))].filter(c=>!targetProtected(c,p));}if(effect.kind==='unitBounce')return PLAYERS.flatMap(q=>fieldCards(q).filter(c=>c.type==='通常'&&!targetProtected(c,p)&&!c.bounceImmune));return legacyTargetOptions(effect,p).filter(c=>!targetProtected(c,p));}
 function effectTargets(){const o=operation;return o?.kind==='effectTarget'?targetOptions({kind:o.effect},o.p):[];}
 function resolveEffectTarget(id,expected=operation){
  const o=operation;if(o!==expected||o?.kind!=='effectTarget'||!effectTargets().some(c=>c.id===id))return fail('有効な対象を1枚選んでください。マナは対象外です。');
  const source=locate(id),owner=source.p,c=source.card;operation=null;if(['enemyBounce','enemyUnitBounce','destroyTapped'].includes(o.effect)){if(o.effect==='destroyTapped')destroyUnit(c.id,'ガンヴィート');else rawMove(source,owner,'hand');pump();return ok('サイド能力の対象を解決。');}if(o.effect==='buffUnit'){c.statBonus={attack:(c.statBonus?.attack||0)+2,health:(c.statBonus?.health||0)+2};c.attack+=2;c.maxHealth+=2;c.health+=2;record(`${c.name}を＋2/＋2。`);pump();return ok('強化しました。');}if(o.effect==='mother'){rawMove(source,owner,'energy');if(locate(c.id)?.z==='energy'){c.faceUp=true;enqueue([{kind:'freeUnit',owner}],o.p,o.sourceId);}}else{if(o.effect==='trap')destroyUnit(c.id,o.effect);else rawMove(source,owner,o.effect==='bounce'?'hand':o.effect==='topUnit'?'main':'trash',o.effect!=='topUnit');if(o.effect==='trap')enqueue([{kind:'manaAdd',count:1}],owner,o.sourceId);}
  record(`${c.name}の移動処理を解決。`);pump();return ok('対象の処理を完了しました。');
 }
 function privateCandidates(){const o=operation;if(!o)return [];if(['reorder','stackOrder'].includes(o.kind))return o.order.map(id=>locate(id)?.card).filter(Boolean);if(o.kind==='searchSpell')return state[o.p].main.filter(c=>c.type==='呪文'&&c.cost&&Mana.total(c.cost)<=o.max&&!c.responseOnly);if(o.kind==='handPick')return state[o.p].hand;if(o.kind==='recoverUnit')return state[o.p].trash.filter(c=>c.type==='通常');if(o.kind==='inspectHand')return state[o.targetPlayer].hand;return [];}
 function reorderCard(id,delta){const o=operation;if(!['reorder','stackOrder'].includes(o?.kind))return fail('並べ替え中ではありません。');const i=o.order.indexOf(id),j=i+delta;if(i<0||j<0||j>=o.order.length)return fail('順番の端です。');[o.order[i],o.order[j]]=[o.order[j],o.order[i]];return ok('上からの順を変更しました。');}
 function confirmOrder(bottom=false,expected=operation){const o=operation;if(o!==expected||!['reorder','stackOrder'].includes(o?.kind))return fail('以前の並べ替えです。');if(o.kind==='stackOrder'){const a=o.order.map(id=>locate(id)?.card);if(a.some(c=>!c))return fail('個体が変わりました。');for(const id of o.order){const src=locate(id);state[src.p][src.z].splice(src.index,1);}state[o.p].main.unshift(...a);}else{if(o.ids.some((id,i)=>state[o.p].main[i]?.id!==id))return fail('確認中の山札が変わりました。');const a=state[o.p].main.splice(0,o.ids.length),ordered=o.order.map(id=>a.find(c=>c.id===id));if(o.scry&&bottom)state[o.p].main.push(...ordered);else state[o.p].main.unshift(...ordered);}operation=null;pump();return ok('順番を確定しました（内容は使用者のみ確認）。');}
 function resolvePrivate(id=null,expected=operation){const o=operation;if(o!==expected||!o)return fail('以前の選択です。');const candidates=privateCandidates();
  if(o.kind==='inspectHand'){const eligible=candidates.filter(c=>c.cost&&Mana.total(c.cost)<=o.max);if(id===null&&eligible.length)return fail('対象があるため1枚選んでください。');if(id!==null&&!eligible.some(c=>c.id===id))return fail('軽減前3コスト以下を選んでください。');operation=null;if(id){const c=locate(id).card;discardBy(id,o.p);record(`${label(o.targetPlayer)}が公開された${c.name}を捨てました。`);}pump();return ok('手札の一時確認を終了しました。');}
  if(!candidates.some(c=>c.id===id))return fail('候補から1枚選んでください。');const source=locate(id),c=source.card;operation=null;
  if(o.kind==='handPick'){rawMove(source,o.p,'trash');record(`${label(o.p)}が手札1枚を選んでトラッシュへ。`);pump();}
  else if(o.kind==='recoverUnit'){rawMove(source,o.p,'hand');c.faceUp=true;record(`${c.name}をトラッシュから手札へ回収。`);pump();}
  else if(o.kind==='searchSpell'){state[o.p].main.splice(source.index,1);state[o.p].check.push(c);shuffleRaw(o.p,'main');prepareFreeUse(locate(id),{p:o.p,method:'アマテラスから無料使用'});}
  return ok('選択を処理しました。');
 }
 function placeToken(slot=null,expected=operation){const o=operation;if(o!==expected||o?.kind!=='tokens')return fail('トークン配置中ではありません。');if(slot===null){operation=null;pump();return ok('残りのトークンを出さずに続行。');}if(!placementOptions(o.p).some(z=>z.id===slot))return fail('配置先を選んでください。');if(summonError(Catalog.cards[o.tokenKey||'snowToken'],o.p)){operation=null;pump();return ok('召喚制限で生成を省略。');}const replacement=state[o.p][slot][0];if(replacement){rawMove(locate(replacement.id),o.p,'trash');if(locate(replacement.id)&&isUnit(locate(replacement.id).z)){operation=null;pump();return ok('上書き対象が離場を防いだためトークン生成を中止。');}}const c=fromDefinition(o.tokenKey||'snowToken',o.p);state[o.p][slot].push(c);operation=null;if(o.remaining>1)queue.unshift({kind:'tokens',p:o.p,count:o.remaining-1,sourceId:o.sourceId,tokenKey:o.tokenKey});unitEntered(c,o.p);record(c.name+'トークン1体が登場。');pump();return ok('トークンを配置しました。');}
 function resolveOptional(use=true,expected=operation){const o=operation;if(o!==expected||!['optionalDraw','optionalEffect'].includes(o?.kind))return fail('終了時ドロー待ちではありません。');operation=null;if(use){if(o.kind==='optionalEffect')enqueue(o.effects,o.p,o.sourceId);else enqueue([{kind:'draw',count:o.count}],o.p,o.sourceId);}record(`${label(o.p)}が終了時ドローを${use?'使用':'省略'}。`);pump();return ok('終了時効果を処理しました。');}
 function freeUnitCandidates(){const o=operation;if(o?.kind!=='freeUnit')return [];const owner=o.owner||o.p;return state[owner].energy.filter(c=>c.type==='通常'&&!c.token&&c.cost&&Mana.total(c.cost)<=manaCount(owner)&&!summonError(c,owner)&&placementOptions(owner,c).length&&(!c.evolution||evolutionBases(owner,c).length));}
 function chooseFreeUnit(id=null,expected=operation){const o=operation;if(o!==expected||o?.kind!=='freeUnit')return fail('この無料登場選択は終了しています。');if(id===null&&freeUnitCandidates().length)return fail('候補があるため必ず登場させてください。');if(id!==null&&!freeUnitCandidates().some(c=>c.id===id))return fail('その持ち主の手札から、マナ枚数以下の軽減前合計コストのユニットを選んでください。');
  operation=null;if(id)operation={kind:'freePlace',p:o.owner||o.p,selector:o.p,id,slot:null,replacedId:null};else{record('無料では出さずに続行。');pump();}return ok('無料登場の選択を更新しました。');
 }
 function confirmFreePlacement(expected=operation){
  const o=operation;if(o!==expected||!['freePlace'].includes(o?.kind)||result)return fail('この配置操作は終了しています。');const s=locate(o.id);if(!s||s.p!==o.p||s.z!=='energy')return fail('対象カードがマナにありません。');if(summonError(s.card,o.p))return fail(summonError(s.card,o.p));if(o.kind==='freePlace'&&(s.card.type!=='通常'||Mana.total(s.card.cost)>manaCount(o.p)))return fail('マナ枚数以下の軽減前合計コストを満たしません。');const checked=placementInfo(o,s.card);if(!checked.ok)return checked;
  operation=null;declareUse(s,{p:o.p,slot:o.slot,replacedId:o.replacedId,baseId:checked.base?.id,method:'母なる大地'});return ok('無料配置を確定しました。');
 }
 function skipFreePlacement(){if(operation?.kind==='freePlace')return fail('母なる大地の登場は強制です。');if(!['freePlace'].includes(operation?.kind))return fail('無料配置ではありません。');operation=null;pump();return ok('配置を取りやめ、カードを手札に残しました。');}
 function attackTargets(id){
  const s=locate(id);if(!s)return [];const c=s.card,enemy=s.p==='p1'?'p2':'p1',units=unitSlots(enemy).flatMap(z=>state[enemy][z.id]).filter(c=>c.type==='通常'&&!c.cannotBeAttacked&&!justDiverActive(c));
  const first=fieldCards(enemy).filter(c=>c.type==='通常'&&c.firstAttackLure&&c.rest&&s.p===turn.player&&(turn.attacks||0)===0);
  const lures=units.filter(c=>c.lure);
  const royal=c.key==='imperialGuard'&&fieldCards(s.p).some(x=>x.guardCommander&&!x.abilitiesDisabled);
  const canUnit=royal||c.machFighter?.duration==='entryTurn'&&c.enteredTurn===turn.counts[s.p]&&s.p===turn.player;
  if(c.sick&&!hasSpeed(c,s.p)&&!canUnit)return [];
  if(first.length)return first.filter(x=>units.includes(x)&&(!c.blockerOnlyAttack||x.abilities?.includes('ブロッカー'))).map(x=>({id:x.id,name:x.name,forced:true}));
  if(c.blockerOnlyAttack)return units.filter(x=>x.abilities?.includes('ブロッカー')).map(x=>({id:x.id,name:x.name}));
  if(lures.length)return lures.map(c=>({id:c.id,name:c.name,forced:true}));
  return [...(!c.sick||hasSpeed(c,s.p)?[{id:'body',name:label(enemy)+'本体'}]:[]),...units.filter(c=>canUnit||c.rest).map(c=>({id:c.id,name:c.name}))];
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
  const s=locate(id);const combatId=++attackSerial;trace('attackDeclared','《'+s.card.name+'》が'+(target==='body'?label(other(s.p)):locate(target)?.card.name)+'へ攻撃宣言。',{combatId,attacker:publicRef(s.card,s.z),declaredTarget:target,targetPlayer:other(s.p)},s.p);activeCombat={id,combatId,p:s.p,defender:other(s.p),silence:!!s.card.shieldSilence};s.card.rest=true;events.push({id:++eventSerial,kind:'attack',p:s.p,attackerId:id,targetId:target,text:s.card.name+'が'+(target==='body'?'相手本体':locate(target)?.card.name)+'へ攻撃'});record(`${s.card.name}が${target==='body'?'相手本体':locate(target)?.card.name}へ攻撃宣言。使用済みにしました。`);
  turn.attacks=(turn.attacks||0)+1;enqueue([{kind:'priorityAttack'},{kind:'invasionOffer',id},{kind:'revolution',id,target},...(s.card.onAttack||[]),{kind:'attackContinue',id,target,combatId}],s.p,id);queueShield(other(s.p),{kind:'attackDeclared',life:life[other(s.p)],attackerId:id,target});pump();return ok('攻撃を宣言しました。');
 }
 function continueAttack(id,target,combatId){const s=locate(id);if(s?.card.canceledAttack){delete s.card.canceledAttack;attackWrap(id,s.p,other(s.p));trace('attackEnd','シールドにより攻撃無効。',{combatId,playerDamage:0});return;}if(!s||!isUnit(s.z)||s.p!==turn.player){attackWrap(id,s?.p||turn.player,other(s?.p||turn.player));trace('attackEnd','攻撃クリーチャーが場を離れたため攻撃終了。本体ダメージ0。',{combatId,playerDamage:0,reason:'attackerLeft'});return;}
  if(target!=='body'){const b=locate(target);if(!b||!isUnit(b.z)||b.p===s.p)return fail('対象ユニットが場にありません。');attackWrap(id,s.p,b.p);battle(s,b,false,combatId);trace('attackEnd','クリーチャーへの攻撃終了。本体ダメージ0。',{combatId,playerDamage:0});pump();return ok('ユニットへの直接攻撃を解決しました。');}
  operation={kind:'combat',id,p:s.p,defender:other(s.p),blockerId:null,combatId,declaredTarget:target};if(mode==='bot'&&operation.defender==='p1'&&!blockers('p1').length)return resolveAttack(null,operation);return ok('防御側がブロックするか選択してください。');
 }
 function blockers(p){if(operation?.kind==='combat'&&locate(operation.id)?.card.unblockable)return [];return unitSlots(p).flatMap(z=>state[p][z.id]).filter(c=>c.type==='通常'&&!c.rest&&c.abilities.includes('ブロッカー')&&Number.isFinite(attack(c,p)));}
 function chooseBlocker(id){const o=operation;if(o?.kind!=='combat'||!blockers(o.defender).some(c=>c.id===id))return fail('未使用のブロッカーを1枚選んでください。');o.blockerId=id;return ok('ブロックする1枚を選びました。');}
 function battle(a,b,blocked,combatId){

  const before={attacker:publicRef(a.card,a.z),defender:publicRef(b.card,b.z)};
  const ap=attack(a.card,a.p),bp=attack(b.card,b.p);if(blocked)b.card.rest=true;
  a.card.health-=bp;b.card.health-=ap;enqueue([{kind:'battleResult',combatId,a:a.card.id,b:b.card.id,ap:a.p,bp:b.p,aSurvived:a.card.health>0,bSurvived:b.card.health>0}],a.p,a.card.id);
  const dead=[a,b].filter(s=>s.card.health<=0);trace('combatDamage','戦闘ダメージ：'+a.card.name+'へ'+bp+'、'+b.card.name+'へ'+ap+'。残り体力：'+a.card.health+'／'+b.card.health+'。',{combatId,blocked,before,after:{attacker:publicRef(a.card,a.z),defender:publicRef(b.card,b.z)},damageToAttacker:bp,damageToDefender:ap,destroyed:dead.map(s=>publicRef(s.card,s.z)),playerDamage:0},a.p);
  record(`戦闘：${a.card.name} ${ap}/${a.card.health} 対 ${b.card.name} ${bp}/${b.card.health}。同時ダメージ。`);
  for(const s of dead)destroyUnit(s.card.id,'戦闘');
  refreshDerived();
 }
 function resolveAttack(blockerId=undefined,expected=operation,priorityDone=false){
  const o=operation;if(!o||o!==expected||o.kind!=='combat'||result||turn.step!=='attack')return fail('この攻撃は終了しています。');const a=locate(o.id);
  if(!a||a.p!==o.p||!isUnit(a.z)||!a.card.rest)return fail('攻撃ユニットの状態が変わりました。');
  if(blockerId===undefined)blockerId=o.blockerId;let b=null;if(blockerId){if(!(priorityDone&&o.blockDeclared&&locate(blockerId)?.p===o.defender&&isUnit(locate(blockerId)?.z))&&!blockers(o.defender).some(c=>c.id===blockerId))return fail('選んだユニットはブロックできません。');b=locate(blockerId);}
  if(b&&!priorityDone){o.blockDeclared=true;b.card.rest=true;trace('blockDeclared','ブロックを宣言。攻撃対象をブロッカーへ変更。',{blockerId:b.card.id,combatId:o.combatId,targetPlayer:o.defender,playerDamage:0},o.defender);}if(b&&!priorityDone&&(instantCards(o.p).length||instantCards(o.defender).length)){openPriority({type:'block',combat:o,blockerId:b.card.id},o.p);return ok('ブロック宣言への応答を確認。');}operation=null;
  if(b){attackWrap(o.id,o.p,o.defender);o.blocked=true;o.resolvedTarget=b.card.id;trace('block','《'+b.card.name+'》でブロック成立。攻撃対象をブロッカーへ変更。',{combatId:o.combatId,declaredTarget:o.declaredTarget,selectedBlocker:b.card.id,blocked:true,resolvedTarget:b.card.id,attacker:publicRef(a.card,a.z),blocker:publicRef(b.card,b.z)},o.defender);battle(a,b,true,o.combatId);trace('attackEnd','ブロック成立のためプレイヤーダメージ0。攻撃終了。',{combatId:o.combatId,blocked:true,playerDamage:0,targetPlayer:o.defender,attackEnded:true},o.p);pump();return ok('ブロック戦闘を解決。本体ダメージ0、攻撃終了。');}trace('block','ブロックなし。',{combatId:o.combatId,blocked:false,declaredTarget:o.declaredTarget,resolvedTarget:'body'},o.defender);
  const damage=attack(a.card,a.p);attackWrap(o.id,o.p,o.defender,damage>0);if(a.card.markerGuard&&state[a.p].markers.some(x=>x.hostId===a.card.id)&&!a.card.abilitiesDisabled)enqueue([{kind:'damagePlayer',amount:damage}],a.p,a.card.id);
  record(`${label(o.defender)}に${damage}ダメージ。`);
  if(a.card.onBodySuccess)enqueue(a.card.onBodySuccess,a.p,a.card.id);
  events.push({id:++eventSerial,kind:'playerCombatDamage',p:o.defender,amount:damage,text:`戦闘ダメージ${damage}`});loseLife(o.defender,damage,'戦闘ダメージ');trace('attackEnd','本体へ'+damage+'ダメージ。攻撃終了。',{combatId:o.combatId,blocked:false,playerDamage:damage,targetPlayer:o.defender,attackEnded:true},o.p);pump();return ok('プレイヤーへの攻撃を解決しました。');
 }
 function finish(winner,reason,extra={}){if(result)return;trace('result',label(winner)+'の勝利：'+reason+'。',{winner,loser:other(winner),reason});result={winner,loser:other(winner),reason,type:'normal',turnNumber:turn.number,gameId,...extra};operation=null;queue=[];stack=[];turn.key={};epoch++;record(`${label(winner)}の勝利：${reason}。`);}
 function chooseFate(key,expected=operation){const o=operation;if(o!==expected||o?.kind!=='fateChoice'||!Catalog.fateKeys.includes(key))return fail('3種類の運命から1枚を選んでください。');const c=fromDefinition(key,o.p);state[o.p].hand.push(c);operation=null;record(`${label(o.p)}が${c.name}を手札に生成しました。`);pump();return ok('運命を選びました。');}
 function toggleUntapMana(id){const o=operation;if(o?.kind!=='untapMana'||!state[o.p].energy.some(c=>c.id===id))return fail('自分のマナを選んでください。');if(!o.ids.includes(id)&&o.ids.length>=o.max)return fail(`最大${o.max}枚です。`);o.ids=o.ids.includes(id)?o.ids.filter(x=>x!==id):[...o.ids,id];return ok('未使用に戻すマナを選択しました。');}
 function confirmUntap(expected=operation){const o=operation;if(o!==expected||o?.kind!=='untapMana'||o.ids.length>o.max||new Set(o.ids).size!==o.ids.length||o.ids.some(id=>!state[o.p].energy.some(c=>c.id===id)))return fail('マナの選択が不正です。');o.ids.forEach(id=>locate(id).card.rest=false);operation=null;record(`${label(o.p)}がマナ${o.ids.length}枚を未使用へ。`);pump();return ok('マナの回復を確定しました。');}
 function setDeckLibrary(records){if(!Array.isArray(records))return fail('デッキ一覧が不正です。');deckRecords=clone(records);return {ok:true};}
 function deckInfo(p){return clone(chosenSpecs[p]);}
 function decisionPlayer(){if(result)return null;if(status==='mulligan')return mulligan.p2==='pending'&&mode==='bot'?'p2':PLAYERS.find(p=>mulligan[p]==='pending')||null;return operation?(operation.kind==='presentation'?null:operation.kind==='combat'?operation.defender:(operation.selector||operation.p)):turn.player;}
 // Bot gets this projection only: no opponent hand or deck ordering.
 function observe(p){
  const copy=c=>JSON.parse(JSON.stringify(c)),publicCard=(c,owner,z)=>z==='markers'?{id:c.id,name:'裏向きマーカー',type:'マーカー',owner,zone:z,faceUp:false}:({...copy(c),owner,zone:z,justDiverActive:justDiverActive(c),speedAttacker:hasSpeed(c,owner),...(c.type==='通常'?{attack:attack(c,owner)}:{})});
  const players={};
  for(const owner of PLAYERS){const zones=state[owner];players[owner]={hand:owner===p?zones.hand.map(c=>({...publicCard(c,owner,'hand'),canPlay:playStatus(c,owner).ok,effectiveCost:effectiveCost(c,owner),paymentPlan:c.cost?planPayment(effectiveCost(c,owner),owner,c.id):null})):null,counts:Object.fromEntries(ZONES.map(z=>[z.id,zones[z.id].length])),units:unitSlots(owner).flatMap(z=>zones[z.id].filter(c=>c.faceUp).map(c=>publicCard(c,owner,z.id))),structures:zones.structures.filter(c=>c.faceUp).map(c=>publicCard(c,owner,'structures')),mana:zones.energy.filter(c=>c.faceUp).map(c=>({...publicCard(c,owner,'energy'),canPlay:!!c.castFromMana&&playStatus(c,owner).ok,effectiveCost:c.cost?effectiveCost(c,owner):null,paymentPlan:c.cost?planPayment(effectiveCost(c,owner),owner,c.id):null})),character:character(owner)?publicCard(character(owner),owner,'lrig'):null,growth:growStatus(owner),sideSpent:sideSpent(owner),sideboard:zones.extra.map(c=>({...publicCard(c,owner,'extra'),canPlay:playStatus(c,owner).ok,effectiveCost:c.type==='キャラクター'?useCost(c,owner,'growth'):effectiveCost(c,owner)})),summonLocks:activeLocks(owner),shields:zones.shields.map(c=>owner===p||c.faceUp?publicCard(c,owner,'shields'):{id:c.id,faceUp:false,owner,zone:'shields'}),trash:zones.trash.map(c=>publicCard(c,owner,'trash')),life:life[owner],maxLife:30,manaCount:manaCount(owner),symbols:symbols(owner)};}
  const actor=decisionPlayer(),o=operation;let projected=o?{kind:o.kind,p:actor}:null;
  if(o&&actor===p){projected=copy(o);if(o.kind==='expansionChoice')projected.candidates=expansionCandidates(o).map(c=>o.choice==='burnShield'?c:publicCard(c,locate(c.id).p,locate(c.id).z));if(o.kind==='lootCost')projected.candidates=state[p].hand.map(c=>publicCard(c,p,'hand'));if(o.kind==='refreshPenalty')projected.candidates=state[p].energy.map(c=>publicCard(c,p,'energy'));if(o.kind==='manaCharge')projected.card=publicCard(locate(o.id).card,p,'hand');if(o.kind==='sideChoice'){projected.candidates=o.choice==='viceOffer'?state[p].extra.filter(c=>c.key===(o.chargerKey||'viceCharger')&&!c.used&&!c.expired).map(c=>publicCard(c,p,'extra')):sideChoiceCandidates(o).map(c=>publicCard(c,locate(c.id).p,locate(c.id).z));}if(o.kind==='shieldWindow')projected.candidates=state[p].shields.filter(c=>o.ids.includes(c.id)&&!c.faceUp).map(c=>publicCard(c,p,'shields'));if(['resetShield','inspectShield'].includes(o.kind))projected.candidates=shieldEffectCandidates().map(c=>o.kind==='resetShield'?publicCard(c,p,'shields'):{id:c.id,faceUp:false});if(o.kind==='shieldReveal')projected.card=publicCard(locate(o.id).card,other(p),'shields');if(['payment','freePlace','freeCast','returnPlace','sideFreePlace'].includes(o.kind)){projected.slots=placementOptions(o.p,locate(o.id)?.card).map(z=>({id:z.id,card:state[o.p][z.id][0]?publicCard(state[o.p][z.id][0],o.p,z.id):null}));}
   if(o.kind==='starterChoice')projected.candidates=starterCandidates(o).map(c=>c.type==='プレイヤー'?c:publicCard(c,locate(c.id).p,locate(c.id).z));if(o.kind==='scryMany')projected.candidates=o.ids.map(id=>publicCard(locate(id).card,p,'main'));if(o.kind==='effectTarget')projected.candidates=effectTargets().map(c=>{const s=locate(c.id);return publicCard(c,s.p,s.z);});
   if(o.kind==='freeUnit')projected.candidates=freeUnitCandidates().map(c=>publicCard(c,locate(c.id).p,'energy'));
   if(o.kind==='combat'){const a=locate(o.id);projected.attacker=a?publicCard(a.card,a.p,a.z):null;projected.blockers=blockers(p).map(c=>publicCard(c,p,locate(c.id).z));}
   if(o.kind==='attackTarget')projected.targets=attackTargets(o.id);
   if(['reorder','stackOrder','searchSpell','inspectHand','handPick','recoverUnit'].includes(o.kind))projected.candidates=privateCandidates().map(c=>publicCard(c,locate(c.id).p,locate(c.id).z));
   if(o.kind==='response'){projected.candidates=counterCards(p).map(c=>publicCard(c,p,locate(c.id).z));projected.target=locate(o.cardId)?publicCard(locate(o.cardId).card,locate(o.cardId).p,'check'):null;}
   if(o.kind==='fateChoice')projected.candidates=Catalog.fateKeys.map(k=>({...clone(Catalog.cards[k]),id:k}));
   if(o.kind==='untapMana')projected.candidates=state[p].energy.map(c=>publicCard(c,p,'energy'));
   if(o.kind==='tokens')projected.slots=placementOptions(p).map(z=>({id:z.id,card:state[o.p][z.id][0]?publicCard(state[o.p][z.id][0],o.p,z.id):null}));
   if(['payment','freeCast'].includes(o.kind)){const c=locate(o.id)?.card;projected.targets=targetOptions((c?.onUse)?.find(e=>['bounce','unitBounce','trap','mother','buffUnit'].includes(e.kind))||{kind:'none'},p).map(c=>publicCard(c,locate(c.id).p,locate(c.id).z));}

  }
  const sources=paymentSources(p).map(s=>({id:s.id,colors:[...s.colors],unit:s.card.type==='通常'}));
  const attacks=actor===p&&!operation&&turn.step==='attack'?players[p].units.filter(c=>!attackError(c.id)).map(c=>({card:c,targets:attackTargets(c.id)})):[];
  const exile=[];
  return {viewer:p,actor,mode,status,exile,firstPlayer,epoch,turn:copy({...turn,key:undefined}),canAdvance:status==='ready'&&!result&&!operation&&!mustAttackPending()&&clock()>=turn.notBefore,mulligan:copy(mulligan),result:result?copy(result):null,players,sources,operation:projected,attacks};
 }
 function dispatch(action,p,expectedEpoch=epoch){
  if(expectedEpoch!==epoch||result)return fail('以前の対戦の操作です。');if(decisionPlayer()!==p)return fail('このプレイヤーの選択待ちではありません。');
  const handlers={expansion:()=>resolveExpansion(action.id||null),loot:()=>beginLoot(action.id),lootCost:()=>resolveLoot(action.id),charge:()=>beginCharge(action.id),confirmCharge:()=>confirmCharge(),skipCharge,refreshSelect:()=>selectRefreshMana(action.id),refresh:()=>confirmRefresh(),grow:()=>beginGrowth(p),sideSelect:()=>selectSideChoice(action.id),sideChoice:()=>resolveSideChoice(action.id||null),sideFree:()=>confirmSideFree(),revolution:()=>resolveRevolution(action.use!==false),shield:()=>resolveShield(action.id||null),shieldEffect:()=>resolveShieldEffect(action.id||null),fate:()=>chooseFate(action.key),returnPlace:()=>confirmReturn(),untapSelect:()=>toggleUntapMana(action.id),untap:()=>confirmUntap(),mulligan:()=>completeMulligan(p,action.ids||[],false),play:()=>beginPayment(action.id,action.method||'normal'),freeCast:()=>confirmFreeCast(),starter:()=>resolveStarter(action.id||null),scryMove:()=>scryMove(action.id,action.destination,action.delta||0),scry:()=>confirmScry(),characterAbility:()=>beginCharacterAbility(p),useTarget:()=>selectUseTarget(action.id),pass:()=>passResponse(),private:()=>resolvePrivate(action.id||null),orderMove:()=>reorderCard(action.id,action.delta),order:()=>confirmOrder(!!action.bottom),token:()=>placeToken(action.slot||null),optional:()=>resolveOptional(action.use!==false),slot:()=>chooseSlot(action.slot),pay:()=>confirmPayment(),cancelPayment,cancelAttackTarget,attack:()=>declareAttack(action.id,action.target),attackTarget:()=>chooseAttackTarget(action.target),block:()=>resolveAttack(action.id),target:()=>resolveEffectTarget(action.id),freeUnit:()=>chooseFreeUnit(action.id||null),freePlace:()=>confirmFreePlacement(),skipFree:skipFreePlacement,discard:()=>{const o=operation;if(o?.kind!=='discard')return fail('手札調整ではありません。');if(!Array.isArray(action.ids)||new Set(action.ids).size!==action.ids.length||action.ids.some(id=>!state[p].hand.some(c=>c.id===id)))return fail('手札から選択してください。');o.ids=[...action.ids];return confirmDiscard(o);},advance:()=>advance()};
  if(action.type==='play'&&locate(action.id)?.p!==p)return fail('自分の手札を選んでください。');
  return handlers[action.type]?handlers[action.type]():fail('操作が見つかりません。');
 }
 function surrender(p='p1'){if(!PLAYERS.includes(p)||result)return fail('現在は降参できません。');finish(other(p),'降参',{type:'surrender',surrendered:p});return ok('降参して対戦を終了しました。');}
 const initialReset=reset();if(!initialReset.ok)throw Error(initialReset.message);
 const api={surrender,expansionCandidates,resolveExpansion,beginLoot,resolveLoot,hasSpeed,justDiverActive,starterCandidates,resolveStarter,scryMove,confirmScry,beginCharacterAbility,characterLevelData,instantCards,legalCounterFrames,selectCounterTarget,get normalMode(){return normalMode;},battleLog,exportLog,reportException,get gameId(){return gameId;},get diagnosticFailures(){return diagnosticFailures;},get journalCount(){return journalId;},beginCharge,confirmCharge,cancelCharge,skipCharge,chargeError,createManaToken,destroyMana,selectRefreshMana,confirmRefresh,sideboardRoster:p=>[...sideRoster[p]],soloNextPlayer,character,growStatus,beginGrowth,sideSpent,costBreakdown,summonError,activeLocks,sideChoiceCandidates,selectSideChoice,resolveSideChoice,confirmSideFree,resolveRevolution,loseLife,destroyUnit,resolveShield,shieldEffectCandidates,resolveShieldEffect,INITIAL_HAND,setDeckLibrary,deckInfo,chooseFate,confirmReturn,toggleUntapMana,confirmUntap,get vanishedIds(){return [...vanishedIds];},get extraTurns(){return [...extraTurns];},ZONES,PLAYERS,SELF,STEPS,confirmFreeCast,selectUseTarget,targetOptions,counterCards,passResponse,finishPresentation,privateCandidates,reorderCard,confirmOrder,resolvePrivate,placeToken,resolveOptional,observe,dispatch,decisionPlayer,isUnit,isField,label,card,buildDeck,validateDeck,reset,completeMulligan,locate,fromDefinition,addMana,refreshDeck,freeUnitCandidates,chooseFreeUnit,manaCount,fieldCards,attack,healUnit,healLife,symbols,effectiveCost,paymentSources,planPayment,selectedMana,chooseManaColor,effectTargets,resolveEffectTarget,confirmFreePlacement,skipFreePlacement,attackTargets,chooseAttackTarget,cancelAttackTarget,manualMove,addCard,toggle,readyMana,remove,draw,shuffle,availableMana,playStatus,unitSlots,placementOptions,beginPayment,chooseSlot,togglePaymentLand,paymentInfo,confirmPayment,cancelPayment,advance,toggleDiscard,confirmDiscard,attackError,declareAttack,blockers,chooseBlocker,resolveAttack,
  get sideboardChoices(){return {...sideChoices};},get summonLocks(){return clone(summonLocks);},get deckChoices(){return {...deckChoices};},get events(){return clone(events);},get mode(){return mode;},get firstPlayer(){return firstPlayer;},get epoch(){return epoch;},get life(){return {...life};},get state(){refreshDerived();return state;},get status(){return status;},get turn(){return turn;},get mulligan(){return mulligan;},get operation(){return operation;},get result(){return result;},get supplyStatus(){return supplyStatus;},get log(){return [...log];},get canAdvance(){return status==='ready'&&!result&&!operation&&!mustAttackPending()&&clock()>=turn.notBefore;}};
 api.destroyUnit=(...args)=>{const r=destroyUnit(...args);if(!operation)pump();return r;};
 for(const name of ['surrender','resolveExpansion','beginLoot','resolveLoot','reset','completeMulligan','beginCharge','confirmCharge','cancelCharge','skipCharge','createManaToken','destroyMana','selectRefreshMana','confirmRefresh','beginGrowth','selectSideChoice','resolveSideChoice','confirmSideFree','resolveRevolution','loseLife','destroyUnit','resolveShield','resolveShieldEffect','chooseFate','confirmReturn','toggleUntapMana','confirmUntap','soloNextPlayer','confirmFreeCast','resolveStarter','scryMove','confirmScry','beginCharacterAbility','selectCounterTarget','selectUseTarget','passResponse','reorderCard','confirmOrder','resolvePrivate','placeToken','resolveOptional','manualMove','addCard','toggle','readyMana','remove','draw','shuffle','beginPayment','chooseSlot','togglePaymentLand','chooseManaColor','confirmPayment','cancelPayment','advance','declareAttack','chooseAttackTarget','cancelAttackTarget','chooseBlocker','resolveAttack','resolveEffectTarget','confirmFreePlacement','skipFreePlacement','chooseFreeUnit','healUnit','healLife','addMana','dispatch'])if(typeof api[name]==='function'){const fn=api[name];api[name]=audited(name,(...args)=>result&&name!=='reset'?fail('対戦は終了しています。'):fn(...args));}
 return api;
}
return {create,ZONES,STEPS};
});
