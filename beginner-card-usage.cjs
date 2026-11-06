'use strict';

const assert = require('node:assert/strict');
const Decks = require('./decks');

const players = ['p1', 'p2'];
const colors = {whiteBeginner:'白', blueBeginner:'青', blackBeginner:'黒', redBeginner:'赤'};
const board = zone => zone === 'structures' || /^signi-[1-7]$/.test(zone);

// Snapshot only original main-deck instances, before either player acts.
function roster(game) {
 const state = game.state;
 return Object.fromEntries(players.map(p => [p,
  new Map([...state[p].main, ...state[p].hand].map(card => [card.id, card.key]))
 ]));
}

function collect(journal, original) {
 const uses = {p1:{}, p2:{}};
 const pending = new Set();
 const instances = {p1:new Map(), p2:new Map()};
 function count(p, id, key) {
  const row = uses[p][key] ||= {copies:0, events:0};
  row.events++;
  if (!instances[p].has(id)) {
   row.copies++;
   instances[p].set(id, key);
  }
 }
 for (const e of journal) {
  const id = e.card?.instanceId;
  const p = e.card?.owner;
  const key = original[p]?.get(id);
  if (!key) continue;
  if (e.kind === 'cardUse') {
   // Spells count when cast, including countered spells. Permanents count
   // only after successful installation or entry.
   if (e.card.type === '呪文') count(p, id, key);
  } else if (e.kind === 'move') {
   pending.delete(id);
   if (board(e.to?.zone) && !board(e.from?.zone) && e.to.player === p) {
    if (e.to.zone === 'structures') count(p, id, key);
    else pending.add(id);
   }
  } else if (e.kind === 'unitEntry' && pending.delete(id)) {
   count(p, id, key);
  }
 }
 return uses;
}

function catalog(deck) {
 const entries = new Map();
 for (const {key,count} of Decks.preset(deck).main) entries.set(key,(entries.get(key)||0)+count);
 return entries;
}

const ratio = (n,d) => d ? n/d : null;
const difference = (a,b) => a === null || b === null ? null : a-b;
function summarize(games, deck, key) {
 const total = games.length;
 let wins=0, winUsed=0, lossUsed=0, winCopies=0, lossCopies=0;
 let winEvents=0, lossEvents=0, usedTurns=0, unusedTurns=0;
 for (const m of games) {
  const p = m.p1 === deck ? 'p1' : 'p2';
  const win = p === m.winner;
  const use = m.usage[p][key];
  if (win) wins++;
  if (use) {
   usedTurns += m.turn;
   if (win) {winUsed++; winCopies+=use.copies; winEvents+=use.events;}
   else {lossUsed++; lossCopies+=use.copies; lossEvents+=use.events;}
  } else unusedTurns += m.turn;
 }
 const losses=total-wins, used=winUsed+lossUsed, unused=total-used;
 const winRate=ratio(winUsed,wins), lossRate=ratio(lossUsed,losses);
 const usedRate=ratio(winUsed,used), unusedRate=ratio(wins-winUsed,unused);
 return {total,wins,losses,used,unused,winUsed,lossUsed,winCopies,lossCopies,winEvents,lossEvents,
  winRate,lossRate,usedRate,unusedRate,winDiff:difference(usedRate,unusedRate),
  useDiff:difference(winRate,lossRate),winAvg:ratio(winCopies,wins),lossAvg:ratio(lossCopies,losses),
  usedTurns:ratio(usedTurns,used),unusedTurns:ratio(unusedTurns,unused)};
}

module.exports = {roster, collect, catalog, summarize, colors};
