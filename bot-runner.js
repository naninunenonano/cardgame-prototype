// Executes one validated shared-rules command per tick. The policy has no Game reference.
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./bot.js'):root.BotPolicy);if(typeof module==='object'&&module.exports)module.exports=api;else root.BotRunner=api;})(globalThis,function(Policy){
function create({game,onChange=()=>{},onError=()=>{},setTimer=setTimeout,clearTimer=clearTimeout,delay=140}={}){
 let timer=null,generation=0,paused=false,steps=0;
 function stop(){generation++;if(timer!==null)clearTimer(timer);timer=null;paused=false;}
 function resume(){if(timer!==null||paused||game.mode!=='bot'||game.result||game.decisionPlayer()!=='p2')return;
  const session=game.epoch,token=generation;
  timer=setTimer(()=>{timer=null;if(token!==generation||session!==game.epoch||game.mode!=='bot'||game.result||game.decisionPlayer()!=='p2')return;
   try{const action=Policy.decide(game.observe('p2'));if(action.type!=='wait'){const result=game.dispatch(action,'p2',session);if(!result.ok){paused=true;onError(result.message);}else{steps++;onChange(result);}}}
   catch(error){paused=true;onError('Bot処理を停止しました：'+error.message);}
   resume();
  },delay);
 }
 return {resume,stop,retry(){paused=false;resume();},get pending(){return timer!==null;},get paused(){return paused;},get steps(){return steps;}};
}
return {create};
});
