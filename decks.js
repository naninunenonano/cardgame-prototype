// Shared catalog-based construction validation and local persistence.
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./cards.js'):root.CardCatalog);if(typeof module==='object'&&module.exports)module.exports=api;else root.DeckLibrary=api;})(globalThis,function(C){
'use strict';
const Identity=typeof module==='object'&&module.exports?require('./identity.js'):globalThis.CardIdentity;
const canonicalKey=Identity.canonicalKey;
function migrateDeck(d){if(!d||typeof d!=='object'||Array.isArray(d))return d;const next={...d};for(const section of ['main','sideboard','shields','lands'])if(Array.isArray(d[section]))next[section]=d[section].filter(e=>!e||!Identity.removedLegacyKey(e.key)).map(e=>e&&typeof e==='object'?{...e,key:canonicalKey(e.key)}:e);const moved=(next.sideboard||[]).filter(e=>['bo1','sbru1'].includes(e?.key));if(moved.length){next.sideboard=next.sideboard.filter(e=>!['bo1','sbru1'].includes(e?.key));next.main=[...(next.main||[]),...moved];}return next;}
function evolutionErrors(deck,owned=null){
 const id=deck.sideboard?.find(e=>e.count>0&&C.cards[e.key]?.type==='キャラクター')?.key;
 if(!id)return [];
 if(deck.evolution!=null&&(typeof deck.evolution!=='object'||Array.isArray(deck.evolution)))return ['進化先の保存形式が不正です。'];
 const route=deck.evolution?.[id];
 if(route!==undefined&&(!Array.isArray(route)||route.length!==4))return ['進化先をLv1〜Lv4に設定してください。'];
 const keys=route??Array(4).fill(id);
 return keys.flatMap((key,i)=>{
  const series=Object.hasOwn(C.evolutionSeries,key)?C.evolutionSeries[key]:null;
  return !series||series.characterId!==id||owned&&!(owned[key]>0)?['Lv'+(i+1)+'の進化系列が未所持または不正です。']:[];
 });
}
const migrateOwned=Identity.migrateOwned;
function migrateProfile(p){if(!p||typeof p!=='object')return p;const owned=migrateOwned(p.owned),characters=Array.isArray(p.characters)&&p.characters.some(k=>canonicalKey(k)!==k)?p.characters.map(canonicalKey).filter((key,i,a)=>key!=='almar'||a.indexOf(key)===i):p.characters,decks=Array.isArray(p.decks)?p.decks.map(migrateDeck):p.decks;const unknownIds=[...new Set([...Object.keys(owned||{}),...(decks||[]).flatMap(d=>['main','sideboard','shields'].flatMap(s=>(d[s]||[]).map(e=>e.key)))].filter(k=>!C.collectibleCard(k)))];return {...p,owned,characters,decks,identityVersion:1,...(unknownIds.length?{migrationUnknownIds:unknownIds}:{})};}
const VERSION=1,STORAGE_KEY='cardgame-prototype.decks.v1',MAIN_SIZE=40,SIDE_SIZE=10,SHIELD_SIZE=4,defaultShields=()=>[{key:'shnr1',count:2},{key:'shnr2',count:2}],copy=x=>JSON.parse(JSON.stringify(x)),trusted=new WeakSet();
// Only the existing official definitions are grandfathered. Returned objects are
// recognized by identity AND their exact composition, never a user-controlled flag/name.
const official=Object.fromEntries(['green','blue','redStarter','blueStarter'].map(id=>[id,{id,name:id==='redStarter'?'赤・初期デッキ':id==='blueStarter'?'青・初期デッキ':id==='green'?'緑プリセット':'青プリセット',preset:true,main:copy(C.decks[id]),sideboard:id.endsWith('Starter')?[{key:id==='redStarter'?'redcaptain':'bluesage',count:1},...C.starter.sideKeys.map(key=>({key,count:1}))]:[],shields:defaultShields()}]));
const advancedBotIds=['blueAdvanced'];
const beginnerBotIds=['blueBeginner','redBeginner','blackBeginner','whiteBeginner'];
const selectableBeginnerBotIds=[...beginnerBotIds,'greenBeginner'];
const stackPalette=['白','青','黒','赤','緑'],STACK_SIZE=15;
function stackColors(d){
 if(d.stacks!==undefined)return d.stacks;
 const color=C.cards[d.sideboard?.find(e=>e.count>0&&C.cards[e.key]?.type==='キャラクター')?.key]?.color;
 if(stackPalette.includes(color))return Array(STACK_SIZE).fill(color);
 if(d.id==='green'||d.id==='blue')return Array(STACK_SIZE).fill(d.id==='green'?'緑':'青');
 return stackPalette.flatMap(color=>Array(3).fill(color));
}
const counts=(entries)=>entries.map(([key,count=3])=>({key,count}));
const beginnerSide=key=>counts([[key,1],['sbnn1'],['sbnr2',2],['sbnr3',2],['sbnr1',1],['sbns1',1]]);
Object.assign(official,{
 blueBeginner:{id:'blueBeginner',name:'青・初級Bot',preset:true,
  main:counts([['nn2'],['nn3'],['nn4'],['nn5'],['nn9',2],['nn1'],['nn6',2],['bn1'],['bn5'],['bn7'],['br3'],['bs2'],['bs5'],['bs1']]),
  sideboard:beginnerSide('bluesage'),shields:counts([['shnr4',1],['shnr5',1],['shns1',1],['shnr6',1]])},
 redBeginner:{id:'redBeginner',name:'赤・初級Bot',preset:true,
  main:counts([['nn3',4],['nn5',4],['nn9',2],['rs4',3],['rs5',2],['rs2',4],['rs1',3],['rn15',4],['rn16',4],['rn20',4],['rn14',4],['rr1',2]]),
  stacks:Array(STACK_SIZE).fill('赤'),
  sideboard:counts([['redcaptain',1],['sbru2',1],['sbrn1',4],['sbrs2',1],['sbru3',1],['sbrr1',1],['sbrr2',1]]),
  shields:counts(['shnr6','shnr2','shnr7','shnr8','shnr9'].map(key=>[key,1]))},
 blackBeginner:{id:'blackBeginner',name:'黒・初級Bot',preset:true,
  main:counts([['nn2'],['nn3'],['nn4'],['nn5'],['nn9'],['nn1'],['nn7',1],['kn9'],['kn10'],['kn2'],['ks13'],['ks14'],['ks15'],['kn11']]),
  sideboard:beginnerSide('redmoonavenger'),shields:counts([['redmoonavenger_shkl1',1],['shnr6',2],['shnr5',1]])},
 whiteBeginner:{id:'whiteBeginner',name:'白・初級Bot',preset:true,
  main:counts([['nn2'],['nn3'],['nn4'],['nn5'],['nn9'],['ws7'],['ws8'],['ws9'],['wr7'],['wr6'],['wn1'],['wn2'],['wr1'],['wr4',1]]),
  sideboard:beginnerSide('eira'),shields:counts([['shnr3',2],['shnr2',1],['shnr5',1]])},
 greenBeginner:{id:'greenBeginner',name:'緑・初級Bot',difficulty:'beginner',preset:true,
  main:counts([['nn9'],['nn2'],['nn3'],['nn4'],['nn5'],['gs6'],['gn2'],['gn4'],['gs5'],['gs1'],['gn1'],['gr1'],['gr2',1],['gr5']]),
  sideboard:beginnerSide('verdantguardian'),shields:counts(['shnr1','shnr5','shnr3','shnr2'].map(key=>[key,1]))},
 blueAdvanced:{id:'blueAdvanced',name:'青上級Bot／アルマー',difficulty:'advanced',preset:true,
  main:counts([['bo1'],['bs1'],['bl2',1],['bl3',1],['nl2',1],['br1'],['bn1'],['br3'],['br5'],['ns1'],['br4'],['nn1'],['bs5'],['bs3'],['nn7',4]]),
  sideboard:counts(['almar','almar_sbbu1','sbbu1','almar_sbbu2','almar_sbbs1','almar_sbnr1','sbbr1','sbbu2','sbnl4','sbnl1'].map(key=>[key,1])),
  shields:counts(['shnl1','shnl2','shnr2','shnr5'].map(key=>[key,1]))}

});
for(const d of Object.values(official)){
 d.sideboard=d.sideboard.filter(e=>C.cards[e.key]&&!C.cards[e.key].unavailable);
 d.stacks=stackColors(d);
}
const hasPreset=id=>Object.hasOwn(official,id);
const composition=d=>JSON.stringify([d.main,d.sideboard||[],d.shields||defaultShields(),stackColors(d)]);
function preset(id){if(!hasPreset(id))return null;const d=copy(official[id]);trusted.add(d);return d;}
function isOfficialPreset(d){return !!d&&trusted.has(d)&&hasPreset(d.id)&&composition(d)===composition(official[d.id]);}
function sectionOf(c){return c.type==='土地'?'legacy':c.sideboardOnly?'sideboard':c.deckSection||'main';}
function limit(c){return c.type==='キャラクター'?1:c.individualDeckLimit??4;}
function available(section=null){return Object.values(C.cards).filter(c=>c&&c.deckEligible!==false&&!c.unavailable&&!c.generated&&!c.token&&sectionOf(c)!=='legacy'&&(!section||sectionOf(c)===section));}
function adoptionError(c,d){if(!c?.requiredCharacter)return '';const chars=(d.sideboard||[]).filter(e=>e.count>0&&C.cards[e.key]?.type==='キャラクター');return chars.length===1&&chars[0].count===1&&chars[0].key===c.requiredCharacter?'':(C.cards[c.requiredCharacter]?.name||c.requiredCharacter)+'専用：対応キャラクターをサイドボードに1枚採用してください。';}
function validate(d){d=migrateDeck(d);const errors=[],allow=new Map(available().map(c=>[c.key,c]));if(!d||typeof d!=='object')return ['デッキデータが不正です。'];const stacks=stackColors(d);if(!Array.isArray(stacks)||stacks.length!==STACK_SIZE||stacks.some(c=>!stackPalette.includes(c)))errors.push('スタック山は5色のスタック15枚です。');
 const check=(a,section,title,expected)=>{if(!Array.isArray(a)){errors.push(title+'の構成が不正です。');return;}let n=0;const counts=new Map();for(const e of a){const c=allow.get(e?.key);if(C.cards[e?.key]?.unavailable&&e.count>0){errors.push(C.cards[e.key].name+'は使用不可：'+C.cards[e.key].unavailable);continue;}if(!c||!Number.isInteger(e.count)||e.count<0||e.count>10000){errors.push(title+'に使用できないカード・枚数があります。');continue;}if(sectionOf(c)!==section){errors.push(title+'に種類の異なるカードがあります。');continue;}n+=e.count;const item=counts.get(c.name)||{count:0,cap:Infinity};item.count+=e.count;item.cap=Math.min(item.cap,limit(c));counts.set(c.name,item);}if(expected!==null&&n!==expected)errors.push(`${title}は${expected}枚です（現在${n}枚）。`);if(section==='sideboard'&&n>SIDE_SIZE)errors.push(`サイドボードは最大${SIDE_SIZE}枚です。`);if(section==='shields'&&![SHIELD_SIZE,5].includes(n))errors.push('シールドデッキは4枚または5枚です。');for(const [name,{count,cap}]of counts)if(count>cap)errors.push(`${name}は同名${cap}枚までです（現在${count}枚）。`);};
 const char=(d.sideboard||[]).find(e=>C.cards[e.key]?.type==='キャラクター'&&e.count>0)?.key;if((d.sideboard||[]).some(e=>e.count>0&&C.cards[e.key]?.requiredCharacterColor&&!(C.cards[char]?.civilizations||[C.cards[char]?.color]).includes(C.cards[e.key].requiredCharacterColor)))errors.push('専用カードのキャラクター色が一致しません。');if((d.sideboard||[]).some(e=>e.count>0&&C.cards[e.key]?.requiredCharacter&&C.cards[e.key].requiredCharacter!==char))errors.push('専用カードの使用キャラクターが一致しません。');
 if((d.sideboard||[]).reduce((n,e)=>n+(C.cards[e.key]?.type==='キャラクター'?e.count:0),0)>1)errors.push('成長型キャラクターはサイドに1枚までです。');
 for(const e of d.shields||[]){if(e.count>0){const why=adoptionError(C.cards[e.key],d);if(why)errors.push(why);}}
 check(d.main,'main','通常デッキ',MAIN_SIZE);check(d.sideboard||[],'sideboard','サイドボード',null);check(d.shields??defaultShields(),'shields','シールドデッキ',null);return [...new Set([...errors,...evolutionErrors(d)])];}
function resolve(id,records=[]){const p=preset(id);if(p)return p;const d=migrateDeck(records.find(d=>d.id===id));if(!d)throw Error('デッキが見つかりません。');const e=validate(d);if(e.length)throw Error(e.join('／'));return {...copy(d),shields:copy(d.shields??defaultShields()),preset:false};}
function create({storage=null}={}){let records=[],warning='',migrationRaw=null,loadedRaw=null;try{const raw=storage?.getItem(STORAGE_KEY);if(raw){loadedRaw=raw;const original=JSON.parse(raw),migrated=Array.isArray(original)?original.map(migrateDeck):{...original,...(Array.isArray(original.decks)?{decks:original.decks.map(migrateDeck)}:{})};if(JSON.stringify(original)!==JSON.stringify(migrated))migrationRaw=JSON.stringify(migrated);const data=migrated,a=Array.isArray(data)?data:data.decks;if(Array.isArray(a)){const seen=new Set(Object.keys(official));records=a.filter(d=>d&&typeof d.id==='string'&&Array.isArray(d.main)).map((d,i)=>{let restored=d.id;if(seen.has(restored)){restored=`recovered-${i}-${d.id}`;while(seen.has(restored))restored+='-copy';warning='重複・公式プリセットと衝突する保存IDを、カードを削除せず自作IDで復旧しました。';}seen.add(restored);return {...copy(d),id:restored,preset:false,name:String(d.name||'名称未設定').slice(0,80),sideboard:d.sideboard||[],shields:d.shields??defaultShields()};});}else warning='保存データの形式が不明です。元データは上書きしていません。';}}catch{warning='保存データを読み込めませんでした。元データは上書きしていません。';}
 // Identity migration preserves the original save envelope and checks concurrent writes.
 if(migrationRaw&&storage&&!warning)try{if(storage.getItem(STORAGE_KEY)!==loadedRaw)warning='別の画面でデッキが更新されたためID移行は保存していません。再読み込みしてください。';else storage.setItem(STORAGE_KEY,migrationRaw);}catch{warning='ID移行を保存できません。元のデッキデータは変更していません。';}
 const persist=next=>{if(!storage)return {ok:false,message:'この環境ではブラウザ保存を利用できません。保存を許可して再試行してください。'};try{storage.setItem(STORAGE_KEY,JSON.stringify({version:VERSION,decks:next}));records=copy(next);warning='';return {ok:true};}catch{return {ok:false,message:'保存できません。ブラウザの保存容量・設定を確認してください。'};}};
 const id=()=>`custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
 return {list:()=>copy(records),get:id=>hasPreset(id)?preset(id):copy(records.find(d=>d.id===id)||null),save(d){d=migrateDeck(d);if(!d||hasPreset(d.id))return {ok:false,message:'プリセットは複製して編集してください。'};const item={id:d.id||id(),name:String(d.name||'自作デッキ').trim().slice(0,80)||'自作デッキ',main:copy(d.main||[]),sideboard:copy(d.sideboard||[]),shields:copy(d.shields??defaultShields()),stacks:copy(stackColors(d)),...(d.evolution?{evolution:copy(d.evolution)}:{})};const errors=validate(item),next=records.filter(x=>x.id!==item.id).concat(item),r=persist(next);return {...r,id:item.id,errors};},duplicate(source){const d=preset(source)||records.find(d=>d.id===source);return d?this.save({...copy(d),id:id(),name:d.name+' コピー'}):{ok:false,message:'複製元がありません。'};},remove(source){return hasPreset(source)?{ok:false,message:'プリセットは削除できません。'}:persist(records.filter(d=>d.id!==source));},get warning(){return warning;}};
}
return {beginnerBotIds,selectableBeginnerBotIds,advancedBotIds,evolutionErrors,canonicalKey,migrateDeck,migrateOwned,migrateProfile,adoptionError,VERSION,STORAGE_KEY,MAIN_SIZE,SIDE_SIZE,SHIELD_SIZE,STACK_SIZE,stackPalette,stackColors,defaultShields,available,sectionOf,limit,preset,isOfficialPreset,validate,resolve,create};
});
