(function(root,factory){const a=factory(typeof module==='object'&&module.exports?require('./id-registry'):root.CardIdRegistry);if(typeof module==='object'&&module.exports)module.exports=a;else root.CardIdentity=a;})(globalThis,function(R){
'use strict';
const rarity=r=>({SSR:'UR',UR:'LEGEND'}[r]||r);
const canonicalKey=k=>R.aliases[k]||R.entries.find(e=>e.faces.includes(k))?.baseId||k;
const formKey=k=>R.forms[k]||k;
const fields=new Set(['key','tokenKey','chargerKey','requiredCharacter','ownerCharacterId']);
function refs(x){if(Array.isArray(x))return x.map(refs);if(!x||typeof x!=='object')return x;return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,typeof v==='string'&&fields.has(k)?canonicalKey(v):typeof v==='string'&&['awaken','awakenOnKill','awakenOnUntap','teamWinsAwaken'].includes(k)?formKey(v):refs(v)]));}
function install(catalog){const next={};for(const e of R.entries){if(e.retired)continue;const original=catalog.cards[e.oldId];if(!original)throw Error('Missing pre-migration definition: '+e.oldId);const c=refs(original);Object.assign(c,{key:e.baseId,baseId:e.baseId,faceId:e.id,cardSection:e.section,ownerCharacterId:e.ownerCharacterId,rarity:e.rarity});if(e.faces.length)c.faceIds=e.faces;next[e.baseId]=c;}
catalog.cards=next;catalog.awakened=Object.fromEntries(Object.entries(catalog.awakened).map(([k,c])=>[formKey(k),{...refs(c),rarity:rarity(c.rarity),faceId:formKey(k)}]));
for(const field of ['sideboardPreset','decks','starter'])catalog[field]=refs(catalog[field]);for(const field of ['shieldKeys','neutralKeys','fateKeys'])catalog[field]=catalog[field].map(canonicalKey);catalog.starter.rarities=catalog.starter.rarities.map(rarity);for(const k of ['sideKeys','neutral','characters'])catalog.starter[k]=catalog.starter[k].map(canonicalKey);return catalog;}
function migrateOwned(old){if(!old||typeof old!=='object')return old;const next={};for(const [k,n]of Object.entries(old)){const key=canonicalKey(k);next[key]=Math.max(next[key]||0,n);}return next;}
function sort(a,b){return a.key.localeCompare(b.key,'en',{numeric:true});}
return {registry:R,rarity,canonicalKey,formKey,refs,install,migrateOwned,sort};});
