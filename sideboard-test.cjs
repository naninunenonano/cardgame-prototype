const { holdUnavailable }=require('./test-fixtures.cjs');
const {fund,finishRefresh,skipCharge}=require('./test-fixtures.cjs');
const A=require('node:assert/strict'),R=require('./game.js'),C=require('./cards.js'),D=require('./decks.js'),M=require('./mana.js'),B=require('./bot.js');let n=0;const yes=r=>A(r.ok,r.message),test=(name,f)=>{f();n++;console.log('PASS '+name);};
function game(){let t=0;const g=R.create({clock:()=>t,random:()=>.4,sideboards:{p1:'almar',p2:'almar'},decks:{p1:'blue',p2:'blue'},strictTargets:true});yes(g.completeMulligan('p1'));yes(g.completeMulligan('p2'));skipCharge(g);fund(g,'p1',1);g.tick=()=>t+=1000;fund(g,'p1',19);return g;}
function settle(g,skipVice=true){let i=0;while(g.operation&&i++<300){if(g.operation.kind==='refreshPenalty'){finishRefresh(g);continue;}const o=g.operation;if(o.kind==='tokens')yes(g.placeToken(g.placementOptions(o.p).find(z=>!g.state[o.p][z.id].length)?.id||null));else if(o.kind==='sideChoice'&&o.choice==='viceOffer'&&skipVice)yes(g.resolveSideChoice(null));else if(o.kind==='shieldWindow')yes(g.resolveShield(null));else {const a=B.decide(g.observe(g.decisionPlayer()));A.notEqual(a.type,'wait',JSON.stringify(o));yes(g.dispatch(a,g.decisionPlayer()));}}A(i<300);}
function next(g,p='p1'){settle(g);while(g.turn.step!=='end'){g.tick();yes(g.advance());while(g.operation?.kind==='response')yes(g.passResponse());settle(g);}g.tick();if(p==='p1')yes(g.advance());else yes(g.soloNextPlayer(p));while(g.operation?.kind==='response')yes(g.passResponse());settle(g);skipCharge(g);}
function grow(g,l){while(g.character('p1').level<l){yes(require('./test-fixtures.cjs').growthFixture(g));settle(g);g.turn.step='main1';}return g.character('p1');}
function vtCard(g,p='p1',key='bo1'){const c=g.fromDefinition(key,p);g.state[p].hand.push(c);return c;}
function side(g,key,target=null){const c=C.cards[key].sideboardOnly?g.state.p1.extra.find(c=>c.key===key):vtCard(g,'p1',key);A(c,key);yes(g.beginPayment(c.id));if(c.type==='通常')yes(g.chooseSlot(g.placementOptions('p1',c)[0].id));if(target)yes(g.selectUseTarget(target));yes(g.confirmPayment());while(g.operation?.kind==='response')yes(g.passResponse());return c;}
function unit(g,p='p1',attack=6,extra={}){const c=g.card('fixture','通常','青',M.cost(6));Object.assign(c,{attack,maxHealth:attack||1,health:attack||1,...extra});yes(g.addCard(p,g.placementOptions(p)[0].id,c));c.sick=false;Object.assign(c,extra);return c;}
function fixtureSide(g,key,p='p1'){const c=g.fromDefinition(key,p);g.state[p][g.placementOptions(p)[0].id].push(c);c.health=c.maxHealth;c.sick=false;c.used=true;return c;}
function fillHand(g,p,count){while(g.state[p].hand.length<count)g.state[p].hand.push(g.fromDefinition('br1',p));}
test('unique side cards and four prototype growth costs, no ordinary eligibility',()=>{A.equal(C.sideboardPreset.length,2);A.equal(new Set(C.sideboardPreset.map(c=>c.key)).size,2);A.deepEqual(Object.values(C.characterLevels).map(d=>d.cost),[1,2,2,3]);for(const e of C.sideboardPreset){A.equal(D.sectionOf(C.cards[e.key]),'sideboard');A(!D.available('main').some(c=>c.key===e.key));}A(!D.available().some(c=>c.key==='t2'));});
test('explicit loadout does not change green/blue presets or main/lands/shields',()=>{const g=game();A.equal(g.state.p1.extra.length,1);A.equal(g.state.p1.hand.length,5);A.equal(g.state.p1.main.length,35);A.equal(g.state.p1.shields.length,4);A.equal(D.preset('blue').sideboard.length,0);});
test('growth1 uses1, separate lrig no creature slot and draws1',()=>{const g=game(),hand=g.state.p1.hand.length;grow(g,1);A.equal(g.character('p1').level,1);A.equal(g.state.p1.lrig.length,1);A.equal(g.fieldCards('p1').length,0);A.equal(g.state.p1.hand.length,hand+1);A.equal(g.paymentSources('p1').length,20);A.equal(g.state.p1.stacks.length,1);A.equal(g.beginGrowth('p1').ok,false);});
test('Almar growth Lv2–4 leaves the opponent hand intact and does not spend the side use',()=>{
 const g=game(),hand=g.state.p2.hand.length;
 grow(g,4);
 A.equal(g.state.p2.hand.length,hand);
 A.equal(g.operation,null);
 A(!g.sideSpent('p1'));
});
test('current start level only, lv4 has no additional start discard',()=>{const g=game();grow(g,4);fillHand(g,'p2',3);const before=g.state.p2.hand.length;next(g);A.equal(g.state.p2.hand.length,before);});
test('Lv4 gives no common reduction and Technology keeps its own mono-blue discount',()=>{const g=game();grow(g,4);const c=vtCard(g,'p1','sbbu2');A.equal(g.effectiveCost(c,'p1').generic,9);A.equal(g.effectiveCost(c,'p1').青,1);A.equal(g.costBreakdown(c,'p1').level4,0);A.equal(g.costBreakdown(c,'p1').allBlue,3);});
test('lostSoul actual discarded count triggers, zero hand no extra draws',()=>{const g=game();grow(g,4);next(g);fillHand(g,'p2',3);const count=g.state.p2.hand.length,before=g.state.p1.hand.length;const c=side(g,'almar_sbbs1');settle(g);A.equal(g.state.p2.hand.length,0);A.equal(g.state.p1.hand.length,before+count);A.equal(g.fieldCards('p1').filter(c=>c.key==='t2').length,count);A.equal(g.locate(c.id).z,'trash');A(!g.sideSpent('p1'));A.equal(g.beginPayment(c.id).ok,false);});
test('migrated spell goes to trash and does not consume the side turn',()=>{const g=game();const c=side(g,'sbbr1');settle(g);A.equal(g.locate(c.id).z,'trash');A(!g.sideSpent('p1'));});
test('psychic leaves to the sideboard',()=>{const g=game(),c=fixtureSide(g,'sbbu1');A(g.destroyUnit(c.id));A.equal(g.locate(c.id).z,'extra');A(!g.state.p1.trash.some(x=>x.id===c.id));});
test('gunveet awakens at opponentend sameid9/9青2SA and no extra hand effect',()=>{const g=game(),c=fixtureSide(g,'almar_sbbu1');g.state.p2.hand=[];next(g,'p2');g.state.p2.hand=[];const before=g.state.p1.hand.length;while(g.turn.step!=='end'){g.tick();yes(g.advance());while(g.operation?.kind==='response')yes(g.passResponse());settle(g);}A.equal(c.awakened,'almar_sbbu1-2');A.equal(c.attack,9);A.equal(c.maxHealth,9);A.equal(c.symbols.青,2);A(c.speedAttacker);A.equal(g.state.p1.hand.length,before);});
test('dark start hand view private then same-cost destruction and no empty hand destruction',()=>{const g=game(),c=fixtureSide(g,'almar_sbbu1');g.state.p2.hand=[];next(g,'p2');g.state.p2.hand=[];while(g.turn.step!=='end'){g.tick();yes(g.advance());while(g.operation?.kind==='response')yes(g.passResponse());settle(g);}const hand=g.fromDefinition('br1','p2');g.state.p2.hand.push(hand);const target=unit(g,'p2',6,{cost:M.cost(4)});g.tick();yes(g.advance());while(g.operation?.kind==='response')yes(g.passResponse());A.equal(g.operation.choice,'darkHand');A(g.observe('p1').operation.candidates[0].name);A.equal(g.observe('p2').operation.candidates,undefined);yes(g.resolveSideChoice(hand.id));while(g.operation?.kind==='response')yes(g.passResponse());A.equal(g.operation.choice,'destroySame');yes(g.resolveSideChoice(target.id));settle(g);A.equal(g.locate(target.id).z,'trash');});
test('alegre end drawdiscard; awaken by return6spells and解除 at hand5',()=>{const g=game(),c=fixtureSide(g,'sbbu1');for(let i=0;i<6;i++)g.state.p1.trash.push(g.fromDefinition('br1','p1'));fillHand(g,'p1',8);next(g); // settle uses Bot to select6 and awaken
A.equal(c.awakened,'sbbu1-2');A.equal(c.attack,13);A.equal(c.cost.generic,14);g.state.p1.hand.splice(0,g.state.p1.hand.length-5);g.tick();yes(g.advance());while(g.operation?.kind==='response')yes(g.passResponse());settle(g);A.equal(c.awakened,null);A.equal(c.attack,5);});
test('combined parallel card enters on attack without paying stock',()=>{const g=game();grow(g,2);const d=g.state.p1.extra.find(c=>c.key==='sbnl4'),c=unit(g,'p1',6,{cost:M.cost(5)});A(!g.beginPayment(d.id).ok);const stock=g.state.p1.stacks.length;g.tick();yes(g.advance());yes(g.declareAttack(c.id,'body'));while(g.operation?.kind==='response')yes(g.passResponse());A.equal(g.operation.choice,'parallelFaces');yes(g.resolveExpansion('revolution'));A.equal(g.locate(c.id).z,'exile');A(g.isUnit(g.locate(d.id).z));A.equal(g.state.p1.stacks.length,stock);A(g.sideSpent('p1'));settle(g);});
test('conspiracy opponent selects discard, bounce ownership and lv4 hook',()=>{const g=game();grow(g,4);next(g);const target=unit(g,'p2',6);const c=side(g,'sbbr1');A.equal(g.operation.effect,'enemyUnitBounce');yes(g.resolveEffectTarget(target.id));A.equal(g.operation.choice,'opponentDiscard');A.equal(g.decisionPlayer(),'p2');const chosen=g.state.p2.hand.at(-1),before=g.state.p1.hand.length;yes(g.resolveSideChoice(chosen.id));settle(g);A.equal(g.state.p1.hand.length,before+1);A.equal(g.locate(chosen.id).z,'trash');});
test('technology arbitrary selection and optional free blue unit by handsize',()=>{const g=game();side(g,'sbbu2');A.equal(g.operation.choice,'technologySearch');const wanted=g.sideChoiceCandidates().slice(0,7);for(const c of wanted)yes(g.selectSideChoice(c.id));yes(g.resolveSideChoice());A.equal(g.operation.choice,'technologyCast');const chosen=g.sideChoiceCandidates().find(c=>c.type==='通常'&&!c.evolution&&!['bn3','bs2','bn4','sbbu1'].includes(c.key));A(chosen);yes(g.resolveSideChoice(chosen.id));A.equal(g.operation.kind,'sideFreePlace');yes(g.chooseSlot(g.placementOptions('p1',chosen)[0].id));yes(g.confirmSideFree());settle(g);A(g.isUnit(g.locate(chosen.id).z));});
test('interstellar cannot be attacked, enter spell exiles and attack spell puts bottom',()=>{const g=game();grow(g,1);next(g);g.state.p1.hand=[];const spell=g.fromDefinition('br1','p1');g.state.p1.hand.push(spell);const c=side(g,'almar_sbbu2');A.equal(g.operation.choice,'interstellarEnter');yes(g.resolveSideChoice(spell.id));settle(g);A.equal(g.locate(spell.id).z,'exile');c.sick=false;g.tick();yes(g.advance());while(g.operation?.kind==='response')yes(g.passResponse());yes(g.declareAttack(c.id,'body'));while(g.operation?.kind==='response')yes(g.passResponse());if(g.operation?.kind==='revolution')yes(g.resolveRevolution(false));while(g.operation?.kind==='response')yes(g.passResponse());A.equal(g.operation.choice,'interstellarAttack');yes(g.resolveSideChoice(spell.id));settle(g);A.equal(g.locate(spell.id).z,'main');A.equal(g.state.p1.main.at(-1).id,spell.id);});
test('VT counts both sides and tokens, not character, minimum0 without side-only Lv4 discount',()=>{const g=game();grow(g,4);next(g);const c=vtCard(g);A.equal(g.costBreakdown(c,'p1').level4,0);const count=g.fieldCards('p1').filter(c=>c.type==='通常').length;unit(g,'p1',6);unit(g,'p2',6);unit(g,'p2',0,{token:true});A.equal(g.costBreakdown(c,'p1').field,count+3);A.equal(g.effectiveCost(c,'p1').generic,Math.max(0,7-count-3));});
test('VT bounce own/enemy5 tokens vanish side returns6stays and lock survives source',()=>{const g=game(),own=unit(g,'p1',5),enemy=unit(g,'p2',5),big=unit(g,'p2',6),token=unit(g,'p2',0,{token:true}),smallSide=fixtureSide(g,'sbbu1');const c=side(g,'bo1');settle(g);A.equal(g.locate(own.id).z,'hand');A.equal(g.locate(enemy.id).z,'hand');A.equal(g.locate(token.id),null);A.equal(g.locate(smallSide.id).z,'extra');A(g.isUnit(g.locate(big.id).z));A(g.destroyUnit(c.id));A.equal(g.summonLocks.length,1);next(g,'p2');A(g.activeLocks('p2').length);});
test('VT next opponentturn blocks normal/free/tokens, not alreadyfield or6, expiresend',()=>{const g=game(),big=unit(g,'p2',6);side(g,'bo1');next(g,'p2');const small=g.fromDefinition('bn2','p2');g.state.p2.hand.push(small);A.equal(g.beginPayment(small.id).ok,false);A(g.summonError(C.cards.t2,'p2'));A.equal(g.summonError(C.cards.bs1,'p2'),'');A(g.isUnit(g.locate(big.id).z));next(g);A.equal(g.summonLocks.length,0);});
test('VT stops aqua generation but Lv4 discard draw still happens',()=>{const g=game();grow(g,4);next(g);const c=vtCard(g,'p2'); // fixture opponent entry using actual side turn
while(g.turn.step!=='end'){g.tick();yes(g.advance());while(g.operation?.kind==='response')yes(g.passResponse());settle(g);}yes(g.soloNextPlayer('p2'));skipCharge(g);fund(g,'p2',10);yes(g.beginPayment(c.id));yes(g.chooseSlot(g.placementOptions('p2',c)[0].id));yes(g.confirmPayment());while(g.operation?.kind==='response')yes(g.passResponse());settle(g);next(g,'p1');fillHand(g,'p2',2);const before=g.state.p1.hand.length;side(g,'almar_sbbs1');settle(g);A(g.state.p1.hand.length>before);A.equal(g.fieldCards('p1').filter(c=>c.key==='t2').length,0);});
test('VT multiple locks independent and currentattack stat not legacy power',()=>{const g=game(),c=side(g,'bo1');next(g);const other=g.fromDefinition('bo1','p1');g.state.p1.hand.push(other);unit(g,'p2',5,{attack:6,maxHealth:6,health:6});side(g,'bo1');settle(g);A.equal(g.summonLocks.length,2);A.equal(g.fieldCards('p2').length,1);});
test('counter and gate migrate to instants with foretell removed',()=>{A.equal(C.cards.br3.foretell,undefined);A.equal(C.cards.br3.cost.generic,2);A.equal(C.cards.br3.cost.青,1);A(C.cards.br3.responseOnly&&C.cards.br3.instant);A.equal(C.cards.bn1.foretell,undefined);});
test('save/load/duplicate side10, bad side count rejected and old empty remains valid',()=>{let raw;const storage={getItem:()=>raw,setItem:(k,v)=>raw=v},store=D.create({storage});const r=store.duplicate('blue');yes(r);const d=store.get(r.id);d.sideboard=JSON.parse(JSON.stringify(C.sideboardPreset));yes(store.save(d));A.deepEqual(D.create({storage}).get(r.id).sideboard,C.sideboardPreset);d.sideboard.pop();A.deepEqual(D.validate(d),[]);A.deepEqual(D.validate(D.preset('blue')),[]);});
test('Lv4 no actual discard means no draw/token; own discard never triggers',()=>{const g=game();grow(g,4);next(g);g.state.p2.hand=[];const before=g.state.p1.hand.length,token=g.fieldCards('p1').length;side(g,'almar_sbbs1');settle(g);A.equal(g.state.p1.hand.length,before);A.equal(g.fieldCards('p1').length,token);});
test('VT rejects free mother candidates and token operation entirely, permits high attacks',()=>{const g=game();side(g,'bo1');next(g,'p2');const low=g.fromDefinition('t1','p2'),high=g.fromDefinition('bs1','p2');A(g.summonError(low,'p2'));A.equal(g.summonError(high,'p2'),'');A.equal(g.addCard('p2','signi-1',low).ok,false);fund(g,'p2',10);const snow=g.fromDefinition('bn5','p2');g.state.p2.hand.push(snow);yes(g.beginPayment(snow.id));yes(g.confirmPayment());while(g.operation?.kind==='response')yes(g.passResponse());A.equal(g.operation,null);A.equal(g.fieldCards('p2').filter(c=>c.token).length,0);});
test('cannot-attack aqua cannot attack but supplies color and blocking; token exits vanish',()=>{const g=game(),c=g.fromDefinition('t2','p1');yes(g.addCard('p1','signi-1',c));g.tick();yes(g.advance());while(g.operation?.kind==='response')yes(g.passResponse());A(g.attackError(c.id));A.equal(g.symbols('p1').青,1);A(g.destroyUnit(c.id));A.equal(g.locate(c.id),null);});
test('allegrias spell draw retained and abolished foretell is unavailable',()=>{const g=game(),c=fixtureSide(g,'sbbu1');Object.assign(c,JSON.parse(JSON.stringify(C.awakened['sbbu1-2'])),{awakened:'sbbu1-2'});c.health=13;fillHand(g,'p1',10);const brain=g.fromDefinition('br1','p1');g.state.p1.hand.push(brain);const before=g.state.p1.hand.length;yes(g.beginPayment(brain.id));yes(g.confirmPayment());while(g.operation?.kind==='response')yes(g.passResponse());settle(g);A.equal(g.state.p1.hand.length,before+3); // spend1, brain3, watcher1
const counter=g.fromDefinition('br3','p1');g.state.p1.hand.push(counter);const count=g.state.p1.hand.length;A.equal(g.beginForetell,undefined);A.equal(g.state.p1.hand.length,count);});
test('interstellar uses spell from ordinary exile without foretell',()=>{const g=game(),c=fixtureSide(g,'almar_sbbu2'),spell=g.fromDefinition('bn1','p1'),enemy=unit(g,'p2',6);spell.faceUp=true;g.state.p1.exile.push(spell);g.tick();yes(g.advance());while(g.operation?.kind==='response')yes(g.passResponse());yes(g.declareAttack(c.id,'body'));while(g.operation?.kind==='response')yes(g.passResponse());if(g.operation?.kind==='revolution')yes(g.resolveRevolution(false));while(g.operation?.kind==='response')yes(g.passResponse());A.equal(g.operation.choice,'interstellarAttack');yes(g.resolveSideChoice(spell.id));A.equal(g.operation.kind,'freeCast');yes(g.selectUseTarget(enemy.id));yes(g.confirmFreeCast());settle(g);A.equal(g.locate(spell.id).z,'main');A.equal(g.state.p1.main.at(-1).id,spell.id);});
test('Bot strict full games with side10, hidden enemy hand and 1side action each own turn',()=>{for(const [p1,p2] of [['blue','blue'],['green','blue']])for(let seed=1;seed<=6;seed++){let t=0,r=seed;const g=R.create({mode:'bot',strictTargets:true,clock:()=>t,random:()=>((r=(r*1664525+1013904223)>>>0)/2**32),sideboards:{p1:'almar',p2:'almar'},decks:{p1,p2}});for(let i=0;i<18000&&!g.result;i++){t+=1000;const p=g.decisionPlayer(),v=g.observe(p);A.equal(v.players[p==='p1'?'p2':'p1'].hand,null);const action=B.decide(v);A.notEqual(action.type,'wait',JSON.stringify({op:g.operation,turn:g.turn}));yes(g.dispatch(action,p));}A(g.result,p1+'/'+p2+' seed'+seed);}});
test('Lv2 performs no discard until the main phase',()=>{const g=game();grow(g,2);fillHand(g,'p2',3);const own=g.state.p1.hand.length,enemy=g.state.p2.hand.length;next(g);A.equal(g.state.p1.hand.length,own+1);A.equal(g.state.p2.hand.length,enemy);});
test('seven creature cap maintained under multiple Lv4 discard triggers',()=>{const g=game();grow(g,4);next(g);while(g.fieldCards('p1').length<7)unit(g,'p1',6);fillHand(g,'p2',4);const before=g.state.p1.hand.length;side(g,'almar_sbbs1');settle(g);A.equal(g.fieldCards('p1').length,7);A.equal(g.state.p1.hand.length,before);});
test('VT filters actual mother free candidates before selecting low creature',()=>{const g=game(),own=unit(g,'p2',6);side(g,'bo1');next(g,'p2');fund(g,'p2',12);g.state.p2.energy[0].color='緑';const low=g.fromDefinition('bn2','p2'),high=g.fromDefinition('gs1','p2'),mother=g.fromDefinition('gl2','p2');g.state.p2.energy.push(low,high);g.state.p2.hand.push(mother);yes(g.beginPayment(mother.id));yes(g.selectUseTarget(own.id));yes(g.confirmPayment());while(g.operation?.kind==='response')yes(g.passResponse());A.equal(g.operation.kind,'freeUnit');A(!g.freeUnitCandidates().some(c=>c.id===low.id));A(g.freeUnitCandidates().some(c=>c.id===high.id));A.equal(g.chooseFreeUnit(low.id).ok,false);yes(g.chooseFreeUnit(high.id));});
test('passing a creature response still resolves VT and its lock',()=>{const g=game();fund(g,'p2',8);const counter=g.fromDefinition('br3','p2');g.state.p2.hand.push(counter);const c=side(g,'bo1');A.equal(g.operation,null);A.equal(g.beginPayment(counter.id,'br3').ok,false);A(g.isUnit(g.locate(c.id).z));A(!c.used);A(!g.sideSpent('p1'));A.equal(g.summonLocks.length,1);A.equal(g.locate(counter.id).z,'hand');});
test('mixed land disables only technology extra reduction, Lv4 leaves colored cost intact',()=>{const g=game();grow(g,4);next(g);const land=g.state.p1.energy[0];land.color='緑';land.mana.color='緑';const c=vtCard(g,'p1','sbbu2');A.equal(g.costBreakdown(c,'p1').allBlue,0);A.equal(g.effectiveCost(c,'p1').generic,12);A.equal(g.effectiveCost(c,'p1').青,1);});
test('awakened side departure restores base for psychic summoning',()=>{const g=game(),c=fixtureSide(g,'almar_sbbu1');g.state.p2.hand=[];next(g,'p2');g.state.p2.hand=[];while(g.turn.step!=='end'){g.tick();yes(g.advance());while(g.operation?.kind==='response')yes(g.passResponse());settle(g);}A.equal(c.awakened,'almar_sbbu1-2');A(g.destroyUnit(c.id));A.equal(g.locate(c.id).z,'extra');A.equal(c.awakened,null);A.equal(c.name,'記憶の管理者 リゼット');});
test('technology choosezero and decline freeuse preserve identity/counts',()=>{const g=game(),before=g.state.p1.main.map(c=>c.id).sort();side(g,'sbbu2');yes(g.resolveSideChoice());if(g.operation?.choice==='technologyCast')yes(g.resolveSideChoice(null));A.deepEqual(g.state.p1.main.map(c=>c.id).sort(),before);A.equal(g.operation,null);});
test('character cannot be paid as a card and a turn cannot grow twice',()=>{const g=game(),id=g.character('p1').id;A(!g.beginPayment(id).ok);yes(require('./test-fixtures.cjs').growthFixture(g));settle(g);A(!g.beginGrowth('p1').ok);A.equal(g.character('p1').level,1);});
test('sideboard roster retains both registered cards across character, field, return and used states',()=>{const g=game();grow(g,1);next(g);const c=side(g,'bo1');settle(g);A.equal(g.sideboardRoster('p1').length,2);A(g.sideboardRoster('p1').includes(g.character('p1')));A(!g.sideboardRoster('p1').includes(c));A(g.destroyUnit(c.id));A.equal(g.sideboardRoster('p1').length,2);});
test('side composition can exchange copies while keeping10, but only1 character',()=>{const d={...D.preset('blue'),id:'test',preset:false};d.sideboard=C.sideboardPreset.filter(e=>e.key!=='almar_sbbu1').map(e=>({...e,count:e.key==='sbnr2'?2:e.count}));A(!D.validate(d).some(e=>e.includes('サイド')));d.sideboard[0].count=2;A(D.validate(d).some(e=>e.includes('成長型キャラクター')));});
test('Xyz materials cannot be field targets and detach atomically to their respective owners',()=>{
 const g=game();
 const first=g.fromDefinition('nn3','p2'),second=g.fromDefinition('nn3','p1');
 const host=unit(g,'p1',6,{xyzMaterials:[first,second]});
 A.deepEqual(g.fieldCards('p1').map(c=>c.id),[host.id]);
 A.equal(g.locate(first.id),null);
 A(!g.targetOptions({kind:'unitBounce'},'p2').some(c=>[first.id,second.id].includes(c.id)));
 for(const ids of [[first.id,first.id],[first.id,'invalid']]){
  A(!g.detachXyzMaterials(host.id,ids).ok);
  A.deepEqual(host.xyzMaterials,[first,second]);
 }
 yes(g.detachXyzMaterials(host.id,[first.id]));
 A.deepEqual(host.xyzMaterials,[second]);
 A.deepEqual([g.locate(first.id).p,g.locate(first.id).z],['p2','trash']);
 A(!g.detachXyzMaterials(host.id,[first.id]).ok);
 A(!g.events.some(e=>e.kind==='unitDestroyed'&&e.cardId===first.id));
 const moves=g.battleLog('p1').filter(e=>e.kind==='move'&&e.card?.instanceId===first.id);
 A.equal(moves.length,1);
 A.equal(moves[0].from.zone,'xyzMaterial');
});

test('an Xyz host releases all remaining materials only when it actually leaves the field',()=>{
 const g=game(),first=g.fromDefinition('kn4','p2'),second=g.fromDefinition('nn3','p1');
 second.onDeath=[{kind:'draw',count:1}];
 const host=unit(g,'p1',6,{xyzMaterials:[first,second]});
 yes(g.manualMove(host.id,'p1','signi-2'));
 A.deepEqual(host.xyzMaterials,[first,second]);
 host.indestructible=true;
 A(!g.destroyUnit(host.id));
 A.deepEqual(host.xyzMaterials,[first,second]);
 delete host.indestructible;
 const hand=g.state.p1.hand.length;
 yes(g.manualMove(host.id,'p1','hand'));
 A.deepEqual(host.xyzMaterials,[]);
 A.deepEqual([g.locate(first.id).p,g.locate(first.id).z],['p2','trash']);
 A.deepEqual([g.locate(second.id).p,g.locate(second.id).z],['p1','trash']);
 A.equal(g.state.p1.hand.length,hand+1);
 A.equal(g.operation.kind,'graveChoice');
 A.equal(g.operation.p,'p2');
 const trigger=g.battleLog('p1').filter(e=>e.kind==='graveInterrupt'&&e.source.instanceId===first.id);
 A.equal(trigger.length,1);
 yes(g.resolveGraveChoice(g.state.p2.hand[0].id));
 A(!g.events.some(e=>e.kind==='unitDestroyed'&&[first.id,second.id].includes(e.cardId)));
});

test('evolution sends a host’s Xyz materials to trash without mixing them into evolution bases',()=>{
 const g=game();
 const material=g.fromDefinition('nn3','p2');
 const base=unit(g,'p1',6,{color:'青',xyzMaterials:[material]});
 const evolution=g.fromDefinition('bs5','p1');
 g.state.p1.hand.push(evolution);
 yes(g.beginPayment(evolution.id));
 yes(g.chooseSlot('signi-1'));
 yes(g.confirmPayment());
 settle(g);
 A.equal(g.locate(evolution.id).z,'signi-1');
 A.deepEqual(evolution.under,[base]);
 A.deepEqual(base.xyzMaterials,[]);
 A.deepEqual([g.locate(material.id).p,g.locate(material.id).z],['p2','trash']);
});
console.log(`${n} sideboard revision groups passed`);
