/* Optional PNG artwork: identity metadata determines the directory and face. */
(function(root){'use strict';
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const valid=v=>typeof v==='string'&&/^[a-z0-9_-]+$/.test(v);
function path(key,level){if(!valid(key))return null;if(level!==undefined)return 'images/characters/'+key+'/lv'+Number(level)+'.png';const split=key.indexOf('_');return split<0?'images/cards/'+key+'.png':'images/characters/'+key.slice(0,split)+'/cards/'+key.slice(split+1)+'.png';}
function html(card){const key=card?.faceId||card?.key,url=path(key,card?.type==='キャラクター'?(card.level??0):undefined);if(!url)return '';return '<span class="optional-art"><img loading="lazy" decoding="async" src="'+escape(url)+'" alt="" onerror="this.parentElement.remove()" ></span>';}
root.CardImages={path,html};if(typeof module==='object'&&module.exports)module.exports=root.CardImages;
})(globalThis);
