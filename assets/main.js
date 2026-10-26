(()=>{const $=s=>document.querySelector(s),TZ='America/Anchorage',R=[1,5],N=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],F=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const P=t=>{const o={};new Intl.DateTimeFormat('en-US',{timeZone:TZ,hourCycle:'h23',year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'numeric',second:'numeric'}).formatToParts(t).forEach(p=>o[p.type]=+p.value);return o};
const W=t=>{const p=P(t);return Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)};
const at=(y,m,d,h)=>{const g=Date.UTC(y,m-1,d,h);return g-(W(g)-g)};
const wk=$('#week');
if(wk){let boom=0;const draw=()=>{const now=Date.now(),p=P(now),base=Date.UTC(p.year,p.month-1,p.day),dow=new Date(base).getUTCDay();
const rel=k=>{const d=new Date(base+k*864e5);return at(d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate(),8)};
let h='';for(let i=0;i<7;i++){const d=new Date(base+(i-dow)*864e5),r=R.includes(i);h+=`<div class="d${r?' rel':''}${i==dow?' today':''}"><b>${N[i]}</b><span>${d.getUTCDate()}</span>${r?'<i>Chapter</i>':''}</div>`}
wk.innerHTML=h;const isR=R.includes(dow),out=isR&&now>=rel(0);let k=0;while(!(R.includes((dow+k)%7)&&rel(k)>now))k++;
const s=Math.floor((rel(k)-now)/1e3),c=`${Math.floor(s/86400)}d ${Math.floor(s%86400/3600)}h ${Math.floor(s%3600/60)}m ${s%60}s`;
const lc=Intl.DateTimeFormat().resolvedOptions().timeZone!==TZ?` (${new Intl.DateTimeFormat([],{hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(rel(k))} for you)`:'';$('#banner').textContent=isR?`It's Argus ${F[dow]}!`:'This week on Argus';
$('#status').innerHTML=out?'A new chapter is out now. <a href="https://www.webnovel.com/book/35397598808248905/catalog">Read it on WebNovel</a>':(isR?'New chapter today at 8:00 AM Alaska time'+lc:`Next chapter: ${F[(dow+k)%7]} at 8:00 AM Alaska time`+lc);
$('#count').textContent=out?'':c;
if(isR&&!boom&&!matchMedia('(prefers-reduced-motion:reduce)').matches){boom=1;for(let i=0;i<70;i++){const e=document.createElement('u');e.className='cf';e.style.cssText=`left:${Math.random()*100}vw;background:${['#d4af37','#f6d365','#8a6d1c','#f4ecd8'][i%4]};animation-delay:${Math.random()*1.2}s;animation-duration:${2.5+Math.random()*2}s`;document.body.append(e)}setTimeout(()=>document.querySelectorAll('.cf').forEach(e=>e.remove()),6500)}};draw();setInterval(draw,1000)}
const ok=u=>{try{const x=new URL(u);return x.protocol==='https:'&&/(^|\.)webnovel\.com$/.test(x.hostname)}catch{return false}};
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const load=async src=>{const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),15000);
try{const r=await fetch(src,{cache:'no-cache',signal:ctl.signal});if(!r.ok)throw new Error(r.status);const d=await r.json();
const v=(Array.isArray(d.volumes)?d.volumes:[]).map((v,i)=>({n:Number.isFinite(v.n)?v.n:i+1,name:String(v.name||''),c:(Array.isArray(v.chapters)?v.chapters:[]).filter(c=>c&&typeof c.title==='string'&&c.title.trim()&&Number.isFinite(c.n)&&ok(c.url)).map(c=>({...c,published:typeof c.published==='string'&&c.published?c.published:null}))})).filter(v=>v.c.length);
if(!v.length)throw new Error('empty');return v}finally{clearTimeout(t)}};
const ytId=u=>{try{const x=new URL(u),h=x.hostname.replace(/^www\.|^m\.|^music\./,'');let id=h==='youtu.be'?x.pathname.slice(1):h==='youtube.com'?(x.searchParams.get('v')||(x.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)||[])[1]):'';return /^[\w-]{11}$/.test(id||'')?id:''}catch{return ''}};
const okYT=u=>{try{const x=new URL(u);return x.protocol==='https:'&&/^(www\.|m\.|music\.)?(youtube\.com|youtu\.be)$/.test(x.hostname)}catch{return false}};
// A chapter's WebNovel ID is the number after the last underscore in its link (.../9th-bullet_95499079936699183). Kept as a string: these are too big for a JS number.
const chId=u=>{try{const m=new URL(u).pathname.match(/_(\d+)\/?$/);return m?m[1]:''}catch{return ''}};
// chapter ID -> link to its soundtrack (only chapters flagged true with a valid YouTube link). Never fatal.
const loadMusic=async src=>{const m=new Map();if(!src)return m;try{const r=await fetch(src,{cache:'no-cache'});if(!r.ok)throw 0;const d=await r.json(),o=d&&d.chapters||{};
for(const k of Object.keys(o)){if(!/^\d+$/.test(k))continue;const e=o[k];if(!e||e.soundtrack!==true||typeof e.url!=='string'||!okYT(e.url.trim()))continue;const u=e.url.trim(),id=ytId(u);
m.set(k,id?new URL('../soundtrack/?v='+id,src).href:u)}}catch{}return m};
const noteIcon='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 3v11.3A3.5 3.5 0 1 0 11 17.5V8h7V3z"/></svg>';
// Volumes whose name ends in "Special Chapters" are listed as "Special Chapters: <rest of the name>" and sorted to the top.
const SPECIAL=/[\s\-–—:]*special\s+chapters\s*$/i,isSpecial=v=>SPECIAL.test(v.name),isWeen=v=>/argus[\s-]*ween/i.test(v.name);
const volTitle=v=>{if(!isSpecial(v))return `Vol. ${v.n} — ${v.name||'Untitled'}`;const t=v.name.replace(SPECIAL,'').trim();return t?`Special Chapters: ${t}`:'Special Chapters'};
const pumpkinIcon='<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M15 8.5c-.2-3 1-5 3.8-6l.9 1.8c-1.5.6-2.1 1.7-2 4.2z" fill="#6b8f23"/><path d="M16 8c-2.6-1.9-8.6-1.4-11.4 2.8C2 14.6 2.1 20.3 5 24c2.5 3.1 6.6 3.8 11 3.8S24.5 27.1 27 24c2.9-3.7 3-9.4.4-13.2C24.6 6.6 18.6 6.1 16 8z" fill="#ff8a1f"/><path d="M16 8.2c-3 3.6-3 15.6 0 19.4M10.8 8.7c-3.6 3.8-3.8 14.8-.6 18.7M21.2 8.7c3.6 3.8 3.8 14.8.6 18.7" fill="none" stroke="#c45a00" stroke-width="1.1" stroke-linecap="round"/><path fill="#1b0d03" d="M8.4 16.2l3.4-3 1.1 3.8zM23.6 16.2l-3.4-3-1.1 3.8zM16 17.6l-1.7 2.8h3.4zM9.8 21.7l2 1.6 1.8-1.7 2.4 2.1 2.4-2.1 1.8 1.7 2-1.6c-.6 3.2-3.1 4.7-6.2 4.7s-5.6-1.5-6.2-4.7z"/></svg>';
const ch=$('#chapters'),lt=$('#latest');
const resolveDataSrc=(root)=>{
  const candidates=[];
  const direct=root&&root.dataset&&root.dataset.src ? root.dataset.src : '';
  if(direct)candidates.push(direct);
  candidates.push('data/chapters.json','argus/data/chapters.json','/argus/data/chapters.json','../data/chapters.json','../argus/data/chapters.json');
  const seen=new Set();
  for(const candidate of candidates){
    const url = candidate.startsWith('http') ? candidate : new URL(candidate, window.location.href).href;
    if(!seen.has(url)){seen.add(url);const path = url.replace(window.location.origin,'');if(path.includes('/argus/data/chapters.json')||path.includes('/data/chapters.json'))return url;}
  }
  return candidates[0] ? new URL(candidates[0], window.location.href).href : '/argus/data/chapters.json';
};
const dateText=date=>{if(!date)return '';const value=new Date(date);return Number.isNaN(value.getTime())?'':new Intl.DateTimeFormat('en-US',{year:'numeric',month:'2-digit',day:'2-digit'}).format(value)};
// "Latest" is determined ONLY by the final numeric ID in the literal WebNovel chapter URL.
// Never use chapter number, catalog position, stored id fields, or publication dates.
// WebNovel IDs exceed Number.MAX_SAFE_INTEGER, so compare them as BigInt.
const idOf=c=>{const id=chId(c?.url||'');return /^\d+$/.test(id)?BigInt(id):-1n};
const laterOf=(a,b)=>idOf(a)>idOf(b)?a:b;
// Sort order of the list: 'new' = newest first (the default on every load), 'old' = oldest first. Volume/chapter numbers (n) grow with newer ones.
let order='new',cache=null;const sortBtn=$('#sort'),byN=(a,b)=>(order==='new'?-1:1)*(a.n-b.n);
const syncSort=()=>{if(!sortBtn)return;const nf=order==='new',lab=sortBtn.querySelector('.sort-label');if(lab)lab.textContent=nf?'Newest first':'Oldest first';sortBtn.dataset.order=order;sortBtn.setAttribute('aria-label',`Showing ${nf?'newest':'oldest'} first. Switch to ${nf?'oldest':'newest'} first.`);sortBtn.hidden=false};
const renderChapters=(vols,music=new Map())=>{const last=vols.flatMap(v=>v.c).reduce(laterOf);
if(ch){const sorted=[...vols].sort(byN),shown=[...sorted.filter(isSpecial),...sorted.filter(v=>!isSpecial(v))];syncSort();ch.replaceChildren(...shown.map(v=>{const s=el('section',(isSpecial(v)?'vol-special':'')+(isWeen(v)?' vol-argusween':'')),volumeDate=dateText(v.c.find(c=>c.published)?.published),heading=`${volTitle(v)}${volumeDate?' '+volumeDate:''}`,h=el('h2');if(isWeen(v)){const pk=el('span','pumpkin');pk.setAttribute('aria-hidden','true');pk.innerHTML=pumpkinIcon;h.append(pk)}h.append(heading);s.append(h);const ol=el('ol');
[...v.c].sort(byN).forEach(c=>{const li=el('li'),a=el('a');a.href=c.url;a.append(el('span','',c.n),c.title);if(c.published)a.append(el('time','release-date',dateText(c.published)));li.append(a);const mu=music.get(chId(c.url));if(mu){const l=el('a','music music-indicator');l.href=mu;l.title='Open chapter soundtrack';l.setAttribute('aria-label','Open chapter soundtrack');l.innerHTML=noteIcon;li.append(l)}
if(c===last)li.append(el('em','pill','Latest'));ol.append(li)});s.append(ol);return s}));ch.removeAttribute('aria-busy')}
if(lt){const a=el('a','','#'+last.n+': '+last.title);a.href=last.url;lt.replaceChildren('Latest chapter: ',a)}
return last;};
const refreshArgusChapters=async src=>{const dataSrc=src||resolveDataSrc(ch||lt),ms=ch&&ch.dataset.soundtracks;const [vols,music]=await Promise.all([load(dataSrc),loadMusic(ms?new URL(ms,window.location.href).href:'')]);cache={vols,music};return renderChapters(vols,music)};
if(sortBtn)sortBtn.addEventListener('click',()=>{order=order==='new'?'old':'new';if(cache)renderChapters(cache.vols,cache.music)});
window.refreshArgusChapters=refreshArgusChapters;
if(ch||lt){
  const showFailure = () => {
    if(ch){ch.removeAttribute('aria-busy');ch.replaceChildren(el('p','fail','failed to load chapters'))}
    if(lt)lt.replaceChildren(el('span','fail','failed to load chapters'));
  };
  refreshArgusChapters(resolveDataSrc(ch||lt)).catch(showFailure);
}
const wd=$('#world');if(wd&&window.WORLD)wd.replaceChildren(...WORLD.map(s=>{const a=el('article');a.append(el('h2','',s.t),el('p','',s.d||'This entry is being written.'));return a}));
const devLink=document.querySelector('.dev-letter');if(devLink){devLink.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();window.location.href=devLink.getAttribute('href')||'../dev/';}})}
})();
