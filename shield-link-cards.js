(function(root){'use strict';function install(M,cards){
 const add=(key,name,rarity,white,generic,type,stats,symbols,extra,text)=>cards[key]={key,name,rarity,color:'白',rarityProvisional:false,type,cost:M.cost(generic,{白:white}),civilizations:['白'],symbols:symbols?{白:symbols}:{},abilities:[],onUse:[],onEnter:[],onDefeat:[],deckLimit:3,reduction:{minimum:{白:1}},...(stats?{attack:stats[0],maxHealth:stats[1]}:{}),...extra,text};
 add('wn1','我竜塔第一層 セイント・キャッスル','N',1,0,'設置物',null,0,{shieldLink:true,replacePlayerDamage:true},'シールドリンク。自分がダメージを受けるとき、かわりにそのダメージを0にし、この設置物をトラッシュに置く。0ダメージにも適用する。');
 add('ws2','ウィリデ・ゴル・ゲルス','SR',2,4,'通常',[2,1],2,{shieldLinkReduction:4,enemyUseDraw:true},'自分の場にシールドリンク設置物があれば召喚コストの無色部分を4軽減。相手ターン中、相手がクリーチャーを召喚、呪文を唱える、またはカードを設置したとき1ドロー。各相手ターン1回。');
 add('ws3','楯教の求道者 ザゼ・ゼーン','SR',1,1,'通常',[6,6],2,{abilities:['ブロッカー'],enterRest:true,noStartUntap:true,onShieldLinkEnter:true},'ブロッカー。横向きで登場し、自分のターン開始時に縦向きにならない。自分の場にシールドリンク設置物を出すたび自身を縦向きにし、①1ドロー、②相手クリーチャー1体を横向きにし次の相手開始時に縦向きにしない、③次の自分開始時まで自身は場を離れない、から1つ選ぶ。');
 add('ws4','雷鳴の守護者ミスト・リエス','SR',3,2,'設置物',null,1,{shieldLink:true,drawOnAnyUnitEnter:true},'シールドリンク。自分・相手の他のクリーチャーが出るたび、カードを1枚引いてもよい。回数制限なし。');
 add('wu1','無敵城 シルヴァー・グローリー','UR',1,5,'設置物',null,1,{shieldLink:true,preventUnitBattleDamage:true},'シールドリンク。自分のクリーチャーはバトルによるダメージを受けない。');
 add('wn2','ヒール・サークル','N',1,0,'設置物',null,0,{shieldLink:true,onStart:[{kind:'healLife',count:1}]},'シールドリンク。自分のターン開始時、自分のライフを1回復する。');
 add('wr1','隼の軌跡','R',1,1,'設置物',null,0,{shieldLink:true,nextStartSacrifice:true,onEnter:[{kind:'tokens',tokenKey:'t7',count:1}],onStart:[{kind:'falconStart'}]},'シールドリンク。設置時、白のコスト2・2/1・スピードアタッカー・シンボルなしのトークン1体を出す。次の自分のターン開始時、この設置物を破壊し、1ドロー。');
 add('t7','隼トークン',null,0,2,'通常',[2,1],0,{token:true,deckEligible:false,speedAttacker:true,deckLimit:0,reduction:null},'スピードアタッカー。ゲーム中に生成され、戦場を離れると消滅する。デッキ採用・収集・生成・分解の対象外。');
 }root.ShieldLinkCards={install};if(typeof module==='object'&&module.exports)module.exports=root.ShieldLinkCards;})(globalThis);
