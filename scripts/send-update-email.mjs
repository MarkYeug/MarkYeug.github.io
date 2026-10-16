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

// "Latest" is determined ONLY by the numeric ID at the very end of the literal WebNovel chapter URL.
// Do not use the displayed chapter number (chapter.n), catalog order, stored ID fields, or publish dates.
// IDs exceed Number.MAX_SAFE_INTEGER, so compare them as BigInt.
function chapterId(chapter) {
  const m = typeof chapter?.url === 'string' ? chapter.url.match(/_(\d+)\/?$/) : null;
  return m ? m[1] : '0';
}
// Highest WebNovel chapter ID always defines the latest chapter, regardless of publish-date metadata.
function laterOf(a, b) {
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
