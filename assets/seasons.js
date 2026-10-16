/*
 * Seasonal effects for the Argus pages.
 *
 *   October   Halloween     webs in the corners and sides, ghosts drifting through the background
 *   November  Thanksgiving  slow falling leaves that fade out at the bottom
 *   December  Winter        falling snow and a small pile along the bottom edge
 *   January   New Year's    fireworks on open + countdown to the Argus Anniversary (Jan 20, 12:00 AM AKST)
 *             Anniversary   from Jan 20 on: balloons rise alongside the fireworks
 *
 * The season is picked from the date in Alaska time (same clock as the chapter schedule).
 * To test a season, set the `argus_season` cookie (see README, or call ArgusSeason.help() in the browser console).
 * Everything here is plain JS/CSS; the styles live in assets/style.css (search "Seasonal effects").
 */
(() => {
  'use strict';

  const COOKIE = 'argus_season';
  const TZ = 'America/Anchorage';

  // Value stored in the cookie -> what it means. `aliases` are also accepted.
  const SEASONS = {
    halloween:    { label: 'Halloween (October)',                aliases: ['october', 'oct'] },
    thanksgiving: { label: 'Thanksgiving (November)',            aliases: ['november', 'nov'] },
    winter:       { label: 'Winter holidays (December)',         aliases: ['december', 'dec', 'holidays'] },
    newyear:      { label: "New Year's + anniversary countdown", aliases: ['january', 'jan', 'newyears'] },
    anniversary:  { label: 'Argus Anniversary (Jan 20 onward)',  aliases: ['argus-anniversary'] },
    off:          { label: 'No seasonal effects',                aliases: ['none'] }
  };

  // Fireworks run this long after the page opens (milliseconds). Raise or lower to taste.
  const FIREWORKS_MS = 14000;

  /* ---------- small helpers ---------- */
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const pad2 = (n) => String(n).padStart(2, '0');

  const normalize = (value) => {
    const v = String(value || '').trim().toLowerCase();
    if (!v) return null;
    for (const key of Object.keys(SEASONS)) {
      if (key === v || SEASONS[key].aliases.includes(v)) return key;
    }
    return null;
  };

  /* ---------- which season is it? ---------- */
  const alaskaDate = (t) => {
    const o = {};
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric' })
      .formatToParts(t).forEach((p) => { if (p.type !== 'literal') o[p.type] = +p.value; });
    return o;
  };
  // January 20, 12:00 AM AKST. Alaska is UTC-9 in January, so this is 09:00 UTC.
  const anniversaryStart = (year) => Date.UTC(year, 0, 20, 9, 0, 0);

  const seasonForDate = (now) => {
    const d = alaskaDate(now);
    if (d.month === 10) return 'halloween';
    if (d.month === 11) return 'thanksgiving';
    if (d.month === 12) return 'winter';
    if (d.month === 1) return now >= anniversaryStart(d.year) ? 'anniversary' : 'newyear';
    return null;
  };

  /* ---------- cookie override (for testing) ---------- */
  const readCookie = () => {
    const hit = document.cookie.split('; ').find((c) => c.startsWith(COOKIE + '='));
    if (!hit) return '';
    try { return decodeURIComponent(hit.slice(COOKIE.length + 1)); } catch { return ''; }
  };
  // One day, so a forgotten test cookie cleans itself up.
  const writeCookie = (v) => { document.cookie = `${COOKIE}=${encodeURIComponent(v)}; path=/; max-age=86400; SameSite=Lax`; };
  const clearCookie = () => { document.cookie = `${COOKIE}=; path=/; max-age=0; SameSite=Lax`; };

  // -> { name: season key or null, override: true when the cookie decided it }
  const resolve = () => {
    const raw = readCookie();
    if (raw) {
      const key = normalize(raw);
      if (key) return { name: key === 'off' ? null : key, override: true };
      console.warn(`[ArgusSeason] Ignoring unknown cookie value "${raw}". Valid: ${Object.keys(SEASONS).join(', ')}.`);
    }
    return { name: seasonForDate(Date.now()), override: false };
  };

  /* ---------- page guard ---------- */
  // Effects only run on the Argus pages. The home, Phobia, and dev pages keep their own look
  // (the dev page loads this file just so its *#season command can use the API below).
  const onArgusPage = !/\b(home|phobia|dev)-page\b/.test(document.body.className);
  const reducedMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- runtime state ---------- */
  let active = null;      // season currently showing
  let root = null;        // container for everything this script adds (except the banner)
  let banner = null;
  let layers = [];        // canvases
  let systems = [];       // animated things drawn on the canvases
  let timers = [];        // setTimeout / setInterval ids
  let rafId = 0;
  let lastFrame = 0;

  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
  const every = (fn, ms) => { const id = setInterval(fn, ms); timers.push(id); return id; };

  const teardown = () => {
    cancelAnimationFrame(rafId); rafId = 0;
    timers.forEach((id) => { clearTimeout(id); clearInterval(id); });
    window.removeEventListener('resize', onResize);
    if (root) root.remove();
    if (banner) banner.remove();
    root = banner = null; layers = []; systems = []; timers = [];
  };

  const onResize = () => {
    layers.forEach((l) => l.resize());
    systems.forEach((s) => s.resize && s.resize());
  };

  const makeLayer = (kind) => {            // kind: 'back' (behind the page) or 'front' (over it)
    const canvas = document.createElement('canvas');
    canvas.className = 'season-canvas ' + kind;
    root.append(canvas);
    const L = { canvas, ctx: canvas.getContext('2d'), w: 0, h: 0 };
    L.resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      L.w = canvas.clientWidth || window.innerWidth;
      L.h = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.round(L.w * dpr);
      canvas.height = Math.round(L.h * dpr);
      L.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    L.resize();
    layers.push(L);
    return L;
  };

  const frame = (now) => {
    const dt = Math.min(0.05, (now - lastFrame) / 1000 || 0);
    lastFrame = now;
    layers.forEach((l) => l.ctx.clearRect(0, 0, l.w, l.h));
    let busy = false;
    for (const s of systems) {
      s.update(dt);
      s.draw();
      if (!s.done) busy = true;
    }
    rafId = busy ? requestAnimationFrame(frame) : 0;   // one-shot shows stop the loop when they finish
  };

  const startLoop = () => {
    if (rafId) return;
    lastFrame = performance.now();
    rafId = requestAnimationFrame(frame);
  };

  /* ================= OCTOBER: webs + ghosts ================= */

  // Tiny seeded random so each web keeps the same shape on every load.
  const seeded = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // A fan of spokes from (cx, cy) with sagging cross-threads between them.
  const webPath = (cx, cy, R, fromDeg, toDeg, spokes, rings, seed) => {
    const rnd = seeded(seed);
    const angles = Array.from({ length: spokes }, (_, i) => (fromDeg + (toDeg - fromDeg) * i / (spokes - 1)) * Math.PI / 180);
    const pt = (a, r) => `${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`;
    let d = '';
    angles.forEach((a) => { d += `M${cx} ${cy}L${pt(a, R)}`; });
    for (let k = 1; k <= rings; k++) {
      const base = R * Math.pow(k / rings, 1.12);
      for (let i = 0; i < spokes - 1; i++) {
        const r1 = base * (0.96 + rnd() * 0.08), r2 = base * (0.96 + rnd() * 0.08);
        const mid = (angles[i] + angles[i + 1]) / 2;
        d += `M${pt(angles[i], r1)}Q${pt(mid, base * (0.8 + rnd() * 0.06))} ${pt(angles[i + 1], r2)}`;
      }
    }
    return d;
  };

  const webSVG = (viewBox, d) =>
    `<svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" aria-hidden="true" focusable="false"><path vector-effect="non-scaling-stroke" d="${d}"/></svg>`;

  const addWebs = () => {
    const corner = (cls, seed) => {
      const el = document.createElement('div');
      el.className = 'season-web ' + cls;
      el.innerHTML = webSVG('0 0 100 100', webPath(0, 0, 100, 0, 90, 7, 6, seed));
      root.append(el);
    };
    const side = (cls, seed) => {
      const el = document.createElement('div');
      el.className = 'season-web side ' + cls;
      el.innerHTML = webSVG('0 0 100 200', webPath(0, 100, 100, -78, 78, 7, 5, seed));
      root.append(el);
    };
    corner('tl', 11); corner('tr', 23); corner('bl', 37); corner('br', 41);
    side('l', 53); side('r', 67);
  };

  const GHOST_SVG =
    '<svg viewBox="0 0 64 76" aria-hidden="true" focusable="false"><path fill="#f4ecd8" d="M32 2C16 2 6 14 6 30v38c0 4 3 5 5.5 2.5L18 64l6.5 6.5c1.5 1.5 3.5 1.5 5 0L32 67.5l2.5 3c1.5 1.5 3.5 1.5 5 0L46 64l6.5 6.5c2.5 2.5 5.5 1.5 5.5-2.5V30C58 14 48 2 32 2z"/>' +
    '<ellipse cx="23.5" cy="29" rx="4" ry="6" fill="#14110a"/><ellipse cx="40.5" cy="29" rx="4" ry="6" fill="#14110a"/><ellipse cx="32" cy="44" rx="4.5" ry="6" fill="#14110a"/></svg>';

  const addGhosts = () => {
    const layer = document.createElement('div');
    layer.className = 'season-ghost-layer';
    root.append(layer);

    const spawn = () => {
      if (layer.children.length < 2) {
        const vw = layer.clientWidth || window.innerWidth, vh = layer.clientHeight || window.innerHeight;
        const size = rand(64, 112), fromLeft = Math.random() < 0.5;
        const y = rand(0.08, 0.78) * vh, amp = rand(14, 34), waves = rand(1.5, 3), duration = rand(11000, 19000);
        const x0 = -size - 20, x1 = vw + 20, steps = 28, keys = [];
        for (let i = 0; i <= steps; i++) {
          const p = i / steps;
          const x = fromLeft ? x0 + (x1 - x0) * p : x1 - (x1 - x0) * p;
          keys.push({ transform: `translate(${x.toFixed(1)}px, ${(y + Math.sin(p * waves * Math.PI * 2) * amp).toFixed(1)}px)` });
        }
        const ghost = document.createElement('div');
        ghost.className = 'season-ghost';
        ghost.style.setProperty('--s', size.toFixed(0) + 'px');
        ghost.innerHTML = GHOST_SVG;
        layer.append(ghost);
        ghost.animate(keys, { duration, easing: 'linear' }).onfinish = () => ghost.remove();
      }
      later(spawn, rand(5000, 11000));
    };
    later(spawn, 1200);      // first ghost shows up almost right away
  };

  /* ================= NOVEMBER: falling leaves ================= */

  const MAPLE = new Path2D('M50 2L58 22L72 16L68 38L92 32L82 50L96 58L68 68L70 78L54 72L54 98L46 98L46 72L30 78L32 68L4 58L18 50L8 32L32 38L28 16L42 22Z');
  const OVAL_LEAF = new Path2D('M50 3C82 24 88 62 50 97C12 62 18 24 50 3Z');
  const OVAL_VEIN = new Path2D('M50 12V92M50 42L36 30M50 42L64 30M50 62L33 48M50 62L67 48');
  const LEAF_COLORS = ['#c1440e', '#d9731f', '#e0a526', '#bf3a24', '#b8661a', '#e07b39'];

  const leavesSystem = (L) => {
    const leaves = [];
    const want = () => Math.round(clamp(L.w / 38, 16, 40));
    const make = (seeded) => {
      const size = rand(18, 36);
      return {
        x: rand(-0.05 * L.w, 1.05 * L.w),
        y: seeded ? rand(-size, L.h * 0.7) : -size * (1 + Math.random()),
        size, t: 0,
        vx: rand(-45, 45),            // drifts left or right
        vy: rand(26, 72),             // slow fall, each leaf at its own speed
        sway: rand(8, 28), swayF: rand(0.5, 1.4), phase: rand(0, 6.28),
        rot: rand(0, 6.28), spin: rand(-1.5, 1.5), flip: rand(0.8, 2.2),
        oval: Math.random() < 0.35, color: pick(LEAF_COLORS)
      };
    };
    for (let i = 0; i < want(); i++) leaves.push(make(true));

    // Fully visible for the top 45% of the screen, then fades to 0% by the time it reaches the bottom.
    const alphaOf = (l) => clamp(1 - (l.y - L.h * 0.45) / (L.h * 0.55), 0, 1);

    return {
      done: false,
      update(dt) {
        if (leaves.length < want() && Math.random() < dt * 3) leaves.push(make(false));
        for (let i = leaves.length - 1; i >= 0; i--) {
          const l = leaves[i];
          l.t += dt;
          l.x += (l.vx + Math.cos(l.t * l.swayF + l.phase) * l.sway) * dt;
          l.y += l.vy * dt;
          l.rot += l.spin * dt;
          if (alphaOf(l) <= 0 || l.x < -80 || l.x > L.w + 80) leaves.splice(i, 1);
        }
      },
      draw() {
        const ctx = L.ctx;
        for (const l of leaves) {
          ctx.globalAlpha = alphaOf(l);
          ctx.save();
          ctx.translate(l.x, l.y);
          ctx.rotate(l.rot);
          const flip = 0.35 + 0.65 * Math.abs(Math.cos(l.t * l.flip));   // tumbling
          ctx.scale(l.size / 100 * flip, l.size / 100);
          ctx.translate(-50, -50);
          ctx.fillStyle = l.color;
          if (l.oval) {
            ctx.fill(OVAL_LEAF);
            ctx.strokeStyle = 'rgba(30,10,0,.35)'; ctx.lineWidth = 3; ctx.stroke(OVAL_VEIN);
          } else {
            ctx.fill(MAPLE);
          }
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      }
    };
  };

  /* ================= DECEMBER: snow + pile ================= */

  const PILE_COL = 4;      // pile resolution in px
  const PILE_MAX = 26;     // the pile levels off around this height in px

  const snowSystem = (L) => {
    const flakes = [];
    let pile, cols;
    const initPile = () => {
      const avg = pile ? pile.reduce((a, b) => a + b, 0) / pile.length : 2;
      cols = Math.ceil(L.w / PILE_COL) + 1;
      pile = new Float32Array(cols).fill(avg);
    };
    initPile();

    const want = () => Math.round(clamp(L.w / 9, 70, 170));
    const make = (seeded) => {
      const r = rand(1.2, 3.6);
      return {
        x: rand(-0.05 * L.w, 1.05 * L.w),
        y: seeded ? rand(-10, L.h * 0.9) : -r * 2 - Math.random() * 40,
        r, t: 0,
        vx: rand(-28, 28),
        vy: rand(32, 95) * (0.6 + r / 6),   // bigger flakes fall a little faster
        sway: rand(6, 20), swayF: rand(0.6, 1.6), phase: rand(0, 6.28),
        a: rand(0.55, 0.95)
      };
    };
    for (let i = 0; i < want(); i++) flakes.push(make(true));

    // A landed flake raises a soft bump; the closer the pile is to its max height, the less it grows.
    const land = (x, r) => {
      const c = Math.round(x / PILE_COL), reach = 7;
      const peak = 2.6 * clamp(1400 / L.w, 0.6, 1.8) * (0.7 + r / 4);
      for (let i = -reach; i <= reach; i++) {
        const j = c + i;
        if (j < 0 || j >= cols) continue;
        const shape = Math.pow(Math.cos(i / reach * Math.PI / 2), 2);
        pile[j] += peak * shape * (1 - pile[j] / PILE_MAX);
      }
    };

    return {
      done: false,
      resize() { initPile(); },
      update(dt) {
        if (flakes.length < want() && Math.random() < dt * 20) flakes.push(make(false));
        for (let i = flakes.length - 1; i >= 0; i--) {
          const f = flakes[i];
          f.t += dt;
          f.x += (f.vx + Math.cos(f.t * f.swayF + f.phase) * f.sway) * dt;
          f.y += f.vy * dt;
          const col = clamp(Math.round(f.x / PILE_COL), 0, cols - 1);
          if (f.y + f.r >= L.h - pile[col]) { land(f.x, f.r); flakes.splice(i, 1); }
          else if (f.x < -60 || f.x > L.w + 60) flakes.splice(i, 1);
        }
      },
      draw() {
        const ctx = L.ctx;
        ctx.fillStyle = '#f4f8ff';
        for (const f of flakes) {
          ctx.globalAlpha = f.a;
          ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.2832); ctx.fill();
        }
        ctx.globalAlpha = 1;
        // the pile, drawn as one smooth silhouette along the bottom edge
        const g = ctx.createLinearGradient(0, L.h - PILE_MAX, 0, L.h);
        g.addColorStop(0, '#f7faff'); g.addColorStop(1, '#cdd9ee');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, L.h);
        ctx.lineTo(0, L.h - pile[0]);
        for (let i = 1; i < cols; i++) {
          const x = i * PILE_COL, y = L.h - pile[i];
          const px = (i - 1) * PILE_COL, py = L.h - pile[i - 1];
          ctx.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
        }
        ctx.lineTo(L.w, L.h);
        ctx.closePath();
        ctx.fill();
      }
    };
  };

  /* ================= JANUARY: fireworks, countdown, balloons ================= */

  const FW_COLORS = ['#f6d365', '#d4af37', '#f4ecd8', '#ff6a4d', '#a46bff', '#e0364b'];

  const fireworksSystem = (L, durationMs) => {
    const rockets = [], sparks = [], flashes = [];
    let elapsed = 0, nextLaunch = 0.25;

    const launch = () => {
      const x = rand(0.08, 0.92) * L.w;
      rockets.push({ x, y: L.h + 10, sx: x, sy: L.h + 10, tx: x + rand(-60, 60), ty: rand(0.14, 0.5) * L.h, T: rand(0.8, 1.25), t: 0, color: pick(FW_COLORS) });
    };
    const burst = (x, y, color) => {
      const scale = clamp(Math.min(L.w, L.h) / 800, 0.7, 1.4);   // bigger bursts on bigger screens
      const n = Math.round(rand(80, 120)), maxV = rand(200, 360) * scale, second = Math.random() < 0.4 ? pick(FW_COLORS) : color;
      for (let i = 0; i < n; i++) {
        const a = rand(0, 6.2832), v = maxV * Math.sqrt(Math.random());
        sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: rand(1.2, 2.1), w: rand(1.6, 2.8), color: Math.random() < 0.7 ? color : second });
      }
      flashes.push({ x, y, t: 0, color });
    };

    const sys = {
      done: false,
      update(dt) {
        elapsed += dt;
        if (elapsed < durationMs / 1000) {
          nextLaunch -= dt;
          while (nextLaunch <= 0) {
            launch();
            if (elapsed < 1.5 && Math.random() < 0.5) launch();          // a quick opening volley
            nextLaunch += rand(0.3, 0.9) * (elapsed < 3 ? 0.7 : 1);
          }
        }
        for (let i = rockets.length - 1; i >= 0; i--) {
          const r = rockets[i];
          r.t += dt;
          const p = Math.min(1, r.t / r.T), e = 1 - (1 - p) * (1 - p);
          r.px = r.x; r.py = r.y;
          r.x = r.sx + (r.tx - r.sx) * e; r.y = r.sy + (r.ty - r.sy) * e;
          if (p >= 1) { burst(r.x, r.y, r.color); rockets.splice(i, 1); }
        }
        const drag = Math.exp(-1.8 * dt);
        for (let i = sparks.length - 1; i >= 0; i--) {
          const s = sparks[i];
          s.life += dt;
          s.vx *= drag; s.vy = s.vy * drag + 85 * dt;
          s.x += s.vx * dt; s.y += s.vy * dt;
          if (s.life >= s.max) sparks.splice(i, 1);
        }
        for (let i = flashes.length - 1; i >= 0; i--) { flashes[i].t += dt; if (flashes[i].t > 0.4) flashes.splice(i, 1); }
        sys.done = elapsed >= durationMs / 1000 && !rockets.length && !sparks.length && !flashes.length;
      },
      draw() {
        const ctx = L.ctx;
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        for (const f of flashes) {
          const k = 1 - f.t / 0.4, rad = 90 + 90 * (1 - k);
          const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, rad);
          g.addColorStop(0, f.color); g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = 0.28 * k; ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(f.x, f.y, rad, 0, 6.2832); ctx.fill();
        }
        for (const r of rockets) {
          ctx.globalAlpha = 0.9; ctx.strokeStyle = r.color; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(r.px, r.py); ctx.lineTo(r.x, r.y); ctx.stroke();
        }
        for (const s of sparks) {
          const k = 1 - s.life / s.max;
          ctx.globalAlpha = k * k; ctx.strokeStyle = s.color; ctx.lineWidth = s.w;
          ctx.beginPath(); ctx.moveTo(s.x - s.vx * 0.035, s.y - s.vy * 0.035); ctx.lineTo(s.x, s.y); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    };
    return sys;
  };

  const BALLOON_COLORS = ['#d4af37', '#f6d365', '#f4ecd8', '#c1272d', '#8a4bd6', '#e8590c'];

  const balloonsSystem = (L) => {
    const list = [], total = 18;
    let elapsed = 0, spawned = 0;
    const make = () => {
      const rx = rand(20, 34);
      return { x: rand(0.05, 0.95) * L.w, y: L.h + rx * 2.4, rx, ry: rx * 1.22, vy: rand(70, 140), sway: rand(10, 26), swayF: rand(0.6, 1.2), phase: rand(0, 6.28), t: 0, color: pick(BALLOON_COLORS) };
    };
    const sys = {
      done: false,
      update(dt) {
        elapsed += dt;
        while (spawned < total && elapsed > spawned * 0.4) { list.push(make()); spawned++; }   // released over ~7 seconds
        for (let i = list.length - 1; i >= 0; i--) {
          const b = list[i];
          b.t += dt; b.y -= b.vy * dt;
          if (b.y < -b.ry * 2 - 90) list.splice(i, 1);
        }
        sys.done = spawned >= total && !list.length;
      },
      draw() {
        const ctx = L.ctx;
        for (const b of list) {
          const sway = Math.sin(b.t * b.swayF + b.phase), x = b.x + sway * b.sway;
          ctx.save();
          ctx.translate(x, b.y);
          ctx.rotate(sway * 0.09);
          ctx.strokeStyle = 'rgba(244,236,216,.55)'; ctx.lineWidth = 1;          // string
          ctx.beginPath(); ctx.moveTo(0, b.ry + 7); ctx.quadraticCurveTo(-sway * 10, b.ry + 42, 0, b.ry + 80); ctx.stroke();
          ctx.fillStyle = b.color;                                                // knot + body
          ctx.beginPath(); ctx.moveTo(0, b.ry - 1); ctx.lineTo(-4.5, b.ry + 8); ctx.lineTo(4.5, b.ry + 8); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.ellipse(0, 0, b.rx, b.ry, 0, 0, 6.2832); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.3)';                                 // shine
          ctx.beginPath(); ctx.ellipse(-b.rx * 0.38, -b.ry * 0.38, b.rx * 0.16, b.ry * 0.28, 0.5, 0, 6.2832); ctx.fill();
          ctx.restore();
        }
      }
    };
    return sys;
  };

  const addCountdown = () => {
    banner = document.createElement('section');
    banner.className = 'season-banner';
    banner.setAttribute('role', 'timer');
    banner.setAttribute('aria-label', 'Countdown to the Argus Anniversary');
    banner.innerHTML =
      '<p class="sb-title">Argus Anniversary begins in</p>' +
      '<div class="season-clock"><div><b data-u="d">0</b><small>days</small></div><div><b data-u="h">00</b><small>hours</small></div>' +
      '<div><b data-u="m">00</b><small>minutes</small></div><div><b data-u="s">00</b><small>seconds</small></div></div>' +
      '<p class="sb-note"></p>';
    document.body.prepend(banner);

    // Next January 20 at 12:00 AM Alaska time (this year's if it hasn't happened yet).
    const now = Date.now(), year = alaskaDate(now).year;
    const target = now < anniversaryStart(year) ? anniversaryStart(year) : anniversaryStart(year + 1);

    let note = 'January 20, 12:00 AM Alaska time';
    try {
      if (Intl.DateTimeFormat().resolvedOptions().timeZone !== TZ) {
        note += ` (${new Intl.DateTimeFormat([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(target)} for you)`;
      }
    } catch { /* keep the Alaska-time note */ }
    banner.querySelector('.sb-note').textContent = note;

    const el = banner;
    const cell = (u) => el.querySelector(`[data-u="${u}"]`);
    const tick = () => {
      const ms = target - Date.now();
      if (ms <= 0) { start('anniversary'); return; }     // the anniversary just began: celebrate
      const s = Math.floor(ms / 1000);
      cell('d').textContent = Math.floor(s / 86400);
      cell('h').textContent = pad2(Math.floor(s % 86400 / 3600));
      cell('m').textContent = pad2(Math.floor(s % 3600 / 60));
      cell('s').textContent = pad2(s % 60);
    };
    tick();
    every(tick, 1000);
  };

  const addAnniversaryBanner = () => {
    banner = document.createElement('section');
    banner.className = 'season-banner party';
    banner.innerHTML = '<p class="sb-title">Happy Argus Anniversary!</p>';
    document.body.prepend(banner);
  };

  /* ================= switchboard ================= */

  function start(name) {
    teardown();
    active = name;
    if (!name || !onArgusPage) return;

    root = document.createElement('div');
    root.id = 'season-fx';
    root.setAttribute('aria-hidden', 'true');
    document.body.append(root);

    const still = reducedMotion();   // webs and banners are static, so they still show; everything that moves is skipped
    if (name === 'halloween') {
      addWebs();
      if (!still) addGhosts();
    } else if (name === 'thanksgiving') {
      if (!still) systems.push(leavesSystem(makeLayer('front')));
    } else if (name === 'winter') {
      if (!still) systems.push(snowSystem(makeLayer('front')));
    } else if (name === 'newyear') {
      addCountdown();
      if (!still) systems.push(fireworksSystem(makeLayer('back'), FIREWORKS_MS));
    } else if (name === 'anniversary') {
      addAnniversaryBanner();
      if (!still) { const back = makeLayer('back'); systems.push(fireworksSystem(back, FIREWORKS_MS), balloonsSystem(back)); }
    }
    if (still && ['halloween', 'thanksgiving', 'winter', 'newyear', 'anniversary'].includes(name)) {
      console.info('[ArgusSeason] Reduced motion is on in your system settings, so animated effects are paused.');
    }
    if (systems.length) { window.addEventListener('resize', onResize); startLoop(); }
  }

  const status = () => {
    const r = resolve();
    return r.override
      ? `Test override active: ${r.name || 'off'}. Reset with ArgusSeason.clear()`
      : `Automatic: ${r.name ? SEASONS[r.name].label : 'no seasonal effects this month'}`;
  };

  // Console / dev-page API
  window.ArgusSeason = {
    seasons: Object.keys(SEASONS),
    isValid: (name) => !!normalize(name),
    set(name) {
      const key = normalize(name);
      if (!key) return `Unknown season "${name}". Valid: ${Object.keys(SEASONS).join(', ')}`;
      writeCookie(key);
      start(resolve().name);
      return `Season set to ${key}${onArgusPage ? '' : '. Open an Argus page to see it'}.`;
    },
    clear() {
      clearCookie();
      start(resolve().name);
      return 'Test cookie cleared. ' + status();
    },
    current: status,
    help() {
      return [
        'Seasons: ' + Object.keys(SEASONS).map((k) => `${k} (${SEASONS[k].label})`).join('; '),
        `ArgusSeason.set("halloween")   set the test cookie and apply it now`,
        'ArgusSeason.clear()           remove the cookie and go back to the date',
        `or by hand: document.cookie = "${COOKIE}=halloween; path=/; max-age=86400"  (then reload)`,
        `reset by hand: document.cookie = "${COOKIE}=; path=/; max-age=0"  (then reload)`
      ].join('\n');
    }
  };

  /* ---------- go ---------- */
  const first = resolve();
  start(first.name);
  if (first.override && onArgusPage) {
    console.info(`[ArgusSeason] Test override "${first.name || 'off'}" is active. Reset with ArgusSeason.clear()`);
  }
  // Pick up month changes (and the Jan 20 switch) if the page stays open.
  setInterval(() => { const r = resolve(); if (r.name !== active) start(r.name); }, 30000);
})();
