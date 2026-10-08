// Site music player (HOME PAGE ONLY - it refuses to start anywhere else): fixed bottom-right, plays self-hosted audio from assets/music/playlist.json.
// Desktop: always visible. Phones (<=640px): a music icon opens/closes it.
// Playback position carries across page loads (this is a multi-page static site), but it never
// auto-starts on a fresh visit - only when you were already playing and just clicked a link.
(()=>{
const S=document.currentScript;if(!S||!S.src)return;
if(!document.body||!document.body.classList.contains('home-page'))return; // player is home-page only
const ASSETS=new URL('./',S.src).href,LIST=new URL('music/playlist.json',ASSETS).href,KEY='site-player-v1';
const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('player.css',ASSETS).href;document.head.append(css);
const mk=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const svg=(c,d)=>`<svg class="${c}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${d}</svg>`;
const I={
  note:svg('i-note','<path d="M9 3v11.3A3.5 3.5 0 1 0 11 17.5V8h7V3z"/>'),
  back:svg('i-back','<path d="M6 5h2.5v14H6zM20 5v14L9.5 12z"/>'),
  next:svg('i-next','<path d="M15.5 5H18v14h-2.5zM4 5l10.5 7L4 19z"/>'),
  play:svg('i-play','<path d="M7 4.5v15l12-7.5z"/>'),
  pause:svg('i-pause','<path d="M6 4.5h4v15H6zM14 4.5h4v15h-4z"/>')
};
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{}}catch{return{}}};
const write=o=>{try{localStorage.setItem(KEY,JSON.stringify(o))}catch{}};
const fmt=s=>{s=isFinite(s)&&s>0?Math.floor(s):0;return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};

fetch(LIST,{cache:'no-cache'}).then(r=>{if(!r.ok)throw 0;return r.json()}).then(d=>{
  const tracks=(Array.isArray(d.tracks)?d.tracks:[]).filter(t=>t&&typeof t.src==='string'&&t.src.trim())
    .map(t=>({title:String(t.title||'Untitled'),artist:String(t.artist||''),src:new URL(t.src.trim(),LIST).href}));
  if(tracks.length)init(tracks);
}).catch(()=>{});

function init(tracks){
  const st=read(),a=new Audio();a.preload='metadata';
  let i=Number.isInteger(st.i)&&st.i>=0&&st.i<tracks.length?st.i:0,dir=1,want=false,fails=0,seeking=false,pendingSeek=0,lastSave=0;

  const root=mk('div','mp'),fab=mk('button','mp-fab'),panel=mk('div','mp-panel');
  root.setAttribute('role','region');root.setAttribute('aria-label','Music player');
  fab.type='button';fab.innerHTML=I.note;fab.setAttribute('aria-controls','mp-panel');
  panel.id='mp-panel';
  const title=mk('div','mp-title'),artist=mk('div','mp-artist'),seek=mk('div','mp-seek'),cur=mk('span','mp-time','0:00'),dur=mk('span','mp-time','0:00');
  const bar=mk('input','mp-bar');bar.type='range';bar.min=0;bar.max=1000;bar.step=1;bar.value=0;bar.setAttribute('aria-label','Playback position');
  seek.append(cur,bar,dur);
  const ctl=mk('div','mp-ctl'),back=mk('button'),play=mk('button','mp-play'),next=mk('button');
  [back,play,next].forEach(b=>b.type='button');
  back.innerHTML=I.back;back.setAttribute('aria-label','Rewind (restart song, or previous song)');back.title='Rewind';
  play.innerHTML=I.play+I.pause;next.innerHTML=I.next;next.setAttribute('aria-label','Next song');next.title='Next';
  ctl.append(back,play,next);panel.append(title,artist,seek,ctl);root.append(fab,panel);
  document.body.append(root);document.body.classList.add('has-mp');

  const mobile=matchMedia('(max-width:640px)');
  const setOpen=o=>{root.classList.toggle('is-open',o);fab.setAttribute('aria-expanded',String(o));fab.setAttribute('aria-label',o?'Close music player':'Open music player')};
  setOpen(!!st.open);
  fab.addEventListener('click',()=>{setOpen(!root.classList.contains('is-open'));persist()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&mobile.matches&&root.classList.contains('is-open')){setOpen(false);fab.focus();persist()}});

  const paint=()=>bar.style.setProperty('--p',(bar.value/10)+'%');
  const ui=()=>{const p=!a.paused;root.classList.toggle('is-playing',p);play.setAttribute('aria-label',p?'Pause':'Play');play.title=p?'Pause':'Play';if('mediaSession' in navigator)navigator.mediaSession.playbackState=p?'playing':'paused'};
  const persist=()=>write({i,t:a.currentTime||0,playing:!a.paused,ts:Date.now(),open:root.classList.contains('is-open')});
  const tryPlay=()=>{const p=a.play();if(p&&p.catch)p.catch(e=>{if(e&&e.name==='NotAllowedError'){want=false;ui()}})};

  const setTrack=(n,{play:go=false,at=0,d=1}={})=>{
    dir=d;i=(n+tracks.length)%tracks.length;const t=tracks[i];
    a.src=t.src;pendingSeek=at;want=go;
    title.textContent=t.title;title.title=t.title;artist.textContent=t.artist;
    bar.value=0;paint();cur.textContent='0:00';dur.textContent='0:00';
    if('mediaSession' in navigator&&window.MediaMetadata)navigator.mediaSession.metadata=new MediaMetadata({title:t.title,artist:t.artist});
    if(go)tryPlay();ui();
  };
  const toggle=()=>{if(a.paused){want=true;fails=0;if(a.error)setTrack(i,{play:true});else tryPlay()}else{want=false;a.pause()}ui()};
  const rewind=()=>{if(a.currentTime>3)a.currentTime=0;else setTrack(i-1,{play:want||!a.paused,d:-1})};
  const skip=()=>setTrack(i+1,{play:want||!a.paused});
  play.addEventListener('click',toggle);back.addEventListener('click',rewind);next.addEventListener('click',skip);

  bar.addEventListener('input',()=>{seeking=true;cur.textContent=fmt(isFinite(a.duration)?a.duration*bar.value/1000:0);paint()});
  bar.addEventListener('change',()=>{if(isFinite(a.duration))a.currentTime=a.duration*bar.value/1000;seeking=false});

  a.addEventListener('loadedmetadata',()=>{dur.textContent=fmt(a.duration);if(pendingSeek>0&&pendingSeek<a.duration){a.currentTime=pendingSeek}pendingSeek=0});
  a.addEventListener('durationchange',()=>{dur.textContent=fmt(a.duration)});
  a.addEventListener('timeupdate',()=>{
    if(!seeking&&isFinite(a.duration)&&a.duration>0){bar.value=Math.round(a.currentTime/a.duration*1000);paint();cur.textContent=fmt(a.currentTime)}
    const n=Date.now();if(n-lastSave>1000){lastSave=n;persist()}
  });
  a.addEventListener('playing',()=>{fails=0;ui()});
  a.addEventListener('play',ui);a.addEventListener('pause',()=>{ui();persist()});
  a.addEventListener('ended',()=>setTrack(i+1,{play:true}));
  a.addEventListener('error',()=>{
    if(!want){artist.textContent='Audio not available yet';return}
    fails++;
    if(fails>=tracks.length){want=false;artist.textContent='Audio not available yet';ui();return}
    setTrack(i+dir,{play:true,d:dir}); // keep moving the way the listener was going
  });
  addEventListener('pagehide',persist);

  if('mediaSession' in navigator){
    const h=(n,f)=>{try{navigator.mediaSession.setActionHandler(n,f)}catch{}};
    h('play',()=>{if(a.paused)toggle()});h('pause',()=>{if(!a.paused)toggle()});
    h('previoustrack',rewind);h('nexttrack',skip);
    h('seekto',e=>{if(isFinite(e.seekTime))a.currentTime=e.seekTime});
  }

  // Resume only if music was playing a moment ago (i.e. this load is a page-to-page click, not a new visit).
  const resume=!!st.playing&&Date.now()-(st.ts||0)<20000;
  setTrack(i,{play:resume,at:Number(st.t)||0});
}
})();
