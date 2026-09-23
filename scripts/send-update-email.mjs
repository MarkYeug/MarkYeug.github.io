import nodemailer from 'nodemailer';

const EMAIL_TO = process.env.EMAIL_TO || 'fabusunyow@gmail.com';
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || 'noreply@localhost';
const SUBJECT = process.env.EMAIL_SUBJECT || 'Website update notification';
const TEXT = process.env.EMAIL_TEXT || 'A site update check completed.';

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  console.error('Missing SMTP configuration: SMTP_HOST, SMTP_USER, and SMTP_PASS are required.');
  process.exit(1);
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
  subject: SUBJECT,
  text: TEXT
});

console.log(`Email sent to ${EMAIL_TO}`);
