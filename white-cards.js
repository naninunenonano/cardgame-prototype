(function(root){
'use strict';
function install(M,cards,awakened){
 cards.wu2={
  key:"wu2", name:"天命の大号令", rarity:"UR", color:"白", type:"呪文",
  civilizations:["白"], deckLimit:3, symbols:{},
  abilities:[],
  onUse:[{"kind":"ownLinkWipe"},{"kind":"linkRandomRestore"}],
  onEnter:[],
  onDefeat:[],
  reduction:{"minimum":{"白":1}},
  text:"自分の場にあるシールドリンクをすべて破壊する。 その後、自分のトラッシュにあるシールドリンクをランダムに選び、設置上限に達するまで可能な限り自分の場に設置する。",
  cost:M.cost(0,{白:8})
 };
 cards.wn3={
  key:"wn3", name:"聖なる雫", rarity:"N", color:"白", type:"呪文",
  civilizations:["白"], deckLimit:3, symbols:{},
  abilities:[],
  onUse:[{"kind":"healLife","count":1},{"kind":"draw","count":1}],
  onEnter:[],
  onDefeat:[],
  reduction:{"minimum":{"白":1}},
  text:"自分のライフを1回復し、カードを1枚引く。",
  cost:M.cost(0,{白:1})
 };
 cards.wr2={
  key:"wr2", name:"浄化の光", rarity:"R", color:"白", type:"呪文",
  civilizations:["白"], deckLimit:3, symbols:{},
  abilities:[],
  onUse:[{"kind":"enemyDamage","amount":3},{"kind":"healLife","count":1}],
  onEnter:[],
  onDefeat:[],
  reduction:{"minimum":{"白":1}},
  text:"相手のクリーチャー1体に3ダメージを与え、自分のライフを1回復する。",
  cost:M.cost(0,{白:3})
 };
 cards.wr3={
  key:"wr3", name:"聖域の裁き", rarity:"R", color:"白", type:"呪文",
  civilizations:["白"], deckLimit:3, symbols:{},
  abilities:[],
  onUse:[{"kind":"destroyUnitTarget"},{"kind":"healLife","count":2}],
  onEnter:[],
  onDefeat:[],
  reduction:{"minimum":{"白":1}},
  text:"相手のクリーチャー1体を破壊し、自分のライフを2回復する。",
  cost:M.cost(0,{白:5})
 };
 cards.ws5={
  key:"ws5", name:"聖域の残響", rarity:"SR", color:"白", type:"設置物",
  civilizations:["白"], deckLimit:3, symbols:{},
  abilities:[],
  onUse:[],
  onEnter:[],
  onDefeat:[],
  reduction:{"minimum":{"白":1}},
  shieldLink:true,
  linkLifetime:2,
  onStart:[{"kind":"echoExpire"}],
  onStructureDestroy:[{"kind":"draw","count":1},{"kind":"healLife","count":2}],
  text:"設置した次の次の自分のターン開始時に、このカードを破壊する。 このカードが破壊されたとき、カードを1枚引き、自分のライフを2回復する。",
  cost:M.cost(0,{白:1})
 };
 cards.wn4={
  key:"wn4", name:"クラッシュ・フォックス", rarity:"N", color:"白", type:"通常",
  civilizations:["白"], deckLimit:3, symbols:{},
  attack:1, maxHealth:2,
  abilities:[],
  onUse:[],
  onEnter:[{"kind":"ownLinkDestroy"},{"kind":"draw","count":1}],
  onDefeat:[],
  reduction:{"minimum":{"白":1}},
  text:"登場時：自分のシールドリンク1枚を破壊する。その後、カードを1枚引く。",
  cost:M.cost(1,{白:1})
 };
 cards.wn5={
  key:"wn5", name:"クラッシュ・ラビット", rarity:"N", color:"白", type:"通常",
  civilizations:["白"], deckLimit:3, symbols:{},
  attack:1, maxHealth:2,
  abilities:[],
  onUse:[],
  onEnter:[{"kind":"ownLinkDestroy"},{"kind":"healLife","count":2}],
  onDefeat:[],
  reduction:{"minimum":{"白":1}},
  text:"登場時：自分のシールドリンク1枚を破壊する。その後、自分のライフを2回復する。",
  cost:M.cost(1,{白:1})
 };
 cards.wr4={
  key:"wr4", name:"聖域の案内人", rarity:"R", color:"白", type:"通常",
  civilizations:["白"], deckLimit:3, symbols:{},
  attack:2, maxHealth:2,
  abilities:[],
  onUse:[],
  onEnter:[{"kind":"lumiereSearch"},{"kind":"whiteShuffle"}],
  onDefeat:[],
  reduction:{"minimum":{"白":1}},
  text:"登場時：自分の通常デッキからシールドリンクをランダムに1枚選び、手札に加える。その後、山札をシャッフルする。",
  cost:M.cost(2,{白:1})
 };
 cards.wo1={
  key:"wo1", name:"守護龍5000SW", rarity:"OR", color:"白", type:"通常",
  civilizations:["白"], deckLimit:3, symbols:{"白":2},
  attack:10, maxHealth:10,
  abilities:[],
  onUse:[],
  onEnter:[{"kind":"enemyUnitSweep","amount":5}],
  onDefeat:[],
  reduction:{"minimum":{"白":1}},
  mainDeckOnly:true,
  linkReductionPerCard:2,
  replaceWeakEntry:true,
  text:"自分の場のシールドリンク1枚につき、このカードの無色コストを2軽減する。 登場時：相手のクリーチャーすべてに5ダメージを与える。 いずれかのプレイヤーが攻撃力3以下のクリーチャーを場に出す場合、代わりにそのカードをトラッシュに置く。",
  cost:M.cost(10,{白:2})
 };
 cards.wr5={
  key:"wr5", name:"聖域の再建", rarity:"R", color:"白", type:"呪文",
  civilizations:["白"], deckLimit:3, symbols:{},
  abilities:[],
  onUse:[{"kind":"linkRebuild","remaining":2}],
  onEnter:[],
  onDefeat:[],
  reduction:{"minimum":{"白":1}},
  text:"自分のトラッシュからコスト1のシールドリンクを最大2枚、設置上限を守って場に出す。",
  cost:M.cost(2,{白:1})
 };
 cards.ws6={
  key:"ws6", name:"聖域の転換", rarity:"SR", color:"白", type:"呪文",
  civilizations:["白"], deckLimit:3, symbols:{},
  abilities:[],
  onUse:[{"kind":"ownLinkDestroy","convert":true}],
  onEnter:[],
  onDefeat:[],
  reduction:{"minimum":{"白":1}},
  text:"自分のシールドリンク1枚を破壊する。その後、破壊したカードのコスト＋3以下のシールドリンク1枚を手札からコストを支払わずに場に出してもよい。",
  cost:M.cost(1,{白:1})
 };
 cards.wr6={
  key:"wr6", name:"聖域の威光", rarity:"R", color:"白", type:"呪文",
  civilizations:["白"], deckLimit:3, symbols:{},
  abilities:[],
  onUse:[{"kind":"enemyUnitSweep","perLink":2}],
  onEnter:[],
  onDefeat:[],
  reduction:{"minimum":{"白":1}},
  text:"自分の場のシールドリンクの枚数×2のダメージを、相手のクリーチャーすべてに与える。",
  cost:M.cost(4,{白:1})
 };
 cards.lumiere_sbwl1={
  key:"lumiere_sbwl1", name:"スカルフェイン", rarity:"LEGEND", color:"白", type:"通常",
  civilizations:["白"], deckLimit:3, symbols:{"白":2},
  attack:4, maxHealth:4,
  sideboardOnly:true,
  deckSection:"sideboard",
  requiredCharacter:"lumiere",
  abilities:[],
  onUse:[],
  onEnter:[{"kind":"skullWipe"}],
  onDefeat:[],
  bothLinkReduction:true,
  text:"場にあるシールドリンク1枚につき無色コストを1軽減。登場時、双方のシールドリンクをすべて破壊。この効果で破壊した1枚につき相手に1ダメージを与え、自分のライフを1回復。",
  cost:M.cost(10,{白:3})
 };
 cards.sbwu1={
  key:"sbwu1", name:"聖霊王アルカディアス", rarity:"UR", color:"白", type:"通常",
  civilizations:["白"], deckLimit:3, symbols:{"白":1},
  attack:6, maxHealth:6,
  sideboardOnly:true,
  deckSection:"sideboard",
  abilities:[],
  onUse:[],
  onEnter:[],
  onDefeat:[],
  evolution:{"color":"白"},
  whiteSpellOnly:true,
  text:"進化：白のクリーチャー1体。お互いのプレイヤーは白以外の呪文を唱えられない。",
  cost:M.cost(0,{白:6})
 };
 cards.lumiere_sbwr1={
  key:"lumiere_sbwr1", name:"メダリオン・チャージャー", rarity:"R", color:"白", type:"呪文",
  civilizations:["白"], deckLimit:3, symbols:{},
  sideboardOnly:true,
  deckSection:"sideboard",
  requiredCharacter:"lumiere",
  abilities:[],
  onUse:[{"kind":"medallionDawn"},{"kind":"untapMana","count":1},{"kind":"manaToken","color":"白"}],
  onEnter:[],
  onDefeat:[],
  viceOnly:true,
  text:"リュミエールLv2への成長直後のみ任意使用。黎明の紋章を1枚設置し、マナを1回復して白マナトークン1つを生成。",
  cost:M.cost(0,{白:0})
 };
 const crest={
  key:'sbwl1',name:'始まりの紋章',color:'白',civilizations:['白'],rarity:'LEGEND',
  type:'設置物',sideboardOnly:true,shieldLink:true,neverendCrest:true,deckLimit:1,
  cost:M.cost(0,{白:4}),symbols:{},abilities:[],onUse:[],
  onEnter:[{kind:'tokens',tokenKey:'t10',count:2}],
  text:'設置時、ラ・ウラ・ギガを2体出す。自分のシールドリンクが5枚になった時、他のリンクをすべて破壊し覚醒する。場を離れたらサイドボードへ戻る。'
 };
 cards.sbwl1=crest;
 awakened['sbwl1-2']={...crest,name:'真・天命王 ネバーエンド',type:'通常',
  shieldLink:false,neverendCrest:false,escapeLink:true,cost:null,attack:7,maxHealth:7,symbols:{白:1},onEnter:[],
  text:'エスケープ：破壊される時、代わりに自分のシールドリンク1枚を破壊してもよい。そうした場合、破壊を防ぎ、体力を全回復する。場を離れたらサイドボードへ戻る。'};
 cards.t10={key:'t10',name:'ラ・ウラ・ギガ',type:'通常',color:'白',civilizations:['白'],
  cost:null,attack:0,maxHealth:1,symbols:{},abilities:['ブロッカー'],cannotAttack:true,
  token:true,onEnter:[],text:'攻撃不可。場を離れれば消滅。'};

}
root.WhiteCards={install};
if(typeof module==='object'&&module.exports)module.exports=root.WhiteCards;
})(globalThis);
