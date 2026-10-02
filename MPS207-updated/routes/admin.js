const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { requireAdmin, checkCredentials } = require('../lib/auth');
const { getAllLeads, updateLeadStatus } = require('../lib/db');

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

router.get('/admin/login', (req, res) => {
  const errorParam = req.query.error ? '<p class="error">Incorrect username or password.</p>' : '';
  const html = fs.readFileSync(path.join(__dirname, '../views/admin-login.html'), 'utf8')
    .replace('<!--ERROR-->', errorParam);
  res.send(html);
});

router.post('/admin/login', express.urlencoded({ extended: true }), (req, res) => {
  const { username, password } = req.body;
  if (checkCredentials(username, password)) {
    req.session.isAdmin = true;
    return res.redirect('/admin/dashboard');
  }
  res.redirect('/admin/login?error=1');
});

router.post('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

router.get('/admin', (req, res) => res.redirect('/admin/dashboard'));

router.get('/admin/dashboard', requireAdmin, (req, res) => {
  const leads = getAllLeads();
  const statuses = ['New', 'Contacted', 'Scheduled', 'Completed', 'Not Interested'];

  const rows = leads.map((l) => {
    const options = statuses.map((s) =>
      `<option value="${s}" ${s === l.status ? 'selected' : ''}>${s}</option>`
    ).join('');

    return `
      <tr class="status-${l.status.replace(/\s+/g, '-').toLowerCase()}">
        <td>${new Date(l.created_at).toLocaleString('en-US', { timeZone: 'America/New_York' })}</td>
        <td>${escapeHtml(l.first_name)} ${escapeHtml(l.last_name)}</td>
        <td><a href="mailto:${escapeHtml(l.email)}">${escapeHtml(l.email)}</a></td>
        <td>${l.phone ? `<a href="tel:${escapeHtml(l.phone)}">${escapeHtml(l.phone)}</a>` : '—'}</td>
        <td>${escapeHtml(l.services) || '—'}</td>
        <td>${escapeHtml(l.preferred_date) || '—'}</td>
        <td class="msg-cell">${escapeHtml(l.message)}</td>
        <td>
          <form method="POST" action="/admin/leads/${l.id}/status" class="status-form">
            <select name="status">${options}</select>
            <button type="submit">Update</button>
          </form>
        </td>
      </tr>`;
  }).join('\n');

  const html = fs.readFileSync(path.join(__dirname, '../views/admin-dashboard.html'), 'utf8')
    .replace('<!--LEAD_ROWS-->', rows || '<tr><td colspan="8">No leads yet.</td></tr>')
    .replace('<!--LEAD_COUNT-->', String(leads.length));

  res.send(html);
});

router.post('/admin/leads/:id/status', requireAdmin, express.urlencoded({ extended: true }), (req, res) => {
  updateLeadStatus(req.params.id, req.body.status);
  res.redirect('/admin/dashboard');
});

module.exports = router;
