// Reads the public WebNovel catalog and rewrites argus/data/chapters.json.
// Safety: on ANY problem this exits non-zero and leaves the existing file untouched.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { load } from 'cheerio';

const BOOK = '35397598808248905', ORIGIN = 'https://www.webnovel.com';
const CATALOG = process.env.CATALOG_URL || `${ORIGIN}/book/${BOOK}/catalog`;
const OUT = 'argus/data/chapters.json';
const MODE = process.env.MODE || 'http';            // http | browser
const FORCE = process.env.FORCE === 'true';         // allow the chapter count to shrink
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const CHAPTER_PATH = new RegExp(`^/book/[^/]+_${BOOK}/([^/]+_\\d+)/?$`);

async function viaHttp() {
  const r = await fetch(CATALOG, { headers: { 'user-agent': UA, accept: 'text/html', 'accept-language': 'en-US,en;q=0.9' }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`WebNovel answered HTTP ${r.status}`);
  return r.text();
}
async function viaBrowser() {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext({ userAgent: UA })).newPage();
    await page.goto(CATALOG, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector(`a[href*="_${BOOK}/"]`, { timeout: 45000 });
    return await page.content();
  } finally { await browser.close(); }
}

function parse(html) {
  const $ = load(html), clean = s => (s || '').replace(/\s+/g, ' ').trim();
  const vols = $('.volume-item').length
    ? $('.volume-item').toArray().map(v => ({ title: clean($(v).find('h4').first().text()), links: $(v).find('a').toArray() }))
    : [{ title: '', links: $('a').toArray() }];
  const seen = new Set(), volumes = []; let n = 0;
  for (const v of vols) {
    const chapters = [];
    for (const a of v.links) {
      const u = new URL($(a).attr('href') || '', ORIGIN), id = u.pathname.match(CHAPTER_PATH)?.[1];
      if (!id || seen.has(id)) continue;
      let title = clean($(a).attr('title') || $(a).text());
      const m = title.match(/^chapter\s*(\d+)\s*[:.\-–—]?\s*(.+)$/i);
      if (m) title = m[2];
      if (!title) continue;
      seen.add(id); n = m ? +m[1] : n + 1;
      chapters.push({ n, title, url: ORIGIN + u.pathname });
    }
    if (!chapters.length) continue;
    const vm = v.title.match(/^volume\s*(\d+)\s*[:.\-–—]?\s*(.*)$/i);
    volumes.push({ n: 0, name: vm ? vm[2] : v.title, filler: /\bfiller\b/i.test(v.title), chapters });
  }
  if (!volumes.length) throw new Error(`No chapters found on the page (title: "${clean($('title').text())}"). WebNovel may be blocking this request, or its page layout changed.`);
  // Numbering: regular volumes count 1, 2, 3... Filler volumes sit between their neighbours:
  // one filler after Volume 2 -> 2.5; two fillers before Volume 3 -> 2.33 and 2.67.
  let reg = 0;
  volumes.forEach(v => { if (!v.filler) v.n = ++reg; });
  for (let i = 0; i < volumes.length;) {
    if (!volumes[i].filler) { i++; continue; }
    let j = i; while (j < volumes.length && volumes[j].filler) j++;      // filler run = i .. j-1
    const lo = i ? volumes[i - 1].n : 0, hi = j < volumes.length ? volumes[j].n : lo + 1;
    for (let k = i; k < j; k++) volumes[k].n = Math.round((lo + (hi - lo) * (k - i + 1) / (j - i + 1)) * 100) / 100;
    i = j;
  }
  volumes.forEach(v => delete v.filler);
  return volumes;
}

try {
  const volumes = parse(MODE === 'browser' ? await viaBrowser() : await viaHttp());
  const total = v => v.reduce((s, x) => s + x.chapters.length, 0);
  const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;
  if (prev && JSON.stringify(prev.volumes) === JSON.stringify(volumes)) { console.log(`No change (${total(volumes)} chapters).`); process.exit(0); }
  if (prev && !FORCE && total(volumes) < total(prev.volumes))
    throw new Error(`Found ${total(volumes)} chapters but the site has ${total(prev.volumes)}; keeping the current list. Re-run with force=true if chapters were really removed.`);
  writeFileSync(OUT, JSON.stringify({ schema: 1, source: CATALOG, updated: new Date().toISOString(), volumes }, null, 1) + '\n');
  console.log(`Updated: ${total(volumes)} chapters in ${volumes.length} volumes.`);
} catch (e) { console.error('Chapter update failed:', e.message); process.exit(1); }
