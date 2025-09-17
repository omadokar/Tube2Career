// notifService.js
require('dotenv').config();
const nodemailer = require('nodemailer');

let admin = null; // injected from server.js
let db = null;

// --- INIT FUNCTION (called from server.js after Firebase is initialized) ---
function init(firebaseAdmin) {
  admin = firebaseAdmin;
  db = admin.firestore();
}

// --- EMAIL (Nodemailer) ---
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendEmail(to, subject, text, html) {
  if (!process.env.EMAIL_USER) return;
  const info = await transporter.sendMail({
    from: `"Tube2Career" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  });
  return info;
}

// --- FETCH SUBSCRIBERS ---
async function fetchSubscribers() {
  if (!db) throw new Error("Firebase not initialized in notifService");
  const snap = await db.collection('subscribers').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// --- MAIN NOTIFY FUNCTION ---
async function notifyAll(payload = {}) {
  const subs = await fetchSubscribers();
  const { type, title } = payload;

  const titleText = type === 'job'
    ? `New Job: ${title}`
    : `New Video: ${title}`;

  const messagePlain =
    type === 'job'
      ? `${title}\n\n${payload.description || ''}\nApply: ${payload.applyLink || ''}`
      : `${title}\nWatch: ${payload.link || ''}`;

  // Deduplicate by email
  const seenEmails = new Set();

  for (const s of subs) {
    if (!s.email || seenEmails.has(s.email)) continue; // skip duplicates
    seenEmails.add(s.email);

    try {
      await sendEmail(
        s.email,
        titleText,
        messagePlain,
        `<b>${title}</b><br/><p>${payload.description || ''}</p><p><a href="${payload.applyLink || payload.link || '#'}">Open</a></p>`
      );
    } catch (err) {
      console.error('Notify error for subscriber', s.id, err);
    }
  }
}


module.exports = { init, notifyAll, sendEmail };
