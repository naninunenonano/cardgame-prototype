/* Presentation data only. Add/replace paths here without changing game rules. */
(function(root){
'use strict';
const images={
 almar:{0:'assets/characters/almar/lv0.webp',1:null,2:null,3:null,4:null},
 redCaptain:{0:null,1:null,2:null,3:null,4:null},
 blueSage:{0:null,1:null,2:null,3:null,4:null},
 celestia:{0:null,1:null,2:null,3:null,4:null}
};
const failed=new Set(),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function source(key,level=0){const path=(root.CardImages?.path(key,level))||images[key]?.[level];return typeof path==='string'&&/\.(png|webp)(\?[^#]*)?$/i.test(path)&&!failed.has(path)?path:null;}
function html(c){const level=c.level??0,path=source(c.key,level);return `<span class="character-art" data-art-character="${esc(c.key)}" data-art-level="${level}">${path?`<img src="${esc(path)}" alt="${esc(c.name)} Lv${level}のイラスト" data-character-image="${esc(path)}" decoding="async">`:''}<span class="character-art-placeholder" ${path?'hidden':''}>NO IMAGE</span></span>`;}
if(typeof document!=='undefined')document.addEventListener('error',e=>{const img=e.target;if(!img?.matches?.('img[data-character-image]'))return;failed.add(img.dataset.characterImage);img.hidden=true;const fallback=img.parentElement.querySelector('.character-art-placeholder');if(fallback)fallback.hidden=false;},true);
root.CharacterArt={images,source,html};
if(typeof module==='object'&&module.exports)module.exports=root.CharacterArt;
})(globalThis);
