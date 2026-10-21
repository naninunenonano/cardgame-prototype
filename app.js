'use strict';
var Game=GameRules.create();
const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const COLORS={白:'#b6a461',赤:'#cf6265',青:'#599dd4',緑:'#61b18c',黒:'#796a9d',無色:'#859aa4'};
let selected=null,active='p1',visibility='active',setupPlayer='p1',exchangeIds=new Set(),advanceTimer=null,modalView=null;
function hidden(p,z,c){return !c.faceUp||(z==='hand'&&visibility==='active'&&p!==active);}
function cardHTML(c,{hide=false,p=null,z=null,selectMode='card',chosen=false}={}) {
 const ability=c.abilities.length?c.abilities.join('・'):'なし';
 const cost=c.type==='土地'?'配置コストなし':c.cost?ManaEngine.describe(c.cost):'コスト未設定';
 const play=z==='hand'&&!hide&&Game.status==='ready'?Game.playStatus(c,p):null;
 const stateText=`${c.rest?'使用済み':'未使用'}${c.sick?'・召喚酔い':''}`;
 return `<button class="card ${c.type==='土地'&&!hide?'land':''} ${hide?'back':''} ${c.rest?'rest':''} ${chosen||selected===c.id?'selected':''} ${play?(play.ok?'playable':'unplayable'):''}" style="--color:${COLORS[c.color]}" data-${selectMode}="${c.id}" ${selectMode!=='card'?`aria-pressed="${chosen}"`:''} aria-label="${hide?'裏向きカード':esc(c.name)}・${stateText}">${hide?'<strong>裏向きカード</strong>':`<strong>${esc(c.name)}</strong><span>${esc(c.type)} / ${esc(c.color)}<br>コスト：${cost}${c.type==='通常'?`<br>パワー：${c.power??'未設定'}`:''}<br>能力：${esc(ability)}</span><em>${c.id}</em>`}${play?`<span class="play-status">${esc(play.text)}</span>`:''}<span class="mana-state ${c.rest?'spent':''}">${stateText}</span></button>`;
}
function notify(result){$('#notice').textContent=result.message||'';render();if(Game.operation)renderOperation();}
function renderSetup(){
 $('#setup').hidden=Game.status==='ready'||!!Game.result;
 if($('#setup').hidden){$('#setup').innerHTML='';return;}
 if(Game.mulligan[setupPlayer]==='done')setupPlayer=Game.PLAYERS.find(p=>Game.mulligan[p]==='pending')||'p1';
 $('#setup').innerHTML=`<h2>開始準備：マリガン</h2><p>各自1回、0〜7枚を交換できます。両者完了後にシールドを7枚配置します。</p><div class="setup-tabs">${Game.PLAYERS.map(p=>`<button data-setup-player="${p}" ${Game.mulligan[p]==='done'?'disabled':''}>${Game.label(p)}：${Game.mulligan[p]==='done'?'完了':'未選択'}</button>`).join('')}</div><h3>${Game.label(setupPlayer)}の初期手札：7枚</h3><div class="mulligan-hand">${Game.state[setupPlayer].hand.map(c=>cardHTML(c,{selectMode:'mulligan',chosen:exchangeIds.has(c.id)})).join('')}</div><p id="exchange-count">選択中：${exchangeIds.size}枚 / 7枚</p><div class="setup-actions"><button id="exchange">${exchangeIds.size}枚交換する</button><button id="keep">交換せず開始</button></div><p>下へ戻す → 同数ドロー → シャッフル。引き直す前にはシャッフルしません。</p>`;
 const p=setupPlayer;
 $('#exchange').onclick=()=>{const r=Game.completeMulligan(p,[...exchangeIds]);if(r.ok)exchangeIds.clear();notify(r);};
 $('#keep').onclick=()=>{const r=Game.completeMulligan(p,[],true);if(r.ok)exchangeIds.clear();notify(r);};
}
function renderTurn(){
 const ready=Game.status==='ready',turn=Game.turn,mana=Game.availableMana('p1');
 const progression=Object.entries(Game.STEPS).map(([key,name])=>`<span class="${key===turn.step?'current-step':''}">${name}</span>`).join(' → ');
 const names={main1:'アタックへ',attack:'メイン2へ',main2:'エンドへ',end:'次のターン'};
 const nextId=turn.step==='end'?'next-turn':'next-phase';
 $('#turn-panel').innerHTML=`<div><b>${Game.result?`${Game.label(Game.result.loser)}の敗北：${Game.result.reason}`:ready?`自分（プレイヤー1）の第${turn.number}ターン ／ ${Game.STEPS[turn.step]}`:'開始準備中'}</b><span class="turn-land">土地配置：${turn.landsPlaced?'配置済み（1/1）':'未配置（0/1）'}</span><small>${ready&&turn.number===1?'先攻第1ターン：ドローなし':'壁打ち：相手のターンを挟みません'}</small><small>未使用土地から出せるマナ：合計${mana.total}点 ／ ${ManaEngine.colors.map(c=>`${c}${mana[c]}`).join('・')}</small><div class="phase-track">${progression}</div></div><div class="turn-buttons">${Game.operation?'<button id="resume-operation">選択を再開</button>':''}<button id="${nextId}" ${!Game.canAdvance?'disabled':''}>${names[turn.step]||'処理中'}</button></div>`;
 const key=turn.key;
 $('#'+nextId).onclick=()=>{selected=null;notify(Game.advance(key));};
 if($('#resume-operation'))$('#resume-operation').onclick=renderOperation;
 if(advanceTimer!==null)clearTimeout(advanceTimer);
 const delay=turn.notBefore-Date.now();if(delay>0)advanceTimer=setTimeout(()=>{advanceTimer=null;renderTurn();},delay+10);
}
function options(){return Game.PLAYERS.map(p=>`<optgroup label="${Game.label(p)}">${Game.ZONES.map(z=>`<option value="${p}/${z.id}">${Game.label(p)}・${z.name}</option>`).join('')}</optgroup>`).join('');}
function renderZone(p,z){
 const a=Game.state[p][z.id],mana=Game.availableMana(p);
 return `<section class="zone ${z.class||''}" data-player="${p}" data-zone="${z.id}"><div class="zone-title"><b>${z.name}</b><span class="count">${a.length}${z.id==='extra'?'/10':''}枚</span></div>${z.id==='energy'?`<p class="mana-summary">未使用土地から出せるマナ：合計${mana.total}点<br>${ManaEngine.colors.map(c=>`${c}${mana[c]}`).join('・')}<br>縦 ${a.filter(c=>!c.rest).length} / 横 ${a.filter(c=>c.rest).length}</p>`:''}<div class="cards">${(z.pile?a.slice(0,1):a).map(c=>cardHTML(c,{hide:hidden(p,z.id,c),p,z:z.id})).join('')||'<span class="empty">カードなし</span>'}</div><div class="zone-tools"><button data-list="${p}/${z.id}">一覧 (${a.length})</button>${z.id==='energy'?`<button data-ready="${p}">手動回復（補助）</button>`:''}${z.id==='main'?`<button data-draw="${p}">手動ドロー（補助）</button>`:''}${['main','extra'].includes(z.id)?`<button data-shuffle="${p}/${z.id}">シャッフル</button>`:''}</div></section>`;
}
function render(){
 $('#current-mode').textContent='壁打ち：自分のターンのみ ／ ユニット7枠・上書き可';
 $('#normal-controls').disabled=Game.status!=='ready'||!!Game.result||!!Game.operation;
 $('#board').hidden=Game.status!=='ready'&&!Game.result;$('#control').hidden=$('#board').hidden;
 renderSetup();renderTurn();
 const scrolls=new Map([...document.querySelectorAll('.zone')].map(el=>[`${el.dataset.player}/${el.dataset.zone}`,el.querySelector('.cards').scrollLeft]));
 $('#board').innerHTML=['p2','p1'].map(p=>`<section class="player ${p==='p2'?'opponent':'self'} ${active===p?'active':''}" data-player="${p}" aria-label="${Game.label(p)}の盤面"><h2 class="player-title">${Game.label(p)} ／ ${p==='p1'?'自分':'相手・手動確認用'}<span>${active===p?'● 確認対象':''}</span></h2><div class="layout"><section class="unit-field" aria-label="${Game.label(p)}のユニット7枠">${Game.ZONES.filter(z=>Game.isUnit(z.id)).map(z=>renderZone(p,z)).join('')}</section>${Game.ZONES.filter(z=>!Game.isUnit(z.id)).map(z=>renderZone(p,z)).join('')}</div></section>`).join('');
 for(const el of document.querySelectorAll('.zone'))el.querySelector('.cards').scrollLeft=scrolls.get(`${el.dataset.player}/${el.dataset.zone}`)||0;
 renderControl();$('#log-count').textContent=Game.log.length;$('#log-list').innerHTML=Game.log.slice().reverse().map(text=>`<li>${esc(text)}</li>`).join('');
}
function renderControl(){
 const s=Game.locate(selected);if(!s){$('#control').innerHTML='<p>カードをタップして操作を選んでください。「手動移動」はルール外の補助です。</p>';return;}
 const playable=s.z==='hand'?Game.playStatus(s.card,s.p):null;
 const attackReason=Game.isUnit(s.z)?Game.attackError(s.card.id):'';
 const locked=!!Game.operation||!!Game.result;
 $('#control').innerHTML=`<p><b>${esc(s.card.name)}</b> ／ ${Game.label(s.p)}・${Game.ZONES.find(z=>z.id===s.z).name} ／ ${s.card.rest?'使用済み':'未使用'}${s.card.sick?'・召喚酔い':''}</p>${playable?`<p class="selected-status">${esc(playable.reasons.join('／')||playable.text)}</p>`:''}${Game.isUnit(s.z)?`<p class="action-status">${esc(attackReason||'相手本体へ攻撃できます。')} ブロックは攻撃への応答で選びます。</p>`:''}<div class="actions">${s.z==='hand'&&s.card.type==='通常'?`<button id="play" ${!playable.ok?'disabled':''}>場に出す</button>`:''}${s.z==='hand'&&s.card.type==='土地'?`<button id="to-mana" ${!playable.ok?'disabled':''}>マナに置く</button>`:''}${Game.isUnit(s.z)&&s.card.type==='通常'?`<button id="attack" ${attackReason?'disabled':''}>本体へ攻撃</button><button id="sick" ${locked?'disabled':''}>召喚酔い切替（補助）</button>`:''}<button id="peek">拡大・内容確認</button><select id="destination" aria-label="手動移動先">${options()}</select><button id="move" ${locked?'disabled':''}>手動移動（ルール外の補助）</button><button id="flip" ${locked?'disabled':''}>表裏切替（補助）</button><button id="rotate" ${locked?'disabled':''}>縦横切替（補助）</button><button id="top" ${locked?'disabled':''}>山札の上へ（補助）</button><button id="bottom" ${locked?'disabled':''}>山札の下へ（補助）</button><button id="delete" ${locked?'disabled':''}>削除（補助）</button><button id="unselect">選択解除</button></div>`;
 $('#destination').value=`${s.p}/${s.z}`;
 if($('#play'))$('#play').onclick=()=>notify(Game.beginPayment(s.card.id));
 if($('#to-mana'))$('#to-mana').onclick=()=>notify(Game.placeLand(s.card.id));
 if($('#attack'))$('#attack').onclick=()=>notify(Game.declareAttack(s.card.id));
 if($('#sick'))$('#sick').onclick=()=>notify(Game.toggle(s.card.id,'sick'));
 $('#move').onclick=()=>{const [p,z]=$('#destination').value.split('/');notify(Game.manualMove(s.card.id,p,z));};
 $('#flip').onclick=()=>notify(Game.toggle(s.card.id,'faceUp'));$('#rotate').onclick=()=>notify(Game.toggle(s.card.id));
 $('#peek').onclick=()=>openModal('カードの拡大確認',`<div class="preview">${cardHTML(s.card)}</div><p>${s.card.id} ／ 表裏・使用状態・召喚酔いは変更しません。</p>`,'peek');
 for(const [id,bottom]of [['top',false],['bottom',true]])$('#'+id).onclick=()=>{const [p,z]=$('#destination').value.split('/');if(!['main','extra'].includes(z)){notify({ok:false,message:'移動先にメインデッキかサイドボードを選んでください。'});return;}notify(Game.manualMove(s.card.id,p,z,bottom));};
 $('#delete').onclick=()=>{const r=Game.remove(s.card.id);if(r.ok)selected=null;notify(r);};$('#unselect').onclick=()=>{selected=null;render();};
}
function openModal(title,body,view='operation'){$('#modal-title').textContent=title;$('#modal-body').innerHTML=body;modalView=view;$('#close').textContent=Game.operation&&Game.operation.kind!=='payment'?'選択を保留':'閉じる';if(!$('#modal').open)$('#modal').showModal();}
function closeModal(){if(Game.operation?.kind==='payment'){const r=Game.cancelPayment();$('#notice').textContent=r.message;}$('#modal').close();modalView=null;render();}
function renderOperation(){
 const o=Game.operation;if(!o)return;
 if(o.kind==='payment'){
  const source=Game.locate(o.id);if(!source)return;
  const check=Game.paymentInfo(o),lands=Game.state[o.p].energy.filter(c=>!c.rest&&c.type==='土地'),mana=ManaEngine.pool(lands.filter(c=>o.landIds.includes(c.id)));
  const replacement=o.replacedId?Game.locate(o.replacedId):null;
  openModal('配置・上書きとマナ支払い',`<p><b>${esc(source.card.name)}</b> ／ 必要：${ManaEngine.describe(source.card.cost)} ／ パワー${source.card.power}</p><p>1. 配置先を選択。満杯の場合は上書き対象を選びます。</p><div class="payment-slots">${Game.placementOptions(o.p).map(z=>`<button data-pay-slot="${z.id}" aria-pressed="${o.slot===z.id}">${z.name}${Game.state[o.p][z.id].length?`：${esc(Game.state[o.p][z.id][0].name)}を上書き`:''}</button>`).join('')}</div><p id="overwrite-info">${replacement?`上書き対象：${esc(replacement.card.name)}（パワー${replacement.card.power}）をトラッシュへ送ります。`:'空き枠への配置です。'}</p><p>2. 支払い土地を確認・変更（必須色を先に確保した自動案）</p><div class="payment-lands">${lands.map(c=>`<button data-pay-land="${c.id}" aria-pressed="${o.landIds.includes(c.id)}"><b>${esc(c.name)}</b><span>${esc(c.mana.color)} ${c.mana.amount}点 ／ ${c.id}</span>${o.landIds.includes(c.id)?'✓ 選択中':'未選択'}</button>`).join('')}</div><p>選択${o.landIds.length}枚／合計${mana.total}点（${ManaEngine.colors.map(c=>`${c}${mana[c]}`).join('・')}）</p><p id="payment-error">${check.ok?'確定時に支払い・上書き・配置をまとめて実行します。':esc(check.message)}</p><div class="setup-actions"><button id="confirm-payment" ${!check.ok?'disabled':''}>支払いを確定して配置</button><button id="cancel-payment">キャンセル</button></div>`);
  $('#confirm-payment').onclick=()=>{const r=Game.confirmPayment(o);if(r.ok){$('#modal').close();modalView=null;}notify(r);};$('#cancel-payment').onclick=closeModal;
 }else if(o.kind==='combat'){
  const a=Game.locate(o.id);if(!a)return;const blockers=Game.blockers(o.defender);
  openModal('防御側：ブロックするか選択',`<p>${esc(a.card.name)}（パワー${a.card.power}）がプレイヤー2本体へ攻撃。攻撃側は使用済みです。</p><p>未使用の「ブロッカー」だけが選べます。召喚酔いでもブロック可能。今回は1枚までです。</p><div class="combat-blockers">${blockers.map(c=>cardHTML(c,{selectMode:'blocker',chosen:o.blockerId===c.id})).join('')||'<p>ブロック可能なユニットはありません。</p>'}</div><div class="setup-actions"><button id="confirm-block" ${!o.blockerId?'disabled':''}>選んだ1枚でブロック</button><button id="no-block">ブロックしない</button></div><p>同パワーは攻撃側有利。ブロック時はシールドへ処理しません。</p>`);
  $('#confirm-block').onclick=()=>{const r=Game.resolveAttack(o.blockerId,o);if(r.ok){$('#modal').close();modalView=null;}notify(r);};$('#no-block').onclick=()=>{const r=Game.resolveAttack(null,o);if(r.ok){$('#modal').close();modalView=null;}notify(r);};
 }else if(o.kind==='discard'){
  openModal('エンド：手札を7枚に調整',`<p>${Game.label(o.p)}の手札${Game.state[o.p].hand.length}枚。<b>${o.required}枚</b>を選び、トラッシュへ送ってください。</p><div class="discard-hand">${Game.state[o.p].hand.map(c=>cardHTML(c,{selectMode:'discard',chosen:o.ids.includes(c.id)})).join('')}</div><p id="discard-count">選択中${o.ids.length}枚／必要${o.required}枚</p><button id="confirm-discard" ${o.ids.length!==o.required?'disabled':''}>選んだカードをトラッシュへ送る</button><p>完了するまで次のターンは開始しません。</p>`);
  $('#confirm-discard').onclick=()=>{const r=Game.confirmDiscard(o);if(r.ok){$('#modal').close();modalView=null;}notify(r);};
 }
}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.setupPlayer){setupPlayer=b.dataset.setupPlayer;exchangeIds.clear();renderSetup();return;}
 if(b.dataset.mulligan){const id=b.dataset.mulligan;if(exchangeIds.has(id))exchangeIds.delete(id);else exchangeIds.add(id);renderSetup();return;}
 if(b.dataset.paySlot){notify(Game.chooseSlot(b.dataset.paySlot));return;}if(b.dataset.payLand){notify(Game.togglePaymentLand(b.dataset.payLand));return;}
 if(b.dataset.blocker){notify(Game.chooseBlocker(b.dataset.blocker));return;}if(b.dataset.discard){notify(Game.toggleDiscard(b.dataset.discard));return;}
 if(b.dataset.card){selected=b.dataset.card;if(modalView==='list'){$('#modal').close();modalView=null;}render();return;}
 if(b.dataset.list){const [p,z]=b.dataset.list.split('/');openModal(`${Game.label(p)}・${Game.ZONES.find(x=>x.id===z).name} (${Game.state[p][z].length}枚)`,`<p>山札は先頭が上、末尾が下です。</p><div class="list">${Game.state[p][z].map(c=>cardHTML(c,{hide:hidden(p,z,c),p,z})).join('')||'カードなし'}</div>`,'list');return;}
 if(b.dataset.ready)notify(Game.readyMana(b.dataset.ready));if(b.dataset.draw)notify(Game.draw(b.dataset.draw));if(b.dataset.shuffle){const [p,z]=b.dataset.shuffle.split('/');notify(Game.shuffle(p,z));}
});
$('#active').onchange=e=>{active=e.target.value;render();};$('#visibility').onchange=e=>{visibility=e.target.value;render();};$('#compact').onchange=e=>document.body.classList.toggle('compact',e.target.checked);
$('#close').onclick=closeModal;$('#modal').addEventListener('cancel',()=>{if(Game.operation?.kind==='payment')Game.cancelPayment();modalView=null;render();});
$('#reset').onclick=()=>{if(confirm('現在の配置・選択・結果を破棄し、60枚のデッキから最初からやり直しますか？')){if(advanceTimer!==null)clearTimeout(advanceTimer);advanceTimer=null;$('#modal').close();modalView=null;selected=null;active='p1';$('#active').value=active;setupPlayer='p1';exchangeIds.clear();notify(Game.reset());}};
$('#add').onclick=()=>{
 if(Game.status!=='ready'||Game.operation||Game.result)return;
 openModal('仮カード追加（ルール外の補助）',`<form id="add-form"><label>追加先<select name="destination">${options()}</select></label><label>名前<input name="name" value="確認用カード" required maxlength="60"></label><label>種類<select name="type"><option>通常</option><option>土地</option><option>ルリグ</option><option>仮カード</option></select></label><label>不特定コスト<input name="generic" type="number" min="0" max="999" value="0" required></label><div class="cost-inputs">${ManaEngine.colors.map(c=>`<label>${c}<input name="cost-${c}" type="number" min="0" max="99" value="${c==='赤'?1:0}" required></label>`).join('')}</div><label>色<select name="color">${Object.keys(COLORS).map(c=>`<option ${c==='赤'?'selected':''}>${c}</option>`).join('')}</select></label><label>パワー（確認用の通常ユニット）<input name="power" type="number" min="0" max="999999" value="1000" required></label><label><input name="blocker" type="checkbox"> ブロッカー（確認用。初期60枚には追加しません）</label><label>表裏<select name="face"><option value="up">表向き</option><option value="down">裏向き</option></select></label><p>土地にはパワー・能力を設定しません。場に追加したユニットは召喚酔いになります。土地配置回数には数えません。</p><p id="add-error" role="alert"></p><button type="submit">追加</button></form>`,'add');
 $('#add-form select').value=`${active}/hand`;
 $('#add-form [name="type"]').onchange=e=>{const land=e.target.value==='土地';for(const el of document.querySelectorAll('#add-form input[type=number],#add-form [name=blocker]'))el.disabled=land;};
 $('#add-form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),[p,z]=f.get('destination').split('/'),type=f.get('type');const c=Game.card(f.get('name'),type,f.get('color'),type==='土地'?null:ManaEngine.cost(Number(f.get('generic')),Object.fromEntries(ManaEngine.colors.map(color=>[color,Number(f.get('cost-'+color))]))));c.faceUp=f.get('face')==='up';if(type==='通常'){c.power=Number(f.get('power'));c.abilities=f.has('blocker')?['ブロッカー']:[];}const r=Game.addCard(p,z,c);if(!r.ok){$('#add-error').textContent=r.message;return;}$('#modal').close();modalView=null;notify(r);};
};
render();
