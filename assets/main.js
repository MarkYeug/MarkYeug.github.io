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
$('#banner').textContent=isR?`It's Argus ${F[dow]}!`:'This week on Argus';
$('#status').innerHTML=out?'A new chapter is out now. <a href="https://www.webnovel.com/book/35397598808248905/catalog">Read it on WebNovel</a>':(isR?'New chapter today at 8:00 AM Alaska time':`Next chapter: ${F[(dow+k)%7]} at 8:00 AM Alaska time`);
$('#count').textContent=out?'':c;
if(isR&&!boom&&!matchMedia('(prefers-reduced-motion:reduce)').matches){boom=1;for(let i=0;i<70;i++){const e=document.createElement('u');e.className='cf';e.style.cssText=`left:${Math.random()*100}vw;background:${['#a45cff','#ffd60a','#e10b1f','#ece6f2'][i%4]};animation-delay:${Math.random()*1.2}s;animation-duration:${2.5+Math.random()*2}s`;document.body.append(e)}setTimeout(()=>document.querySelectorAll('.cf').forEach(e=>e.remove()),6500)}};draw();setInterval(draw,1000)}
const ch=$('#chapters');if(ch&&window.ARGUS)ch.innerHTML=ARGUS.volumes.map(v=>`<section><h2>Volume ${v.n}</h2><p class=arc>${v.name}</p><ol>${v.c.map(c=>`<li><a href="${ARGUS.base+c[2]}" rel=noopener><span>${c[0]}</span>${c[1]}</a></li>`).join('')}</ol></section>`).join('');
const wd=$('#world');if(wd&&window.WORLD)wd.innerHTML=WORLD.map(s=>`<article><h2>${s.t}</h2><p>${s.d||'This entry is being written.'}</p></article>`).join('')})();
