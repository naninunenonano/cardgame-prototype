// 色・種類・カード定義・効果列・デッキ構成を分離。プリセットの構成は維持し、通常40枚の自作デッキから選択。
(function(root,factory){const c=factory(typeof module==='object'&&module.exports?require('./mana.js'):root.ManaEngine);if(typeof module==='object'&&module.exports)module.exports=c;else root.CardCatalog=c;})(globalThis,function(M){
 const COLORS=['白','青','黒','赤','緑'],TYPES={unit:'通常',spell:'呪文',structure:'設置物'};
 const manaBoost={kind:'manaAdd',count:1};
 const defs=[
 {key:'life',name:'フェアリー・ライフ',type:'呪文',cost:M.cost(1,{緑:1}),onUse:[manaBoost],text:'通常デッキの上から1枚を未使用でマナゾーンへ。'},
 {key:'fortune',name:'豊潤フォージュン',type:'呪文',cost:M.cost(2,{緑:1}),onUse:[manaBoost,{kind:'drawIfManaMax',max:5,count:1}],text:'通常デッキの上から1枚を未使用でマナゾーンへ。追加後のマナが5枚以下なら1枚ドロー。'},
 {key:'touki',name:'竜の闘気',type:'呪文',cost:M.cost(4,{緑:1}),onUse:[{kind:'manaAdd',count:1},{kind:'draw',count:2},{kind:'healLife',count:3}],provisional:true,text:'通常デッキ上1枚を未使用でマナへ→2枚ドロー→ライフ3回復（最大30）。コストは仮値。'},
 {key:'bronze',name:'青銅の鎧',type:'通常',cost:M.cost(3,{緑:1}),attack:2,maxHealth:2,symbols:{緑:1},onEnter:[manaBoost],provisional:true,text:'登場時：通常デッキの上から1枚を未使用でマナゾーンへ。色指定は仮値。'},
 {key:'dragon',name:'グラディアン・レッド・ドラゴン',type:'通常',cost:M.cost(4,{緑:6}),attack:15,maxHealth:15,symbols:{緑:3},text:'緑カード。最大5軽減、最低不特定4＋緑1。'},
 {key:'trap',name:'ナチュラル・トラップ',type:'呪文',cost:M.cost(5,{緑:1}),onUse:[{kind:'trap'}],provisional:true,text:'相手ユニット1枚をトラッシュへ。その持ち主が通常デッキの上から1枚を未使用でマナゾーンへ。コストは仮値。'},
 {key:'repair',deckLimit:1,name:'修復',type:'呪文',cost:M.cost(0,{緑:3}),onUse:[{kind:'resetShield'},{kind:'healLife',count:3}],text:'自分の使用済みシールド1枚を裏向きに戻してもよい。その後ライフ3回復（最大30）。対象なしでも回復。'},
 {key:'bahamut',deckLimit:1,reduction:null,name:'バハムート',type:'通常',cost:M.cost(10,{緑:1}),attack:11,maxHealth:11,symbols:{緑:3},onEnter:[{kind:'wipe'}],text:'登場時：本人以外の両者のユニット・設置物をすべてトラッシュへ。マナ・キャラ・サイドは対象外。'},
 {key:'bird',name:'極楽鳥',type:'通常',cost:M.cost(0,{緑:1}),attack:1,maxHealth:1,symbols:{},manaAbility:{colors:COLORS,amount:1},provisional:true,text:'本人を横向きにして任意の1色1点を支払いに使用。召喚酔い中は不可。攻撃力・最大体力は仮値。'},
 {key:'elf',name:'ラノワールのエルフ',type:'通常',cost:M.cost(0,{緑:1}),attack:2,maxHealth:2,symbols:{},manaAbility:{colors:['緑'],amount:1},provisional:true,text:'本人を横向きにして緑1点を支払いに使用。召喚酔い中は不可。攻撃力・最大体力は仮値。'},
 {key:'panzer',name:'タマタンゴ・パンツァー',type:'通常',cost:M.cost(5,{緑:3}),attack:7,maxHealth:7,symbols:{緑:2},enterRest:true,lure:true,text:'使用済みで登場。横向きでも相手の攻撃を引き付ける。マナ5枚以上ならブロッカーではない。'},
 {key:'dolt',reduction:null,name:'ドルツヴァイ・アステリオ',type:'通常',cost:M.cost(5,{緑:1}),attack:0,maxHealth:0,statMode:'manaCount',symbols:{緑:1},machFighter:{duration:'entryTurn'},onDefeat:[manaBoost],text:'攻撃力・最大体力＝自分のマナ枚数。マッハファイター：出たターンは縦向き・横向きの相手ユニットへ攻撃可能。戦闘で相手を退場させたら通常デッキの上から1枚を未使用でマナゾーンへ。'}
 ,{key:'mother',deckLimit:1,name:'母なる大地',type:'呪文',cost:M.cost(2,{緑:1}),onUse:[{kind:'mother'}],text:'両者いずれかのユニット1枚を持ち主のトラッシュへ。その持ち主はマナ枚数以下の軽減前合計コストのユニット1枚を手札から無料で出してもよい。'}
 ,{key:'zundoko',name:'Dの花道 ズンドコ晴れ舞台',type:'設置物',cost:M.cost(4,{緑:1}),symbols:{緑:1},onUnitEnter:[manaBoost],text:'自分のユニットが登場するたび、通常デッキ上1枚を未使用でマナへ。複数枚はそれぞれ誘発。Dスイッチなし。'}
 ];
 const cards=Object.fromEntries(defs.map(d=>[d.key,{color:'緑',symbols:{},abilities:[],onUse:[],onEnter:[],onDefeat:[],reduction:{minimum:{緑:1}},...d}]));
 const redKeys=[];for(let n=1;n<=12;n++){const key='red'+n;redKeys.push(key);cards[key]={key,deckEligible:false,name:`赤・${n}コスト`,type:'通常',color:'赤',cost:M.cost(n-1,{赤:1}),attack:n,maxHealth:n,symbols:{赤:1},abilities:[],onUse:[],onEnter:[],onDefeat:[],text:'再利用用の旧仮デッキ定義。'};}
 const blueDefs=[
 {key:'brain',name:'サイバー・ブレイン',type:'呪文',cost:M.cost(3,{青:1}),onUse:[{kind:'draw',count:3}],text:'カードを3枚引く。'},
 {key:'shaper',name:'ストリーミング・シェイパー',type:'呪文',cost:M.cost(0,{青:3}),deckLimit:1,onUse:[{kind:'revealBlue',count:4}],text:'上から4枚を公開。青をすべて手札へ、残りをトラッシュへ。ドローではない。'},
 {key:'vegas',name:'Dの博才 サイバーダイス・ベガス',type:'設置物',cost:M.cost(4,{青:1}),symbols:{青:1},onEnd:[{kind:'optionalDraw',count:1}],text:'自分のターン終了時、1枚引いてもよい。Dスイッチ・置き換えルールなし。'},
 {key:'cosmo',name:'ルナ・コスモビュー',type:'通常',cost:M.cost(8,{青:1}),attack:6,maxHealth:6,symbols:{青:2},abilities:['ブロッカー'],gZero:{hand:10},onEnter:[{kind:'draw',count:1}],provisional:true,text:'ブロッカー。G・ゼロ：使用前の手札10枚以上なら無料召喚。登場時1枚ドロー。コスト内訳は仮値。'},
 {key:'counter',name:'対抗呪文',type:'呪文',cost:M.cost(2,{青:1}),responseOnly:true,instant:true,spellCounter:true,text:'インスタント。呪文1つを打ち消す。'},
 {key:'gate',name:'スパイラル・ゲート',type:'呪文',cost:M.cost(1,{青:1}),instant:true,onUse:[{kind:'unitBounce'}],text:'インスタント。クリーチャー1体を持ち主の手札へ。'},
 {key:'goby',name:'パルピィ・ゴービー',type:'通常',cost:M.cost(2,{青:1}),attack:2,maxHealth:2,symbols:{青:1},abilities:['ブロッカー'],cannotAttack:true,onEnter:[{kind:'reorder',count:5}],text:'ブロッカー・攻撃不可。登場時上5枚を自分だけ見て並べ直す。'},
 {key:'zwei',deckLimit:1,name:'クリスタル・ツヴァイランサー',type:'通常',cost:M.cost(3,{青:5}),attack:13,maxHealth:13,symbols:{青:3},evolution:{color:'青'},unblockable:true,text:'自分の青ユニットの上へ進化。ブロックされない。最上段だけがシンボル・能力・攻撃力・最大体力を供給。使用済みを継承、召喚酔いなし。'},
 {key:'amaterasu',name:'蒼狼の始祖アマテラス',type:'通常',cost:M.cost(4,{青:2}),attack:5,maxHealth:5,symbols:{青:1},onEnter:[{kind:'searchSpell',max:4}],text:'登場時：山札の軽減前4コスト以下かつ使用条件を満たす呪文1枚を無料使用。残りをシャッフルしてから通常効果を解決。'},
 {key:'emeral',name:'エメラル',type:'通常',cost:M.cost(1,{青:1}),attack:1,maxHealth:1,symbols:{青:1},onEnter:[{kind:'inspectShield'}],text:'登場時：相手の未使用シールド1枚を選び、自分だけ内容を確認する。使用状態は変えない。'},
 {key:'corile',name:'コーライル',type:'通常',cost:M.cost(4,{青:1}),attack:2,maxHealth:2,symbols:{青:1},onEnter:[{kind:'topUnit'}],text:'登場時：相手ユニット1体を持ち主のメインデッキの上へ戻す。設置物・マナ・キャラ対象外。'},
 {key:'snow',name:'スノーマン召喚',type:'呪文',cost:M.cost(3,{青:1}),onUse:[{kind:'tokens',count:3}],text:'スノーマントークン3体を召喚。'},
 {key:'inquiry',name:'ウォズレックの審問',type:'呪文',cost:M.cost(1,{青:1}),onUse:[{kind:'inspectDiscard',max:3}],text:'相手の手札を一時的に確認し、軽減前合計3以下のカード1枚を選んでトラッシュへ。対象があれば1枚必須。'},
 {key:'vice',name:'スケルトン・バイス',type:'呪文',cost:M.cost(3,{青:1}),onUse:[{kind:'randomDiscard',count:2}],text:'相手の手札からランダムに2枚を重複せずトラッシュへ。手札全体は公開しない。1枚なら1枚だけ。'}
 ];
 for(const d of blueDefs)cards[d.key]={color:'青',symbols:{},abilities:[],onUse:[],onEnter:[],onDefeat:[],reduction:{minimum:{青:1}},...d};
 cards.snowToken={key:'snowToken',name:'スノーマン',type:'通常',color:'青',cost:null,attack:1,maxHealth:1,symbols:{青:1},abilities:[],token:true,onUse:[],onEnter:[],onDefeat:[]};
 const neutralDefs=[
 {key:'jil',name:'慟哭のジル・クライハート',type:'通常',cost:M.cost(8),attack:5,maxHealth:5,symbols:{},deckLimit:1,genericReduction:{maximum:4,minimum:4},onEnter:[{kind:'chooseFate'}],provisional:true,text:'運命を選ぶ。有色シンボル1つにつき1軽減、最大4・最低4。攻撃力・最大体力5は暫定。'},
 {key:'peridot',name:'永遠の蜃気楼 ペリドット',type:'通常',cost:M.cost(4),attack:4,maxHealth:4,symbols:{},deckLimit:1,onEnter:[{kind:'blinkSelf'}],onBodySuccess:[{kind:'blinkSelf'}],provisional:true,text:'登場時・本体への攻撃成功時に自身を除外。次の自分のターン開始時、スピードアタッカーを持って帰還。攻撃力・最大体力4は暫定。'},
 {key:'themis',name:'テミスの審判',type:'呪文',cost:M.cost(6),onUse:[{kind:'wipeUnits'}],text:'お互いの場のユニットをすべてトラッシュへ。設置物・マナは対象外。'},
 {key:'holyMail',name:'ホーリー・メール',type:'呪文',cost:M.cost(4),onUse:[{kind:'healLife',count:4}],text:'自分のライフを4回復する（最大30）。'},
 {key:'kaiser',name:'ショットガン・カイザー',type:'通常',cost:M.cost(7),attack:9,maxHealth:9,symbols:{},onEnd:[{kind:'untapMana',count:4}],text:'自分のターン終了時、自分のマナを最大4枚選んで未使用に戻す。複数体はそれぞれ誘発。'},
 {key:'glennya',name:'グレンニャー',type:'通常',cost:M.cost(2),attack:1,maxHealth:1,symbols:{},onEnter:[{kind:'draw',count:1}],text:'登場時：カードを1枚引く。'},
 {key:'walsura',name:'プラチナ・ワルスラS',type:'通常',cost:M.cost(4),attack:6,maxHealth:6,symbols:{},evolution:{any:true},onAttack:[{kind:'optionalEffect',label:'3枚引いて手札1枚を捨てますか？',effects:[{kind:'draw',count:3},{kind:'handDiscard',count:1}]}],text:'自分のユニット1体の上に進化（文明不問）。攻撃時、3枚引いてもよい。そうしたら手札1枚を選びトラッシュへ。'},
 {key:'honenbee',name:'白骨の守護者ホネンビー',type:'通常',cost:M.cost(4),attack:3,maxHealth:3,symbols:{},abilities:['ブロッカー'],onEnter:[{kind:'optionalEffect',label:'上から3枚をトラッシュへ置き、ユニット1枚を回収しますか？',effects:[{kind:'millRecover',count:3}]}],text:'ブロッカー。登場時、上から3枚をトラッシュへ置いてもよい。そうしたらトラッシュのユニット1枚を手札へ。シンボル0でも攻撃可能。'}
 ];
 for(const d of neutralDefs)cards[d.key]={color:'無色',symbols:{},abilities:[],onUse:[],onEnter:[],onDefeat:[],reduction:null,...d};
 const fates=[
 {key:'fateWhim',name:'運命の気まぐれ',cost:M.cost(1),onUse:[{kind:'fateWhim'}],text:'1枚引く。自分の場にジルがいる場合、その個体の使用コストを1にする。使用後消滅。'},
 {key:'fateWings',name:'運命の翼',cost:M.cost(4),onUse:[{kind:'buffUnit',attack:2,health:2},{kind:'drawIfJil',count:2}],text:'自分のクリーチャー1体を＋2/＋2（攻撃力・最大体力・現在体力を2増加）。自分の場にジルがいればさらに2枚引く。使用後消滅。'},
 {key:'fateReversal',name:'運命の逆転',cost:M.cost(8),onUse:[{kind:'extraTurns'}],text:'自分が追加ターンを得る。自分の場にジルがいなければ相手も追加ターンを得る。使用後消滅。'}
 ];
 for(const d of fates)cards[d.key]={color:'無色',type:'呪文',symbols:{},abilities:[],onUse:[],onEnter:[],onDefeat:[],generated:true,vanishAfterUse:true,reduction:null,...d};
 const shieldDefs=[
 {key:'reactiveArmor',name:'リアクティブアーマー',shieldRule:{event:'attackDeclared',maxLife:10,effect:'destroyAttacker'},useCondition:'自分のライフが10以下。',triggerCondition:'相手のクリーチャーが自分を攻撃した時。',text:'攻撃しているクリーチャーを破壊する。攻撃宣言時のライフを参照し、ダメージ前に解決。'},
 {key:'wisdomBlessing',name:'知恵の恵み',shieldRule:{event:'lifeLost',effect:'draw',count:2},triggerCondition:'自分のライフが減少した時。',text:'カードを2枚引く。ライフ0以下で確定した敗北は取り消せない。'}
 ];
 for(const d of shieldDefs)cards[d.key]={color:'無色',type:'シールドカード',deckSection:'shields',cost:null,symbols:{},abilities:[],onUse:[],onEnter:[],onDefeat:[],...d};
 // 成長コストLv3/Lv4・未記載の覚醒前数値はデータで調整できる試作値。
 const characterLevels={1:{cost:1,text:'成長時・開始時：1ドロー。',effects:[{kind:'draw',count:1}]},2:{cost:3,text:'成長時・開始時：相手ランダム1捨て。成長直後のみバイス・チャージャーを任意使用。',effects:[{kind:'randomDiscard',count:1}]},3:{cost:5,text:'成長時・開始時：相手の場1枚をバウンス（マナ不可）→ランダム1捨て。',effects:[{kind:'enemyBounce'},{kind:'randomDiscard',count:1}]},4:{cost:7,text:'成長時：相手2捨て。常時：自分の効果で相手が実際に1枚捨てるごと1ドロー＋アクア・ガード。サイドの不特定3軽減。',effects:[{kind:'randomDiscard',count:2}]}};
 const sideDefs=[
 {key:'piruluk',name:'ピルルク',type:'キャラクター',cost:M.cost(1),level:0,text:'Lv1→Lv4へ順番に成長。成長もサイド使用1ターン1枚に含む。通常の攻撃・ブロックは行わない。'},
 {key:'gunveet',name:'ブラック・ガンヴィート',type:'通常',cost:M.cost(4,{青:3}),attack:7,maxHealth:7,symbols:{青:1},requiredCharacter:'piruluk',provisional:true,onEnter:[{kind:'destroyTapped'}],awaken:'darkGunveet',text:'登場時：相手の横向き1体を破壊。相手ターン終了時、相手手札0なら覚醒。覚醒前7/7・青1は仮設定。'},
 {key:'alegre',name:'ルナ・アレグル',type:'通常',cost:M.cost(5,{青:2}),attack:5,maxHealth:5,symbols:{青:1},provisional:true,onEnd:[{kind:'draw',count:1},{kind:'handDiscard',count:1}],awaken:'alegria',text:'終了時1ドロー→自分の手札1捨て。自分の開始時、トラッシュの呪文6枚を山札へ戻して覚醒可能。5/5・青1は仮設定。'},
 {key:'dogiragon',name:'蒼き覚醒 ドギラゴンX',type:'通常',cost:M.cost(8),attack:13,maxHealth:13,symbols:{},revolution:true,text:'通常支払い不可。自分の元コスト5以上のクリーチャーの攻撃時に革命チェンジ。交換元を除外し同じ枠で攻撃を引き継ぐ。サイド使用1回。'},
 {key:'viceCharger',name:'バイス・チャージャー',type:'呪文',cost:M.cost(0),requiredCharacter:'piruluk',viceOnly:true,onUse:[{kind:'randomDiscard',count:1},{kind:'manaToken',color:'青'}],text:'ピルルクLv2へ成長した直後だけ任意使用。相手ランダム1捨て→青マナトークン1個。成長の追加処理として回数を二重消費しない。'},
 {key:'lostSoul',name:'ロスト・ソウル',type:'呪文',cost:M.cost(0,{青:8}),requiredCharacter:'piruluk',onUse:[{kind:'randomDiscard',count:999}],text:'相手の手札をすべて捨てさせる。実際の捨て札1枚ごとにピルルクLv4が誘発する。'},
 {key:'conspiracy',name:'陰謀と計略の手',type:'呪文',cost:M.cost(3,{青:1}),onUse:[{kind:'enemyUnitBounce'},{kind:'opponentDiscard'}],text:'相手の1体をバウンス→相手本人が手札1枚を選んで捨てる。'},
 {key:'technology',name:'インビンシブル・テクノロジー',type:'呪文',cost:M.cost(12,{青:1}),allBlueReduction:3,onUse:[{kind:'technologySearch'},{kind:'technologyCast'}],text:'自分のマナがすべて青なら不特定をさらに3軽減（0まで）。山札から任意枚数を手札へ→現在手札枚数以下の元コストの青カード1枚を任意で無料使用。'},
 {key:'interstellar',name:'偽りの月 インターステラ',type:'通常',cost:M.cost(4,{青:3}),attack:9,maxHealth:9,symbols:{青:2},requiredCharacter:'piruluk',abilities:['ブロッカー'],justDiver:true,onEnter:[{kind:'interstellarEnter'}],onAttack:[{kind:'interstellarAttack'}],text:'ジャストダイバー：登場時、次の自分のターン開始まで相手に選ばれず、攻撃されない。登場時：手札の呪文またはトラッシュの元コスト5以下の呪文を無料使用→除外。攻撃時：除外の元コスト5以下の呪文を無料使用→使用後山札下。'},
 {key:'vt5000',provisional:true,name:'飛翔龍 5000VT',type:'通常',color:'青',cost:M.cost(8),attack:12,maxHealth:12,symbols:{青:1},creatureReduction:true,onEnter:[{kind:'vtBounceLock'}],text:'青シンボル1は仮設定。両者のクリーチャー数だけ不特定軽減（トークンを含みキャラを除く、Lv4軽減と併用し0まで）。登場時：両者の攻撃力5以下を全バウンス。次の相手ターン中、相手は攻撃力5以下を出せない。'}
 ];
 for(const d of sideDefs)cards[d.key]={color:'青',symbols:{},abilities:[],onUse:[],onEnter:[],onDefeat:[],sideboardOnly:true,reduction:{minimum:{青:1}},...d};
 const awakened={
 darkGunveet:{name:'ダークネス・ガンヴィート',cost:M.cost(9),attack:9,maxHealth:9,symbols:{青:2},abilities:[],speedAttacker:true,onEnter:[],onStart:[{kind:'darkHand'}],text:'覚醒後のみ。9/9・青2・SA。自分の開始時：相手手札確認→1枚選んで捨てる→同じ元コストの相手1体を破壊。覚醒解除なし。'},
 alegria:{name:'ルナ・アレグリア',cost:M.cost(14),attack:13,maxHealth:13,symbols:{青:3},abilities:[],onEnd:[],onEnter:[],drawOnUse:true,revertAtFive:true,text:'覚醒後のみ。13/13・青3。自分の召喚・呪文使用時1ドロー。自分の手札5枚以下なら覚醒解除。'}
 };
 cards.aquaGuard={key:'aquaGuard',name:'アクア・ガード',type:'通常',color:'青',cost:null,attack:0,maxHealth:1,symbols:{青:1},abilities:['ブロッカー'],cannotAttack:true,token:true,onUse:[],onEnter:[],onDefeat:[],text:'攻撃不可。場を離れれば消滅。'};
 const sideboardPreset=sideDefs.map(c=>({key:c.key,count:1}));
 const starter=(typeof module==='object'&&module.exports?require('./starter-cards.js'):globalThis.StarterContent).install(M,cards,awakened);
 (typeof module==='object'&&module.exports?require('./update-cards.js'):globalThis.CardUpdate).install(M,cards,awakened);
 (typeof module==='object'&&module.exports?require('./expansion-cards.js'):globalThis.ExpansionCards).install(M,cards,awakened);
 (typeof module==='object'&&module.exports?require('./black-cards.js'):globalThis.BlackCards).install(M,cards);
 (typeof module==='object'&&module.exports?require('./graveyard-cards.js'):globalThis.GraveyardCards).install(M,cards);
 // Black SSR: only the current level is active; growth effects never repeat at turn start.
 cards.redMoonAvenger={key:'redMoonAvenger',name:'赤月の復讐者',rarity:'SSR',color:'黒',type:'キャラクター',sideboardOnly:true,level:0,deckLimit:1,cost:M.cost(1),symbols:{},abilities:[],onUse:[],onEnter:[],onDefeat:[],growthOnly:true,provisional:true,
 characterEffects:{1:[{kind:'redMoonSelf',amount:2},{kind:'draw',count:2}],2:[],3:[{kind:'redMoonLife15'}],4:[]},
 levelTexts:{1:'成長時：自分に2ダメージ（シールド誘発なし）。その後2枚ドロー。',2:'自分のクリーチャー登場時：自分に2ダメージ（シールド誘発なし）。そのクリーチャーはSAを得る。強制・回数制限なし。',3:'成長時：自分のライフを15に変更。変更前が15以上なら2ドロー、15未満なら相手クリーチャー1体を破壊。',4:'復讐（ライフ15以下）なら自軍クリーチャーすべてにドレイン。自軍クリーチャー破壊ごと自分に3ダメージ（シールド誘発なし）。クリーチャーの攻撃以外でライフ0以下にならない（ルールダメージを除く）。共通：サイドの不特定3軽減。'},
 text:'仮称・男性吸血鬼。Lv0からLv4へ成長。固有能力は現在レベルのみ有効、すべて強制。復讐は現在ライフ15以下。ドレインは戦闘で与えたダメージ分回復（最大ライフまで）。'};
 cards.yellowZone={key:'yellowZone',name:'イエローゾーン',rarity:'UR',color:'黒',type:'シールドカード',deckSection:'shields',deckLimit:1,requiredCharacter:'redMoonAvenger',cost:null,symbols:{},abilities:[],onUse:[],onEnter:[],onDefeat:[],shieldRule:{event:'lifeThreshold',effect:'yellowZone',maxLife:15},triggerCondition:'ライフ変更後、現在ライフ15以下で自動発動（1試合1回）。赤月の復讐者の固有自傷・ルールダメージでは発動しない。',useCondition:'赤月の復讐者専用。',text:'仮称。発動中は最大ライフ15、受ける3以上のダメージは3、シールドによるライフ回復不可。他の回復は可能。裏向きで効果を失い、再発動しない。'};
 const decks={...starter.decks,green:[...defs.map(c=>({key:c.key,count:['bahamut','mother'].includes(c.key)?1:3})),{key:'glennya',count:2}],blue:[...blueDefs.map(c=>({key:c.key,count:['shaper','zwei'].includes(c.key)?1:3})),{key:'glennya',count:2}]};
 return {starter,COLORS,TYPES,cards,characterLevels,awakened,sideboardPreset,shieldKeys:Object.values(cards).filter(c=>c.type==='シールドカード').map(c=>c.key),neutralKeys:neutralDefs.map(c=>c.key),fateKeys:fates.map(c=>c.key),decks,startDeck:'green'};
});
