(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CardUpdate=api;})(globalThis,function(){
function install(M,c,a){
 const groups={UR:'r1 otohime kuraki b1 shaper zwei bahamut mother jil peridot s5 s9 dogiragon vt5000 piruluk',SSR:'redCaptain blueSage s8 alegre technology gunveet interstellar',SR:'r3 r4 b6 b7 cosmo amaterasu dragon trap repair dolt themis walsura s6 lostSoul',R:'r2 r7 counter brain vice inquiry vegas fortune touki bird kaiser honenbee s2 s3 s4 s7 conspiracy viceCharger reactiveArmor wisdomBlessing',N:'imperialGuard r5 r6 gate b5 goby emeral corile snow life bronze elf panzer glennya c1 c2 c3 c4 c5 c6 c7 s1'};
 c.repair.cost=M.cost(0,{緑:5});c.repair.instant=c.trap.instant=c.brain.instant=c.mother.instant=true;
 c.mother.text='インスタント。両者いずれかのクリーチャー1体を持ち主のマナへ。その持ち主のマナから移動後のマナ枚数以下の元コストのクリーチャー1体を必ず無料登場。全選択は発動者が行う。';
 c.panzer.text='タップして登場。攻撃を引き付ける。自分のシールドを表にした時、自分のマナに緑のカードが5枚以上あれば手札から任意で無料登場。';c.panzer.shieldEntry=true;
 c.s5.name='時空の火焔ボルシャック・ドラゴン';a.giantAwake.name='勝利の覚醒者ボルシャック・メビウス';c.s9.name='轟く覚醒 レッドゾーン・バスター';
 const unit=(key,name,cost,attack,maxHealth,symbols,extra)=>c[key]={key,name,cost,type:'通常',color:'赤',attack,maxHealth,symbols,abilities:[],onEnter:[],onDeath:[],onUse:[],reduction:{minimum:{赤:1}},...extra};
 unit('otohime','憤怒の竜帝・乙姫',M.cost(1,{赤:6}),2,2,{赤:2},{guardCommander:true,onEnter:[{kind:'fillGuards'}],text:'登場時、空き枠を竜帝の近衛兵で埋める。自分の近衛兵は登場ターンから縦横を問わず相手クリーチャーへ攻撃できる。'});
 unit('imperialGuard','竜帝の近衛兵',null,2,1,{}, {token:true,deckEligible:false,onDeath:[{kind:'guardDeath'}],text:'死亡時、相手の各クリーチャーと相手プレイヤーから等確率で1対象を抽選し1ダメージ。'});
 unit('kuraki','昏き底より出でる者',M.cost(6,{赤:3}),8,10,{赤:3},{markerGuard:true,onEnter:[{kind:'attachMarker'}],text:'登場時、山札上1枚を裏向きマーカーにする。離場をマーカー破棄で1回防ぐ。マーカーが外れた時アンタップなら攻撃力分を相手に与える。マーカー付きの本体攻撃成功時、攻撃力分の追加ダメージ。マーカーなしなら各ターン終了時破壊。'});
 const shields=[['revival','起死回生','UR','lethal','revive','ライフ0以下時、ライフ15回復。回復後も0以下なら敗北。'],['negateAttack','攻撃の無力化','UR','attackDeclared','negate','ライフ5以下で攻撃された時、敵全クリーチャーをタップし攻撃無効。',5],['firstAid','応急処置','R','damaged','firstAid','ダメージを受けた時、そのダメージと同じ値だけライフ回復。'],['bindingChain','束縛の鎖','R','attackDeclared','tapTwo','攻撃された時、相手クリーチャーを最大2体タップ。攻撃は無効にならない。'],['evacuation','緊急撤退','R','attackDeclared','evacuate','攻撃された時、クリーチャー1体をバウンス。'],['weakCurse','弱体化の呪い','SR','attackDeclared','weaken','攻撃された時、敵1体の攻撃力を次の自分のターンまで0に。'],['counterArrow','反撃の一矢','R','damaged','counterArrow','ダメージを受けた時、相手プレイヤーに3ダメージ。'],['desperate','決死の反撃','SR','attackDeclared','desperate','攻撃された時、自分のライフ2を失い攻撃クリーチャーを破壊。']];
 for(const [key,name,rarity,event,effect,text,maxLife]of shields)c[key]={key,name,rarity,type:'シールドカード',color:'無色',cost:null,symbols:{},deckSection:'shields',abilities:[],onUse:[],onEnter:[],shieldRule:{event,effect,...(maxLife===undefined?{}:{maxLife})},triggerCondition:event==='attackDeclared'?'相手クリーチャーが攻撃した時。':event==='lethal'?'自分のライフが0以下になった時。':'自分がダメージを受けた時。',text,deckLimit:rarity==='UR'?1:4};
 for(const [rarity,keys]of Object.entries(groups))for(const k of keys.split(' '))if(c[k]){c[k].rarity=rarity;c[k].rarityProvisional=false;c[k].deckLimit=rarity==='UR'?1:3;}
 for(const k of ['alegre','dogiragon','technology','vt5000','conspiracy'])delete c[k].requiredCharacter;
 for(const k of ['gunveet','interstellar','lostSoul','viceCharger'])c[k].requiredCharacter='piruluk';
 c.interstellar.packExcluded=true;c.interstellar.specificationHold='ジャストダイバーの確定全文・期限の確認待ち。旧効果は維持。';c.holyMail.packExcluded=true;for(const x of Object.values(c))if(x.token||x.generated||x.deckEligible===false)x.packExcluded=true;
}
return {install};});
