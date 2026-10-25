/* Optional PNG art. No catalog, rules, or collection mutations. */
(function(root){'use strict';
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const valid=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]+$/.test(v);
const path=(key,level)=>valid(key)?(level===undefined?'images/cards/'+key+'.png':'images/characters/'+key+'/lv'+Number(level)+'.png'):null;
function html(card){const key=card?.key;if(!valid(key))return '';const url=path(key,card.type==='キャラクター'?(card.level??0):undefined);return '<span class="optional-art"><img loading="lazy" decoding="async" src="'+escape(url)+'" alt="" onerror="this.parentElement.remove()" ></span>';}
root.CardImages={path,html};
if(typeof module==='object'&&module.exports)module.exports=root.CardImages;
})(globalThis);
