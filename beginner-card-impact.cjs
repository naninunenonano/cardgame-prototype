'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Decks=require('./decks');
const {cards}=require('./cards');

// These catalog entries are ordinary creatures without card abilities.
// An absent description alone does not imply vanilla (e.g. evolutions).
const vanilla=new Set(['nn2','nn3','nn4','nn5','nn9','sbnn1']);
const unit=zone=>zone?.startsWith('signi-');
const opponent=p=>p==='p1'?'p2':'p1';
const colors={whiteBeginner:'白',blueBeginner:'青',blackBeginner:'黒',redBeginner:'赤'};

function eligible(deck){
 const entries=new Map();
 for(const section of ['main','sideboard','shields']){
  for(const {key,count} of Decks.preset(deck)[section]){
   if(!vanilla.has(key))entries.set(key,(entries.get(key)||0)+count);
  }
 }
 return entries;
}

function assess(journal,players,winner){
 const evidence={p1:new Map(),p2:new Map()};
 const allowed=Object.fromEntries(Object.entries(players).map(([p,deck])=>[p,eligible(deck)]));
 const combat=new Map();
 let previous=0;
 const row=(ref,p=ref?.owner)=>{
  if(!allowed[p]?.has(ref?.cardId))return null;
  const key=ref.cardId;
  if(!evidence[p].has(key))evidence[p].set(key,{key,used:false,body:0,removal:0,draw:0,heal:0,board:0,mana:0,self:0});
  return evidence[p].get(key);
 };
 const add=(ref,metric,value,p)=>{
  if(!ref||!Number.isFinite(value)||value<=0)return;
  const r=row(ref,p);
  if(r){r.used=true;r[metric]+=value;}
 };
 const use=(ref,p)=>{const r=row(ref,p);if(r)r.used=true;};
 const power=ref=>Math.max(0,ref?.attack||0);
 for(let end=0;end<journal.length;end++){
  const command=journal[end];
  if(command.kind!=='dispatch'&&end!==journal.length-1)continue;
  let source=command.source,body=null;
  const combatKills=new Map();
  for(let i=previous;i<=end;i++){
   const e=journal[i],c=e.card;
   if(e.kind==='effect'){
    source=e.source;
    continue;
   }
   if(e.kind==='cardUse'||e.kind==='shieldDecision'&&e.used||e.kind==='growth'){
    use(c,e.actor);
    source=c;
   }
   if(e.kind==='unitEntry'){
    add(c,'board',Math.min(2,(power(c)+(c.maxHealth||0))/6),e.actor);
    // Tokens have no deck entry. Count their deployment for a known creator.
    if(cards[c?.cardId]?.token)add(source,'board',1,e.actor);
   }
   if(e.kind==='move'&&e.to?.zone==='structures')add(c,'board',1,e.to.player);
   if(e.kind==='attackDeclared'){combat.set(e.combatId,e.attacker);use(e.attacker,e.actor);}
   if(e.kind==='bodyStrike')body=e.attacker;
   if(e.kind==='block'&&e.blocked){
    use(e.blocker,e.actor);
    add(e.blocker,'board',Math.min(3,power(e.attacker)*.5),e.actor);
   }
   if(e.kind==='combatDamage'){
    const {attacker,defender}=e.after;
    use(attacker);use(defender);
    if(defender.health<=0&&e.damageToDefender>0)combatKills.set(defender.instanceId,attacker);
    if(attacker.health<=0&&e.damageToAttacker>0)combatKills.set(attacker.instanceId,defender);
   }
   if(e.kind==='unitDestroyed'){
    const ref=combatKills.get(c?.instanceId)||source;
    if(ref?.owner===opponent(e.actor))add(ref,'removal',2+Math.min(4,power(c)*.5));
   }
   // Bounce/deck-top/mana removal, excluding ordinary discard, destruction and overwrite.
   if(e.kind==='move'&&unit(e.from?.zone)&&['hand','main','energy','exile'].includes(e.to?.zone)&&source?.owner===opponent(e.from.player))
    add(source,'removal',1.5+Math.min(3,power(c)*.4));
   if(e.kind==='draw')add(e.source||source,'draw',e.count,e.actor);
   if(e.kind==='manaPlaced'&&e.fromZone!=='hand')add(source,'mana',1,e.actor);
   if(e.kind==='life'&&!e.direct){
    const delta=e.afterLife-e.beforeLife;
    if(delta<0){
     const ref=e.reason==='戦闘ダメージ'?body:source;
     if(ref?.owner===opponent(e.targetPlayer))add(ref,'body',Math.min(-delta,Math.max(0,e.beforeLife)));
     else if(ref?.owner===e.targetPlayer)add(ref,'self',-delta);
    }else if(delta>0){
     const ref=e.reason==='戦闘ダメージ'?body:source;
     add(ref,'heal',delta*(e.beforeLife<=8?1.5:e.beforeLife<=15?.85:.4),e.targetPlayer);
    }
   }
   if(e.kind==='attackEnd'&&e.combatId){use(combat.get(e.combatId));combat.delete(e.combatId);body=null;}
   if(e.kind==='unitDamage'&&c?.owner===opponent(e.sourcePlayer)&&e.afterHealth>0)
    add(source,'board',Math.min(2,Math.max(0,e.beforeHealth-e.afterHealth)*.3),e.sourcePlayer);
  }
  previous=end+1;
 }
 const candidates=[...evidence[winner].values()].map(r=>({...r,
  score:r.body+r.removal+r.draw*1.25+r.heal+r.board*.65+r.mana*1.5-r.self*.45
 })).sort((a,b)=>b.score-a.score||a.key.localeCompare(b.key));
 const [top,second]=candidates;
 const reason=!top||top.score<4?'根拠が閾値未満':second&&top.score-second.score<1?'上位候補の差が1点未満':'';
 return {used:Object.fromEntries(Object.entries(evidence).map(([p,v])=>[p,[...v.values()].filter(r=>r.used).map(r=>r.key)])),
  pick:reason?null:top,reason,candidates:candidates.slice(0,2)};
}

const csvValue=value=>'"'+String(value??'').replaceAll('"','""')+'"';
function csv(file,header,rows){
 fs.writeFileSync(file,'\uFEFF'+[header,...rows].map(row=>row.map(csvValue).join(',')).join('\r\n')+'\r\n');
}

function writeReports(matches,out){
 const stats=new Map(),byMatch=new Map(),seen=new Set();
 for(const deck of Decks.beginnerBotIds)for(const [key,count] of eligible(deck)){
  stats.set(deck+':'+key,{deck,key,count,uses:0,picks:0,first:0,second:0,opponents:{}});
 }
 for(const m of matches){
  const matchId=[m.p1,m.p2,m.seed].join(':');
  assert(!seen.has(matchId),'試合ID重複 '+matchId);
  seen.add(matchId);
  for(const p of ['p1','p2'])for(const key of new Set(m.impact.used[p]))stats.get(m[p]+':'+key).uses++;
  if(!m.impact.pick)continue;
  const p=m.winner,other=m[opponent(p)],key=m.impact.pick.key;
  const r=stats.get(m[p]+':'+key);
  assert(m.impact.used[p].includes(key));
  r.picks++;r[m.first===p?'first':'second']++;
  r.opponents[other]=(r.opponents[other]||0)+1;
  const tuple=[m.p1,m.p2,m[p],key];
  const k=tuple.join(':');
  if(!byMatch.has(k))byMatch.set(k,{tuple,picks:0,first:0,second:0});
  const match=byMatch.get(k);match.picks++;match[m.first===p?'first':'second']++;
 }
 const data=[...stats.values()].sort((a,b)=>a.deck.localeCompare(b.deck)||b.picks-a.picks||a.key.localeCompare(b.key));
 const header=['Bot色','区分','カード名','カードID','文明','採用枚数','使用試合数','決定打回数','選出率%','先攻','後攻',...Object.values(colors).map(c=>'対'+c)];
 const fields=r=>[colors[r.deck],cards[r.key].type==='キャラクター'?'キャラクター':'カード',cards[r.key].name,r.key,cards[r.key].color,r.count,r.uses,r.picks,r.uses?(100*r.picks/r.uses).toFixed(2):'使用なし',r.first,r.second,...Object.keys(colors).map(d=>d===r.deck?'':r.opponents[d]||0)];
 assert.equal(data.reduce((n,r)=>n+r.picks,0),matches.filter(m=>m.impact.pick).length);
 for(const r of data){
  assert(r.picks<=r.uses);
  assert.equal(r.picks,r.first+r.second);
  assert.equal(r.picks,Object.values(r.opponents).reduce((a,b)=>a+b,0));
 }
 fs.mkdirSync(out,{recursive:true});
 csv(path.join(out,'beginner-bot-card-impact.csv'),header,data.map(fields));
 const rankings=[];
 for(const deck of Decks.beginnerBotIds){
  const group=data.filter(r=>r.deck===deck&&cards[r.key].type!=='キャラクター');
  for(const [label,sorter] of [
   ['上位',(a,b)=>b.picks-a.picks],['下位',(a,b)=>a.picks-b.picks||b.uses-a.uses],
   ['先攻',(a,b)=>b.first-a.first],['後攻',(a,b)=>b.second-a.second]
  ])group.slice().sort(sorter).slice(0,5).forEach((r,i)=>rankings.push([label,i+1,...fields(r)]));
 }
 csv(path.join(out,'beginner-bot-card-ranking.csv'),['ランキング','順位',...header],rankings);
 csv(path.join(out,'beginner-bot-card-matchups.csv'),['対面色1','対面色2','勝利Bot色','カードID','カード名','決定打回数','先攻','後攻'],
  [...byMatch.values()].sort((a,b)=>a.tuple[0].localeCompare(b.tuple[0])||a.tuple[1].localeCompare(b.tuple[1])||b.picks-a.picks||a.tuple[3].localeCompare(b.tuple[3]))
   .map(({tuple:[a,b,d,k],picks,first,second})=>[colors[a],colors[b],colors[d],k,cards[k].name,picks,first,second]));
 csv(path.join(out,'beginner-bot-card-matches.csv'),['P1','P2','seed','先攻','勝利','ターン','P1ライフ','P2ライフ','決定打ID','判定不能理由','候補の得点内訳JSON','P1使用ID','P2使用ID'],
  matches.map(m=>[colors[m.p1],colors[m.p2],m.seed,colors[m[m.first]],colors[m[m.winner]],m.turn,m.life.p1,m.life.p2,m.impact.pick?.key,m.impact.reason,JSON.stringify(m.impact.candidates),m.impact.used.p1.join(' '),m.impact.used.p2.join(' ')]));
}

module.exports={assess,eligible,writeReports};
if(require.main===module){
 const [out,...files]=process.argv.slice(2);
 assert(out&&files.length,'Usage: node beginner-card-impact.cjs OUT_DIR MATCH_JSON ...');
 writeReports(files.flatMap(f=>JSON.parse(fs.readFileSync(f,'utf8'))),out);
}
