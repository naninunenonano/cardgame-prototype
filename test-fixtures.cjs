// Test-only resources: real ordinary card instances, never a production deck or UI option.
const M=require('./mana.js');
function fund(g,p,n,color=null){const k=color||(g.deckInfo(p).name.includes('緑')?'緑':'青');for(let i=0;i<n;i++){const c=g.card('テスト用マナ','呪文',k,M.cost(1),false,p);c.mana={color:k,amount:1};g.state[p].energy.push(c);}g.state;return n;}
function finishRefresh(g){while(g.operation?.kind==='refreshPenalty'){for(const c of g.state[g.operation.p].energy.slice(0,g.operation.required))g.selectRefreshMana(c.id);g.confirmRefresh();}}
function skipCharge(g){if(g.turn.step==='charge'&&!g.operation)g.skipCharge();}
module.exports={fund,finishRefresh,skipCharge};
