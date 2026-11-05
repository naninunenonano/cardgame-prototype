(function(root){
'use strict';
const storageKey='cardgame.battle-motion';
const colors={白:'#ffe1a1',青:'#71d9ff',黒:'#bc8aff',赤:'#ff7957',緑:'#91e961',無色:'#bac8dc'};
const durations={draw:300,mana:300,move:260,summon:500,attack:400,damage:400,destroy:400,spell:430,ability:220,growth:800,shield:700};
const unit=z=>z?.startsWith('signi-');
function create(layer){
 let speed='normal',session=null,cursor=0,token=0,busy=false,pending=[],completion=null;
 try{speed=localStorage.getItem(storageKey)||'normal';}catch{}
 if(!['normal','fast','off'].includes(speed))speed='normal';
 const point=el=>{const r=el?.getBoundingClientRect();return r&&r.width&&r.height?{x:r.left+r.width/2,y:r.top+r.height/2,el}:null;};
 const center=()=>({x:innerWidth/2,y:innerHeight*.45});
 const find=(key,value)=>point(document.querySelector(`[data-${key}="${CSS.escape(String(value))}"]`));
 const zone=(p,z)=>find('list',p+'/'+z)|| (z==='hand'?find('player',p):null) ||
  (unit(z)?point(document.querySelector(`[data-player="${p}"][data-zone="${z}"]`)):null)||
  (z==='lrig'?find('character',p):null)||center();
 const at=(ref,fallback)=>ref?.instanceId&&find('card',ref.instanceId)||fallback||center();
 function cancel(){completion=null;token++;busy=false;pending=[];layer.replaceChildren();layer.hidden=true;}
 function skip(){const done=completion;cancel();done?.();}
 function setSpeed(value){if(!['normal','fast','off'].includes(value))return;speed=value;try{localStorage.setItem(storageKey,value);}catch{}}
 function collect(game,viewer,active){
  if(session!==game.gameId){cancel();session=game.gameId;cursor=0;}
  const last=game.journalCount;
  const events=active&&speed!=='off'&&last>cursor?game.battleLog(viewer,{tail:Math.min(last-cursor,100),detailed:true}).filter(e=>e.number>cursor):[];
  cursor=last;
  const out=[],destroyed=new Set(events.filter(e=>e.kind==='unitDestroyed').map(e=>e.card?.instanceId));
  const add=(kind,data)=>out.push({kind,...data});
  for(const e of events){
   const {kind,card,actor,from,to}=e;
   if(kind==='draw')for(let i=0;i<Math.min(e.count,6);i++)add('draw',{a:zone(actor,'main'),b:zone(actor,'hand'),label:i===5&&e.count>6?'+'+(e.count-5):''});
   if(kind==='manaPlaced')add('mana',{card,a:at(card,zone(actor,e.fromZone||'main')),b:zone(actor,'energy')});
   if(kind==='move'&&to?.player&&from?.zone!==to.zone&&!destroyed.has(card?.instanceId)){
    if(to.zone==='energy')add('mana',{card,a:at(card,zone(from.player,from.zone)),b:zone(to.player,to.zone)});
    else if((['hand','trash','exile','main','extra'].includes(to.zone)&&['structures','energy','trash','check','hand','extra'].includes(from.zone))||(unit(from.zone)&&!unit(to.zone)))
     add('move',{card:to.zone==='hand'?null:card,a:at(card,zone(from.player,from.zone)),b:zone(to.player,to.zone)});
   }
   if(kind==='unitEntry')add('summon',{card,a:center(),b:zone(actor,e.zone)});
   if(kind==='move'&&to?.zone==='structures'&&from?.zone!=='structures')add('summon',{card,a:center(),b:zone(to.player,'structures')});
   if(kind==='combatDamage'){
    const a=e.after.attacker,b=e.after.defender;
    add('attack',{card:a,other:b,a:at(a),b:at(b),label:e.blocked?'ブロック！':''});
    for(const [ref,n] of [[a,e.damageToAttacker],[b,e.damageToDefender]])if(n)add('damage',{a:at(ref),label:'−'+n,stat:ref.health});
   }
   if(kind==='bodyStrike')add('attack',{card:e.attacker,a:at(e.attacker),b:find('life',e.targetPlayer)||center()});
   if(kind==='life'||kind==='unitDamage'||kind==='unitHeal'){
    const life=kind==='life',after=life?e.afterLife:e.afterHealth;
    const delta=after-(life?e.beforeLife:e.beforeHealth);
    if(delta)add('damage',{a:life?find('life',e.targetPlayer)||center():at(card),label:(delta>0?'+':'−')+Math.abs(delta),heal:delta>0,stat:after});
   }
   if(kind==='unitDestroyed')add('destroy',{card,a:at(card)});
   if(kind==='cardUse'&&card?.type==='呪文')add('spell',{card,a:center(),b:e.target?.instanceId?at(e.target):null,label:'呪文'});
   if(kind==='effect'&&e.source?.name&&['damagePlayer','draw','enemyUnitSweep','tokens','destroyUnitTarget','manaAdd','healLife'].includes(e.effectKind)&&out.at(-1)?.kind!=='ability')
    add('ability',{card:e.source,a:at(e.source),label:'能力発動'});
   if(kind==='growth')add('growth',{card,a:center(),label:`Lv${e.level-1} → Lv${e.level}`,detail:e.ability});
   if(kind==='shieldDecision'&&e.used)add('shield',{card,a:center(),label:'シールド発動',detail:root.CardCatalog.cards[card?.cardId]?.text});
  }
  return out;
 }
 function nodeFor(event,card=event.card){
  const node=document.createElement('div');
  node.className='motion-piece';
  const c=card&&!card.hidden&&card.name?card:null;
  const definition=c&&root.CardCatalog.cards[c.cardId];
  const palette=(definition?.civilizations||[c?.color]).map(color=>colors[color]||colors.無色);
  node.style.setProperty('--motion-color',event.heal?'#76f5ac':palette[0]||colors.無色);
  if(palette.length>1)node.style.backgroundImage=`linear-gradient(140deg,${palette.map(color=>color+'44').join(',')})`;
  const line=(tag,value)=>{if(value){const el=document.createElement(tag);el.textContent=value;node.append(el);}};
  if(c){
   node.classList.add('motion-card');
   line('strong',c.name);
   const url=root.CardImages.path(c.awakened||definition?.faceId||c.cardId,c.type==='キャラクター'?(c.level??0):undefined,definition?.ownerCharacterId);
   if(url){const img=document.createElement('img');img.alt='';img.onerror=()=>img.remove();img.src=url;node.append(img);}
   if(c.type==='通常')line('small',`攻撃 ${c.attack??'–'} ／ 体力 ${c.health??'–'}`);
  }else if(event.kind==='draw')node.classList.add('motion-card','motion-back');
  line('b',event.label);line('small',event.detail);if(event.stat!==undefined)line('small',String(event.stat));
  return node;
 }
 function animate(event,ms){
  const {a=center(),b=a,kind}=event;
  const node=nodeFor(event);
  node.dataset.motion=kind;
  layer.append(node);
  const frames=(p,s=1,opacity=1,angle=0)=>({transform:`translate(${p.x}px,${p.y}px) translate(-50%,-50%) scale(${s}) rotate(${angle}deg)`,opacity});
  let keyframes;
  if(kind==='attack')keyframes=[frames(a,.62),frames({x:a.x,y:a.y-12},.77),{...frames(b,.85),offset:.56},frames(a,.62)];
  else if(kind==='damage')keyframes=[frames(a,.85),frames(a,1.15),frames({x:a.x,y:a.y-25},1,0)];
  else if(kind==='destroy')keyframes=[frames(a,.68),frames(a,.75,1,-8),frames(a,.72,1,7),{...frames(a,.3,0,25),filter:'brightness(4) blur(8px)'}];
  else if(['spell','shield','growth','ability'].includes(kind))keyframes=[frames(a,.72,0),frames(a,1),{...frames(a,1),offset:.78},frames(a,.94,0)];
  else keyframes=[frames(a,.46,0),{...frames(a,kind==='summon'?1:.66),offset:.36},frames(b,.46),frames(b,.38,0)];
  const flashAt=kind==='attack'||kind==='summon'||kind==='mana'||kind==='spell'?b:kind==='damage'||kind==='destroy'?a:null;
  if(flashAt){
   const flash=document.createElement('i');flash.className='motion-impact';flash.style.left=flashAt.x+'px';flash.style.top=flashAt.y+'px';
   flash.style.setProperty('--motion-color',node.style.getPropertyValue('--motion-color'));
   layer.append(flash);flash.animate([{opacity:0,scale:'.4'},{opacity:.95,scale:'1'},{opacity:0,scale:'1.65'}],{duration:ms*.55,delay:ms*.42,fill:'both'});setTimeout(()=>flash.remove(),ms+30);
  }
  if(kind==='damage'&&a.el)a.el.animate([{translate:'0'},{translate:event.heal?'0 -3px':'4px 0'},{translate:event.heal?'0 -1px':'-4px 0'},{translate:'0'}],ms*.7);
  if(kind==='attack'&&event.other){const defender=nodeFor({...event,label:''},event.other);layer.append(defender);defender.animate([frames(b,.52),frames(b,.62),frames(b,.52,0)],{duration:ms,fill:'both'});setTimeout(()=>defender.remove(),ms+30);}
  const anim=node.animate(keyframes,{duration:ms,easing:'ease-in-out',fill:'both'});
  const remove=()=>node.remove();anim.finished.then(remove,remove);setTimeout(remove,ms+60);
 }
 function play(events,done){
  pending.push(...events);
  if(busy)return true;
  if(!pending.length)return false;
  busy=true;completion=done;layer.hidden=false;const id=++token;
  (async()=>{
   try{
    while(id===token&&pending.length&&speed!=='off'){
     const first=pending.shift(),group=[first];
     if(['draw','damage','destroy','summon'].includes(first.kind))while(pending[0]?.kind===first.kind)group.push(pending.shift());
     const factor=(speed==='fast'?.48:1)*(group.length>3?.75:1);
     const ms=durations[first.kind]*factor;
     group.slice(0,14).forEach((event,i)=>{const delay=first.kind==='draw'?Math.min(i,5)*42*factor:0;if(delay)setTimeout(()=>{if(id===token)try{animate(event,ms);}catch{}},delay);else animate(event,ms);});
     await new Promise(resolve=>setTimeout(resolve,ms+(first.kind==='draw'?Math.min(group.length-1,5)*42*factor:0)));
    }
   }catch{/* Rendering failures must never hold up the match. */}
   finally{if(id===token){cancel();done();}}
  })();
  return true;
 }
 return {collect,play,cancel,skip,setSpeed,get busy(){return busy;},get speed(){return speed;}};
}
root.BattleMotion={create,storageKey};
})(globalThis);
