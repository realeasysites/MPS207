const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[mailer] SMTP env vars not fully set — email notifications are disabled.');
    return null;
  }
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

async function sendLeadNotification(lead) {
  const t = getTransporter();
  const notifyTo = process.env.NOTIFY_EMAIL;
  if (!t || !notifyTo) {
    console.log('[mailer] Skipping email — not configured. New lead was still saved to the database:', lead);
    return;
  }

  const subject = `New MPS207 quote request — ${lead.first_name} ${lead.last_name}`;
  const text = [
    `New lead from mps207.com`,
    ``,
    `Name: ${lead.first_name} ${lead.last_name}`,
    `Email: ${lead.email}`,
    `Phone: ${lead.phone || '(not provided)'}`,
    `Services: ${lead.services || '(not specified)'}`,
    `Preferred date: ${lead.preferred_date || '(not specified)'}`,
    ``,
    `Message:`,
    lead.message,
  ].join('\n');

  try {
    await t.sendMail({
      from: process.env.SMTP_USER,
      to: notifyTo,
      replyTo: lead.email,
      subject,
      text,
    });
  } catch (err) {
    console.error('[mailer] Failed to send lead notification email:', err.message);
  }
}

module.exports = { sendLeadNotification };
