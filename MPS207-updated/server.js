require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const quoteRoutes = require('./routes/quote');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 }, // 8 hours
}));

// Static site (public/index.html, /about -> about.html, etc.)
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.use(quoteRoutes);
app.use(adminRoutes);

// 404 fallback
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.listen(PORT, () => {
  console.log(`MPS207 site running on http://localhost:${PORT}`);
});
