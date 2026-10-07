const nodemailer = require('nodemailer');

// Same setup as the Loria Construction site: Gmail SMTP with an app password.
//   SMTP_HOST=smtp.gmail.com  SMTP_PORT=465  SMTP_SECURE=true
//   SMTP_USER=<sending Gmail address>  SMTP_PASS=<16-character Gmail app password>
//   NOTIFY_EMAIL=<inbox that gets each new estimate request>
//   MAIL_FROM (optional)  e.g. "MPS207 Website <sender@gmail.com>"
//   SITE_URL  (optional)  e.g. https://mps207.com — adds a "open dashboard" link

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

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function sendLeadNotification(lead) {
  const t = getTransporter();
  const notifyTo = process.env.NOTIFY_EMAIL;
  if (!t || !notifyTo) {
    // Don't write the customer's details into the server logs — the lead is in the dashboard.
    console.log('[mailer] Email not configured — new estimate request saved to the dashboard only.');
    return;
  }

  const name = `${lead.first_name} ${lead.last_name}`.trim();
  const subject = `New estimate request: ${name}${lead.services ? ' — ' + lead.services : ''}`;
  const siteUrl = (process.env.SITE_URL || '').replace(/\/+$/, '');

  const text = [
    'New estimate request from the MPS207 website',
    '',
    `Name: ${name}`,
    `Phone: ${lead.phone || '(not provided)'}`,
    `Email: ${lead.email}`,
    `Services: ${lead.services || '(not specified)'}`,
    `Preferred date: ${lead.preferred_date || '(not specified)'}`,
    '',
    'Message:',
    lead.message,
    '',
    'Hit Reply to answer the customer directly.',
    siteUrl ? `Lead dashboard: ${siteUrl}/admin` : '',
  ].join('\n');

  const row = (k, v) =>
    `<tr><td style="color:#666;width:34%;padding:6px 8px;vertical-align:top"><b>${k}</b></td><td style="padding:6px 8px">${v}</td></tr>`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px">
      <div style="background:#141414;color:#fff;padding:16px 20px;font-weight:bold;font-size:18px;border-bottom:4px solid #e4141b">
        MPS<span style="color:#e4141b">207</span> · New estimate request
      </div>
      <div style="padding:18px 20px;border:1px solid #e5e5e5;border-top:0">
        <table cellpadding="0" style="border-collapse:collapse;width:100%">
          ${row('Name', esc(name))}
          ${row('Phone', lead.phone ? `<a href="tel:${esc(lead.phone)}">${esc(lead.phone)}</a>` : '—')}
          ${row('Email', `<a href="mailto:${esc(lead.email)}">${esc(lead.email)}</a>`)}
          ${row('Services', esc(lead.services || '—'))}
          ${row('Preferred date', esc(lead.preferred_date || '—'))}
        </table>
        <h3 style="margin:18px 0 6px">Message</h3>
        <p style="white-space:pre-wrap;margin:0">${esc(lead.message)}</p>
        <p style="margin-top:20px;color:#666;font-size:13px">Hit <b>Reply</b> to answer the customer directly.</p>
        ${siteUrl ? `<p style="margin-top:6px"><a href="${esc(siteUrl)}/admin" style="color:#e4141b;font-weight:bold">Open lead dashboard →</a></p>` : ''}
      </div>
    </div>`;

  try {
    await t.sendMail({
      from: process.env.MAIL_FROM || `"MPS207 Website" <${process.env.SMTP_USER}>`,
      to: notifyTo,
      replyTo: lead.email,
      subject,
      text,
      html,
    });
    console.log('[mailer] Estimate request emailed to NOTIFY_EMAIL.');
  } catch (err) {
    console.error('[mailer] Failed to send lead notification email:', err.message);
  }
}

module.exports = { sendLeadNotification };
