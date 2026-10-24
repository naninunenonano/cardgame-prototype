(function(root,factory){const a=factory();if(typeof module==='object'&&module.exports)module.exports=a;else root.ExpansionCards=a;})(globalThis,function(){function install(M,c,a){
const make=(key,name,r,g,n,color,type,stats,extra={})=>c[key]={key,name,rarity:r,deckLimit:r==='UR'?1:3,cost:M.cost(g,n?{[color]:n}:{}),color,civilizations:n?[color]:['無色'],type,symbols:type==='通常'&&n?{[color]:1}:{},abilities:[],onUse:[],onEnter:[],onDeath:[],onDefeat:[],reduction:{minimum:{[color]:1}},...(stats?{attack:stats[0],maxHealth:stats[1]}:{}),...extra};
make('manarock','メガ・マナロック・ドラゴン','UR',0,6,'赤','通常',[3,3],{onEnter:[{kind:'manaLock'}],onAttack:[{kind:'manaLock'}],text:'登場時・攻撃時：相手のマナにある色ごとに未ロックのカード1枚を選びタップ。次の相手開始時の回復を1回防ぐ。無色は対象外。'});
make('churis','ダチッコ・チュリス','SR',1,1,'赤','通常',[2,2],{symbols:{},onEnter:[{kind:'temporarySymbols',color:'赤',count:3}],text:'基本シンボル0。登場時、このターン赤シンボル3を追加。'});
make('drillSquall','ドリル・スコール','R',0,1,'赤','呪文',null,{onUse:[{kind:'eachDestroyMana'}],text:'各プレイヤーが自分のマナ1枚を選び破壊。マナトークンは消滅。'});
make('blazeClaw','ブレイズクロー','N',0,1,'赤','通常',[2,2],{symbols:{},mustAttack:true,text:'攻撃可能なら毎ターン必ず攻撃。召喚酔いは通常どおり。'});
make('rageArm','レイジアーム','N',1,1,'赤','通常',[1,2],{symbols:{},rageArm:true,text:'他のクリーチャーが場に出るたび、このターン攻撃力+1。自身では誘発しない。'});
make('apache','狂葬者 アパッチ','N',2,1,'赤','通常',[4,3],{onEnter:[{kind:'selfDamage',amount:3}],text:'登場時、自分のライフに3ダメージ。'});
make('arianrhod','アリアンロッド','N',1,1,'赤','通常',[1,1],{symbols:{},lootAbility:true,nameProvisional:true,text:'タップ＋手札1枚を捨てることをコストに1ドロー。召喚酔い中不可。名称は仮登録。'});
make('redManaBreaker','野蛮な侵略者','N',1,1,'赤','通常',[3,2],{onEnter:[{kind:'ownDestroyMana'}],text:'登場時、自分のマナ1枚を選び破壊。'});
make('scrapper','地獄スクラッパー','N',3,1,'赤','呪文',null,{instant:true,onUse:[{kind:'scrapper',remaining:5}],text:'インスタント。敵の盤面のカード1枚に1ダメージを5回順番に処理。毎回対象を選び直す。相手プレイヤーは対象外。'});

make('bolmeteus','ボルメテウス・ホワイト・ドラゴン','UR',6,1,'赤','通常',[7,7],{sideboardOnly:true,symbols:{赤:2},shieldSilence:true,text:'攻撃中、相手はシールドを使用できない。本体のライフを減らした攻撃の終了時、相手の裏向きシールド1枚を発動させず表へ。ブロック可能。'});
make('moltNext','超戦龍覇 モルトNEXT','SSR',2,5,'赤','通常',[5,6],{sideboardOnly:true,symbols:{赤:2},redUntap:true,awakenOnUntap:'gaiNext',text:'マナがすべて赤なら攻撃終了時アンタップ。アンタップした時ガイNEXTへ覚醒。状態を引き継ぐ。'});
a.gaiNext={name:'超戦覇龍 ガイNEXT',cost:M.cost(14),attack:8,maxHealth:10,symbols:{赤:3},redUntap:false,awakenOnUntap:null,speedAura:true,release:true,onEnter:[],onAttack:[],onDeath:[],text:'自分の全クリーチャーにSA。解除：離場の代わりにモルトNEXTへ戻る。ダメージ・状態を維持。'};
make('scrambleChange','スクランブル・チェンジ','SR',2,1,'赤','呪文',null,{sideboardOnly:true,onUse:[{kind:'scramble'}],text:'このターン次の赤クリーチャー召喚を5軽減（色指定を優先して最低1残し、残りを無色から軽減）。その個体にこのターンSA。サイド1ターン1枚制限を消費。'});
make('gaiaLord','大地の巨神 ガイアロード','SR',6,3,'緑','通常',[9,9],{symbols:{緑:2},castFromMana:true,onEnter:[{kind:'recoverMana',count:2}],text:'マナからも通常支払いで召喚可。登場時マナから可能な限り2枚を手札へ。'});
make('celestia','セレスティア','UR',1,0,'緑','キャラクター',null,{sideboardOnly:true,civilizations:['緑'],symbols:{},level:0,characterEffects:{1:[{kind:'draw',count:1}],2:[{kind:'manaAdd',count:1}],3:[{kind:'celestiaBuff'}],4:[]},levelTexts:{1:'成長時・自分開始時：1ドロー。',2:'成長時・自分開始時：山札上1枚をマナへ。成長直後のみランプチャージャーを任意使用。',3:'成長時・自分開始時：自分の1体の攻撃力を永続+2。',4:'両者の終了時：自分の1体のダメージを全回復し最大体力を永続+1。サイド無色3軽減。'},text:'緑URキャラクター。Lv1〜3：成長時と自分開始時に現在レベルの能力。Lv4：各プレイヤー終了時に全回復＋最大体力+1。'});
make('dravita','時空の精圧ドラヴィタ','SSR',5,2,'緑','通常',[3,10],{sideboardOnly:true,requiredCharacter:'celestia',machFighter:{duration:'entryTurn'},untapOnWin:true,teamWinsAwaken:'vermillion',text:'マッハファイター。戦闘勝利時アンタップ。自分のターン、自分の全クリーチャーの戦闘勝利が3回になると覚醒。'});
a.vermillion={name:'龍圧の覚醒者ヴァーミリオン・ドラヴィタ',cost:M.cost(14),attack:6,maxHealth:15,symbols:{緑:3},untapOnWin:false,teamWinsAwaken:null,spellSilence:true,onEnter:[],onDeath:[],text:'場にいる間、相手の呪文の効果をすべて無効。唱えることとコスト支払いは可能。状態引き継ぎ。'};
make('ancientWyvern','エンシェント・ホーリー・ワイバーン','SSR',7,3,'緑','通常',[0,14],{sideboardOnly:true,requiredCharacter:'celestia',symbols:{緑:2},statMode:'lifeDifference',lifeSave:true,text:'攻撃力＝自分ライフ−相手ライフ（最低0）。破壊時、任意でライフ5を失い、破壊を防ぎ全回復。ライフ6以上で使用可。バウンス等には無効。'});
make('fairyBeast','フェアリービースト','SR',0,7,'緑','通常',[3,3],{sideboardOnly:true,requiredCharacter:'celestia',onEnter:[{kind:'draw',count:1},{kind:'healHand'}],text:'登場時1ドロー、その後の手札枚数だけ回復（最大30）。'});
make('rampCharger','ランプチャージャー','R',0,0,'緑','呪文',null,{sideboardOnly:true,requiredCharacter:'celestia',viceOnly:true,onUse:[{kind:'manaAdd',count:1},{kind:'manaToken',color:'緑'}],text:'セレスティアLv2成長直後のみ任意、コスト0。山札上1枚をマナへ→緑マナトークン1。自身はサイド使用済み。見送り後使用不可、成長との二重消費なし。'});
make('gigandidanos','大樹王 ギガンディダノス','UR',3,9,'緑','通常',[13,13],{sideboardOnly:true,symbols:{緑:3},firstAttackLure:true,onEnter:[{kind:'opponentToMana',count:2}],text:'登場時、相手本人が手札と場のクリーチャーから計2枚をマナへ。相手ターン中タップ状態なら、そのターン最初の攻撃対象を自身へ強制。'});
make('crystalFusion','クリスタル・フュージョン','SSR',8,1,'緑','呪文',null,{sideboardOnly:true,onUse:[{kind:'fusion'}],text:'処理開始時の自分のマナ枚数と同数、山札上からすべて使用済みでマナへ。'});
make('royalDogiragon','王道の革命 ドギラゴン','SSR',7,2,'緑','通常',[7,7],{sideboardOnly:true,symbols:{緑:2},machFighter:{duration:'entryTurn'},onEnter:[{kind:'manaAdd',count:3},{kind:'recoverMana',count:1}],text:'マッハファイター。登場時山札上3枚をマナへ→マナ1枚を手札へ。革命能力なし。'});
for(const k of ['dravita','ancientWyvern','fairyBeast']){delete c[k].requiredCharacter;c[k].requiredCharacterColor='緑';c[k].sideboardScope='緑専用';}c.zundoko.rarity='R';c.zundoko.rarityProvisional=false;for(let i=1;i<=7;i++)c['c'+i].packExcluded=true;
// Cost defines civilization; character identities and costless tokens remain explicit.
for(const x of Object.values(c)){if(x.cost&&x.type!=='キャラクター'){x.civilizations=M.colors.filter(k=>x.cost[k]>0);if(!x.civilizations.length)x.civilizations=['無色'];x.color=x.civilizations[0];}if(x.sideboardOnly&&!x.requiredCharacter&&!x.requiredCharacterColor)x.sideboardScope='汎用';else if(x.requiredCharacter)x.sideboardScope=x.requiredCharacter==='celestia'?'緑専用（セレスティア）':'ピルルク専用';}
for(const x of Object.values(a)){x.rarity=x.rarity||'SSR';x.deckEligible=false;}
}
return {install};});
