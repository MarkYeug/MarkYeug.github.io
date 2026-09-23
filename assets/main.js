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
// Loads the live chapter catalog. The static site can poll this endpoint every few seconds.
const load=async src=>{const candidates = Array.isArray(src) ? src : [src];
let lastError = null;
for (const candidate of candidates) {
  const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),15000);
  try{
    const r=await fetch(candidate,{cache:'no-cache',signal:ctl.signal});
    if(!r.ok) throw new Error(r.status);
    const d=await r.json();
    const v=(Array.isArray(d.volumes)?d.volumes:[]).map((v,i)=>({n:Number.isFinite(v.n)?v.n:i+1,name:String(v.name||''),c:(Array.isArray(v.chapters)?v.chapters:[]).filter(c=>c&&typeof c.title==='string'&&c.title.trim()&&Number.isFinite(c.n)&&ok(c.url))})).filter(v=>v.c.length);
    if(!v.length) throw new Error('empty');
    return v;
  } catch (error) {
    lastError = error;
  } finally { clearTimeout(t); }
}
throw lastError || new Error('empty');};
const ch=$('#chapters'),lt=$('#latest');
const resolveDataSrc=(root)=>{
  const candidates=[];
  const direct=root&&root.dataset&&root.dataset.src ? root.dataset.src : '';
  if(direct)candidates.push(direct);
  candidates.push('/api/chapters','data/chapters.json','argus/data/chapters.json','/argus/data/chapters.json','../data/chapters.json','../argus/data/chapters.json');
  const seen=new Set();
  for(const candidate of candidates){
    const url = candidate.startsWith('http') ? candidate : new URL(candidate, window.location.href).href;
    if(!seen.has(url)){seen.add(url);const path = url.replace(window.location.origin,'');if(path.includes('/api/chapters')||path.includes('/argus/data/chapters.json')||path.includes('/data/chapters.json'))return url;}
  }
  return candidates[0] ? new URL(candidates[0], window.location.href).href : '/api/chapters';
};
const renderChapters=vols=>{const last=vols[vols.length-1].c.slice(-1)[0];
if(ch){ch.replaceChildren(...vols.map(v=>{const s=el('section');s.append(el('h2','','Volume '+v.n));if(v.name)s.append(el('p','arc',v.name));const ol=el('ol');
v.c.forEach(c=>{const li=el('li'),a=el('a');a.href=c.url;a.rel='noopener';a.append(el('span','',c.n),c.title);if(c===last)a.append(el('em','pill','Latest'));li.append(a);ol.append(li)});s.append(ol);return s}));ch.removeAttribute('aria-busy')}
if(lt){const a=el('a','','Chapter '+last.n+': '+last.title);a.href=last.url;a.rel='noopener';lt.replaceChildren('Latest chapter: ',a)}
return last;};
const refreshArgusChapters=async src=>{
  const dataSrc=src||resolveDataSrc(ch||lt);
  const vols=await load(dataSrc);
  return renderChapters(vols);
};
window.refreshArgusChapters=refreshArgusChapters;
if(ch||lt){
  const showFailure = () => {
    if(ch){ch.removeAttribute('aria-busy');ch.replaceChildren(el('p','fail','failed to load chapters'))}
    if(lt)lt.replaceChildren(el('span','fail','failed to load chapters'));
  };
  const poll = () => refreshArgusChapters(resolveDataSrc(ch||lt)).catch(showFailure);
  poll();
  setInterval(poll, 5000);
}
const wd=$('#world');if(wd&&window.WORLD)wd.replaceChildren(...WORLD.map(s=>{const a=el('article');a.append(el('h2','',s.t),el('p','',s.d||'This entry is being written.'));return a}));
const devLink=document.querySelector('.dev-letter');if(devLink){devLink.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();window.location.href=devLink.getAttribute('href')||'../dev/';}})}
})();
