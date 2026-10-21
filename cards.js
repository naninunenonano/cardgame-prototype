// 色・種類・カード定義・効果列・デッキ構成を分離。今回の開始デッキはgreen。
(function(root,factory){const c=factory(typeof module==='object'&&module.exports?require('./mana.js'):root.ManaEngine);if(typeof module==='object'&&module.exports)module.exports=c;else root.CardCatalog=c;})(globalThis,function(M){
 const COLORS=['白','青','黒','赤','緑'],TYPES={unit:'通常',spell:'呪文',structure:'設置物',land:'土地'};
 const addLand={kind:'land',count:1};
 const defs=[
 {key:'life',name:'フェアリー・ライフ',type:'呪文',cost:M.cost(1,{緑:1}),onUse:[addLand],text:'土地デッキの上から1枚を未使用でマナゾーンへ。'},
 {key:'fortune',name:'豊潤フォージュン',type:'呪文',cost:M.cost(2,{緑:1}),onUse:[addLand,{kind:'drawIfLandMax',max:5,count:1}],text:'土地デッキの上から1枚を未使用でマナゾーンへ。追加後の土地が5枚以下なら1枚ドロー。'},
 {key:'touki',name:'竜の闘気',type:'呪文',cost:M.cost(4,{緑:1}),onUse:[addLand,{kind:'draw',count:2},{kind:'shield',count:1}],provisional:true,text:'土地デッキから1枚追加→2枚ドロー→盾1枚追加。コストは仮値。'},
 {key:'bronze',name:'青銅の鎧',type:'通常',cost:M.cost(3,{緑:1}),power:2000,symbols:{緑:1},breaks:1,onEnter:[addLand],provisional:true,text:'登場時：土地デッキの上から1枚を未使用でマナゾーンへ。色指定は仮値。'},
 {key:'dragon',name:'グラディアン・レッド・ドラゴン',type:'通常',cost:M.cost(4,{緑:6}),power:15000,symbols:{緑:3},breaks:3,text:'緑カード。最大5軽減、最低不特定4＋緑1。'},
 {key:'trap',name:'ナチュラル・トラップ',type:'呪文',cost:M.cost(5,{緑:1}),trigger:{},onUse:[{kind:'trap'}],provisional:true,text:'シールドトリガー。相手ユニット1枚をトラッシュへ。その持ち主が土地デッキの上から1枚を未使用でマナゾーンへ。コストは仮値。'},
 {key:'repair',name:'修復',type:'呪文',cost:M.cost(0,{緑:3}),trigger:{},onUse:[{kind:'shield',count:1,landThreshold:10,extra:1}],text:'シールドトリガー。盾1枚追加。土地10枚以上ならさらに1枚。キャラ制限なし。'},
 {key:'bahamut',deckLimit:1,reduction:null,name:'バハムート',type:'通常',cost:M.cost(10,{緑:1}),power:11000,symbols:{緑:3},breaks:3,onEnter:[{kind:'wipe'}],text:'登場時：本人以外の両者のユニット・設置物をすべてトラッシュへ。土地・盾・キャラ・サイドは対象外。'},
 {key:'bird',name:'極楽鳥',type:'通常',cost:M.cost(0,{緑:1}),power:1000,symbols:{},breaks:0,manaAbility:{colors:COLORS,amount:1},provisional:true,text:'本人を横向きにして任意の1色1点を支払いに使用。召喚酔い中は不可。ブレイク0。パワーは仮値。'},
 {key:'elf',name:'ラノワールのエルフ',type:'通常',cost:M.cost(0,{緑:1}),power:2000,symbols:{},breaks:0,manaAbility:{colors:['緑'],amount:1},provisional:true,text:'本人を横向きにして緑1点を支払いに使用。召喚酔い中は不可。ブレイク0。パワーは仮値。'},
 {key:'panzer',name:'タマタンゴ・パンツァー',type:'通常',cost:M.cost(5,{緑:3}),power:7000,symbols:{緑:2},breaks:2,enterRest:true,lure:true,trigger:{minLands:5},text:'使用済みで登場。横向きでも相手の攻撃を引き付ける。土地5枚以上ならシールドトリガー。ブロッカーではない。'},
 {key:'dolt',reduction:null,name:'ドルツヴァイ・アステリオ',type:'通常',cost:M.cost(5,{緑:1}),power:0,powerMode:'lands',symbols:{緑:1},breaks:1,machFighter:{duration:'entryTurn'},onDefeat:[addLand],text:'パワー＝自分の土地×1000。出たターンだけ相手ユニットへ攻撃可能。戦闘で相手を退場させたら土地デッキの上から1枚を未使用でマナゾーンへ。'}
 ,{key:'mother',name:'母なる大地',type:'呪文',cost:M.cost(2,{緑:1}),onUse:[{kind:'mother'}],text:'両者いずれかのユニット1枚を持ち主のトラッシュへ。その持ち主は土地枚数以下の軽減前合計コストのユニット1枚を手札から無料で出してもよい。トリガーなし。'}
 ,{key:'zundoko',name:'Dの花道 ズンドコ晴れ舞台',type:'設置物',cost:M.cost(4,{緑:1}),power:null,symbols:{緑:1},onUnitEnter:[addLand],text:'自分のユニットが登場するたび、土地デッキの上から1枚を未使用で追加。複数枚はそれぞれ誘発。Dスイッチなし。'}
 ];
 const cards=Object.fromEntries(defs.map(d=>[d.key,{color:'緑',symbols:{},breaks:0,abilities:[],onUse:[],onEnter:[],onDefeat:[],reduction:{minimum:{緑:1}},...d}]));
 cards.greenLand={key:'greenLand',name:'緑の基本土地',type:'土地',color:'緑',cost:null,power:null,symbols:{},breaks:0,basic:true,abilities:[],onUse:[],onEnter:[],onDefeat:[]};
 const redKeys=[];for(let n=1;n<=12;n++){const key='red'+n;redKeys.push(key);cards[key]={key,name:`赤・${n}コスト`,type:'通常',color:'赤',cost:M.cost(n-1,{赤:1}),power:n*1000,symbols:{赤:1},breaks:1,abilities:[],onUse:[],onEnter:[],onDefeat:[],text:'再利用用の旧仮デッキ定義。'};}
 cards.redLand={...cards.greenLand,key:'redLand',name:'赤の基本土地',color:'赤'};
 const decks={green:defs.map(c=>({key:c.key,count:c.key==='bahamut'?1:3}))};
 const landDecks={green:[{key:'greenLand',count:20}]};
 return {COLORS,TYPES,cards,decks,landDecks,startDeck:'green',startLandDeck:'green'};
});
