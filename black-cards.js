(function(root,factory){const a=factory();if(typeof module==='object'&&module.exports)module.exports=a;else root.BlackCards=a;})(globalThis,function(){
function install(M,c){
 const make=(key,name,rarity,black,generic,stats,symbols,extra={})=>{if(c[key])throw Error('Duplicate card: '+key);return c[key]={key,name,rarity,deckLimit:rarity==='UR'?1:3,color:'黒',civilizations:['黒'],type:stats?'通常':'呪文',cost:M.cost(generic,{黒:black}),symbols:symbols?{黒:symbols}:{},abilities:[],onUse:[],onEnter:[],onDeath:[],onDefeat:[],reduction:{minimum:{黒:1}},...(stats?{attack:stats[0],maxHealth:stats[1]}:{}),...extra};};
 make('zalba','黒神龍ザルバ','N',4,0,[5,3],1,{onEnter:[{kind:'opponentDraw',count:1}],text:'登場時：相手は1枚引く。'});
 make('bloodPactServant','血契の従者','N',1,2,[3,3],0,{vengeanceStats:true,onEnter:[{kind:'selfDamage',amount:3},{kind:'draw',count:1}],text:'登場時：自分に3ダメージ、その後1ドロー。復讐（現在ライフ15以下）の間+1/+1。'});
 make('duskSentry','宵闇の番兵','N',1,0,[0,3],0,{onEnter:[{kind:'vengeanceEntry',attack:2}],text:'登場時、復讐状態なら永続+2/+0。復讐解除後も維持。'});
 make('bloodbladeTracker','血刃の追跡者','R',1,2,[4,1],0,{machFighter:{duration:'entryTurn'},onEnter:[{kind:'vengeanceEntry',speed:true}],text:'マッハファイター。登場時、復讐状態ならスピードアタッカーを得る。'});
 make('doomDevourer','破滅を喰らう者','UR',1,1,[1,1],0,{onEnter:[{kind:'selfDamage',amount:10},{kind:'draw',count:2},{kind:'selfBuff',attack:3,health:3},{kind:'destroyUnitTarget'}],text:'登場時：自分に10ダメージ→2ドロー→自身を+3/+3→相手クリーチャー1体を破壊。'});
 make('twinBloodBeast','双撃の血獣','SR',3,2,[3,9],1,{machFighter:{duration:'entryTurn'},attacksPerTurn:2,afterAttackSelfDamage:2,text:'マッハファイター。1ターンに2回攻撃可能。攻撃するたび、攻撃後に自分へ2ダメージ。'});
 make('nightBanquetKin','夜宴の眷属','R',4,2,[2,2],1,{onEnter:[{kind:'tokens',count:3,tokenKey:'blackKinToken'}],text:'登場時：2/2・黒シンボル1の黒クリーチャートークンを3体出す（盤面7体まで）。'});
 // Internal generated token, excluded from decks, collection, crafting and packs.
 make('blackKinToken','夜宴の眷属トークン','N',0,0,[2,2],1,{token:true,generated:true,deckEligible:false,cost:null,text:'2/2の黒クリーチャートークン。黒シンボル1。'});
 make('ceres','セレス','SR',2,2,[1,5],1,{beforeBattleDamage:4,onEnd:[{kind:'healLife',count:3}],text:'他のクリーチャーとの戦闘前、相手クリーチャーに4ダメージ。相手が破壊されたら通常のダメージ交換なし。自分のターン終了時ライフ3回復。'});
 make('bloodmoonWarrior','血月の戦鬼','R',2,3,[4,4],1,{onAttack:[{kind:'bothPlayerDamage',amount:2}],text:'攻撃時：お互いのプレイヤーに2ダメージ。'});
 const herald=(key,name,kind)=>make(key,name,'SR',1,6,[0,1],1,{onPlayerDamage:[{kind}],text:'相手プレイヤーへダメージを与えたとき（攻撃が通れば0ダメージでも発動）：'+({halveEnemyLife:'相手の現在ライフを半分（端数切り捨て）にする。',limitEnemyRecovery:'次の相手ターンに回復するマナは合計最大3枚（自然回復・効果による回復を含む）。',destroyTwoEnemies:'相手クリーチャーを可能な限り異なる2体破壊。',stealEnemyLife:'相手に4ダメージ、その後自分のライフ4回復。',sealEnemyHand:'相手の全手札を一時除外し、次の相手ターン終了時に元の持ち主の手札へ戻す。'}[kind])});
 herald('endHerald','終焉の宣告者','halveEnemyLife');herald('manaSealHerald','魔力封鎖の宣告者','limitEnemyRecovery');herald('judgmentHerald','断罪の宣告者','destroyTwoEnemies');herald('lifeTheftHerald','生命収奪の宣告者','stealEnemyLife');herald('memorySealHerald','記憶封印の宣告者','sealEnemyHand');
 make('bloodKing','滅界の血王','UR',3,7,[8,10],2,{speedAttacker:true,onEnter:[{kind:'bloodKingWipe'}],onAttack:[{kind:'bloodKingLifeCost'}],text:'スピードアタッカー。登場時：相手クリーチャーをすべて破壊し、破壊したクリーチャーの攻撃力合計分、自分にダメージ。攻撃時：ライフを直接1減らす。0以下なら戦闘・ドレイン前に敗北。'});
 make('apocalypse','黙示録','SR',4,4,null,0,{vengeanceGenericReduction:4,onUse:[{kind:'allUnitDamage',amount:8}],text:'両者の全クリーチャーに8ダメージ。復讐状態なら無色4軽減。通常シンボル軽減と併用し、最終支払いは最低1。'});
}
return {install};});
