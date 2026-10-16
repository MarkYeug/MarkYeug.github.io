import nodemailer from 'nodemailer';
import { readFileSync, existsSync } from 'node:fs';

const EMAIL_TO = process.env.EMAIL_TO || 'fabusunyow@gmail.com';
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || 'noreply@localhost';
const SUBJECT = process.env.EMAIL_SUBJECT || 'Chapters have been refreshed!';
const TEXT = process.env.EMAIL_TEXT || 'Chapters have been refreshed!';
const DATA_PATH = process.env.CHAPTERS_PATH || 'argus/data/chapters.json';

// Same rule as the site (assets/main.js): a chapter can be slotted into the catalog out of
// sequence, so "latest" isn't always the last chapter in volume order. Prefer the real publish
// date when both chapters being compared have one; otherwise fall back to WebNovel's chapter ID,
// which is always assigned in publish order.
function chapterId(chapter) {
  if (chapter && typeof chapter.id === 'string' && chapter.id) return chapter.id;
  const m = typeof chapter?.url === 'string' ? chapter.url.match(/_(\d+)\/?$/) : null;
  return m ? m[1] : '0';
}
function laterOf(a, b) {
  const ad = a.published ? Date.parse(a.published) : NaN;
  const bd = b.published ? Date.parse(b.published) : NaN;
  if (!Number.isNaN(ad) && !Number.isNaN(bd)) return ad >= bd ? a : b;
  return BigInt(chapterId(a)) >= BigInt(chapterId(b)) ? a : b;
}
function latestChapterDetails() {
  if (!existsSync(DATA_PATH)) return null;
  try {
    const data = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
    const vols = Array.isArray(data.volumes) ? data.volumes : [];
    const chapters = vols.flatMap(v => Array.isArray(v.chapters) ? v.chapters : []);
    if (!chapters.length) return null;
    const lastChapter = chapters.reduce(laterOf);
    return { title: String(lastChapter.title || ''), url: String(lastChapter.url || ''), chapter: lastChapter.n };
  } catch {
    return null;
  }
}

const details = latestChapterDetails();
const chapterTitle = details?.title ? details.title : 'latest chapter';
const chapterUrl = details?.url ? details.url : 'unknown';
const finalSubject = SUBJECT.includes('{chapter_title}') ? SUBJECT.replace('{chapter_title}', chapterTitle) : SUBJECT;
const finalText = TEXT.includes('{chapter_title}') ? TEXT.replace('{chapter_title}', chapterTitle) : TEXT;
const finalTextWithUrl = finalText.includes('{chapter_url}') ? finalText.replace('{chapter_url}', chapterUrl) : finalText;
const finalBody = `${finalTextWithUrl}\n\nLatest chapter: ${chapterTitle}\nURL: ${chapterUrl}`;

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  console.log('SMTP configuration not set; skipping email notification.');
  process.exit(0);
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: Number(SMTP_PORT) === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS }
});

await transporter.sendMail({
  from: SMTP_FROM,
  to: EMAIL_TO,
  subject: finalSubject,
  text: finalBody
});

console.log(`Email sent to ${EMAIL_TO} for chapter: ${chapterTitle}`);
