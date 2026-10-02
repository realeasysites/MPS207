const db = require('../db/init');

function createLead(lead) {
  const stmt = db.prepare(`
    INSERT INTO leads (first_name, last_name, email, phone, services, preferred_date, message)
    VALUES (@first_name, @last_name, @email, @phone, @services, @preferred_date, @message)
  `);
  const info = stmt.run(lead);
  return info.lastInsertRowid;
}

function getAllLeads() {
  return db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all();
}

function getLead(id) {
  return db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
}

function updateLeadStatus(id, status) {
  db.prepare('UPDATE leads SET status = ? WHERE id = ?').run(status, id);
}

module.exports = { createLead, getAllLeads, getLead, updateLeadStatus };
