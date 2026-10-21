'use strict';
// 表示名・枠の定義。既存キーを保ち、CSSの配置定義を再利用する。
const ZONES = [
  {id:'signi-1',name:'シグニ1',class:'signi'},
  {id:'signi-2',name:'シグニ2',class:'signi'},
  {id:'signi-3',name:'シグニ3',class:'signi'},
  {id:'lrig',name:'ルリグ',class:'lrig'},
  {id:'extra',name:'サイドボード',pile:true},
  {id:'main',name:'メインデッキ',pile:true},
  {id:'life',name:'シールド',pile:true},
  {id:'energy',name:'マナゾーン'},
  {id:'trash',name:'トラッシュ',pile:true},
  {id:'check',name:'チェックゾーン'},
  {id:'hand',name:'手札',class:'hand'}
];
const CONFIG = {deck:60, hand:7, shields:7, sideboard:10, sameName:3};
const COLORS = {白:'#b6a461',赤:'#cf6265',青:'#599dd4',緑:'#61b18c',黒:'#796a9d',無色:'#859aa4'};
const PLAYERS = ['p1','p2'];
const $ = s => document.querySelector(s);
const label = p => p==='p1'?'プレイヤー1':'プレイヤー2';
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let serial=0, selected=null, active='p1', visibility='active', state;
let phase='mulligan', setupPlayer='p1', mulligan, exchangeSelection=new Set();

function createCard(name,type,color,faceUp=true,cost=null,basic=false,origin=null) {
  return {id:`card-${++serial}`,name,type,color,cost,basic,origin,faceUp,rest:false};
}
function buildDeck(p) {
  const cards=[];
  for(let cost=1;cost<=12;cost++) {
    for(let copy=0;copy<3;copy++) cards.push(createCard(`赤・${cost}コスト`,'通常','赤',false,cost,false,p));
  }
  for(let i=0;i<24;i++) cards.push(createCard('赤の基本土地','土地','赤',false,null,true,p));
  return cards;
}
function validateDeck(cards) {
  if(cards.length!==CONFIG.deck) throw Error('メインデッキは60枚です。');
  const names=new Map();
  for(const card of cards) {
    if(card.basic&&card.type==='土地') continue;
    names.set(card.name,(names.get(card.name)||0)+1);
    if(names.get(card.name)>CONFIG.sameName) throw Error('基本土地以外の同名カードは3枚までです。');
  }
}
function shuffle(p,z) {
  const cards=state[p][z];
  for(let i=cards.length-1;i>0;i--) {
    const j=Math.floor(Math.random()*(i+1));
    [cards[i],cards[j]]=[cards[j],cards[i]];
  }
}
// 開始処理専用。通常操作の制限を迂回する公開操作としては使わない。
function deal(p,z,count,faceUp) {
  const cards=state[p].main.splice(0,count);
  cards.forEach(card=>{card.faceUp=faceUp;card.rest=false;});
  state[p][z].push(...cards);
}
function initial() {
  serial=0; selected=null; phase='mulligan'; setupPlayer='p1';
  exchangeSelection=new Set();
  mulligan={p1:'pending',p2:'pending'};
  state={};
  for(const p of PLAYERS) {
    state[p]=Object.fromEntries(ZONES.map(z=>[z.id,[]]));
    state[p].main=buildDeck(p);
    validateDeck(state[p].main);
    shuffle(p,'main');
    deal(p,'hand',CONFIG.hand,true);
  }
}
// シールド配置のタイミングを変更する場合は、この開始完了処理を変更する。
function finishSetup() {
  if(phase!=='mulligan'||PLAYERS.some(p=>mulligan[p]!=='done')) return;
  phase='dealing';
  for(const p of PLAYERS) deal(p,'life',CONFIG.shields,false);
  selected=null; exchangeSelection.clear(); phase='ready';
}
function completeMulligan(p,ids=[],skip=false) {
  if(phase!=='mulligan'||mulligan[p]!=='pending') return false;
  const unique=new Set(ids);
  if(unique.size!==ids.length||ids.length>CONFIG.hand||
     ids.some(id=>!state[p].hand.some(c=>c.id===id))||
     state[p].main.length<ids.length) return false;
  // 同期処理の開始時に完了へ進め、連打・古いイベントで再実行しない。
  mulligan[p]='done';
  if(!skip) {
    const chosen=state[p].hand.filter(c=>unique.has(c.id));
    state[p].hand=state[p].hand.filter(c=>!unique.has(c.id));
    chosen.forEach(card=>{card.faceUp=false;card.rest=false;});
    state[p].main.push(...chosen);       // 先に下へ戻す
    deal(p,'hand',chosen.length,true);   // シャッフル前の上から同数引く
    shuffle(p,'main');                  // 引き終わってから全体をシャッフル
  }
  exchangeSelection.clear();
  setupPlayer=PLAYERS.find(player=>mulligan[player]==='pending')||p;
  finishSetup();
  return true;
}
function locate(id) {
  for(const p of PLAYERS) for(const z of ZONES) {
    const index=state[p][z.id].findIndex(c=>c.id===id);
    if(index>=0) return {p,z:z.id,index,card:state[p][z.id][index]};
  }
  return null;
}
function placementError(card,p,z,source=null) {
  if(phase!=='ready') return 'マリガン完了まで通常の壁打ち操作はできません。';
  if(z==='energy'&&card.type!=='土地') return '土地以外のカードはマナゾーンに置けません。';
  if(z==='extra'&&state[p].extra.length>=CONFIG.sideboard&&!(source?.p===p&&source?.z===z)) return 'サイドボードは10枚枠です。';
  return '';
}
function move(id,p,z,bottom=false) {
  const source=locate(id);
  if(!source||!state[p]?.[z]) return false;
  const reason=placementError(source.card,p,z,source);
  if(reason){say(reason);return false;}
  const [card]=state[source.p][source.z].splice(source.index,1);
  if(bottom) state[p][z].push(card); else state[p][z].unshift(card);
  return true;
}
function addCard(p,z,card) {
  if(!state[p]?.[z]) return false;
  const reason=placementError(card,p,z);
  if(reason){say(reason);return false;}
  state[p][z].push(card);
  return true;
}
function manaCounts(p) {
  const cards=state[p].energy;
  return {total:cards.length,upright:cards.filter(c=>!c.rest).length,sideways:cards.filter(c=>c.rest).length};
}
function readyMana(p) {
  if(phase!=='ready') return false;
  state[p].energy.forEach(c=>c.rest=false);
  return true;
}
function hidden(p,z,c) {return !c.faceUp||(z==='hand'&&visibility==='active'&&p!==active);}
function cardHTML(c,hide=false) {
  const cost=c.type==='土地'?'配置コスト未設定':c.cost===null?'コスト未設定':`コスト ${c.cost}`;
  return `<button class="card ${!hide&&c.type==='土地'?'land':''} ${hide?'back':''} ${c.rest?'rest':''} ${selected===c.id?'selected':''}" style="--color:${COLORS[c.color]}" data-card="${c.id}" aria-label="${hide?'裏向きカード':esc(c.name)}${c.rest?'・横向き':''}">${hide?'<strong>仮カード<br>裏向き</strong>':`<strong>${c.type==='土地'?'◆ 土地<br>':''}${esc(c.name)}</strong><span>${esc(c.type)} / ${esc(c.color)}<br>${cost}</span><em>${c.id}</em>`}</button>`;
}
function renderSetup() {
  $('#setup').hidden=phase==='ready';
  if(phase==='ready') {$('#setup').innerHTML='';return;}
  $('#setup').innerHTML=`<h2>開始準備：マリガン</h2><p>交換は各自1回まで。交換する手札をタップしてください。シールドは両者の完了後に配置します。</p><div class="setup-tabs">${PLAYERS.map(p=>`<button data-setup-player="${p}" ${mulligan[p]==='done'?'disabled':''} aria-pressed="${setupPlayer===p}">${label(p)}：${mulligan[p]==='done'?'完了':'未選択'}</button>`).join('')}</div><h3>${label(setupPlayer)}の初期手札：7枚</h3><div class="mulligan-hand">${state[setupPlayer].hand.map(c=>cardHTML(c).replace('data-card=','data-mulligan=').replace('class="card ',`aria-pressed="${exchangeSelection.has(c.id)}" class="card ${exchangeSelection.has(c.id)?'selected':''} `)).join('')}</div><p id="exchange-count" role="status">選択中：${exchangeSelection.size}枚 / 7枚</p><div class="setup-actions"><button id="exchange">${exchangeSelection.size}枚交換する</button><button id="keep">交換せず開始</button></div><p>選んだカードを山札の下へ → 同数ドロー → 山札をシャッフル。</p>`;
  // pを描画時に固定し、以前のボタンを連打しても次のプレイヤーに作用させない。
  const p=setupPlayer;
  $('#exchange').onclick=()=>{if(completeMulligan(p,[...exchangeSelection])) finish(phase==='ready'?'準備完了。シールドを7枚ずつ配置しました。':'交換が完了しました。もう一人の選択へ進みます。');};
  $('#keep').onclick=()=>{if(completeMulligan(p,[],true)) finish(phase==='ready'?'準備完了。シールドを7枚ずつ配置しました。':'手札を確定しました。もう一人の選択へ進みます。');};
}
function options() {
  return PLAYERS.map(p=>`<optgroup label="${label(p)}">${ZONES.map(z=>`<option value="${p}/${z.id}">${label(p)}・${z.name}</option>`).join('')}</optgroup>`).join('');
}
function render() {
  $('#current-mode').textContent='マナ：土地のみ';
  $('#normal-controls').disabled=phase!=='ready';
  $('#board').hidden=phase!=='ready';
  $('#control').hidden=phase!=='ready';
  renderSetup();
  const scrolls=new Map([...document.querySelectorAll('.zone')].map(e=>[`${e.dataset.player}/${e.dataset.zone}`,e.querySelector('.cards').scrollLeft]));
  $('#board').innerHTML=['p2','p1'].map(p=>`<section class="player ${p==='p2'?'opponent':'self'} ${active===p?'active':''}" aria-label="${label(p)}の盤面"><h2 class="player-title">${label(p)} ${p==='p2'?'／ 相手側':'／ 自分側'} <span>${active===p?'● 操作対象':''}</span></h2><div class="layout">${ZONES.map(z=>{
    const a=state[p][z.id];
    return `<section class="zone ${z.class||''}" data-player="${p}" data-zone="${z.id}"><div class="zone-title"><b>${z.name}</b><span class="count">${a.length}${z.id==='extra'?'/10':''}枚${z.id==='energy'?`<small class="mana-counts">縦 ${manaCounts(p).upright} / 横 ${manaCounts(p).sideways}</small>`:''}</span></div><div class="cards">${(z.pile?a.slice(0,1):a).map(c=>cardHTML(c,hidden(p,z.id,c))).join('')||'<span class="empty">カードなし</span>'}</div><div class="zone-tools">${z.id==='energy'?`<button data-ready="${p}">すべて縦向き</button>`:''}<button data-list="${p}/${z.id}">一覧 (${a.length})</button>${z.id==='main'?`<button data-draw="${p}">ドロー</button>`:''}${['main','extra'].includes(z.id)?`<button data-shuffle="${p}/${z.id}">シャッフル</button>`:''}</div></section>`;
  }).join('')}</div></section>`).join('');
  for(const e of document.querySelectorAll('.zone')) e.querySelector('.cards').scrollLeft=scrolls.get(`${e.dataset.player}/${e.dataset.zone}`)||0;
  renderControl();
}
function renderControl() {
  const s=locate(selected);
  $('#control').innerHTML=s?`<p><b>選択中：${esc(s.card.name)}</b> ／ ${label(s.p)}・${ZONES.find(z=>z.id===s.z).name} ／ ${s.card.faceUp?'表向き':'裏向き'}・${s.card.rest?'横向き':'縦向き'}</p><div class="actions"><select id="destination" aria-label="移動先">${options()}</select><button id="move">移動</button>${s.z==='hand'?'<button id="to-mana">マナに置く</button>':''}<button id="flip">表裏切替</button><button id="rotate">縦横切替</button><button id="peek">拡大・内容確認</button><button id="top">山札の上へ</button><button id="bottom">山札の下へ</button><button id="delete">削除</button><button id="unselect">選択解除</button></div>`:'<p>カード未選択 — カード、または領域の「一覧」をタップしてください。</p>';
  if(!s||phase!=='ready') return;
  $('#destination').value=`${s.p}/${s.z}`;
  $('#move').onclick=()=>{const [p,z]=$('#destination').value.split('/');if(move(selected,p,z))finish('カードを移動しました。');};
  if(s.z==='hand') $('#to-mana').onclick=()=>{if(move(selected,s.p,'energy'))finish('マナゾーンに置きました。');};
  $('#flip').onclick=()=>{if(phase!=='ready')return;s.card.faceUp=!s.card.faceUp;finish('表裏を切り替えました。');};
  $('#rotate').onclick=()=>{if(phase!=='ready')return;s.card.rest=!s.card.rest;finish('縦横を切り替えました。');};
  $('#peek').onclick=()=>openModal('カードの内容確認',`<div class="preview">${cardHTML({...s.card,rest:false})}</div><p>${esc(s.card.id)} ／ 現在は${s.card.faceUp?'表向き':'裏向き'}。この確認では表裏・縦横を変更しません。</p>`);
  for(const [id,bottom] of [['top',false],['bottom',true]]) $('#'+id).onclick=()=>{
    const [p,z]=$('#destination').value.split('/');
    if(!['main','extra'].includes(z)){say('移動先でメインデッキかサイドボードを選んでください。');return;}
    if(move(selected,p,z,bottom))finish(`${ZONES.find(a=>a.id===z).name}の${bottom?'下':'上'}に戻しました。`);
  };
  $('#delete').onclick=()=>{if(phase!=='ready')return;state[s.p][s.z].splice(s.index,1);selected=null;finish('カードを削除しました。');};
  $('#unselect').onclick=()=>{selected=null;render();};
}
function say(message) {$('#notice').textContent=message;}
function finish(message) {render();say(message);}
function openModal(title,body) {
  $('#modal-title').textContent=title;$('#modal-body').innerHTML=body;
  if(!$('#modal').open)$('#modal').showModal();
}
function showList(p,z) {
  openModal(`${label(p)}・${ZONES.find(a=>a.id===z).name} (${state[p][z].length}枚)`,`<p>先頭が上、末尾が下です。カードをタップして選択します。</p><div class="list">${state[p][z].map(c=>cardHTML(c,hidden(p,z,c))).join('')||'カードなし'}</div>`);
}
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(phase==='mulligan') {
    if(b.dataset.setupPlayer&&mulligan[b.dataset.setupPlayer]==='pending') {setupPlayer=b.dataset.setupPlayer;exchangeSelection.clear();renderSetup();}
    if(b.dataset.mulligan&&mulligan[setupPlayer]==='pending'&&state[setupPlayer].hand.some(c=>c.id===b.dataset.mulligan)) {
      const id=b.dataset.mulligan;
      if(exchangeSelection.has(id))exchangeSelection.delete(id);else exchangeSelection.add(id);
      renderSetup();
    }
    return;
  }
  if(phase!=='ready')return;
  if(b.dataset.ready){readyMana(b.dataset.ready);finish('マナをすべて縦向きに戻しました。');return;}
  if(b.dataset.card){selected=b.dataset.card;if($('#modal').open)$('#modal').close();render();say('カードを選択しました。');}
  if(b.dataset.list)showList(...b.dataset.list.split('/'));
  if(b.dataset.draw){const p=b.dataset.draw,c=state[p].main[0];if(c){if(move(c.id,p,'hand'))finish('1枚ドローしました。表裏・縦横は保持します。');}else say('メインデッキは空です。');}
  if(b.dataset.shuffle){shuffle(...b.dataset.shuffle.split('/'));finish('シャッフルしました。');}
});
$('#active').onchange=e=>{if(phase!=='ready')return;active=e.target.value;finish('操作対象を切り替えました。配置は変わりません。');};
$('#visibility').onchange=e=>{if(phase!=='ready')return;visibility=e.target.value;render();};
$('#compact').onchange=e=>document.body.classList.toggle('compact',e.target.checked);
$('#close').onclick=()=>$('#modal').close();
$('#reset').onclick=()=>{
  if(confirm('現在の配置を破棄し、60枚のデッキと初期手札7枚で最初からやり直しますか？')) {
    if($('#modal').open)$('#modal').close();
    initial();finish('新しいデッキを配りました。各自のマリガンを選択してください。');
  }
};
$('#add').onclick=()=>{
  if(phase!=='ready')return;
  openModal('仮カードを追加',`<form id="add-form"><label>追加先<select name="destination">${options()}</select></label><label>名前<input name="name" value="仮カード ${serial+1}" required maxlength="60"></label><label>種類<select name="type"><option>通常</option><option>土地</option><option>ルリグ</option><option>仮カード</option></select></label><label>コスト（通常カード用）<input name="cost" type="number" min="0" max="999" step="1" value="1"></label><label>色<select name="color">${Object.keys(COLORS).map(c=>`<option>${c}</option>`).join('')}</select></label><label>表裏<select name="face"><option value="up">表向き</option><option value="down">裏向き</option></select></label><p>追加は壁打ち用です。初期の60枚には含めません。土地の配置コストは未設定です。</p><p id="add-error" role="alert"></p><button type="submit">追加</button></form>`);
  $('#add-form select').value=`${active}/hand`;
  $('#add-form [name="type"]').onchange=e=>{$('#add-form [name="cost"]').disabled=e.target.value==='土地';};
  $('#add-form').onsubmit=e=>{
    e.preventDefault();if(phase!=='ready')return;
    const f=new FormData(e.target),[p,z]=f.get('destination').split('/');
    const card=createCard(f.get('name'),f.get('type'),f.get('color'),f.get('face')==='up',f.get('type')==='土地'?null:Number(f.get('cost')));
    if(!addCard(p,z,card)){$('#add-error').textContent=placementError(card,p,z);return;}
    $('#modal').close();finish('仮カードを追加しました。');
  };
};
initial();render();
