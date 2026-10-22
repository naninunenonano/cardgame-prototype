// 色・種類・カード定義・効果列・デッキ構成を分離。プリセットの構成は維持し、独立した土地デッキと自作デッキから選択。
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
 {key:'repair',deckLimit:1,name:'修復',type:'呪文',cost:M.cost(0,{緑:3}),trigger:{},onUse:[{kind:'shield',count:1,landThreshold:10,extra:1}],text:'シールドトリガー。盾1枚追加。土地10枚以上ならさらに1枚。キャラ制限なし。'},
 {key:'bahamut',deckLimit:1,reduction:null,name:'バハムート',type:'通常',cost:M.cost(10,{緑:1}),power:11000,symbols:{緑:3},breaks:3,onEnter:[{kind:'wipe'}],text:'登場時：本人以外の両者のユニット・設置物をすべてトラッシュへ。土地・盾・キャラ・サイドは対象外。'},
 {key:'bird',name:'極楽鳥',type:'通常',cost:M.cost(0,{緑:1}),power:1000,symbols:{},breaks:0,manaAbility:{colors:COLORS,amount:1},provisional:true,text:'本人を横向きにして任意の1色1点を支払いに使用。召喚酔い中は不可。ブレイク0。パワーは仮値。'},
 {key:'elf',name:'ラノワールのエルフ',type:'通常',cost:M.cost(0,{緑:1}),power:2000,symbols:{},breaks:0,manaAbility:{colors:['緑'],amount:1},provisional:true,text:'本人を横向きにして緑1点を支払いに使用。召喚酔い中は不可。ブレイク0。パワーは仮値。'},
 {key:'panzer',name:'タマタンゴ・パンツァー',type:'通常',cost:M.cost(5,{緑:3}),power:7000,symbols:{緑:2},breaks:2,enterRest:true,lure:true,trigger:{minLands:5},text:'使用済みで登場。横向きでも相手の攻撃を引き付ける。土地5枚以上ならシールドトリガー。ブロッカーではない。'},
 {key:'dolt',reduction:null,name:'ドルツヴァイ・アステリオ',type:'通常',cost:M.cost(5,{緑:1}),power:0,powerMode:'lands',symbols:{緑:1},breaks:1,machFighter:{duration:'entryTurn'},onDefeat:[addLand],text:'パワー＝自分の土地×1000。出たターンだけ相手ユニットへ攻撃可能。戦闘で相手を退場させたら土地デッキの上から1枚を未使用でマナゾーンへ。'}
 ,{key:'mother',deckLimit:1,name:'母なる大地',type:'呪文',cost:M.cost(2,{緑:1}),onUse:[{kind:'mother'}],text:'両者いずれかのユニット1枚を持ち主のトラッシュへ。その持ち主は土地枚数以下の軽減前合計コストのユニット1枚を手札から無料で出してもよい。トリガーなし。'}
 ,{key:'zundoko',name:'Dの花道 ズンドコ晴れ舞台',type:'設置物',cost:M.cost(4,{緑:1}),power:null,symbols:{緑:1},onUnitEnter:[addLand],text:'自分のユニットが登場するたび、土地デッキの上から1枚を未使用で追加。複数枚はそれぞれ誘発。Dスイッチなし。'}
 ];
 const cards=Object.fromEntries(defs.map(d=>[d.key,{color:'緑',symbols:{},breaks:0,abilities:[],onUse:[],onEnter:[],onDefeat:[],reduction:{minimum:{緑:1}},...d}]));
 cards.greenLand={key:'greenLand',name:'緑の基本土地',type:'土地',color:'緑',cost:null,power:null,symbols:{},breaks:0,basic:true,abilities:[],onUse:[],onEnter:[],onDefeat:[]};
 const redKeys=[];for(let n=1;n<=12;n++){const key='red'+n;redKeys.push(key);cards[key]={key,deckEligible:false,name:`赤・${n}コスト`,type:'通常',color:'赤',cost:M.cost(n-1,{赤:1}),power:n*1000,symbols:{赤:1},breaks:1,abilities:[],onUse:[],onEnter:[],onDefeat:[],text:'再利用用の旧仮デッキ定義。'};}
 cards.redLand={...cards.greenLand,deckEligible:false,key:'redLand',name:'赤の基本土地',color:'赤'};
 const blueDefs=[
 {key:'brain',name:'サイバー・ブレイン',type:'呪文',cost:M.cost(3,{青:1}),trigger:{},onUse:[{kind:'draw',count:3}],text:'シールドトリガー。カードを3枚引く。'},
 {key:'shaper',name:'ストリーミング・シェイパー',type:'呪文',cost:M.cost(0,{青:3}),deckLimit:1,onUse:[{kind:'revealBlue',count:4}],text:'上から4枚を公開。青をすべて手札へ、残りをトラッシュへ。ドローではない。同名1枚制限。'},
 {key:'vegas',name:'Dの博才 サイバーダイス・ベガス',type:'設置物',cost:M.cost(4,{青:1}),symbols:{青:1},trigger:{},onEnd:[{kind:'optionalDraw',count:1}],text:'シールドトリガー。自分のターン終了時、1枚引いてもよい。Dスイッチ・置き換えルールなし。'},
 {key:'cosmo',name:'ルナ・コスモビュー',type:'通常',cost:M.cost(8,{青:1}),power:6000,symbols:{青:2},breaks:2,abilities:['ブロッカー'],gZero:{hand:10},onEnter:[{kind:'draw',count:1}],provisional:true,text:'ブロッカー。G・ゼロ：使用前の手札10枚以上なら無料召喚。登場時1枚ドロー。コスト内訳は仮値。'},
 {key:'counter',name:'対抗呪文',type:'呪文',cost:M.cost(3,{青:1}),responseOnly:true,foretell:{cost:M.cost(0),useCost:M.cost(3,{青:1}),onSet:[]},text:'カード使用への応答で使用を無効化。予顕0（伏せる費用）。後の使用は不特定3＋青1。予顕ターン使用不可。'},
 {key:'gate',name:'スパイラル・ゲート',type:'呪文',cost:M.cost(1,{青:1}),trigger:{},onUse:[{kind:'bounce'}],foretell:{cost:M.cost(1),useCost:M.cost(2,{青:1}),onSet:[],onUse:[{kind:'bounce'},{kind:'draw',count:1}]},text:'ユニット・設置物1枚を持ち主の手札へ。土地対象外。予顕1、後の使用は不特定2＋青1。この使用だけ追加1ドロー。'},
 {key:'goby',name:'パルピィ・ゴービー',type:'通常',cost:M.cost(2,{青:1}),power:2000,symbols:{青:1},breaks:1,abilities:['ブロッカー'],cannotAttack:true,onEnter:[{kind:'reorder',count:5}],foretell:{cost:M.cost(1),useCost:M.cost(2),onSet:[{kind:'scry',count:1}]},text:'ブロッカー・攻撃不可。登場時上5枚を自分だけ見て並べ直す。予顕1で占術1。後の使用は不特定2（色不要・軽減なし）。'},
 {key:'zwei',deckLimit:1,name:'クリスタル・ツヴァイランサー',type:'通常',cost:M.cost(3,{青:5}),power:13000,symbols:{青:3},breaks:3,evolution:{color:'青'},unblockable:true,text:'自分の青ユニットの上へ進化。ブロックされない。最上段だけがシンボル・能力・パワーを供給。使用済みを継承、召喚酔いなし。'},
 {key:'amaterasu',name:'蒼狼の始祖アマテラス',type:'通常',cost:M.cost(4,{青:2}),power:5000,symbols:{青:1},breaks:1,onEnter:[{kind:'searchSpell',max:4}],text:'登場時：山札の軽減前4コスト以下かつ使用条件を満たす呪文1枚を無料使用。残りをシャッフルしてから通常効果を解決。'},
 {key:'emeral',name:'エメラル',type:'通常',cost:M.cost(1,{青:1}),power:1000,symbols:{青:1},breaks:1,onEnter:[{kind:'shieldSwap'}],text:'登場時：手札1枚を盾へ置けたら、自分の盾1枚を内容を見て手札へ。新しい盾も選べ、トリガー使用可能。相手へ内容非公開。'},
 {key:'corile',name:'コーライル',type:'通常',cost:M.cost(4,{青:1}),power:2000,symbols:{青:1},breaks:1,onEnter:[{kind:'topUnit'}],text:'登場時：相手ユニット1体を持ち主のメインデッキの上へ戻す。設置物・土地・キャラ対象外。'},
 {key:'snow',name:'スノーマン召喚',type:'呪文',cost:M.cost(3,{青:1}),onUse:[{kind:'tokens',count:3}],foretell:{cost:M.cost(3),useCost:M.cost(3,{青:1}),onSet:[{kind:'bounce'}]},text:'スノーマントークン3体を召喚。予顕3でユニット・設置物1枚をバウンス（場の土地は対象外）。後の使用は不特定3＋青1で3体召喚。'},
 {key:'inquiry',name:'ウォズレックの審問',type:'呪文',cost:M.cost(1,{青:1}),onUse:[{kind:'inspectDiscard',max:3}],text:'相手の手札を一時的に確認し、軽減前合計3以下のカード1枚を選んでトラッシュへ。対象があれば1枚必須。'},
 {key:'vice',name:'スケルトン・バイス',type:'呪文',cost:M.cost(3,{青:1}),onUse:[{kind:'randomDiscard',count:2}],text:'相手の手札からランダムに2枚を重複せずトラッシュへ。手札全体は公開しない。1枚なら1枚だけ。'}
 ];
 for(const d of blueDefs)cards[d.key]={color:'青',power:null,symbols:{},breaks:0,abilities:[],onUse:[],onEnter:[],onDefeat:[],reduction:{minimum:{青:1}},...d};
 cards.blueLand={...cards.greenLand,key:'blueLand',name:'青の基本土地',color:'青'};
 cards.snowToken={key:'snowToken',name:'スノーマン',type:'通常',color:'青',cost:null,power:1000,symbols:{青:1},breaks:1,abilities:[],token:true,onUse:[],onEnter:[],onDefeat:[]};
 const neutralDefs=[
 {key:'jil',name:'慟哭のジル・クライハート',type:'通常',cost:M.cost(8),power:5000,symbols:{無色:1},breaks:1,deckLimit:1,genericReduction:{maximum:4,minimum:4},onEnter:[{kind:'chooseFate'}],provisional:true,text:'運命を選ぶ。有色シンボル1つにつき1軽減、最大4・最低4。パワー5000は暫定。'},
 {key:'peridot',name:'永遠の蜃気楼 ペリドット',type:'通常',cost:M.cost(4),power:4000,symbols:{無色:1},breaks:1,deckLimit:1,onEnter:[{kind:'blinkSelf'}],onBodySuccess:[{kind:'blinkSelf'}],provisional:true,text:'登場時・本体への攻撃成功時に自身を除外。次の自分のターン開始時、スピードアタッカーを持って帰還。パワー4000は暫定。'},
 {key:'themis',name:'テミスの審判',type:'呪文',cost:M.cost(6),onUse:[{kind:'wipeUnits'}],text:'お互いの場のユニットをすべてトラッシュへ。設置物・土地は対象外。'},
 {key:'holyMail',name:'ホーリー・メール',type:'呪文',cost:M.cost(4),onUse:[{kind:'handShield'}],text:'自分の手札1枚を選び、裏向きでシールドに加える。内容は相手へ非公開。'},
 {key:'kaiser',name:'ショットガン・カイザー',type:'通常',cost:M.cost(7),power:9000,symbols:{無色:2},breaks:2,onEnd:[{kind:'untapLands',count:4}],text:'自分のターン終了時、自分の土地を最大4枚選んで未使用に戻す。複数体はそれぞれ誘発。'},
 {key:'glennya',name:'グレンニャー',type:'通常',cost:M.cost(2),power:1000,symbols:{無色:1},breaks:1,onEnter:[{kind:'draw',count:1}],text:'登場時：カードを1枚引く。'},
 {key:'walsura',name:'プラチナ・ワルスラS',type:'通常',cost:M.cost(4),power:6000,symbols:{無色:2},breaks:2,evolution:{any:true},onAttack:[{kind:'optionalEffect',label:'3枚引いて手札1枚を捨てますか？',effects:[{kind:'draw',count:3},{kind:'handDiscard',count:1}]}],text:'自分のユニット1体の上に進化（文明不問）。攻撃時、3枚引いてもよい。そうしたら手札1枚を選びトラッシュへ。'},
 {key:'honenbee',name:'白骨の守護者ホネンビー',type:'通常',cost:M.cost(4),power:3000,symbols:{},breaks:0,abilities:['ブロッカー'],onEnter:[{kind:'optionalEffect',label:'上から3枚をトラッシュへ置き、ユニット1枚を回収しますか？',effects:[{kind:'millRecover',count:3}]}],text:'ブロッカー。登場時、上から3枚をトラッシュへ置いてもよい。そうしたらトラッシュのユニット1枚を手札へ。シンボル0でも攻撃可能。'}
 ];
 for(const d of neutralDefs)cards[d.key]={color:'無色',power:null,symbols:{},breaks:0,abilities:[],onUse:[],onEnter:[],onDefeat:[],reduction:null,...d};
 const fates=[
 {key:'fateWhim',name:'運命の気まぐれ',cost:M.cost(1),onUse:[{kind:'fateWhim'}],text:'1枚引く。自分の場にジルがいる場合、その個体の使用コストを1にする。使用後消滅。'},
 {key:'fateWings',name:'運命の翼',cost:M.cost(4),onUse:[{kind:'shield',count:1},{kind:'drawIfJil',count:2}],text:'山札の上1枚を裏向きで盾へ。自分の場にジルがいればさらに2枚引く。使用後消滅。'},
 {key:'fateReversal',name:'運命の逆転',cost:M.cost(8),onUse:[{kind:'extraTurns'}],text:'自分が追加ターンを得る。自分の場にジルがいなければ相手も追加ターンを得る。使用後消滅。'}
 ];
 for(const d of fates)cards[d.key]={color:'無色',type:'呪文',power:null,symbols:{},breaks:0,abilities:[],onUse:[],onEnter:[],onDefeat:[],generated:true,vanishAfterUse:true,reduction:null,...d};
 const decks={green:defs.map(c=>({key:c.key,count:c.key==='bahamut'?1:3})),blue:blueDefs.map(c=>({key:c.key,count:c.key==='shaper'?1:3}))};
 const landDecks={green:[{key:'greenLand',count:20}],blue:[{key:'blueLand',count:20}]};
 return {COLORS,TYPES,cards,neutralKeys:neutralDefs.map(c=>c.key),fateKeys:fates.map(c=>c.key),decks,landDecks,startDeck:'green',startLandDeck:'green'};
});
