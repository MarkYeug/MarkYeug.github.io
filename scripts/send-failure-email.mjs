// Emails an alert when the "Update chapter list" workflow fails.
// Unlike send-update-email.mjs, missing SMTP settings are an error here (exit 1), not a silent skip,
// so a broken alert setup shows up as a red run instead of going unnoticed.
import nodemailer from 'nodemailer';

const {
  SMTP_HOST, SMTP_PORT = '587', SMTP_USER, SMTP_PASS, SMTP_FROM,
  EMAIL_TO = 'markyeug@gmail.com', FAILED = '', TRIGGER = '', REPO = '', RUN_URL = ''
} = process.env;

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  console.error('Cannot send the failure email: SMTP_HOST, SMTP_USER and SMTP_PASS must be set as repository secrets.');
  process.exit(1);
}

const when = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Anchorage', dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
const what = FAILED || 'A setup step (checkout or install) failed, or the run timed out, before the chapter steps finished. The run log has the details.';
const how = TRIGGER === 'workflow_dispatch' ? 'a manual run' : 'the 3-hour schedule';

const text = [
  'The "Update chapter list" workflow failed.',
  '',
  `What failed: ${what}`,
  `Started by: ${how}`,
  `When: ${when} (Alaska time)`,
  `Run log: ${RUN_URL}`,
  '',
  'Any chapter list that could not be refreshed keeps its previous data. The next scheduled run will try again.'
].join('\n');

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: Number(SMTP_PORT) === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS }
});

await transporter.sendMail({
  from: SMTP_FROM || SMTP_USER,
  to: EMAIL_TO,
  subject: `Update chapter list failed${REPO ? ` (${REPO})` : ''}`,
  text
});

console.log(`Failure email sent to ${EMAIL_TO}.`);
