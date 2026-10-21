'use strict';
var Game=GameRules.create();
const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const COLORS={白:'#b6a461',赤:'#cf6265',青:'#599dd4',緑:'#61b18c',黒:'#796a9d',無色:'#859aa4'};
let modeChosen=false,selected=null,active='p1',visibility='active',setupPlayer='p1',exchangeIds=new Set(),advanceTimer=null,modalView=null;
function hidden(p,z,c){return (Game.mode==='bot'&&(z==='main'||z==='life'||(z==='hand'&&p==='p2')))||z==='landDeck'||!c.faceUp||(z==='hand'&&visibility==='active'&&p!==active);}
function cardHTML(c,{hide=false,p=null,z=null,selectMode='card',chosen=false}={}) {
 const ability=[...(c.abilities||[]),c.deckLimit===1?'同名1枚制限':'',c.text||''].filter(Boolean).join('／')||'なし';
 const cost=c.type==='土地'?'配置コストなし':c.cost?ManaEngine.describe(c.cost):'コスト未設定';
 const sym=ManaEngine.colors.filter(color=>c.symbols?.[color]).map(color=>color+c.symbols[color]).join('・')||'なし';
 const play=z==='hand'&&!hide&&Game.status==='ready'?Game.playStatus(c,p):null;
 const stateText=`${c.rest?'使用済み':'未使用'}${c.sick?'・召喚酔い':''}`;
 return `<button class="card ${c.type==='土地'&&!hide?'land':''} ${hide?'back':''} ${c.rest?'rest':''} ${chosen||selected===c.id?'selected':''} ${play?(play.ok?'playable':'unplayable'):''}" style="--color:${COLORS[c.color]}" data-${selectMode}="${c.id}" ${selectMode!=='card'?`aria-pressed="${chosen}"`:''} aria-label="${hide?'裏向きカード':esc(c.name)}・${stateText}">${hide?'<strong>裏向きカード</strong>':`<strong>${esc(c.name)}</strong><span>${esc(c.type)} / ${esc(c.color)}<br>コスト：${cost}${c.type==='通常'?`<br>パワー：${Game.power(c,p)??'未設定'}<br>シンボル：${sym}／ブレイク${c.breaks||0}`:c.type==='設置物'?`<br>軽減用シンボル：${sym}<br>パワー・ブレイクなし`:''}</span><span class="ability-text">能力：${esc(ability)}</span><em>${c.id}</em>`}${play?`<span class="play-status">${esc(play.text)}</span>`:''}<span class="mana-state ${c.rest?'spent':''}">${stateText}</span></button>`;
}
function humanOperation(){return Game.mode!=='bot'||Game.decisionPlayer()==='p1';}
function notify(result){$('#notice').textContent=result.message||'';if((!Game.operation||!humanOperation())&&modalView==='operation'){$('#modal').close();modalView=null;}render();if(Game.operation&&humanOperation())renderOperation();}
function renderSetup(){
 $('#setup').hidden=!modeChosen||Game.status==='ready'||!!Game.result;
 if($('#setup').hidden){$('#setup').innerHTML='';return;}
 if(Game.mode==='bot'){setupPlayer='p1';if(Game.mulligan.p1==='done'){$('#setup').innerHTML='<p>Botの開始準備を待っています。</p>';return;}}
 if(Game.mulligan[setupPlayer]==='done')setupPlayer=Game.PLAYERS.find(p=>Game.mulligan[p]==='pending')||'p1';
 $('#setup').innerHTML=`<h2>開始準備：マリガン</h2><p>各自1回、0〜7枚を交換できます。両者完了後にシールドを7枚配置します。</p><div class="setup-tabs">${(Game.mode==='bot'?['p1']:Game.PLAYERS).map(p=>`<button data-setup-player="${p}" ${Game.mulligan[p]==='done'?'disabled':''}>${Game.label(p)}：${Game.mulligan[p]==='done'?'完了':'未選択'}</button>`).join('')}</div><h3>${Game.label(setupPlayer)}の初期手札：7枚</h3><div class="mulligan-hand">${Game.state[setupPlayer].hand.map(c=>cardHTML(c,{selectMode:'mulligan',chosen:exchangeIds.has(c.id)})).join('')}</div><p id="exchange-count">選択中：${exchangeIds.size}枚 / 7枚</p><div class="setup-actions"><button id="exchange">${exchangeIds.size}枚交換する</button><button id="keep">交換せず開始</button></div><p>下へ戻す → 同数ドロー → シャッフル。引き直す前にはシャッフルしません。</p>`;
 const p=setupPlayer;
 $('#exchange').onclick=()=>{const r=Game.completeMulligan(p,[...exchangeIds]);if(r.ok)exchangeIds.clear();notify(r);};
 $('#keep').onclick=()=>{const r=Game.completeMulligan(p,[],true);if(r.ok)exchangeIds.clear();notify(r);};
}
function renderTurn(){
 const ready=Game.status==='ready',turn=Game.turn,mana=Game.availableMana(turn.player),botBusy=Game.mode==='bot'&&Game.decisionPlayer()==='p2';
 const progression=Object.entries(Game.STEPS).map(([key,name])=>`<span class="${key===turn.step?'current-step':''}">${name}</span>`).join(' → ');
 const names={main1:'アタックへ',attack:'メイン2へ',main2:'エンドへ',end:'次のターン'};
 const nextId=turn.step==='end'?'next-turn':'next-phase';
 $('#turn-panel').innerHTML=`<div><b>${Game.result?`${Game.label(Game.result.winner)}の勝利：${Game.result.reason}`:ready?`${Game.label(turn.player)}（${turn.player==='p1'?'あなた':Game.mode==='bot'?'Bot':'相手'}）の第${turn.number}ターン ／ ${Game.STEPS[turn.step]}`:'開始準備中'}</b><span class="turn-land">ターン開始の土地：${!ready?'開始待ち':turn.landsPlaced?'自動配置済み（1枚）':'配置不可（土地不足）'}</span><small>${ready&&turn.skippedDraw?'先攻第1ターン：ドローなし':Game.mode==='bot'?`先攻：${Game.label(Game.firstPlayer)} ／ Botと交互に進行`:'壁打ち：相手のターンを挟みません'}</small><small>使用可能な支払い元：${mana.total}枚（任意色${mana.flexible}枚）／色別候補 ${ManaEngine.colors.map(c=>`${c}${mana[c]}`).join('・')}</small><small>場の軽減シンボル：${ManaEngine.colors.map(c=>`${c}${Game.symbols(turn.player)[c]}`).join('・')}</small><div class="phase-track">${progression}</div></div><div class="turn-buttons">${Game.operation&&humanOperation()?'<button id="resume-operation">選択を再開</button>':''}<button id="${nextId}" ${!Game.canAdvance||botBusy?'disabled':''}>${names[turn.step]||'処理中'}</button></div>`;
 const key=turn.key;
 $('#'+nextId).onclick=()=>{selected=null;notify(Game.advance(key));};
 if($('#resume-operation'))$('#resume-operation').onclick=renderOperation;
 if(advanceTimer!==null)clearTimeout(advanceTimer);
 const delay=turn.notBefore-Date.now();if(delay>0)advanceTimer=setTimeout(()=>{advanceTimer=null;renderTurn();},delay+10);
}
function options(){return Game.PLAYERS.map(p=>`<optgroup label="${Game.label(p)}">${Game.ZONES.map(z=>`<option value="${p}/${z.id}">${Game.label(p)}・${z.name}</option>`).join('')}</optgroup>`).join('');}
function renderZone(p,z){
 const a=Game.state[p][z.id],mana=Game.availableMana(p);
 return `<section class="zone ${z.class||''}" data-player="${p}" data-zone="${z.id}"><div class="zone-title"><b>${z.name}</b><span class="count">${a.length}${z.id==='extra'?'/10':''}枚</span></div>${['main','landDeck'].includes(z.id)?`<p class="deck-summary">${z.id==='main'?'開始40枚／初手・マリガン・盾はこちら':'開始20枚／毎ターン上から自動配置・通常表示では順番非公開'}${Game.supplyStatus[p][z.id==='main'?'main':'land']?`<br><b role="status">${esc(Game.supplyStatus[p][z.id==='main'?'main':'land'])}</b>`:''}</p>`:''}${z.id==='energy'?`<p class="mana-summary">使用可能な支払い元：${mana.total}枚（任意色${mana.flexible}枚）<br>${ManaEngine.colors.map(c=>`${c}${mana[c]}`).join('・')}<br>縦 ${a.filter(c=>!c.rest).length} / 横 ${a.filter(c=>c.rest).length}</p>`:''}<div class="cards">${(z.pile?a.slice(0,1):a).map(c=>cardHTML(c,{hide:hidden(p,z.id,c),p,z:z.id})).join('')||'<span class="empty">カードなし</span>'}</div><div class="zone-tools"><button data-list="${p}/${z.id}">一覧 (${a.length})</button>${z.id==='energy'&&Game.mode==='solo'?`<button data-ready="${p}">手動回復（補助）</button>`:''}${z.id==='main'&&Game.mode==='solo'?`<button data-draw="${p}">手動ドロー（補助）</button>`:''}${Game.mode==='solo'&&['main','landDeck','extra'].includes(z.id)?`<button data-shuffle="${p}/${z.id}">シャッフル</button>`:''}</div></section>`;
}
function render(){
 $('#mode-select').hidden=modeChosen;$('#turn-panel').hidden=!modeChosen;$('#normal-controls').hidden=!modeChosen;$('#change-mode').hidden=!modeChosen;$('#reset').disabled=!modeChosen;
 const bot=Game.mode==='bot';for(const selector of ['#active','#visibility'])$(selector).closest('label').hidden=bot;$('#add').hidden=bot;
 $('#bot-status').hidden=!modeChosen||!bot;$('#bot-status').textContent=Game.result?`${Game.label(Game.result.winner)}の勝利`:Game.decisionPlayer()==='p2'?`Bot処理中 ／ ${Game.log.at(-1)||''}`:Game.operation?'あなたの選択待ちです。':'あなたの操作待ちです。';
 $('#current-mode').textContent=`緑メイン40枚＋土地デッキ20枚 ／ ${Game.mode==='bot'?'Bot戦（人間：P1・Bot：P2）':'壁打ち：自分のターンのみ'} ／ 軽減は緑1を残す`;
 $('#normal-controls').disabled=Game.status!=='ready'||!!Game.result||!!Game.operation;
 $('#board').hidden=!modeChosen||(Game.status!=='ready'&&!Game.result);$('#control').hidden=$('#board').hidden;
 renderSetup();renderTurn();
 const scrolls=new Map([...document.querySelectorAll('.zone')].map(el=>[`${el.dataset.player}/${el.dataset.zone}`,el.querySelector('.cards').scrollLeft]));
 $('#board').innerHTML=['p2','p1'].map(p=>`<section class="player ${p==='p2'?'opponent':'self'} ${active===p?'active':''}" data-player="${p}" aria-label="${Game.label(p)}の盤面"><h2 class="player-title">${Game.label(p)} ／ ${p==='p1'?'自分':Game.mode==='bot'?'Bot':'相手・手動確認用'}<span>${active===p?'● 確認対象':''}</span></h2><div class="layout"><section class="unit-field" aria-label="${Game.label(p)}のユニット7枠">${Game.ZONES.filter(z=>Game.isUnit(z.id)).map(z=>renderZone(p,z)).join('')}</section>${Game.ZONES.filter(z=>!Game.isUnit(z.id)).map(z=>renderZone(p,z)).join('')}</div></section>`).join('');
 for(const el of document.querySelectorAll('.zone'))el.querySelector('.cards').scrollLeft=scrolls.get(`${el.dataset.player}/${el.dataset.zone}`)||0;
 renderControl();runner.resume();$('#log-count').textContent=Game.log.length;$('#log-list').innerHTML=Game.log.slice().reverse().map(text=>`<li>${esc(text)}</li>`).join('');
}
function renderControl(){
 const s=Game.locate(selected);if(!s){$('#control').innerHTML='<p>カードをタップして操作を選んでください。「手動移動」はルール外の補助です。</p>';return;}
 if(Game.mode==='bot'&&hidden(s.p,s.z,s.card)){$('#control').innerHTML='<p>非公開のカードです。内容を確認できません。</p><button id="unselect">選択解除</button>';$('#unselect').onclick=()=>{selected=null;render();};return;}
 const playable=s.z==='hand'?Game.playStatus(s.card,s.p):null;
 const attackReason=Game.isUnit(s.z)?Game.attackError(s.card.id):'';
 const locked=!!Game.operation||!!Game.result||(Game.mode==='bot'&&Game.turn.player!=='p1');
 $('#control').innerHTML=`<p><b>${esc(s.card.name)}</b> ／ ${Game.label(s.p)}・${Game.ZONES.find(z=>z.id===s.z).name} ／ ${s.card.rest?'使用済み':'未使用'}${s.card.sick?'・召喚酔い':''}</p>${playable?`<p class="selected-status">${esc(playable.reasons.join('／')||playable.text)}</p>`:''}${Game.isUnit(s.z)?`<p class="action-status">${esc(attackReason||'攻撃できる対象があります。')} 引き付けがあれば強制対象。マッハファイターは出たターンだけユニットへ。</p>`:''}<div class="actions">${s.z==='hand'&&(Game.mode!=='bot'||s.p==='p1')&&['通常','呪文','設置物'].includes(s.card.type)?`<button id="play" ${!playable.ok?'disabled':''}>${s.card.type==='呪文'?'呪文を使用':'場に出す'}</button>`:''}${Game.isUnit(s.z)&&s.card.type==='通常'&&(Game.mode!=='bot'||s.p==='p1')?`<button id="attack" ${attackReason||locked?'disabled':''}>攻撃対象を選ぶ</button>${Game.mode==='solo'?`<button id="sick" ${locked?'disabled':''}>召喚酔い切替（補助）</button>`:''}`:''}<button id="peek">拡大・内容確認</button>${Game.mode==='solo'?`<select id="destination" aria-label="手動移動先">${options()}</select><button id="move" ${locked?'disabled':''}>手動移動（ルール外の補助）</button><button id="flip" ${locked?'disabled':''}>表裏切替（補助）</button><button id="rotate" ${locked?'disabled':''}>縦横切替（補助）</button><button id="top" ${locked?'disabled':''}>山札の上へ（補助）</button><button id="bottom" ${locked?'disabled':''}>山札の下へ（補助）</button><button id="delete" ${locked?'disabled':''}>削除（補助）</button>`:''}<button id="unselect">選択解除</button></div>`;
 if($('#destination'))$('#destination').value=`${s.p}/${s.z}`;
 if($('#play'))$('#play').onclick=()=>notify(Game.beginPayment(s.card.id));
 if($('#attack'))$('#attack').onclick=()=>notify(Game.declareAttack(s.card.id));
 if($('#sick'))$('#sick').onclick=()=>notify(Game.toggle(s.card.id,'sick'));
 if($('#move'))$('#move').onclick=()=>{const [p,z]=$('#destination').value.split('/');notify(Game.manualMove(s.card.id,p,z));};
 if($('#flip'))$('#flip').onclick=()=>notify(Game.toggle(s.card.id,'faceUp'));if($('#rotate'))$('#rotate').onclick=()=>notify(Game.toggle(s.card.id));
 $('#peek').onclick=()=>openModal('カードの拡大確認',`<div class="preview">${cardHTML(s.card)}</div><p>${s.card.id} ／ 表裏・使用状態・召喚酔いは変更しません。</p>`,'peek');
 for(const [id,bottom]of [['top',false],['bottom',true]])if($('#'+id))$('#'+id).onclick=()=>{const [p,z]=$('#destination').value.split('/');if(!['main','landDeck','extra'].includes(z)){notify({ok:false,message:'移動先にメインデッキ・土地デッキ・サイドボードを選んでください。'});return;}notify(Game.manualMove(s.card.id,p,z,bottom));};
 if($('#delete'))$('#delete').onclick=()=>{const r=Game.remove(s.card.id);if(r.ok)selected=null;notify(r);};$('#unselect').onclick=()=>{selected=null;render();};
}
function openModal(title,body,view='operation'){$('#modal-title').textContent=title;$('#modal-body').innerHTML=body;modalView=view;$('#close').textContent=Game.operation&&Game.operation.kind!=='payment'?'選択を保留':'閉じる';if(!$('#modal').open)$('#modal').showModal();}
function closeModal(){if(Game.operation?.kind==='payment'){const r=Game.cancelPayment();$('#notice').textContent=r.message;}else if(Game.operation?.kind==='attackTarget'){Game.cancelAttackTarget();}else if(['triggerPlace','freePlace'].includes(Game.operation?.kind)){Game.skipTriggerPlacement();}$('#modal').close();modalView=null;render();}
function renderOperation(){
 const o=Game.operation;if(!o||!humanOperation())return;
 if(['payment','triggerPlace','freePlace'].includes(o.kind)){
  const source=Game.locate(o.id);if(!source)return;const c=source.card,free=o.kind!=='payment';
  const check=free?{ok:!!o.slot}:Game.paymentInfo(o),sources=free?[]:Game.paymentSources(o.p),mana=free?null:ManaEngine.pool(Game.selectedMana(o).filter(Boolean));
  const replacement=o.replacedId?Game.locate(o.replacedId):null;
  openModal(free?(o.kind==='freePlace'?'母なる大地：無料配置':'シールドトリガー：無料配置'):'軽減後のコストと支払い',`<p><b>${esc(c.name)}</b> ／ ${Game.label(o.p)}</p><p>元コスト：${ManaEngine.describe(c.cost)}${free?' ／ 無料で使用':`<br>軽減後：<b>${ManaEngine.describe(Game.effectiveCost(c,o.p))}</b> ／ 不特定部分は軽減しません。緑1を残します。`}</p>${c.type==='通常'?`<p>配置先・上書き対象を選択</p><div class="payment-slots">${Game.placementOptions(o.p).map(z=>`<button data-pay-slot="${z.id}" aria-pressed="${o.slot===z.id}">${z.name}${Game.state[o.p][z.id].length?`：${esc(Game.state[o.p][z.id][0].name)}を上書き`:''}</button>`).join('')}</div><p id="overwrite-info">${replacement?`上書き対象：${esc(replacement.card.name)}をトラッシュへ。支払い時点ではこのカードのシンボルも有効です。`:'空き枠への配置です。'}</p>`:(c.type==='設置物'?'<p>設置物は専用領域に残ります。ユニット7枠とは別で、枚数上限はありません。</p>':'<p>呪文はユニット枠を使わず、解決後にトラッシュへ送ります。</p>')}${!free?`<p>支払い元を選択。極楽鳥は色も変更できます。使用済み・召喚酔い中のマナ能力は使えません。</p><div class="payment-lands">${sources.map(s=>`<div class="source-option"><button data-pay-land="${s.id}" aria-pressed="${o.sourceIds.includes(s.id)}"><b>${esc(s.card.name)}</b><span>${s.card.type==='土地'?'土地':'本人を横向きにするマナ能力'} ／ ${s.id}</span>${o.sourceIds.includes(s.id)?'✓ 選択中':'未選択'}</button>${s.colors.length>1?`<label>出す色<select data-mana-color="${s.id}">${s.colors.map(color=>`<option ${o.sourceColors[s.id]===color?'selected':''}>${color}</option>`).join('')}</select></label>`:`<span>${s.colors[0]}1点</span>`}</div>`).join('')}</div><p>選択${o.sourceIds.length}枚／合計${mana.total}点（${ManaEngine.colors.map(c=>`${c}${mana[c]}`).join('・')}）</p>`:''}<p id="payment-error">${check.ok?'内容を確認して確定してください。':esc(check.message||'配置先を選んでください。')}</p><div class="setup-actions"><button id="confirm-payment" ${!check.ok?'disabled':''}>${free?'無料配置を確定':'支払いを確定して使用'}</button><button id="cancel-payment">${free?'使用せず手札に残す':'キャンセル'}</button></div>`);
  $('#confirm-payment').onclick=()=>{const r=free?Game.confirmTriggerPlacement(o):Game.confirmPayment(o);if(r.ok){$('#modal').close();modalView=null;}notify(r);};$('#cancel-payment').onclick=closeModal;
 }else if(o.kind==='effectTarget'){
  const mother=o.effect==='mother';
  openModal(mother?'母なる大地：両者からユニットを1枚選択':'相手ユニットを1枚選択',`<p>${Game.label(o.p)}が対象を選び、持ち主のトラッシュへ送ります。${mother?'その持ち主が、土地枚数以下の軽減前コストのユニットを自分の手札から出すか選びます。':'その持ち主の土地デッキから1枚を自動追加します。'}</p><div class="effect-targets">${Game.effectTargets().map(c=>`<section><p>${Game.label(Game.locate(c.id).p)}</p>${cardHTML(c,{selectMode:'effect-target'})}</section>`).join('')}</div>`);
 }else if(o.kind==='freeUnit'){
  openModal('母なる大地：持ち主が無料で出すカードを選択',`<p><b>選ぶ人：${Game.label(o.p)}</b>。場の土地${Game.landCount(o.p)}枚。自分の手札から軽減前の合計コストが${Game.landCount(o.p)}以下のユニットを1枚まで選べます。登場時能力も発動します。</p><div class="free-unit-options">${Game.freeUnitCandidates().map(c=>cardHTML(c,{selectMode:'free-unit'})).join('')}</div><button id="skip-free-unit">出さずに解決を続ける</button>`);
  $('#skip-free-unit').onclick=()=>notify(Game.chooseFreeUnit(null,o));
 }else if(o.kind==='triggers'){
  openModal('シールドトリガーの順番を選択',`<p>選ぶ人：${Game.label(o.p)}。今回割れた盾は先にすべて手札へ移動済みです。1枚ずつ、好きな順番で無料使用するか選びます。</p><div class="trigger-options">${o.ids.map(id=>{const c=Game.locate(id)?.card;return c?`<section>${cardHTML(c,{selectMode:'trigger-card'})}<button data-use-trigger="${id}">無料で使用する</button><button data-skip-trigger="${id}">使用せず手札に残す</button></section>`:'';}).join('')}</div><button id="skip-triggers">残りをすべて手札に残す</button>`);
  $('#skip-triggers').onclick=()=>notify(Game.skipTriggers());
 }else if(o.kind==='attackTarget'){
  openModal('攻撃側：対象を選択',`<p>引き付けがある場合はその中から選びます。マッハファイターは出たターンだけ相手ユニットを攻撃できます。</p><div class="attack-targets">${Game.attackTargets(o.id).map(t=>`<button data-attack-target="${t.id}">${esc(t.name)}${t.forced?'（引き付け・横向きでも有効）':''}</button>`).join('')}</div><button id="cancel-attack-target">攻撃前にキャンセル</button>`);
  $('#cancel-attack-target').onclick=()=>{notify(Game.cancelAttackTarget());$('#modal').close();modalView=null;};
 }else if(o.kind==='combat'){
  const a=Game.locate(o.id);if(!a)return;const blockers=Game.blockers(o.defender);
  openModal('防御側：ブロックするか選択',`<p>${esc(a.card.name)}（パワー${Game.power(a.card,o.p)}）が${Game.label(o.defender)}本体へ攻撃。攻撃側は使用済みです。</p><p>未使用の「ブロッカー」だけが選べます。召喚酔いでもブロック可能。今回は1枚までです。</p><div class="combat-blockers">${blockers.map(c=>cardHTML(c,{selectMode:'blocker',chosen:o.blockerId===c.id})).join('')||'<p>ブロック可能なユニットはありません。</p>'}</div><div class="setup-actions"><button id="confirm-block" ${!o.blockerId?'disabled':''}>選んだ1枚でブロック</button><button id="no-block">ブロックしない</button></div><p>同パワーは攻撃側有利。ブロック時はシールドへ処理しません。</p>`);
  $('#confirm-block').onclick=()=>{const r=Game.resolveAttack(o.blockerId,o);if(r.ok){$('#modal').close();modalView=null;}notify(r);};$('#no-block').onclick=()=>{const r=Game.resolveAttack(null,o);if(r.ok){$('#modal').close();modalView=null;}notify(r);};
 }else if(o.kind==='discard'){
  openModal('エンド：手札を7枚に調整',`<p>${Game.label(o.p)}の手札${Game.state[o.p].hand.length}枚。<b>${o.required}枚</b>を選び、トラッシュへ送ってください。</p><div class="discard-hand">${Game.state[o.p].hand.map(c=>cardHTML(c,{selectMode:'discard',chosen:o.ids.includes(c.id)})).join('')}</div><p id="discard-count">選択中${o.ids.length}枚／必要${o.required}枚</p><button id="confirm-discard" ${o.ids.length!==o.required?'disabled':''}>選んだカードをトラッシュへ送る</button><p>完了するまで次のターンは開始しません。</p>`);
  $('#confirm-discard').onclick=()=>{const r=Game.confirmDiscard(o);if(r.ok){$('#modal').close();modalView=null;}notify(r);};
 }
}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;if(Game.mode==='bot'&&Game.decisionPlayer()==='p2'&&Object.keys(b.dataset).some(k=>!['card','list'].includes(k)))return;
 if(b.dataset.setupPlayer){setupPlayer=b.dataset.setupPlayer;exchangeIds.clear();renderSetup();return;}
 if(b.dataset.mulligan){const id=b.dataset.mulligan;if(exchangeIds.has(id))exchangeIds.delete(id);else exchangeIds.add(id);renderSetup();return;}
 if(b.dataset.paySlot){notify(Game.chooseSlot(b.dataset.paySlot));return;}if(b.dataset.payLand){notify(Game.togglePaymentLand(b.dataset.payLand));return;}
 if(b.dataset.freeUnit){notify(Game.chooseFreeUnit(b.dataset.freeUnit));return;}if(b.dataset.effectTarget){notify(Game.resolveEffectTarget(b.dataset.effectTarget));return;}if(b.dataset.useTrigger){notify(Game.chooseTrigger(b.dataset.useTrigger,true));return;}if(b.dataset.skipTrigger){notify(Game.chooseTrigger(b.dataset.skipTrigger,false));return;}if(b.dataset.attackTarget){notify(Game.chooseAttackTarget(b.dataset.attackTarget));return;}
 if(b.dataset.blocker){notify(Game.chooseBlocker(b.dataset.blocker));return;}if(b.dataset.discard){notify(Game.toggleDiscard(b.dataset.discard));return;}
 if(b.dataset.card){selected=b.dataset.card;if(modalView==='list'){$('#modal').close();modalView=null;}render();return;}
 if(b.dataset.list){const [p,z]=b.dataset.list.split('/');openModal(`${Game.label(p)}・${Game.ZONES.find(x=>x.id===z).name} (${Game.state[p][z].length}枚)`,`<p>${z==='landDeck'?'土地デッキは裏向きで表示します。個体を選ぶと補助操作で移動・内容確認ができます。':'山札は先頭が上、末尾が下です。'}</p><div class="list">${Game.state[p][z].map(c=>cardHTML(c,{hide:hidden(p,z,c),p,z})).join('')||'カードなし'}</div>`,'list');return;}
 if(b.dataset.ready)notify(Game.readyMana(b.dataset.ready));if(b.dataset.draw)notify(Game.draw(b.dataset.draw));if(b.dataset.shuffle){const [p,z]=b.dataset.shuffle.split('/');notify(Game.shuffle(p,z));}
});
document.addEventListener('change',e=>{if(e.target.dataset.manaColor)notify(Game.chooseManaColor(e.target.dataset.manaColor,e.target.value));});
$('#active').onchange=e=>{active=e.target.value;render();};$('#visibility').onchange=e=>{visibility=e.target.value;render();};$('#compact').onchange=e=>document.body.classList.toggle('compact',e.target.checked);
$('#close').onclick=closeModal;$('#modal').addEventListener('cancel',()=>{if(Game.operation?.kind==='payment')Game.cancelPayment();else if(Game.operation?.kind==='attackTarget')Game.cancelAttackTarget();modalView=null;render();});
$('#reset').onclick=()=>{if(confirm('現在の配置・選択・結果を破棄し、メイン40枚・土地20枚から最初からやり直しますか？')){runner.stop();if(advanceTimer!==null)clearTimeout(advanceTimer);advanceTimer=null;$('#modal').close();modalView=null;selected=null;active='p1';$('#active').value=active;setupPlayer='p1';exchangeIds.clear();notify(Game.reset());}};
$('#add').onclick=()=>{
 if(Game.status!=='ready'||Game.operation||Game.result)return;
 openModal('仮カード追加（ルール外の補助）',`<form id="add-form"><label>追加先<select name="destination">${options()}</select></label><label>名前<input name="name" value="確認用カード" required maxlength="60"></label><label>種類<select name="type"><option>通常</option><option>呪文</option><option>設置物</option><option>土地</option><option>ルリグ</option><option>仮カード</option></select></label><label>不特定コスト<input name="generic" type="number" min="0" max="999" value="0" required></label><div class="cost-inputs">${ManaEngine.colors.map(c=>`<label>${c}<input name="cost-${c}" type="number" min="0" max="99" value="${c==='緑'?1:0}" required></label>`).join('')}</div><label>色<select name="color">${Object.keys(COLORS).map(c=>`<option ${c==='緑'?'selected':''}>${c}</option>`).join('')}</select></label><label>パワー（確認用の通常ユニット）<input name="power" type="number" min="0" max="999999" value="1000" required></label><label><input name="blocker" type="checkbox"> ブロッカー（確認用。初期40枚には追加しません）</label><label>表裏<select name="face"><option value="up">表向き</option><option value="down">裏向き</option></select></label><p>土地にはパワー・能力を設定しません。場に追加したユニットは召喚酔いになります。ターン開始の自動配置とは別です。</p><p id="add-error" role="alert"></p><button type="submit">追加</button></form>`,'add');
 $('#add-form select').value=`${active}/hand`;
 $('#add-form [name="type"]').onchange=e=>{const land=e.target.value==='土地';for(const el of document.querySelectorAll('#add-form input[type=number],#add-form [name=blocker]'))el.disabled=land;};
 $('#add-form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),[p,z]=f.get('destination').split('/'),type=f.get('type');const c=Game.card(f.get('name'),type,f.get('color'),type==='土地'?null:ManaEngine.cost(Number(f.get('generic')),Object.fromEntries(ManaEngine.colors.map(color=>[color,Number(f.get('cost-'+color))]))));c.faceUp=f.get('face')==='up';if(type==='通常'){c.power=Number(f.get('power'));c.abilities=f.has('blocker')?['ブロッカー']:[];}const r=Game.addCard(p,z,c);if(!r.ok){$('#add-error').textContent=r.message;return;}$('#modal').close();modalView=null;notify(r);};
};
const runner=BotRunner.create({game:Game,onChange:notify,onError:message=>{$('#notice').textContent=message;$('#bot-status').textContent='Bot処理を停止しました。再開できます。';$('#retry-bot').hidden=false;}});
const retry=document.createElement('button');retry.id='retry-bot';retry.textContent='Botを再開';retry.hidden=true;$('#bot-status').after(retry);retry.onclick=()=>{retry.hidden=true;runner.retry();};
function startMode(mode){runner.stop();modeChosen=true;selected=null;setupPlayer='p1';exchangeIds.clear();active='p1';visibility='active';$('#active').value='p1';$('#visibility').value='active';$('#modal').close();modalView=null;retry.hidden=true;notify(Game.reset(mode));}
$('#start-solo').onclick=()=>startMode('solo');$('#start-bot').onclick=()=>startMode('bot');
$('#change-mode').onclick=()=>{if(confirm('現在の対戦を終了し、モード選択へ戻りますか？')){runner.stop();Game.reset('solo');modeChosen=false;selected=null;exchangeIds.clear();$('#modal').close();modalView=null;retry.hidden=true;render();}};
render();
