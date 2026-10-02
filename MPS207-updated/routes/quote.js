const express = require('express');
const router = express.Router();
const { createLead } = require('../lib/db');
const { sendLeadNotification } = require('../lib/mailer');

router.post('/api/quote', async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      email,
      phone,
      services, // array or comma string from checkboxes
      preferred_date,
      message,
    } = req.body;

    if (!first_name || !last_name || !email || !message) {
      return res.status(400).json({ ok: false, error: 'Please fill in your name, email, and a short message.' });
    }

    const servicesStr = Array.isArray(services) ? services.join(', ') : (services || '');

    const lead = {
      first_name: String(first_name).trim(),
      last_name: String(last_name).trim(),
      email: String(email).trim(),
      phone: phone ? String(phone).trim() : null,
      services: servicesStr,
      preferred_date: preferred_date || null,
      message: String(message).trim(),
    };

    const id = createLead(lead);
    sendLeadNotification(lead).catch(() => {});

    res.json({ ok: true, id });
  } catch (err) {
    console.error('[quote] Failed to save lead:', err);
    res.status(500).json({ ok: false, error: 'Something went wrong submitting your request. Please call/text (207) 504-7586 directly.' });
  }
});

module.exports = router;
