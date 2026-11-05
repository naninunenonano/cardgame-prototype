(function(root){
'use strict';
const settings={
 ranks:[],
 botDeckRecords:[],
 progressMatch:null,
 defaultBotDecks:['redStarter','blueStarter']
};
function state(profile){
 return profile.ranked??{rankId:null,points:null,wins:0,losses:0,matches:[]};
}
function current(progress){return settings.ranks.find(rank=>rank.id===progress.rankId)??null;}
function chooseDeck(progress,preferred,isAvailable,random=Math.random){
 const configured=current(progress)?.botDecks;
 const candidates=(configured??settings.defaultBotDecks).filter(isAvailable);
 if(!configured&&candidates.includes(preferred))return preferred;
 return candidates[Math.floor(random()*candidates.length)]??null;
}
function record(profile,match){
 if(match.error||!['p1','p2'].includes(match.result?.winner))return {eligible:false};
 const progress=profile.ranked??=state(profile);
 const won=match.result.winner==='p1';
 progress[won?'wins':'losses']++;
 progress.matches.push({id:match.gameId,won,deckId:match.deckId,botDeckId:match.botDeckId,reason:match.result.reason});
 const update=settings.progressMatch?.({rankId:progress.rankId,points:progress.points,won});
 if(update){progress.rankId=update.rankId;progress.points=update.points;}
 return {eligible:true};
}
const api={settings,state,current,chooseDeck,record};
if(typeof module==='object'&&module.exports)module.exports=api;
else root.RankedBattle=api;
})(globalThis);
