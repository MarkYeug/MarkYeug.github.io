// Reads the public WebNovel catalog and rewrites argus/data/chapters.json.
// Safety: on ANY problem this exits non-zero and leaves the existing file untouched.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { load } from 'cheerio';

export const BOOK = '35397598808248905', ORIGIN = 'https://www.webnovel.com';
export const CATALOG = process.env.CATALOG_URL || `${ORIGIN}/book/${BOOK}/catalog`;
export const OUT = 'argus/data/chapters.json';
export const MODE = process.env.MODE || 'http';            // http | browser
export const FORCE = process.env.FORCE === 'true';         // allow the chapter count to shrink
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const CHAPTER_PATH = new RegExp(`^/book/[^/]+_${BOOK}/([^/]+_\\d+)/?$`);

async function viaHttp() {
  const r = await fetch(CATALOG, { headers: { 'user-agent': UA, accept: 'text/html', 'accept-language': 'en-US,en;q=0.9' }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`WebNovel answered HTTP ${r.status}`);
  return r.text();
}
async function viaBrowser() {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent: UA,
      locale: 'en-US',
      viewport: { width: 1440, height: 1200 }
    });
    const page = await context.newPage();
    await page.goto(CATALOG, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForSelector(`a[href*="_${BOOK}/"]`, { timeout: 45000 });
    const html = await page.content();
    await context.close();
    return html;
  } finally { await browser.close(); }
}

export function parse(html) {
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
  let reg = 0;
  volumes.forEach(v => { if (!v.filler) v.n = ++reg; });
  for (let i = 0; i < volumes.length;) {
    if (!volumes[i].filler) { i++; continue; }
    let j = i; while (j < volumes.length && volumes[j].filler) j++; 
    const lo = i ? volumes[i - 1].n : 0;
    const hi = j < volumes.length ? volumes[j].n : lo + 1;
    const count = j - i;
    for (let k = i; k < j; k++) {
      const fraction = count === 1 ? 0.5 : (k - i + 1) / (count + 1);
      volumes[k].n = Number((lo + (hi - lo) * fraction).toFixed(2));
    }
    i = j;
  }
  volumes.forEach(v => delete v.filler);
  return volumes;
}

export async function refreshChapters({ outputPath = OUT, mode = MODE, force = FORCE, writeFile = true } = {}) {
  const volumes = parse(mode === 'browser' ? await viaBrowser() : await viaHttp());
  const total = v => v.reduce((s, x) => s + x.chapters.length, 0);
  const prev = outputPath && writeFile && existsSync(outputPath) ? JSON.parse(readFileSync(outputPath, 'utf8')) : null;
  if (prev && JSON.stringify(prev.volumes) === JSON.stringify(volumes)) {
    return { changed: false, total: total(volumes), volumes, source: CATALOG, updated: new Date().toISOString() };
  }
  if (prev && !force && total(volumes) < total(prev.volumes))
    throw new Error(`Found ${total(volumes)} chapters but the site has ${total(prev.volumes)}; keeping the current list. Re-run with force=true if chapters were really removed.`);
  if (writeFile) writeFileSync(outputPath, JSON.stringify({ schema: 1, source: CATALOG, updated: new Date().toISOString(), volumes }, null, 1) + '\n');
  return { changed: true, total: total(volumes), volumes, source: CATALOG, updated: new Date().toISOString() };
}

if (process.argv[1] && process.argv[1].endsWith('scripts/update-chapters.mjs')) {
  try {
    const result = await refreshChapters({ outputPath: OUT, mode: MODE, force: FORCE, writeFile: true });
    console.log(`Updated: ${result.total} chapters in ${result.volumes.length} volumes.`);
  } catch (e) {
    console.error('Chapter update failed:', e.message);
    process.exit(1);
  }
}
