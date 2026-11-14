'use strict';
const assert = require('node:assert/strict');
const Game = require('./game');
const Bot = require('./bot');
const Mana = require('./mana');
const { skipCharge } = require('./test-fixtures.cjs');

function ok(result) {
 assert(result.ok, result.message);
}
function ready(mode = 'solo', deck = 'redBeginner') {
 const g = Game.create({ mode, decks: { p1: deck, p2: 'redBeginner' }, random: () => .25 });
 for (const p of g.PLAYERS) ok(g.completeMulligan(p, [], true));
 skipCharge(g);
 g.character('p1').level = 2;
 return g;
}
function dispatch(g, action) {
 ok(g.dispatch(action, g.decisionPlayer()));
}
function use(g, card, slot) {
 dispatch(g, { type: 'play', id: card.id });
 if (slot) dispatch(g, { type: 'slot', slot });
 dispatch(g, { type: 'pay' });
 while (g.operation?.kind === 'response') dispatch(g, { type: 'pass' });
}
function nextMain(g) {
 do {
  assert(!g.operation, g.operation?.kind);
  g.turn.notBefore = 0;
  g.turn.step === 'charge' ? ok(g.skipCharge()) : ok(g.advance());
 } while (g.turn.player !== 'p1' || g.turn.step !== 'main1');
}
function put(g, key, zone) {
 const c = g.fromDefinition(key, 'p1');
 g.state.p1[zone].push(c);
 return c;
}
function stocks(g, color, count) {
 for (let i = 0; i < count; i++) g.state.p1.stacks.push(g.card(color, 'ストック', color, null, false, 'p1'));
}
function checkZone(g, card, zone) {
 assert.equal(g.locate(card.id)?.z, zone);
 assert.equal(Object.values(g.state.p1).flat().filter(c => c.id === card.id).length, 1);
}
function uses(g, key) {
 return g.battleLog().filter(e => e.kind === 'cardUse' && e.card.cardId === key);
}

for (const mode of ['solo', 'bot']) {
 const g = ready(mode);
 const copies = g.state.p1.extra.filter(c => c.key === 'sbrn1');
 const host = put(g, 'nn5', 'signi-1');
 const gear = g.state.p1.extra.find(c => c.key === 'sbrr2');
 stocks(g, '赤', 5);
 for (const [i, charger] of copies.entries()) {
  const stockCount = g.state.p1.stacks.length;
  if (mode === 'bot') {
   const view = g.observe('p1');
   assert(view.players.p1.sideboard.find(c => c.id === charger.id).canPlay);
   if (i === 0) {
    const action = Bot.decide(view);
    assert.deepEqual(action, { type: 'play', id: charger.id });
    dispatch(g, action);
    dispatch(g, { type: 'pay' });
   } else use(g, charger);
  } else use(g, charger);
  checkZone(g, charger, 'check');
  dispatch(g, { type: 'expansion', id: 'done' });
  checkZone(g, charger, 'trash');
  assert.equal(g.state.p1.stacks.length, stockCount + 1);
  assert(!g.playStatus(gear, 'p1').ok);
  assert(!g.dispatch({ type: 'play', id: gear.id }, 'p1').ok);
  nextMain(g);
  assert(g.playStatus(gear, 'p1').ok);
 }
 assert.equal(uses(g, 'sbrn1').length, 4);
 assert.equal(new Set(uses(g, 'sbrn1').map(e => e.card.instanceId)).size, 4);
 for (const c of copies) assert(!g.dispatch({ type: 'play', id: c.id }, 'p1').ok);
 use(g, gear, 'signi-2');
 dispatch(g, { type: 'expansion', id: host.id });
 checkZone(g, gear, 'signi-2');
 assert(!g.beginPayment(gear.id).ok);
 assert(g.destroyUnit(host.id));
 checkZone(g, gear, 'trash');
 assert(!gear.hostId);
}
console.log('PASS A/B/C/F/G/H: four spell instances, shared turn limit, and equipment lifecycle');

{
 const g = ready('solo', 'whiteAdvanced');
 g.state.p1.hand.length = 0;
 const charger = g.state.p1.extra.find(c => c.key === 'sbws1');
 const formula = g.state.p1.extra.find(c => c.key === 'sbws2');
 const dragon = g.state.p1.extra.find(c => c.key === 'sbws3');
 const crest = g.state.p1.extra.find(c => c.key === 'sbwl1');
 const target = put(g, 'ws5', 'trash');
 const materials = ['signi-1', 'signi-2'].map(z => put(g, 't10', z));
 const links = [put(g, 'wn2', 'structures'), put(g, 'wn6', 'structures')];
 const select = id => dispatch(g, { type: 'expansion', id });
 stocks(g, '白', 5);
 dispatch(g, { type: 'play', id: formula.id });
 select('synchro');
 for (const c of materials) select(c.id);
 select('signi-1');
 checkZone(g, formula, 'signi-1');
 assert(!g.sideSpent('p1'));
 use(g, charger);
 checkZone(g, charger, 'trash');
 assert(g.sideSpent('p1'));
 dispatch(g, { type: 'play', id: dragon.id });
 select('links');
 for (const c of links) select(c.id);
 select('signi-2');
 checkZone(g, dragon, 'signi-2');
 // Give the spent spell a test-only target property to exercise the printed
 // recovery effect and destination redirect with a non-creature.
 charger.shieldLink = true;
 select(charger.id);
 delete charger.shieldLink;
 checkZone(g, charger, 'extra');
 checkZone(g, target, 'trash');
 assert(!g.beginPayment(charger.id).ok);
 assert(!g.beginPayment(crest.id).ok);
 nextMain(g);
 assert(g.playStatus(charger, 'p1').ok);
 use(g, charger);
 checkZone(g, charger, 'trash');
 assert.equal(new Set(uses(g, 'sbws1').map(e => e.card.instanceId)).size, 1);
 assert.equal(uses(g, 'sbws1').length, 2);
 assert(g.destroyUnit(formula.id));
 checkZone(g, formula, 'trash');
 nextMain(g);
 use(g, crest);
 checkZone(g, crest, 'structures');
 assert(!g.playStatus(crest, 'p1').ok);
}
console.log('PASS D/E/F: two creatures in one turn, legal return, redeclaration next turn, and field placement');

{
 const g = ready('solo', 'whiteAdvanced');
 const charger = g.state.p1.extra.find(c => c.key === 'sbws1');
 const baronne = put(g, 'sbwo1', 'signi-1');
 use(g, charger);
 checkZone(g, charger, 'trash');
 ok(g.beginWhiteAbility(baronne.id, 'baronneRecover'));
 dispatch(g, { type: 'expansion', id: charger.id });
 checkZone(g, charger, 'trash');
 assert.equal(uses(g, 'sbws1').filter(e => e.from === 'extra').length, 1);
 assert.equal(uses(g, 'sbws1').filter(e => e.from === 'trash').length, 1);
 assert(g.sideSpent('p1'));
}
console.log('PASS E/H: Baronne casts from trash and preserves the side turn ledger');
