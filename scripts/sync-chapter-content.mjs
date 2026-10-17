// Sync published Argus chapter prose from public WebNovel chapter pages.
// Uses ordinary browser navigation; it does not log in, bypass challenges, or unlock paid chapters.
// Missing chapters are retried on later runs. The newest three chapters are refreshed on each scheduled run.
import { readFileSync, writeFileSync } from "node:fs";
import { load } from "cheerio";
import { chromium } from "playwright";

const CATALOG_PATH = process.env.CATALOG_PATH || "argus/data/chapters.json";
const OUT = process.env.CONTENT_OUT || "argus/data/chapter-content.json";
const SYNC_ALL = process.env.SYNC_ALL === "true";
const RECENT_COUNT = Number(process.env.RECENT_COUNT || 3);
const DELAY_MS = Number(process.env.DELAY_MS || 1100);
const ALLOWED_TAGS = new Set(["p","br","strong","b","em","i","u","s","blockquote","h2","h3","hr","ul","ol","li","span"]);

function sanitizeHtml(html) {
  const $ = load(html, null, false);
  $("script,style,iframe,object,embed,form,button,svg,video,audio").remove();
  $("*").each((_, element) => {
    const node = $(element);
    const tag = element.tagName?.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      node.replaceWith(node.contents());
      return;
    }
    for (const attr of Object.keys(element.attribs || {})) node.removeAttr(attr);
  });
  return $.root().html() || "";
}

function flattenCatalog(catalog) {
  return (catalog.volumes || []).flatMap(volume => volume.chapters || [])
    .filter(chapter => chapter.url && chapter.n !== undefined)
    .sort((a,b) => Number(a.n) - Number(b.n));
}

const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
const chapters = flattenCatalog(catalog);
if (!chapters.length) throw new Error("Chapter catalog is empty; refusing to sync prose.");
let stored = { schema: 1, source: "WebNovel published chapter pages", updated: null, chapters: {} };
try { stored = JSON.parse(readFileSync(OUT, "utf8")); } catch {}
if (!stored.chapters || typeof stored.chapters !== "object") stored.chapters = {};
const recentIds = new Set(chapters.slice(-RECENT_COUNT).map(ch => String(ch.n)));
const targets = chapters.filter(ch => SYNC_ALL || !stored.chapters[String(ch.n)]?.html || recentIds.has(String(ch.n)));
if (!targets.length) {
  console.log("All chapter text is present; no chapter pages need refreshing.");
  process.exit(0);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: "en-US", viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.setDefaultNavigationTimeout(45000);
let saved = 0, failed = 0;
try {
  for (const chapter of targets) {
    const key = String(chapter.n);
    try {
      console.log("Fetching #" + chapter.n + ": " + chapter.title);
      const response = await page.goto(chapter.url, { waitUntil: "domcontentloaded", timeout: 45000 });
      if (response && response.status() >= 400) throw new Error("HTTP " + response.status());
      await page.waitForSelector(".cha-words", { state: "attached", timeout: 18000 });
      const raw = await page.locator(".cha-words").first().innerHTML();
      const html = sanitizeHtml(raw).trim();
      const $ = load(html, null, false);
      const paragraphs = $("p").toArray().filter(p => $(p).text().trim());
      const textLength = $("body").text().trim().length;
      if (!paragraphs.length || textLength < 30) {
        const title = await page.title().catch(() => "");
        throw new Error("Chapter text was empty or unexpected (page title: " + title + ")");
      }
      stored.chapters[key] = {
        title: chapter.title,
        source_url: chapter.url,
        fetched_at: new Date().toISOString(),
        html
      };
      saved++;
    } catch (error) {
      failed++;
      console.warn("Could not sync #" + chapter.n + ": " + error.message);
      // Keep previously synced content intact. A missing chapter will be retried next run.
    }
    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
  }
} finally {
  await context.close();
  await browser.close();
}
if (saved) {
  stored.schema = 1;
  stored.source = "WebNovel published chapter pages";
  stored.updated = new Date().toISOString();
  writeFileSync(OUT, JSON.stringify(stored, null, 2) + "\n");
}
console.log("Chapter prose sync complete: " + saved + " updated, " + failed + " unavailable, " + Object.keys(stored.chapters).length + " stored total.");
if (!saved && failed) console.warn("No chapter text was updated. Existing content was left untouched.");
