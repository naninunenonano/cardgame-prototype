// 色・種類・カード定義・効果列・デッキ構成を分離。プリセットの構成は維持し、通常40枚の自作デッキから選択。
(function(root,factory){const c=factory(typeof module==='object'&&module.exports?require('./mana.js'):root.ManaEngine);if(typeof module==='object'&&module.exports)module.exports=c;else root.CardCatalog=c;})(globalThis,function(M){
 const COLORS=['白','青','黒','赤','緑'],TYPES={unit:'通常',spell:'呪文',structure:'設置物'};
 const manaBoost={kind:'manaAdd',count:1};
 const defs=[
 {key:'life',name:'フェアリー・ライフ',type:'呪文',cost:M.cost(1,{緑:1}),onUse:[manaBoost],text:'通常デッキの上から1枚を未使用でマナゾーンへ。'},
 {key:'fortune',name:'豊潤フォージュン',type:'呪文',cost:M.cost(2,{緑:1}),onUse:[manaBoost,{kind:'drawIfManaMin',min:7,count:1}],text:'通常デッキの上から1枚を未使用でマナゾーンへ。追加後のマナが7枚以上なら1枚ドロー。'},
 {key:'touki',name:'竜の闘気',type:'呪文',cost:M.cost(4,{緑:1}),onUse:[{kind:'manaAdd',count:1},{kind:'draw',count:2},{kind:'healLife',count:3}],provisional:true,text:'通常デッキ上1枚を未使用でマナへ→2枚ドロー→ライフ3回復（最大30）。コストは仮値。'},
 {key:'bronze',name:'青銅の鎧',type:'通常',cost:M.cost(3,{緑:1}),attack:2,maxHealth:2,symbols:{緑:1},onEnter:[manaBoost],provisional:true,text:'登場時：通常デッキの上から1枚を未使用でマナゾーンへ。色指定は仮値。'},
 {key:'dragon',name:'グラディアン・レッド・ドラゴン',type:'通常',cost:M.cost(4,{緑:6}),attack:10,maxHealth:10,symbols:{緑:3},abilities:['マッハファイター','トランブル'],machFighter:{duration:'entryTurn'},trample:true,text:'マッハファイター。トランブル。最大5軽減、最低不特定4＋緑1。'},
 {key:'trap',name:'ナチュラル・トラップ',type:'呪文',cost:M.cost(2,{緑:1}),onUse:[{kind:'trap'}],instant:true,text:'インスタント。相手クリーチャー1体を持ち主のマナゾーンに置く。'},
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
 cards.gs6={key:'gs6',name:'統率するレオパルド・ホーン',color:'緑',type:'通常',cost:M.cost(6,{緑:1}),attack:2,maxHealth:2,symbols:{緑:1},deckLimit:3,abilities:['マッハファイター','トランブル'],machFighter:{duration:'entryTurn'},trample:true,gZero:{fieldCreatures:4},onEnter:[{kind:'leopardBuff'}],text:'G・ゼロ：自分の他のクリーチャーが4体以上。マッハファイター。トランブル。登場時、他の自分のクリーチャー1体につき＋1/＋1。'};
 const blueDefs=[
 {key:'walsura',name:'プラチナ・ワルスラS',type:'通常',cost:M.cost(0,{青:4}),attack:6,maxHealth:6,symbols:{青:1},evolution:{any:true,colorlessBaseDiscount:true},onAttack:[{kind:'optionalEffect',label:'3枚引いて手札1枚を捨てますか？',effects:[{kind:'draw',count:3},{kind:'handDiscard',count:1}]}],text:'自分のユニット1体の上に進化（文明不問）。無色の進化元の記載コスト分、このカードの青コストを軽減する（自分のキャラクターが青なら0まで、それ以外は最低青1）。攻撃時、3枚引いてもよい。そうしたら手札1枚を選びトラッシュへ。'},
 {key:'brain',name:'サイバー・ブレイン',type:'呪文',cost:M.cost(3,{青:1}),onUse:[{kind:'draw',count:3}],text:'カードを3枚引く。'},
 {key:'shaper',name:'ストリーミング・シェイパー',type:'呪文',cost:M.cost(0,{青:3}),deckLimit:1,onUse:[{kind:'revealBlue',count:4}],text:'上から4枚を公開。青をすべて手札へ、残りをトラッシュへ。ドローではない。'},
 {key:'vegas',name:'Dの博才 サイバーダイス・ベガス',type:'設置物',cost:M.cost(4,{青:1}),symbols:{青:1},onEnd:[{kind:'optionalDraw',count:1}],text:'自分のターン終了時、1枚引いてもよい。Dスイッチ・置き換えルールなし。'},
 {key:'cosmo',name:'ルナ・コスモビュー',type:'通常',cost:M.cost(8,{青:1}),attack:6,maxHealth:6,symbols:{青:2},abilities:['ブロッカー'],gZero:{hand:10},onEnter:[{kind:'draw',count:1}],provisional:true,text:'ブロッカー。G・ゼロ：使用前の手札10枚以上なら無料召喚。登場時1枚ドロー。コスト内訳は仮値。'},
 {key:'counter',name:'対抗呪文',type:'呪文',cost:M.cost(2,{青:1}),responseOnly:true,instant:true,spellCounter:true,text:'インスタント。相手が呪文を使用するか、クリーチャーを召喚するか、カードの効果によってクリーチャーを場に出そうとしたとき、その使用・召喚・登場を1件無効にする。'},
 {key:'gate',name:'スパイラル・ゲート',type:'呪文',cost:M.cost(1,{青:1}),instant:true,onUse:[{kind:'unitBounce'}],text:'インスタント。クリーチャー1体を持ち主の手札へ。'},
 {key:'goby',name:'パルピィ・ゴービー',type:'通常',cost:M.cost(2,{青:1}),attack:2,maxHealth:2,symbols:{青:1},abilities:['ブロッカー'],cannotAttack:true,onEnter:[{kind:'reorder',count:5}],text:'ブロッカー・攻撃不可。登場時上5枚を自分だけ見て並べ直す。'},
 {key:'zwei',deckLimit:1,name:'万象の水霊 ネレイア',type:'通常',cost:M.cost(3,{青:5}),attack:13,maxHealth:13,symbols:{青:3},evolution:{color:'青'},unblockable:true,text:'自分の青ユニットの上へ進化。ブロックされない。最上段だけがシンボル・能力・攻撃力・最大体力を供給。使用済みを継承、召喚酔いなし。'},
 {key:'amaterasu',name:'蒼狼の始祖アマテラス',type:'通常',cost:M.cost(2,{青:2}),attack:2,maxHealth:2,abilities:['ブロッカー'],symbols:{青:1},onEnter:[{kind:'searchSpell',max:3}],text:'ブロッカー。登場時、自分の山札または手札からコスト3以下の呪文を1枚、コストを支払わずに使用してもよい。山札を見た場合、その後シャッフルする。'},
 {key:'emeral',name:'エメラル',type:'通常',cost:M.cost(1,{青:1}),attack:1,maxHealth:1,symbols:{青:1},onEnter:[{kind:'inspectShield'}],text:'登場時：相手の未使用シールド1枚を選び、自分だけ内容を確認する。使用状態は変えない。'},
 {key:'corile',name:'コーライル',type:'通常',cost:M.cost(4,{青:1}),attack:2,maxHealth:2,symbols:{青:1},onEnter:[{kind:'topUnit'}],text:'登場時：相手ユニット1体を持ち主のメインデッキの上へ戻す。設置物・マナ・キャラ対象外。'},
 {key:'snow',name:'スノーマン召喚',type:'呪文',cost:M.cost(3,{青:1}),onUse:[{kind:'tokens',count:3}],text:'スノーマントークン3体を召喚。'},
 {key:'inquiry',name:'ウォズレックの審問',type:'呪文',cost:M.cost(1,{青:1}),onUse:[{kind:'inspectDiscard',max:3}],text:'相手の手札を一時的に確認し、軽減前合計3以下のカード1枚を選んでトラッシュへ。対象があれば1枚必須。'},
 {key:'vice',name:'スケルトン・バイス',type:'呪文',cost:M.cost(3,{青:1}),onUse:[{kind:'randomDiscard',count:2}],text:'相手の手札からランダムに2枚を重複せずトラッシュへ。手札全体は公開しない。1枚なら1枚だけ。'}
 ];
 for(const d of blueDefs)cards[d.key]={color:'青',symbols:{},abilities:[],onUse:[],onEnter:[],onDefeat:[],reduction:{minimum:{青:1}},...d};
 cards.bn7={color:'青',symbols:{},abilities:[],onEnter:[],onDefeat:[],reduction:{minimum:{青:1}},key:'bn7',rarity:'N',rarityProvisional:false,name:'エナジー・ライト',type:'呪文',cost:M.cost(2,{青:1}),onUse:[{kind:'draw',count:2}],text:'カードを2枚引く。'};
 cards.snowToken={key:'snowToken',name:'スノーマン',type:'通常',color:'青',cost:null,attack:1,maxHealth:1,symbols:{青:1},abilities:[],token:true,onUse:[],onEnter:[],onDefeat:[]};
 const neutralDefs=[
 {key:'jil',name:'慟哭のジル・クライハート',type:'通常',cost:M.cost(8),attack:5,maxHealth:5,symbols:{},deckLimit:1,genericReduction:{maximum:4,minimum:4},onEnter:[{kind:'chooseFate'}],provisional:true,text:'運命を選ぶ。有色シンボル1つにつき1軽減、最大4・最低4。攻撃力・最大体力5は暫定。'},
 {key:'peridot',name:'永遠の蜃気楼 ペリドット',type:'通常',cost:M.cost(4),attack:4,maxHealth:4,symbols:{},deckLimit:1,onEnter:[{kind:'blinkSelf'}],onBodySuccess:[{kind:'blinkSelf'}],provisional:true,text:'登場時・本体への攻撃成功時に自身を除外。次の自分のターン開始時、スピードアタッカーを持って帰還。攻撃力・最大体力4は暫定。'},
 {key:'themis',name:'テミスの審判',type:'呪文',cost:M.cost(6),onUse:[{kind:'wipeUnits'}],text:'お互いの場のユニットをすべてトラッシュへ。設置物・マナは対象外。'},
 {key:'holyMail',name:'ホーリー・メール',type:'呪文',cost:M.cost(3),onUse:[{kind:'healLife',count:4}],text:'自分のライフを4回復する（最大30）。'},
 {key:'kaiser',name:'ショットガン・カイザー',type:'通常',cost:M.cost(7),attack:9,maxHealth:9,symbols:{},onEnd:[{kind:'untapMana',count:4}],text:'自分のターン終了時、自分のマナを最大4枚選んで未使用に戻す。複数体はそれぞれ誘発。'},
 {key:'glennya',name:'グレンニャー',type:'通常',cost:M.cost(2),attack:1,maxHealth:1,symbols:{},onEnter:[{kind:'draw',count:1}],text:'登場時：カードを1枚引く。'},
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
 const characterLevels={1:{cost:1,text:'成長時・開始時：1ドロー。',effects:[{kind:'draw',count:1}]},2:{cost:3,text:'成長時・開始時：相手ランダム1捨て。成長直後のみメモリー・フラスコを任意使用。',effects:[{kind:'randomDiscard',count:1}]},3:{cost:5,text:'成長時・開始時：相手の場1枚をバウンス（マナ不可）→ランダム1捨て。',effects:[{kind:'enemyBounce'},{kind:'randomDiscard',count:1}]},4:{cost:7,text:'成長時：相手2捨て。常時：自分の効果で相手が実際に1枚捨てるごと1ドロー＋アクア・ガード。サイドの不特定3軽減。',effects:[{kind:'randomDiscard',count:2}]}};
 const sideDefs=[
 {key:'almar',name:'アルマー',type:'キャラクター',cost:M.cost(1),level:0,text:'Lv1→Lv4へ順番に成長。通常の攻撃・ブロックは行わない。'},
 {key:'gunveet',name:'記憶の管理者 リゼット',type:'通常',cost:M.cost(4,{青:3}),attack:7,maxHealth:7,symbols:{青:1},requiredCharacter:'almar',provisional:true,onEnter:[{kind:'destroyTapped'}],awaken:'darkGunveet',text:'登場時：相手の横向き1体を破壊。相手ターン終了時、相手手札0なら覚醒。覚醒前7/7・青1は仮設定。'},
 {key:'alegre',name:'ルナ・アレグル',type:'通常',cost:M.cost(5,{青:2}),attack:5,maxHealth:5,symbols:{青:1},provisional:true,onEnd:[{kind:'draw',count:1},{kind:'handDiscard',count:1}],awaken:'alegria',text:'終了時1ドロー→自分の手札1捨て。自分の開始時、トラッシュの呪文6枚を山札へ戻して覚醒可能。5/5・青1は仮設定。'},
 {key:'dogiragon',name:'蒼き覚醒 ドギラゴンX',type:'通常',cost:M.cost(8),attack:13,maxHealth:13,symbols:{},revolution:true,text:'通常支払い不可。自分の元コスト5以上のクリーチャーの攻撃時に革命チェンジ。交換元を除外し同じ枠で攻撃を引き継ぐ。サイド使用1回。'},
 {key:'viceCharger',name:'メモリー・フラスコ',type:'呪文',cost:M.cost(0),stackCost:M.cost(0),requiredCharacter:'almar',charger:true,sideboardDiscardAfterUse:true,onUse:[{kind:'randomDiscard',count:1},{kind:'blueStock'}],text:'アルマー専用チャージャー。相手の手札をランダムに1枚捨てさせ、青ストック1個を得る。使用後はトラッシュへ。サイドボードに戻れば再使用できる。'},
 {key:'lostSoul',name:'記憶の簒奪',type:'呪文',cost:M.cost(6,{青:1}),requiredCharacter:'almar',onUse:[{kind:'randomDiscard',count:999}],text:'相手の手札をすべて捨てさせる。実際の捨て札1枚ごとにアルマーLv4が誘発する。'},
 {key:'conspiracy',name:'陰謀と計略の手',type:'呪文',cost:M.cost(3,{青:1}),onUse:[{kind:'enemyUnitBounce'},{kind:'opponentDiscard'}],text:'相手の1体をバウンス→相手本人が手札1枚を選んで捨てる。'},
 {key:'technology',name:'インビンシブル・テクノロジー',type:'呪文',cost:M.cost(12,{青:1}),allBlueReduction:3,onUse:[{kind:'technologySearch'},{kind:'technologyCast'}],text:'自分のマナがすべて青なら不特定をさらに3軽減（0まで）。山札から任意枚数を手札へ→現在手札枚数以下の元コストの青カード1枚を任意で無料使用。'},
 {key:'interstellar',name:'星界の門番 デウス・エクス・マキナ',type:'通常',cost:M.cost(6,{青:1}),attack:5,maxHealth:5,symbols:{青:2},requiredCharacter:'almar',abilities:['ブロッカー'],justDiver:true,onEnter:[{kind:'interstellarEnter'}],onAttack:[{kind:'interstellarAttack'}],text:'ジャストダイバー：登場時、次の自分のターン開始まで相手に選ばれず、攻撃されない。登場時：手札またはトラッシュから元コスト7以下の呪文1枚を無料使用→除外。攻撃時：除外の元コスト7以下の呪文1枚を無料使用→使用後山札下。'},
 {key:'vt5000',name:'飛翔龍 5000VT',type:'通常',color:'青',cost:M.cost(7,{青:1}),attack:12,maxHealth:12,symbols:{青:2},fieldReduction:true,onEnter:[{kind:'vtBounceLock'}],text:'両者の場のクリーチャー・設置物1枚につき無色コストを1軽減（0まで）。青1は必須。登場時：両者の攻撃力5以下を全バウンス。次の相手ターン中、相手は攻撃力5以下を出せない。'}
 ];
 for(const d of sideDefs)cards[d.key]={color:'青',symbols:{},abilities:[],onUse:[],onEnter:[],onDefeat:[],sideboardOnly:true,reduction:{minimum:{青:1}},...d};
 const awakened={
 darkGunveet:{name:'記憶の管理者 リゼット・エンゲージ',cost:M.cost(9),attack:9,maxHealth:9,symbols:{青:2},abilities:[],speedAttacker:true,onEnter:[],onStart:[{kind:'darkHand'}],text:'覚醒後のみ。9/9・青2・SA。自分の開始時：相手手札確認→1枚選んで捨てる→同じ元コストの相手1体を破壊。覚醒解除なし。'},
 alegria:{name:'ルナ・アレグリア',cost:M.cost(14),attack:13,maxHealth:13,symbols:{青:3},abilities:[],onEnd:[],onEnter:[],drawOnUse:true,revertAtFive:true,text:'覚醒後のみ。13/13・青3。自分の召喚・呪文使用時1ドロー。自分の手札5枚以下なら覚醒解除。'}
 };
 cards.aquaGuard={key:'aquaGuard',name:'アクア・ガード',type:'通常',color:'青',cost:null,attack:0,maxHealth:1,symbols:{青:1},abilities:['ブロッカー'],cannotAttack:true,token:true,onUse:[],onEnter:[],onDefeat:[],text:'攻撃不可。場を離れれば消滅。'};
 const sideboardPreset=sideDefs.filter(c=>!['vt5000','viceCharger'].includes(c.key)).map(c=>({key:c.key,count:1})).concat({key:'s3',count:1});
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
 cards.yellowZone={key:'yellowZone',name:'イエローゾーン',rarity:'UR',color:'黒',type:'シールドカード',deckSection:'shields',deckLimit:1,requiredCharacter:'redMoonAvenger',cost:null,symbols:{},abilities:[],onUse:[],onEnter:[],onDefeat:[],shieldRule:{event:'lifeThreshold',effect:'yellowZone',maxLife:15},triggerCondition:'ライフ変更後、現在ライフ15以下で自動発動（1試合1回）。赤月の復讐者の固有自傷・ルールダメージでは発動しない。',useCondition:'赤月の復讐者専用。',text:'仮称。発動中は最大ライフ15、相手から受ける3以上のダメージは3、シールドによるライフ回復不可。他の回復は可能。裏向きで効果を失い、再発動しない。'};
 const decks={...starter.decks,green:[...defs.map(c=>({key:c.key,count:['bahamut','mother'].includes(c.key)?1:3})),{key:'glennya',count:2}],blue:[...blueDefs.filter(c=>c.key!=='walsura').map(c=>({key:c.key,count:['shaper','zwei'].includes(c.key)?1:3})),{key:'glennya',count:2}]};

 (typeof module==='object'&&module.exports?require('./shield-link-cards.js'):globalThis.ShieldLinkCards).install(M,cards);
 (typeof module==='object'&&module.exports?require('./lumiere-cards.js'):globalThis.LumiereCards).install(M,cards);
 // Sheet batch 2026-11-04: only Lv1 changes; Lv2–4 remain as defined above.
 characterLevels[1].text='成長時：カードを1枚引く。';
 for(const key of ['almar','redCaptain','blueSage','celestia','ereshthiaNox','redMoonAvenger']){
  const c=cards[key];if(!c)throw Error('Missing character '+key);
  if(c.characterEffects)c.characterEffects[1]=[{kind:'draw',count:1}];
  if(c.levelTexts)c.levelTexts[1]='成長時：カードを1枚引く。';
  if(key==='redCaptain')c.text=c.text.replace('Lv1：手札1捨て→相手1点。','Lv1：成長時に1ドロー。');
  if(key==='celestia')c.text=c.text.replace('Lv1〜3：成長時と自分開始時に現在レベルの能力。','Lv1：成長時に1ドロー。Lv2〜3：成長時と自分開始時に現在レベルの能力。');
 }
 cards.ws1={key:'ws1',name:'光神龍スペル・デル・フィン',color:'白',rarity:'SR',rarityProvisional:false,type:'通常',cost:M.cost(6,{白:3}),attack:3,maxHealth:8,symbols:{白:2},abilities:[],onUse:[],onEnter:[],onDefeat:[],reduction:{minimum:{白:1}},deckLimit:3,civilizations:['白'],spellLock:true,revealEnemyHand:true,spellHandBonus:true,text:'相手は呪文を唱えられない。相手は手札を公開してプレイする。相手の手札の呪文1枚につき攻撃力+1。'};
 cards.wu4={key:'wu4',name:'断罪の執行者',color:'白',rarity:'LEGEND',rarityProvisional:false,type:'通常',cost:M.cost(5,{白:2}),attack:0,maxHealth:1,symbols:{白:1},abilities:['ブロッカー'],onUse:[],onEnter:[{kind:'executorSelect'}],onDefeat:[],reduction:{minimum:{白:1}},deckLimit:1,civilizations:['白'],spellImmune:true,text:'ブロッカー。自分・相手双方の呪文効果を受けない。登場時、相手クリーチャーを最大2体選ぶ。選択時の攻撃力合計を自身の攻撃力に、現在体力合計を最大体力に加算。その後選んだクリーチャーを破壊。場に残った対象は次の自分のターン終了時まで攻撃・ブロック不可。'};
 (typeof module==='object'&&module.exports?require('./white-cards.js'):globalThis.WhiteCards).install(M,cards,awakened);
 cards.verdantguardian={
  key:'verdantguardian',name:'新緑の守護者',type:'キャラクター',color:'緑',civilizations:['緑'],rarity:'UR',
  level:0,cost:M.cost(1),sideboardOnly:true,deckLimit:1,symbols:{},abilities:[],growthOnly:true,
  onUse:[],onEnter:[],onDefeat:[],
  characterEffects:{1:[{kind:'draw',count:1}],2:[{kind:'guardianHand'}],3:[{kind:'guardianTop'}],4:[]},
  levelTexts:{
   1:'成長時：1ドロー。',
   2:'成長時：手札から元コスト4以下のカード1枚を任意で無料使用。',
   3:'成長時：山札の上5枚を見て、リソース枚数以下の元コストのクリーチャー1枚を任意で無料登場。残りはランダムな順番で山札の下へ。',
   4:'自分のターンに1回、自分のクリーチャー1体をリソースへ置き、山札の一番上を公開。クリーチャーなら無料登場し、その攻撃力以下の相手1体を任意でリソースへ。それ以外なら公開カードを自分のリソースに置き、リソース1枚を手札へ。サイドの無色3軽減。'
  },text:'現在レベルの能力のみ有効。'
 };
 cards.gt5000.deckLimit=3;cards.vt5000.deckLimit=3;
 cards.vt5000.sideboardOnly=false;cards.vt5000.mainDeckOnly=true;delete cards.vt5000.sideboardScope;
 cards.br6={key:'br6',name:'封魔ウアラク（仮）',color:'青',rarity:'R',type:'通常',cost:M.cost(1,{青:1}),
  attack:1,maxHealth:3,blocksEntryTurnSpeedAttack:true,abilities:[],symbols:{},onUse:[],onEnter:[],onDefeat:[],
  text:'スピードアタッカーを持つクリーチャーは、登場したターンに攻撃できない。'};
 const xyz=(key,name,color,rarity,attack,maxHealth,summon,abilityLines,extra={})=>{cards[key]={
  key,abilities:[],symbols:{},onEnter:[],onUse:[],onDeath:[],onDefeat:[],
  name,color,rarity,type:'通常',cost:null,sideboardOnly:true,cardSection:'sideboard',attack,maxHealth,xyz:summon,
  stackCost:color==='無色'?M.cost(1):M.cost(0,{[color]:1}),abilityLines,text:abilityLines.join('\n'),...extra
 };};
 xyz('sbbr2','ネフィル・アサイラム・ヘット・ナイト（N・As・H Knight）','青','R',2,8,{count:2,ability:'absorb'},[
  '自分・相手のメインフェイズに1ターンに1回、このカードの素材を2枚取り除いて発動できる。場の他のクリーチャー1体を選び、このカードの下にエクシーズ素材として重ねる。'
 ]);
 xyz('sbbs2','CX－N・As・Ch Knight（カオスナイト）','青','SR',7,3,{count:3,overlayBase:'sbbr2',ability:'overlay'},[
  '自分の《ネフィル・アサイラム・ヘット・ナイト》の上に重ねて出すこともできる。通常の素材条件とストック支払いは不要。',
  '自分のメインフェイズに、このカードの素材を2枚取り除いて発動できる。サイドボードのエクシーズ・クリーチャー1体をこのカードの上に重ねる。通常の素材条件とストック支払いは不要。回数制限なし。'
 ]);
 xyz('sbno2','CiNo.1000 夢幻虚光神ヌメロニアス・ヌメロニア','無色','OR',10,10,{count:8,earliestTurn:10},[
  '自分の10ターン目以降にのみ場に出せる。効果で重ねる場合にも適用する。タップ状態で場に出る。このカードは攻撃できない。',
  'このカードが場にある限り、自分はゲームに敗北しない。このカードが場を離れた場合、自分はゲームに敗北する。このカードは相手の効果によって選ばれない。',
  'このカードが場にある限り、相手は1ターンにクリーチャー1体でしか攻撃できない。',
  '相手の攻撃宣言時、このカードの素材を1枚取り除いて発動できる。その攻撃を無効にする。',
  '相手ターン終了時、このカードが場にあるなら、自分はゲームに勝利する。',
  '登場時、自分の場の他のカードと手札をすべてトラッシュに置く。その後、自分のトラッシュのカードをすべて除外する。エクシーズ素材は場のカードではないため移動しない。'
 ],{xyzNumeronia:true,enterRest:true,cannotAttack:true,untargetable:true,onEnter:[{kind:'xyzWipe'}]});
 cards.bs9={key:'bs9',name:'エナジー・ゲート',color:'青',rarity:'SR',type:'呪文',cost:M.cost(6,{青:1}),damageTrigger:M.cost(0,{青:1}),onUse:[{kind:'draw',count:2},{kind:'psychicChoice',choice:'energyEntry'}],
  text:'2枚引く。その後、手札からコスト7以下のクリーチャー1体を無償で出してもよい。ダメージトリガー：ライフが10以下なら手札から公開し、山札の上1枚を公開する。同じ色があれば青ストック1個で無償使用できる。公開した山札のカードは戻してシャッフルする。'};
 cards.sbbs3={key:'sbbs3',name:'アクア・アタック＜BAGOOON・パンツァー＞',color:'青',rarity:'SR',type:'通常',cost:M.cost(7),attack:4,maxHealth:4,sideboardOnly:true,psychic:true,awaken:'sbbs3-2',panzerAwaken:true,
  abilities:['ブロッカー'],cannotAttack:true,cannotBeAttacked:true,onStart:[{kind:'optionalDraw',count:1}],
  text:'ブロッカー。攻撃されず、自身は攻撃できない。自分のターン開始時、1枚引いてもよい。相手ターン終了時に自分の山札が10枚以下なら、トラッシュを山札に戻してシャッフルし覚醒する。サイドボード由来はサイドボードに戻す。'};
 awakened['sbbs3-2']={faceId:'sbbs3-2',name:cards.sbbs3.name+'（覚醒）',type:'通常',color:'青',rarity:'SR',cost:M.cost(10),attack:5,maxHealth:5,panzerAwaken:false,onStart:[{kind:'psychicChoice',choice:'panzerSearch'}],text:'ブロッカー。攻撃されず、自身は攻撃できない。自分のターン開始時、山札から1枚を手札に加えてもよい。その後シャッフルする。'};
 const catalog=(typeof module==='object'&&module.exports?require('./identity.js'):globalThis.CardIdentity).install({starter,COLORS,TYPES,cards,characterLevels,awakened,sideboardPreset,shieldKeys:Object.values(cards).filter(c=>c.type==='シールドカード').map(c=>c.key),neutralKeys:neutralDefs.map(c=>c.key),fateKeys:fates.map(c=>c.key),decks,startDeck:'green'});
 for(const [i,cost] of [1,2,2,3].entries())characterLevels[i+1].cost=cost;
 characterLevels[2].text='成長時・開始時：相手の手札をランダムに1枚捨てる。';
 characterLevels[4].text='成長時：相手の手札をランダムに2枚捨てる。常時：自分の効果で相手が実際に1枚捨てるごとに1ドローし、アクア・ガードを出す。';
 const c=catalog.cards, forms=catalog.awakened;
 c.nu1.unavailable='個別軽減が旧シンボルを参照するため、新しい軽減条件の確認待ち。';
 const updateText=text=>text?.replace(/（最大30）|（最大ライフまで）|。共通：サイドの不特定3軽減|。サイドの無色3軽減|。サイド無色3軽減/g,'');
 for(const card of Object.values(c)){
  if(card.text)card.text=updateText(card.text);
  if(card.levelTexts)for(const level of Object.keys(card.levelTexts))card.levelTexts[level]=updateText(card.levelTexts[level]);
 }

 Object.assign(c.redcaptain,{provisional:false,growthOnly:true,characterEffects:{1:[{kind:'draw',count:1}],2:[],3:[],4:[]},
  text:'Lv0：SAを持って登場した自分のクリーチャー1体につき赤ストック1個。成長後も有効。',
  levelTexts:{1:'成長時：1枚引く。',2:'SAを持って登場した自分のクリーチャー1体につき1枚引き、相手に1ダメージ。',3:'自分のターンに1回、赤ストック1個で自分のクリーチャー1体にターン中SA。',4:'自分のターンに1回、赤1を含む4ストックで手札からコスト7以下のクリーチャーを無償登場。ターンに1回、攻撃で相手本体にダメージを与えた時、山札の一番上から攻撃クリーチャーのコスト以下のクリーチャーを任意で無償登場させ、SAを与える。'}
 });
 Object.assign(c.rn15,{speedAttacker:true,text:'スピードアタッカー。攻撃可能なら毎ターン必ず攻撃。'});
 Object.assign(c.rn16,{speedAttacker:true,cost:M.cost(1,{赤:2}),text:'スピードアタッカー。'+c.rn16.text});
 c.rn20.cost=M.cost(2,{赤:1});
 const add=(key,definition)=>c[key]={key,baseId:key,faceId:key,abilities:[],symbols:{},onEnter:[],onUse:[],onDeath:[],onDefeat:[],...definition};
 Object.assign(c.almar,{growthOnly:true,growthCosts:{1:1,2:2,3:2,4:4},characterEffects:{1:[{kind:'draw',count:1}],2:[],3:[],4:[]},
  text:'Lv0：相手の手札からトラッシュに置かれたカード1枚につき青ストック1個。成長後も有効。',
  levelTexts:{1:'成長時：1枚引く。',2:'自分のメインフェイズ開始時：2枚引き、手札1枚を選んで捨てる。',3:'自分のターンに1回、青ストック1個で相手手札1枚を選び山札の下へ。',4:'各ターン1回：互いに1枚か2枚を選んで引く／メモリー・フラスコをトラッシュからサイドへ／青ストック3個で手札差のダメージと相手山札の上1枚を上か下へ。相手が手札を捨てるたび、空き枠にアクア・ガード1体を生成し、任意で1枚引く。'}
 });
 add('sbbo1',{name:'コード・ピルルク',color:'青',rarity:'OR',type:'通常',cost:M.cost(12),attack:0,maxHealth:20,sideboardOnly:true,cardSection:'sideboard',psychic:true,psychicLock:true,psychicBrainTouch:true,awaken:'sbbo1-2',faceIds:['sbbo1','sbbo1-2'],text:'相手は相手のドローフェイズ以外、手札にカードを加えられない。自分の終了時、自分の手札が相手より5枚以上多ければ覚醒。自分のターンに1回、青ストック2個で相手の手札をランダムに1枚捨てさせ、その後自分は1枚引く。'});
 forms['sbbo1-2']={faceId:'sbbo1-2',name:'コード・ピルルクΩ',color:'青',type:'通常',rarity:'OR',cost:M.cost(16),attack:0,maxHealth:25,psychicLock:false,psychicBrainTouch:false,psychicIntercept:true,text:'相手のドローフェイズ以外の相手の手札追加に干渉。クリーチャーは捨てて攻撃力分ダメージ、呪文は無償で唱え、元の持ち主のトラッシュへ。応答専用呪文は有効な応答先がなければ不発。その他は山札の下。自分のターンに1回、青ストック2個で相手山札の上2枚を並べ替え、互いに1枚引く。'};
 const hole=(key,name,color,generic,effects,filter,text)=>add(key,{name,color,rarity:'SR',type:'呪文',cardSection:'main',cost:M.cost(generic,{[color]:1}),onUse:[...effects,{kind:'psychicSummon',...filter}],text});
 hole('bs6','超次元ストラテジー・ホール','青',6,[...c.br7.onUse],{color:'青'},'相手1体を手札へ戻し、相手自身が手札1枚を捨てる。その後サイドから青サイキック1体を出す。召喚コスト上限なし。');
 hole('bs7','超次元バイス・ホール','青',4,[{kind:'psychicChoice',choice:'viceSpell'}],{max:10},'相手の手札を確認し、呪文1枚を捨てさせる。その後サイドからコスト10以下のサイキック1体を出す。');
 hole('bs8','超次元ドラヴィタ・ホール','青',3,[{kind:'psychicChoice',choice:'dravitaRecover'}],{max:7},'自分のトラッシュから呪文1枚を手札へ戻す。その後サイドからコスト7以下のサイキック1体を出す。');
 add('shno1',{name:'パーフェクト・シールド',color:'無色',rarity:'OR',type:'シールドカード',deckSection:'shields',cardSection:'shields',cost:M.cost(10),shieldRule:{event:'attackDeclared',effect:'perfectShield'},text:'相手の攻撃時、任意色のストック合計10個を支払い、その攻撃を無効にして相手のターンを終了する。'});
 catalog.shieldKeys.push('shno1');
 const white=(key,definition)=>add(key,{color:'白',civilizations:['白'],...definition});
 const whiteMana=n=>M.cost(n-1,{白:1});
 for(const key of ['wn4','wn5'])c[key].snakeEye=true;
 white('ws10',{name:'スネークアイ・キャット',rarity:'SR',type:'通常',snakeEye:true,cost:whiteMana(4),attack:3,maxHealth:4,
  onEnter:[{kind:'ownLinkDestroy'},{kind:'destroyUnitTarget'}],text:'登場時、自分のシールドリンク1枚を破壊。その後、相手クリーチャー1体を破壊。'});
 white('wr8',{name:'スネークアイ・ドッグ',rarity:'R',type:'通常',snakeEye:true,cost:whiteMana(2),attack:1,maxHealth:2,
  onEnter:[{kind:'ownLinkDestroy'},{kind:'damagePlayer',amount:2}],text:'登場時、自分のシールドリンク1枚を破壊。その後、相手に2ダメージ。'});
 white('ws11',{name:'蛇眼神殿',rarity:'SR',type:'設置物',shieldLink:true,cost:whiteMana(3),
  onStructureDestroy:[{kind:'templeRestore'}],text:'破壊時、自分のトラッシュから蛇眼神殿以外のシールドリンク1枚を設置する。'});
 white('wn6',{name:'リアクティブ・シールド',rarity:'N',type:'設置物',shieldLink:true,cost:whiteMana(1),
  onStructureDestroy:[{kind:'reactiveShield'}],text:'破壊時、ランダムな相手クリーチャー1体に3ダメージ。'});
 white('wr9',{name:'ギャラクシー・シールド',rarity:'R',type:'設置物',shieldLink:true,cost:whiteMana(4),
  onEnter:[{kind:'galaxyShield'}],
  text:'登場時、山札上2枚を見る。設置できるシールドリンクがあれば1枚を選び設置する。その後、残ったカードから1枚を手札に加え、さらに残ったカードをトラッシュに置く。'});
 white('wu3',{name:'蛇眼の大蛇（仮称）',rarity:'UR',type:'通常',snakeEye:true,cost:whiteMana(8),attack:4,maxHealth:7,
  serpentAbility:true,onEnter:[{kind:'serpentRecycle'}],text:'登場時、自分のトラッシュからクリーチャーを任意の枚数戻し（サイド由来はサイドボードへ）、その枚数以下の合計コストとなるようトラッシュからシールドリンクを設置する。自分のターンに自身を除外して、山札からコスト2以下のスネークアイを最大2体出す。'});
 const whiteSide=(key,definition)=>white(key,{sideboardOnly:true,cardSection:'sideboard',...definition});
 whiteSide('sbws1',{name:'スネークアイ・チャージャー',rarity:'SR',type:'呪文',snakeEye:true,charger:true,sideboardDiscardAfterUse:true,cost:M.cost(0),stackCost:M.cost(0),
  onUse:[{kind:'snakeCharger'}],text:'白ストックトークン1個を得る。山札上3枚を公開し、スネークアイとシールドリンクを手札へ、残りを山札の下へ。'});
 c.t10.cost=whiteMana(1);
 const special=(key,name,rarity,cost,attack,maxHealth,specialSummon,extra)=>whiteSide(key,
  {name,rarity,cost:whiteMana(cost),attack,maxHealth,specialSummon,type:'通常',...extra});
 special('sbns3','フォーミュラ・シンクロン','SR',2,2,2,'synchro',{color:'無色',civilizations:['無色'],cost:M.cost(2),onEnter:[{kind:'draw',count:1}],text:'シンクロ。登場時に1枚引く。'});
 special('sbws3','蛇眼の原罪龍','SR',8,6,6,'fusion',{snakeEye:true,onEnter:[{kind:'fusionRecover'}],
  text:'融合。スネークアイ2体と無色ストック1個、またはシールドリンク2枚。登場時、自分のトラッシュのシールドリンク1枚を任意で回収。'});
 special('sbno3','フルール・ド・バロネス','OR',10,7,9,'synchro',{color:'無色',civilizations:['無色'],cost:M.cost(10),
  baronne:true,text:'シンクロ。自分のターンに各1回、自身を破壊してトラッシュのカードを無料使用、または場の1枚を破壊。場にいる間1回、対抗魔術と同様に相手の行動を無効にできる。'});
 special('sbws4','スネークアイ・ファントム','SR',4,2,4,'synchro',{snakeEye:true,onEnter:[{kind:'phantomLinks',remaining:2}],text:'シンクロ。登場時、トラッシュのスネークアイ・クリーチャーを最大2枚、能力のないシールドリンクとして設置。'});
 special('sbwu2','蛇眼の断罪龍','UR',12,7,15,'synchro',{snakeEye:true,
  judgmentDragon:true,text:'シンクロ。お互いのターンに各1回、場・トラッシュの1枚を能力のないシールドリンクとして設置。相手ターンに1回、攻撃時にリンクを破壊して攻撃クリーチャーを破壊。離場時、トラッシュの蛇眼の原罪龍をサイドへ戻す。'});
 const equip=(key,name,rarity,count,equipment,face,description)=>{
  add(key,{name,rarity,color:'赤',type:'設置物',sideboardOnly:true,cardSection:'sideboard',cost:M.cost(0),stackCost:M.cost(0,{赤:count}),equipment,faceIds:[key,face],text:description});
 };
 const dragon=(key,name,cost,attack,maxHealth,extra={})=>forms[key]={faceId:key,name,type:'通常',cost:M.cost(cost),attack,maxHealth,equipment:null,onEnter:[],...extra};
 equip('sbru2','爆熱剣 バトライ刃','UR',2,'batblade','sbru2-2','赤クリーチャーに装備。装備先の攻撃時に山札上を公開し、コスト以下の赤クリーチャーなら登場。それ以外は山札の下へ。赤クリーチャーが登場したターンの終了時に龍解。');
 c.sbru2.faceIds.push('sbru2-3');
 forms['sbru2-2']={faceId:'sbru2-2',name:'爆熱天守 バトライ閣',equipment:null,text:'赤クリーチャーの攻撃時に山札上を公開し、コスト以下の赤クリーチャーなら登場。それ以外は山札の下へ。ターン中に赤クリーチャーが3体登場した時に龍解。'};
 dragon('sbru2-3','爆熱DX バトライ武神',8,8,8,{onAttack:[{kind:'batdragon'}],text:'攻撃時、山札上3枚から赤クリーチャー1体を選びSAを与えて出す。残りをランダムな順で山札の下へ。'});
 equip('sbrs2','ツインホーン','SR',3,'twinhorn','sbrs2-2','装備先はターン中に2回攻撃できる。ターン中に相手ライフを合計5以上減らした時に龍解。');
 c.sbrs2.provisional=true;
 dragon('sbrs2-2','ガイバーン',7,6,6,{speedAttacker:true,onEnter:[{kind:'gaiburn'}],text:'スピードアタッカー。龍解時、自身を破壊し、その後、相手に3ダメージ。'});
 equip('sbru3','覇闘将龍剣 ガイオウバーン','UR',3,'gaiou','sbru3-2','装備先の攻撃力＋3。その後、相手クリーチャーとバトルし、装備先の体力は開始時に2以上なら1、1なら0になる。自軍のターン中2回目の戦闘勝利で龍解。');
 dragon('sbru3-2','勝利の覇闘 ガイラオウ',7,7,7,{machFighter:{duration:'entryTurn'},onEnter:[{kind:'destroyUnitTarget'}],text:'マッハファイター。龍解時、相手クリーチャー1体を破壊。'});
 equip('sbrr1','無敵剣 プロト・ギガハート','R',1,'gigaheart','sbrr1-2','相手のクリーチャー能力または呪文による装備先の離場を龍解で置換。');
 dragon('sbrr1-2','最強龍 オウギンガ・ゼロ',4,4,4,{speedAttacker:true,text:'スピードアタッカー。'});
 equip('sbrr2','熱血剣 グリージーホーン','R',1,'greasy','sbrr2-2','装備先にマッハファイター。自分の終了時に装備先が横向きなら龍解。');
 dragon('sbrr2-2','熱血龍 リトルビッグホーン',5,4,3,{machFighter:{duration:'entryTurn'},text:'マッハファイター。'});
 add('sbrn1',{name:'ネクスト・チャージャー',color:'赤',rarity:'N',type:'呪文',cardSection:'sideboard',sideboardOnly:true,charger:true,sideboardDiscardAfterUse:true,cost:M.cost(0),stackCost:M.cost(0),onUse:[{kind:'nextCharger'}],text:'任意で手札をすべて好きな順番で山札の下へ置き、同じ枚数引く。どちらの場合も使用後に赤ストック1個を獲得。'});
 add('shnu1',{name:'反撃の一手',rarity:'UR',type:'シールドカード',color:'無色',cardSection:'shields',deckSection:'shields',cost:null,
  shieldRule:{event:'lethal',effect:'counterMove'},text:'ライフが0以下になるダメージを受けた時、ライフを1にし、キャラクターと同じ色のストックを5個得る。このターン、ライフは減少しない。'});
 catalog.shieldKeys.push('shnu1');
 for(const [key,name,event,effect,text] of [
  ['shnr7','力の温存','damaged','reserveStacks','ダメージを受けた時、キャラクターと同じ色のストックを2個得る。'],
  ['shnr8','力の解放','attackDeclared','releaseStacks','相手の攻撃時、任意色のストック5個で攻撃クリーチャーを破壊し、さらに相手のクリーチャー1体を任意で破壊。'],
  ['shnr9','水晶の記憶','damaged','crystalMemory','ダメージを受けた時、通常デッキから好きなカード1枚を手札に加える。']
 ]){add(key,{name,rarity:'R',type:'シールドカード',color:'無色',cardSection:'shields',deckSection:'shields',cost:null,shieldRule:{event,effect},text});catalog.shieldKeys.push(key);}
 forms.sbnl1={...c.sbnl1,faceId:'sbnl1',trample:true,abilities:['トランブル'],text:'パラレル革命：自分の攻撃力6以上のクリーチャーの攻撃時に、交換元を除外し、同じ枠で攻撃を引き継ぐ。ストック消費なし。トランブル。'};
 delete c.sbnl1;
 Object.assign(c.sbnu3,{faceIds:['sbnu3','sbnl1'],alternateFace:'sbnl1',revolutionMinimumAttack:6,stackCost:M.cost(0),text:c.sbnu3.text+' ストック消費なし。'});
 Object.assign(c.ro1,{cardSection:'main',rarity:'OR',rarityProvisional:false});
 delete c.ro1.faceIds;
 add('sbru4',{name:'闘将銀河城 ハートバーン',color:'赤',rarity:'UR',type:'設置物',cardSection:'sideboard',sideboardOnly:true,
  heartburn:true,redSpeedAura:true,cost:M.cost(0),stackCost:M.cost(0,{赤:4}),faceIds:['sbru4','sbru1-2'],
  text:'自分の赤クリーチャーすべてにSA。自分の赤クリーチャーがアンタップした時、超戦覇龍 ガイNEXTへ龍解。'});
 for(const key of ['almar_sbbu1','sbbu1'])c[key].psychic=true;
 const eligibleLegacySide=new Set(['sbnu2','sbgu1','almar_sbbu1','sbbu1','sbnr4','celestia_sbnr1','lumiere_sbwr1','sbwu3']);
 for(const card of Object.values(c)){
  if(card.sideboardOnly&&!card.psychic&&!card.specialSummon&&!card.xyz&&card.type!=='キャラクター'&&!card.stackCost&&!card.unavailable){
   if(eligibleLegacySide.has(card.key))card.unavailable='色付きストック支払い条件が未確定。';
   else{
    Object.assign(card,{sideboardOnly:false,mainDeckOnly:true,cardSection:'main',deckSection:'main'});
    delete card.sideboardScope;
   }
  }
 }
 catalog.sideboardPreset=catalog.sideboardPreset.filter(e=>c[e.key]?.sideboardOnly&&!c[e.key].unavailable&&!c[e.key].psychic);
 return (typeof module==='object'&&module.exports?require('./character-series.js'):globalThis.CharacterSeries).install(catalog);
});
