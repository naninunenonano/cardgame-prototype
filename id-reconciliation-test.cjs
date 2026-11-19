'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Catalog = require('./cards');
const Identity = require('./identity');
const Decks = require('./decks');
const Mana = require('./mana');
const {changes, highWaterMarks,cardFingerprints} = require('./docs/id-reconciliation.json');
const {allocate} = require('./id-allocation.cjs');
const active = new Set(Object.keys(Catalog.cards));
assert.equal(active.size, Object.keys(Catalog.cards).length);
for (const change of changes) {
 assert(!active.has(change.old));
 assert(active.has(change.new));
 assert(Identity.registry.retiredIds.includes(change.old));
 assert.equal(Identity.canonicalKey(change.old), change.new);
 assert.deepEqual(Decks.migrateOwned({[change.old]:3}), {[change.new]:3});
 const old = {...Decks.preset('redStarter'), main:[{key:change.old,count:3}]};
 assert.equal(Decks.migrateDeck(old).main[0].key, change.new);
}
for (const [prefix,maximum] of Object.entries(highWaterMarks)) {
 assert.equal(Identity.registry.highWaterMarks[prefix], maximum);
}
for (const rarity of ['N','R','SR','UR','OR']) for (const color of Mana.colors) {
 const next = allocate(Identity.registry,{name:'allocation regression',rarity,color});
 assert(!active.has(next.id));
 assert(!Identity.registry.retiredIds.includes(next.id));
}
for (const form of Object.keys(Catalog.awakened)) assert(!Identity.registry.retiredIds.includes(form));
for (const file of ['images/cards/ru2.png','images/cards/ru6.png','images/cards/bu2.png']) assert(fs.existsSync(file));
console.log('PASS 43 ID migrations, old saves, reserved IDs, next allocation and related faces');

const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
 ? Object.fromEntries(Object.keys(value).sort().map(key => [key,stable(value[key])])) : value;
for (const [key,fingerprint] of Object.entries(cardFingerprints)) {
 let definition=Catalog.cards[Identity.canonicalKey(key)];
 // Approved neutral-color correction after PR #89; compare all remaining fields to its baseline.
 if(['sbws2','sbwo1'].includes(key)){definition={...definition,key,baseId:key,faceId:key,color:'白',civilizations:['白'],cost:Mana.cost(key==='sbws2'?1:9,{白:1})};}
 const actual = require('node:crypto').createHash('sha256').update(JSON.stringify(stable(definition))).digest('hex');
 assert.equal(actual,fingerprint,key+' has changed beyond its ID');
}
console.log('PASS 235 baseline definitions, allowing only the two approved neutral-color corrections');

assert.equal(allocate(Identity.registry,{name:'legacy rarity input',rarity:'LEGEND',color:'青'}).id,allocate(Identity.registry,{name:'current rarity input',rarity:'UR',color:'青'}).id);
